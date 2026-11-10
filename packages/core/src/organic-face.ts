import { ORGANIC_AVATAR_BODY_SIZE } from "./avatar-shape.js";
import { BOT_BODY_SHAPES, smoothClosedPath } from "./bot-body-shapes.js";

/**
 * The organic face: two eyes laid on a ball behind the body, so turning the gaze slides them
 * across it, leans them along its curve, and narrows and bows them toward its rim. Every body
 * rests looking up and to the right; each sits its ball, lean and eye size where that body reads
 * best, with a small per-eye correction so the resting face matches the reference exactly.
 */

const DEG = Math.PI / 180;
/** Where every body looks at rest. */
const REST_GAZE = { yaw: 28.5, pitch: 28.6 };
/** Half the angle between the eyes, around the ball. */
const EYE_SPLIT = 16.4;
/** The eyes' meridians curve as on a ball this share of the face's radius. */
const MERIDIAN_CURVE = 0.75;
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
  /** How much of the resting portrait's per-eye correction applies: 1 at rest, 0 facing you. */
  portrait: number;
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
  /** The eye's outline in the avatar's viewBox. */
  d: string;
  opacity: number;
}

const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Points per rounded corner; straight sides get points at about the same spacing, so they bend. */
const CORNER_STEPS = 4;
const MAX_SIDE_STEPS = 8;

/** A `width` × `height` capsule centred on the origin, as evenly spaced points clockwise. */
function capsule(width: number, height: number): [number, number][] {
  const radius = Math.min(width, height) / 2;
  const [hx, hy] = [width / 2 - radius, height / 2 - radius];
  const spacing = Math.max(1e-6, (radius * Math.PI) / 2 / CORNER_STEPS);
  const centres = [
    [hx, -hy],
    [hx, hy],
    [-hx, hy],
    [-hx, -hy],
  ] as const;
  return centres.flatMap(([cx, cy], index) => {
    const start = (index - 1) * 90;
    const at = (degrees: number, ox = cx, oy = cy): [number, number] => [
      ox + radius * Math.cos(degrees * DEG),
      oy + radius * Math.sin(degrees * DEG),
    ];
    const arc = Array.from({ length: CORNER_STEPS }, (_, step) =>
      at(start + (90 * step) / CORNER_STEPS),
    );
    // The straight side from this corner to the next; none when the corners meet.
    const [nx, ny] = centres[(index + 1) % 4]!;
    const steps = Math.min(MAX_SIDE_STEPS, Math.round(Math.hypot(nx - cx, ny - cy) / spacing));
    const [from, to] = [at(start + 90), at(start + 90, nx, ny)];
    const side = Array.from({ length: steps }, (_, step): [number, number] => [
      mix(from[0], to[0], step / steps),
      mix(from[1], to[1], step / steps),
    ]);
    return [...arc, ...side];
  });
}

type EyeOutline = { points: [number, number][]; opacity: number };

/** Both eyes' outlines for a body `family` in a pose, on its ball in the avatar's viewBox. */
function eyeOutlines(family: number, pose: OrganicFacePose): [EyeOutline, EyeOutline] {
  const face = faceFor(family);
  const size = ORGANIC_AVATAR_BODY_SIZE;
  // Eyes bow along a meridian of a ball a little tighter than the face's own: the reference bows a
  // third more than the face's ball would.
  const curve = face.radius * size * MERIDIAN_CURVE;
  const pitch = pose.pitch * DEG;
  const lean = pose.lean * DEG;
  const shear = Math.sin(pose.yaw * DEG) * Math.sin(pitch);
  const along = Math.max(0.08, Math.cos(pitch));
  const round = clamp01(pose.round);
  const lid = 0.06 + 0.94 * clamp01(pose.lid);
  const portrait = clamp01(pose.portrait);
  const eye = (index: 0 | 1): EyeOutline => {
    const fit = face.eyes[index];
    const yaw = (pose.yaw + (index === 0 ? -1 : 1) * EYE_SPLIT) * DEG;
    const across = Math.max(0.08, Math.cos(yaw));
    const lx = face.radius * Math.sin(yaw) * Math.cos(pitch);
    const ly = -face.radius * Math.sin(pitch);
    const x = (face.ax + lx * Math.cos(lean) - ly * Math.sin(lean) + fit.dx * portrait) * size;
    const y = (face.ay + lx * Math.sin(lean) + ly * Math.cos(lean) + fit.dy * portrait) * size;
    const turn = lean + fit.dAngle * portrait * DEG;
    const [cos, sin] = [Math.cos(turn), Math.sin(turn)];
    const pill = face.height * mix(1, fit.hScale, portrait);
    const width = mix(face.width * mix(1, fit.wScale, portrait), pill * 0.6, round) * size;
    const height = mix(pill, pill * 0.6, round) * size * lid;
    // Along its length the eye bows out toward the rim as it turns away.
    const bow = -curve * Math.sin(yaw) * Math.cos(pitch);
    const points = capsule(width, height).map(([u, v]): [number, number] => {
      // In the face's frame: across the latitude (sheared by a raised gaze), then along it.
      const side = u * across + v * shear + bow * (1 - Math.cos(v / curve));
      const up = v * along;
      return [x + cos * side - sin * up, y + sin * side + cos * up];
    });
    return { points, opacity: Math.cos(yaw) * Math.cos(pitch) > 0.05 ? 1 : 0 };
  };
  return [eye(0), eye(1)];
}

