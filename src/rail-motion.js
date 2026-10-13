import { Vector3 } from 'three';
import { TABLE } from './table-geometry.js';
import { tableContacts } from './rail-geometry.js';
import { advanceBall, advanceFlight, initializeMotion, integrateOrientation, cushionImpulse, GRAVITY } from './ball-motion.js';

const GRAVITY_VECTOR = new Vector3(0, -GRAVITY, 0);
const CONTACT_TOLERANCE = 0.00002;
const velocity = (b) => new Vector3(b.vx, b.vy, b.vz);
const rotation = (b) => new Vector3(b.wx, b.wy, b.wz);
const setVelocity = (b, v, w) => { b.vx = v.x;b.vy = v.y;b.vz = v.z;b.wx = w.x;b.wy = w.y;b.wz = w.z; };

function contactImpulse(ball, normal, kind) {
  const v = velocity(ball), w = rotation(ball), incoming = v.dot(normal);
  if (incoming >= 0) return 0;
  // Rubber rebounds more than the wood cap. Very small normal impacts settle
  // so a supported ball can roll instead of bouncing forever under gravity.
  const restitution = kind === 'rubber' ? 0.78 : kind === 'wood' ? 0.35 : 0.5;
  const bounce = -incoming * restitution;
  const outgoing = bounce ** 2 / (2 * GRAVITY) > TABLE.radius * 0.001 ? bounce : 0;
  const impulse = outgoing - incoming;
  v.addScaledVector(normal, impulse);
  const arm = normal.clone().multiplyScalar(-TABLE.radius);
  const slip = v.clone().add(w.clone().cross(arm));
  slip.addScaledVector(normal, -slip.dot(normal));
  const length = slip.length();
  if (length > 1e-10) {
    const friction = kind === 'wood' ? 0.2 : 0.18;
    const tangent = slip.multiplyScalar(-Math.min(friction * impulse, length / 3.5) / length);
    v.add(tangent);w.add(arm.cross(tangent).multiplyScalar(2.5 / TABLE.radius ** 2));
  }
  setVelocity(ball, v, w);
  return -incoming;
}

function advanceSupported(ball, dt, contact) {
  const { normal, point, face } = contact;
  // A horizontal plane can use the exact sliding/rolling solver at its real
  // height. This includes the wood cap, not just the cloth at y=0.
  if (normal.y > 1 - 1e-9) {
    const height = point.y;
    ball.y = 0;ball.vy = 0;
    advanceBall(ball, dt);
    ball.y += height;
    return;
  }
  const v = velocity(ball), w = rotation(ball);
  v.addScaledVector(normal, -v.dot(normal));
  const before = v.clone();
  const tangentGravity = GRAVITY_VECTOR.clone().addScaledVector(normal, GRAVITY * normal.y);
  v.addScaledVector(tangentGravity, dt);
  const arm = normal.clone().multiplyScalar(-TABLE.radius);
  const slip = v.clone().add(w.clone().cross(arm));
  slip.addScaledVector(normal, -slip.dot(normal));
  const length = slip.length(), friction = face.kind === 'wood' ? 0.2 : 8 / GRAVITY;
  const impulse = Math.min(length / 3.5, friction * GRAVITY * normal.y * dt);
  if (length > 1e-10) {
    const tangent = slip.multiplyScalar(-impulse / length);
    v.add(tangent);w.add(arm.cross(tangent).multiplyScalar(2.5 / TABLE.radius ** 2));
  }
  // Once rolling, static friction gives the familiar 5g sin(theta)/7 downhill
  // acceleration of a solid sphere. Rolling resistance opposes that travel.
  if (length - impulse * 3.5 < 1e-7) {
    const speed = v.length();
    v.multiplyScalar(speed > 0 ? Math.max(0, 1 - (0.45 + speed * 0.1) * dt / speed) : 0);
    const axial = w.dot(normal);
    w.copy(normal).cross(v).divideScalar(TABLE.radius).addScaledVector(normal, axial);
  }
  const axial = w.dot(normal);
  const nextSpin = Math.max(0, Math.abs(axial) + (Math.abs(axial) + 2.2 / 0.8) * Math.expm1(-0.8 * dt));
  w.addScaledVector(normal, Math.sign(axial) * nextSpin - axial);
  ball.x += (before.x + v.x) * dt / 2;
  ball.y += (before.y + v.y) * dt / 2;
  ball.z += (before.z + v.z) * dt / 2;
  setVelocity(ball, v, w);integrateOrientation(ball, dt);
}

// Only balls near the physical rails need triangle contacts. The cloth solver
// remains exact in the interior, including flight/landing and massé trajectories.
export function advanceTableBall(ball, dt, onRail) {
  initializeMotion(ball);
  const r = TABLE.radius;
  const reach = r * 1.5 + Math.hypot(ball.vx, ball.vz) * dt;
  if (Math.abs(ball.x) < TABLE.width / 2 - reach && Math.abs(ball.z) < TABLE.length / 2 - reach) {
    advanceBall(ball, dt);return;
  }
  const contacts = tableContacts(ball, CONTACT_TOLERANCE);
  const v = velocity(ball);
  const support = contacts.find((c) => c.normal.y > 0.5 && Math.abs(v.dot(c.normal)) < 0.05);
  if (support) advanceSupported(ball, dt, support);
  else advanceFlight(ball, dt);

  const emitted = new Set();
  for (let pass = 0; pass < 4; pass++) {
    const contact = tableContacts(ball).find((c) => c.depth > 1e-9 || velocity(ball).dot(c.normal) < -0.001);
    if (!contact) break;
    const { normal, depth, face } = contact;
    if (depth > 0) {
      ball.x += normal.x * (depth + 1e-7);ball.y += normal.y * (depth + 1e-7);ball.z += normal.z * (depth + 1e-7);
    }
    let speed;
    // A cloth-supported ball hits the nose with the slate opposing its downward
    // impulse. Use the constrained horizontal response rather than letting the
    // rubber push it underneath the bed or manufacture a jump on every bank.
    if (face.kind === 'rubber' && normal.y < 0 && ball.y < 0.001 && ball.vy <= 0.05) {
      const length = Math.hypot(normal.x, normal.z), nx = normal.x / length, nz = normal.z / length;
      const incoming = ball.vx * nx + ball.vz * nz;
      if (incoming < 0) cushionImpulse(ball, nx, nz, incoming);
      ball.y = 0;ball.vy = 0;speed = Math.max(0, -incoming);
    } else speed = contactImpulse(ball, normal, face.kind);
    if (face.rail !== null && speed > 1e-8 && !emitted.has(face.rail)) {
      emitted.add(face.rail);onRail(face.rail, speed);
    }
  }
}

export function restingOnRail(ball) {
  if ((ball.y || 0) < TABLE.cushionNoseHeight * 0.8 || Math.hypot(ball.vx, ball.vy || 0, ball.vz) > 0.01 ||
    Math.hypot(ball.wx || 0, ball.wy || 0, ball.wz || 0) * TABLE.radius > 0.01) return false;
  return tableContacts(ball, CONTACT_TOLERANCE).some((c) => c.face.kind !== 'cloth' && c.normal.y > 0.999);
}
