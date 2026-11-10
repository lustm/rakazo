import { organicRestEyes, organicRestPose } from "@rakazo/core";
import { describe, expect, it } from "vitest";
import {
  BLINK_DURATION,
  blinkLid,
  createOrganicMotion,
  LOOK_PITCH,
  LOOK_YAW,
  mulberry32,
  nextBlinkDelay,
  organicFrame,
  pointerGaze,
  restPose,
  squashAmount,
  stepOrganicMotion,
} from "./organic-motion.js";

const run = (
  motion: ReturnType<typeof createOrganicMotion>,
  from: number,
  to: number,
  working: boolean,
  aim: { yaw: number; pitch: number } | null = null,
) => {
  let pose = stepOrganicMotion(motion, from, working, aim);
  for (let t = from; t <= to; t += 1 / 60) pose = stepOrganicMotion(motion, t, working, aim);
  return pose;
};

describe("organic avatar motion", () => {
  it("rests in its body's own pose, with the portrait's face", () => {
    const rest = organicRestPose(2);
    const frame = organicFrame(2, restPose(2));
    expect(frame.turn).toBe(`rotate(${rest.roll})`);
    expect(frame.lean).toBe(`rotate(${rest.lean - rest.roll})`);
    expect(frame.body).toBe("scale(1 1)");
    expect(frame.eyes).toEqual(organicRestEyes(2));
  });

  it("closes fast and opens slower when blinking", () => {
    expect(blinkLid(0)).toBe(1);
    expect(blinkLid(0.45)).toBe(0);
    expect(blinkLid(1)).toBe(1);
    // A tenth of the way in, closing has gone further than opening has a tenth after the shut.
    expect(1 - blinkLid(0.1)).toBeGreaterThan(blinkLid(0.55));
  });

  it("aims at a pointer over the avatar, straight ahead at its centre", () => {
    expect(pointerGaze(0, 0, 40)).toEqual({ yaw: 0, pitch: -0 });
    expect(pointerGaze(400, -400, 40)).toEqual({ yaw: LOOK_YAW, pitch: LOOK_PITCH });
    expect(pointerGaze(-24, 24, 40)).toEqual({ yaw: -LOOK_YAW / 2, pitch: -LOOK_PITCH / 2 });
  });

  it("blinks every 1.9 to 4.6 seconds, sometimes twice in quick succession", () => {
    const random = mulberry32(42);
    let doubled = false;
    for (let index = 0; index < 200; index++) {
      const delay = nextBlinkDelay(random, doubled);
      if (delay < 1) {
        expect(doubled).toBe(false);
        expect(delay).toBeCloseTo(BLINK_DURATION + 0.24);
      } else {
        expect(delay).toBeGreaterThanOrEqual(1.9);
        expect(delay).toBeLessThanOrEqual(4.6);
      }
      doubled = delay < 1;
    }
  });

  it("squashes flat for a moment and recovers", () => {
    expect(squashAmount(0)).toBe(0);
    expect(squashAmount(0.3)).toBe(1);
    expect(squashAmount(0.7)).toBeGreaterThan(0);
    expect(squashAmount(1)).toBe(0);
  });

  it("turns to face a hovering pointer and settles back to rest after it leaves", () => {
    const motion = createOrganicMotion(3, 0, 0);
    const facing = run(motion, 0, 0.5, false, { yaw: 0, pitch: 0 });
    expect(Math.abs(facing.yaw)).toBeLessThan(1);
    expect(Math.abs(facing.roll)).toBeLessThan(1);
    const settled = run(motion, 0.5, 2.5, false);
    expect(Math.abs(settled.roll - organicRestPose(0).roll)).toBeLessThan(1);
    expect(Math.abs(settled.yaw - organicRestPose(0).yaw)).toBeLessThan(10);
  });

  it("acts busy while working: round eyes, shrinking, spinning and squashing all come up", () => {
    const motion = createOrganicMotion(11, 0, 0);
    const seen = { round: false, shrink: false, spin: false, squash: false };
    for (let t = 0; t < 60; t += 1 / 30) {
      const pose = stepOrganicMotion(motion, t, true, null);
      seen.round ||= pose.round > 0.9;
      seen.shrink ||= pose.scale < 0.8;
      seen.spin ||= pose.spin > 90;
      seen.squash ||= pose.squash > 0.9;
    }
    expect(seen).toEqual({ round: true, shrink: true, spin: true, squash: true });
  });

  it("hides the eyes while a spin turns the face away", () => {
    const frame = organicFrame(0, { ...restPose(0), yaw: 0, spin: 180 });
    expect(frame.eyes.map((eye) => eye.opacity)).toEqual([0, 0]);
  });

  it("calms back to rest once work ends", () => {
    const motion = createOrganicMotion(5, 0, 0);
    run(motion, 0, 6, true);
    const pose = run(motion, 6, 9, false);
    expect(pose.scale).toBeCloseTo(1, 2);
    expect(pose.round).toBeCloseTo(0, 2);
    expect(Math.abs(pose.roll - organicRestPose(0).roll)).toBeLessThan(1);
  });
});
