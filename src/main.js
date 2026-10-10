import './style.css';
import './layout.css';
import './playground.css';
import { PoolPhysics, EightBallGame, BALL_COLORS } from './physics.js';
import { TableView } from './table.js';
import { GameAudio } from './audio.js';
import { ShotControl } from './shot-control.js';
import { loadPowerSide, savePowerSide } from './settings.js';
import { AimWheel, TableAimControl, normalizeAngle } from './aim-controls.js';
import { controlDockLayout } from './control-layout.js';
import { PocketHistory } from './pocket-history.js';
import { Playground } from './playground.js';
import { BallPlacementControl } from './ball-placement.js';

const $ = (id) => document.getElementById(id);
const game = new EightBallGame();
const audio = new GameAudio();
const pocketHistory = new PocketHistory();
const playground = new Playground();
const container = $('canvas-container');
const aimingLabel = container.getAttribute('aria-label');
const sessions = {};
let mode = 'match';
let menuOpen = true;
let hasStarted = false;
let shotPower = 0;
let view;
let angle = 0;
let inShot = false;
let shotBalls = [];
let settleTime = 0;
let toastTimer;
let aimDirty = true;
let contextLost = false;
let tableAiming;
let aimWheel;
let ballPlacement;
let placementOffset = { x: 50, y: -58 };

const physics = new PoolPhysics((event) => {
  audio.play(event.type, event.speed || 1);
  if (event.type === 'pocket') {
    shotBalls.push(event.id);
    view.pocket(event.id, event.pocket);
    if (pocketHistory.record(event.id)) {
      renderPocketHistory();
      $('pocket-announcement').textContent = `Ball ${event.id} pocketed. ${pocketHistory.ids.length} balls down.`;
    } else if (event.id === 0) $('pocket-announcement').textContent = 'Cue ball pocketed. Scratch.';
    if (navigator.vibrate) navigator.vibrate(12);
  }
});

function canInteract() { return !!view && !menuOpen && !contextLost && !document.hidden && !document.querySelector('dialog[open]'); }
function canEdit() { return canInteract() && mode === 'playground' && playground.editing && !inShot; }
function canTakeShot() {
  return canInteract() && !inShot && !physics.cue.pocketed && (mode === 'playground' ? !playground.editing : game.winner === null);
}

const shotControl = new ShotControl($('shot-power'), {
  canShoot: () => canTakeShot() && !tableAiming?.active && !aimWheel?.active && !ballPlacement?.active,
  onChange: (power) => { shotPower = power;aimDirty = true; },
  onShoot: (power) => takeShot(power),
  onStart: () => audio.unlock(),
});

function setAimAngle(value) {
  angle = normalizeAngle(value);
  aimDirty = true;
  aimWheel?.render(angle);
}

tableAiming = new TableAimControl(container, {
  canAim: () => canTakeShot() && !shotControl.charging && !aimWheel?.active,
  getCue: () => physics.cue,
  getAngle: () => angle,
  setAngle: setAimAngle,
  pointFromScreen: (x, y) => view.pointFromScreen(x, y),
  hitCue: (x, y) => {
    view.updateAim(physics.balls, angle, shotPower, true);
    return view.hitCue(x, y, physics.cue);
  },
});
aimWheel = new AimWheel($('aim-wheel'), {
  canAim: () => canTakeShot() && !shotControl.charging && !tableAiming.active,
  getAngle: () => angle,
  setAngle: setAimAngle,
});

ballPlacement = new BallPlacementControl(container, $('ball-drag-handle'), {
  canEdit, model: playground,
  pointFromScreen: (x, y) => view.pointFromScreen(x, y),
  pickBall: (x, y) => {
    let nearest = null, distance = Infinity;
    for (const ball of physics.balls) {
      if (ball.pocketed) continue;
      const screen = view.ballToScreen(ball);
      const d = Math.hypot(x - screen.x, y - screen.y);
      if (d < Math.max(18, screen.radius + 8) && d < distance) { nearest = ball.id;distance = d; }
    }
    return nearest;
  },
  onChange: (constrained) => {
    aimDirty = true;
    $('turn-toast').classList.remove('visible');
    $('ball-placement-layer').classList.toggle('constrained', constrained);
    updatePlacementOverlay();
    updatePlaygroundUI();
  },
});

