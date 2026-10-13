import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PoolPhysics, TABLE } from '../src/physics.js';
import { REST_MOTION, REST_ORIENTATION, advanceBall, cushionImpulse } from '../src/ball-motion.js';
import { clampSpin } from '../src/spin.js';
import { SpinControl } from '../src/spin-control.js';
import { Playground } from '../src/playground.js';
import { TableView } from '../src/table.js';
import { ControlElement } from './helpers/control-element.js';

const energy = (ball) => 0.5 * (ball.vx ** 2 + ball.vz ** 2) + 0.2 * TABLE.radius ** 2 * ((ball.wx || 0) ** 2 + (ball.wy || 0) ** 2 + (ball.wz || 0) ** 2);

test('off-center strikes transfer less energy than centered strikes at the same cue speed', () => {
  let centerEnergy;
  for (const spin of [{ x: 0, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: 1, y: 1 }]) {
    const physics = new PoolPhysics();
    physics.shoot(0.7, 0.65, spin);
    if (spin.x === 0 && spin.y === 0) centerEnergy = energy(physics.cue);
    else assert.ok(energy(physics.cue) < centerEnergy);
  }
  assert.deepEqual(clampSpin({ x: NaN, y: Infinity }), { x: 0, y: 0 });
  assert.ok(Math.abs(Math.hypot(...Object.values(clampSpin({ x: 4, y: -3 }))) - 1) < 1e-10);
});

test('draw reverses the cue after object-ball contact; follow continues forward more strongly than center ball', () => {
  const outcomes = new Map();
  for (const y of [-1, 0, 1]) {
    let impact = null;
    const physics = new PoolPhysics((event) => { if (event.type === 'collision' && !impact) impact = { z: physics.cue.z }; });
    physics.balls = physics.balls.filter((ball) => ball.id <= 1);
    Object.assign(physics.cue, { x: 0, z: 2 });Object.assign(physics.balls[1], { x: 0, z: 0 });
    physics.shoot(0, 0.7, { x: 0, y });
    let after = 0;
    for (let step = 0; step < 1200; step++) {
      physics.step(1 / 240);
      if (impact && ++after === 72) break;
    }
    assert.ok(impact, 'shot must reach the object ball');
    outcomes.set(y, { z: physics.cue.z, vz: physics.cue.vz, impact: impact.z });
  }
  const draw = outcomes.get(-1), follow = outcomes.get(1), center = outcomes.get(0);
  assert.ok(draw.vz > 0.5 && draw.z > draw.impact + 0.1, 'draw must pull back, not just stop');
  assert.ok(follow.vz < -1 && follow.z < follow.impact - 0.2, 'follow must carry forward');
  assert.ok(Math.abs(follow.vz) > Math.abs(center.vz));
});

test('cloth friction wears off backspin and eventually turns it into forward rolling', () => {
  const physics = new PoolPhysics();physics.balls = [physics.cue];
  physics.shoot(0, 0.65, { x: 0, y: -1 });
  assert.ok(physics.cue.wx > 0);
  for (let step = 0; step < 240 * 2; step++) physics.step(1 / 240);
  assert.ok(physics.cue.vz < 0);
  assert.ok(physics.cue.wx < 0, 'backspin should not survive forever');
  assert.ok(Math.abs(physics.cue.vz - TABLE.radius * physics.cue.wx) < 1e-6, 'ball should transition to natural rolling');
});

test('left and right sidespin give opposite cushion deflections without sideways drift before contact', () => {
  const results = [];
  for (const x of [-1, 0, 1]) {
    let hit = false;
    const physics = new PoolPhysics((event) => { if (event.type === 'rail') hit = true; });
    physics.balls = [physics.cue];Object.assign(physics.cue, { x: 2.5, z: 2 });
    physics.shoot(Math.PI / 2, 0.65, { x, y: 0 });
    for (let step = 0; step < 1200 && !hit; step++) {
      if (!hit) assert.ok(Math.abs(physics.cue.z - 2) < 1e-6, 'sidespin alone must not magically curve a level shot');
      physics.step(1 / 240);
    }
    assert.ok(hit);assert.ok(physics.cue.vx < 0);
    results.push(physics.cue.vz);
  }
  assert.ok(results[0] < -0.5 && results[2] > 0.5);
  assert.ok(Math.abs(results[0] + results[2]) < 1e-6);
  assert.ok(Math.abs(results[1]) < 1e-6);
});

test('cloth and cushion friction dissipate total kinetic energy even when spin increases linear speed', () => {
  const ball = { id: 0, x: 0, z: 0, ...REST_MOTION, ...REST_ORIENTATION, vx: -6, vz: 1.2, wx: 10, wy: 80, wz: -5, pocketed: false };
  let before = energy(ball);
  cushionImpulse(ball, 1, 0, ball.vx);
  assert.ok(energy(ball) <= before + 1e-8);
  for (let i = 0; i < 3000; i++) {
    before = energy(ball);advanceBall(ball, 1 / 240);
    assert.ok(energy(ball) <= before + 1e-8, 'friction cannot add energy');
  }
  assert.ok(energy(ball) < 1e-8);
});

