# CLAUDE.md — Sole Blessed

Browser board game + RPG (Dokapon Kingdom-like) in the Kingdom of Arendore. **Pure HTML/CSS/JS, no libraries, no build step, no external assets.** All art is drawn with Canvas code/emoji; all sound is Web Audio synthesis.

- Spec (source of truth): `docs/project_spec.md` · Story text: `docs/game_dialogue.md`
- Save format: `docs/localstorage_schema.md` (update it whenever `Game.state` or a storage key changes)

## Run & test

```bash
# Play: open index.html directly (file:// works; classic <script> tags, no ES modules on purpose)
node tools/test-rules.js                          # rule assertions vs the spec (damage table, cooldowns, EXP…)
node tools/simulate.js 40                         # 40 headless 4-bot games, checks state invariants every turn
node tools/simulate.js 40 --days=45 --pace=brisk --verbose
```
Run both tools after touching `game.js`, `battle.js`, `bot.js`, `map.js` or `data.js`. The simulator must report "all invariants held".

## Files (script load order matters: each file uses globals from earlier ones)

| File | Global | Role |
| --- | --- | --- |
| `js/util.js` | `U` | random, rounding (`U.round`: .5 rounds up per spec), seeded RNG, colour helpers |
| `js/data.js` | `DATA` | **every** balance number, map layouts (ASCII from the spec, parsed at load), dialogue, help text |
| `js/save.js` | `Save` | localStorage (prefix `soleblessed:v1:`), 4 slots + autosave + settings + records |
| `js/audio.js` | `Sound` | synth music sequencer + SFX; unlocked on first user gesture |
| `js/sprites.js` | `Sprites` | procedural art: heroes (9 classes × 2 genders), 13 monsters/bosses, buildings, props, NPC portraits; `Sprites.portrait()` caches data-URLs for the DOM |
| `js/map.js` | `MapSys` | graph from the spec layouts, BFS reachability, 2.5D board renderer, camera, walk animation |
| `js/game.js` | `Game`, `ABORT` | state, rules, async turn loop, spaces/events/shops/items/levels/minion/endings |
| `js/battle.js` | `Battle`, `BattleView`, `SimView` | damage rules & battle flows; canvas battle scene + DOM battle HUD |
| `js/bot.js` | `Bot` | bot decisions (spec §10) |
| `js/ui.js` | `UI` | screens, HUD, modals, keyboard, and every **human** decision |
| `js/main.js` | — | canvas sizing, render loop, pointer/touch input |

## Architecture rules

- **One JSON state.** Everything that must survive a save is in `Game.state` (plain JSON). Static data never goes in state.
- **Decision parity.** `Game.who(p)` returns `Bot` or `UI`; both implement the same async methods (`turnAction`, `chooseDestination`, `yesNo(p, key, info)`, `chooseChallenge`, `battleCommand`, `allocatePoints`, `inventoryFull`, `charmChoice`, `stealChoice`, `shop`, `horseBet`, `pickTarget`, `pickSpace`). Add a new decision to both.
- **Headless-safe logic.** `game.js`/`battle.js`/`bot.js` must run in Node (`Game.sim = true`): guard every display call with `if (!this.sim)` / `Game.sim`, and route battle visuals through `Battle.view()` (returns `SimView` in sim).
- **Timing.** Use `await Game.wait(ms)` in game flow. It applies bot speed (spec: bots 2×), Enter-to-skip (`Game.skipping`), pause, and throws `ABORT` when the player exits to the title (`Game.runId` changes). Human decisions call `Game.needHuman()` to cancel skipping.
- **Saving** is only legal in the human's pre-roll phase (`Game.canSave()`), so loading always resumes at `playTurn()` start. Keep that phase idempotent.
- **Keyboard.** `UI.pushKeys(fn, tag, isModal)` stack; handlers return `true` when they consume a key. Modals swallow everything. `hud` and `title` handlers are permanent. Never remove them in cleanup.
- **Battle scene data** is read live via a scene function. `BattleView.getScene()` caches the last good scene because the enemy may be removed (minion defeated) while the result window is open. Mutate world state after `V.result(...)`.

## Spec interpretations & deliberate deviations (keep in sync)

1. Zone 2 `t01` has no connector in the spec layout → linked to `e14` directly below it (`DATA.EXTRA_LINKS`). Road `3-B03—4-e01` uses waypoints so it doesn't cross Zone 3 `L04`.
2. **Rules presets (per game, chosen on character creation):** default = spec (35 days, *Classic*). *Brisk* = EXP ×1.5 and every hero heals 10% HP at day start; lengths 45/60 days. "★ Recommended" = Brisk + 45 days. See Balance notes.
3. Bots: spec rules plus (a) minion fights require level ≥ minion − 1, (b) low-HP retreat only when they can afford a heal (temples don't heal, broke bots would loop), (c) time-pressure readiness (`Bot.SCHEDULE`) so the story advances, (d) seek co-op Demon Lord Army battles in range.
4. Isan Person's "AT +40%" and Energy Drink last for the **next battle** (or the current one if locked in battle).
5. One inventory use per turn covers items **and** spellbooks. Anti-Magic Talisman is passive.
6. Hero duel KO: loser pays the normal 10% KO penalty, then the winner steals (20% money / equipment / item). Stolen equipment that's equipped sells the winner's old piece for 50%; charms are discarded (not sellable).
7. Minion Sticky Fingers = 20% total money loss on KO/surrender. Minion never "arrives" on a hero already sharing its space.
8. All co-op participants get +2 Job EXP when the Demon Lord Army falls; finisher gets star/drop/full rewards, others 50% EXP & money.
9. Treasure items can include Larb; treasure spellbooks are limited to zones ≤ the chest's zone. E04 "toughest monster" = the higher-level monster of the zone.
10. General/Demon Lord first-meeting lines come from `game_dialogue.md`; later meetings use the short spec lines.
11. Extras (creative): autosave row on Load Game, lifetime records/endings counter on the title, 4× bot speed option, HUD event log, turn summary after Enter-skip, D-pad on touch screens.

## Balance notes (from `tools/simulate.js`, 4 bots)

| Preset | Demon Lord defeated | Endings |
| --- | --- | --- |
| 35 days · Classic (spec) | ~0–3% of games | almost always Bad |
| 45 days · Brisk | ~50–55% | mix of Good / Secret / Bad |

With spec numbers, heroes reach ~Lv 17 by day 30 while the Demon Lord is Lv 28 behind three sequential Generals, so the spec's own intended pacing (zone 4 at Lv 19–26) doesn't fit in 35 turns per hero. Tune via `DATA.PACES` / `DATA.RULES_*` (not by editing spec tables) and re-run the simulator.
