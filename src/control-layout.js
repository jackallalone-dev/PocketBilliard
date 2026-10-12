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
