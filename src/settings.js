const STORAGE_KEY = 'pocket-club.power-side';

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
