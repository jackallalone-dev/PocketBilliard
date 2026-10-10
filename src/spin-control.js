import { clampSpin, MAX_TIP_OFFSET, spinDescription } from './spin.js';

export class SpinControl {
  constructor(element, { canChange, onChange, output }) {
    Object.assign(this, { element, canChange, onChange, output });
    this.value = { x: 0, y: 0 };
    this.drag = null;
    element.addEventListener('pointerdown', (event) => {
      if (event.isPrimary === false || event.button !== 0 || this.drag || !this.canChange()) return;
      event.preventDefault();
      this.drag = { id: event.pointerId, original: { ...this.value } };
      element.focus({ preventScroll: true });element.setPointerCapture(event.pointerId);
      this.move(event);
    });
    element.addEventListener('pointermove', (event) => this.move(event));
    element.addEventListener('pointerup', (event) => {
      if (this.drag?.id !== event.pointerId) return;
      this.move(event);this.end(false);
    });
    element.addEventListener('pointercancel', (event) => { if (this.drag?.id === event.pointerId) this.cancel(); });
    element.addEventListener('lostpointercapture', () => { if (this.drag) this.cancel(); });
    element.addEventListener('keydown', (event) => this.keydown(event));
    this.setValue(this.value, false);
  }

  setValue(value, notify = true) {
    this.value = clampSpin(value);
    this.element.style.setProperty('--spin-x', this.value.x);
    this.element.style.setProperty('--spin-y', this.value.y);
    const description = spinDescription(this.value);
    this.output.textContent = description;
    this.element.setAttribute('aria-label', `Cue-ball contact point: ${description}. Arrow keys adjust; Home centers the hit.`);
    if (notify) this.onChange({ ...this.value });
  }

  move(event) {
    if (!this.drag || this.drag.id !== event.pointerId) return;
    if (!this.canChange()) { this.cancel();return; }
    event.preventDefault();
    const rect = this.element.getBoundingClientRect();
    const radius = Math.min(rect.width, rect.height) / 2 * MAX_TIP_OFFSET;
    if (radius <= 0) return;
    const x = (event.clientX - rect.left - rect.width / 2) / radius;
    const y = (rect.top + rect.height / 2 - event.clientY) / radius;
    this.setValue(Math.hypot(x, y) < 0.035 ? { x: 0, y: 0 } : { x, y });
  }

  end(restore) {
    if (!this.drag) return;
    const { id, original } = this.drag;
    this.drag = null;
    if (this.element.hasPointerCapture(id)) this.element.releasePointerCapture(id);
    if (restore) this.setValue(original);
  }

  cancel() { this.end(true); }

  keydown(event) {
    if (event.key === 'Escape' && this.drag) {
      event.preventDefault();event.stopPropagation();this.cancel();return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
    event.preventDefault();event.stopPropagation();
    if (!this.canChange() || this.drag) return;
    if (event.key === 'Home') { this.setValue({ x: 0, y: 0 });return; }
    const step = event.shiftKey ? 0.01 : 0.05;
    this.setValue({
      x: this.value.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
      y: this.value.y + (event.key === 'ArrowDown' ? -step : event.key === 'ArrowUp' ? step : 0),
    });
  }
}
