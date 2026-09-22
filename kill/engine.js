import { commandTransitionsFor } from './commands.js';
import {
  enemyBossProfile, enemyCommandTransitions, enemySkillForCommand,
  enemyCompanionProfile, enemyCompanionCommandTransitions, enemyCompanionSkillForCommand, enemyCompanionBaseHp
} from './enemy-actions.js';
import { BOSS_PRESET_BY_ID } from './boss-presets.js';
import { SKILL_PRESET_BY_ID, normalizeSkillName, presetIdForSkillName } from './presets.js';
// 撃破確率シミュレータ v0.5.66
// 公開用の撃破確率計算に必要な戦闘要素だけを扱います。

export const DEFENDER_ATTRIBUTES = Object.freeze([
  ['none', '無'], ['fire', '火'], ['water', '水'], ['earth', '土'],
  ['wind', '風'], ['light', '光'], ['dark', '闇']
]);

// 撃破確率ページで選択できる敵属性。敵には無・光・闇属性は存在しないため除外。
export const ENEMY_ATTRIBUTE_OPTIONS = Object.freeze([
  ['fire', '火'], ['water', '水'], ['earth', '土'], ['wind', '風']
]);

export const ENEMY_RACE_OPTIONS = Object.freeze([
  ['normal', '通常'], ['undead', 'アンデッド'], ['demon', '悪魔'], ['angel', '天使'], ['birdBeast', '鳥獣'], ['waterRace', '水族'], ['machine', '機械']
]);

export const ATTACK_TYPE_OPTIONS = Object.freeze([
  ['physical', '物理'], ['magic', '魔法'], ['other', 'それ以外']
]);

export const ATTACK_ATTRIBUTES = Object.freeze([
  ['none', '無'], ['fire', '火'], ['heat', '熱'], ['water', '水'], ['ice', '氷'],
  ['earth', '土'], ['poison', '毒'], ['wind', '風'], ['thunder', '雷'],
  ['light', '光'], ['holy', '聖'], ['dark', '闇'], ['evil', '邪'], ['all', '全']
]);

const ATTACK_ATTRIBUTE_INDEX = Object.freeze(Object.fromEntries(ATTACK_ATTRIBUTES.map((x, i) => [x[0], i])));
const DEFENDER_ATTRIBUTE_INDEX = Object.freeze(Object.fromEntries(DEFENDER_ATTRIBUTES.map((x, i) => [x[0], i])));

// 1000 = 100%。アプリ内部で確認した14×7属性表。
const ATTRIBUTE_TABLE = Object.freeze([
  [1000,1000,1000,1000,1000,1000,1000],
  [1000,1000,1500, 900, 800, 900, 900],
  [1000,1000, 900, 900,1400, 900, 900],
  [1000, 800,1000,1500, 900, 900, 900],
  [1000,1400,1000, 900, 900, 900, 900],
  [1000, 900, 800,1000,1500, 900, 900],
  [1000, 900,1400,1000, 900, 900, 900],
  [1000,1500, 900, 800,1000, 900, 900],
  [1000, 900, 900,1400,1000, 900, 900],
  [1000,1050,1050,1050,1050,1000,1500],
  [1000,1070,1070,1070,1070,1000,1400],
  [1000,1050,1050,1050,1050,1500,1000],
  [1000,1070,1070,1070,1070,1400,1000],
  [1000,1100,1100,1100,1100,1100,1100]
]);

export const ALLY_EFFECT_TYPES = Object.freeze([
  ['atkBuff', '攻撃力バフ'],
  ['speedBuff', '素早さバフ'],
  ['defenseDown', '敵の防御ダウン'],
  ['speedDown', '敵の素早さダウン'],
  ['poison', '毒'],
  ['deadlyPoison', '猛毒'],
  ['poisonToDeadly', '毒→猛毒'],
  ['weaknessBuff', '弱点属性強化'],
  ['statusCure', '状態異常治療'],
  ['statusAvoid', '状態異常耐性'],
  ['statusImmune', '状態異常無効']
]);

export const ENEMY_EFFECT_TYPES = Object.freeze([
  ['none', '効果なし'],
  ['allyAtkDebuff', '攻撃デバフ'],
  ['allySpeedDebuff', '素早さデバフ'],
  ['enemyAtkBuff', '敵の攻撃アップ'],
  ['enemyDefenseBuff', '敵の防御アップ'],
  ['enemyDefenseDebuff', '敵の防御ダウン'],
  ['enemyCounterGuard', 'カウンター（防御部分）'],
  ['enemyBlessing', '敵の加護'],
  ['enemySpeedBuff', '敵の素早さアップ'],
  ['heal', '回復'],
  ['statusParalysis', '麻痺'],
  ['statusConfusion', '混乱'],
  ['statusSilence', '沈黙'],
  ['statusDarkness', '暗闇'],
  ['statusSleep', '睡眠'],
  ['statusPetrification', '石化'],
  ['statusCold', '風邪'],
  ['statusBrainwash', '洗脳']
]);

function defaultAllyBuff() {
  return { type: 'atkBuff', target: 'self', mode: 'mult', value: '150', duration: '1' };
}

function defaultEnemyBuff() {
  return { type: 'enemyAtkBuff', mode: 'mult', value: '150', duration: '1' };
}

function defaultEnemyEffect() {
  return { type: 'none', target: 'all', mode: 'mult', value: '20', duration: '1' };
}

function defaultAttackAction() {
  return {
    kind: 'attack',
    skillMultiplier: '200',
    skillMultiplierMin: '',
    skillMultiplierMax: '',
    skillMultiplierStep: '',
    attackAttribute: 'none',
    attackAttribute2: 'none',
    attackType: 'physical',
    hits: '1',
    hitsMin: '',
    hitsMax: '',
    undeadSkillMultiplier: '',
    poisonedSkillMultiplier: '',
    deadlyPoisonSkillMultiplier: '',
    weakDefenderAttribute: '',
    weakSkillMultiplier: '',
    raceSkillMultipliers: {},
    damageFormula: '',
    selfDestruct: false,
    buff: defaultAllyBuff(),
    effects: []
  };
}

function defaultSkipAction() {
  return {
    kind: 'skip', skillMultiplier: '200', skillMultiplierMin: '', skillMultiplierMax: '', skillMultiplierStep: '',
    attackAttribute: 'none', attackAttribute2: 'none', attackType: 'physical', hits: '1', hitsMin: '', hitsMax: '',
    undeadSkillMultiplier: '', poisonedSkillMultiplier: '', deadlyPoisonSkillMultiplier: '', weakDefenderAttribute: '', weakSkillMultiplier: '', raceSkillMultipliers: {}, damageFormula: '', selfDestruct: false, buff: defaultAllyBuff(), effects: []
  };
}

export const DEFAULT_STATE = Object.freeze({
  enemy: { presetId: '', maxHp: '1500', attribute: 'fire', race: 'normal', attack: '0', speed: '45' },
  characterStats: {
    son_goku: { attack: '84', speed: '78' },
    gyumao: { attack: '94', speed: '15' },
    sylph: { attack: '31', speed: '42' },
    crow: { attack: '31', speed: '63' },
    platinum_drake: { attack: '78', speed: '78' },
    clear_blue_dragon: { attack: '73', speed: '68' },
    bahamut: { attack: '89', speed: '73' },
    mimitoshishi: { attack: '42', speed: '63' },
    dark_bahamut: { attack: '89', speed: '73' },
    magora: { attack: '36', speed: '57' },
    kerogon_green: { attack: '31', speed: '52' },
    oniwaka_monk: { attack: '63', speed: '47' },
    oniwaka: { attack: '57', speed: '42' },
    red_empress: { attack: '63', speed: '84' },
    raijin_kukulkan: { attack: '78', speed: '89' },
    venom_behemoth: { attack: '73', speed: '15' },
    heavy_behemoth: { attack: '63', speed: '10' },
    kerogon_yellow: { attack: '31', speed: '21' },
    guardian_powan: { attack: '73', speed: '73' },
    kerogon_blue: { attack: '31', speed: '42' },
    dartan: { attack: '78', speed: '36' },
    kerogon_gold: { attack: '36', speed: '10' },
    camineko: { attack: '42', speed: '68' },
    garanezumi: { attack: '31', speed: '73' },
    black_knight_gebolg: { attack: '74', speed: '31' },
    rakshasa: { attack: '53', speed: '21' },
    scarlet_dragon: { attack: '89', speed: '47' },
    kenran_kukulkan: { attack: '78', speed: '89' },
    shinjuryu_kukulkan: { attack: '78', speed: '84' },
    ifrit: { attack: '84', speed: '42' },
    astaroth: { attack: '68', speed: '31' },
    loki: { attack: '63', speed: '68' },
    toritamago: { attack: '1', speed: '1' },
    ares: { attack: '73', speed: '21' },
    chibimuus: { attack: '45', speed: '15' },
    lafroig: { attack: '94', speed: '57' },
    mermaid_mellow: { attack: '68', speed: '73' },
    captain_azul: { attack: '63', speed: '42' },
    elysion: { attack: '78', speed: '52' },
    hien: { attack: '63', speed: '78' },
    marduk: { attack: '79', speed: '95' },
    enki: { attack: '78', speed: '57' },
    damkina: { attack: '68', speed: '89' },
    saezer: { attack: '68', speed: '52' },
    dante_magic_swordsman: { attack: '68', speed: '31' },
    simon: { attack: '68', speed: '47' },
    hayate: { attack: '57', speed: '84' },
    sky_clay: { attack: '73', speed: '73' },
    djinn: { attack: '63', speed: '84' },
    gate_dante: { attack: '78', speed: '36' },
    yamato: { attack: '78', speed: '78' },
    susanoo: { attack: '73', speed: '78' },
    nanawarai: { attack: '84', speed: '63' },
    ginger_ale: { attack: '84', speed: '52' },
    soccerra: { attack: '92', speed: '26' },
    fire_drake: { attack: '84', speed: '47' }
  },
  allyCount: 3,
  allies: [
    { characterId: 'son_goku', attack: '84', speed: '78', star: '4', attribute: 'wind', race: 'normal', commandVariant: '' },
    { characterId: 'gyumao', attack: '94', speed: '15', star: '4', attribute: 'fire', race: 'normal', commandVariant: '' },
    { characterId: '', attack: '0', speed: '0', star: '', attribute: '', race: 'normal', commandVariant: '' }
  ],
  turns: [{
    allyActions: [
      { ...defaultAttackAction(), kind: 'buff', skillName: 'ロキブランド', buff: { type: 'atkBuff', target: 'star4', mode: 'mult', value: '150', duration: '2' } },
      { ...defaultAttackAction(), kind: 'buff', skillName: '鬼の気合入れ', buff: { type: 'atkBuff', target: 'self', mode: 'mult', value: '200', duration: '1' } },
      { ...defaultSkipAction(), skillName: '' }
    ],
    enemyAction: { enabled: true, effect: defaultEnemyEffect() }
  }]
});

export function cloneDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function trunc0(value) {
  return Math.trunc(value);
}

function parseDecimalFraction(value) {
  const raw = String(value ?? '').trim();
  if (!/^[-+]?\d+(?:\.\d+)?$/.test(raw)) return null;
  const sign = raw.startsWith('-') ? -1n : 1n;
  const clean = raw.replace(/^[-+]/, '');
  const [intPart, fracPart = ''] = clean.split('.');
  const denominator = 10n ** BigInt(fracPart.length);
  const numerator = sign * BigInt((intPart || '0') + fracPart);
  return { numerator, denominator };
}

function mulPercentTrunc(value, percent) {
  const fraction = parseDecimalFraction(percent);
  if (!fraction) return null;
  const numerator = BigInt(trunc0(value)) * fraction.numerator;
  const denominator = fraction.denominator * 100n;
  return Number(numerator / denominator);
}

function decimalPlaces(value) {
  const raw = String(value ?? '').trim().replace(/^[-+]/, '');
  const dot = raw.indexOf('.');
  return dot < 0 ? 0 : raw.length - dot - 1;
}

function scaledDecimal(value, scaleDigits) {
  const fraction = parseDecimalFraction(value);
  if (!fraction) return null;
  const scale = 10n ** BigInt(scaleDigits);
  return fraction.numerator * scale / fraction.denominator;
}

function scaledDecimalToString(value, scaleDigits) {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  if (scaleDigits === 0) return `${negative ? '-' : ''}${abs}`;
  const scale = 10n ** BigInt(scaleDigits);
  const integer = abs / scale;
  const fraction = String(abs % scale).padStart(scaleDigits, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${integer}${fraction ? `.${fraction}` : ''}`;
}

function parseNumber(value, label, { min = -Infinity, max = Infinity } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${label}が不正です`);
  return n;
}

function parseIntValue(value, label, { min = -Infinity, max = Infinity } = {}) {
  const n = trunc0(parseNumber(value, label, { min, max }));
  if (n < min || n > max) throw new Error(`${label}が不正です`);
  return n;
}

function applyMod(value, mod) {
  const amount = Number(mod.value);
  if (!Number.isFinite(amount)) return value;
  if (mod.mode === 'add') return value + trunc0(amount);
  const next = mulPercentTrunc(value, mod.value);
  return next === null ? value : next;
}

function applyMods(base, mods, { clampMin = -Infinity, clampMax = Infinity } = {}) {
  let value = base;
  for (const mod of [...mods].sort((a, b) => a.seq - b.seq)) value = applyMod(value, mod);
  return Math.min(clampMax, Math.max(clampMin, value));
}

// ロート系は内部の継続倍率を小数第3位まで保持し、更新ごとに4桁目以下を切り捨てる。
function compoundProgressiveMultiplier(current, factor) {
  const c = Number(current ?? 1);
  const f = Number(factor ?? 1);
  if (!Number.isFinite(c) || !Number.isFinite(f)) return Number.isFinite(c) ? c : 1;
  return Math.floor((c * f + 1e-12) * 1000) / 1000;
}

function applyProgressiveMultiplier(value, multiplier, { clampMin = -Infinity, clampMax = Infinity } = {}) {
  const m = Number(multiplier ?? 1);
  if (!Number.isFinite(m) || m === 1) return Math.min(clampMax, Math.max(clampMin, value));
  const next = Math.ceil(value * m - 1e-12);
  return Math.min(clampMax, Math.max(clampMin, next));
}

function effectiveAllyAttack(ally) {
  const ordinary = applyMods(ally.baseAttack, ally.attackMods, { clampMin:1, clampMax:999 });
  return applyProgressiveMultiplier(ordinary, ally.rotAttackMultiplier, { clampMin:1, clampMax:999 });
}

function effectiveAllySpeed(ally) {
  const ordinary = applyMods(ally.baseSpeed, ally.speedMods, { clampMin:0, clampMax:999 });
  return applyProgressiveMultiplier(ordinary, ally.rotSpeedMultiplier, { clampMin:0, clampMax:999 });
}

function attrCoefficient(attackAttr, defenderAttr) {
  const a = ATTACK_ATTRIBUTE_INDEX[attackAttr];
  const d = DEFENDER_ATTRIBUTE_INDEX[defenderAttr];
  if (a === undefined || d === undefined) return 1000;
  return ATTRIBUTE_TABLE[a][d];
}

function boostedAttrCoefficient(coefficient, weaknessBoost) {
  if (!weaknessBoost) return coefficient;
  if (coefficient === 1500) return 1900;
  if (coefficient === 1400) return 1800;
  return coefficient;
}

function speciesCoefficient(defenderRace, attackType) {
  if (defenderRace !== 'undead') return 1000;
  if (attackType === 'physical') return 800;
  if (attackType === 'magic') return 1200;
  return 1000;
}

function normalizeEnemyRace(value) {
  return ['undead','demon','angel','birdBeast','waterRace','machine'].includes(value) ? value : 'normal';
}

function raceSkillMultiplier(action, race, fallback) {
  if (race === 'undead' && action.undeadSkillMultiplier !== '') return action.undeadSkillMultiplier;
  const byRace = action.raceSkillMultipliers ?? {};
  if (byRace && Object.prototype.hasOwnProperty.call(byRace, race)) return byRace[race];
  return fallback;
}

function applicableDefenseMods(mods, attackType, attackAttributes = []) {
  const attrs = Array.isArray(attackAttributes) ? attackAttributes : [];
  return (mods ?? []).filter(mod => {
    const typeOk = !Array.isArray(mod.attackTypes) || mod.attackTypes.includes(attackType);
    const attrOk = !Array.isArray(mod.attributes) || mod.attributes.some(attr => attrs.includes(attr));
    return typeOk && attrOk;
  });
}

function attackAttributesFromConfig(config) {
  if (Array.isArray(config.attackAttributes) && config.attackAttributes.length) return config.attackAttributes;
  const attrs = [config.attackAttribute ?? 'none'];
  if (config.attackAttribute2 && config.attackAttribute2 !== 'none') attrs.push(config.attackAttribute2);
  return attrs;
}

function oneHitDistribution({
  attack, speed = 0, skillMultiplier, damageFormula = '', attackAttribute, attackAttribute2, attackAttributes, defenderAttribute, defenderRace,
  attackType, defenseMods, weaknessBoost
}) {
  let base;
  if (damageFormula === 'windmill') {
    // アプリ版Wiki: 風車は1発あたり 攻撃×0.6 + 素早さ×0.15。
    base = trunc0(attack * 0.6 + speed * 0.15);
  } else {
    base = mulPercentTrunc(attack, skillMultiplier);
    if (base === null) throw new Error('技倍率が不正です');
  }
  for (const attr of attackAttributesFromConfig({ attackAttribute, attackAttribute2, attackAttributes })) {
    const coefficient = boostedAttrCoefficient(attrCoefficient(attr, defenderAttribute), weaknessBoost);
    base = trunc0(base * coefficient / 1000);
  }
  base = trunc0(base * speciesCoefficient(defenderRace, attackType) / 1000);

  const counts = new Map();
  for (let r = -50; r <= 50; r++) {
    // アプリ本体と同じく、乱数係数950～1050をダメージ本体へ直接乗算して整数化する。
    let damage = trunc0(base * (1000 + r) / 1000);
    damage = Math.min(damage, 999);
    damage = applyMods(damage, defenseMods, { clampMin: 0 });
    counts.set(damage, (counts.get(damage) ?? 0) + 1);
  }
  return new Map([...counts].map(([damage, count]) => [damage, count / 101]));
}

function convolveDamage(a, b) {
  const out = new Map();
  for (const [da, pa] of a) {
    for (const [db, pb] of b) {
      const key = da + db;
      out.set(key, (out.get(key) ?? 0) + pa * pb);
    }
  }
  return out;
}

function decimalRange(min, max, step) {
  const scaleDigits = Math.max(decimalPlaces(min), decimalPlaces(max), decimalPlaces(step));
  const minScaled = scaledDecimal(min, scaleDigits);
  const maxScaled = scaledDecimal(max, scaleDigits);
  const stepScaled = scaledDecimal(step, scaleDigits);
  if (minScaled === null || maxScaled === null || stepScaled === null || stepScaled <= 0n) return [];
  const out = [];
  for (let value = minScaled; value <= maxScaled; value += stepScaled) {
    out.push(scaledDecimalToString(value, scaleDigits));
    if (out.length > 100000) throw new Error('技倍率範囲が広すぎます');
  }
  return out;
}

function averageDistributions(distributions) {
  const out = new Map();
  if (!distributions.length) return out;
  const weight = 1 / distributions.length;
  for (const dist of distributions) {
    for (const [value, probability] of dist) out.set(value, (out.get(value) ?? 0) + probability * weight);
  }
  return out;
}

export function attackDamageDistribution(config) {
  const damageFormula = config.damageFormula ?? '';
  if (damageFormula === 'windmill') {
    parseNumber(config.attack, '攻撃力', { min: 0 });
    parseNumber(config.speed ?? 0, '素早さ', { min: 0 });
  } else {
    parseNumber(config.skillMultiplier, '技倍率', { min: 0 });
  }
  const fixedMultiplier = String(config.skillMultiplier ?? '100');
  const hasMultiplierRange = config.skillMultiplierMin !== '' && config.skillMultiplierMin != null
    && config.skillMultiplierMax !== '' && config.skillMultiplierMax != null;
  let multipliers = [fixedMultiplier];
  if (hasMultiplierRange) {
    const min = parseNumber(config.skillMultiplierMin, '技倍率下限', { min: 0 });
    parseNumber(config.skillMultiplierMax, '技倍率上限', { min });
    parseNumber(config.skillMultiplierStep || '0.1', '技倍率刻み', { min: 0.000001 });
    multipliers = decimalRange(config.skillMultiplierMin, config.skillMultiplierMax, config.skillMultiplierStep || '0.1');
  }
  const one = averageDistributions(multipliers.map(skillMultiplier => oneHitDistribution({ ...config, skillMultiplier, damageFormula })));

  const dynamicWindmillHits = damageFormula === 'windmill'
    ? Math.max(1, Math.min(10, Math.floor(parseNumber(config.speed ?? 0, '素早さ', { min: 0 }) / 20)))
    : null;
  const fixedHits = dynamicWindmillHits ?? parseIntValue(config.hits, 'ヒット数', { min: 1, max: 50 });
  const hasHitRange = damageFormula !== 'windmill' && config.hitsMin !== '' && config.hitsMin != null && config.hitsMax !== '' && config.hitsMax != null;
  let hitCounts = [fixedHits];
  if (hasHitRange) {
    const minHits = parseIntValue(config.hitsMin, '最小ヒット数', { min: 1, max: 50 });
    const maxHits = parseIntValue(config.hitsMax, '最大ヒット数', { min: 1, max: 50 });
    if (maxHits < minHits) throw new Error('ヒット数範囲が不正です');
    hitCounts = Array.from({ length: maxHits - minHits + 1 }, (_, i) => minHits + i);
  }

  const totals = [];
  for (const hits of hitCounts) {
    let total = new Map([[0, 1]]);
    for (let i = 0; i < hits; i++) total = convolveDamage(total, one);
    totals.push(total);
  }
  return averageDistributions(totals);
}

function multiHpParts(hp) {
  if (typeof hp !== 'string' || !hp.includes(',')) return null;
  const parts = hp.split(',').map(Number);
  return parts.length > 1 && parts.every(Number.isFinite) ? parts : null;
}

function multiHpKey(parts) {
  return parts.map(value => Math.max(0, trunc0(value))).join(',');
}

function enemyHpDefeated(hp) {
  const parts = multiHpParts(hp);
  return parts ? parts.every(value => value <= 0) : Number(hp) <= 0;
}

function enemyHpTotal(hp) {
  const parts = multiHpParts(hp);
  return parts ? parts.reduce((sum, value) => sum + Math.max(0, value), 0) : Math.max(0, Number(hp) || 0);
}

function enemyExGauge(runtime) {
  return Math.max(0, Math.min(10, Math.trunc(Number(runtime?.enemy?.exGauge ?? 0) || 0)));
}

function addEnemyEx(runtime, amount) {
  const delta = Math.max(0, Math.trunc(Number(amount) || 0));
  if (!delta) return enemyExGauge(runtime);
  runtime.enemy.exGauge = Math.min(10, enemyExGauge(runtime) + delta);
  return runtime.enemy.exGauge;
}

function spendEnemyEx(runtime, amount) {
  const delta = Math.max(0, Math.trunc(Number(amount) || 0));
  if (!delta) return enemyExGauge(runtime);
  runtime.enemy.exGauge = Math.max(0, enemyExGauge(runtime) - delta);
  return runtime.enemy.exGauge;
}

function playerExGauge(runtime) {
  return Math.max(0, Math.min(10, Math.trunc(Number(runtime?.playerExGauge ?? 0) || 0)));
}

function addPlayerEx(runtime, amount) {
  const delta = Math.max(0, Math.trunc(Number(amount) || 0));
  if (!delta) return playerExGauge(runtime);
  runtime.playerExGauge = Math.min(10, playerExGauge(runtime) + delta);
  return runtime.playerExGauge;
}

function playerExGainFromCommandName(commandName) {
  const normalized = String(commandName ?? '').trim().replace(/＋/g, '+');
  const m = /^EXゲージ\+(\d+)$/.exec(normalized);
  return m ? Math.max(0, Number(m[1]) || 0) : 0;
}

export function stealExAmount(playerGauge) {
  const gauge = Math.max(0, Math.min(10, Math.trunc(Number(playerGauge) || 0)));
  if (gauge <= 0) return 0;
  if (gauge <= 3) return 1;
  if (gauge <= 6) return 2;
  if (gauge <= 9) return 3;
  return 4;
}

export function stealExTransfer(playerGauge, enemyGauge) {
  const player = Math.max(0, Math.min(10, Math.trunc(Number(playerGauge) || 0)));
  const enemy = Math.max(0, Math.min(10, Math.trunc(Number(enemyGauge) || 0)));
  const stolen = Math.min(player, stealExAmount(player));
  return {
    stolen,
    playerGauge: Math.max(0, player - stolen),
    enemyGauge: Math.min(10, enemy + stolen)
  };
}

export function playerExGainFromEnemyAttack(hitCount, targetMode = 'random', activeTargetCount = 1) {
  const hits = Math.max(0, Math.trunc(Number(hitCount) || 0));
  const targets = Math.max(0, Math.trunc(Number(activeTargetCount) || 0));
  if (!hits || !targets) return 0;
  return targetMode === 'all' ? hits * targets : hits;
}

function applyEnemyStealEx(runtime) {
  const transfer = stealExTransfer(playerExGauge(runtime), enemyExGauge(runtime));
  runtime.playerExGauge = transfer.playerGauge;
  runtime.enemy.exGauge = transfer.enemyGauge;
  return transfer.stolen;
}

function enemyExGainFromCommandName(commandName) {
  const normalized = String(commandName ?? '').trim().replace(/＋/g, '+');
  const m = /^EXゲージ\+(\d+)$/.exec(normalized);
  return m ? Math.max(0, Number(m[1]) || 0) : 0;
}

function bossHpSlotCount(runtime) {
  return Math.max(1, Number(runtime?.enemy?.multiBossCount ?? 1) || 1);
}

function enemyHpPartArray(hp) {
  return multiHpParts(hp) ?? [Math.max(0, Number(hp) || 0)];
}

function bossHpDefeated(runtime, hp) {
  const parts = enemyHpPartArray(hp);
  return parts.slice(0, bossHpSlotCount(runtime)).every(value => value <= 0);
}

function companionHpAlive(runtime, hp, companionIndex) {
  const companion = runtime?.companions?.[companionIndex];
  if (!companion || companion.active === false) return false;
  const slot = Number(companion.hpSlot);
  if (!Number.isInteger(slot) || slot < 0) return true;
  const parts = enemyHpPartArray(hp);
  return Number(parts[slot] ?? 0) > 0;
}

function companionAliveMask(runtime, hp) {
  const parts = enemyHpPartArray(hp);
  return (runtime?.companions ?? []).map(companion => {
    if (!companion || companion.active === false) return '0';
    const slot = Number(companion.hpSlot);
    if (!Number.isInteger(slot) || slot < 0) return '1';
    return Number(parts[slot] ?? 0) > 0 ? '1' : '0';
  }).join('');
}

function markEnemyCompanionDefeated(runtime, companion) {
  if (!runtime?.enemy || !companion || companion.active === false) return;
  runtime.enemy.deathSerial = Math.max(0, Math.trunc(Number(runtime.enemy.deathSerial ?? 0) || 0)) + 1;
  companion.deathSeq = runtime.enemy.deathSerial;
  companion.revivable = true;
  companion.active = false;
}

function syncCompanionActivityFromHp(runtime, hp) {
  const parts = enemyHpPartArray(hp);
  for (const companion of runtime?.companions ?? []) {
    const slot = Number(companion?.hpSlot);
    if (!Number.isInteger(slot) || slot < 0) continue;
    const alive = Number(parts[slot] ?? 0) > 0;
    if (!alive && companion.active !== false) markEnemyCompanionDefeated(runtime, companion);
    else if (alive) companion.active = true;
  }
}

function branchRuntimeByCompanionAliveMask(runtime, hpDist) {
  const grouped = new Map();
  for (const [hp, probability] of hpDist) {
    const mask = companionAliveMask(runtime, hp);
    const bucket = grouped.get(mask) ?? { sampleHp:hp, dist:new Map() };
    bucket.dist.set(hp, (bucket.dist.get(hp) ?? 0) + probability);
    grouped.set(mask, bucket);
  }
  return [...grouped.values()].map(({ sampleHp, dist }) => {
    const rt = cloneRuntimeState(runtime);
    syncCompanionActivityFromHp(rt, sampleHp);
    return { runtime:rt, hpDist:dist };
  });
}

function companionReflectsAllyAttack(companion, action) {
  if (!companion || companion.active === false) return false;
  if (String(action?.attackType ?? '') !== 'magic') return false;
  return Boolean(companion.magicReflect);
}

function companionOneHitGuardBlocksAllyAttack(companion, action) {
  if (!companion || companion.active === false || !companion.oneHitGuard) return false;
  const attackTypes = Array.isArray(companion.oneHitGuard.attackTypes) ? companion.oneHitGuard.attackTypes : ['physical'];
  return attackTypes.includes(String(action?.attackType ?? 'physical'));
}

function companionPhysicalEvasionChance(companion) {
  if (!companion || companion.active === false) return 0;
  let chance = 0;
  for (const mod of companion.physicalEvasionMods ?? []) {
    chance = Math.max(chance, Number(mod?.chance ?? 0) || 0);
  }
  return Math.max(0, Math.min(100, chance));
}

function companionNegatesAllyAttack(companion, action) {
  return Boolean(companion?.evadedCurrentAllyAttack)
    || companionReflectsAllyAttack(companion, action)
    || companionOneHitGuardBlocksAllyAttack(companion, action);
}

function branchCompanionPhysicalEvasion(runtime, hpDist, action) {
  if (String(action?.attackType ?? '') !== 'physical') return [{ runtime, hpDist }];

  const grouped = new Map();
  for (const [hp, probability] of hpDist) {
    const candidates = [];
    for (const slot of allyTargetedEnemySlots(runtime, hp, action)) {
      const companionIndex = companionIndexForHpSlot(runtime, slot);
      if (companionIndex < 0) continue;
      const chance = companionPhysicalEvasionChance(runtime.companions?.[companionIndex]) / 100;
      if (chance > 0) candidates.push({ companionIndex, chance });
    }

    let local = [{ evaded:[], probability }];
    for (const { companionIndex, chance } of candidates) {
      const next = [];
      for (const branch of local) {
        if (chance < 1) next.push({ evaded:branch.evaded.slice(), probability:branch.probability * (1 - chance) });
        if (chance > 0) next.push({ evaded:[...branch.evaded, companionIndex], probability:branch.probability * chance });
      }
      local = next;
    }

    for (const branch of local) {
      if (!(branch.probability > 0)) continue;
      const key = branch.evaded.slice().sort((a,b) => a-b).join(',');
      const bucket = grouped.get(key) ?? { evaded:branch.evaded.slice(), dist:new Map() };
      bucket.dist.set(hp, (bucket.dist.get(hp) ?? 0) + branch.probability);
      grouped.set(key, bucket);
    }
  }

  return [...grouped.values()].map(({ evaded, dist }) => {
    const rt = cloneRuntimeState(runtime);
    for (const companionIndex of evaded) {
      const companion = rt.companions?.[companionIndex];
      if (companion && companion.active !== false) companion.evadedCurrentAllyAttack = true;
    }
    return { runtime:rt, hpDist:dist };
  });
}

function clearCompanionAttackEvasionFlags(runtime) {
  for (const companion of runtime?.companions ?? []) delete companion.evadedCurrentAllyAttack;
}

function allyTargetedEnemySlots(runtime, hp, action = {}) {
  const parts = enemyHpPartArray(hp);
  const targetMode = action?.enemyTarget ?? 'single';
  const companionOffFieldSlots = new Set((runtime.companions ?? [])
    .filter(companion => companion?.active !== false && companionIsOffField(companion) && Number.isInteger(companion?.hpSlot))
    .map(companion => Number(companion.hpSlot)));
  if (targetMode === 'all') {
    return parts.map((value, slot) => value > 0 && !companionOffFieldSlots.has(slot) ? slot : -1).filter(slot => slot >= 0);
  }

  // 透明化などでBOSS本体が単体選択不可、または〖ゆうらん〗でお供が一時離脱中なら対象候補から外す。
  const bossUntargetable = Boolean(runtime?.enemy?.singleTargetUntargetable);
  const eligible = parts.map((value, slot) => value > 0
      && !(slot < bossHpSlotCount(runtime) && bossUntargetable)
      && !companionOffFieldSlots.has(slot) ? slot : -1)
    .filter(slot => slot >= 0);
  const preferredRaw = action?.enemyTargetSlot ?? 'auto';
  const preferred = preferredRaw === 'auto' || preferredRaw === '' || preferredRaw == null ? -1 : Math.trunc(Number(preferredRaw));
  const slot = Number.isInteger(preferred) && eligible.includes(preferred) ? preferred : (eligible[0] ?? -1);
  return slot >= 0 ? [slot] : [];
}

