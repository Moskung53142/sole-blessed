# LocalStorage Schema — Sole Blessed

All persistence lives in `js/save.js`. Every key is namespaced with the prefix **`soleblessed:v1:`** so the game never collides with other pages on the same origin. The *key layout* is still v1; the *save format* inside a record is versioned separately by `schema` (currently **2**).

Values are JSON strings. Reads are wrapped in `try/catch`: a missing, corrupted, or foreign value is treated as "empty" and never crashes the game. If `localStorage` is unavailable (private browsing, blocked storage) the game falls back to an in-memory store and the Load/Save screen shows a warning.

| Key | Written when | Purpose |
| --- | --- | --- |
| `soleblessed:v1:settings` | A setting changes | Volumes and game speed |
| `soleblessed:v1:slot:1` … `slot:4` | Player saves from the Pause Menu | The 4 manual save slots (spec §1) |
| `soleblessed:v1:autosave` | Start of every human turn, before rolling (not when the turn opens straight into a battle) | Crash/close safety net; shown under the 4 slots on Load Game |
| `soleblessed:v1:records` | A game reaches an ending | Lifetime stats: endings discovered, best stars, last 10 results |

Typical sizes (measured with `tools/simulate.js` on 140-day games): a save record is about 4 KB at the start and at most about 30 KB late in the game. Most of that is the 300-entry adventure log. All keys together stay under about 160 KB.

---

## 1. `settings`

```jsonc
{
  "schema": 2,
  "musicVolume": 0.5,   // 0..1
  "sfxVolume": 0.7,     // 0..1
  "speed": 1,           // game speed: 1 (default), 2 or 4 — animations and bot turns
  "showTips": true      // reserved
}
```
Missing fields are filled from defaults on load (`Object.assign(DEFAULTS, stored)`), so adding a setting never needs a migration. (v1 stored `botSpeed`; it is ignored.)

## 2. Save records: `slot:N` and `autosave`

```jsonc
{
  "schema": 2,                        // = DATA.SAVE_SCHEMA
  "meta": {                           // shown on the Load/Save screen without parsing the whole state
    "slot": 3,                        // 1..4, or "auto"
    "savedAt": "2026-09-28T02:57:39.000Z",
    "name": "Moss", "classId": "shaman", "className": "Apprentice Shaman",
    "level": 17, "day": 48, "stars": 5, "gender": "f", "color": "#e8553d"
  },
  "state": { /* GameState, see §3 */ }
}
```

**When saving is allowed:** only on the human's own turn, before rolling (`state.phase === "preRoll"`), never while a battle scene is open, and never when the turn opened straight into an unfinished fight (spec §1, §6). Loading therefore always resumes at the start of the human's pre-roll phase. `Game.start(state)` re-enters `playTurn()`, which is idempotent at that point.

**Overwrite:** writing to an occupied slot requires confirmation in the UI. **Delete:** `Save.deleteSlot(n)` removes the key after confirmation.

## 3. `GameState` (the `state` object)

The entire game is one plain JSON object (`Game.state`). Nothing else needs to be persisted: map geometry, decorations and all balance numbers are rebuilt from `js/data.js`.

```jsonc
{
  "schema": 2,
  "version": "2.0.0",                 // DATA.VERSION that created the save
  "createdAt": "ISO date",
  "rules": { "days": 140 },           // 140, or 0 = Endless
  "day": 48,                          // 1..rules.days (unbounded in Endless)
  "turn": 0,                          // index into players (0 = human)
  "phase": "preRoll",                 // preRoll | acting | battle | between | start
  "players": [ /* Player ×4, see §3.1 */ ],
  "army": {                           // Demon Lord Army; HP persists between battles
    "B01": { "hp": 460, "maxHp": 460, "cd": { "special": 0, "specialDef": 0 }, "defeated": false },
    "B02": { … }, "B03": { … }, "B04": { … }            // B04 = Demon Lord
  },
  "minion": null,                     // or { "zone": 2, "spaceId": "2-e07", "hp": 480, "maxHp": 480, "cd": {…} } — never on a building
  "minionNextDay": 3,                 // first spawn day 3; after a defeat = defeat day + 2
  "dlDefeated": false,                // → everyone rolls 2 dice, hero duels give 1 ⭐
  "head": { "holder": null, "space": null },   // Demon Lord's Head: held by player id, or dropped on a space id
  "chests": { "1-t03": 9 },           // treasure space → day it was opened (empty for 3 days)
  "traps": [ { "space": "3-e05", "owner": 2 } ],   // Monster Traps (MB03)
  "battles": [ /* unfinished fights, see §3.2 */ ],
  "nextBattleId": 14,
  "request": {                        // current King's Request (spec §11), or null
    "id": "bounty", "icon": "🎯", "event": "killKey", "key": "tiger",   // key: monster key or building space id when relevant
    "text": "Defeat a Striped Tiger", "n": 1, "day": 43, "ends": 49, "reward": 600,
    "progress": { "0": 0, "2": 1 },   // player id → progress this week
    "winner": 2                       // player id who completed it first, or null
  },
  "requestsDone": 6,
  "flags": { "castleIntro": false, "dlMet": false, "generalMet": { "B01": true } },  // one-time dialogues
  "log": [ { "day": 48, "text": "Moss rolled 4.", "icon": "🎲", "who": 0 } ],        // last 300 events (Log ledger); who = player id | "minion" | "king"
  "over": false,
  "ending": null,                     // "good" | "bad" | "secret" once over
  "deliveredBy": null                 // player id who delivered the head
}
```

