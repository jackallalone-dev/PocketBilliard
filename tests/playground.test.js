import test from 'node:test';
import assert from 'node:assert/strict';
import { Playground, legalBallPosition } from '../src/playground.js';
import { BallPlacementControl } from '../src/ball-placement.js';
import { PoolPhysics, TABLE } from '../src/physics.js';
import { ControlElement } from './helpers/control-element.js';

test('playground starts with a cue and a small editable setup with no overlaps', () => {
  const model = new Playground();
  assert.equal(model.balls.length, 16);
  assert.equal(model.balls[0].id, 0);
  assert.equal(model.editing, true);
  assert.deepEqual(model.balls.filter((b) => !b.pocketed).map((b) => b.id), [0, 1, 9]);
  for (const b of model.balls.filter((b) => !b.pocketed)) assert.ok(legalBallPosition(model.balls, b.id, b.x, b.z));
});

test('placement clamps to cushions and keeps other balls fixed without overlaps', () => {
  const model = new Playground();
  const obstacle = { ...model.balls[1] };
  model.move(2, obstacle.x, obstacle.z);
  assert.ok(legalBallPosition(model.balls, 2, model.balls[2].x, model.balls[2].z));
  assert.deepEqual(model.balls[1], obstacle);
  for (const [x, z] of [[99, 0], [-99, 0], [99, 99], [-99, -99], [0, 99]]) {
    const position = model.move(2, x, z);
    assert.ok(position);
    assert.ok(legalBallPosition(model.balls, 2, position.x, position.z));
    assert.ok(Math.abs(position.x) < TABLE.width / 2 && Math.abs(position.z) < TABLE.length / 2);
  }
  assert.equal(model.move(2, NaN, 0), null);
});

test('all numbered balls can be added into a crowded area without duplicate balls or overlap', () => {
  const model = new Playground();
  model.clear();
  for (let id = 1; id <= 15; id++) {
    const point = model.move(id, 0, 0);
    assert.ok(point, `ball ${id} must find a clear position`);
    for (const b of model.balls.filter((b) => !b.pocketed)) assert.ok(legalBallPosition(model.balls, b.id, b.x, b.z));
  }
  assert.equal(new Set(model.balls.map((ball) => ball.id)).size, 16);
});

test('removal and clearing keep the cue ball and retry restores the committed arrangement', () => {
  const model = new Playground();
  model.move(4, 2, 2);
  model.selectedId = 4;
  assert.equal(model.removeSelected(), true);
  model.selectedId = 0;
  assert.equal(model.removeSelected(), false);
  model.move(4, -2, -2);
  assert.equal(model.commit(0.7), true);
  const saved = model.balls.map((b) => ({ ...b }));
  model.editing = true;
  model.clear();
  assert.deepEqual(model.balls.filter((b) => !b.pocketed).map((b) => b.id), [0]);
  assert.equal(model.restore(), 0.7);
  assert.deepEqual(model.balls, saved);
});

test('a saved trick shot survives real physics and retry stops motion and restores all balls', () => {
  const model = new Playground();
  model.clear();model.move(0, 0, 2);model.move(8, 0, 0);model.commit(0);
  const saved = model.balls.map((b) => ({ ...b }));
  const physics = new PoolPhysics();physics.balls = model.balls;
  physics.shoot(0, 0.6);
  for (let i = 0; i < 240; i++) physics.step(1 / 240);
  assert.ok(physics.moving);
  assert.notDeepEqual(model.balls, saved);
  assert.equal(model.move(8, 2, 2), null, 'arranging must be disabled during shooting');
  model.restore();
  assert.equal(physics.moving, false);
  assert.deepEqual(physics.balls, saved);
});

function placement() {
  const model = new Playground();model.clear();model.move(1, 0, 0);model.selectedId = 1;
  const canvas = new ControlElement(), handle = new ControlElement();
  const state = { allowed: true, pick: 1, changes: [] };
  const control = new BallPlacementControl(canvas, handle, {
    model, canEdit: () => state.allowed && model.editing,
    pointFromScreen: (x, y) => ({ x: (x - 100) / 100, z: (y - 100) / 100 }),
    pickBall: () => state.pick,
    onChange: (blocked) => state.changes.push(blocked),
  });
  return { model, canvas, handle, control, state };
}

test('the offset handle drags without jumping the ball to the finger', () => {
  const { model, handle, control } = placement();
  handle.send('pointerdown', { clientX: 200, clientY: 200 });
  assert.equal(model.selected.x, 0);assert.equal(model.selected.z, 0);
  handle.send('pointermove', { clientX: 230, clientY: 240 });
  assert.ok(Math.abs(model.selected.x - 0.3) < 1e-8);
  assert.ok(Math.abs(model.selected.z - 0.4) < 1e-8);
  handle.send('pointerup', { clientX: 230, clientY: 240 });
  assert.equal(control.active, false);
  assert.equal(model.selected.vx, 0);assert.equal(model.selected.vz, 0);
});

test('direct ball dragging preserves the grab offset and can return exactly to its start', () => {
  const { model, canvas } = placement();
  canvas.send('pointerdown', { clientX: 105, clientY: 110 });
  canvas.send('pointermove', { clientX: 135, clientY: 120 });
  assert.ok(Math.abs(model.selected.x - 0.3) < 1e-8);
  assert.ok(Math.abs(model.selected.z - 0.1) < 1e-8);
  canvas.send('pointerup', { clientX: 105, clientY: 110 });
  assert.ok(Math.hypot(model.selected.x, model.selected.z) < 1e-8);
});

test('cancelled drags and interrupted placement revert, while secondary pointers are ignored', () => {
  const { model, canvas, handle, state, control } = placement();
  handle.send('pointerdown');
  handle.send('pointermove', { pointerId: 2, clientX: 140 });
  assert.equal(model.selected.x, 0);
  handle.send('pointermove', { clientX: 140 });
  handle.send('pointercancel');
  assert.equal(model.selected.x, 0);assert.equal(control.active, false);
  model.selectedId = 2;state.pick = null;
  canvas.send('pointerdown', { clientX: 200 });
  assert.equal(model.selected.pocketed, false);
  state.allowed = false;
  canvas.send('pointermove', { clientX: 220 });
  assert.equal(model.selected.pocketed, true, 'interrupted addition must be rolled back');
});

test('tapping blank cloth only adds a selected off-table ball and never teleports an existing ball', () => {
  const { model, canvas, state, control } = placement();
  state.pick = null;
  canvas.send('pointerdown', { clientX: 250 });
  assert.equal(control.active, false);
  assert.equal(model.selected.x, 0);
  model.selectedId = 3;
  canvas.send('pointerdown', { clientX: 250 });
  canvas.send('pointerup', { clientX: 250 });
  assert.equal(model.selected.pocketed, false);
  assert.equal(model.selected.x, 1.5);
});