function enemyHitSlotsByAllyAttack(runtime, hp, action = {}) {
  const hit = [];
  for (const slot of allyTargetedEnemySlots(runtime, hp, action)) {
    const companionIndex = companionIndexForHpSlot(runtime, slot);
    if (companionIndex >= 0 && companionNegatesAllyAttack(runtime.companions?.[companionIndex], action)) continue;
    hit.push(slot);
  }
  return hit;
}

function enemyUnitsHitByAllyAttack(runtime, hp, action = {}) {
  return enemyHitSlotsByAllyAttack(runtime, hp, action).length;
}

function consumeCompanionOneHitGuards(runtime, hp, action = {}) {
  for (const slot of allyTargetedEnemySlots(runtime, hp, action)) {
    const companionIndex = companionIndexForHpSlot(runtime, slot);
    if (companionIndex < 0) continue;
    const companion = runtime.companions?.[companionIndex];
    // 回避に成功した攻撃では、別枠の1回無効バリアを消費しない。
    if (companion?.evadedCurrentAllyAttack) continue;
    if (companionOneHitGuardBlocksAllyAttack(companion, action)) delete companion.oneHitGuard;
  }
}

function enemyDeathsBetweenHp(beforeHp, afterHp) {
  const before = multiHpParts(beforeHp);
  const after = multiHpParts(afterHp);
  if (before && after && before.length === after.length) {
    let deaths = 0;
    for (let i = 0; i < before.length; i++) if (before[i] > 0 && after[i] <= 0) deaths += 1;
    return deaths;
  }
  return !enemyHpDefeated(beforeHp) && enemyHpDefeated(afterHp) ? 1 : 0;
}

function companionIndexForHpSlot(runtime, slot) {
  return (runtime?.companions ?? []).findIndex(companion => Number(companion?.hpSlot) === Number(slot));
}

function adjustedAllyDamageForEnemySlot(runtime, slot, damage, action) {
  const companionIndex = companionIndexForHpSlot(runtime, slot);
  if (companionIndex < 0) return Math.max(0, trunc0(damage));
  const companion = runtime.companions?.[companionIndex];
  // 魔法反射中は魔法攻撃を無効化する。反射ダメージは味方HPを追跡しない現行モデルでは省略。
  if (companionNegatesAllyAttack(companion, action)) return 0;
  const mods = applicableDefenseMods(
    companion?.defenseMods ?? [],
    action?.attackType ?? 'physical',
    attackAttributesFromConfig(action ?? {})
  );
  return Math.max(0, applyMods(trunc0(damage), mods, { clampMin:0 }));
}

function nextHpAfterAllyDamage(runtime, hp, damage, action) {
  const targetMode = action?.enemyTarget ?? 'single';
  const targetSlot = action?.enemyTargetSlot ?? 'auto';
  const parts = multiHpParts(hp);
  if (!parts) return Math.max(0, hp - damage);
  if (targetMode === 'all') {
    return multiHpKey(parts.map((value, slot) => {
      if (value <= 0) return 0;
      const adjusted = adjustedAllyDamageForEnemySlot(runtime, slot, damage, action);
      return Math.max(0, value - adjusted);
    }));
  }
  const next = parts.slice();
  const index = allyTargetedEnemySlots(runtime, hp, action)[0] ?? -1;
  if (index >= 0) {
    const adjusted = adjustedAllyDamageForEnemySlot(runtime, index, damage, action);
    next[index] = Math.max(0, next[index] - adjusted);
  }
  return multiHpKey(next);
}

function wakeCompanionsHitByPhysicalAllyAttack(runtime, hp, action) {
  if (action?.attackType !== 'physical') return;
  for (const slot of allyTargetedEnemySlots(runtime, hp, action)) {
    const companionIndex = companionIndexForHpSlot(runtime, slot);
    if (companionIndex < 0) continue;
    const companion = runtime.companions?.[companionIndex];
    if (!companion || companion.active === false || companion.evadedCurrentAllyAttack) continue;
    if (companion.statuses?.sleep) delete companion.statuses.sleep;
  }
}

function allyAttackHitCountChoices(action, speed) {
  if (action.damageFormula === 'windmill') {
    return [{ hits:Math.max(1, Math.min(10, Math.floor(Number(speed || 0) / 20))), probability:1 }];
  }
  const hasRange = action.hitsMin !== '' && action.hitsMin != null && action.hitsMax !== '' && action.hitsMax != null;
  if (!hasRange) return [{ hits:parseIntValue(action.hits, 'ヒット数', { min:1, max:50 }), probability:1 }];
  const minHits = parseIntValue(action.hitsMin, '最小ヒット数', { min:1, max:50 });
  const maxHits = parseIntValue(action.hitsMax, '最大ヒット数', { min:1, max:50 });
  if (maxHits < minHits) throw new Error('ヒット数範囲が不正です');
  const probability = 1 / (maxHits - minHits + 1);
  return Array.from({ length:maxHits - minHits + 1 }, (_, i) => ({ hits:minHits + i, probability }));
}

function applyEnemyDefenseOnHitEx(runtime, action, hitSlots, hits) {
  const bossSlots = bossHpSlotCount(runtime);
  if (!(hitSlots ?? []).some(slot => Number(slot) >= 0 && Number(slot) < bossSlots)) return;
  const attrs = attackAttributesFromConfig(action ?? {});
  const activeMods = applicableDefenseMods(runtime.enemy?.defenseMods ?? [], String(action?.attackType ?? 'physical'), attrs);
  const perHitEnemyGain = activeMods.reduce((sum, mod) => sum + Math.max(0, Number(mod?.onHitEnemyExGain ?? 0) || 0), 0);
  const perHitPlayerLoss = activeMods.reduce((sum, mod) => sum + Math.max(0, Number(mod?.onHitPlayerExLoss ?? 0) || 0), 0);
  const hitCount = Math.max(1, Math.trunc(Number(hits ?? 1) || 1));
  if (perHitEnemyGain > 0) addEnemyEx(runtime, perHitEnemyGain * hitCount);
  if (perHitPlayerLoss > 0) runtime.playerExGauge = Math.max(0, playerExGauge(runtime) - perHitPlayerLoss * hitCount);
}

function applyAllyAttackWithEnemyEx(runtime, hpDist, damageDist, action, hits) {
  const targetMode = action?.enemyTarget ?? 'single';
  const targetSlot = action?.enemyTargetSlot ?? 'auto';
  const grouped = new Map();
  for (const [hp, hpProb] of hpDist) {
    if (enemyHpDefeated(hp)) {
      const key = multiHpParts(hp) ? multiHpKey(multiHpParts(hp).map(() => 0)) : 0;
      const mask = companionAliveMask(runtime, key);
      const groupKey = `0|${mask}`;
      const bucket = grouped.get(groupKey) ?? { gain:0, sampleHp:key, dist:new Map() };
      bucket.dist.set(key, (bucket.dist.get(key) ?? 0) + hpProb);
      grouped.set(groupKey, bucket);
      continue;
    }
    const hitSlots = enemyHitSlotsByAllyAttack(runtime, hp, action);
    const hitUnits = hitSlots.length;
    for (const [damage, damageProb] of damageDist) {
      const nextHp = nextHpAfterAllyDamage(runtime, hp, damage, action);
      // 被弾は1ヒットにつき+1。敵側の味方が倒れた場合はさらに1体につき+1。
      const exGain = Math.max(0, hits * hitUnits + enemyDeathsBetweenHp(hp, nextHp));
      const mask = companionAliveMask(runtime, nextHp);
      const groupKey = `${exGain}|${mask}|${hitSlots.join(',')}`;
      const bucket = grouped.get(groupKey) ?? { gain:exGain, sampleHp:nextHp, hitSlots:hitSlots.slice(), dist:new Map() };
      bucket.dist.set(nextHp, (bucket.dist.get(nextHp) ?? 0) + hpProb * damageProb);
      grouped.set(groupKey, bucket);
    }
  }
  return [...grouped.values()].map(({ gain, sampleHp, hitSlots = [], dist }) => {
    const rt = cloneRuntimeState(runtime);
    rt.lastAllyAttackHitSlots = hitSlots.slice();
    addEnemyEx(rt, gain);
    applyEnemyDefenseOnHitEx(rt, action, hitSlots, hits);
    // 〖ふたをする〗等の1回無効は、ダメージを受けなくても対象になった物理技1回で消費する。
    consumeCompanionOneHitGuards(rt, sampleHp, action);
    syncCompanionActivityFromHp(rt, sampleHp);
    wakeCompanionsHitByPhysicalAllyAttack(rt, sampleHp, action);
    return { runtime:rt, hpDist:dist };
  });
}

function mapHpDistribution(hpDist, mapper) {
  const out = new Map();
  for (const [hp, probability] of hpDist) {
    if (enemyHpDefeated(hp)) {
      const key = multiHpParts(hp) ? multiHpKey(multiHpParts(hp).map(() => 0)) : 0;
      out.set(key, (out.get(key) ?? 0) + probability);
      continue;
    }
    const parts = multiHpParts(hp);
    const nextHp = parts
      ? multiHpKey(parts.map(value => value <= 0 ? 0 : Math.max(0, trunc0(mapper(value)))))
      : Math.max(0, trunc0(mapper(hp)));
    out.set(nextHp, (out.get(nextHp) ?? 0) + probability);
  }
  return out;
}

function applyAttackToHp(hpDist, damageDist, targetMode = 'single') {
  const out = new Map();
  for (const [hp, hpProb] of hpDist) {
    if (enemyHpDefeated(hp)) {
      const key = multiHpParts(hp) ? multiHpKey(multiHpParts(hp).map(() => 0)) : 0;
      out.set(key, (out.get(key) ?? 0) + hpProb);
      continue;
    }
    for (const [damage, damageProb] of damageDist) {
      const parts = multiHpParts(hp);
      let nextHp;
      if (!parts) {
        nextHp = Math.max(0, hp - damage);
      } else if (targetMode === 'all') {
        nextHp = multiHpKey(parts.map(value => value <= 0 ? 0 : Math.max(0, value - damage)));
      } else {
        // 単体選択攻撃はプレイヤーが生存中の敵を選べるため、先頭の生存個体へ集中攻撃する。
        // 同一個体3体のマシュまろでは個体差がないので、この正規化で確率結果は変わらない。
        const next = parts.slice();
        const index = next.findIndex(value => value > 0);
        if (index >= 0) next[index] = Math.max(0, next[index] - damage);
        nextHp = multiHpKey(next);
      }
      out.set(nextHp, (out.get(nextHp) ?? 0) + hpProb * damageProb);
    }
  }
  return out;
}

function killChance(hpDist) {
  let value = 0;
  for (const [hp, probability] of hpDist) if (enemyHpDefeated(hp)) value += probability;
  return Math.max(0, Math.min(1, value));
}

function hpRange(hpDist) {
  const live = [...hpDist.keys()].filter(hp => !enemyHpDefeated(hp)).map(enemyHpTotal);
  if (!live.length) return { min: 0, max: 0 };
  return { min: Math.min(...live), max: Math.max(...live) };
}

function normalizeTarget(effect, actorIndex, runtime) {
  const target = effect.target ?? 'self';
  const allyCount = runtime.allyCount;
  const targetable = i => runtime.allies[i]?.active !== false && Number(runtime.allies[i]?.actionLockRemaining ?? 0) <= 0;
  if (Array.isArray(target)) {
    return [...new Set(target.flatMap(item => normalizeTarget({ target: item }, actorIndex, runtime)))];
  }
  if (target === 'all') return Array.from({ length: allyCount }, (_, i) => i).filter(targetable);
  if (target === 'self') return targetable(actorIndex) ? [actorIndex] : [];
  if (target === 'others') return Array.from({ length: allyCount }, (_, i) => i).filter(i => i !== actorIndex && targetable(i));
  if (target === 'star4') return runtime.allies.map((ally, i) => targetable(i) && Number(ally.star) === 4 ? i : -1).filter(i => i >= 0);
  if (target === 'fireAllies') return runtime.allies.map((ally, i) => targetable(i) && ally.attribute === 'fire' ? i : -1).filter(i => i >= 0);
  const m = /^ally(\d)$/.exec(target);
  if (m) {
    const i = Number(m[1]) - 1;
    return i >= 0 && i < allyCount && targetable(i) ? [i] : [];
  }
  return [];
}

function effectDirection(type) {
  // +1: 数値が上がる（攻撃/速度アップ、敵の防御ダウン=被ダメ増）
  // -1: 数値が下がる（デバフ、敵の防御アップ=被ダメ減）
  return ['allyAtkDebuff', 'allySpeedDebuff', 'speedDown', 'enemyDefenseBuff', 'enemyCounterGuard'].includes(type) ? -1 : 1;
}

function effectAmountToMod(effect, defaultMode = 'mult') {
  const amount = parseNumber(effect.value ?? '0', '効果量', { min: 0 });
  const mode = effect.mode ?? defaultMode;
  const direction = effectDirection(effect.type);
  if (mode === 'add') return { mode, value: direction * amount };

  // 攻撃力アップはダメージ計算ツールと同じ表記:
  // 150% = ×1.5、200% = ×2.0。
  // 攻撃デバフや防御・素早さ補正は従来どおり「効果量」入力。
  if (effect.type === 'atkBuff' || effect.type === 'enemyAtkBuff') {
    return { mode: 'mult', value: amount };
  }
  return { mode: 'mult', value: 100 + direction * amount };
}

function addTimedMod(list, effect, seq, defaultMode = 'mult', sourceContext = null) {
  const mod = effectAmountToMod(effect, defaultMode);
  const common = { ...mod, seq };
  if (effect.expiry && sourceContext) {
    const offset = effect.expiry === 'sourceNextActionEnd' ? 2 : 1;
    list.push({
      ...common,
      expiry: effect.expiry,
      sourceActorIndex: sourceContext.actorIndex,
      expiresAtActionCount: sourceContext.actionsTaken + offset
    });
    return;
  }
  const duration = Math.max(1, parseIntValue(effect.duration ?? '1', '継続ターン', { min: 1, max: 99 }));
  // 付与されたそのターンの終了時には残りターンを減らさない。
  // これにより「1ターン」の自己バフも次の行動ターンまで正しく残る。
  list.push({ ...common, remaining: duration, justApplied: true });
}

function addEnemyDefenseMod(list, effect, seq, sourceKey = '') {
  // 冥界の城のように「重ね掛けはするが、再使用すると既存スタック全体の残り時間を更新」する効果。
  const refreshGroup = effect.stackRefreshGroup ? String(effect.stackRefreshGroup) : '';
  if (refreshGroup) {
    const duration = Math.max(1, parseIntValue(effect.duration ?? '1', '継続ターン', { min: 1, max: 99 }));
    for (const existing of list) {
      if (existing.stackRefreshGroup !== refreshGroup) continue;
      existing.remaining = duration;
      existing.justApplied = true;
    }
    addTimedMod(list, effect, seq, 'mult');
    const added = list[list.length - 1];
    added.stackRefreshGroup = refreshGroup;
    if (Array.isArray(effect.attackTypes)) added.attackTypes = effect.attackTypes.slice();
    if (Array.isArray(effect.attributes)) added.attributes = effect.attributes.slice();
    if (effect.breakOnActionDisable === true) added.breakOnActionDisable = true;
    if (effect.onHitEnemyExGain != null) added.onHitEnemyExGain = Number(effect.onHitEnemyExGain) || 0;
    if (effect.onHitPlayerExLoss != null) added.onHitPlayerExLoss = Number(effect.onHitPlayerExLoss) || 0;
    return added;
  }

  const key = effect.nonStacking ? String(effect.stackKey ?? sourceKey ?? '') : '';
  if (key) {
    const existing = list.find(x => x.enemyEffectKey === key);
    if (existing) {
      const mod = effectAmountToMod(effect, 'mult');
      const duration = Math.max(1, parseIntValue(effect.duration ?? '1', '継続ターン', { min: 1, max: 99 }));
      existing.mode = mod.mode;
      existing.value = mod.value;
      existing.seq = seq;
      existing.remaining = duration;
      existing.justApplied = true;
      existing.enemyEffectKey = key;
      if (Array.isArray(effect.attackTypes)) existing.attackTypes = effect.attackTypes.slice();
      else delete existing.attackTypes;
      if (Array.isArray(effect.attributes)) existing.attributes = effect.attributes.slice();
      else delete existing.attributes;
      if (effect.breakOnActionDisable === true) existing.breakOnActionDisable = true;
      else delete existing.breakOnActionDisable;
      if (effect.onHitEnemyExGain != null) existing.onHitEnemyExGain = Number(effect.onHitEnemyExGain) || 0;
      else delete existing.onHitEnemyExGain;
      if (effect.onHitPlayerExLoss != null) existing.onHitPlayerExLoss = Number(effect.onHitPlayerExLoss) || 0;
      else delete existing.onHitPlayerExLoss;
      return existing;
    }
  }
  addTimedMod(list, effect, seq, 'mult');
  const added = list[list.length - 1];
  if (Array.isArray(effect.attackTypes)) added.attackTypes = effect.attackTypes.slice();
  if (Array.isArray(effect.attributes)) added.attributes = effect.attributes.slice();
  if (effect.breakOnActionDisable === true) added.breakOnActionDisable = true;
  if (effect.onHitEnemyExGain != null) added.onHitEnemyExGain = Number(effect.onHitEnemyExGain) || 0;
  if (effect.onHitPlayerExLoss != null) added.onHitPlayerExLoss = Number(effect.onHitPlayerExLoss) || 0;
  if (key) added.enemyEffectKey = key;
  return added;
}

function addEnemyTeamDefenseMod(runtime, effect, sourceKey = '') {
  const seq = ++runtime.seq;
  addEnemyDefenseMod(runtime.enemy.defenseMods, effect, seq, sourceKey);
  for (const companion of runtime.companions ?? []) {
    if (!companion || companion.active === false || companionIsOffField(companion)) continue;
    companion.defenseMods ??= [];
    addEnemyDefenseMod(companion.defenseMods, effect, seq, sourceKey);
  }
}

function addTimedFlag(list, effect, seq) {
  const duration = Math.max(1, parseIntValue(effect.duration ?? '1', '継続ターン', { min: 1, max: 99 }));
  list.push({ remaining: duration, seq, justApplied: true });
}

function applyProgressiveStatDecay(ally, stat, factor) {
  const f = Number(factor ?? 1);
  if (!(f > 0 && f <= 1)) return;
  if (stat === 'attack') ally.rotAttackMultiplier = compoundProgressiveMultiplier(ally.rotAttackMultiplier ?? 1, f);
  else if (stat === 'speed') ally.rotSpeedMultiplier = compoundProgressiveMultiplier(ally.rotSpeedMultiplier ?? 1, f);
  else return;
  // パワー／スピードを併用した場合、行動後に継続して下がるのは後から受けた側だけ。
  ally.activeProgressiveDecay = { stat, factor:f };
}

function advanceProgressiveDecayAfterAction(runtime, allyIndex) {
  const ally = runtime.allies?.[allyIndex];
  const active = ally?.activeProgressiveDecay;
  if (!active) return;
  const f = Number(active.factor ?? 1);
  if (active.stat === 'attack') ally.rotAttackMultiplier = compoundProgressiveMultiplier(ally.rotAttackMultiplier ?? 1, f);
  else if (active.stat === 'speed') ally.rotSpeedMultiplier = compoundProgressiveMultiplier(ally.rotSpeedMultiplier ?? 1, f);
}

function queueAllyReelShift(runtime, indexes, amount) {
  const delta = Number(amount ?? 0) || 0;
  if (!delta) return;
  runtime.pendingReelBoosts ??= [];
  for (const index of indexes) runtime.pendingReelBoosts.push({ index, amount:delta });
}

function queueAllyReelSet(runtime, index, reel) {
  const i = Number(index);
  const r = Number(reel);
  if (!Number.isInteger(i) || !Number.isInteger(r)) return;
  runtime.pendingReelSets ??= [];
  // 同じ行動中に同じ対象へ複数回指定された場合は最後の指定を採用する。
  runtime.pendingReelSets = runtime.pendingReelSets.filter(x => x.index !== i);
  runtime.pendingReelSets.push({ index:i, reel:r });
}

function decrementTimedEffects(runtime) {
  const dec = list => list
    .map(x => {
      if (!Number.isFinite(x.remaining)) return x;
      if (x.justApplied) return { ...x, justApplied: false };
      return { ...x, remaining: x.remaining - 1 };
    })
    .filter(x => !Number.isFinite(x.remaining) || x.remaining > 0);
  for (const ally of runtime.allies) {
    ally.attackMods = dec(ally.attackMods);
    ally.speedMods = dec(ally.speedMods);
    ally.weaknessMods = dec(ally.weaknessMods);
    ally.statusAvoidMods = dec(ally.statusAvoidMods ?? []);
    ally.statusImmuneMods = dec(ally.statusImmuneMods ?? []);
    ally.damageTakenMods = dec(ally.damageTakenMods ?? []);
    ally.statusVulnerabilityMods = dec(ally.statusVulnerabilityMods ?? []);
  }
  runtime.enemy.speedMods = dec(runtime.enemy.speedMods);
  // バルバドスの水は効果が切れれば累積回数もリセット。
  if (!(runtime.enemy.speedMods ?? []).some(x => x.enemyEffectKey === 'バルバドスの水:速度')) {
    runtime.enemy.barbadosWaterStack = 0;
  }
  runtime.enemy.attackMods = dec(runtime.enemy.attackMods);
  runtime.enemy.defenseMods = dec(runtime.enemy.defenseMods);
  runtime.enemy.blessingMods = dec(runtime.enemy.blessingMods ?? []);
  runtime.enemy.reactiveEffects = dec(runtime.enemy.reactiveEffects ?? []);
  runtime.enemy.statusAvoidMods = dec(runtime.enemy.statusAvoidMods ?? []);
  for (const companion of runtime.companions ?? []) {
    companion.speedMods = dec(companion.speedMods ?? []);
    companion.attackMods = dec(companion.attackMods ?? []);
    companion.defenseMods = dec(companion.defenseMods ?? []);
    companion.physicalEvasionMods = dec(companion.physicalEvasionMods ?? []);
  }
}


function advanceSummonCurses(runtime, hpDist) {
  let nextHp = hpDist;
  for (const companion of runtime.companions ?? []) {
    if (!companion || companion.active === false || Number(companion.summonCurseTurns ?? 0) <= 0) continue;
    if (companion.summonCurseJustApplied) {
      companion.summonCurseJustApplied = false;
      continue;
    }
    companion.summonCurseTurns = Math.max(0, Number(companion.summonCurseTurns) - 1);
    if (companion.summonCurseTurns > 0) continue;
    companion.active = false;
    companion.revivable = false;
    companion.deathSeq = null;
    const slot = Number(companion.hpSlot);
    if (Number.isInteger(slot) && slot >= 0) nextHp = setEnemyHpSlotDistribution(nextHp, slot, 0);
  }
  return nextHp;
}

const HARMFUL_STATUSES = Object.freeze(['paralysis','confusion','silence','darkness','sleep','petrification','cold','brainwash','curse']);

function cureStatuses(ally) {
  ally.statuses ??= {};
  for (const key of HARMFUL_STATUSES) delete ally.statuses[key];
}

function addStatusAvoid(list, effect, seq) {
  const duration = Math.max(1, parseIntValue(effect.duration ?? '1', '継続ターン', { min: 1, max: 99 }));
  const value = parseNumber(effect.value ?? '0', '状態異常耐性', { min: 0, max: 100 });
  list.push({ value, remaining: duration, seq, justApplied: true });
}

function addOrRefreshPointTimed(list, effect, seq, sourceKey = '') {
  const key = effect.nonStacking ? String(effect.stackKey ?? sourceKey ?? '') : '';
  const duration = Math.max(1, parseIntValue(effect.duration ?? '1', '継続ターン', { min: 1, max: 99 }));
  const value = parseNumber(effect.value ?? '0', '効果量', { min: 0, max: 100 });
  if (key) {
    const existing = list.find(x => x.enemyEffectKey === key);
    if (existing) {
      existing.value = value;
      existing.remaining = duration;
      existing.seq = seq;
      existing.justApplied = true;
      existing.enemyEffectKey = key;
      return existing;
    }
  }
  list.push({ value, remaining: duration, seq, justApplied:true, ...(key ? { enemyEffectKey:key } : {}) });
  return list[list.length - 1];
}

function addOrRefreshEnemyStatMod(list, effect, seq, sourceKey = '') {
  const key = effect.nonStacking ? String(effect.stackKey ?? sourceKey ?? '') : '';
  if (key) {
    const existing = list.find(x => x.enemyEffectKey === key);
    if (existing) {
      const temp = [];
      addTimedMod(temp, effect, seq, 'mult');
      Object.assign(existing, temp[0], { enemyEffectKey:key });
      return existing;
    }
  }
  addTimedMod(list, effect, seq, 'mult');
  const added = list[list.length - 1];
  if (key) added.enemyEffectKey = key;
  return added;
}

function addEnemyTeamAttackMod(runtime, effect, sourceKey = '') {
  const seq = ++runtime.seq;
  addOrRefreshEnemyStatMod(runtime.enemy.attackMods, effect, seq, sourceKey);
  for (const companion of runtime.companions ?? []) {
    if (!companion || companion.active === false || companionIsOffField(companion)) continue;
    companion.attackMods ??= [];
    addOrRefreshEnemyStatMod(companion.attackMods, effect, seq, sourceKey);
  }
}

function statusAvoidPoints(ally) {
  return (ally.statusAvoidMods ?? []).reduce((sum, x) => sum + Number(x.value || 0), 0);
}

function statusVulnerabilityPoints(ally) {
  return (ally.statusVulnerabilityMods ?? []).reduce((sum, x) => sum + Number(x.value || 0), 0);
}

function statusImmuneActive(ally) {
  return (ally.statusImmuneMods ?? []).length > 0;
}

function expireSourceLinkedMods(runtime, actorIndex, phase) {
  const actionsTaken = runtime.allies[actorIndex].actionsTaken;
  const expiry = phase === 'start' ? 'sourceNextActionStart' : 'sourceNextActionEnd';
  const keep = mod => !(mod.expiry === expiry && mod.sourceActorIndex === actorIndex && mod.expiresAtActionCount <= actionsTaken);
  runtime.enemy.defenseMods = runtime.enemy.defenseMods.filter(keep);
  runtime.enemy.speedMods = runtime.enemy.speedMods.filter(keep);
  runtime.enemy.attackMods = runtime.enemy.attackMods.filter(keep);
}

function allyEffect(runtime, effect, actorIndex) {
  runtime.seq += 1;
  const sourceContext = { actorIndex, actionsTaken: runtime.allies[actorIndex].actionsTaken };
  switch (effect.type) {
    case 'atkBuff': {
      for (const i of normalizeTarget(effect, actorIndex, runtime)) {
        addTimedMod(runtime.allies[i].attackMods, effect, runtime.seq, 'mult', sourceContext);
      }
      break;
    }
    case 'speedBuff': {
      for (const i of normalizeTarget(effect, actorIndex, runtime)) {
        addTimedMod(runtime.allies[i].speedMods, effect, runtime.seq, 'mult', sourceContext);
      }
      break;
    }
    case 'defenseDown':
      addTimedMod(runtime.enemy.defenseMods, effect, runtime.seq, 'mult', sourceContext);
      break;
    case 'speedDown':
      addTimedMod(runtime.enemy.speedMods, effect, runtime.seq, 'mult', sourceContext);
      break;
    case 'poison':
      if (runtime.enemy.poison === 'none') runtime.enemy.poison = 'poison';
      break;
    case 'deadlyPoison':
      runtime.enemy.poison = 'deadlyPoison';
      break;
    case 'poisonToDeadly':
      if (runtime.enemy.poison === 'poison') runtime.enemy.poison = 'deadlyPoison';
      break;
    case 'weaknessBuff':
      for (const i of normalizeTarget(effect, actorIndex, runtime)) addTimedFlag(runtime.allies[i].weaknessMods, effect, runtime.seq);
      break;
    case 'statusCure':
      for (const i of normalizeTarget(effect, actorIndex, runtime)) cureStatuses(runtime.allies[i]);
      break;
    case 'statusAvoid':
      for (const i of normalizeTarget(effect, actorIndex, runtime)) addStatusAvoid(runtime.allies[i].statusAvoidMods, effect, runtime.seq);
      break;
    case 'statusImmune':
      for (const i of normalizeTarget(effect, actorIndex, runtime)) addTimedFlag(runtime.allies[i].statusImmuneMods, effect, runtime.seq);
      break;
    default:
      break;
  }
}

function enemyEffect(runtime, effect, hpDist) {
  runtime.seq += 1;
  switch (effect.type) {
    case 'allyAtkDebuff': {
      const targets = normalizeTarget(effect, 0, runtime);
      for (const i of targets) addTimedMod(runtime.allies[i].attackMods, effect, runtime.seq);
      return hpDist;
    }
    case 'allySpeedDebuff': {
      const targets = normalizeTarget(effect, 0, runtime);
      for (const i of targets) addTimedMod(runtime.allies[i].speedMods, effect, runtime.seq);
      return hpDist;
    }
    case 'progressiveStatDecay': {
      const targets = normalizeTarget(effect, 0, runtime);
      for (const i of targets) applyProgressiveStatDecay(runtime.allies[i], effect.stat, effect.factor);
      return hpDist;
    }
    case 'allyReelShift': {
      const targets = normalizeTarget(effect, 0, runtime);
      queueAllyReelShift(runtime, targets, effect.amount);
      return hpDist;
    }
    case 'enemySpeedBuff':
      addOrRefreshEnemyStatMod(runtime.enemy.speedMods, effect, runtime.seq, 'manual:enemySpeedBuff');
      return hpDist;
    case 'enemyAtkBuff':
      addOrRefreshEnemyStatMod(runtime.enemy.attackMods, effect, runtime.seq, 'manual:enemyAtkBuff');
      return hpDist;
    case 'enemyStatusAvoid':
      runtime.enemy.statusAvoidMods ??= [];
      addOrRefreshPointTimed(runtime.enemy.statusAvoidMods, effect, runtime.seq, 'manual:enemyStatusAvoid');
      return hpDist;
    case 'bossSpeedGrow': {
      const value = Number(effect.value ?? 0) || 0;
      runtime.enemy.flatSpeedBonus = Number(runtime.enemy.flatSpeedBonus ?? 0) + value;
      if (value) runtime.enemy.postActionSpeedGain = value;
      return hpDist;
    }
    case 'companionSpeedGrow': {
      const value = Number(effect.value ?? 0) || 0;
      for (const companion of runtime.companions ?? []) {
        if (companion?.active === false) continue;
        companion.flatSpeedBonus = Number(companion.flatSpeedBonus ?? 0) + value;
        if (value) companion.postActionSpeedGain = value;
      }
      return hpDist;
    }
    case 'enemyDefenseBuff':
    case 'enemyDefenseDebuff':
    case 'enemyCounterGuard': {
      addEnemyDefenseMod(runtime.enemy.defenseMods, effect, runtime.seq, `manual:${effect.type}`);
      return hpDist;
    }
    case 'enemyBlessing': {
      const duration = Math.max(1, parseIntValue(effect.duration ?? '3', '継続ターン', { min:1, max:99 }));
      runtime.enemy.blessingMods ??= [];
      runtime.enemy.blessingMods.push({
        mode: effect.mode ?? 'attackPercent',
        value: parseNumber(effect.value ?? '30', '加護回復量', { min:0 }),
        remaining: duration, justApplied: false, seq: runtime.seq
      });
      return hpDist;
    }
    case 'heal': {
      const value = parseNumber(effect.value ?? '0', '回復量', { min: 0 });
      const mode = effect.mode ?? 'flat';
      const amount = mode === 'maxPercent' ? trunc0(runtime.maxHp * value / 100) : trunc0(value);
      return mapBossHpDistribution(runtime, hpDist, hp => Math.min(runtime.maxHp, hp + amount));
    }
    case 'enemyStatusCure':
      runtime.enemy.poison = 'none';
      return hpDist;
    default:
      return hpDist;
  }
}