test('full-strength spin breaks settle, retain normalized orientations, and never leave the table', () => {
  for (const spin of [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: -0.7, y: -0.7 }]) {
    const physics = new PoolPhysics();physics.shoot(0.007, 1, spin);
    let steps = 0;
    while (physics.moving && steps++ < 240 * 30) physics.step(1 / 240);
    assert.equal(physics.moving, false);
    for (const ball of physics.balls) {
      assert.ok(Number.isFinite(ball.x) && Number.isFinite(ball.z));
      assert.ok(Math.abs(Math.hypot(ball.qx, ball.qy, ball.qz, ball.qw) - 1) < 1e-8);
      if (!ball.pocketed) assert.ok(Math.abs(ball.x) < TABLE.width / 2 + 0.5 && Math.abs(ball.z) < TABLE.length / 2 + 0.5);
    }
  }
});

test('scratch recovery and playground retry clear residual angular motion', () => {
  const physics = new PoolPhysics();physics.shoot(0, 0.8, { x: 0.5, y: -0.5 });
  physics.cue.pocketed = true;physics.placeCue();
  assert.equal(physics.cue.wx, 0);assert.equal(physics.cue.wy, 0);assert.equal(physics.cue.wz, 0);
  const model = new Playground();model.commit(0.4, { x: 0.3, y: -0.8 });
  physics.balls = model.balls;physics.shoot(0.4, 0.8, model.setupSpin);
  for (let i = 0; i < 80; i++) physics.step(1 / 240);
  model.restore();
  assert.equal(physics.moving, false);
  assert.deepEqual(model.setupSpin, { x: 0.3, y: -0.8 });
  model.editing = true;model.balls[1].wx = 25;model.move(1, 2, 2);
  assert.equal(model.balls[1].wx, 0, 'arranging a ball must not retain spin');
});

test('spin pad uses relative swipes without jumping on touch, clamps spin, and supports cancellation and keyboard input', () => {
  const element = new ControlElement();
  element.getBoundingClientRect = () => ({ left: 10, top: 20, width: 200, height: 200 });
  const output = { textContent: '' };
  let allowed = true;
  const control = new SpinControl(element, { canChange: () => allowed, onChange() {}, output });
  element.send('pointerdown', { clientX: 110, clientY: 185 });
  element.send('pointerup', { clientX: 110, clientY: 185 });
  assert.deepEqual(control.value, { x: 0, y: 0 }, 'a tap anywhere must leave the contact point alone');
  element.send('pointerdown', { clientX: 40, clientY: 55 });
  element.send('pointermove', { clientX: 40, clientY: 120 });
  element.send('pointerup', { clientX: 40, clientY: 120 });
  assert.deepEqual(control.value, { x: 0, y: -1 });assert.equal(output.textContent, 'Draw 100%');
  element.send('pointerdown', { clientX: 200, clientY: 180 });
  assert.deepEqual(control.value, { x: 0, y: -1 }, 'a second swipe must start from the current spin');
  element.send('pointerup', { clientX: 200, clientY: 50 });
  assert.deepEqual(control.value, { x: 0, y: 1 });
  element.send('pointerdown', { clientX: 100, clientY: 100 });
  element.send('pointermove', { clientX: 1000, clientY: 1000 });
  assert.ok(Math.abs(Math.hypot(control.value.x, control.value.y) - 1) < 1e-8);
  element.send('pointercancel');assert.deepEqual(control.value, { x: 0, y: 1 });
  element.send('keydown', { key: 'Home' });element.send('keydown', { key: 'ArrowRight' });
  assert.deepEqual(control.value, { x: 0.05, y: 0 });
  allowed = false;element.send('pointerdown', { clientX: 110, clientY: 185 });
  assert.deepEqual(control.value, { x: 0.05, y: 0 });
});

test('the rendered cue moves to the chosen contact point relative to the shot direction', () => {
  const view = Object.create(TableView.prototype);view.scene = new THREE.Scene();view.buildAim();
  const cue = { id: 0, x: 0, z: 0, pocketed: false };
  for (const angle of [0, Math.PI / 2, Math.PI]) {
    view.updateAim([cue], angle, 0, true, { x: 0.6, y: -0.6 });
    const direction = new THREE.Vector3(Math.sin(angle), 0, -Math.cos(angle));
    const right = new THREE.Vector3(-direction.z, 0, direction.x);
    assert.ok(view.cueGroup.position.dot(right) > 0);
    assert.ok(view.cueGroup.position.y < TABLE.radius + 0.028);
  }
  view.scene.traverse((object) => { object.geometry?.dispose();object.material?.dispose(); });
});
