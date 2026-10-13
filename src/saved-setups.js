import { TABLE } from './table-geometry.js';
import { REST_MOTION, REST_ORIENTATION } from './ball-motion.js';
import { clampSpin, clampElevation } from './spin.js';

export const SETUP_SLOT_COUNT = 5;
const STORAGE_KEY = 'pocket-club.playground-setups';

// Only restore known fields, and always start with grounded, stationary balls.
export function normalizeSetup(value) {
  if (!Array.isArray(value?.balls) || value.balls.length !== 16 || !Number.isFinite(value.angle)) return null;
  const ids = new Set();
  const balls = [];
  for (const ball of value.balls) {
    if (!ball || !Number.isInteger(ball.id) || ball.id < 0 || ball.id > 15 || ids.has(ball.id) ||
        !Number.isFinite(ball.x) || !Number.isFinite(ball.z) || typeof ball.pocketed !== 'boolean') return null;
    if (!ball.pocketed && (Math.abs(ball.x) > TABLE.width / 2 || Math.abs(ball.z) > TABLE.length / 2)) return null;
    ids.add(ball.id);
    const orientation = { ...REST_ORIENTATION };
    const keys = Object.keys(orientation);
    const length = Math.hypot(...keys.map((key) => ball[key]));
    if (keys.every((key) => Number.isFinite(ball[key])) && length > 1e-8) {
      for (const key of keys) orientation[key] = ball[key] / length;
    }
    balls.push({ id: ball.id, x: ball.x, z: ball.z, ...REST_MOTION, ...orientation, pocketed: ball.pocketed });
  }
  balls.sort((a, b) => a.id - b.id);
  if (balls[0].pocketed) return null;
  return {
    balls, angle: value.angle,
    spin: clampSpin({ x: Number.isFinite(value.spin?.x) ? value.spin.x : 0, y: Number.isFinite(value.spin?.y) ? value.spin.y : 0 }),
    elevation: clampElevation(Number.isFinite(value.elevation) ? value.elevation : 0),
  };
}

export class SavedSetups {
  constructor(storage) {
    this.storage = storage;
    this.slots = Array(SETUP_SLOT_COUNT).fill(null);
    try {
      const data = JSON.parse(this.store?.getItem(STORAGE_KEY) || 'null');
      if (data?.version !== 1 || !Array.isArray(data.slots)) return;
      this.slots = this.slots.map((_, index) => {
        const slot = data.slots[index], setup = normalizeSetup(slot?.setup);
        return setup ? { name: this.name(slot.name, index), setup } : null;
      });
    } catch { /* Missing or unavailable storage starts with empty slots. */ }
  }

  get store() { return this.storage ?? globalThis.localStorage; }
  validSlot(index) { return Number.isInteger(index) && index >= 0 && index < SETUP_SLOT_COUNT; }
  name(value, index) { return typeof value === 'string' && value.trim() ? value.trim().slice(0, 40) : `Setup ${index + 1}`; }

  get(index) {
    const slot = this.slots[index];
    return this.validSlot(index) && slot ? { name: slot.name, setup: normalizeSetup(slot.setup) } : null;
  }

  persist() {
    try {
      const storage = this.store;
      if (!storage) return false;
      storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, slots: this.slots }));
      return true;
    } catch { return false; }
  }

  save(index, name, value) {
    const setup = normalizeSetup(value);
    if (!this.validSlot(index) || !setup) return { ok: false, persisted: false };
    this.slots[index] = { name: this.name(name, index), setup };
    return { ok: true, persisted: this.persist() };
  }

  delete(index) {
    if (!this.validSlot(index) || !this.slots[index]) return { ok: false, persisted: false };
    this.slots[index] = null;
    return { ok: true, persisted: this.persist() };
  }
}
