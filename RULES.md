# Match rules: UPA-based 8-ball and 9-ball

## Source and scope

Sources are the United States Professional Poolplayers Association’s official [8-ball rules](https://upatour.com/8-ball-rules/) (checked October 10, 2026) and [9-ball rules](https://upatour.com/9-ball-rules/) (checked October 11, 2026). Both pages link their 2026 official PDFs. UPA rules are a specific ruleset—other organizations, including WPA and APA, can handle situations differently.

Pocket Club implements the applicable on-table rules, choosing the **amateur** variant for 8-ball. It is a digital adaptation with optional aiming aids, not a certified tournament/referee system. Each match mode has an independent session. Playground remains unrestricted and does not use the match rule engine.

## 8-ball implementation

| Source | In-game behavior |
| --- | --- |
| 1, 2.1 | Solids/stripes; randomized rack with the apex on the foot spot, the 8 in the center, and opposite groups at the two rear corners. |
| 2 | New racks default to alternating breakers. Players can select the opening breaker in New Game, standing in for the real-world rating/lag procedure. |
| 3 | Break placement behind the head string. Pocket a numbered ball or send at least four **distinct object balls** to rails. The cue can hit any object first on the break. |
| 3 | Illegal break: re-rack; opponent chooses to break or require the offender to break again. |
| 3 | A legal break with a pocket retains the turn; a dry legal break passes it. A foul on a legal break gives the opponent ball in hand behind the head string, with the first object contacted outside the kitchen. |
| 4 | A legally pocketed 8 on the break wins. Pocketing it with a simultaneous foul loses. |
| 5 | Groups remain open after the break. A legal called pocket assigns the group. On an open table, either colored group may be hit first, but not the 8. The 8 can participate later in a combination. |
| 6 | Ball-and-pocket calls; correct called pockets retain the turn. Banks, kicks, and combinations require no further details. All pocketed object balls stay down. |
| 7.2–7.5 | Scratch, wrong first ball, missing all object balls, no subsequent rail/pocket, and off-table balls are fouls. Normal fouls give ball in hand anywhere clear. Removing the 8 loses. |
| 7.3, 9.2 | Once a group is cleared, the 8 is the legal first ball. Ambiguous split contacts within the same fixed physics step favor a legal target. |
| 7.4 | A cushion touched before the first object contact does not satisfy the after-contact rail requirement. A ball initially frozen to a cushion must separate before hitting that cushion can count. |
| 7.9–7.11 | The close-ball 45° requirement is checked for shots within half an inch (scaled to table units). Kitchen placement is constrained, and cue placement cannot overlap or move object balls. |
| 8 | Early 8, wrong called pocket for the 8, or pocketing the 8 with a foul loses. Scratching on an 8 attempt **without pocketing the 8** is a normal foul. The last group ball and the 8 cannot legally finish the game on the same stroke. |
| 8.3 | Current player can concede through Settings. |
| 9.9 | A declared safety ends the inning even if an object ball falls. It does not assign groups on an open table. |
| 9.10 | After three consecutive foul innings from each player, a stalemate action becomes available. Both players must explicitly agree that the stated stalemate conditions apply; then a new rack is played. |

## 9-ball implementation

Section references in this table are to the UPA 9-ball source.

| Source | In-game behavior |
| --- | --- |
| 1, 2.1 | Diamond rack: 1 on the foot spot, 9 in the center, 2 at the rear, and the other numbers randomized. |
| 2 | Alternating breakers by default; an agreed opening breaker can be selected in New Game. |
| 3, 7.10 | Break from behind the head string, hitting 1 first. Pocket a numbered ball or send at least three **distinct object balls** to rails. An off-table ball does not count as a pocket toward this requirement. |
| 3 | Illegal break: re-rack; the opponent chooses who breaks. A foul on a legal break gives ball in hand anywhere and counts toward the shooter's consecutive fouls. |
| 4 | Legally pocketing the 9 on the break wins. A fouled 9 is spotted instead. |
| 1, 6, 10.5 | Hit the lowest remaining ball first. Any legal numbered pocket retains the turn; a dry legal shot passes it. Pocketing the 9 legally wins, including combinations. No called-pocket requirement. |
| 5 | A declared push-out is available only on the shot immediately after a legal break, including a legal break with a foul. No first-contact or rail requirement applies; other fouls still apply. After a legal push, the opponent chooses to take the position or pass it back. |
| 5 | Balls pocketed on a push stay down, except the 9, which is spotted. A legal push clears the shooter's consecutive-foul streak. |
| 7.2–7.5, 7.9 | Scratch, wrong first ball, missing all object balls, no rail/pocket after contact, off-table balls, and close double-hit approaches give ball in hand anywhere. Frozen-rail handling uses the same chronological tracker as 8-ball. |
| 1, 7.5 | A 9 removed on a foul or driven off the table is spotted; other removed numbered balls stay down. |
| 8.2 | Three consecutive fouls by the same player lose the game if the required warning was acknowledged after the second foul. Without the warning, a third foul does not lose; another warning opportunity is presented. A legal shot clears that player's count and warning. |
| 8.3 | Current player can concede through Settings. |
| 9.2 | Ambiguous split contacts within the same physics step favor a legal lowest-ball hit. |

### 9-ball controls and conventions

1. Place and confirm the cue for the break or ball in hand. The HUD shows the lowest target and each player's consecutive-foul count.
2. Aim and shoot without selecting a pocket. To push on the shot after the break, select **Push** before shooting; selecting it again cancels the declaration.
3. After a legal push, choose to take the position or pass it back in the decision dialog.
4. After a second foul, the opponent should warn the shooter and select **Warning given**. This acknowledgment records the digital equivalent of the required verbal warning. Dismissing the dialog does not record a warning.
5. A re-spotted 9 goes on the foot spot. If occupied, the app searches for the nearest clear point on the long string toward the foot rail, then toward the head rail if necessary. This blocked-spot placement is a digital convention because the linked page specifies the foot spot without detailing an occupied-spot procedure. Other balls are not moved.

## Shared digital conventions and non-applicable items

- **8-ball explicit calls:** UPA permits obvious balls/pockets without a verbal declaration. This interface requires an explicit call on every non-break 8-ball shot, avoiding ambiguous guesses about a player’s intended bank, kick, combination, or 8-ball pocket. Declaring Safety is the alternative. These controls do not apply to 9-ball.
- **Ball in hand:** use the ball or its offset handle, then confirm. Placement automatically avoids overlaps rather than permitting accidental disturbance fouls. The cue returns to a valid provisional spot after a scratch, but the incoming player can reposition it.
- **Illegal actions prevented by the interface:** shooting while balls move, moving object balls during match play, and multiple cue strikes in one stroke. The displayed active player controls each hot-seat inning; the software cannot identify which physical person is touching the device.
- **First break:** there are no player speed ratings or a physical lag minigame. Player 1 is the initial default, with an agreed breaker selectable through New Game.
- **8-ball three-foul loss:** the 8-ball source's section 8.2 explicitly says this is **pro only**, not amateur league play. In 8-ball, foul-inning counters are used only to make the mutual-stalemate action available. In 9-ball, the warned three-foul loss applies as described above.
- **No shot clock:** section 9.1 makes this discretionary. No referee shot clock is selected for this local game.
- **Physical/officiating rules:** foot on floor, cue/equipment standards, coaching time-outs, interference, physical ball tapping, marking cloth, match lateness, referees, disputes, and outside interference are not modeled.
- **Jump shots:** both modes permit elevated downward strokes (UPA sections 7.7 and 9.7). The player manually adjusts cue elevation, with minimum shaft clearance calculated from nearby balls. Takeoff is an approximate rebound from the cloth; gravity, airborne ball contacts, landing bounces, and off-table fouls are simulated. A ball passed over without touching does not count as first contact. Jumping does not waive the normal target, pocket, or rail rules. Scooping and miscues are not modeled.
- **Rail-running balls:** crossing a cushion nose or touching the top of a rail is not automatically out of bounds. Balls can roll on the rail and return to the cloth or fall into a pocket. A ball that leaves the physical outer table boundary or comes to rest on the rail is off-table, with the usual scratch/object-ball penalties and 9-ball spotting. Off-table balls are recorded separately from pocketed balls and cannot satisfy a called pocket. Cushion slopes and cap widths share their collision geometry with the rendered table; the selected WPA-based dimensions are documented in README.md.
- **Close-ball geometry:** the existing UPA 45° close-hit check uses the cue's three-dimensional approach angle, including elevation. That rule is separate from shaft clearance: the minimum elevation to clear a ball behind the cue is calculated from geometry and is not fixed at 45°.
- **Pocket/flight phenomena:** pockets filled with supporting balls, suspended balls, pocket rebounds, table defects, and delayed hanging-ball drops are not modeled. A captured ball is permanently pocketed for that shot; any engine-detected off-table ball still receives the rule penalty.
- **Aiming aids:** guide lines and trajectory estimates are optional digital assistance. They can be independently disabled in Settings. The cyan cue-ball estimate is a short prediction for level shots, not a guarantee of the entire shot. Elevated shots use an amber estimate through the first landing or collision, at the selected power (65% while idle).

## 8-ball controls

1. Place/confirm the cue for a break or ball in hand.
2. After the break, choose **Call shot** → ball → pocket (P1–P6), or **Safety**.
3. Aim, choose spin, pull the power control, and release.
4. Read the foul/turn message. If an illegal break occurs, the incoming player chooses the re-break option.
5. Use Settings for concession or an eligible mutual stalemate. Restart/another round defaults to the alternating breaker.