function poisonTickValue(currentHp, poisonState, race = 'normal') {
  const rate = poisonState === 'deadlyPoison' ? 0.20 : poisonState === 'poison' ? 0.10 : 0;
  if (!(rate > 0) || !(currentHp > 0)) return currentHp;
  const amount = Math.floor(currentHp * rate);
  if (race === 'undead') return currentHp + Math.min(50, amount);
  return Math.max(0, currentHp - amount);
}

function applyPoison(runtime, hpDist) {
  const state = runtime.enemy.poison ?? 'none';
  if (state === 'none') return hpDist;
  return mapBossHpDistribution(runtime, hpDist, hp => Math.min(runtime.maxHp, poisonTickValue(hp, state, runtime.enemy.race)));
}

function applyCompanionPoison(runtime, hpDist, companionIndex) {
  const companion = runtime.companions?.[companionIndex];
  const state = companion?.poison ?? 'none';
  if (!companion || companion.active === false || state === 'none' || !Number.isInteger(companion.hpSlot)) return hpDist;
  const out = new Map();
  for (const [hp, probability] of hpDist) {
    const parts = enemyHpPartArray(hp);
    const slot = companion.hpSlot;
    while (parts.length <= slot) parts.push(0);
    if (parts[slot] > 0) {
      const next = poisonTickValue(parts[slot], state, companion.race);
      parts[slot] = Math.min(Math.max(1, Number(companion.maxHp ?? 1)), next);
    }
    const key = parts.length > 1 ? multiHpKey(parts) : parts[0];
    out.set(key, (out.get(key) ?? 0) + probability);
  }
  return out;
}

function actorOrder(runtime) {
  const actors = [];
  for (let i = 0; i < runtime.allyCount; i++) {
    if (runtime.allies[i]?.active === false) continue;
    actors.push({
      side: 'ally',
      index: i,
      speed: effectiveAllySpeed(runtime.allies[i])
    });
  }
  actors.push({
    side: 'enemy',
    index: -1,
    name: runtime.enemy.name ?? 'BOSS',
    speed: applyMods(runtime.enemy.baseSpeed + Number(runtime.enemy.flatSpeedBonus ?? 0), runtime.enemy.speedMods, { clampMin: 0 })
  });
  for (let i = 0; i < (runtime.companions ?? []).length; i++) {
    const companion = runtime.companions[i];
    if (companion?.active === false) continue;
    const companionProfile = enemyCompanionProfile(companion?.name ?? '');
    // 現行モデルで純粋ダメージ／かばうしか持たないお供は行動枝を作らない。
    if (companionProfile?.killProbabilityInert) continue;
    actors.push({
      side: 'companion',
      index: i,
      name: companion.name,
      speed: applyMods(companion.baseSpeed + Number(companion.flatSpeedBonus ?? 0), companion.speedMods ?? [], { clampMin: 0 })
    });
  }

  const sideRank = { ally:0, enemy:1, companion:2 };
  actors.sort((a, b) => {
    if (a.speed !== b.speed) return b.speed - a.speed;
    if (a.side !== b.side) return (sideRank[a.side] ?? 9) - (sideRank[b.side] ?? 9);
    return a.index - b.index;
  });
  return actors;
}

function recordTimeline(timeline, label, hpDist, turn, kind) {
  const range = hpRange(hpDist);
  timeline.push({
    label,
    turn,
    kind,
    killChance: killChance(hpDist),
    minLiveHp: range.min,
    maxLiveHp: range.max
  });
}

function ensureAction(action, side = 'ally') {
  const defaultBuff = side === 'enemy' ? defaultEnemyBuff() : defaultAllyBuff();
  return {
    kind: action?.kind ?? 'skip',
    skillPresetId: action?.skillPresetId ?? '',
    skillMultiplier: action?.skillMultiplier ?? '200',
    skillMultiplierMin: action?.skillMultiplierMin ?? '',
    skillMultiplierMax: action?.skillMultiplierMax ?? '',
    skillMultiplierStep: action?.skillMultiplierStep ?? '',
    attackAttribute: action?.attackAttribute ?? 'none',
    attackAttribute2: action?.attackAttribute2 ?? 'none',
    attackType: action?.attackType ?? 'physical',
    hits: action?.hits ?? '1',
    hitsMin: action?.hitsMin ?? '',
    hitsMax: action?.hitsMax ?? '',
    undeadSkillMultiplier: action?.undeadSkillMultiplier ?? '',
    poisonedSkillMultiplier: action?.poisonedSkillMultiplier ?? '',
    deadlyPoisonSkillMultiplier: action?.deadlyPoisonSkillMultiplier ?? '',
    weakDefenderAttribute: action?.weakDefenderAttribute ?? '',
    weakSkillMultiplier: action?.weakSkillMultiplier ?? '',
    raceSkillMultipliers: action?.raceSkillMultipliers ?? {},
    damageFormula: action?.damageFormula ?? '',
    selfDestruct: action?.selfDestruct === true,
    enemyTarget: action?.enemyTarget ?? 'single',
    enemyTargetSlot: action?.enemyTargetSlot ?? 'auto',
    buff: { ...defaultBuff, ...(action?.buff ?? {}) },
    effects: Array.isArray(action?.effects) ? action.effects : [],
    skillName: action?.skillName ?? '',
    presetTarget: action?.presetTarget ?? ''
  };
}

function resolveAction(turns, turnIndex, side, actorIndex = -1) {
  let index = turnIndex;
  let repeated = false;
  while (index >= 0) {
    const raw = side === 'enemy'
      ? turns[index]?.enemyAction
      : turns[index]?.allyActions?.[actorIndex];
    const action = ensureAction(raw, side);
    if (action.kind !== 'same') return { action, repeated };
    repeated = true;
    index -= 1;
  }
  return { action: ensureAction({ kind: 'skip' }, side), repeated: true };
}

function simulateKillProbabilityLegacy(state) {
  const maxHp = parseIntValue(state.enemy?.maxHp, '敵HP', { min: 1, max: 9999999 });
  const enemyBaseSpeed = parseNumber(state.enemy?.speed, '敵の素早さ', { min: 0 });
  const allyCount = parseIntValue(state.allyCount, '味方人数', { min: 1, max: 3 });
  const turns = Array.isArray(state.turns) && state.turns.length ? state.turns : [];
  if (!turns.length) throw new Error('ターンを1つ以上設定してください');

  const runtime = {
    maxHp,
    allyCount,
    seq: 0,
    allies: Array.from({ length: allyCount }, (_, i) => ({
      baseAttack: parseNumber(state.allies?.[i]?.attack, `キャラ${i + 1}の攻撃力`, { min: 0 }),
      baseSpeed: parseNumber(state.allies?.[i]?.speed, `キャラ${i + 1}の素早さ`, { min: 0 }),
      star: state.allies?.[i]?.star ?? '',
      attribute: state.allies?.[i]?.attribute ?? '',
      attackMods: [],
      speedMods: [],
      weaknessMods: [],
      actionsTaken: 0,
      active: true,
      swordDanceAutoRemaining: 0,
      swordDanceStage: 0
    })),
    enemy: {
      baseSpeed: enemyBaseSpeed,
      speedMods: [],
      attackMods: [],
      defenseMods: [],
      poison: 'none',
      race: normalizeEnemyRace(state.enemy?.race)
    }
  };

  let hpDist = new Map([[maxHp, 1]]);
  const timeline = [];

  for (let turnIndex = 0; turnIndex < turns.length; turnIndex++) {
    const turn = turns[turnIndex] ?? {};
    const order = actorOrder(runtime);
    const isFinalTurn = turnIndex === turns.length - 1;
    const lastAllyPosition = Math.max(...order.map((actor, pos) => actor.side === 'ally' ? pos : -1));

    for (let pos = 0; pos < order.length; pos++) {
      const actor = order[pos];

      if (actor.side === 'ally') {
        expireSourceLinkedMods(runtime, actor.index, 'start');
        const resolved = resolveAction(turns, turnIndex, 'ally', actor.index);
        const action = resolved.action;
        const samePrefix = resolved.repeated ? '同行動→' : '';
        if (action.kind === 'attack') {
          const attack = applyMods(
            runtime.allies[actor.index].baseAttack,
            runtime.allies[actor.index].attackMods,
            { clampMin: 1, clampMax: 999 }
          );
          let skillMultiplier = action.skillMultiplier;
          if (action.weakDefenderAttribute && action.weakSkillMultiplier !== ''
              && state.enemy?.attribute === action.weakDefenderAttribute) {
            skillMultiplier = action.weakSkillMultiplier;
          }
          skillMultiplier = raceSkillMultiplier(action, runtime.enemy.race, skillMultiplier);
          if (runtime.enemy.poison !== 'none' && action.poisonedSkillMultiplier !== '') skillMultiplier = action.poisonedSkillMultiplier;
          if (runtime.enemy.poison === 'deadlyPoison' && action.deadlyPoisonSkillMultiplier !== '') skillMultiplier = action.deadlyPoisonSkillMultiplier;
          const speed = applyMods(
            runtime.allies[actor.index].baseSpeed,
            runtime.allies[actor.index].speedMods,
            { clampMin: 0, clampMax: 999 }
          );
          const damageDist = attackDamageDistribution({
            attack,
            speed,
            skillMultiplier,
            damageFormula: action.damageFormula,
            skillMultiplierMin: action.skillMultiplierMin,
            skillMultiplierMax: action.skillMultiplierMax,
            skillMultiplierStep: action.skillMultiplierStep,
            attackAttribute: action.attackAttribute,
            attackAttribute2: action.attackAttribute2,
            attackType: action.attackType,
            defenderAttribute: state.enemy?.attribute ?? 'none',
            defenderRace: runtime.enemy.race,
            defenseMods: applicableDefenseMods(runtime.enemy.defenseMods, action.attackType, attackAttributesFromConfig(action)),
            weaknessBoost: runtime.allies[actor.index].weaknessMods.length > 0,
            hits: action.hits,
            hitsMin: action.hitsMin,
            hitsMax: action.hitsMax
          });
          hpDist = applyAttackToHp(hpDist, damageDist);
          recordTimeline(timeline, `キャラ${actor.index + 1} ${samePrefix}攻撃`, hpDist, turnIndex + 1, 'attack');
        } else if (action.kind === 'buff') {
          allyEffect(runtime, action.buff, actor.index);
          recordTimeline(timeline, `キャラ${actor.index + 1} ${samePrefix}バフ`, hpDist, turnIndex + 1, 'buff');
        } else if (action.kind === 'effect') {
          recordTimeline(timeline, `キャラ${actor.index + 1} ${samePrefix}効果のみ`, hpDist, turnIndex + 1, 'effect');
        } else {
          recordTimeline(timeline, `キャラ${actor.index + 1} ${samePrefix}行動スキップ`, hpDist, turnIndex + 1, 'skip');
        }

        if (action.kind !== 'skip') {
          for (const effect of action.effects) allyEffect(runtime, effect, actor.index);
        }
        runtime.allies[actor.index].actionsTaken += 1;
        expireSourceLinkedMods(runtime, actor.index, 'end');
      } else {
        const rawEnemyAction = turn.enemyAction ?? { enabled: false, effect: { type: 'none' } };
        let effect = rawEnemyAction.effect ?? { type: 'none' };
        let repeated = false;
        if (effect.type === 'same') {
          repeated = true;
          for (let i = turnIndex - 1; i >= 0; i--) {
            const prev = turns[i]?.enemyAction?.effect;
            if (prev && prev.type !== 'same') { effect = prev; break; }
          }
          if (effect.type === 'same') effect = { type: 'none' };
        }
        if (rawEnemyAction.enabled !== false) {
          hpDist = enemyEffect(runtime, effect, hpDist);
          hpDist = finishEnemyCommandAction(runtime, hpDist);
          const labelMap = {
            none: '効果なし', allyAtkDebuff: '攻撃デバフ', allySpeedDebuff: '素早さデバフ',
            enemyAtkBuff: '敵の攻撃アップ', enemyDefenseBuff: '敵の防御アップ', enemyDefenseDebuff: '敵の防御ダウン',
            enemyCounterGuard: 'カウンター（防御部分）', enemyBlessing: '敵の加護', enemySpeedBuff: '敵の素早さアップ', heal: '回復'
          };
          recordTimeline(timeline, `敵 ${repeated ? '同行動→' : ''}${labelMap[effect.type] ?? '効果なし'}`, hpDist, turnIndex + 1, 'enemy');
        } else {
          recordTimeline(timeline, '敵 行動OFF', hpDist, turnIndex + 1, 'enemyOff');
        }

        const before = hpDist;
        hpDist = applyPoison(runtime, hpDist);
        if (runtime.enemy.poison !== 'none') {
          recordTimeline(
            timeline,
            runtime.enemy.poison === 'poison' ? '毒ダメージ' : '猛毒ダメージ',
            hpDist,
            turnIndex + 1,
            'poison'
          );
        } else if (before !== hpDist) {
          recordTimeline(timeline, '毒ダメージ', hpDist, turnIndex + 1, 'poison');
        }
      }

      // 最終ターンは、入力された味方の最終行動が終わった瞬間で計算を止める。
      if (isFinalTurn && pos === lastAllyPosition) {
        return {
          killChance: killChance(hpDist),
          hpDistribution: hpDist,
          timeline,
          finalTurn: turnIndex + 1,
          finalOrder: order
        };
      }
    }

    decrementTimedEffects(runtime);
  }

  return { killChance: killChance(hpDist), hpDistribution: hpDist, timeline, finalTurn: turns.length, finalOrder: [] };
}


function cloneRuntimeState(runtime) {
  return JSON.parse(JSON.stringify(runtime));
}

function scaleDistribution(dist, factor) {
  if (factor === 1) return new Map(dist);
  const out = new Map();
  for (const [hp, p] of dist) out.set(hp, p * factor);
  return out;
}

function mapBossHpDistribution(runtime, hpDist, mapper) {
  const out = new Map();
  const count = bossHpSlotCount(runtime);
  for (const [hp, probability] of hpDist) {
    const parts = multiHpParts(hp);
    if (!parts) {
      const next = Math.max(0, trunc0(mapper(hp)));
      out.set(next, (out.get(next) ?? 0) + probability);
      continue;
    }
    const next = parts.slice();
    for (let i = 0; i < Math.min(count, next.length); i++) {
      if (next[i] > 0) next[i] = Math.max(0, trunc0(mapper(next[i])));
    }
    const key = multiHpKey(next);
    out.set(key, (out.get(key) ?? 0) + probability);
  }
  return out;
}

function setEnemyHpSlotDistribution(hpDist, slot, value) {
  const out = new Map();
  for (const [hp, probability] of hpDist) {
    const parts = enemyHpPartArray(hp);
    while (parts.length <= slot) parts.push(0);
    parts[slot] = Math.max(0, trunc0(value));
    const key = parts.length > 1 ? multiHpKey(parts) : parts[0];
    out.set(key, (out.get(key) ?? 0) + probability);
  }
  return out;
}

function addEnemyHpSlotDistribution(hpDist, slot, value, maxHp = Infinity) {
  const add = Math.max(0, trunc0(Number(value) || 0));
  if (!add) return hpDist;
  const cap = Number.isFinite(Number(maxHp)) ? Math.max(0, trunc0(Number(maxHp))) : Infinity;
  const out = new Map();
  for (const [hp, probability] of hpDist) {
    const parts = enemyHpPartArray(hp);
    while (parts.length <= slot) parts.push(0);
    if (parts[slot] > 0) parts[slot] = Math.min(cap, Math.max(0, parts[slot] + add));
    const key = parts.length > 1 ? multiHpKey(parts) : parts[0];
    out.set(key, (out.get(key) ?? 0) + probability);
  }
  return out;
}

function healEnemyTeamDistribution(runtime, hpDist, amount) {
  const heal = Math.max(0, trunc0(Number(amount) || 0));
  if (!heal) return hpDist;
  const bossCount = bossHpSlotCount(runtime);
  const maxBySlot = new Map();
  const untargetableSlots = new Set();
  for (let i = 0; i < bossCount; i++) maxBySlot.set(i, Math.max(1, Number(runtime.maxHp ?? 1) || 1));
  for (const companion of runtime.companions ?? []) {
    const slot = Number(companion?.hpSlot);
    if (!Number.isInteger(slot) || slot < 0) continue;
    maxBySlot.set(slot, Math.max(1, Number(companion.maxHp ?? 1) || 1));
    if (companionIsOffField(companion)) untargetableSlots.add(slot);
  }
  const out = new Map();
  for (const [hp, probability] of hpDist) {
    const parts = enemyHpPartArray(hp);
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] <= 0) continue; // 撃破済みの敵は回復で復活しない。
      if (untargetableSlots.has(i)) continue; // 一時離脱中は味方側の回復技からも対象外。
      const cap = maxBySlot.get(i);
      if (cap == null) continue;
      parts[i] = Math.min(cap, parts[i] + heal);
    }
    const key = parts.length > 1 ? multiHpKey(parts) : parts[0];
    out.set(key, (out.get(key) ?? 0) + probability);
  }
  return out;
}

function appendEnemyHpSlots(hpDist, values) {
  if (!values?.length) return hpDist;
  const out = new Map();
  for (const [hp, probability] of hpDist) {
    const parts = enemyHpPartArray(hp);
    parts.push(...values.map(value => Math.max(0, trunc0(value))));
    const key = multiHpKey(parts);
    out.set(key, (out.get(key) ?? 0) + probability);
  }
  return out;
}

function addDistribution(into, from) {
  for (const [hp, p] of from) into.set(hp, (into.get(hp) ?? 0) + p);
}

function stringifyRuntimeForMerge(runtime) {
  // seq は効果の適用順を表す通し番号だが、配列自体も適用順を保持している。
  // 絶対値だけが異なる同一状態を別枝にしないことで、再行動BOSSの枝爆発を抑える。
  // ドック・ローの再行動技は「同じリール内の同名マス」が完全に交換可能なので、
  // どの物理スロットを消費したかではなく、各リールで何個消費したかだけをキー化する。
  // 実ランタイムには代表枝のslot overrideを残すため、挙動は厳密なまま状態数だけ圧縮できる。
  let normalized = runtime;
  if (runtime?.enemy?.presetId === 'q_dock_low' && runtime.enemy?.commandOverrides) {
    normalized = cloneRuntimeState(runtime);
    const matrix = enemyBossProfile('q_dock_low')?.matrix ?? [];
    const counts = {};
    for (const [slotKey, nextCommand] of Object.entries(runtime.enemy.commandOverrides ?? {})) {
      if (String(nextCommand) !== 'ミス') {
        counts[`raw:${slotKey}`] = nextCommand;
        continue;
      }
      const [rText, sText] = String(slotKey).split(':');
      const r = Number(rText), si = Number(sText);
      const original = String(matrix?.[r]?.[si] ?? '');
      if (original === '蒼染の月明' || original === '深海の叫び') {
        const key = `${r}:${original}`;
        counts[key] = (counts[key] ?? 0) + 1;
      } else {
        counts[`raw:${slotKey}`] = nextCommand;
      }
    }
    normalized.enemy.commandOverrides = Object.fromEntries(Object.entries(counts).sort(([a],[b]) => a.localeCompare(b, 'ja')));
  }
  return JSON.stringify(normalized, (key, value) => (key === 'seq' || key === 'summoned') ? undefined : value);
}

function runtimeScenarioKey(runtime, reels, enemyReel = 0, companionReels = []) {
  return `${stringifyRuntimeForMerge(runtime)}|${JSON.stringify({ reels, enemyReel, companionReels })}`;
}

function compactInactiveCompanionsAtTurnBoundary(sc) {
  const companions = sc.runtime?.companions ?? [];
  if (!companions.some(x => x?.active === false)) return sc;
  const keep = [];
  for (let i = 0; i < companions.length; i++) {
    if (companions[i]?.active !== false) keep.push(i);
  }
  const runtime = cloneRuntimeState(sc.runtime);
  runtime.companions = keep.map(i => runtime.companions[i]);
  const priorReels = Array.isArray(sc.companionReels) ? sc.companionReels : [];
  const companionReels = keep.map((oldIndex, newIndex) => {
    const companion = runtime.companions[newIndex];
    return priorReels[oldIndex] ?? companion?.startReel ?? 0;
  });
  return { ...sc, runtime, companionReels };
}

function mergeScenarios(scenarios) {
  const byKey = new Map();
  for (const sc of scenarios) {
    const companionReels = Array.isArray(sc.companionReels) ? sc.companionReels : [];
    const key = runtimeScenarioKey(sc.runtime, sc.reels, sc.enemyReel ?? 0, companionReels);
    const existing = byKey.get(key);
    if (existing) addDistribution(existing.hpDist, sc.hpDist);
    else byKey.set(key, { runtime: sc.runtime, reels: sc.reels.slice(), enemyReel: sc.enemyReel ?? 0, companionReels: companionReels.slice(), hpDist: new Map(sc.hpDist), order: sc.order });
  }
  return [...byKey.values()];
}

function clearEnemyCharge(runtime) {
  const charge = runtime?.enemy?.charge;
  if (!charge) return;
  const defenseKey = String(charge.defenseKey ?? '');
  if (defenseKey) {
    runtime.enemy.defenseMods = (runtime.enemy.defenseMods ?? []).filter(mod => mod.enemyEffectKey !== defenseKey);
  }
  runtime.enemy.charge = null;
}

// 秘宗重拳の溜め解除判定。溜め開始時HPから最大HPの指定割合以上を失った枝だけを分離し、
// その次の行動者から20%軽減が外れるようにする。Maotai自身に回復技がないため、
// 「開始HP－現在HP」で受けた累積ダメージを正確に追跡できる。
function splitBrokenEnemyChargeScenarios(scenarios) {
  const out = [];
  for (const sc of scenarios) {
    const charge = sc.runtime?.enemy?.charge;
    if (!charge) { out.push(sc); continue; }
    const startHp = Number(charge.startHp);
    const breakDamage = Number(charge.breakDamage);
    if (!Number.isFinite(startHp) || !Number.isFinite(breakDamage) || breakDamage <= 0) { out.push(sc); continue; }
    const charging = new Map();
    const broken = new Map();
    for (const [hp, probability] of sc.hpDist) {
      // 撃破済みの質量は以後BOSSが行動しないため、状態分岐を増やさず充填側へ残す。
      const target = hp > 0 && startHp - hp >= breakDamage ? broken : charging;
      target.set(hp, (target.get(hp) ?? 0) + probability);
    }
    if (distributionMass(charging) > 0) out.push({ ...sc, hpDist:charging });
    if (distributionMass(broken) > 0) {
      const rt = cloneRuntimeState(sc.runtime);
      clearEnemyCharge(rt);
      out.push({ ...sc, runtime:rt, hpDist:broken });
    }
  }
  return mergeScenarios(out);
}

function combinedHpDistribution(scenarios) {
  const out = new Map();
  for (const sc of scenarios) addDistribution(out, sc.hpDist);
  return out;
}

function distributionMass(dist) {
  let total = 0;
  for (const p of dist.values()) total += p;
  return total;
}


function addPointTimed(list, effect, seq) {
  const duration = Math.max(1, parseIntValue(effect.duration ?? '1', '継続ターン', { min: 1, max: 99 }));
  const value = parseNumber(effect.value ?? '0', '効果量', { min: 0, max: 100 });
  list.push({ value, remaining: duration, seq, justApplied: true });
}

function enemyTargetIndexes(runtime, target) {
  // 石化中は敵から攻撃対象として選ばれない。
  const active = Array.from({ length: runtime.allyCount }, (_, i) => i)
    // 石化中・すいこみ中は場から対象として外れる。ただしactorOrderには残し、行動機会で拘束カウントを進める。
    .filter(i => runtime.allies[i]?.active !== false
      && !runtime.allies[i]?.statuses?.petrification
      && Number(runtime.allies[i]?.actionLockRemaining ?? 0) <= 0);
  if (target === 'all') return active;
  if (target === 'random' || target === 'randomEachHit') return active;
  return active;
}

function wakeFromPhysicalHit(ally) {
  if (ally?.statuses?.sleep) delete ally.statuses.sleep;
}

function markEnemyDamagedTarget(runtime, allyIndex) {
  runtime.enemyDamagedTargets ??= [];
  if (!runtime.enemyDamagedTargets.includes(allyIndex)) runtime.enemyDamagedTargets.push(allyIndex);
}

function markEnemyHitStatus(runtime, allyIndex, status) {
  if (!status) return;
  runtime.enemyHitStatusTargets ??= {};
  runtime.enemyHitStatusTargets[status] ??= [];
  if (!runtime.enemyHitStatusTargets[status].includes(allyIndex)) runtime.enemyHitStatusTargets[status].push(allyIndex);
}

function statusConditionAtHitMatches(runtime, allyIndex, effect) {
  const status = String(effect?.requiresStatusAtHit ?? '').trim();
  if (!status) return true;
  return (runtime.enemyHitStatusTargets?.[status] ?? []).includes(allyIndex);
}

function adjustedStatusChance(ally, effect, sourceSkill) {
  const race = String(ally?.race ?? '').trim();
  if (effect?.status === 'curse' && race === 'undead') return 0;
  if (Array.isArray(effect?.immuneRaces) && effect.immuneRaces.includes(race)) return 0;
  if (statusImmuneActive(ally)) return 0;
  const attribute = String(ally?.attribute ?? '').trim();
  const requiredAttribute = String(effect?.requiredAttribute ?? '').trim();
  if (requiredAttribute && attribute !== requiredAttribute) return 0;
  if (effect?.maxStar != null) {
    const rawStar = String(ally?.star ?? '').trim();
    const star = Number(rawStar);
    if (!rawStar || !Number.isFinite(star) || star > Number(effect.maxStar)) return 0;
  }
  if (effect?.minStar != null) {
    const rawStar = String(ally?.star ?? '').trim();
    const star = Number(rawStar);
    if (!rawStar || !Number.isFinite(star) || star < Number(effect.minStar)) return 0;
  }
  let rawChance = effect.chance ?? 100;
  if (attribute && effect.chanceIfAttribute?.[attribute] != null) {
    rawChance = effect.chanceIfAttribute[attribute];
  }
  if (race && effect.chanceIfRace?.[race] != null) {
    rawChance = effect.chanceIfRace[race];
  }
  for (const [status, chance] of Object.entries(effect.chanceIfStatus ?? {})) {
    if (ally?.statuses?.[status]) { rawChance = chance; break; }
  }
  const base = parseNumber(rawChance, '状態異常確率', { min: 0, max: 100 });
  const vulnerability = statusVulnerabilityPoints(ally);
  const bypassAvoid = effect.bypassAvoid === true || sourceSkill?.attackType === 'other';
  const avoid = bypassAvoid ? 0 : statusAvoidPoints(ally);
  return Math.max(0, Math.min(100, base + vulnerability - avoid));
}

function inflictStatus(ally, effect) {
  ally.statuses ??= {};
  const status = effect.status;
  if (!status || status === 'poison' || status === 'deadlyPoison') return;
  const defaultDuration = status === 'silence' || status === 'darkness' || status === 'cold' ? 3
    : status === 'sleep' ? 5
    : status === 'petrification' ? 99
    : 1;
  const duration = Math.max(1, Number(effect.duration ?? defaultDuration) || defaultDuration);
  ally.statuses[status] = { remaining: duration };
}

function mergeRuntimeBranches(branches) {
  const byKey = new Map();
  for (const branch of branches) {
    const key = stringifyRuntimeForMerge(branch.runtime);
    const existing = byKey.get(key);
    if (existing) addDistribution(existing.hpDist, branch.hpDist);
    else byKey.set(key, { runtime: branch.runtime, hpDist: new Map(branch.hpDist) });
  }
  return [...byKey.values()];
}

function branchStatusOnTargets(branches, indexes, effect, sourceSkill) {
  if (effect?.status === 'poison' || effect?.status === 'deadlyPoison') return branches;
  let current = branches;
  for (const allyIndex of indexes) {
    const next = [];
    for (const branch of current) {
      const ally = branch.runtime.allies[allyIndex];
      if (!ally || ally.active === false) { next.push(branch); continue; }
      if (effect?.status === 'brainwash' && branch.runtime.allies.filter(x => x?.active !== false).length <= 1) { next.push(branch); continue; }
      if (!statusConditionAtHitMatches(branch.runtime, allyIndex, effect)) { next.push(branch); continue; }
      const chance = adjustedStatusChance(ally, effect, sourceSkill) / 100;
      if (chance <= 0) { next.push(branch); continue; }
      if (chance >= 1) {
        inflictStatus(ally, effect);
        next.push(branch);
        continue;
      }
      const missRt = cloneRuntimeState(branch.runtime);
      const hitRt = cloneRuntimeState(branch.runtime);
      inflictStatus(hitRt.allies[allyIndex], effect);
      next.push({ runtime: missRt, hpDist: scaleDistribution(branch.hpDist, 1 - chance) });
      next.push({ runtime: hitRt, hpDist: scaleDistribution(branch.hpDist, chance) });
    }
    current = mergeRuntimeBranches(next);
  }
  return current;
}

function branchInstantDeathOnTargets(branches, indexes, effect, sourceSkill) {
  let current = branches;
  for (const allyIndex of indexes) {
    const next = [];
    for (const branch of current) {
      const ally = branch.runtime.allies[allyIndex];
      if (!ally || ally.active === false) { next.push(branch); continue; }
      if (!statusConditionAtHitMatches(branch.runtime, allyIndex, effect)) { next.push(branch); continue; }
      const chance = adjustedStatusChance(ally, effect, sourceSkill) / 100;
      if (chance <= 0) { next.push(branch); continue; }
      if (chance >= 1) {
        ally.active = false;
        ally.inactiveReason = 'instantDeath';
        next.push(branch);
        continue;
      }
      const missRt = cloneRuntimeState(branch.runtime);
      const hitRt = cloneRuntimeState(branch.runtime);
      hitRt.allies[allyIndex].active = false;
      hitRt.allies[allyIndex].inactiveReason = 'instantDeath';
      next.push({ runtime:missRt, hpDist:scaleDistribution(branch.hpDist, 1 - chance) });
      next.push({ runtime:hitRt, hpDist:scaleDistribution(branch.hpDist, chance) });
    }
    current = mergeRuntimeBranches(next);
  }
  return current;
}

function purgeOffensiveBeneficialAllyEffects(ally) {
  const keepNonPositive = mod => {
    if (mod.mode === 'add') return Number(mod.value ?? 0) <= 0;
    return Number(mod.value ?? 100) <= 100;
  };
  ally.attackMods = (ally.attackMods ?? []).filter(keepNonPositive);
  ally.speedMods = (ally.speedMods ?? []).filter(keepNonPositive);
}

function purgeBeneficialAllyEffects(ally) {
  const keepNonPositive = mod => {
    if (mod.mode === 'add') return Number(mod.value ?? 0) <= 0;
    return Number(mod.value ?? 100) <= 100;
  };
  const keepNonProtectiveDamage = mod => {
    if (mod.mode === 'add') return Number(mod.value ?? 0) >= 0;
    return Number(mod.value ?? 100) >= 100;
  };
  ally.attackMods = (ally.attackMods ?? []).filter(keepNonPositive);
  ally.speedMods = (ally.speedMods ?? []).filter(keepNonPositive);
  ally.weaknessMods = [];
  ally.statusAvoidMods = [];
  ally.statusImmuneMods = [];
  ally.damageTakenMods = (ally.damageTakenMods ?? []).filter(keepNonProtectiveDamage);
}

function enemySkillMultiplierForAlly(skill, ally) {
  let multiplier = Number(skill?.multiplier ?? 100);
  const allyAttribute = String(ally?.attribute ?? '').trim();
  if (allyAttribute && skill?.multiplierIfAttribute?.[allyAttribute] != null) {
    multiplier = Number(skill.multiplierIfAttribute[allyAttribute]);
  }
  for (const [status, value] of Object.entries(skill?.multiplierIfStatus ?? {})) {
    if (ally?.statuses?.[status]) { multiplier = Number(value); break; }
  }
  if (skill?.multiplierIfAnyHarmfulStatus != null
      && HARMFUL_STATUSES.some(status => ally?.statuses?.[status])) {
    multiplier = Number(skill.multiplierIfAnyHarmfulStatus);
  }
  return multiplier;
}

