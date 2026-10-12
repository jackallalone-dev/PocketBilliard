import { TABLE, POCKETS, CUSHION_SEGMENTS, closestPoint } from './table-geometry.js';
import { REST_MOTION, REST_ORIENTATION } from './ball-motion.js';
import { clampSpin, clampElevation } from './spin.js';

const MARGIN = 0.008;
const SEPARATION = TABLE.radius * 2 + MARGIN;
const copyBalls = (balls) => balls.map((ball) => ({ ...ball, ...REST_MOTION }));

export function legalBallPosition(balls, id, x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  if (Math.abs(x) > TABLE.width / 2 - TABLE.radius - MARGIN || Math.abs(z) > TABLE.length / 2 - TABLE.radius - MARGIN) return false;
  if (POCKETS.some((p) => Math.hypot(x - p.x, z - p.z) < p.captureRadius + MARGIN)) return false;
  if (CUSHION_SEGMENTS.some((segment) => {
    const point = closestPoint(segment, x, z);
    return Math.hypot(x - point.x, z - point.z) < TABLE.radius + MARGIN - 1e-7;
  })) return false;
  return balls.every((ball) => ball.id === id || ball.pocketed || Math.hypot(x - ball.x, z - ball.z) >= SEPARATION - 1e-7);
}

export function freeBallPosition(balls, id, targetX, targetZ, minZ = -Infinity) {
  if (!Number.isFinite(targetX) || !Number.isFinite(targetZ)) return null;
  const limitX = TABLE.width / 2 - TABLE.radius - MARGIN;
  const limitZ = TABLE.length / 2 - TABLE.radius - MARGIN;
  const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));
  const clampZ = (value) => Math.max(minZ, clamp(value, limitZ));
  const desired = { x: clamp(targetX, limitX), z: clampZ(targetZ) };
  const point = { ...desired };
  const original = balls.find((ball) => ball.id === id);
  for (let pass = 0; pass < 20; pass++) {
    for (const ball of balls) {
      if (ball.id === id || ball.pocketed) continue;
      let dx = point.x - ball.x, dz = point.z - ball.z;
      const distance = Math.hypot(dx, dz);
      if (distance >= SEPARATION) continue;
      if (distance < 1e-8) {
        dx = original && !original.pocketed ? original.x - ball.x : 1;
        dz = original && !original.pocketed ? original.z - ball.z : 0;
        if (Math.hypot(dx, dz) < 1e-8) dx = 1;
      }
      const length = Math.hypot(dx, dz);
      point.x = ball.x + dx / length * (SEPARATION + 1e-6);
      point.z = ball.z + dz / length * (SEPARATION + 1e-6);
    }
    point.x = clamp(point.x, limitX);point.z = clampZ(point.z);
    if (legalBallPosition(balls, id, point.x, point.z)) return point;
  }
  // A crowded rail should hold the last valid placement rather than jump.
  if (original && !original.pocketed && original.z >= minZ && legalBallPosition(balls, id, original.x, original.z)) return { x: original.x, z: original.z };
  for (let radius = 0.05; radius <= 2; radius += 0.05) {
    for (let step = 0; step < 32; step++) {
      const angle = step * Math.PI / 16;
      const x = clamp(desired.x + Math.cos(angle) * radius, limitX);
      const z = clampZ(desired.z + Math.sin(angle) * radius);
      if (legalBallPosition(balls, id, x, z)) return { x, z };
    }
  }
  return null;
}

export class Playground {
  constructor() {
    this.balls = Array.from({ length: 16 }, (_, id) => ({ id, x: 0, z: id === 0 ? TABLE.headSpot : 0, ...REST_MOTION, ...REST_ORIENTATION, pocketed: id !== 0 }));
    this.editing = true;
    this.selectedId = 0;
    this.attempts = 0;
    this.move(1, 0, -1.8);
    this.move(9, 1.5, -3.6);
    this.setup = copyBalls(this.balls);
    this.setupAngle = 0;
    this.setupSpin = { x: 0, y: 0 };
    this.setupElevation = 0;
  }

  get selected() { return this.balls.find((ball) => ball.id === this.selectedId); }

  move(id, x, z) {
    if (!this.editing) return null;
    const ball = this.balls.find((ball) => ball.id === id);
    if (!ball) return null;
    const point = freeBallPosition(this.balls, id, x, z);
    if (!point) return null;
    Object.assign(ball, point, REST_MOTION, { pocketed: false });
    return point;
  }

  removeSelected() {
    if (!this.editing || this.selectedId === 0 || !this.selected || this.selected.pocketed) return false;
    this.selected.pocketed = true;
    Object.assign(this.selected, REST_MOTION);
    this.selectedId = 0;
    return true;
  }

  clear() {
    if (!this.editing) return false;
    for (const ball of this.balls) Object.assign(ball, REST_MOTION, REST_ORIENTATION, { x: 0, z: ball.id === 0 ? TABLE.headSpot : 0, pocketed: ball.id !== 0 });
    this.selectedId = 0;
    return true;
  }

  commit(angle, spin = {}, elevation = 0) {
    if (!this.editing || this.balls[0].pocketed) return false;
    this.setup = copyBalls(this.balls);
    this.setupAngle = angle;
    this.setupSpin = clampSpin(spin);
    this.setupElevation = clampElevation(elevation);
    this.editing = false;
    this.attempts = 0;
    return true;
  }

  restore() {
    for (let i = 0; i < this.balls.length; i++) Object.assign(this.balls[i], this.setup[i], REST_MOTION);
    if (this.selected.pocketed) this.selectedId = 0;
    return this.setupAngle;
  }
}
