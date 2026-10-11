import test from 'node:test';
import assert from 'node:assert/strict';
import { PoolPhysics, TABLE } from '../src/physics.js';

test('200% increases actual shot speed beyond 100%, and higher inputs clamp at 200%', () => {
  const speeds = [];
  for (const power of [1, 2, 20]) {
    const physics = new PoolPhysics();physics.shoot(0, power);
    speeds.push(Math.hypot(physics.cue.vx, physics.cue.vz));
  }
  assert.ok(speeds[1] > speeds[0] * 1.8);
  assert.equal(speeds[1], speeds[2]);
});

test('boosted shots hit close cushions and object balls without tunneling', () => {
  const cushion = new PoolPhysics();cushion.balls = [cushion.cue];
  Object.assign(cushion.cue, { x: TABLE.width / 2 - TABLE.radius - 0.001, z: 3 });
  cushion.shoot(Math.PI / 2, 2);cushion.step(1 / 240);
  assert.ok(cushion.cue.vx < 0);
  assert.ok(cushion.cue.x <= TABLE.width / 2 - TABLE.radius);
  const collision = new PoolPhysics();collision.balls = collision.balls.filter((ball) => ball.id <= 1);
  Object.assign(collision.cue, { x: -1, z: 2 });Object.assign(collision.balls[1], { x: 0, z: 2 });
  collision.shoot(Math.PI / 2, 2);
  let substeps = 0;
  collision.step(1 / 30, () => substeps++);
  assert.ok(substeps > 1, 'fast travel must use smaller collision steps');
  assert.ok(collision.balls[1].vx > 20);
  assert.ok(collision.cue.x < collision.balls[1].x);
});

test('200% breaks with and without spin remain contained and settle', () => {
  for (const spin of [{ x: 0, y: 0 }, { x: 0, y: -1 }, { x: 0.7, y: 0.7 }]) {
    const escaped = [];
    const physics = new PoolPhysics((event) => { if (event.type === 'offTable') escaped.push(event.id); });
    physics.shoot(0.007, 2, spin);
    let steps = 0;
    while (physics.moving && steps++ < 240 * 30) physics.step(1 / 240);
    assert.equal(physics.moving, false);
    assert.deepEqual(escaped, []);
    for (const ball of physics.balls) {
      assert.ok(Number.isFinite(ball.x) && Number.isFinite(ball.z));
      if (!ball.pocketed) assert.ok(Math.abs(ball.x) < TABLE.width / 2 + 0.5 && Math.abs(ball.z) < TABLE.length / 2 + 0.5);
    }
  }
});
