import { TABLE } from './table-geometry.js';
import { clampSpin, clampElevation, MAX_TIP_OFFSET, MAX_CUE_ELEVATION } from './spin.js';

export const CUE_START = TABLE.radius + 0.065;
export const CUE_LENGTH = 5.075;

// The same 3D cue axis is used by rendering and clearance checks. Ball y is
// height above its resting position, not its center's absolute world height.
export function cuePose(cue, angle, power, spin = {}, elevation = 0) {
  const tilt = clampElevation(elevation) * Math.PI / 180;
  const dx = Math.sin(angle), dz = -Math.cos(angle), c = Math.cos(tilt), s = Math.sin(tilt);
  const back = { x: -dx * c, y: s, z: -dz * c };
  const contact = clampSpin(spin);
  const side = contact.x * TABLE.radius * MAX_TIP_OFFSET;
  const height = contact.y * TABLE.radius * MAX_TIP_OFFSET;
  const pull = power * 0.48 + Math.sqrt(TABLE.radius ** 2 - side ** 2 - height ** 2) - TABLE.radius;
  return {
    back, tilt,
    x: cue.x + back.x * pull - dz * side + dx * s * height,
    y: TABLE.radius + 0.028 + (cue.y || 0) + back.y * pull + c * height,
    z: cue.z + back.z * pull + dx * side + dz * s * height,
  };
}

// Actual point on the sphere, rather than the 2D offset perpendicular to the
// cue. Raising the butt rotates the reachable contact cap toward the top.
export function cueContact(cue, angle, spin = {}, elevation = 0) {
  const pose = cuePose(cue, angle, 0, spin, elevation);
  return {
    x: pose.x + pose.back.x * TABLE.radius,
    y: pose.y + pose.back.y * TABLE.radius,
    z: pose.z + pose.back.z * TABLE.radius,
  };
}

export function cueObstruction(balls, angle, spin, elevation) {
  const pose = cuePose(balls[0], angle, 0, spin, elevation);
  for (const ball of balls) {
    if (ball.id === 0 || ball.pocketed) continue;
    const x = ball.x - pose.x, y = TABLE.radius + 0.028 + (ball.y || 0) - pose.y, z = ball.z - pose.z;
    const along = Math.max(TABLE.radius, Math.min(CUE_START + CUE_LENGTH, x * pose.back.x + y * pose.back.y + z * pose.back.z));
    const shaftRadius = 0.036 + Math.min(1, Math.max(0, (along - CUE_START - 0.225) / 4.85)) * 0.046;
    if (Math.hypot(x - pose.back.x * along, y - pose.back.y * along, z - pose.back.z * along) < TABLE.radius + shaftRadius + 0.006) return ball.id;
  }
  return null;
}

export function minimumCueElevation(balls, angle, spin = {}) {
  // One-degree increments match the manual slider. There is no fixed 45° rule:
  // nearer/taller blockers need more lift; balls outside the shaft need none.
  for (let elevation = 0; elevation <= MAX_CUE_ELEVATION; elevation++) {
    if (cueObstruction(balls, angle, spin, elevation) === null) return elevation;
  }
  return MAX_CUE_ELEVATION;
}
