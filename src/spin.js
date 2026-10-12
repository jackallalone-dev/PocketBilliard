import { TABLE } from './table-geometry.js';

// Contact coordinates as seen from behind the cue: +X right, +Y above center.
export const MAX_TIP_OFFSET = 0.65;
export const MAX_SHOT_POWER = 2;
export const MAX_CUE_ELEVATION = 75;
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
  const speed = (3 + Math.max(0, Math.min(MAX_SHOT_POWER, power)) * 22) / Math.sqrt(1 + 0.4 * factor ** 2 * (contact.x ** 2 + contact.y ** 2));
  const tilt = clampElevation(elevation) * Math.PI / 180;
  const dx = Math.sin(angle), dz = -Math.cos(angle), c = Math.cos(tilt), s = Math.sin(tilt);
  // A downward tip strike rebounds from the cloth. This is a dissipative
  // takeoff approximation, not a scoop underneath the cue ball.
  const vy = speed * s * 0.55;
  const turn = speed / TABLE.radius * factor;
  return {
    y: 0, vx: dx * speed * c, vz: dz * speed * c, vy,
    // Torque r × J: elevation tilts sidespin toward the shot direction.
    // The resulting barrel-roll component makes cloth friction bend the ball
    // toward the selected side, rather than adding a steering force.
    wx: turn * (dz * contact.y + dx * s * contact.x),
    wz: turn * (-dx * contact.y + dz * s * contact.x),
    wy: turn * c * contact.x,
  };
}
