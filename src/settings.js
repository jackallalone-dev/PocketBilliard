const STORAGE_KEY = 'pocket-club.power-side';
const AIDS_KEY = 'pocket-club.aim-aids';
export const DEFAULT_AIM_AIDS = Object.freeze({ guideLine: true, targetLine: true, cueLine: true, contactCircle: true });

export function loadAimAids(storage) {
  try {
    const saved = JSON.parse((storage ?? globalThis.localStorage)?.getItem(AIDS_KEY) || '{}');
    return Object.fromEntries(Object.entries(DEFAULT_AIM_AIDS).map(([key, fallback]) => [key, typeof saved?.[key] === 'boolean' ? saved[key] : fallback]));
  } catch { return { ...DEFAULT_AIM_AIDS }; }
}

export function saveAimAids(value, storage) {
  const settings = Object.fromEntries(Object.entries(DEFAULT_AIM_AIDS).map(([key, fallback]) => [key, typeof value[key] === 'boolean' ? value[key] : fallback]));
  try { (storage ?? globalThis.localStorage)?.setItem(AIDS_KEY, JSON.stringify(settings)); } catch { /* Session settings still apply. */ }
  return settings;
}

export function loadPowerSide(storage) {
  try {
    return (storage ?? globalThis.localStorage)?.getItem(STORAGE_KEY) === 'left' ? 'left' : 'right';
  } catch {
    return 'right';
  }
}

export function savePowerSide(side, storage) {
  const value = side === 'left' ? 'left' : 'right';
  try {
    (storage ?? globalThis.localStorage)?.setItem(STORAGE_KEY, value);
  } catch {
    // The selected side still works for this session when storage is unavailable.
  }
  return value;
}

const ORIENTATION_KEY = 'pocket-club.orientation';

// Landscape fits the long table best, so it is the default on touch devices.
export function loadOrientation(storage) {
  try {
    return (storage ?? globalThis.localStorage)?.getItem(ORIENTATION_KEY) === 'auto' ? 'auto' : 'landscape';
  } catch {
    return 'landscape';
  }
}

export function saveOrientation(value, storage) {
  const choice = value === 'auto' ? 'auto' : 'landscape';
  try { (storage ?? globalThis.localStorage)?.setItem(ORIENTATION_KEY, choice); } catch { /* Session settings still apply. */ }
  return choice;
}
