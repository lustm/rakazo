import type { OrganicEye } from "@rakazo/core";
import { ORGANIC_REST_GAZE, organicFaceEyes } from "@rakazo/core";

/**
 * Organic avatar motion, computed per frame instead of looped keyframes. At rest a bot looks up
 * and to the right, drifting slightly and blinking on an irregular rhythm. Hovering its row turns
 * it to face the pointer. While it works it acts busy: glances around, faces you, widens its
 * eyes, shrinks, tilts, spins like a coin and squashes flat, in a seeded random order.
 *
 * Everything here is a pure function of time and input so tests stay deterministic; the hook in
 * hooks/use-organic-motion.ts owns the clock and writes the frames to the DOM.
 */

const TAU = Math.PI * 2;

export const BLINK_DURATION = 0.18;
const DOUBLE_BLINK_CHANCE = 0.18;
const DOUBLE_BLINK_GAP = 0.24;
/** How far the gaze turns toward a pointer an avatar width or more from its centre. */
export const LOOK_YAW = 38;
export const LOOK_PITCH = 32;
const SPIN_DURATION = 0.7;
const SQUASH_DURATION = 0.45;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const easeOutQuint = (t: number) => 1 - (1 - clamp(t)) ** 5;

/** How open the lids are `progress` (0..1) of the way through a blink: a quick close, slower open. */
export function blinkLid(progress: number): number {
  const k = clamp(progress);
  return k < 0.45 ? 1 - k / 0.45 : (k - 0.45) / 0.55;
}

/** Gaze toward a pointer `dx`, `dy` px from the centre of an avatar `width` px wide. */
export function pointerGaze(dx: number, dy: number, width: number): { yaw: number; pitch: number } {
  const reach = Math.max(1, width * 1.2);
  return {
    yaw: clamp(dx / reach, -1, 1) * LOOK_YAW,
    pitch: -clamp(dy / reach, -1, 1) * LOOK_PITCH,
  };
}

/** Slow wander from a few incommensurate sine periods. */
function gazeDrift(seconds: number): { yaw: number; pitch: number } {
  const wave = (period: number, phase: number) => Math.sin((seconds / period) * TAU + phase);
  return {
    yaw: wave(11.3, 0.4) * 5.5 + wave(3.7, 2.1) * 1.6,
    pitch: wave(9.1, 1.3) * 4.2 + wave(4.3, 0.7) * 1.3,
  };
}

/** Small seeded PRNG so each bot blinks and fidgets on its own, reproducible rhythm. */
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

/** A momentary squash flat and back: fast down, brief hold, softer recovery. */
export function squashAmount(progress: number): number {
  if (progress <= 0 || progress >= 1) return 0;
  if (progress < 0.27) return easeOutQuint(progress / 0.27);
  if (progress < 0.4) return 1;
  return 1 - easeOutQuint((progress - 0.4) / 0.6);
}

export interface OrganicPose {
  yaw: number;
  pitch: number;
  /** Degrees the whole avatar leans. */
  roll: number;
  lid: number;
  round: number;
  scale: number;
  /** 0..1, how flat the body is squashed. */
  squash: number;
  /** Degrees of a coin-flip turn. */
  spin: number;
  breath: number;
}

export function restPose(): OrganicPose {
  return { ...ORGANIC_REST_GAZE, lid: 1, round: 0, scale: 1, squash: 0, spin: 0, breath: 1 };
}

export interface OrganicFrame {
  turn: string;
  body: string;
  face: string;
  eyes: [OrganicEye, OrganicEye];
}

const fixed = (value: number) => Math.round(value * 1000) / 1000;

export function organicFrame(family: number, pose: OrganicPose): OrganicFrame {
  const squashX = 1 + 0.15 * pose.squash;
  const squashY = 1 - 0.8 * pose.squash;
  const turned = Math.max(0.05, Math.abs(Math.cos((pose.spin * Math.PI) / 180)));
  return {
    turn: `rotate(${fixed(pose.roll)})`,
    body: `scale(${fixed(pose.scale * squashX * turned)} ${fixed(pose.scale * squashY * pose.breath)})`,
    face: `scale(${fixed(pose.scale * squashX)} ${fixed(pose.scale * squashY)})`,
    eyes: organicFaceEyes(family, {
      yaw: pose.yaw + pose.spin,
      pitch: pose.pitch,
      lid: pose.lid,
      round: pose.round,
    }),
  };
}

type Channel = "yaw" | "pitch" | "roll" | "round" | "scale";
type Targets = Record<Channel, number>;

interface Beat {
  targets: Targets;
  /** Seconds the beat holds before the next one. */
  hold: number;
  spin?: boolean;
  squash?: boolean;
}

const range = (random: () => number, from: number, to: number) => from + random() * (to - from);
const FACING: Targets = { yaw: 0, pitch: 0, roll: 0, round: 0, scale: 1 };

