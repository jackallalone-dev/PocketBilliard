# Match rules: UPA-based amateur 8-ball

## Source and scope

The supplied link, **https://upatour.com/8-ball-rules/**, is the United States Professional Poolplayers Association’s official 8-ball rules page. It was checked on October 10, 2026; the page also links its 2026 official PDF. UPA rules are a specific ruleset—other organizations, including WPA and APA, can handle situations differently.

Pocket Club implements the applicable on-table **amateur** rules from that page. It is a digital adaptation with optional aiming aids, not a certified tournament/referee system. Playground remains unrestricted and does not use the match rule engine.

## Implemented

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

## Digital conventions and non-applicable items

- **Explicit calls:** UPA permits obvious balls/pockets without a verbal declaration. This interface requires an explicit call on every non-break shot, avoiding ambiguous guesses about a player’s intended bank, kick, combination, or 8-ball pocket. Declaring Safety is the alternative.
- **Ball in hand:** use the ball or its offset handle, then confirm. Placement automatically avoids overlaps rather than permitting accidental disturbance fouls. The cue returns to a valid provisional spot after a scratch, but the incoming player can reposition it.
- **Illegal actions prevented by the interface:** shooting while balls move, moving object balls during match play, and multiple cue strikes in one stroke. The displayed active player controls each hot-seat inning; the software cannot identify which physical person is touching the device.
- **First break:** there are no player speed ratings or a physical lag minigame. Player 1 is the initial default, with an agreed breaker selectable through New Game.
- **Three-foul loss:** section 8.2 explicitly says this is **pro only**, not amateur league play. It is not enforced as a loss here. Foul-inning counters are used only to make the mutual-stalemate action available.
- **No shot clock:** section 9.1 makes this discretionary. No referee shot clock is selected for this local game.
- **Physical/officiating rules:** foot on floor, cue/equipment standards, coaching time-outs, interference, physical ball tapping, marking cloth, match lateness, referees, disputes, and outside interference are not modeled.
- **Pocket/flight phenomena:** the flat-table engine has no jump shots, pockets filled with supporting balls, suspended balls, pocket rebounds, table defects, or delayed hanging-ball drops. A captured ball is permanently pocketed for that shot; any engine-detected off-table ball still receives the rule penalty.
- **Aiming aids:** guide lines and trajectory estimates are optional digital assistance. They can be independently disabled in Settings. The cyan cue-ball estimate is a short prediction, not a guarantee of the entire shot.

## Controls added for match play

1. Place/confirm the cue for a break or ball in hand.
2. After the break, choose **Call shot** → ball → pocket (P1–P6), or **Safety**.
3. Aim, choose spin, pull the power control, and release.
4. Read the foul/turn message. If an illegal break occurs, the incoming player chooses the re-break option.
5. Use Settings for concession or an eligible mutual stalemate. Restart/another round defaults to the alternating breaker.
