import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PoolPhysics, TABLE, POCKETS } from '../src/physics.js';
import { REST_MOTION, REST_ORIENTATION, GRAVITY } from '../src/ball-motion.js';
import { strikeMotion, clampElevation } from '../src/spin.js';
import { cueObstruction, minimumCueElevation, cuePose } from '../src/cue-elevation.js';
import { elevatedPreview } from '../src/elevated-preview.js';
import { ShotTracker, EightBallGame } from '../src/match-rules.js';
import { NineBallGame } from '../src/nine-ball.js';
import { Playground } from '../src/playground.js';
import { TableView } from '../src/table.js';
import { DEFAULT_AIM_AIDS } from '../src/settings.js';

const ball = (id, x, z, extra = {}) => ({ id, x, z, ...REST_MOTION, ...REST_ORIENTATION, pocketed: false, ...extra });
const energy = (b) => 0.5 * (b.vx ** 2 + b.vy ** 2 + b.vz ** 2) + GRAVITY * b.y + 0.2 * TABLE.radius ** 2 * (b.wx ** 2 + b.wy ** 2 + b.wz ** 2);

test('minimum cue lift follows ball geometry, not a fixed angle', () => {
  const balls = [ball(0, 0, 0), ball(1, 0, 0.4)];
  const near = minimumCueElevation(balls, 0);
  assert.ok(near > 20 && near < 45);
  assert.equal(cueObstruction(balls, 0, {}, near), null);
  assert.equal(cueObstruction(balls, 0, {}, near - 1), 1);
  balls[1].z = 1;
  const farther = minimumCueElevation(balls, 0);
  assert.ok(farther > 0 && farther < near);
  balls[1].y = 0.2;
  assert.ok(minimumCueElevation(balls, 0) > farther, 'taller obstruction needs more lift');
  balls[1].x = 1;
  assert.equal(minimumCueElevation(balls, 0), 0, 'a ball beside the shaft does not block it');
  balls[1] = ball(1, 0, -0.4);
  assert.equal(minimumCueElevation(balls, 0), 0, 'a ball in front is a shot obstacle, not a shaft obstruction');
});

test('cue clearance handles off-center contact, aiming directions, and multiple blockers', () => {
  for (const angle of [0, 0.9, Math.PI, -2.1]) {
    const dx = -Math.sin(angle), dz = Math.cos(angle);
    const balls = [ball(0, 0, 0), ball(2, dx * 0.5, dz * 0.5), ball(3, dx * 1.8, dz * 1.8)];
    for (const spin of [{ x: 0, y: 0 }, { x: 0.5, y: -0.5 }, { x: -0.6, y: 0.7 }]) {
      const elevation = minimumCueElevation(balls, angle, spin);
      assert.ok(elevation > 0);assert.equal(cueObstruction(balls, angle, spin, elevation), null);
      balls[1].pocketed = balls[2].pocketed = true;
      assert.equal(minimumCueElevation(balls, angle, spin), 0);
      balls[1].pocketed = balls[2].pocketed = false;
    }
  }
});

test('manual elevation and power change takeoff while retaining a bounded energy budget', () => {
  const flat = strikeMotion(0, 1, {}, 0), shallow = strikeMotion(0, 1, {}, 25), steep = strikeMotion(0, 1, {}, 65);
  assert.equal(flat.vy, 0);assert.ok(shallow.vy > 0 && steep.vy > shallow.vy);
  assert.ok(Math.abs(steep.vz) < Math.abs(shallow.vz));
  assert.ok(strikeMotion(0, 0.4, {}, 65).vy < steep.vy);
  for (const elevation of [0, 1, 25, 65, 75, 89, 90]) for (const spin of [{}, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 1 }]) {
    assert.ok(energy(strikeMotion(0.6, 2, spin, elevation)) <= 0.5 * 47 ** 2 + 1e-8);
  }
  assert.equal(clampElevation(NaN), 0);assert.equal(clampElevation(-20), 0);assert.equal(clampElevation(90), 90);assert.equal(clampElevation(120), 90);
});

