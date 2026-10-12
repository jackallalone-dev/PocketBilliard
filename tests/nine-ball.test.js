import test from 'node:test';
import assert from 'node:assert/strict';
import { NineBallGame, spotNineBall } from '../src/nine-ball.js';
import { PoolPhysics, TABLE } from '../src/physics.js';

function report(overrides = {}) {
  return {
    start: Array.from({ length: 10 }, (_, id) => ({ id, x: 0, z: id === 0 ? TABLE.headSpot + 0.6 : 0 })),
    firstContacts: [1], pockets: [], numberedRails: [2, 3, 4],
    railAfterContact: true, pocketAfterContact: false, offTable: [], closeHit: false, call: {}, ...overrides,
  };
}
const potted = (...ids) => ids.map((id) => ({ id, pocket: 5 }));
function openGame() { const game = new NineBallGame();game.isBreak = false;game.ballInHand = null;return game; }
function afterBreak() { const game = new NineBallGame();game.resolveShot(report());return game; }

test('9-ball rack has exactly nine object balls in a diamond, with 1 on the spot, 9 centered, and 2 at the back', () => {
  const physics = new PoolPhysics(() => {}, 'nine');
  assert.equal(physics.balls.length, 10);
  assert.deepEqual(physics.balls.map((ball) => ball.id).sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const one = physics.balls.find((ball) => ball.id === 1), nine = physics.balls.find((ball) => ball.id === 9), two = physics.balls.find((ball) => ball.id === 2);
  assert.equal(one.x, 0);assert.equal(one.z, TABLE.footSpot);assert.equal(nine.x, 0);assert.equal(two.x, 0);
  assert.ok(Math.abs(nine.z - (one.z + two.z) / 2) < 1e-9);
  const rows = new Map();for (const ball of physics.balls.slice(1)) rows.set(ball.z, (rows.get(ball.z) || 0) + 1);
  assert.deepEqual([...rows.values()], [1, 2, 3, 2, 1]);
  for (let i = 0; i < physics.balls.length; i++) for (let j = i + 1; j < physics.balls.length; j++) {
    assert.ok(Math.hypot(physics.balls[i].x - physics.balls[j].x, physics.balls[i].z - physics.balls[j].z) >= TABLE.radius * 2);
  }
});

test('three distinct object rails make a legal dry 9-ball break; fewer require the opponent’s re-break choice', () => {
  const game = new NineBallGame();const legal = game.resolveShot(report());
  assert.equal(legal.foul, null);assert.equal(game.currentPlayer, 1);assert.equal(game.pushAvailable, true);
  const bad = new NineBallGame();assert.equal(bad.resolveShot(report({ numberedRails: [2, 2, 3] })).illegalBreak, true);
  assert.deepEqual(bad.pendingBreak, { offender: 0, chooser: 1 });
  assert.equal(bad.chooseBreak(1), true);assert.equal(bad.currentPlayer, 1);assert.equal(bad.isBreak, true);
});

test('breaks must hit 1 first; a legal-break foul gives ball in hand anywhere and counts as a foul', () => {
  for (const changes of [{ firstContacts: [2] }, { pockets: potted(0) }, { offTable: [4] }]) {
    const game = new NineBallGame();const result = game.resolveShot(report(changes));
    assert.ok(result.foul);assert.equal(game.ballInHand, 'table');assert.equal(game.currentPlayer, 1);
    assert.equal(game.consecutiveFouls[0], 1);assert.equal(game.winner, null);
  }
  const game = new NineBallGame();const bad = report();bad.start[0].z = TABLE.headSpot;
  assert.equal(game.resolveShot(bad).foul, 'head-string');
});

test('a legal 9 on the break wins; a fouled 9 is re-spotted instead of losing the game', () => {
  const game = new NineBallGame();
  assert.equal(game.resolveShot(report({ pockets: potted(9), numberedRails: [] })).winner, 0);
  const foul = new NineBallGame();const result = foul.resolveShot(report({ pockets: potted(9, 0), numberedRails: [] }));
  assert.equal(result.spotNine, true);assert.equal(result.winner, undefined);assert.equal(foul.winner, null);
  assert.equal(foul.pocketed.has(9), false);assert.equal(foul.ballInHand, 'table');
  const first = new NineBallGame();assert.equal(first.resolveShot(report({ firstContacts: [9], pockets: potted(9) })).foul, 'wrong-first-ball');
});

test('legal combinations can win on the 9 in any pocket without calling it', () => {
  const game = openGame();const result = game.resolveShot(report({ pockets: potted(9), pocketAfterContact: true, numberedRails: [] }));
  assert.equal(result.winner, 0);assert.equal(result.reason, 'nine-pocketed');assert.equal(game.pocketed.has(1), false);
});

test('the lowest remaining ball must be hit first and any legal numbered pocket retains the turn', () => {
  const game = openGame();assert.deepEqual(game.targets(), [1]);assert.equal(game.callReady({}), true);
  assert.equal(game.resolveShot(report({ pockets: potted(1), pocketAfterContact: true })).keepTurn, true);
  assert.deepEqual(game.targets(), [2]);
  assert.equal(game.resolveShot(report({ firstContacts: [2], pockets: potted(7), pocketAfterContact: true })).keepTurn, true);
  assert.deepEqual(game.targets(), [2]);
  const result = game.resolveShot(report({ firstContacts: [3] }));
  assert.equal(result.foul, 'wrong-first-ball');assert.equal(game.currentPlayer, 1);
});

test('normal no-contact/no-rail fouls apply, while ambiguous split hits favor a legal lowest ball', () => {
  for (const [changes, expected] of [[{ firstContacts: [] }, 'no-contact'], [{ railAfterContact: false }, 'no-rail'], [{ closeHit: true }, 'close-double-hit']]) {
    const game = openGame();assert.equal(game.resolveShot(report(changes)).foul, expected);
  }
  const split = openGame();assert.equal(split.resolveShot(report({ firstContacts: [2, 1] })).foul, null);
});

test('illegally pocketed/off-table 9 is re-spotted while other balls remain down', () => {
  const game = openGame();const result = game.resolveShot(report({ pockets: potted(1, 3, 9, 0), pocketAfterContact: true }));
  assert.equal(result.spotNine, true);assert.equal(game.lowestBall, 2);assert.equal(game.pocketed.has(9), false);
  assert.ok(game.pocketed.has(1) && game.pocketed.has(3));
  const off = openGame();const removed = off.resolveShot(report({ offTable: [9] }));
  assert.equal(removed.spotNine, true);assert.equal(off.winner, null);
});

test('a push-out allows no contact or rail, then the opponent chooses to take or pass back', () => {
  for (const take of [true, false]) {
    const game = afterBreak(), pusher = game.currentPlayer;
    const result = game.resolveShot(report({ firstContacts: [], railAfterContact: false, call: { push: true } }));
    assert.equal(result.pushOut, true);assert.equal(result.foul, null);assert.equal(game.pushAvailable, false);
    assert.deepEqual(game.pendingPush, { pusher, chooser: 1 - pusher });
    assert.equal(game.resolveShot(report()), null, 'must wait for the decision');
    assert.equal(game.choosePush(take), true);assert.equal(game.currentPlayer, take ? 1 - pusher : pusher);
    assert.equal(game.callReady({ push: true }), false);assert.equal(game.ballInHand, null);
    assert.equal(game.resolveShot(report({ firstContacts: [] })).foul, 'no-contact', 'normal rules resume after the choice');
  }
});

test('a pushed 9 is spotted, other pushed balls stay down, and a legal push resets the shooter’s foul count', () => {
  const game = afterBreak();game.consecutiveFouls[1] = 2;game.warned[1] = true;
  const result = game.resolveShot(report({ firstContacts: [9], railAfterContact: false, pockets: potted(2, 9), call: { push: true } }));
  assert.equal(result.pushOut, true);assert.equal(result.spotNine, true);assert.equal(game.pocketed.has(2), true);
  assert.equal(game.pocketed.has(9), false);assert.equal(game.consecutiveFouls[1], 0);assert.equal(game.warned[1], false);
});

test('push-outs are limited to the shot after a legal break and still penalize scratches', () => {
  const game = afterBreak();game.resolveShot(report());
  assert.equal(game.pushAvailable, false);assert.equal(game.callReady({ push: true }), false);
  assert.equal(game.resolveShot(report({ call: { push: true } })).foul, 'illegal-push');
  const scratch = afterBreak();const result = scratch.resolveShot(report({ pockets: potted(0, 9), firstContacts: [], railAfterContact: false, call: { push: true } }));
  assert.equal(result.foul, 'scratch');assert.equal(result.spotNine, true);assert.equal(scratch.pendingPush, null);assert.equal(scratch.ballInHand, 'table');
});

test('a warned third consecutive foul loses, but a third without the warning does not', () => {
  for (const warned of [true, false]) {
    const game = openGame();
    game.resolveShot(report({ firstContacts: [] }));game.resolveShot(report());
    const second = game.resolveShot(report({ firstContacts: [] }));
    assert.equal(second.warningPlayer, 0);
    if (warned) assert.equal(game.acknowledgeWarning(0), true);
    game.resolveShot(report());
    const third = game.resolveShot(report({ firstContacts: [] }));
    assert.equal(game.consecutiveFouls[0], 3);
    assert.equal(third.winner, warned ? 1 : undefined);
    if (!warned) {
      assert.equal(third.warningPlayer, 0);assert.equal(game.winner, null);
      game.acknowledgeWarning(0);game.resolveShot(report());
      assert.equal(game.resolveShot(report({ firstContacts: [] })).winner, 1);
    }
  }
});

test('an intervening legal shot clears the consecutive-foul count and warning', () => {
  const game = openGame();game.consecutiveFouls[0] = 2;game.warned[0] = true;
  game.resolveShot(report());assert.equal(game.consecutiveFouls[0], 0);assert.equal(game.warned[0], false);
  assert.equal(game.acknowledgeWarning(0), false);
  game.reset(1);assert.equal(game.currentPlayer, 1);assert.deepEqual(game.consecutiveFouls, [0, 0]);assert.equal(game.pendingPush, null);
});

test('spotting the 9 uses the foot spot or the nearest clear point on its long string without moving another ball', () => {
  const physics = new PoolPhysics(() => {}, 'nine');
  physics.balls = physics.balls.filter((ball) => [0, 1, 9].includes(ball.id));
  const nine = physics.balls.find((ball) => ball.id === 9), one = physics.balls.find((ball) => ball.id === 1);
  nine.pocketed = true;one.x = 2;
  spotNineBall(physics.balls);assert.equal(nine.x, 0);assert.equal(nine.z, TABLE.footSpot);assert.equal(nine.pocketed, false);
  nine.pocketed = true;one.x = 0;const before = { ...one };
  spotNineBall(physics.balls);
  assert.ok(nine.z < TABLE.footSpot);assert.ok(Math.abs(nine.z - one.z) >= TABLE.radius * 2);
  assert.deepEqual(one, before);assert.equal(nine.vx, 0);assert.equal(nine.wy, 0);
});
