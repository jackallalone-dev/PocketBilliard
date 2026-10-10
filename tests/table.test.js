import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PoolPhysics, POCKETS, TABLE } from '../src/physics.js';
import { boundaryDistance } from '../src/table-geometry.js';
import { TableView } from '../src/table.js';

const movingBall = (x, z, vx, vz) => ({ id: 0, x, z, vx, vz, pocketed: false });

test('balls roll through each open mouth into the recessed pocket without an invisible rail', () => {
  for (const pocket of POCKETS) {
    const events = [];
    const physics = new PoolPhysics((event) => events.push(event));
    const dx = Math.sign(pocket.x), dz = Math.sign(pocket.z);
    physics.balls = [movingBall(pocket.x - dx * 1.3, pocket.z - dz * 1.3, dx * 4, dz * 4)];
    for (let i = 0; i < 480 && !physics.cue.pocketed; i++) physics.step(1 / 240);
    assert.equal(physics.cue.pocketed, true, `pocket at ${pocket.x}, ${pocket.z} should be reachable`);
    assert.equal(events.filter((event) => event.type === 'rail').length, 0);
  }
});

test('a shot grazing a side-pocket cushion tip rebounds instead of passing through it', () => {
  const events = [];
  const physics = new PoolPhysics((event) => events.push(event));
  physics.balls = [movingBall(3.7, 0.43, 4, 0)];
  for (let i = 0; i < 100 && !events.length; i++) physics.step(1 / 240);
  assert.equal(events[0]?.type, 'rail');
  assert.equal(physics.cue.pocketed, false);
  assert.ok(Math.abs(physics.cue.vz) > 0.1, 'the angled/rounded tip should deflect the ball');
  assert.ok(Math.hypot(physics.cue.vx, physics.cue.vz) < 4, 'a jaw rebound cannot add energy');
});

test('aim predictions agree with actual cushion, jaw, and pocket contacts', () => {
  const corner = POCKETS[1];
  const angles = [0, Math.PI / 2, Math.atan2(corner.x, -corner.z), Math.atan2(4.3, -0.43)];
  for (const angle of angles) {
    let contact;
    const physics = new PoolPhysics((event) => {
      contact ||= { type: event.type, x: physics.cue.x, z: physics.cue.z };
    });
    const dx = Math.sin(angle), dz = -Math.cos(angle);
    const predicted = boundaryDistance(0, 0, dx, dz);
    physics.balls = [movingBall(0, 0, dx * 20, dz * 20)];
    for (let i = 0; i < 1200 && !contact; i++) physics.step(1 / 240);
    assert.ok(contact, `angle ${angle} must meet a rail or pocket`);
    assert.ok(Math.abs(contact.x * dx + contact.z * dz - predicted) < 0.09, `guide and physical contact must agree at angle ${angle}`);
  }
  assert.ok(boundaryDistance(0, 0, 1, 0) > TABLE.width / 2 - TABLE.radius, 'a pocket shot must continue past the ordinary cushion boundary');
});

test('the actual 3D meshes leave the cloth and recessed pocket holes unobstructed', () => {
  // Mesh construction and raycasting work without WebGL. Only the procedural
  // texture canvas is stubbed; this checks the production geometry directly.
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement: () => ({
      getContext: () => ({
        createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
        putImageData() {}, fillText() {},
      }),
    }),
  };
  const view = Object.create(TableView.prototype);
  view.scene = new THREE.Scene();
  try {
    view.buildTable();
    view.scene.updateMatrixWorld(true);
    const surfaceAt = (x, z) => {
      const ray = new THREE.Raycaster(new THREE.Vector3(x, 2, z), new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObjects(view.scene.children).find((hit) => hit.object.isMesh);
      assert.ok(hit, `missing surface at ${x}, ${z}`);
      return hit;
    };
    const heightAt = (x, z) => surfaceAt(x, z).point.y;
    assert.ok(Math.abs(heightAt(0, 0) - 0.025) < 0.001, 'wood must not cover the playing surface');
    assert.ok(heightAt(4.4, 3) > 0.17, 'the cushion must have a raised, sloping top');
    assert.ok(heightAt(4.85, 3) > 0.1, 'the wooden frame still surrounds the table');
    for (const p of POCKETS) {
      assert.ok(heightAt(p.x, p.z) < -0.1, 'pockets must be real openings down to a recessed well');
    }
    assert.ok(heightAt(4.2, 0) < 0.025, 'the side-pocket mouth must be open');
    assert.ok(heightAt(4.12, 8.35) < 0.04, 'corner jaws must leave a diagonal entrance');
    assert.equal(view.scene.children.filter((mesh) => mesh.name === 'pocket-surround').length, 6);
    for (const side of [-1, 1]) {
      assert.equal(surfaceAt(side * 4.98, 0).object.name, 'pocket-surround', 'side castings must be visible above the frame');
      for (const end of [-1, 1]) {
        assert.equal(surfaceAt(side * 4.95, end * 9).object.name, 'pocket-surround', 'corner castings must be visible above the frame');
      }
    }
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    view.scene.traverse((object) => {
      object.geometry?.dispose();
      object.material?.map?.dispose();
      object.material?.dispose();
    });
  }
});

