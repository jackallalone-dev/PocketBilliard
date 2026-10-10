import { TABLE, POCKETS, boundaryDistance } from './table-geometry.js';
import { advanceBall, ballContactFriction, REST_MOTION, REST_ORIENTATION } from './ball-motion.js';
import { strikeMotion } from './spin.js';

// Short estimate of the cue's post-contact path. Stops at the next obstruction;
// it is deliberately not a claim to predict the entire multi-ball shot.
export function cuePathPreview(balls, target, end, angle, power, spin) {
  const start = balls[0];
  const cue = { ...start, ...REST_ORIENTATION, ...strikeMotion(angle, power || 0.65, spin) };
  const dx = Math.sin(angle), dz = -Math.cos(angle);
  const distance = Math.hypot(end.x - start.x, end.z - start.z);
  let reached = distance < 0.001;
  for (let step = 0; step < 480 && !reached; step++) {
    advanceBall(cue, 1 / 120);
    reached = (cue.x - start.x) * dx + (cue.z - start.z) * dz >= distance;
    if (!reached && Math.hypot(cue.vx, cue.vz) < 0.045) break;
  }
  if (!reached) return [];
  cue.x = end.x;cue.z = end.z;
  const object = { ...target, ...REST_MOTION, ...REST_ORIENTATION };
  const length = Math.hypot(target.x - end.x, target.z - end.z);
  if (length < 1e-8) return [];
  const nx = (target.x - end.x) / length, nz = (target.z - end.z) / length;
  const impulse = Math.max(0, (cue.vx * nx + cue.vz * nz) * 0.965);
  cue.vx -= impulse * nx;cue.vz -= impulse * nz;
  object.vx += impulse * nx;object.vz += impulse * nz;
  ballContactFriction(cue, object, nx, nz, impulse);
  const points = [{ x: end.x, z: end.z }];
  let traveled = 0;
  for (let step = 0; step < 60; step++) {
    const previous = { x: cue.x, z: cue.z };
    advanceBall(cue, 1 / 60);advanceBall(object, 1 / 60);
    const vx = cue.x - previous.x, vz = cue.z - previous.z, move = Math.hypot(vx, vz);
    if (move > 1e-8 && boundaryDistance(previous.x, previous.z, vx / move, vz / move) < move) break;
    if (POCKETS.some((p) => Math.hypot(cue.x - p.x, cue.z - p.z) < p.captureRadius)) break;
    if (balls.some((b) => b.id !== 0 && b.id !== target.id && !b.pocketed && Math.hypot(cue.x - b.x, cue.z - b.z) < TABLE.radius * 2)) break;
    if (Math.hypot(cue.x - object.x, cue.z - object.z) < TABLE.radius * 2 - 0.002) break;
    traveled += move;
    if (step % 2 === 1) points.push({ x: cue.x, z: cue.z });
    if (traveled > 2.7) break;
  }
  return traveled > 0.06 ? points : [];
}
