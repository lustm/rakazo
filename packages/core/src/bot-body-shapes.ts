/**
 * The bot body outlines every avatar draws: organic bodies pick one from the bot's id, and Avatar
 * Studio offers them all. Each is generated once from a few geometric primitives (rounded polygons,
 * unions of circles, radial profiles), normalized to fit a unit square around the origin, and
 * emitted as one smooth closed path, so web, mobile and notification portraits share geometry.
 */

type Point = readonly [number, number];

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const RADIAL_SAMPLES = 96;

/** Samples a star-shaped outline from its radius at each angle (0 is right, angles turn clockwise). */
function radial(radius: (angle: number) => number, smoothing = 0): Point[] {
  let radii = Array.from({ length: RADIAL_SAMPLES }, (_, index) =>
    radius((index / RADIAL_SAMPLES) * TAU),
  );
  for (let pass = 0; pass < smoothing; pass++)
    radii = radii.map(
      (value, index) =>
        (radii[(index + RADIAL_SAMPLES - 1) % RADIAL_SAMPLES]! +
          value * 2 +
          radii[(index + 1) % RADIAL_SAMPLES]!) /
        4,
    );
  return radii.map((value, index) => {
    const angle = (index / RADIAL_SAMPLES) * TAU;
    return [Math.cos(angle) * value, Math.sin(angle) * value];
  });
}

/** The outer edge of overlapping circles `[cx, cy, r]`, as seen from the origin. */
function circles(list: readonly (readonly [number, number, number])[]) {
  return (angle: number) => {
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    let reach = 0;
    for (const [cx, cy, r] of list) {
      const along = ux * cx + uy * cy;
      const discriminant = r * r - (cx * cx + cy * cy) + along * along;
      if (discriminant >= 0) reach = Math.max(reach, along + Math.sqrt(discriminant));
    }
    return reach;
  };
}

/** A convex polygon through `vertices` with every corner rounded to `corner`. */
function roundedPolygon(vertices: readonly Point[], corner: number): Point[] {
  const points: Point[] = [];
  const count = vertices.length;
  const tangents = vertices.map((vertex, index) => {
    const previous = vertices[(index + count - 1) % count]!;
    const next = vertices[(index + 1) % count]!;
    const toPrevious = unit([previous[0] - vertex[0], previous[1] - vertex[1]]);
    const toNext = unit([next[0] - vertex[0], next[1] - vertex[1]]);
    const half = Math.acos(toPrevious[0] * toNext[0] + toPrevious[1] * toNext[1]) / 2;
    const reach = corner / Math.tan(half);
    const bisector = unit([toPrevious[0] + toNext[0], toPrevious[1] + toNext[1]]);
    const centre: Point = [
      vertex[0] + (bisector[0] * corner) / Math.sin(half),
      vertex[1] + (bisector[1] * corner) / Math.sin(half),
    ];
    const start: Point = [vertex[0] + toPrevious[0] * reach, vertex[1] + toPrevious[1] * reach];
    const end: Point = [vertex[0] + toNext[0] * reach, vertex[1] + toNext[1] * reach];
    return { centre, start, end };
  });
  tangents.forEach(({ centre, start, end }, index) => {
    const from = Math.atan2(start[1] - centre[1], start[0] - centre[0]);
    let to = Math.atan2(end[1] - centre[1], end[0] - centre[0]);
    while (to < from) to += TAU;
    if (to - from > Math.PI) to -= TAU;
    for (let step = 0; step <= 8; step++) {
      const angle = from + ((to - from) * step) / 8;
      points.push([centre[0] + Math.cos(angle) * corner, centre[1] + Math.sin(angle) * corner]);
    }
    const next = tangents[(index + 1) % count]!.start;
    for (let step = 1; step < 4; step++)
      points.push([
        end[0] + ((next[0] - end[0]) * step) / 4,
        end[1] + ((next[1] - end[1]) * step) / 4,
      ]);
  });
  return points;
}

function regular(sides: number, rotation: number, stretch: Point = [1, 1]): Point[] {
  return Array.from({ length: sides }, (_, index) => {
    const angle = rotation * DEG + (index / sides) * TAU;
    return [Math.cos(angle) * stretch[0], Math.sin(angle) * stretch[1]];
  });
}

function rotate(points: readonly Point[], degrees: number): Point[] {
  const c = Math.cos(degrees * DEG);
  const s = Math.sin(degrees * DEG);
  return points.map(([x, y]) => [x * c - y * s, x * s + y * c]);
}

function unit([x, y]: Point): Point {
  const length = Math.hypot(x, y) || 1;
  return [x / length, y / length];
}

export interface BotBodyShape {
  readonly key: string;
  /** Outline fitted to the square from -1 to 1. */
  readonly points: readonly Point[];
  /** Where the face sits: the outline's centroid. */
  readonly centre: Point;
  /** Half the outline's width and height, for laying the face across it. */
  readonly extent: Point;
}

