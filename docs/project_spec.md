> **Revision 2 (2026-09-28).** 140-day / Endless modes · walk the exact roll · new 251-space map · max level 50 with full heal on level-up ·
> classes change only at the Royal Castle / Temples · 3-round duels that continue until someone is knocked out or gives up · forced battle
> screen · no fights inside buildings · walking into a fight is not optional · 2 turns to resurrect / stand up · rebalanced items, equipment
> (8 tiers) and enemies (3 monsters per zone) · Log ledger · game speed 1×/2×/4× · King's Requests · victory poses · shareable results.
>
> **Revision 2.1 (2026-09-29).** 1 turn to resurrect / stand up (the minion still returns after 2 days) · no items during a fight, in any round
> (heal before you roll) · Sand Scorpion General and Demon Lord retuned for fights without healing.

### 0. General Requirements

- The game "Sole blessed" is a turn-based board game combined with an RPG, played in a web browser.
- Pure HTML, CSS, and JavaScript; no external libraries. Separate files by system
(data.js stores all game data, map.js, battle.js, ui.js, bot.js, save.js).
- Draw with Canvas in an angled (2.5D) view; do not use external image or sound files
Graphics are drawn with code or emojis; sound uses the Web Audio API.
- Save the game with localStorage, supporting computers and mobile devices.
- UI: cream-colored frames, orange-gold borders, rounded corners, cartoon style, centered modal windows, darkened background.
- Every button can be clicked/tapped and has a shortcut-key label. Disabled buttons are gray and explain why
Important actions (buying, deleting, changing class, donating, quitting the game) require confirmation first.
- During a bot's turn, command buttons are disabled (except Pause and Log). The bottom-right corner always displays "[Name]'s turn".

Controls

| Situation | Keys |
| --- | --- |
| Normal play screen | Q Move, O Inventory, I Free Camera, X Status, L Log, Z How to Play |
| While moving | W/A/S/D Move (walk every step), E Free Camera, I Auto-Move, O Status, N Full Map, Enter confirm Auto-Move |
| Battle | W/A/S/D Select command (up/left/down/right), Z Enemy Info (no items during a fight) |
| Menu | W/A/S/D Select, Enter Confirm |
| All situations | ESC closes a window; if no window is open, it opens the Pause Menu |

### 1. Screens

