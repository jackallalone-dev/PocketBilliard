import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TABLE, POCKETS } from '../src/table-geometry.js';
import { PoolPhysics } from '../src/physics.js';
import { REST_MOTION, REST_ORIENTATION, GRAVITY } from '../src/ball-motion.js';
import { CUSHION_FACES, tableContacts } from '../src/rail-geometry.js';
import { ShotTracker, EightBallGame } from '../src/match-rules.js';
import { NineBallGame } from '../src/nine-ball.js';
import { elevatedPreview } from '../src/elevated-preview.js';
import { TableView } from '../src/table.js';

const ball = (extra = {}) => ({ id: 0, x: 0, z: 0, ...REST_MOTION, ...REST_ORIENTATION, pocketed: false, ...extra });
const run = (initial, dt = 1 / 240) => {
  const events = [], physics = new PoolPhysics((event) => events.push(event));
  physics.balls = [ball(initial)];
  return { physics, events, finish() {
    for (let i = 0; i < 40 / dt && physics.moving; i++) physics.step(dt);
    assert.equal(physics.moving, false, 'the shot must settle, pocket, or leave the table');
    return physics.cue;
  } };
};
const energy = (b) => GRAVITY * b.y + 0.5 * (b.vx ** 2 + b.vy ** 2 + b.vz ** 2) + 0.2 * TABLE.radius ** 2 * (b.wx ** 2 + b.wy ** 2 + b.wz ** 2);

test('the selected 9-foot rail has regulation nose height, a real 5 1/16-inch flat cap, and a 114 × 64 inch outside', () => {
  const inch = TABLE.width / 50;
  assert.ok(Math.abs(TABLE.cushionNoseHeight / (TABLE.radius * 2) - 0.635) < 1e-12);
  assert.ok(Math.abs(TABLE.cushionDepth / inch - 1.9375) < 1e-12);
  assert.ok(Math.abs((TABLE.railWidth - TABLE.cushionDepth) / inch - 5.0625) < 1e-12);
  assert.ok(Math.abs((TABLE.frameWidth - TABLE.width) / 2 / inch - 7) < 1e-12);
  assert.ok(Math.abs(TABLE.frameLength / inch - 114) < 1e-9 && Math.abs(TABLE.frameWidth / inch - 64) < 1e-9);
  const slope = (TABLE.railTopHeight - TABLE.cushionNoseHeight) / TABLE.cushionDepth;
  assert.ok(Math.atan(slope) * 180 / Math.PI > 9 && Math.atan(slope) * 180 / Math.PI < 10);
});

test('a ball rolls along the flat cap at rail height without hitting an invisible wall or being declared out early', () => {
  const { physics, events } = run({ x: 4.9, z: 3, y: TABLE.railTopHeight, vz: 1.5, wx: 1.5 / TABLE.radius });
  for (let i = 0; i < 120; i++) physics.step(1 / 240);
  assert.ok(physics.cue.z > 3.6);
  assert.ok(Math.abs(physics.cue.y - TABLE.railTopHeight) < 1e-8);
  assert.equal(physics.cue.pocketed, false);
  assert.deepEqual(events, []);
});

test('an airborne ball can land on the cap before eventually coming to rest there', () => {
  const shot = run({ x: 4.9, z: 3, y: 0.8, vz: 1 });
  let landed = false;
  for (let i = 0; i < 180; i++) {
    shot.physics.step(1 / 240);
    if (Math.abs(shot.physics.cue.y - TABLE.railTopHeight) < 1e-6) landed = true;
    assert.equal(shot.physics.cue.pocketed, false);
  }
  assert.ok(landed, 'the cap must support the ball rather than letting it fall through');
  shot.finish();
  assert.equal(shot.events.filter((e) => e.type === 'offTable').length, 1);
  assert.equal(shot.events.at(-1).reason, 'resting-on-rail');
});

