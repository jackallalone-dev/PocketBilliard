import test from 'node:test';
import assert from 'node:assert/strict';
import { EightBallGame, ShotTracker } from '../src/match-rules.js';
import { PoolPhysics, TABLE } from '../src/physics.js';
import { CUSHION_SEGMENTS, closestPoint } from '../src/table-geometry.js';
import { CuePlacement } from '../src/cue-placement.js';

function report(overrides = {}) {
  return {
    start: Array.from({ length: 16 }, (_, id) => ({ id, x: 0, z: id === 0 ? TABLE.headSpot + 0.6 : 0 })),
    pockets: [], firstContacts: [1], numberedRails: [1, 2, 3, 4], railAfterContact: true,
    pocketAfterContact: false, offTable: [], call: { ball: 1, pocket: 0 }, closeHit: false, ...overrides,
  };
}
const potted = (...ids) => ids.map((id) => ({ id, pocket: 0 }));
function openGame() { const game = new EightBallGame();game.isBreak = false;game.ballInHand = null;return game; }
function assignedGame(onEight = false) {
  const game = openGame();game.groups = ['solids', 'stripes'];
  if (onEight) for (let id = 1; id <= 7; id++) game.pocketed.add(id);
  return game;
}

test('break placement is behind the string; breaker choice and reset are explicit', () => {
  const game = new EightBallGame();
  assert.equal(game.ballInHand, 'kitchen');
  assert.equal(game.confirmPlacement({ pocketed: false, z: TABLE.headSpot }), false);
  assert.equal(game.confirmPlacement({ pocketed: false, z: TABLE.headSpot + 0.1 }), true);
  game.reset(1);assert.equal(game.currentPlayer, 1);assert.equal(game.breaker, 1);assert.equal(game.placementConfirmed, false);
});

test('a legal break leaves groups open and a pocket retains the breaker’s turn', () => {
  const game = new EightBallGame();
  const result = game.resolveShot(report({ pockets: potted(2, 10), numberedRails: [] }));
  assert.equal(result.keepTurn, true);assert.equal(game.currentPlayer, 0);
  assert.deepEqual(game.groups, [null, null]);assert.equal(game.isBreak, false);
  assert.equal(game.pocketed.size, 2);
  const next = game.resolveShot(report({ pockets: potted(9), call: { ball: 9, pocket: 0 }, firstContacts: [1], pocketAfterContact: true }));
  assert.equal(next.keepTurn, true);assert.deepEqual(game.groups, ['stripes', 'solids']);
});

test('a legal dry break passes the turn; four distinct numbered rail contacts are required', () => {
  const legal = new EightBallGame();legal.resolveShot(report());assert.equal(legal.currentPlayer, 1);assert.equal(legal.isBreak, false);
  const illegal = new EightBallGame();
  const result = illegal.resolveShot(report({ numberedRails: [1, 1, 2, 3] }));
  assert.equal(result.illegalBreak, true);assert.deepEqual(illegal.pendingBreak, { offender: 0, chooser: 1 });
  assert.equal(illegal.resolveShot(report()), null);
  assert.equal(illegal.chooseBreak(1), true);assert.equal(illegal.currentPlayer, 1);assert.equal(illegal.isBreak, true);
  const repeated = new EightBallGame();repeated.resolveShot(report({ numberedRails: [] }));repeated.chooseBreak(0);
  assert.equal(repeated.currentPlayer, 0);
});

test('UPA awards a legal 8-ball break, but an 8-ball break with a foul loses', () => {
  for (const scratch of [false, true]) {
    const game = new EightBallGame();
    const result = game.resolveShot(report({ pockets: potted(...(scratch ? [8, 0] : [8])), firstContacts: [8], numberedRails: [] }));
    assert.equal(result.winner, scratch ? 1 : 0);
    assert.equal(result.reason, scratch ? 'eight-on-foul' : 'eight-on-break');
  }
});