test('camera stays exactly overhead with correct table proportions and touch mapping after resizing', () => {
  const view = Object.create(TableView.prototype);
  view.renderer = { setSize() {} };
  view.camera = new THREE.OrthographicCamera(-7, 7, 12, -12, 0.1, 100);
  view.raycaster = new THREE.Raycaster();
  const ballHeight = TABLE.radius + 0.028;
  view.aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ballHeight);
  for (const [width, height] of [[366, 650], [788, 700], [744, 850], [612, 330]]) {
    view.container = { clientWidth: width, clientHeight: height, getBoundingClientRect: () => ({ left: 13, top: 57, width, height }) };
    view.resize();
    const direction = view.camera.getWorldDirection(new THREE.Vector3());
    assert.ok(direction.distanceTo(new THREE.Vector3(0, -1, 0)) < 1e-10, 'camera must have zero tilt');
    const low = new THREE.Vector3(2, 0, 3).project(view.camera);
    const high = new THREE.Vector3(2, 1, 3).project(view.camera);
    assert.ok(Math.hypot(low.x - high.x, low.y - high.y) < 1e-10, 'objects at different heights must have no sideways parallax');
    const screenPoint = (x, z) => {
      const p = new THREE.Vector3(x, 0, z).project(view.camera);
      return new THREE.Vector2(p.x * width / 2, p.y * height / 2);
    };
    const bedWidth = screenPoint(-TABLE.width / 2, 0).distanceTo(screenPoint(TABLE.width / 2, 0));
    const bedLength = screenPoint(0, -TABLE.length / 2).distanceTo(screenPoint(0, TABLE.length / 2));
    assert.ok(Math.abs(bedLength / bedWidth - 2) < 1e-10, 'overhead table must retain its 2:1 proportions');
    for (const x of [-5.3, 5.3]) {
      for (const z of [-9.62, 9.62]) {
        const p = new THREE.Vector3(x, 0, z).project(view.camera);
        assert.ok(Math.abs(p.x) < 1 && Math.abs(p.y) < 1, 'the entire frame must fit');
      }
    }
    const target = new THREE.Vector3(2, ballHeight, 3);
    const projected = target.clone().project(view.camera);
    const picked = view.pointFromScreen(13 + (projected.x + 1) * width / 2, 57 + (1 - projected.y) * height / 2);
    assert.ok(picked.distanceTo(target) < 1e-8, 'touch positions must follow the overhead camera');
  }
});

test('cue geometry joins tip to handle without reversed tapers or gaps', () => {
  const view = Object.create(TableView.prototype);
  view.scene = new THREE.Scene();
  view.buildAim();
  const sections = view.cueGroup.children;
  assert.deepEqual(sections.map((mesh) => mesh.name), ['tip', 'ferrule', 'shaft', 'joint', 'handle', 'bumper']);
  let previous;
  for (const mesh of sections) {
    mesh.updateMatrix();
    const vertices = mesh.geometry.attributes.position;
    const points = [];
    for (let i = 0; i < vertices.count; i++) points.push(new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrix));
    const near = Math.min(...points.map((p) => p.z));
    const far = Math.max(...points.map((p) => p.z));
    const nearRadius = Math.max(...points.filter((p) => Math.abs(p.z - near) < 1e-6).map((p) => Math.hypot(p.x, p.y)));
    const farRadius = Math.max(...points.filter((p) => Math.abs(p.z - far) < 1e-6).map((p) => Math.hypot(p.x, p.y)));
    assert.ok(farRadius >= nearRadius - 1e-7, `${mesh.name} must not narrow toward the handle`);
    if (['shaft', 'handle'].includes(mesh.name)) assert.ok(farRadius > nearRadius + 0.01);
    if (previous) {
      assert.ok(Math.abs(near - previous.far) < 1e-6, `${mesh.name} must connect flush to the preceding section`);
      assert.ok(Math.abs(nearRadius - previous.farRadius) < 1e-6, `${mesh.name} must match the preceding section's diameter`);
    }
    previous = { far, farRadius };
  }
  const balls = [{ id: 0, x: 0.5, z: 1, pocketed: false }];
  for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 0.73]) {
    for (const power of [0.1, 1]) {
      view.updateAim(balls, angle, power, true);
      view.scene.updateMatrixWorld(true);
      const tip = view.cueGroup.localToWorld(new THREE.Vector3(0, 0, TABLE.radius + 0.065));
      const butt = view.cueGroup.localToWorld(new THREE.Vector3(0, 0, previous.far));
      const shotDirection = new THREE.Vector3(Math.sin(angle), 0, -Math.cos(angle));
      assert.ok(tip.clone().sub(butt).normalize().dot(shotDirection) > 1 - 1e-10, 'the tip must point toward the shot');
      const fromBall = tip.clone().sub(new THREE.Vector3(balls[0].x, TABLE.radius + 0.028, balls[0].z));
      assert.ok(fromBall.dot(shotDirection) < -TABLE.radius, 'tip must sit behind the ball');
      assert.ok(fromBall.clone().cross(shotDirection).length() < 1e-8, 'cue must line up with the center of the ball');
    }
  }
  view.scene.traverse((object) => { object.geometry?.dispose();object.material?.dispose(); });
});
