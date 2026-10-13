import { ShapeUtils, Vector2, Vector3, Triangle } from 'three';
import { TABLE, CUSHIONS, POCKETS, frameOpeningPoints } from './table-geometry.js';

// Heights are above the cloth, just like ball.y. Render these same triangles
// translated by TABLE.clothHeight; there is no separate invisible rail shape.
const point = (p, y) => new Vector3(p.x, y, p.z);
const surface = (a, b, c, kind, rail = null) => {
  const triangle = new Triangle(a, b, c), normal = triangle.getNormal(new Vector3());
  return { triangle, normal, kind, rail,
    minX: Math.min(a.x, b.x, c.x), maxX: Math.max(a.x, b.x, c.x),
    minY: Math.min(a.y, b.y, c.y), maxY: Math.max(a.y, b.y, c.y),
    minZ: Math.min(a.z, b.z, c.z), maxZ: Math.max(a.z, b.z, c.z) };
};

export function roundedOutline(width, length, radius, steps = 12) {
  const points = [];
  for (let corner = 0; corner < 4; corner++) {
    const angle = corner * Math.PI / 2;
    const x = (corner === 0 || corner === 3 ? 1 : -1) * (width / 2 - radius);
    const z = (corner < 2 ? 1 : -1) * (length / 2 - radius);
    for (let i = 0; i <= steps; i++) {
      const a = angle + i / steps * Math.PI / 2;
      points.push({ x: x + radius * Math.cos(a), z: z + radius * Math.sin(a) });
    }
  }
  return points;
}

function flatSurface(outline, holes, height, kind) {
  const contour = outline.map((p) => new Vector2(p.x, p.z));
  const cutouts = holes.map((hole) => hole.map((p) => new Vector2(p.x, p.z)));
  const vertices = [...outline, ...holes.flat()].map((p) => point(p, height));
  return ShapeUtils.triangulateShape(contour, cutouts).map(([a, b, c]) => {
    const face = surface(vertices[a], vertices[b], vertices[c], kind);
    return face.normal.y > 0 ? face : surface(vertices[a], vertices[c], vertices[b], kind);
  });
}

export const FRAME_OUTLINE = roundedOutline(TABLE.frameWidth, TABLE.frameLength, TABLE.frameCornerRadius);
export const FRAME_TOP = flatSurface(FRAME_OUTLINE, [frameOpeningPoints()], TABLE.railTopHeight, 'wood');
export const BED_TOP = flatSurface(
  roundedOutline(TABLE.frameWidth - 0.1, TABLE.frameLength - 0.1, 0.45),
  POCKETS.map((p) => Array.from({ length: 64 }, (_, i) => ({ x: p.x + p.radius * Math.cos(i * Math.PI / 32), z: p.z + p.radius * Math.sin(i * Math.PI / 32) }))),
  0, 'cloth',
);

export const CUSHION_FACES = CUSHIONS.map((points, index) => {
  const noseA = point(points[0], TABLE.cushionNoseHeight), noseB = point(points[1], TABLE.cushionNoseHeight);
  const backB = point(points[2], TABLE.railTopHeight), backA = point(points[3], TABLE.railTopHeight);
  const lowA = point(points[3], 0.018), lowB = point(points[2], 0.018);
  const center = new Vector3().add(noseA).add(noseB).add(backA).add(backB).add(lowA).add(lowB).divideScalar(6);
  const faces = [];
  // Triangular rubber cross-section: sloping top, undercut nose, vertical back,
  // and pocket jaws. Main nose rail IDs match CUSHION_SEGMENTS for rule tracking.
  for (const [polygon, rail] of [[ [noseA, noseB, backB, backA], index * 4 ],
    [[noseA, lowA, lowB, noseB], index * 4], [[backA, backB, lowB, lowA], index * 4 + 2],
    [[noseB, lowB, backB], index * 4 + 1], [[noseA, backA, lowA], index * 4 + 3]]) {
    for (let i = 1; i < polygon.length - 1; i++) {
      let face = surface(polygon[0], polygon[i], polygon[i + 1], 'rubber', rail);
      const outward = face.triangle.getMidpoint(new Vector3()).sub(center);
      if (face.normal.dot(outward) < 0) face = surface(polygon[0], polygon[i + 1], polygon[i], 'rubber', rail);
      faces.push(face);
    }
  }
  return faces;
});

// The rail's inner and outer vertical walls close the wooden volume. Inward
// pocket cutouts are shared with frameOpeningPoints, including curved castings.
export const FRAME_WALLS = [];
for (const [outline, inward] of [[FRAME_OUTLINE, false], [frameOpeningPoints(), true]]) {
  let area = 0;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];area += a.x * b.z - b.x * a.z;
  }
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    const vertices = [point(a, TABLE.railTopHeight), point(b, TABLE.railTopHeight), point(b, -0.25), point(a, -0.25)];
    const outward = new Vector3(b.z - a.z, 0, a.x - b.x).multiplyScalar((area > 0 ? 1 : -1) * (inward ? -1 : 1));
    for (const [j, k] of [[1, 2], [2, 3]]) {
      let face = surface(vertices[0], vertices[j], vertices[k], 'wood');
      if (face.normal.dot(outward) < 0) face = surface(vertices[0], vertices[k], vertices[j], 'wood');
      FRAME_WALLS.push(face);
    }
  }
}

