'use strict';
/* Sole Blessed — ALL static game data (spec: docs/project_spec.md, docs/game_dialogue.md).
 * Rules code reads from here; never hard-code balance numbers elsewhere. */

const DATA = (() => {
  const D = {};

  D.TITLE = 'Sole Blessed';
  D.VERSION = '1.0.0';
  D.SAVE_SCHEMA = 1;
  D.MAX_DAYS = 35;
  D.MAX_LEVEL = 30;
  D.NUM_PLAYERS = 4;
  D.ROUNDS_PER_DAY = 3;
  D.MINION_FIRST_DAY = 3;
  D.INV_SIZE = 6;
  D.CELL = 120;                       // px between spaces (world units)
  D.START = { level: 1, hp: 30, at: 5, df: 3, sp: 5, money: 300 };
  /* Per-game rules chosen at character creation. Defaults = the spec. Brisk/longer games exist
   * because simulations show the Demon Lord is almost never reached in 35 days with spec EXP
   * (see CLAUDE.md "Balance notes"). */
  D.RULES_DEFAULT = { days: 35, pace: 'classic' };
  D.RULES_RECOMMENDED = { days: 45, pace: 'brisk' };
  D.DAY_OPTIONS = [35, 45, 60];
  D.PACES = {
    classic: { name: 'Classic', expMul: 1, regen: 0, text: 'Exact spec balance. Very hard to reach the Demon Lord in 35 days.' },
    brisk: { name: 'Brisk', expMul: 1.5, regen: 0.1, text: 'EXP ×1.5 and every hero recovers 10% HP at the start of each day.' },
  };
  D.PLAYER_COLORS = ['#e8553d', '#3b82f6', '#22a55a', '#a855f7'];
  D.BOT_NAMES = ['Somchai', 'Mali', 'Arthit', 'Kanya', 'Ploy', 'Tawan', 'Nok', 'Boonmee', 'Dao', 'Kaew',
    'Rowan', 'Elara', 'Brom', 'Fah', 'Chai', 'Pim', 'Sombat', 'Lamai', 'Orin', 'Suda'];

  /* ------------------------------------------------------------------ classes */
  D.TIER1 = ['commoner', 'shaman', 'slingshot'];
  D.CLASS_GRID = [['commoner', 'warlord'], ['shaman', 'archmage'], ['slingshot', 'bowlord'], ['isan', 'gambler', 'templekid']];
  D.CLASSES = {
    commoner: {
      name: 'Sword-wielding Commoner', short: 'Commoner', tier: 1, next: 'warlord', magic: false,
      unlockText: 'Starting class', levelUp: { hp: 10, at: 1 }, mastery: { hp: 5 },
      passive: { id: 'beginner', name: 'Beginner', text: 'AT +20%, but every attack has a 50% chance to deal −20% damage' },
      move: { id: 'fullForce', name: 'Full-force Slash', cd: 2, fx: { type: 'baseMulPlusSp', mul: 2 }, text: 'Base ×2 + SP' },
    },
    warlord: {
      name: 'Hotheaded Sword Warlord', short: 'Sword Warlord', tier: 2, magic: false,
      unlockText: 'Master Sword-wielding Commoner', levelUp: { hp: 10, at: 1, df: 1 }, mastery: { df: 1 },
      passive: { id: 'hotheaded', name: 'Hotheaded', text: 'AT +50%, but every attack has a 20% chance to miss' },
      move: { id: 'furious', name: 'Furious Slash', cd: 3, fx: { type: 'furious', mul: 2.5, lost: 0.3 }, text: 'Base ×2.5 + 30% of lost HP' },
    },
    shaman: {
      name: 'Apprentice Shaman', short: 'Shaman', tier: 1, next: 'archmage', magic: true,
      unlockText: 'Starting class', levelUp: { df: 1, sp: 2 }, mastery: { sp: 1 },
      passive: { id: 'novice', name: 'Novice Caster', text: 'SP +20%, but every attack has a 50% chance to deal −20% damage' },
      move: { id: 'crooked', name: 'Crooked Fireball', cd: 2, fx: { type: 'spMul', mul: 3.5 }, text: 'SP ×3.5' },
    },
    archmage: {
      name: 'Loquacious Archmage', short: 'Archmage', tier: 2, magic: true,
      unlockText: 'Master Apprentice Shaman', levelUp: { hp: 10, sp: 2 }, mastery: { sp: 1 },
      passive: { id: 'looseTongue', name: 'Loose Tongue', text: 'At the end of your turn, 50% chance to reduce the cooldown of a Special/Class move by 1 day' },
      move: { id: 'youB', name: 'You B#!$!', cd: 2, fx: { type: 'spMul', mul: 4.5 }, text: 'SP ×4.5' },
    },
    slingshot: {
      name: 'Slingshot Lad', short: 'Slingshot Lad', tier: 1, next: 'bowlord', magic: false,
      unlockText: 'Starting class', levelUp: { at: 2, sp: 1 }, mastery: { at: 1 },
      passive: { id: 'keenEyes', name: 'Keen Eyes', text: 'Attack/Strike has a 20% chance to critically hit for ×1.5' },
      move: { id: 'rubberBand', name: 'Rubber Band Shot', cd: 2, fx: { type: 'baseMulPlusSp', mul: 1.5 }, text: 'Base ×1.5 + SP' },
    },
    bowlord: {
      name: 'Cross-eyed Bow Warlord', short: 'Bow Warlord', tier: 2, magic: false,
      unlockText: 'Master Slingshot Lad', levelUp: { at: 2, sp: 1 }, mastery: { at: 1 },
      passive: { id: 'crossEyed', name: 'Cross-eyed', text: 'Attack/Strike has a 30% chance to critically hit for ×2, with a 10% chance to miss' },
      move: { id: 'arrows', name: 'Wild Arrow Barrage', cd: 2, fx: { type: 'arrows', n: 3, mul: 0.7 }, text: '3 arrows, each (Base + SP) ×0.7; Passive rolls per arrow' },
    },
    isan: {
      name: 'Isan Person', short: 'Isan Person', tier: 0, magic: false,
      unlockText: 'Use Larb for the first time', levelUp: { hp: 10, at: 2 }, mastery: { at: 1 },
      passive: { id: 'eater', name: 'Adventurous Eater', text: 'HP-restoring items are 50% more effective, and using one grants AT +40% for your next battle' },
      move: { id: 'sizzle', name: 'Spicy Sizzle', cd: 2, fx: { type: 'atMul', mul: 3.5, drain: 0.5 }, text: 'AT ×3.5; restore HP equal to 50% of damage dealt' },
    },
    gambler: {
      name: 'Gambler', short: 'Gambler', tier: 0, magic: false,
      unlockText: 'Go All-in at the horse-racing track (win or lose)', levelUp: { hp: 10, at: 1, sp: 1 }, mastery: { hp: 5 },
      passive: { id: 'lucky', name: 'Lucky', text: 'When HP reaches 0, 50% chance to revive with 20% HP' },
      move: { id: 'allIn', name: 'All-In', cd: 1, fx: { type: 'allIn', mul: 2, tries: 5 }, text: '50%: deal SP ×2 and roll again, up to 5 times' },
    },
    templekid: {
      name: 'Temple Kid', short: 'Temple Kid', tier: 0, magic: false,
      unlockText: 'Make merit 3 times at a temple', levelUp: { hp: 10, at: 1, df: 1 }, mastery: { df: 1 },
      passive: { id: 'blessed', name: 'Blessed Merit', text: 'At the start of a new day, restore 10% HP' },
      move: { id: 'alms', name: 'Alms Round', cd: 3, fx: { type: 'alms' }, text: "50% of opponent's AT + 50% of opponent's SP" },
    },
  };

  /* ------------------------------------------------------------------ skills */
  D.SKILLS = {
    SK1: { kind: 'special', zone: 1, name: 'Tiny Fireball', price: 300, cd: 2, fx: { type: 'spMul', mul: 2 }, text: 'SP ×2', icon: '🔥' },
    SK2: { kind: 'special', zone: 2, name: 'Life Drain', price: 700, cd: 3, fx: { type: 'spMul', mul: 1.5, drain: 1 }, text: 'SP ×1.5; restore HP equal to damage dealt', icon: '🧛' },
    SK3: { kind: 'special', zone: 3, name: 'Sandstorm', price: 1500, cd: 3, fx: { type: 'spMul', mul: 4 }, text: 'SP ×4', icon: '🌪️' },
    SK4: { kind: 'special', zone: 4, name: 'Heavenly Light Sword', price: 3000, cd: 3, fx: { type: 'atSpMul', mul: 2.5 }, text: '(AT + SP) ×2.5', icon: '⚔️' },
    SD1: { kind: 'specialDef', zone: 1, name: 'Power Recovery', price: 300, cd: 2, fx: { type: 'heal', mul: 2 }, text: 'Restore HP = SP ×2 before being attacked', icon: '💚' },
    SD2: { kind: 'specialDef', zone: 2, name: 'Stone Armor', price: 700, cd: 2, fx: { type: 'reduce', v: 0.4 }, text: 'Damage −40%', icon: '🗿' },
    SD3: { kind: 'specialDef', zone: 3, name: 'Reflective Mirror', price: 1500, cd: 3, fx: { type: 'mirror' }, text: 'Reflect all Special/Class moves back', icon: '💎' },
    SD4: { kind: 'specialDef', zone: 4, name: 'Holy Shield', price: 3000, cd: 4, fx: { type: 'immune' }, text: 'Take no damage this time', icon: '🛡️' },
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
    MB01: { tab: 'books', zone: 1, name: 'Homecoming Tome', icon: '📘', price: 100, fx: 'home', text: 'Warp to your respawn point. Cannot be used while holding the Demon Lord\'s Head.' },
    MB02: { tab: 'books', zone: 2, name: 'Pickpocket', icon: '🧤', price: 200, fx: 'pickpocket', text: "Steal 1 random item from a hero's Item tab (anywhere on the map)." },
    MB03: { tab: 'books', zone: 3, name: 'Monster Trap', icon: '🕳️', price: 350, fx: 'trap', text: 'Place a trap on an empty space within 6 spaces. The first other hero to stop there fights a monster from the next zone.' },
    MB04: { tab: 'books', zone: 4, name: 'Challenge Letter', icon: '✉️', price: 500, fx: 'challenge', text: 'Immediately challenge a hero within 6 spaces.' },
    IQ01: { tab: 'quest', name: "Demon Lord's Head", icon: '💀', price: 0, fx: 'quest', text: "Deliver it to the Royal Castle for 5 stars and end the game. Cannot be sold, discarded, or stolen by magic." },
  };
  D.SHOP_ITEMS = ['I02', 'I03', 'I04', 'I05', 'I06', 'I07'];
  D.TREASURE_ITEMS = [['I04', 3], ['I02', 2], ['I06', 2], ['I01', 2], ['I05', 1], ['I07', 1], ['I03', 1]];

  /* ------------------------------------------------------------------ equipment */
  D.EQUIP = {
    W1: { slot: 'weapon', zone: 1, name: 'Bamboo Sword', at: 3, price: 150, icon: '🗡️' },
    S1: { slot: 'weapon', zone: 1, name: 'Tamarind Branch Staff', sp: 3, price: 150, icon: '🪄' },
    A1: { slot: 'armor', zone: 1, name: 'Buffalo Leather Shirt', df: 2, hp: 10, price: 150, icon: '🥋' },
    W2: { slot: 'weapon', zone: 2, name: 'Steel Sword', at: 6, price: 400, icon: '🗡️' },
    S2: { slot: 'weapon', zone: 2, name: 'Vine Staff', sp: 6, price: 400, icon: '🪄' },
    A2: { slot: 'armor', zone: 2, name: 'Iron Armor', df: 4, hp: 20, price: 400, icon: '🛡️' },
    W3: { slot: 'weapon', zone: 3, name: 'Desert Sword', at: 10, price: 900, icon: '⚔️' },
    S3: { slot: 'weapon', zone: 3, name: 'Amber Rod', sp: 10, price: 900, icon: '🔮' },
    A3: { slot: 'armor', zone: 3, name: 'Sandscale Armor', df: 7, hp: 35, price: 900, icon: '🛡️' },
    W4: { slot: 'weapon', zone: 4, name: 'Demon-Slaying Sword', at: 15, price: 1800, icon: '⚔️' },
    S4: { slot: 'weapon', zone: 4, name: 'Star Rod', sp: 15, price: 1800, icon: '🌟' },
    A4: { slot: 'armor', zone: 4, name: "Hero's Armor", df: 10, hp: 50, price: 1800, icon: '🛡️' },
  };
  D.CHARMS = {
    C01: { slot: 'charm', name: 'Boar Fang', at: 3, price: 0, icon: '🦷', text: 'AT +3' },
    C02: { slot: 'charm', name: 'Fang-Guard Talisman', df: 3, price: 0, icon: '📿', text: 'DF +3' },
    C03: { slot: 'charm', name: "Mage's Ring", sp: 3, price: 0, icon: '💍', text: 'SP +3' },
    C04: { slot: 'charm', name: 'Lucky Coin', moneyBonus: 0.2, price: 0, icon: '🪙', text: 'Money from battles +20%' },
  };
  D.GEAR = Object.assign({}, D.EQUIP, D.CHARMS);

  /* ------------------------------------------------------------------ enemies */
  D.MONSTERS = {
    slime: { key: 'slime', name: 'Sticky Rice Slime', zone: 1, lv: 2, hp: 40, at: 5, df: 2, sp: 2, exp: 20, money: 20, passive: 'stickyBody', special: null, drop: { id: 'I04', chance: 0.3 } },
    wolf: { key: 'wolf', name: 'Hungry Wolf', zone: 1, lv: 3, hp: 34, at: 6, df: 1, sp: 2, exp: 25, money: 25, passive: 'rapidBite', special: null, drop: { id: 'I04', chance: 0.2 } },
    kongkoi: { key: 'kongkoi', name: 'Kong Koi Ghost', zone: 2, lv: 8, hp: 150, at: 18, df: 8, sp: 12, exp: 75, money: 70, passive: 'leapDodge', special: null, drop: { id: 'I06', chance: 0.2 } },
    mushroom: { key: 'mushroom', name: 'Walking Poison Mushroom', zone: 2, lv: 9, hp: 160, at: 17, df: 10, sp: 18, exp: 85, money: 75, passive: null, special: 'poisonSpores', drop: { id: 'I04', chance: 0.3 } },
    scorpion: { key: 'scorpion', name: 'Giant Sand Scorpion', zone: 3, lv: 15, hp: 240, at: 30, df: 18, sp: 15, exp: 165, money: 150, passive: 'stinger', special: null, drop: { id: 'I05', chance: 0.2 } },
    mummy: { key: 'mummy', name: 'Anachronistic Mummy', zone: 3, lv: 16, hp: 250, at: 28, df: 16, sp: 30, exp: 175, money: 160, passive: null, special: 'cursedBandages', drop: { id: 'I07', chance: 0.2 } },
    shadow: { key: 'shadow', name: 'Shadow Demon', zone: 4, lv: 22, hp: 360, at: 43, df: 22, sp: 30, exp: 270, money: 300, passive: 'shadowForm', special: null, drop: { id: 'I05', chance: 0.3 } },
    deathknight: { key: 'deathknight', name: 'Death Knight', zone: 4, lv: 23, hp: 380, at: 42, df: 28, sp: 35, exp: 290, money: 320, passive: null, special: 'soulSlash', drop: { id: 'I03', chance: 0.2 } },
  };
  D.ZONE_MONSTERS = { 1: ['slime', 'wolf'], 2: ['kongkoi', 'mushroom'], 3: ['scorpion', 'mummy'], 4: ['shadow', 'deathknight'] };
  D.E04_MULT = 1.3;

  D.ARMY = {
    B01: { key: 'B01', name: 'Iron Fang General', zone: 1, lv: 6, hp: 240, at: 11, df: 6, sp: 12, exp: 90, money: 100, stars: 2,
      passive: 'thickHide', special: 'earthquake', specialDef: 'raiseShield', drops: [{ id: 'C01', chance: 1 }] },
    B02: { key: 'B02', name: 'Dark Dryad General', zone: 2, lv: 12, hp: 440, at: 22, df: 14, sp: 24, exp: 300, money: 250, stars: 2,
      passive: 'regenRoots', special: 'vines', specialDef: 'hardBark', drops: [{ id: 'C02', chance: 1 }] },
    B03: { key: 'B03', name: 'Sand Scorpion General', zone: 3, lv: 19, hp: 700, at: 34, df: 22, sp: 35, exp: 600, money: 600, stars: 2,
      passive: 'poisonTail', special: 'ragingSandstorm', specialDef: 'burrow', drops: [{ id: 'C03', chance: 1 }] },
    B04: { key: 'B04', name: 'Demon Lord', zone: 4, lv: 28, hp: 1800, at: 48, df: 30, sp: 55, exp: 1200, money: 1500, stars: 3,
      passive: 'threeForms', special: 'hellfire', specialDef: 'darkVeil', drops: [{ id: 'IQ01', chance: 1 }] },
  };
  D.MINION = {
    key: 'minion', name: 'Demon Lord Minion', stars: 1, passive: 'stickyFingers', special: 'rockThrow', specialDef: 'suddenDodge',
    drops: [{ id: 'I05', chance: 0.5 }, { id: 'C04', chance: 0.1 }],
    lv: [4, 10, 17, 24], hp: [85, 200, 330, 480], at: [9, 20, 32, 45], df: [4, 10, 17, 25], sp: [8, 18, 28, 40],
    exp: [50, 180, 380, 650], money: [60, 200, 450, 900],
  };
  D.minionStats = function (zone) {
    const m = D.MINION, i = zone - 1;
    return { key: 'minion', name: m.name, zone, lv: m.lv[i], hp: m.hp[i], at: m.at[i], df: m.df[i], sp: m.sp[i],
      exp: m.exp[i], money: m.money[i], stars: m.stars, passive: m.passive, special: m.special, specialDef: m.specialDef, drops: m.drops };
  };

  /* ------------------------------------------------------------------ events */
  D.EVENTS = {
    E01: { name: 'Training Ground', icon: '🏋️', weight: 30, text: 'A random stat is trained: 50% +1 point / 50% −1 point.' },
    E02: { name: 'Kind Doctor', icon: '🩺', weight: 30, text: 'Pay 10% of your money to restore full HP?' },
    E03: { name: 'Dropped Money', icon: '💰', weight: 30, text: 'You find money on the road!' },
    E04: { name: 'Townspeople Request Help', icon: '🙏', weight: 10, text: 'Fight the toughest monster in the zone (HP & AT ×1.3). Win to gain 1 extra star!' },
  };

  /* ------------------------------------------------------------------ map */
  D.TYPE_INFO = {
    e: { name: 'Empty Space', color: '#f5cf4f', side: '#b88f22' },
    t: { name: 'Treasure Space', color: '#5ac86a', side: '#378a43' },
    B: { name: 'Demon Lord General', color: '#5b2a86', side: '#351652' },
    B04: { name: "Demon Lord's Castle", color: '#1d1b22', side: '#09080b', border: '#d62828' },
    L: { name: 'Town', color: '#f59a3c', side: '#b5661b' },
  };
  D.PLACES = {
    L01: { name: 'Royal Castle', icon: '🏰', text: "Set your respawn point. Deliver the Demon Lord's Head here." },
    L02: { name: 'Shop', icon: '🛒', text: 'Sells 6 useful items.' },
    L03: { name: 'Equipment Shop', icon: '⚒️', text: 'Sells weapons and armor for this zone.' },
    L04: { name: 'Skillbook Shop', icon: '📚', text: 'Sells a Special move, a Special Defense, and a spellbook.' },
    L05: { name: 'Temple', icon: '🛕', text: 'Set your respawn point or make merit (donate 10% of your money).' },
    L06: { name: 'Larb Shop', icon: '🥗', text: 'Sells Larb for 100 G each.' },
    L07: { name: 'Horse-Racing Track', icon: '🏇', text: 'Bet on 1 of 6 horses. A correct pick pays 5×.' },
  };

  /* Layouts copied from the spec. Node rows are the even lines; columns are 5 chars wide.
   * "──" links horizontally, "│" (odd lines) links vertically. */
  D.ZONES = [
    { id: 1, name: 'Kingdom of Arendore', theme: 'kingdom', offset: [0, 6], levels: '1–6', layout: [
      'L05            B01',
      '│              │',
      'e10            L04',
      '│              │',
      'L07──t03──e07──e06──e05──e09',
      '│    │    │',
      'e08  t04  t01',
      '│    │    │',
      'L01──e01──e02──e03──e04──t02──L03',
      '│',
      'L02',
    ] },
    { id: 2, name: 'Forest', theme: 'forest', offset: [4, 0], levels: '6–12', layout: [
      'L06       t03──e11──L03',
      '│         │    │',
      'e13       e10  e12──B02',
      '│         │    │',
      'e08──e07──e06──t04',
      '│         │',
      'L05──t05──e09       t01',
      '│         │',
      'e02──e03──e04──e05──e14──L04',
      '│         │',
      'e01       L02',
    ] },
    { id: 3, name: 'Desert', theme: 'desert', offset: [11, 0], levels: '12–19', layout: [
      'L03',
      '│',
      'e01──e02──e03──e04──e11──L05',
      '│         │',
      't02       t01',
      '│         │',
      'e07──e06──e05──e08──t03',
      '│         │         │',
      'e12       t04──e10──e09',
      '│              │    │',
      'L02            L04  B03',
    ] },
    { id: 4, name: "Demon Lord's Land", theme: 'demon', offset: [12, 6], levels: '19–26', layout: [
      'e01',
      '│',
      'L04──e15──e04──e03──e02',
      '│         │',
      't01       t02       L02',
      '│         │         │',
      'e05──e06──e07──e10──e11',
      '│         │         │',
      'e09──t03──e08──L05  e14       t04',
      '│                   │         │',
      'B04                 t05──e13──e12',
      '│',
      'L03',
    ] },
  ];
  D.CROSS_LINKS = [['1-B01', '2-e01'], ['2-B02', '3-e01'], ['3-B03', '4-e01']];
  /* Spec layout leaves Zone 2 t01 without any connector; link it to e14 directly below it. */
  D.EXTRA_LINKS = [['2-t01', '2-e14']];
  /* Road waypoints (in cells) so long links do not visually cross other spaces. */
  D.LINK_WAYPOINTS = { '3-B03|4-e01': [[15, 5.55], [12, 5.55]] };

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
    ['Normal play', 'Q Move · O Inventory · I Free Camera · X Status · Z How to Play'],
    ['While moving', 'W/A/S/D Move · E Free Camera · I Auto-Move · O Status · N Full Map · Enter Stop'],
    ['Battle', 'W/A/S/D Select command · Z Enemy Info · A/D + Enter pick a card'],
    ['Menus', 'W/A/S/D Select · Enter Confirm · number keys pick options'],
    ['Anywhere', 'ESC closes a window; with no window open it opens the Pause Menu'],
  ];
  D.HELP = [
    ['Goal', 'Earn the most ⭐ in 35 days. Minion 1 · General 2 · Demon Lord 3 · deliver the Demon Lord\'s Head to the Royal Castle 5 · beat a hero after the Demon Lord falls 1 · help townspeople 1. Ties: money, then level.'],
    ['Turns', '4 heroes take turns; 4 turns = 1 day. Roll 1 die (2 after the Demon Lord is defeated) and stop on any space up to that distance. You cannot visit a space twice in one move. Generals and the Demon Lord\'s Castle block the road until defeated.'],
    ['Spaces', '🟨 Empty: 70% monster / 30% event · 🟩 Treasure · 🟪 General · ⬛ Demon Lord\'s Castle · 🟧 Towns: castle, shops, temple, Larb shop, horse track.'],
    ['Battle', 'Pick a card to decide who attacks first. Each round both sides attack once; up to 3 rounds per day vs monsters. Attack vs Defend = ×0.5, vs Counter = ×1.5. Strike vs Defend = ×2, vs Counter = you get countered. Special and Class moves ignore Defend/Counter.'],
    ['Growth', 'Level up for stats + 2 free points. Master a class (10 Job EXP) to keep its bonus forever and unlock its Tier 2 class. Secret classes unlock by eating Larb, going all-in at the races, or making merit 3 times.'],
    ['Endings', "Bring the Demon Lord's Head to the Royal Castle for the Good Ending. Fail to defeat him in 35 days: Bad Ending. Hold the head without delivering it… find out."],
  ];

  return D;
})();
