import { TABLE } from './table-geometry.js';
import { tableImpact } from './ball-motion.js';

// Contact coordinates as seen from behind the cue: +X right, +Y above center.
export const MAX_TIP_OFFSET = 0.65;
export const MAX_SHOT_POWER = 2;
export const MAX_CUE_ELEVATION = 90;
const BALL_CUE_MASS_RATIO = 0.17 / 0.54; // 170 g ball, 540 g cue.
export const clampElevation = (value) => Number.isFinite(value) ? Math.max(0, Math.min(MAX_CUE_ELEVATION, value)) : 0;

export function clampSpin(spin = {}) {
  const x = Number.isFinite(spin.x) ? spin.x : 0;
  const y = Number.isFinite(spin.y) ? spin.y : 0;
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

export function spinDescription(spin) {
  const { x, y } = clampSpin(spin);
  const parts = [];
  if (Math.abs(y) >= 0.025) parts.push(`${y > 0 ? 'Follow' : 'Draw'} ${Math.round(Math.abs(y) * 100)}%`);
  if (Math.abs(x) >= 0.025) parts.push(`${x > 0 ? 'Right' : 'Left'} ${Math.round(Math.abs(x) * 100)}%`);
  return parts.length ? parts.join(' + ') : 'Center ball';
}

export function strikeMotion(angle, power, spin = {}, elevation = 0) {
  const contact = clampSpin(spin), factor = 2.5 * MAX_TIP_OFFSET;
  // Power controls cue speed, calibrated to 47 world units/s for a centered
  // maximum-power strike. Zero power must approach zero speed continuously.
  // Finite-mass cue impact: J/m ∝ 1 / (1 + m/M + m b²/I), where b is
  // perpendicular tip offset. Off-center hits transfer less energy than center
  // hits at the same cue speed; they do not share an enforced energy budget.
  const centerSpeed = 47 * Math.max(0, Math.min(MAX_SHOT_POWER, power)) / MAX_SHOT_POWER;
  const speed = centerSpeed * (1 + BALL_CUE_MASS_RATIO) / (1 + BALL_CUE_MASS_RATIO + 0.4 * factor ** 2 * (contact.x ** 2 + contact.y ** 2));
  const tilt = clampElevation(elevation) * Math.PI / 180;
  const dx = Math.sin(angle), dz = -Math.cos(angle), c = Math.abs(Math.cos(tilt)) < 1e-12 ? 0 : Math.cos(tilt), s = Math.sin(tilt);
  const turn = speed / TABLE.radius * factor;
  const motion = {
    y: 0, vx: dx * speed * c, vz: dz * speed * c, vy: -speed * s,
    // Torque r × J: elevation tilts sidespin toward the shot direction.
    // The resulting barrel-roll component makes cloth friction bend the ball
    // toward the selected side, rather than adding a steering force.
    wx: turn * (dz * contact.y + dx * s * contact.x),
    wz: turn * (-dx * contact.y + dz * s * contact.x),
    wy: turn * c * contact.x,
  };
  // Downward strike followed by a dissipative slate impact, including friction
  // during takeoff. This is the same contact law used when the ball lands.
  tableImpact(motion);
  if (motion.vy === 0) motion.vy = 0;
  return motion;
}
