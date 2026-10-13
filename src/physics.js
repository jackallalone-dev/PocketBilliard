import { TABLE, POCKETS } from './table-geometry.js';
import { REST_MOTION, REST_ORIENTATION, hasBallMotion, ballContactFriction } from './ball-motion.js';
import { advanceTableBall, restingOnRail } from './rail-motion.js';
import { strikeMotion } from './spin.js';
export { TABLE, POCKETS } from './table-geometry.js';
export { EightBallGame, groupOf } from './match-rules.js';
export const BALL_COLORS = ['#faf6e9', '#e9b52a', '#3776c4', '#d24c3f', '#8d58a5', '#df802e', '#39886c', '#924044', '#171c20', '#e9b52a', '#3776c4', '#d24c3f', '#8d58a5', '#df802e', '#39886c', '#924044'];

export class PoolPhysics {
  constructor(onEvent = () => {}, rackType = 'eight') {
    this.onEvent = onEvent;
    this.reset(rackType);
  }

  reset(rackType = 'eight') {
    this.stepNumber = 0;
    this.balls = [{ id: 0, x: 0, z: TABLE.headSpot + 0.015, ...REST_MOTION, ...REST_ORIENTATION, pocketed: false }];
    const shuffle = (values) => {
      for (let i = values.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));[values[i], values[j]] = [values[j], values[i]];
      }
      return values;
    };
    if (rackType === 'nine') {
      const remaining = shuffle([3, 4, 5, 6, 7, 8]);
      const rack = Array.from({ length: 9 }, (_, i) => i === 0 ? 1 : i === 4 ? 9 : i === 8 ? 2 : remaining.pop());
      const spacing = TABLE.radius * 2 + 0.006;
      let index = 0;
      for (const [row, count] of [1, 2, 3, 2, 1].entries()) {
        for (let col = 0; col < count; col++) {
          this.balls.push({ id: rack[index++], x: (col - (count - 1) / 2) * spacing, z: TABLE.footSpot - row * spacing * Math.sqrt(3) / 2, ...REST_MOTION, ...REST_ORIENTATION, pocketed: false });
        }
      }
      return;
    }
    const solid = 1 + Math.floor(Math.random() * 7), stripe = 9 + Math.floor(Math.random() * 7);
    const remaining = Array.from({ length: 15 }, (_, i) => i + 1).filter((id) => ![8, solid, stripe].includes(id));
    shuffle(remaining);
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

  shoot(angle, power, spin = {}, elevation = 0) {
    if (this.moving || this.cue.pocketed) return false;
    Object.assign(this.cue, strikeMotion(angle, power, spin, elevation));
    return true;
  }

  pocket(ball, pocket) {
    ball.pocketed = true;
    Object.assign(ball, REST_MOTION);
    const pocketIndex = POCKETS.findIndex((p) => Math.hypot(p.x - pocket.x, p.z - pocket.z) < 1e-6);
    this.onEvent({ type: 'pocket', id: ball.id, pocket, pocketIndex, step: this.stepNumber });
  }

  step(dt, beforeStep) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const maxSpeed = this.balls.reduce((speed, ball) => ball.pocketed ? speed : Math.max(speed, Math.hypot(ball.vx, ball.vy || 0, ball.vz)), 0);
    // Keep travel below a ball radius even for boosted shots. This prevents
    // skipping ball contacts or crossing a cushion nose between solver steps.
    const steps = Math.max(1, Math.ceil(maxSpeed * dt / (TABLE.radius * 0.25)), Math.ceil(dt * 240));
    for (let i = 0; i < steps; i++) {
      beforeStep?.(this.balls);
      this.integrateStep(dt / steps);
    }
  }

  integrateStep(dt) {
    this.stepNumber++;
    const r = TABLE.radius;
    for (const b of this.balls) {
      if (b.pocketed) continue;
      advanceTableBall(b, dt, (rail, speed) => this.onEvent({ type: 'rail', id: b.id, rail, speed, step: this.stepNumber }));
      const pocket = b.y < r * 0.5 && POCKETS.find((p) => Math.hypot(b.x - p.x, b.z - p.z) < p.captureRadius ||
        (b.y < -r * 0.1 && Math.hypot(b.x - p.x, b.z - p.z) < p.radius));
      if (pocket) { this.pocket(b, pocket); continue; }
      // Crossing the cushion nose is allowed. Only a real escape beyond the
      // outer rail, falling below the table, or coming to rest on top is out.
      if (Math.abs(b.x) > TABLE.frameWidth / 2 + r || Math.abs(b.z) > TABLE.frameLength / 2 + r || b.y < -r * 2) this.removeOffTable(b);
      else if (restingOnRail(b)) this.removeOffTable(b, 'resting-on-rail');
    }

    // Two solver passes prevent a tightly packed rack from retaining overlaps.
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < this.balls.length; i++) {
        const a = this.balls[i];
        if (a.pocketed) continue;
        for (let j = i + 1; j < this.balls.length; j++) {
          const b = this.balls[j];
          if (b.pocketed) continue;
          const dx = b.x - a.x, dy = (b.y || 0) - (a.y || 0), dz = b.z - a.z;
          const distance = Math.hypot(dx, dy, dz);
          if (distance >= r * 2) continue;
          const nx = distance > 0.00001 ? dx / distance : 1;
          const nz = distance > 0.00001 ? dz / distance : 0;
          const ny = distance > 0.00001 ? dy / distance : 0;
          const correction = (r * 2 - distance + 0.00001) / 2;
          a.x -= nx * correction; a.z -= nz * correction;
          b.x += nx * correction; b.z += nz * correction;
          a.y = Math.max(0, (a.y || 0) - ny * correction);
          b.y = Math.max(0, (b.y || 0) + ny * correction);
          const relative = (a.vx - b.vx) * nx + ((a.vy || 0) - (b.vy || 0)) * ny + (a.vz - b.vz) * nz;
          if (relative <= 0) continue;
          this.onEvent({ type: 'contact', a: a.id, b: b.id, speed: relative, step: this.stepNumber });
          const impulse = relative * 0.965;
          a.vx -= impulse * nx; a.vz -= impulse * nz;
          b.vx += impulse * nx; b.vz += impulse * nz;
          a.vy = (a.vy || 0) - impulse * ny;b.vy = (b.vy || 0) + impulse * ny;
          if (a.y === 0 && a.vy < 0) a.vy = 0;
          if (b.y === 0 && b.vy < 0) b.vy = 0;
          if (Math.abs(ny) < 0.001) ballContactFriction(a, b, nx, nz, impulse);
          if (pass === 0 && relative > 0.35) this.onEvent({ type: 'collision', speed: relative });
        }
      }
    }
  }

  removeOffTable(ball, reason = 'left-table') {
    if (ball.pocketed) return;
    const motion = { x: ball.x, y: ball.y || 0, z: ball.z, vx: ball.vx, vy: ball.vy || 0, vz: ball.vz };
    ball.pocketed = true;Object.assign(ball, REST_MOTION);
    this.onEvent({ type: 'offTable', id: ball.id, reason, ...motion, step: this.stepNumber });
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
