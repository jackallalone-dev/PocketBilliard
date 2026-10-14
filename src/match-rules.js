import { TABLE, POCKETS } from './table-geometry.js';
import { tableContacts } from './rail-geometry.js';
import { clampElevation } from './spin.js';

export const RULES_SOURCE = 'https://upatour.com/8-ball-rules/';
export const groupOf = (id) => id > 0 && id < 8 ? 'solids' : id > 8 && id <= 15 ? 'stripes' : null;
export const POCKET_NAMES = ['P1 · foot-left', 'P2 · foot-right', 'P3 · side-left', 'P4 · side-right', 'P5 · head-left', 'P6 · head-right'];

export class ShotTracker {
  constructor(balls, call = {}, angle = 0, elevation = 0) {
    this.start = balls.map(({ id, x, z, pocketed }) => ({ id, x, z, pocketed }));
    this.call = { ...call };
    this.firstContacts = new Set();this.firstStep = null;
    this.pockets = [];this.numberedRails = new Set();this.railAfterContact = false;this.pocketAfterContact = false;this.offTable = [];
    this.frozen = new Set();
    for (const ball of balls.filter((b) => !b.pocketed)) {
      for (const contact of tableContacts(ball, 0.002)) {
        if (contact.face.rail !== null) this.frozen.add(`${ball.id}:${contact.face.rail}`);
      }
    }
    const cue = balls[0], dx = Math.sin(angle), dz = -Math.cos(angle);
    const horizontal = Math.cos(clampElevation(elevation) * Math.PI / 180);
    this.closeHit = balls.some((b) => {
      if (b.id === 0 || b.pocketed) return false;
      const distance = Math.hypot(b.x - cue.x, b.z - cue.z);
      return distance <= TABLE.radius * 2 + TABLE.width / 100 && distance > 0 && horizontal * ((b.x - cue.x) * dx + (b.z - cue.z) * dz) / distance > Math.SQRT1_2 + 1e-7;
    });
  }

  sample(balls) {
    for (const key of this.frozen) {
      const [id, index] = key.split(':').map(Number);
      const ball = balls.find((b) => b.id === id);
      if (ball.pocketed || !tableContacts(ball, 0.004).some((contact) => contact.face.rail === index)) this.frozen.delete(key);
    }
  }

  record(event) {
    if (event.type === 'contact' && (event.a === 0 || event.b === 0)) {
      if (this.firstStep === null) this.firstStep = event.step;
      if (event.step === this.firstStep) this.firstContacts.add(event.a === 0 ? event.b : event.a);
    } else if (event.type === 'rail' && !this.frozen.has(`${event.id}:${event.rail}`)) {
      if (event.id > 0) this.numberedRails.add(event.id);
      if (this.firstContacts.size) this.railAfterContact = true;
    } else if (event.type === 'pocket') {
      const pocket = event.pocketIndex ?? POCKETS.findIndex((p) => Math.hypot(p.x - event.pocket.x, p.z - event.pocket.z) < 1e-6);
      this.pockets.push({ id: event.id, pocket });
      if (this.firstContacts.size) this.pocketAfterContact = true;
    } else if (event.type === 'offTable') this.offTable.push(event.id);
  }

  report() {
    return { start: this.start, call: this.call, firstContacts: [...this.firstContacts], pockets: this.pockets, numberedRails: [...this.numberedRails], railAfterContact: this.railAfterContact, pocketAfterContact: this.pocketAfterContact, offTable: this.offTable, closeHit: this.closeHit };
  }
}

// UPA amateur 8-ball. Event reports come from the shot's chronological physics
// events, not just the final list of balls that happened to fall.
export class EightBallGame {
  constructor({ callPocket = true } = {}) { this.callPocket = callPocket;this.reset(); }
  reset(breaker = 0) {
    this.breaker = breaker === 1 ? 1 : 0;
    this.currentPlayer = this.breaker;
    this.groups = [null, null];this.pocketed = new Set();
    this.shotNumber = 1;this.winner = null;this.isBreak = true;
    this.ballInHand = 'kitchen';this.placementConfirmed = false;
    this.pendingBreak = null;this.consecutiveFouls = [0, 0];
  }

  remaining(player) {
    const group = this.groups[player];
    return group ? Array.from({ length: 7 }, (_, i) => i + (group === 'solids' ? 1 : 9)).filter((id) => !this.pocketed.has(id)) : [];
  }

  targets() {
    if (!this.groups[this.currentPlayer]) return Array.from({ length: 15 }, (_, i) => i + 1).filter((id) => id !== 8 && !this.pocketed.has(id));
    const remaining = this.remaining(this.currentPlayer);
    return remaining.length ? remaining : [8];
  }

  callTargets() { return this.targets(); }

  validCall(call) {
    return this.callTargets().includes(call?.ball) && Number.isInteger(call?.pocket) && call.pocket >= 0 && call.pocket < 6;
  }

  callReady(call) { return !this.callPocket || this.isBreak || !!call?.safety || this.validCall(call); }

