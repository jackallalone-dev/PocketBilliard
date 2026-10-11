import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { AimWheel, TableAimControl, normalizeAngle } from '../src/aim-controls.js';
import { ShotControl } from '../src/shot-control.js';
import { TableView } from '../src/table.js';
import { TABLE } from '../src/table-geometry.js';
import { controlDockLayout } from '../src/control-layout.js';
import { PocketHistory } from '../src/pocket-history.js';
import { PoolPhysics } from '../src/physics.js';
import { ControlElement } from './helpers/control-element.js';

function controls() {
  const state = { angle: 0, power: 0, allowed: true, onCue: false, shots: [] };
  const tableElement = new ControlElement(), wheelElement = new ControlElement(), powerElement = new ControlElement();
  let table, wheel, power;
  const getAngle = () => state.angle;
  const setAngle = (angle) => { state.angle = angle; };
  table = new TableAimControl(tableElement, {
    canAim: () => state.allowed && !power.charging && !wheel.active,
    getCue: () => ({ x: 0, z: 0 }), getAngle, setAngle,
    pointFromScreen: (x, y) => ({ x: (x - 100) / 100, z: (y - 100) / 100 }),
    hitCue: () => state.onCue,
  });
  wheel = new AimWheel(wheelElement, { canAim: () => state.allowed && !table.active && !power.charging, getAngle, setAngle });
  power = new ShotControl(powerElement, {
    canShoot: () => state.allowed && !table.active && !wheel.active,
    onChange: (value) => { state.power = value; },
    onShoot: (value) => state.shots.push({ angle: state.angle, power: value }),
  });
  wheel.setDisabled(false);power.setDisabled(false);
  return { state, table, wheel, power, tableElement, wheelElement, powerElement };
}

test('tapping aims on release while swiping rotates the existing aim without a touch-down snap', () => {
  const { tableElement, state } = controls();
  tableElement.send('pointerdown', { clientX: 200 });
  assert.equal(state.angle, 0, 'touching must not snap the aim');
  tableElement.send('pointerup', { clientX: 200 });
  assert.equal(state.angle, Math.PI / 2);
  tableElement.send('pointerdown', { clientX: 200 });
  tableElement.send('pointermove', { clientX: 100, clientY: 0 });
  assert.equal(state.angle, 0);
  tableElement.send('pointerup', { clientX: 100, clientY: 0 });
  assert.equal(state.shots.length, 0);
});

test('a swipe starting away from the aiming direction preserves the angle and never becomes a tap', () => {
  const { tableElement, state } = controls();
  state.angle = 0.7;
  tableElement.send('pointerdown', { clientX: 200, clientY: 100 });
  tableElement.send('pointermove', { clientX: 202, clientY: 100 });
  assert.equal(state.angle, 0.7);
  tableElement.send('pointermove', { clientX: 200, clientY: 120 });
  const expected = 0.7 + Math.atan2(1, -0.2) - Math.PI / 2;
  assert.ok(Math.abs(state.angle - expected) < 1e-8);
  tableElement.send('pointerup', { clientX: 200, clientY: 120 });
  assert.ok(Math.abs(state.angle - expected) < 1e-8, 'releasing a swipe must not aim at the release point');
});

test('grabbing the stick preserves the current aim and rotates it by the drag, not toward the butt', () => {
  const { tableElement, state } = controls();
  state.onCue = true;
  tableElement.send('pointerdown', { clientX: 100, clientY: 300 });
  assert.equal(state.angle, 0, 'grabbing the rear of the cue must not flip the shot');
  tableElement.send('pointermove', { clientX: 100, clientY: 100 });
  assert.equal(state.angle, 0, 'crossing the ball center must not jitter the aim');
  tableElement.send('pointerup', { clientX: 300, clientY: 100 });
  assert.ok(Math.abs(state.angle + Math.PI / 2) < 1e-8, 'moving the butt right should point the tip left');
  assert.equal(state.shots.length, 0);
});

test('fine-aim wheel gives small continuous changes across the angle boundary without changing power', () => {
  const { wheelElement, state, power } = controls();
  state.angle = Math.PI - 0.01;
  power.setPower(0.65);
  wheelElement.send('pointerdown');
  wheelElement.send('pointermove', { clientY: 110 });
  assert.ok(Math.abs(state.angle - (Math.PI - 0.005)) < 1e-8, 'a ten-pixel drag should make only a small fine-aim adjustment');
  wheelElement.send('pointermove', { clientY: 140 });
  assert.ok(Math.abs(state.angle - (-Math.PI + 0.01)) < 1e-8);
  wheelElement.send('pointerup', { clientY: 140 });
  assert.equal(state.power, 0.65);
  assert.equal(state.shots.length, 0);
  const before = state.angle;
  wheelElement.send('keydown', { key: 'ArrowRight', shiftKey: true });
  assert.ok(Math.abs(normalizeAngle(state.angle - before) - 0.000125) < 1e-8);
});