Space ids are `"<zone>-<code>"`, e.g. `1-L01` (Royal Castle), `4-B04` (Demon Lord's Castle); see spec §7.2. The v2 map is completely different from v1, so **v1 saves cannot be loaded**. They are listed as "Saved by an older version" and can only be deleted.

### 3.1 Player

```jsonc
{
  "id": 0, "name": "Moss", "isBot": false, "gender": "f", "color": "#e8553d",
  "classId": "shaman",                // key of DATA.CLASSES
  "level": 17, "exp": 23, "freePts": 0,
  "base": { "hp": 330, "at": 9, "df": 22, "sp": 48 },  // before equipment, charm % and passives
  "hp": 301, "money": 1640, "stars": 5,
  "spaceId": "2-e04", "respawnId": "2-L05",
  "equip": { "weapon": "S3", "armor": "A3", "charm": "C03" },   // DATA.EQUIP (W/S/A + tier 1–8) / DATA.CHARMS keys, or null
  "items": ["I04", "I06"],            // Item tab, max 6 (DATA.ITEMS keys)
  "books": ["MB02"],                  // Spellbook tab, max 6
  "special": "SK2", "specialDef": "SD1",          // DATA.SKILLS keys
  "cd": { "special": 0, "specialDef": 0, "classMove": 1 },   // days remaining
  "jobExp": { "shaman": 6, "commoner": 10 },
  "mastered": ["commoner"],           // mastery bonus applies on every level-up
  "unlocked": ["commoner", "shaman", "slingshot", "warlord"],
  "merit": 1, "usedLarb": false, "wentAllIn": false,          // secret-class unlock progress
  "buffs": { "dice": 0, "energy": false, "eater": false },    // next roll / next battle
  "battleId": null,                   // locked in a fight → id in state.battles
  "down": 0, "downReason": null,      // turns left to skip after a KO ("ko") or giving up ("giveup")
  "itemUsed": false,                  // one item per turn
  "turnOver": false,                  // the turn was used up early (KO, Challenge Letter duel)
  "record": { "monsters": 14, "heroesBeaten": 1, "army": 1, "treasures": 3, "deaths": 1, "requests": 2 },
  "botMem": {}                        // bot-only memory (off-branch decisions, castle/temple menu)
}
```

### 3.2 Battle (unfinished fights only)

```jsonc
{
  "id": 13, "kind": "army",           // "monster" | "army" | "duel"
  "space": "2-B02",
  "armyKey": "B02",                   // "minion" | "B01".."B04" for army; null otherwise
  "enemy": null,                      // monsters only: { "key": "wolf", "mult": 1, "e04": false, "hp": 20, "maxHp": 115, "specialDay": 0 }
  "parts": [0, 2],                    // heroes in the fight (duels: exactly 2)
  "first": { "0": "hero", "2": "hero" },          // monster/army: who attacks first per participant (kept across days)
  "mods": { "0": { "energy": true, "eater": false, "vines": false } },   // per-battle buffs/debuffs
  "reserve": 0,                       // duels that will hand this fight back to their winner (brawls, spec §6.4)
  "firstId": 2,                       // duels only: the hero who attacks first
  "resume": 11                        // duels only: fight the winner rejoins afterwards, or null
}
```

Army enemy HP/cooldowns live in `state.army[key]` or `state.minion`, not in the battle, so they persist after every participant leaves.

## 4. `records`

```jsonc
{
  "schema": 1,
  "gamesPlayed": 3, "wins": 1, "bestStars": 24,
  "endings": { "good": true, "bad": true, "secret": false },   // "Endings discovered x/3" on the title screen
  "history": [ { "date": "ISO", "ending": "good", "rank": 1, "stars": 24, "winner": "Moss" } ]   // newest first, max 10
}
```

## 5. Versioning & migration

* `schema` in every save record is compared with `DATA.SAVE_SCHEMA` (currently `2`).
* `Save.migrate(record)` runs before validation. It is the single place to upgrade old saves. v1 → v2 is not upgradeable because the map changed.
* `Save.validState(state)` checks the structural minimum (schema, 4 players, day/turn numbers, army/head/battles). Invalid records show as **corrupted**, and records with another schema show as **older version**. Both can be deleted but not loaded.
* A breaking change should bump `DATA.SAVE_SCHEMA`, add an upgrade step in `migrate` when possible, and keep the `soleblessed:v1:` prefix unless the key layout itself changes.

## 6. Clearing data

From the browser console: `Object.keys(localStorage).filter(k => k.startsWith('soleblessed:')).forEach(k => localStorage.removeItem(k))`.
