import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_MODES, createMatches } from '../src/game-modes.js';
import { PoolPhysics, TABLE } from '../src/physics.js';

const pocket = (id, pocket = 2) => ({ id, pocket });
const report = (extra = {}) => ({
  start: [{ id: 0, x: 0, z: TABLE.headSpot + 0.5 }],
  firstContacts: [1], numberedRails: [1, 2, 3, 4], railAfterContact: true,
  pockets: [], pocketAfterContact: false, offTable: [], call: {}, ...extra,
});
function gameFor(mode) {
  const game = createMatches()[mode];game.isBreak = false;game.ballInHand = null;
  return game;
}
function onEight(mode) {
  const game = gameFor(mode);game.groups = ['solids', 'stripes'];
  for (let id = 1; id <= 7; id++) game.pocketed.add(id);
  return game;
}

test('regular and Call Pocket matches have independent rule state and the correct racks', () => {
  const matches = createMatches();
  assert.deepEqual(Object.keys(matches), ['match', 'nine', 'call-eight', 'call-nine']);
  for (const [mode, game] of Object.entries(matches)) {
    assert.equal(game.callPocket, mode.startsWith('call-'));
    const physics = new PoolPhysics(() => {}, GAME_MODES[mode].rack);
    assert.equal(physics.balls.length, mode.includes('nine') ? 10 : 16);
    game.isBreak = false;
    assert.equal(game.callReady({}), !game.callPocket);
    game.groups[0] = 'solids';game.pocketed.add(1);game.consecutiveFouls[0] = 2;
    game.reset(1);
    assert.equal(game.callPocket, mode.startsWith('call-'));assert.equal(game.currentPlayer, 1);
    assert.equal(game.callReady({}), true, 'breaks do not require calls');
  }
  matches['call-eight'].pocketed.add(8);matches['call-nine'].consecutiveFouls[1] = 2;
  assert.equal(matches.match.pocketed.size, 0);assert.deepEqual(matches.nine.consecutiveFouls, [0, 0]);
  assert.equal(matches.playground, undefined);
});

test('regular 8-ball assigns groups by the first legal pocket after the break and needs no call', () => {
  const game = gameFor('match');
  const result = game.resolveShot(report({ pockets: [pocket(9), pocket(1)], pocketAfterContact: true }));
  assert.equal(result.keepTurn, true);assert.equal(result.foul, null);assert.equal(game.currentPlayer, 0);
  assert.deepEqual(game.groups, ['stripes', 'solids']);
  assert.equal(game.callReady({}), true);
  const opponentOnly = game.resolveShot(report({ firstContacts: [10], pockets: [pocket(2)], pocketAfterContact: true }));
  assert.equal(opponentOnly.keepTurn, false);assert.equal(opponentOnly.foul, null);
  const foul = gameFor('match');
  foul.resolveShot(report({ pockets: [pocket(1), pocket(0)], pocketAfterContact: true }));
  assert.deepEqual(foul.groups, [null, null]);assert.equal(foul.ballInHand, 'table');
});

test('regular 8-ball wins in any pocket after clearing the group but still loses on an early 8 or foul', () => {
  const game = onEight('match');
  assert.equal(game.resolveShot(report({ firstContacts: [8], pockets: [pocket(8)], pocketAfterContact: true })).winner, 0);
  assert.equal(gameFor('match').resolveShot(report({ pockets: [pocket(8)], pocketAfterContact: true })).winner, 1);
  const scratch = onEight('match').resolveShot(report({ firstContacts: [8], pockets: [pocket(8), pocket(0)], pocketAfterContact: true }));
  assert.equal(scratch.winner, 1);assert.equal(scratch.foul, 'scratch');
});

test('Call Pocket 8-ball still requires a valid call, retains only made calls, and enforces the called 8', () => {
  const game = gameFor('call-eight');
  assert.equal(game.callReady({}), false);assert.equal(game.callReady({ safety: true }), true);
  assert.equal(game.callReady({ ball: 1, pocket: 2 }), true);
  assert.equal(game.callReady({ ball: 8, pocket: 2 }), false);
  const missed = game.resolveShot(report({ call: { ball: 1, pocket: 2 }, pockets: [pocket(1, 3)], pocketAfterContact: true }));
  assert.equal(missed.keepTurn, false);assert.equal(missed.foul, null);assert.deepEqual(game.groups, [null, null]);
  const wrongEight = onEight('call-eight').resolveShot(report({ firstContacts: [8], call: { ball: 8, pocket: 2 }, pockets: [pocket(8, 3)], pocketAfterContact: true }));
  assert.equal(wrongEight.winner, 1);assert.equal(wrongEight.reason, 'wrong-eight-pocket');
  const win = onEight('call-eight').resolveShot(report({ firstContacts: [8], call: { ball: 8, pocket: 2 }, pockets: [pocket(8)], pocketAfterContact: true }));
  assert.equal(win.winner, 0);
});

