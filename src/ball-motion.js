import { TABLE } from './table-geometry.js';

export const REST_MOTION = Object.freeze({ y: 0, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0 });
export const REST_ORIENTATION = Object.freeze({ qx: 0, qy: 0, qz: 0, qw: 1 });
export const GRAVITY = 66.4; // 9.81 m/s² at the table's world-unit scale.
const LANDING_RESTITUTION = 0.22;
const LANDING_FRICTION = 0.18;
const SLIDING_ACCELERATION = 8;

export function hasBallMotion(ball) {
  return !ball.pocketed && ((ball.y || 0) > 0 || Math.abs(ball.vy || 0) > 0 || Math.hypot(ball.vx, ball.vz) > 0 || Math.hypot(ball.wx || 0, ball.wz || 0) * TABLE.radius > 0.01 || Math.abs(ball.wy || 0) > 0.15);
}

export function advanceBall(ball, dt) {
  const r = TABLE.radius;
  ball.wx ??= 0;ball.wy ??= 0;ball.wz ??= 0;
  ball.qx ??= 0;ball.qy ??= 0;ball.qz ??= 0;ball.qw ??= 1;
  ball.y ??= 0;ball.vy ??= 0;
  const airborne = ball.y > 0 || ball.vy > 0;
  if (airborne) {
    const impactSpeed = Math.sqrt(ball.vy ** 2 + 2 * GRAVITY * ball.y);
    const landingTime = (ball.vy + impactSpeed) / GRAVITY;
    const flightTime = Math.min(dt, landingTime);
    // No cloth steering or spin decay in the air. Resolve the exact landing
    // time so a short hop does not hide an entire fixed step of cloth contact.
    ball.x += ball.vx * flightTime;ball.z += ball.vz * flightTime;
    ball.y = Math.max(0, ball.y + ball.vy * flightTime - GRAVITY * flightTime ** 2 / 2);
    ball.vy -= GRAVITY * flightTime;
    integrateOrientation(ball, flightTime);
    if (landingTime <= dt) {
      ball.y = 0;
      const bounce = impactSpeed * LANDING_RESTITUTION;
      ball.vy = bounce > 0.8 ? bounce : 0;
      // Landing friction acts on slip, including barrel roll. It exchanges
      // translation and spin, not an arbitrary percentage of forward speed.
      const slipX = ball.vx + r * ball.wz, slipZ = ball.vz - r * ball.wx;
      const slip = Math.hypot(slipX, slipZ);
      if (slip > 1e-9) {
        const impulse = Math.min(LANDING_FRICTION * (impactSpeed + ball.vy), slip / 3.5);
        const ix = -slipX / slip * impulse, iz = -slipZ / slip * impulse;
        ball.vx += ix;ball.vz += iz;
        ball.wx -= 2.5 * iz / r;ball.wz += 2.5 * ix / r;
      }
      if (dt - flightTime > 1e-10) advanceBall(ball, dt - flightTime);
    }
    return;
  } else {
    ball.y = ball.vy = 0;
    // Velocity of the point touching the cloth: v + omega × (0, -r, 0).
    const slipX = ball.vx + r * ball.wz;
    const slipZ = ball.vz - r * ball.wx;
    const slip = Math.hypot(slipX, slipZ);
    let rollingTime = dt;
    if (slip > 1e-7) {
      // I = 2/5 mr². Cloth friction changes translation and angular velocity;
      // together they remove surface slip at 3.5 times the linear acceleration.
      const impulse = Math.min(SLIDING_ACCELERATION * dt, slip / 3.5);
      const ax = -slipX / slip * impulse, az = -slipZ / slip * impulse;
      ball.vx += ax;ball.vz += az;
      ball.wx -= 2.5 * az / r;ball.wz += 2.5 * ax / r;
      rollingTime = Math.max(0, dt - impulse / SLIDING_ACCELERATION);
    }
    if (rollingTime > 1e-9) {
      const speed = Math.hypot(ball.vx, ball.vz);
      const next = Math.max(0, speed - (0.45 + speed * 0.1) * rollingTime);
      const scale = speed > 0 && next >= 0.045 ? next / speed : 0;
      ball.vx *= scale;ball.vz *= scale;
      ball.wx = ball.vz / r;ball.wz = -ball.vx / r;
    }
    // Vertical-axis spin decays independently; it is converted into sideways
    // motion at contacts, not by inventing a sideways force on free-running balls.
    const side = Math.max(0, Math.abs(ball.wy) - (2.2 + Math.abs(ball.wy) * 0.8) * dt);
    ball.wy = side < 0.15 ? 0 : Math.sign(ball.wy) * side;
    if (Math.hypot(ball.vx, ball.vz) < 0.045 && Math.hypot(ball.wx, ball.wz) * r < 0.045) {
      ball.vx = ball.vz = ball.wx = ball.wz = 0;
    }
  }
  ball.x += ball.vx * dt;ball.z += ball.vz * dt;
  integrateOrientation(ball, dt);
}

function integrateOrientation(ball, dt) {
  // Integrate orientation in physics time, so pausing a shot also pauses spin.
  const angularSpeed = Math.hypot(ball.wx, ball.wy, ball.wz);
  if (angularSpeed > 0) {
    const halfAngle = angularSpeed * dt / 2;
    const scale = Math.sin(halfAngle) / angularSpeed;
    const x = ball.wx * scale, y = ball.wy * scale, z = ball.wz * scale, w = Math.cos(halfAngle);
    const { qx, qy, qz, qw } = ball;
    ball.qx = w * qx + x * qw + y * qz - z * qy;
    ball.qy = w * qy - x * qz + y * qw + z * qx;
    ball.qz = w * qz + x * qy - y * qx + z * qw;
    ball.qw = w * qw - x * qx - y * qy - z * qz;
    const length = Math.hypot(ball.qx, ball.qy, ball.qz, ball.qw);
    ball.qx /= length;ball.qy /= length;ball.qz /= length;ball.qw /= length;
  }
}

export function cushionImpulse(ball, nx, nz, incoming) {
  const r = TABLE.radius;
  const normalImpulse = -1.78 * incoming;
  ball.vx += normalImpulse * nx;ball.vz += normalImpulse * nz;
  const tx = -nz, tz = nx;
  const surfaceSlip = ball.vx * tx + ball.vz * tz + r * (ball.wy || 0);
  const limit = normalImpulse * 0.18;
  const tangentImpulse = Math.max(-limit, Math.min(limit, -surfaceSlip / 3.5));
  ball.vx += tangentImpulse * tx;ball.vz += tangentImpulse * tz;
  ball.wy = (ball.wy || 0) + 2.5 * tangentImpulse / r;
}

export function ballContactFriction(a, b, nx, nz, normalImpulse) {
  const r = TABLE.radius, tx = -nz, tz = nx;
  const slip = (a.vx - b.vx) * tx + (a.vz - b.vz) * tz - r * ((a.wy || 0) + (b.wy || 0));
  const limit = normalImpulse * 0.035;
  const impulse = Math.max(-limit, Math.min(limit, -slip / 7));
  a.vx += impulse * tx;a.vz += impulse * tz;
  b.vx -= impulse * tx;b.vz -= impulse * tz;
  a.wy = (a.wy || 0) - 2.5 * impulse / r;
  b.wy = (b.wy || 0) - 2.5 * impulse / r;
}