function summonEnemyCompanion(runtime, effect) {
  runtime.companions ??= [];
  // オレカの敵チームは最大3体。BOSS本体を1枠として、お供は最大2体まで。
  const activeCount = runtime.companions.filter(x => x?.active !== false).length;
  if (activeCount >= 2) return [];
  const name = String(effect?.name ?? '').trim();
  // BOSS専用召喚など、同名のお供が場にいる間は再召喚しない技。
  if (effect?.onlyIfMissing === true && activeEnemyCompanionNamed(runtime, [name])) return [];
  const cp = enemyCompanionProfile(name);
  const baseHp = Math.max(1, Number(effect?.maxHp ?? enemyCompanionBaseHp(name) ?? 0) || 0);
  if (!cp && !baseHp) return [];
  const summonCount = effect?.fillEmpty === true ? 2 - activeCount : 1;
  const added = [];
  for (let i = 0; i < summonCount; i++) {
    const hpSlot = baseHp ? Math.max(1, Number(runtime.enemy?.hpSlotCount ?? bossHpSlotCount(runtime))) : null;
    if (baseHp) runtime.enemy.hpSlotCount = hpSlot + 1;
    runtime.companions.push({
      name,
      maxHp:baseHp || null, hpSlot,
      // Lv10召喚など、技側で個別ステータスが明示される場合はそちらを優先。
      baseAttack: Number(effect.attack ?? cp?.attack ?? 0) || 0,
      baseSpeed: Number(effect.speed ?? cp?.speed ?? 0) || 0,
      attribute:String(effect.attribute ?? cp?.attribute ?? ''), race:String(effect.race ?? cp?.race ?? 'normal'),
      attackMods: [], speedMods: [], defenseMods: [], statuses:{}, flatAttackBonus:0, flatSpeedBonus:0, postActionSpeedGain:0, postActionEnemyExGain:0,
      permanentBuffKeys:[], actionLockRemaining:0, active: true,
      startReel: Math.max(0, Math.min((cp?.matrix?.length ?? 1) - 1, Number(effect.startReel ?? 0) || 0)),
      summoned: true, deathSeq:null, revivable:false,
      summonCurseTurns: Math.max(0, Math.trunc(Number(effect.summonCurseTurns ?? 0) || 0)),
      summonCurseJustApplied: Math.max(0, Math.trunc(Number(effect.summonCurseTurns ?? 0) || 0)) > 0
    });
    added.push(runtime.companions.length - 1);
  }
  return added;
}

function activeEnemyCompanionNamed(runtime, names) {
  const wanted = new Set((names ?? []).map(x => String(x ?? '').trim()).filter(Boolean));
  if (!wanted.size) return false;
  return (runtime.companions ?? []).some(x => x?.active !== false && wanted.has(String(x?.name ?? '').trim()));
}


function healEnemySingleBranches(runtime, hpDist, amount, cureStatus = false, targetRace = '') {
  const heal = Math.max(0, trunc0(Number(amount) || 0));
  if (!heal) return [{ runtime, hpDist }];
  const bossCount = bossHpSlotCount(runtime);
  const requiredRace = String(targetRace ?? '').trim();
  const raceMatches = race => !requiredRace || normalizeEnemyRace(race) === requiredRace;
  const companionBySlot = new Map();
  for (const i of targetableEnemyCompanionIndexes(runtime)) {
    const companion = runtime.companions?.[i];
    const slot = Number(companion?.hpSlot);
    if (Number.isInteger(slot) && slot >= 0 && raceMatches(companion?.race ?? enemyCompanionProfile(companion?.name ?? '')?.race)) companionBySlot.set(slot, i);
  }
  const out = [];
  for (const [hp, probability] of hpDist) {
    const parts = enemyHpPartArray(hp);
    const candidates = [];
    for (let slot = 0; slot < Math.min(bossCount, parts.length); slot++) if (parts[slot] > 0 && raceMatches(runtime.enemy?.race)) candidates.push({ slot, companionIndex:null });
    for (const [slot, companionIndex] of companionBySlot) if ((parts[slot] ?? 0) > 0) candidates.push({ slot, companionIndex });
    if (!candidates.length) {
      out.push({ runtime:cloneRuntimeState(runtime), hpDist:new Map([[hp, probability]]) });
      continue;
    }
    const weight = probability / candidates.length;
    for (const target of candidates) {
      const rt = cloneRuntimeState(runtime);
      const next = parts.slice();
      const cap = target.companionIndex == null
        ? Math.max(1, Number(rt.maxHp ?? 1) || 1)
        : Math.max(1, Number(rt.companions?.[target.companionIndex]?.maxHp ?? 1) || 1);
      next[target.slot] = Math.min(cap, Math.max(0, next[target.slot]) + heal);
      if (cureStatus) {
        if (target.companionIndex == null) rt.enemy.poison = 'none';
        else {
          const c = rt.companions?.[target.companionIndex];
          if (c) { c.poison = 'none'; clearCompanionSleep(c); }
        }
      }
      out.push({ runtime:rt, hpDist:new Map([[next.length > 1 ? multiHpKey(next) : next[0], weight]]) });
    }
  }
  return mergeRuntimeBranches(out);
}


function healActingCompanionDistribution(runtime, hpDist, amount) {
  const companionIndex = Number(runtime?.actingCompanionIndex);
  const companion = Number.isInteger(companionIndex) ? runtime.companions?.[companionIndex] : null;
  if (!companion || companion.active === false || !Number.isInteger(Number(companion.hpSlot))) return hpDist;
  const heal = Math.max(0, trunc0(Number(amount) || 0));
  if (!heal) return hpDist;
  return addEnemyHpSlotDistribution(hpDist, Number(companion.hpSlot), heal, Math.max(1, Number(companion.maxHp ?? 1)));
}

function applyEnemyActorHealDistribution(runtime, hpDist, healDist) {
  const companionIndex = Number(runtime?.actingCompanionIndex);
  const companion = Number.isInteger(companionIndex) ? runtime.companions?.[companionIndex] : null;
  const out = new Map();
  for (const [heal, healProbability] of healDist ?? []) {
    if (!(healProbability > 0)) continue;
    let healed;
    if (companion && companion.active !== false && Number.isInteger(Number(companion.hpSlot))) {
      healed = addEnemyHpSlotDistribution(
        hpDist, Number(companion.hpSlot), Math.max(0, trunc0(Number(heal) || 0)),
        Math.max(1, Number(companion.maxHp ?? 1) || 1)
      );
    } else {
      healed = mapBossHpDistribution(runtime, hpDist, hp => Math.min(runtime.maxHp, hp + Math.max(0, trunc0(Number(heal) || 0))));
    }
    addDistribution(out, scaleDistribution(healed, healProbability));
  }
  return out.size ? out : hpDist;
}

function companionIsOffField(companion) {
  return Boolean(companion?.excursion?.active);
}

function activeEnemyCompanionIndexes(runtime) {
  const out = [];
  for (let i = 0; i < (runtime?.companions?.length ?? 0); i++) {
    if (runtime.companions[i]?.active !== false) out.push(i);
  }
  return out;
}

// 〖ゆうらん〗などで一時離脱中のお供は、枠自体は占有するが技の対象にはならない。
function targetableEnemyCompanionIndexes(runtime) {
  return activeEnemyCompanionIndexes(runtime).filter(i => !companionIsOffField(runtime.companions?.[i]));
}

function companionIsWarrior(companion) {
  const race = String(companion?.race ?? enemyCompanionProfile(companion?.name ?? '')?.race ?? '').trim();
  return race === 'warrior';
}

function clearCompanionSleep(companion) {
  if (!companion) return;
  if (companion.statuses?.sleep) delete companion.statuses.sleep;
  // 〖寝る〗由来の加護は睡眠が解除された時点で終了する。
  if (companion.sleepBlessing) delete companion.sleepBlessing;
}

function applyCompanionSleep(companion, duration = 5) {
  if (!companion || companion.active === false) return;
  companion.statuses ??= {};
  // 睡眠中への再付与では残り行動回数を延長しない。
  if (!companion.statuses.sleep) companion.statuses.sleep = { remaining:Math.max(1, Math.trunc(Number(duration) || 5)) };
}

function damageEnemyHpSlotDistribution(hpDist, slot, damageDist) {
  const out = new Map();
  for (const [hp, hpProbability] of hpDist) {
    const parts = enemyHpPartArray(hp);
    if (!Number.isInteger(slot) || slot < 0 || slot >= parts.length || parts[slot] <= 0) {
      out.set(hp, (out.get(hp) ?? 0) + hpProbability);
      continue;
    }
    for (const [damage, damageProbability] of damageDist) {
      const next = parts.slice();
      next[slot] = Math.max(0, next[slot] - Math.max(0, trunc0(damage)));
      const key = multiHpKey(next);
      out.set(key, (out.get(key) ?? 0) + hpProbability * damageProbability);
    }
  }
  return out;
}

function reviveEnemyCompanionFullBranches(branch) {
  const next = [];
  for (const [hp, probability] of branch.hpDist) {
    const parts = enemyHpPartArray(hp);
    const candidates = [];
    for (let i = 0; i < (branch.runtime.companions ?? []).length; i++) {
      const companion = branch.runtime.companions[i];
      const slot = Number(companion?.hpSlot);
      if (!Number.isInteger(slot) || slot < 0 || slot >= parts.length) continue;
      if (Number(parts[slot] ?? 0) > 0) continue;
      if (!(Number(companion?.maxHp ?? 0) > 0)) continue;
      if (companion?.revivable !== true || !Number.isFinite(Number(companion?.deathSeq))) continue;
      candidates.push(i);
    }
    if (!candidates.length) {
      next.push({ runtime:cloneRuntimeState(branch.runtime), hpDist:new Map([[hp, probability]]) });
      continue;
    }
    // 〖ふっかつの秘法〗は倒れた順に蘇生するため、最も古い死亡記録を確定対象にする。
    candidates.sort((a, b) => {
      const ca = branch.runtime.companions[a];
      const cb = branch.runtime.companions[b];
      const seqDiff = Number(ca?.deathSeq ?? Infinity) - Number(cb?.deathSeq ?? Infinity);
      if (seqDiff) return seqDiff;
      return Number(ca?.hpSlot ?? Infinity) - Number(cb?.hpSlot ?? Infinity);
    });
    const companionIndex = candidates[0];
    const rt = cloneRuntimeState(branch.runtime);
    const companion = rt.companions[companionIndex];
    const slot = Number(companion.hpSlot);
    const revived = parts.slice();
    revived[slot] = Math.max(1, Math.trunc(Number(companion.maxHp ?? 1) || 1));
    companion.active = true;
    companion.revivable = false;
    companion.deathSeq = null;
    next.push({ runtime:rt, hpDist:new Map([[multiHpKey(revived), probability]]) });
  }
  return mergeRuntimeBranches(next);
}


function reviveEnemyCompanionHpBranches(branch, hpValue = 1) {
  const next = [];
  const reviveHp = Math.max(1, Math.trunc(Number(hpValue) || 1));
  for (const [hp, probability] of branch.hpDist) {
    const parts = enemyHpPartArray(hp);
    const candidates = [];
    for (let i = 0; i < (branch.runtime.companions ?? []).length; i++) {
      const companion = branch.runtime.companions[i];
      const slot = Number(companion?.hpSlot);
      if (!Number.isInteger(slot) || slot < 0 || slot >= parts.length) continue;
      if (Number(parts[slot] ?? 0) > 0) continue;
      if (!(Number(companion?.maxHp ?? 0) > 0)) continue;
      if (companion?.revivable !== true || !Number.isFinite(Number(companion?.deathSeq))) continue;
      candidates.push(i);
    }
    if (!candidates.length) {
      next.push({ runtime:cloneRuntimeState(branch.runtime), hpDist:new Map([[hp, probability]]) });
      continue;
    }
    candidates.sort((a, b) => {
      const ca = branch.runtime.companions[a];
      const cb = branch.runtime.companions[b];
      const seqDiff = Number(ca?.deathSeq ?? Infinity) - Number(cb?.deathSeq ?? Infinity);
      if (seqDiff) return seqDiff;
      return Number(ca?.hpSlot ?? Infinity) - Number(cb?.hpSlot ?? Infinity);
    });
    const companionIndex = candidates[0];
    const rt = cloneRuntimeState(branch.runtime);
    const companion = rt.companions[companionIndex];
    const slot = Number(companion.hpSlot);
    const revived = parts.slice();
    revived[slot] = Math.min(Math.max(1, Number(companion.maxHp ?? 1)), reviveHp);
    companion.active = true;
    companion.revivable = false;
    companion.deathSeq = null;
    next.push({ runtime:rt, hpDist:new Map([[multiHpKey(revived), probability]]) });
  }
  return mergeRuntimeBranches(next);
}


function transformCompanionToZombieBranches(branch, effect = {}) {
  const candidates = targetableEnemyCompanionIndexes(branch.runtime);
  if (!candidates.length) return [{ runtime:cloneRuntimeState(branch.runtime), hpDist:new Map(branch.hpDist) }];
  const out = [];
  const weight = 1 / candidates.length;
  for (const targetIndex of candidates) {
    const rt = cloneRuntimeState(branch.runtime);
    const source = rt.companions?.[targetIndex];
    if (!source || source.active === false) continue;
    const sourceMaxHp = Math.max(1, Number(source.maxHp ?? 1));
    const sourceAttack = Math.max(0, Number(source.baseAttack ?? 0) + Number(source.flatAttackBonus ?? 0));
    const newMaxHp = 270 + trunc0(sourceMaxHp * Number(effect.hpCarryPercent ?? 50) / 100);
    const newAttack = 40 + trunc0(sourceAttack * Number(effect.attackCarryPercent ?? 50) / 100);
    const slot = Number(source.hpSlot);
    rt.companions[targetIndex] = {
      name:'ゾンビビ', maxHp:newMaxHp, hpSlot:slot,
      baseAttack:newAttack, baseSpeed:30, attribute:'earth', race:'undead',
      attackMods:[], speedMods:[], defenseMods:[], statuses:{}, flatAttackBonus:0, flatSpeedBonus:0,
      postActionSpeedGain:0, postActionEnemyExGain:0, permanentBuffKeys:[], actionLockRemaining:0,
      active:true, startReel:0, summoned:true, deathSeq:null, revivable:false,
      summonCurseTurns:Math.max(0, Math.trunc(Number(effect.summonCurseTurns ?? 2) || 2)),
      summonCurseJustApplied:true
    };
    const nextHp = new Map();
    for (const [hp, probability] of branch.hpDist) {
      const parts = enemyHpPartArray(hp);
      if (Number.isInteger(slot) && slot >= 0 && slot < parts.length) parts[slot] = newMaxHp;
      const key = multiHpKey(parts);
      nextHp.set(key, (nextHp.get(key) ?? 0) + probability * weight);
    }
    out.push({ runtime:rt, hpDist:nextHp });
  }
  return mergeRuntimeBranches(out);
}

function applyEnemySecondaryEffects(branches, skill, state) {
  let current = branches;
  for (const effect of skill?.effects ?? []) {
    if (effect.type === 'fixedExAbsorb') {
      const requested = Math.max(0, Math.trunc(Number(effect.value ?? 1) || 0));
      for (const branch of current) {
        const amount = Math.min(requested, playerExGauge(branch.runtime));
        if (amount <= 0) continue;
        branch.runtime.playerExGauge = Math.max(0, playerExGauge(branch.runtime) - amount);
        addEnemyEx(branch.runtime, amount);
      }
      current = mergeRuntimeBranches(current);
      continue;
    }
    if (effect.type === 'auroraExTransfer') {
      for (const branch of current) {
        const activeCount = enemyTargetIndexes(branch.runtime, 'all').length;
        const amount = activeCount >= 3 ? 4 : activeCount === 2 ? 2 : activeCount === 1 ? 1 : 0;
        if (amount > 0) {
          branch.runtime.playerExGauge = Math.max(0, playerExGauge(branch.runtime) - amount);
          addEnemyEx(branch.runtime, amount);
        }
      }
      current = mergeRuntimeBranches(current);
      continue;
    }
    if (effect.type === 'transformCompanionToZombie') {
      const next = [];
      for (const branch of current) next.push(...transformCompanionToZombieBranches(branch, effect));
      current = mergeRuntimeBranches(next);
      continue;
    }
    if (effect.type === 'reviveEnemyCompanionHp') {
      const next = [];
      for (const branch of current) next.push(...reviveEnemyCompanionHpBranches(branch, effect.hp ?? 1));
      current = mergeRuntimeBranches(next);
      continue;
    }
    if (effect.type === 'companionSelfDestruct') {
      for (const branch of current) {
        const companionIndex = Number(branch.runtime.actingCompanionIndex);
        const companion = Number.isInteger(companionIndex) ? branch.runtime.companions?.[companionIndex] : null;
        if (!companion || companion.active === false) continue;
        companion.active = false;
        companion.revivable = false;
        companion.deathSeq = null;
        if (Number.isInteger(Number(companion.hpSlot))) {
          branch.hpDist = setEnemyHpSlotDistribution(branch.hpDist, Number(companion.hpSlot), 0);
        }
      }
      current = mergeRuntimeBranches(current);
      continue;
    }
    if (effect.type === 'reviveEnemyCompanionFull') {
      const next = [];
      for (const branch of current) next.push(...reviveEnemyCompanionFullBranches(branch));
      current = mergeRuntimeBranches(next);
      continue;
    }
    if (effect.type === 'companionPostActionEnemyExGain') {
      const value = Math.max(0, Math.trunc(Number(effect.value ?? 0) || 0));
      for (const branch of current) {
        for (const companion of branch.runtime.companions ?? []) {
          if (!companion || companion.active === false || companionIsOffField(companion)) continue;
          // 同じ精霊の加護アイコンは重複させず、最大値で保持する。
          companion.postActionEnemyExGain = Math.max(Number(companion.postActionEnemyExGain ?? 0), value);
        }
      }
      current = mergeRuntimeBranches(current);
      continue;
    }
    if (effect.type === 'seaDragonTongueEx') {
      // 海竜の舌なめずり: 基礎+3、場にいる水族1体につきさらに+2。
      // 「水属性」ではなく種族「水族」を数える。
      const base = Math.max(0, Math.trunc(Number(effect.base ?? 3) || 0));
      const perWaterRace = Math.max(0, Math.trunc(Number(effect.perWaterRace ?? 2) || 0));
      for (const branch of current) {
        const rt = branch.runtime;
        let waterRaceCount = 0;
        if (normalizeEnemyRace(rt.enemy?.race) === 'waterRace') waterRaceCount += 1;
        for (const ally of rt.allies ?? []) {
          if (!ally || ally.active === false) continue;
          if (normalizeEnemyRace(ally.race) === 'waterRace') waterRaceCount += 1;
        }
        for (const companion of rt.companions ?? []) {
          if (!companion || companion.active === false || companionIsOffField(companion)) continue;
          if (normalizeEnemyRace(companion.race) === 'waterRace') waterRaceCount += 1;
        }
        addEnemyEx(rt, base + perWaterRace * waterRaceCount);
      }
      current = mergeRuntimeBranches(current);
      continue;
    }
    if (effect.type === 'enemyTeamSingleReelShift') {
      // 「味方1体」対象。BOSS自身を除外する表記ではないためBOSS＋生存お供を候補にする。
      // CPUの味方単体対象選択は完全ランダムとして、候補間を等確率分岐する。
      const amount = Math.trunc(Number(effect.amount ?? 0) || 0);
      if (!amount) continue;
      const next = [];
      for (const branch of current) {
        const companionIndexes = targetableEnemyCompanionIndexes(branch.runtime);
        const candidates = [-1, ...companionIndexes];
        if (!candidates.length) { next.push(branch); continue; }
        const weight = 1 / candidates.length;
        for (const target of candidates) {
          const rt = cloneRuntimeState(branch.runtime);
          if (target < 0) {
            rt.enemy.pendingReelShift = Number(rt.enemy.pendingReelShift ?? 0) + amount;
          } else {
            rt.pendingCompanionReelShifts ??= {};
            rt.pendingCompanionReelShifts[target] = Number(rt.pendingCompanionReelShifts[target] ?? 0) + amount;
          }
          next.push({ runtime:rt, hpDist:scaleDistribution(branch.hpDist, weight) });
        }
      }
      current = mergeRuntimeBranches(next);
      continue;
    }
    if (effect.type === 'enemySelfDefenseBuff') {
      for (const branch of current) {
        const actingCompanionIndex = Number(branch.runtime.actingCompanionIndex);
        if (Number.isInteger(actingCompanionIndex) && branch.runtime.companions?.[actingCompanionIndex]) {
          const companion = branch.runtime.companions[actingCompanionIndex];
          if (companion.active === false) continue;
          companion.defenseMods ??= [];
          addEnemyDefenseMod(companion.defenseMods, { ...effect, type:'enemyDefenseBuff' }, ++branch.runtime.seq, String(effect.stackKey ?? `${skill.name}:自己防御`));
        } else {
          addEnemyDefenseMod(branch.runtime.enemy.defenseMods, { ...effect, type:'enemyDefenseBuff' }, ++branch.runtime.seq, String(effect.stackKey ?? `${skill.name}:自己防御`));
        }
      }
      current = mergeRuntimeBranches(current);
      continue;
    }
    if (effect.type === 'companionTeamDefenseBuff') {
      for (const branch of current) {
        for (const companion of branch.runtime.companions ?? []) {
          if (!companion || companion.active === false) continue;
          companion.defenseMods ??= [];
          addEnemyDefenseMod(
            companion.defenseMods,
            { ...effect, type:'enemyDefenseBuff' },
            ++branch.runtime.seq,
            String(effect.stackKey ?? `${skill.name}:${effect.type}`)
          );
        }
      }
      current = mergeRuntimeBranches(current);
      continue;
    }
    if (effect.type === 'companionTeamSleep') {
      for (const branch of current) {
        for (const companion of branch.runtime.companions ?? []) {
          if (companion?.active === false) continue;
          applyCompanionSleep(companion, effect.duration ?? 5);
        }
      }
      current = mergeRuntimeBranches(current);
      continue;
    }
    if (effect.type === 'companionOneHitGuard') {
      for (const branch of current) {
        const companionIndex = Number(branch.runtime.actingCompanionIndex);
        const companion = Number.isInteger(companionIndex) ? branch.runtime.companions?.[companionIndex] : null;
        if (!companion || companion.active === false) continue;
        // 同ターンに再使用しても無効回数は1回だけ。未消費なら上書きしない。
        if (!companion.oneHitGuard) {
          companion.oneHitGuard = {
            attackTypes:Array.isArray(effect.attackTypes) ? effect.attackTypes.slice() : ['physical'],
            source:String(skill?.name ?? '')
          };
        }
      }
      current = mergeRuntimeBranches(current);
      continue;
    }
    if (effect.type === 'companionMagicReflect') {
      for (const branch of current) {
        const companionIndex = Number(branch.runtime.actingCompanionIndex);
        const companion = Number.isInteger(companionIndex) ? branch.runtime.companions?.[companionIndex] : null;
        if (!companion || companion.active === false) continue;
        companion.magicReflect = {
          ratio:Math.max(0, Number(effect.ratio ?? 100) || 0),
          source:String(skill?.name ?? '')
        };
      }
      current = mergeRuntimeBranches(current);
      continue;
    }
    if (effect.type === 'companionSelfPhysicalEvasion') {
      for (const branch of current) {
        const companionIndex = Number(branch.runtime.actingCompanionIndex);
        const companion = Number.isInteger(companionIndex) ? branch.runtime.companions?.[companionIndex] : null;
        if (!companion || companion.active === false) continue;
        companion.physicalEvasionMods ??= [];
        const key = String(effect.stackKey ?? `${skill.name}:${effect.type}`);
        const duration = Math.max(1, Math.trunc(Number(effect.duration ?? 1) || 1));
        const chance = Math.max(0, Math.min(100, Number(effect.chance ?? 0) || 0));
        const existing = companion.physicalEvasionMods.find(x => x.stackKey === key);
        if (existing) {
          existing.chance = chance;
          existing.remaining = duration;
          existing.justApplied = true;
        } else {
          companion.physicalEvasionMods.push({ chance, remaining:duration, justApplied:true, stackKey:key, seq:++branch.runtime.seq });
        }
      }
      current = mergeRuntimeBranches(current);
      continue;
    }
    if (effect.type === 'companionGuardOrder') {
      const next = [];
      for (const branch of current) {
        const candidates = targetableEnemyCompanionIndexes(branch.runtime);
        if (!candidates.length) { next.push(branch); continue; }
        // CPUの味方単体対象選択は完全ランダムとして、複数候補時は等確率で分岐する。
        const weight = 1 / candidates.length;
        for (const companionIndex of candidates) {
          const rt = cloneRuntimeState(branch.runtime);
          const companion = rt.companions[companionIndex];
          companion.defenseMods ??= [];
          const reduction = companionIsWarrior(companion)
            ? Number(effect.warriorValue ?? effect.value ?? 0)
            : Number(effect.value ?? 0);
          addEnemyDefenseMod(companion.defenseMods, {
            type:'enemyDefenseBuff', value:reduction, duration:effect.duration ?? 2,
            nonStacking:true, stackKey:String(effect.stackKey ?? `${skill.name}:防御`)
          }, ++rt.seq, String(effect.stackKey ?? `${skill.name}:防御`));
          companion.actionLockRemaining = Math.max(
            Number(companion.actionLockRemaining ?? 0),
            Math.max(1, Math.trunc(Number(effect.duration ?? 2) || 2))
          );
          next.push({ runtime:rt, hpDist:scaleDistribution(branch.hpDist, weight) });
        }
      }
      current = mergeRuntimeBranches(next);
      continue;
    }
    if (effect.type === 'status' && (effect.status === 'poison' || effect.status === 'deadlyPoison')) continue;
    if (effect.type === 'status') {
      const target = effect.target ?? skill.target ?? 'all';
      if (target === 'random') {
        const next = [];
        for (const branch of current) {
          const selected = Number.isInteger(branch.runtime.enemyLastTarget) ? branch.runtime.enemyLastTarget : null;
          const indexes = selected == null ? enemyTargetIndexes(branch.runtime, 'random') : [selected];
          next.push(...branchStatusOnTargets([branch], indexes, effect, skill));
        }
        current = mergeRuntimeBranches(next);
      } else if (target === 'damaged') {
        const next = [];
        for (const branch of current) {
          const indexes = (branch.runtime.enemyDamagedTargets ?? [])
            .filter(i => Number.isInteger(i) && i >= 0 && i < branch.runtime.allyCount);
          next.push(...branchStatusOnTargets([branch], indexes, effect, skill));
        }
        current = mergeRuntimeBranches(next);
      } else {
        const indexes = enemyTargetIndexes(current[0]?.runtime ?? { allyCount: 0, allies: [] }, target);
        current = branchStatusOnTargets(current, indexes, effect, skill);
      }
      current = mergeRuntimeBranches(current);
      continue;
    }
    if (effect.type === 'instantDeath') {
      const next = [];
      for (const branch of current) {
        const effectTarget = effect.target ?? skill.target ?? 'random';
        let indexes;
        if (effectTarget === 'damaged') {
          indexes = (branch.runtime.enemyDamagedTargets ?? [])
            .filter(i => Number.isInteger(i) && i >= 0 && i < branch.runtime.allyCount);
        } else if (effectTarget === 'random' && Number.isInteger(branch.runtime.enemyLastTarget)) {
          indexes = [branch.runtime.enemyLastTarget];
        } else {
          indexes = enemyTargetIndexes(branch.runtime, effectTarget);
        }
        next.push(...branchInstantDeathOnTargets([branch], indexes, effect, skill));
      }
      current = mergeRuntimeBranches(next);
      continue;
    }
    if (effect.type === 'summonCompanionWeighted') {
      const choices = (effect.choices ?? []).filter(choice => {
        return Number(choice?.weight ?? 0) > 0 && enemyCompanionProfile(choice?.name ?? '');
      });
      const totalWeight = choices.reduce((sum, choice) => sum + Number(choice.weight ?? 0), 0);
      if (!(totalWeight > 0)) continue;
      const next = [];
      for (const branch of current) {
        const activeCount = (branch.runtime.companions ?? []).filter(x => x?.active !== false).length;
        if (activeCount >= 2) { next.push(branch); continue; }
        for (const choice of choices) {
          const rt = cloneRuntimeState(branch.runtime);
          const added = summonEnemyCompanion(rt, { type:'summonCompanion', ...choice });
          let hpDist = scaleDistribution(branch.hpDist, Number(choice.weight) / totalWeight);
          if (added.length) hpDist = appendEnemyHpSlots(hpDist, added.map(index => rt.companions[index]?.maxHp ?? 0));
          next.push({ runtime: rt, hpDist });
        }
      }
      current = mergeRuntimeBranches(next);
      continue;
    }
    if (effect.type === 'allyReelRandomSet') {
      // ブラックライトブレス: 被弾した各味方について、そのモンスターが持つ全リールから等確率で1つを選ぶ。
      // リール変更は既存の allyReelShift と同様、現在の行動処理が終わった後に反映する。
      let next = current;
      for (let allyIndex = 0; allyIndex < (current[0]?.runtime?.allyCount ?? 0); allyIndex++) {
        const branched = [];
        for (const branch of next) {
          const rt = branch.runtime;
          const targetMode = effect.target ?? skill.target ?? 'all';
          const indexes = targetMode === 'damaged'
            ? (rt.enemyDamagedTargets ?? []).filter(i => Number.isInteger(i) && i >= 0 && i < rt.allyCount)
            : enemyTargetIndexes(rt, targetMode);
          if (!indexes.includes(allyIndex)) { branched.push(branch); continue; }
          const starRaw = Number(rt.allies?.[allyIndex]?.star);
          const reelCount = Number.isFinite(starRaw) && starRaw > 0 ? Math.max(1, Math.min(4, Math.floor(starRaw))) : 4;
          for (let reel = 0; reel < reelCount; reel++) {
            const child = cloneRuntimeState(rt);
            queueAllyReelSet(child, allyIndex, reel);
            branched.push({ runtime:child, hpDist:scaleDistribution(branch.hpDist, 1 / reelCount) });
          }
        }
        next = mergeRuntimeBranches(branched);
      }
      current = next;
      continue;
    }
    if (effect.type === 'enemyPoisonProgression') {
      const next = [];
      for (const branch of current) {
        const rt = branch.runtime;
        if (rt.enemy.poison === 'deadlyPoison') {
          next.push(branch);
          continue;
        }
        const baseChance = Math.max(0, Math.min(100, Number(effect.chance ?? 100) || 0));
        const bypassAvoid = effect.bypassAvoid === true || skill?.attackType === 'other';
        const avoidPoints = bypassAvoid ? 0 : (rt.enemy.statusAvoidMods ?? []).reduce((sum, x) => sum + Number(x.value || 0), 0);
        const chance = Math.max(0, Math.min(1, (baseChance - avoidPoints) / 100));
        if (chance <= 0) { next.push(branch); continue; }
        const applyHit = hitRt => {
          hitRt.enemy.poison = hitRt.enemy.poison === 'poison' ? 'deadlyPoison' : 'poison';
        };
        if (chance >= 1) {
          applyHit(rt);
          next.push(branch);
          continue;
        }
        const missRt = cloneRuntimeState(rt);
        const hitRt = cloneRuntimeState(rt);
        applyHit(hitRt);
        next.push({ runtime:missRt, hpDist:scaleDistribution(branch.hpDist, 1 - chance) });
        next.push({ runtime:hitRt, hpDist:scaleDistribution(branch.hpDist, chance) });
      }
      current = mergeRuntimeBranches(next);
      continue;
    }
    for (const branch of current) {
      const runtime = branch.runtime;
      if (effect.type === 'disableEnemyCommandName') {
        runtime.enemy.disabledCommands ??= [];
        const commandName = String(effect.commandName ?? skill.name ?? '').trim();
        if (commandName && !runtime.enemy.disabledCommands.includes(commandName)) runtime.enemy.disabledCommands.push(commandName);
        continue;
      }
      if (effect.type === 'disableEnemyCommandNameDuringChain') {
        runtime.enemy.transientDisabledCommands ??= [];
        const commandName = String(effect.commandName ?? skill.name ?? '').trim();
        if (commandName && !runtime.enemy.transientDisabledCommands.includes(commandName)) runtime.enemy.transientDisabledCommands.push(commandName);
        continue;
      }
      if (effect.type === 'transformEnemyCommands') {
        const presetId = String(state.enemy?.presetId ?? '').trim();
        const matrix = enemyBossProfile(presetId)?.matrix ?? [];
        const mapping = effect.mapping && typeof effect.mapping === 'object' ? effect.mapping : {};
        runtime.enemy.commandOverrides ??= {};
        for (let reel = 0; reel < matrix.length; reel++) {
          for (let slotIndex = 0; slotIndex < (matrix[reel]?.length ?? 0); slotIndex++) {
            const key = `${reel}:${slotIndex}`;
            const currentCommand = Object.prototype.hasOwnProperty.call(runtime.enemy.commandOverrides, key)
              ? runtime.enemy.commandOverrides[key]
              : matrix[reel][slotIndex];
            const nextCommand = mapping[String(currentCommand ?? '').trim()];
            if (nextCommand) runtime.enemy.commandOverrides[key] = String(nextCommand);
          }
        }
        continue;
      }
      if (effect.type === 'enemySingleTargetUntargetable') {
        runtime.enemy.singleTargetUntargetable = {
          // 発動行動中の再行動では維持し、次の通常BOSS行動開始時に解除する。
          expiresAtAction: Number(runtime.enemy.actionSerial ?? 0) + 1
        };
        continue;
      }
      if (effect.type === 'enemyPhysicalEvasion') {
        const chance = Math.max(0, Math.min(100, Number(effect.chance ?? 0) || 0));
        runtime.enemy.physicalEvasion = {
          chance,
          // 発動したBOSS行動中の再行動には残し、次の通常BOSS行動開始時に解除する。
          expiresAtAction: Number(runtime.enemy.actionSerial ?? 0) + 1
        };
        continue;
      }
      if (effect.type === 'enemyReactiveStatus') {
        runtime.enemy.reactiveEffects ??= [];
        const key = String(effect.stackKey ?? `${skill.name}:${effect.status ?? ''}`);
        const reactionDuration = Math.max(1, Number(effect.reactionDuration ?? effect.duration ?? 1) || 1);
        const nextEffect = {
          status: effect.status, chance: Number(effect.chance ?? 100),
          chanceIfAttribute: effect.chanceIfAttribute ?? null,
          statusDuration: Math.max(1, Number(effect.statusDuration ?? 1) || 1),
          triggerAttackTypes: Array.isArray(effect.triggerAttackTypes) ? effect.triggerAttackTypes.slice() : ['physical'],
          remaining: reactionDuration, justApplied: true, seq: ++runtime.seq, enemyEffectKey: key
        };
        if (effect.nonStacking) {
          const existing = runtime.enemy.reactiveEffects.find(x => x.enemyEffectKey === key);
          if (existing) Object.assign(existing, nextEffect);
          else runtime.enemy.reactiveEffects.push(nextEffect);
        } else {
          runtime.enemy.reactiveEffects.push(nextEffect);
        }
        continue;
      }
      const effectTarget = effect.target ?? skill.target ?? 'all';
      const indexes = effectTarget === 'damaged'
        ? (runtime.enemyDamagedTargets ?? []).filter(i => Number.isInteger(i) && i >= 0 && i < runtime.allyCount)
        : effectTarget === 'random' && Number.isInteger(runtime.enemyLastTarget)
          ? [runtime.enemyLastTarget]
          : enemyTargetIndexes(runtime, effectTarget);
      if (effect.type === 'allyAtkBuff') {
        for (const i of indexes) addTimedMod(runtime.allies[i].attackMods, { ...effect, type:'atkBuff' }, ++runtime.seq);
      } else if (effect.type === 'allyAtkDebuff') {
        for (const i of indexes) {
          const list = runtime.allies[i].attackMods;
          if (effect.nonStacking && list.some(x => x.enemyEffectKey === `${skill.name}:${effect.type}`)) continue;
          addTimedMod(list, { ...effect, type: 'allyAtkDebuff' }, ++runtime.seq);
          list[list.length - 1].enemyEffectKey = `${skill.name}:${effect.type}`;
        }
      } else if (effect.type === 'allySpeedDebuff') {
        for (const i of indexes) {
          const list = runtime.allies[i].speedMods;
          if (effect.nonStacking && list.some(x => x.enemyEffectKey === `${skill.name}:${effect.type}`)) continue;
          addTimedMod(list, { ...effect, type: 'allySpeedDebuff', mode: 'mult' }, ++runtime.seq);
          list[list.length - 1].enemyEffectKey = `${skill.name}:${effect.type}`;
        }
      } else if (effect.type === 'progressiveStatDecay') {
        for (const i of indexes) applyProgressiveStatDecay(runtime.allies[i], effect.stat, effect.factor);
      } else if (effect.type === 'allyReelShift') {
        queueAllyReelShift(runtime, indexes, effect.amount);
      } else if (effect.type === 'damageTakenUp') {
        for (const i of indexes) addTimedMod(runtime.allies[i].damageTakenMods, { ...effect, type: 'damageTakenUp', mode: 'mult' }, ++runtime.seq);
      } else if (effect.type === 'statusVulnerability') {
        for (const i of indexes) addPointTimed(runtime.allies[i].statusVulnerabilityMods, effect, ++runtime.seq);
      } else if (effect.type === 'purgeBeneficial') {
        for (const i of indexes) purgeBeneficialAllyEffects(runtime.allies[i]);
      } else if (effect.type === 'purgeOffensiveBeneficial') {
        for (const i of indexes) purgeOffensiveBeneficialAllyEffects(runtime.allies[i]);
      } else if (effect.type === 'fireTeamReelShift') {
        // 〖火に油を注ぐ〗: 敵味方を問わず火属性モンスターのリールを+3する。
        // BOSS/お供の現在リールは scenario 側で保持しているため、ここでは次の保存時に反映する予約値を積む。
        const amount = Math.trunc(Number(effect.amount ?? 0) || 0);
        if (amount) {
          if (String(runtime.enemy?.attribute ?? '') === 'fire') {
            runtime.enemy.pendingReelShift = Number(runtime.enemy.pendingReelShift ?? 0) + amount;
          }
          runtime.pendingCompanionReelShifts ??= {};
          for (let companionIndex = 0; companionIndex < (runtime.companions?.length ?? 0); companionIndex++) {
            const companion = runtime.companions[companionIndex];
            if (!companion || companion.active === false) continue;
            const profile = enemyCompanionProfile(companion.name ?? '');
            if (String(profile?.attribute ?? '') !== 'fire') continue;
            runtime.pendingCompanionReelShifts[companionIndex] = Number(runtime.pendingCompanionReelShifts[companionIndex] ?? 0) + amount;
          }
        }
      } else if (effect.type === 'barbadosWater') {
        // 2ターン攻撃×2・素早さ×1/2、重ね掛け可。撃破率に影響する速度だけを追跡する。
        // 2回目は速度0、効果中3回目は速度変化を解除。3回目の自己睡眠は現行BOSS状態モデル外。
        const key = 'バルバドスの水:速度';
        runtime.enemy.speedMods = (runtime.enemy.speedMods ?? []).filter(x => x.enemyEffectKey !== key);
        const stack = Math.max(0, Math.min(2, Number(runtime.enemy.barbadosWaterStack ?? 0) || 0));
        if (stack < 2) {
          runtime.enemy.speedMods.push({
            mode:'mult', value: stack === 0 ? 50 : 0, remaining:2, justApplied:true,
            seq:++runtime.seq, enemyEffectKey:key
          });
          runtime.enemy.barbadosWaterStack = stack + 1;
        } else {
          runtime.enemy.barbadosWaterStack = 0;
        }
      } else if (effect.type === 'enemyMaxHpAdd') {
        const value = Math.max(0, Math.trunc(Number(effect.value ?? 0) || 0));
        runtime.maxHp = Math.max(1, Number(runtime.maxHp ?? 1) + value);
      } else if (effect.type === 'enemyPermanentAttackAdd') {
        runtime.enemy.flatAttackBonus = Number(runtime.enemy.flatAttackBonus ?? 0) + (Number(effect.value ?? 0) || 0);
      } else if (effect.type === 'enemyAtkBuff') {
        const normalized = { ...effect, type:'enemyAtkBuff' };
        if (effect.scope === 'enemyTeam') addEnemyTeamAttackMod(runtime, normalized, `${skill.name}:${effect.type}`);
        else addOrRefreshEnemyStatMod(runtime.enemy.attackMods, normalized, ++runtime.seq, `${skill.name}:${effect.type}`);
      } else if (effect.type === 'enemyTeamAttackBuffByCount') {
        const count = Math.max(1, Math.min(3, 1 + activeEnemyCompanionIndexes(runtime).length));
        const value = Number(effect.values?.[count] ?? effect.values?.[String(count)] ?? 0) || 0;
        if (value) addEnemyTeamAttackMod(runtime, {
          type:'enemyAtkBuff', mode:'add', value, duration:effect.duration ?? 99,
          nonStacking:true, stackKey:String(effect.stackKey ?? `${skill.name}:攻撃`)
        }, `${skill.name}:enemyTeamAttackBuffByCount`);
      } else if (effect.type === 'enemySpeedBuff') {
        addOrRefreshEnemyStatMod(runtime.enemy.speedMods, { ...effect, type:'enemySpeedBuff' }, ++runtime.seq, `${skill.name}:${effect.type}`);
      } else if (effect.type === 'enemyStatusAvoid') {
        runtime.enemy.statusAvoidMods ??= [];
        addOrRefreshPointTimed(runtime.enemy.statusAvoidMods, effect, ++runtime.seq, `${skill.name}:${effect.type}`);
      } else if (effect.type === 'bossSpeedGrow') {
        const value = Number(effect.value ?? 0) || 0;
        runtime.enemy.flatSpeedBonus = Number(runtime.enemy.flatSpeedBonus ?? 0) + value;
        if (value) runtime.enemy.postActionSpeedGain = value;
      } else if (effect.type === 'companionSpeedGrow') {
        const value = Number(effect.value ?? 0) || 0;
        for (const companion of runtime.companions ?? []) {
          if (companion?.active === false || companionIsOffField(companion)) continue;
          companion.flatSpeedBonus = Number(companion.flatSpeedBonus ?? 0) + value;
          if (value) companion.postActionSpeedGain = value;
        }
      } else if (effect.type === 'companionPermanentStats') {
        const names = new Set((effect.names ?? []).map(x => String(x ?? '').trim()).filter(Boolean));
        const key = String(effect.nonStackingKey ?? `${skill.name}:${effect.type}`);
        const attack = Number(effect.attack ?? 0) || 0;
        const speed = Number(effect.speed ?? 0) || 0;
        const maxHpAdd = Math.max(0, Math.trunc(Number(effect.maxHp ?? 0) || 0));
        for (const companion of runtime.companions ?? []) {
          if (companion?.active === false || companionIsOffField(companion) || !names.has(String(companion?.name ?? '').trim())) continue;
          companion.permanentBuffKeys ??= [];
          if (key && companion.permanentBuffKeys.includes(key)) continue;
          companion.flatAttackBonus = Number(companion.flatAttackBonus ?? 0) + attack;
          companion.flatSpeedBonus = Number(companion.flatSpeedBonus ?? 0) + speed;
          if (maxHpAdd > 0 && Number.isInteger(companion.hpSlot)) {
            companion.maxHp = Math.max(1, Number(companion.maxHp ?? 1) + maxHpAdd);
            branch.hpDist = addEnemyHpSlotDistribution(branch.hpDist, companion.hpSlot, maxHpAdd, companion.maxHp);
          }
          if (key) companion.permanentBuffKeys.push(key);
        }
      } else if (effect.type === 'enemyDefenseBuff' || effect.type === 'enemyDefenseDebuff' || effect.type === 'enemyCounterGuard') {
        const normalized = { ...effect, type:effect.type };
        if (effect.scope === 'enemyTeam') addEnemyTeamDefenseMod(runtime, normalized, `${skill.name}:${effect.type}`);
        else addEnemyDefenseMod(runtime.enemy.defenseMods, normalized, ++runtime.seq, `${skill.name}:${effect.type}`);
      } else if (effect.type === 'enemyBlessing') {
        const duration = Math.max(1, Number(effect.duration ?? 3) || 3);
        runtime.enemy.blessingMods ??= [];
        runtime.enemy.blessingMods.push({ mode:effect.mode ?? 'attackPercent', value:Number(effect.value ?? 30) || 0, remaining:duration, justApplied:false, seq:++runtime.seq });
      } else if (effect.type === 'enemyPostActionAttackGain') {
        runtime.enemy.postActionAttackGain = Number(effect.value ?? 0) || 0;
      } else if (effect.type === 'enemyStatusCure') {
        // 現在BOSS側で追跡している有害状態は毒／猛毒。
        runtime.enemy.poison = 'none';
      } else if (effect.type === 'summonCompanion') {
        const added = summonEnemyCompanion(runtime, effect);
        if (added.length) branch.hpDist = appendEnemyHpSlots(branch.hpDist, added.map(index => runtime.companions[index]?.maxHp ?? 0));
      } else if (effect.type === 'consumeCompanions') {
        const names = new Set((effect.names ?? []).map(x => String(x ?? '').trim()).filter(Boolean));
        for (const companion of runtime.companions ?? []) {
          if (companion?.active === false) continue;
          if (!names.has(String(companion?.name ?? '').trim())) continue;
          companion.active = false;
          companion.revivable = false;
          companion.deathSeq = null;
          if (Number.isInteger(companion.hpSlot)) branch.hpDist = setEnemyHpSlotDistribution(branch.hpDist, companion.hpSlot, 0);
        }
      }
    }
    current = mergeRuntimeBranches(current);
  }
  for (const branch of current) {
    delete branch.runtime.enemyLastTarget;
    delete branch.runtime.enemyDamagedTargets;
    delete branch.runtime.enemyHitStatusTargets;
  }
  return current;
}


