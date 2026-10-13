import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TABLE } from '../src/table-geometry.js';
import { cueContact, cuePose, CUE_START } from '../src/cue-elevation.js';
import { TableView } from '../src/table.js';

test('3D contact stays on the sphere and on the rendered tip axis for every cue orientation', () => {
  const view = Object.create(TableView.prototype);view.scene = new THREE.Scene();view.buildAim();
  const cue = { id: 0, x: 1.4, z: -2.3, y: 0.2 };
  const center = new THREE.Vector3(cue.x, TABLE.radius + 0.028 + cue.y, cue.z);
  for (const angle of [0, 0.7, Math.PI, -2.1]) {
    for (const elevation of [0, 25, 65, 75, 89, 90]) {
      for (const spin of [{ x: 0, y: 0 }, { x: 0, y: -1 }, { x: 0.6, y: 0.8 }, { x: -1, y: 0 }]) {
        const contact = cueContact(cue, angle, spin, elevation);
        const point = new THREE.Vector3(contact.x, contact.y, contact.z);
        assert.ok(Math.abs(point.distanceTo(center) - TABLE.radius) < 1e-12, 'marker must lie on the ball, not a flat selector');
        const pose = cuePose(cue, angle, 0, spin, elevation);
        view.cueGroup.position.set(pose.x, pose.y, pose.z);
        view.cueGroup.rotation.set(-pose.tilt, -angle, 0, 'YXZ');
        view.scene.updateMatrixWorld(true);
        const tip = view.cueGroup.localToWorld(new THREE.Vector3(0, 0, CUE_START));
        const back = new THREE.Vector3(pose.back.x, pose.back.y, pose.back.z);
        assert.ok(tip.clone().sub(point).cross(back).length() < 1e-12, 'tip must aim exactly at the marker');
        assert.ok(Math.abs(tip.distanceTo(point) - 0.065) < 1e-12, 'same tip gap as the live table');
        assert.ok(point.clone().sub(center).dot(back) > 0, 'contact must be on the approaching face');
      }
    }
  }
  view.scene.traverse((object) => { object.geometry?.dispose();object.material?.dispose(); });
});

test('steep elevation moves the whole reachable contact area above the equator, including full draw', () => {
  const cue = { x: 0, z: 0 }, equator = TABLE.radius + 0.028;
  assert.ok(cueContact(cue, 0, { x: 0, y: -1 }, 0).y < equator);
  assert.equal(cueContact(cue, 0, {}, 0).y, equator);
  for (let azimuth = 0; azimuth < 360; azimuth += 5) {
    const a = azimuth * Math.PI / 180;
    for (const fraction of [0, 0.5, 1]) {
      const spin = { x: Math.cos(a) * fraction, y: Math.sin(a) * fraction };
      assert.ok(cueContact(cue, 0.8, spin, 65).y > equator, 'draw is cue-relative; the tip cannot hit the underside through the ball');
    }
  }
});