test('Call Pocket 9-ball can call combinations on any remaining ball while still requiring lowest first', () => {
  const game = gameFor('call-nine');
  assert.deepEqual(game.targets(), [1]);assert.deepEqual(game.callTargets(), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(game.callReady({}), false);
  for (const call of [{ ball: 9 }, { ball: 0, pocket: 2 }, { ball: 9, pocket: -1 }, { ball: 9, pocket: 6 }]) assert.equal(game.callReady(call), false);
  assert.equal(game.callReady({ ball: 9, pocket: 2 }), true);
  const win = game.resolveShot(report({ call: { ball: 9, pocket: 2 }, pockets: [pocket(9)], pocketAfterContact: true }));
  assert.equal(win.winner, 0);
  const foul = gameFor('call-nine').resolveShot(report({ firstContacts: [9], call: { ball: 9, pocket: 2 }, pockets: [pocket(9)], pocketAfterContact: true }));
  assert.equal(foul.foul, 'wrong-first-ball');assert.equal(foul.spotNine, true);assert.equal(foul.winner, undefined);
});

test('missed 9-ball calls pass the turn without a foul and leave other balls down', () => {
  const game = gameFor('call-nine');
  const result = game.resolveShot(report({ call: { ball: 1, pocket: 2 }, pockets: [pocket(1, 4), pocket(3)], pocketAfterContact: true }));
  assert.equal(result.keepTurn, false);assert.equal(result.foul, null);assert.equal(game.currentPlayer, 1);
  assert.equal(game.lowestBall, 2);assert.equal(game.pocketed.has(3), true);assert.equal(game.ballInHand, null);
  assert.equal(game.callReady({ ball: 1, pocket: 2 }), false);
});

test('uncalled and wrong-pocket 9s are spotted; an incidental 9 does not cancel another made call', () => {
  for (const call of [{}, { ball: 9, pocket: 3 }, { ball: 1, pocket: 2 }, { safety: true }]) {
    const game = gameFor('call-nine');
    const result = game.resolveShot(report({ call, pockets: [pocket(9)], pocketAfterContact: true }));
    assert.equal(result.spotNine, true);assert.equal(result.winner, undefined);assert.equal(result.keepTurn, false);
    assert.equal(result.foul, null);assert.equal(game.pocketed.has(9), false);assert.equal(game.winner, null);
  }
  const game = gameFor('call-nine');
  const result = game.resolveShot(report({ call: { ball: 1, pocket: 2 }, pockets: [pocket(1), pocket(9)], pocketAfterContact: true }));
  assert.equal(result.keepTurn, true);assert.equal(result.spotNine, true);assert.equal(game.currentPlayer, 0);
  assert.equal(game.lowestBall, 2);assert.equal(game.pocketed.has(9), false);
});

test('Call Pocket 9-ball exempts breaks and valid push-outs, and safety still requires a legal hit', () => {
  const game = createMatches()['call-nine'];
  const result = game.resolveShot(report({ pockets: [pocket(1)], pocketAfterContact: true }));
  assert.equal(result.keepTurn, true);assert.equal(game.pushAvailable, true);
  assert.equal(game.callReady({}), false);assert.equal(game.callReady({ push: true }), true);
  const pushed = game.resolveShot(report({ firstContacts: [], railAfterContact: false, call: { push: true }, pockets: [pocket(9)] }));
  assert.equal(pushed.pushOut, true);assert.equal(pushed.spotNine, true);
  assert.equal(game.callReady({ ball: 2, pocket: 2 }), false, 'a pending push decision blocks shooting');
  game.choosePush(true);
  assert.equal(game.callReady({ push: true }), false);assert.equal(game.callReady({ safety: true }), true);
  const safety = game.resolveShot(report({ firstContacts: [2], call: { safety: true }, pockets: [pocket(2)], pocketAfterContact: true }));
  assert.equal(safety.safety, true);assert.equal(safety.keepTurn, false);assert.equal(safety.foul, null);
  assert.equal(gameFor('call-nine').resolveShot(report({ call: { safety: true }, firstContacts: [] })).foul, 'no-contact');
  const breakNine = createMatches()['call-nine'].resolveShot(report({ pockets: [pocket(9)], pocketAfterContact: true }));
  assert.equal(breakNine.winner, 0);
});

test('Call Pocket 9-ball keeps the warned three-foul loss rule', () => {
  const game = gameFor('call-nine');game.consecutiveFouls[0] = 2;game.acknowledgeWarning(0);
  const result = game.resolveShot(report({ firstContacts: [], call: { safety: true } }));
  assert.equal(result.winner, 1);assert.equal(result.reason, 'three-fouls');
});
