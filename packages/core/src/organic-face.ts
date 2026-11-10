import { ORGANIC_AVATAR_BODY_SIZE } from "./avatar-shape.js";
import { BOT_BODY_SHAPES } from "./bot-body-shapes.js";

/**
 * The organic face: two eyes laid on a ball behind the body, so turning the gaze slides them
 * across it, leans them along its curve and narrows them toward its rim. Every body rests looking
 * up and to the right; each sits its ball, lean and eye size where that body reads best, with a
 * small per-eye correction so the resting face matches the reference exactly.
 */

const DEG = Math.PI / 180;
/** Where every body looks at rest. */
const REST_GAZE = { yaw: 28.5, pitch: 28.6 };
/** Half the angle between the eyes, around the ball. */
const EYE_SPLIT = 16.4;
/** Degrees a body turns from its resting tilt to stand upright when it faces you. */
export const ORGANIC_UPRIGHT_ROLL = 15;

interface EyeFit {
  dx: number;
  dy: number;
  dAngle: number;
  wScale: number;
  hScale: number;
}

/** Per body, in units of the body's half size: ball centre and radius, lean, eye size. */
interface FaceFit {
  ax: number;
  ay: number;
  radius: number;
  lean: number;
  width: number;
  height: number;
  eyes: [EyeFit, EyeFit];
}

const FACES: Record<string, FaceFit> = {
  circle: {
    ax: 0.083,
    ay: 0.255,
    radius: 1.181,
    lean: -19.787,
    width: 0.248,
    height: 0.596,
    eyes: [
      { dx: 0.007, dy: 0.023, dAngle: 3.427, wScale: 1.07, hScale: 0.995 },
      { dx: -0.006, dy: -0.022, dAngle: 0.405, wScale: 0.939, hScale: 0.995 },
    ],
  },
  cloud: {
    ax: -0.036,
    ay: 0.24,
    radius: 0.974,
    lean: -11.308,
    width: 0.223,
    height: 0.532,
    eyes: [
      { dx: 0.001, dy: 0.016, dAngle: 1.449, wScale: 0.93, hScale: 0.997 },
      { dx: -0.001, dy: -0.014, dAngle: 0.577, wScale: 1.188, hScale: 1.002 },
    ],
  },
  squircle: {
    ax: -0.089,
    ay: 0.394,
    radius: 0.813,
    lean: -10.577,
    width: 0.21,
    height: 0.476,
    eyes: [
      { dx: -0.0, dy: 0.017, dAngle: 1.367, wScale: 0.929, hScale: 0.986 },
      { dx: -0.0, dy: -0.015, dAngle: 0.513, wScale: 1.202, hScale: 1.011 },
    ],
  },
  sparkle: {
    ax: -0.095,
    ay: 0.289,
    radius: 0.839,
    lean: -11.648,
    width: 0.188,
    height: 0.449,
    eyes: [
      { dx: 0.0, dy: 0.014, dAngle: 0.567, wScale: 0.873, hScale: 0.993 },
      { dx: -0.001, dy: -0.012, dAngle: 1.191, wScale: 1.302, hScale: 1.008 },
    ],
  },
  clover: {
    ax: -0.162,
    ay: 0.361,
    radius: 0.953,
    lean: -11.556,
    width: 0.201,
    height: 0.48,
    eyes: [
      { dx: -0.0, dy: 0.016, dAngle: 1.645, wScale: 0.907, hScale: 0.988 },
      { dx: -0.001, dy: -0.014, dAngle: 0.482, wScale: 1.25, hScale: 1.011 },
    ],
  },
  heart: {
    ax: 0.088,
    ay: 0.297,
    radius: 0.946,
    lean: -8.556,
    width: 0.203,
    height: 0.488,
    eyes: [
      { dx: 0.003, dy: 0.026, dAngle: 1.898, wScale: 0.948, hScale: 0.988 },
      { dx: -0.002, dy: -0.025, dAngle: 1.361, wScale: 1.183, hScale: 1.008 },
    ],
  },
  scallop: {
    ax: -0.032,
    ay: 0.361,
    radius: 0.795,
    lean: -9.887,
    width: 0.227,
    height: 0.493,
    eyes: [
      { dx: 0.0, dy: 0.017, dAngle: 2.457, wScale: 0.971, hScale: 0.987 },
      { dx: -0.0, dy: -0.015, dAngle: -0.436, wScale: 1.138, hScale: 1.006 },
    ],
  },
  drop: {
    ax: 0.067,
    ay: 0.237,
    radius: 0.911,
    lean: -9.965,
    width: 0.213,
    height: 0.512,
    eyes: [
      { dx: 0.002, dy: 0.02, dAngle: 2.618, wScale: 1.044, hScale: 1.001 },
      { dx: -0.002, dy: -0.019, dAngle: -0.167, wScale: 0.984, hScale: 0.991 },
    ],
  },
  pill: {
    ax: -0.081,
    ay: 0.371,
    radius: 1.2,
    lean: -10.668,
    width: 0.224,
    height: 0.52,
    eyes: [
      { dx: -0.0, dy: 0.023, dAngle: 1.62, wScale: 0.902, hScale: 0.994 },
      { dx: -0.0, dy: -0.021, dAngle: 2.075, wScale: 1.272, hScale: 1.003 },
    ],
  },
  triangle: {
    ax: 0.091,
    ay: 0.119,
    radius: 0.808,
    lean: -34.912,
    // Measured widths here are blurred by the eyes' small, diagonal size; drawn as thin as the rest.
    width: 0.2,
    height: 0.478,
    eyes: [
      { dx: -0.04, dy: -0.056, dAngle: -1.137, wScale: 0.95, hScale: 1.003 },
      { dx: 0.041, dy: 0.057, dAngle: -7.923, wScale: 0.85, hScale: 1.024 },
    ],
  },
  pentagon: {
    ax: -0.18,
    ay: 0.429,
    radius: 0.918,
    lean: -11.691,
    width: 0.211,
    height: 0.5,
    eyes: [
      { dx: -0.001, dy: 0.014, dAngle: 0.95, wScale: 0.897, hScale: 0.991 },
      { dx: 0.0, dy: -0.012, dAngle: 0.814, wScale: 1.25, hScale: 1.01 },
    ],
  },
  burst: {
    ax: -0.074,
    ay: 0.431,
    radius: 0.852,
    lean: -11.151,
    width: 0.192,
    height: 0.452,
    eyes: [
      { dx: -0.0, dy: 0.016, dAngle: 1.214, wScale: 0.913, hScale: 0.99 },
      { dx: -0.0, dy: -0.014, dAngle: 0.617, wScale: 1.233, hScale: 1.008 },
    ],
  },
  hex: {
    ax: -0.155,
    ay: 0.602,
    radius: 1.2,
    lean: -11.935,
    width: 0.256,
    height: 0.604,
    eyes: [
      { dx: -0.008, dy: 0.02, dAngle: 1.146, wScale: 0.889, hScale: 0.99 },
      { dx: 0.007, dy: -0.017, dAngle: 1.568, wScale: 1.261, hScale: 1.012 },
    ],
  },
};