function effectUsesAttackTarget(skill, effect) {
  const target = effect?.target ?? skill?.target ?? 'all';
  return target === 'random' || target === 'damaged';
}

// 敵から味方へのダメージ量そのものは追跡しない。
// v0.5.26以降、追加効果のない「ダメージだけの攻撃」は物理攻撃でも完全に無視する。
// 状態異常など撃破確率に関係する付随効果がある攻撃だけ、対象と必要な被弾時状態を保持する。
function executeEnemyAttackImpactOnly(runtime, enemyHpDist, skill) {
  const relevantEffects = (skill.effects ?? []).filter(effect => !(effect?.type === 'status' && (effect.status === 'poison' || effect.status === 'deadlyPoison')));
  const activeIndexes = enemyTargetIndexes(runtime, skill.target ?? 'random');
  if (!activeIndexes.length) return [{ runtime, hpDist: enemyHpDist }];

  const physical = skill.attackType === 'physical';
  const needsWakeTarget = physical && activeIndexes.some(i => Boolean(runtime.allies[i]?.statuses?.sleep));
  const needsDamagedTargets = relevantEffects.some(effect => (effect?.target ?? '') === 'damaged');
  const needsRandomTarget = relevantEffects.some(effect => effectUsesAttackTarget(skill, effect));
  const hitChoices = enemyHitCountChoices(skill);

  // プレイヤー側EXは、敵攻撃の被弾回数を「1ヒット=+1」として追跡する。
  // 純粋な敵ダメージ量自体は従来どおり計算しないが、〖ぬすむ〗が後続する場合に
  // 正しいEX残量を参照できるよう、追加効果のない攻撃もここでは被弾数だけ保持する。
  if (skill.target === 'randomEachHit') {
    const out = [];
    for (const choice of hitChoices) {
      // 追加効果がなく、睡眠解除などの対象追跡も不要なら対象分岐は省略できる。
      if (!needsWakeTarget && !needsDamagedTargets && !needsRandomTarget) {
        const rt = cloneRuntimeState(runtime);
        addPlayerEx(rt, playerExGainFromEnemyAttack(choice.hits, 'randomEachHit', activeIndexes.length));
        out.push({ runtime: rt, hpDist: scaleDistribution(enemyHpDist, choice.probability) });
        continue;
      }

      let local = [{ runtime: cloneRuntimeState(runtime), hpDist: scaleDistribution(enemyHpDist, choice.probability) }];
      for (let hit = 0; hit < choice.hits; hit++) {
        const next = [];
        for (const branch of local) {
          const targets = enemyTargetIndexes(branch.runtime, 'random');
          if (!targets.length) { next.push(branch); continue; }
          for (const allyIndex of targets) {
            const rt = cloneRuntimeState(branch.runtime);
            addPlayerEx(rt, 1);
            if (physical && rt.allies[allyIndex]?.statuses?.sleep) markEnemyHitStatus(rt, allyIndex, 'sleep');
            if (physical) wakeFromPhysicalHit(rt.allies[allyIndex]);
            if (needsDamagedTargets) markEnemyDamagedTarget(rt, allyIndex);
            next.push({ runtime: rt, hpDist: scaleDistribution(branch.hpDist, 1 / targets.length) });
          }
        }
        local = mergeRuntimeBranches(next);
      }
      out.push(...local);
    }
    return mergeRuntimeBranches(out);
  }

  if (skill.target === 'random') {
    const out = [];
    for (const choice of hitChoices) {
      if (!needsWakeTarget && !needsRandomTarget && !needsDamagedTargets) {
        const rt = cloneRuntimeState(runtime);
        addPlayerEx(rt, playerExGainFromEnemyAttack(choice.hits, 'random', activeIndexes.length));
        out.push({ runtime:rt, hpDist:scaleDistribution(enemyHpDist, choice.probability) });
        continue;
      }
      for (const allyIndex of activeIndexes) {
        const rt = cloneRuntimeState(runtime);
        addPlayerEx(rt, playerExGainFromEnemyAttack(choice.hits, 'random', activeIndexes.length));
        rt.enemyLastTarget = allyIndex;
        if (physical && rt.allies[allyIndex]?.statuses?.sleep) markEnemyHitStatus(rt, allyIndex, 'sleep');
        if (physical) wakeFromPhysicalHit(rt.allies[allyIndex]);
        if (needsDamagedTargets) markEnemyDamagedTarget(rt, allyIndex);
        out.push({ runtime: rt, hpDist: scaleDistribution(enemyHpDist, choice.probability / activeIndexes.length) });
      }
    }
    return mergeRuntimeBranches(out);
  }

  // 全体攻撃など。各ヒットが生存中の対象全員へ当たるため、被弾数は hits×対象数。
  const out = [];
  for (const choice of hitChoices) {
    const rt = cloneRuntimeState(runtime);
    addPlayerEx(rt, playerExGainFromEnemyAttack(choice.hits, 'all', activeIndexes.length));
    if (physical) {
      for (const allyIndex of activeIndexes) {
        if (rt.allies[allyIndex]?.statuses?.sleep) markEnemyHitStatus(rt, allyIndex, 'sleep');
        wakeFromPhysicalHit(rt.allies[allyIndex]);
      }
    }
    if (needsDamagedTargets) for (const allyIndex of activeIndexes) markEnemyDamagedTarget(rt, allyIndex);
    out.push({ runtime:rt, hpDist:scaleDistribution(enemyHpDist, choice.probability) });
  }
  return mergeRuntimeBranches(out);
}

function enemyHitCountChoices(skill) {
  if (skill?.hitsMin != null || skill?.hitsMax != null) {
    const min = Math.max(1, Math.floor(Number(skill.hitsMin ?? skill.hitsMax ?? 1) || 1));
    const max = Math.max(min, Math.floor(Number(skill.hitsMax ?? skill.hitsMin ?? min) || min));
    const probability = 1 / (max - min + 1);
    return Array.from({ length: max - min + 1 }, (_, i) => ({ hits: min + i, probability }));
  }
  return [{ hits: Math.max(1, Math.floor(Number(skill?.hits ?? 1) || 1)), probability: 1 }];
}

function applyGuaranteedTargetDebuffs(runtime, allyIndex, skillName) {
  const ally = runtime.allies[allyIndex];
  if (!ally) return;
  const atkList = ally.attackMods;
  const atkKey = `${skillName}:allyAtkDebuff`;
  if (!atkList.some(x => x.enemyEffectKey === atkKey)) {
    addTimedMod(atkList, { type:'allyAtkDebuff', value:15, duration:3, nonStacking:true }, ++runtime.seq);
    atkList[atkList.length - 1].enemyEffectKey = atkKey;
  }
  addTimedMod(ally.damageTakenMods, { type:'damageTakenUp', value:15, duration:3, mode:'mult' }, ++runtime.seq);
}

function statusAttemptBranches(branch, allyIndex, effect, skill) {
  const ally = branch.runtime.allies[allyIndex];
  if (!ally || ally.active === false) return { hit:[], miss:[branch] };
  if (effect?.status === 'brainwash' && branch.runtime.allies.filter(x => x?.active !== false).length <= 1) return { hit:[], miss:[branch] };
  const chance = adjustedStatusChance(ally, effect, skill) / 100;
  if (chance <= 0) return { hit:[], miss:[branch] };
  if (chance >= 1) {
    const rt = cloneRuntimeState(branch.runtime);
    inflictStatus(rt.allies[allyIndex], effect);
    return { hit:[{ runtime:rt, hpDist:new Map(branch.hpDist) }], miss:[] };
  }
  const hitRt = cloneRuntimeState(branch.runtime);
  inflictStatus(hitRt.allies[allyIndex], effect);
  return {
    hit:[{ runtime:hitRt, hpDist:scaleDistribution(branch.hpDist, chance) }],
    miss:[{ runtime:cloneRuntimeState(branch.runtime), hpDist:scaleDistribution(branch.hpDist, 1 - chance) }]
  };
}

function executeIceBindSkill(runtime, enemyHpDist, skill) {
  const targets = enemyTargetIndexes(runtime, 'random');
  if (!targets.length) return [{ runtime, hpDist:enemyHpDist }];
  const out = [];
  for (const allyIndex of targets) {
    const baseRt = cloneRuntimeState(runtime);
    applyGuaranteedTargetDebuffs(baseRt, allyIndex, skill.name);
    const branch = { runtime:baseRt, hpDist:scaleDistribution(enemyHpDist, 1 / targets.length) };
    const isFire = String(baseRt.allies[allyIndex]?.attribute ?? '') === 'fire';
    if (!isFire) {
      const attempt = statusAttemptBranches(branch, allyIndex, { type:'status', status:'paralysis', chance:50, duration:1 }, skill);
      out.push(...attempt.hit, ...attempt.miss);
      continue;
    }
    // 現行内部データ: 火属性には30%で2ターン麻痺。失敗枝だけさらに50%で通常麻痺。
    const first = statusAttemptBranches(branch, allyIndex, { type:'status', status:'paralysis', chance:30, duration:2 }, skill);
    out.push(...first.hit);
    for (const miss of first.miss) {
      const second = statusAttemptBranches(miss, allyIndex, { type:'status', status:'paralysis', chance:50, duration:1 }, skill);
      out.push(...second.hit, ...second.miss);
    }
  }
  return mergeRuntimeBranches(out);
}

function executeOroshiIllusionSkill(runtime, enemyHpDist, skill) {
  const targets = enemyTargetIndexes(runtime, 'random');
  if (!targets.length) return [{ runtime, hpDist:enemyHpDist }];
  const out = [];
  for (const allyIndex of targets) {
    const rt = cloneRuntimeState(runtime);
    const weighted = scaleDistribution(enemyHpDist, 1 / targets.length);
    // 自身の+10%脆弱化で同じ技の洗脳率まで上げないよう、洗脳判定を先に行う。
    const attempt = statusAttemptBranches({ runtime:rt, hpDist:weighted }, allyIndex, { type:'status', status:'brainwash', chance:100, duration:1 }, skill);
    for (const branch of [...attempt.hit, ...attempt.miss]) {
      addPointTimed(branch.runtime.allies[allyIndex].statusVulnerabilityMods, { value:10, duration:3 }, ++branch.runtime.seq);
      out.push(branch);
    }
  }
  return mergeRuntimeBranches(out);
}

function executeStareVoiceSkill(runtime, enemyHpDist, skill) {
  const targets = enemyTargetIndexes(runtime, 'random');
  if (!targets.length) return [{ runtime, hpDist:enemyHpDist }];
  const out = [];
  for (const allyIndex of targets) {
    const rt = cloneRuntimeState(runtime);
    const weighted = scaleDistribution(enemyHpDist, 1 / targets.length);
    const attempt = statusAttemptBranches(
      { runtime:rt, hpDist:weighted }, allyIndex,
      { type:'status', status:'brainwash', chance:100, duration:1 }, skill
    );
    for (const branch of attempt.hit) {
      // 洗脳成功時のみ、対象側にも2ターン攻撃+5。
      addTimedMod(branch.runtime.allies[allyIndex].attackMods, { type:'atkBuff', mode:'add', value:5, duration:2 }, ++branch.runtime.seq);
      out.push(branch);
    }
    out.push(...attempt.miss);
  }
  return mergeRuntimeBranches(out);
}

// 吸血系。敵から味方へのHPダメージ自体は追跡しないが、回復量が与ダメージ依存のため
// ダメージ分布をBOSS HP回復量へ変換する用途に限って計算する。
function executeEnemyLifestealSkill(runtime, enemyHpDist, skill) {
  const targets = enemyTargetIndexes(runtime, skill.target ?? 'random');
  if (!targets.length) return [{ runtime, hpDist:enemyHpDist }];

  const actingCompanionIndex = Number(runtime.actingCompanionIndex);
  const actingCompanion = Number.isInteger(actingCompanionIndex) ? runtime.companions?.[actingCompanionIndex] : null;
  const attacker = actingCompanion && actingCompanion.active !== false ? actingCompanion : runtime.enemy;
  const attack = applyMods(
    Number(attacker.baseAttack ?? 0) + Number(attacker.flatAttackBonus ?? 0),
    attacker.attackMods,
    { clampMin:0, clampMax:999 }
  );
  const healRate = Math.max(0, Number(skill.healRate ?? 0) || 0);

  const healDistributionFor = ally => {
    const damageDist = attackDamageDistribution({
      attack, speed:0,
      skillMultiplier:String(skill.multiplier ?? 100),
      attackAttribute:skill.attributes?.[0] ?? 'none',
      attackAttribute2:skill.attributes?.[1] ?? 'none',
      attackAttributes:Array.isArray(skill.attributes) ? skill.attributes : undefined,
      defenderAttribute:String(ally.attribute ?? 'none'),
      defenderRace:normalizeEnemyRace(ally.race ?? 'normal'),
      attackType:skill.attackType ?? 'physical',
      defenseMods:[], weaknessBoost:false, hits:'1', hitsMin:'', hitsMax:''
    });
    const healDist = new Map();
    for (const [damage, probability] of damageDist) {
      const heal = trunc0(Number(damage) * healRate / 100);
      healDist.set(heal, (healDist.get(heal) ?? 0) + probability);
    }
    return healDist;
  };

  // 全体吸収は各対象への与ダメージから得た回復量を合計する。
  if (skill.target === 'all') {
    const rt = cloneRuntimeState(runtime);
    addPlayerEx(rt, playerExGainFromEnemyAttack(1, 'all', targets.length));
    let totalHealDist = new Map([[0, 1]]);
    for (const allyIndex of targets) {
      const ally = rt.allies[allyIndex];
      if (!ally || ally.active === false) continue;
      if (skill.attackType === 'physical') wakeFromPhysicalHit(ally);
      totalHealDist = convolveDamage(totalHealDist, healDistributionFor(ally));
    }
    const nextHp = applyEnemyActorHealDistribution(rt, enemyHpDist, totalHealDist);
    return [{ runtime:rt, hpDist:nextHp }];
  }

  const out = [];
  for (const allyIndex of targets) {
    const rt = cloneRuntimeState(runtime);
    addPlayerEx(rt, playerExGainFromEnemyAttack(1, 'random', targets.length));
    const ally = rt.allies[allyIndex];
    if (!ally || ally.active === false) continue;
    // 物理攻撃なので、睡眠中の対象へ命中した場合は通常の敵攻撃と同様に起こす。
    if (skill.attackType === 'physical') wakeFromPhysicalHit(ally);
    const healDist = healDistributionFor(ally);
    const weightedHpDist = scaleDistribution(enemyHpDist, 1 / targets.length);
    const nextHp = applyEnemyActorHealDistribution(rt, weightedHpDist, healDist);
    out.push({ runtime:rt, hpDist:nextHp });
  }
  return mergeRuntimeBranches(out);
}

// 〖フォーリン・ダウン〗はリーダーを除く1体だけをランダムに選び、成功時は次のBOSS行動を召喚に固定する。
function executeFallingDownSkill(runtime, enemyHpDist, skill) {
  const targets = enemyTargetIndexes(runtime, 'random').filter(i => i !== 0);
  if (!targets.length) return [{ runtime, hpDist:enemyHpDist }];
  const out = [];
  for (const allyIndex of targets) {
    const weighted = scaleDistribution(enemyHpDist, 1 / targets.length);
    const ally = runtime.allies[allyIndex];
    const effect = { type:'instantDeath', status:'instantDeath', chance:skill.chance ?? 55, immuneRaces:skill.immuneRaces ?? [] };
    const chance = adjustedStatusChance(ally, effect, skill) / 100;
    if (chance <= 0) {
      out.push({ runtime:cloneRuntimeState(runtime), hpDist:weighted });
      continue;
    }
    if (chance < 1) out.push({ runtime:cloneRuntimeState(runtime), hpDist:scaleDistribution(weighted, 1 - chance) });
    const hitRt = cloneRuntimeState(runtime);
    hitRt.allies[allyIndex].active = false;
    hitRt.allies[allyIndex].inactiveReason = 'instantDeath';
    hitRt.enemy.fallingDownSummonPending = true;
    out.push({ runtime:hitRt, hpDist:scaleDistribution(weighted, chance) });
  }
  return mergeRuntimeBranches(out);
}

function executeEnemyChargeSkill(runtime, enemyHpDist, skill) {
  const out = [];
  const defenseValue = Math.max(0, Number(skill?.defenseValue ?? 0) || 0);
  const breakDamagePercent = Math.max(0, Number(skill?.breakDamagePercent ?? 50) || 0);
  const key = String(skill?.name ?? 'enemyCharge');
  const defenseKey = `enemyCharge:${key}:defense`;
  const breakDamage = Math.max(1, trunc0(runtime.maxHp * breakDamagePercent / 100));

  // 溜め開始時HPが異なる確率枝を分離して保持する。これにより「開始後に受けた合計ダメージ」で解除できる。
  for (const [hp, probability] of enemyHpDist) {
    if (probability <= 0) continue;
    const rt = cloneRuntimeState(runtime);
    if (hp > 0) {
      rt.enemy.charge = { key, startHp:hp, breakDamage, defenseKey };
      if (defenseValue > 0) {
        addEnemyDefenseMod(rt.enemy.defenseMods, {
          type:'enemyDefenseBuff', value:defenseValue, duration:99, nonStacking:true, stackKey:defenseKey
        }, ++rt.seq, defenseKey);
      }
    }
    out.push({ runtime:rt, hpDist:new Map([[hp, probability]]) });
  }
  return mergeRuntimeBranches(out);
}

// 〖すいこみ〗等、通常の状態異常回避では防げない「場から外れて行動不能」を扱う。
// 相手が1体だけの場合は不発。対象は等確率で1体を選び、使用者がお供なら同じ2行動機会ぶん使用者も拘束する。
function executeConsumeCompanionHealBuffSkill(runtime, enemyHpDist, skill) {
  const names = new Set((skill.companionNames ?? []).map(x => String(x ?? '').trim()).filter(Boolean));
  const index = (runtime.companions ?? []).findIndex(x => x?.active !== false && names.has(String(x?.name ?? '').trim()));
  if (index < 0) return [{ runtime, hpDist:enemyHpDist }];

  // 〖フードをたべる〗は1体だけを生贄にする。消費したお供は蘇生対象にならないため inactive 化する。
  const consumed = runtime.companions[index];
  consumed.active = false;
  consumed.revivable = false;
  consumed.deathSeq = null;
  let hpDist = Number.isInteger(consumed.hpSlot)
    ? setEnemyHpSlotDistribution(enemyHpDist, consumed.hpSlot, 0)
    : enemyHpDist;
  const healValue = Math.max(0, Number(skill.healValue ?? 0) || 0);
  hpDist = mapBossHpDistribution(runtime, hpDist, hp => Math.min(runtime.maxHp, hp + trunc0(healValue)));
  const attackAdd = Number(skill.attackAdd ?? 0) || 0;
  if (attackAdd) {
    addOrRefreshEnemyStatMod(runtime.enemy.attackMods, { mode:'add', value:attackAdd, duration:99 }, ++runtime.seq, `${skill.name}:attackAdd`);
  }
  return [{ runtime, hpDist }];
}

