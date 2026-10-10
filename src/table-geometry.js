// One plan-view layout for the visible cushions, collisions, and shot guide.
// Coordinates are the cushion noses; the playing area keeps its 2:1 ratio.
// A 100 × 50 inch tournament bed with 2.25 inch balls, in scene units.
export const TABLE = Object.freeze({
  width: 8.6, length: 17.2, radius: 8.6 * 2.25 / 50 / 2,
  cushionDepth: 0.3, headSpot: 4.3, footSpot: -4.3,
  frameWidth: 10.23, frameLength: 18.83, frameCornerRadius: 0.55,
});
const X = TABLE.width / 2;
const Z = TABLE.length / 2;
const D = TABLE.cushionDepth;
const cornerMouth = 0.54;
const sideMouth = 0.48;

export const POCKETS = [
  { x: -X - 0.14, z: -Z - 0.14, radius: 0.43, captureRadius: 0.34 },
  { x: X + 0.14, z: -Z - 0.14, radius: 0.43, captureRadius: 0.34 },
  { x: -X - 0.17, z: 0, radius: 0.365, captureRadius: 0.285 },
  { x: X + 0.17, z: 0, radius: 0.365, captureRadius: 0.285 },
  { x: -X - 0.14, z: Z + 0.14, radius: 0.43, captureRadius: 0.34 },
  { x: X + 0.14, z: Z + 0.14, radius: 0.43, captureRadius: 0.34 },
];

export const CUSHIONS = [];
for (const side of [-1, 1]) {
  for (const end of [-1, 1]) {
    // Front edge, side-pocket jaw, back edge, diagonal corner-pocket jaw.
    CUSHIONS.push([
      { x: side * X, z: end * (Z - cornerMouth) },
      { x: side * X, z: end * sideMouth },
      { x: side * (X + D), z: end * 0.35 },
      { x: side * (X + D), z: end * (Z - cornerMouth + D) },
    ]);
  }
  CUSHIONS.push([
    { x: -X + cornerMouth, z: side * Z },
    { x: X - cornerMouth, z: side * Z },
    { x: X - cornerMouth + D, z: side * (Z + D) },
    { x: -X + cornerMouth - D, z: side * (Z + D) },
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

function rayCircle(x, z, dx, dz, cx, cz, radius) {
  const ox = cx - x, oz = cz - z;
  const along = ox * dx + oz * dz;
  const perpendicularSq = ox * ox + oz * oz - along * along;
  if (perpendicularSq > radius * radius) return Infinity;
  const near = along - Math.sqrt(Math.max(0, radius * radius - perpendicularSq));
  return near >= -1e-7 ? Math.max(0, near) : Infinity;
}

export function boundaryDistance(x, z, dx, dz) {
  let nearest = Infinity;
  for (const segment of CUSHION_SEGMENTS) {
    const length = Math.sqrt(segment.lengthSq);
    const nx = -segment.dz / length, nz = segment.dx / length;
    const originNormal = (x - segment.a.x) * nx + (z - segment.a.z) * nz;
    const velocityNormal = dx * nx + dz * nz;
    for (const side of [-1, 1]) {
      if (velocityNormal * side >= -1e-8) continue;
      const distance = (side * TABLE.radius - originNormal) / velocityNormal;
      if (distance < -1e-7) continue;
      const along = ((x + dx * distance - segment.a.x) * segment.dx + (z + dz * distance - segment.a.z) * segment.dz) / segment.lengthSq;
      if (along >= 0 && along <= 1) nearest = Math.min(nearest, Math.max(0, distance));
    }
    nearest = Math.min(nearest,
      rayCircle(x, z, dx, dz, segment.a.x, segment.a.z, TABLE.radius),
      rayCircle(x, z, dx, dz, segment.b.x, segment.b.z, TABLE.radius));
  }
  for (const p of POCKETS) nearest = Math.min(nearest, rayCircle(x, z, dx, dz, p.x, p.z, p.captureRadius));
  return Number.isFinite(nearest) ? nearest : TABLE.length * 2;
}
