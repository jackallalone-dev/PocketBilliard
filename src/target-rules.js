import { TABLE } from './table-geometry.js';

// Which balls the shooter may contact first, for the table's target ring and
// "no" sign. legal: null means any ball (break in 8-ball, push-out, no match).
export function firstHitRules(game, { nine = false, balls = [], push = false } = {}) {
  const open = { legal: null, highlight: [] };
  if (!game || game.winner !== null || game.pendingBreak || game.pendingPush || push || (!nine && game.isBreak)) return open;
  let legal = game.targets();
  // After an 8-ball break foul the first object ball must lie outside the kitchen.
  if (!nine && game.ballInHand === 'kitchen') legal = legal.filter((id) => balls.some((ball) => ball.id === id && !ball.pocketed && ball.z < TABLE.headSpot));
  return { legal, highlight: legal.length === 1 ? legal : [] };
}
