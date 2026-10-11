import { TABLE } from './table-geometry.js';

// Contact coordinates as seen from behind the cue: +X right, +Y above center.
export const MAX_TIP_OFFSET = 0.65;
export const MAX_SHOT_POWER = 2;

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

export function strikeMotion(angle, power, spin = {}) {
  const contact = clampSpin(spin), factor = 2.5 * MAX_TIP_OFFSET;
  const speed = (3 + Math.max(0, Math.min(MAX_SHOT_POWER, power)) * 22) / Math.sqrt(1 + 0.4 * factor ** 2 * (contact.x ** 2 + contact.y ** 2));
  const vx = Math.sin(angle) * speed, vz = -Math.cos(angle) * speed;
  return { vx, vz, wx: vz / TABLE.radius * factor * contact.y, wz: -vx / TABLE.radius * factor * contact.y, wy: speed / TABLE.radius * factor * contact.x };
}