function faceFor(family: number): FaceFit {
  return FACES[(BOT_BODY_SHAPES[family] ?? BOT_BODY_SHAPES[0]!).key] ?? FACES.circle!;
}

export interface OrganicFacePose {
  /** Degrees; positive looks right and up. */
  yaw: number;
  pitch: number;
  /** Degrees the face leans on the body. */
  lean: number;
  /** 1 open, 0 shut. */
  lid: number;
  /** 0 capsule eyes, 1 round dots. */
  round: number;
}

/** How a body rests: where it looks, its outline's turn from resting, and its face's lean. */
export interface OrganicRestPose {
  yaw: number;
  pitch: number;
  roll: number;
  lean: number;
}

export function organicRestPose(family: number): OrganicRestPose {
  return { ...REST_GAZE, roll: 0, lean: faceFor(family).lean };
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
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Both eyes for a body `family` in a pose, centred on the origin and placed by `transform`. */
export function organicFaceEyes(family: number, pose: OrganicFacePose): [OrganicEye, OrganicEye] {
  const face = faceFor(family);
  const size = ORGANIC_AVATAR_BODY_SIZE;
  const pitch = pose.pitch * DEG;
  const lean = pose.lean * DEG;
  const shear = Math.sin(pose.yaw * DEG) * Math.sin(pitch);
  const along = Math.max(0.08, Math.cos(pitch));
  const round = clamp01(pose.round);
  const lid = 0.06 + 0.94 * clamp01(pose.lid);
  const eye = (index: 0 | 1): OrganicEye => {
    const fit = face.eyes[index];
    const yaw = (pose.yaw + (index === 0 ? -1 : 1) * EYE_SPLIT) * DEG;
    const across = Math.max(0.08, Math.cos(yaw));
    const lx = face.radius * Math.sin(yaw) * Math.cos(pitch);
    const ly = -face.radius * Math.sin(pitch);
    const x = face.ax + lx * Math.cos(lean) - ly * Math.sin(lean) + fit.dx;
    const y = face.ay + lx * Math.sin(lean) + ly * Math.cos(lean) + fit.dy;
    const turn = lean + fit.dAngle * DEG;
    const [cos, sin] = [Math.cos(turn), Math.sin(turn)];
    const pill = face.height * fit.hScale;
    const width = mix(face.width * fit.wScale, pill * 0.6, round) * size;
    const height = mix(pill, pill * 0.6, round) * size * lid;
    return {
      x: fixed(-width / 2),
      y: fixed(-height / 2),
      width: fixed(width),
      height: fixed(height),
      rx: fixed(Math.min(width, height) / 2),
      // The eye's own axes on the ball (across the latitude, along the meridian), then the lean.
      transform: `matrix(${fixed(cos * across)} ${fixed(sin * across)} ${fixed(cos * shear - sin * along)} ${fixed(sin * shear + cos * along)} ${fixed(x * size)} ${fixed(y * size)})`,
      opacity: Math.cos(yaw) * Math.cos(pitch) > 0.05 ? 1 : 0,
    };
  };
  return [eye(0), eye(1)];
}

/** The face every static portrait of this body wears, eyes open. */
export function organicRestEyes(family: number): [OrganicEye, OrganicEye] {
  return organicFaceEyes(family, { ...organicRestPose(family), lid: 1, round: 0 });
}
