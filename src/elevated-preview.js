import { PoolPhysics } from './physics.js';
import { tableContacts } from './rail-geometry.js';

// Reuse the real solver through flight AND sliding/rolling. First landings
// are marked separately; a hop must not hide the curve that follows it.
export function elevatedPreview(balls, angle, power, spin, elevation) {
  let collision = null;
  const physics = Object.create(PoolPhysics.prototype);
  physics.balls = balls.map((ball) => ({ ...ball }));physics.stepNumber = 0;
  physics.onEvent = (event) => {
    if (collision) return;
    if (event.type === 'contact' && (event.a === 0 || event.b === 0)) collision = { type: 'ball', id: event.a === 0 ? event.b : event.a };
    if (['pocket', 'offTable'].includes(event.type) && event.id === 0) collision = { type: event.type, point: event.type === 'offTable' ? { x: event.x, y: event.y, z: event.z } : null };
  };
  physics.shoot(angle, power || 0.65, spin, elevation);
  const point = () => collision?.point || ({ x: physics.cue.x, y: physics.cue.y || 0, z: physics.cue.z });
  const points = [point()];
  let landing = null, distance = 0, complete = false;
  for (let step = 0; step < 1200; step++) {
    const before = point(), beforeVy = physics.cue.vy;
    const flying = physics.cue.y > 0 || physics.cue.vy > 0;
    physics.step(1 / 240);
    // A bounce can already be back above the cloth at the end of this step.
    const landed = flying && (physics.cue.y === 0 || (beforeVy < 0 && physics.cue.vy >= 0));
    if (!landing && landed && !collision) {
      const support = tableContacts(physics.cue, 0.08).find((c) => c.normal.y > 0.5);
      landing = support ? { x: support.point.x, y: support.point.y, z: support.point.z } : { ...point(), y: 0 };
    }
    distance += Math.hypot(physics.cue.x - before.x, physics.cue.z - before.z);
    complete = !!collision || !physics.moving;
    if (step % 3 === 0 || complete || distance >= 8 || step === 1199) points.push(point());
    if (complete || distance >= 8) break;
  }
  return { points, landing, complete, target: collision?.type === 'ball' ? balls.find((ball) => ball.id === collision.id) : null };
}