/** Both eyes for a body `family` in a pose, drawn on its ball in the avatar's viewBox. */
export function organicFaceEyes(family: number, pose: OrganicFacePose): [OrganicEye, OrganicEye] {
  const [left, right] = eyeOutlines(family, pose);
  return [
    { d: smoothClosedPath(left.points), opacity: left.opacity },
    { d: smoothClosedPath(right.points), opacity: right.opacity },
  ];
}

/** Room an eye keeps from the body's edge, in viewBox units. */
const EYE_MARGIN = 1;

/** A body's outline in viewBox units, and the radius within which every point is clear of it. */
type BodyBounds = { outline: [number, number][]; clear: number };
const bodyBounds = new Map<number, BodyBounds>();

function boundsFor(family: number): BodyBounds {
  const cached = bodyBounds.get(family);
  if (cached) return cached;
  const size = ORGANIC_AVATAR_BODY_SIZE;
  const outline = (BOT_BODY_SHAPES[family] ?? BOT_BODY_SHAPES[0]!).points.map(
    ([x, y]): [number, number] => [x * size, y * size],
  );
  // The centre is inside every body, so the nearest edge from it bounds a disc that is too.
  const clear = Math.sqrt(edgeDistanceSquared(outline, 0, 0)) - EYE_MARGIN;
  const bounds = { outline, clear };
  bodyBounds.set(family, bounds);
  return bounds;
}

function edgeDistanceSquared(outline: [number, number][], x: number, y: number): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 0, previous = outline.length - 1; index < outline.length; previous = index++) {
    const [ax, ay] = outline[previous]!;
    const [bx, by] = outline[index]!;
    const [dx, dy] = [bx - ax, by - ay];
    const t = clamp01(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1));
    const [ex, ey] = [x - ax - t * dx, y - ay - t * dy];
    nearest = Math.min(nearest, ex * ex + ey * ey);
  }
  return nearest;
}

/** Whether `point` lies inside the body and at least the margin from its edge. */
function clearOfEdge({ outline, clear }: BodyBounds, [x, y]: [number, number]): boolean {
  if (x * x + y * y <= clear * clear) return true;
  let inside = false;
  for (let index = 0, previous = outline.length - 1; index < outline.length; previous = index++) {
    const [ax, ay] = outline[previous]!;
    const [bx, by] = outline[index]!;
    if (ay > y !== by > y && x < ax + ((y - ay) * (bx - ax)) / (by - ay)) inside = !inside;
  }
  return inside && edgeDistanceSquared(outline, x, y) >= EYE_MARGIN * EYE_MARGIN;
}

/** Whether both eyes of a pose sit wholly inside the body, clear of its edge. */
export function organicEyesInside(family: number, pose: OrganicFacePose): boolean {
  const bounds = boundsFor(family);
  return eyeOutlines(family, pose).every(({ points }) =>
    points.every((point) => clearOfEdge(bounds, point)),
  );
}

/**
 * The gaze closest to `pose`'s, on the way from `from`, that keeps both eyes inside the body:
 * a look past the body's edge stops where the eyes would start to leave it.
 */
export function organicContainedGaze(
  family: number,
  pose: OrganicFacePose,
  from: { yaw: number; pitch: number },
): { yaw: number; pitch: number } {
  const at = (t: number) => ({
    yaw: mix(from.yaw, pose.yaw, t),
    pitch: mix(from.pitch, pose.pitch, t),
  });
  if (organicEyesInside(family, pose)) return at(1);
  let [inside, outside] = [0, 1];
  for (let step = 0; step < 8; step++) {
    const t = (inside + outside) / 2;
    if (organicEyesInside(family, { ...pose, ...at(t) })) inside = t;
    else outside = t;
  }
  return at(inside);
}

/** The face every static portrait of this body wears, eyes open. */
export function organicRestEyes(family: number): [OrganicEye, OrganicEye] {
  return organicFaceEyes(family, { ...organicRestPose(family), lid: 1, round: 0, portrait: 1 });
}
