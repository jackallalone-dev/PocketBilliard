import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TABLE } from '../src/table-geometry.js';
import { strikeMotion } from '../src/spin.js';
import { advanceBall, tableImpact, GRAVITY, REST_MOTION, REST_ORIENTATION, hasBallMotion } from '../src/ball-motion.js';
import { SpinView } from '../src/spin-view.js';
import { elevatedPreview } from '../src/elevated-preview.js';
import { shotEffects } from '../src/shot-effects.js';

const ball = (motion = {}) => ({ id: 0, x: 0, z: 0, pocketed: false, ...REST_MOTION, ...REST_ORIENTATION, ...motion });
const energy = (b) => 0.5 * (b.vx ** 2 + b.vy ** 2 + b.vz ** 2) + GRAVITY * b.y + 0.2 * TABLE.radius ** 2 * (b.wx ** 2 + b.wy ** 2 + b.wz ** 2);
const near = (actual, expected, message = '') => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} ≠ ${expected}`);

test('zero and very soft strokes have no artificial minimum launch speed', () => {
  for (const elevation of [0, 15, 60, 90]) {
    const idle = strikeMotion(0.7, 0, { x: 0.6, y: -0.4 }, elevation);
    near(energy(idle), 0);
    assert.equal(hasBallMotion(ball(idle)), false);
    const soft = strikeMotion(0.7, 0.001, { x: 0.6, y: -0.4 }, elevation);
    assert.ok(energy(soft) > 0 && energy(soft) < 0.001);
  }
});

test('finite-mass level strikes conserve cue-plus-ball momentum and energy in the elastic reference case', () => {
  const m = 0.17, M = 0.54;
  const power = 0.7;
  // Infer cue approach speed from the independently known centered elastic
  // two-body collision. The same cue speed must also account for offset hits.
  const center = strikeMotion(0, power);
  const cueBefore = -center.vz * (m + M) / (2 * M);
  for (const spin of [{}, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0.6, y: 0.8 }]) {
    const motion = strikeMotion(0, power, spin);
    const cueAfter = cueBefore - m * -motion.vz / M;
    near(M * cueBefore, M * cueAfter + m * -motion.vz);
    near(0.5 * M * cueBefore ** 2, 0.5 * M * cueAfter ** 2 + m * energy(motion));
  }
});

test('table impacts oppose surface slip, preserve vertical-axis spin, and dissipate energy', () => {
  const r = TABLE.radius;
  for (const vy of [-0.01, -1, -8, -40]) {
    for (const spin of [{ wx: 0, wz: 0 }, { wx: -30, wz: 40 }, { wx: 80, wz: -50 }]) {
      const b = ball({ vx: 3, vz: -5, vy, wy: 17, ...spin });
      const before = { ...b }, slip = [b.vx + r * b.wz, b.vz - r * b.wx];
      tableImpact(b);
      const afterSlip = [b.vx + r * b.wz, b.vz - r * b.wx];
      assert.ok(b.vy >= 0 && b.vy < -vy);
      assert.ok(energy(b) <= energy(before) + 1e-9);
      near(b.wy, before.wy);
      assert.ok(Math.hypot(...afterSlip) <= Math.hypot(...slip) + 1e-9);
      assert.ok(afterSlip[0] * slip[0] + afterSlip[1] * slip[1] >= -1e-9, 'friction must not reverse slip');
      near(b.wx - before.wx, -2.5 * (b.vz - before.vz) / r);
      near(b.wz - before.wz, 2.5 * (b.vx - before.vx) / r);
    }
  }
  const rolling = ball({ vx: 3, vz: -2, wx: -2 / r, wz: -3 / r, vy: -5 });
  tableImpact(rolling);
  near(rolling.vx, 3);near(rolling.vz, -2);
});

test('the initial slate rebound includes tangential friction even for a center-axis jump', () => {
  const freeSpeed = Math.abs(strikeMotion(0, 0.6).vz);
  const b = strikeMotion(0, 0.6, {}, 45);
  assert.ok(Math.abs(b.vz) < freeSpeed / Math.sqrt(2));
  assert.ok(b.wx < 0, 'table friction imparts forward rotation during takeoff');
  const incoming = freeSpeed / Math.sqrt(2);
  const drop = ball({ vy: -incoming });tableImpact(drop);
  near(b.vy, drop.vy, 'takeoff and landing use the same normal contact law');
});

test('left/right swerve mirrors and airborne spin does not bend the flight', () => {
  const outcomes = [];
  for (const side of [-1, 1]) {
    const b = ball(strikeMotion(0, 0.2, { x: side * 0.8, y: -0.3 }, 15));
    const initial = { ...b };
    assert.ok(b.vy > 0);
    const dt = b.vy / GRAVITY / 2;
    advanceBall(b, dt);
    near(b.x, initial.vx * dt);near(b.z, initial.vz * dt);
    near(b.vx, initial.vx);near(b.vz, initial.vz);
    near(b.wx, initial.wx);near(b.wz, initial.wz);
    for (let i = 0; i < 240; i++) advanceBall(b, 1 / 240);
    assert.ok(b.x * side > 0.1);
    assert.ok(b.vx * initial.vz - b.vz * initial.vx !== 0, 'cloth contact changes direction');
    outcomes.push(b);
  }
  near(outcomes[0].x, -outcomes[1].x);near(outcomes[0].z, outcomes[1].z);
});

test('soft swerve can stay near the cloth while a firmer identical stroke hops higher', () => {
  const spin = { x: 0.8, y: -0.3 };
  const soft = ball(strikeMotion(0, 0.05, spin, 35));
  const firm = strikeMotion(0, 0.8, spin, 35);
  const height = soft.vy ** 2 / (2 * GRAVITY);
  assert.ok(height < TABLE.radius * 0.01, 'soft hop is below one percent of a radius');
  assert.ok(firm.vy ** 2 / (2 * GRAVITY) > height * 100);
  for (let i = 0; i < 240; i++) advanceBall(soft, 1 / 240);
  assert.ok(soft.x > 0.01, 'small hop must still allow spin-driven sideways travel');
});

test('vertical center strikes hop in place; offset vertical strikes transfer spin into lateral travel', () => {
  for (const angle of [0, 0.8, Math.PI, -2.4]) {
    const center = ball(strikeMotion(angle, 0.5, {}, 90));
    assert.ok(center.vy > 0);
    for (let i = 0; i < 720 && hasBallMotion(center); i++) advanceBall(center, 1 / 240);
    near(center.x, 0);near(center.z, 0);
    assert.equal(hasBallMotion(center), false);
    const offset = ball(strikeMotion(angle, 0.2, { x: 0.8, y: 0 }, 90));
    for (let i = 0; i < 240; i++) advanceBall(offset, 1 / 240);
    near(offset.x * Math.sin(angle) - offset.z * Math.cos(angle), 0);
    assert.ok(offset.x * Math.cos(angle) + offset.z * Math.sin(angle) > 0.1);
  }
});

test('sliding follows a parabola and stops slipping at the rigid-sphere transition time', () => {
  const r = TABLE.radius, b = ball({ vz: -3, wz: -12 });
  const slip = Math.hypot(12 * r, 3);
  const ax = 8 * 12 * r / slip, az = 8 * 3 / slip, dt = 0.03;
  advanceBall(b, dt);
  near(b.x, ax * dt ** 2 / 2);near(b.z, -3 * dt + az * dt ** 2 / 2);
  const transition = slip / (3.5 * 8);
  advanceBall(b, transition - dt);
  near(b.vx + r * b.wz, 0);near(b.vz - r * b.wx, 0);
});

test('cloth travel and landing-to-roll transitions agree across different timesteps', () => {
  for (const initial of [
    { vx: 3, vz: -2, wx: 12, wz: -30, wy: 10 },
    { vx: 0.08, wz: -0.08 / TABLE.radius, wy: 0.2 },
    { y: 0.002, vy: -0.4, vx: 0.3, vz: -0.4, wx: 20, wz: -10 },
  ]) {
    const results = [1, 30, 240, 960].map((steps) => {
      const b = ball(initial);
      for (let i = 0; i < steps; i++) advanceBall(b, 1 / steps);
      return b;
    });
    for (const b of results.slice(1)) {
      for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'wx', 'wy', 'wz']) near(b[key], results[0][key], key);
    }
  }
});

test('vertical and soft-shot previews use the same motion as the actual shot', () => {
  for (const [power, elevation] of [[0.05, 35], [0.2, 90]]) {
    const balls = [ball()], spin = { x: 0.8, y: -0.3 };
    const preview = elevatedPreview(balls, 0, power, spin, elevation);
    assert.equal(preview.complete, true);
    const b = ball(strikeMotion(0, power, spin, elevation));
    for (let i = 0; i < 1200 && hasBallMotion(b); i++) advanceBall(b, 1 / 240);
    near(preview.points.at(-1).x, b.x);near(preview.points.at(-1).z, b.z);
    near(shotEffects(spin, elevation, power).height, strikeMotion(0, power, spin, elevation).vy ** 2 / (2 * GRAVITY));
  }
});

test('the contact camera keeps cue-relative left/up axes at and near vertical elevation', () => {
  const view = Object.create(SpinView.prototype);
  Object.assign(view, {
    host: { clientWidth: 300, clientHeight: 240, closest: () => ({ open: true }) },
    view: 'contact', environment: new THREE.Group(), cue: new THREE.Group(),
    cap: new THREE.Group(), marker: new THREE.Group(), equator: new THREE.Group(),
    blockedCue: new THREE.Group(), ballMeshes: new Map(), camera: new THREE.PerspectiveCamera(38, 1, 0.015, 90),
    renderer: { setSize() {}, render() {} },
  });
  for (const angle of [0, 0.8, -2.1]) for (const elevation of [0, 45, 89.999, 90]) {
    view.update([ball()], angle, {}, elevation, elevation);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(view.camera.quaternion);
    near(right.x, Math.cos(angle));near(right.y, 0);near(right.z, Math.sin(angle));
    const forward = view.camera.getWorldDirection(new THREE.Vector3());
    near(forward.dot(view.camera.up), 0);
  }
});
