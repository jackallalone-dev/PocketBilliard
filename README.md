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

- **Touch to aim:** a tap on the cloth aims at that point when you release. A swipe rotates your existing aim without snapping toward your finger on touch-down or release. The white dotted line shows the initial path, the gold line previews the first target ball, and the cyan line estimates the white ball’s short post-contact path, including draw/follow. The contact circle marks the impact position. The trajectory lines render above balls.
- **Aiming aids:** Settings has independent switches for the initial guide, target-ball line, white-ball path, and contact circle. Choices are saved on this device when storage is available. The cue remains visible even with every aid off.
- **Drag the cue:** grab the visible stick and move it around the cue ball to rotate your aim. Touching the rear of the stick preserves the current angle instead of flipping the shot.
- **Fine-aim wheel:** drag the small wheel below the power control up/down for precise adjustments. Mouse scrolling and arrow keys also work on the wheel; Shift + arrow gives an even smaller step.
- **Shoot:** pull down on the vertical power control beside the table, then release to shoot. Halfway is **100%**; the full pull reaches **200%**, with an orange boosted-power indicator above 100%. Tapping alone does not shoot. Arrow keys still adjust in 5% steps; End on the control selects 200%.
- **Cue-ball spin:** tap **SPIN** above the power control. Swipe anywhere on the selector to move the dot **relative to its current position**; merely touching it does not move the dot. Swipe down for draw/backspin, up for follow/topspin, and sideways for sidespin. Multiple swipes accumulate; presets and Home can center it. The cue’s tip position and red-dot indicator show the contact point.
- **Cancel a shot:** return your finger to the starting height or move it sideways before releasing. Switching apps, opening a dialog, or rotating the screen cancels an unfinished pull too.
- **Left/right controls:** open **Settings** in the header and choose the control side. The power control and aiming wheel dock directly beside the table’s outer rail on that side, in portrait or landscape. The selection is saved on this device when browser storage is available.
- **Pocketed-ball list:** a slim vertical tray sits beside the table, opposite the shooting and fine-aim controls. It mirrors automatically when you change control sides and shows numbered balls in pocketing order as they drop. Scroll the tray on shorter screens to see every ball. Cue-ball scratches are announced separately. A new game clears the tray.
- **Break:** place the cue behind the head string with the move handle, confirm, and shoot. Pocket a numbered ball or drive four distinct object balls to rails. An illegal break re-racks with the opponent choosing who breaks. A legal 8-ball break wins under the selected UPA rules; pocketing it with a foul loses.
- **Call your shot:** after the break, choose one ball and pocket using **Call shot**, or declare **Safety**. P1–P6 labels match the pockets on the table. This app requests an explicit call even for obvious shots.
- **Turns and groups:** the table stays open after the break. The first legally pocketed called ball assigns solids/stripes. Legally making your called shot retains the turn; a miss or safety passes it. Extra pocketed balls stay down.
- **Win:** first clear your group, then legally pocket the 8 in its called pocket on a later shot. An early 8, wrong 8-ball pocket, or 8 on a foul loses. A scratch while attempting the 8 is only a foul if the 8 stays on the table.
- **Fouls / ball in hand:** scratches, wrong first contact, no object-ball contact, no rail/pocket after contact, illegal kitchen contact, close double-hit approaches, and off-table balls are enforced. The opponent can place the cue anywhere clear, except after a legal-break foul: placement is behind the head string and the first object hit must be outside the kitchen. Confirm placement before aiming.
- **Match rules:** UPA-based **amateur** 8-ball, not the pro-only three-foul variant. New racks default to alternating breakers; the New Game dialog permits an agreed opening breaker. Settings includes concession and a mutually agreed stalemate after three consecutive foul innings each. See [RULES.md](RULES.md) for the source and digital scope.
- **Desktop:** drag and release with a mouse, or use left/right arrows to aim, Shift + arrow for finer adjustments, up/down arrows for power, and Space to shoot while the table has focus. When the power control has focus, its arrow keys adjust power and Enter/Space fires; Escape cancels.
- Tap the sound icon for optional synthesized shot sounds. Tap **?** for the rules, or the restart arrow to re-rack.

## Playground / trick shots

1. Choose **Playground** from the main menu. It starts with a cue ball and two object balls.
2. In **Arrange**, drag a ball directly or drag its gold **move handle**. The handle sits away from the ball so your finger does not cover the placement. Balls stay inside the cushions and cannot overlap.
3. Use **＋ Balls** to select any numbered ball. Tap empty cloth to add a selected off-table ball; selecting an existing ball reveals its handle. **Remove** deletes the selected object ball, and **Clear** leaves only the cue ball.
4. Switch to **Shoot** to save the arrangement and practice using the normal aiming and power controls. Playground has no turns or early-8-ball penalties; a scratched cue ball returns to the table.
5. **Retry setup** restores all balls and the first attempt’s aiming direction and spin, even during a shot. Switch back to Arrange to change the setup. Setup storage lasts for the current page session.

On desktop, focus the table or move handle and use arrow keys to nudge the selected ball. Hold Shift for smaller nudges. Escape, opening a dialog/menu, or a cancelled touch reverts an unfinished drag.

## Practicing spin

- **Draw:** place the cue ball a few ball-widths from an object ball, choose the bottom of the spin selector, and use medium-to-high power. Remaining backspin grips the cloth after impact and pulls the cue ball back.
- **Follow:** choose a contact point above center to carry the cue ball forward after impact.
- **Sidespin:** left/right spin changes the outgoing angle at a cushion. Combine it with draw or follow by moving the contact point diagonally.
- Backspin wears off with travel and can become natural forward roll. A soft, long-distance shot may therefore follow instead of drawing. Center-ball shots also acquire natural roll from the cloth.
- Match shots reset the selected contact point to center after settling. Playground retains the selection; Retry restores the first attempt’s spin.
- The white guide previews initial contact. The cyan cue-ball path is only a short post-impact estimate: it stops at the next obstruction and does not simulate an entire multi-ball sequence. Ball rotation is simulated alongside sliding/rolling cloth friction, cushion friction, and small ball-contact friction. This is a flat-table approximation; cue elevation, massé/swerve, squirt, jump shots, and miscues are not modeled.

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
- `src/physics.js` — fixed-step ball physics, randomized legal racks, and rule-event emission
- `src/match-rules.js` — UPA-based amateur rules and chronological shot tracking
- `src/cue-placement.js` — match ball-in-hand placement and kitchen bounds
- `src/aim-preview.js` — short spin-aware cue-ball path estimates
- `src/ball-motion.js` — angular motion, cloth friction, and spin-aware collision impulses
- `src/spin.js`, `src/spin-control.js`, `src/spin.css` — contact-point mapping and touch/keyboard spin selection
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
