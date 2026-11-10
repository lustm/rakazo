/**
 * The bot body outlines every avatar draws: organic bodies pick one from the bot's id, and Avatar
 * Studio offers them all. Each outline is a smooth radial profile (a short Fourier series around
 * a point near its middle), fitted to the square from -1 to 1 and drawn as one closed path, so
 * web, mobile and notification portraits share geometry. Outlines are stored in their resting
 * orientation.
 */

type Point = readonly [number, number];

const TAU = Math.PI * 2;
const SAMPLES = 96;

interface RadialOutline {
  readonly key: string;
  /** Where the radial profile is centred, relative to the outline's box. */
  readonly origin: Point;
  /** Fourier coefficients [real, imaginary] of the radius around `origin`; the first is the mean. */
  readonly coeffs: readonly (readonly [number, number])[];
}

/** In the order Avatar Studio lists them; stored `::shape_N` values index this list. */
const OUTLINES: readonly RadialOutline[] = [
  { key: "circle", origin: [0, 0], coeffs: [[1, 0]] },
  {
    key: "cloud",
    origin: [-0.0858, 0.0264],
    coeffs: [
      [0.9295, 0.0],
      [0.0078, 0.0116],
      [0.0334, 0.017],
      [0.026, -0.0044],
      [-0.0064, -0.0018],
      [0.019, -0.0015],
      [0.0043, -0.0038],
      [-0.0015, 0.0042],
      [-0.006, 0.0024],
      [0.0006, 0.0001],
      [-0.0015, -0.002],
      [-0.0001, 0.0022],
      [0.0004, -0.0011],
      [0.0014, -0.0015],
      [0.0004, -0.0012],
    ],
  },
  {
    key: "squircle",
    origin: [-0.0089, 0.0028],
    coeffs: [
      [0.8822, 0.0],
      [0.0046, 0.0017],
      [0.005, -0.0304],
      [0.0006, 0.0007],
      [-0.0069, -0.0534],
      [0.0003, -0.0012],
      [-0.0051, 0.0016],
      [0.0003, -0.0001],
      [-0.0114, 0.0013],
      [-0.0004, -0.0],
      [0.001, 0.0001],
      [0.0, -0.0002],
      [-0.0005, 0.0029],
      [0.0, 0.0001],
      [-0.0008, -0.0002],
    ],
  },
  {
    key: "sparkle",
    origin: [-0.0093, 0.01],
    coeffs: [
      [0.8263, 0.0],
      [0.0047, 0.0052],
      [-0.0001, -0.0169],
      [-0.0022, 0.0008],
      [0.0738, 0.0341],
      [0.0007, 0.0025],
      [0.0004, 0.0019],
      [0.0003, 0.0001],
      [0.0013, -0.0007],
      [0.0002, -0.0005],
      [-0.0015, 0.0006],
      [-0.0006, -0.0003],
      [0.0017, 0.0055],
      [-0.0005, 0.0006],
      [0.001, 0.0001],
    ],
  },
  {
    key: "clover",
    origin: [-0.0069, 0.008],
    coeffs: [
      [0.9254, 0.0],
      [0.0035, 0.0045],
      [0.0041, -0.0284],
      [0.0011, 0.0004],
      [-0.0041, -0.0448],
      [0.0006, -0.0007],
      [0.0011, 0.0011],
      [-0.0001, 0.0006],
      [0.01, -0.0056],
      [0.0005, 0.0001],
      [-0.0025, 0.0006],
      [-0.0005, -0.0002],
      [0.0018, 0.0042],
      [-0.0001, 0.0002],
      [-0.0009, -0.0002],
    ],
  },
  {
    key: "heart",
    origin: [0.0195, -0.0269],
    coeffs: [
      [0.9143, 0.0],
      [0.0103, 0.0024],
      [0.0324, 0.0084],
      [-0.039, 0.0269],
      [-0.0042, 0.0086],
      [0.0081, 0.0018],
      [0.001, 0.0037],
      [-0.0025, 0.001],
      [-0.0006, -0.0015],
      [0.0016, 0.0007],
      [-0.0006, 0.001],
      [-0.0018, -0.0],
      [0.0005, -0.0001],
      [0.0002, 0.0006],
      [-0.0006, -0.0001],
    ],
  },
  {
    key: "scallop",
    origin: [-0.0121, 0.0039],
    coeffs: [
      [0.9208, 0.0],
      [0.0061, 0.0022],
      [0.0022, -0.0222],
      [0.0001, -0.0003],
      [0.0027, 0.0008],
      [-0.0004, 0.0015],
      [0.0217, -0.0292],
      [0.0009, -0.0011],
      [0.0046, 0.0041],
      [0.0001, 0.0005],
      [0.0022, -0.0023],
      [-0.0002, -0.0007],
      [0.0017, 0.0067],
      [0.0003, 0.0004],
      [-0.0036, 0.0012],
      [-0.0004, 0.0],
      [0.0002, -0.0002],
      [0.0006, -0.0],
      [-0.0036, -0.0009],
      [-0.0005, -0.0],
      [0.0007, -0.0013],
    ],
  },
  {
    key: "drop",
    origin: [-0.0528, 0.0547],
    coeffs: [
      [0.93, 0.0],
      [0.0119, 0.0056],
      [-0.0194, -0.0234],
      [0.0228, -0.0066],
      [-0.0027, 0.0172],
      [-0.0097, -0.0065],
      [0.0059, -0.004],
      [0.0006, 0.004],
      [-0.0023, -0.0008],
      [0.0011, -0.0009],
      [0.0004, 0.0011],
      [-0.0008, -0.0],
      [0.0003, -0.0004],
      [0.0001, 0.0003],
      [0.0001, -0.0001],
    ],
  },
  {
    key: "pill",
    origin: [-0.0201, 0.0204],
    coeffs: [
      [0.8662, 0.0],
      [0.0076, 0.0108],
      [0.0681, 0.0409],
      [0.0014, 0.0028],
      [-0.0034, -0.0062],
      [0.0001, -0.0008],
      [-0.0005, 0.0005],
      [-0.0002, -0.0],
      [-0.0003, 0.0006],
      [-0.0001, 0.0001],
      [0.0004, -0.0001],
      [0.0001, 0.0001],
      [0.0001, -0.0001],
      [-0.0, 0.0],
      [0.0001, 0.0],
    ],
  },
  {
    key: "triangle",
    origin: [-0.1589, 0.0671],
    coeffs: [
      [0.9243, 0.0],
      [0.0062, 0.0083],
      [-0.0005, 0.0032],
      [0.0779, -0.0169],
      [-0.0009, 0.0117],
      [0.0027, 0.0037],
      [0.0126, -0.0056],
      [0.0002, 0.0049],
      [0.0013, 0.0011],
      [0.0015, -0.0011],
      [0.0002, 0.0015],
      [0.0005, 0.0001],
      [0.0002, -0.0004],
      [0.0004, 0.0002],
      [-0.0, 0.0003],
    ],
  },
  {
    key: "pentagon",
    origin: [-0.0628, 0.0354],
    coeffs: [
      [0.9257, 0.0],
      [0.0021, 0.0036],
      [0.0049, -0.0249],
      [0.0284, -0.0183],
      [-0.0012, -0.0189],
      [-0.0223, -0.0072],
      [0.006, -0.0083],
      [-0.0022, -0.002],
      [-0.0057, 0.0007],
      [-0.0007, 0.0016],
      [0.0006, -0.0012],
      [-0.0024, 0.0015],
      [-0.0008, 0.0001],
      [0.0003, -0.0003],
      [-0.001, 0.0006],
    ],
  },
  {
    key: "burst",
    origin: [-0.0096, 0.0013],
    coeffs: [
      [0.8457, 0.0],
      [0.005, 0.0014],
      [0.0052, -0.0398],
      [0.0003, -0.0005],
      [-0.0046, -0.0012],
      [-0.0013, 0.0023],
      [0.0424, -0.0579],
      [0.0016, -0.002],
      [0.0028, 0.0035],
      [0.0004, 0.0003],
      [-0.0033, 0.0],
      [-0.0004, -0.0004],
      [0.0011, 0.0031],
      [-0.0003, 0.0005],
      [0.005, -0.0006],
      [0.0004, 0.0006],
      [0.0005, -0.0056],
      [0.0002, -0.0005],
      [-0.0003, -0.0001],
      [0.0001, -0.0005],
      [-0.0017, 0.003],
    ],
  },
  {
    key: "hex",
    origin: [-0.0168, 0.0051],
    coeffs: [
      [0.9322, 0.0],
      [0.0085, 0.0028],
      [0.0021, -0.0189],
      [-0.0001, -0.0003],
      [0.0056, 0.0022],
      [-0.0002, 0.0013],
      [0.0126, -0.0178],
      [0.001, -0.0007],
      [-0.0008, -0.0007],
      [-0.0001, 0.0001],
      [0.001, -0.0014],
      [0.0003, 0.0002],
      [-0.0011, -0.0032],
      [-0.0, -0.0003],
      [0.0001, -0.0002],
    ],
  },
];