function cancelGestures() {
  shotControl.cancel();
  tableAiming.cancel();
  aimWheel.cancel();
  ballPlacement?.cancel();
}

function layoutControlDock(frame) {
  const area = $('table-area').getBoundingClientRect();
  const canvas = container.getBoundingClientRect();
  const side = document.querySelector('.game').dataset.powerSide;
  const dock = $('control-dock');
  const layout = controlDockLayout(frame, canvas, area, side, dock.offsetWidth);
  dock.style.setProperty('--dock-left', `${layout.left}px`);
  dock.style.setProperty('--dock-top', `${layout.top}px`);
  dock.style.setProperty('--dock-height', `${layout.height}px`);
  const tray = $('pocketed-panel');
  const trayLayout = controlDockLayout(frame, canvas, area, side === 'left' ? 'right' : 'left', tray.offsetWidth);
  tray.style.setProperty('--tray-left', `${trayLayout.left}px`);
  tray.style.setProperty('--tray-top', `${trayLayout.top}px`);
  tray.style.setProperty('--tray-height', `${trayLayout.height}px`);
  updatePlacementOverlay();
}

function updatePlacementOverlay() {
  const layer = $('ball-placement-layer');
  const selected = playground.selected;
  layer.hidden = !canEdit() || selected.pocketed;
  if (layer.hidden) return;
  const area = $('table-area').getBoundingClientRect();
  const canvas = container.getBoundingClientRect();
  const ball = view.ballToScreen(selected);
  const preferred = { x: ball.x > canvas.left + canvas.width / 2 ? -50 : 50, y: ball.y < canvas.top + 90 ? 58 : -58 };
  if (ballPlacement?.drag && !ballPlacement.drag.handleOffset) {
    ballPlacement.drag.handleOffset = ballPlacement.drag.element === $('ball-drag-handle') ? { ...placementOffset } : preferred;
  }
  const offset = ballPlacement?.drag?.handleOffset || preferred;
  const hx = Math.max(canvas.left + 24, Math.min(canvas.right - 24, ball.x + offset.x));
  const hy = Math.max(canvas.top + 24, Math.min(canvas.bottom - 24, ball.y + offset.y));
  placementOffset = { x: hx - ball.x, y: hy - ball.y };
  const ring = $('ball-placement-ring');
  ring.style.left = `${ball.x - area.left}px`;ring.style.top = `${ball.y - area.top}px`;
  ring.style.width = ring.style.height = `${Math.max(28, ball.radius * 2 + 12)}px`;
  const line = $('ball-placement-line');
  line.style.left = `${ball.x - area.left}px`;line.style.top = `${ball.y - area.top}px`;
  line.style.width = `${Math.hypot(hx - ball.x, hy - ball.y)}px`;
  line.style.transform = `rotate(${Math.atan2(hy - ball.y, hx - ball.x)}rad)`;
  const handle = $('ball-drag-handle');
  handle.style.left = `${hx - area.left}px`;handle.style.top = `${hy - area.top}px`;
  handle.setAttribute('aria-label', `Move ${selected.id === 0 ? 'cue ball' : `ball ${selected.id}`}. Drag or use arrow keys; Shift makes smaller adjustments.`);
  $('ball-handle-label').textContent = selected.id === 0 ? 'C' : selected.id;
}

function updatePlaygroundUI() {
  const active = mode === 'playground';
  document.querySelector('.game').dataset.mode = mode;
  document.querySelector('.game').dataset.editing = String(active && playground.editing);
  $('pg-arrange').setAttribute('aria-pressed', String(playground.editing));
  $('pg-shoot').setAttribute('aria-pressed', String(!playground.editing));
  $('pg-arrange').disabled = $('pg-shoot').disabled = !canInteract() || inShot;
  $('pg-balls').disabled = $('pg-clear').disabled = !canEdit();
  $('pg-remove').disabled = !canEdit() || playground.selectedId === 0 || playground.selected.pocketed;
  $('pg-retry').disabled = !active || !canInteract();
  $('playground-attempt').textContent = `TRY ${String(playground.attempts + (inShot ? 0 : 1)).padStart(2, '0')}`;
  $('restart-button').title = active ? 'Restore trick-shot setup' : 'Start a new game';
  container.setAttribute('aria-label', active && playground.editing ? 'Arrange balls. Drag a ball or its move handle. Use the Balls palette to select a ball to add, then tap the cloth. Arrow keys nudge the selected ball.' : aimingLabel);
}

