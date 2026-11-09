import { describe, expect, it } from "vitest";
import { avatarLookOffset } from "./use-avatar-look.js";

const range = { x: 10, y: 7 };

describe("avatarLookOffset", () => {
  it("looks straight at a pointer to the right, at full range when it is far away", () => {
    expect(avatarLookOffset(500, 0, 38, range)).toEqual({ x: 10, y: 0 });
  });

  it("points toward the pointer's direction", () => {
    const upLeft = avatarLookOffset(-300, -300, 38, range);
    expect(upLeft.x).toBeLessThan(0);
    expect(upLeft.y).toBeLessThan(0);
    const downRight = avatarLookOffset(300, 300, 38, range);
    expect(downRight.x).toBeGreaterThan(0);
    expect(downRight.y).toBeGreaterThan(0);
  });

  it("moves less while the pointer is close to the avatar", () => {
    const near = avatarLookOffset(10, 0, 38, range);
    const far = avatarLookOffset(100, 0, 38, range);
    expect(near.x).toBeGreaterThan(0);
    expect(near.x).toBeLessThan(far.x);
  });

  it("stays centered with the pointer on the avatar's center or no size", () => {
    expect(avatarLookOffset(0, 0, 38, range)).toEqual({ x: 0, y: 0 });
    expect(avatarLookOffset(50, 50, 0, range)).toEqual({ x: 0, y: 0 });
  });
});
