export class ShotControl {
  constructor(element, { canShoot, onChange, onShoot, onStart = () => {} }) {
    this.element = element;
    this.canShoot = canShoot;
    this.onChange = onChange;
    this.onShoot = onShoot;
    this.onStart = onStart;
    this.track = element.querySelector('.power-track');
    this.output = element.querySelector('output');
    this.hint = element.querySelector('.power-hint');
    this.value = 0;
    this.drag = null;
    this.disabled = true;
    this.disabledLabel = 'WAIT';
    element.addEventListener('pointerdown', (event) => this.start(event));
    element.addEventListener('pointermove', (event) => this.move(event));
    element.addEventListener('pointerup', (event) => this.release(event));
    element.addEventListener('pointercancel', () => this.cancel());
    element.addEventListener('lostpointercapture', () => { if (this.drag) this.cancel(); });
    element.addEventListener('keydown', (event) => this.keydown(event));
    element.addEventListener('contextmenu', (event) => event.preventDefault());
    this.render();
  }

  get charging() { return this.drag !== null; }

  setPower(value) {
    this.value = Math.max(0, Math.min(1, value));
    this.render();
    this.onChange(this.value);
  }

  setDisabled(disabled, label = 'WAIT') {
    this.disabled = disabled;
    this.disabledLabel = label;
    if (disabled) this.cancel();
    this.render();
  }

  render() {
    const percent = Math.round(this.value * 100);
    this.element.style.setProperty('--shot-power', this.value);
    this.element.setAttribute('aria-valuenow', String(percent));
    this.element.setAttribute('aria-valuetext', `${percent} percent. ${this.drag?.cancelled ? 'Release to cancel.' : this.drag && this.value > 0 ? 'Release to shoot.' : 'Pull down to charge.'}`);
    this.element.setAttribute('aria-disabled', String(this.disabled));
    this.element.classList.toggle('charging', this.charging);
    this.element.classList.toggle('cancelled', !!this.drag?.cancelled);
    this.output.innerHTML = `${percent}<span>%</span>`;
    this.hint.textContent = this.disabled ? this.disabledLabel : this.drag?.cancelled ? 'CANCEL' : this.drag && this.value > 0 ? 'RELEASE' : this.value > 0 ? 'SPACE ↵' : 'PULL ↓';
  }

  start(event) {
    if (event.isPrimary === false || event.button !== 0 || this.drag || this.disabled || !this.canShoot()) return;
    event.preventDefault();
    this.onStart();
    this.element.focus({ preventScroll: true });
    this.drag = {
      id: event.pointerId, x: event.clientX, y: event.clientY, cancelled: false,
      travel: Math.max(60, Math.min(180, this.track.getBoundingClientRect().height - 24)),
    };
    this.element.setPointerCapture(event.pointerId);
    this.setPower(0);
  }

  move(event) {
    if (!this.drag || event.pointerId !== this.drag.id) return;
    event.preventDefault();
    this.drag.cancelled = Math.abs(event.clientX - this.drag.x) > 80;
    const distance = Math.max(0, event.clientY - this.drag.y);
    this.setPower(distance < 8 ? 0 : distance / this.drag.travel);
  }

  endDrag() {
    const id = this.drag?.id;
    this.drag = null;
    if (id !== undefined && this.element.hasPointerCapture(id)) this.element.releasePointerCapture(id);
  }

  release(event) {
    if (!this.drag || event.pointerId !== this.drag.id) return;
    this.move(event);
    const power = !this.drag.cancelled && !this.disabled && this.canShoot() ? this.value : 0;
    this.endDrag();
    this.setPower(0);
    if (power > 0) this.onShoot(power);
  }

  cancel() {
    this.endDrag();
    this.setPower(0);
  }

  keydown(event) {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' ', 'Escape'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') { this.cancel();return; }
    if (this.disabled || !this.canShoot() || this.drag) return;
    if (event.key === 'Enter' || event.key === ' ') {
      if (!event.repeat && this.value > 0) {
        const power = this.value;
        this.setPower(0);
        this.onShoot(power);
      }
    } else if (event.key === 'Home') this.setPower(0);
    else if (event.key === 'End') this.setPower(1);
    else this.setPower(this.value + (['ArrowUp', 'ArrowRight'].includes(event.key) ? 0.05 : -0.05));
  }
}