test('table drag, aiming wheel, and shooting lock out conflicting gestures', () => {
  const { table, wheel, power, tableElement, wheelElement, powerElement, state } = controls();
  tableElement.send('pointerdown', { clientX: 200 });
  wheelElement.send('pointerdown');powerElement.send('pointerdown');
  assert.equal(wheel.active, false);assert.equal(power.charging, false);
  table.cancel();
  wheelElement.send('pointerdown');
  tableElement.send('pointerdown', { clientX: 100, clientY: 0 });powerElement.send('pointerdown');
  assert.equal(table.active, false);assert.equal(power.charging, false);
  wheelElement.send('pointerup');
  powerElement.send('pointerdown');
  const lockedAngle = state.angle;
  tableElement.send('pointerdown', { clientX: 100, clientY: 0 });wheelElement.send('pointerdown');
  wheelElement.send('wheel', { deltaY: 20 });
  assert.equal(table.active, false);assert.equal(wheel.active, false);assert.equal(state.angle, lockedAngle);
  powerElement.send('pointerup', { clientY: 190 });
  assert.deepEqual(state.shots, [{ angle: lockedAngle, power: 1 }]);
});

test('cancelled or interrupted aiming stops tracking and secondary fingers cannot take over', () => {
  const { tableElement, wheelElement, state, table, wheel } = controls();
  tableElement.send('pointerdown', { clientX: 200 });
  tableElement.send('pointermove', { pointerId: 2, clientX: 100, clientY: 0 });
  assert.equal(state.angle, 0);
  tableElement.send('pointercancel');
  assert.equal(table.active, false);
  wheelElement.send('pointerdown');
  state.allowed = false;
  wheelElement.send('pointermove', { clientY: 200 });
  assert.equal(wheel.active, false);
  assert.equal(state.angle, 0);
});

function viewAt(width, height, left = 0, top = 0) {
  const view = Object.create(TableView.prototype);
  view.container = { clientWidth: width, clientHeight: height, getBoundingClientRect: () => ({ left, top, width, height }) };
  view.renderer = { setSize() {} };
  view.camera = new THREE.OrthographicCamera(-7, 7, 12, -12, 0.1, 100);
  view.resize();
  return view;
}

test('controls and pocketed balls dock on opposite sides without covering the table at phone and tablet sizes', () => {
  for (const [width, height] of [[300, 530], [370, 680], [780, 890], [1280, 360]]) {
    for (const side of ['left', 'right']) {
      const area = { left: 10, top: 90, width, height };
      const view = viewAt(width - 82, height, area.left + (side === 'left' ? 50 : 32), area.top);
      const frame = view.frameScreenBounds();
      const canvas = view.container.getBoundingClientRect();
      const dock = controlDockLayout(frame, canvas, area, side);
      const rail = canvas.left - area.left + (side === 'left' ? frame.left : frame.right);
      const gap = side === 'left' ? rail - dock.left - 44 : dock.left - rail;
      assert.ok(Math.abs(gap - 6) < 1e-6, 'dock must follow the table rail, not the viewport edge');
      assert.ok(dock.left >= 0 && dock.left + 44 <= width);
      assert.ok(dock.top - dock.height / 2 >= 0 && dock.top + dock.height / 2 <= height);
      const opposite = side === 'left' ? 'right' : 'left';
      const tray = controlDockLayout(frame, canvas, area, opposite, 26);
      const oppositeRail = canvas.left - area.left + (opposite === 'left' ? frame.left : frame.right);
      const trayGap = opposite === 'left' ? oppositeRail - tray.left - 26 : tray.left - oppositeRail;
      assert.ok(Math.abs(trayGap - 6) < 1e-6, 'pocketed-ball tray must follow the opposite rail');
      assert.ok(tray.left >= 0 && tray.left + 26 <= width);
      assert.ok(tray.top - tray.height / 2 >= 0 && tray.top + tray.height / 2 <= height);
      assert.ok(side === 'left' ? dock.left + 44 < tray.left : tray.left + 26 < dock.left);
    }
  }
});

test('cue hit testing has a finger-friendly target in portrait and landscape without swallowing cue-ball taps', () => {
  for (const [width, height] of [[320, 660], [900, 440]]) {
    const view = viewAt(width, height, 17, 80);
    view.scene = new THREE.Scene();
    view.buildAim();
    const cue = { id: 0, x: 0, z: 0, pocketed: false };
    for (const angle of [0, Math.PI / 2, 0.7]) {
      view.updateAim([cue], angle, 0, true);
      view.cueGroup.updateWorldMatrix(true, false);
      const stick = view.pointToScreen(view.cueGroup.localToWorld(new THREE.Vector3(0, 0, 2.5)));
      assert.equal(view.hitCue(stick.x + 10, stick.y, cue), true);
      const ball = view.pointToScreen(new THREE.Vector3(0, TABLE.radius + 0.028, 0));
      assert.equal(view.hitCue(ball.x, ball.y, cue), false);
    }
    view.aimGroup.visible = false;
    assert.equal(view.hitCue(100, 100, cue), false);
    view.scene.traverse((object) => { object.geometry?.dispose();object.material?.dispose(); });
  }
});

test('pocket history updates on pocket events, preserves order, excludes scratches, and clears for a new rack', () => {
  const history = new PocketHistory();
  const physics = new PoolPhysics((event) => { if (event.type === 'pocket') history.record(event.id); });
  const pocket = { x: 4.47, z: 0 };
  for (const id of [12, 3, 0, 8]) physics.pocket(physics.balls.find((ball) => ball.id === id), pocket);
  assert.deepEqual(history.ids, [12, 3, 8]);
  assert.equal(history.record(12), false, 'duplicate events must not duplicate the display');
  history.reset();physics.reset();
  assert.deepEqual(history.ids, []);
});
