import { ORGANIC_AVATAR_EYES } from "@rakazo/core";
import { describe, expect, it } from "vitest";
import {
  BLINK_DURATION,
  blinkLid,
  createOrganicMotion,
  dotPulse,
  MAX_PITCH,
  MAX_YAW,
  MODE_MORPH,
  mulberry32,
  nextBlinkDelay,
  organicFrame,
  pointerGaze,
  restPose,
  stepOrganicMotion,
  TURN_TIME,
} from "./organic-motion.js";

const translateX = (transform: string) => Number(/translate\(([-\d.]+)/.exec(transform)?.[1]);
const scale = (transform: string) =>
  /scale\(([-\d.]+) ([-\d.]+)\)/.exec(transform)?.slice(1).map(Number) ?? [];

describe("organic avatar motion", () => {
  it("rests with the static face: eyes at their usual place and size, no dots", () => {
    const frame = organicFrame(restPose(false));
    expect(frame.eyes.map(translateX)).toEqual([
      ORGANIC_AVATAR_EYES.leftCx,
      ORGANIC_AVATAR_EYES.rightCx,
    ]);
    expect(frame.eyes.map(scale)).toEqual([
      [1, 1],
      [1, 1],
    ]);
    expect(frame.bodyOpacity).toBe(1);
    expect(frame.dots.every((dot) => dot.r === 0 && dot.opacity === 0)).toBe(true);
  });

  it("becomes three dots with its eyes closed while working", () => {
    const frame = organicFrame(restPose(true));
    expect(frame.eyesOpacity).toBe(0);
    expect(frame.bodyOpacity).toBe(0);
    expect(frame.dots.map((dot) => dot.cx)).toEqual([-33, 0, 33]);
    expect(frame.dots.every((dot) => dot.r > 0 && dot.opacity === 1)).toBe(true);
  });

  it("slides the eyes toward the gaze and narrows the one nearer the rim", () => {
    const frame = organicFrame({ ...restPose(false), yaw: 40 });
    const [left, right] = frame.eyes;
    expect(translateX(left!)).toBeGreaterThan(ORGANIC_AVATAR_EYES.leftCx);
    expect(translateX(right!)).toBeGreaterThan(ORGANIC_AVATAR_EYES.rightCx);
    expect(scale(right!)[0]).toBeLessThan(scale(left!)[0]!);
  });

  it("closes fast and opens slower when blinking", () => {
    expect(blinkLid(0)).toBe(1);
    expect(blinkLid(0.45)).toBe(0);
    expect(blinkLid(1)).toBe(1);
    // A tenth of the way in, closing has gone further than opening has a tenth after the shut.
    expect(1 - blinkLid(0.1)).toBeGreaterThan(blinkLid(0.55));
  });

  it("waves the working dots in turn", () => {
    expect(dotPulse(0.375, 0)).toBeCloseTo(1);
    expect(dotPulse(0.875, 1)).toBeCloseTo(1);
    expect(dotPulse(1.375, 2)).toBeCloseTo(1);
    expect(dotPulse(1, 0)).toBe(0);
  });

  it("aims at the pointer within the turning range", () => {
    expect(pointerGaze(1000, -1000, 500, 400)).toEqual({ yaw: MAX_YAW, pitch: MAX_PITCH });
    expect(pointerGaze(-250, 200, 500, 400)).toEqual({ yaw: -MAX_YAW / 2, pitch: -MAX_PITCH / 2 });
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

  it("eases into the working dots and back without jumping", () => {
    const motion = createOrganicMotion(7, false, 0);
    expect(stepOrganicMotion(motion, 0, false, null).mode).toBe(0);
    const early = stepOrganicMotion(motion, 0.05, true, null).mode;
    expect(early).toBe(0);
    const mid = stepOrganicMotion(motion, 0.05 + MODE_MORPH / 3, true, null).mode;
    expect(mid).toBeGreaterThan(0.5);
    expect(mid).toBeLessThan(1);
    expect(stepOrganicMotion(motion, 0.05 + MODE_MORPH, true, null).mode).toBe(1);
    const back = stepOrganicMotion(motion, 1, false, null).mode;
    expect(back).toBe(1);
    expect(stepOrganicMotion(motion, 1 + MODE_MORPH, false, null).mode).toBe(0);
  });

  it("turns toward the pointer gradually and only while idle", () => {
    const aim = { yaw: MAX_YAW, pitch: 0 };
    const motion = createOrganicMotion(3, false, 0);
    stepOrganicMotion(motion, 0, false, aim);
    const turning = stepOrganicMotion(motion, TURN_TIME / 4, false, aim).yaw;
    const turned = stepOrganicMotion(motion, TURN_TIME * 2, false, aim).yaw;
    expect(turning).toBeLessThan(turned);
    expect(turned).toBeGreaterThan(MAX_YAW - 10);
    const working = createOrganicMotion(3, true, 0);
    stepOrganicMotion(working, 0, true, aim);
    expect(Math.abs(stepOrganicMotion(working, TURN_TIME * 2, true, aim).yaw)).toBeLessThan(10);
  });
});