export interface BotBodyShape {
  readonly key: string;
  /** Outline fitted to the square from -1 to 1. */
  readonly points: readonly Point[];
}

function trace({ origin, coeffs }: RadialOutline): Point[] {
  return Array.from({ length: SAMPLES }, (_, index) => {
    const angle = (index / SAMPLES) * TAU;
    let radius = coeffs[0]![0];
    for (let k = 1; k < coeffs.length; k++) {
      const [re, im] = coeffs[k]!;
      radius += 2 * (re * Math.cos(k * angle) - im * Math.sin(k * angle));
    }
    return [origin[0] + Math.cos(angle) * radius, origin[1] + Math.sin(angle) * radius];
  });
}

function fitShape(outline: RadialOutline): BotBodyShape {
  const points = trace(outline);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const midX = (Math.max(...xs) + Math.min(...xs)) / 2;
  const midY = (Math.max(...ys) + Math.min(...ys)) / 2;
  const half = Math.max(Math.max(...xs) - midX, Math.max(...ys) - midY);
  return {
    key: outline.key,
    points: points.map(([x, y]): Point => [(x - midX) / half, (y - midY) / half]),
  };
}

export const BOT_BODY_SHAPES: readonly BotBodyShape[] = OUTLINES.map(fitShape);

export const BOT_BODY_SHAPE_COUNT = BOT_BODY_SHAPES.length;