function clearPocketHistory() {
  pocketHistory.reset();renderPocketHistory();$('pocket-announcement').textContent = '';
}

function openMainMenu() {
  cancelGestures();
  menuOpen = true;
  $('app').hidden = true;
  $('main-menu').hidden = false;
  $('menu-continue').hidden = !hasStarted;
  $('menu-continue').firstChild.textContent = mode === 'playground' ? 'Continue playground ' : 'Continue your game ';
  updateUI();
  (hasStarted ? $('menu-continue') : $('menu-match')).focus({ preventScroll: true });
}

function enterMode(nextMode) {
  if (!view || contextLost) return;
  cancelGestures();
  if (nextMode !== mode) {
    sessions[mode] = { balls: physics.balls, inShot, shotBalls: [...shotBalls], settleTime, angle, history: [...pocketHistory.ids] };
    const session = sessions[nextMode] || { balls: playground.balls, inShot: false, shotBalls: [], settleTime: 0, angle: 0, history: [] };
    mode = nextMode;
    physics.balls = session.balls;
    inShot = session.inShot;shotBalls = [...session.shotBalls];settleTime = session.settleTime;
    setAimAngle(session.angle);
    pocketHistory.ids = [...session.history];renderPocketHistory();
    view.resetBalls(physics.balls);
  }
  menuOpen = false;hasStarted = true;
  $('main-menu').hidden = true;$('app').hidden = false;
  updateUI();
  view.resize();aimDirty = true;
  container.focus({ preventScroll: true });
}

function setPlaygroundPhase(editing) {
  if (mode !== 'playground' || !canInteract() || inShot || playground.editing === editing) return;
  cancelGestures();
  if (editing) playground.editing = true;
  else if (!playground.commit(angle)) return;
  clearPocketHistory();aimDirty = true;updateUI();
  toast(editing ? 'Arrange your shot. Drag a ball or its handle.' : 'Setup saved. Aim, pull, and release.');
}

function restorePlayground() {
  if (mode !== 'playground' || !canInteract()) return;
  cancelGestures();
  setAimAngle(playground.restore());
  inShot = false;shotBalls = [];settleTime = 0;
  clearPocketHistory();view.resetBalls(physics.balls);updateUI();
  toast('Setup restored. Give it another try.');
}

function applyPowerSide(side) {
  cancelGestures();
  document.querySelector('.game').dataset.powerSide = side;
  for (const input of document.querySelectorAll('input[name="power-side"]')) input.checked = input.value === side;
  view?.resize();
}
applyPowerSide(loadPowerSide());
for (const input of document.querySelectorAll('input[name="power-side"]')) {
  input.addEventListener('change', () => { if (input.checked) applyPowerSide(savePowerSide(input.value)); });
}

function openDialog(id) {
  cancelGestures();
  $(id).showModal();
  updateUI();
}

function renderPocketHistory() {
  const list = $('pocketed-balls');
  list.replaceChildren();
  for (const id of pocketHistory.ids) {
    const ball = document.createElement('li');
    ball.className = `tray-ball assigned${id > 8 ? ' stripe' : ''}`;
    ball.style.setProperty('--ball-color', BALL_COLORS[id]);
    ball.setAttribute('aria-label', `Ball ${id}`);
    ball.title = `Ball ${id}`;
    const number = document.createElement('span');
    number.textContent = id;
    ball.appendChild(number);
    list.appendChild(ball);
  }
  $('pocketed-empty').hidden = pocketHistory.ids.length > 0;
  list.scrollTop = list.scrollHeight;
}
renderPocketHistory();

function toast(message, duration = 2500) {
  clearTimeout(toastTimer);
  $('turn-toast').textContent = message;
  $('turn-toast').classList.add('visible');
  toastTimer = setTimeout(() => $('turn-toast').classList.remove('visible'), duration);
}

