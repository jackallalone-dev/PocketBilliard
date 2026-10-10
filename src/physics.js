import { TABLE, POCKETS, CUSHION_SEGMENTS, closestPoint } from './table-geometry.js';
import { REST_MOTION, REST_ORIENTATION, advanceBall, hasBallMotion, cushionImpulse, ballContactFriction } from './ball-motion.js';
import { strikeMotion } from './spin.js';
export { TABLE, POCKETS } from './table-geometry.js';
export { EightBallGame, groupOf } from './match-rules.js';
export const BALL_COLORS = ['#faf6e9', '#e9b52a', '#3776c4', '#d24c3f', '#8d58a5', '#df802e', '#39886c', '#924044', '#171c20', '#e9b52a', '#3776c4', '#d24c3f', '#8d58a5', '#df802e', '#39886c', '#924044'];

export class PoolPhysics {
  constructor(onEvent = () => {}) {
    this.onEvent = onEvent;
    this.reset();
  }

  reset() {
    this.stepNumber = 0;
    this.balls = [{ id: 0, x: 0, z: TABLE.headSpot + 0.6, ...REST_MOTION, ...REST_ORIENTATION, pocketed: false }];
    const solid = 1 + Math.floor(Math.random() * 7), stripe = 9 + Math.floor(Math.random() * 7);
    const remaining = Array.from({ length: 15 }, (_, i) => i + 1).filter((id) => ![8, solid, stripe].includes(id));
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));[remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
    const rack = Array.from({ length: 15 }, (_, i) => i === 4 ? 8 : i === 10 ? solid : i === 14 ? stripe : remaining.pop());
    const spacing = TABLE.radius * 2 + 0.006;
    let index = 0;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col <= row; col++) {
        this.balls.push({ id: rack[index++], x: (col - row / 2) * spacing, z: TABLE.footSpot - row * spacing * Math.sqrt(3) / 2, ...REST_MOTION, ...REST_ORIENTATION, pocketed: false });
      }
    }
  }

  get cue() { return this.balls[0]; }
  get moving() { return this.balls.some(hasBallMotion); }

  shoot(angle, power, spin = {}) {
    if (this.moving || this.cue.pocketed) return false;
    Object.assign(this.cue, strikeMotion(angle, power, spin));
    return true;
  }

  pocket(ball, pocket) {
    ball.pocketed = true;
    Object.assign(ball, REST_MOTION);
    const pocketIndex = POCKETS.findIndex((p) => Math.hypot(p.x - pocket.x, p.z - pocket.z) < 1e-6);
    this.onEvent({ type: 'pocket', id: ball.id, pocket, pocketIndex, step: this.stepNumber });
  }

  step(dt) {
    this.stepNumber++;
    const r = TABLE.radius;
    for (const b of this.balls) {
      if (b.pocketed) continue;
      advanceBall(b, dt);
      const pocket = POCKETS.find((p) => Math.hypot(b.x - p.x, b.z - p.z) < p.captureRadius);
      if (pocket) { this.pocket(b, pocket); continue; }
      for (const [rail, segment] of CUSHION_SEGMENTS.entries()) {
        const contact = closestPoint(segment, b.x, b.z);
        const dx = b.x - contact.x, dz = b.z - contact.z;
        const distance = Math.hypot(dx, dz);
        if (distance >= r || distance < 1e-8) continue;
        const nx = dx / distance, nz = dz / distance;
        b.x += nx * (r - distance + 0.000001);
        b.z += nz * (r - distance + 0.000001);
        const incoming = b.vx * nx + b.vz * nz;
        if (incoming < 0) {
          this.onEvent({ type: 'rail', id: b.id, rail, speed: -incoming, step: this.stepNumber });
          cushionImpulse(b, nx, nz, incoming);
        }
      }
      if (Math.abs(b.x) > TABLE.width / 2 + 0.9 || Math.abs(b.z) > TABLE.length / 2 + 0.9) {
        this.onEvent({ type: 'offTable', id: b.id, step: this.stepNumber });
        const nearest = POCKETS.reduce((a, p) => Math.hypot(p.x - b.x, p.z - b.z) < Math.hypot(a.x - b.x, a.z - b.z) ? p : a);
        this.pocket(b, nearest);
      }
    }

    // Two solver passes prevent a tightly packed rack from retaining overlaps.
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < this.balls.length; i++) {
        const a = this.balls[i];
        if (a.pocketed) continue;
        for (let j = i + 1; j < this.balls.length; j++) {
          const b = this.balls[j];
          if (b.pocketed) continue;
          const dx = b.x - a.x, dz = b.z - a.z;
          const distance = Math.hypot(dx, dz);
          if (distance >= r * 2) continue;
          const nx = distance > 0.00001 ? dx / distance : 1;
          const nz = distance > 0.00001 ? dz / distance : 0;
          const correction = (r * 2 - distance + 0.00001) / 2;
          a.x -= nx * correction; a.z -= nz * correction;
          b.x += nx * correction; b.z += nz * correction;
          const relative = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
          if (relative <= 0) continue;
          this.onEvent({ type: 'contact', a: a.id, b: b.id, speed: relative, step: this.stepNumber });
          const impulse = relative * 0.965;
          a.vx -= impulse * nx; a.vz -= impulse * nz;
          b.vx += impulse * nx; b.vz += impulse * nz;
          ballContactFriction(a, b, nx, nz, impulse);
          if (pass === 0 && relative > 0.35) this.onEvent({ type: 'collision', speed: relative });
        }
      }
    }
  }

  placeCue() {
    const free = (x, z) => this.balls.every((b) => b.id === 0 || b.pocketed || Math.hypot(b.x - x, b.z - z) > TABLE.radius * 2 + 0.035);
    // Start in the kitchen, searching the entire table if it is crowded.
    let position = null;
    for (let z = TABLE.headSpot; z > -7.8 && !position; z -= 0.55) {
      for (let n = 0; n <= 14; n++) {
        const x = (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 0.53;
        if (free(x, z)) { position = { x, z }; break; }
      }
    }
    if (!position) throw new Error('No clear position for the cue ball.');
    Object.assign(this.cue, position, REST_MOTION, { pocketed: false });
  }
}
