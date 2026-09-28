# LocalStorage Schema — Sole Blessed

All persistence lives in `js/save.js`. Every key is namespaced with the prefix **`soleblessed:v1:`** so the game never collides with other pages on the same origin, and so a future breaking change can move to `v2:` while old data stays readable.

Values are JSON strings. Reads are wrapped in `try/catch`: a missing, corrupted, or foreign value is treated as "empty" and never crashes the game. If `localStorage` is unavailable (private browsing, blocked storage) the game falls back to an in-memory store and the Load/Save screen shows a warning.

| Key | Written when | Purpose |
| --- | --- | --- |
| `soleblessed:v1:settings` | A setting changes | Volume and bot speed |
| `soleblessed:v1:slot:1` … `slot:4` | Player saves from the Pause Menu | The 4 manual save slots (spec §1) |
| `soleblessed:v1:autosave` | Start of every human turn, before rolling | Crash/close safety net; shown under the 4 slots on Load Game |
| `soleblessed:v1:records` | A game reaches an ending | Lifetime stats: endings discovered, best stars, last 10 results |

Typical sizes: a save record is about 3 KB at the start of a game and at most about 9 KB mid-game (measured with `tools/simulate.js`). All keys together stay under about 50 KB.

---

## 1. `settings`

```jsonc
{
  "schema": 1,
  "musicVolume": 0.5,   // 0..1
  "sfxVolume": 0.7,     // 0..1
  "botSpeed": 2,        // 2 = spec "bots at 2× speed", 4 = faster
  "showTips": true      // reserved
}
```
Missing fields are filled from defaults on load (`Object.assign(DEFAULTS, stored)`), so adding a setting never needs a migration.

## 2. Save records: `slot:N` and `autosave`

```jsonc
{
  "schema": 1,                        // = DATA.SAVE_SCHEMA
  "meta": {                           // shown on the Load/Save screen without parsing the whole state
    "slot": 3,                        // 1..4, or "auto"
    "savedAt": "2026-09-28T02:57:39.000Z",
    "name": "Moss", "classId": "shaman", "className": "Apprentice Shaman",
    "level": 7, "day": 12, "stars": 3, "gender": "f", "color": "#e8553d"
  },
  "state": { /* GameState, see §3 */ }
}
```

**When saving is allowed:** only on the human's own turn, before rolling (`state.phase === "preRoll"`) and never while a battle scene is open (spec §1). Loading therefore always resumes at the start of the human's pre-roll phase. `Game.start(state)` re-enters `playTurn()`, which is idempotent at that point.

**Overwrite:** writing to an occupied slot requires confirmation in the UI. **Delete:** `Save.deleteSlot(n)` removes the key after confirmation.

## 3. `GameState` (the `state` object)

The entire game is one plain JSON object (`Game.state`). Nothing else needs to be persisted: map geometry, decorations and all balance numbers are rebuilt from `js/data.js`.

```jsonc
{
  "schema": 1,
  "version": "1.0.0",                 // DATA.VERSION that created the save
  "createdAt": "ISO date",
  "rules": { "days": 35, "pace": "classic" },   // chosen at character creation (35|45|60, classic|brisk)
  "day": 12,                          // 1..rules.days
  "turn": 0,                          // index into players (0 = human)
  "phase": "preRoll",                 // preRoll | acting | between | start
  "players": [ /* Player ×4, see §3.1 */ ],
  "army": {                           // Demon Lord Army; HP persists between battles
    "B01": { "hp": 240, "maxHp": 240, "cd": { "special": 0, "specialDef": 0 }, "defeated": false },
    "B02": { … }, "B03": { … }, "B04": { … }            // B04 = Demon Lord
  },
  "minion": null,                     // or { "zone": 2, "spaceId": "2-e07", "hp": 200, "maxHp": 200, "cd": {…} }
  "minionNextDay": 3,                 // first spawn day 3; after a defeat = defeat day + 1
  "dlDefeated": false,                // → everyone rolls 2 dice, hero duels give 1 ⭐
  "head": { "holder": null, "space": null },   // Demon Lord's Head: held by player id, or dropped on a space id
  "chests": { "1-t03": 9 },           // treasure space → day it was opened (empty for 3 days)
  "traps": [ { "space": "3-e05", "owner": 2 } ],   // Monster Traps (MB03)
  "battles": [ /* ongoing monster/army battles, see §3.2 */ ],
  "nextBattleId": 14,
  "flags": { "castleIntro": false, "dlMet": false, "generalMet": { "B01": true } },  // one-time dialogues
  "log": [ { "day": 12, "text": "🎲 Moss rolled 4." } ],   // last 80 events (HUD log, turn summary)
  "over": false,
  "ending": null,                     // "good" | "bad" | "secret" once over
  "deliveredBy": null                 // player id who delivered the head
}
```

