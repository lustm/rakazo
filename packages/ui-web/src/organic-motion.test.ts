import {
  BOT_BODY_SHAPE_COUNT,
  ORGANIC_UPRIGHT_ROLL,
  organicEyesInside,
  organicRestEyes,
  organicRestPose,
} from "@rakazo/core";
import { describe, expect, it } from "vitest";
import {
  BLINK_DURATION,
  blinkLid,
  createOrganicMotion,
  FACE_PITCH,
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

  it("faces a pointer at its centre and leans the gaze toward one off to a side", () => {
    expect(pointerGaze(0, 0, 40)).toEqual({ yaw: 0, pitch: FACE_PITCH });
    // Past 0.7 body radii (11.2 px of a 40 px avatar) along an axis, the gaze turns no further.
    expect(pointerGaze(400, -400, 40)).toEqual({ yaw: LOOK_YAW, pitch: FACE_PITCH + LOOK_PITCH });
    const half = pointerGaze(-5.6, 5.6, 40);
    expect(half.yaw).toBeCloseTo(-LOOK_YAW / 2);
    expect(half.pitch).toBeCloseTo(FACE_PITCH - LOOK_PITCH / 2);
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

  it("stands upright to face a hovering pointer and settles back to rest after it leaves", () => {
    const motion = createOrganicMotion(3, 0, 0);
    const facing = run(motion, 0, 0.5, false, { yaw: 0, pitch: 0 });
    expect(Math.abs(facing.yaw)).toBeLessThan(1);
    expect(facing.roll).toBeCloseTo(ORGANIC_UPRIGHT_ROLL, 0);
    expect(facing.roll + facing.lean).toBeCloseTo(0, 0);
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

  it("keeps every body's eyes inside it while idle, hovered and working", () => {
    for (let family = 0; family < BOT_BODY_SHAPE_COUNT; family++) {
      const motion = createOrganicMotion(family * 7 + 1, family, 0);
      const outside: string[] = [];
      const check = (t: number, working: boolean, aim: { yaw: number; pitch: number } | null) => {
        const pose = stepOrganicMotion(motion, t, working, aim);
        // A coin-flip spin turns the face away on purpose; every other frame keeps it whole.
        if (pose.spin !== 0) return;
        const portrait = 1 - Math.min(1, Math.abs(pose.roll) / ORGANIC_UPRIGHT_ROLL);
        if (!organicEyesInside(family, { ...pose, lid: 1, portrait }))
          outside.push(`${working ? "busy" : aim ? "hover" : "idle"} @${t.toFixed(2)}`);
      };
      for (let t = 0; t < 12; t += 1 / 30) check(t, false, null);
      for (let t = 12; t < 14; t += 1 / 30) check(t, false, pointerGaze(-400, 400, 40));
      for (let t = 14; t < 60; t += 1 / 30) check(t, true, null);
      expect(outside.slice(0, 3), `family ${family}`).toEqual([]);
    }
  });

  it("stands the eyes straight in some busy beats and keeps the body's lean in others", () => {
    const motion = createOrganicMotion(11, 0, 0);
    const leans = new Set<string>();
    for (let t = 0; t < 60; t += 1 / 30) {
      stepOrganicMotion(motion, t, true, null);
      const beat = motion.beatTargets!;
      leans.add(
        beat.lean === motion.rest.lean ? "rest" : beat.lean === -beat.roll ? "straight" : "?",
      );
    }
    expect([...leans].sort()).toEqual(["rest", "straight"]);
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