test('balls can roll inward from all four rails and settle back on the cloth', () => {
  for (const side of [-1, 1]) for (const end of [false, true]) {
    const vx = end ? 0 : -side * 2, vz = end ? -side * 2 : 0;
    const shot = run({ x: end ? 1 : side * 4.9, z: end ? side * 9.2 : 3, y: TABLE.railTopHeight,
      vx, vz, wx: vz / TABLE.radius, wz: -vx / TABLE.radius });
    const result = shot.finish();
    assert.equal(result.pocketed, false);assert.equal(result.y, 0);
    assert.ok(Math.abs(result.x) < TABLE.width / 2 && Math.abs(result.z) < TABLE.length / 2);
    assert.ok(shot.events.some((e) => e.type === 'rail'));
    assert.ok(!shot.events.some((e) => e.type === 'offTable'));
  }
});

test('gravity rolls a stationary ball off the cushion slope instead of leaving it stuck', () => {
  for (const faces of CUSHION_FACES) {
    const top = faces.find((face) => face.normal.y > 0.5);
    const center = top.triangle.getMidpoint(new THREE.Vector3()).addScaledVector(top.normal, TABLE.radius);
    const shot = run({ x: center.x, y: center.y - TABLE.radius, z: center.z });
    const initialEnergy = energy(shot.physics.cue);
    let maxEnergy = initialEnergy;
    for (let i = 0; i < 9600 && shot.physics.moving; i++) {
      shot.physics.step(1 / 240);maxEnergy = Math.max(maxEnergy, energy(shot.physics.cue));
    }
    assert.equal(shot.physics.moving, false);
    assert.equal(shot.physics.cue.pocketed, false);
    assert.equal(shot.physics.cue.y, 0);
    assert.ok(maxEnergy <= initialEnergy + 0.001, 'the slope must convert gravitational energy, not add a kick');
  }
});

test('a rail-running ball can fall into each of the six actual pocket openings', () => {
  for (const [index, pocket] of POCKETS.entries()) {
    const sx = Math.sign(pocket.x), sz = Math.sign(pocket.z), corner = sz !== 0;
    const vx = corner ? sx * 2.5 : 0, vz = corner ? 0 : -2.5;
    const shot = run({ x: corner ? sx * 2.5 : sx * 4.75, z: corner ? sz * 9.02 : 2,
      y: TABLE.railTopHeight, vx, vz, wx: vz / TABLE.radius, wz: -vx / TABLE.radius });
    shot.finish();
    assert.deepEqual(shot.events.filter((e) => e.type === 'pocket').map((e) => e.pocketIndex), [index]);
    assert.ok(!shot.events.some((e) => e.type === 'offTable'));
  }
});

test('rolling beyond the physical outer edge is out of bounds, not a fabricated pocket', () => {
  for (const side of [-1, 1]) {
    const shot = run({ x: side * 4.9, z: 3, y: TABLE.railTopHeight, vx: side * 2, wz: -side * 2 / TABLE.radius });
    shot.finish();
    const outs = shot.events.filter((e) => e.type === 'offTable');
    assert.equal(outs.length, 1);
    assert.equal(outs[0].reason, 'left-table');
    assert.ok(Math.abs(outs[0].x) > TABLE.frameWidth / 2);
    assert.ok(outs[0].vy < 0);
    assert.ok(!shot.events.some((e) => e.type === 'pocket'));
  }
});

