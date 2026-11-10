import { describe, expect, it } from "vitest";
import { BOT_BODY_SHAPES, botBodyShapePath } from "./bot-body-shapes.js";
import { organicFaceEyes, organicRestEyes } from "./organic-face.js";

const position = (transform: string) =>
  transform
    .match(/[-\d.]+/g)!
    .slice(4)
    .map(Number);

describe("bot body shapes", () => {
  it("emits one smooth closed path per shape, fitted inside its size", () => {
    expect(BOT_BODY_SHAPES).toHaveLength(13);
    for (let index = 0; index < BOT_BODY_SHAPES.length; index++) {
      const path = botBodyShapePath(index, 48);
      expect(path).toMatch(/^M[-0-9. ]+(?:C[-0-9. ]+)+Z$/);
      const values = path.match(/-?[\d.]+/g)!.map(Number);
      expect(Math.max(...values.map(Math.abs))).toBeLessThanOrEqual(49);
    }
    expect(new Set(BOT_BODY_SHAPES.map((shape) => shape.key)).size).toBe(13);
  });
});

describe("organic face", () => {
  it("rests up and to the right with the eyes leaning along the body's curve", () => {
    const [left, right] = organicRestEyes(0);
    const [lx, ly] = position(left.transform);
    const [rx, ry] = position(right.transform);
    expect(lx).toBeGreaterThan(0);
    expect(rx).toBeGreaterThan(lx!);
    expect(ly).toBeLessThan(0);
    expect(ry).toBeLessThan(0);
    // matrix(a 0 c d …): a positive c leans the eye's top toward the left.
    expect(Number(right.transform.match(/[-\d.]+/g)![2])).toBeGreaterThan(0);
  });

  it("looks straight ahead with upright, centred eyes", () => {
    const [left, right] = organicFaceEyes(0, { yaw: 0, pitch: 0, lid: 1, round: 0 });
    expect(position(left.transform)[0]).toBeCloseTo(-position(right.transform)[0]!, 1);
    expect(left.transform).toMatch(/^matrix\(0\.96 0 -?0 1 /);
    expect(left.height).toBeGreaterThan(left.width * 2);
  });

  it("rounds the eyes into dots and shuts them in a blink", () => {
    const [round] = organicFaceEyes(0, { yaw: 0, pitch: 0, lid: 1, round: 1 });
    expect(round.width).toBe(round.height);
    const [shut] = organicFaceEyes(0, { yaw: 0, pitch: 0, lid: 0, round: 0 });
    expect(shut.height).toBeLessThan(2);
  });
});