function updateUI(message) {
  for (let player = 0; player < 2; player++) {
    const card = $(`player-${player}`);
    card.classList.toggle('active', game.currentPlayer === player && game.winner === null);
    card.querySelector('.turn-dot').setAttribute('aria-label', game.currentPlayer === player ? 'Current turn' : 'Waiting');
    const group = game.groups[player];
    const remaining = game.remaining(player);
    $(`group-${player}`).textContent = group ? remaining.length ? `${group.toUpperCase()} · ${remaining.length} LEFT` : 'ON THE 8-BALL' : 'OPEN TABLE';
    const tray = $(`tray-${player}`);
    tray.replaceChildren();
    for (let i = 0; i < 7; i++) {
      const id = i + (group === 'stripes' ? 9 : 1);
      const ball = document.createElement('span');
      ball.className = `tray-ball${group ? ' assigned' : ''}${group === 'stripes' ? ' stripe' : ''}${group && game.pocketed.has(id) ? ' pocketed' : ''}`;
      ball.style.setProperty('--ball-color', BALL_COLORS[id]);
      if (group) {
        const number = document.createElement('span');number.textContent = id;ball.appendChild(number);
        ball.title = `Ball ${id}: ${game.pocketed.has(id) ? 'pocketed' : 'on the table'}`;
      }
      tray.appendChild(ball);
    }
    tray.setAttribute('aria-label', group ? `${remaining.length} ${group} remaining` : 'Groups not assigned yet');
  }
  const disabled = !canTakeShot();
  shotControl.setDisabled(disabled, inShot ? 'ROLLING' : mode === 'playground' && playground.editing ? 'EDIT' : mode === 'match' && game.winner !== null ? 'OVER' : 'WAIT');
  aimWheel.setDisabled(disabled);
  if (disabled) tableAiming.cancel();
  if (!canEdit()) ballPlacement.cancel();
  $('shot-count').textContent = mode === 'playground' ? `TRY ${String(playground.attempts + 1).padStart(2, '0')}` : `SHOT ${String(game.shotNumber).padStart(2, '0')}`;
  const status = $('turn-status');
  status.replaceChildren();
  const strong = document.createElement('strong');
  if (mode === 'playground') {
    strong.textContent = 'Playground';
    status.append(strong, document.createTextNode(inShot ? ' · Shot in motion.' : playground.editing ? ' · Drag a ball or its handle to arrange.' : ' · Aim and shoot. Retry to restore your setup.'));
  } else {
    strong.textContent = `Player ${(game.winner ?? game.currentPlayer) + 1}`;
    status.append(strong, document.createTextNode(message || (game.winner !== null ? ' wins. What a game.' : inShot ? ' is at the table.' : game.shotNumber === 1 ? ', break the ice.' : ', the table is yours.')));
  }
  $('table-hint').textContent = inShot ? 'Let the good times roll' : mode === 'playground' && playground.editing ? 'Drag a ball or its move handle' : 'Tap the table or drag to aim';
  updatePlaygroundUI();updatePlacementOverlay();
}

function finishShot() {
  inShot = false;
  if (mode === 'playground') {
    if (physics.cue.pocketed) physics.placeCue();
    aimDirty = true;updateUI();
    toast(shotBalls.includes(0) ? 'Cue ball returned. Retry setup or keep shooting.' : 'Try another shot, or restore your setup.');
    return;
  }
  const result = game.resolveShot(shotBalls);
  if (result.scratch && result.winner === undefined) physics.placeCue();
  if (result.winner !== undefined) {
    $('winner-title').textContent = `Player ${result.winner + 1} wins.`;
    $('winner-detail').textContent = result.reason === 'cleared' ? 'Seven down, then the 8. A beautifully finished game.' : result.reason === 'scratch-on-eight' ? 'The cue ball followed the 8 into a pocket. That’s the game — and a perfect excuse for a rematch.' : 'The 8-ball went down a little too soon. There’s always the next round.';
    openDialog('winner-dialog');
  } else {
    const name = `Player ${game.currentPlayer + 1}`;
    toast(result.scratch ? `Scratch · ${name}, your turn` : result.keepTurn ? `Nicely done. ${name} shoots again` : `Pass it over · ${name}’s turn`);
    if (!result.keepTurn && navigator.vibrate) navigator.vibrate([20, 35, 20]);
  }
  aimDirty = true;
  updateUI(result.scratch && result.winner === undefined ? ', your turn. Cue ball returned.' : undefined);
}

