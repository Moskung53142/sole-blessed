# CLAUDE.md — Sole Blessed

Browser board game + RPG (Dokapon Kingdom-like) in the Kingdom of Arendore. **Pure HTML/CSS/JS, no libraries, no build step, no external assets.** All art is drawn with Canvas code/emoji; all sound is Web Audio synthesis.

- Spec (source of truth, revision 2): `docs/project_spec.md` · Story text: `docs/game_dialogue.md`
- Save format: `docs/localstorage_schema.md` (update it whenever `Game.state` or a storage key changes)

## Run & test

```bash
# Play: open index.html directly (file:// works; classic <script> tags, no ES modules on purpose)
node tools/test-rules.js                 # rule assertions vs the spec (map, exact steps, damage table, KO rest, duels…)
node tools/simulate.js 20                # 20 headless 4-bot 140-day games, checks state invariants every turn
node tools/simulate.js 12 --days=0       # Endless mode
node tools/balance.js                    # how every enemy plays vs reference bot heroes (--tune regenerates HP/AT)
```
Run the first two after touching `game.js`, `battle.js`, `bot.js`, `map.js` or `data.js`; the simulator must report "all invariants held". After changing balance numbers, run `balance.js` and keep the spec tables in sync (the numbers in `docs/project_spec.md` §9 and §8 must match `data.js`).

## Files (script load order matters: each file uses globals from earlier ones)

| File | Global | Role |
| --- | --- | --- |
| `js/util.js` | `U` | random, rounding (`U.round`: .5 rounds up per spec), seeded RNG, colour helpers |
| `js/data.js` | `DATA` | **every** balance number, map layouts (ASCII from the spec, parsed at load), dialogue, requests, help text |
| `js/save.js` | `Save` | localStorage (prefix `soleblessed:v1:`, save schema 2), 4 slots + autosave + settings + records |
| `js/audio.js` | `Sound` | synth music sequencer + SFX; unlocked on first user gesture |
| `js/sprites.js` | `Sprites` | procedural art: heroes (9 classes × 2 genders, victory poses), 17 monsters/bosses, buildings, props, NPC portraits |
| `js/map.js` | `MapSys` | graph from the spec layouts, exact-step move search, depth (monster tiers), 2.5D renderer with a cached land layer, camera |
| `js/game.js` | `Game`, `ABORT` | state, rules, async turn loop, spaces/events/shops/items/levels/minion/requests/endings |
| `js/battle.js` | `Battle`, `BattleView`, `SimView` | damage rules, monster/army/duel flows, brawls; canvas battle scene + DOM battle HUD |
| `js/bot.js` | `Bot` | bot decisions (spec §10) |
| `js/ui.js` | `UI` | screens, HUD, modals, keyboard, Log ledger, sharing, and every **human** decision |
| `js/main.js` | — | canvas sizing, render loop, pointer/touch input |
| `tools/*.js` | — | Node test / simulation / balance tools (load the game files with `vm`) |

## Architecture rules

