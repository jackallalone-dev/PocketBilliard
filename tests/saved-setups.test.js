import test from 'node:test';
import assert from 'node:assert/strict';
import { SavedSetups, SETUP_SLOT_COUNT } from '../src/saved-setups.js';
import { Playground } from '../src/playground.js';
import { PoolPhysics } from '../src/physics.js';
import { REST_MOTION } from '../src/ball-motion.js';

function memoryStorage() {
  const data = new Map();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test('five independent named slots survive reload, replacement, and deletion', () => {
  const storage = memoryStorage(), saved = new SavedSetups(storage), model = new Playground();
  assert.equal(SETUP_SLOT_COUNT, 5);assert.deepEqual(saved.slots, Array(5).fill(null));
  for (let index = 0; index < 5; index++) {
    model.move(9, -2 + index, -4);
    assert.deepEqual(saved.save(index, ` Practice ${index + 1} `, model.snapshot(index, { x: 0.3, y: -0.4 }, 45)), { ok: true, persisted: true });
  }
  assert.equal(saved.save(5, 'Extra', model.snapshot(0)).ok, false);
  assert.equal(saved.save(-1, 'Extra', model.snapshot(0)).ok, false);
  const reloaded = new SavedSetups(storage);
  for (let index = 0; index < 5; index++) {
    const { name, setup } = reloaded.get(index);
    assert.equal(name, `Practice ${index + 1}`);assert.equal(setup.balls[9].x, -2 + index);
    assert.equal(setup.angle, index);assert.deepEqual(setup.spin, { x: 0.3, y: -0.4 });assert.equal(setup.elevation, 45);
  }
  const untouched = reloaded.get(3);
  reloaded.save(1, 'Replacement', model.snapshot(0.75));reloaded.delete(0);
  const final = new SavedSetups(storage);
  assert.equal(final.get(0), null);assert.equal(final.get(1).name, 'Replacement');assert.deepEqual(final.get(3), untouched);
  assert.equal(final.slots.length, 5);
});

test('saving in Arrange leaves editing intact and loading updates live physics and Retry in either phase', () => {
  const saved = new SavedSetups(memoryStorage()), model = new Playground(), physics = new PoolPhysics();
  physics.balls = model.balls;
  const liveBalls = physics.balls, liveCue = physics.cue;
  model.move(4, -2, 2);
  saved.save(0, 'Bank', model.snapshot(0.7, { x: -0.4, y: 0.3 }, 62));
  assert.equal(model.editing, true);assert.equal(model.attempts, 0);
  for (const editing of [true, false]) {
    model.editing = true;model.clear();model.editing = editing;model.attempts = 4;
    assert.ok(model.loadSetup(saved.get(0).setup));
    assert.equal(model.editing, editing);assert.equal(model.attempts, 0);assert.equal(model.selectedId, 0);
    assert.equal(physics.balls, liveBalls);assert.equal(physics.cue, liveCue);
    assert.equal(physics.balls[4].x, -2);assert.equal(physics.balls[4].pocketed, false);
    assert.equal(model.setupAngle, 0.7);assert.deepEqual(model.setupSpin, { x: -0.4, y: 0.3 });assert.equal(model.setupElevation, 62);
    physics.shoot(0, 1);physics.step(1 / 60);
    assert.ok(physics.moving);
    assert.ok(model.loadSetup(saved.get(0).setup));
    assert.equal(physics.moving, false);
    physics.balls[4].pocketed = true;
    model.restore();assert.equal(physics.balls[4].pocketed, false);
    assert.deepEqual(physics.balls, saved.get(0).setup.balls);
  }
});

test('Shoot saves preserve the original attempt rather than moving or pocketed balls', () => {
  const model = new Playground(), saved = new SavedSetups(memoryStorage()), physics = new PoolPhysics();
  model.commit(1.2, { x: 0.2, y: -0.5 }, 55);
  // Before the first attempt, save the current aim controls.
  saved.save(0, '', model.snapshot(0.4, { x: 0, y: 1 }, 20));
  assert.equal(saved.get(0).setup.angle, 0.4);assert.equal(saved.get(0).setup.elevation, 20);
  model.attempts = 1;physics.balls = model.balls;
  physics.shoot(1.2, 1, model.setupSpin, model.setupElevation);
  for (let i = 0; i < 60; i++) physics.step(1 / 240);
  model.balls[9].pocketed = true;
  saved.save(1, 'Original shot', model.snapshot(2.8, {}, 0));
  const original = saved.get(1).setup;
  assert.deepEqual(original.balls, model.setup);
  assert.equal(original.angle, 1.2);assert.deepEqual(original.spin, { x: 0.2, y: -0.5 });assert.equal(original.elevation, 55);
  assert.equal(model.editing, false);assert.equal(model.attempts, 1);
});

test('saved snapshots cannot be changed by later edits, shots, or loads', () => {
  const saved = new SavedSetups(memoryStorage()), model = new Playground();
  const snapshot = model.snapshot(0, { x: 0.5, y: 0 }, 30);
  saved.save(0, '', snapshot);
  const expected = saved.get(0);
  snapshot.balls[0].x = 99;snapshot.spin.x = -1;
  model.move(1, 2, 3);model.loadSetup(saved.get(0).setup);model.setup[1].x = 3;
  const copy = saved.get(0);copy.setup.balls[0].x = -99;copy.setup.spin.y = 1;
  assert.deepEqual(saved.get(0), expected);
});

test('malformed storage is isolated per slot and loaded balls cannot retain motion', () => {
  const storage = memoryStorage(), model = new Playground(), saved = new SavedSetups(storage);
  for (let i = 0; i < 5; i++) saved.save(i, 'Test', model.snapshot(0));
  const key = [...storage.data.keys()][0], data = JSON.parse(storage.getItem(key));
  data.slots[0].setup.balls[1].id = 0;
  data.slots[1].setup.balls[0].pocketed = true;
  data.slots[2].setup.balls[1].x = 'bad';
  Object.assign(data.slots[3].setup.balls[0], { vx: 50, y: 10, wy: 20, qx: null, qw: null });
  storage.setItem(key, JSON.stringify(data));
  const loaded = new SavedSetups(storage);
  for (let i = 0; i < 3; i++) assert.equal(loaded.get(i), null);
  for (const [field, value] of Object.entries(REST_MOTION)) assert.equal(loaded.get(3).setup.balls[0][field], value);
  assert.equal(loaded.get(3).setup.balls[0].qw, 1);assert.ok(loaded.get(4));
  const before = structuredClone(model.balls);
  assert.equal(model.loadSetup(data.slots[0].setup), false);assert.deepEqual(model.balls, before);
  for (const raw of ['{broken', 'null', '{"version":99,"slots":[]}', '{"version":1,"slots":{}}']) {
    storage.setItem(key, raw);assert.deepEqual(new SavedSetups(storage).slots, Array(5).fill(null));
  }
});

test('unavailable browser storage reports session-only saves without losing in-session actions', () => {
  const denied = { getItem() { throw new Error('Denied'); }, setItem() { throw new Error('Quota'); } };
  const saved = new SavedSetups(denied), model = new Playground();
  assert.deepEqual(saved.save(0, 'Session', model.snapshot(0)), { ok: true, persisted: false });
  assert.equal(saved.get(0).name, 'Session');
  assert.deepEqual(saved.delete(0), { ok: true, persisted: false });assert.equal(saved.get(0), null);
});
