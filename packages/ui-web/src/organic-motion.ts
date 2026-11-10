import { ORGANIC_AVATAR_EYES } from "@rakazo/core";

/**
 * Organic avatar motion, computed per frame instead of looped keyframes. At rest the face lives
 * on gaze drift and irregular blinks while the body stays put; the eyes sit on an imagined ball
 * and turn toward the mouse pointer, sliding across the body and narrowing as they near its edge.
 * While the bot works, the body collapses into three pulsing dots and the eyes close.
 *
 * Everything here is a pure function of time and input so tests stay deterministic; the hook in
 * hooks/use-organic-motion.ts owns the clock and writes the frames to the DOM.
 */

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/** Radius of the ball the eyes ride on, in organic view box units (the box is 120 wide). */
const GAZE_RADIUS = 42;
/** Half the angle between the eyes; at rest it puts them at the static face's ±10.5. */
const EYE_SPLIT = Math.asin(ORGANIC_AVATAR_EYES.rightCx / GAZE_RADIUS) / DEG;
/** How far the eyes turn when the pointer is half a window or more away. */
export const MAX_YAW = 44;
export const MAX_PITCH = 34;

export const BLINK_DURATION = 0.18;
const DOUBLE_BLINK_CHANCE = 0.18;
const DOUBLE_BLINK_GAP = 0.24;
/** Turning toward or away from the pointer. */
export const TURN_TIME = 1.1;
/** Collapsing into the working dots and growing back. */
export const MODE_MORPH = 0.45;
/** How quickly the aim catches up with a moving pointer once the eyes are turned. */
const AIM_LAG = 0.08;

