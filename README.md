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

## GitHub Pages

The site is published at **https://jackallalone-dev.github.io/PocketBilliard/**.

In repository **Settings → Pages**, set **Source** to **GitHub Actions**. The `Deploy to GitHub Pages` workflow installs dependencies, runs tests, builds with Vite, and deploys `dist/` on every push to `master`. It can also be started manually from the Actions tab.

Vite uses relative asset URLs so JavaScript and CSS load correctly under the repository subpath. Publish the built `dist/` output; the source `index.html` depends on Vite and cannot run directly on a static host.

### Install on a phone or tablet

The production build includes a web app manifest, 192/512-pixel install icons, an Apple touch icon, and an offline service worker scoped to the GitHub Pages repository path.

- **Android / Chrome:** open the Pages URL directly in Chrome, let it finish loading, then use **⋮ → Add to Home screen → Install**. It launches in its own app window rather than as a browser shortcut.
- **iPhone / iPad:** open the URL in Safari, then **Share → Add to Home Screen** (enable **Open as Web App** if shown).
- After the first successful online load and service-worker installation, the game can reopen offline. Online fonts may fall back to system fonts. Playground saves stay in the same browser storage; installing does not clear them.
- Updates download in the background and activate after existing game tabs/app windows close. Close all Pocket Club windows and reopen to use a newly deployed build.
- Install/offline support requires HTTPS or localhost and is enabled for production builds, not the Vite development server. To test locally, run `npm run build` then `npm run preview`.

Icons are committed assets; `python3 scripts/generate-icons.py` regenerates them with Pillow. The Vite build generates `sw.js` with the current hashed assets and a versioned cache, so another GitHub Pages project’s caches are not affected.

## Play

The app opens on a **main menu**. Choose **Two-player 8-ball**, **Two-player 9-ball**, **Call Pocket**, or **Playground**. **Call Pocket** opens a dialog to choose **8-ball** or **9-ball** with called-shot rules; the regular modes need no pocket calls. Tap the Pocket Club logo to return to the menu; the table pauses, and **Continue** resumes it. All four match variants and Playground keep independent tables and state while the page remains open, including shots paused in motion. Reloading the page starts a fresh session; Playground’s five saved setup slots remain available.

