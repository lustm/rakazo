import { BOT_BODY_SHAPE_COUNT, botBodyShapePath } from "./bot-body-shapes.js";

export function avatarIdentitySeed(identity: string): number {
  let hash = 0;
  for (let index = 0; index < identity.length; index++) {
    hash = (hash << 5) - hash + identity.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Two eyes of one size, placed by their centres in the avatar's own view box. */
export interface AvatarEyes {
  readonly width: number;
  readonly height: number;
  readonly leftCx: number;
  readonly rightCx: number;
  readonly cy: number;
}

/** The pair as fully rounded bars, the face every organic and shipped-shape avatar wears. */
export function avatarEyeRects(eyes: AvatarEyes) {
  return [eyes.leftCx, eyes.rightCx].map((cx) => ({
    x: cx - eyes.width / 2,
    y: eyes.cy - eyes.height / 2,
    width: eyes.width,
    height: eyes.height,
    rx: eyes.width / 2,
  }));
}

export const ORGANIC_AVATAR_VIEWBOX = "-60 -60 120 120";

export const ORGANIC_AVATAR_EYES: AvatarEyes = {
  width: 7,
  height: 24,
  leftCx: -10.5,
  rightCx: 10.5,
  cy: 0,
};

/** Degrees the organic face leans, so bots sharing a body still differ. */
export function organicAvatarEyeTilt(seed: number): number {
  return (seed % 9) - 4;
}

/** Organic bodies come in this many families (the shared bot body shapes); the seed picks one. */
export const ORGANIC_AVATAR_FAMILY_COUNT = BOT_BODY_SHAPE_COUNT;

/** The rounded heart body. */
export const ORGANIC_AVATAR_HEART_FAMILY = 5;

/** The organic body family every client draws for this identity (a bot's id). */
export function organicAvatarFamily(identity: string): number {
  return avatarIdentitySeed(identity) % ORGANIC_AVATAR_FAMILY_COUNT;
}

/** Every family is its own look. */
export function organicAvatarLook(family: number): number {
  return family;
}

/** The distinct organic bodies a new bot can get: every look except the heart. */
export const ORGANIC_AVATAR_LOOKS: readonly number[] = Array.from(
  { length: ORGANIC_AVATAR_FAMILY_COUNT },
  (_, family) => family,
).filter((family) => family !== ORGANIC_AVATAR_HEART_FAMILY);

/** A stable identity whose organic body is the given family, for previews before a bot has an id. */
export function organicAvatarSampleIdentity(family: number): string {
  for (let index = 0; ; index++) {
    const identity = `look-${family}-${index}`;
    if (organicAvatarFamily(identity) === family) return identity;
  }
}

/** Half the organic body's width, in the organic view box. */
export const ORGANIC_AVATAR_BODY_SIZE = 48;

export function organicAvatarPath(seed: number): string {
  return botBodyShapePath(seed % ORGANIC_AVATAR_FAMILY_COUNT, ORGANIC_AVATAR_BODY_SIZE);
}
