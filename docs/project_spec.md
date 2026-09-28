### 0. General Requirements

- The game "Sole blessed" is a turn-based board game combined with an RPG, played in a web browser.
- Pure HTML, CSS, and JavaScript; no external libraries. Separate files by system
(data.js stores all game data, map.js, battle.js, ui.js, bot.js, save.js).
- Draw with Canvas in an angled (2.5D) view; do not use external image or sound files
Graphics are drawn with code or emojis; sound uses the Web Audio API.
- Save the game with localStorage, supporting computers and mobile devices.
- UI: cream-colored frames, orange-gold borders, rounded corners, cartoon style, centered modal windows, darkened background.
- Every button can be clicked/tapped and has a shortcut-key label. Disabled buttons are gray and explain why
Important actions (buying, deleting, changing class, quitting the game) require confirmation first.
- During a bot's turn, command buttons are disabled (except Pause). The bottom-right corner always displays "[Name]'s turn".

Controls

| Situation | Keys |
| --- | --- |
| Normal play screen | Q Move, O Inventory, I Free Camera, X Status, Z How to Play |
| While moving | W/A/S/D Move, E Free Camera, I Auto-Move, O Status, N Full Map, Enter Stop |
| Battle | W/A/S/D Select command (up/left/down/right), Z Enemy Info |
| Menu | W/A/S/D Select, Enter Confirm |
| All situations | ESC closes a window; if no window is open, it opens the Pause Menu |

### 1. Screens

