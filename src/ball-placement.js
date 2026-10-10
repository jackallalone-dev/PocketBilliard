// The handle and the ball share an offset-preserving drag. The handle can sit
// away from the ball so a finger never needs to cover the intended placement.
export class BallPlacementControl {
  constructor(canvas, handle, { canEdit, model, pointFromScreen, pickBall, onChange }) {
    Object.assign(this, { canvas, handle, canEdit, model, pointFromScreen, pickBall, onChange });
    this.drag = null;
    for (const element of [canvas, handle]) {
      element.addEventListener('pointerdown', (event) => this.start(event, element));
      element.addEventListener('pointermove', (event) => this.move(event));
      element.addEventListener('pointerup', (event) => {
        if (this.drag?.pointerId !== event.pointerId) return;
        this.move(event);
        this.end(false);
      });
      element.addEventListener('pointercancel', (event) => { if (this.drag?.pointerId === event.pointerId) this.cancel(); });
      element.addEventListener('lostpointercapture', () => { if (this.drag) this.cancel(); });
      element.addEventListener('contextmenu', (event) => { if (this.canEdit()) event.preventDefault(); });
    }
  }

  get active() { return this.drag !== null; }

  start(event, element) {
    if (event.isPrimary === false || event.button !== 0 || this.active || !this.canEdit()) return;
    const point = this.pointFromScreen(event.clientX, event.clientY);
    if (!point) return;
    let id = element === this.handle ? this.model.selectedId : this.pickBall(event.clientX, event.clientY);
    if (id === null && this.model.selected.pocketed) id = this.model.selectedId;
    if (id === null) return;
    event.preventDefault();
    this.model.selectedId = id;
    const ball = this.model.selected;
    const original = { ...ball };
    if (ball.pocketed && !this.model.move(id, point.x, point.z)) return;
    this.drag = {
      pointerId: event.pointerId, id, element, original,
      point, position: { x: ball.x, z: ball.z }, screenX: event.clientX, screenY: event.clientY,
    };
    element.focus({ preventScroll: true });
    element.setPointerCapture(event.pointerId);
    this.onChange(false);
  }

  move(event) {
    if (!this.drag || this.drag.pointerId !== event.pointerId) return;
    if (!this.canEdit()) { this.cancel();return; }
    event.preventDefault();
    if (!this.drag.moved && Math.hypot(event.clientX - this.drag.screenX, event.clientY - this.drag.screenY) < 3) return;
    this.drag.moved = true;
    const point = this.pointFromScreen(event.clientX, event.clientY);
    if (!point) return;
    const x = this.drag.position.x + point.x - this.drag.point.x;
    const z = this.drag.position.z + point.z - this.drag.point.z;
    const placed = this.model.move(this.drag.id, x, z);
    this.onChange(!placed || Math.hypot(placed.x - x, placed.z - z) > 0.015);
  }

  end(restore) {
    if (!this.drag) return;
    const { element, pointerId, id, original } = this.drag;
    this.drag = null;
    if (restore) Object.assign(this.model.balls.find((ball) => ball.id === id), original);
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
    this.onChange(false);
  }

  cancel() { this.end(true); }
}