function takeShot(power = shotPower) {
  if (!canTakeShot() || shotControl.charging || tableAiming.active || aimWheel.active || ballPlacement.active || power <= 0) return;
  audio.unlock();
  if (!physics.shoot(angle, power)) return;
  if (mode === 'playground') playground.attempts++;
  shotControl.cancel();
  audio.play('shoot', 3);
  shotBalls = [];inShot = true;settleTime = 0;
  $('turn-toast').classList.remove('visible');
  aimDirty = true;
  updateUI();
}

function resetGame() {
  if (mode === 'playground') { restorePlayground();return; }
  cancelGestures();
  for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
  physics.reset();game.reset();view.resetBalls(physics.balls);
  setAimAngle(0);inShot = false;shotBalls = [];settleTime = 0;aimDirty = true;
  pocketHistory.reset();renderPocketHistory();$('pocket-announcement').textContent = '';
  updateUI();toast('Fresh rack. Player 1, you’re up.');
}

function openBallPalette() {
  if (!canEdit()) return;
  cancelGestures();
  const palette = $('ball-palette');
  palette.replaceChildren();
  for (const ball of playground.balls) {
    const option = document.createElement('button');
    option.className = `ball-option${ball.pocketed ? '' : ' on-table'}`;
    option.setAttribute('aria-pressed', String(playground.selectedId === ball.id));
    option.setAttribute('aria-label', `${ball.id === 0 ? 'Cue ball' : `Ball ${ball.id}`}, ${ball.pocketed ? 'add to table' : 'on table'}`);
    const icon = document.createElement('span');
    icon.className = `tray-ball assigned${ball.id > 8 ? ' stripe' : ''}`;
    icon.style.setProperty('--ball-color', BALL_COLORS[ball.id]);
    const label = document.createElement('span');label.textContent = ball.id === 0 ? 'C' : ball.id;icon.appendChild(label);
    const caption = document.createElement('small');caption.textContent = ball.pocketed ? 'ADD' : 'ON TABLE';
    option.append(icon, caption);
    option.addEventListener('click', () => {
      playground.selectedId = ball.id;
      $('balls-dialog').close();updateUI();aimDirty = true;
      toast(ball.pocketed ? `Tap the cloth to place ball ${ball.id}.` : 'Drag the selected ball or its move handle.');
    });
    palette.appendChild(option);
  }
  openDialog('balls-dialog');
}

function removeSelectedBall() {
  if (!canEdit()) return;
  cancelGestures();
  if (playground.removeSelected()) { aimDirty = true;updateUI(); }
}

for (const element of [container, $('ball-drag-handle')]) element.addEventListener('keydown', (event) => {
  if (!canEdit() || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Delete', 'Backspace', 'Escape'].includes(event.key)) return;
  event.preventDefault();event.stopPropagation();
  if (event.key === 'Escape') { ballPlacement.cancel();return; }
  if (event.key === 'Delete' || event.key === 'Backspace') { removeSelectedBall();return; }
  if (ballPlacement.active || playground.selected.pocketed) return;
  const screen = view.ballToScreen(playground.selected);
  const step = event.shiftKey ? 0.5 : 2;
  const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
  const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
  const point = view.pointFromScreen(screen.x + dx, screen.y + dy);
  if (point) playground.move(playground.selectedId, point.x, point.z);
  aimDirty = true;updatePlacementOverlay();
});

window.addEventListener('keydown', (event) => {
  if (document.querySelector('dialog[open]') || document.activeElement === $('pocketed-balls') || ['INPUT', 'BUTTON', 'A'].includes(document.activeElement?.tagName)) return;
  if (event.code === 'Escape') { cancelGestures();return; }
  if (!canTakeShot() || shotControl.charging || tableAiming.active || aimWheel.active) return;
  if (event.code === 'Space') {
    event.preventDefault();
    if (!event.repeat) {
      if (shotPower > 0) takeShot();
      else toast('Pull the side control, or use ↑ / ↓ for power.');
    }
  }
  if (['ArrowUp', 'ArrowDown'].includes(event.code)) {
    event.preventDefault();shotControl.setPower(shotPower + (event.code === 'ArrowUp' ? 0.05 : -0.05));
  }
  if (['ArrowLeft', 'ArrowRight'].includes(event.code)) {
    event.preventDefault();setAimAngle(angle + (event.code === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 0.002 : 0.012));
  }
});
window.addEventListener('blur', cancelGestures);
window.addEventListener('resize', cancelGestures);
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelGestures(); });
$('help-button').addEventListener('click', () => openDialog('help-dialog'));
$('settings-button').addEventListener('click', () => openDialog('settings-dialog'));
$('restart-button').addEventListener('click', () => mode === 'playground' ? restorePlayground() : openDialog('restart-dialog'));
$('menu-button').addEventListener('click', openMainMenu);
$('menu-continue').addEventListener('click', () => enterMode(mode));
$('menu-match').addEventListener('click', () => enterMode('match'));
$('menu-playground').addEventListener('click', () => enterMode('playground'));
$('menu-settings').addEventListener('click', () => openDialog('settings-dialog'));
$('menu-help').addEventListener('click', () => openDialog('help-dialog'));
$('pg-arrange').addEventListener('click', () => setPlaygroundPhase(true));
$('pg-shoot').addEventListener('click', () => setPlaygroundPhase(false));
$('pg-balls').addEventListener('click', openBallPalette);
$('pg-remove').addEventListener('click', removeSelectedBall);
$('pg-retry').addEventListener('click', restorePlayground);
$('pg-clear').addEventListener('click', () => {
  if (!canEdit()) return;
  cancelGestures();playground.clear();clearPocketHistory();aimDirty = true;updateUI();
  toast('Clear table. Choose balls to build your shot.');
});
$('confirm-restart').addEventListener('click', resetGame);
$('play-again').addEventListener('click', resetGame);
for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => $(button.dataset.close).close());
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('close', () => updateUI());
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});

