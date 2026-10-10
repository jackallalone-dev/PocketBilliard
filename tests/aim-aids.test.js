import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { cuePathPreview } from '../src/aim-preview.js';
import { PoolPhysics, TABLE } from '../src/physics.js';
import { TableView } from '../src/table.js';
import { DEFAULT_AIM_AIDS, loadAimAids, saveAimAids } from '../src/settings.js';

function shot() {
  const physics = new PoolPhysics();physics.balls = physics.balls.filter((ball) => ball.id <= 1);
  Object.assign(physics.cue, { x: 0, z: 2 });Object.assign(physics.balls[1], { x: 0, z: 0 });
  return physics.balls;
}

test('cue-ball path estimate distinguishes draw and follow without mutating the table', () => {
  const balls = shot(), before = JSON.stringify(balls), end = { x: 0, z: TABLE.radius * 2 };
  const draw = cuePathPreview(balls, balls[1], end, 0, 0.7, { x: 0, y: -1 });
  const follow = cuePathPreview(balls, balls[1], end, 0, 0.7, { x: 0, y: 1 });
  assert.ok(draw.length > 2 && follow.length > 2);
  assert.ok(draw.at(-1).z > end.z + 0.1);
  assert.ok(follow.at(-1).z < end.z - 0.1);
  assert.equal(JSON.stringify(balls), before);
});

test('each aiming aid can be disabled independently while the cue remains visible', () => {
  const view = Object.create(TableView.prototype);view.scene = new THREE.Scene();view.buildAim();
  const balls = shot();
  const properties = { guideLine: 'guide', targetLine: 'targetGuide', cueLine: 'cueGuide', contactCircle: 'ghost' };
  for (const [selected, mesh] of Object.entries(properties)) {
    const settings = Object.fromEntries(Object.keys(properties).map((key) => [key, key === selected]));
    view.updateAim(balls, 0, 0.7, true, { x: 0, y: -1 }, settings);
    assert.equal(view[mesh].visible, true, `${selected} should remain enabled`);
    for (const [key, other] of Object.entries(properties)) if (key !== selected) assert.equal(view[other].visible, false);
    assert.equal(view.aimGroup.visible, true);assert.equal(view.cueGroup.visible, true);
  }
  view.scene.traverse((object) => { object.geometry?.dispose();object.material?.dispose(); });
});

test('aiming aid settings persist independently and recover from missing or malformed storage', () => {
  const data = new Map();const storage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) };
  assert.deepEqual(loadAimAids(storage), DEFAULT_AIM_AIDS);
  const choice = { guideLine: false, targetLine: true, cueLine: false, contactCircle: true };
  saveAimAids(choice, storage);assert.deepEqual(loadAimAids(storage), choice);
  assert.deepEqual(loadAimAids({ getItem: () => '{broken' }), DEFAULT_AIM_AIDS);
  assert.deepEqual(loadAimAids({ getItem() { throw new Error('Unavailable'); } }), DEFAULT_AIM_AIDS);
  assert.deepEqual(saveAimAids(choice, { setItem() { throw new Error('Unavailable'); } }), choice);
});
