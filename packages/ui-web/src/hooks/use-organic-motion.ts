import type { RefObject } from "react";
import { useEffect, useRef } from "react";
import type { OrganicFrame } from "../organic-motion.js";
import {
  createOrganicMotion,
  organicFrame,
  pointerGaze,
  restPose,
  stepOrganicMotion,
} from "../organic-motion.js";

interface FrameSubscriber {
  /** Layout reads for this frame; every read runs before any write so frames never thrash. */
  read(): void;
  write(seconds: number): void;
}

const subscribers = new Set<FrameSubscriber>();
let frame = 0;

function tick(ms: number) {
  frame = subscribers.size > 0 ? window.requestAnimationFrame(tick) : 0;
  for (const subscriber of subscribers) subscriber.read();
  for (const subscriber of subscribers) subscriber.write(ms / 1000);
}

/** The mouse pointer every moving avatar watches; touch and pen leave the eyes alone. */
const pointer = { x: 0, y: 0, inside: false };
const onPointerMove = (event: PointerEvent) => {
  if (event.pointerType !== "mouse") return;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.inside = true;
};
const onPointerOut = (event: PointerEvent) => {
  if (!event.relatedTarget) pointer.inside = false;
};
const onBlur = () => {
  pointer.inside = false;
};

/** One animation frame loop and one set of pointer listeners serve every moving avatar. */
function subscribeFrames(subscriber: FrameSubscriber): () => void {
  if (subscribers.size === 0) {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerout", onPointerOut, { passive: true });
    window.addEventListener("blur", onBlur);
  }
  subscribers.add(subscriber);
  if (!frame) frame = window.requestAnimationFrame(tick);
  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size > 0) return;
    window.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerout", onPointerOut);
    window.removeEventListener("blur", onBlur);
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
  };
}

function applyFrame(svg: SVGSVGElement, next: OrganicFrame) {
  const body = svg.querySelector<SVGGElement>("[data-organic-body]");
  body?.setAttribute("transform", next.body);
  body?.setAttribute("opacity", String(next.bodyOpacity));
  svg
    .querySelector<SVGGElement>("[data-organic-eyes]")
    ?.setAttribute("opacity", String(next.eyesOpacity));
  svg.querySelectorAll<SVGRectElement>("[data-organic-eye]").forEach((eye, index) => {
    const transform = next.eyes[index];
    if (transform) eye.setAttribute("transform", transform);
  });
  svg.querySelectorAll<SVGCircleElement>("[data-organic-dot]").forEach((dot, index) => {
    const pose = next.dots[index];
    if (!pose) return;
    dot.setAttribute("cx", String(pose.cx));
    dot.setAttribute("cy", String(pose.cy));
    dot.setAttribute("r", String(pose.r));
    dot.setAttribute("opacity", String(pose.opacity));
  });
}

/**
 * Drives an organic avatar's face and body each frame while `enabled` (on screen, large enough,
 * motion allowed). React renders the resting pose; this writes straight to the SVG so the avatar
 * never re-renders to move. When it stops, the avatar returns to its resting pose.
 */
export function useOrganicMotion(
  ref: RefObject<SVGSVGElement | null>,
  seed: number,
  working: boolean,
  enabled: boolean,
) {
  const workingRef = useRef(working);
  workingRef.current = working;
  useEffect(() => {
    const svg = ref.current;
    if (!enabled || !svg || typeof window === "undefined") return;
    const motion = createOrganicMotion(seed, workingRef.current, performance.now() / 1000);
    let aim: { yaw: number; pitch: number } | null = null;
    const unsubscribe = subscribeFrames({
      read() {
        if (!pointer.inside) {
          aim = null;
          return;
        }
        const box = svg.getBoundingClientRect();
        aim = pointerGaze(
          pointer.x - (box.left + box.width / 2),
          pointer.y - (box.top + box.height / 2),
          window.innerWidth / 2,
          window.innerHeight / 2,
        );
      },
      write(seconds) {
        applyFrame(svg, organicFrame(stepOrganicMotion(motion, seconds, workingRef.current, aim)));
      },
    });
    return () => {
      unsubscribe();
      applyFrame(svg, organicFrame(restPose(workingRef.current)));
    };
  }, [ref, seed, enabled]);
}
