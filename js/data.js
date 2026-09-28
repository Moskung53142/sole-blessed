'use strict';
/* Sole Blessed — ALL static game data (spec: docs/project_spec.md, docs/game_dialogue.md).
 * Rules code reads from here; never hard-code balance numbers elsewhere. */

const DATA = (() => {
  const D = {};

  D.TITLE = 'Sole Blessed';
  D.VERSION = '2.0.0';
  D.SAVE_SCHEMA = 2;                   // v2: new 251-space map (v1 saves are not loadable)
  D.MAX_LEVEL = 50;
  D.NUM_PLAYERS = 4;
  D.ROUNDS_PER_DAY = 3;
  D.MINION_FIRST_DAY = 3;
  D.MINION_RESPAWN_DAYS = 2;           // a defeated minion returns 2 days later
  D.DOWN_TURNS = 1;                    // turns skipped after a KO (resurrection) or giving up (standing up)
  D.INV_SIZE = 6;
  D.LOG_SIZE = 300;                    // entries kept in the adventure log
  D.CELL = 120;                        // px between spaces (world units)
  D.START = { level: 1, hp: 30, at: 5, df: 3, sp: 5, money: 300 };
  /* Game length chosen at character creation: 140 days or endless (0). */
  D.RULES_DEFAULT = { days: 140 };
  D.DAY_OPTIONS = [140, 0];
  D.SPEEDS = [1, 2, 4];                // game speed setting (animations & bot turns)
  D.PLAYER_COLORS = ['#e8553d', '#3b82f6', '#22a55a', '#a855f7'];
  D.BOT_NAMES = ['Somchai', 'Mali', 'Arthit', 'Kanya', 'Ploy', 'Tawan', 'Nok', 'Boonmee', 'Dao', 'Kaew',
    'Rowan', 'Elara', 'Brom', 'Fah', 'Chai', 'Pim', 'Sombat', 'Lamai', 'Orin', 'Suda'];

  /* ------------------------------------------------------------------ classes */
  D.TIER1 = ['commoner', 'shaman', 'slingshot'];
  D.CLASS_GRID = [['commoner', 'warlord'], ['shaman', 'archmage'], ['slingshot', 'bowlord'], ['isan', 'gambler', 'templekid']];
  D.CLASSES = {
    commoner: {
      victory: 'raises the bamboo sword to the sky!',
      name: 'Sword-wielding Commoner', short: 'Commoner', tier: 1, next: 'warlord', magic: false,
      unlockText: 'Starting class', levelUp: { hp: 10, at: 1 }, mastery: { hp: 5 },
      passive: { id: 'beginner', name: 'Beginner', text: 'AT +20%, but every attack has a 50% chance to deal −20% damage' },
      move: { id: 'fullForce', name: 'Full-force Slash', cd: 2, fx: { type: 'baseMulPlusSp', mul: 2 }, text: 'Base ×2 + SP' },
    },
    warlord: {
      victory: 'roars and slams the giant sword into the ground!',
      name: 'Hotheaded Sword Warlord', short: 'Sword Warlord', tier: 2, magic: false,
      unlockText: 'Master Sword-wielding Commoner', levelUp: { hp: 10, at: 1, df: 1 }, mastery: { df: 1 },
      passive: { id: 'hotheaded', name: 'Hotheaded', text: 'AT +50%, but every attack has a 20% chance to miss' },
      move: { id: 'furious', name: 'Furious Slash', cd: 3, fx: { type: 'furious', mul: 2.5, lost: 0.3 }, text: 'Base ×2.5 + 30% of lost HP' },
    },
    shaman: {
      victory: 'twirls the crooked staff in a shower of sparks!',
      name: 'Apprentice Shaman', short: 'Shaman', tier: 1, next: 'archmage', magic: true,
      unlockText: 'Starting class', levelUp: { df: 1, sp: 2 }, mastery: { sp: 1 },
      passive: { id: 'novice', name: 'Novice Caster', text: 'SP +20%, but every attack has a 50% chance to deal −20% damage' },
      move: { id: 'crooked', name: 'Crooked Fireball', cd: 2, fx: { type: 'spMul', mul: 3.5 }, text: 'SP ×3.5' },
    },
    archmage: {
      victory: "won't stop talking about how easy that was.",
      name: 'Loquacious Archmage', short: 'Archmage', tier: 2, magic: true,
      unlockText: 'Master Apprentice Shaman', levelUp: { hp: 10, sp: 2 }, mastery: { sp: 1 },
      passive: { id: 'looseTongue', name: 'Loose Tongue', text: 'At the end of your turn, 50% chance to reduce the cooldown of a Special/Class move by 1 day' },
      move: { id: 'youB', name: 'You B#!$!', cd: 2, fx: { type: 'spMul', mul: 4.5 }, text: 'SP ×4.5' },
    },
    slingshot: {
      victory: 'leaps up and pings a pebble at the sun!',
      name: 'Slingshot Lad', short: 'Slingshot Lad', tier: 1, next: 'bowlord', magic: false,
      unlockText: 'Starting class', levelUp: { at: 2, sp: 1 }, mastery: { at: 1 },
      passive: { id: 'keenEyes', name: 'Keen Eyes', text: 'Attack/Strike has a 20% chance to critically hit for ×1.5' },
      move: { id: 'rubberBand', name: 'Rubber Band Shot', cd: 2, fx: { type: 'baseMulPlusSp', mul: 1.5 }, text: 'Base ×1.5 + SP' },
    },
    bowlord: {
      victory: 'fires a victory arrow… in a completely random direction.',
      name: 'Cross-eyed Bow Warlord', short: 'Bow Warlord', tier: 2, magic: false,
      unlockText: 'Master Slingshot Lad', levelUp: { at: 2, sp: 1 }, mastery: { at: 1 },
      passive: { id: 'crossEyed', name: 'Cross-eyed', text: 'Attack/Strike has a 30% chance to critically hit for ×2, with a 10% chance to miss' },
      move: { id: 'arrows', name: 'Wild Arrow Barrage', cd: 2, fx: { type: 'arrows', n: 3, mul: 0.7 }, text: '3 arrows, each (Base + SP) ×0.7; Passive rolls per arrow' },
    },
    isan: {
      victory: 'celebrates with a handful of sticky rice!',
      name: 'Isan Person', short: 'Isan Person', tier: 0, magic: false,
      unlockText: 'Use Larb for the first time', levelUp: { hp: 10, at: 2 }, mastery: { at: 1 },
      passive: { id: 'eater', name: 'Adventurous Eater', text: 'HP-restoring items are 50% more effective, and using one grants AT +40% for your next battle' },
      move: { id: 'sizzle', name: 'Spicy Sizzle', cd: 2, fx: { type: 'atMul', mul: 3.5, drain: 0.5 }, text: 'AT ×3.5; restore HP equal to 50% of damage dealt' },
    },
    gambler: {
      victory: 'tosses the dice and catches a jackpot of coins!',
      name: 'Gambler', short: 'Gambler', tier: 0, magic: false,
      unlockText: 'Go All-in at the horse-racing track (win or lose)', levelUp: { hp: 10, at: 1, sp: 1 }, mastery: { hp: 5 },
      passive: { id: 'lucky', name: 'Lucky', text: 'When HP reaches 0, 50% chance to revive with 20% HP' },
      move: { id: 'allIn', name: 'All-In', cd: 1, fx: { type: 'allIn', mul: 2, tries: 5 }, text: '50%: deal SP ×2 and roll again, up to 5 times' },
    },
    templekid: {
      victory: 'bows with a respectful wai. 🙏',
      name: 'Temple Kid', short: 'Temple Kid', tier: 0, magic: false,
      unlockText: 'Make merit 3 times at a temple', levelUp: { hp: 10, at: 1, df: 1 }, mastery: { df: 1 },
      passive: { id: 'blessed', name: 'Blessed Merit', text: 'At the start of a new day, restore 10% HP' },
      move: { id: 'alms', name: 'Alms Round', cd: 3, fx: { type: 'alms' }, text: "50% of opponent's AT + 50% of opponent's SP" },
    },
  };

  /* ------------------------------------------------------------------ skills */
  D.SKILLS = {
    SK1: { kind: 'special', zone: 1, name: 'Tiny Fireball', price: 400, cd: 2, fx: { type: 'spMul', mul: 2 }, text: 'SP ×2', icon: '🔥' },
    SK2: { kind: 'special', zone: 2, name: 'Life Drain', price: 1600, cd: 3, fx: { type: 'spMul', mul: 1.5, drain: 1 }, text: 'SP ×1.5; restore HP equal to damage dealt', icon: '🧛' },
    SK3: { kind: 'special', zone: 3, name: 'Sandstorm', price: 3800, cd: 3, fx: { type: 'spMul', mul: 4 }, text: 'SP ×4', icon: '🌪️' },
    SK4: { kind: 'special', zone: 4, name: 'Heavenly Light Sword', price: 7500, cd: 3, fx: { type: 'atSpMul', mul: 2.5 }, text: '(AT + SP) ×2.5', icon: '⚔️' },
    SD1: { kind: 'specialDef', zone: 1, name: 'Power Recovery', price: 400, cd: 2, fx: { type: 'heal', mul: 2 }, text: 'Restore HP = SP ×2 before being attacked', icon: '💚' },
    SD2: { kind: 'specialDef', zone: 2, name: 'Stone Armor', price: 1600, cd: 2, fx: { type: 'reduce', v: 0.4 }, text: 'Damage −40%', icon: '🗿' },
    SD3: { kind: 'specialDef', zone: 3, name: 'Reflective Mirror', price: 3800, cd: 3, fx: { type: 'mirror' }, text: 'Reflect all Special/Class moves back', icon: '💎' },
    SD4: { kind: 'specialDef', zone: 4, name: 'Holy Shield', price: 7500, cd: 4, fx: { type: 'immune' }, text: 'Take no damage this time', icon: '🛡️' },
  };

  /* Enemy moves (army have cooldowns; monsters use their special once per day). */
  D.ENEMY_MOVES = {
    rockThrow: { name: 'Rock Throw', cd: 2, fx: { type: 'baseMul', mul: 1.5 }, text: 'Base ×1.5' },
    earthquake: { name: 'Earthquake', cd: 2, fx: { type: 'baseMulPlusSp', mul: 1.5 }, text: 'Base ×1.5 + SP' },
    vines: { name: 'Entangling Vines', cd: 3, fx: { type: 'spMul', mul: 2, debuffAt: 0.8 }, text: "SP ×2 and your AT −20% for the rest of the battle" },
    ragingSandstorm: { name: 'Raging Sandstorm', cd: 3, fx: { type: 'spMul', mul: 3 }, text: 'SP ×3' },
    hellfire: { name: 'Hellfire', cd: 2, fx: { type: 'spMul', mul: 3 }, text: 'SP ×3' },
    poisonSpores: { name: 'Poison Spores', cd: 0, fx: { type: 'spMul', mul: 2 }, text: 'SP ×2 (once per day)' },
    cursedBandages: { name: 'Cursed Bandages', cd: 0, fx: { type: 'spMul', mul: 2 }, text: 'SP ×2 (once per day)' },
    soulSlash: { name: 'Soul Slash', cd: 0, fx: { type: 'baseMul', mul: 2 }, text: 'Base ×2 (once per day)' },
    coconutToss: { name: 'Coconut Toss', cd: 0, fx: { type: 'spMul', mul: 2 }, text: 'SP ×2 (once per day)' },
    tigerClaw: { name: 'Tiger Claw', cd: 0, fx: { type: 'baseMul', mul: 2 }, text: 'Base ×2 (once per day)' },
    quicksand: { name: 'Quicksand', cd: 0, fx: { type: 'spMul', mul: 2.5 }, text: 'SP ×2.5 (once per day)' },
    magmaPunch: { name: 'Magma Punch', cd: 0, fx: { type: 'baseMul', mul: 2 }, text: 'Base ×2 (once per day)' },
    suddenDodge: { name: 'Sudden Dodge', cd: 2, fx: { type: 'reduce', v: 0.5 }, text: 'Damage −50%' },
    raiseShield: { name: 'Raise Shield', cd: 2, fx: { type: 'reduce', v: 0.4 }, text: 'Damage −40%' },
    hardBark: { name: 'Hard Bark', cd: 3, fx: { type: 'reduce', v: 0.5 }, text: 'Damage −50%' },
    burrow: { name: 'Burrow', cd: 4, fx: { type: 'immune' }, text: 'Take no damage' },
    darkVeil: { name: 'Dark Veil', cd: 3, fx: { type: 'reduce', v: 0.5, reflect: 0.3 }, text: 'Damage −50% and reflect 30%' },
  };

  D.PASSIVES = {
    stickyFingers: { name: 'Sticky Fingers', text: 'You lose an extra 10% money when defeated by or surrendering to it' },
    thickHide: { name: 'Thick Hide', text: 'Strike damage −30%' },
    regenRoots: { name: 'Regenerative Roots', text: 'Restores 5% HP at the start of each day' },
    poisonTail: { name: 'Poison Tail', text: '20% chance on hit to add damage equal to 10% of your max HP' },
    threeForms: { name: 'Three Forms of Darkness', text: 'HP > 66%: DF ×1.5 · 34–66%: AT ×1.3 · ≤ 33%: reflects 20% of damage received' },
    stickyBody: { name: 'Sticky Body', text: 'Strike damage −30%' },
    rapidBite: { name: 'Rapid Bite', text: '20% chance on hit to bite again' },
    leapDodge: { name: 'Leap Dodge', text: '20% chance to evade Attack' },
    stinger: { name: 'Stinger', text: '20% chance on hit to deal ×1.5 damage' },
    shadowForm: { name: 'Shadow Form', text: '25% chance to evade Attack/Strike' },
    moltenBody: { name: 'Molten Body', text: 'Strike damage −30%' },
    pounce: { name: 'Pounce', text: '20% chance on hit to deal ×1.5 damage' },
  };

  /* ------------------------------------------------------------------ items */
  D.ITEMS = {
    I01: { tab: 'items', name: 'Larb', icon: '🥗', price: 100, fx: 'heal', heal: 0.4, text: 'Restore 40% HP. Sold only at the Larb Shop.' },
    I02: { tab: 'items', name: 'Double Dice', icon: '🎲', price: 100, fx: 'dice', dice: 1, text: 'Add 1 die to your next roll.' },
    I03: { tab: 'items', name: 'Triple Dice', icon: '🎰', price: 250, fx: 'dice', dice: 2, text: 'Add 2 dice to your next roll.' },
    I04: { tab: 'items', name: 'Herbal Balm', icon: '🌿', price: 80, fx: 'heal', heal: 0.3, text: 'Restore 30% HP.' },
    I05: { tab: 'items', name: 'Angelic Inhalant', icon: '👼', price: 200, fx: 'heal', heal: 0.7, text: 'Restore 70% HP.' },
    I06: { tab: 'items', name: 'Energy Drink', icon: '🥤', price: 120, fx: 'energy', text: 'AT +20% in your next battle.' },
    I07: { tab: 'items', name: 'Anti-Magic Talisman', icon: '🧿', price: 150, fx: 'talisman', text: 'Automatically blocks 1 spellbook cast on you by another player.' },
    I08: { tab: 'items', name: 'Royal Elixir', icon: '🧪', price: 650, fx: 'heal', heal: 1, text: 'Restore 100% HP. Sold in the Desert and the Demon Lord\'s Land.' },
    MB01: { tab: 'books', zone: 1, name: 'Homecoming Tome', icon: '📘', price: 100, fx: 'home', text: 'Warp to your respawn point. Cannot be used while holding the Demon Lord\'s Head.' },
    MB02: { tab: 'books', zone: 2, name: 'Pickpocket', icon: '🧤', price: 250, fx: 'pickpocket', text: "Steal 1 random item from a hero's Item tab (anywhere on the map)." },
    MB03: { tab: 'books', zone: 3, name: 'Monster Trap', icon: '🕳️', price: 500, fx: 'trap', text: 'Place a trap on an empty space within 6 spaces. The first other hero to stop there fights a monster from the next zone.' },
    MB04: { tab: 'books', zone: 4, name: 'Challenge Letter', icon: '✉️', price: 800, fx: 'challenge', text: 'Challenge a hero within 6 spaces (not inside a building). You rush to their space and the duel starts at once.' },
    IQ01: { tab: 'quest', name: "Demon Lord's Head", icon: '💀', price: 0, fx: 'quest', text: "Deliver it to the Royal Castle for 5 stars and end the game. Cannot be sold, discarded, or stolen by magic." },
  };
  /* Item Shop stock per zone (6 items each). */
  D.SHOP_ITEMS = { 1: ['I02', 'I03', 'I04', 'I05', 'I06', 'I07'], 2: ['I02', 'I03', 'I04', 'I05', 'I06', 'I07'],
    3: ['I02', 'I03', 'I05', 'I06', 'I07', 'I08'], 4: ['I02', 'I03', 'I05', 'I06', 'I07', 'I08'] };
  D.TREASURE_ITEMS = [['I04', 3], ['I02', 2], ['I06', 2], ['I01', 2], ['I05', 2], ['I07', 1], ['I03', 1], ['I08', 1]];
  D.TREASURE_MONEY = [0, 150, 600, 1350, 2400];   // by zone
  D.EVENT_MONEY = [0, 60, 240, 540, 960];         // E03 Dropped Money, by zone

  /* ------------------------------------------------------------------ equipment */
  /* 8 tiers, 2 per zone; each Equipment Shop sells both tiers of its zone. minLv = suggested level. */
  const TIERS = [
    { t: 1, zone: 1, minLv: 1, price: 150, at: 3, df: 2, hp: 10, W: ['Bamboo Sword', '🗡️'], S: ['Tamarind Branch Staff', '🪄'], A: ['Buffalo Leather Shirt', '🥋'] },
    { t: 2, zone: 1, minLv: 6, price: 450, at: 6, df: 4, hp: 25, W: ['Iron Machete', '🔪'], S: ['Bodhi Leaf Wand', '🪄'], A: ['Rattan Scale Vest', '🥋'] },
    { t: 3, zone: 2, minLv: 13, price: 1100, at: 10, df: 7, hp: 45, W: ['Steel Sword', '🗡️'], S: ['Vine Staff', '🪄'], A: ['Iron Armor', '🛡️'] },
    { t: 4, zone: 2, minLv: 19, price: 2000, at: 15, df: 10, hp: 70, W: ['Tiger Fang Blade', '🗡️'], S: ['Firefly Lantern Staff', '🏮'], A: ['Teak Guard Plate', '🛡️'] },
    { t: 5, zone: 3, minLv: 24, price: 3400, at: 21, df: 14, hp: 100, W: ['Desert Sword', '⚔️'], S: ['Amber Rod', '🔮'], A: ['Sandscale Armor', '🛡️'] },
    { t: 6, zone: 3, minLv: 30, price: 5200, at: 28, df: 19, hp: 140, W: ['Sunforged Scimitar', '⚔️'], S: ['Mirage Scepter', '🔮'], A: ["Pharaoh's Mail", '🛡️'] },
    { t: 7, zone: 4, minLv: 37, price: 7600, at: 36, df: 25, hp: 190, W: ['Demon-Slaying Sword', '⚔️'], S: ['Star Rod', '🌟'], A: ["Hero's Armor", '🛡️'] },
    { t: 8, zone: 4, minLv: 44, price: 10500, at: 45, df: 32, hp: 250, W: ['Blessing Blade', '⚔️'], S: ['Naga Moon Staff', '🌙'], A: ['Royal Garuda Armor', '🛡️'] },
  ];
  D.EQUIP = {};
  for (const T of TIERS) {
    D.EQUIP['W' + T.t] = { slot: 'weapon', zone: T.zone, tier: T.t, minLv: T.minLv, name: T.W[0], icon: T.W[1], at: T.at, price: T.price };
    D.EQUIP['S' + T.t] = { slot: 'weapon', zone: T.zone, tier: T.t, minLv: T.minLv, name: T.S[0], icon: T.S[1], sp: T.at, price: T.price };
    D.EQUIP['A' + T.t] = { slot: 'armor', zone: T.zone, tier: T.t, minLv: T.minLv, name: T.A[0], icon: T.A[1], df: T.df, hp: T.hp, price: T.price };
  }
  /* Charms scale with the hero (percent bonuses). Not sold; from Generals, treasure and minions. */
  D.CHARMS = {
    C01: { slot: 'charm', name: 'Boar Fang', atPct: 0.1, price: 0, icon: '🦷', text: 'AT +10%' },
    C02: { slot: 'charm', name: 'Fang-Guard Talisman', dfPct: 0.1, price: 0, icon: '📿', text: 'DF +10%' },
    C03: { slot: 'charm', name: "Mage's Ring", spPct: 0.1, price: 0, icon: '💍', text: 'SP +10%' },
    C04: { slot: 'charm', name: 'Lucky Coin', moneyBonus: 0.25, price: 0, icon: '🪙', text: 'Money from battles +25%' },
    C05: { slot: 'charm', name: 'Jade Amulet', hpPct: 0.1, price: 0, icon: '🟢', text: 'Max HP +10%' },
  };
  D.GEAR = Object.assign({}, D.EQUIP, D.CHARMS);

  /* ------------------------------------------------------------------ enemies */
  /* ENEMY_STATS_BEGIN — generated/tuned with tools/balance.js; keep the spec tables in sync. */
  /* 3 monsters per zone. The tier-1 monster roams near the zone entrance, tier 3 near the General:
   * each space's depth (0 = entrance … 1 = General) picks the tier (Game.pickMonster). */
  D.MONSTERS = {
    slime: { key: 'slime', name: 'Sticky Rice Slime', zone: 1, tier: 1, lv: 2, hp: 40, at: 4, df: 2, sp: 4, exp: 23, money: 30, passive: 'stickyBody', special: null, drop: { id: 'I04', chance: 0.3 } },
    wolf: { key: 'wolf', name: 'Hungry Wolf', zone: 1, tier: 2, lv: 6, hp: 115, at: 9, df: 5, sp: 5, exp: 54, money: 66, passive: 'rapidBite', special: null, drop: { id: 'I04', chance: 0.25 } },
    monkey: { key: 'monkey', name: 'Mischievous Monkey', zone: 1, tier: 3, lv: 10, hp: 185, at: 15, df: 11, sp: 14, exp: 85, money: 102, passive: null, special: 'coconutToss', drop: { id: 'I02', chance: 0.2 } },
    kongkoi: { key: 'kongkoi', name: 'Kong Koi Ghost', zone: 2, tier: 1, lv: 15, hp: 280, at: 28, df: 16, sp: 24, exp: 124, money: 147, passive: 'leapDodge', special: null, drop: { id: 'I06', chance: 0.2 } },
    mushroom: { key: 'mushroom', name: 'Walking Poison Mushroom', zone: 2, tier: 2, lv: 19, hp: 460, at: 39, df: 27, sp: 44, exp: 155, money: 183, passive: null, special: 'poisonSpores', drop: { id: 'I04', chance: 0.3 } },
    tiger: { key: 'tiger', name: 'Striped Tiger', zone: 2, tier: 3, lv: 22, hp: 610, at: 42, df: 27, sp: 31, exp: 179, money: 210, passive: 'pounce', special: 'tigerClaw', drop: { id: 'I05', chance: 0.2 } },
    scorpion: { key: 'scorpion', name: 'Giant Sand Scorpion', zone: 3, tier: 1, lv: 27, hp: 810, at: 54, df: 47, sp: 34, exp: 218, money: 255, passive: 'stinger', special: null, drop: { id: 'I05', chance: 0.2 } },
    mummy: { key: 'mummy', name: 'Anachronistic Mummy', zone: 3, tier: 2, lv: 31, hp: 950, at: 67, df: 44, sp: 65, exp: 249, money: 291, passive: null, special: 'cursedBandages', drop: { id: 'I07', chance: 0.2 } },
    wyrm: { key: 'wyrm', name: 'Sand Wyrm', zone: 3, tier: 3, lv: 34, hp: 1100, at: 80, df: 51, sp: 68, exp: 272, money: 318, passive: null, special: 'quicksand', drop: { id: 'I08', chance: 0.15 } },
    shadow: { key: 'shadow', name: 'Shadow Demon', zone: 4, tier: 1, lv: 39, hp: 1340, at: 97, df: 46, sp: 80, exp: 311, money: 363, passive: 'shadowForm', special: null, drop: { id: 'I05', chance: 0.3 } },
    deathknight: { key: 'deathknight', name: 'Death Knight', zone: 4, tier: 2, lv: 43, hp: 1480, at: 86, df: 86, sp: 73, exp: 342, money: 399, passive: null, special: 'soulSlash', drop: { id: 'I03', chance: 0.2 } },
    golem: { key: 'golem', name: 'Lava Golem', zone: 4, tier: 3, lv: 47, hp: 1660, at: 94, df: 97, sp: 79, exp: 374, money: 435, passive: 'moltenBody', special: 'magmaPunch', drop: { id: 'I08', chance: 0.2 } },
  };
  D.ZONE_MONSTERS = { 1: ['slime', 'wolf', 'monkey'], 2: ['kongkoi', 'mushroom', 'tiger'], 3: ['scorpion', 'mummy', 'wyrm'], 4: ['shadow', 'deathknight', 'golem'] };
  D.E04_MULT = 1.3;

  D.ARMY = {
    B01: { key: 'B01', name: 'Iron Fang General', zone: 1, lv: 12, hp: 460, at: 21, df: 20, sp: 22, exp: 400, money: 700, stars: 2,
      passive: 'thickHide', special: 'earthquake', specialDef: 'raiseShield', drops: [{ id: 'C01', chance: 1 }] },
    B02: { key: 'B02', name: 'Dark Dryad General', zone: 2, lv: 24, hp: 960, at: 44, df: 43, sp: 46, exp: 900, money: 1600, stars: 2,
      passive: 'regenRoots', special: 'vines', specialDef: 'hardBark', drops: [{ id: 'C02', chance: 1 }] },
    B03: { key: 'B03', name: 'Sand Scorpion General', zone: 3, lv: 36, hp: 1400, at: 62, df: 68, sp: 65, exp: 1500, money: 3000, stars: 2,
      passive: 'poisonTail', special: 'ragingSandstorm', specialDef: 'burrow', drops: [{ id: 'C03', chance: 1 }] },
    B04: { key: 'B04', name: 'Demon Lord', zone: 4, lv: 50, hp: 3600, at: 66, df: 89, sp: 70, exp: 3000, money: 8000, stars: 3,
      passive: 'threeForms', special: 'hellfire', specialDef: 'darkVeil', drops: [{ id: 'IQ01', chance: 1 }] },
  };
  D.MINION = {
    key: 'minion', name: 'Demon Lord Minion', stars: 1, passive: 'stickyFingers', special: 'rockThrow', specialDef: 'suddenDodge',
    drops: [{ id: 'I05', chance: 0.5 }, { id: 'C04', chance: 0.1 }],
    lv: [7, 19, 31, 43], hp: [155, 480, 1050, 1590], at: [12, 35, 56, 88], df: [9, 26, 46, 67], sp: [11, 31, 53, 80],
    exp: [100, 270, 440, 610], money: [175, 475, 775, 1075],
  };
  /* ENEMY_STATS_END */
  D.minionStats = function (zone) {
    const m = D.MINION, i = zone - 1;
    return { key: 'minion', name: m.name, zone, lv: m.lv[i], hp: m.hp[i], at: m.at[i], df: m.df[i], sp: m.sp[i],
      exp: m.exp[i], money: m.money[i], stars: m.stars, passive: m.passive, special: m.special, specialDef: m.specialDef, drops: m.drops };
  };

  /* ------------------------------------------------------------------ events */
  D.EVENTS = {
    E01: { name: 'Training Ground', icon: '🏋️', weight: 30, text: 'A random stat is trained: 50% +1 point / 50% −1 point.' },
    E02: { name: 'Kind Doctor', icon: '🩺', weight: 30, text: 'Pay 10% of your money to restore full HP?' },
    E03: { name: 'Dropped Money', icon: '💰', weight: 30, text: 'You find money on the road! (60 / 240 / 540 / 960 G by zone)' },
    E04: { name: 'Townspeople Request Help', icon: '🙏', weight: 10, text: 'Fight the toughest monster in the zone (HP & AT ×1.3). Win to gain 1 extra star!' },
  };

  /* ------------------------------------------------------------------ King's Requests (weekly side quests) */
  /* Every 7 days the King posts one request; the first hero to finish it earns +1 ⭐ and gold.
   * {n}, {monster} and {place} are filled in when the request is posted (Game.postRequest). */
  D.REQUEST_DAYS = 7;
  D.REQUEST_GOLD = [0, 200, 600, 1200, 2000];      // reward by frontier zone
  D.REQUESTS = [
    { id: 'hunt', icon: '⚔️', text: 'Defeat {n} monsters', n: 4, event: 'kill' },
    { id: 'bounty', icon: '🎯', text: 'Defeat a {monster}', n: 1, event: 'killKey' },
    { id: 'chests', icon: '🎁', text: 'Open {n} treasure chests', n: 2, event: 'chest' },
    { id: 'gold', icon: '💰', text: 'Earn {n} G from battles', nByZone: [0, 300, 1000, 2000, 3500], event: 'battleGold' },
    { id: 'levels', icon: '⬆️', text: 'Gain {n} levels', n: 2, event: 'level' },
    { id: 'duel', icon: '🤺', text: 'Win a duel against another hero', n: 1, event: 'duelWin' },
    { id: 'minion', icon: '😈', text: 'Defeat the Demon Lord Minion', n: 1, event: 'minion' },
    { id: 'merit', icon: '🙏', text: 'Make merit at a temple', n: 1, event: 'merit', minZone: 2 },
    { id: 'letter', icon: '✉️', text: 'Deliver a royal letter to the {place}', n: 1, event: 'visit' },
  ];

  /* ------------------------------------------------------------------ map */
  D.TYPE_INFO = {
    e: { name: 'Empty Space', color: '#f5cf4f', side: '#b88f22' },
    t: { name: 'Treasure Space', color: '#5ac86a', side: '#378a43' },
    B: { name: 'Demon Lord General', color: '#5b2a86', side: '#351652' },
    B04: { name: "Demon Lord's Castle", color: '#1d1b22', side: '#09080b', border: '#d62828' },
    L: { name: 'Town', color: '#f59a3c', side: '#b5661b' },
  };
  D.PLACES = {
    L01: { name: 'Royal Castle', icon: '🏰', text: "Change class, set your respawn point, or deliver the Demon Lord's Head." },
    L02: { name: 'Shop', icon: '🛒', text: 'Sells 6 useful items.' },
    L03: { name: 'Equipment Shop', icon: '⚒️', text: 'Sells 2 tiers of weapons and armor for this zone.' },
    L04: { name: 'Skillbook Shop', icon: '📚', text: 'Sells a Special move, a Special Defense, and a spellbook.' },
    L05: { name: 'Temple', icon: '🛕', text: 'Change class, set your respawn point, or make merit (donate 10% of your money).' },
    L06: { name: 'Larb Shop', icon: '🥗', text: 'Sells Larb for 100 G each.' },
    L07: { name: 'Horse-Racing Track', icon: '🏇', text: 'Bet on 1 of 6 horses. A correct pick pays 5×.' },
  };

  /* Layouts copied from the spec. Node rows are the even lines; columns are 5 chars wide.
   * "──" links horizontally, "│" (odd lines) links vertically. */
  /* Layouts copied from the spec (§7.2). Node rows are the even lines; codes sit every 5 characters.
   * "──" links horizontally; "│" (odd lines, under the first or middle character of a code) links vertically.
   * Duplicate codes in the drawn map were renamed: Zone 1 second t04 → t07, Zone 2 second e30 → e41. */
  D.ZONES = [
    { id: 1, name: 'Kingdom of Arendore', theme: 'kingdom', offset: [0, 10], levels: '1–12', entry: 'L01', boss: 'B01', layout: [
      '                              B01',
      '                               │',
      'e29──L04──e30       t05──e33──e34──e35',
      '│          │         │              │',
      'e28       t04       e31──e32──L02──t06',
      '│          │         │              │',
      'e24──e25──e26──e27──e15──e16──e17──e18',
      '│                    │              │',
      'e23       e22──L07──e14            e19',
      '│          │         │              │',
      'e20──t03──e21       e13──e12──t07──e11',
      '│                                   │',
      'e04──L01──e01──e05──t02            e10',
      '│          │         │              │',
      'e03──t01──e02──e06──e07──e08──L03──e09',
    ] },
    { id: 2, name: 'Forest', theme: 'forest', offset: [5, 1], levels: '13–24', entry: 'e01', boss: 'B02', layout: [
      '               e46──e47──L02──e48',
      '                │              │',
      'e39──L04──e40──t06──e42──e43──e44──e45──B02',
      '│          │    │              │    │',
      'e35       e36──e37            e38  t05',
      '│          │    │              │    │',
      'e30──e41──e31──e32            e33──e34',
      '│          │                   │',
      'e26       e27──t04──e28       e29',
      '│                    │         │',
      'e20──L03──e21──e22──t03──e23──e24──L05──e25',
      '│          │                   │         │',
      'e16       e17                 e18       e19',
      '│          │                   │         │',
      'e09──t02──e10──e11──e12──e13──e14──L06──e15',
      '│                         │              │',
      'e02──e01──e03──e04──e05──t01──e06──e07──e08',
    ] },
    { id: 3, name: 'Desert', theme: 'desert', offset: [15, 0], levels: '24–36', entry: 'e01', boss: 'B03', layout: [
      '                              e15──L02──e16',
      '                               │         │',
      '     e10──e11──L05──e12       e13       e14',
      '      │              │         │         │',
      'e01──e02──e03──e04──e05──e06──e07──e08──e09──t01',
      '      │    │    │              │              │',
      '     e17──t02  e18       e19──e20──e21       e22',
      '      │         │         │         │         │',
      '     e23──e24──e25──t03──e26──L03──e27──t04──e28',
      '      │                                  │',
      '     e29──e30──e31──e32──e33──e34──e35──e36',
      '      │         │              │         │',
      '     e37──t05──e38            e39       e40──e41',
      '      │         │              │              │',
      '     e42       e43──e44──e45──e46──t06──e47──e48',
      '      │         │         │         │    │',
      '     e49       e50       e51       e52  e53',
      '      │         │         │         │    │',
      '     e54       e55──L04──e56──e57──e58──t07──e59',
      '      │         │         │         │         │',
      '     t08──e60──e61──e62──e63       e64──B03──e65',
    ] },
    { id: 4, name: "Demon Lord's Land", theme: 'demon', offset: [15, 12], levels: '37–50', entry: 'e01', boss: 'B04', layout: [
      '                                        e01',
      '                                         │',
      'e02──L04──e03       e04──e05──e06──e07──e08──e09',
      '│          │         │         │              │',
      'e10──t01──e11──e12──e13──t02──e14            e15',
      '│               │                             │',
      'e16       e17──e18                           e19',
      '│          │                                  │',
      'e20──t03──e21──e22──e23──e24──e25──e26──L05──t04',
      '│                    │         │              │',
      'e27──e28──L03──e29──t05──e30  e31            e32',
      '│               │         │    │              │',
      'e33──e34──e35──e36       e37  e38──L02──e39──e40',
      '      │                   │         │         │',
      '     e41──e42──B04──e43  e44       e45       e46',
      '      │              │    │         │         │',
      '     t06──e47──e48──e49──e50──e51──e52──t07──e53',
    ] },
  ];
  /* [a, b, style]: style 'bridge' draws a wooden bridge over the sea. */
  D.CROSS_LINKS = [['1-B01', '2-e01'], ['2-B02', '3-e01', 'bridge'], ['3-B03', '4-e01']];
  D.EXTRA_LINKS = [];
  D.LINK_WAYPOINTS = {};

  /* ------------------------------------------------------------------ minigames */
  D.HORSES = [
    { name: 'Swift Mango', color: '#f5b120' },
    { name: 'Sticky Rice Storm', color: '#f4f1e8' },
    { name: 'Lucky Tuk-Tuk', color: '#2bb0d6' },
    { name: 'Midnight Durian', color: '#5b3f8c' },
    { name: 'Golden Elephant', color: '#d6a531' },
    { name: 'Spicy Chili', color: '#e0412f' },
  ];

  /* ------------------------------------------------------------------ dialogue */
  D.SPEAKERS = {
    system: { name: 'System', portrait: 'scroll' },
    king: { name: 'King', portrait: 'king' },
    assistant: { name: "King's Assistant", portrait: 'assistant' },
    narrator: { name: 'Narrator', portrait: 'scroll' },
    villager: { name: 'Villager', portrait: 'villager' },
    darklord: { name: 'Dark Lord', portrait: 'demonlord' },
    darkvoice: { name: "Dark Lord's Voice", portrait: 'darkvoice' },
  };
  D.DIALOGUE = {
    cinematic: "When the Demon Lord returns to threaten the world, the kingdom announces: choose one hero to receive the King's Blessing. The four heroes set out on a journey; although they may need to cooperate to survive, in the end only one can claim the ultimate reward.",
    prologue: [
      { who: 'king', text: "Heroes, our kingdom is in danger. The one who achieves the greatest deeds will receive the King's Blessing!" },
      { who: 'assistant', text: "But the road ahead is filled with monsters and the Demon Lord's minions. You may have to cooperate… or compete against one another." },
      { who: 'narrator', text: 'Players travel through cities, forests, and dangerous areas. Along the way, they may encounter monsters, events, or townspeople who need help. Helping people allows the kingdom to recover, but each player must also compete to accumulate money, experience, and achievements.' },
    ],
    generalFirst: 'Do you really think you can pass through this land so easily? Our Dark Lord is waiting for the day when the entire world will fall under his shadow!',
    generalShort: 'Do you really think you can simply pass through this land?',
    villager: 'Thank you for helping us! I heard that other heroes are also making their way here. Be careful!',
    castleDecision: 'When the players arrive at the castle, they must decide whether to work together to fight the final battle or save their strength and items to increase their chances of winning the rewards.',
    castleEnter: 'You have traveled a long way. The Dark Lord is inside. If you do not stop him now, the kingdom will never be the same again.',
    dlFirst: "You have fought your way here together, yet in the end, you still have to compete with one another for the blessings, don't you? Humans are truly so predictable.",
    dlShort: 'Come and get me, you pathetic hero.',
    dlDefeated: "When the Dark Lord is defeated, the threat to the kingdom comes to an end. The King will bestow the King's Blessing upon the player with the greatest achievements, based on completed quests, accumulated wealth, defeated bosses, and assistance provided to fellow players.",
    good: "You have all helped save the kingdom, but one among you has distinguished themselves above the rest... Step forward and receive the King's Blessing!",
    results: "You have all helped save the kingdom, but one of you has achieved the greatest deeds… step forward to receive the King's Blessing!",
    bad: 'Look upon your world for the last time. From this day forth, all kingdoms shall kneel before me. Your heroes have fallen, your hopes are broken, and nothing can stop the rise of my eternal reign!',
    /* {holder} is replaced by the name of the hero carrying the head. */
    secret: [
      { who: 'holder', text: 'What?! What is happening?!' },
      { who: 'king', text: "No... It can't be. Put the Dark Lord's head down! Now!" },
      { who: 'holder', text: "I... I can't control my body!" },
      { who: 'king', text: "Guards! Stop them before it's too late!" },
      { who: 'darkvoice', text: 'Foolish humans... Did you truly believe that defeating me would end my reign?' },
      { who: 'holder', text: 'Who... who are you?!' },
      { who: 'darkvoice', text: 'I am not gone. I have merely found a new vessel.' },
      { who: 'king', text: 'Everyone, stand back! That is no longer the hero who saved our kingdom...' },
      { who: 'holder', text: "No... I won't become you!" },
      { who: 'darklord', text: 'You already have.' },
      { who: 'narrator', text: 'The hero who once fought to save the kingdom became the new Dark Lord. With the kingdom powerless to stop them, darkness spread across the land... until the entire world fell under their rule.' },
      { who: 'king', text: 'The kingdom... is lost.' },
    ],
  };

  /* ------------------------------------------------------------------ help */
  D.KEYS = [
    ['Normal play', 'Q Move · O Inventory · I Free Camera · X Status · L Log · Z How to Play'],
    ['While moving', 'W/A/S/D walk one space (you must walk every step) · E Free Camera · I Auto-Move · O Status · N Full Map'],
    ['Battle', 'W/A/S/D Select command · Z Enemy Info · A/D + Enter pick a card (no items during a fight)'],
    ['Menus', 'W/A/S/D Select · Enter Confirm · number keys pick options'],
    ['Anywhere', 'ESC closes a window; with no window open it opens the Pause Menu'],
  ];
  D.HELP = [
    ['Goal', "Earn the most ⭐ in 140 days (or play Endless until the Demon Lord's Head is delivered). Minion 1 · General 2 · Demon Lord 3 · deliver the Head to the Royal Castle 5 · beat a hero after the Demon Lord falls 1 · help townspeople 1 · King's Request 1. Ties: money, then level."],
    ['Turns', '4 heroes take turns; 4 turns = 1 day. Roll 1 die (2 after the Demon Lord falls) and walk EXACTLY that many spaces, never visiting a space twice. Stepping onto a General or the Demon Lord\'s Castle stops you there. No route of that length = your turn is skipped.'],
    ['Spaces', '🟨 Empty: 70% monster / 30% event · 🟩 Treasure · 🟪 General · ⬛ Demon Lord\'s Castle · 🟧 Towns (castle, shops, temple, Larb shop, horse track). Nobody fights inside a building.'],
    ['Battle', 'Pick a card to decide who attacks first. Each round both sides attack once, 3 rounds per turn. Attack vs Defend = ×0.5, vs Counter = ×1.5. Strike vs Defend = ×2, vs Counter = you get countered. Special and Class moves ignore Defend/Counter. Duels between heroes continue every turn until someone is knocked out or gives up. Walking into someone else\'s fight forces you to join it.'],
    ['Growth', 'Level up (max 50) for stats, 2 free points and a full heal. Master a class (10 Job EXP) to keep its bonus and unlock Tier 2. Change class at the Royal Castle or a Temple. Secret classes unlock by eating Larb, going all-in at the races, or making merit 3 times.'],
    ['Setbacks', 'Knocked out: return to your respawn point and skip your next turn. Give up: stay put and skip your next turn. Items cannot be used during a fight, so heal before you roll.'],
    ['King\'s Requests', 'Every week the King posts a request. The first hero to finish it earns +1 ⭐ and gold.'],
    ['Endings', "Bring the Demon Lord's Head to the Royal Castle for the Good Ending. Fail to defeat him in time: Bad Ending. Hold the head without delivering it… find out."],
  ];

  return D;
})();