test('flight follows gravity without cloth friction until landing, then dissipates and settles', () => {
  const physics = new PoolPhysics();physics.balls = [ball(0, 0, 2)];
  physics.shoot(0, 0.65, { x: 0.3, y: -0.4 }, 55);
  const before = { ...physics.cue }, dt = 1 / 240;
  physics.step(dt);
  assert.ok(Math.abs(physics.cue.y - (before.vy * dt - GRAVITY * dt * dt / 2)) < 1e-9);
  assert.equal(physics.cue.vx, before.vx);assert.equal(physics.cue.vz, before.vz);assert.equal(physics.cue.wx, before.wx);
  assert.ok(Math.abs(energy(physics.cue) - energy(before)) < 1e-7);
  let peak = physics.cue.y;
  for (let step = 0; step < 7200 && physics.moving; step++) { physics.step(dt);peak = Math.max(peak, physics.cue.y); }
  assert.ok(Math.abs(peak - before.vy ** 2 / (2 * GRAVITY)) < 0.001);
  assert.equal(physics.moving, false);assert.equal(physics.cue.y, 0);assert.equal(physics.cue.vy, 0);
});

test('a high jump clears a blocker; an insufficient jump collides and records the real first ball', () => {
  for (const [elevation, expected] of [[0, 8], [15, 8], [60, 1]]) {
    let tracker;
    const physics = new PoolPhysics((event) => tracker?.record(event));
    physics.balls = [ball(0, 0, 2), ball(8, 0, 1), ball(1, 0, -3.8)];
    tracker = new ShotTracker(physics.balls, {}, 0, elevation);physics.shoot(0, 1, {}, elevation);
    for (let i = 0; i < 7200 && physics.moving; i++) physics.step(1 / 240, (balls) => tracker.sample(balls));
    assert.deepEqual(tracker.report().firstContacts, [expected]);
    const game = new NineBallGame();game.isBreak = false;game.ballInHand = null;
    assert.equal(game.resolveShot(tracker.report()).foul, elevation === 60 ? null : 'wrong-first-ball');
    if (elevation === 60) assert.equal(physics.balls[1].z, 1, 'cleared blocker must not move');
  }
});

test('airborne balls are not captured by a pocket beneath them and high rail escapes are fouls', () => {
  const events = [], physics = new PoolPhysics((event) => events.push(event));
  const pocket = POCKETS[2];
  physics.balls = [ball(0, pocket.x, pocket.z, { y: 0.8 })];physics.step(1 / 240);
  assert.equal(physics.cue.pocketed, false);
  physics.balls = [ball(0, 3, 2)];events.length = 0;
  const tracker = new ShotTracker(physics.balls);
  physics.onEvent = (event) => { events.push(event);tracker.record(event); };
  physics.shoot(Math.PI / 2, 2, {}, 60);
  for (let i = 0; i < 240 && !physics.cue.pocketed; i++) physics.step(1 / 240);
  assert.equal(events.filter((event) => event.type === 'offTable').length, 1);
  assert.equal(events.filter((event) => event.type === 'rail').length, 0);
  for (const Game of [EightBallGame, NineBallGame]) {
    const game = new Game();game.isBreak = false;game.ballInHand = null;
    assert.equal(game.resolveShot(tracker.report()).foul, 'scratch');assert.ok(game.ballInHand);
  }
});

test('a purely vertical flight remains moving and landing cannot leave residual vertical motion', () => {
  const physics = new PoolPhysics();physics.balls = [ball(0, 0, 0, { y: 0.7, vy: 1 })];
  assert.equal(physics.moving, true);assert.equal(physics.shoot(0, 1), false);
  for (let i = 0; i < 1000 && physics.moving; i++) physics.step(1 / 240);
  assert.equal(physics.moving, false);assert.equal(physics.cue.y, 0);assert.equal(physics.cue.vy, 0);
});

test('boosted steep and shallow jumps with spin remain finite and settle or leave the table', () => {
  for (const elevation of [10, 35, 60, 75, 89, 90]) {
    const physics = new PoolPhysics();physics.shoot(0, 2, { x: 0.7, y: -0.5 }, elevation);
    for (let i = 0; i < 12000 && physics.moving; i++) physics.step(1 / 240);
    assert.equal(physics.moving, false);
    for (const b of physics.balls) for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'wx', 'wy', 'wz', 'qw']) assert.ok(Number.isFinite(b[key]));
  }
});