const DOT_RADIUS = 13;
const DOT_GAP = 33;
/** The body's scale when it has become the middle dot (bodies are about 48 units in radius). */
const BODY_DOT_SCALE = DOT_RADIUS / 46;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const easeOutQuint = (t: number) => 1 - (1 - clamp(t)) ** 5;
const smoothstep = (from: number, to: number, value: number) => {
  const t = clamp((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};

/** How open the lids are `progress` (0..1) of the way through a blink: a quick close, slower open. */
export function blinkLid(progress: number): number {
  const k = clamp(progress);
  return k < 0.45 ? 1 - k / 0.45 : (k - 0.45) / 0.55;
}

/** A dot of the working wave swells once every 1.5 s, each dot half a second after the last. */
export function dotPulse(seconds: number, index: number): number {
  const p = ((((seconds - index * 0.5) / 1.5) % 1) + 1) % 1;
  const k = p < 0.5 ? 0.5 - 0.5 * Math.cos(p * TAU) : 0;
  return clamp(k * 2);
}

/** Gaze angles toward a pointer `dx`, `dy` px from the avatar, scaled by half the window size. */
export function pointerGaze(
  dx: number,
  dy: number,
  halfWidth: number,
  halfHeight: number,
): { yaw: number; pitch: number } {
  return {
    yaw: clamp(dx / Math.max(1, halfWidth), -1, 1) * MAX_YAW,
    pitch: -clamp(dy / Math.max(1, halfHeight), -1, 1) * MAX_PITCH,
  };
}

/** Slow, never-repeating-looking wander from a few incommensurate sine periods. */
function gazeDrift(seconds: number): { yaw: number; pitch: number; roll: number } {
  const wave = (period: number, phase: number) => Math.sin((seconds / period) * TAU + phase);
  return {
    yaw: wave(11.3, 0.4) * 5.5 + wave(3.7, 2.1) * 1.6,
    pitch: wave(9.1, 1.3) * 4.2 + wave(4.3, 0.7) * 1.3,
    roll: wave(13.7, 2.9) * 2.2,
  };
}

/** Small seeded PRNG so each bot blinks on its own, reproducible rhythm. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seconds until the next blink: 1.9–4.6 s apart, with an occasional quick double blink. */
export function nextBlinkDelay(random: () => number, afterDouble: boolean): number {
  if (!afterDouble && random() < DOUBLE_BLINK_CHANCE) return BLINK_DURATION + DOUBLE_BLINK_GAP;
  return 1.9 + random() * 2.7;
}

export interface OrganicPose {
  /** Degrees; positive turns right / up. */
  yaw: number;
  pitch: number;
  roll: number;
  /** 1 open, 0 shut. */
  lid: number;
  /** 0 the resting body, 1 the three working dots. */
  mode: number;
  /** Vertical breath scale of the body. */
  breath: number;
  /** Clock for the dot wave, in seconds. */
  seconds: number;
}

export function restPose(working: boolean): OrganicPose {
  return { yaw: 0, pitch: 0, roll: 0, lid: 1, mode: working ? 1 : 0, breath: 1, seconds: 0 };
}

export interface OrganicFrame {
  body: string;
  bodyOpacity: number;
  eyes: [string, string];
  eyesOpacity: number;
  dots: { cx: number; cy: number; r: number; opacity: number }[];
}

const fixed = (value: number) => Math.round(value * 100) / 100;

/** Projects one eye onto the gaze ball: it slides with the gaze and foreshortens near the rim. */
function eyeTransform(pose: OrganicPose, side: -1 | 1, lidScale: number): string {
  const yaw = (pose.yaw + side * EYE_SPLIT) * DEG;
  const pitch = pose.pitch * DEG;
  const x = GAZE_RADIUS * Math.sin(yaw) * Math.cos(pitch);
  const y = -GAZE_RADIUS * Math.sin(pitch);
  const sx = Math.max(0.12, Math.cos(yaw) / Math.cos(EYE_SPLIT * DEG));
  const sy = Math.max(0.12, Math.cos(pitch)) * lidScale;
  // The rect is drawn at its static place, so move it to the origin before turning and scaling.
  const restX = side < 0 ? ORGANIC_AVATAR_EYES.leftCx : ORGANIC_AVATAR_EYES.rightCx;
  return `translate(${fixed(x)} ${fixed(y)}) rotate(${fixed(pose.roll)}) scale(${fixed(sx)} ${fixed(sy)}) translate(${-restX} ${-ORGANIC_AVATAR_EYES.cy})`;
}

export function organicFrame(pose: OrganicPose): OrganicFrame {
  const m = clamp(pose.mode);
  // Eyes close as the body starts to collapse, and reopen only once it has nearly regrown.
  const eyeGate = 1 - clamp(m * 2.5);
  const lidScale = (0.06 + 0.94 * clamp(pose.lid)) * (0.06 + 0.94 * eyeGate);
  const bodyScale = 1 - (1 - BODY_DOT_SCALE) * m;
  return {
    body: `scale(${fixed(bodyScale)} ${fixed(bodyScale * pose.breath)})`,
    bodyOpacity: fixed(1 - smoothstep(0.55, 0.95, m)),
    eyes: [eyeTransform(pose, -1, lidScale), eyeTransform(pose, 1, lidScale)],
    eyesOpacity: fixed(eyeGate > 0 ? 1 : 0),
    dots: [0, 1, 2].map((index) => {
      const pulse = dotPulse(pose.seconds, index);
      const side = index - 1;
      const grown = side === 0 ? smoothstep(0.45, 0.9, m) : smoothstep(0.2, 1, m);
      return {
        cx: fixed(side * DOT_GAP * easeOutQuint(m)),
        cy: fixed(-5 * pulse * grown),
        r: fixed(DOT_RADIUS * (0.78 + 0.22 * pulse) * grown),
        opacity: fixed(grown),
      };
    }),
  };
}

/** Per-avatar animation state: one per mounted, visible avatar. */
export interface OrganicMotion {
  last: number;
  phase: number;
  working: boolean;
  modeFrom: number;
  modeTo: number;
  modeSince: number;
  looking: boolean;
  lookFrom: number;
  lookTo: number;
  lookSince: number;
  aimYaw: number;
  aimPitch: number;
  random: () => number;
  blinkAt: number;
  nextBlink: number;
  doubled: boolean;
}

export function createOrganicMotion(seed: number, working: boolean, now: number): OrganicMotion {
  const random = mulberry32(seed ^ 0x5eed);
  return {
    last: now,
    // Bots on one screen should not drift in step.
    phase: (seed % 997) * 0.37,
    working,
    modeFrom: working ? 1 : 0,
    modeTo: working ? 1 : 0,
    modeSince: now,
    looking: false,
    lookFrom: 0,
    lookTo: 0,
    lookSince: now,
    aimYaw: 0,
    aimPitch: 0,
    random,
    blinkAt: Number.NEGATIVE_INFINITY,
    nextBlink: now + 1.4 + random() * 1.5,
    doubled: false,
  };
}

const eased = (from: number, to: number, since: number, now: number, duration: number) =>
  from + (to - from) * easeOutQuint((now - since) / duration);

/** Advances `motion` to `now` and returns the pose to draw. `aim` is the pointer's gaze, if any. */
export function stepOrganicMotion(
  motion: OrganicMotion,
  now: number,
  working: boolean,
  aim: { yaw: number; pitch: number } | null,
): OrganicPose {
  const dt = clamp(now - motion.last, 0, 0.064);
  motion.last = now;

  if (working !== motion.working) {
    motion.modeFrom = eased(motion.modeFrom, motion.modeTo, motion.modeSince, now, MODE_MORPH);
    motion.modeTo = working ? 1 : 0;
    motion.modeSince = now;
    motion.working = working;
  }
  const mode = eased(motion.modeFrom, motion.modeTo, motion.modeSince, now, MODE_MORPH);

  const looking = aim !== null && !working;
  if (looking !== motion.looking) {
    motion.lookFrom = eased(motion.lookFrom, motion.lookTo, motion.lookSince, now, TURN_TIME);
    motion.lookTo = looking ? 1 : 0;
    motion.lookSince = now;
    motion.looking = looking;
    if (looking && aim) {
      motion.aimYaw = aim.yaw;
      motion.aimPitch = aim.pitch;
    }
  }
  if (looking && aim) {
    const follow = 1 - Math.exp(-dt / AIM_LAG);
    motion.aimYaw += (aim.yaw - motion.aimYaw) * follow;
    motion.aimPitch += (aim.pitch - motion.aimPitch) * follow;
  }
  const mix = eased(motion.lookFrom, motion.lookTo, motion.lookSince, now, TURN_TIME);

  if (now >= motion.nextBlink) {
    motion.blinkAt = motion.nextBlink;
    const delay = nextBlinkDelay(motion.random, motion.doubled);
    motion.doubled = delay < 1;
    motion.nextBlink = motion.blinkAt + delay;
  }
  const sinceBlink = now - motion.blinkAt;
  const lid = sinceBlink < BLINK_DURATION ? blinkLid(sinceBlink / BLINK_DURATION) : 1;

  const drift = gazeDrift(now + motion.phase);
  return {
    yaw: motion.aimYaw * mix + drift.yaw,
    pitch: motion.aimPitch * mix + drift.pitch,
    roll: drift.roll,
    lid,
    mode,
    breath: 1 + Math.sin((now / 3.4) * TAU) * 0.005,
    seconds: now,
  };
}
