# Sole Blessed

A turn-based **board game + RPG** for the browser, inspired by Dokapon Kingdom. Four heroes (you + 3 bots) roam a 2.5D island, fight monsters and the Demon Lord's army, cooperate or duel each other, and race for the most ⭐ before the days run out. The winner receives the **King's Blessing**.

**No install, no build, no libraries.** Open `index.html` in a modern browser (desktop or mobile). All graphics are drawn with Canvas code, and all music and sound effects are synthesised with the Web Audio API.

## Features
- 91-space map across 4 zones (Kingdom of Arendore, Forest, Desert, Demon Lord's Land), built from the layouts in the spec
- 9 classes (3 branches × 2 tiers + 3 secret classes), mastery bonuses, free stat points
- Card-draw initiative and simultaneous Attack/Strike/Special/Class vs Defend/Counter/Special Defense/Give Up battles; co-op Demon Lord Army battles
- Shops, equipment, skills, spellbooks, events, treasure, horse racing, temples, a roaming minion
- 3 endings (Good / Bad / Secret), 4 save slots + autosave, keyboard and touch controls
- Per-game rules: 35/45/60 days, Classic (spec) or Brisk pace

## Controls
| Situation | Keys |
| --- | --- |
| Normal play | Q Move · O Inventory · I Free Camera · X Status · Z How to Play |
| While moving | W/A/S/D Move · E Free Camera · I Auto-Move · O Status · N Full Map · Enter Stop |
| Battle | W/A/S/D choose a command · Z Enemy Info |
| Menus | W/A/S/D select · Enter confirm · Esc close / pause |

## Development
- Design docs: [`docs/project_spec.md`](docs/project_spec.md), [`docs/game_dialogue.md`](docs/game_dialogue.md), [`docs/localstorage_schema.md`](docs/localstorage_schema.md)
- Architecture and conventions: [`CLAUDE.md`](CLAUDE.md)
- `node tools/test-rules.js` checks the rules against the spec · `node tools/simulate.js 40` plays 40 headless bot games (Node 18+)