test('elevated preview marks landing, continues afterward, and leaves the live table untouched', () => {
  const balls = [ball(0, 0, 2), ball(8, 0, 1)];
  const before = JSON.stringify(balls), preview = elevatedPreview(balls, 0, 1, {}, 60);
  assert.equal(JSON.stringify(balls), before);assert.equal(preview.target, null);
  assert.ok(preview.points.some((p) => p.y > TABLE.radius * 2));assert.equal(preview.landing.y, 0);
  assert.ok(preview.points.at(-1).z < preview.landing.z - 0.5);
  const physics = new PoolPhysics();physics.balls = balls.map((b) => ({ ...b }));physics.shoot(0, 1, {}, 60);
  for (let i = 0; i < 720; i++) {
    const vy = physics.cue.vy;physics.step(1 / 240);
    if (vy < 0 && physics.cue.vy >= 0) break;
  }
  assert.ok(Math.abs(preview.landing.z - physics.cue.z) < 1e-9);
  assert.equal(elevatedPreview(balls, 0, 1, {}, 15).target.id, 8);
});

test('cue mesh tilts upward at its butt and airborne balls render at their simulated height', () => {
  const view = Object.create(TableView.prototype);view.scene = new THREE.Scene();view.buildAim();
  const balls = [ball(0, 0, 0)], angle = 0.7, elevation = 53;
  view.updateAim(balls, angle, 0.8, true, {}, DEFAULT_AIM_AIDS, elevation);view.scene.updateMatrixWorld(true);
  const tip = view.cueGroup.getObjectByName('tip').getWorldPosition(new THREE.Vector3());
  const butt = view.cueGroup.getObjectByName('bumper').getWorldPosition(new THREE.Vector3());
  const shaft = butt.clone().sub(tip);
  assert.ok(Math.abs(Math.atan2(shaft.y, Math.hypot(shaft.x, shaft.z)) * 180 / Math.PI - elevation) < 1e-9);
  const pose = cuePose(balls[0], angle, 0.8, {}, elevation);
  assert.ok(view.cueGroup.position.distanceTo(new THREE.Vector3(pose.x, pose.y, pose.z)) < 1e-9);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(TABLE.radius), new THREE.MeshBasicMaterial());
  view.ballMeshes = new Map([[0, mesh]]);view.falling = new Map();balls[0].y = 0.8;
  assert.equal(view.sync(balls, 1 / 60), true);assert.equal(mesh.position.y, TABLE.radius + 0.028 + 0.8);
  assert.equal(view.targetGuide.visible, false);assert.equal(view.cueGuide.visible, false);
  view.scene.traverse((object) => { object.geometry?.dispose();object.material?.dispose(); });mesh.geometry.dispose();mesh.material.dispose();
});

test('retry and scratch recovery restore grounded balls and the saved manual elevation', () => {
  const playground = new Playground();playground.commit(0.2, { x: 0.2, y: 0 }, 57);
  const physics = new PoolPhysics();physics.balls = playground.balls;physics.shoot(0.2, 1, {}, 57);physics.step(1 / 60);
  assert.ok(physics.cue.y > 0);playground.restore();
  assert.equal(playground.setupElevation, 57);assert.equal(physics.cue.y, 0);assert.equal(physics.cue.vy, 0);assert.equal(physics.moving, false);
  Object.assign(physics.cue, { pocketed: true, y: 1, vy: -2 });physics.placeCue();
  assert.equal(physics.cue.y, 0);assert.equal(physics.cue.vy, 0);
});

test('close-ball approach uses the actual 3D cue angle independently of shaft clearance', () => {
  const balls = [ball(0, 0, 0), ball(1, 0, -TABLE.radius * 2 - 0.01)];
  assert.equal(new ShotTracker(balls, {}, 0, 20).closeHit, true);
  assert.equal(new ShotTracker(balls, {}, 0, 50).closeHit, false);
  assert.equal(minimumCueElevation(balls, 0), 0);
});
