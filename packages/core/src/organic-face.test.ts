import { describe, expect, it } from "vitest";
import { ORGANIC_AVATAR_BODY_SIZE } from "./avatar-shape.js";
import { BOT_BODY_SHAPES, botBodyShapePath } from "./bot-body-shapes.js";
import { organicFaceEyes, organicRestEyes, organicRestPose } from "./organic-face.js";

const numbers = (transform: string) => transform.match(/[-\d.]+/g)!.map(Number);
/** An eye's centre in units of the body's half size. */
const centre = (transform: string) =>
  numbers(transform)
    .slice(4)
    .map((value) => value / ORGANIC_AVATAR_BODY_SIZE);
/** Degrees the eye's long axis leans from vertical; positive tips its top to the left. */
const lean = (transform: string) => {
  const [, , c, d] = numbers(transform);
  return (Math.atan2(c!, d!) * 180) / Math.PI;
};
const index = (key: string) => BOT_BODY_SHAPES.findIndex((shape) => shape.key === key);

describe("bot body shapes", () => {
  it("emits one smooth closed path per shape, fitted inside its size", () => {
    expect(BOT_BODY_SHAPES).toHaveLength(13);
    for (let shape = 0; shape < BOT_BODY_SHAPES.length; shape++) {
      const path = botBodyShapePath(shape, 48);
      expect(path).toMatch(/^M[-0-9. ]+(?:C[-0-9. ]+)+Z$/);
      const values = path.match(/-?[\d.]+/g)!.map(Number);
      expect(Math.max(...values.map(Math.abs))).toBeLessThanOrEqual(49);
    }
    expect(new Set(BOT_BODY_SHAPES.map((shape) => shape.key)).size).toBe(13);
  });
});

describe("organic face", () => {
  // Resting eye centres measured from the reference studio, in units of the body's half size.
  it.each([
    ["circle", [0.103, -0.327], [0.573, -0.546]],
    ["squircle", [-0.014, 0.001], [0.336, -0.096]],
    ["triangle", [-0.048, -0.34], [0.32, -0.428]],
    ["hex", [-0.065, 0.014], [0.461, -0.132]],
  ] as const)("rests the %s's eyes where the reference does", (key, left, right) => {
    const [l, r] = organicRestEyes(index(key));
    expect(centre(l.transform)[0]).toBeCloseTo(left[0], 1);
    expect(centre(l.transform)[1]).toBeCloseTo(left[1], 1);
    expect(centre(r.transform)[0]).toBeCloseTo(right[0], 1);
    expect(centre(r.transform)[1]).toBeCloseTo(right[1], 1);
  });

  it("keeps both resting eyes leaning the same way", () => {
    for (let shape = 0; shape < BOT_BODY_SHAPES.length; shape++) {
      const [l, r] = organicRestEyes(shape);
      // Within a few degrees: the reference triangle's eyes differ by about five.
      expect(Math.abs(lean(l.transform) - lean(r.transform))).toBeLessThan(8);
      expect(lean(l.transform)).toBeGreaterThan(0);
    }
  });

  it("rests every body looking up and right, with its own face lean", () => {
    const poses = BOT_BODY_SHAPES.map((_, shape) => organicRestPose(shape));
    expect(poses.every((pose) => pose.yaw > 20 && pose.pitch > 20 && pose.roll === 0)).toBe(true);
    expect(new Set(poses.map((pose) => pose.lean)).size).toBeGreaterThan(10);
  });

  it("looks straight ahead with upright, level eyes", () => {
    const [l, r] = organicFaceEyes(0, { yaw: 0, pitch: 0, lean: 0, lid: 1, round: 0 });
    expect(centre(l.transform)[1]).toBeCloseTo(centre(r.transform)[1]!, 1);
    expect(Math.abs(lean(l.transform))).toBeLessThan(5);
    expect(l.height).toBeGreaterThan(l.width * 2);
  });

  it("rounds the eyes into dots and shuts them in a blink", () => {
    const [dot] = organicFaceEyes(0, { yaw: 0, pitch: 0, lean: 0, lid: 1, round: 1 });
    expect(dot.width).toBeCloseTo(dot.height, 0);
    const [shut] = organicFaceEyes(0, { yaw: 0, pitch: 0, lean: 0, lid: 0, round: 0 });
    expect(shut.height).toBeLessThan(2);
  });
});
