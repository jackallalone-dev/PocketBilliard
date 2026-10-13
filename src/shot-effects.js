import { TABLE } from './table-geometry.js';
import { GRAVITY } from './ball-motion.js';
import { clampSpin, clampElevation, strikeMotion } from './spin.js';

// These labels describe a continuum, not separate physics modes. A massé can
// hop before it bends; a center-axis jump has no sideways barrel-roll spin.
export function shotEffects(spin, elevation, power = 0.65) {
  const contact = clampSpin(spin), tilt = clampElevation(elevation);
  const motion = strikeMotion(0, power, contact, tilt);
  const curve = Math.abs(contact.x * Math.sin(tilt * Math.PI / 180)) > 0.005;
  const height = motion.vy ** 2 / (2 * GRAVITY);
  const jump = height >= TABLE.radius * 0.5;
  const direction = contact.x < 0 ? 'Left' : 'Right';
  const label = curve ? `${jump ? 'Hop + ' : ''}${direction.toLowerCase()} ${tilt >= 40 ? 'massé' : 'swerve'}` : jump ? 'Jump shot' : tilt > 0 ? `Elevated stroke${height > 0 ? ' · small hop' : ''}` : 'Level stroke';
  return { curve, jump, height, label: label[0].toUpperCase() + label.slice(1) };
}