- Start screen: game title and opening text "{game_dialogue Starter game cinematic}" Buttons: Start Game / Load Game / Settings
- Character creation: name 1–12 characters, male/female, choose from 3 Tier 1 class cards,
"Begin Journey" button (enabled once all selections are complete). Bots randomly choose a name, gender, and class.
- Dialogue scenes (dialogue box; Enter/tap to continue; Skip button): look up in game_dialogue.md
- Save Game: 4 slots showing name, class, level, day, stars, and save time (empty slots show "Empty")
Opened from the Start screen = Load/Delete; opened from the Pause Menu = Save (overwriting requires confirmation).
- Settings: music and sound-effect sliders, key table, summarized How to Play (opened with Z).
- Pause Menu: Resume / Save (available only on the user's turn before rolling) / Settings / Exit to Start Screen

### 2. Rules

- In the Kingdom of Arendore, the Demon Lord has returned to threaten the world. The king searches for heroes;
the one with the most outstanding achievements will receive the "King's Blessing" and may ask for one thing.
- 4 players (1 user + 3 bots) play in order, one turn each. All 4 turns = 1 day. The game lasts 35 days.
- Before the Demon Lord is defeated, all heroes roll 1 die each turn (the minion still rolls 1 die). After the Demon Lord is defeated, all heroes roll 2 dice each turn.
- The game has 3 ending form
    - **Good Ending:** If the players successfully bring the Dark Lord’s head to the royal palace, they are considered victorious, leading to the Good Ending.
    - **Bad Ending:** If the players fail to defeat the Dark Lord within 35 days, they lose and trigger the Bad Ending.
    - **Secret Ending:** If the players obtain the Dark Lord’s head but fail to deliver it to the royal palace within 35 days, they lose and trigger the Secret Ending.
- Stars: Minion 1, General 2, Demon Lord 3, deliver the Demon Lord's Head 5,
defeat another hero after the Demon Lord is defeated 1, event E04 1.
- The player with the most stars wins (ties are decided by money, then level). In-game rankings use the same criteria.
- Results screen: the king says "You have all helped save the kingdom, but one of you has achieved
the greatest deeds…step forward to receive the King's Blessing!" Then show ranks 1–4 (stars, money, level).

### 3. Game Screen and Movement

3.1 Normal Play UI

- Top-left: "Day 5 / 35" box and Pause button
- Top-right: active-player panel (level, name, class, rank, stars, money, AT/DF/SP, HP bar)
Tap the panel or press X to open the Status screen.
- Left edge: vertical circular buttons Q Move, O Inventory, I Free Camera, X Status
- Bottom edge: compact panels for the other 3 players (portrait, level, name, stars, HP bar)
- Bottom-left: "Z How to Play" / the current player's standing space is highlighted in a different color

3.2 Movement Rules

- Press Q to spin the dice; press Q or Enter to stop. Roll 1–6 (after the Demon Lord is defeated, roll 2 dice)
Double/Triple Dice items add 1/2 dice, then total the result.
- You may stop on any space no more than the rolled distance away; move at least 1 space. A route may not pass through the same space twice.
- Blocking spaces (an undefeated General or the Demon Lord's Castle): you may stop there but cannot pass through.
- A space's effect occurs only on the space where you stop.
- Stop on a space occupied by another hero → you may challenge them (except someone currently locked in battle).
- If you are on a space where a Demon Lord Army battle is in progress → choose to join instead of rolling.
- If you are locked in an unfinished battle → you do not roll; continue the battle instead.

3.3 Movement Method and UI While Moving

- While moving, hide the UI from 3.1. Stoppable spaces blink; blocking spaces are red
Spaces occupied by players or minions, and spaces where the Demon Lord's Head has fallen, show icons above them.
- Top-left: command panel E Free Camera, I Auto-Move, O Status, N Full Map
Bottom-left: "3 spaces remaining" and "Enter: Stop here"
- Manual movement: W/A/S/D one space at a time. Small arrows show available directions. Pressing the reverse direction cancels a step
(returning the space). Press Enter to stop; when 0 spaces remain, stop automatically.
- Auto-Move (always used by bots): press I, then use A/D to select a space (blinking arrow, space-type label,
and dotted route). Press Enter or tap to confirm; ESC cancels. The character walks one space at a time with animation.
- Free Camera: move the camera with W/A/S/D or drag. Full Map: zoom out to show the entire map
with player, enemy, Demon Lord's Head, respawn-point icons, and zone names. ESC closes either mode.

### 4. Characters

- Stats: HP health, AT attack power, DF base damage reduction, SP special power
- Starting at level 1: HP 30, AT 5, DF 3, SP 5, money 300 G
Displayed values include equipment. Decimals are rounded to the nearest whole number (.5 rounds up).
- Maximum level 30. EXP required = 10 × current level (excess carries over).
- EXP gained = enemy EXP × (1 + 0.1 × (enemy level − player level)), with the multiplier capped at 0.5–2.
- On level-up: HP +10, class-based stats, mastery bonuses for every mastered class
and 2 free points (1 point = HP +5 or AT/DF/SP +1). The "Level Up!" window allows points to be assigned.
- When HP reaches 0: respawn at the respawn point with full HP, lose 10% of money, and continue on the next turn
The initial respawn point is the Royal Castle. It can be reset at a temple or the Royal Castle
(one respawn point at a time; shown as a colored flag on the map).
- For the holder of the Demon Lord's Head who loses:
    - Loses to another hero (including surrender): the head immediately moves to the winner.
    - HP reaches 0 from a monster or Demon Lord Army: the head drops on that space
    The first hero to stop on that space takes the head (passing through does not take it).
- Status screen (X or O while moving, or tap the top-right panel; bots can be viewed in read-only mode):
portrait, name, class, level, rank, stars, money, EXP bar, stats (Passive results shown in green)
equipment, Job EXP, all moves with cooldowns, mastered classes, respawn point, and "Change Class" button

### 5. Classes

- You may change class during your own turn before rolling and while not locked in battle. Tier 1 classes are always available
Other classes must be unlocked. After changing, your level and existing stats remain.
- Every class has separate Job EXP, up to 10 (defeat a monster +1, Demon Lord Army +2)
At 10, the class is mastered: gain its mastery bonus on every level-up for the rest of the game and unlock Tier 2 of the branch.
- Magic classes use SP instead of AT for base damage in all cases.
- Class moves are not reduced or countered by Defend/Counter.

| Class | Unlock | Level-up | Mastery | Passive | Class move |
| --- | --- | --- | --- | --- | --- |
| Sword-wielding Commoner | Starting class | HP+10 AT+1 | HP+5 | Beginner: AT +20%, but every attack has a 50% chance to deal −20% damage | Full-force Slash: Base ×2 + SP (CD 2) |
| Hotheaded Sword Warlord | Master Sword-wielding Commoner | HP+10 AT+1 DF+1 | DF+1 | Hotheaded: AT +50%, but every attack has a 20% chance to miss | Furious Slash: Base ×2.5 + 30% of lost HP (CD 3) |
| Apprentice Shaman | Starting class | DF+1 SP+2 | SP+1 | Novice Caster: SP +20%, but every attack has a 50% chance to deal −20% damage | Crooked Fireball: SP ×3.5 (CD 2) |
| Loquacious Archmage | Master Apprentice Shaman | HP+10 SP+2 | SP+1 | Loose Tongue: At the end of your turn, 50% chance to reduce the cooldown of a Special/Class move by 1 day | You B#!$!: SP ×4.5 (CD 2) |
| Slingshot Lad | Starting class | AT+2 SP+1 | AT+1 | Keen Eyes: Attack/Strike has a 20% chance to critically hit for ×1.5 | Rubber Band Shot: Base ×1.5 + SP (CD 2) |
| Cross-eyed Bow Warlord | Master Slingshot Lad | AT+2 SP+1 | AT+1 | Cross-eyed: Attack/Strike has a 30% chance to critically hit for ×2, with a 10% chance to miss | Wild Arrow Barrage: 3 arrows, each dealing (Base + SP) ×0.7; calculate Passive separately (CD 2) |
| Isan Person | Use Larb for the first time | HP+10 AT+2 | AT+1 | Adventurous Eater: HP-restoring items are 50% more effective, and using one grants AT +40% | Spicy Sizzle: AT ×3.5 and restore HP equal to 50% of damage dealt (CD 2) |
| Gambler | Go All-in at the horse-racing track (win or lose) | HP+10 AT+1 SP+1 | HP+5 | Lucky: When HP reaches 0, 50% chance to revive with 20% HP | All-In: 50% chance to succeed and deal SP ×2, then roll again; up to 5 times (CD 1) |
| Temple Kid | Make merit 3 times | HP+10 AT+1 DF+1 | DF+1 | Blessed Merit: At the start of a new day, restore 10% HP | Alms Round: (50% of opponent's AT + 50% of opponent's SP) (CD 3) |
- Class Change screen: 9 cards (3 main branches in rows, Tier 1 → 2, plus 1 off-branch row)
Show name and current Job EXP. Current class = gold frame; locked = gray with padlock; mastered = star
Details and the "Change to This Class" button appear on the right.

### 6. Battle

6.1 Order and Duration

- Start immediately with a two-card face-down mini-game. The card marked "Go First" attacks first (bots resolve randomly).
- 1 round = each side attacks once. Both sides choose commands simultaneously and reveal the results simultaneously.
- You may fight monsters and the Demon Lord Army for no more than 3 rounds per day. If unfinished, continue on the next player's turn
(HP persists, the player remains on the same space, and cross-day battles keep the same order).
- Intended duration: monsters and minions 1–2 days (mostly 1), Generals 2–3 days,
Demon Lord 4–5 days when fought alone, heroes 1 round (if neither reaches 0 HP = draw).
- If the player loses or surrenders: a monster disappears; the Demon Lord Army remains in place with its lost HP preserved.

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
- Give Up: counts as a loss but does not kill the player; HP remains unchanged and the player stays on the same space
Surrendering to an enemy loses 10% of money; surrendering to another hero grants the same reward as a win.

6.3 Heroes Fighting Each Other

- Can happen throughout the game: challenge after stopping on the same space, or use a Challenge Letter (MB04). Always one-on-one
You cannot challenge someone currently locked in battle.
- The winner chooses one item to steal: 20% of money, 1 piece of equipment (equip it instead or discard it), or 1 item
Gain EXP = 40 × level difference if lower level than the loser, gain 1 star if the Demon Lord has been defeated,
and immediately take the Demon Lord's Head if the loser is holding it.

6.4 Cooperative Demon Lord Army Battle (up to 4 players)

- Stop on a space where a Demon Lord Army battle is in progress to join (or choose to join instead of rolling)
No mini-game is required, and the team attacks first.
- Each player fights for no more than 3 rounds during their own turn. The enemy attacks only the active player; enemy HP and cooldowns are shared.
- Cooperation bonus: damage +10% per additional participant (maximum +30%).

6.5 Battle UI

- Zone-based background; player on the left, enemy on the right, allies in the back row on the left with compact HP bars
- Top: gold circular level badge, numeric HP bar, name labels for both sides, a burst-star "VS" in the center
and a "Round 2 / 3" counter. HP bars slide down and turn red below 25%.
- Center: AT, DF, SP comparison bars (player left, enemy right) and a "Z Info" button to view enemy moves
- Starting cards appear below the characters; select with A/D and flip simultaneously.
- "Attacker" label in red / "Defender" label in blue. Four diamond-shaped command buttons
Enemy buttons are dark gray; cooldown buttons show days remaining. After selection, show "Waiting for opponent…"
- Reveal: command name above each character, animation, bouncing damage numbers, summary text
- End: Win/Loss/Surrender/Draw window with EXP, Job EXP, money, stars, and items gained or lost
If unfinished, show "The battle will continue on the next day."

### 7. Map

7.1 Structure

- Fixed, non-random networked Sugoroku map on an island, larger than the screen; the camera follows the active player.
- Stored as a graph: each space has an id, x/y, type, zone, and list of connected spaces.
- 4 zones connected through one General space each. Zone 1 is southwest, Zone 2 northwest,
Zone 3 northeast, Zone 4 southeast (Zone 1 and Zone 4 are separated by sea).
| Zone | Name | Spaces | Shortest distance to General/Demon Lord | Target level | Offset (column, row) |
|-----|-----|-----|------------------------|-------------|---------------------|
| 1 | Kingdom of Arendore | 21 | 9 | 1–6 | 0, 6 |
| 2 | Forest | 24 | 9 | 6–12 | 4, 0 |
| 3 | Desert | 21 | 9 | 12–19 | 11, 0 |
| 4 | Demon Lord's Land | 25 | 9 | 19–26 | 12, 6 |

7.2 Layout

- Spaces connect only when a pair has a ── or │ line between them; adjacent spaces without a line are not connected.
- Actual position = (column, row) in the layout + the zone offset; row 0 is at the top, 1 space = 120 px.
- Full code = zone-code (e.g. 1-e01). The leading letter indicates the type (Section 7.3).
- Cross-zone connections: 1-B01–2-e01, 2-B02–3-e01, 3-B03–4-e01

Zone 1
L05            B01
│              │
e10            L04
│              │
L07──t03──e07──e06──e05──e09
│    │    │
e08  t04  t01
│    │    │
L01──e01──e02──e03──e04──t02──L03
│
L02

Zone 2
L06       t03──e11──L03
│         │    │
e13       e10  e12──B02
│         │    │
e08──e07──e06──t04
│         │
L05──t05──e09       t01
│         │
e02──e03──e04──e05──e14──L04
│         │
e01       L02

Zone 3
L03
│
e01──e02──e03──e04──e11──L05
│         │
t02       t01
│         │
e07──e06──e05──e08──t03
│         │         │
e12       t04──e10──e09
│              │    │
L02            L04  B03

Zone 4
e01
│
L04──e15──e04──e03──e02
│         │
t01       t02       L02
│         │         │
e05──e06──e07──e10──e11
│         │         │
e09──t03──e08──L05  e14       t04
│                   │         │
B04                 t05──e13──e12
│
L03

7.3 Space Types and Locations

| Code | Name | Color | Effect on Stop |
| --- | --- | --- | --- |
| e | Empty space | Yellow | 70% fight a zone monster, 30% event |
| t | Treasure space | Green | 50% item, 20% spellbook, 20% money equal to 100 × zone number, 10% charm. Once opened, becomes an empty chest for 3 days (show open chest) |
| B01–B03 | Demon Lord General | Dark purple | Fight the General; after victory, becomes an empty space |
| B04 | Demon Lord's Castle | Black with red border | Fight the Demon Lord; after victory, becomes an empty space |
| L01 | Royal Castle | Orange + building | Starting point, first respawn point (can be set as respawn point again), deliver the Demon Lord's Head |
| L02 | Shop | Orange + building | Sells 6 items |
| L03 | Equipment Shop | Orange + building | Sells 3 zone-level equipment pieces (after buying, the old item is automatically sold for 50%) |
| L04 | Skillbook Shop | Orange + building | Sells 1 each of zone-level Special moves, Special Defense, and spellbooks |
| L05 | Temple | Orange + building | Set respawn point; make a donation of 10% of money (once per stop) |
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
| E03 | Dropped Money | Forced: gain money equal to 50 × zone number | 30% |
| E04 | Townspeople Request Help | Choose: fight the toughest monster in the zone (HP, AT ×1.3); win to gain 1 additional star | 10% |

8.2 Inventory (opened/closed with O)

- 2 tabs, 6 slots per page (3 × 2 grid): Items and Spellbooks. Quest items are shown separately and do not use slots.
- Use 1 item per turn, before rolling or before continuing a battle (I07 activates automatically and does not count).
- When the inventory is full after obtaining a new item → choose to discard the old item or the new item. Items can be sold at shops for half price.
- Spellbooks used on others can target anywhere on the map. If the target has I07, the effect is canceled and I07 is removed.

| Code | Name | Effect | Price |
| --- | --- | --- | --- |
| I01 | Larb | Restore 40% HP (sell only at the Larb Shop) | 100 |
| I02 | Double Dice | Add 1 die to the next roll | 100 |
| I03 | Triple Dice | Add 2 dice to the next roll | 250 |
| I04 | Herbal Balm | Restore 30% HP | 80 |
| I05 | Angelic Inhalant | Restore 70% HP | 200 |
| I06 | Energy Drink | AT +20% in the next battle | 120 |
| I07 | Anti-Magic Talisman | Block 1 spellbook from another player | 150 |
| MB01 | Homecoming Tome (Zone 1) | Warp to the respawn point (cannot use while holding the Demon Lord's Head) | 100 |
| MB02 | Pickpocket (Zone 2) | Steal 1 random item from the target's Item tab | 200 |
| MB03 | Monster Trap (Zone 3) | Place a trap on an empty space within 6 spaces. The first person to stop there (except the placer) fights a monster from the next zone (Zone 4 uses Zone 4 monsters) | 350 |
| MB04 | Challenge Letter (Zone 4) | Immediately challenge a hero within 6 spaces | 500 |
| IQ01 | Demon Lord's Head | Obtain from the Demon Lord. Stop at the Royal Castle to receive 5 stars and end the game. If defeated by a hero, the head moves to the winner; if defeated by an enemy, the head drops on the space. Cannot be sold, discarded, or stolen by magic | - |

8.3 Equipment (weapon, armor, charm slots; empty at game start; all classes can equip)

| Zone | AT Weapon | SP Weapon | Armor | Price/piece |
| --- | --- | --- | --- | --- |
| 1 | Bamboo Sword AT+3 | Tamarind Branch Staff SP+3 | Buffalo Leather Shirt DF+2 HP+10 | 150 |
| 2 | Steel Sword AT+6 | Vine Staff SP+6 | Iron Armor DF+4 HP+20 | 400 |
| 3 | Desert Sword AT+10 | Amber Rod SP+10 | Sandscale Armor DF+7 HP+35 | 900 |
| 4 | Demon-Slaying Sword AT+15 | Star Rod SP+15 | Hero's Armor DF+10 HP+50 | 1800 |
- Charms (not sold; obtained from treasure spaces or drops): C01 Boar Fang AT+3, C02 Fang-Guard Talisman DF+3,
C03 Mage's Ring SP+3, C04 Lucky Coin: money from battles +20%

8.4 Skills (1 of each; none at game start; buy at L04 to replace the current move)

| Zone | Special move | Special Defense | Price |
| --- | --- | --- | --- |
| 1 | Tiny Fireball: SP ×2 (CD 2) | Power Recovery: restore HP = SP ×2 before being attacked (CD 2) | 300 |
| 2 | Life Drain: SP ×1.5; restore HP equal to damage dealt (CD 3) | Stone Armor: damage −40% (CD 2) | 700 |
| 3 | Sandstorm: SP ×4 (CD 3) | Reflective Mirror: reflect all Special/Class moves back (CD 3) | 1500 |
| 4 | Heavenly Light Sword: (AT + SP) ×2.5 (CD 3) | Holy Shield: take no damage this time (CD 4) | 3000 |

### 9. Enemies

9.1 Demon Lord Army

- Demon Lord: resides in the Demon Lord's Castle (B04). Before battle, says "Come and get me, you pathetic hero."
- Demon Lord Generals: guard spaces B01–B03. After victory, they disappear permanently, opening the route and clearing that zone
Before battle, they say "Do you really think you can simply pass through this land?"
- Demon Lord Minion: 1 exists at a time. The first spawns on day 3; after being defeated, it respawns at the start of the next day
It spawns on a random empty space with no players in the zone after the latest-cleared zone
(if no zone has been cleared, the maximum is Zone 1; otherwise use the next zone), with a notification to everyone.
    - At the end of each day, roll 1 die and move toward the nearest player (cannot pass blocking spaces; skips players locked in battle).
    When it arrives, it immediately ambushes for 1 round (no mini-game; the minion attacks first)
    Then continue fighting on the player's turn. It does not move while someone is fighting it.
    - A player who stops on its space must fight; players passing through do not.
- Rewards: the finisher receives the star, full EXP, money, and drop. Other participants receive 50% EXP and money.
- Command selection: use Special move/Defense as soon as off cooldown; otherwise attack with Attack 60% / Strike 40%
Defend 50% / Counter 50% when defending.

| Name | Lv | HP | AT | DF | SP | EXP | Money | Drop |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Minion Zone 1/2/3/4 | 4/10/17/24 | 85/200/330/480 | 9/20/32/45 | 4/10/17/25 | 8/18/28/40 | 50/180/380/650 | 60/200/450/900 | I05 50%, C04 10% |
| Iron Fang General (Zone 1) | 6 | 240 | 11 | 6 | 12 | 90 | 100 | C01 100% |
| Dark Dryad General (Zone 2) | 12 | 440 | 22 | 14 | 24 | 300 | 250 | C02 100% |
| Sand Scorpion General (Zone 3) | 19 | 700 | 34 | 22 | 35 | 600 | 600 | C03 100% |
| Demon Lord (Zone 4) | 28 | 1800 | 48 | 30 | 55 | 1200 | 1500 | IQ01 100% |
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

- 2 types per zone, equally likely. They have no Class move/Special Defense. Special move can be used once per day
(50% each time they attack); otherwise choose commands like the Demon Lord Army. Maximum 1 drop.

| Name | Zone | Lv | HP | AT | DF | SP | EXP | Money | Ability | Drop |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sticky Rice Slime | 1 | 2 | 40 | 5 | 2 | 2 | 20 | 20 | Sticky Body: Strike −30% | I04 30% |
| Hungry Wolf | 1 | 3 | 34 | 6 | 1 | 2 | 25 | 25 | Rapid Bite: 20% chance on hit to bite again | I04 20% |
| Kong Koi Ghost | 2 | 8 | 150 | 18 | 8 | 12 | 75 | 70 | Leap Dodge: 20% chance to evade Attack | I06 20% |
| Walking Poison Mushroom | 2 | 9 | 160 | 17 | 10 | 18 | 85 | 75 | Poison Spores: SP ×2 | I04 30% |
| Giant Sand Scorpion | 3 | 15 | 240 | 30 | 18 | 15 | 165 | 150 | Stinger: 20% chance on hit to deal ×1.5 damage | I05 20% |
| Anachronistic Mummy | 3 | 16 | 250 | 28 | 16 | 30 | 175 | 160 | Cursed Bandages: SP ×2 | I07 20% |
| Shadow Demon | 4 | 22 | 360 | 43 | 22 | 30 | 270 | 300 | Shadow Form: 25% chance to evade Attack/Strike | I05 30% |
| Death Knight | 4 | 23 | 380 | 42 | 28 | 35 | 290 | 320 | Soul Slash: base ×2 | I03 20% |

### 10. Bots

- Select destinations in order: holding the Demon Lord's Head → Royal Castle / Demon Lord's Head dropped within range → go collect it
/ HP < 30% → nearest temple or shop / minion within range and HP > 60% → fight
/ General or Demon Lord within range and level ≥ enemy − 1 → fight
/ enough money to buy better equipment → Equipment Shop / otherwise move toward the General of the uncleared zone
- Challenge a hero on the same space when HP is higher (steal money after winning)
Join a Demon Lord Army battle when HP > 50%.
- Use recovery items when HP < 40%. Use spellbooks on the hero with the most stars 50% of the time per turn.
- Battle: use Class/Special moves as soon as off cooldown; otherwise attack with Attack 60% / Strike 40%
Defend 50% / Counter 30% / Special Defense 20% when defending. Surrender to a Demon Lord Army when HP < 15%.
- Assign free points to stats increased by the class. Promote immediately. Change to an off-branch class 50% of the time.
Choose optional events 50% of the time. Never go all-in. Decide in 0.5–1 second per action.
- Bot movement and battles display at 2× speed. The user can press Enter to skip ahead to the results summary.