function fitShape(key: string, points: readonly Point[]): BotBodyShape {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const midX = (Math.max(...xs) + Math.min(...xs)) / 2;
  const midY = (Math.max(...ys) + Math.min(...ys)) / 2;
  const half = Math.max(Math.max(...xs) - midX, Math.max(...ys) - midY);
  const fitted = points.map(([x, y]): Point => [(x - midX) / half, (y - midY) / half]);
  let area = 0;
  let cx = 0;
  let cy = 0;
  fitted.forEach(([x0, y0], index) => {
    const [x1, y1] = fitted[(index + 1) % fitted.length]!;
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  });
  return {
    key,
    points: fitted,
    centre: [cx / (3 * area), cy / (3 * area)],
    extent: [
      (Math.max(...xs) - Math.min(...xs)) / 2 / half,
      (Math.max(...ys) - Math.min(...ys)) / 2 / half,
    ],
  };
}

/** In the order Avatar Studio lists them; stored `::shape_N` values index this list. */
export const BOT_BODY_SHAPES: readonly BotBodyShape[] = [
  fitShape(
    "circle",
    radial(() => 1),
  ),
  fitShape(
    "cloud",
    radial(
      circles([
        [-0.46, 0.14, 0.5],
        [0.14, -0.12, 0.66],
        [0.62, 0.22, 0.44],
        [-0.04, 0.3, 0.52],
      ]),
      3,
    ),
  ),
  fitShape("squircle", roundedPolygon(regular(4, 65), 0.36)),
  fitShape(
    "sparkle",
    rotate(
      radial((angle) => 0.6 + 0.4 * Math.abs(Math.cos(2 * angle)) ** 1.6, 6),
      12,
    ),
  ),
  fitShape(
    "clover",
    radial(
      circles([
        [0, 0, 0.62],
        [-0.42, -0.4, 0.5],
        [0.44, -0.36, 0.46],
        [0.42, 0.42, 0.5],
        [-0.4, 0.4, 0.46],
      ]),
      3,
    ),
  ),
  fitShape(
    "heart",
    rotate(
      radial(
        circles([
          [-0.42, -0.2, 0.56],
          [0.42, -0.2, 0.56],
          [0, 0.28, 0.5],
          [0, 0.62, 0.22],
        ]),
        3,
      ),
      -20,
    ),
  ),
  fitShape(
    "scallop",
    radial(
      circles([
        [0, 0, 0.82],
        ...regular(8, 10).map(([x, y]): readonly [number, number, number] => [
          x * 0.74,
          y * 0.74,
          0.28,
        ]),
      ]),
      2,
    ),
  ),
  fitShape(
    "drop",
    radial((angle) => 1 + 0.75 * Math.max(0, Math.cos(angle + 125 * DEG)) ** 6, 2),
  ),
  fitShape(
    "pill",
    rotate(
      roundedPolygon(
        [
          [-1, -0.56],
          [1, -0.56],
          [1, 0.56],
          [-1, 0.56],
        ],
        0.55,
      ),
      -8,
    ),
  ),
  fitShape("triangle", roundedPolygon(regular(3, 8), 0.26)),
  fitShape("pentagon", roundedPolygon(regular(5, -108), 0.32)),
  fitShape(
    "burst",
    radial((angle) => 1 + 0.17 * Math.cos(7 * angle + 0.6) + 0.05 * Math.cos(3 * angle), 4),
  ),
  fitShape("hex", roundedPolygon(regular(6, -82), 0.26)),
];

export const BOT_BODY_SHAPE_COUNT = BOT_BODY_SHAPES.length;

const round = (value: number) => Math.round(value * 100) / 100;

/** One shape as a smooth closed path, `size` units from its centre to the fitted square's edge. */
export function botBodyShapePath(index: number, size: number, cx = 0, cy = 0): string {
  const shape = BOT_BODY_SHAPES[index] ?? BOT_BODY_SHAPES[0]!;
  const points = shape.points.map(([x, y]): Point => [cx + x * size, cy + y * size]);
  const count = points.length;
  const at = (offset: number) => points[(offset + count) % count]!;
  let path = `M${round(at(0)[0])} ${round(at(0)[1])}`;
  for (let index = 0; index < count; index++) {
    const [p0, p1, p2, p3] = [at(index - 1), at(index), at(index + 1), at(index + 2)];
    path += `C${round(p1[0] + (p2[0] - p0[0]) / 6)} ${round(p1[1] + (p2[1] - p0[1]) / 6)} ${round(p2[0] - (p3[0] - p1[0]) / 6)} ${round(p2[1] - (p3[1] - p1[1]) / 6)} ${round(p2[0])} ${round(p2[1])}`;
  }
  return `${path}Z`;
}
