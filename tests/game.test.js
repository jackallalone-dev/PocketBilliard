import test from 'node:test';
import assert from 'node:assert/strict';
import { PoolPhysics, TABLE, POCKETS } from '../src/physics.js';

const ball = (id, x, z, vx = 0, vz = 0) => ({ id, x, z, vx, vz, pocketed: false });

test('rack has all 16 unique balls, the 8 in the center, and no overlaps', () => {
  const physics = new PoolPhysics();
  assert.equal(new Set(physics.balls.map((b) => b.id)).size, 16);
  const eight = physics.balls.find((b) => b.id === 8);
  assert.equal(eight.x, 0);
  const apex = physics.balls[1];
  assert.equal(apex.z, TABLE.footSpot);
  assert.ok(physics.cue.z > TABLE.headSpot);
  assert.ok(physics.balls[11].id >= 1 && physics.balls[11].id <= 7);
  assert.ok(physics.balls[15].id >= 9 && physics.balls[15].id <= 15);
  assert.ok(Math.abs(eight.z - (apex.z - (TABLE.radius * 2 + 0.006) * Math.sqrt(3))) < 1e-8);
  for (let i = 0; i < physics.balls.length; i++) {
    for (let j = i + 1; j < physics.balls.length; j++) {
      const a = physics.balls[i], b = physics.balls[j];
      assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= TABLE.radius * 2);
    }
  }
});

test('head-on ball collision transfers momentum without adding energy', () => {
  const physics = new PoolPhysics();
  physics.balls = [ball(0, 0, 2, 0, -8), ball(1, 0, 2 - TABLE.radius * 2)];
  physics.step(1 / 240);
  assert.ok(physics.balls[1].vz < -7);
  assert.ok(Math.abs(physics.cue.vz) < 1);
  const energy = physics.balls.reduce((sum, b) => sum + b.vx ** 2 + b.vz ** 2, 0);
  assert.ok(energy <= 64);
});

test('a cushion reflects a ball and reduces its speed', () => {
  const physics = new PoolPhysics();
  physics.balls = [ball(0, TABLE.width / 2 - TABLE.radius - 0.001, 3, 6)];
  physics.step(1 / 240);
  assert.ok(physics.cue.vx < 0 && physics.cue.vx > -6);
  assert.ok(physics.cue.x <= TABLE.width / 2 - TABLE.radius);
});

test('all six pockets capture a ball and emit exactly one pocket event', () => {
  for (const pocket of POCKETS) {
    const events = [];
    const physics = new PoolPhysics((event) => events.push(event));
    const offset = pocket.captureRadius * 0.5;
    const x = pocket.x - Math.sign(pocket.x) * offset;
    const z = pocket.z - Math.sign(pocket.z) * offset;
    physics.balls = [ball(0, x, z)];
    physics.step(1 / 240);physics.step(1 / 240);
    assert.equal(physics.cue.pocketed, true);
    assert.equal(events.filter((e) => e.type === 'pocket').length, 1);
  }
});

test('a full-power break disperses the rack and comes to rest', () => {
  const physics = new PoolPhysics();
  const originals = new Map(physics.balls.map((b) => [b.id, { x: b.x, z: b.z }]));
  assert.equal(physics.shoot(0, 1), true);
  assert.equal(physics.shoot(0, 1), false, 'cannot shoot twice while balls move');
  let steps = 0;
  while (physics.moving && steps < 240 * 30) { physics.step(1 / 240);steps++; }
  assert.equal(physics.moving, false, 'shot should settle within 30 seconds');
  const displaced = physics.balls.filter((b) => Math.hypot(b.x - originals.get(b.id).x, b.z - originals.get(b.id).z) > 0.5);
  assert.ok(displaced.length > 8, 'break should spread the rack');
  for (const b of physics.balls) {
    assert.ok(Number.isFinite(b.x) && Number.isFinite(b.z));
    if (!b.pocketed) {
      assert.ok(Math.abs(b.x) <= TABLE.width / 2);
      assert.ok(Math.abs(b.z) <= TABLE.length / 2);
    }
  }
});

test('scratched cue ball is returned to a free position', () => {
  const physics = new PoolPhysics();
  physics.cue.pocketed = true;
  physics.balls.push(ball(16, 0, TABLE.headSpot));
  physics.placeCue();
  assert.equal(physics.cue.pocketed, false);
  for (const other of physics.balls.slice(1)) {
    assert.ok(Math.hypot(physics.cue.x - other.x, physics.cue.z - other.z) > TABLE.radius * 2);
  }
});
