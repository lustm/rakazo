import type { AvatarEyes } from "./avatar-shape.js";
import { BOT_BODY_SHAPES, botBodyShapePath } from "./bot-body-shapes.js";

export const SHIPPED_BOT_AVATAR_VIEWBOX = "-15 -15 259 259";
export const SHIPPED_BOT_AVATAR_CENTER = 114.2705;

/** The organic avatars' bar eyes scaled to this 259-unit box, so every shape wears the same face. */
export const SHIPPED_BOT_AVATAR_EYES: AvatarEyes = {
  width: 15,
  height: 52,
  leftCx: SHIPPED_BOT_AVATAR_CENTER - 22.5,
  rightCx: SHIPPED_BOT_AVATAR_CENTER + 22.5,
  cy: SHIPPED_BOT_AVATAR_CENTER - 8,
};

/** Avatar Studio's shapes: the shared bot bodies drawn in this box. */
export const SHIPPED_BOT_AVATAR_SHAPES: Record<string, string> = Object.fromEntries(
  BOT_BODY_SHAPES.map((shape, index) => [
    shape.key,
    botBodyShapePath(index, 108, SHIPPED_BOT_AVATAR_CENTER, SHIPPED_BOT_AVATAR_CENTER),
  ]),
);

export const SHIPPED_BOT_AVATAR_SHAPE_KEYS = BOT_BODY_SHAPES.map((shape) => shape.key);

const FALLBACK_SHAPE_PATH = SHIPPED_BOT_AVATAR_SHAPES.circle ?? "";

export function shippedBotAvatarShapePath(shapeIndex: number): string {
  const count = SHIPPED_BOT_AVATAR_SHAPE_KEYS.length;
  const normalized = Number.isFinite(shapeIndex)
    ? ((Math.trunc(shapeIndex) % count) + count) % count
    : 0;
  const key = SHIPPED_BOT_AVATAR_SHAPE_KEYS[normalized] ?? "circle";
  return SHIPPED_BOT_AVATAR_SHAPES[key] ?? FALLBACK_SHAPE_PATH;
}
