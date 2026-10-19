import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PoolPhysics, TABLE } from '../src/physics.js';
import { EightBallGame } from '../src/match-rules.js';
import { NineBallGame } from '../src/nine-ball.js';
import { TableView } from '../src/table.js';
import { DEFAULT_AIM_AIDS, loadOrientation, saveOrientation } from '../src/settings.js';
import { firstHitRules } from '../src/target-rules.js';

const ball = (id, x, z) => ({ id, x, z, vx: 0, vz: 0, pocketed: false });

test('target rules ring the single legal ball and leave breaks and push-outs unrestricted', () => {
  const nine = new NineBallGame();
  assert.deepEqual(firstHitRules(nine, { nine: true }), { legal: [1], highlight: [1] }, 'the 9-ball break must hit the 1');
  nine.isBreak = false;nine.pocketed.add(1);nine.pocketed.add(2);
  assert.deepEqual(firstHitRules(nine, { nine: true }), { legal: [3], highlight: [3] });
  assert.deepEqual(firstHitRules(nine, { nine: true, push: true }), { legal: null, highlight: [] });
  nine.winner = 0;
  assert.equal(firstHitRules(nine, { nine: true }).legal, null);

  const eight = new EightBallGame({ callPocket: false });
  assert.equal(firstHitRules(eight).legal, null, 'any ball may be hit on an 8-ball break');
  eight.isBreak = false;eight.ballInHand = null;
  const open = firstHitRules(eight);
  assert.ok(!open.legal.includes(8) && open.legal.length === 14);
  assert.deepEqual(open.highlight, [], 'an open table has no single target to ring');
  eight.groups = ['solids', 'stripes'];
  assert.deepEqual(firstHitRules(eight).legal, [1, 2, 3, 4, 5, 6, 7]);
  for (let id = 1; id <= 7; id++) eight.pocketed.add(id);
  assert.deepEqual(firstHitRules(eight), { legal: [8], highlight: [8] }, 'the 8 is ringed once the group is cleared');
});

test('after an 8-ball break foul, balls inside the kitchen are not legal first contacts', () => {
  const game = new EightBallGame({ callPocket: false });
  game.isBreak = false;game.ballInHand = 'kitchen';
  const balls = [ball(0, 0, 6), ball(1, 0, -3), ball(2, 1, TABLE.headSpot + 1), ball(3, -1, -5)];
  const { legal } = firstHitRules(game, { balls });
  assert.ok(legal.includes(1) && legal.includes(3));
  assert.ok(!legal.includes(2), 'a ball behind the head string cannot be hit first');
});

test('aiming at an illegal ball shows a red "no" sign and hides the follow-on guides', () => {
  const view = Object.create(TableView.prototype);view.scene = new THREE.Scene();view.buildAim();
  const balls = [ball(0, 0, 3), ball(1, 2, -2), ball(2, 0, 0)];
  const rules = { legal: [1], highlight: [1] };
  view.updateAim(balls, 0, 0.5, true, {}, DEFAULT_AIM_AIDS, 0, rules);
  assert.equal(view.illegalTarget, 2);
  assert.equal(view.forbidden.visible, true);assert.equal(view.ghost.visible, true);
  assert.equal(view.ghost.material.color.getHex(), 0xff5a4e);
  assert.equal(view.targetGuide.visible, false);assert.equal(view.cueGuide.visible, false);
  view.updateAim(balls, 0, 0.5, true, {}, { ...DEFAULT_AIM_AIDS, contactCircle: false }, 0, rules);
  assert.equal(view.forbidden.visible, true, 'the warning ignores the contact-circle preference');

  const toOne = Math.atan2(2, 5);
  view.updateAim(balls, toOne, 0.5, true, {}, DEFAULT_AIM_AIDS, 0, rules);
  assert.equal(view.illegalTarget, null);
  assert.equal(view.forbidden.visible, false);assert.equal(view.targetGuide.visible, true);
  view.updateAim(balls, 0, 0.5, true, {}, DEFAULT_AIM_AIDS, 0, { legal: null, highlight: [] });
  assert.equal(view.forbidden.visible, false, 'unrestricted shots never show the sign');

  // The ring follows the target, even while aiming is hidden for cue placement.
  view.updateAim(balls, 0, 0.5, false, {}, DEFAULT_AIM_AIDS, 0, rules);
  assert.deepEqual(view.targetIds, [1]);
  const ring = view.targetMarkers.children.find((child) => child.visible);
  assert.ok(Math.abs(ring.position.x - 2) < 1e-12 && Math.abs(ring.position.z + 2) < 1e-12);
  balls[1].pocketed = true;
  view.updateAim(balls, 0, 0.5, false, {}, DEFAULT_AIM_AIDS, 0, rules);
  assert.equal(view.targetMarkers.children.some((child) => child.visible), false);
  view.scene.traverse((object) => { object.geometry?.dispose();object.material?.dispose(); });
});

test('the target ring pulses at the start of a turn, then disappears until the next turn', () => {
  const view = Object.create(TableView.prototype);view.scene = new THREE.Scene();view.buildAim();
  const balls = [ball(0, 0, 3), ball(1, 2, -2)];
  const visible = () => view.targetMarkers.children.some((child) => child.visible);
  view.updateTargets(balls, [1], 1000);
  assert.ok(visible());assert.equal(view.animateTargets(1000), true);
  const scales = [1000, 1225, 1450].map((now) => { view.animateTargets(now);return view.targetMarkers.children[0].scale.x; });
  assert.ok(scales[1] > scales[0] && scales[2] > scales[1], 'the ring grows and shrinks');
  assert.ok(view.targetMarkerMaterial.opacity > 0);
  view.updateTargets(balls, [1], 3000);
  assert.ok(visible(), 'an unchanged target keeps pulsing until its time is up');
  assert.equal(view.animateTargets(5000), true, 'one last frame clears the ring');
  assert.equal(visible(), false);assert.equal(view.animateTargets(5100), false, 'no rendering once it is gone');
  view.updateTargets(balls, [1], 6000);
  assert.equal(visible(), false, 'the same turn does not bring it back');
  view.updateTargets(balls, [], 7000);view.updateTargets(balls, [1], 9000);
  assert.ok(visible(), 'the next turn pulses it again');
  view.scene.traverse((object) => { object.geometry?.dispose();object.material?.dispose(); });
});

test('guide lines keep a fixed, visible screen width', () => {
  const view = Object.create(TableView.prototype);view.scene = new THREE.Scene();view.buildAim();
  for (const line of [view.guide, view.targetGuide, view.cueGuide]) {
    assert.ok(line.isLine2, 'native WebGL lines are a 1-pixel hairline');
    assert.ok(line.material.linewidth >= 2);assert.ok(line.material.opacity >= 0.85);
  }
  view.updateAim(new PoolPhysics().balls, 0, 0.5, true);
  assert.ok(view.guide.geometry.attributes.instanceStart.count >= 1);
  view.scene.traverse((object) => { object.geometry?.dispose();object.material?.dispose(); });
});

test('landscape is the default orientation and an auto-rotate choice persists', () => {
  const data = new Map(), storage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) };
  assert.equal(loadOrientation(storage), 'landscape');
  assert.equal(saveOrientation('auto', storage), 'auto');assert.equal(loadOrientation(storage), 'auto');
  assert.equal(saveOrientation('sideways', storage), 'landscape');assert.equal(loadOrientation(storage), 'landscape');
  assert.equal(loadOrientation({ getItem() { throw new Error('Unavailable'); } }), 'landscape');
});