function executeEnemyActionLockSkill(runtime, enemyHpDist, skill) {
  const targets = enemyTargetIndexes(runtime, skill.target ?? 'random');
  const minimum = Math.max(1, Number(skill.minimumActiveTargets ?? 1) || 1);
  if (targets.length < minimum) return [{ runtime, hpDist:enemyHpDist }];
  const duration = Math.max(1, Number(skill.duration ?? 1) || 1);
  const sourceIndex = Number.isInteger(runtime.actingCompanionIndex) ? runtime.actingCompanionIndex : null;
  const out = [];
  for (const allyIndex of targets) {
    const rt = cloneRuntimeState(runtime);
    rt.allies[allyIndex].actionLockRemaining = Math.max(Number(rt.allies[allyIndex].actionLockRemaining ?? 0), duration);
    if (skill.lockSource && sourceIndex != null && rt.companions?.[sourceIndex]?.active !== false) {
      rt.companions[sourceIndex].actionLockRemaining = Math.max(Number(rt.companions[sourceIndex].actionLockRemaining ?? 0), duration);
    }
    out.push({ runtime:rt, hpDist:scaleDistribution(enemyHpDist, 1 / targets.length) });
  }
  return mergeRuntimeBranches(out);
}

function executeEnemyDanceSkill(runtime, enemyHpDist, skill) {
  const wasDancing = Boolean(runtime.enemy?.danceActive);
  let branches = [{ runtime, hpDist:enemyHpDist }];
  if (skill.danceType === 'life') {
    const heal = Math.max(0, Number(wasDancing ? skill.healEnhanced : skill.healNormal) || 0);
    if (heal > 0 && skill.target === 'enemySingle') {
      branches = healEnemySingleBranches(runtime, enemyHpDist, heal, false);
    } else if (heal > 0) {
      branches = branches.map(branch => ({ runtime:branch.runtime, hpDist:mapBossHpDistribution(branch.runtime, branch.hpDist, hp => Math.min(branch.runtime.maxHp, hp + trunc0(heal))) }));
    }
  }
  for (const branch of branches) {
    branch.runtime.enemy.danceActive = true;
    if (skill.danceType === 'life' && wasDancing && Number(skill.blessingFlat ?? 0) > 0) {
      branch.runtime.enemy.blessingMods ??= [];
      const key = `${skill.name}:加護`;
      const existing = branch.runtime.enemy.blessingMods.find(x => x.enemyEffectKey === key);
      const next = {
        mode:'flat', value:Number(skill.blessingFlat), remaining:99, justApplied:false,
        seq:++branch.runtime.seq, enemyEffectKey:key
      };
      if (existing) Object.assign(existing, next);
      else branch.runtime.enemy.blessingMods.push(next);
    }
  }
  return mergeRuntimeBranches(branches);
}

function companionSingleTargetBranches(runtime, enemyHpDist, handler) {
  const candidates = activeEnemyCompanionIndexes(runtime);
  if (!candidates.length) return [{ runtime, hpDist:enemyHpDist }];
  const weight = 1 / candidates.length;
  const out = [];
  for (const companionIndex of candidates) {
    const rt = cloneRuntimeState(runtime);
    const hpDist = scaleDistribution(enemyHpDist, weight);
    out.push(...handler(rt, hpDist, companionIndex));
  }
  return mergeRuntimeBranches(out);
}

function executeCompanionHealCureSleepSkill(runtime, enemyHpDist, skill) {
  const amount = Math.max(0, trunc0(Number(skill?.value ?? 0) || 0));
  // 〖エナジーフィール〗の「味方1体」は自身も対象になり得る。
  // CPUの味方単体対象選択は完全ランダムとして、BOSS自身+生存お供を等確率で分岐する。
  const candidates = [-1, ...activeEnemyCompanionIndexes(runtime)];
  const weight = 1 / candidates.length;
  const out = [];
  for (const target of candidates) {
    const rt = cloneRuntimeState(runtime);
    let hpDist = scaleDistribution(enemyHpDist, weight);
    if (target < 0) {
      if (amount > 0) hpDist = mapBossHpDistribution(rt, hpDist, hp => Math.min(rt.maxHp, hp + amount));
    } else {
      const companion = rt.companions?.[target];
      if (companion && companion.active !== false) {
        clearCompanionSleep(companion);
        if (amount > 0 && Number.isInteger(companion.hpSlot)) {
          hpDist = addEnemyHpSlotDistribution(hpDist, companion.hpSlot, amount, Math.max(1, Number(companion.maxHp ?? 1)));
        }
      }
    }
    out.push({ runtime:rt, hpDist });
  }
  return mergeRuntimeBranches(out);
}

function executeCompanionDisciplineSkill(runtime, enemyHpDist, skill) {
  return companionSingleTargetBranches(runtime, enemyHpDist, (rt, hpDist, companionIndex) => {
    const companion = rt.companions?.[companionIndex];
    if (!companion || companion.active === false) return [{ runtime:rt, hpDist }];

    // 〖魔将の教鞭〗は「攻撃を受けたぶんの+1」を含め、ガープ以外の生存味方数に応じてEXが増える。
    addEnemyEx(rt, activeEnemyCompanionIndexes(rt).length + 1);

    const attack = applyMods(
      Number(rt.enemy.baseAttack ?? 0) + Number(rt.enemy.flatAttackBonus ?? 0),
      rt.enemy.attackMods ?? [],
      { clampMin:0, clampMax:999 }
    );
    const damageDist = attackDamageDistribution({
      attack, speed:0,
      skillMultiplier:String(skill?.multiplier ?? 10),
      attackAttribute:skill?.attributes?.[0] ?? 'none',
      attackAttribute2:skill?.attributes?.[1] ?? 'none',
      attackAttributes:Array.isArray(skill?.attributes) ? skill.attributes : undefined,
      defenderAttribute:String(companion.attribute ?? 'none'),
      defenderRace:normalizeEnemyRace(companion.race ?? 'normal'),
      attackType:'physical',
      defenseMods:applicableDefenseMods(companion.defenseMods ?? [], 'physical', attackAttributesFromConfig({
        attackAttribute:skill?.attributes?.[0] ?? 'none',
        attackAttribute2:skill?.attributes?.[1] ?? 'none',
        attackAttributes:Array.isArray(skill?.attributes) ? skill.attributes : undefined
      })),
      weaknessBoost:false, hits:'1', hitsMin:'', hitsMax:''
    });
    if (Number.isInteger(companion.hpSlot)) hpDist = damageEnemyHpSlotDistribution(hpDist, companion.hpSlot, damageDist);
    // 物理攻撃を受けた時点で睡眠解除。教鞭で撃破された確率枝は、その後のお供行動から除外する。
    clearCompanionSleep(companion);
    return branchRuntimeByCompanionAliveMask(rt, hpDist);
  });
}


function executeCompanionSleepBlessingSkill(runtime, enemyHpDist, skill) {
  const companionIndex = Number(runtime.actingCompanionIndex);
  const companion = Number.isInteger(companionIndex) ? runtime.companions?.[companionIndex] : null;
  if (!companion || companion.active === false) return [{ runtime, hpDist:enemyHpDist }];

  // 〖寝る〗の加護回復量は「発動時の攻撃力」と同値で、その後は固定。
  const attack = applyMods(
    Number(companion.baseAttack ?? 0) + Number(companion.flatAttackBonus ?? 0),
    companion.attackMods ?? [],
    { clampMin:0, clampMax:999 }
  );
  const amount = Math.max(0, trunc0(attack));
  companion.statuses ??= {};
  companion.statuses.sleep = {
    // 発動ターンを1ターン目と数える。次の3行動機会は睡眠継続、4回目（通算5ターン目）に自動起床。
    remaining:Math.max(1, Math.trunc(Number(skill?.sleepRemainingAfterCast ?? 4) || 4))
  };
  companion.sleepBlessing = { amount };

  let hpDist = enemyHpDist;
  if (amount > 0 && Number.isInteger(companion.hpSlot)) {
    hpDist = addEnemyHpSlotDistribution(hpDist, companion.hpSlot, amount, Math.max(1, Number(companion.maxHp ?? 1)));
  }
  return [{ runtime, hpDist }];
}

function executeCompanionExcursionHealSkill(runtime, enemyHpDist, skill) {
  const companionIndex = Number(runtime.actingCompanionIndex);
  const companion = Number.isInteger(companionIndex) ? runtime.companions?.[companionIndex] : null;
  if (!companion || companion.active === false) return [{ runtime, hpDist:enemyHpDist }];
  companion.excursion = {
    active:true,
    healValue:Math.max(0, Math.trunc(Number(skill?.healValue ?? 100) || 0))
  };
  return [{ runtime, hpDist:enemyHpDist }];
}


function bossFriendlyFireDamageDistribution(runtime, skill, companion) {
  const attack = applyMods(
    Number(runtime?.enemy?.baseAttack ?? 0) + Number(runtime?.enemy?.flatAttackBonus ?? 0),
    runtime?.enemy?.attackMods ?? [],
    { clampMin:0, clampMax:999 }
  );
  return attackDamageDistribution({
    attack, speed:0,
    skillMultiplier:String(skill?.multiplier ?? 100),
    attackAttribute:skill?.attributes?.[0] ?? 'none',
    attackAttribute2:skill?.attributes?.[1] ?? 'none',
    attackAttributes:Array.isArray(skill?.attributes) ? skill.attributes : undefined,
    defenderAttribute:String(companion?.attribute ?? 'none'),
    defenderRace:normalizeEnemyRace(companion?.race ?? 'normal'),
    attackType:String(skill?.attackType ?? 'magic'),
    defenseMods:applicableDefenseMods(
      companion?.defenseMods ?? [],
      String(skill?.attackType ?? 'magic'),
      attackAttributesFromConfig({
        attackAttribute:skill?.attributes?.[0] ?? 'none',
        attackAttribute2:skill?.attributes?.[1] ?? 'none',
        attackAttributes:Array.isArray(skill?.attributes) ? skill.attributes : undefined
      })
    ),
    weaknessBoost:false, hits:'1', hitsMin:'', hitsMax:''
  });
}

function damageEnemyCompanionByBossBranches(branch, companionIndex, skill, options = {}) {
  const companion = branch.runtime?.companions?.[companionIndex];
  if (!companion || companion.active === false || !Number.isInteger(Number(companion.hpSlot))) return [branch];
  const slot = Number(companion.hpSlot);
  const damageDist = bossFriendlyFireDamageDistribution(branch.runtime, skill, companion);
  const out = [];
  for (const [hp, hpProbability] of branch.hpDist) {
    const parts = enemyHpPartArray(hp);
    const before = Math.max(0, Number(parts[slot] ?? 0));
    if (before <= 0) {
      out.push({ runtime:cloneRuntimeState(branch.runtime), hpDist:new Map([[hp, hpProbability]]) });
      continue;
    }
    for (const [damage, damageProbability] of damageDist) {
      const next = parts.slice();
      next[slot] = Math.max(0, before - Math.max(0, trunc0(damage)));
      let nextHp = multiHpKey(next);
      const rt = cloneRuntimeState(branch.runtime);
      // 自軍のお供が攻撃を受けた場合も敵側共有EXが1増える。退場時はさらに+1。
      addEnemyEx(rt, 1);
      const defeated = before > 0 && next[slot] <= 0;
      if (defeated) addEnemyEx(rt, 1 + Math.max(0, Number(options.extraEnemyExOnKill ?? 0) || 0));
      syncCompanionActivityFromHp(rt, nextHp);
      let hpDist = new Map([[nextHp, hpProbability * damageProbability]]);
      if (defeated && Number(options.healBossByDefeatedMaxHpRate ?? 0) > 0) {
        const heal = trunc0(Math.max(0, Number(companion.maxHp ?? 0)) * Number(options.healBossByDefeatedMaxHpRate) / 100);
        if (heal > 0) hpDist = mapBossHpDistribution(rt, hpDist, bossHp => Math.min(rt.maxHp, bossHp + heal));
      }
      out.push({ runtime:rt, hpDist });
    }
  }
  return mergeRuntimeBranches(out);
}

function executeKujeskaBlackRussianSkill(runtime, enemyHpDist, skill) {
  const playerTargets = enemyTargetIndexes(runtime, 'all').map(index => ({ side:'player', index }));
  const companionTargets = activeEnemyCompanionIndexes(runtime).map(index => ({ side:'enemy', index }));
  const targets = [...playerTargets, ...companionTargets];
  if (!targets.length) return [{ runtime, hpDist:enemyHpDist }];
  const weight = 1 / targets.length;
  const out = [];
  for (const target of targets) {
    const base = { runtime:cloneRuntimeState(runtime), hpDist:scaleDistribution(enemyHpDist, weight) };
    if (target.side === 'player') {
      // プレイヤーHP/KO自体は現行モードの対象外。被弾による共有EX+1だけ保持する。
      addPlayerEx(base.runtime, 1);
      out.push(base);
    } else {
      out.push(...damageEnemyCompanionByBossBranches(base, target.index, skill, { healBossByDefeatedMaxHpRate:30 }));
    }
  }
  return mergeRuntimeBranches(out);
}

function executeKujeskaBloodyMarySkill(runtime, enemyHpDist, skill) {
  // プレイヤー側は全員1ヒット。HP/KOは追跡しないが共有EXは増える。
  const playerHits = enemyTargetIndexes(runtime, 'all').length;
  let branches = [{ runtime:cloneRuntimeState(runtime), hpDist:new Map(enemyHpDist) }];
  if (playerHits > 0) for (const branch of branches) addPlayerEx(branch.runtime, playerHits);

  // 自軍のお供も全員巻き込む。被弾+1、退場+1、技固有の撃破時+1で、撃破時は合計+3。
  const companionIndexes = activeEnemyCompanionIndexes(runtime);
  for (const companionIndex of companionIndexes) {
    branches = branches.flatMap(branch => damageEnemyCompanionByBossBranches(
      branch, companionIndex, skill, { extraEnemyExOnKill:1 }
    ));
  }
  return mergeRuntimeBranches(branches);
}

function executeEnemySkill(runtime, enemyHpDist, state, skill) {
  if (!skill) return [{ runtime, hpDist: enemyHpDist }];
  if (Number(skill.enemyExSpend ?? 0) > 0) spendEnemyEx(runtime, skill.enemyExSpend);
  if (Number(skill.enemyExGain ?? 0) > 0) addEnemyEx(runtime, skill.enemyExGain);
  if (skill.kind === 'iceBind') return executeIceBindSkill(runtime, enemyHpDist, skill);
  if (skill.kind === 'oroshiIllusion') return executeOroshiIllusionSkill(runtime, enemyHpDist, skill);
  if (skill.kind === 'stareVoice') return executeStareVoiceSkill(runtime, enemyHpDist, skill);
  if (skill.kind === 'enemyCharge') return executeEnemyChargeSkill(runtime, enemyHpDist, skill);
  if (skill.kind === 'lifestealAttack') return applyEnemySecondaryEffects(executeEnemyLifestealSkill(runtime, enemyHpDist, skill), skill, state);
  if (skill.kind === 'fallingDown') return executeFallingDownSkill(runtime, enemyHpDist, skill);
  if (skill.kind === 'actionLock') return executeEnemyActionLockSkill(runtime, enemyHpDist, skill);
  if (skill.kind === 'consumeCompanionHealBuff') return executeConsumeCompanionHealBuffSkill(runtime, enemyHpDist, skill);
  if (skill.kind === 'dance') return executeEnemyDanceSkill(runtime, enemyHpDist, skill);
  if (skill.kind === 'companionHealCureSleep') return executeCompanionHealCureSleepSkill(runtime, enemyHpDist, skill);
  if (skill.kind === 'companionDiscipline') return executeCompanionDisciplineSkill(runtime, enemyHpDist, skill);
  if (skill.kind === 'companionSleepBlessing') return executeCompanionSleepBlessingSkill(runtime, enemyHpDist, skill);
  if (skill.kind === 'companionExcursionHeal') return executeCompanionExcursionHealSkill(runtime, enemyHpDist, skill);
  if (skill.kind === 'kujeskaBlackRussian') return executeKujeskaBlackRussianSkill(runtime, enemyHpDist, skill);
  if (skill.kind === 'kujeskaBloodyMary') return executeKujeskaBloodyMarySkill(runtime, enemyHpDist, skill);
  if (skill.kind === 'stealEx') {
    applyEnemyStealEx(runtime);
    return [{ runtime, hpDist: enemyHpDist }];
  }
  let branches = [{ runtime, hpDist: enemyHpDist }];
  const activeIndexes = enemyTargetIndexes(runtime, skill.target ?? 'random');

  // 敵から味方への純粋なダメージ量・KOは計算しない。
  // ただし被弾回数はプレイヤー共有EXへ加算し、状態異常など撃破率へ影響する付随効果も追跡する。
  if (skill.kind === 'attack' && activeIndexes.length) {
    branches = executeEnemyAttackImpactOnly(runtime, enemyHpDist, skill);
  } else if (skill.kind === 'heal') {
    const attack = applyMods(runtime.enemy.baseAttack + Number(runtime.enemy.flatAttackBonus ?? 0), runtime.enemy.attackMods, { clampMin:0, clampMax:999 });
    const amount = skill.attackMultiplier != null ? trunc0(attack * Number(skill.attackMultiplier) / 100) : trunc0(Number(skill.value ?? 0));
    if (skill.target === 'enemyTeam') {
      branches = branches.map(branch => ({ runtime:branch.runtime, hpDist:healEnemyTeamDistribution(branch.runtime, branch.hpDist, amount) }));
    } else if (skill.target === 'enemySingle') {
      const cureStatus = (skill.effects ?? []).some(effect => effect?.type === 'enemyStatusCure');
      branches = branches.flatMap(branch => healEnemySingleBranches(branch.runtime, branch.hpDist, amount, cureStatus, skill.targetRace ?? ''));
      if (cureStatus) skill = { ...skill, effects:(skill.effects ?? []).filter(effect => effect?.type !== 'enemyStatusCure') };
    } else if (skill.target === 'self' && Number.isInteger(Number(runtime.actingCompanionIndex))) {
      branches = branches.map(branch => ({ runtime:branch.runtime, hpDist:healActingCompanionDistribution(branch.runtime, branch.hpDist, amount) }));
    } else {
      branches = branches.map(branch => ({ runtime:branch.runtime, hpDist:mapBossHpDistribution(branch.runtime, branch.hpDist, hp => Math.min(branch.runtime.maxHp, hp + amount)) }));
    }
  }
  // percentHp など味方HPだけを変化させる敵技は、付随する状態・デバフだけ処理する。
  return applyEnemySecondaryEffects(branches, skill, state);
}

function decrementStatusCounter(ally, status) {
  const current = ally.statuses?.[status];
  if (!current) return;
  current.remaining = Math.max(0, Number(current.remaining ?? 1) - 1);
  if (current.remaining <= 0) delete ally.statuses[status];
}

function preActionStatusBlock(runtime, allyIndex) {
  const ally = runtime.allies[allyIndex];
  if (!ally || ally.active === false) return 'inactive';
  if (ally.statuses?.petrification) return 'petrification';
  if (Number(ally.actionLockRemaining ?? 0) > 0) {
    ally.actionLockRemaining = Math.max(0, Number(ally.actionLockRemaining) - 1);
    return 'actionLock';
  }
  if (ally.statuses?.sleep) {
    decrementStatusCounter(ally, 'sleep');
    return 'sleep';
  }
  if (ally.statuses?.paralysis) {
    delete ally.statuses.paralysis;
    return 'paralysis';
  }
  return '';
}

function actionBlockedByStatus(runtime, allyIndex, action, characterId) {
  const ally = runtime.allies[allyIndex];
  if (!ally || ally.active === false) return '';
  const statuses = ally.statuses ?? {};
  const viaChangeMagic = characterId === 'son_goku' || characterId === 'gyumao';
  if (statuses.silence && (viaChangeMagic || action.attackType === 'magic')) return 'silence';
  if (statuses.darkness && action.kind === 'attack' && action.attackType === 'physical') return 'darkness';
  if (statuses.confusion && action.kind === 'attack') return 'confusion';
  if (statuses.brainwash && action.kind !== 'skip') return 'brainwash';
  const looksLikeBreath = action.attackType === 'breath' || /(?:ブレス|いき|息)/.test(String(action.skillName ?? ''));
  if (statuses.cold && looksLikeBreath) return 'cold';
  return '';
}

function finishAllyStatusOpportunity(runtime, allyIndex, rolledAction = true) {
  const ally = runtime.allies[allyIndex];
  if (!ally) return;
  if (rolledAction && ally.statuses?.confusion) delete ally.statuses.confusion;
  decrementStatusCounter(ally, 'brainwash');
  decrementStatusCounter(ally, 'silence');
  decrementStatusCounter(ally, 'darkness');
  decrementStatusCounter(ally, 'cold');
  // 呪いは自分の行動機会終了ごとにカウント。0になった時点で離脱する。
  if (ally.statuses?.curse) {
    ally.statuses.curse.remaining = Math.max(0, Number(ally.statuses.curse.remaining ?? 1) - 1);
    if (ally.statuses.curse.remaining <= 0) {
      delete ally.statuses.curse;
      ally.active = false;
    }
  }
}

function scenarioStatusSummary(scenarios, allyCount) {
  const out = Array.from({ length: allyCount }, () => ({ paralysis: 0, confusion: 0, silence: 0, darkness: 0, sleep: 0, petrification:0, cold:0, brainwash:0, curse:0 }));
  for (const sc of scenarios) {
    const mass = distributionMass(sc.hpDist);
    for (let i = 0; i < allyCount; i++) {
      const ally = sc.runtime.allies[i];
      for (const status of HARMFUL_STATUSES) if (ally?.statuses?.[status]) out[i][status] += mass;
    }
  }
  return out;
}

function effectChanceFraction(effect) {
  if (effect?.chance == null || effect.chance === '') return null;
  return parseNumber(effect.chance, '追加効果確率', { min: 0, max: 100 }) / 100;
}

function enemyUnitStatusAvoid(runtime, slot, sourceAction) {
  const bypassAvoid = sourceAction?.attackType === 'other';
  if (bypassAvoid || slot >= bossHpSlotCount(runtime)) return 0;
  return (runtime.enemy.statusAvoidMods ?? []).reduce((sum, x) => sum + Number(x.value || 0), 0) / 100;
}

function clearEnemyEffectsBrokenByActionDisable(runtime) {
  runtime.enemy.defenseMods = (runtime.enemy.defenseMods ?? []).filter(mod => mod.breakOnActionDisable !== true);
  for (const companion of runtime.companions ?? []) {
    companion.defenseMods = (companion.defenseMods ?? []).filter(mod => mod.breakOnActionDisable !== true);
  }
}

function applyEnemyUnitStatus(runtime, slot, effect) {
  const boss = slot < bossHpSlotCount(runtime);
  if (effect.type === 'poison' || effect.type === 'deadlyPoison') {
    const value = effect.type === 'deadlyPoison' ? 'deadlyPoison' : 'poison';
    if (boss) {
      if (value === 'deadlyPoison' || runtime.enemy.poison === 'none') runtime.enemy.poison = value;
    } else {
      const ci = companionIndexForHpSlot(runtime, slot);
      if (ci >= 0 && runtime.companions?.[ci]) {
        const current = runtime.companions[ci].poison ?? 'none';
        if (value === 'deadlyPoison' || current === 'none') runtime.companions[ci].poison = value;
      }
    }
    return;
  }
  if (effect.type === 'enemyParalysis') {
    if (boss) {
      runtime.enemy.paralysis = true;
      clearEnemyEffectsBrokenByActionDisable(runtime);
    } else {
      const ci = companionIndexForHpSlot(runtime, slot);
      if (ci >= 0 && runtime.companions?.[ci]) {
        runtime.companions[ci].statuses ??= {};
        runtime.companions[ci].statuses.paralysis = { remaining:1 };
      }
    }
  }
}

function branchEnemyUnitStatusEffect(branches, effect, sourceAction) {
  const out = [];
  const baseChance = Math.max(0, Math.min(1, Number(effect.chance ?? 100) / 100));
  for (const branch of branches) {
    for (const [hp, probability] of branch.hpDist) {
      const parts = enemyHpPartArray(hp);
      const rawSlots = Array.isArray(branch.runtime.lastAllyAttackHitSlots)
        ? branch.runtime.lastAllyAttackHitSlots
        : allyTargetedEnemySlots(branch.runtime, hp, sourceAction ?? {});
      const slots = rawSlots.filter(slot => Number(parts[slot] ?? 0) > 0);
      let local = [{ runtime:cloneRuntimeState(branch.runtime), hpDist:new Map([[hp, probability]]) }];
      for (const slot of slots) {
        const next = [];
        for (const item of local) {
          const chance = Math.max(0, Math.min(1, baseChance - enemyUnitStatusAvoid(item.runtime, slot, sourceAction)));
          if (chance <= 0) { next.push(item); continue; }
          if (chance >= 1) {
            applyEnemyUnitStatus(item.runtime, slot, effect);
            next.push(item);
            continue;
          }
          const missRt = cloneRuntimeState(item.runtime);
          const hitRt = cloneRuntimeState(item.runtime);
          applyEnemyUnitStatus(hitRt, slot, effect);
          next.push({ runtime:missRt, hpDist:scaleDistribution(item.hpDist, 1 - chance) });
          next.push({ runtime:hitRt, hpDist:scaleDistribution(item.hpDist, chance) });
        }
        local = next;
      }
      out.push(...local);
    }
  }
  return mergeRuntimeBranches(out);
}

function branchAllyEffects(runtime, hpDist, effects, actorIndex, sourceAction = null) {
  let branches = [{ runtime, hpDist }];
  for (const effect of effects ?? []) {
    if (sourceAction?.kind === 'attack' && ['poison','deadlyPoison','enemyParalysis'].includes(effect.type)) {
      branches = branchEnemyUnitStatusEffect(branches, effect, sourceAction);
      continue;
    }
    let chance = effectChanceFraction(effect);
    if (chance == null || chance >= 1) {
      for (const branch of branches) allyEffect(branch.runtime, effect, actorIndex);
      continue;
    }
    if (chance <= 0) continue;
    const next = [];
    for (const branch of branches) {
      const missRuntime = cloneRuntimeState(branch.runtime);
      const hitRuntime = cloneRuntimeState(branch.runtime);
      allyEffect(hitRuntime, effect, actorIndex);
      next.push({ runtime: missRuntime, hpDist: scaleDistribution(branch.hpDist, 1 - chance) });
      next.push({ runtime: hitRuntime, hpDist: scaleDistribution(branch.hpDist, chance) });
    }
    branches = next;
  }
  for (const branch of branches) delete branch.runtime.lastAllyAttackHitSlots;
  return branches;
}

function swordDanceBuffFor(runtime, actorIndex, action) {
  if (action.skillPresetId !== 'sword_dance') return action.buff;
  const stage = Math.max(0, Math.min(3, runtime.allies[actorIndex]?.swordDanceStage ?? 0));
  const values = ['120', '125', '130', '135'];
  return { ...(action.buff ?? defaultAllyBuff()), value: values[stage] };
}

function advanceSwordDanceState(runtime, actorIndex, action) {
  const ally = runtime.allies[actorIndex];
  if (!ally || action.skillPresetId !== 'sword_dance') return;
  if ((ally.swordDanceAutoRemaining ?? 0) > 0) {
    ally.swordDanceAutoRemaining -= 1;
    if (ally.swordDanceAutoRemaining > 0) ally.swordDanceStage = Math.min(3, (ally.swordDanceStage ?? 0) + 1);
    else ally.swordDanceStage = 0;
  } else {
    ally.swordDanceAutoRemaining = 3;
    ally.swordDanceStage = 1;
  }
}

function applyActivatedAllyActionResolved(runtime, hpDist, action, actorIndex, state) {
  let nextHp = hpDist;
  if (action.kind === 'attack') {
    const attack = effectiveAllyAttack(runtime.allies[actorIndex]);
    let skillMultiplier = action.skillMultiplier;
    if (action.weakDefenderAttribute && action.weakSkillMultiplier !== '' && state.enemy?.attribute === action.weakDefenderAttribute) skillMultiplier = action.weakSkillMultiplier;
    skillMultiplier = raceSkillMultiplier(action, runtime.enemy.race, skillMultiplier);
    if (runtime.enemy.poison !== 'none' && action.poisonedSkillMultiplier !== '') skillMultiplier = action.poisonedSkillMultiplier;
    if (runtime.enemy.poison === 'deadlyPoison' && action.deadlyPoisonSkillMultiplier !== '') skillMultiplier = action.deadlyPoisonSkillMultiplier;
    const speed = effectiveAllySpeed(runtime.allies[actorIndex]);
    // EXゲージは被弾1ヒットごとに増えるため、ヒット数可変技はヒット数枝を分けて保持する。
    const hitChoices = allyAttackHitCountChoices(action, speed);
    let attackBranches = [];
    for (const choice of hitChoices) {
      const damageDist = attackDamageDistribution({
        attack, speed, skillMultiplier, damageFormula: action.damageFormula,
        skillMultiplierMin: action.skillMultiplierMin, skillMultiplierMax: action.skillMultiplierMax, skillMultiplierStep: action.skillMultiplierStep,
        attackAttribute: action.attackAttribute, attackAttribute2: action.attackAttribute2, attackType: action.attackType,
        defenderAttribute: state.enemy?.attribute ?? 'none', defenderRace: runtime.enemy.race,
        defenseMods: applicableDefenseMods(runtime.enemy.defenseMods, action.attackType, attackAttributesFromConfig(action)), weaknessBoost: runtime.allies[actorIndex].weaknessMods.length > 0,
        hits: String(choice.hits), hitsMin: '', hitsMax: ''
      });
      const weightedHp = scaleDistribution(nextHp, choice.probability);
      attackBranches.push(...applyAllyAttackWithEnemyEx(runtime, weightedHp, damageDist, action, choice.hits));
    }
    // 攻撃枝ではEXゲージ量が異なり得るため、この時点で追加効果まで枝ごとに処理して返す。
    let branches = [];
    for (const attackBranch of attackBranches) {
      const local = branchAllyEffects(attackBranch.runtime, attackBranch.hpDist, action.effects ?? [], actorIndex, action);
      branches.push(...local);
    }
    for (const branch of branches) {
      advanceSwordDanceState(branch.runtime, actorIndex, action);
      if (action.selfDestruct === true) branch.runtime.allies[actorIndex].active = false;
    }
    return mergeRuntimeBranches(branches);
  } else if (action.kind === 'buff') {
    allyEffect(runtime, swordDanceBuffFor(runtime, actorIndex, action), actorIndex);
  }

  const preset = SKILL_PRESET_BY_ID.get(action.skillPresetId ?? '');
  if (preset?.reelBoost) {
    const target = action.presetTarget ?? `ally${Math.min(actorIndex + 1, runtime.allyCount)}`;
    const ids = resolvedTargetIdsRuntime(runtime, target, actorIndex);
    for (const id of ids) {
      const idx = Number(id.replace('ally','')) - 1;
      runtime.pendingReelBoosts ??= [];
      runtime.pendingReelBoosts.push({ index: idx, amount: Number(preset.reelBoost) });
    }
  }

  let branches = action.kind === 'skip'
    ? [{ runtime, hpDist: nextHp }]
    : branchAllyEffects(runtime, nextHp, action.effects ?? [], actorIndex, action);

  for (const branch of branches) {
    advanceSwordDanceState(branch.runtime, actorIndex, action);
    if (action.selfDestruct === true) branch.runtime.allies[actorIndex].active = false;
  }
  return branches;
}

function applyActivatedAllyActionWithCompanionEvasion(runtime, hpDist, action, actorIndex, state) {
  const out = [];
  for (const branch of branchCompanionPhysicalEvasion(runtime, hpDist, action)) {
    const resolved = applyActivatedAllyActionResolved(branch.runtime, branch.hpDist, action, actorIndex, state);
    for (const result of resolved) {
      clearCompanionAttackEvasionFlags(result.runtime);
      out.push(result);
    }
  }
  return mergeRuntimeBranches(out);
}

function applyActivatedAllyAction(runtime, hpDist, action, actorIndex, state) {
  // オプティカルカモフラージュ等、BOSS本人の物理回避。
  // 回避枝ではダメージだけでなく、その攻撃に付随する敵向け追加効果も発生しない。
  const evasion = action?.kind === 'attack' && action?.attackType === 'physical'
    ? Math.max(0, Math.min(100, Number(runtime.enemy?.physicalEvasion?.chance ?? 0) || 0)) / 100
    : 0;
  if (evasion <= 0) return applyActivatedAllyActionWithCompanionEvasion(runtime, hpDist, action, actorIndex, state);
  if (evasion >= 1) return [{ runtime, hpDist }];

  const evaded = { runtime:cloneRuntimeState(runtime), hpDist:scaleDistribution(hpDist, evasion) };
  const hitRuntime = cloneRuntimeState(runtime);
  const hitBranches = applyActivatedAllyActionWithCompanionEvasion(hitRuntime, scaleDistribution(hpDist, 1 - evasion), action, actorIndex, state);
  return mergeRuntimeBranches([evaded, ...hitBranches]);
}