- **Touch to aim:** a tap on the cloth aims at that point when you release. A swipe rotates your existing aim without snapping toward your finger on touch-down or release. The solid white line shows the initial path, the gold line previews the object ball’s direction, and the dashed cyan line estimates the white ball’s short post-contact path, including draw/follow. The contact circle marks the impact position. Lines are drawn at a fixed screen thickness, so they stay visible on small phones, and render above balls.
- **Aiming aids:** Settings has independent switches for the initial guide, target-ball line, white-ball path, and contact circle. Choices are saved on this device when storage is available. The cue remains visible even with every aid off.
- **Drag the cue:** grab the visible stick and move it around the cue ball to rotate your aim. Touching the rear of the stick preserves the current angle instead of flipping the shot.
- **Adaptive table layout:** the game compares side controls with a compact bottom bar and uses whichever gives the table more room without changing its proportions. Narrow portrait phones and wider tablets often use bottom controls; tall portrait tablets keep side controls. On wide landscape phones, the action buttons move to the spare side space to free table height.
- **Minimal on-screen text:** the highlighted player card shows whose turn it is, short pop-ups report fouls and turn changes, and buttons use short labels (**✓ Ready**, **Move cue**, **Call shot**, **Safety**, **Push**). Full instructions remain available to screen readers. All pockets remain visible.
- **Fine-aim wheel:** drag up/down beside the table, or left/right on the bottom bar, for precise adjustments. Mouse scrolling and arrow keys also work on the wheel; Shift + arrow gives an even smaller step.
- **Shoot:** follow the power control’s arrow: pull **down** beside the table or **right** on the bottom bar, then release to shoot. Halfway is **100%**; the full pull reaches **200%**, with an orange boosted-power indicator above 100%. Tapping alone does not shoot. Arrow keys still adjust in 5% steps; End on the control selects 200%.
- **Cue-ball spin:** tap **SPIN** above the power control for a **face-on 3D close-up** of the white ball. Contact view looks straight down the cue axis, hiding the stick and surrounding objects so the contact point is easy to see. Swipe anywhere in the view to adjust spin **relative to its current position**; merely touching it does not move the dot. Swipe down for draw/backspin, up for follow/topspin, and sideways for sidespin. Multiple swipes accumulate; presets and Home can center it. The red marker shows the real surface contact, green marks the reachable area, and the dashed gold line marks the ball’s equator. Raising the cue rotates that area upward—even full draw hits above the equator at steep angles. **ANGLE** opens in **Side** view with the stick visible; **Clearance** gives a wider side view of nearby balls. An amber ball and ghost cue show a blocked lower angle when automatic clearance raises the actual stick. The inline angle slider lets you watch the contact change while setting spin. Each time you open SPIN or ANGLE, its camera returns to the appropriate default.
- **Vertical cue angle / jumps:** the separate **ANGLE** button opens a manual elevation slider. Raise the cue butt from the calculated minimum clearance up to **90° (vertical)**. Nearby balls determine the minimum from their height, position, and distance from the shaft. **Auto clearance** uses the lowest clear angle; when the shaft is clear, that is **0°**. Angle, tip contact, and power determine the motion. At 90°, a centered strike hops in place; an off-center strike gives spin that table friction can turn into lateral travel. See the jump-shot practice below.
- **Cancel a shot:** return your finger to the starting point or move perpendicular to the pull direction before releasing. Switching apps, opening a dialog, or rotating the screen cancels an unfinished pull too.
- **Target ball:** like 8 Ball Pool, the ball you must hit first gets a pulsing white ring for a few seconds at the start of each turn whenever there is exactly one (the lowest ball in 9-ball, or the 8 once your group is cleared). The 9-ball HUD keeps showing that ball, ringed, beside the action buttons. If you aim at a ball you may not hit first — the wrong group, the 8 too early, a non-lowest ball in 9-ball, or a ball in the kitchen after a break foul — the contact circle turns into a red “no” sign and the gold/cyan lines are hidden.
- **Game menu:** the **☰** button in the header holds **New game** (or **Restore setup** in Playground), **Sound** on/off, **Settings**, **How to play**, and **Main menu**. Tap outside the menu or press Escape to close it; that tap never aims or shoots.
- **Landscape by default:** on phones and tablets the game turns to landscape when a game starts. Installed apps lock to landscape; in a browser tab it enters fullscreen to lock rotation, and where rotation can’t be locked (such as iOS Safari) a reminder asks you to turn the device. Choose **Settings → Screen orientation → Auto-rotate** to follow the device instead; portrait layouts still work.
- **Left/right controls:** open **Settings** from the ☰ menu and choose the control side. Side controls follow the selected outer rail; bottom controls mirror their order. The selection is saved on this device when browser storage is available.
- **Pocketed-ball list:** a slim tray sits opposite side controls, or horizontally above the bottom controls. It shows removed numbered balls in order, including balls driven off the table. Scroll the tray to see every ball. Cue-ball scratches and out-of-bounds balls are announced separately. A new game clears the tray.
- **Desktop:** drag and release with a mouse, or use left/right arrows to aim, Shift + arrow for finer adjustments, up/down arrows for power, and Space to shoot while the table has focus. When the power control has focus, its arrow keys adjust power and Enter/Space fires; Escape cancels.
- Open the ☰ menu to turn on optional synthesized shot sounds, read the rules, or re-rack.

### Two-player 8-ball

- **Break:** place the cue behind the head string with the move handle, confirm, and shoot. Pocket a numbered ball or drive four distinct object balls to rails. An illegal break re-racks with the opponent choosing who breaks. A legal 8-ball break wins under the selected UPA rules; pocketing it with a foul loses.
- **No pocket calls:** aim and shoot after confirming any required cue placement. For called shots, choose **Call Pocket → 8-ball** instead.
- **Turns and groups:** the table stays open after the break. The first legally pocketed solid or stripe assigns the group (pocket-event order decides if both fall). A legal pocket of your group retains the turn; a miss or an opponent-only pocket passes it. Extra pocketed balls stay down.
- **Win:** first clear your group, then legally pocket the 8 in any pocket on a later shot. An early 8 or 8 on a foul loses. A scratch while attempting the 8 is only a foul if the 8 stays on the table.
- **Fouls / ball in hand:** scratches, wrong first contact, no object-ball contact, no rail/pocket after contact, illegal kitchen contact, close double-hit approaches, and off-table balls are enforced. The opponent can place the cue anywhere clear, except after a legal-break foul: placement is behind the head string and the first object hit must be outside the kitchen. Confirm placement before aiming.
- **Match rules:** a **no-call house variant** of UPA-based amateur 8-ball, not the pro-only three-foul variant. New racks default to alternating breakers; the New Game dialog permits an agreed opening breaker. Settings includes concession and a mutually agreed stalemate after three consecutive foul innings each. See [RULES.md](RULES.md) for the source and digital scope.