export const TABLE_SURFACES = [...BED_TOP, ...FRAME_TOP, ...FRAME_WALLS, ...CUSHION_FACES.flat()];
const buckets = new Map();
for (const face of TABLE_SURFACES) {
  for (let x = Math.floor(face.minX - TABLE.radius); x <= Math.floor(face.maxX + TABLE.radius); x++) {
    for (let z = Math.floor(face.minZ - TABLE.radius); z <= Math.floor(face.maxZ + TABLE.radius); z++) {
      const key = `${x}:${z}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(face);
    }
  }
}

const center = new Vector3(), closest = new Vector3();
export function tableContacts(ball, margin = 0.00001) {
  const r = TABLE.radius;
  center.set(ball.x, r + (ball.y || 0), ball.z);
  const contacts = [];
  for (const face of buckets.get(`${Math.floor(ball.x)}:${Math.floor(ball.z)}`) || []) {
    if (center.y < face.minY - r || center.y > face.maxY + r + margin ||
      ball.x < face.minX - r - margin || ball.x > face.maxX + r + margin ||
      ball.z < face.minZ - r - margin || ball.z > face.maxZ + r + margin) continue;
    // Only the outward side can be contacted: a top face must not pull a ball
    // approaching the underside of the nose up through the rubber.
    if (face.normal.dot(closest.copy(center).sub(face.triangle.a)) < -1e-8) continue;
    face.triangle.closestPointToPoint(center, closest);
    const delta = center.clone().sub(closest), distance = delta.length();
    if (distance > r + margin) continue;
    const normal = distance > 1e-9 ? delta.divideScalar(distance) : face.normal.clone();
    contacts.push({ face, normal, depth: r - distance, point: closest.clone() });
  }
  return contacts.sort((a, b) => b.depth - a.depth);
}

export function surfacePositions(faces) {
  return faces.flatMap(({ triangle }) => [triangle.a, triangle.b, triangle.c].flatMap((p) => [p.x, p.y + TABLE.clothHeight, p.z]));
}

function firstRoot(a, b, c) {
  if (a < 1e-12) return Infinity;
  const discriminant = b * b - a * c;
  if (discriminant < 0) return Infinity;
  const t = (-b - Math.sqrt(discriminant)) / a;
  return t >= -1e-7 ? Math.max(0, t) : Infinity;
}

// Sweep a resting-height sphere against the same faces, finite edges, and
// vertices used for collisions. A plan-view wall cannot predict an undercut
// cushion or a pocket jaw correctly once the nose is above the ball's center.
export function boundaryDistance(x, z, dx, dz) {
  const origin = new Vector3(x, TABLE.radius, z), direction = new Vector3(dx, 0, dz), r = TABLE.radius;
  if (tableContacts({ x, z, y: 0 }).some((c) => c.face.kind !== 'cloth' && direction.dot(c.normal) < -1e-8)) return 0;
  let nearest = TABLE.length * 2;
  for (const face of TABLE_SURFACES) {
    if (face.kind === 'cloth' || origin.y < face.minY - r || origin.y > face.maxY + r) continue;
    let entry = 0, exit = nearest;
    for (const [position, speed, min, max] of [[x, dx, face.minX - r, face.maxX + r], [z, dz, face.minZ - r, face.maxZ + r]]) {
      if (Math.abs(speed) < 1e-12) { if (position < min || position > max) exit = -1; }
      else {
        const a = (min - position) / speed, b = (max - position) / speed;
        entry = Math.max(entry, Math.min(a, b));exit = Math.min(exit, Math.max(a, b));
      }
    }
    if (exit < entry) continue;
    const { triangle, normal } = face;
    const side = origin.clone().sub(triangle.a).dot(normal), approach = direction.dot(normal);
    if (approach < -1e-9) {
      const t = (r - side) / approach;
      if (t >= 0 && t < nearest && triangle.containsPoint(origin.clone().addScaledVector(direction, t).addScaledVector(normal, -r))) nearest = t;
    }
    const vertices = [triangle.a, triangle.b, triangle.c];
    const accept = (t) => { if (t < nearest && side + approach * t >= -1e-8) nearest = t; };
    for (let i = 0; i < 3; i++) {
      const a = vertices[i], b = vertices[(i + 1) % 3], offset = origin.clone().sub(a);
      accept(firstRoot(1, offset.dot(direction), offset.lengthSq() - r * r));
      const axis = b.clone().sub(a), length = axis.length();axis.divideScalar(length);
      const parallel = direction.dot(axis), along = offset.dot(axis);
      const perpendicular = direction.clone().addScaledVector(axis, -parallel);
      offset.addScaledVector(axis, -along);
      const t = firstRoot(perpendicular.lengthSq(), offset.dot(perpendicular), offset.lengthSq() - r * r);
      const edgePosition = along + parallel * t;
      if (edgePosition >= 0 && edgePosition <= length) accept(t);
    }
  }
  for (const p of POCKETS) {
    const ox = x - p.x, oz = z - p.z;
    nearest = Math.min(nearest, firstRoot(1, ox * dx + oz * dz, ox * ox + oz * oz - p.captureRadius ** 2));
  }
  return nearest;
}
