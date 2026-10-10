// Contact coordinates as seen from behind the cue: +X right, +Y above center.
export const MAX_TIP_OFFSET = 0.65;

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