  confirmPlacement(cue) {
    if (!this.ballInHand || cue.pocketed || (this.ballInHand === 'kitchen' && cue.z <= TABLE.headSpot)) return false;
    this.placementConfirmed = true;
    return true;
  }

  get stalemateEligible() { return this.consecutiveFouls.every((count) => count >= 3); }

  chooseBreak(player) {
    if (!this.pendingBreak || ![this.pendingBreak.offender, this.pendingBreak.chooser].includes(player)) return false;
    this.reset(player);return true;
  }

  concede() {
    if (this.winner !== null) return null;
    this.winner = 1 - this.currentPlayer;
    return { winner: this.winner, reason: 'conceded' };
  }

  resolveShot(report) {
    if (this.winner !== null || this.pendingBreak) return null;
    const shooter = this.currentPlayer, other = 1 - shooter;
    const pockets = report.pockets || [], ids = pockets.map((p) => p.id);
    const offTable = report.offTable || [];
    const scratch = ids.includes(0) || offTable.includes(0);
    const black = ids.includes(8) || offTable.includes(8);
    const cueStart = report.start?.find((ball) => ball.id === 0);
    const first = report.firstContacts || [];
    const legalTargets = this.targets();
    const onEight = !!this.groups[shooter] && this.remaining(shooter).length === 0;
    let foul = scratch ? 'scratch' : offTable.length ? 'ball-off-table' : null;
    if (offTable.includes(8)) {
      this.pocketed.add(8);this.winner = other;
      return { winner: other, scratch, foul, reason: 'eight-off-table' };
    }

    if (this.isBreak) {
      const legalBreak = ids.some((id) => id > 0 && !offTable.includes(id)) || new Set(report.numberedRails || []).size >= 4;
      if (!legalBreak) {
        this.currentPlayer = other;
        this.pendingBreak = { offender: shooter, chooser: other };
        this.ballInHand = null;this.placementConfirmed = false;
        return { illegalBreak: true, player: other, scratch, reason: 'illegal-break' };
      }
      if (!cueStart || cueStart.z <= TABLE.headSpot) foul ||= 'head-string';
      if (report.closeHit) foul ||= 'close-double-hit';
      for (const id of [...ids, ...offTable]) if (id > 0) this.pocketed.add(id);
      this.isBreak = false;
      if (black) {
        this.winner = foul ? other : shooter;
        return { winner: this.winner, scratch, reason: foul ? 'eight-on-foul' : 'eight-on-break', foul };
      }
      const keepTurn = !foul && ids.some((id) => id > 0);
      this.currentPlayer = keepTurn ? shooter : other;
      this.ballInHand = foul ? 'kitchen' : null;
      this.placementConfirmed = false;this.shotNumber++;
      this.consecutiveFouls[shooter] = foul ? 1 : 0;
      return { player: this.currentPlayer, keepTurn, scratch, foul, ballInHand: this.ballInHand, openTable: true };
    }

    if (!first.length) foul ||= 'no-contact';
    else if (!first.some((id) => legalTargets.includes(id))) foul ||= 'wrong-first-ball';
    if (this.ballInHand === 'kitchen') {
      if (!cueStart || cueStart.z <= TABLE.headSpot) foul ||= 'head-string';
      if (!first.some((id) => legalTargets.includes(id) && report.start?.some((ball) => ball.id === id && ball.z < TABLE.headSpot))) foul ||= 'kitchen-contact';
    }
    if (!report.railAfterContact && !report.pocketAfterContact) foul ||= 'no-rail';
    if (report.closeHit) foul ||= 'close-double-hit';
    const call = report.call || {};
    const legalCall = this.validCall(call);
    const madeCall = !call.safety && legalCall && pockets.some((p) => p.id === call.ball && p.pocket === call.pocket);
    const creditedBall = this.callPocket ? (madeCall ? call.ball : null) : (pockets.find((p) => legalTargets.includes(p.id) && !offTable.includes(p.id))?.id ?? null);
    for (const id of [...ids, ...offTable]) if (id > 0) this.pocketed.add(id);
    if (black) {
      const won = !foul && !offTable.includes(8) && onEight && (!this.callPocket || madeCall && call.ball === 8);
      this.winner = won ? shooter : other;
      return { winner: this.winner, scratch, foul, reason: won ? 'cleared' : foul ? 'eight-on-foul' : onEight ? 'wrong-eight-pocket' : 'early-eight' };
    }
    if (!foul && creditedBall !== null && !this.groups[shooter]) {
      this.groups[shooter] = groupOf(creditedBall);
      this.groups[other] = groupOf(creditedBall) === 'solids' ? 'stripes' : 'solids';
    }
    const keepTurn = !foul && creditedBall !== null;
    this.currentPlayer = keepTurn ? shooter : other;
    this.ballInHand = foul ? 'table' : null;
    this.placementConfirmed = false;this.shotNumber++;
    this.consecutiveFouls[shooter] = foul ? this.consecutiveFouls[shooter] + 1 : 0;
    return { player: this.currentPlayer, keepTurn, scratch, foul, safety: this.callPocket && !!call.safety, madeCall, ballInHand: this.ballInHand };
  }
}
