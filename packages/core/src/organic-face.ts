import { ORGANIC_AVATAR_BODY_SIZE } from "./avatar-shape.js";
import { BOT_BODY_SHAPES } from "./bot-body-shapes.js";

/**
 * The organic face: two eyes laid on the body as if it were a ball, so turning the gaze slides
 * them across it, leans them along its curve and narrows them toward its rim.
 */

/** How a body rests: where it looks, how its outline tips, and how its eyes lean on screen. */
export interface OrganicRestPose {
  /** Degrees; positive looks right and up. */
  yaw: number;
  pitch: number;
  /** Degrees the outline tips. */
  roll: number;
  /** Degrees the eyes lean, independent of the outline. */
  lean: number;
}

/** Each body sits its face where it reads best: a ball looks up and right, a squircle straight. */
const REST_POSES: Record<string, OrganicRestPose> = {
  circle: { yaw: 28.5, pitch: 28.6, roll: -20, lean: -20 },
  cloud: { yaw: 14, pitch: 16, roll: 0, lean: -10 },
  squircle: { yaw: 4, pitch: -6, roll: -20, lean: -2 },
  sparkle: { yaw: 5, pitch: 6, roll: 0, lean: -8 },
  clover: { yaw: 14, pitch: 12, roll: 0, lean: -12 },
  heart: { yaw: 18, pitch: 2, roll: 0, lean: -10 },
  scallop: { yaw: 6, pitch: -4, roll: 0, lean: -8 },
  drop: { yaw: 16, pitch: 4, roll: 0, lean: -12 },
  pill: { yaw: 18, pitch: 16, roll: -6, lean: -14 },
  triangle: { yaw: 22, pitch: 30, roll: 0, lean: -48 },
  pentagon: { yaw: 2, pitch: -10, roll: 0, lean: 0 },
  burst: { yaw: 6, pitch: -8, roll: 0, lean: -6 },
  hex: { yaw: 10, pitch: -2, roll: 0, lean: -6 },
};

export function organicRestPose(family: number): OrganicRestPose {
  return REST_POSES[(BOT_BODY_SHAPES[family] ?? BOT_BODY_SHAPES[0]!).key] ?? REST_POSES.circle!;
}

const DEG = Math.PI / 180;
/** Half the angle between the eyes, around the ball. */
const EYE_SPLIT = 22;
/** Eye sizes as fractions of the body size: a tall capsule, or a round dot. */
const PILL_WIDTH = 0.24;
const PILL_HEIGHT = 0.58;
const ROUND_SIZE = 0.34;
/** How far toward the outline the ball the eyes ride reaches. */
const BALL_REACH = 0.82;

export interface OrganicFacePose {
  /** Degrees; positive looks right and up. */
  yaw: number;
  pitch: number;
  /** 1 open, 0 shut. */
  lid: number;
  /** 0 capsule eyes, 1 round dots. */
  round: number;
}

export interface OrganicEye {
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
  transform: string;
  opacity: number;
}

const fixed = (value: number) => Math.round(value * 100) / 100;
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;

/** Both eyes for a body `family` in a pose, centred on the origin and placed by `transform`. */
export function organicFaceEyes(family: number, pose: OrganicFacePose): [OrganicEye, OrganicEye] {
  const shape = BOT_BODY_SHAPES[family] ?? BOT_BODY_SHAPES[0]!;
  const size = ORGANIC_AVATAR_BODY_SIZE;
  const ballX = shape.extent[0] * size * BALL_REACH;
  const ballY = shape.extent[1] * size * BALL_REACH;
  const round = Math.min(1, Math.max(0, pose.round));
  const width = mix(PILL_WIDTH, ROUND_SIZE, round) * size;
  const open = mix(PILL_HEIGHT, ROUND_SIZE, round) * size;
  const height = open * (0.06 + 0.94 * Math.min(1, Math.max(0, pose.lid)));
  // Both eyes share the lean of the gaze's centre, so they stay parallel; each narrows only by
  // how far around the ball it sits.
  const gazeYaw = pose.yaw * DEG;
  const pitch = pose.pitch * DEG;
  const c = Math.sin(gazeYaw) * Math.sin(pitch);
  const d = Math.max(0.08, Math.cos(pitch));
  const eye = (side: -1 | 1): OrganicEye => {
    const yaw = (pose.yaw + side * EYE_SPLIT) * DEG;
    const a = Math.max(0.08, Math.cos(yaw));
    const x = shape.centre[0] * size + ballX * Math.sin(yaw) * Math.cos(pitch);
    const y = shape.centre[1] * size - ballY * Math.sin(pitch);
    return {
      x: fixed(-width / 2),
      y: fixed(-height / 2),
      width: fixed(width),
      height: fixed(height),
      rx: fixed(Math.min(width, height) / 2),
      transform: `matrix(${fixed(a)} 0 ${fixed(c)} ${fixed(d)} ${fixed(x)} ${fixed(y)})`,
      opacity: Math.cos(yaw) * Math.cos(pitch) > 0.05 ? 1 : 0,
    };
  };
  return [eye(-1), eye(1)];
}

/** The face every static portrait of this body wears, eyes open. */
export function organicRestEyes(family: number): [OrganicEye, OrganicEye] {
  return organicFaceEyes(family, { ...organicRestPose(family), lid: 1, round: 0 });
}
