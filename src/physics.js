import { TABLE, POCKETS, CUSHION_SEGMENTS, closestPoint } from './table-geometry.js';
import { REST_MOTION, REST_ORIENTATION, advanceBall, hasBallMotion, cushionImpulse, ballContactFriction } from './ball-motion.js';
import { clampSpin, MAX_TIP_OFFSET } from './spin.js';
export { TABLE, POCKETS } from './table-geometry.js';
export const BALL_COLORS = ['#faf6e9', '#e9b52a', '#3776c4', '#d24c3f', '#8d58a5', '#df802e', '#39886c', '#924044', '#171c20', '#e9b52a', '#3776c4', '#d24c3f', '#8d58a5', '#df802e', '#39886c', '#924044'];
export const groupOf = (id) => id > 0 && id < 8 ? 'solids' : id > 8 ? 'stripes' : null;

export class PoolPhysics {
  constructor(onEvent = () => {}) {
    this.onEvent = onEvent;
    this.reset();
  }

  reset() {
    this.balls = [{ id: 0, x: 0, z: TABLE.headSpot, ...REST_MOTION, ...REST_ORIENTATION, pocketed: false }];
    const rack = [1, 10, 2, 3, 8, 11, 12, 4, 13, 5, 6, 14, 7, 15, 9];
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
    const contact = clampSpin(spin);
    const spinFactor = 2.5 * MAX_TIP_OFFSET;
    // The power budget is shared by translation and rotation on off-center hits.
    const speed = (3 + Math.max(0, Math.min(1, power)) * 22) / Math.sqrt(1 + 0.4 * spinFactor ** 2 * (contact.x ** 2 + contact.y ** 2));
    this.cue.vx = Math.sin(angle) * speed;
    this.cue.vz = -Math.cos(angle) * speed;
    this.cue.wx = this.cue.vz / TABLE.radius * spinFactor * contact.y;
    this.cue.wz = -this.cue.vx / TABLE.radius * spinFactor * contact.y;
    this.cue.wy = speed / TABLE.radius * spinFactor * contact.x;
    return true;
  }

  pocket(ball, pocket) {
    ball.pocketed = true;
    Object.assign(ball, REST_MOTION);
    this.onEvent({ type: 'pocket', id: ball.id, pocket });
  }

  step(dt) {
    const r = TABLE.radius;
    for (const b of this.balls) {
      if (b.pocketed) continue;
      advanceBall(b, dt);
      const pocket = POCKETS.find((p) => Math.hypot(b.x - p.x, b.z - p.z) < p.captureRadius);
      if (pocket) { this.pocket(b, pocket); continue; }
      for (const segment of CUSHION_SEGMENTS) {
        const contact = closestPoint(segment, b.x, b.z);
        const dx = b.x - contact.x, dz = b.z - contact.z;
        const distance = Math.hypot(dx, dz);
        if (distance >= r || distance < 1e-8) continue;
        const nx = dx / distance, nz = dz / distance;
        b.x += nx * (r - distance + 0.000001);
        b.z += nz * (r - distance + 0.000001);
        const incoming = b.vx * nx + b.vz * nz;
        if (incoming < 0) {
          this.onEvent({ type: 'rail', speed: -incoming });
          cushionImpulse(b, nx, nz, incoming);
        }
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

export class EightBallGame {
  constructor() { this.reset(); }
  reset() {
    this.currentPlayer = 0;
    this.groups = [null, null];
    this.pocketed = new Set();
    this.shotNumber = 1;
    this.winner = null;
  }
  remaining(player) {
    const group = this.groups[player];
    return group ? Array.from({ length: 7 }, (_, i) => i + (group === 'solids' ? 1 : 9)).filter((id) => !this.pocketed.has(id)) : [];
  }
  resolveShot(ids) {
    if (this.winner !== null) return null;
    const shooter = this.currentPlayer;
    const scratch = ids.includes(0);
    let blackLegal = false;
    // Evaluate the 8 at the moment it falls, including earlier balls in this shot.
    for (const id of ids) {
      if (id === 8) blackLegal = !!this.groups[shooter] && this.remaining(shooter).length === 0;
      if (id > 0) this.pocketed.add(id);
      if (!scratch && !this.groups[shooter] && groupOf(id)) {
        this.groups[shooter] = groupOf(id);
        this.groups[1 - shooter] = groupOf(id) === 'solids' ? 'stripes' : 'solids';
      }
    }
    if (ids.includes(8)) {
      this.winner = blackLegal && !scratch ? shooter : 1 - shooter;
      return { winner: this.winner, scratch, reason: scratch ? 'scratch-on-eight' : blackLegal ? 'cleared' : 'early-eight' };
    }
    const keepTurn = !scratch && ids.some((id) => groupOf(id) && groupOf(id) === this.groups[shooter]);
    if (!keepTurn) this.currentPlayer = 1 - shooter;
    this.shotNumber++;
    return { scratch, keepTurn, player: this.currentPlayer, groups: this.groups };
  }
}