test('legal break fouls give kitchen placement and require the first object outside the kitchen', () => {
  const game = new EightBallGame();game.resolveShot(report({ pockets: potted(0, 1) }));
  assert.equal(game.currentPlayer, 1);assert.equal(game.ballInHand, 'kitchen');assert.deepEqual(game.groups, [null, null]);
  const next = report({ firstContacts: [2], call: { ball: 2, pocket: 0 } });
  next.start.find((ball) => ball.id === 2).z = TABLE.headSpot + 0.3;
  assert.equal(game.resolveShot(next).foul, 'kitchen-contact');assert.equal(game.ballInHand, 'table');
  const allowed = new EightBallGame();allowed.resolveShot(report({ pockets: potted(0, 1) }));
  const legal = allowed.resolveShot(report({ pockets: potted(2), firstContacts: [2], call: { ball: 2, pocket: 0 }, pocketAfterContact: true }));
  assert.equal(legal.foul, null);assert.deepEqual(allowed.groups, ['stripes', 'solids']);
});

test('groups are assigned only by a legal called pocket, not by flukes or safeties', () => {
  for (const call of [{ ball: 1, pocket: 1 }, { ball: 2, pocket: 0 }, { safety: true }]) {
    const game = openGame();const result = game.resolveShot(report({ pockets: potted(1), call, pocketAfterContact: true }));
    assert.equal(result.keepTurn, false);assert.deepEqual(game.groups, [null, null]);assert.ok(game.pocketed.has(1));
  }
});

test('the 8 cannot be first on an open table, but ambiguous simultaneous legal contact favors the shooter', () => {
  const bad = openGame();assert.equal(bad.resolveShot(report({ firstContacts: [8] })).foul, 'wrong-first-ball');
  const split = openGame();assert.equal(split.resolveShot(report({ firstContacts: [8, 1] })).foul, null);
});

test('wrong first ball, no contact, no rail, and close double-hit approach all grant ball in hand', () => {
  for (const [changes, foul] of [
    [{ firstContacts: [9] }, 'wrong-first-ball'], [{ firstContacts: [] }, 'no-contact'],
    [{ railAfterContact: false }, 'no-rail'], [{ closeHit: true }, 'close-double-hit'],
  ]) {
    const game = assignedGame();const result = game.resolveShot(report(changes));
    assert.equal(result.foul, foul);assert.equal(game.currentPlayer, 1);assert.equal(game.ballInHand, 'table');
  }
});

test('only the called pocket retains a turn; extra own/opponent balls stay pocketed', () => {
  const game = assignedGame();
  const result = game.resolveShot(report({ pockets: potted(1, 2, 9), pocketAfterContact: true }));
  assert.equal(result.keepTurn, true);assert.ok(game.pocketed.has(9));assert.equal(game.remaining(0).length, 5);
  const missed = game.resolveShot(report({ firstContacts: [3], pockets: [{ id: 3, pocket: 2 }], call: { ball: 3, pocket: 1 }, pocketAfterContact: true }));
  assert.equal(missed.foul, null);assert.equal(missed.keepTurn, false);assert.ok(game.pocketed.has(3));
});

test('a legal safety passes the turn even if the declared ball falls', () => {
  const game = assignedGame();const result = game.resolveShot(report({ pockets: potted(1), pocketAfterContact: true, call: { ball: 1, pocket: 0, safety: true } }));
  assert.equal(result.keepTurn, false);assert.equal(result.foul, null);assert.equal(game.currentPlayer, 1);assert.equal(game.ballInHand, null);
});

test('the 8 wins only in its called pocket on a legal shot after the group was already cleared', () => {
  const win = assignedGame(true);
  assert.equal(win.resolveShot(report({ firstContacts: [8], pockets: potted(8), call: { ball: 8, pocket: 0 }, pocketAfterContact: true })).winner, 0);
  for (const changes of [{ call: { ball: 8, pocket: 1 } }, { pockets: potted(8, 0) }, { firstContacts: [9] }, { call: { safety: true } }]) {
    const game = assignedGame(true);
    const result = game.resolveShot(report({ firstContacts: [8], pockets: potted(8), call: { ball: 8, pocket: 0 }, pocketAfterContact: true, ...changes }));
    assert.equal(result.winner, 1);
  }
  for (const ids of [[7, 8], [8, 7]]) {
    const game = assignedGame();for (let id = 1; id <= 6; id++) game.pocketed.add(id);
    assert.equal(game.resolveShot(report({ firstContacts: [7], pockets: potted(...ids), call: { ball: 7, pocket: 0 }, pocketAfterContact: true })).winner, 1);
  }
});

