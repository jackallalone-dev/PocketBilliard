import { TABLE } from './table-geometry.js';

export const BOTTOM_CONTROLS_HEIGHT = 90;

// Choose by the ball/table scale we can actually display, rather than device
// names. A tall tablet keeps side controls; a narrow phone gains a bottom bar.
export function tableControlLayout(area) {
  const horizontal = area.width > area.height;
  const width = (horizontal ? TABLE.frameLength : TABLE.frameWidth) + 0.3;
  const height = (horizontal ? TABLE.frameWidth : TABLE.frameLength) + 0.3;
  const sideScale = Math.min(Math.max(0, area.width - 82) / width, area.height / height);
  const bottomScale = Math.min(area.width / width, Math.max(0, area.height - BOTTOM_CONTROLS_HEIGHT) / height);
  return { horizontal, controls: bottomScale > sideScale * 1.02 ? 'bottom' : 'side' };
}

export function controlDockLayout(frame, canvas, area, side, width = 44) {
  const gap = 6;
  const offsetX = canvas.left - area.left;
  const offsetY = canvas.top - area.top;
  const desiredLeft = offsetX + (side === 'left' ? frame.left - width - gap : frame.right + gap);
  const height = Math.max(0, Math.min(520, area.height - 8, Math.max(320, frame.height * 0.95)));
  const desiredTop = offsetY + (frame.top + frame.bottom) / 2;
  return {
    left: Math.max(0, Math.min(area.width - width, desiredLeft)),
    top: Math.max(height / 2 + 4, Math.min(area.height - height / 2 - 4, desiredTop)),
    height,
  };
}
