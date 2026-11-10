import { ORGANIC_AVATAR_BODY_SIZE } from "./avatar-shape.js";
import { BOT_BODY_SHAPES } from "./bot-body-shapes.js";

/**
 * The organic face: two eyes laid on the body as if it were a ball, so turning the gaze slides
 * them across it, leans them along its curve and narrows them toward its rim. At rest a bot looks
 * up and to the right with its body tipped slightly back.
 */
export const ORGANIC_REST_GAZE = { yaw: 28.5, pitch: 28.6, roll: -13 } as const;

const DEG = Math.PI / 180;
/** Half the angle between the eyes, around the ball. */
const EYE_SPLIT = 17;
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
  const eye = (side: -1 | 1): OrganicEye => {
    const yaw = (pose.yaw + side * EYE_SPLIT) * DEG;
    const pitch = pose.pitch * DEG;
    const facing = Math.cos(yaw) * Math.cos(pitch);
    // The eye's own axes on the ball: across follows the latitude, along follows the meridian.
    const a = Math.max(0.08, Math.cos(yaw));
    const c = Math.sin(yaw) * Math.sin(pitch);
    const d = Math.max(0.08, Math.cos(pitch));
    const x = shape.centre[0] * size + ballX * Math.sin(yaw) * Math.cos(pitch);
    const y = shape.centre[1] * size - ballY * Math.sin(pitch);
    return {
      x: fixed(-width / 2),
      y: fixed(-height / 2),
      width: fixed(width),
      height: fixed(height),
      rx: fixed(Math.min(width, height) / 2),
      transform: `matrix(${fixed(a)} 0 ${fixed(c)} ${fixed(d)} ${fixed(x)} ${fixed(y)})`,
      opacity: facing > 0.05 ? 1 : 0,
    };
  };
  return [eye(-1), eye(1)];
}

/** The face every static portrait wears: looking up and right, eyes open. */
export function organicRestEyes(family: number): [OrganicEye, OrganicEye] {
  return organicFaceEyes(family, { ...ORGANIC_REST_GAZE, lid: 1, round: 0 });
}