Space ids are `"<zone>-<code>"`, e.g. `1-L01` (Royal Castle), `4-B04` (Demon Lord's Castle); see spec §7.2.

### 3.1 Player

```jsonc
{
  "id": 0, "name": "Moss", "isBot": false, "gender": "f", "color": "#e8553d",
  "classId": "shaman",                // key of DATA.CLASSES
  "level": 7, "exp": 23, "freePts": 0,
  "base": { "hp": 150, "at": 9, "df": 8, "sp": 21 },   // before equipment & passives (displayed values add them)
  "hp": 131, "money": 640, "stars": 3,
  "spaceId": "2-e04", "respawnId": "2-L05",
  "equip": { "weapon": "S2", "armor": "A1", "charm": "C03" },   // keys of DATA.EQUIP / DATA.CHARMS or null
  "items": ["I04", "I06"],            // Item tab, max 6 (DATA.ITEMS keys)
  "books": ["MB02"],                  // Spellbook tab, max 6
  "special": "SK1", "specialDef": null,           // DATA.SKILLS keys
  "cd": { "special": 0, "specialDef": 0, "classMove": 1 },   // days remaining
  "jobExp": { "shaman": 6, "commoner": 10 },
  "mastered": ["commoner"],           // mastery bonus applies on every level-up
  "unlocked": ["commoner", "shaman", "slingshot", "warlord"],
  "merit": 1, "usedLarb": false, "wentAllIn": false,          // secret-class unlock progress
  "buffs": { "dice": 0, "energy": false, "eater": false },    // next roll / next battle
  "battleId": null,                   // locked in battle → id in state.battles
  "itemUsed": false,                  // one item per turn
  "turnOver": false,                  // knocked out during own pre-roll (Challenge Letter)
  "record": { "monsters": 4, "heroesBeaten": 1, "army": 1, "treasures": 3, "deaths": 1 },
  "botMem": {}                        // bot-only memory (e.g. off-branch class decisions)
}
```

### 3.2 Battle (only unfinished monster / Demon Lord Army battles are stored)

```jsonc
{
  "id": 13, "kind": "army",           // "monster" | "army"   (hero duels are never persisted: they last 1 round)
  "space": "2-B02",
  "armyKey": "B02",                   // "minion" | "B01".."B04" for army; null for monsters
  "enemy": null,                      // monsters only: { "key": "wolf", "mult": 1, "e04": false, "hp": 20, "maxHp": 34, "specialDay": 0 }
  "parts": [0, 2],                    // participating player ids (co-op up to 4)
  "first": { "0": "hero", "2": "hero" },          // who attacks first, per participant (kept across days)
  "mods": { "0": { "energy": true, "eater": false, "vines": false } }   // per-battle buffs/debuffs
}
```

Army enemy HP/cooldowns live in `state.army[key]` or `state.minion`, not in the battle, so they persist after every participant leaves.

## 4. `records`

```jsonc
{
  "schema": 1,
  "gamesPlayed": 3, "wins": 1, "bestStars": 14,
  "endings": { "good": true, "bad": true, "secret": false },   // "Endings discovered x/3" on the title screen
  "history": [ { "date": "ISO", "ending": "good", "rank": 1, "stars": 14, "winner": "Moss" } ]   // newest first, max 10
}
```

## 5. Versioning & migration

* `schema` in every record is compared with `DATA.SAVE_SCHEMA` (currently `1`).
* `Save.migrate(record)` runs before validation. It is the single place to upgrade old saves. For example, v1 saves without `rules` get `DATA.RULES_DEFAULT`.
* `Save.validState(state)` checks the structural minimum (schema, 4 players, day/turn numbers, army/head/battles). Invalid records show as **corrupted** in the Load screen and can be deleted but not loaded.
* A breaking change should bump `DATA.SAVE_SCHEMA`, add an upgrade step in `migrate`, and keep the `soleblessed:v1:` prefix unless the key layout itself changes.

## 6. Clearing data

From the browser console: `Object.keys(localStorage).filter(k => k.startsWith('soleblessed:')).forEach(k => localStorage.removeItem(k))`.
