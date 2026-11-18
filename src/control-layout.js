import { TABLE } from './table-geometry.js';

// HUD sizes shared with the CSS (set as custom properties on .game).
export const HUD_TOP_HEIGHT = 44;
export const HUD_BOTTOM_HEIGHT = 92;
export const BOTTOM_CONTROLS_HEIGHT = HUD_TOP_HEIGHT + HUD_BOTTOM_HEIGHT;

// Side columns hold the players, power and fine aim. They grow a little on
// wide screens, where the height-limited table leaves room anyway.
export function hudColumnWidth(width) {
  return Math.round(Math.min(96, Math.max(64, width * 0.085)));
}

function fit(width, height, long, short) {
  return Math.max(0, Math.max(Math.min(width / long, height / short), Math.min(width / short, height / long)));
}

// Choose by the table scale each layout can actually display, rather than by
// device names: "side" gives the table the full height between two columns
// (landscape phones), "bottom" gives it the full width between a top and a
// bottom bar (portrait phones and tablets).
export function tableControlLayout(area) {
  const long = TABLE.frameLength + 0.3, short = TABLE.frameWidth + 0.3;
  const column = hudColumnWidth(area.width);
  const side = fit(area.width - column * 2, area.height, long, short);
  const bottom = fit(area.width, area.height - BOTTOM_CONTROLS_HEIGHT, long, short);
  return { controls: bottom > side * 1.02 ? 'bottom' : 'side', column, side, bottom };
}
