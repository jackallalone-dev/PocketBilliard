export const normalizeAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const FINE_AIM_STEP = 0.0005;

export class TableAimControl {
  constructor(element, { canAim, getCue, getAngle, setAngle, pointFromScreen, hitCue }) {
    Object.assign(this, { element, canAim, getCue, getAngle, setAngle, pointFromScreen, hitCue });
    this.drag = null;
    element.addEventListener('pointerdown', (event) => this.start(event));
    element.addEventListener('pointermove', (event) => this.move(event));
    element.addEventListener('pointerup', (event) => {
      if (this.drag?.id !== event.pointerId) return;
      this.move(event);
      if (this.drag && !this.drag.moved && this.drag.mode === 'table' && this.canAim()) {
        const point = this.pointFromScreen(event.clientX, event.clientY);
        const cue = this.getCue();
        if (point && Math.hypot(point.x - cue.x, point.z - cue.z) >= 0.25) this.setAngle(Math.atan2(point.x - cue.x, cue.z - point.z));
      }
      this.cancel();
    });
    element.addEventListener('pointercancel', (event) => { if (this.drag?.id === event.pointerId) this.cancel(); });
    element.addEventListener('lostpointercapture', () => { if (this.drag) this.cancel(); });
  }

  get active() { return this.drag !== null; }

  start(event) {
    if (event.isPrimary === false || event.button !== 0 || this.active || !this.canAim()) return;
    const point = this.pointFromScreen(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    const cue = this.getCue();
    const onCue = this.hitCue(event.clientX, event.clientY);
    this.drag = {
      id: event.pointerId, mode: onCue ? 'cue' : 'table', angle: this.getAngle(),
      bearing: Math.hypot(point.x - cue.x, point.z - cue.z) >= 0.25 ? Math.atan2(point.x - cue.x, cue.z - point.z) : null,
      x: event.clientX, y: event.clientY, moved: false,
    };
    this.element.classList.toggle('dragging-cue', onCue);
    this.element.focus({ preventScroll: true });
    this.element.setPointerCapture(event.pointerId);
    // Wait to distinguish a tap from a swipe; touching never snaps the cue.
  }

  move(event) {
    if (!this.drag || event.pointerId !== this.drag.id) return;
    if (!this.canAim()) { this.cancel();return; }
    event.preventDefault();
    if (!this.drag.moved && Math.hypot(event.clientX - this.drag.x, event.clientY - this.drag.y) < 6) return;
    this.drag.moved = true;
    const point = this.pointFromScreen(event.clientX, event.clientY);
    if (!point) return;
    const cue = this.getCue();
    if (Math.hypot(point.x - cue.x, point.z - cue.z) < 0.25) return;
    const bearing = Math.atan2(point.x - cue.x, cue.z - point.z);
    if (this.drag.bearing === null) { this.drag.bearing = bearing;return; }
    this.setAngle(normalizeAngle(this.drag.angle + normalizeAngle(bearing - this.drag.bearing)));
  }

  cancel() {
    const id = this.drag?.id;
    this.drag = null;
    this.element.classList.toggle('dragging-cue', false);
    if (id !== undefined && this.element.hasPointerCapture(id)) this.element.releasePointerCapture(id);
  }
}

export class AimWheel {
  constructor(element, { canAim, getAngle, setAngle }) {
    Object.assign(this, { element, canAim, getAngle, setAngle });
    this.drag = null;
    this.disabled = true;
    this.output = element.querySelector('output');
    element.addEventListener('pointerdown', (event) => this.start(event));
    element.addEventListener('pointermove', (event) => this.move(event));
    element.addEventListener('pointerup', (event) => {
      if (this.drag?.id !== event.pointerId) return;
      this.move(event);
      this.cancel();
    });
    element.addEventListener('pointercancel', (event) => { if (this.drag?.id === event.pointerId) this.cancel(); });
    element.addEventListener('lostpointercapture', () => { if (this.drag) this.cancel(); });
    element.addEventListener('keydown', (event) => this.keydown(event));
    element.addEventListener('wheel', (event) => {
      event.preventDefault();
      if (!this.disabled && !this.active && this.canAim()) this.adjust(Math.max(-30, Math.min(30, event.deltaY)) * FINE_AIM_STEP / 4);
    }, { passive: false });
    element.addEventListener('contextmenu', (event) => event.preventDefault());
    this.render(0);
  }

  get active() { return this.drag !== null; }

  render(angle) {
    const degrees = ((angle * 180 / Math.PI) % 360 + 360) % 360;
    const label = (Math.round(degrees * 10) % 3600 / 10).toFixed(1);
    this.element.style.setProperty('--wheel-offset', `${angle * 180 / Math.PI * 12}px`);
    this.element.setAttribute('aria-valuenow', label);
    this.element.setAttribute('aria-valuetext', `${label} degrees`);
    this.element.setAttribute('aria-disabled', String(this.disabled));
    this.output.textContent = `${label}°`;
  }

  setDisabled(disabled) {
    this.disabled = disabled;
    if (disabled) this.cancel();
    this.render(this.getAngle());
  }

  adjust(delta) {
    this.setAngle(normalizeAngle(this.getAngle() + delta));
    this.render(this.getAngle());
  }

  start(event) {
    if (event.isPrimary === false || event.button !== 0 || this.active || this.disabled || !this.canAim()) return;
    event.preventDefault();
    this.drag = { id: event.pointerId, y: event.clientY };
    this.element.classList.toggle('adjusting', true);
    this.element.focus({ preventScroll: true });
    this.element.setPointerCapture(event.pointerId);
  }

  move(event) {
    if (!this.drag || event.pointerId !== this.drag.id) return;
    if (this.disabled || !this.canAim()) { this.cancel();return; }
    event.preventDefault();
    const delta = event.clientY - this.drag.y;
    this.drag.y = event.clientY;
    this.adjust(delta * FINE_AIM_STEP);
  }

  cancel() {
    const id = this.drag?.id;
    this.drag = null;
    this.element.classList.toggle('adjusting', false);
    if (id !== undefined && this.element.hasPointerCapture(id)) this.element.releasePointerCapture(id);
  }

  keydown(event) {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') { this.cancel();return; }
    if (this.disabled || this.active || !this.canAim()) return;
    this.adjust((['ArrowUp', 'ArrowRight'].includes(event.key) ? 1 : -1) * FINE_AIM_STEP * (event.shiftKey ? 0.25 : 1));
  }
}