const NON_EFFECT_COMMANDS = new Set([
  '', 'ミス', 'ほほえんでいる', 'ほほえんでいる?', 'なげいている', 'ためる', 'チャージ',
  '燃えている', '笑っている', 'みくだしている', 'ときをまつ', 'うつむいている', '様子を見ている'
]);

function isStructuralOrNoEffectCommand(commandName) {
  const name = String(commandName ?? '').trim();
  if (NON_EFFECT_COMMANDS.has(name)) return true;
  if (/^(★+)→(★+)$/.test(name)) return true;
  if (/^EXゲージ\+\d+$/.test(name)) return true;
  return false;
}

// ルーレットで実際に止まったコマンドを、撃破確率エンジンで実行できる action に変換する。
// 表示中の技と同じコマンドなら、ユーザーが指定した対象などを保持するため configuredAction をそのまま使う。
// 別コマンドなら非表示の内部プリセットも含めて技名から解決する。
function actionForRolledCommand(commandName, configuredAction) {
  const name = String(commandName ?? '').trim();
  if (isStructuralOrNoEffectCommand(name)) return { action: null, missing: '' };

  if (normalizeSkillName(name) === normalizeSkillName(configuredAction?.skillName ?? '')) {
    return { action: configuredAction, missing: '' };
  }

  const presetId = presetIdForSkillName(name);
  const preset = presetId ? SKILL_PRESET_BY_ID.get(presetId) : null;
  if (!preset) return { action: null, missing: name };

  // 王女のせいえん／女王のごほうび等で、表示中の行動側に対象指定があれば
  // 別コマンドを引いた場合にも同じ対象を使う。
  const raw = {
    ...preset,
    skillPresetId: preset.id,
    presetTarget: configuredAction?.presetTarget ?? ''
  };
  return { action: ensureAction(raw, 'ally'), missing: '' };
}

function resolvedTargetIdsRuntime(runtime, target, actorIndex = 0) {
  if (Array.isArray(target)) return target.filter(x => /^ally[1-3]$/.test(x));
  if (target === 'all') return Array.from({ length: runtime.allyCount }, (_, i) => `ally${i + 1}`);
  if (target === 'self') return [`ally${actorIndex + 1}`];
  if (target === 'others') return Array.from({ length: runtime.allyCount }, (_, i) => `ally${i + 1}`).filter(x => x !== `ally${actorIndex + 1}`);
  if (/^ally[1-3]$/.test(target ?? '')) return [target];
  return [];
}

function applyPendingReelBoosts(runtime, reels) {
  for (const x of runtime.pendingReelSets ?? []) {
    reels[x.index] = Math.max(0, Math.min(3, Number(x.reel) || 0));
  }
  runtime.pendingReelSets = [];
  for (const b of runtime.pendingReelBoosts ?? []) {
    reels[b.index] = Math.max(0, Math.min(3, (reels[b.index] ?? 0) + b.amount));
  }
  runtime.pendingReelBoosts = [];
}

function hasAnyActivationModel(state) {
  const presetId = state.enemy?.presetId ?? '';
  if (enemyBossProfile(presetId)) return true;
  const bossPreset = BOSS_PRESET_BY_ID.get(presetId);
  if ((bossPreset?.companions ?? []).some(name => enemyCompanionProfile(name))) return true;
  const turns = Array.isArray(state.turns) ? state.turns : [];
  // 敵EXゲージは被弾・ターン終了だけでも増えるため、敵行動ONなら確率分岐側で必ず追跡する。
  if (turns.some(t => t?.enemyAction?.enabled !== false)) return true;
  if (turns.some(t => String(t?.enemyAction?.effect?.type ?? '').startsWith('status'))) return true;
  // リール位置や永続的なロート倍率は、確率分岐側のランタイム状態でのみ追跡する。
  if (turns.some(t => ['progressiveStatDecay','allyReelShift'].includes(String(t?.enemyAction?.effect?.type ?? '')))) return true;
  for (let i = 0; i < Number(state.allyCount ?? 0); i++) {
    const characterId = state.allies?.[i]?.characterId;
    for (let t = 0; t < turns.length; t++) {
      const { action } = resolveAction(turns, t, 'ally', i);
      const preset = SKILL_PRESET_BY_ID.get(action.skillPresetId ?? '');
      if (action.selfDestruct || action.skillPresetId === 'sword_dance' || (action.effects ?? []).some(e => e.chance != null)) return true;
      if (!characterId) continue;
      const transitions = commandTransitionsFor({
        characterId,
        skillPresetId: action.skillPresetId,
        skillName: action.skillName,
        startReel: 0,
        commandVariant: state.allies?.[i]?.commandVariant ?? ''
      });
      if (transitions) return true;
    }
  }
  return false;
}


function makeInitialRuntime(state, maxHp, allyCount, enemyBaseSpeed) {
  const presetId = state.enemy?.presetId ?? '';
  const bossProfile = enemyBossProfile(presetId);
  const bossPreset = BOSS_PRESET_BY_ID.get(presetId);
  const configuredEnemyAttack = state.enemy?.attack == null || String(state.enemy.attack).trim() === ''
    ? null
    : parseNumber(state.enemy.attack, '敵の攻撃力', { min: 0 });
  const bossCount = Math.max(1, Number(bossPreset?.enemyCount ?? 1) || 1);
  // マシュまろは同一BOSS3体を専用multiBossCountで管理済みなので、encounter由来の「お供」2体を重複登録しない。
  const fixedCompanionNames = bossCount > 1 ? [] : (bossPreset?.companions ?? []);
  const companions = fixedCompanionNames.flatMap((name, fixedIndex) => {
    const cp = enemyCompanionProfile(name);
    const maxHp = enemyCompanionBaseHp(name);
    if (!cp && maxHp == null) return [];
    return [{
      name, maxHp, hpSlot:maxHp == null ? null : bossCount + fixedIndex,
      baseAttack:Number(cp?.attack ?? 0) || 0, baseSpeed:Number(cp?.speed ?? 0) || 0,
      attribute:String(cp?.attribute ?? ''), race:String(cp?.race ?? 'normal'),
      attackMods:[], speedMods:[], defenseMods:[], statuses:{}, poison:'none', flatAttackBonus:0, flatSpeedBonus:0, postActionSpeedGain:0, postActionEnemyExGain:0,
      permanentBuffKeys:[], actionLockRemaining:0, active:true, startReel:0, summoned:false, deathSeq:null, revivable:false
    }];
  });
  return {
    maxHp, allyCount, seq: 0, playerExGauge: 0,
    allies: Array.from({ length: allyCount }, (_, i) => {
      return {
        baseAttack: parseNumber(state.allies?.[i]?.attack, `キャラ${i + 1}の攻撃力`, { min: 0 }),
        baseSpeed: parseNumber(state.allies?.[i]?.speed, `キャラ${i + 1}の素早さ`, { min: 0 }),
        star: state.allies?.[i]?.star ?? '', attribute: state.allies?.[i]?.attribute ?? '', race: normalizeEnemyRace(state.allies?.[i]?.race ?? 'normal'),
        attackMods: [], speedMods: [], weaknessMods: [],
        statusAvoidMods: [], statusImmuneMods: [], damageTakenMods: [], statusVulnerabilityMods: [], statuses: {},
        rotAttackMultiplier: 1, rotSpeedMultiplier: 1, activeProgressiveDecay: null, actionLockRemaining:0,
        actionsTaken: 0, active: true, swordDanceAutoRemaining: 0, swordDanceStage: 0
      };
    }),
    enemy: {
      name: bossPreset?.name ?? 'BOSS', presetId,
      baseAttack: (configuredEnemyAttack != null && configuredEnemyAttack > 0) ? configuredEnemyAttack : (bossProfile?.attack ?? configuredEnemyAttack ?? 0),
      baseSpeed: enemyBaseSpeed, attribute:String(state.enemy?.attribute ?? ''), speedMods: [], attackMods: [], defenseMods: [], poison: 'none', race: normalizeEnemyRace(state.enemy?.race),
      postActionAttackGain: 0, flatAttackBonus: 0, postActionSpeedGain:0, flatSpeedBonus:0, blessingMods: [], reactiveEffects: [], statusAvoidMods: [], disabledCommands: [], transientDisabledCommands: [], commandOverrides: {}, charge:null, paralysis:false,
      actionSerial:0, physicalEvasion:null, singleTargetUntargetable:null, barbadosWaterStack:0, exGauge:0, deathSerial:0,
      multiBossCount: bossCount, hpSlotCount: bossCount + companions.filter(x => Number.isInteger(x.hpSlot)).length
    },
    companions,
    pendingReelBoosts: [],
    pendingReelSets: [],
    pendingCompanionReelShifts: {}
  };
}

const MANUAL_ENEMY_STATUS = Object.freeze({
  statusParalysis: 'paralysis',
  statusConfusion: 'confusion',
  statusSilence: 'silence',
  statusDarkness: 'darkness',
  statusSleep: 'sleep',
  statusPetrification: 'petrification',
  statusCold: 'cold',
  statusBrainwash: 'brainwash'
});

function manualEnemyStatusSkill(effect) {
  const status = MANUAL_ENEMY_STATUS[effect?.type];
  if (!status) return null;
  const defaultDuration = status === 'silence' || status === 'darkness' || status === 'cold' ? 3 : status === 'sleep' ? 5 : status === 'poison' || status === 'deadlyPoison' || status === 'petrification' ? 99 : 1;
  return {
    name: `手動:${status}`,
    kind: 'effect',
    target: effect.target ?? 'all',
    attackType: effect.attackType ?? 'other',
    effects: [{ type: 'status', status, chance: effect.chance ?? 100, duration: effect.duration ?? defaultDuration, bypassAvoid: effect.bypassAvoid === true }]
  };
}

function executeManualEnemyStatus(runtime, enemyHpDist, state, effect) {
  const skill = manualEnemyStatusSkill(effect);
  if (!skill) return [{ runtime, hpDist: enemyHpDist }];
  const activationChance = Math.max(0, Math.min(100, Number(effect.activationChance ?? 100) || 0)) / 100;
  const out = [];
  if (activationChance < 1) out.push({ runtime: cloneRuntimeState(runtime), hpDist: scaleDistribution(enemyHpDist, 1 - activationChance) });
  if (activationChance > 0) {
    const hitRt = cloneRuntimeState(runtime);
    out.push(...executeEnemySkill(hitRt, scaleDistribution(enemyHpDist, activationChance), state, skill));
  }
  return out;
}

function beginEnemyCommandAction(runtime) {
  runtime.enemy.actionSerial = Number(runtime.enemy.actionSerial ?? 0) + 1;
  const evasion = runtime.enemy.physicalEvasion;
  if (evasion && Number(evasion.expiresAtAction ?? Infinity) <= runtime.enemy.actionSerial) {
    runtime.enemy.physicalEvasion = null;
  }
  const hidden = runtime.enemy.singleTargetUntargetable;
  if (hidden && Number(hidden.expiresAtAction ?? Infinity) <= runtime.enemy.actionSerial) {
    runtime.enemy.singleTargetUntargetable = null;
  }
}

function finishEnemyCommandAction(runtime, hpDist) {
  let nextHp = hpDist;
  // 加護は敵の行動終了時に回復。技ごとの値を flat / 最大HP% / 敵ATK% で保持できる。
  for (const blessing of runtime?.enemy?.blessingMods ?? []) {
    const value = Number(blessing.value ?? 0) || 0;
    let amount = 0;
    if (blessing.mode === 'flat') amount = trunc0(value);
    else if (blessing.mode === 'maxPercent') amount = trunc0(runtime.maxHp * value / 100);
    else {
      const attack = applyMods(runtime.enemy.baseAttack + Number(runtime.enemy.flatAttackBonus ?? 0), runtime.enemy.attackMods, { clampMin:0, clampMax:999 });
      amount = trunc0(attack * value / 100);
    }
    if (amount > 0) nextHp = mapBossHpDistribution(runtime, nextHp, hp => Math.min(runtime.maxHp, hp + amount));
  }
  const gain = Number(runtime?.enemy?.postActionAttackGain ?? 0);
  if (gain) runtime.enemy.flatAttackBonus = Number(runtime.enemy.flatAttackBonus ?? 0) + gain;
  const speedGain = Number(runtime?.enemy?.postActionSpeedGain ?? 0);
  if (speedGain) runtime.enemy.flatSpeedBonus = Number(runtime.enemy.flatSpeedBonus ?? 0) + speedGain;
  return nextHp;
}

function splitEnemyAliveDistribution(dist) {
  const dead = new Map();
  const live = new Map();
  for (const [hp, p] of dist) {
    const target = enemyHpDefeated(hp) ? dead : live;
    target.set(hp, (target.get(hp) ?? 0) + p);
  }
  return { dead, live };
}

function splitBossAliveDistribution(runtime, dist) {
  const dead = new Map();
  const live = new Map();
  for (const [hp, p] of dist) {
    const target = bossHpDefeated(runtime, hp) ? dead : live;
    target.set(hp, (target.get(hp) ?? 0) + p);
  }
  return { dead, live };
}

function splitCompanionAliveDistribution(runtime, dist, companionIndex) {
  const dead = new Map();
  const live = new Map();
  for (const [hp, p] of dist) {
    const target = companionHpAlive(runtime, hp, companionIndex) ? live : dead;
    target.set(hp, (target.get(hp) ?? 0) + p);
  }
  return { dead, live };
}

function mergeBossCommandChainBranches(branches) {
  const byKey = new Map();
  for (const branch of branches) {
    const key = `${stringifyRuntimeForMerge(branch.runtime)}|${branch.nextReel ?? 0}`;
    const existing = byKey.get(key);
    if (existing) addDistribution(existing.hpDist, branch.hpDist);
    else byKey.set(key, { runtime:branch.runtime, hpDist:new Map(branch.hpDist), nextReel:branch.nextReel ?? 0 });
  }
  return [...byKey.values()];
}

// 闇の女神官は再行動技3種が「その再行動中だけ同名技をミス化」する。
// 3技とも撃破率に関係する効果は冥界の城の防御だけなので、コマンド連鎖自体を事前集約して枝爆発を避ける。
const DARK_PRIESTESS_REACTION_COMMANDS = new Set(['冥界の城','宵闇の裁き','宵闇の杖']);
const darkPriestessChainCache = new Map();

function darkPriestessChainOutcomes(startReel) {
  const cacheKey = Number(startReel) || 0;
  if (darkPriestessChainCache.has(cacheKey)) return darkPriestessChainCache.get(cacheKey);
  const raw = [];
  const expectedActivations = {};
  const walk = (reel, disabled, probability, castleUsed, depth = 0) => {
    if (depth > 4 || probability <= 0) return;
    const transitions = enemyCommandTransitions('q_dark_priestess', reel, [...disabled]);
    for (const tr of transitions ?? []) {
      if (tr.probability <= 0) continue;
      const p = probability * tr.probability;
      const name = String(tr.commandName ?? '').trim();
      if (enemySkillForCommand(name, 'q_dark_priestess')) {
        expectedActivations[name] = (expectedActivations[name] ?? 0) + p;
      }
      if (DARK_PRIESTESS_REACTION_COMMANDS.has(name)) {
        const nextDisabled = new Set(disabled);
        nextDisabled.add(name);
        walk(tr.nextReel, nextDisabled, p, castleUsed || name === '冥界の城', depth + 1);
      } else {
        raw.push({ probability:p, nextReel:tr.nextReel, commandName:name, castleUsed });
      }
    }
  };
  walk(cacheKey, new Set(), 1, false);

  // 発動回数統計は期待値を別集計し、実ランタイムの枝は「最終コマンド・最終リール・城使用有無」だけで統合する。
  const merged = new Map();
  for (const x of raw) {
    const key = JSON.stringify({ nextReel:x.nextReel, commandName:x.commandName, castleUsed:x.castleUsed });
    const prev = merged.get(key);
    if (prev) prev.probability += x.probability;
    else merged.set(key, { ...x });
  }
  const result = { outcomes:[...merged.values()], expectedActivations };
  darkPriestessChainCache.set(cacheKey, result);
  return result;
}

function executeDarkPriestessCommandChain(runtime, hpDist, state, startReel, activationBucket, missingEffects) {
  const sourceMass = distributionMass(hpDist);
  const chain = darkPriestessChainOutcomes(startReel);
  for (const [name, expectedCount] of Object.entries(chain.expectedActivations)) {
    activationBucket[name] = (activationBucket[name] ?? 0) + sourceMass * expectedCount;
  }
  const out = [];
  for (const outcome of chain.outcomes) {
    const rt = cloneRuntimeState(runtime);
    if (outcome.castleUsed) {
      addEnemyTeamDefenseMod(rt, {
        type:'enemyDefenseBuff', value:10, duration:5, stackRefreshGroup:'冥界の城:防御', scope:'enemyTeam'
      }, '冥界の城:防御');
    }
    const weighted = scaleDistribution(hpDist, outcome.probability);
    const finalSkill = enemySkillForCommand(outcome.commandName, 'q_dark_priestess');
    if (finalSkill && !DARK_PRIESTESS_REACTION_COMMANDS.has(outcome.commandName)) {
      for (const branch of executeEnemySkill(rt, weighted, state, finalSkill)) {
        out.push({ runtime:branch.runtime, hpDist:branch.hpDist, nextReel:outcome.nextReel });
      }
    } else {
      if (!finalSkill && !isStructuralOrNoEffectCommand(outcome.commandName) && outcome.commandName) missingEffects.add(`敵:${outcome.commandName}`);
      out.push({ runtime:rt, hpDist:weighted, nextReel:outcome.nextReel });
    }
  }
  return mergeBossCommandChainBranches(out);
}

// アロマ系など「技使用後にコマンドを書き換えて、その場で再行動」するBOSS用。
// 1回の敵行動機会の中で再抽選を続け、行動終了処理はチェーン全体の最後に1回だけ行う。
function disabledEnemyCommandsForChain(runtime) {
  return [...new Set([
    ...(runtime.enemy?.disabledCommands ?? []),
    ...(runtime.enemy?.transientDisabledCommands ?? [])
  ])];
}

function clearTransientEnemyCommandDisables(branches) {
  for (const branch of branches) branch.runtime.enemy.transientDisabledCommands = [];
  return branches;
}


// 鋏竜ザリガリオンの「鋏竜の猛攻」は、ハサミ技を使うたびに同一行動機会内で再抽選する。
// フグ／クラゲは各1回で全同名枠がミス化し、オニは1回目に使用した1枠だけ、2回目で全枠がミス化するため、
// 使用済みスロットを一時状態として保持しながら各再抽選ごとに同一ランタイムを集約する。
function executeZarigarionCommandChain(runtime, hpDist, state, startReel, activationBucket, missingEffects) {
  const presetId = 'q_zarigarion';
  const reelCount = enemyBossProfile(presetId)?.matrix?.length ?? 1;
  let active = [{ runtime:cloneRuntimeState(runtime), hpDist:new Map(hpDist), nextReel:startReel }];
  const finished = [];
  const MAX_RUSH_STEPS = 16; // 仕様上は最大攻撃回数5回。異常データ時の安全上限。

  for (let step = 0; step < MAX_RUSH_STEPS && active.length; step++) {
    const nextActive = [];
    for (const scenario of active) {
      const temporaryOverrides = { ...(scenario.runtime.enemy?.commandOverrides ?? {}) };
      for (const slotKey of scenario.runtime.enemy?.pincerDisabledSlots ?? []) temporaryOverrides[slotKey] = 'ミス';
      const transitions = enemyCommandTransitions(
        presetId,
        scenario.nextReel,
        disabledEnemyCommandsForChain(scenario.runtime),
        temporaryOverrides,
        true
      );
      if (!transitions?.length) {
        finished.push(scenario);
        continue;
      }

      const sourceMass = distributionMass(scenario.hpDist);
      for (const tr of transitions) {
        if (tr.probability <= 0) continue;
        const rawCommandName = String(tr.commandName ?? '').trim();
        const alreadyRushing = Boolean(scenario.runtime.enemy?.pincerRushActive);
        // 猛攻の再行動中は、残っている「鋏竜の猛攻」枠が「竜のしっぽ」に変化する。
        const effectiveCommandName = alreadyRushing && rawCommandName === '鋏竜の猛攻'
          ? '竜のしっぽ'
          : rawCommandName;
        const skill = enemySkillForCommand(effectiveCommandName, presetId);
        if (skill) {
          activationBucket[effectiveCommandName] = (activationBucket[effectiveCommandName] ?? 0) + sourceMass * tr.probability;
        } else if (!isStructuralOrNoEffectCommand(effectiveCommandName) && effectiveCommandName) {
          missingEffects.add(`敵:${effectiveCommandName}`);
        }

        const rt = cloneRuntimeState(scenario.runtime);
        if (!alreadyRushing && rawCommandName === '鋏竜の猛攻') {
          rt.enemy.pincerRushActive = true;
          rt.enemy.pincerOniUses = 0;
          rt.enemy.pincerDisabledSlots = [];
        }
        const weighted = scaleDistribution(scenario.hpDist, tr.probability);
        const branches = skill ? executeEnemySkill(rt, weighted, state, skill) : [{ runtime:rt, hpDist:weighted }];
        const bossReelShift = Number(skill?.bossReelShift ?? 0) || 0;
        const nextReel = Math.max(0, Math.min(reelCount - 1, tr.nextReel + bossReelShift));

        for (const branch of branches) {
          let continueRush = false;
          if (branch.runtime.enemy?.pincerRushActive) {
            if (effectiveCommandName === 'フグバサミ' || effectiveCommandName === 'クラゲバサミ') {
              // それぞれ一度使うと、残りの同名コマンドが全てミスになる。
              branch.runtime.enemy.transientDisabledCommands ??= [];
              if (!branch.runtime.enemy.transientDisabledCommands.includes(effectiveCommandName)) {
                branch.runtime.enemy.transientDisabledCommands.push(effectiveCommandName);
              }
              continueRush = true;
            } else if (effectiveCommandName === 'オニバサミ') {
              const uses = Number(branch.runtime.enemy.pincerOniUses ?? 0) + 1;
              branch.runtime.enemy.pincerOniUses = uses;
              if (uses >= 2) {
                // 2回目を使用した後は全てのオニバサミがミスになる。
                branch.runtime.enemy.transientDisabledCommands ??= [];
                if (!branch.runtime.enemy.transientDisabledCommands.includes('オニバサミ')) {
                  branch.runtime.enemy.transientDisabledCommands.push('オニバサミ');
                }
              } else if (Number.isInteger(tr.stopReel) && Number.isInteger(tr.slotIndex)) {
                // 1回目は使用したその1マスだけミス化する。
                branch.runtime.enemy.pincerDisabledSlots ??= [];
                const key = `${tr.stopReel}:${tr.slotIndex}`;
                if (!branch.runtime.enemy.pincerDisabledSlots.includes(key)) branch.runtime.enemy.pincerDisabledSlots.push(key);
              }
              continueRush = true;
            } else if (!alreadyRushing && rawCommandName === '鋏竜の猛攻') {
              // 猛攻そのものの使用直後に最初の再抽選へ入る。
              continueRush = true;
            }
          }

          if (continueRush) nextActive.push({ runtime:branch.runtime, hpDist:branch.hpDist, nextReel });
          else finished.push({ runtime:branch.runtime, hpDist:branch.hpDist, nextReel });
        }
      }
    }

    active = mergeBossCommandChainBranches(nextActive);
  }

  // 安全上限に達した場合も確率質量は捨てない。
  finished.push(...active);
  const merged = mergeBossCommandChainBranches(finished);
  clearTransientEnemyCommandDisables(merged);
  for (const branch of merged) {
    delete branch.runtime.enemy.pincerRushActive;
    delete branch.runtime.enemy.pincerOniUses;
    delete branch.runtime.enemy.pincerDisabledSlots;
  }
  return merged;
}

function executeDockLowCommandChain(runtime, hpDist, state, startReel, activationBucket, missingEffects) {
  const presetId = 'q_dock_low';
  const reelCount = enemyBossProfile(presetId)?.matrix?.length ?? 1;
  let active = [{ runtime:cloneRuntimeState(runtime), hpDist:new Map(hpDist), nextReel:startReel }];
  const finished = [];
  // 月明/叫びは使用マスが永続ミス化するため、同一行動機会での再行動回数には厳密な有限上限がある。
  // 各stepで同一状態を集約し、同じリール内の同名マスは merge key 側で個数状態へ圧縮する。
  const MAX_DOCK_CHAIN_STEPS = 24;
  for (let step = 0; step < MAX_DOCK_CHAIN_STEPS && active.length; step++) {
    const nextActive = [];
    for (const scenario of active) {
      // 〖蒼染の月明〗／〖深海の叫び〗でEXが10になった場合、直後の再行動機会は通常コマンドではなくEX発動。
      // 周回用途ではEX発動到達＝失敗として枝を打ち切る。初回行動機会(step=0)は呼び出し側で既に判定済み。
      if (step > 0 && enemyExGauge(scenario.runtime) >= 10) {
        scenario.runtime.enemy.exTriggered = true;
        finished.push(scenario);
        continue;
      }
      const transitions = enemyCommandTransitions(
        presetId, scenario.nextReel, disabledEnemyCommandsForChain(scenario.runtime),
        scenario.runtime.enemy?.commandOverrides ?? null, true
      );
      if (!transitions?.length) { finished.push(scenario); continue; }
      const sourceMass = distributionMass(scenario.hpDist);
      for (const tr of transitions) {
        if (tr.probability <= 0) continue;
        const commandName = String(tr.commandName ?? '').trim();
        const skill = enemySkillForCommand(commandName, presetId);
        if (skill) activationBucket[commandName] = (activationBucket[commandName] ?? 0) + sourceMass * tr.probability;
        else if (!isStructuralOrNoEffectCommand(commandName) && commandName) missingEffects.add(`敵:${commandName}`);

        const rt = cloneRuntimeState(scenario.runtime);
        addEnemyEx(rt, enemyExGainFromCommandName(commandName));
        const weighted = scaleDistribution(scenario.hpDist, tr.probability);
        const branches = skill ? executeEnemySkill(rt, weighted, state, skill) : [{ runtime:rt, hpDist:weighted }];
        const bossReelShift = Number(skill?.bossReelShift ?? 0) || 0;
        const nextReel = Math.max(0, Math.min(reelCount - 1, tr.nextReel + bossReelShift));
        for (const branch of branches) {
          if (skill?.replaceUsedSlotWith && Number.isInteger(tr.stopReel) && Number.isInteger(tr.slotIndex)) {
            branch.runtime.enemy.commandOverrides ??= {};
            branch.runtime.enemy.commandOverrides[`${tr.stopReel}:${tr.slotIndex}`] = String(skill.replaceUsedSlotWith);
          }
          if (skill?.turnContinue) nextActive.push({ runtime:branch.runtime, hpDist:branch.hpDist, nextReel });
          else finished.push({ runtime:branch.runtime, hpDist:branch.hpDist, nextReel });
        }
      }
    }
    active = mergeBossCommandChainBranches(nextActive);
  }
  // 防御的な上限に到達しても確率質量は捨てない。通常データでは全再行動枠を消費する前に必ず終了枝へ入る。
  finished.push(...active);
  return mergeBossCommandChainBranches(finished);
}

function executeCompanionCommandChain(runtime, hpDist, state, companionIndex, startReel, activationBucket, missingEffects, depth = 0) {
  const companion = runtime.companions?.[companionIndex];
  if (!companion || companion.active === false || depth >= 12) {
    return [{ runtime, hpDist, nextReel:startReel }];
  }
  const companionName = String(companion.name ?? '').trim();
  const transitions = enemyCompanionCommandTransitions(
    companionName, startReel, companion.commandOverrides ?? null, true
  );
  if (!transitions?.length) return [{ runtime, hpDist, nextReel:startReel }];

  const sourceMass = distributionMass(hpDist);
  const out = [];
  for (const tr of transitions) {
    if (tr.probability <= 0) continue;
    const commandName = String(tr.commandName ?? '').trim();
    const skill = enemyCompanionSkillForCommand(commandName, companionName);
    const activationLabel = `お供:${companionName} / ${commandName || '移動'}`;
    if (skill) activationBucket[activationLabel] = (activationBucket[activationLabel] ?? 0) + sourceMass * tr.probability;
    else if (!isStructuralOrNoEffectCommand(commandName) && commandName) missingEffects.add(`お供:${companionName}:${commandName}`);

    const rt = cloneRuntimeState(runtime);
    addEnemyEx(rt, enemyExGainFromCommandName(commandName));
    rt.actingCompanionIndex = companionIndex;
    const weighted = scaleDistribution(hpDist, tr.probability);
    const branches = skill ? executeEnemySkill(rt, weighted, state, skill) : [{ runtime:rt, hpDist:weighted }];
    for (const branch of branches) {
      delete branch.runtime.actingCompanionIndex;
      const acting = branch.runtime.companions?.[companionIndex];
      if (skill?.replaceUsedSlotWith && acting && Number.isInteger(tr.stopReel) && Number.isInteger(tr.slotIndex)) {
        acting.commandOverrides ??= {};
        acting.commandOverrides[`${tr.stopReel}:${tr.slotIndex}`] = String(skill.replaceUsedSlotWith);
      }
      if (skill?.turnContinue) {
        out.push(...executeCompanionCommandChain(
          branch.runtime, branch.hpDist, state, companionIndex, tr.nextReel,
          activationBucket, missingEffects, depth + 1
        ));
      } else {
        out.push({ runtime:branch.runtime, hpDist:branch.hpDist, nextReel:tr.nextReel });
      }
    }
  }
  return mergeBossCommandChainBranches(out);
}