### Two-player 9-ball

- **Rack and break:** a nine-ball diamond with 1 on the foot spot, 9 in the center, and 2 at the rear. Place the cue behind the head string, confirm, and hit 1 first. Pocket a numbered ball or send at least **three distinct object balls** to rails. An illegal break re-racks with the opponent choosing the breaker.
- **Lowest ball first:** the lowest remaining number is the target ball, ringed on the table and shown in the HUD. Hit that ball first; any legally pocketed numbered ball keeps your turn. A dry legal shot passes the turn. There are no called pockets or declared safeties in this mode.
- **Win:** legally pocket the 9, including on the break or in a combination after hitting the lowest ball first. You do not have to clear 1–8 first.
- **Push-out:** on the shot immediately after a legal break, optionally tap **Push** before shooting. First-contact and rail requirements are waived, but scratches and other fouls still count. After a legal push, the opponent chooses to take the position or pass it back. Normal rules resume afterward.
- **Fouls and spotting:** fouls give the opponent ball in hand **anywhere**, including after a legal-break foul. A 9 pocketed on a foul or push-out, or driven off the table, is re-spotted; other removed balls stay down. A re-spotted 9 is removed from the pocketed-ball tray.
- **Three consecutive fouls:** each player's HUD shows their foul count. After a second foul, a dialog asks the opponent to warn the player and select **Warning given**. A subsequent foul before an intervening legal shot loses the game only if that warning was acknowledged. A legal shot clears the shooter's streak and warning.
- **Match rules:** based on [UPA 9-ball](https://upatour.com/9-ball-rules/), with alternating breakers and concession through Settings. See [RULES.md](RULES.md) for details and digital conventions.

### Call Pocket → 8-ball or 9-ball

- Select **Call Pocket** on the menu, then choose **8-ball** or **9-ball** in the dialog. Each has its own match, separate from regular 8-ball and 9-ball. Returning to a choice resumes its table; use New Game for a fresh rack.
- After the break, use **Call shot** to select one ball and a pocket (**P1–P6**), or declare **Safety**. Only a legally made call retains the turn. A missed call alone is not a foul; normal first-contact and rail/pocket rules still apply. Safety ends the turn even when balls fall.
- **8-ball:** groups are assigned by the first legally made called shot. Clear your group, then call and pocket the 8 on a later shot. An early 8, a wrong-pocket 8, or an 8 on a foul loses. This preserves the original UPA-based explicit-call rules.
- **9-ball:** a **house variant** requiring a called ball and pocket. Hit the lowest remaining ball first, but call any remaining ball for combinations. A legal called 9 wins; an uncalled or wrong-pocket 9 is re-spotted. If another called ball is legally made while the 9 falls incidentally, re-spot the 9 and keep the turn. Other pocketed balls stay down. Push-outs and the warned three-foul rule still apply.
- **Exceptions:** no call is required on either break or a declared 9-ball push-out. A legal 8 or 9 on the break still wins under the existing break rules.

## Playground / trick shots

1. Choose **Playground** from the main menu. It starts with a cue ball and two object balls.
2. In **Arrange**, drag a ball directly or drag its gold **move handle**. The handle sits away from the ball so your finger does not cover the placement. Balls stay inside the cushions and cannot overlap.
3. Use **＋ Balls** to select any numbered ball. Tap empty cloth to add a selected off-table ball; selecting an existing ball reveals its handle. **Remove** deletes the selected object ball, and **Clear** leaves only the cue ball.
4. Switch to **Shoot** to set the retry arrangement and practice using the normal aiming and power controls. Playground has no turns or early-8-ball penalties; a scratched cue ball returns to the table.
5. **Retry setup** restores all balls and the first attempt’s aiming direction, spin, and manual cue elevation, even during an airborne shot. Switch back to Arrange to change the setup.
6. **Save setup** opens **five named slots** from either Arrange or Shoot. Save into an empty slot, **Replace** an existing slot, **Load**, or **Delete**. Saves include ball positions, aim, spin, and manual elevation, and persist in this browser across reloads. Loading stays in your current phase and resets Retry to the loaded setup. After an attempt, saving keeps the original retry setup; switch to Arrange if you want to save the resulting table instead. If browser storage is unavailable, the panel reports that saves are session-only.

On desktop, focus the table or move handle and use arrow keys to nudge the selected ball. Hold Shift for smaller nudges. Escape, opening a dialog/menu, or a cancelled touch reverts an unfinished drag.

## Practicing spin

- **Draw:** place the cue ball a few ball-widths from an object ball, choose the bottom of the spin selector, and use medium-to-high power. Remaining backspin grips the cloth after impact and pulls the cue ball back.
- **Follow:** choose a contact point above center to carry the cue ball forward after impact.
- **Sidespin:** left/right spin changes the outgoing angle at a cushion. Combine it with draw or follow by moving the contact point diagonally.
- Backspin wears off with travel and can become natural forward roll. A soft, long-distance shot may therefore follow instead of drawing. Center-ball shots also acquire natural roll from the cloth.
- Match shots reset spin to center and manual elevation to Auto clearance after settling. Playground retains the selections; Retry restores the first attempt’s spin and elevation.
- **Swerve / massé:** combine cue elevation with left/right tip offset. The tilted spin creates sideways slip at the cloth, so friction bends the path. Softer strokes produce smaller hops and begin bending over shorter distances; a firm elevated shot can hop before bending. A ball in free flight does not curve from cloth friction. The violet guide follows the same physics as the live shot.
- The white guide previews initial contact. The cyan cue-ball path is only a short post-impact estimate for level shots: it stops at the next obstruction and does not simulate an entire multi-ball sequence. Ball rotation is simulated alongside sliding/rolling cloth friction, cushion friction, and small ball-contact friction. Squirt and miscues are not modeled.

## Practicing jump shots

1. In Playground, put an object ball in front of the cue ball, with a gap of roughly **two ball diameters**, and another target farther along the same aiming line.
2. Switch to **Shoot**, aim past the blocking ball, and open **SPIN** to choose center-ball contact. Close that panel and open **ANGLE**, then manually raise the **Vertical cue angle** slider—for example, start near **60°** and adjust from there. There is no single required jump angle.
3. Close the dialog, pull to around **100%** power, and release. A high-enough jump passes over the blocker; a lower flight can clip it. Use **Retry setup** to compare different angles and powers.
4. For a ball obstructing the **cue stick behind the white**, Auto clearance raises the butt just enough to clear its geometry. A closer blocker usually requires more elevation. This shaft-clearance angle is separate from the angle needed to jump over a ball ahead.

The elevated cue visibly tilts, and the side-view diagram shows its angle. An **amber jump guide** or **violet swerve/massé guide** follows flight, cloth travel, and rail rebounds until object-ball contact, removal, rest, or the preview limit. A separate ring marks the first landing at the height of the cloth or rail. The prediction uses the selected power, or 65% while idle. These replace the level-shot prediction for an elevated stroke; the cyan post-contact estimate is hidden. Existing guide/contact-circle switches still apply. Actual airborne height is rendered in 3D with ball shadows while the camera remains overhead.

Jumps use an approximate downward strike/cloth rebound, gravity, height-aware ball contacts, landing bounces, and energy loss. Airborne balls can clear other balls and cushions, land on the rail, and return to play. Jumping does not waive first-contact, called-pocket, or rail/pocket requirements. Mode switching preserves a shot paused in flight. Cue clearance currently checks numbered balls, rather than simulating a player's bridge, body, or the shaft's contact with the rail.

### Rail-running shots and table dimensions

The cushions, flat wooden rail caps, pocket cutouts, and cloth use **shared rendering/collision triangles**. A ball can land on a rail, roll along the cap, roll down the cushion slope onto the cloth, fall into any pocket, or roll/fly beyond the outer edge. Merely crossing the cushion nose is not out of bounds. A ball that **comes to rest on top of the rail** is off-table; the shot resolves rather than leaving it stuck or making it roll artificially. Out-of-bounds removal emits its own event and follows the exit trajectory instead of being animated into a nearby pocket.

This is a selected 9-foot profile based on the [WPA equipment specifications, sections 5–9](https://wpapool.com/wp-content/uploads/2024/01/RECOMMENDED-EQUIPMENT-SPECIFICATIONS.pdf):

| Dimension | Model |
| --- | --- |
| Playing area | 100 × 50 inches |
| Ball diameter | 2.25 inches |
| Outside frame | **114 × 64 inches** |
| Total rail width, including cushion | 7 inches (WPA range: 4–7.5) |
| Covered cushion depth, nose to cap | 1 15/16 inches (WPA range: 1 7/8–2) |
| Flat cap width behind the cushion | **5 1/16 inches / 128.6 mm** along the straight rails |
| Nose height above cloth | **63.5% of ball diameter / 36.3 mm** |
| Selected cap height above cloth | 1.75 inches / 44.45 mm |
| Resulting cushion-top slope | **Approximately 9.4°** |
| Corner / side pocket mouth | 4.5 / 5 inches |
| Corner / side pocket shelf (mouth line to hole edge) | 1.5 / 0.1875 inches (WPA: 1–2.25 / 0–0.375) |
| Horizontal corner / side jaw angles | 142° / 104° |

Manufacturers use different cap heights, rubber sections, pocket shelves, and corner shapes: WPA specifies ranges, not one universal rail profile. The cap height and rounded frame here are explicit design choices, not measurements copied from a particular brand. The model uses a triangular cushion section and approximate rigid contacts; it does not simulate rubber deformation or a manufacturer's full pocket back-draft/liner profile.

### Stroke and cloth model

- Power maps continuously to cue speed, with no minimum-speed kick. The maximum centered, level strike is calibrated to 47 world units/s (about 6.9 m/s). The instantaneous cue impulse uses a **170 g ball / 540 g cue** mass ratio and solid-sphere inertia `I = 2mr²/5`. Off-center hits transfer less energy at the same cue speed, while torque follows the actual cue-relative offset.
- Downward cue motion is resolved against the table using the **same contact law as landing**: normal restitution **0.5**, tangential friction coefficient **0.18**, and a friction impulse capped at the amount needed to remove surface slip. This exchanges spin and translation without adding energy. Hops below approximately **0.03 mm** are settled to avoid endless numerical bounces; there is no special jump/swerve mode or spin-based hop suppression.
- Sliding uses the velocity of the bottom contact point, `v + ω × (0, -r, 0)`. Position follows a parabola until slip reaches zero, then rolling takes over for the remainder of the timestep. Rolling and vertical-axis spin decay use exact integration of the existing speed-dependent resistance laws. Cloth-only travel is independent of timestep within floating-point precision; collisions are still resolved in adaptive fixed steps.
- This is a rigid-body approximation with representative material parameters, not a calibration to a particular cue and cloth. Finite-duration tip/cloth compression, shaft deflection (squirt), and miscues remain outside this model.

References: [billiards cloth-motion derivation](https://ekiefl.github.io/2020/04/24/pooltool-theory/#section-i-ball-cloth-interactions), [finite-mass cue-impact reference](https://github.com/ekiefl/pooltool/blob/main/pooltool/physics/resolve/stick_ball/instantaneous_point/__init__.py), and [representative ball/table parameters](https://github.com/ekiefl/pooltool/blob/main/pooltool/objects/ball/params.py). These provide model/reference values, rather than validation against measured shots on this game's table.

## Build and test

```sh
npm test
npm run build
npm run preview
```

Deploy the generated `dist/` directory to any static web host. The game uses WebGL and works in current mobile Safari, Chrome, and Firefox. Landscape is the default on touch devices, with portrait layouts available through Auto-rotate. Fonts use Google Fonts when available and fall back to system fonts.

## Structure

- `src/main.js` — input, UI, game loop, and turn flow
- `src/table.js` — Three.js table, ball materials, aiming guides, and rendering
- `src/table-geometry.js` — regulation-scale table dimensions, cushion outlines, and pocket openings
- `src/rail-geometry.js` — shared cloth/cushion/cap collision triangles, spatial lookup, and 3D sphere-sweep aiming boundaries
- `src/rail-motion.js` — 3D rail contact impulses, cap support, and gravity-driven motion on cushion slopes
- `src/physics.js` — fixed-step ball physics, randomized legal racks, and rule-event emission
- `src/match-rules.js` — UPA-based amateur 8-ball rules and shared chronological shot tracking
- `src/nine-ball.js` — UPA-based 9-ball rules, push-outs, foul warnings, and 9-ball spotting
- `src/cue-placement.js` — match ball-in-hand placement and kitchen bounds
- `src/aim-preview.js` — short spin-aware cue-ball path estimates
- `src/ball-motion.js` — angular motion, cloth friction, and spin-aware collision impulses
- `src/cue-elevation.js` — shared 3D cue pose and geometry-based minimum ball clearance
- `src/elevated-preview.js` — elevated-shot flight and cloth-path estimate using the live physics solver
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
- `tests/rail-physics.test.js` — rail landings, returns, all six pocket entries, out-of-bounds rules, and stuck-ball regressions

All visual assets are generated in code. Multiplayer is local pass-and-play on one device.