- **One JSON state.** Everything that must survive a save is in `Game.state` (plain JSON). Static data never goes in state.
- **Decision parity.** `Game.who(p)` returns `Bot` or `UI`; both implement the same async methods (`turnAction`, `chooseDestination(p, moves, total)`, `yesNo`, `chooseChallenge`, `fightChoice`, `placeMenu`, `chooseClass`, `battleCommand`, `allocatePoints`, `inventoryFull`, `charmChoice`, `stealChoice`, `shop`, `horseBet`, `pickTarget`, `pickSpace`). Add a new decision to both.
- **Headless-safe logic.** `game.js`/`battle.js`/`bot.js` must run in Node (`Game.sim = true`): guard every display call with `if (!this.sim)` / `Game.sim`, and route battle visuals through `Battle.view()` (returns `SimView` in sim).
- **Timing.** Use `await Game.wait(ms)` in game flow. It applies the game speed setting (`UI.settings.speed`, 1/2/4), Enter-to-skip (`Game.skipping`), pause, and throws `ABORT` when the player exits to the title. Human decisions call `Game.needHuman()` to cancel skipping.
- **Movement** uses `MapSys.exactMoves(prefix, steps, isBlocking)`: the rolled number must be walked exactly, no revisits, and stepping onto an undefeated General / Demon Lord's Castle ends the move. No route = turn skipped.
- **Fights.** Battles are persistent objects (`kind` monster/army/duel). A locked hero goes straight into `Battle.continueFor` at turn start (no pre-roll menu). No items during a fight (`Game.canUseItem` refuses while `p.battleId` is set), and the HUD keys except L are ignored while `BattleView.isOpen`. Duels run 3 rounds per duelist turn until KO/give-up. Walking into a fight calls `Game.enterFight` (join or duel; `reserve`/`resume` hand the monster fight to the duel winner).
- **Rest turns.** KO and give-up set `p.down = DATA.DOWN_TURNS` (1); `Game.playTurn` skips those turns (`restTurn`). When the rest ends, `p.justUp` is set until the end of the hero's next turn: no turn-start join offer, no challenges, no minion ambush (a free roll). Resting heroes can't be challenged or ambushed; heroes in buildings can't be challenged; the minion never ends on a building.
- **Saving** is only legal in the human's pre-roll phase (`Game.canSave()`), so loading always resumes at `playTurn()` start. Keep that phase idempotent.
- **Phone layout.** Check UI changes at 390×844 and 360×740 with touch emulation (the D-pad only shows for `pointer: coarse`). In the movement HUD, `#move-info` and `#move-left` live in the bottom-left `#move-bl` column, clear of the D-pad; battle header boxes use `minmax(0, 1fr)` columns so long names ellipsize instead of pushing off-screen.
- **Keyboard.** `UI.pushKeys(fn, tag, isModal)` stack; handlers return `true` when they consume a key. Modals swallow everything. `hud` and `title` handlers are permanent. Never remove them in cleanup.
- **Battle scene data** is read live via a scene function; `BattleView.getScene()` caches the last good scene. Mutate world state after `V.result(...)`.
- **Log.** `Game.log(text, who)`: the leading emoji becomes the ledger icon, `who` (player / 'minion' / 'king') picks the avatar.

## Spec interpretations (keep in sync with the spec)

1. Duplicate codes in the drawn map were renamed (Zone 1 second `t04` → `t07`, Zone 2 second `e30` → `e41`). A `│` may sit under the first or middle character of a code (the parser accepts both and throws on anything else).
2. Zone offsets (0,10) / (5,1) / (15,0) / (15,12) place the zones SW/NW/NE/SE with a sea strait (bridge) between Zones 2 and 3 and open sea between Zones 1 and 4.
3. Monsters: 3 per zone; the tier comes from the space's depth between the zone entrance and its General (20% tier below, 12% tier above).
4. After a monster falls with 2+ heroes in the fight, the finisher duels one remaining hero ("the fight still goes on"). Demon Lord Army fights stay co-operative.
5. Isan Person's AT +40% and Energy Drink apply to the hero's next fight.
6. One item per turn covers items and spellbooks, before rolling only; no items during a fight (any round).
7. Hero duel KO: loser pays the normal 10% KO penalty and rests 1 turn, then the winner steals. Stolen equipped gear sells the winner's old piece for 50%; charms are discarded.
8. Minion Sticky Fingers = 20% total money loss on KO/surrender.
9. Challenge Letter: the caster rushes to the target's space and the duel starts immediately (uses up the turn).
10. Extras: autosave row, lifetime records on the title, HUD unread badge on the Log button, turn summary after Enter-skip, D-pad on touch screens, bot schedule/co-op seeking (`Bot.SCHEDULE`) so the story advances.

## Balance notes (from `tools/simulate.js`, 4 bots, 140 days)

- 160-game sample (revision 2.1: no items in fights, 1 rest turn): Generals fall around days 32 / 68 / 104 (the third in ≈92% of games); the Demon Lord is engaged in ≈60% of games (around day 126) and falls in ≈45%, around day 128. Endings with bots only: ≈18% Good / 27% Secret / 55% Bad (a human pushing the story does better). Endless always ends Good (Demon Lord ≈ day 149).
- Top bot level ≈ 12 / 24 / 34 / 43 on days 30 / 60 / 90 / 120, matching the zone bands 1–12 / 13–24 / 24–36 / 37–50.
- Small samples (≤ 24 games) swing a lot (Demon Lord kill rate 25–75%); use 80+ games before judging a change. `simulate.js` also prints when the Demon Lord is first engaged and its HP left when it survives: few engagements = pacing/bot readiness, high HP left = boss too tough.
- Monster EXP = 7.8 × level + 7, money = 9 × level + 12. Change pacing through these, `DATA.MINION` and the equipment prices, then re-run both tools.
