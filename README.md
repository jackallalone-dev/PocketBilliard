# Pocket Club

A mobile-first, 3D local multiplayer billiards game built with **Three.js** and **Vite**. Two people share one browser and pass the device between turns. No accounts or server-side game service required.

## Run locally

Requires Node.js 20.19+ or a current Node.js LTS release.

```sh
cd /root/b-g
npm install
npm run dev
```

Open **http://localhost:5173**. To play on a phone, connect it to the same Wi-Fi as the computer and open the **Network** URL printed by Vite (for example, `http://192.168.1.10:5173`). The development server listens on all network interfaces.

### Debian in Termux

Run the commands above inside your Debian session and leave the server running. On that same Android phone, open `http://localhost:5173` in Chrome or Firefox. No desktop environment is needed. If Node.js is not installed, install a compatible version inside Debian first; the project requires Node.js 20.19+.

## Play

The app opens on a **main menu**. Choose **Two-player 8-ball** or **Playground**. Tap the Pocket Club logo to return to the menu; the table pauses, and **Continue** resumes it. Both modes keep their own table state while the page remains open, including a shot paused in motion. Reloading the page starts a fresh session.

- **Touch to aim:** tap a point on the cloth or drag across it to set the shot direction. The white dotted line predicts the cue ball’s initial path; the gold line previews the first object ball’s direction.
- **Drag the cue:** grab the visible stick and move it around the cue ball to rotate your aim. Touching the rear of the stick preserves the current angle instead of flipping the shot.
- **Fine-aim wheel:** drag the small wheel below the power control up/down for precise adjustments. Mouse scrolling and arrow keys also work on the wheel; Shift + arrow gives an even smaller step.
- **Shoot:** pull down on the vertical power control beside the table, then release to shoot. A longer pull gives more power. Tapping alone does not shoot.
- **Cancel a shot:** return your finger to the starting height or move it sideways before releasing. Switching apps, opening a dialog, or rotating the screen cancels an unfinished pull too.
- **Left/right controls:** open **Settings** in the header and choose the control side. The power control and aiming wheel dock directly beside the table’s outer rail on that side, in portrait or landscape. The selection is saved on this device when browser storage is available.
- **Pocketed-ball list:** a slim vertical tray sits beside the table, opposite the shooting and fine-aim controls. It mirrors automatically when you change control sides and shows numbered balls in pocketing order as they drop. Scroll the tray on shorter screens to see every ball. Cue-ball scratches are announced separately. A new game clears the tray.
- **Turns:** pocket your own ball to shoot again. Otherwise, pass the device to the other player when the balls stop.
- **Groups:** the first colored ball pocketed on a scratch-free shot assigns solids or stripes.
- **Win:** clear your group, then pocket the 8-ball. Pocketing the 8 early, or scratching on the same shot as the 8, awards the game to the other player.
- **Scratch:** pocketing the cue ball ends your turn. It automatically returns to a clear spot near the starting area.
- **House rules:** simplified 8-ball, with no called pockets, first-contact fouls, or special break exemptions. Opponent balls stay pocketed. If your final group ball and the 8 fall on the same shot, your group ball must fall first.
- **Desktop:** drag and release with a mouse, or use left/right arrows to aim, Shift + arrow for finer adjustments, up/down arrows for power, and Space to shoot while the table has focus. When the power control has focus, its arrow keys adjust power and Enter/Space fires; Escape cancels.
- Tap the sound icon for optional synthesized shot sounds. Tap **?** for the rules, or the restart arrow to re-rack.

## Playground / trick shots

1. Choose **Playground** from the main menu. It starts with a cue ball and two object balls.
2. In **Arrange**, drag a ball directly or drag its gold **move handle**. The handle sits away from the ball so your finger does not cover the placement. Balls stay inside the cushions and cannot overlap.
3. Use **＋ Balls** to select any numbered ball. Tap empty cloth to add a selected off-table ball; selecting an existing ball reveals its handle. **Remove** deletes the selected object ball, and **Clear** leaves only the cue ball.
4. Switch to **Shoot** to save the arrangement and practice using the normal aiming and power controls. Playground has no turns or early-8-ball penalties; a scratched cue ball returns to the table.
5. **Retry setup** restores all balls and the saved aiming direction, even during a shot. Switch back to Arrange to change the setup. Setup storage lasts for the current page session.

On desktop, focus the table or move handle and use arrow keys to nudge the selected ball. Hold Shift for smaller nudges. Escape, opening a dialog/menu, or a cancelled touch reverts an unfinished drag.

## Build and test

```sh
npm test
npm run build
npm run preview
```

Deploy the generated `dist/` directory to any static web host. The game uses WebGL and works in current mobile Safari, Chrome, and Firefox. Portrait is the primary layout, with a compact landscape layout as well. Fonts use Google Fonts when available and fall back to system fonts.

## Structure

- `src/main.js` — input, UI, game loop, and turn flow
- `src/table.js` — Three.js table, ball materials, aiming guides, and rendering
- `src/table-geometry.js` — shared tapered cushion shapes, pocket openings, and aiming boundaries
- `src/physics.js` — fixed-step ball physics and simplified 8-ball rules
- `src/audio.js` — optional Web Audio effects
- `src/shot-control.js` — drag-to-charge/release-to-shoot gestures and keyboard controls
- `src/aim-controls.js` — touch aiming, cue dragging, and the fine-aim wheel
- `src/control-layout.js` — table-relative left/right control docking
- `src/pocket-history.js` — ordered pocketed-ball tracking
- `src/playground.js` — custom setups, collision-safe placement, and retry snapshots
- `src/ball-placement.js` — direct ball dragging and offset move-handle gestures
- `src/playground.css` — main menu, playground toolbar, palette, and placement handles
- `src/settings.js` — saved left/right control preference
- `src/style.css` — responsive mobile/desktop layouts
- `src/layout.css` — compact, viewport-filling layout with a reversible side power control
- `tests/game.test.js` — physics and game-rule tests using Node’s built-in test runner

All visual assets are generated in code. Multiplayer is local pass-and-play on one device.
