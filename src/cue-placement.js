import { TABLE } from './table-geometry.js';
import { REST_MOTION } from './ball-motion.js';
import { freeBallPosition, legalBallPosition } from './playground.js';

export class CuePlacement {
  constructor(physics, game) { this.physics = physics;this.game = game;this.selectedId = 0; }
  get balls() { return this.physics.balls; }
  get selected() { return this.physics.cue; }
  get minimumZ() { return this.game.ballInHand === 'kitchen' ? TABLE.headSpot + 0.015 : -Infinity; }
  move(id, x, z) {
    if (id !== 0 || !this.game.ballInHand || this.game.placementConfirmed) return null;
    const point = freeBallPosition(this.balls, 0, x, z, this.minimumZ);
    if (point) Object.assign(this.selected, point, REST_MOTION, { pocketed: false });
    return point;
  }
  prepare() {
    const cue = this.selected;
    const x = cue.pocketed ? 0 : cue.x;
    const z = cue.pocketed ? TABLE.headSpot + 0.015 : cue.z;
    return this.move(0, x, z);
  }
  confirm() {
    const cue = this.selected;
    return legalBallPosition(this.balls, 0, cue.x, cue.z) && this.game.confirmPlacement(cue);
  }
}
