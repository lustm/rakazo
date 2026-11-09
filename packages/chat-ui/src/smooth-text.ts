import { useEffect, useRef, useState } from "react";

/** Slowest reveal rate, in characters per second, while there is anything left to show. */
const MIN_CHARS_PER_SECOND = 60;
/** How fast a backlog drains: the rate grows with what is still hidden (about 0.25 s to catch up). */
const BACKLOG_DRAIN_PER_SECOND = 4;
/** Re-render at most this often; parsing the last block every frame is not worth it. */
const FRAME_INTERVAL_MS = 32;

function prefersReducedMotion(): boolean {
  try {
    return (
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  } catch {
    return false;
  }
}

/** Never end inside a UTF-16 surrogate pair, so an emoji is never drawn as half a character. */
export function safeTextEnd(text: string, end: number): number {
  if (end <= 0) return 0;
  if (end >= text.length) return text.length;
  const code = text.charCodeAt(end - 1);
  return code >= 0xd800 && code <= 0xdbff ? end + 1 : end;
}

/** How many characters to reveal next, given how long it has been since the last reveal. */
export function nextRevealLength(shown: number, total: number, elapsedMs: number): number {
  const backlog = total - shown;
  if (backlog <= 0) return total;
  const rate = Math.max(MIN_CHARS_PER_SECOND, backlog * BACKLOG_DRAIN_PER_SECOND);
  const step = Math.max(1, Math.round((elapsedMs / 1000) * rate));
  return Math.min(total, shown + step);
}

/**
 * Reveals streamed text at a steady pace instead of in network-sized bursts.
 *
 * Text present when the hook mounts is shown at once; only text that arrives afterwards is paced.
 * Once `active` has been true the hook keeps draining after it turns false, so a reply's tail is
 * not dumped in one frame when the stream ends. Text that does not extend what is shown (an edit,
 * a different message) is shown immediately. Reduced motion shows everything at once.
 */
export function useSmoothText(text: string, active: boolean): string {
  const [shown, setShown] = useState(text.length);
  const shownRef = useRef(text.length);
  const textRef = useRef(text);
  const pacedRef = useRef(active);
  const frameRef = useRef(0);
  const lastRef = useRef(0);
  if (active) pacedRef.current = true;

  // Anything that does not extend the visible text replaces it outright.
  const replaced = !text.startsWith(textRef.current.slice(0, shownRef.current));
  if (replaced) shownRef.current = text.length;
  textRef.current = text;

  useEffect(() => {
    if (!pacedRef.current || prefersReducedMotion() || shownRef.current >= text.length) {
      shownRef.current = text.length;
      setShown(text.length);
      return;
    }
    // One loop drains everything; new text only extends what it is draining towards.
    if (frameRef.current) return;
    lastRef.current = performance.now();
    const tick = (now: number) => {
      const elapsed = now - lastRef.current;
      if (elapsed >= FRAME_INTERVAL_MS) {
        const current = textRef.current;
        const next = safeTextEnd(
          current,
          nextRevealLength(shownRef.current, current.length, elapsed),
        );
        shownRef.current = next;
        lastRef.current = now;
        setShown(next);
        if (next >= current.length) {
          frameRef.current = 0;
          return;
        }
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [text]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    },
    [],
  );

  if (replaced || shown >= text.length) return text;
  return text.slice(0, safeTextEnd(text, shown));
}