test('scratching on an 8-ball attempt is not a loss unless the 8 also falls', () => {
  const game = assignedGame(true);const result = game.resolveShot(report({ firstContacts: [8], pockets: potted(0), call: { ball: 8, pocket: 0 }, pocketAfterContact: true }));
  assert.equal(result.winner, undefined);assert.equal(result.foul, 'scratch');assert.equal(game.ballInHand, 'table');
});

test('off-table object balls remain down; removing the 8 loses even on an otherwise illegal break', () => {
  const game = assignedGame();assert.equal(game.resolveShot(report({ offTable: [3] })).foul, 'ball-off-table');assert.ok(game.pocketed.has(3));
  const broken = new EightBallGame();assert.equal(broken.resolveShot(report({ numberedRails: [], offTable: [8] })).winner, 1);
});

test('amateur fouls do not trigger the pro-only three-foul loss, and stalemate requires both players’ sequence', () => {
  const game = assignedGame();
  for (let i = 0; i < 6; i++) game.resolveShot(report({ pockets: potted(0), firstContacts: [] }));
  assert.equal(game.winner, null);assert.equal(game.stalemateEligible, true);
  game.resolveShot(report());assert.equal(game.stalemateEligible, false);
  const result = game.concede();assert.equal(result.winner, 1 - game.currentPlayer);
});

test('shot tracking ignores rails before first contact and initially frozen cushions until separation', () => {
  const physics = new PoolPhysics();physics.balls = physics.balls.filter((ball) => ball.id <= 1);
  const noseReach = Math.sqrt(TABLE.radius ** 2 - (TABLE.cushionNoseHeight - TABLE.radius) ** 2);
  Object.assign(physics.cue, { x: 0, z: 0 });Object.assign(physics.balls[1], { x: TABLE.width / 2 - noseReach, z: 3 });
  const ball = physics.balls[1];
  const rail = CUSHION_SEGMENTS.findIndex((s) => { const p = closestPoint(s, ball.x, ball.z);return Math.hypot(ball.x - p.x, ball.z - p.z) <= TABLE.radius + 0.001; });
  const tracker = new ShotTracker(physics.balls);
  tracker.record({ type: 'rail', id: 0, rail, step: 0 });assert.equal(tracker.report().railAfterContact, false);
  tracker.record({ type: 'contact', a: 0, b: 1, step: 1 });
  tracker.record({ type: 'rail', id: 1, rail, step: 2 });assert.equal(tracker.report().railAfterContact, false);
  ball.x -= 0.1;tracker.sample(physics.balls);
  tracker.record({ type: 'rail', id: 1, rail, step: 5 });assert.equal(tracker.report().railAfterContact, true);
});

test('quiet, low-speed contacts are still emitted for rules enforcement', () => {
  const events = [];const physics = new PoolPhysics((event) => events.push(event));
  physics.balls = physics.balls.filter((ball) => ball.id <= 1);
  Object.assign(physics.cue, { x: 0, z: TABLE.radius * 2 + 0.0001, vz: -0.3 });Object.assign(physics.balls[1], { x: 0, z: 0 });
  physics.step(1 / 240);
  assert.ok(events.some((event) => event.type === 'contact' && event.a === 0 && event.b === 1));
  assert.ok(!events.some((event) => event.type === 'collision'));
});

test('cue placement respects kitchen limits and other balls, then locks on confirmation', () => {
  const game = new EightBallGame(), physics = new PoolPhysics();
  const placement = new CuePlacement(physics, game);
  placement.move(0, 0, -6);assert.ok(physics.cue.z > TABLE.headSpot);
  assert.equal(placement.move(1, 0, 0), null);
  assert.equal(placement.confirm(), true);assert.equal(placement.move(0, 2, 5), null);
  game.ballInHand = 'table';game.placementConfirmed = false;
  const obstacle = physics.balls[1];placement.move(0, obstacle.x, obstacle.z);
  assert.ok(Math.hypot(physics.cue.x - obstacle.x, physics.cue.z - obstacle.z) >= TABLE.radius * 2);
  placement.move(0, 0, -2);assert.ok(physics.cue.z < TABLE.headSpot);
});
