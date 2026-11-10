import { describe, expect, it } from "vitest";
import { ORGANIC_AVATAR_BODY_SIZE } from "./avatar-shape.js";
import { BOT_BODY_SHAPES, botBodyShapePath } from "./bot-body-shapes.js";
import {
  organicContainedGaze,
  organicEyesInside,
  organicFaceEyes,
  organicRestEyes,
  organicRestPose,
} from "./organic-face.js";

/** The points a path passes through (each segment's end point). */
const points = (d: string) =>
  d
    .split(/[MCZ]/)
    .filter((segment) => segment.trim())
    .map((segment) => segment.trim().split(" ").map(Number).slice(-2));
/** An eye's centre in units of the body's half size. */
const centre = (d: string) => {
  const all = points(d);
  return [0, 1].map(
    (axis) => all.reduce((sum, p) => sum + p[axis]!, 0) / all.length / ORGANIC_AVATAR_BODY_SIZE,
  );
};
/** The eye's long axis (pointing down) and its length and width along and across it. */
const shape = (d: string) => {
  const all = points(d);
  const [cx, cy] = centre(d).map((value) => value * ORGANIC_AVATAR_BODY_SIZE);
  let [xx, xy, yy] = [0, 0, 0];
  for (const [x, y] of all) {
    xx += (x! - cx!) ** 2;
    xy += (x! - cx!) * (y! - cy!);
    yy += (y! - cy!) ** 2;
  }
  const angle = Math.atan2(2 * xy, xx - yy) / 2;
  let axis = [Math.cos(angle), Math.sin(angle)];
  const spread = (dir: number[]) => {
    const along = all.map(([x, y]) => (x! - cx!) * dir[0]! + (y! - cy!) * dir[1]!);
    return Math.max(...along) - Math.min(...along);
  };
  if (spread(axis) < spread([-axis[1]!, axis[0]!])) axis = [-axis[1]!, axis[0]!];
  if (axis[1]! < 0) axis = [-axis[0]!, -axis[1]!];
  return { axis, length: spread(axis), width: spread([-axis[1]!, axis[0]!]) };
};
/** Degrees the eye's long axis leans from vertical; positive tips its top to the left. */
const lean = (d: string) => {
  const [x, y] = shape(d).axis;
  return (Math.atan2(x!, y!) * 180) / Math.PI;
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

const FRONT = { yaw: 0, pitch: 0, lean: 0, portrait: 1 };

describe("organic face", () => {
  // Resting eye centres measured from the reference studio, in units of the body's half size.
  it.each([
    ["circle", [0.103, -0.327], [0.573, -0.546]],
    ["squircle", [-0.014, 0.001], [0.336, -0.096]],
    ["triangle", [-0.048, -0.34], [0.32, -0.428]],
    ["hex", [-0.065, 0.014], [0.461, -0.132]],
  ] as const)("rests the %s's eyes where the reference does", (key, left, right) => {
    const [l, r] = organicRestEyes(index(key));
    expect(centre(l.d)[0]).toBeCloseTo(left[0], 1);
    expect(centre(l.d)[1]).toBeCloseTo(left[1], 1);
    expect(centre(r.d)[0]).toBeCloseTo(right[0], 1);
    expect(centre(r.d)[1]).toBeCloseTo(right[1], 1);
  });

  it("keeps both resting eyes leaning the same way", () => {
    for (let shape = 0; shape < BOT_BODY_SHAPES.length; shape++) {
      const [l, r] = organicRestEyes(shape);
      // Within a few degrees: the reference triangle's eyes differ by about five.
      expect(Math.abs(lean(l.d) - lean(r.d))).toBeLessThan(8);
      expect(lean(l.d)).toBeGreaterThan(0);
    }
  });

  it("rests every body looking up and right, with its own face lean", () => {
    const poses = BOT_BODY_SHAPES.map((_, shape) => organicRestPose(shape));
    expect(poses.every((pose) => pose.yaw > 20 && pose.pitch > 20 && pose.roll === 0)).toBe(true);
    expect(new Set(poses.map((pose) => pose.lean)).size).toBeGreaterThan(10);
  });

  it("rests every body's eyes inside it, and stops a look past its edge where they would leave", () => {
    for (let shape = 0; shape < BOT_BODY_SHAPES.length; shape++) {
      const rest = organicRestPose(shape);
      expect(organicEyesInside(shape, { ...rest, lid: 1, round: 0, portrait: 1 })).toBe(true);
      // Looking hard down and left would carry the eyes off most bodies.
      const far = { ...rest, yaw: -38, pitch: -22, lid: 1, round: 0, portrait: 0 };
      const gaze = organicContainedGaze(shape, far, { yaw: 0, pitch: 14 });
      expect(organicEyesInside(shape, { ...far, ...gaze })).toBe(true);
      expect(gaze.pitch).toBeLessThan(14);
    }
  });

  it("looks straight ahead with upright, level eyes", () => {
    const [l, r] = organicFaceEyes(0, { ...FRONT, lid: 1, round: 0 });
    expect(centre(l.d)[1]).toBeCloseTo(centre(r.d)[1]!, 1);
    expect(Math.abs(lean(l.d))).toBeLessThan(5);
    expect(shape(l.d).length).toBeGreaterThan(shape(l.d).width * 2);
  });

  it("bows an eye toward the rim as it turns away, and keeps a head-on eye straight", () => {
    // Looking right by half the eyes' spread: the left eye faces you and the right one turns away.
    const [near, far] = organicFaceEyes(0, { ...FRONT, yaw: 16.4, lid: 1, round: 0 });
    const bow = (d: string) => {
      const all = points(d);
      const tips = [
        all.reduce((a, b) => (b[1]! < a[1]! ? b : a)),
        all.reduce((a, b) => (b[1]! > a[1]! ? b : a)),
      ];
      return centre(d)[0]! * ORGANIC_AVATAR_BODY_SIZE - (tips[0]![0]! + tips[1]![0]!) / 2;
    };
    expect(Math.abs(bow(near.d))).toBeLessThan(0.05);
    expect(bow(far.d)).toBeGreaterThan(0.25);
  });

  it("drops the resting portrait's per-eye touch-ups while facing you", () => {
    const [l, r] = organicFaceEyes(0, { ...FRONT, pitch: 14, lid: 1, round: 0, portrait: 0 });
    expect(centre(l.d)[1]).toBeCloseTo(centre(r.d)[1]!, 3);
  });

  it("rounds the eyes into dots and shuts them in a blink", () => {
    const [dot] = organicFaceEyes(0, { ...FRONT, lid: 1, round: 1 });
    expect(shape(dot.d).width / shape(dot.d).length).toBeGreaterThan(0.9);
    const [shut] = organicFaceEyes(0, { ...FRONT, lid: 0, round: 0 });
    expect(Math.min(shape(shut.d).length, shape(shut.d).width)).toBeLessThan(2);
  });
});