function executeBossCommandChain(runtime, hpDist, state, presetId, startReel, activationBucket, missingEffects, depth = 0) {
  if (presetId === 'q_dock_low' && depth === 0) {
    return executeDockLowCommandChain(runtime, hpDist, state, startReel, activationBucket, missingEffects);
  }
  if (presetId === 'q_dark_priestess' && depth === 0) {
    return executeDarkPriestessCommandChain(runtime, hpDist, state, startReel, activationBucket, missingEffects);
  }
  if (presetId === 'q_zarigarion' && depth === 0) {
    return executeZarigarionCommandChain(runtime, hpDist, state, startReel, activationBucket, missingEffects);
  }
  const MAX_CHAIN = presetId === 'q_zarigarion' ? 24 : 12;
  if (depth >= MAX_CHAIN) return [{ runtime, hpDist, nextReel:startReel }];
  const preserveSlots = presetId === 'q_michael' || presetId === 'q_dock_low' || Object.keys(runtime.enemy?.commandOverrides ?? {}).length > 0;
  const transitions = enemyCommandTransitions(
    presetId, startReel, disabledEnemyCommandsForChain(runtime), runtime.enemy?.commandOverrides ?? null, preserveSlots
  );
  if (!transitions?.length) return [{ runtime, hpDist, nextReel:startReel }];

  const sourceMass = distributionMass(hpDist);
  const out = [];
  for (const tr of transitions) {
    if (tr.probability <= 0) continue;
    const commandName = String(tr.commandName ?? '').trim();
    // 鋏竜の猛攻中は、同名コマンドがすべて竜のしっぽへ一時変化する。
    const effectiveCommandName = presetId === 'q_zarigarion' && runtime.enemy?.pincerRushActive && commandName === '鋏竜の猛攻'
      ? '竜のしっぽ'
      : commandName;
    const skill = enemySkillForCommand(effectiveCommandName, presetId);
    if (skill) {
      activationBucket[effectiveCommandName] = (activationBucket[effectiveCommandName] ?? 0) + sourceMass * tr.probability;
    } else if (!isStructuralOrNoEffectCommand(effectiveCommandName) && effectiveCommandName) {
      missingEffects.add(`敵:${effectiveCommandName}`);
    }

    const rt = cloneRuntimeState(runtime);
    addEnemyEx(rt, enemyExGainFromCommandName(effectiveCommandName));
    if (presetId === 'q_zarigarion' && commandName === '鋏竜の猛攻' && !rt.enemy?.pincerRushActive) {
      rt.enemy.pincerRushActive = true;
    }
    const conditionalNames = Array.isArray(skill?.turnContinueIfNoActiveCompanionNames)
      ? skill.turnContinueIfNoActiveCompanionNames
      : null;
    const continueBecauseNoCompanion = conditionalNames != null && !activeEnemyCompanionNamed(rt, conditionalNames);
    const continueBecauseActiveCompanion = skill?.turnContinueIfActiveCompanion === true
      && (rt.companions ?? []).some(x => x?.active !== false);
    if (continueBecauseNoCompanion) {
      rt.enemy.transientDisabledCommands ??= [];
      if (commandName && !rt.enemy.transientDisabledCommands.includes(commandName)) rt.enemy.transientDisabledCommands.push(commandName);
    }
    const weighted = scaleDistribution(hpDist, tr.probability);
    const branches = skill ? executeEnemySkill(rt, weighted, state, skill) : [{ runtime:rt, hpDist:weighted }];
    const reelCount = enemyBossProfile(presetId)?.matrix?.length ?? 1;
    const bossReelShift = Number(skill?.bossReelShift ?? 0) || 0;
    const nextReelAfterSkill = Math.max(0, Math.min(reelCount - 1, tr.nextReel + bossReelShift));
    for (const branch of branches) {
      if (skill?.replaceUsedSlotWith && Number.isInteger(tr.stopReel) && Number.isInteger(tr.slotIndex)) {
        branch.runtime.enemy.commandOverrides ??= {};
        branch.runtime.enemy.commandOverrides[`${tr.stopReel}:${tr.slotIndex}`] = String(skill.replaceUsedSlotWith);
      }

      // ナタラジャは踊り以外の行動を取ると踊り状態が解除される。
      if (presetId === 'q_nataraja' && skill?.kind !== 'dance') branch.runtime.enemy.danceActive = false;

      // 鋏竜の猛攻中はハサミ技の使用後に再行動。フグ／クラゲは1回使うと残りの同名枠がミス化する。
      let continuePincerRush = false;
      if (presetId === 'q_zarigarion' && branch.runtime.enemy?.pincerRushActive) {
        if (effectiveCommandName === 'フグバサミ' || effectiveCommandName === 'クラゲバサミ') {
          branch.runtime.enemy.transientDisabledCommands ??= [];
          if (!branch.runtime.enemy.transientDisabledCommands.includes(effectiveCommandName)) {
            branch.runtime.enemy.transientDisabledCommands.push(effectiveCommandName);
          }
          continuePincerRush = true;
        } else if (effectiveCommandName === 'オニバサミ') {
          continuePincerRush = true;
        }
      }

      if (skill?.turnContinue || continueBecauseNoCompanion || continueBecauseActiveCompanion || continuePincerRush) {
        out.push(...executeBossCommandChain(
          branch.runtime, branch.hpDist, state, presetId, nextReelAfterSkill, activationBucket, missingEffects, depth + 1
        ));
      } else {
        out.push({ runtime:branch.runtime, hpDist:branch.hpDist, nextReel:nextReelAfterSkill });
      }
    }
  }
  const merged = mergeBossCommandChainBranches(out);
  if (depth === 0) {
    clearTransientEnemyCommandDisables(merged);
    for (const branch of merged) delete branch.runtime.enemy.pincerRushActive;
    return merged;
  }
  return merged;
}


function applyPendingEnemyTeamReelShifts(runtime, enemyReel, companionReels, presetId) {
  let nextEnemyReel = Number(enemyReel ?? 0) || 0;
  const nextCompanionReels = companionReels?.slice() ?? [];

  const bossShift = Math.trunc(Number(runtime.enemy?.pendingReelShift ?? 0) || 0);
  if (bossShift) {
    const bossMatrix = enemyBossProfile(presetId ?? '')?.matrix ?? [];
    if (bossMatrix.length) nextEnemyReel = Math.max(0, Math.min(bossMatrix.length - 1, nextEnemyReel + bossShift));
    delete runtime.enemy.pendingReelShift;
  }

  for (const [rawIndex, rawShift] of Object.entries(runtime.pendingCompanionReelShifts ?? {})) {
    const companionIndex = Number(rawIndex);
    const shift = Math.trunc(Number(rawShift) || 0);
    const targetCompanion = runtime.companions?.[companionIndex];
    const targetProfile = enemyCompanionProfile(targetCompanion?.name ?? '');
    if (!Number.isInteger(companionIndex) || !shift || !targetProfile?.matrix?.length) continue;
    const currentReel = nextCompanionReels[companionIndex] ?? targetCompanion?.startReel ?? 0;
    nextCompanionReels[companionIndex] = Math.max(0, Math.min(targetProfile.matrix.length - 1, currentReel + shift));
  }
  runtime.pendingCompanionReelShifts = {};
  return { enemyReel:nextEnemyReel, companionReels:nextCompanionReels };
}

function applyEnemyReactiveEffectsAfterAllyAction(branches, actorIndex, action) {
  if (action?.kind !== 'attack') return branches;
  const out = [];
  for (const branch of branches) {
    const { dead, live } = splitBossAliveDistribution(branch.runtime, branch.hpDist);
    if (distributionMass(dead) > 0) out.push({ runtime:cloneRuntimeState(branch.runtime), hpDist:dead });
    if (distributionMass(live) <= 0) continue;

    let current = [{ runtime:cloneRuntimeState(branch.runtime), hpDist:live }];
    const reactiveEffects = branch.runtime.enemy?.reactiveEffects ?? [];
    for (const reaction of reactiveEffects) {
      if (!(reaction.triggerAttackTypes ?? ['physical']).includes(action.attackType)) continue;
      const next = [];
      for (const candidate of current) {
        const statusEffect = {
          type:'status', status:reaction.status, chance:reaction.chance,
          chanceIfAttribute:reaction.chanceIfAttribute ?? undefined,
          duration:reaction.statusDuration ?? 1
        };
        // 反撃型状態異常も通常の状態異常耐性・無効化を受ける。
        const attempt = statusAttemptBranches(candidate, actorIndex, statusEffect, { attackType:'physical' });
        next.push(...attempt.hit, ...attempt.miss);
      }
      current = mergeRuntimeBranches(next);
    }
    out.push(...current);
  }
  return mergeRuntimeBranches(out);
}

function simulateKillProbabilityWithActivation(state) {
  const maxHp = parseIntValue(state.enemy?.maxHp, '敵HP', { min: 1, max: 9999999 });
  const enemyBaseSpeed = parseNumber(state.enemy?.speed, '敵の素早さ', { min: 0 });
  const allyCount = parseIntValue(state.allyCount, '味方人数', { min: 1, max: 3 });
  const turns = Array.isArray(state.turns) && state.turns.length ? state.turns : [];
  if (!turns.length) throw new Error('ターンを1つ以上設定してください');

  const presetId = state.enemy?.presetId ?? '';
  const bossProfile = enemyBossProfile(presetId);
  const bossPreset = BOSS_PRESET_BY_ID.get(presetId);
  const initialRuntime = makeInitialRuntime(state, maxHp, allyCount, enemyBaseSpeed);
  let scenarios = [{
    runtime: initialRuntime,
    reels: Array(allyCount).fill(0),
    enemyReel: 0,
    companionReels: Array(initialRuntime.companions?.length ?? 0).fill(0),
    hpDist: (() => {
      const bossCount = bossHpSlotCount(initialRuntime);
      const parts = [
        ...Array.from({ length:bossCount }, () => maxHp),
        ...(initialRuntime.companions ?? []).filter(x => Number.isInteger(x.hpSlot)).map(x => Number(x.maxHp ?? 0) || 0)
      ];
      return parts.length > 1 ? new Map([[multiHpKey(parts), 1]]) : new Map([[maxHp, 1]]);
    })()
  }];
  const timeline = [];
  const missing = new Set();
  const missingEffects = new Set();
  const enemySkillActivation = Array.from({ length: turns.length }, () => ({}));
  const allySkillActivation = Array.from({ length: turns.length }, () => Array.from({ length: allyCount }, () => ({})));
  const statusSummaryByTurn = [];
  const scenarioCountByTurn = [];
  let firstFinalOrder = [];
  let enemyExFailureChance = 0;
  const enemyExFailureByTurn = Array(turns.length).fill(0);

  for (let turnIndex = 0; turnIndex < turns.length; turnIndex++) {
    const turn = turns[turnIndex] ?? {};
    const isFinalTurn = turnIndex === turns.length - 1;
    const finished = [];

    for (const baseScenario of scenarios) {
      const order = actorOrder(baseScenario.runtime);
      if (!firstFinalOrder.length && isFinalTurn) firstFinalOrder = order;
      const lastAllyPosition = Math.max(...order.map((actor, pos) => actor.side === 'ally' ? pos : -1));
      let active = [{ ...baseScenario, order }];

      for (let pos = 0; pos < order.length; pos++) {
        const actor = order[pos];
        const next = [];
        for (const sc of active) {
          const runtime = sc.runtime;
          if (actor.side === 'ally') {
            // 先に敵に倒されていた枝では行動しない。
            if (runtime.allies[actor.index]?.active === false) {
              next.push(sc);
              continue;
            }

            const baseRt = cloneRuntimeState(runtime);
            expireSourceLinkedMods(baseRt, actor.index, 'start');
            const preBlocked = preActionStatusBlock(baseRt, actor.index);
            if (preBlocked) {
              baseRt.allies[actor.index].actionsTaken += 1;
              advanceProgressiveDecayAfterAction(baseRt, actor.index);
              finishAllyStatusOpportunity(baseRt, actor.index, false);
              expireSourceLinkedMods(baseRt, actor.index, 'end');
              next.push({ runtime: baseRt, reels: sc.reels.slice(), enemyReel: sc.enemyReel ?? 0, companionReels: sc.companionReels?.slice() ?? [], hpDist: sc.hpDist, order });
              continue;
            }

            const characterId = state.allies?.[actor.index]?.characterId ?? '';
            const autoDance = (baseRt.allies[actor.index]?.swordDanceAutoRemaining ?? 0) > 0;
            let configuredAction;
            let commandBranches;
            if (autoDance) {
              const preset = SKILL_PRESET_BY_ID.get('sword_dance');
              configuredAction = ensureAction({ ...preset, skillPresetId: 'sword_dance' }, 'ally');
              commandBranches = [{ nextReel: sc.reels[actor.index] ?? 0, commandName: 'つるぎの舞', probability: 1, directAction: true }];
            } else {
              ({ action: configuredAction } = resolveAction(turns, turnIndex, 'ally', actor.index));
              const transitions = commandTransitionsFor({
                characterId,
                skillPresetId: configuredAction.skillPresetId,
                skillName: configuredAction.skillName,
                startReel: sc.reels[actor.index] ?? 0,
                commandVariant: state.allies?.[actor.index]?.commandVariant ?? ''
              });
              if (!transitions && characterId && configuredAction.skillPresetId) missing.add(`${characterId}:${configuredAction.skillName}`);
              commandBranches = transitions ?? [{ nextReel: sc.reels[actor.index] ?? 0, commandName: configuredAction.skillName, probability: 1, directAction: true }];
            }

            for (const tr of commandBranches) {
              if (tr.probability <= 0) continue;
              const rt = cloneRuntimeState(baseRt);
              const reels = sc.reels.slice();
              reels[actor.index] = tr.nextReel;
              const weightedEnemyHp = scaleDistribution(sc.hpDist, tr.probability);
              // 味方側の〖EXゲージ+n〗も共有EXへ反映し、後続の〖ぬすむ〗が正しい量を参照できるようにする。
              addPlayerEx(rt, playerExGainFromCommandName(tr.commandName || configuredAction?.skillName));
              const rolled = tr.directAction ? { action: configuredAction, missing: '' } : actionForRolledCommand(tr.commandName, configuredAction);
              if (rolled.missing) missingEffects.add(rolled.missing);

              let actionBranches;
              const statusBlock = rolled.action ? actionBlockedByStatus(rt, actor.index, rolled.action, characterId) : '';
              if (!rolled.action || statusBlock) {
                actionBranches = [{ runtime: rt, hpDist: weightedEnemyHp }];
              } else {
                const actualSkillName = String(rolled.action.skillName ?? tr.commandName ?? '').trim();
                if (actualSkillName) {
                  allySkillActivation[turnIndex][actor.index][actualSkillName] =
                    (allySkillActivation[turnIndex][actor.index][actualSkillName] ?? 0) + distributionMass(weightedEnemyHp);
                }
                actionBranches = applyActivatedAllyAction(rt, weightedEnemyHp, rolled.action, actor.index, state);
                actionBranches = applyEnemyReactiveEffectsAfterAllyAction(actionBranches, actor.index, rolled.action);
              }

              for (const actionBranch of actionBranches) {
                const branchRuntime = actionBranch.runtime;
                branchRuntime.allies[actor.index].actionsTaken += 1;
                advanceProgressiveDecayAfterAction(branchRuntime, actor.index);
                finishAllyStatusOpportunity(branchRuntime, actor.index, true);
                expireSourceLinkedMods(branchRuntime, actor.index, 'end');
                const branchReels = reels.slice();
                applyPendingReelBoosts(branchRuntime, branchReels);
                next.push({ runtime: branchRuntime, reels: branchReels.slice(), enemyReel: sc.enemyReel ?? 0, companionReels: sc.companionReels?.slice() ?? [], hpDist: actionBranch.hpDist, order });
              }
            }
          } else if (actor.side === 'enemy') {
            // BOSSがすでに倒れている確率質量では敵側行動を発生させない。
            const { dead, live } = splitBossAliveDistribution(runtime, sc.hpDist);
            if (distributionMass(dead) > 0) {
              next.push({ runtime: cloneRuntimeState(runtime), reels: sc.reels.slice(), enemyReel: sc.enemyReel ?? 0, companionReels: sc.companionReels?.slice() ?? [], hpDist: dead, order });
            }
            if (distributionMass(live) <= 0) continue;

            const rawEnemyAction = turn.enemyAction ?? { enabled: false, effect: { type: 'none' } };
            // 麻痺は必ず次の行動機会を1回失って解除。EX10でもこの行動機会では発動しない。
            if (runtime.enemy?.paralysis) {
              const rt = cloneRuntimeState(runtime);
              rt.enemy.paralysis = false;
              const hp = applyPoison(rt, new Map(live));
              next.push({ runtime:rt, reels:sc.reels.slice(), enemyReel:sc.enemyReel ?? 0, companionReels:sc.companionReels?.slice() ?? [], hpDist:hp, order });
              continue;
            }
            // 敵EXが10の枝では、敵の行動機会にEXが発動した時点で周回失敗として確率質量を除外する。
            if (rawEnemyAction.enabled !== false && enemyExGauge(runtime) >= 10) {
              const failed = distributionMass(live);
              enemyExFailureChance += failed;
              enemyExFailureByTurn[turnIndex] += failed;
              continue;
            }
            if (rawEnemyAction.enabled === false) {
              const rt = cloneRuntimeState(runtime);
              const hp = applyPoison(rt, live);
              next.push({ runtime: rt, reels: sc.reels.slice(), enemyReel: sc.enemyReel ?? 0, companionReels: sc.companionReels?.slice() ?? [], hpDist: hp, order });
              continue;
            }

            // BOSSの通常行動機会を1回進める。即時再行動チェーンはここを通らないため、
            // オプティカルカモフラージュのホワイトミストは次の通常BOSS行動開始時まで正確に保持できる。
            beginEnemyCommandAction(runtime);

            // 〖フォーリン・ダウン〗成功後は、次の通常BOSS行動を倒した相手の召喚だけに使う。
            // 召喚後のコピー側の純粋ダメージは撃破率へ不要なので、ここではBOSSの行動消費だけを正確に反映する。
            if (runtime.enemy?.fallingDownSummonPending) {
              const rt = cloneRuntimeState(runtime);
              rt.enemy.fallingDownSummonPending = false;
              let hp = finishEnemyCommandAction(rt, new Map(live));
              hp = applyPoison(rt, hp);
              const branchReels = sc.reels.slice();
              applyPendingReelBoosts(rt, branchReels);
              next.push({ runtime:rt, reels:branchReels, enemyReel:sc.enemyReel ?? 0, companionReels:sc.companionReels?.slice() ?? [], hpDist:hp, order });
              continue;
            }

            // 秘宗重拳の溜めが残っていれば、このBOSS行動は500%攻撃の放出に使う。
            // 敵から味方への純粋ダメージは計算対象外なので、軽減を解除してコマンド再抽選をせず行動終了処理だけ行う。
            if (runtime.enemy?.charge) {
              const rt = cloneRuntimeState(runtime);
              clearEnemyCharge(rt);
              let hp = finishEnemyCommandAction(rt, new Map(live));
              hp = applyPoison(rt, hp);
              const branchReels = sc.reels.slice();
              applyPendingReelBoosts(rt, branchReels);
              next.push({ runtime:rt, reels:branchReels, enemyReel:sc.enemyReel ?? 0, companionReels:sc.companionReels?.slice() ?? [], hpDist:hp, order });
              continue;
            }

            const transitions = bossProfile ? enemyCommandTransitions(state.enemy?.presetId ?? '', sc.enemyReel ?? 0, runtime.enemy?.disabledCommands ?? []) : null;
            if (transitions?.length) {
              const chainBranches = executeBossCommandChain(
                runtime, live, state, state.enemy?.presetId ?? '', sc.enemyReel ?? 0,
                enemySkillActivation[turnIndex], missingEffects
              );
              for (const eb of chainBranches) {
                if (eb.runtime.enemy?.exTriggered) {
                  const failed = distributionMass(eb.hpDist);
                  enemyExFailureChance += failed;
                  enemyExFailureByTurn[turnIndex] += failed;
                  continue;
                }
                const afterEnd = finishEnemyCommandAction(eb.runtime, eb.hpDist);
                const hp = applyPoison(eb.runtime, afterEnd);
                const branchReels = sc.reels.slice();
                applyPendingReelBoosts(eb.runtime, branchReels);
                const shifted = applyPendingEnemyTeamReelShifts(
                  eb.runtime, eb.nextReel, sc.companionReels?.slice() ?? [], state.enemy?.presetId ?? ''
                );
                next.push({
                  runtime: eb.runtime, reels: branchReels,
                  enemyReel: shifted.enemyReel, companionReels: shifted.companionReels,
                  hpDist: hp, order
                });
              }
            } else {
              // コマンド未登録BOSSは従来の手動敵効果を維持する。
              const rt = cloneRuntimeState(runtime);
              let hp = new Map(live);
              let effect = rawEnemyAction.effect ?? { type: 'none' };
              if (effect.type === 'same') {
                for (let i = turnIndex - 1; i >= 0; i--) {
                  const prev = turns[i]?.enemyAction?.effect;
                  if (prev && prev.type !== 'same') { effect = prev; break; }
                }
                if (effect.type === 'same') effect = { type: 'none' };
              }
              const manualStatus = manualEnemyStatusSkill(effect);
              if (manualStatus) {
                const activationChance = Math.max(0, Math.min(100, Number(effect.activationChance ?? 100) || 0)) / 100;
                if (activationChance > 0) {
                  const label = `手動 ${Object.values(MANUAL_ENEMY_STATUS).includes(manualStatus.effects[0].status) ? manualStatus.effects[0].status : effect.type}`;
                  enemySkillActivation[turnIndex][label] = (enemySkillActivation[turnIndex][label] ?? 0) + distributionMass(live) * activationChance;
                }
                for (const mb of executeManualEnemyStatus(rt, hp, state, effect)) {
                  const afterEnd = finishEnemyCommandAction(mb.runtime, mb.hpDist);
                  const poisonedHp = applyPoison(mb.runtime, afterEnd);
                  const branchReels = sc.reels.slice();
                  applyPendingReelBoosts(mb.runtime, branchReels);
                  next.push({ runtime: mb.runtime, reels: branchReels, enemyReel: sc.enemyReel ?? 0, companionReels: sc.companionReels?.slice() ?? [], hpDist: poisonedHp, order });
                }
              } else {
                hp = enemyEffect(rt, effect, hp);
                hp = finishEnemyCommandAction(rt, hp);
                hp = applyPoison(rt, hp);
                const branchReels = sc.reels.slice();
                applyPendingReelBoosts(rt, branchReels);
                next.push({ runtime: rt, reels: branchReels, enemyReel: sc.enemyReel ?? 0, companionReels: sc.companionReels?.slice() ?? [], hpDist: hp, order });
              }
            }
          } else if (actor.side === 'companion') {
            // 固定編成のお供も独立した行動者として、素早さ順・初期コマンドから抽選する。
            // お供HPを個別追跡し、撃破済みのお供の確率質量ではその行動を発生させない。
            const { dead, live } = splitCompanionAliveDistribution(runtime, sc.hpDist, actor.index);
            if (distributionMass(dead) > 0) {
              next.push({ runtime: cloneRuntimeState(runtime), reels: sc.reels.slice(), enemyReel: sc.enemyReel ?? 0, companionReels: sc.companionReels?.slice() ?? [], hpDist: dead, order });
            }
            if (distributionMass(live) <= 0) continue;

            const rawEnemyAction = turn.enemyAction ?? { enabled:false, effect:{ type:'none' } };
            const preCompanion = runtime.companions?.[actor.index];
            if (preCompanion?.statuses?.paralysis) {
              const rt = cloneRuntimeState(runtime);
              delete rt.companions[actor.index].statuses.paralysis;
              const hp = applyCompanionPoison(rt, new Map(live), actor.index);
              next.push({ runtime:rt, reels:sc.reels.slice(), enemyReel:sc.enemyReel ?? 0, companionReels:sc.companionReels?.slice() ?? [], hpDist:hp, order });
              continue;
            }
            // 敵チームEXは共有。お供の行動機会でも10ならEX発動＝周回失敗とする。
            if (rawEnemyAction.enabled !== false && enemyExGauge(runtime) >= 10) {
              const failed = distributionMass(live);
              enemyExFailureChance += failed;
              enemyExFailureByTurn[turnIndex] += failed;
              continue;
            }
            if (rawEnemyAction.enabled === false) {
              next.push({ runtime: cloneRuntimeState(runtime), reels: sc.reels.slice(), enemyReel: sc.enemyReel ?? 0, companionReels: sc.companionReels?.slice() ?? [], hpDist:new Map(live), order });
              continue;
            }

            const companion = runtime.companions?.[actor.index];
            // BOSS行動で自爆・離脱したお供は、ターン開始時の行動順に残っていても行動しない。
            if (!companion || companion.active === false) {
              next.push({ runtime: cloneRuntimeState(runtime), reels: sc.reels.slice(), enemyReel: sc.enemyReel ?? 0, companionReels: sc.companionReels?.slice() ?? [], hpDist:new Map(live), order });
              continue;
            }
            const companionName = companion?.name ?? actor.name ?? '';
            // 〖ゆうらん〗: 発動後は次の自分の行動機会まで完全に対象外。
            // 次の行動で場へ戻ってHP100回復し、その行動は回復だけで終了する。
            if (companionIsOffField(companion)) {
              const rt = cloneRuntimeState(runtime);
              const returning = rt.companions[actor.index];
              const heal = Math.max(0, Math.trunc(Number(returning.excursion?.healValue ?? 0) || 0));
              delete returning.excursion;
              let hp = new Map(live);
              if (heal > 0 && Number.isInteger(returning.hpSlot)) {
                hp = addEnemyHpSlotDistribution(hp, returning.hpSlot, heal, Math.max(1, Number(returning.maxHp ?? 1)));
              }
              next.push({ runtime:rt, reels:sc.reels.slice(), enemyReel:sc.enemyReel ?? 0, companionReels:sc.companionReels?.slice() ?? [], hpDist:hp, order });
              continue;
            }
            // 通常のマジック・リフレクト系は「1ターン」。前回の行動で付与した反射は
            // このお供の次の行動機会開始時に解除し、この行動で再使用した場合だけ新たに付与する。
            if (companion.magicReflect) delete companion.magicReflect;
            if (companion.statuses?.sleep) {
              const rt = cloneRuntimeState(runtime);
              const sleeper = rt.companions[actor.index];
              const remaining = Math.max(0, Number(sleeper.statuses?.sleep?.remaining ?? 1) - 1);
              let hp = new Map(live);
              if (remaining > 0) {
                sleeper.statuses.sleep.remaining = remaining;
                // 〖寝る〗の加護は睡眠継続中の行動機会に回復。自動起床する5ターン目は回復しない。
                const heal = Math.max(0, trunc0(Number(sleeper.sleepBlessing?.amount ?? 0) || 0));
                if (heal > 0 && Number.isInteger(sleeper.hpSlot)) {
                  hp = addEnemyHpSlotDistribution(hp, sleeper.hpSlot, heal, Math.max(1, Number(sleeper.maxHp ?? 1)));
                }
              } else {
                clearCompanionSleep(sleeper);
              }
              next.push({ runtime:rt, reels:sc.reels.slice(), enemyReel:sc.enemyReel ?? 0, companionReels:sc.companionReels?.slice() ?? [], hpDist:hp, order });
              continue;
            }
            if (Number(companion.actionLockRemaining ?? 0) > 0) {
              const rt = cloneRuntimeState(runtime);
              rt.companions[actor.index].actionLockRemaining = Math.max(0, Number(rt.companions[actor.index].actionLockRemaining) - 1);
              next.push({ runtime:rt, reels:sc.reels.slice(), enemyReel:sc.enemyReel ?? 0, companionReels:sc.companionReels?.slice() ?? [], hpDist:new Map(live), order });
              continue;
            }
            const startReel = sc.companionReels?.[actor.index] ?? companion?.startReel ?? 0;
            const transitions = companionName ? enemyCompanionCommandTransitions(companionName, startReel) : null;
            if (!transitions?.length) {
              next.push({ runtime: cloneRuntimeState(runtime), reels: sc.reels.slice(), enemyReel: sc.enemyReel ?? 0, companionReels: sc.companionReels?.slice() ?? [], hpDist:new Map(live), order });
              continue;
            }

            const companionBranches = companionName === 'アヴァドンフード'
              ? executeCompanionCommandChain(
                  runtime, live, state, actor.index, startReel,
                  enemySkillActivation[turnIndex], missingEffects
                )
              : (() => {
                  const sourceMass = distributionMass(live);
                  const out = [];
                  for (const tr of transitions) {
                    if (tr.probability <= 0) continue;
                    const commandName = String(tr.commandName ?? '').trim();
                    const skill = enemyCompanionSkillForCommand(commandName, companionName);
                    const activationLabel = `お供:${companionName} / ${commandName || '移動'}`;
                    if (skill) {
                      enemySkillActivation[turnIndex][activationLabel] = (enemySkillActivation[turnIndex][activationLabel] ?? 0) + sourceMass * tr.probability;
                    } else if (!isStructuralOrNoEffectCommand(commandName) && commandName) {
                      missingEffects.add(`お供:${companionName}:${commandName}`);
                    }
                    const rt = cloneRuntimeState(runtime);
                    addEnemyEx(rt, enemyExGainFromCommandName(commandName));
                    rt.actingCompanionIndex = actor.index;
                    const weighted = scaleDistribution(live, tr.probability);
                    const branches = skill ? executeEnemySkill(rt, weighted, state, skill) : [{ runtime:rt, hpDist:weighted }];
                    for (const branch of branches) {
                      delete branch.runtime.actingCompanionIndex;
                      out.push({ runtime:branch.runtime, hpDist:branch.hpDist, nextReel:tr.nextReel });
                    }
                  }
                  return out;
                })();

            for (const eb of companionBranches) {
              const actingCompanion = eb.runtime.companions?.[actor.index];
              const speedGain = Number(actingCompanion?.postActionSpeedGain ?? 0);
              if (actingCompanion && speedGain) {
                actingCompanion.flatSpeedBonus = Number(actingCompanion.flatSpeedBonus ?? 0) + speedGain;
              }
              const postActionEnemyExGain = Math.max(0, Math.trunc(Number(actingCompanion?.postActionEnemyExGain ?? 0) || 0));
              if (postActionEnemyExGain) addEnemyEx(eb.runtime, postActionEnemyExGain);
              const baseCompanionReels = sc.companionReels?.slice() ?? [];
              baseCompanionReels[actor.index] = eb.nextReel ?? startReel;

              // 〖火に油を注ぐ〗や〖プリンセスのおうえん〗などの敵チーム内リール移動を行動終了後に反映する。
              const shifted = applyPendingEnemyTeamReelShifts(
                eb.runtime, sc.enemyReel ?? 0, baseCompanionReels, state.enemy?.presetId ?? ''
              );
              const enemyReel = shifted.enemyReel;
              const companionReels = shifted.companionReels;

              const branchReels = sc.reels.slice();
              applyPendingReelBoosts(eb.runtime, branchReels);
              // BOSS自身の加護・毒は進めないが、このお供自身の毒は行動終了時に進める。
              const companionHp = applyCompanionPoison(eb.runtime, eb.hpDist, actor.index);
              next.push({ runtime:eb.runtime, reels:branchReels, enemyReel, companionReels, hpDist:companionHp, order });
            }
          }
        }
        active = splitBrokenEnemyChargeScenarios(mergeScenarios(next));
        if (isFinalTurn && pos === lastAllyPosition) {
          finished.push(...active);
          active = [];
          break;
        }
      }
      if (active.length) {
        for (const sc of active) {
          sc.hpDist = advanceSummonCurses(sc.runtime, sc.hpDist);
          decrementTimedEffects(sc.runtime);
          // EXゲージは双方とも各ターン終了時に+1。最終ターンは最後の味方行動直後で計算を止めるため加算しない。
          if (!isFinalTurn && distributionMass(splitEnemyAliveDistribution(sc.hpDist).live) > 0) {
            addEnemyEx(sc.runtime, 1);
            if ((sc.runtime.allies ?? []).some(x => x?.active !== false)) addPlayerEx(sc.runtime, 1);
          }
        }
        finished.push(...active);
      }
    }
    // 離脱済みのお供はターン境界で配列から除き、召喚→自爆を繰り返すBOSSの履歴差だけによる枝爆発を防ぐ。
    scenarios = mergeScenarios(finished.map(compactInactiveCompanionsAtTurnBoundary));
    const combined = combinedHpDistribution(scenarios);
    const range = hpRange(combined);
    timeline.push({ turn: turnIndex + 1, label: `T${turnIndex + 1}終了`, kind: 'turn', killChance: killChance(combined), minLiveHp: range.min, maxLiveHp: range.max });
    statusSummaryByTurn.push(scenarioStatusSummary(scenarios, allyCount));
    scenarioCountByTurn.push(scenarios.length);
    if (isFinalTurn) break;
  }

  const hpDistribution = combinedHpDistribution(scenarios);
  const hasEnabledEnemyAction = turns.some(t => t?.enemyAction?.enabled !== false);
  const bossPresetForResult = BOSS_PRESET_BY_ID.get(state.enemy?.presetId ?? '');
  const presetCompanions = bossPresetForResult?.companions ?? [];
  const activeCompanionCommandProfiles = hasEnabledEnemyAction
    ? presetCompanions.filter(name => enemyCompanionProfile(name))
    : [];
  const missingCompanionCommandProfiles = hasEnabledEnemyAction
    ? presetCompanions.filter(name => !enemyCompanionProfile(name))
    : [];
  const inheritedCompanionCommandBaselines = activeCompanionCommandProfiles.filter(name => enemyCompanionProfile(name)?.inheritedBaseline);
  const playerExGaugeDistribution = new Map();
  const enemyExGaugeDistribution = new Map();
  for (const sc of scenarios) {
    const mass = distributionMass(sc.hpDist);
    const pg = playerExGauge(sc.runtime);
    const eg = enemyExGauge(sc.runtime);
    playerExGaugeDistribution.set(pg, (playerExGaugeDistribution.get(pg) ?? 0) + mass);
    enemyExGaugeDistribution.set(eg, (enemyExGaugeDistribution.get(eg) ?? 0) + mass);
  }
  return {
    killChance: killChance(hpDistribution),
    hpDistribution,
    timeline,
    finalTurn: turns.length,
    finalOrder: firstFinalOrder,
    missingCommandProfiles: [...missing],
    missingCommandEffects: [...missingEffects],
    missingEnemyCommandProfile: Boolean(state.enemy?.presetId && hasEnabledEnemyAction && !bossProfile),
    activeCompanionCommandProfiles,
    missingCompanionCommandProfiles,
    inheritedCompanionCommandBaselines,
    enemySkillActivation,
    allySkillActivation,
    statusSummaryByTurn,
    scenarioCountByTurn,
    enemyExFailureChance: Math.max(0, Math.min(1, enemyExFailureChance)),
    enemyExFailureByTurn,
    playerExGaugeDistribution,
    enemyExGaugeDistribution
  };
}

export function simulateKillProbability(state) {
  return hasAnyActivationModel(state) ? simulateKillProbabilityWithActivation(state) : simulateKillProbabilityLegacy(state);
}