const round = (value: number) => Math.round(value * 100) / 100;

/** One shape as a smooth closed path, `size` units from its centre to the fitted square's edge. */
export function botBodyShapePath(index: number, size: number, cx = 0, cy = 0): string {
  const shape = BOT_BODY_SHAPES[index] ?? BOT_BODY_SHAPES[0]!;
  return smoothClosedPath(shape.points.map(([x, y]): Point => [cx + x * size, cy + y * size]));
}

/** A closed curve through `points` (Catmull-Rom, drawn as cubic Béziers). */
export function smoothClosedPath(points: readonly Point[]): string {
  const count = points.length;
  const at = (offset: number) => points[(offset + count) % count]!;
  let path = `M${round(at(0)[0])} ${round(at(0)[1])}`;
  for (let index = 0; index < count; index++) {
    const [p0, p1, p2, p3] = [at(index - 1), at(index), at(index + 1), at(index + 2)];
    path += `C${round(p1[0] + (p2[0] - p0[0]) / 6)} ${round(p1[1] + (p2[1] - p0[1]) / 6)} ${round(p2[0] - (p3[0] - p1[0]) / 6)} ${round(p2[1] - (p3[1] - p1[1]) / 6)} ${round(p2[0])} ${round(p2[1])}`;
  }
  return `${path}Z`;
}