test('a ball at rest on the cap ends the shot and produces the correct foul in both games', () => {
  for (const id of [0, 1, 8, 9]) {
    const shot = run({ id, x: 4.9, z: 3, y: TABLE.railTopHeight });
    const tracker = new ShotTracker([ball(), ...(id ? [shot.physics.cue] : [])]);
    shot.physics.onEvent = (event) => { shot.events.push(event);tracker.record(event); };
    shot.physics.step(1 / 240);
    assert.equal(shot.physics.cue.pocketed, true);
    assert.equal(shot.physics.moving, false);
    assert.deepEqual(tracker.report().offTable, [id]);assert.deepEqual(tracker.report().pockets, []);
    for (const Game of [EightBallGame, NineBallGame]) {
      const game = new Game();game.isBreak = false;game.ballInHand = null;
      const result = game.resolveShot(tracker.report());
      assert.equal(result.foul, id === 0 ? 'scratch' : 'ball-off-table');
      if (id === 9 && Game === NineBallGame) assert.equal(result.spotNine, true);
      if (id === 8 && Game === EightBallGame) assert.equal(result.reason, 'eight-off-table');
    }
  }
});

test('rail returns remain consistent at different update rates', () => {
  const initial = { x: 4.9, z: 3, y: TABLE.railTopHeight, vx: -2, wz: 2 / TABLE.radius };
  const a = run(initial, 1 / 30).finish(), b = run(initial, 1 / 240).finish();
  assert.equal(a.pocketed, false);assert.equal(b.pocketed, false);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.02);
});

test('elevated preview continues through rail contacts and marks a landing at cap height', () => {
  const balls = [ball({ x: 3.8, z: 3 })], spin = { x: 0.5, y: -0.3 };
  const preview = elevatedPreview(balls, Math.PI / 2, 1, spin, 60);
  assert.ok(Math.abs(preview.landing.y - TABLE.railTopHeight) < 1e-9);
  assert.ok(preview.points.some((p) => p.x > TABLE.width / 2 + TABLE.cushionDepth));
  assert.ok(preview.points.at(-1).x > TABLE.frameWidth / 2);
  assert.ok(preview.points.at(-1).y > 0, 'out-of-bounds preview must retain the real exit height');
  const back = elevatedPreview([ball({ x: 4.05, z: 3 })], Math.PI / 2, 1, spin, 75);
  assert.ok(back.landing.y > 0);
  assert.ok(back.points.at(-1).x < TABLE.width / 2 - 1, 'guide must continue after returning from the rail');
});

test('near-rail elevated shots finish without leaving a ball embedded or suspended in a cushion', () => {
  for (const end of [false, true]) for (const elevation of [0, 15, 45, 60, 75, 90]) for (const power of [0.1, 0.6, 2]) {
    const shot = run({ x: end ? 1 : 3.8, z: end ? 8 : 3 });
    shot.physics.shoot(end ? Math.PI : Math.PI / 2, power, { x: 0.5, y: -0.3 }, elevation);
    const b = shot.finish();
    for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'wx', 'wy', 'wz']) assert.ok(Number.isFinite(b[key]));
    if (!b.pocketed) {
      assert.equal(b.y, 0);
      assert.ok(Math.abs(b.x) < TABLE.width / 2 && Math.abs(b.z) < TABLE.length / 2);
      assert.ok(tableContacts(b).every((c) => c.depth < 0.0001));
    }
  }
});

test('out-of-bounds animation follows the exit trajectory rather than moving toward a pocket', () => {
  const view = Object.create(TableView.prototype), mesh = new THREE.Mesh(new THREE.SphereGeometry(TABLE.radius), new THREE.MeshBasicMaterial());
  view.falling = new Map();view.ballMeshes = new Map([[0, mesh]]);
  const event = { id: 0, x: TABLE.frameWidth / 2 + TABLE.radius, y: 0.2, z: 3, vx: 2, vy: -1, vz: 0.3, reason: 'left-table' };
  view.offTable(event);view.sync([ball({ pocketed: true })], 0.1);
  assert.ok(Math.abs(mesh.position.x - event.x - 0.2) < 1e-10);
  assert.ok(Math.abs(mesh.position.z - event.z - 0.03) < 1e-10);
  assert.ok(mesh.position.y < TABLE.radius + TABLE.clothHeight + event.y);
  mesh.geometry.dispose();mesh.material.dispose();
});
