import test from 'node:test';
import assert from 'node:assert/strict';
import { ShotControl } from '../src/shot-control.js';
import { loadPowerSide, savePowerSide } from '../src/settings.js';
import { ControlElement } from './helpers/control-element.js';

function setup() {
  const element = new ControlElement();
  const shots = [], changes = [];
  const gate = { allowed: true };
  const control = new ShotControl(element, {
    canShoot: () => gate.allowed,
    onChange: (power) => changes.push(power),
    onShoot: (power) => shots.push(power),
  });
  control.setDisabled(false);
  return { element, control, shots, changes, gate };
}

test('dragging charges without shooting; release fires exactly once at the selected power', () => {
  const { element, control, shots } = setup();
  element.send('pointerdown');
  element.send('pointermove', { clientY: 190 });
  assert.equal(control.value, 1);
  assert.equal(element.attributes.get('aria-valuenow'), '100');
  assert.equal(shots.length, 0);
  element.send('pointerup', { clientY: 190 });
  element.send('pointerup', { clientY: 190 });
  assert.deepEqual(shots, [1]);
  assert.equal(control.value, 0);
  assert.equal(control.charging, false);
  assert.equal(element.captures.size, 0);
});

test('a tap, a small finger wobble, or returning to the start never fires', () => {
  for (const end of [100, 104, 70]) {
    const { element, shots } = setup();
    element.send('pointerdown');
    element.send('pointermove', { clientY: 200 });
    element.send('pointerup', { clientY: end });
    assert.equal(shots.length, 0);
  }
});

test('sideways release cancels; moving back into the gesture rearms the shot', () => {
  const { element, shots } = setup();
  element.send('pointerdown');
  element.send('pointerup', { clientX: 200, clientY: 190 });
  assert.equal(shots.length, 0);
  element.send('pointerdown');
  element.send('pointermove', { clientX: 200, clientY: 190 });
  element.send('pointerup', { clientX: 100, clientY: 190 });
  assert.deepEqual(shots, [1]);
});

test('browser cancellation, capture loss, modal opening, or a disabled control cannot fire', () => {
  for (const reason of ['pointercancel', 'lostpointercapture', 'explicit', 'disabled', 'blocked']) {
    const { element, control, shots, gate } = setup();
    element.send('pointerdown');
    element.send('pointermove', { clientY: 240 });
    if (reason === 'explicit') control.cancel();
    else if (reason === 'disabled') control.setDisabled(true);
    else if (reason === 'blocked') gate.allowed = false;
    else element.send(reason);
    element.send('pointerup', { clientY: 240 });
    assert.equal(shots.length, 0, `${reason} must not shoot`);
    assert.equal(control.value, 0);
    assert.equal(control.charging, false);
  }
});

test('secondary touches cannot take over a shot and drag power is clamped', () => {
  const { element, control, shots } = setup();
  element.send('pointerdown', { isPrimary: false, pointerId: 2 });
  assert.equal(control.charging, false);
  element.send('pointerdown');
  element.send('pointermove', { pointerId: 2, clientY: 280 });
  element.send('pointerup', { pointerId: 2, clientY: 280 });
  assert.equal(control.value, 0);
  assert.equal(shots.length, 0);
  element.send('pointerup', { clientY: 1000 });
  assert.deepEqual(shots, [2]);
});

test('keyboard power adjustment, firing, and escape cancellation work without pointer input', () => {
  const { element, control, shots } = setup();
  element.send('keydown', { key: 'ArrowUp' });
  element.send('keydown', { key: 'ArrowUp' });
  assert.equal(control.value, 0.1);
  element.send('keydown', { key: 'Enter', repeat: false });
  assert.deepEqual(shots, [0.1]);
  element.send('keydown', { key: 'End' });
  assert.equal(control.value, 2);
  assert.equal(element.attributes.get('aria-valuemax'), '200');
  element.send('keydown', { key: 'Escape' });
  element.send('keydown', { key: ' ', repeat: false });
  assert.equal(shots.length, 1);
  element.send('keydown', { key: 'End' });
  control.setDisabled(true);
  element.send('keydown', { key: 'Enter', repeat: false });
  assert.equal(shots.length, 1);
});

test('bottom-bar power charges rightwards and cancels perpendicular movement or a layout change', () => {
  const { element, control, shots } = setup();
  element.parts['.power-track'].getBoundingClientRect = () => ({ width: 204, height: 24 });
  control.setHorizontal(true);
  assert.equal(element.attributes.get('aria-orientation'), 'horizontal');
  element.send('pointerdown');element.send('pointermove', { clientX: 190 });
  assert.equal(control.value, 1);assert.equal(shots.length, 0);
  element.send('pointerup', { clientX: 190 });assert.deepEqual(shots, [1]);
  element.send('pointerdown');element.send('pointerup', { clientX: 280 });assert.deepEqual(shots, [1, 2]);
  for (const finish of [{ clientX: 200, clientY: 200 }, { clientX: 100 }, { clientX: 104 }]) {
    element.send('pointerdown');element.send('pointermove', { clientX: 220 });element.send('pointerup', finish);
    assert.equal(shots.length, 2, 'off-axis release, returning to start, and finger wobble must not fire');
  }
  element.send('pointerdown');element.send('pointermove', { clientX: 220 });
  control.setHorizontal(false);element.send('pointerup', { clientY: 190 });
  assert.equal(shots.length, 2);assert.equal(control.value, 0);assert.equal(control.charging, false);
  assert.equal(element.attributes.get('aria-orientation'), 'vertical');
});

test('left/right preference survives a reload and invalid or unavailable storage falls back safely', () => {
  const saved = new Map();
  const storage = { getItem: (key) => saved.get(key), setItem: (key, value) => saved.set(key, value) };
  assert.equal(loadPowerSide(storage), 'right');
  savePowerSide('left', storage);
  assert.equal(loadPowerSide(storage), 'left');
  savePowerSide('right', storage);
  assert.equal(loadPowerSide(storage), 'right');
  const blocked = { getItem() { throw new Error('Storage denied'); }, setItem() { throw new Error('Storage denied'); } };
  assert.equal(loadPowerSide(blocked), 'right');
  assert.equal(savePowerSide('left', blocked), 'left', 'session choice should still work');
  assert.equal(loadPowerSide({ getItem: () => 'invalid' }), 'right');
});
