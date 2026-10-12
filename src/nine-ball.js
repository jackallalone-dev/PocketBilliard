import { EightBallGame } from './match-rules.js';
import { TABLE } from './table-geometry.js';
import { REST_MOTION } from './ball-motion.js';

export const NINE_BALL_RULES_SOURCE = 'https://upatour.com/9-ball-rules/';

export class NineBallGame extends EightBallGame {
  reset(breaker = 0) {
    super.reset(breaker);
    this.pushAvailable = false;
    this.pendingPush = null;
    this.warned = [false, false];
  }

  remaining() { return Array.from({ length: 9 }, (_, i) => i + 1).filter((id) => !this.pocketed.has(id)); }
  get lowestBall() { return this.remaining()[0] ?? null; }
  targets() { return this.lowestBall === null ? [] : [this.lowestBall]; }
  get stalemateEligible() { return false; }
  callReady(call) { return !this.pendingBreak && !this.pendingPush && (!call?.push || this.pushAvailable); }

  acknowledgeWarning(player) {
    if (![0, 1].includes(player) || this.winner !== null || this.consecutiveFouls[player] < 2) return false;
    this.warned[player] = true;return true;
  }

  choosePush(takeShot) {
    if (!this.pendingPush || typeof takeShot !== 'boolean') return false;
    this.currentPlayer = takeShot ? this.pendingPush.chooser : this.pendingPush.pusher;
    this.pendingPush = null;
    return true;
  }

  resolveShot(report) {
    if (this.winner !== null || this.pendingBreak || this.pendingPush) return null;
    const shooter = this.currentPlayer, other = 1 - shooter;
    const pockets = report.pockets || [], ids = pockets.map((ball) => ball.id);
    const offTable = report.offTable || [];
    const lowest = this.lowestBall;
    const scratch = ids.includes(0) || offTable.includes(0);
    const nineDown = ids.includes(9) || offTable.includes(9);
    const wasBreak = this.isBreak;
    const push = !wasBreak && !!report.call?.push && this.pushAvailable;
    let foul = scratch ? 'scratch' : offTable.length ? 'ball-off-table' : null;
    const numberedPocketed = ids.some((id) => id >= 1 && id <= 9 && !offTable.includes(id));

    if (wasBreak) {
      const legalBreak = numberedPocketed || new Set(report.numberedRails || []).size >= 3;
      if (!legalBreak) {
        this.currentPlayer = other;
        this.pendingBreak = { offender: shooter, chooser: other };
        this.ballInHand = null;this.placementConfirmed = false;this.pushAvailable = false;
        return { illegalBreak: true, player: other, scratch, reason: 'illegal-break' };
      }
      const cue = report.start?.find((ball) => ball.id === 0);
      if (!cue || cue.z <= TABLE.headSpot) foul ||= 'head-string';
    }
    if (!push) {
      if (!report.firstContacts?.length) foul ||= 'no-contact';
      else if (!report.firstContacts.includes(lowest)) foul ||= 'wrong-first-ball';
      if (!wasBreak && !report.railAfterContact && !report.pocketAfterContact) foul ||= 'no-rail';
    }
    if (report.call?.push && !push) foul ||= 'illegal-push';
    if (report.closeHit) foul ||= 'close-double-hit';

    for (const id of [...ids, ...offTable]) if (id >= 1 && id <= 9) this.pocketed.add(id);
    const spotNine = nineDown && (!!foul || push);
    if (spotNine) this.pocketed.delete(9);
    this.isBreak = false;
    // UPA §5 permits a push only on the shot immediately after the break.
    this.pushAvailable = wasBreak;
    this.ballInHand = null;this.placementConfirmed = false;this.shotNumber++;

    if (foul) {
      this.currentPlayer = other;this.ballInHand = 'table';
      this.consecutiveFouls[shooter]++;
      if (this.consecutiveFouls[shooter] >= 3 && this.warned[shooter]) {
        this.winner = other;
        return { winner: other, reason: 'three-fouls', foul, scratch, spotNine };
      }
      // Without the warning, a third foul is not a loss. The next warning
      // starts another last-chance shot, as described in UPA §8.2.
      return { player: other, keepTurn: false, foul, scratch, spotNine, ballInHand: 'table', warningPlayer: this.consecutiveFouls[shooter] >= 2 ? shooter : null };
    }

    this.consecutiveFouls[shooter] = 0;this.warned[shooter] = false;
    if (push) {
      this.pendingPush = { pusher: shooter, chooser: other };
      this.currentPlayer = other;
      return { player: other, pushOut: true, spotNine, keepTurn: false, foul: null, scratch: false };
    }
    if (nineDown) {
      this.winner = shooter;
      return { winner: shooter, reason: wasBreak ? 'nine-on-break' : 'nine-pocketed', foul: null, scratch: false };
    }
    const keepTurn = numberedPocketed;
    this.currentPlayer = keepTurn ? shooter : other;
    return { player: this.currentPlayer, keepTurn, foul: null, scratch: false, spotNine: false };
  }
}

// Spot on the foot spot, or the nearest clear position along its long string.
// Search toward the foot rail first, then toward the head if that side is full.
export function spotNineBall(balls) {
  const nine = balls.find((ball) => ball.id === 9);
  if (!nine) return null;
  const clearance = TABLE.radius * 2 + 0.008;
  const limit = TABLE.length / 2 - TABLE.radius - 0.008;
  const free = (z) => balls.every((ball) => ball.id === 9 || ball.pocketed || Math.hypot(ball.x, ball.z - z) >= clearance);
  let z = null;
  if (free(TABLE.footSpot)) z = TABLE.footSpot;
  for (const direction of [-1, 1]) {
    if (z !== null) break;
    for (let distance = 0.01; distance < TABLE.length; distance += 0.01) {
      const candidate = TABLE.footSpot + direction * distance;
      if (Math.abs(candidate) > limit) break;
      if (free(candidate)) { z = candidate;break; }
    }
  }
  if (z === null) throw new Error('No clear position on the foot string to spot the 9-ball.');
  Object.assign(nine, REST_MOTION, { x: 0, z, pocketed: false });
  return nine;
}