/** The busy moves, weighted by how often they come up. */
const BEATS: readonly { name: string; weight: number; make: (random: () => number) => Beat }[] = [
  {
    name: "glance",
    weight: 3,
    make: (r) => ({
      targets: {
        yaw: range(r, -38, 38),
        pitch: range(r, -22, 28),
        roll: range(r, -14, 14),
        round: 0,
        scale: 1,
      },
      hold: range(r, 0.9, 1.6),
    }),
  },
  { name: "face", weight: 1, make: (r) => ({ targets: FACING, hold: range(r, 1, 1.8) }) },
  {
    name: "wide",
    weight: 2,
    make: (r) => ({
      targets: {
        yaw: range(r, -24, 24),
        pitch: range(r, -18, 10),
        roll: range(r, -10, 10),
        round: 1,
        scale: 1,
      },
      hold: range(r, 1.4, 2.4),
    }),
  },
  {
    name: "shrink",
    weight: 1,
    make: (r) => ({
      targets: { yaw: range(r, -14, 14), pitch: range(r, -8, 8), roll: 0, round: 1, scale: 0.72 },
      hold: range(r, 1.6, 2.4),
    }),
  },
  {
    name: "tilt",
    weight: 2,
    make: (r) => {
      const side = r() < 0.5 ? -1 : 1;
      return {
        targets: { yaw: side * 26, pitch: 10, roll: side * range(r, 18, 26), round: 0, scale: 1 },
        hold: range(r, 0.9, 1.4),
      };
    },
  },
  { name: "spin", weight: 1, make: () => ({ targets: FACING, hold: 1.2, spin: true }) },
  { name: "squash", weight: 1, make: () => ({ targets: FACING, hold: 0.9, squash: true }) },
];
const BEAT_WEIGHT = BEATS.reduce((sum, beat) => sum + beat.weight, 0);

function pickBeat(random: () => number, previous: string): { name: string; beat: Beat } {
  for (;;) {
    let ticket = random() * BEAT_WEIGHT;
    let choice = BEATS[0]!;
    for (const beat of BEATS) {
      choice = beat;
      ticket -= beat.weight;
      if (ticket < 0) break;
    }
    if (choice.name !== previous) return { name: choice.name, beat: choice.make(random) };
  }
}

/** Per-avatar animation state: one per mounted, visible avatar. */
export interface OrganicMotion {
  last: number;
  phase: number;
  pose: Targets;
  random: () => number;
  blinkAt: number;
  nextBlink: number;
  doubled: boolean;
  beatName: string;
  beat: Beat | null;
  nextBeat: number;
  spinAt: number;
  squashAt: number;
}

export function createOrganicMotion(seed: number, now: number): OrganicMotion {
  const random = mulberry32(seed ^ 0x5eed);
  const { yaw, pitch, roll } = ORGANIC_REST_GAZE;
  return {
    last: now,
    // Bots on one screen should not drift in step.
    phase: (seed % 997) * 0.37,
    pose: { yaw, pitch, roll, round: 0, scale: 1 },
    random,
    blinkAt: Number.NEGATIVE_INFINITY,
    nextBlink: now + 1.4 + random() * 1.5,
    doubled: false,
    beatName: "",
    beat: null,
    nextBeat: now,
    spinAt: Number.NEGATIVE_INFINITY,
    squashAt: Number.NEGATIVE_INFINITY,
  };
}

/** Seconds for a channel to close most of the gap to its target: snappy toward a pointer. */
const FOLLOW_TAU = 0.07;
const BEAT_TAU = 0.12;
const SETTLE_TAU = 0.22;

/** Advances `motion` to `now` and returns the pose to draw. `aim` is the hovering pointer's gaze. */
export function stepOrganicMotion(
  motion: OrganicMotion,
  now: number,
  working: boolean,
  aim: { yaw: number; pitch: number } | null,
): OrganicPose {
  const dt = clamp(now - motion.last, 0, 0.064);
  motion.last = now;

  if (!working) motion.beat = null;
  else if (!motion.beat || now >= motion.nextBeat) {
    const { name, beat } = pickBeat(motion.random, motion.beatName);
    motion.beatName = name;
    motion.beat = beat;
    motion.nextBeat = now + beat.hold;
    if (beat.spin) motion.spinAt = now;
    if (beat.squash) motion.squashAt = now;
  }

  let targets: Targets;
  let tau: number;
  if (aim) {
    targets = { yaw: aim.yaw, pitch: aim.pitch, roll: 0, round: 0, scale: 1 };
    tau = FOLLOW_TAU;
  } else if (motion.beat) {
    targets = motion.beat.targets;
    tau = BEAT_TAU;
  } else {
    const drift = gazeDrift(now + motion.phase);
    targets = {
      yaw: ORGANIC_REST_GAZE.yaw + drift.yaw,
      pitch: ORGANIC_REST_GAZE.pitch + drift.pitch,
      roll: ORGANIC_REST_GAZE.roll,
      round: 0,
      scale: 1,
    };
    tau = SETTLE_TAU;
  }
  const follow = 1 - Math.exp(-dt / tau);
  for (const channel of Object.keys(targets) as Channel[])
    motion.pose[channel] += (targets[channel] - motion.pose[channel]) * follow;

  if (now >= motion.nextBlink) {
    motion.blinkAt = motion.nextBlink;
    const delay = nextBlinkDelay(motion.random, motion.doubled);
    motion.doubled = delay < 1;
    motion.nextBlink = motion.blinkAt + delay;
  }
  const sinceBlink = now - motion.blinkAt;
  const lid = sinceBlink < BLINK_DURATION ? blinkLid(sinceBlink / BLINK_DURATION) : 1;
  const spinProgress = (now - motion.spinAt) / SPIN_DURATION;
  const spin = spinProgress > 0 && spinProgress < 1 ? 360 * easeInOutCubic(spinProgress) : 0;

  return {
    ...motion.pose,
    lid,
    squash: squashAmount((now - motion.squashAt) / SQUASH_DURATION),
    spin,
    breath: 1 + Math.sin((now / 3.4) * TAU) * 0.005,
  };
}