- Start screen: game title and the opening text "{game_dialogue Starter game cinematic}" (shown on its own, without a "System" label). Buttons: Start Game / Load Game / Settings
- Character creation: name 1–12 characters, male/female, choose from 3 Tier 1 class cards, and the game length (140 days or Endless).
"Begin Journey" button (enabled once all selections are complete). Bots randomly choose a name, gender, and class.
- Dialogue scenes (dialogue box; Enter/tap to continue; Skip button): look up in game_dialogue.md
- Save Game: 4 slots showing name, class, level, day, stars, and save time (empty slots show "Empty"); an Autosave row (start of your last turn) is listed under the slots.
Opened from the Start screen = Load/Delete; opened from the Pause Menu = Save (overwriting requires confirmation).
- Settings: music and sound-effect sliders, game speed (1× default, 2×, 4×), key table, summarized How to Play (opened with Z).
- Pause Menu: Resume / Save (available only on the user's turn before rolling) / Settings / How to Play / Exit to Start Screen

### 2. Rules

- In the Kingdom of Arendore, the Demon Lord has returned to threaten the world. The king searches for heroes;
the one with the most outstanding achievements will receive the "King's Blessing" and may ask for one thing.
- 4 players (1 user + 3 bots) play in order, one turn each. All 4 turns = 1 day.
- Game length (chosen on character creation): **140 days** (default) or **Endless** (no day limit; the game ends when the Demon Lord's Head is delivered).
Simulated 4-bot games (160 games, 140 days): Generals fall around days 32 / 68 / 104; the Demon Lord falls in ≈45% of bot-only games, around day 128.
Endless games reach the Demon Lord's defeat around day 149.
- Before the Demon Lord is defeated, all heroes roll 1 die each turn (the minion still rolls 1 die). After the Demon Lord is defeated, all heroes roll 2 dice each turn.
- The game has 3 endings
    - **Good Ending:** If the players successfully bring the Dark Lord's head to the royal palace, they are considered victorious, leading to the Good Ending.
    - **Bad Ending:** If the players fail to defeat the Dark Lord within 140 days, they lose and trigger the Bad Ending.
    - **Secret Ending:** If the players obtain the Dark Lord's head but fail to deliver it to the royal palace within 140 days, they lose and trigger the Secret Ending.
    - In Endless mode only the Good Ending is possible.
- Stars: Minion 1, General 2, Demon Lord 3, deliver the Demon Lord's Head 5,
defeat another hero after the Demon Lord is defeated 1, event E04 1, King's Request 1 (§11).
- The player with the most stars wins (ties are decided by money, then level). In-game rankings use the same criteria.
- Results screen: the king says "You have all helped save the kingdom, but one of you has achieved
the greatest deeds…step forward to receive the King's Blessing!" Then show ranks 1–4 (stars, money, level), with "Share image" (S) and "Copy text" (C) buttons (§13).

### 3. Game Screen and Movement

3.1 Normal Play UI

- Top-left: "Day 5 / 140" box ("Day 5 / ∞" in Endless) and Pause button
- Top-center: the current King's Request with your progress and days left (tap for details)
- Top-right: active-player panel (level, name, class, rank, stars, money, AT/DF/SP, HP bar), 20 px wider and taller than v1 with larger portrait, text and HP bar.
Tap the panel or press X to open the Status screen.
- Left edge: vertical circular buttons Q Move, O Inventory, I Free Camera, X Status, L Log (the Log button shows a red badge with the number of unread entries)
- Bottom edge: compact panels for the other 3 players (portrait, level, name, stars, HP bar)
- Bottom-left: "Z How to Play" / the current player's standing space is highlighted in a different color
- Log ledger (L): a clipboard pop-up in the center of the screen, scrollable (W/S), newest first and grouped by day.
Each row: the player's / other's avatar on the left, the text in the center, and the action icon on the right. It keeps the last 300 entries.
- Game speed: 1× by default; 2× and 4× in Settings (applies to animations and bot turns). During a bot's turn the user can press Enter to skip ahead to a summary.

3.2 Movement Rules

- Press Q to spin the dice; press Q or Enter to stop. Roll 1–6 (after the Demon Lord is defeated, roll 2 dice)
Double/Triple Dice items add 1/2 dice, then total the result.
- You must walk **exactly** the rolled number of spaces. A route may not pass through the same space twice.
If no route of exactly that length exists (dead end), the turn is skipped.
- Blocking spaces (an undefeated General or the Demon Lord's Castle): stepping onto one ends the move there (even with steps left); you cannot pass through.
- A space's effect occurs only on the space where you stop.
- Stop on a space occupied by another hero → you may challenge them (except someone locked in battle, resting, or inside a building).
- Stop on a space where a fight is in progress → you must enter it (§6.4).
- If you start your turn on a space where a Demon Lord Army battle is in progress → you may choose to join instead of rolling.
- If you are locked in an unfinished battle → you do not roll; the battle screen opens immediately.
- If you are resting (knocked out or gave up, §4) → the turn is skipped.

3.3 Movement Method and UI While Moving

- While moving, hide the UI from 3.1. Every space where the move can end shows a bobbing 🚩 destination flag and blinks; blocking spaces are red.
Spaces occupied by players or minions, and spaces where the Demon Lord's Head has fallen, show icons above them.
- Top-left: command panel E Free Camera, I Auto-Move, O Status, N Full Map
Bottom-left: "3 steps left — you must walk every step"
- Manual movement: W/A/S/D one space at a time. Small arrows only show directions that can still finish exactly on the roll. Pressing the reverse direction cancels a step
(returning the space). When 0 steps remain (or you step onto a blocking space), the move ends automatically.
- Auto-Move (always used by bots): press I, then use A/D to cycle the destinations (blinking arrow, space-type label,
and dotted route). Press Enter or tap to confirm; ESC cancels. The character walks one space at a time with animation. On touch screens, tap a flagged space.
- Free Camera: move the camera with W/A/S/D or drag. Full Map: zoom out to show the entire map
with player, enemy, Demon Lord's Head, respawn-point icons, and zone names. ESC closes either mode.

### 4. Characters

- Stats: HP health, AT attack power, DF base damage reduction, SP special power
- Starting at level 1: HP 30, AT 5, DF 3, SP 5, money 300 G
Displayed values include equipment and charms. Decimals are rounded to the nearest whole number (.5 rounds up).
- Maximum level 50. EXP required = 10 × current level (excess carries over).
- EXP gained = enemy EXP × (1 + 0.1 × (enemy level − player level)), with the multiplier capped at 0.5–2.
- On level-up: HP +10, class-based stats, mastery bonuses for every mastered class,
2 free points (1 point = HP +5 or AT/DF/SP +1), and **HP is fully restored**. The "Level Up!" window allows points to be assigned.
- When HP reaches 0 (knocked out): return to the respawn point with full HP, lose 10% of money, and **skip the next turn while resurrecting** (🪦 on the map).
The initial respawn point is the Royal Castle. It can be reset at a temple or the Royal Castle
(one respawn point at a time; shown as a colored flag on the map).
- Giving up: HP unchanged, stay on the same space, and **skip the next turn while standing up** (😵). Resting heroes cannot be challenged or ambushed.
- For the holder of the Demon Lord's Head who loses:
    - Loses to another hero (including surrender): the head immediately moves to the winner.
    - HP reaches 0 from a monster or Demon Lord Army: the head drops on that space
    The first hero to stop on that space takes the head (passing through does not take it).
- Status screen (X or O while moving, or tap the top-right panel; bots can be viewed in read-only mode):
portrait, name, class, level, rank, stars, money, EXP bar, stats (Passive/charm results shown in green)
equipment, Job EXP, all moves with cooldowns, mastered classes, respawn point, resting state. (No "Change Class" button — see §5.)

### 5. Classes

- Classes can only be changed at the **Royal Castle** or a **Temple**: stopping there opens a menu (Change Class / Set Respawn Point / Make Merit (temple) / Leave).
Tier 1 classes are always available; other classes must be unlocked. After changing, your level and existing stats remain.
- Every class has separate Job EXP, up to 10 (defeat a monster +1, Demon Lord Army +2)
At 10, the class is mastered: gain its mastery bonus on every level-up for the rest of the game and unlock Tier 2 of the branch.
- Magic classes use SP instead of AT for base damage in all cases.
- Class moves are not reduced or countered by Defend/Counter.

| Class | Unlock | Level-up | Mastery | Passive | Class move | Victory pose |
| --- | --- | --- | --- | --- | --- | --- |
| Sword-wielding Commoner | Starting class | HP+10 AT+1 | HP+5 | Beginner: AT +20%, but every attack has a 50% chance to deal −20% damage | Full-force Slash: Base ×2 + SP (CD 2) | Raises the bamboo sword to the sky ✨ |
| Hotheaded Sword Warlord | Master Sword-wielding Commoner | HP+10 AT+1 DF+1 | DF+1 | Hotheaded: AT +50%, but every attack has a 20% chance to miss | Furious Slash: Base ×2.5 + 30% of lost HP (CD 3) | Roars and slams the giant sword down 💢 |
| Apprentice Shaman | Starting class | DF+1 SP+2 | SP+1 | Novice Caster: SP +20%, but every attack has a 50% chance to deal −20% damage | Crooked Fireball: SP ×3.5 (CD 2) | Twirls the crooked staff in sparks 🔥 |
| Loquacious Archmage | Master Apprentice Shaman | HP+10 SP+2 | SP+1 | Loose Tongue: At the end of your turn, 50% chance to reduce the cooldown of a Special/Class move by 1 day | You B#!$!: SP ×4.5 (CD 2) | Won't stop talking about it 💬 |
| Slingshot Lad | Starting class | AT+2 SP+1 | AT+1 | Keen Eyes: Attack/Strike has a 20% chance to critically hit for ×1.5 | Rubber Band Shot: Base ×1.5 + SP (CD 2) | Pings a pebble at the sun ⭐ |
| Cross-eyed Bow Warlord | Master Slingshot Lad | AT+2 SP+1 | AT+1 | Cross-eyed: Attack/Strike has a 30% chance to critically hit for ×2, with a 10% chance to miss | Wild Arrow Barrage: 3 arrows, each dealing (Base + SP) ×0.7; calculate Passive separately (CD 2) | Fires a victory arrow in a random direction 🏹 |
| Isan Person | Use Larb for the first time | HP+10 AT+2 | AT+1 | Adventurous Eater: HP-restoring items are 50% more effective, and using one grants AT +40% for the next battle | Spicy Sizzle: AT ×3.5 and restore HP equal to 50% of damage dealt (CD 2) | Celebrates with sticky rice 🍙 |
| Gambler | Go All-in at the horse-racing track (win or lose) | HP+10 AT+1 SP+1 | HP+5 | Lucky: When HP reaches 0, 50% chance to revive with 20% HP | All-In: 50% chance to succeed and deal SP ×2, then roll again; up to 5 times (CD 1) | Catches a jackpot of coins 🪙 |
| Temple Kid | Make merit 3 times | HP+10 AT+1 DF+1 | DF+1 | Blessed Merit: At the start of a new day, restore 10% HP | Alms Round: (50% of opponent's AT + 50% of opponent's SP) (CD 3) | Bows with a respectful wai 🙏 |
- Class Change screen: 9 cards (3 main branches in rows, Tier 1 → 2, plus 1 off-branch row)
Show name and current Job EXP. Current class = gold frame; locked = gray with padlock; mastered = star
Details and the "Change to This Class" button (confirmation required) appear on the right.

### 6. Battle

6.1 Order and Duration

- Start immediately with a two-card face-down mini-game. The card marked "Go First" attacks first (bots resolve randomly).
- 1 round = each side attacks once. Both sides choose commands simultaneously and reveal the results simultaneously.
- Up to 3 rounds per turn against monsters, the Demon Lord Army **and other heroes**. If unfinished, the fight continues on that hero's next turn
(HP persists, the player remains on the same space, and cross-day battles keep the same order).
- **Forced battle screen:** a hero locked in an unfinished fight goes straight to the battle screen at the start of their turn (no Move/Inventory menu).
- **No items during a fight**, in the first round or any later one: HP carries over between turns until the fight ends, so heal before rolling.
- Intended duration (hero at the enemy's tier, solo, no healing): monsters ~1.3 days (mostly 1), minions ~1.7 days, Generals ~2 days,
Demon Lord ~3 days; a lone hero beats a General or the Demon Lord about half the time, so team up. Duels continue until someone is knocked out or gives up (no draws).
- If the player loses or surrenders: a monster disappears (unless another hero is still fighting it); the Demon Lord Army remains in place with its lost HP preserved.
- **No fighting inside buildings** (Royal Castle, shops, temple, Larb shop, horse track): heroes there cannot be challenged, and the minion never stops on a building.

6.2 Commands and Damage

| Position/Key | Attacker | Defender |
| --- | --- | --- |
| Top W | Special move | Special Defense |
| Left A | Strike | Counter |
| Right D | Attack | Defend |
| Bottom S | Class move | Give Up |
- Base damage = AT × 2 − enemy DF (minimum 1). Moves calculated directly from AT/SP do not subtract DF
| Attack \ Defense | Defend | Counter |
|---------|--------|---------|
| Attack | Defender takes ×0.5 | Counter fails; defender takes ×1.5 |
| Strike | Defender takes ×2 | Counter succeeds; attacker takes defender's base damage ×1.5 |
- Special/Class moves are not reduced by Defend/Counter. Special Defense that does not cover that attack = ×1 damage.
- Cooldowns are counted in days and decrease by 1 at the end of the day, including the day used (CD 2 used on day 5 → available on day 7).
- Give Up: counts as a loss but does not kill the player; HP remains unchanged, the player stays on the same space and rests for 1 turn.
Surrendering to an enemy loses 10% of money; surrendering to another hero grants the same reward as a win.

6.3 Heroes Fighting Each Other (duels)

- Can happen throughout the game: challenge after stopping on the same space, use a Challenge Letter (MB04: the caster rushes to the target's space), or pick a hero when walking into a fight (§6.4). Always one-on-one.
You cannot challenge someone who is locked in battle, resting, or inside a building.
- 3 rounds per turn. If nobody falls, the duel continues on each duelist's next turn until one is knocked out or gives up.
- The winner chooses one item to steal: 20% of money, 1 piece of equipment (equip it instead or discard it), or 1 item
Gain EXP = 40 × level difference if lower level than the loser, gain 1 star if the Demon Lord has been defeated,
and immediately take the Demon Lord's Head if the loser is holding it.

6.4 Walking Into a Fight (monsters and Demon Lord Army, up to 4 heroes)

- Stopping on a space where a fight is in progress is not optional. Choose your opponent:
    - **Fight the enemy**: join as an ally (no mini-game; the team attacks first).
    - **Attack one of the heroes** there: a duel starts; that hero leaves the enemy fight while it lasts. The duel winner then takes over the enemy fight on their next turn.
- Against a **monster**, the fight goes on after it falls: the heroes still standing in that fight must duel each other.
Demon Lord Army fights are co-operative: after the army enemy falls, allies part peacefully.
- You may also choose to join a Demon Lord Army battle on your space instead of rolling.
- Each player fights for no more than 3 rounds during their own turn. The enemy attacks only the active player; enemy HP and cooldowns are shared.
- Cooperation bonus: damage +10% per additional participant (maximum +30%).
- Rewards: the finisher receives the star, full EXP, money, and drop. Other participants receive 50% EXP and money, and Job EXP.

6.5 Battle UI

- Zone-based background; player on the left, enemy on the right, allies in the back row on the left with compact HP bars
- Top: gold circular level badge, numeric HP bar, name labels for both sides, a burst-star "VS" in the center
and a "Round 2 / 3" counter. HP bars slide down and turn red below 25%.
- Center: AT, DF, SP comparison bars (player left, enemy right), and a "Z Info" button to view enemy moves.
- Starting cards appear below the characters; select with A/D and flip simultaneously.
- "Attacker" label in red / "Defender" label in blue. Four diamond-shaped command buttons
Enemy buttons are dark gray; cooldown buttons show days remaining. After selection, show "Waiting for opponent…"
- Reveal: command name above each character, animation, bouncing damage numbers, summary text
- End: the winner strikes their class's **victory pose** (§12), then the Win/Loss/Surrender window with EXP, Job EXP, money, stars, and items gained or lost
If unfinished, show "The battle will continue on the next day." / "The duel goes on!"

### 7. Map

7.1 Structure

- Fixed, non-random networked Sugoroku map on an island, larger than the screen; the camera follows the active player.
- Stored as a graph: each space has an id, x/y, type, zone, and list of connected spaces.
- 4 zones connected through one General space each. Zone 1 is southwest, Zone 2 northwest,
Zone 3 northeast, Zone 4 southeast (Zone 1 and Zone 4 are separated by sea; a wooden bridge crosses the strait between Zone 2 and Zone 3).
- Empty spaces spawn 3 monster tiers per zone: tier 1 near the zone entrance, tier 3 near the General (by the space's depth between the entrance and the General; 20% chance of the tier below, 12% of the tier above).

| Zone | Name | Spaces | Shortest distance to General/Demon Lord | Target level | Offset (column, row) |
|-----|-----|-----|------------------------|-------------|---------------------|
| 1 | Kingdom of Arendore | 48 | 13 (from the Royal Castle) | 1–12 | 0, 10 |
| 2 | Forest | 60 | 14 | 13–24 | 5, 1 |
| 3 | Desert | 78 | 16 | 24–36 | 15, 0 |
| 4 | Demon Lord's Land | 65 | 16 | 37–50 | 15, 12 |

7.2 Layout

- Spaces connect only when a pair has a ── or │ line between them; adjacent spaces without a line are not connected.
A │ may sit under the first or the middle character of a space code.
- Actual position = (column, row) in the layout + the zone offset; row 0 is at the top, 1 space = 120 px. Columns are 5 characters wide.
- Full code = zone-code (e.g. 1-e01). The leading letter indicates the type (Section 7.3).
- Cross-zone connections: 1-B01–2-e01, 2-B02–3-e01 (bridge), 3-B03–4-e01
- Duplicate codes in the drawn map were renamed: Zone 1's second `t04` (row 5) is `t07`; Zone 2's second `e30` (row 3) is `e41`.

Zone 1
                              B01
                               │
e29──L04──e30       t05──e33──e34──e35
│          │         │              │
e28       t04       e31──e32──L02──t06
│          │         │              │
e24──e25──e26──e27──e15──e16──e17──e18
│                    │              │
e23       e22──L07──e14            e19
│          │         │              │
e20──t03──e21       e13──e12──t07──e11
│                                   │
e04──L01──e01──e05──t02            e10
│          │         │              │
e03──t01──e02──e06──e07──e08──L03──e09

Zone 2
               e46──e47──L02──e48
                │              │
e39──L04──e40──t06──e42──e43──e44──e45──B02
│          │    │              │    │
e35       e36──e37            e38  t05
│          │    │              │    │
e30──e41──e31──e32            e33──e34
│          │                   │
e26       e27──t04──e28       e29
│                    │         │
e20──L03──e21──e22──t03──e23──e24──L05──e25
│          │                   │         │
e16       e17                 e18       e19
│          │                   │         │
e09──t02──e10──e11──e12──e13──e14──L06──e15
│                         │              │
e02──e01──e03──e04──e05──t01──e06──e07──e08

Zone 3
                              e15──L02──e16
                               │         │
     e10──e11──L05──e12       e13       e14
      │              │         │         │
e01──e02──e03──e04──e05──e06──e07──e08──e09──t01
      │    │    │              │              │
     e17──t02  e18       e19──e20──e21       e22
      │         │         │         │         │
     e23──e24──e25──t03──e26──L03──e27──t04──e28
      │                                  │
     e29──e30──e31──e32──e33──e34──e35──e36
      │         │              │         │
     e37──t05──e38            e39       e40──e41
      │         │              │              │
     e42       e43──e44──e45──e46──t06──e47──e48
      │         │         │         │    │
     e49       e50       e51       e52  e53
      │         │         │         │    │
     e54       e55──L04──e56──e57──e58──t07──e59
      │         │         │         │         │
     t08──e60──e61──e62──e63       e64──B03──e65

Zone 4
                                        e01
                                         │
e02──L04──e03       e04──e05──e06──e07──e08──e09
│          │         │         │              │
e10──t01──e11──e12──e13──t02──e14            e15
│               │                             │
e16       e17──e18                           e19
│          │                                  │
e20──t03──e21──e22──e23──e24──e25──e26──L05──t04
│                    │         │              │
e27──e28──L03──e29──t05──e30  e31            e32
│               │         │    │              │
e33──e34──e35──e36       e37  e38──L02──e39──e40
      │                   │         │         │
     e41──e42──B04──e43  e44       e45       e46
      │              │    │         │         │
     t06──e47──e48──e49──e50──e51──e52──t07──e53

7.3 Space Types and Locations

| Code | Name | Color | Effect on Stop |
| --- | --- | --- | --- |
| e | Empty space | Yellow | 70% fight a zone monster (tier by depth, §7.1), 30% event |
| t | Treasure space | Green | 50% item, 20% spellbook, 20% money (150 / 600 / 1,350 / 2,400 G by zone), 10% charm. Once opened, becomes an empty chest for 3 days (show open chest) |
| B01–B03 | Demon Lord General | Dark purple | Fight the General; after victory, becomes an empty space |
| B04 | Demon Lord's Castle | Black with red border | Fight the Demon Lord; after victory, becomes an empty space |
| L01 | Royal Castle | Orange + building | Starting point, first respawn point. Menu: Change Class / Set Respawn Point / Leave. Deliver the Demon Lord's Head here |
| L02 | Shop | Orange + building | Sells 6 items (stock depends on the zone, §8.2) |
| L03 | Equipment Shop | Orange + building | Sells the zone's 2 equipment tiers: 6 pieces (after buying, the old item is automatically sold for 50%) |
| L04 | Skillbook Shop | Orange + building | Sells 1 each of zone-level Special moves, Special Defense, and spellbooks |
| L05 | Temple | Orange + building | Menu: Change Class / Set Respawn Point / Make Merit (donate 10% of money, once per stop) / Leave |
| L06 | Larb Shop | Orange + building | Sells Larb (I01) for 100 G each (Zone 2) |
| L07 | Horse-Racing Track | Orange + building | Bet once per stop; must have at least 100 G. Bet 10%, 50%, or all-in; choose 1 of 6 horses. A correct choice pays 5× (Zone 1) |
- Shop UI: product list on the left (price red when money is insufficient), details on the right
(equipment comparison with current item: increases in green, decreases in red). Buttons: Buy / Sell (half price) / Exit

### 8. Events, Items, Equipment, and Skills

8.1 Events (from Empty Spaces)

| Code | Name | Effect | Chance |
| --- | --- | --- | --- |
| E01 | Training Ground | Forced: randomly choose 1 stat; 50% +1 point / 50% −1 point | 30% |
| E02 | Kind Doctor | Choose: pay 10% to restore full HP | 30% |
| E03 | Dropped Money | Forced: gain 60 / 240 / 540 / 960 G by zone | 30% |
| E04 | Townspeople Request Help | Choose: fight the zone's tier-3 monster (HP, AT ×1.3); win to gain 1 additional star | 10% |

8.2 Inventory (opened/closed with O)

- 2 tabs, 6 slots per page (3 × 2 grid): Items and Spellbooks. Quest items are shown separately and do not use slots.
- Use 1 item per turn, before rolling. Items cannot be used during a fight (I07 activates automatically and does not count).
- When the inventory is full after obtaining a new item → choose to discard the old item or the new item. Items can be sold at shops for half price.
- Spellbooks used on others can target anywhere on the map. If the target has I07, the effect is canceled and I07 is removed.
- Item Shop stock: Zones 1–2 = I02, I03, I04, I05, I06, I07; Zones 3–4 = I02, I03, I05, I06, I07, I08.

| Code | Name | Effect | Price |
| --- | --- | --- | --- |
| I01 | Larb | Restore 40% HP (sold only at the Larb Shop) | 100 |
| I02 | Double Dice | Add 1 die to the next roll | 100 |
| I03 | Triple Dice | Add 2 dice to the next roll | 250 |
| I04 | Herbal Balm | Restore 30% HP | 80 |
| I05 | Angelic Inhalant | Restore 70% HP | 200 |
| I06 | Energy Drink | AT +20% in the next battle | 120 |
| I07 | Anti-Magic Talisman | Block 1 spellbook from another player | 150 |
| I08 | Royal Elixir (new) | Restore 100% HP (Zones 3–4 shops, treasure, Sand Wyrm / Lava Golem drops) | 650 |
| MB01 | Homecoming Tome (Zone 1) | Warp to the respawn point (cannot use while holding the Demon Lord's Head) | 100 |
| MB02 | Pickpocket (Zone 2) | Steal 1 random item from the target's Item tab | 250 |
| MB03 | Monster Trap (Zone 3) | Place a trap on an empty space within 6 spaces. The first person to stop there (except the placer) fights a monster from the next zone (Zone 4 uses Zone 4 monsters) | 500 |
| MB04 | Challenge Letter (Zone 4) | Challenge a hero within 6 spaces (not inside a building); the caster rushes to their space and the duel starts at once | 800 |
| IQ01 | Demon Lord's Head | Obtain from the Demon Lord. Stop at the Royal Castle to receive 5 stars and end the game. If defeated by a hero, the head moves to the winner; if defeated by an enemy, the head drops on the space. Cannot be sold, discarded, or stolen by magic | - |

8.3 Equipment (weapon, armor, charm slots; empty at game start; all classes can equip). 8 tiers, 2 per zone.

| Tier (zone) | Suggested level | AT Weapon | SP Weapon | Armor | Price/piece |
| --- | --- | --- | --- | --- | --- |
| 1 (Zone 1) | 1+ | Bamboo Sword AT+3 | Tamarind Branch Staff SP+3 | Buffalo Leather Shirt DF+2 HP+10 | 150 |
| 2 (Zone 1) | 6+ | Iron Machete AT+6 | Bodhi Leaf Wand SP+6 | Rattan Scale Vest DF+4 HP+25 | 450 |
| 3 (Zone 2) | 13+ | Steel Sword AT+10 | Vine Staff SP+10 | Iron Armor DF+7 HP+45 | 1,100 |
| 4 (Zone 2) | 19+ | Tiger Fang Blade AT+15 | Firefly Lantern Staff SP+15 | Teak Guard Plate DF+10 HP+70 | 2,000 |
| 5 (Zone 3) | 24+ | Desert Sword AT+21 | Amber Rod SP+21 | Sandscale Armor DF+14 HP+100 | 3,400 |
| 6 (Zone 3) | 30+ | Sunforged Scimitar AT+28 | Mirage Scepter SP+28 | Pharaoh's Mail DF+19 HP+140 | 5,200 |
| 7 (Zone 4) | 37+ | Demon-Slaying Sword AT+36 | Star Rod SP+36 | Hero's Armor DF+25 HP+190 | 7,600 |
| 8 (Zone 4) | 44+ | Blessing Blade AT+45 | Naga Moon Staff SP+45 | Royal Garuda Armor DF+32 HP+250 | 10,500 |
- Charms (not sold; obtained from Generals, treasure spaces or minions) scale with the hero: C01 Boar Fang AT +10%, C02 Fang-Guard Talisman DF +10%,
C03 Mage's Ring SP +10%, C04 Lucky Coin: money from battles +25%, C05 Jade Amulet (new): Max HP +10%

8.4 Skills (1 of each; none at game start; buy at L04 to replace the current move)

| Zone | Special move | Special Defense | Price |
| --- | --- | --- | --- |
| 1 | Tiny Fireball: SP ×2 (CD 2) | Power Recovery: restore HP = SP ×2 before being attacked (CD 2) | 400 |
| 2 | Life Drain: SP ×1.5; restore HP equal to damage dealt (CD 3) | Stone Armor: damage −40% (CD 2) | 1,600 |
| 3 | Sandstorm: SP ×4 (CD 3) | Reflective Mirror: reflect all Special/Class moves back (CD 3) | 3,800 |
| 4 | Heavenly Light Sword: (AT + SP) ×2.5 (CD 3) | Holy Shield: take no damage this time (CD 4) | 7,500 |

### 9. Enemies

Enemy stats are tuned with `tools/balance.js` against simulated bot heroes: monsters for the level at which heroes first meet them, bosses for their own level.

9.1 Demon Lord Army

- Demon Lord: resides in the Demon Lord's Castle (B04). Before battle, says "Come and get me, you pathetic hero."
- Demon Lord Generals: guard spaces B01–B03. After victory, they disappear permanently, opening the route and clearing that zone
Before battle, they say "Do you really think you can simply pass through this land?"
- Demon Lord Minion: 1 exists at a time. The first spawns on day 3; **after being defeated, it returns 2 days later**.
It spawns on a random empty space with no players in the zone after the latest-cleared zone
(if no zone has been cleared, the maximum is Zone 1; otherwise use the next zone), with a notification to everyone.
    - At the end of each day, roll 1 die and move toward the nearest player (cannot pass blocking spaces; skips players locked in battle or resting).
    **The minion never stops on a building**: if its path would end on one (e.g. the player is inside a building), it stops on the last open space before it.
    When it arrives, it immediately ambushes for 1 round (no mini-game; the minion attacks first)
    Then continue fighting on the player's turn. It does not move while someone is fighting it.
    - A player who stops on its space must fight (§6.4); players passing through do not.
- Rewards: the finisher receives the star, full EXP, money, and drop. Other participants receive 50% EXP and money.
- Command selection: use Special move/Defense as soon as off cooldown; otherwise attack with Attack 60% / Strike 40%
Defend 50% / Counter 50% when defending.

| Name | Lv | HP | AT | DF | SP | EXP | Money | Drop |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Minion Zone 1/2/3/4 | 7/19/31/43 | 155/480/1050/1590 | 12/35/56/88 | 9/26/46/67 | 11/31/53/80 | 100/270/440/610 | 175/475/775/1075 | I05 50%, C04 10% |
| Iron Fang General (Zone 1) | 12 | 460 | 21 | 20 | 22 | 400 | 700 | C01 100% |
| Dark Dryad General (Zone 2) | 24 | 960 | 44 | 43 | 46 | 900 | 1600 | C02 100% |
| Sand Scorpion General (Zone 3) | 36 | 1400 | 62 | 68 | 65 | 1500 | 3000 | C03 100% |
| Demon Lord (Zone 4) | 50 | 3600 | 66 | 89 | 70 | 3000 | 8000 | IQ01 100% |
- Minion: Sticky Fingers (player loses an additional 10% money when defeated/surrendering) / Rock Throw, base ×1.5 (CD 2) / Sudden Dodge, −50% damage (CD 2)
- Iron Fang General: Thick Hide (Strike −30%) / Earthquake, base ×1.5 + SP (CD 2) / Raise Shield, −40% damage (CD 2)
- Dark Dryad General: Regenerative Roots (restore 5% HP at the start of the day) / Entangling Vines, SP ×2 and player's AT −20%
for the entire battle (CD 3) / Hard Bark, −50% damage (CD 3)
- Sand Scorpion General: Poison Tail (20% chance on hit to add damage equal to 10% of the player's maximum HP)
/ Raging Sandstorm, SP ×3 (CD 3) / Burrow, take no damage (CD 4)
- Demon Lord: Three Forms of Darkness (HP > 66%: DF ×1.5; 34–66%: AT ×1.3; ≤ 33%: counter 20%
of damage received; changes color when changing form) / Hellfire, SP ×3 (CD 2)
/ Dark Veil, −50% damage and reflect 30% (CD 3)

9.2 Monsters

- 3 types per zone (tier 1 near the entrance → tier 3 near the General, §7.1). They have no Class move/Special Defense. Special move can be used once per day
(50% each time they attack); otherwise choose commands like the Demon Lord Army. Maximum 1 drop.

| Name | Zone / tier | Lv | HP | AT | DF | SP | EXP | Money | Ability | Drop |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sticky Rice Slime | 1 / 1 | 2 | 40 | 4 | 2 | 4 | 23 | 30 | Sticky Body: Strike −30% | I04 30% |
| Hungry Wolf | 1 / 2 | 6 | 115 | 9 | 5 | 5 | 54 | 66 | Rapid Bite: 20% chance on hit to bite again | I04 25% |
| Mischievous Monkey (new) | 1 / 3 | 10 | 185 | 15 | 11 | 14 | 85 | 102 | Coconut Toss: SP ×2 | I02 20% |
| Kong Koi Ghost | 2 / 1 | 15 | 280 | 28 | 16 | 24 | 124 | 147 | Leap Dodge: 20% chance to evade Attack | I06 20% |
| Walking Poison Mushroom | 2 / 2 | 19 | 460 | 39 | 27 | 44 | 155 | 183 | Poison Spores: SP ×2 | I04 30% |
| Striped Tiger (new) | 2 / 3 | 22 | 610 | 42 | 27 | 31 | 179 | 210 | Pounce: 20% chance on hit ×1.5 / Tiger Claw: base ×2 | I05 20% |
| Giant Sand Scorpion | 3 / 1 | 27 | 810 | 54 | 47 | 34 | 218 | 255 | Stinger: 20% chance on hit to deal ×1.5 damage | I05 20% |
| Anachronistic Mummy | 3 / 2 | 31 | 950 | 67 | 44 | 65 | 249 | 291 | Cursed Bandages: SP ×2 | I07 20% |
| Sand Wyrm (new) | 3 / 3 | 34 | 1100 | 80 | 51 | 68 | 272 | 318 | Quicksand: SP ×2.5 | I08 15% |
| Shadow Demon | 4 / 1 | 39 | 1340 | 97 | 46 | 80 | 311 | 363 | Shadow Form: 25% chance to evade Attack/Strike | I05 30% |
| Death Knight | 4 / 2 | 43 | 1480 | 86 | 86 | 73 | 342 | 399 | Soul Slash: base ×2 | I03 20% |
| Lava Golem (new) | 4 / 3 | 47 | 1660 | 94 | 97 | 79 | 374 | 435 | Molten Body: Strike −30% / Magma Punch: base ×2 | I08 20% |

### 10. Bots

- Select exact-step destinations in order: holding the Demon Lord's Head → Royal Castle / Demon Lord's Head dropped within range → go collect it
/ HP < 30% and can afford a heal → nearest shop / promotion available → Royal Castle or Temple in range
/ minion within range, HP > 60% and level ≥ minion − 1 → fight
/ General or Demon Lord within range and level ≥ enemy − 1 (or behind schedule: day 30 / 62 / 92 / 118 and level ≥ enemy − 4) → fight
/ an ally's Demon Lord Army battle within range and HP > 50% → join
/ enough money to buy better equipment → Equipment Shop / otherwise move toward the General of the uncleared zone (roaming for fights while under-levelled)
- Challenge a hero on the same space when HP is higher (steal money after winning)
Join a Demon Lord Army battle when HP > 50%. When walking into a fight: ambush a badly hurt hero, otherwise help against the enemy.
- Use recovery items before rolling when HP < 40% (< 75% when a General / the Demon Lord or an army battle is within 6 spaces). Use spellbooks on the hero with the most stars 50% of the time per turn.
- Battle: use Class/Special moves as soon as off cooldown; otherwise attack with Attack 60% / Strike 40%
Defend 50% / Counter 30% / Special Defense 20% when defending. Surrender to a Demon Lord Army when HP < 15% and in a duel when HP < 12%.
- Assign free points to stats increased by the class. Promote at the first Royal Castle / Temple visit. Change to an off-branch class 50% of the time.
Choose optional events 50% of the time. Never go all-in. Decide in 0.5–1 second per action.
- Bot turns follow the game speed setting (1× / 2× / 4×). The user can press Enter to skip ahead to the results summary.

### 11. King's Requests (weekly side quests)

- On day 1 and every 7 days, the King posts one request (shown top-center; details on tap). The first hero to complete it within the week earns **+1 ⭐** and gold (200 / 600 / 1,200 / 2,000 G by the frontier zone).
- Requests: defeat 4 monsters · defeat a specific monster of the frontier zone · open 2 treasure chests · earn X G from battles · gain 2 levels · win a duel · defeat the Demon Lord Minion · make merit at a temple (from Zone 2) · deliver a royal letter to a named building.
- The same request never repeats twice in a row. Unfinished requests expire when the next one is posted.

### 12. Victory Poses

- When a hero wins a battle or duel, their sprite hops into a class-specific pose with an emoji burst (see the table in §5), and the result window shows the pose line.

### 13. Sharing the Results

- The results screen offers **Share image** (a 1080×1080 card with the ending, day, and ranking; uses the device share sheet when available, otherwise downloads the PNG)
and **Copy text** (a short text summary for chats).
