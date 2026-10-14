import { EightBallGame } from './match-rules.js';
import { NineBallGame } from './nine-ball.js';

export const GAME_MODES = Object.freeze({
  match: { label: '8-ball', rack: 'eight', callPocket: false },
  nine: { label: '9-ball', rack: 'nine', callPocket: false },
  'call-eight': { label: 'Call Pocket · 8-ball', rack: 'eight', callPocket: true },
  'call-nine': { label: 'Call Pocket · 9-ball', rack: 'nine', callPocket: true },
  playground: { label: 'Playground', rack: null, callPocket: false },
});

export function createMatches() {
  return Object.fromEntries(Object.entries(GAME_MODES).filter(([, config]) => config.rack).map(([mode, config]) =>
    [mode, config.rack === 'nine' ? new NineBallGame(config) : new EightBallGame(config)]));
}
