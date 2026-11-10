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

/** One animation frame loop serves every moving avatar. */
function subscribeFrames(subscriber: FrameSubscriber): () => void {
  subscribers.add(subscriber);
  if (!frame) frame = window.requestAnimationFrame(tick);
  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size > 0 || !frame) return;
    window.cancelAnimationFrame(frame);
    frame = 0;
  };
}

/**
 * Where an avatar watches the pointer: an explicit `data-avatar-look-region` ancestor (a profile
 * panel), else the row or control it sits in (a sidebar conversation), else the avatar itself.
 */
const LOOK_REGION = "[data-avatar-look-region]";
const INTERACTIVE_ROW = 'a, button, [role="button"], [role="link"], [role="option"]';

export function applyOrganicFrame(svg: SVGSVGElement, next: OrganicFrame) {
  svg.querySelector("[data-organic-turn]")?.setAttribute("transform", next.turn);
  for (const body of svg.querySelectorAll("[data-organic-body]"))
    body.setAttribute("transform", next.body);
  svg.querySelector("[data-organic-face]")?.setAttribute("transform", next.face);
  svg.querySelectorAll<SVGRectElement>("[data-organic-eye]").forEach((element, index) => {
    const eye = next.eyes[index];
    if (!eye) return;
    element.setAttribute("x", String(eye.x));
    element.setAttribute("y", String(eye.y));
    element.setAttribute("width", String(eye.width));
    element.setAttribute("height", String(eye.height));
    element.setAttribute("rx", String(eye.rx));
    element.setAttribute("transform", eye.transform);
    element.setAttribute("opacity", String(eye.opacity));
  });
}

/**
 * Drives an organic avatar each frame while `enabled` (on screen, large enough, motion allowed).
 * React renders the resting pose; this writes straight to the SVG so the avatar never re-renders
 * to move. When it stops, the avatar returns to its resting pose.
 */
export function useOrganicMotion(
  ref: RefObject<SVGSVGElement | null>,
  family: number,
  seed: number,
  working: boolean,
  enabled: boolean,
) {
  const workingRef = useRef(working);
  workingRef.current = working;
  useEffect(() => {
    const svg = ref.current;
    if (!enabled || !svg || typeof window === "undefined") return;
    const region: Element = svg.closest(LOOK_REGION) ?? svg.closest(INTERACTIVE_ROW) ?? svg;
    let pointer: { x: number; y: number } | null = null;
    const onMove = (event: Event) => {
      const move = event as PointerEvent;
      if (move.pointerType === "mouse") pointer = { x: move.clientX, y: move.clientY };
    };
    const onLeave = () => {
      pointer = null;
    };
    region.addEventListener("pointermove", onMove, { passive: true });
    region.addEventListener("pointerleave", onLeave);

    const motion = createOrganicMotion(seed, performance.now() / 1000);
    let aim: { yaw: number; pitch: number } | null = null;
    const unsubscribe = subscribeFrames({
      read() {
        if (!pointer) {
          aim = null;
          return;
        }
        const box = svg.getBoundingClientRect();
        aim = pointerGaze(
          pointer.x - (box.left + box.width / 2),
          pointer.y - (box.top + box.height / 2),
          box.width,
        );
      },
      write(seconds) {
        const pose = stepOrganicMotion(motion, seconds, workingRef.current, aim);
        applyOrganicFrame(svg, organicFrame(family, pose));
      },
    });
    return () => {
      unsubscribe();
      region.removeEventListener("pointermove", onMove);
      region.removeEventListener("pointerleave", onLeave);
      applyOrganicFrame(svg, organicFrame(family, restPose()));
    };
  }, [ref, family, seed, enabled]);
}
