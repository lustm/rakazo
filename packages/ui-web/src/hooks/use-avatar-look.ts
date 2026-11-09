import type { RefObject } from "react";
import { useEffect } from "react";

/**
 * Where an avatar watches the pointer: an explicit `data-avatar-look-region` ancestor (a profile
 * panel), else the row or control it sits in (a sidebar conversation), else the avatar itself.
 */
const LOOK_REGION = "[data-avatar-look-region]";
const INTERACTIVE_ROW = 'a, button, [role="button"], [role="link"], [role="option"]';

/** How far the pointer must be, in avatar widths, before the eyes reach their full offset. */
const FULL_REACH_AVATAR_WIDTHS = 1.25;

export interface AvatarLookRange {
  /** Largest horizontal eye offset, in the avatar's viewBox units. */
  x: number;
  /** Largest vertical eye offset, in the avatar's viewBox units. */
  y: number;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** The eye offset, in viewBox units, for a pointer at (dx, dy) px from an avatar `width` px wide. */
export function avatarLookOffset(
  dx: number,
  dy: number,
  width: number,
  range: AvatarLookRange,
): { x: number; y: number } {
  const distance = Math.hypot(dx, dy);
  if (distance < 0.5 || width <= 0) return { x: 0, y: 0 };
  const reach = Math.min(1, distance / (width * FULL_REACH_AVATAR_WIDTHS));
  return {
    x: (dx / distance) * reach * range.x,
    y: (dy / distance) * reach * range.y,
  };
}

/**
 * Turns an avatar's eyes toward a mouse pointer moving over it or its row. The avatar's
 * `.rakazo-avatar-look` group reads `--look-x` / `--look-y` (viewBox units) and `data-looking`;
 * updates are written straight to the element once per frame, so React never re-renders.
 * Touch and pen input and reduced motion leave the eyes where they are.
 */
export function useAvatarLook(
  ref: RefObject<Element | null>,
  range: AvatarLookRange,
  enabled = true,
) {
  const { x: rangeX, y: rangeY } = range;
  useEffect(() => {
    const avatar = ref.current as (HTMLElement | SVGElement) | null;
    if (!enabled || !avatar || typeof window === "undefined") return;
    const region: Element =
      avatar.closest(LOOK_REGION) ?? avatar.closest(INTERACTIVE_ROW) ?? avatar;
    let frame = 0;
    let pointer: { x: number; y: number } | null = null;

    const apply = () => {
      frame = 0;
      if (!pointer) return;
      const box = avatar.getBoundingClientRect();
      const offset = avatarLookOffset(
        pointer.x - (box.left + box.width / 2),
        pointer.y - (box.top + box.height / 2),
        box.width,
        { x: rangeX, y: rangeY },
      );
      avatar.style.setProperty("--look-x", `${offset.x.toFixed(2)}px`);
      avatar.style.setProperty("--look-y", `${offset.y.toFixed(2)}px`);
      avatar.dataset.looking = "true";
    };
    const onMove = (event: Event) => {
      const move = event as PointerEvent;
      if (move.pointerType !== "mouse" || prefersReducedMotion()) return;
      pointer = { x: move.clientX, y: move.clientY };
      if (!frame) frame = window.requestAnimationFrame(apply);
    };
    const onLeave = () => {
      pointer = null;
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      avatar.style.removeProperty("--look-x");
      avatar.style.removeProperty("--look-y");
      delete avatar.dataset.looking;
    };

    region.addEventListener("pointermove", onMove);
    region.addEventListener("pointerleave", onLeave);
    return () => {
      region.removeEventListener("pointermove", onMove);
      region.removeEventListener("pointerleave", onLeave);
      onLeave();
    };
  }, [ref, rangeX, rangeY, enabled]);
}