function updateSoundButton() {
  $('sound-button').innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4Z"/>${audio.enabled ? '<path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>' : '<path d="m16 9 5 6m0-6-5 6"/>'}</svg>`;
  $('sound-button').setAttribute('aria-label', audio.enabled ? 'Mute sound' : 'Enable sound');
  $('sound-button').setAttribute('title', audio.enabled ? 'Mute sound' : 'Enable sound');
  $('sound-button').setAttribute('aria-pressed', String(audio.enabled));
}
$('sound-button').addEventListener('click', () => { audio.enabled = !audio.enabled;audio.unlock();updateSoundButton();if (audio.enabled) audio.play('collision'); });
updateSoundButton();

try {
  view = new TableView(container, { onLayout: layoutControlDock });
  view.resetBalls(physics.balls);
  $('loading-state').hidden = true;
  updateUI();
  let previous = performance.now(), accumulator = 0;
  const fixedStep = 1 / 240;
  const frame = (now) => {
    requestAnimationFrame(frame);
    const dt = Math.min((now - previous) / 1000, 0.05);
    previous = now;
    if (document.hidden || contextLost || menuOpen) return;
    // Dialogs pause the current shot as well as the controls.
    if (inShot && !document.querySelector('dialog[open]')) {
      accumulator += dt;
      while (accumulator >= fixedStep) {
        physics.step(fixedStep);accumulator -= fixedStep;
      }
      if (!physics.moving) {
        settleTime += dt;
        if (settleTime > 0.45) finishShot();
      } else settleTime = 0;
    } else accumulator = 0;
    const ballsChanged = view.sync(physics.balls, dt);
    const shouldRender = ballsChanged || aimDirty || view.needsRender;
    if (aimDirty) { view.updateAim(physics.balls, angle, shotPower, !inShot && !physics.cue.pocketed && (mode === 'playground' ? !playground.editing : game.winner === null));aimDirty = false; }
    if (shouldRender) view.render();
  };
  requestAnimationFrame(frame);
  view.renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();contextLost = true;updateUI();
    $('loading-state').hidden = false;
    $('loading-state').querySelector('p').textContent = 'Restoring the table…';
  });
  view.renderer.domElement.addEventListener('webglcontextrestored', () => {
    contextLost = false;aimDirty = true;$('loading-state').hidden = true;updateUI();
  });
} catch (error) {
  console.error('Unable to initialize the table:', error);
  $('loading-state').querySelector('p').textContent = 'This table needs WebGL. Try a current version of Safari, Chrome, or Firefox with hardware acceleration enabled.';
  shotControl.setDisabled(true);
  aimWheel.setDisabled(true);
  $('restart-button').disabled = true;
  $('menu-match').disabled = $('menu-playground').disabled = true;
  $('menu-status').textContent = 'The table needs WebGL. Open this page in a current browser with hardware acceleration enabled.';
}
