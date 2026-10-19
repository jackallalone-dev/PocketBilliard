// Shared dimensions for the visible table, 3D contacts, and shot guide.
// Coordinates are the cushion noses; the playing area keeps its 2:1 ratio.
// A 100 × 50 inch tournament bed with 2.25 inch balls, in scene units.
const INCH = 8.6 / 50;
export const TABLE = Object.freeze({
  width: 8.6, length: 17.2, radius: 8.6 * 2.25 / 50 / 2,
  // WPA: 4–7.5 inch total rail, 1.875–2 inch covered cushion, nose at
  // 63.5% of ball diameter. The 1.75 inch cap height is our selected profile,
  // not a universal specification. It gives a ~9.4° cushion-top slope.
  // 7 inch rails give the 114 × 64 inch outside size of a 9-foot table.
  cushionDepth: 1.9375 * INCH, cushionNoseHeight: 2.25 * 0.635 * INCH,
  railWidth: 7 * INCH, railTopHeight: 1.75 * INCH,
  clothHeight: 0.028, headSpot: 4.3, footSpot: -4.3,
  frameWidth: 8.6 + 14 * INCH, frameLength: 17.2 + 14 * INCH, frameCornerRadius: 0.62,
});
const X = TABLE.width / 2;
const Z = TABLE.length / 2;
const D = TABLE.cushionDepth;
const cornerMouth = 4.5 * INCH / Math.SQRT2;
const sideMouth = 5 * INCH / 2;
const cornerJaw = D / Math.tan(38 * Math.PI / 180); // 142° included angle.
const sideJaw = D * Math.tan(14 * Math.PI / 180); // 104° included angle.
// Holes sit back in the rails, behind the mouth lines, rather than cutting into
// the bed: WPA shelf depth is 1–2.25 in at corners and 0–0.375 in at sides.
const CORNER_SHELF = 1.5 * INCH, SIDE_SHELF = 0.1875 * INCH;
const cornerOffset = (CORNER_SHELF + 0.43 - cornerMouth / Math.SQRT2) / Math.SQRT2;
const sideOffset = SIDE_SHELF + 0.365;

export const POCKETS = [
  { x: -X - cornerOffset, z: -Z - cornerOffset, radius: 0.43, captureRadius: 0.34 },
  { x: X + cornerOffset, z: -Z - cornerOffset, radius: 0.43, captureRadius: 0.34 },
  { x: -X - sideOffset, z: 0, radius: 0.365, captureRadius: 0.285 },
  { x: X + sideOffset, z: 0, radius: 0.365, captureRadius: 0.285 },
  { x: -X - cornerOffset, z: Z + cornerOffset, radius: 0.43, captureRadius: 0.34 },
  { x: X + cornerOffset, z: Z + cornerOffset, radius: 0.43, captureRadius: 0.34 },
];

export const CUSHIONS = [];
for (const side of [-1, 1]) {
  for (const end of [-1, 1]) {
    // Front edge, side-pocket jaw, back edge, diagonal corner-pocket jaw.
    CUSHIONS.push([
      { x: side * X, z: end * (Z - cornerMouth) },
      { x: side * X, z: end * sideMouth },
      { x: side * (X + D), z: end * (sideMouth - sideJaw) },
      { x: side * (X + D), z: end * (Z - cornerMouth + cornerJaw) },
    ]);
  }
  CUSHIONS.push([
    { x: -X + cornerMouth, z: side * Z },
    { x: X - cornerMouth, z: side * Z },
    { x: X - cornerMouth + cornerJaw, z: side * (Z + D) },
    { x: -X + cornerMouth - cornerJaw, z: side * (Z + D) },
  ]);
}

export const CUSHION_SEGMENTS = CUSHIONS.flatMap((points) => points.map((a, i) => {
  const b = points[(i + 1) % points.length];
  const dx = b.x - a.x, dz = b.z - a.z;
  return { a, b, dx, dz, lengthSq: dx * dx + dz * dz };
}));

export function closestPoint(segment, x, z) {
  const t = Math.max(0, Math.min(1, ((x - segment.a.x) * segment.dx + (z - segment.a.z) * segment.dz) / segment.lengthSq));
  return { x: segment.a.x + segment.dx * t, z: segment.a.z + segment.dz * t };
}

// The wooden frame's opening follows the cloth bed and wraps around the pockets.
// Unlike overlapping hole paths, this single contour triangulates cleanly.
export function frameOpeningPoints() {
  const bx = X + D, bz = Z + D;
  const corner = POCKETS[1], side = POCKETS[3];
  const cr = corner.radius + 0.07, sr = side.radius + 0.06;
  const cornerStart = Math.atan2(-bz - corner.z, -Math.sqrt(cr * cr - (-bz - corner.z) ** 2));
  const cornerEnd = Math.acos((bx - corner.x) / cr);
  const sideAngle = Math.acos((bx - side.x) / sr);
  const points = [{ x: 0, z: -bz }];
  const arc = (x, z, radius, from, to) => {
    const steps = Math.ceil((to - from) * 12);
    for (let i = 0; i <= steps; i++) {
      const angle = from + (to - from) * i / steps;
      points.push({ x: x + Math.cos(angle) * radius, z: z + Math.sin(angle) * radius });
    }
  };
  arc(corner.x, corner.z, cr, cornerStart, cornerEnd);
  arc(side.x, side.z, sr, -sideAngle, sideAngle);
  arc(corner.x, -corner.z, cr, -cornerEnd, -cornerStart);
  points.push({ x: 0, z: bz });
  return [...points, ...points.slice(1, -1).reverse().map((p) => ({ x: -p.x, z: p.z }))];
}

// Flat metal castings follow the same pocket cutouts as the frame, rather than
// laying closed plates over the pocket entrances or the cloth.
export function pocketSurroundPoints(pocket) {
  const bx = X + D, bz = Z + D;
  const ox = TABLE.frameWidth / 2, oz = TABLE.frameLength / 2;
  const cx = Math.abs(pocket.x), cz = Math.abs(pocket.z);
  const points = [];
  const arc = (x, z, radius, from, to) => {
    const steps = Math.ceil(Math.abs(to - from) * 16);
    for (let i = 0; i <= steps; i++) {
      const angle = from + (to - from) * i / steps;
      points.push({ x: x + Math.cos(angle) * radius, z: z + Math.sin(angle) * radius });
    }
  };
  if (cz > 0) {
    const radius = pocket.radius + 0.07;
    const corner = TABLE.frameCornerRadius;
    points.push({ x: X - 0.5, z: oz });
    arc(ox - corner, oz - corner, corner, Math.PI / 2, 0);
    points.push({ x: ox, z: Z - 0.5 }, { x: bx, z: Z - 0.5 });
    arc(cx, cz, radius, -Math.acos((bx - cx) / radius), Math.PI - Math.asin((bz - cz) / radius));
    points.push({ x: X - 0.5, z: bz });
  } else {
    const radius = pocket.radius + 0.06;
    const angle = Math.acos((bx - cx) / radius);
    points.push({ x: ox, z: -0.64 }, { x: ox, z: 0.64 }, { x: bx, z: 0.64 });
    arc(cx, 0, radius, angle, -angle);
    points.push({ x: bx, z: -0.64 });
  }
  return points.map((p) => ({ x: p.x * Math.sign(pocket.x), z: p.z * (Math.sign(pocket.z) || 1) }));
}
