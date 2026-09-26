import { commandTransitionsFor, commandSkillNamesForCharacter } from './commands.js';
import {
  enemyBossProfile, enemyCommandTransitions, enemySkillForCommand,
  enemyCompanionProfile, enemyCompanionCommandTransitions, enemyCompanionSkillForCommand, enemyCompanionBaseHp
} from './enemy-actions.js';
import { BOSS_PRESET_BY_ID } from './boss-presets.js';
import { SKILL_PRESET_BY_ID, normalizeSkillName, presetIdForSkillName } from './presets.js';
import { OLD5_PRECOMPUTED_RESULTS, reviveOld5PrecomputedResult } from './old5-precomputed.js';
// 撃破確率シミュレータ v0.6.04
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
  ['physical', '物理'], ['magic', '魔法'], ['breath', 'ブレス'], ['other', 'それ以外']
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
  ['none', '効果なし／行動スキップ'],
  ['allyAtkDebuff', '攻撃デバフ'],
  ['allySpeedDebuff', '素早さデバフ'],
  ['enemyDefenseBuff', '防御バフ'],
  ['enemyDefenseDebuff', '防御デバフ'],
  ['enemyDamageReduction', '防御アップ'],
  ['enemyCounterGuard', 'カウンター（防御部分）'],
  ['enemyBlessing', '敵の加護'],
  ['enemySpeedBuff', '敵の素早さアップ'],
  ['heal', '回復']
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
  enemy: { presetId: '', bossOnlyVictory: false, maxHp: '1500', attribute: 'fire', race: 'normal', attack: '0', speed: '45', enemyExAllowance: '0' },
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
    docteur: { attack: '57', speed: '63' },
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
    red_magician: { attack: '73', speed: '68' },
    magician: { attack: '63', speed: '57' },
    beige: { attack: '21', speed: '94' },
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
  // 最終ターンをどこで打ち切るか。lastAlly=従来どおり最後の味方行動直後。
  finalTurnCutoff: 'lastAlly',
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

function oneHitDamageForRoll({
  attack, speed = 0, skillMultiplier, damageFormula = '', attackAttribute, attackAttribute2, attackAttributes, defenderAttribute, defenderRace,
  attackType, defenseMods, weaknessBoost
}, r) {
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

  // アプリ本体と同じく、乱数係数950～1050をダメージ本体へ直接乗算して整数化する。
  let damage = trunc0(base * (1000 + r) / 1000);
  damage = Math.min(damage, 999);
  // ダメージ計算チャートと同じ順序: 防御バフ/デバフ → 防御アップ（ダメージ軽減枠）。
  // 手動入力の時系列にかかわらず、この2層は別計算として各段階で整数化する。
  const ordinaryDefenseMods = (defenseMods ?? []).filter(mod => mod?.layer !== 'reduction');
  const reductionMods = (defenseMods ?? []).filter(mod => mod?.layer === 'reduction');
  damage = applyMods(damage, ordinaryDefenseMods, { clampMin: 0 });
  damage = applyMods(damage, reductionMods, { clampMin: 0 });
  return damage;
}

function oneHitDistribution(config) {

  const counts = new Map();
  for (let r = -50; r <= 50; r++) {
    const damage = oneHitDamageForRoll(config, r);
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

const ATTACK_DAMAGE_CACHE = new Map();
const ATTACK_DAMAGE_CACHE_MAX = 512;

function attackDamageCacheKey(config) {
  const defenseMods = [...(config.defenseMods ?? [])]
    .sort((a, b) => Number(a?.seq ?? 0) - Number(b?.seq ?? 0))
    .map(mod => [String(mod?.mode ?? 'mult'), String(mod?.value ?? ''), String(mod?.layer ?? 'defense')]);
  return JSON.stringify([
    config.attack, config.speed ?? 0, config.skillMultiplier ?? '', config.damageFormula ?? '',
    config.skillMultiplierMin ?? '', config.skillMultiplierMax ?? '', config.skillMultiplierStep ?? '',
    config.attackAttribute ?? '', config.attackAttribute2 ?? '', config.attackAttributes ?? null,
    config.defenderAttribute ?? '', config.defenderRace ?? '', config.attackType ?? '',
    defenseMods, Boolean(config.weaknessBoost), config.hits ?? '', config.hitsMin ?? '', config.hitsMax ?? ''
  ]);
}

export function attackDamageDistribution(config) {
  const cacheKey = attackDamageCacheKey(config);
  const cached = ATTACK_DAMAGE_CACHE.get(cacheKey);
  if (cached) return cached;
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
  const result = averageDistributions(totals);
  if (ATTACK_DAMAGE_CACHE.size >= ATTACK_DAMAGE_CACHE_MAX) ATTACK_DAMAGE_CACHE.clear();
  ATTACK_DAMAGE_CACHE.set(cacheKey, result);
  return result;
}

const MULTI_HP_PARTS_CACHE = new Map();
const MULTI_HP_PARTS_CACHE_MAX = 32768;
function multiHpParts(hp) {
  if (typeof hp !== 'string' || !hp.includes(',')) return null;
  const cached = MULTI_HP_PARTS_CACHE.get(hp);
  if (cached) return cached;
  const parts = hp.split(',').map(Number);
  if (!(parts.length > 1 && parts.every(Number.isFinite))) return null;
  if (MULTI_HP_PARTS_CACHE.size >= MULTI_HP_PARTS_CACHE_MAX) MULTI_HP_PARTS_CACHE.clear();
  MULTI_HP_PARTS_CACHE.set(hp, parts);
  return parts;
}

function multiHpKey(parts) {
  const n = parts.length;
  if (n === 2) return `${Math.max(0, trunc0(parts[0]))},${Math.max(0, trunc0(parts[1]))}`;
  if (n === 3) return `${Math.max(0, trunc0(parts[0]))},${Math.max(0, trunc0(parts[1]))},${Math.max(0, trunc0(parts[2]))}`;
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

function enemyExActivationCount(runtime) {
  return Math.max(0, Math.trunc(Number(runtime?.enemy?.exActivations ?? 0) || 0));
}

function enemyExIsAvailable(runtime) {
  const preset = BOSS_PRESET_BY_ID.get(String(runtime?.enemy?.presetId ?? ''));
  const required = Array.isArray(preset?.enemyExRequiresCompanionNames)
    ? preset.enemyExRequiresCompanionNames.filter(Boolean)
    : [];
  if (!required.length) return true;
  return (runtime?.companions ?? []).some(companion =>
    companion?.active !== false && required.includes(String(companion?.name ?? ''))
  );
}

function consumeAllowedEnemyEx(runtime) {
  runtime.enemy.exGauge = 0;
  runtime.enemy.exActivations = enemyExActivationCount(runtime) + 1;
  return runtime.enemy.exActivations;
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
  if (runtime?.ignorePlayerExTracking === true) return playerExGauge(runtime);
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

function bossPoisonState(runtime, slot = 0) {
  const count = bossHpSlotCount(runtime);
  if (count <= 1) return String(runtime?.enemy?.poison ?? 'none');
  const states = runtime?.enemy?.poisonByBoss;
  return Array.isArray(states) ? String(states[slot] ?? 'none') : String(runtime?.enemy?.poison ?? 'none');
}

function setBossPoisonState(runtime, slot, value) {
  const count = bossHpSlotCount(runtime);
  const next = String(value ?? 'none');
  if (count <= 1) {
    runtime.enemy.poison = next;
    return;
  }
  if (!Array.isArray(runtime.enemy.poisonByBoss) || runtime.enemy.poisonByBoss.length !== count) {
    const fallback = String(runtime.enemy.poison ?? 'none');
    runtime.enemy.poisonByBoss = Array.from({ length: count }, () => fallback);
  }
  if (slot >= 0 && slot < count) runtime.enemy.poisonByBoss[slot] = next;
  // Keep the legacy scalar synchronized with slot 0 for code paths that only support a single BOSS.
  runtime.enemy.poison = runtime.enemy.poisonByBoss[0] ?? 'none';
}

function clearAllBossPoison(runtime) {
  const count = bossHpSlotCount(runtime);
  runtime.enemy.poison = 'none';
  if (count > 1) runtime.enemy.poisonByBoss = Array(count).fill('none');
}

function enemyUnitPoisonState(runtime, slot = 0) {
  if (slot < bossHpSlotCount(runtime)) return bossPoisonState(runtime, slot);
  const companionIndex = companionIndexForHpSlot(runtime, slot);
  return String(runtime?.companions?.[companionIndex]?.poison ?? 'none');
}

function poisonConditionalSkillMultiplier(runtime, action, slot, fallback) {
  const poison = enemyUnitPoisonState(runtime, slot);
  if (poison === 'deadlyPoison' && String(action?.deadlyPoisonSkillMultiplier ?? '') !== '') {
    return action.deadlyPoisonSkillMultiplier;
  }
  if (poison !== 'none' && String(action?.poisonedSkillMultiplier ?? '') !== '') {
    return action.poisonedSkillMultiplier;
  }
  return fallback;
}

function hasPoisonConditionalSkillMultiplier(action) {
  return String(action?.poisonedSkillMultiplier ?? '') !== ''
    || String(action?.deadlyPoisonSkillMultiplier ?? '') !== '';
}

function enemyHpPartArray(hp) {
  const parts = multiHpParts(hp);
  return parts ? parts.slice() : [Math.max(0, Number(hp) || 0)];
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
  if (String(action?.attackType ?? '') !== 'physical' || !(runtime.companions?.length)) return [{ runtime, hpDist }];

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


function compactCompanionTransitionsForKillProbability(companionName, transitions, runtime) {
  if (runtime?.ignorePlayerExTracking !== true || !Array.isArray(transitions) || transitions.length < 2) return transitions;
  const grouped = new Map();
  for (const tr of transitions) {
    const commandName = String(tr?.commandName ?? '').trim();
    const skill = commandName ? enemyCompanionSkillForCommand(commandName, companionName) : null;
    const hasSleepingAlly = (runtime?.allies ?? []).some(ally => ally?.active !== false && Boolean(ally?.statuses?.sleep));
    const pureAttack = skill?.kind === 'attack'
      && !(skill?.effects?.length)
      && Number(skill?.enemyExGain ?? 0) === 0
      && Number(skill?.enemyExSpend ?? 0) === 0
      // 物理攻撃は睡眠中の味方を起こすため、睡眠が存在する枝では省略不可。
      && !(skill?.attackType === 'physical' && hasSleepingAlly);
    // 撃破確率モデルは味方HPを追跡しないため、フェンリルの〖うなる〗による
    // 自身ATK強化は以後の敵→味方ダメージしか変えず、撃破/敵EX判定には影響しない。
    // 同じnextReelの純粋攻撃と厳密に同値として統合する。
    const killProbabilityOnlyInertEffect = companionName === 'フェンリル' && commandName === 'うなる';
    const inert = isStructuralOrNoEffectCommand(commandName) || pureAttack || killProbabilityOnlyInertEffect;
    if (!inert) {
      grouped.set(`raw:${grouped.size}:${tr.nextReel}:${commandName}`, {
        ...tr,
        activationBreakdown:[{ commandName, probability:tr.probability }]
      });
      continue;
    }
    const key = `inert:${Number(tr.nextReel ?? 0)}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.probability += tr.probability;
      existing.activationBreakdown.push({ commandName, probability:tr.probability });
    } else {
      grouped.set(key, {
        nextReel:tr.nextReel ?? 0,
        commandName:'',
        probability:tr.probability,
        activationBreakdown:[{ commandName, probability:tr.probability }]
      });
    }
  }
  return [...grouped.values()];
}

function normalizedFenrirStateDist(weightMap, total) {
  if (!(total > 0)) return [];
  const out = [];
  for (const [key, mass] of weightMap) {
    if (!(mass > 0)) continue;
    const [reel, sleep] = key.split(',').map(Number);
    out.push([reel, sleep, mass / total]);
  }
  out.sort((a,b) => a[0] - b[0] || a[1] - b[1]);
  return out;
}

function executeKujeskaFenrirMarkov(runtime, hpDist, state, companionIndex, activationBucket, missingEffects) {
  const companion = runtime?.companions?.[companionIndex];
  const stateDist = companion?.fenrirStateDist;
  if (!Array.isArray(stateDist) || !stateDist.length) return null;
  const sourceMass = distributionMass(hpDist);
  const outcome = new Map(); // key: quiet | howl | wake:<ally>
  const addState = (outcomeKey, reel, sleep, mass) => {
    if (!(mass > 0)) return;
    let bucket = outcome.get(outcomeKey);
    if (!bucket) { bucket = { mass:0, states:new Map() }; outcome.set(outcomeKey, bucket); }
    bucket.mass += mass;
    const sk = `${reel},${sleep}`;
    bucket.states.set(sk, (bucket.states.get(sk) ?? 0) + mass);
  };
  const activeTargets = enemyTargetIndexes(runtime, 'random');
  for (const item of stateDist) {
    const reel = Math.max(0, Math.trunc(Number(item?.[0] ?? 0) || 0));
    const sleep = Math.max(0, Math.trunc(Number(item?.[1] ?? 0) || 0));
    const stateProbability = Math.max(0, Number(item?.[2] ?? 0) || 0);
    if (!(stateProbability > 0)) continue;
    if (sleep > 0) {
      addState('quiet', reel, Math.max(0, sleep - 1), stateProbability);
      continue;
    }
    const transitions = enemyCompanionCommandTransitions('フェンリル', reel) ?? [];
    for (const tr of transitions) {
      const tp = stateProbability * Math.max(0, Number(tr?.probability ?? 0) || 0);
      if (!(tp > 0)) continue;
      const commandName = String(tr?.commandName ?? '').trim();
      const nextReel = Math.max(0, Math.trunc(Number(tr?.nextReel ?? reel) || 0));
      if (commandName) {
        const label = `お供:フェンリル / ${commandName}`;
        activationBucket[label] = (activationBucket[label] ?? 0) + sourceMass * tp;
      }
      if (commandName === 'ほえる') {
        addState('howl', nextReel, 0, tp);
        continue;
      }
      if (commandName === '寝る') {
        addState('quiet', nextReel, 4, tp);
        continue;
      }
      const skill = commandName ? enemyCompanionSkillForCommand(commandName, 'フェンリル') : null;
      const physicalWake = skill?.kind === 'attack' && skill?.attackType === 'physical'
        && activeTargets.some(i => Boolean(runtime.allies?.[i]?.statuses?.sleep));
      if (physicalWake && activeTargets.length) {
        const tw = tp / activeTargets.length;
        for (const allyIndex of activeTargets) {
          const key = runtime.allies?.[allyIndex]?.statuses?.sleep ? `wake:${allyIndex}` : 'quiet';
          addState(key, nextReel, 0, tw);
        }
      } else {
        // ミス・通常攻撃・うなる等。味方HPを追跡しない標準チャートでは外部状態を変えない。
        addState('quiet', nextReel, 0, tp);
      }
    }
  }
  const out = [];
  const howlSkill = enemyCompanionSkillForCommand('ほえる', 'フェンリル');
  for (const [outcomeKey, bucket] of outcome) {
    if (!(bucket.mass > 0)) continue;
    const rt = cloneRuntimeState(runtime);
    const c = rt.companions?.[companionIndex];
    if (!c) continue;
    c.fenrirStateDist = normalizedFenrirStateDist(bucket.states, bucket.mass);
    let weighted = scaleDistribution(hpDist, bucket.mass);
    if (outcomeKey.startsWith('wake:')) {
      const allyIndex = Number(outcomeKey.slice(5));
      if (Number.isInteger(allyIndex) && rt.allies?.[allyIndex]?.statuses?.sleep) delete rt.allies[allyIndex].statuses.sleep;
      out.push({ runtime:rt, hpDist:weighted, nextReel:0 });
      continue;
    }
    if (outcomeKey === 'howl' && howlSkill) {
      rt.actingCompanionIndex = companionIndex;
      const branches = executeEnemySkill(rt, weighted, state, howlSkill);
      for (const branch of branches) {
        delete branch.runtime.actingCompanionIndex;
        out.push({ runtime:branch.runtime, hpDist:branch.hpDist, nextReel:0 });
      }
      continue;
    }
    out.push({ runtime:rt, hpDist:weighted, nextReel:0 });
  }
  return mergeRuntimeBranches(out);
}

function clearCompanionAttackEvasionFlags(runtime) {
  for (const companion of runtime?.companions ?? []) delete companion.evadedCurrentAllyAttack;
}

function allyTargetedEnemySlots(runtime, hp, action = {}) {
  if (bossHpSlotCount(runtime) === 1 && (runtime.companions?.length ?? 0) === 0) {
    if (enemyHpDefeated(hp)) return [];
    const targetMode = action?.enemyTarget ?? 'single';
    if (targetMode === 'all' || targetMode === 'random') return [0];
    return runtime?.enemy?.singleTargetUntargetable ? [] : [0];
  }
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
  // ランダム攻撃は各ヒットごとに、この候補全体から等確率で1体を選ぶ。
  // この関数を回避枝の事前生成にも使うため、randomでは候補一覧を返す。
  if (targetMode === 'random') return eligible;
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
  if ((runtime.companions?.length ?? 0) === 0) return Math.max(0, trunc0(damage));
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
  if (!parts) {
    // 単体BOSSがオプティカルカモフラージュ等で「単体選択不可」の間は、
    // 単体選択攻撃には有効な対象が存在しない。ランダム／全体攻撃は従来どおり命中可能。
    if (targetMode === 'single' && runtime?.enemy?.singleTargetUntargetable) return hp;
    return Math.max(0, hp - damage);
  }
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

const SINGLE_BOSS_HP_TRANSFORM_CACHE = new WeakMap();
const SINGLE_BOSS_HP_TRANSFORM_CACHE_MAX = 256;
const DAMAGE_DIST_DENSE_CACHE = new WeakMap();

function denseDamageDistribution(damageDist) {
  const cached = DAMAGE_DIST_DENSE_CACHE.get(damageDist);
  if (cached) return cached;
  const damages = new Int32Array(damageDist.size);
  const probabilities = new Float64Array(damageDist.size);
  let i = 0;
  for (const [damage, probability] of damageDist) {
    damages[i] = Math.max(0, Math.trunc(Number(damage) || 0));
    probabilities[i] = Number(probability) || 0;
    i += 1;
  }
  const out = Object.freeze({ damages, probabilities });
  DAMAGE_DIST_DENSE_CACHE.set(damageDist, out);
  return out;
}

function cachedSingleBossHpTransform(hpDist, damageDist, runtime, action) {
  const sourceMass = distributionMass(hpDist);
  if (!(sourceMass > 0)) return null;
  let byHp = SINGLE_BOSS_HP_TRANSFORM_CACHE.get(damageDist);
  if (!byHp) {
    byHp = new Map();
    SINGLE_BOSS_HP_TRANSFORM_CACHE.set(damageDist, byHp);
  }
  const hpKey = exactNormalizedHpDistributionKey(hpDist);
  // damageDist は attackDamageDistribution() 側ですでにBOSSの防御補正を含み、
  // そのキャッシュidentity自体が攻撃力・属性・BOSS防御状態まで区別している。
  // slot 0 (BOSS) にはお供固有防御の追加補正も無いため、同じdamageDist identity内では
  // HP分布だけが変換結果を決める。707要素級のdamageKey文字列を枝ごとに再生成しない。
  const cacheKey = hpKey;
  const cached = byHp.get(cacheKey);
  if (cached) return { cached, sourceMass };

  const denseDamage = denseDamageDistribution(damageDist);
  const damages = denseDamage.damages;
  const damageProbabilities = denseDamage.probabilities;
  let maxLiveHp = 0;
  let alreadyDeadMass = 0;
  for (const [hp, hpProb] of hpDist) {
    if (!(hpProb > 0)) continue;
    const currentHp = Math.max(0, Math.trunc(Number(hp) || 0));
    if (currentHp <= 0) alreadyDeadMass += hpProb;
    else if (currentHp > maxLiveHp) maxLiveHp = currentHp;
  }
  const survivedDense = new Float64Array(maxLiveHp + 1);
  let defeatedMass = 0;
  for (const [hp, hpProb] of hpDist) {
    if (!(hpProb > 0)) continue;
    const currentHp = Math.max(0, Math.trunc(Number(hp) || 0));
    if (currentHp <= 0) continue;
    for (let i = 0; i < damages.length; i++) {
      const nextHp = currentHp - damages[i];
      const probability = hpProb * damageProbabilities[i];
      if (nextHp <= 0) defeatedMass += probability;
      else survivedDense[nextHp] += probability;
    }
  }
  const survived = new Map();
  for (let hp = 1; hp <= maxLiveHp; hp++) {
    const probability = survivedDense[hp];
    if (probability !== 0) survived.set(hp, probability / sourceMass);
  }
  if (survived.size) exactNormalizedHpDistributionKey(survived);
  const result = Object.freeze({
    survived,
    alreadyDeadFraction: alreadyDeadMass / sourceMass,
    defeatedFraction: defeatedMass / sourceMass
  });
  if (byHp.size >= SINGLE_BOSS_HP_TRANSFORM_CACHE_MAX) byHp.clear();
  byHp.set(cacheKey, result);
  return { cached:result, sourceMass };
}


// v0.5.85: BOSS＋お供1〜2体への通常単体攻撃用HP変換キャッシュ。
// クジェスカ戦のように「固定お供を狙い、倒れたらBOSSへフォールバック」する攻撃は、
// 味方状態異常やリール状態だけが違う多数の枝で同じHP畳み込みを繰り返す。
// HP・対象slot・撃破数→敵EX増加だけを抽象化して再利用し、runtime副作用は各枝で適用する。
const SMALL_ENEMY_SINGLE_TARGET_CACHE = new Map();
const SMALL_ENEMY_SINGLE_TARGET_CACHE_MAX = 512;
// 防御補正の無いお供では、attackDamageDistribution() が返す damageDist identity をそのまま再利用する。
// 巨大な damageKey 文字列と slot 別配列を枝ごとに再生成しない。
const SMALL_ENEMY_SINGLE_TARGET_IDENTITY_CACHE = new WeakMap();
const SMALL_ENEMY_SINGLE_TARGET_IDENTITY_CACHE_MAX = 8192;
let SMALL_CACHE_HITS=0, SMALL_CACHE_MISSES=0; const SMALL_CACHE_BY_ACTION = new Map();

function canUseSmallEnemySingleTargetCache(runtime, hpDist, action) {
  const mode = action?.enemyTarget ?? 'single';
  if (mode === 'all' || mode === 'random') return false;
  const companions = runtime?.companions ?? [];
  if (bossHpSlotCount(runtime) !== 1 || companions.length < 1 || companions.length > 2) return false;
  if (runtime?.enemy?.singleTargetUntargetable) return false;
  if (action?.attackType === 'physical' && Math.max(0, Number(runtime.enemy?.physicalEvasion?.chance ?? 0) || 0) > 0) return false;
  for (const companion of companions) {
    if (!companion) continue;
    if (companionIsOffField(companion) || companion.evadedCurrentAllyAttack) return false;
    if (companion.oneHitGuard && companionOneHitGuardBlocksAllyAttack(companion, action)) return false;
    if (companionReflectsAllyAttack(companion, action) || companionNegatesAllyAttack(companion, action)) return false;
  }
  if (action?.attackType === 'physical') {
    const preferredRaw = action?.enemyTargetSlot ?? 'auto';
    const preferred = preferredRaw === 'auto' || preferredRaw === '' || preferredRaw == null ? -1 : Math.trunc(Number(preferredRaw));
    if (preferred >= 1) {
      const targetCompanion = companions.find(c => Number(c?.hpSlot) === preferred);
      if (targetCompanion?.statuses?.sleep) return false;
    }
  }
  const attrs = attackAttributesFromConfig(action ?? {});
  const activeMods = applicableDefenseMods(runtime.enemy?.defenseMods ?? [], String(action?.attackType ?? 'physical'), attrs);
  if (activeMods.some(mod => Math.max(0, Number(mod?.onHitEnemyExGain ?? 0) || 0) > 0
      || Math.max(0, Number(mod?.onHitPlayerExLoss ?? 0) || 0) > 0)) return false;
  const expectedSlots = Math.max(1 + companions.length, Math.max(1, Math.trunc(Number(runtime?.enemy?.hpSlotCount ?? 1) || 1)));
  for (const [hp, probability] of hpDist ?? []) {
    if (!(probability > 0) || enemyHpDefeated(hp)) continue;
    const parts = multiHpParts(hp);
    if (!parts || parts.length !== expectedSlots) return false;
  }
  return true;
}

function smallEnemyHpKeyAfterSingleHit(parts, target, nextTargetHp) {
  const n = parts.length;
  if (n === 2) return target === 0 ? `${nextTargetHp},${parts[1]}` : `${parts[0]},${nextTargetHp}`;
  if (n === 3) {
    if (target === 0) return `${nextTargetHp},${parts[1]},${parts[2]}`;
    if (target === 1) return `${parts[0]},${nextTargetHp},${parts[2]}`;
    return `${parts[0]},${parts[1]},${nextTargetHp}`;
  }
  const next = parts.slice();
  next[target] = nextTargetHp;
  return multiHpKey(next);
}

function companionAliveMaskAfterSingleHit(runtime, parts, target, nextTargetHp) {
  let out = '';
  for (const companion of runtime?.companions ?? []) {
    if (!companion || companion.active === false) { out += '0'; continue; }
    const slot = Number(companion.hpSlot);
    if (!Number.isInteger(slot) || slot < 0) { out += '1'; continue; }
    const hp = slot === target ? nextTargetHp : Number(parts[slot] ?? 0);
    out += hp > 0 ? '1' : '0';
  }
  return out;
}

function buildSmallEnemyAbstractGroups(runtime, hpDist, sourceMass, preferred, hitCount, slotCount, damageForSlot) {
  const grouped = new Map();
  for (const [hp, hpProbability] of hpDist) {
    if (!(hpProbability > 0)) continue;
    const parts = enemyHpPartArray(hp);
    if (enemyHpDefeated(hp)) {
      const dead = parts.map(() => 0);
      const key = multiHpKey(dead);
      const mask = companionAliveMask(runtime, key);
      const gk = `0|${mask}|`;
      const bucket = grouped.get(gk) ?? { gain:0, hitSlots:[], sampleHp:key, dist:new Map() };
      bucket.dist.set(key, (bucket.dist.get(key) ?? 0) + hpProbability / sourceMass);
      grouped.set(gk, bucket);
      continue;
    }
    let target = -1;
    if (Number.isInteger(preferred) && preferred >= 0 && Number(parts[preferred] ?? 0) > 0) target = preferred;
    else {
      for (let slot=0; slot<parts.length; slot++) {
        if (Number(parts[slot] ?? 0) > 0) { target = slot; break; }
      }
    }
    if (target < 0) continue;

    const before = Math.max(0, Number(parts[target] ?? 0));
    const aliveMask = companionAliveMaskAfterSingleHit(runtime, parts, target, Math.max(1, before));
    const deadMask = companionAliveMaskAfterSingleHit(runtime, parts, target, 0);
    const aliveGain = hitCount;
    const deadGain = hitCount + 1;
    const aliveKey = `${aliveGain}|${aliveMask}|${target}`;
    const deadKey = `${deadGain}|${deadMask}|${target}`;
    let aliveBucket = grouped.get(aliveKey);
    let deadBucket = grouped.get(deadKey);
    const sourceWeight = hpProbability / sourceMass;
    const dist = damageForSlot(target);

    const addDamage = (damage, damageProbability) => {
      if (!(damageProbability > 0)) return;
      const nextTargetHp = Math.max(0, before - damage);
      const nextHp = smallEnemyHpKeyAfterSingleHit(parts, target, nextTargetHp);
      const defeated = before > 0 && nextTargetHp <= 0;
      let bucket;
      if (defeated) {
        if (!deadBucket) {
          deadBucket = { gain:deadGain, hitSlots:[target], sampleHp:nextHp, dist:new Map() };
          grouped.set(deadKey, deadBucket);
        }
        bucket = deadBucket;
      } else {
        if (!aliveBucket) {
          aliveBucket = { gain:aliveGain, hitSlots:[target], sampleHp:nextHp, dist:new Map() };
          grouped.set(aliveKey, aliveBucket);
        }
        bucket = aliveBucket;
      }
      const p = sourceWeight * damageProbability;
      bucket.dist.set(nextHp, (bucket.dist.get(nextHp) ?? 0) + p);
    };

    if (dist.damages) {
      const damages = dist.damages, probs = dist.probabilities;
      for (let i=0; i<damages.length; i++) addDamage(damages[i], probs[i]);
    } else {
      for (const [damage, damageProbability] of dist) addDamage(damage, damageProbability);
    }
  }
  return [...grouped.values()];
}

function applySmallEnemySingleTargetCache(runtime, hpDist, damageDist, action, hits) {
  const __sid = String(action?.skillPresetId ?? action?.skillName ?? '');
  const sourceMass = distributionMass(hpDist);
  if (!(sourceMass > 0)) return [];
  const companions = runtime.companions ?? [];
  const slotCount = Math.max(1 + companions.length, Math.max(1, Math.trunc(Number(runtime?.enemy?.hpSlotCount ?? 1) || 1)));
  const preferredRaw = action?.enemyTargetSlot ?? 'auto';
  const preferred = preferredRaw === 'auto' || preferredRaw === '' || preferredRaw == null ? -1 : Math.trunc(Number(preferredRaw));
  const hitCount = Math.max(1, Math.trunc(Number(hits ?? 1) || 1));
  const hpKey = exactNormalizedHpDistributionKey(hpDist);

  const noCompanionDefense = companions.every(c => (c?.defenseMods?.length ?? 0) === 0);
  let abstractGroups;

  if (noCompanionDefense) {
    let byHp = SMALL_ENEMY_SINGLE_TARGET_IDENTITY_CACHE.get(damageDist);
    if (!byHp) {
      byHp = new Map();
      SMALL_ENEMY_SINGLE_TARGET_IDENTITY_CACHE.set(damageDist, byHp);
    }
    const cacheKey = `${slotCount}|${preferred}|${hitCount}|${hpKey}`;
    abstractGroups = byHp.get(cacheKey);
    if (abstractGroups) { SMALL_CACHE_HITS++; const q=SMALL_CACHE_BY_ACTION.get(__sid)??[0,0]; q[0]++; SMALL_CACHE_BY_ACTION.set(__sid,q); }
    if (!abstractGroups) {
      SMALL_CACHE_MISSES++; const q=SMALL_CACHE_BY_ACTION.get(__sid)??[0,0]; q[1]++; SMALL_CACHE_BY_ACTION.set(__sid,q);
      const dense = denseDamageDistribution(damageDist);
      abstractGroups = buildSmallEnemyAbstractGroups(runtime, hpDist, sourceMass, preferred, hitCount, slotCount, () => dense);
      if (byHp.size >= SMALL_ENEMY_SINGLE_TARGET_IDENTITY_CACHE_MAX) byHp.clear();
      byHp.set(cacheKey, abstractGroups);
    }
  } else {
    // お供固有の防御補正がある一般ケースだけ、slot別ダメージ分布をキーへ含める。
    const damageBySlot = Array.from({ length:slotCount }, (_, slot) => {
      const out = new Map();
      for (const [damage, probability] of damageDist) {
        if (!(probability > 0)) continue;
        const adjusted = Math.max(0, Math.trunc(adjustedAllyDamageForEnemySlot(runtime, slot, damage, action)));
        out.set(adjusted, (out.get(adjusted) ?? 0) + probability);
      }
      return [...out.entries()];
    });
    const damageKey = damageBySlot.map(dist => dist.map(([d,p]) => `${d}:${p}`).join(',')).join('/');
    const cacheKey = `${slotCount}|${preferred}|${hitCount}|${damageKey}|${hpKey}`;
    abstractGroups = SMALL_ENEMY_SINGLE_TARGET_CACHE.get(cacheKey);
    if (!abstractGroups) {
      abstractGroups = buildSmallEnemyAbstractGroups(runtime, hpDist, sourceMass, preferred, hitCount, slotCount, slot => damageBySlot[slot]);
      if (SMALL_ENEMY_SINGLE_TARGET_CACHE.size >= SMALL_ENEMY_SINGLE_TARGET_CACHE_MAX) SMALL_ENEMY_SINGLE_TARGET_CACHE.clear();
      SMALL_ENEMY_SINGLE_TARGET_CACHE.set(cacheKey, abstractGroups);
    }
  }

  return abstractGroups.map(group => {
    const rt = cloneRuntimeState(runtime);
    rt.lastAllyAttackHitSlots = group.hitSlots.slice();
    addEnemyEx(rt, group.gain);
    applyEnemyDefenseOnHitEx(rt, action, group.hitSlots, hitCount);
    consumeCompanionOneHitGuards(rt, group.sampleHp, action);
    syncCompanionActivityFromHp(rt, group.sampleHp);
    wakeCompanionsHitByPhysicalAllyAttack(rt, group.sampleHp, action);
    return { runtime:rt, hpDist:scaleDistribution(group.dist, sourceMass) };
  });
}

function applyAllyAttackWithEnemyEx(runtime, hpDist, damageDist, action, hits) {
  const targetMode = action?.enemyTarget ?? 'single';
  const targetSlot = action?.enemyTargetSlot ?? 'auto';

  // v0.5.76: BOSS1体・お供なしの通常戦では、対象判定・生存mask・複数HP文字列処理は不要。
  // このケースは大半のBOSS戦を占めるため、数値HPの畳み込みを専用ホットパスで処理する。
  // EX差は「生存」と「この攻撃で撃破」の2種類だけなので、runtimeも最大2枝で済む。
  if (bossHpSlotCount(runtime) === 1 && (runtime.companions?.length ?? 0) === 0) {
    const firstHp = hpDist.keys().next().value;
    const numericHp = firstHp == null || typeof firstHp === 'number';
    const bossTargetable = targetMode === 'all' || !runtime.enemy?.singleTargetUntargetable;
    if (numericHp && bossTargetable) {
      // 同じdamageDist・同じ正規化HP分布ならHP変換は完全に同値。
      // 敵EXゲージなどruntime差は変換後に適用し、確率値を変えずに再利用する。
      const transformed = cachedSingleBossHpTransform(hpDist, damageDist, runtime, action);
      if (!transformed) return [];
      const { cached, sourceMass } = transformed;
      const out = [];
      if (cached.alreadyDeadFraction > 0) {
        const deadDist = new Map([[0, cached.alreadyDeadFraction * sourceMass]]);
        HP_DEFEAT_STATE_CACHE.set(deadDist, 'dead');
        out.push({ runtime, hpDist:deadDist });
      }
      if (cached.survived.size) {
        const rt = cloneRuntimeState(runtime);
        rt.lastAllyAttackHitSlots = [0];
        addEnemyEx(rt, Math.max(1, Math.trunc(Number(hits ?? 1) || 1)));
        applyEnemyDefenseOnHitEx(rt, action, [0], hits);
        const survivedDist = scaleDistribution(cached.survived, sourceMass);
        HP_DEFEAT_STATE_CACHE.set(survivedDist, 'live');
        out.push({ runtime:rt, hpDist:survivedDist });
      }
      if (cached.defeatedFraction > 0) {
        const rt = cloneRuntimeState(runtime);
        rt.lastAllyAttackHitSlots = [0];
        addEnemyEx(rt, Math.max(1, Math.trunc(Number(hits ?? 1) || 1)) + 1);
        applyEnemyDefenseOnHitEx(rt, action, [0], hits);
        const defeated = new Map([[0, cached.defeatedFraction * sourceMass]]);
        HP_DEFEAT_STATE_CACHE.set(defeated, 'dead');
        out.push({ runtime:rt, hpDist:defeated });
      }
      return out;
    }
  }

  // v0.5.81: 死亡済みお供のHPスロットだけが残っている場合も、実質BOSS単体なら
  // 数値HPの高速畳み込みを使う。同一ターン内でお供が倒れた直後（例: サッカーラ戦のベージ）に
  // [BOSS HP,0] を複数敵汎用ループへ戻す必要はない。runtime/HPスロット自体は維持するため、
  // 蘇生等の後続仕様を変えず、HP変換だけを単体専用キャッシュへ委譲する。
  if (bossHpSlotCount(runtime) === 1 && (runtime.companions?.length ?? 0) > 0) {
    const slotCount = 1 + (runtime.companions?.length ?? 0);
    let bossOnlyTargetable = true;
    const numericHpDist = new Map();
    for (const [hp, probability] of hpDist) {
      if (!(probability > 0)) continue;
      const parts = multiHpParts(hp);
      if (!parts || parts.length !== slotCount) { bossOnlyTargetable = false; break; }
      for (let slot = 1; slot < parts.length; slot++) {
        if (Number(parts[slot] ?? 0) > 0) { bossOnlyTargetable = false; break; }
      }
      if (!bossOnlyTargetable) break;
      const bossHp = Math.max(0, Math.trunc(Number(parts[0] ?? 0) || 0));
      numericHpDist.set(bossHp, (numericHpDist.get(bossHp) ?? 0) + probability);
    }
    if (bossOnlyTargetable) {
      const bossTargetable = targetMode === 'all' || !runtime.enemy?.singleTargetUntargetable;
      if (bossTargetable) {
        const transformed = cachedSingleBossHpTransform(numericHpDist, damageDist, runtime, action);
        if (transformed) {
          const { cached, sourceMass } = transformed;
          const deadKey = multiHpKey(Array(slotCount).fill(0));
          const out = [];
          if (cached.alreadyDeadFraction > 0) {
            const deadDist = new Map([[deadKey, cached.alreadyDeadFraction * sourceMass]]);
            HP_DEFEAT_STATE_CACHE.set(deadDist, 'dead');
            out.push({ runtime, hpDist:deadDist });
          }
          if (cached.survived.size) {
            const rt = cloneRuntimeState(runtime);
            rt.lastAllyAttackHitSlots = [0];
            addEnemyEx(rt, Math.max(1, Math.trunc(Number(hits ?? 1) || 1)));
            applyEnemyDefenseOnHitEx(rt, action, [0], hits);
            const survivedDist = new Map();
            for (const [bossHp, probability] of cached.survived) {
              const parts = Array(slotCount).fill(0); parts[0] = bossHp;
              survivedDist.set(multiHpKey(parts), probability * sourceMass);
            }
            HP_DEFEAT_STATE_CACHE.set(survivedDist, 'live');
            out.push({ runtime:rt, hpDist:survivedDist });
          }
          if (cached.defeatedFraction > 0) {
            const rt = cloneRuntimeState(runtime);
            rt.lastAllyAttackHitSlots = [0];
            addEnemyEx(rt, Math.max(1, Math.trunc(Number(hits ?? 1) || 1)) + 1);
            applyEnemyDefenseOnHitEx(rt, action, [0], hits);
            const defeated = new Map([[deadKey, cached.defeatedFraction * sourceMass]]);
            HP_DEFEAT_STATE_CACHE.set(defeated, 'dead');
            out.push({ runtime:rt, hpDist:defeated });
          }
          return out;
        }
      }
    }
  }

  if (canUseSmallEnemySingleTargetCache(runtime, hpDist, action)) {
    return applySmallEnemySingleTargetCache(runtime, hpDist, damageDist, action, hits);
  }

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


// ランダム多段でも「生存対象がBOSS1体だけ」で、BOSSにヒット単位回避が無い場合は
// 各ヒットの対象抽選結果が常に同じになる。HP分布は多段畳み込みで完全に同値なので、
// ヒットごとの枝展開を省略できる。撃破枝のEX差は戦闘終了後には影響しない。
function canCollapseRandomHitsToSingleBoss(runtime, hpDist, action) {
  if ((action?.enemyTarget ?? 'single') !== 'random') return false;
  if (bossHpSlotCount(runtime) === 1 && (runtime.companions?.length ?? 0) === 0 && !runtime?.enemy?.singleTargetUntargetable) {
    if (!(action?.attackType === 'physical' && Math.max(0, Number(runtime.enemy?.physicalEvasion?.chance ?? 0) || 0) > 0)) return true;
  }
  if (action?.attackType === 'physical'
      && Math.max(0, Number(runtime.enemy?.physicalEvasion?.chance ?? 0) || 0) > 0) return false;
  const bossSlots = bossHpSlotCount(runtime);
  for (const [hp, probability] of hpDist ?? []) {
    if (!(probability > 0) || enemyHpDefeated(hp)) continue;
    const targets = allyTargetedEnemySlots(runtime, hp, action);
    if (targets.length !== 1 || targets[0] >= bossSlots) return false;
  }
  return true;
}


// v0.5.79: BOSS＋お供1〜2体の通常ランダム多段攻撃専用DP。
// 特殊回避・反射・1回無効・被弾時EX変動が無い場合だけ使用する。
// DP状態はHP整数・被弾slot mask・EX増加量を保持し、Mapキーの文字列を毎回再分解しない。
function canUseSmallEnemyRandomDp(runtime, hpDist, action) {
  if ((action?.enemyTarget ?? 'single') !== 'random') return false;
  const companionCount = runtime.companions?.length ?? 0;
  const slotCount = Math.max(1, Math.trunc(Number(runtime?.enemy?.hpSlotCount ?? (1 + companionCount)) || 1));
  if (bossHpSlotCount(runtime) !== 1 || slotCount < 2 || slotCount > 3) return false;
  if (runtime?.enemy?.singleTargetUntargetable) return false;
  if (action?.attackType === 'physical' && Math.max(0, Number(runtime.enemy?.physicalEvasion?.chance ?? 0) || 0) > 0) return false;
  for (const companion of runtime.companions ?? []) {
    if (!companion) continue;
    // v0.5.99: 死亡済み固定お供はHP=0のままDPに残せる。
    // inactive/off-field 個体は対象候補にならず特殊防御も発動しないため、
    // 生存個体だけ特殊処理の有無を確認する。
    if (companion.active === false) continue;
    if (companionIsOffField(companion)) return false;
    if (companion.evadedCurrentAllyAttack) return false;
    if (companion.oneHitGuard && companionOneHitGuardBlocksAllyAttack(companion, action)) return false;
    if (companionReflectsAllyAttack(companion, action)) return false;
    if (companionNegatesAllyAttack(companion, action)) return false;
  }
  const attrs = attackAttributesFromConfig(action ?? {});
  const activeMods = applicableDefenseMods(runtime.enemy?.defenseMods ?? [], String(action?.attackType ?? 'physical'), attrs);
  if (activeMods.some(mod => Math.max(0, Number(mod?.onHitEnemyExGain ?? 0) || 0) > 0
      || Math.max(0, Number(mod?.onHitPlayerExLoss ?? 0) || 0) > 0)) return false;
  const expectedSlots = slotCount;
  for (const [hp, probability] of hpDist ?? []) {
    if (!(probability > 0) || enemyHpDefeated(hp)) continue;
    const parts = multiHpParts(hp);
    if (!parts || parts.length !== expectedSlots) return false;
    // runtime上すでに死亡/off-fieldの固定お供に正HPが残る不整合枝では
    // 汎用処理へ戻す。通常の死亡済み枝は0HPなので高速DPを安全に使える。
    for (const companion of runtime.companions ?? []) {
      if (!companion || (companion.active !== false && !companionIsOffField(companion))) continue;
      const slot = Number(companion.hpSlot);
      if (Number.isInteger(slot) && slot >= 1 && Number(parts[slot] ?? 0) > 0) return false;
    }
  }
  return true;
}

const SMALL_ENEMY_RANDOM_DP_CACHE = new Map();
const SMALL_ENEMY_RANDOM_DP_CACHE_MAX = 256;

function exactNormalizedHpDistributionKey(dist) {
  const cached = HP_EXACT_NORMALIZED_KEY_CACHE.get(dist);
  if (cached != null) return cached;
  const mass = distributionMass(dist);
  if (!(mass > 0)) return '0';
  let out = `${dist.size}|`;
  for (const [hp, probability] of dist) out += `${hp}:${probability / mass};`;
  HP_EXACT_NORMALIZED_KEY_CACHE.set(dist, out);
  return out;
}

function applySmallEnemyRandomDp(runtime, hpDist, oneHitDamageDist, action, hits) {
  const hitCount = Math.max(1, Math.trunc(Number(hits ?? 1) || 1));
  const slotCount = Math.max(1, Math.trunc(Number(runtime?.enemy?.hpSlotCount ?? (1 + (runtime.companions?.length ?? 0))) || 1));
  const sourceMass = distributionMass(hpDist);
  if (!(sourceMass > 0)) return [];

  // 防御補正はHPに依存しないため、slotごとに調整済み1hit分布を一度だけ作る。
  const damageBySlot = Array.from({ length:slotCount }, (_, slot) => {
    const dist = new Map();
    for (const [damage, probability] of oneHitDamageDist) {
      if (!(probability > 0)) continue;
      const adjusted = Math.max(0, Math.trunc(adjustedAllyDamageForEnemySlot(runtime, slot, damage, action)));
      dist.set(adjusted, (dist.get(adjusted) ?? 0) + probability);
    }
    return [...dist.entries()];
  });

  // 状態異常対象など「味方側runtimeだけが違い、敵HP分布と攻撃条件は同じ」枝では
  // ランダム多段DPの数値結果は完全に共通。抽象結果（HP・被弾mask・EX増加）だけを
  // 正規化して再利用し、runtimeへの副作用は各枝へ改めて適用する。
  const damageKey = damageBySlot.map(dist => dist.map(([d,p]) => `${d}:${p}`).join(',')).join('/');
  const hpKey = exactNormalizedHpDistributionKey(hpDist);
  const cacheKey = `${slotCount}|${hitCount}|${damageKey}|${hpKey}`;
  let abstractGroups = SMALL_ENEMY_RANDOM_DP_CACHE.get(cacheKey);

  if (!abstractGroups) {
    let states = new Map();
    // v0.5.99: 小規模ランダム多段DPの内部キーを文字列から安全整数へ変更する。
    // HPは攻撃中に減るだけなので、入力分布のslot別最大HP+1を基数にすれば衝突しない。
    // 3slot・HP数千程度・hit数一桁なら Number.MAX_SAFE_INTEGER を十分下回る。
    const hpBase = Array(slotCount).fill(1);
    for (const [hp, probability] of hpDist) {
      if (!(probability > 0)) continue;
      const parts = multiHpParts(hp);
      if (!parts || parts.length !== slotCount) continue;
      for (let i = 0; i < slotCount; i++) hpBase[i] = Math.max(hpBase[i], Math.max(0, Math.trunc(Number(parts[i] ?? 0) || 0)) + 1);
    }
    const exBase = hitCount * 2 + 1;
    const maskBase = 1 << slotCount;
    const packedKeyIsSafe = hpBase.reduce((product, base) => product * base, 1) * maskBase * exBase <= Number.MAX_SAFE_INTEGER;
    const stateKey = packedKeyIsSafe
      ? (slotCount === 2
        ? ((h, hitMask, exGain) => ((((h[0] * hpBase[1]) + h[1]) * maskBase + hitMask) * exBase + exGain))
        : ((h, hitMask, exGain) => (((((h[0] * hpBase[1]) + h[1]) * hpBase[2] + h[2]) * maskBase + hitMask) * exBase + exGain)))
      : (slotCount === 2
        ? ((h, hitMask, exGain) => `${h[0]},${h[1]}|${hitMask}|${exGain}`)
        : ((h, hitMask, exGain) => `${h[0]},${h[1]},${h[2]}|${hitMask}|${exGain}`));

    for (const [hp, probability] of hpDist) {
      if (!(probability > 0)) continue;
      const parts = multiHpParts(hp);
      if (!parts || parts.length !== slotCount) continue;
      const key = stateKey(parts, 0, 0);
      const normalizedProbability = probability / sourceMass;
      const existing = states.get(key);
      if (existing) existing.probability += normalizedProbability;
      else states.set(key, { h:parts.slice(), hitMask:0, exGain:0, probability:normalizedProbability });
    }

    for (let hitIndex = 0; hitIndex < hitCount; hitIndex++) {
      const next = new Map();
      for (const state of states.values()) {
        const stateProb = state.probability;
        if (!(stateProb > 0)) continue;
        const h = state.h;
        let livingCount = 0;
        for (let i = 0; i < slotCount; i++) if (h[i] > 0) livingCount++;
        if (!livingCount) {
          const key = stateKey(h, state.hitMask, state.exGain);
          const existing = next.get(key);
          if (existing) existing.probability += stateProb;
          else next.set(key, { h:h.slice(), hitMask:state.hitMask, exGain:state.exGain, probability:stateProb });
          continue;
        }
        const targetWeight = 1 / livingCount;
        for (let slot = 0; slot < slotCount; slot++) {
          const before = h[slot];
          if (!(before > 0)) continue;
          for (const [adjusted, damageProb] of damageBySlot[slot]) {
            if (!(damageProb > 0)) continue;
            const after = Math.max(0, before - adjusted);
            const nh = h.slice();
            nh[slot] = after;
            const deathBonus = after <= 0 ? 1 : 0;
            const hitMask = state.hitMask | (1 << slot);
            const exGain = state.exGain + 1 + deathBonus;
            const key = stateKey(nh, hitMask, exGain);
            const p = stateProb * targetWeight * damageProb;
            const existing = next.get(key);
            if (existing) existing.probability += p;
            else next.set(key, { h:nh, hitMask, exGain, probability:p });
          }
        }
      }
      states = next;
    }

    const grouped = new Map();
    for (const state of states.values()) {
      const probability = state.probability;
      if (!(probability > 0)) continue;
      const hp = multiHpKey(state.h);
      const mask = companionAliveMask(runtime, hp);
      const groupKey = `${state.exGain}|${mask}|${state.hitMask}`;
      const bucket = grouped.get(groupKey) ?? { gain:state.exGain, hitMask:state.hitMask, sampleHp:hp, dist:new Map() };
      bucket.dist.set(hp, (bucket.dist.get(hp) ?? 0) + probability);
      grouped.set(groupKey, bucket);
    }
    abstractGroups = [...grouped.values()];
    if (SMALL_ENEMY_RANDOM_DP_CACHE.size >= SMALL_ENEMY_RANDOM_DP_CACHE_MAX) {
      SMALL_ENEMY_RANDOM_DP_CACHE.delete(SMALL_ENEMY_RANDOM_DP_CACHE.keys().next().value);
    }
    SMALL_ENEMY_RANDOM_DP_CACHE.set(cacheKey, abstractGroups);
  }

  return abstractGroups.map(({ gain, hitMask, sampleHp, dist }) => {
    const rt = cloneRuntimeState(runtime);
    const hitSlots = [];
    for (let i = 0; i < slotCount; i++) if (hitMask & (1 << i)) hitSlots.push(i);
    rt.lastAllyAttackHitSlots = hitSlots;
    addEnemyEx(rt, gain);
    if (action?.attackType === 'physical') {
      for (const slot of hitSlots) {
        const companionIndex = companionIndexForHpSlot(rt, slot);
        if (companionIndex >= 0 && rt.companions?.[companionIndex]?.statuses?.sleep) delete rt.companions[companionIndex].statuses.sleep;
      }
    }
    syncCompanionActivityFromHp(rt, sampleHp);
    return { runtime:rt, hpDist:sourceMass === 1 ? dist : scaleDistribution(dist, sourceMass) };
  });
}

// ランダム攻撃は「合計ダメージを1体へ入れる」のではなく、1ヒットごとに生存対象を再抽選する。
// お供・召喚個体も同じ対象プールへ入り、途中撃破された個体は後続ヒットの候補から外れる。
function applyRandomAllyAttackWithEnemyEx(runtime, hpDist, oneHitDamageDist, action, hits, damageDistForSlot = null) {
  if (!damageDistForSlot && canUseSmallEnemyRandomDp(runtime, hpDist, action)) return applySmallEnemyRandomDp(runtime, hpDist, oneHitDamageDist, action, hits);
  let branches = [{ runtime:cloneRuntimeState(runtime), hpDist:new Map(hpDist) }];
  const terminal = [];
  const hitCount = Math.max(1, Math.trunc(Number(hits ?? 1) || 1));

  for (let hitIndex = 0; hitIndex < hitCount; hitIndex++) {
    const next = [];
    for (const branch of branches) {
      for (const [hp, hpProbability] of branch.hpDist) {
        if (!(hpProbability > 0)) continue;
        if (enemyHpDefeated(hp)) {
          // ここで全敵撃破済みなら残りヒットを抽選しない。
          terminal.push({ runtime:branch.runtime, hpDist:new Map([[hp, hpProbability]]) });
          continue;
        }
        const candidates = allyTargetedEnemySlots(branch.runtime, hp, { ...action, enemyTarget:'random' });
        if (!candidates.length) {
          next.push({ runtime:branch.runtime, hpDist:new Map([[hp, hpProbability]]) });
          continue;
        }
        const targetWeight = 1 / candidates.length;
        for (const slot of candidates) {
          const isBossSlot = slot < bossHpSlotCount(branch.runtime);
          const bossEvadeChance = isBossSlot && action?.attackType === 'physical'
            ? Math.max(0, Math.min(100, Number(branch.runtime.enemy?.physicalEvasion?.chance ?? 0) || 0)) / 100
            : 0;

          // BOSS本人の物理回避は、そのヒットがBOSSを選んだ場合だけ判定する。
          if (bossEvadeChance > 0) {
            next.push({
              runtime:branch.runtime,
              hpDist:new Map([[hp, hpProbability * targetWeight * bossEvadeChance]])
            });
          }
          const hitProbabilityScale = hpProbability * targetWeight * (1 - bossEvadeChance);
          if (!(hitProbabilityScale > 0)) continue;

          const companionIndex = companionIndexForHpSlot(branch.runtime, slot);
          const companion = companionIndex >= 0 ? branch.runtime.companions?.[companionIndex] : null;
          const evaded = Boolean(companion?.evadedCurrentAllyAttack);
          const guarded = companionOneHitGuardBlocksAllyAttack(companion, action);
          const reflected = companionReflectsAllyAttack(companion, action);
          const negated = evaded || guarded || reflected;
          const slotDamageDist = damageDistForSlot ? damageDistForSlot(branch.runtime, slot) : oneHitDamageDist;
          const damageMass = distributionMass(slotDamageDist);

          // 回避・1回無効・反射ではダメージ乱数値による結果差がないため、101枝へ複製しない。
          if (negated) {
            const rt = cloneRuntimeState(branch.runtime);
            const rtCompanion = companionIndex >= 0 ? rt.companions?.[companionIndex] : null;
            if (guarded && !evaded && rtCompanion?.oneHitGuard) delete rtCompanion.oneHitGuard;
            next.push({
              runtime:rt,
              hpDist:new Map([[hp, hitProbabilityScale * damageMass]])
            });
            continue;
          }

          // ダメージ値ごとにHP分布だけを保持し、runtimeは「対象生存」「対象撃破」の最大2枝に集約する。
          const surviveDist = new Map();
          const defeatedDist = new Map();
          let surviveSampleHp = null;
          let defeatedSampleHp = null;
          const parts = enemyHpPartArray(hp);
          const beforeSlotHp = Number(parts[slot] ?? 0);
          for (const [damage, damageProbability] of slotDamageDist) {
            if (!(damageProbability > 0)) continue;
            const nextParts = parts.slice();
            const adjusted = adjustedAllyDamageForEnemySlot(branch.runtime, slot, damage, action);
            nextParts[slot] = Math.max(0, beforeSlotHp - adjusted);
            const nextHp = multiHpParts(hp) ? multiHpKey(nextParts) : Math.max(0, Number(nextParts[0] ?? 0));
            const probability = hitProbabilityScale * damageProbability;
            const targetDefeated = beforeSlotHp > 0 && Number(nextParts[slot] ?? 0) <= 0;
            const dist = targetDefeated ? defeatedDist : surviveDist;
            dist.set(nextHp, (dist.get(nextHp) ?? 0) + probability);
            if (targetDefeated) defeatedSampleHp ??= nextHp;
            else surviveSampleHp ??= nextHp;
          }

          const makeRuntime = (sampleHp, deathBonus) => {
            const rt = cloneRuntimeState(branch.runtime);
            rt.lastAllyAttackHitSlots = Array.from(new Set([...(rt.lastAllyAttackHitSlots ?? []), slot]));
            addEnemyEx(rt, 1 + deathBonus);
            applyEnemyDefenseOnHitEx(rt, action, [slot], 1);
            const rtCompanion = companionIndex >= 0 ? rt.companions?.[companionIndex] : null;
            if (action?.attackType === 'physical' && rtCompanion?.statuses?.sleep) delete rtCompanion.statuses.sleep;
            syncCompanionActivityFromHp(rt, sampleHp);
            return rt;
          };

          if (surviveDist.size) next.push({ runtime:makeRuntime(surviveSampleHp, 0), hpDist:surviveDist });
          if (defeatedDist.size) next.push({ runtime:makeRuntime(defeatedSampleHp, 1), hpDist:defeatedDist });
        }
      }
    }
    branches = mergeRuntimeBranches(next);
    if (!branches.length) break;
  }
  return mergeRuntimeBranches([...branches, ...terminal]);
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


function battleHpDefeated(runtime, hp) {
  // v0.5.71: 撃破成功はBOSS本体だけではなく、初期お供・召喚個体を含む全敵HPが0になった時だけ。
  return enemyHpDefeated(hp);
}

function battleKillChance(runtime, hpDist) {
  let value = 0;
  for (const [hp, probability] of hpDist) if (battleHpDefeated(runtime, hp)) value += probability;
  return Math.max(0, Math.min(1, value));
}

function battleHpRange(runtime, hpDist) {
  const live = [];
  for (const [hp] of hpDist) {
    if (battleHpDefeated(runtime, hp)) continue;
    live.push(enemyHpTotal(hp));
  }
  if (!live.length) return { min:0, max:0 };
  return { min:Math.min(...live), max:Math.max(...live) };
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
  return ['allyAtkDebuff', 'allySpeedDebuff', 'speedDown', 'enemyDefenseBuff', 'enemyDamageReduction', 'enemyCounterGuard'].includes(type) ? -1 : 1;
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
    // defenseMods はclone時に要素identityを共有できるよう、既存要素の更新だけcopy-on-writeにする。
    for (let i = 0; i < list.length; i++) {
      const existing = list[i];
      if (existing.stackRefreshGroup !== refreshGroup) continue;
      list[i] = { ...existing, remaining:duration, justApplied:true };
    }
    addTimedMod(list, effect, seq, 'mult');
    const added = list[list.length - 1];
    added.stackRefreshGroup = refreshGroup;
    if (Array.isArray(effect.attackTypes)) added.attackTypes = effect.attackTypes.slice();
    if (Array.isArray(effect.attributes)) added.attributes = effect.attributes.slice();
    if (effect.layer) added.layer = String(effect.layer);
    if (effect.breakOnActionDisable === true) added.breakOnActionDisable = true;
    if (effect.onHitEnemyExGain != null) added.onHitEnemyExGain = Number(effect.onHitEnemyExGain) || 0;
    if (effect.onHitPlayerExLoss != null) added.onHitPlayerExLoss = Number(effect.onHitPlayerExLoss) || 0;
    return added;
  }

  const key = effect.nonStacking ? String(effect.stackKey ?? sourceKey ?? '') : '';
  if (key) {
    const existingIndex = list.findIndex(x => x.enemyEffectKey === key);
    if (existingIndex >= 0) {
      const existing = { ...list[existingIndex] };
      list[existingIndex] = existing;
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
      if (effect.layer) existing.layer = String(effect.layer);
      else delete existing.layer;
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
  if (effect.layer) added.layer = String(effect.layer);
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
    case 'enemyDamageReduction': {
      addEnemyDefenseMod(runtime.enemy.defenseMods, { ...effect, layer:'reduction' }, runtime.seq, 'manual:enemyDamageReduction');
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
      clearAllBossPoison(runtime);
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
  const count = bossHpSlotCount(runtime);
  if (count <= 1) {
    const state = runtime.enemy.poison ?? 'none';
    if (state === 'none') return hpDist;
    return mapBossHpDistribution(runtime, hpDist, hp => Math.min(runtime.maxHp, poisonTickValue(hp, state, runtime.enemy.race)));
  }
  const states = Array.from({ length: count }, (_, slot) => bossPoisonState(runtime, slot));
  if (states.every(state => state === 'none')) return hpDist;
  const out = new Map();
  for (const [hp, probability] of hpDist) {
    const parts = enemyHpPartArray(hp);
    for (let slot = 0; slot < Math.min(count, parts.length); slot++) {
      if (parts[slot] <= 0 || states[slot] === 'none') continue;
      parts[slot] = Math.min(runtime.maxHp, poisonTickValue(parts[slot], states[slot], runtime.enemy.race));
    }
    const key = parts.length > 1 ? multiHpKey(parts) : parts[0];
    out.set(key, (out.get(key) ?? 0) + probability);
  }
  return out;
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
    // 敵行動ON時は純粋ダメージ／かばうしか持たないお供を省略できる。
    // ただし全ターン敵行動OFFでは、毒・猛毒の継続ダメージを発生させる「行動機会」として必要。
    if (companionProfile?.killProbabilityInert && !runtime.enemyActionsDisabled) continue;
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


function finalTurnCutoffPosition(state, order) {
  const mode = String(state?.finalTurnCutoff ?? 'lastAlly');
  // ターン終了までを選んだ場合は行動ループ内では打ち切らず、ターン境界処理まで通す。
  if (mode === 'turnEnd') return Number.POSITIVE_INFINITY;
  const allyMatch = /^ally([1-3])$/.exec(mode);
  if (allyMatch) {
    const allyIndex = Number(allyMatch[1]) - 1;
    return order.findIndex(actor => actor.side === 'ally' && actor.index === allyIndex);
  }
  const lastAlly = Math.max(...order.map((actor, pos) => actor.side === 'ally' ? pos : -1));
  // 従来モードで味方が全員不在の枝は、旧挙動どおり敵側のターン末まで処理する。
  return lastAlly >= 0 ? lastAlly : Number.POSITIVE_INFINITY;
}

function finalTurnCutoffLabel(state) {
  const mode = String(state?.finalTurnCutoff ?? 'lastAlly');
  if (mode === 'turnEnd') return 'ターン終了まで';
  const allyMatch = /^ally([1-3])$/.exec(mode);
  if (allyMatch) return `キャラ${allyMatch[1]}の行動機会直後`;
  return '最後の味方行動直後';
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
    presetTarget: action?.presetTarget ?? '',
    fixedCharacterSkill: action?.fixedCharacterSkill ?? '',
    playerExRequired: Math.max(0, Number(action?.playerExRequired ?? 0) || 0),
    playerExSpend: Math.max(0, Number(action?.playerExSpend ?? 0) || 0),
    chargeSkillPresetId: String(action?.chargeSkillPresetId ?? '')
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
      race: normalizeEnemyRace(state.enemy?.race),
      bossOnlyVictory: false
    }
  };

  let hpDist = new Map([[maxHp, 1]]);
  const timeline = [];

  for (let turnIndex = 0; turnIndex < turns.length; turnIndex++) {
    const turn = turns[turnIndex] ?? {};
    const order = actorOrder(runtime);
    const isFinalTurn = turnIndex === turns.length - 1;
    const finalCutoffPosition = isFinalTurn ? finalTurnCutoffPosition(state, order) : -1;
    if (isFinalTurn && finalCutoffPosition < 0) {
      return {
        killChance: killChance(hpDist),
        hpDistribution: hpDist,
        timeline,
        finalTurn: turnIndex + 1,
        finalOrder: order,
        finalTurnCutoffLabel: finalTurnCutoffLabel(state)
      };
    }

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
          allyEffect(runtime, allyBuffForAction(runtime, actor.index, action, state.allies?.[actor.index]?.characterId ?? ''), actor.index);
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
            enemyAtkBuff: '敵の攻撃アップ', enemyDefenseBuff: '防御バフ', enemyDefenseDebuff: '防御デバフ', enemyDamageReduction: '防御アップ',
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

      // 最終ターンは、設定された行動者の行動機会が終わった瞬間で計算を止める。
      if (isFinalTurn && pos === finalCutoffPosition) {
        return {
          killChance: killChance(hpDist),
          hpDistribution: hpDist,
          timeline,
          finalTurn: turnIndex + 1,
          finalOrder: order,
          finalTurnCutoffLabel: finalTurnCutoffLabel(state)
        };
      }
    }

    decrementTimedEffects(runtime);
  }

  return { killChance: killChance(hpDist), hpDistribution: hpDist, timeline, finalTurn: turns.length, finalOrder: [], finalTurnCutoffLabel: finalTurnCutoffLabel(state) };
}


function cloneFlatObjectArray(list) {
  if (!Array.isArray(list) || list.length === 0) return [];
  const out = new Array(list.length);
  for (let i = 0; i < list.length; i++) out[i] = { ...list[i] };
  return out;
}
function cloneObjectRefArray(list) {
  return Array.isArray(list) && list.length ? list.slice() : [];
}
function cloneStatuses(statuses) {
  const out = {};
  for (const key of Object.keys(statuses ?? {})) {
    const value = statuses[key];
    out[key] = value && typeof value === 'object' ? { ...value } : value;
  }
  return out;
}
function cloneAllyState(a) {
  return {
    ...a,
    attackMods: cloneObjectRefArray(a.attackMods),
    speedMods: cloneObjectRefArray(a.speedMods),
    weaknessMods: cloneObjectRefArray(a.weaknessMods),
    statusAvoidMods: cloneObjectRefArray(a.statusAvoidMods),
    statusImmuneMods: cloneObjectRefArray(a.statusImmuneMods),
    damageTakenMods: cloneObjectRefArray(a.damageTakenMods),
    statusVulnerabilityMods: cloneObjectRefArray(a.statusVulnerabilityMods),
    statuses: cloneStatuses(a.statuses),
    activeProgressiveDecay: a.activeProgressiveDecay && typeof a.activeProgressiveDecay === 'object' ? { ...a.activeProgressiveDecay } : a.activeProgressiveDecay,
    chargedAction: a.chargedAction && typeof a.chargedAction === 'object' ? { ...a.chargedAction } : a.chargedAction
  };
}
function cloneEnemyState(e) {
  const fanlongSimple = e?.presetId === 'old3_fanlong';
  return {
    ...e,
    speedMods: fanlongSimple ? cloneObjectRefArray(e.speedMods) : cloneFlatObjectArray(e.speedMods),
    attackMods: fanlongSimple ? cloneObjectRefArray(e.attackMods) : cloneFlatObjectArray(e.attackMods),
    defenseMods: fanlongSimple ? cloneObjectRefArray(e.defenseMods) : cloneFlatObjectArray(e.defenseMods),
    blessingMods: fanlongSimple ? cloneObjectRefArray(e.blessingMods) : cloneFlatObjectArray(e.blessingMods),
    reactiveEffects: fanlongSimple ? cloneObjectRefArray(e.reactiveEffects) : cloneFlatObjectArray(e.reactiveEffects),
    statusAvoidMods: fanlongSimple ? cloneObjectRefArray(e.statusAvoidMods) : cloneFlatObjectArray(e.statusAvoidMods),
    disabledCommands: Array.isArray(e.disabledCommands) ? e.disabledCommands.slice() : [],
    transientDisabledCommands: Array.isArray(e.transientDisabledCommands) ? e.transientDisabledCommands.slice() : [],
    commandOverrides: { ...(e.commandOverrides ?? {}) },
    poisonByBoss: Array.isArray(e.poisonByBoss) ? e.poisonByBoss.slice() : e.poisonByBoss,
    charge: e.charge && typeof e.charge === 'object' ? { ...e.charge } : e.charge,
    physicalEvasion: e.physicalEvasion && typeof e.physicalEvasion === 'object' ? { ...e.physicalEvasion } : e.physicalEvasion,
    singleTargetUntargetable: e.singleTargetUntargetable && typeof e.singleTargetUntargetable === 'object' ? { ...e.singleTargetUntargetable } : e.singleTargetUntargetable
  };
}
function cloneCompanionState(c) {
  return {
    ...c,
    attackMods: cloneFlatObjectArray(c.attackMods),
    speedMods: cloneFlatObjectArray(c.speedMods),
    defenseMods: cloneObjectRefArray(c.defenseMods),
    statuses: cloneStatuses(c.statuses),
    permanentBuffKeys: Array.isArray(c.permanentBuffKeys) ? c.permanentBuffKeys.slice() : [],
    fenrirStateDist: Array.isArray(c.fenrirStateDist) ? c.fenrirStateDist.map(x => x.slice()) : undefined
  };
}
function cloneRuntimeState(runtime) {
  if (runtime == null || typeof runtime !== 'object') return runtime;
  return {
    ...runtime,
    allies: (runtime.allies ?? []).map(cloneAllyState),
    enemy: cloneEnemyState(runtime.enemy ?? {}),
    companions: (runtime.companions ?? []).map(cloneCompanionState),
    pendingReelBoosts: cloneObjectRefArray(runtime.pendingReelBoosts),
    pendingReelSets: cloneObjectRefArray(runtime.pendingReelSets),
    pendingCompanionReelShifts: { ...(runtime.pendingCompanionReelShifts ?? {}) },
    deferredConfusionEvents: Array.isArray(runtime.deferredConfusionEvents)
      ? runtime.deferredConfusionEvents.map(event => ({ weights:Array.isArray(event?.weights) ? event.weights.slice() : [] }))
      : undefined
  };
}

const HP_NORMALIZED_KEY_CACHE = new WeakMap();
const HP_EXACT_NORMALIZED_KEY_CACHE = new WeakMap();
const HP_DEFEAT_STATE_CACHE = new WeakMap(); // 'live' | 'dead' | undefined

// 確率係数だけが違う同一HP分布をMapへ複製せず、読み取り時だけ係数を掛ける。
// Map互換で必要な読み取りAPIだけを持ち、書き込みが必要な箇所では既存どおり new Map(view) で実体化する。
class ScaledDistributionView {
  constructor(base, factor) {
    if (base instanceof ScaledDistributionView) {
      this.base = base.base;
      this.factor = base.factor * factor;
    } else {
      this.base = base;
      this.factor = factor;
    }
  }
  get size() { return this.base.size; }
  get(key) {
    const value = this.base.get(key);
    return value == null ? value : value * this.factor;
  }
  has(key) { return this.base.has(key); }
  keys() { return this.base.keys(); }
  *values() {
    const f = this.factor;
    for (const value of this.base.values()) yield value * f;
  }
  *entries() {
    const f = this.factor;
    for (const [key, value] of this.base) yield [key, value * f];
  }
  [Symbol.iterator]() { return this.entries(); }
  forEach(callback, thisArg = undefined) {
    const f = this.factor;
    for (const [key, value] of this.base) callback.call(thisArg, value * f, key, this);
  }
}

function scaleDistribution(dist, factor) {
  if (factor === 1) return dist;
  if (!(factor > 0) || !(dist?.size > 0)) return new Map();
  // 小分布は従来Mapの方が後続処理で速い。大分布だけ遅延スケールする。
  if (dist.size < 1) {
    const out = new Map();
    for (const [hp, p] of dist) out.set(hp, p * factor);
    const normalizedKey = HP_NORMALIZED_KEY_CACHE.get(dist);
    if (normalizedKey != null) HP_NORMALIZED_KEY_CACHE.set(out, normalizedKey);
    const exactNormalizedKey = HP_EXACT_NORMALIZED_KEY_CACHE.get(dist);
    if (exactNormalizedKey != null) HP_EXACT_NORMALIZED_KEY_CACHE.set(out, exactNormalizedKey);
    const defeatState = HP_DEFEAT_STATE_CACHE.get(dist);
    if (defeatState) HP_DEFEAT_STATE_CACHE.set(out, defeatState);
    return out;
  }
  const view = new ScaledDistributionView(dist, factor);
  const normalizedKey = HP_NORMALIZED_KEY_CACHE.get(dist);
  if (normalizedKey != null) HP_NORMALIZED_KEY_CACHE.set(view, normalizedKey);
  const exactNormalizedKey = HP_EXACT_NORMALIZED_KEY_CACHE.get(dist);
  if (exactNormalizedKey != null) HP_EXACT_NORMALIZED_KEY_CACHE.set(view, exactNormalizedKey);
  const defeatState = HP_DEFEAT_STATE_CACHE.get(dist);
  if (defeatState) HP_DEFEAT_STATE_CACHE.set(view, defeatState);
  return view;
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
  from.forEach((p, hp) => into.set(hp, (into.get(hp) ?? 0) + p));
}

const ALLY_STATIC_MERGE_KEYS = new Set(['baseAttack','baseSpeed','star','attribute','race']);
const ENEMY_STATIC_MERGE_KEYS = new Set(['name','presetId','baseAttack','baseSpeed','attribute','race']);
const COMPANION_STATIC_MERGE_KEYS = new Set(['baseAttack','baseSpeed','attribute','race']);

function compactObjectForMerge(source, omittedKeys, forceKeys = null) {
  const out = {};
  for (const key of Object.keys(source ?? {})) {
    if (omittedKeys?.has(key)) continue;
    if (key === 'seq') { out[key] = 0; continue; }
    if (key === 'summoned') { out[key] = false; continue; }
    out[key] = source[key];
  }
  if (forceKeys) for (const key of forceKeys) if (source?.[key] !== undefined) out[key] = source[key];
  return out;
}

function canonicalEnemyCommandOverridesForKey(e) {
  if (e?.presetId !== 'q_dock_low' || !e?.commandOverrides) return e?.commandOverrides ?? {};
  const matrix = enemyBossProfile('q_dock_low')?.matrix ?? [];
  const counts = {};
  for (const [slotKey, nextCommand] of Object.entries(e.commandOverrides ?? {})) {
    const [rText, sText] = String(slotKey).split(':');
    const r = Number(rText), slot = Number(sText);
    const original = matrix?.[r]?.[slot] ?? '';
    if (original === '蒼染の月明' || original === '深海の叫び') {
      const key = `${r}:${original}`;
      counts[key] = (counts[key] ?? 0) + 1;
    } else counts[`raw:${slotKey}`] = nextCommand;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a],[b]) => a.localeCompare(b, 'ja')));
}

const FAST_SIMPLE_FIXED_COMPANION_MERGE_PRESETS = new Set([
  // 行動表を持たない固定お供だけの旧1章ドラゴン戦。
  // 枝ごとに変わり得る値だけを配列化し、一般 companion object の列挙を避ける。
  'old1_grim','old1_genbu','old1_blizzard_dragon','old1_fafnir','old2_soccerra','old3_yamata','old3_kukulkan','old3_fanlong','old4_salamander','old5_frost_dragon'
]);

function fastSimpleFixedCompanionRuntimeKey(runtime) {
  const allies = (runtime?.allies ?? []).map(a => [
    a.attackMods ?? [], a.speedMods ?? [], a.weaknessMods ?? [], a.statusAvoidMods ?? [], a.statusImmuneMods ?? [],
    a.damageTakenMods ?? [], a.statusVulnerabilityMods ?? [], a.statuses ?? {}, a.rotAttackMultiplier ?? 1, a.rotSpeedMultiplier ?? 1,
    a.activeProgressiveDecay ?? null, a.actionLockRemaining ?? 0, a.actionsTaken ?? 0, a.active !== false,
    a.swordDanceAutoRemaining ?? 0, a.swordDanceStage ?? 0, a.chargedAction ?? null, a.flatAttackBonus ?? 0, a.flatSpeedBonus ?? 0,
    a.postActionSpeedGain ?? 0, a.postActionEnemyExGain ?? 0
  ]);
  const e = runtime?.enemy ?? {};
  const enemy = [
    e.speedMods ?? [], e.attackMods ?? [], e.defenseMods ?? [], e.poison ?? 'none', e.poisonByBoss ?? null, e.postActionAttackGain ?? 0, e.flatAttackBonus ?? 0,
    e.postActionSpeedGain ?? 0, e.flatSpeedBonus ?? 0, e.blessingMods ?? [], e.reactiveEffects ?? [], e.statusAvoidMods ?? [],
    e.disabledCommands ?? [], e.transientDisabledCommands ?? [], canonicalEnemyCommandOverridesForKey(e), e.charge ?? null, Boolean(e.paralysis),
    e.actionSerial ?? 0, e.physicalEvasion ?? null, e.singleTargetUntargetable ?? null, e.barbadosWaterStack ?? 0, e.exGauge ?? 0,
    e.deathSerial ?? 0, e.multiBossCount ?? 1, e.hpSlotCount ?? 1, e.pendingReelShift ?? 0, e.danceActive ?? null,
    e.exTriggered ?? false, e.fallingDownSummonPending ?? null, e.pincerDisabledSlots ?? null, e.pincerOniUses ?? null, e.pincerRushActive ?? null
  ];
  const companions = (runtime?.companions ?? []).map(c => [
    c.name ?? '', c.maxHp ?? null, c.hpSlot ?? null,
    c.attackMods ?? [], c.speedMods ?? [], c.defenseMods ?? [], c.physicalEvasionMods ?? [], c.statuses ?? {},
    c.poison ?? 'none', c.permanentBuffKeys ?? [], c.actionLockRemaining ?? 0, c.active !== false,
    c.flatAttackBonus ?? 0, c.flatSpeedBonus ?? 0, c.postActionSpeedGain ?? 0, c.postActionEnemyExGain ?? 0,
    c.deathSeq ?? null, Boolean(c.revivable), c.summonCurseTurns ?? 0, Boolean(c.summonCurseJustApplied),
    Boolean(c.evadedCurrentAllyAttack), c.oneHitGuard ?? null, c.magicReflect ?? null, c.sleepBlessing ?? null, c.excursion ?? null,
    c.startReel ?? 0
  ]);
  const transient = [
    runtime?.enemyLastTarget ?? null,
    runtime?.enemyDamagedTargets ?? [],
    runtime?.enemyHitStatusTargets ?? {},
    runtime?.lastAllyAttackHitSlots ?? [],
    runtime?.actingCompanionIndex ?? null
  ];
  const rawKey = JSON.stringify([
    runtime?.ignorePlayerExTracking ? 0 : Number(runtime?.playerExGauge ?? 0),
    allies, enemy, companions, runtime?.pendingReelBoosts ?? [], runtime?.pendingReelSets ?? [], runtime?.pendingCompanionReelShifts ?? {}, transient
  ]);
  return Number(runtime?.seq ?? 0) === 0 ? rawKey : rawKey.replace(/"seq":-?\d+(?:\.\d+)?/g, '"seq":0');
}


function objectHasEnumerableKeys(value) {
  if (!value || typeof value !== 'object') return false;
  for (const _key in value) return true;
  return false;
}

function sparseAllyRuntimeKey(a) {
  const out = [];
  if ((a.attackMods?.length ?? 0) > 0) out.push('a', a.attackMods);
  if ((a.speedMods?.length ?? 0) > 0) out.push('s', a.speedMods);
  if ((a.weaknessMods?.length ?? 0) > 0) out.push('w', a.weaknessMods);
  if ((a.statusAvoidMods?.length ?? 0) > 0) out.push('v', a.statusAvoidMods);
  if ((a.statusImmuneMods?.length ?? 0) > 0) out.push('i', a.statusImmuneMods);
  if ((a.damageTakenMods?.length ?? 0) > 0) out.push('d', a.damageTakenMods);
  if ((a.statusVulnerabilityMods?.length ?? 0) > 0) out.push('u', a.statusVulnerabilityMods);
  if (objectHasEnumerableKeys(a.statuses)) out.push('t', a.statuses);
  if (Number(a.rotAttackMultiplier ?? 1) !== 1) out.push('ra', a.rotAttackMultiplier);
  if (Number(a.rotSpeedMultiplier ?? 1) !== 1) out.push('rs', a.rotSpeedMultiplier);
  if (a.activeProgressiveDecay != null) out.push('pd', a.activeProgressiveDecay);
  if (Number(a.actionLockRemaining ?? 0) !== 0) out.push('lk', a.actionLockRemaining);
  if (Number(a.actionsTaken ?? 0) !== 0) out.push('n', a.actionsTaken);
  if (a.active === false) out.push('x', 0);
  if (Number(a.swordDanceAutoRemaining ?? 0) !== 0) out.push('sd', a.swordDanceAutoRemaining);
  if (Number(a.swordDanceStage ?? 0) !== 0) out.push('ss', a.swordDanceStage);
  if (a.chargedAction != null) out.push('ch', a.chargedAction);
  if (Number(a.flatAttackBonus ?? 0) !== 0) out.push('fa', a.flatAttackBonus);
  if (Number(a.flatSpeedBonus ?? 0) !== 0) out.push('fs', a.flatSpeedBonus);
  if (Number(a.postActionSpeedGain ?? 0) !== 0) out.push('ps', a.postActionSpeedGain);
  if (Number(a.postActionEnemyExGain ?? 0) !== 0) out.push('pe', a.postActionEnemyExGain);
  if (Number(a.deferredParalysisChance ?? 0) !== 0) out.push('dp', a.deferredParalysisChance);
  return out;
}

function sparseEnemyRuntimeKey(e) {
  const enemy = [];
  if ((e.speedMods?.length ?? 0) > 0) enemy.push('s', e.speedMods);
  if ((e.attackMods?.length ?? 0) > 0) enemy.push('a', e.attackMods);
  if ((e.defenseMods?.length ?? 0) > 0) enemy.push('d', e.defenseMods);
  if ((e.poison ?? 'none') !== 'none') enemy.push('p', e.poison);
  if (Array.isArray(e.poisonByBoss) && e.poisonByBoss.some(x => String(x ?? 'none') !== 'none')) enemy.push('pb', e.poisonByBoss);
  if (Number(e.postActionAttackGain ?? 0) !== 0) enemy.push('pa', e.postActionAttackGain);
  if (Number(e.flatAttackBonus ?? 0) !== 0) enemy.push('fa', e.flatAttackBonus);
  if (Number(e.postActionSpeedGain ?? 0) !== 0) enemy.push('ps', e.postActionSpeedGain);
  if (Number(e.flatSpeedBonus ?? 0) !== 0) enemy.push('fs', e.flatSpeedBonus);
  if ((e.blessingMods?.length ?? 0) > 0) enemy.push('b', e.blessingMods);
  if ((e.reactiveEffects?.length ?? 0) > 0) enemy.push('r', e.reactiveEffects);
  if ((e.statusAvoidMods?.length ?? 0) > 0) enemy.push('v', e.statusAvoidMods);
  if ((e.disabledCommands?.length ?? 0) > 0) enemy.push('dc', e.disabledCommands);
  if ((e.transientDisabledCommands?.length ?? 0) > 0) enemy.push('tc', e.transientDisabledCommands);
  if (objectHasEnumerableKeys(e.commandOverrides)) {
    const overrides = canonicalEnemyCommandOverridesForKey(e);
    if (objectHasEnumerableKeys(overrides)) enemy.push('co', overrides);
  }
  if (e.charge != null) enemy.push('ch', e.charge);
  if (Boolean(e.paralysis)) enemy.push('pz', 1);
  if (Number(e.deferredParalysisChance ?? 0) > 0) enemy.push('dp', e.deferredParalysisChance);
  if (Number(e.actionSerial ?? 0) !== 0) enemy.push('as', e.actionSerial);
  if (e.physicalEvasion != null) enemy.push('ev', e.physicalEvasion);
  if (e.singleTargetUntargetable != null) enemy.push('ut', e.singleTargetUntargetable);
  if (Number(e.barbadosWaterStack ?? 0) !== 0) enemy.push('bw', e.barbadosWaterStack);
  if (Number(e.exGauge ?? 0) !== 0) enemy.push('ex', e.exGauge);
  if (Number(e.exActivations ?? 0) !== 0) enemy.push('xa', e.exActivations);
  if (Number(e.deathSerial ?? 0) !== 0) enemy.push('ds', e.deathSerial);
  if (Number(e.multiBossCount ?? 1) !== 1) enemy.push('mc', e.multiBossCount);
  if (Number(e.hpSlotCount ?? 1) !== 1) enemy.push('hc', e.hpSlotCount);
  if (Number(e.pendingReelShift ?? 0) !== 0) enemy.push('pr', e.pendingReelShift);
  if (e.danceActive != null) enemy.push('da', e.danceActive);
  if (Boolean(e.exTriggered)) enemy.push('xt', 1);
  if (e.fallingDownSummonPending != null) enemy.push('fd', e.fallingDownSummonPending);
  if (e.pincerDisabledSlots != null) enemy.push('pd', e.pincerDisabledSlots);
  if (e.pincerOniUses != null) enemy.push('po', e.pincerOniUses);
  if (e.pincerRushActive != null) enemy.push('pru', e.pincerRushActive);
  return enemy;
}

function sparseCompanionRuntimeKey(c) {
  const out = [];
  if ((c.attackMods?.length ?? 0) > 0) out.push('a', c.attackMods);
  if ((c.speedMods?.length ?? 0) > 0) out.push('s', c.speedMods);
  if ((c.defenseMods?.length ?? 0) > 0) out.push('d', c.defenseMods);
  if ((c.physicalEvasionMods?.length ?? 0) > 0) out.push('e', c.physicalEvasionMods);
  if (objectHasEnumerableKeys(c.statuses)) out.push('t', c.statuses);
  if (Number(c.deferredParalysisChance ?? 0) > 0) out.push('dp', c.deferredParalysisChance);
  if ((c.poison ?? 'none') !== 'none') out.push('p', c.poison);
  if ((c.permanentBuffKeys?.length ?? 0) > 0) out.push('k', c.permanentBuffKeys);
  if (Number(c.actionLockRemaining ?? 0) !== 0) out.push('lk', c.actionLockRemaining);
  if (c.active === false) out.push('x', 0);
  if (Number(c.flatAttackBonus ?? 0) !== 0) out.push('fa', c.flatAttackBonus);
  if (Number(c.flatSpeedBonus ?? 0) !== 0) out.push('fs', c.flatSpeedBonus);
  if (Number(c.postActionSpeedGain ?? 0) !== 0) out.push('ps', c.postActionSpeedGain);
  if (Number(c.postActionEnemyExGain ?? 0) !== 0) out.push('pe', c.postActionEnemyExGain);
  if (c.deathSeq != null) out.push('ds', c.deathSeq);
  if (Boolean(c.revivable)) out.push('rv', 1);
  if (Number(c.summonCurseTurns ?? 0) !== 0) out.push('ct', c.summonCurseTurns);
  if (Boolean(c.summonCurseJustApplied)) out.push('cj', 1);
  if (Boolean(c.evadedCurrentAllyAttack)) out.push('ea', 1);
  if (c.oneHitGuard != null) out.push('og', c.oneHitGuard);
  if (c.magicReflect != null) out.push('mr', c.magicReflect);
  if (c.sleepBlessing != null) out.push('sb', c.sleepBlessing);
  if (c.excursion != null) out.push('xc', c.excursion);
  if (Array.isArray(c.fenrirStateDist) && c.fenrirStateDist.length) out.push('fd', c.fenrirStateDist);
  if (Number(c.startReel ?? 0) !== 0) out.push('sr', c.startReel);
  return out;
}

const SPARSE_FIXED_COMPANION_MERGE_PRESETS = new Set(['old3_kukulkan','old3_fanlong','old5_kujeska']);

function sparseFixedCompanionRuntimeKey(runtime) {
  const e = runtime?.enemy ?? {};
  const root = [
    runtime?.ignorePlayerExTracking ? 0 : Number(runtime?.playerExGauge ?? 0),
    (runtime?.allies ?? []).map(sparseAllyRuntimeKey), sparseEnemyRuntimeKey(e), (runtime?.companions ?? []).map(sparseCompanionRuntimeKey)
  ];
  if ((runtime?.pendingReelBoosts?.length ?? 0) > 0) root.push('b', runtime.pendingReelBoosts);
  if ((runtime?.pendingReelSets?.length ?? 0) > 0) root.push('s', runtime.pendingReelSets);
  if (objectHasEnumerableKeys(runtime?.pendingCompanionReelShifts)) root.push('r', runtime.pendingCompanionReelShifts);
  if (runtime?.enemyLastTarget != null) root.push('t', runtime.enemyLastTarget);
  if ((runtime?.enemyDamagedTargets?.length ?? 0) > 0) root.push('q', runtime.enemyDamagedTargets);
  if (objectHasEnumerableKeys(runtime?.enemyHitStatusTargets)) root.push('h', runtime.enemyHitStatusTargets);
  if ((runtime?.lastAllyAttackHitSlots?.length ?? 0) > 0) root.push('l', runtime.lastAllyAttackHitSlots);
  if (runtime?.actingCompanionIndex != null) root.push('ac', runtime.actingCompanionIndex);
  return JSON.stringify(root).replace(/"seq":-?\d+(?:\.\d+)?/g, '"seq":0');
}

function sparsePairsWithoutTags(items, omittedTags) {
  if (!items?.length) return [];
  const out = [];
  for (let i = 0; i < items.length; i += 2) {
    const tag = items[i];
    if (omittedTags.has(tag)) continue;
    out.push(tag, items[i + 1]);
  }
  return out;
}

const KUJESKA_OMIT_ALLY_SPARSE_TAGS = new Set(['n']);
const KUJESKA_OMIT_ENEMY_SPARSE_TAGS = new Set(['ds','as']);
const KUJESKA_OMIT_COMPANION_SPARSE_TAGS = new Set(['ds','rv','sr']);

function kujeskaFinalAlly0RuntimeKey(runtime) {
  // 旧5章クジェスカ標準チャートの最終ターンは、全枝でキャラ1（ソンゴクウ）が
  // 最初に行動し、その直後で評価終了する。したがって、それより後にしか使われない
  // コマンド/速度/麻痺待ち等の「将来行動情報」はmerge上は不要。
  // HP、防御、魔法反射、味方の実状態異常、敵EX量は結果・表示に必要なので保持する。
  const allies = (runtime?.allies ?? []).map((a, index) => {
    const sparse = sparseAllyRuntimeKey(a);
    if (index === 0) return sparsePairsWithoutTags(sparse, KUJESKA_OMIT_ALLY_SPARSE_TAGS);
    const keep = new Set(['t','dp','x']); // 最終状態サマリーに出る情報だけ保持。
    const out = [];
    for (let i=0; i<sparse.length; i+=2) {
      const tag = sparse[i];
      if (keep.has(tag)) out.push(tag, sparse[i+1]);
    }
    return out;
  });
  const e = runtime?.enemy ?? {};
  const enemySparse = sparseEnemyRuntimeKey(e);
  const enemyKeep = new Set(['d','r','ex','xa','mc','hc']);
  const enemy = [];
  for (let i=0; i<enemySparse.length; i+=2) {
    const tag = enemySparse[i];
    if (enemyKeep.has(tag)) enemy.push(tag, enemySparse[i+1]);
  }
  const companions = (runtime?.companions ?? []).map(c => {
    const sparse = sparseCompanionRuntimeKey(c);
    // 最終のヴェノム・サラマンダ（魔法・全体）が参照し得る受け側情報だけ保持。
    const keep = new Set(['d','x','og','mr','xc']);
    const reduced = [];
    for (let i=0; i<sparse.length; i+=2) {
      const tag = sparse[i];
      if (keep.has(tag)) reduced.push(tag, sparse[i+1]);
    }
    return [c?.name ?? '', c?.maxHp ?? null, c?.hpSlot ?? null, reduced];
  });
  // ゆうわく遅延イベントは、最終評価前に行動するキャラ1への命中確率だけが必要。
  // 他キャラ向けの残余分布は評価終了後にしか使われない。
  let confuseMiss = 1;
  for (const event of runtime?.deferredConfusionEvents ?? []) {
    const hit = Math.max(0, Math.min(1, Number(event?.weights?.[1] ?? 0) || 0));
    confuseMiss *= (1 - hit);
  }
  const root = [runtime?.ignorePlayerExTracking ? 0 : Number(runtime?.playerExGauge ?? 0), allies, enemy, companions];
  const confuseChance = 1 - confuseMiss;
  if (confuseChance > 0) root.push('yc0', confuseChance);
  return JSON.stringify(root).replace(/"seq":-?\d+(?:\.\d+)?/g, '"seq":0');
}

function kujeskaRuntimeKey(runtime) {
  if (runtime?.kujeskaFinalAlly0Only) return kujeskaFinalAlly0RuntimeKey(runtime);
  const e = runtime?.enemy ?? {};
  const enemy = sparsePairsWithoutTags(sparseEnemyRuntimeKey(e), KUJESKA_OMIT_ENEMY_SPARSE_TAGS);
  const companions = (runtime?.companions ?? []).map(c => {
    // クジェスカ戦のフェンリルは標準チャートではT4まで攻撃対象にならず、
    // 最終のヴェノム・サラマンダは最大HP174を常に上回る。
    // そのため攻撃バフ量と睡眠回復量は撃破/敵EX結果へ影響しない。
    // 睡眠そのもの（行動不能）は statuses 側に残す。
    const omitted = c?.name === 'フェンリル'
      ? new Set([...KUJESKA_OMIT_COMPANION_SPARSE_TAGS, 'a', 'sb'])
      : KUJESKA_OMIT_COMPANION_SPARSE_TAGS;
    return [
      c?.name ?? '', c?.maxHp ?? null, c?.hpSlot ?? null,
      sparsePairsWithoutTags(sparseCompanionRuntimeKey(c), omitted)
    ];
  });
  const root = [
    runtime?.ignorePlayerExTracking ? 0 : Number(runtime?.playerExGauge ?? 0),
    (runtime?.allies ?? []).map(a => sparsePairsWithoutTags(sparseAllyRuntimeKey(a), KUJESKA_OMIT_ALLY_SPARSE_TAGS)), enemy, companions
  ];
  if ((runtime?.pendingReelBoosts?.length ?? 0) > 0) root.push('b', runtime.pendingReelBoosts);
  if ((runtime?.pendingReelSets?.length ?? 0) > 0) root.push('s', runtime.pendingReelSets);
  if (objectHasEnumerableKeys(runtime?.pendingCompanionReelShifts)) root.push('r', runtime.pendingCompanionReelShifts);
  if (runtime?.enemyLastTarget != null) root.push('t', runtime.enemyLastTarget);
  if ((runtime?.enemyDamagedTargets?.length ?? 0) > 0) root.push('q', runtime.enemyDamagedTargets);
  if (objectHasEnumerableKeys(runtime?.enemyHitStatusTargets)) root.push('h', runtime.enemyHitStatusTargets);
  if ((runtime?.lastAllyAttackHitSlots?.length ?? 0) > 0) root.push('l', runtime.lastAllyAttackHitSlots);
  if (runtime?.actingCompanionIndex != null) root.push('ac', runtime.actingCompanionIndex);
  if ((runtime?.deferredConfusionEvents?.length ?? 0) > 0) root.push('yc', runtime.deferredConfusionEvents);
  return JSON.stringify(root).replace(/"seq":-?\d+(?:\.\d+)?/g, '"seq":0');
}


const KUJESKA_DIST_BASE_IDS = new WeakMap();
let KUJESKA_DIST_BASE_ID_SEQ = 1;
function distributionBaseAndFactor(dist) {
  if (dist instanceof ScaledDistributionView) return { base:dist.base, factor:dist.factor };
  return { base:dist, factor:1 };
}
function kujeskaDistributionBaseId(dist) {
  const { base } = distributionBaseAndFactor(dist);
  let id = KUJESKA_DIST_BASE_IDS.get(base);
  if (id == null) { id = KUJESKA_DIST_BASE_ID_SEQ++; KUJESKA_DIST_BASE_IDS.set(base, id); }
  return id;
}
function mixNormalizedFenrirStateDists(a, wa, b, wb) {
  const total = wa + wb;
  if (!(total > 0)) return a ?? b ?? [];
  const m = new Map();
  for (const row of a ?? []) {
    const key = `${Number(row?.[0] ?? 0)},${Number(row?.[1] ?? 0)}`;
    m.set(key, (m.get(key) ?? 0) + Number(row?.[2] ?? 0) * wa);
  }
  for (const row of b ?? []) {
    const key = `${Number(row?.[0] ?? 0)},${Number(row?.[1] ?? 0)}`;
    m.set(key, (m.get(key) ?? 0) + Number(row?.[2] ?? 0) * wb);
  }
  return normalizedFenrirStateDist(m, total);
}
function kujeskaRuntimeKeyOmitFenrirDistAt(runtime, targetCompanionIndex) {
  const e = runtime?.enemy ?? {};
  const enemy = sparsePairsWithoutTags(sparseEnemyRuntimeKey(e), KUJESKA_OMIT_ENEMY_SPARSE_TAGS);
  const companions = (runtime?.companions ?? []).map((c, index) => {
    const omitted = c?.name === 'フェンリル'
      ? new Set([...KUJESKA_OMIT_COMPANION_SPARSE_TAGS, 'a', 'sb', ...(index === targetCompanionIndex ? ['fd'] : [])])
      : KUJESKA_OMIT_COMPANION_SPARSE_TAGS;
    return [c?.name ?? '', c?.maxHp ?? null, c?.hpSlot ?? null, sparsePairsWithoutTags(sparseCompanionRuntimeKey(c), omitted)];
  });
  const root = [
    runtime?.ignorePlayerExTracking ? 0 : Number(runtime?.playerExGauge ?? 0),
    (runtime?.allies ?? []).map(a => sparsePairsWithoutTags(sparseAllyRuntimeKey(a), KUJESKA_OMIT_ALLY_SPARSE_TAGS)), enemy, companions
  ];
  if ((runtime?.pendingReelBoosts?.length ?? 0) > 0) root.push('b', runtime.pendingReelBoosts);
  if ((runtime?.pendingReelSets?.length ?? 0) > 0) root.push('s', runtime.pendingReelSets);
  if (objectHasEnumerableKeys(runtime?.pendingCompanionReelShifts)) root.push('r', runtime.pendingCompanionReelShifts);
  if (runtime?.enemyLastTarget != null) root.push('t', runtime.enemyLastTarget);
  if ((runtime?.enemyDamagedTargets?.length ?? 0) > 0) root.push('q', runtime.enemyDamagedTargets);
  if (objectHasEnumerableKeys(runtime?.enemyHitStatusTargets)) root.push('h', runtime.enemyHitStatusTargets);
  if ((runtime?.lastAllyAttackHitSlots?.length ?? 0) > 0) root.push('l', runtime.lastAllyAttackHitSlots);
  if (runtime?.actingCompanionIndex != null) root.push('ac', runtime.actingCompanionIndex);
  if ((runtime?.deferredConfusionEvents?.length ?? 0) > 0) root.push('yc', runtime.deferredConfusionEvents);
  return JSON.stringify(root).replace(/"seq":-?\d+(?:\.\d+)?/g, '"seq":0');
}
function mergeKujeskaFenrirMarginals(scenarios) {
  if (!Array.isArray(scenarios) || scenarios.length < 2) return scenarios ?? [];
  let current = scenarios;
  const maxCompanions = Math.max(0, ...current.map(sc => sc.runtime?.companions?.length ?? 0));
  for (let targetIndex=0; targetIndex<maxCompanions; targetIndex++) {
    const grouped = new Map();
    const passthrough = [];
    for (const sc of current) {
      const c = sc.runtime?.companions?.[targetIndex];
      if (c?.name !== 'フェンリル' || !Array.isArray(c.fenrirStateDist) || !c.fenrirStateDist.length) {
        passthrough.push(sc); continue;
      }
      const { base, factor } = distributionBaseAndFactor(sc.hpDist);
      const key = `${kujeskaRuntimeKeyOmitFenrirDistAt(sc.runtime, targetIndex)}|${(sc.reels ?? []).join(',')}|${Number(sc.enemyReel ?? 0)}|${(sc.companionReels ?? []).join(',')}|b${kujeskaDistributionBaseId(sc.hpDist)}`;
      const prev = grouped.get(key);
      if (!prev) {
        grouped.set(key, { ...sc, _base:base, _factor:factor });
        continue;
      }
      const nextFactor = prev._factor + factor;
      const rt = cloneRuntimeState(prev.runtime);
      rt.companions[targetIndex].fenrirStateDist = mixNormalizedFenrirStateDists(
        prev.runtime.companions[targetIndex].fenrirStateDist, prev._factor,
        c.fenrirStateDist, factor
      );
      prev.runtime = rt;
      prev._factor = nextFactor;
      prev.hpDist = scaleDistribution(prev._base, nextFactor);
    }
    current = passthrough.concat([...grouped.values()].map(sc => { delete sc._base; delete sc._factor; return sc; }));
  }
  return current;
}

function stringifyRuntimeForMerge(runtime) {
  const fixedCompanionCount = runtime?.companions?.length ?? 0;
  if (runtime?.enemy?.presetId === 'old5_kujeska') return kujeskaRuntimeKey(runtime);
  if (SPARSE_FIXED_COMPANION_MERGE_PRESETS.has(runtime?.enemy?.presetId)
      && fixedCompanionCount >= 1 && fixedCompanionCount <= 2
      && runtime.companions.every(companion => companion?.summoned !== true)) {
    return sparseFixedCompanionRuntimeKey(runtime);
  }
  if (FAST_SIMPLE_FIXED_COMPANION_MERGE_PRESETS.has(runtime?.enemy?.presetId)
      && fixedCompanionCount >= 1 && fixedCompanionCount <= 2
      && runtime.companions.every(companion => companion?.summoned !== true)) {
    return fastSimpleFixedCompanionRuntimeKey(runtime);
  }
  if ((runtime?.companions?.length ?? 0) === 0) {
    // v0.5.83: sparse projection helpersを共有し、mergeごとのclosure/Object.keys/regex生成を避ける。
    const e = runtime?.enemy ?? {};
    const root = [
      runtime?.ignorePlayerExTracking ? 0 : Number(runtime?.playerExGauge ?? 0),
      (runtime?.allies ?? []).map(sparseAllyRuntimeKey), sparseEnemyRuntimeKey(e)
    ];
    if ((runtime?.pendingReelBoosts?.length ?? 0) > 0) root.push('b', runtime.pendingReelBoosts);
    if ((runtime?.pendingReelSets?.length ?? 0) > 0) root.push('s', runtime.pendingReelSets);
    if (objectHasEnumerableKeys(runtime?.pendingCompanionReelShifts)) root.push('r', runtime.pendingCompanionReelShifts);
    if (runtime?.enemyLastTarget != null) root.push('t', runtime.enemyLastTarget);
    if ((runtime?.enemyDamagedTargets?.length ?? 0) > 0) root.push('d', runtime.enemyDamagedTargets);
    if (objectHasEnumerableKeys(runtime?.enemyHitStatusTargets)) root.push('h', runtime.enemyHitStatusTargets);
    if ((runtime?.lastAllyAttackHitSlots?.length ?? 0) > 0) root.push('l', runtime.lastAllyAttackHitSlots);
    if (runtime?.actingCompanionIndex != null) root.push('ac', runtime.actingCompanionIndex);
    return JSON.stringify(root).replace(/"seq":-?\d+(?:\.\d+)?/g, '"seq":0');
  }

  // 1回のsimulate内で不変な基礎能力・属性・種族・名前などはmerge判定に不要。
  // 動的部分だけを投影することで、2ターン目以降の大量mergeで巨大JSONを作らない。
  const enemy = compactObjectForMerge(runtime?.enemy ?? {}, ENEMY_STATIC_MERGE_KEYS);

  // ドック・ローの再行動技は「同じリール内の同名マス」が完全に交換可能。
  // どの物理スロットを消費したかではなく、各リールで何個消費したかだけをキー化する。
  if (runtime?.enemy?.presetId === 'q_dock_low' && runtime.enemy?.commandOverrides) {
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
      } else counts[`raw:${slotKey}`] = nextCommand;
    }
    enemy.commandOverrides = Object.fromEntries(Object.entries(counts).sort(([a],[b]) => a.localeCompare(b, 'ja')));
  }

  const projection = {
    // ignorePlayerExTracking=trueならplayerExGauge差は将来の結果に使わない。
    p: runtime?.ignorePlayerExTracking ? 0 : Number(runtime?.playerExGauge ?? 0),
    a: (runtime?.allies ?? []).map(ally => compactObjectForMerge(ally, ALLY_STATIC_MERGE_KEYS)),
    e: enemy,
    c: (runtime?.companions ?? []).map(companion => {
      // 召喚個体は種類・HP slot・最大HPが枝によって異なり得るのでidentityは保持する。
      const compact = compactObjectForMerge(companion, COMPANION_STATIC_MERGE_KEYS);
      compact.name = companion?.name ?? '';
      compact.maxHp = companion?.maxHp ?? null;
      compact.hpSlot = companion?.hpSlot ?? null;
      return compact;
    }),
    b: runtime?.pendingReelBoosts ?? [],
    s: runtime?.pendingReelSets ?? [],
    r: runtime?.pendingCompanionReelShifts ?? {},
    // 攻撃本体→追加効果の間だけ必要な一時対象情報。ここを落とすと、
    // ランダム単体攻撃の対象枝が追加効果適用前に誤って統合される。
    t: runtime?.enemyLastTarget ?? null,
    d: runtime?.enemyDamagedTargets ?? [],
    h: runtime?.enemyHitStatusTargets ?? {},
    l: runtime?.lastAllyAttackHitSlots ?? [],
    ac: runtime?.actingCompanionIndex ?? null
  };
  return JSON.stringify(projection)
    .replace(/"seq":-?\d+(?:\.\d+)?/g, '"seq":0')
    .replace(/"summoned":(?:true|false)/g, '"summoned":false');
}

function runtimeScenarioKey(runtime, reels, enemyReel = 0, companionReels = []) {
  return `${stringifyRuntimeForMerge(runtime)}|${(reels ?? []).join(',')}|${Number(enemyReel ?? 0)}|${(companionReels ?? []).join(',')}`;
}

function compactInactiveCompanionsAtTurnBoundary(sc, compactHpSlots = false) {
  const companions = sc.runtime?.companions ?? [];
  if (!companions.some(x => x?.active === false)) return sc;
  const keep = [];
  for (let i = 0; i < companions.length; i++) {
    if (companions[i]?.active !== false) keep.push(i);
  }
  const runtime = cloneRuntimeState(sc.runtime);
  const priorReels = Array.isArray(sc.companionReels) ? sc.companionReels : [];

  // v0.5.80: お供が全滅した場合、残りHPスロットはBOSS分だけに正規化する。
  // 旧実装は companion object だけを削除し、hpDist を「BOSS,0」のまま残していたため、
  // 以後の単体戦まで複数敵用の文字列HP・対象判定を通っていた。
  if (compactHpSlots && keep.length === 0) {
    const bossSlots = bossHpSlotCount(runtime);
    const hpDist = new Map();
    for (const [hp, probability] of sc.hpDist) {
      const parts = enemyHpPartArray(hp);
      const bossParts = parts.slice(0, bossSlots);
      while (bossParts.length < bossSlots) bossParts.push(0);
      const key = bossSlots === 1 ? Math.max(0, Number(bossParts[0] ?? 0)) : multiHpKey(bossParts);
      hpDist.set(key, (hpDist.get(key) ?? 0) + probability);
    }
    runtime.companions = [];
    runtime.enemy.hpSlotCount = bossSlots;
    runtime.pendingCompanionReelShifts = {};
    delete runtime.actingCompanionIndex;
    return { ...sc, runtime, companionReels:[], hpDist };
  }

  runtime.companions = keep.map(i => runtime.companions[i]);
  const companionReels = keep.map((oldIndex, newIndex) => {
    const companion = runtime.companions[newIndex];
    return priorReels[oldIndex] ?? companion?.startReel ?? 0;
  });
  return { ...sc, runtime, companionReels };
}

function mergeScenarios(scenarios) {
  if (!scenarios?.length) return [];
  if (scenarios.length === 1) return scenarios;
  const byKey = new Map();
  const runtimeKeyCache = new WeakMap();
  for (const sc of scenarios) {
    let companionReels = Array.isArray(sc.companionReels) ? sc.companionReels : [];
    const companions = sc.runtime?.companions ?? [];
    let normalizedDeadReels = null;
    for (let i=0; i<companionReels.length; i++) {
      const companion = companions[i];
      // v0.5.85: クジェスカ戦のフェンリル専用Markov経路では、実リール分布を
      // companion.fenrirStateDist 内に保持する。外側 companionReels の値は二重表現なので
      // merge key では0へ正規化して同値枝を統合する。
      if (companion?.name === 'フェンリル' && Array.isArray(companion?.fenrirStateDist)) {
        if (Number(companionReels[i] ?? 0) !== 0) {
          if (!normalizedDeadReels) normalizedDeadReels = companionReels.slice();
          normalizedDeadReels[i] = 0;
        }
        continue;
      }
      if (companion?.active === false && companion?.revivable !== true && Number(companionReels[i] ?? 0) !== 0) {
        if (!normalizedDeadReels) normalizedDeadReels = companionReels.slice();
        normalizedDeadReels[i] = 0;
      }
    }
    if (normalizedDeadReels) companionReels = normalizedDeadReels;
    let runtimeKey = runtimeKeyCache.get(sc.runtime);
    if (runtimeKey == null) { runtimeKey = stringifyRuntimeForMerge(sc.runtime); runtimeKeyCache.set(sc.runtime, runtimeKey); }
    const finalAlly0Only = Boolean(sc.runtime?.kujeskaFinalAlly0Only);
    const reelKey = finalAlly0Only ? String(sc.reels?.[0] ?? 0) : (sc.reels ?? []).join(',');
    const enemyReelKey = finalAlly0Only ? 0 : Number(sc.enemyReel ?? 0);
    const companionReelKey = finalAlly0Only ? '' : companionReels.join(',');
    const key = `${runtimeKey}|${reelKey}|${enemyReelKey}|${companionReelKey}`;
    const existing = byKey.get(key);
    if (existing) {
      if (!existing._hpOwned) {
        existing.hpDist = new Map(existing.hpDist);
        existing._hpOwned = true;
      }
      addDistribution(existing.hpDist, sc.hpDist);
    } else {
      // 入力シナリオはこのmerge後に破棄され、hpDistは以後読み取り専用で扱われる。
      // 衝突が起きた時だけコピーして加算することで巨大Mapの無駄な複製を避ける。
      byKey.set(key, { runtime:sc.runtime, reels:sc.reels, enemyReel:sc.enemyReel ?? 0, companionReels, hpDist:sc.hpDist, order:sc.order, _hpOwned:false });
    }
  }
  const out = [...byKey.values()];
  for (const sc of out) delete sc._hpOwned;
  return out;
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

function statusRefreshWouldBeNoop(ally, effect) {
  const status = String(effect?.status ?? '');
  if (!status || status === 'poison' || status === 'deadlyPoison') return false;
  const existing = ally?.statuses?.[status];
  if (!existing) return false;
  const defaultDuration = status === 'silence' || status === 'darkness' || status === 'cold' ? 3
    : status === 'sleep' ? 5
    : status === 'petrification' ? 99
    : 1;
  const incoming = Math.max(1, Number(effect?.duration ?? defaultDuration) || defaultDuration);
  return Math.max(0, Number(existing?.remaining ?? 0) || 0) >= incoming;
}

function mergeRuntimeBranches(branches) {
  if (!branches?.length) return [];
  if (branches.length === 1) return branches;
  const byKey = new Map();
  const runtimeKeyCache = new WeakMap();
  for (const branch of branches) {
    let key = runtimeKeyCache.get(branch.runtime);
    if (key == null) { key = stringifyRuntimeForMerge(branch.runtime); runtimeKeyCache.set(branch.runtime, key); }
    const existing = byKey.get(key);
    if (existing) {
      if (!existing._hpOwned) { existing.hpDist = new Map(existing.hpDist); existing._hpOwned = true; }
      addDistribution(existing.hpDist, branch.hpDist);
    } else byKey.set(key, { runtime:branch.runtime, hpDist:branch.hpDist, _hpOwned:false });
  }
  const out = [...byKey.values()];
  for (const branch of out) delete branch._hpOwned;
  return out;
}

let ACTIVE_FINAL_STATUS_RELEVANT_ALLIES = null;
let ACTIVE_FINAL_STATUS_RELEVANT_TYPES = null;
// 撃破率に影響しない沈黙は枝分岐させない。シミュレーションごとに、
// 今回の設定で魔法行動（または七十二変化）を取り得る味方だけを事前抽出する。
let ACTIVE_SILENCE_RELEVANT_ALLIES = null;
let ACTIVE_DARKNESS_RELEVANT_ALLIES = null;
let ACTIVE_FINAL_BOSS_CHAIN = false;

function deferKujeskaYuwaku(branch, effect, sourceSkill) {
  const runtime = branch?.runtime;
  if (runtime?.enemy?.presetId !== 'old5_kujeska') return null;
  if (String(sourceSkill?.name ?? '') !== 'ゆうわく' || String(effect?.status ?? '') !== 'confusion') return null;
  const indexes = enemyTargetIndexes(runtime, 'random');
  if (!indexes.length) return branch;
  const weights = Array.from({ length: runtime.allyCount + 1 }, () => 0);
  const targetWeight = 1 / indexes.length;
  let successMass = 0;
  for (const allyIndex of indexes) {
    const ally = runtime.allies?.[allyIndex];
    if (!ally || ally.active === false) continue;
    if (!statusConditionAtHitMatches(runtime, allyIndex, effect)) continue;
    // 付与時点ですでに同等以上の混乱があるなら、この命中は将来へ持ち越されない。
    if (statusRefreshWouldBeNoop(ally, effect)) continue;
    const chance = Math.max(0, Math.min(1, adjustedStatusChance(ally, effect, sourceSkill) / 100));
    if (!(chance > 0)) continue;
    const p = targetWeight * chance;
    weights[allyIndex + 1] += p;
    successMass += p;
  }
  weights[0] = Math.max(0, 1 - successMass);
  if (!(successMass > 0)) return branch;
  const rt = cloneRuntimeState(runtime);
  rt.deferredConfusionEvents ??= [];
  rt.deferredConfusionEvents.push({ weights });
  return { runtime:rt, hpDist:branch.hpDist };
}

function resolveDeferredConfusionForAllyScenarios(scenarios, allyIndex) {
  if (!scenarios?.length) return scenarios ?? [];
  let current = scenarios;
  const hasAny = current.some(sc => (sc.runtime?.deferredConfusionEvents?.length ?? 0) > 0);
  if (!hasAny) return current;
  const nextAll = [];
  for (const sc of current) {
    const events = sc.runtime?.deferredConfusionEvents ?? [];
    if (!events.length) { nextAll.push(sc); continue; }
    let local = [{ runtime:sc.runtime, hpDist:sc.hpDist, confused:false, residual:[] }];
    for (const event of events) {
      const weights = Array.isArray(event?.weights) ? event.weights : [];
      const hitP = Math.max(0, Math.min(1, Number(weights[allyIndex + 1] ?? 0) || 0));
      const missP = Math.max(0, 1 - hitP);
      const next = [];
      for (const branch of local) {
        if (hitP > 0) {
          // このイベントの結果が当該味方への混乱だった枝。イベントはここで消費済み。
          next.push({
            runtime:branch.runtime,
            hpDist:scaleDistribution(branch.hpDist, hitP),
            confused:true,
            residual:branch.residual.slice()
          });
        }
        if (missP > 0) {
          const remainingWeights = weights.slice();
          if (allyIndex + 1 < remainingWeights.length) remainingWeights[allyIndex + 1] = 0;
          let targetRemain = 0;
          for (let i=1; i<remainingWeights.length; i++) targetRemain += Math.max(0, Number(remainingWeights[i] ?? 0) || 0);
          const residual = branch.residual.slice();
          if (targetRemain > 0 && missP > 0) {
            for (let i=0; i<remainingWeights.length; i++) remainingWeights[i] = Math.max(0, Number(remainingWeights[i] ?? 0) || 0) / missP;
            residual.push({ weights:remainingWeights });
          }
          next.push({
            runtime:branch.runtime,
            hpDist:scaleDistribution(branch.hpDist, missP),
            confused:branch.confused,
            residual
          });
        }
      }
      local = next;
    }
    for (const branch of local) {
      const rt = cloneRuntimeState(branch.runtime);
      if (branch.residual.length) rt.deferredConfusionEvents = branch.residual;
      else delete rt.deferredConfusionEvents;
      if (branch.confused && rt.allies?.[allyIndex] && !rt.allies[allyIndex].statuses?.confusion) {
        inflictStatus(rt.allies[allyIndex], { status:'confusion', duration:1 });
      }
      nextAll.push({ ...sc, runtime:rt, hpDist:branch.hpDist });
    }
  }
  return mergeScenarios(nextAll);
}

function branchStatusOnTargets(branches, indexes, effect, sourceSkill) {
  if (effect?.status === 'poison' || effect?.status === 'deadlyPoison') return branches;
  // v0.5.85: 旧5章クジェスカ戦のフェンリル〖ほえる〗は、麻痺成功/失敗を
  // 対象の次の行動機会まで遅延評価する。複数回は厳密に合成する。
  if (effect?.status === 'paralysis' && String(sourceSkill?.name ?? '') === 'ほえる'
      && branches.every(branch => branch?.runtime?.enemy?.presetId === 'old5_kujeska')) {
    for (const branch of branches) {
      for (const allyIndex of indexes) {
        const ally = branch.runtime?.allies?.[allyIndex];
        if (!ally || ally.active === false || ally.statuses?.paralysis) continue;
        if (!statusConditionAtHitMatches(branch.runtime, allyIndex, effect)) continue;
        const p = Math.max(0, Math.min(1, adjustedStatusChance(ally, effect, sourceSkill) / 100));
        if (!(p > 0)) continue;
        const q = Math.max(0, Math.min(1, Number(ally.deferredParalysisChance ?? 0) || 0));
        ally.deferredParalysisChance = 1 - (1 - q) * (1 - p);
      }
    }
    return branches;
  }
  let current = branches;
  const effectiveIndexes = ACTIVE_FINAL_STATUS_RELEVANT_ALLIES == null ? indexes : indexes.filter(i => ACTIVE_FINAL_STATUS_RELEVANT_ALLIES.has(i));
  for (const allyIndex of effectiveIndexes) {
    if (effect?.status === 'silence' && ACTIVE_SILENCE_RELEVANT_ALLIES && !ACTIVE_SILENCE_RELEVANT_ALLIES.has(allyIndex)) continue;
    if (effect?.status === 'darkness' && ACTIVE_DARKNESS_RELEVANT_ALLIES && !ACTIVE_DARKNESS_RELEVANT_ALLIES.has(allyIndex)) continue;
    if (ACTIVE_FINAL_STATUS_RELEVANT_TYPES) {
      const relevantTypes = ACTIVE_FINAL_STATUS_RELEVANT_TYPES.get(allyIndex);
      if (!relevantTypes?.has(String(effect?.status ?? ''))) continue;
    }
    const next = [];
    for (const branch of current) {
      const ally = branch.runtime.allies[allyIndex];
      if (!ally || ally.active === false) { next.push(branch); continue; }
      if (effect?.status === 'brainwash' && branch.runtime.allies.filter(x => x?.active !== false).length <= 1) { next.push(branch); continue; }
      if (!statusConditionAtHitMatches(branch.runtime, allyIndex, effect)) { next.push(branch); continue; }
      // 既に同じ状態が同等以上の残り時間で付いている場合、再付与成功と失敗は同一状態になる。
      // 分岐せず確率質量をそのまま保持する。
      if (statusRefreshWouldBeNoop(ally, effect)) { next.push(branch); continue; }
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
    const startReel = Math.max(0, Math.min((cp?.matrix?.length ?? 1) - 1, Number(effect.startReel ?? 0) || 0));
    runtime.companions.push({
      name,
      maxHp:baseHp || null, hpSlot,
      // Lv10召喚など、技側で個別ステータスが明示される場合はそちらを優先。
      baseAttack: Number(effect.attack ?? cp?.attack ?? 0) || 0,
      baseSpeed: Number(effect.speed ?? cp?.speed ?? 0) || 0,
      attribute:String(effect.attribute ?? cp?.attribute ?? ''), race:String(effect.race ?? cp?.race ?? 'normal'),
      attackMods: [], speedMods: [], defenseMods: [], statuses:{}, flatAttackBonus:0, flatSpeedBonus:0, postActionSpeedGain:0, postActionEnemyExGain:0,
      permanentBuffKeys:[], actionLockRemaining:0, active: true,
      startReel,
      // 旧5章クジェスカ標準チャートだけ、フェンリルの内部リール/睡眠を確率ベクトルで保持する。
      // [reel, sleepRemaining, probability]。ほえる/睡眠解除など外部へ影響する結果だけ後で分岐する。
      fenrirStateDist: runtime.kujeskaFenrirMarkov && name === 'フェンリル' ? [[startReel,0,1]] : undefined,
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
          if (selected != null) {
            next.push(...branchStatusOnTargets([branch], [selected], effect, skill));
            continue;
          }
          // クジェスカ戦の〖ゆうわく〗は「誰に当たったか」の相関を保ったまま、
          // 各対象の次の行動機会まで1イベントとして遅延評価する。
          const deferred = deferKujeskaYuwaku(branch, effect, skill);
          if (deferred) { next.push(deferred); continue; }
          // 攻撃を伴わないランダム単体効果は、対象を1体だけ等確率で選んでから
          // その対象に状態異常成功率を判定する。
          const indexes = enemyTargetIndexes(branch.runtime, 'random');
          if (!indexes.length) { next.push(branch); continue; }
          const targetWeight = 1 / indexes.length;
          for (const allyIndex of indexes) {
            const targeted = { runtime: cloneRuntimeState(branch.runtime), hpDist: scaleDistribution(branch.hpDist, targetWeight) };
            next.push(...branchStatusOnTargets([targeted], [allyIndex], effect, skill));
          }
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
        if (effect.scope === 'enemyTeam') {
          addEnemyTeamAttackMod(runtime, normalized, `${skill.name}:${effect.type}`);
        } else {
          // お供が「自分」対象の自己強化を使った場合はBOSSではなく、そのお供自身へ付与する。
          // 例: 魔皇クジェスカが召喚するフェンリルの〖うなる〗。
          const actingIndex = Number(runtime.actingCompanionIndex);
          const targetSelf = String(effect.target ?? skill.target ?? '') === 'self';
          const actingCompanion = Number.isInteger(actingIndex) ? runtime.companions?.[actingIndex] : null;
          if (targetSelf && actingCompanion && actingCompanion.active !== false) {
            actingCompanion.attackMods ??= [];
            addOrRefreshEnemyStatMod(actingCompanion.attackMods, normalized, ++runtime.seq, `${skill.name}:${effect.type}`);
          } else {
            addOrRefreshEnemyStatMod(runtime.enemy.attackMods, normalized, ++runtime.seq, `${skill.name}:${effect.type}`);
          }
        }
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

const ENEMY_HIT_CHOICES_CACHE = new WeakMap();

function enemyHitCountChoices(skill) {
  if (skill && typeof skill === 'object' && ENEMY_HIT_CHOICES_CACHE.has(skill)) return ENEMY_HIT_CHOICES_CACHE.get(skill);
  let result;
  if (skill?.hitsMin != null || skill?.hitsMax != null) {
    const min = Math.max(1, Math.floor(Number(skill.hitsMin ?? skill.hitsMax ?? 1) || 1));
    const max = Math.max(min, Math.floor(Number(skill.hitsMax ?? skill.hitsMin ?? min) || min));
    const probability = 1 / (max - min + 1);
    result = Array.from({ length: max - min + 1 }, (_, i) => ({ hits: min + i, probability }));
  } else {
    result = [{ hits: Math.max(1, Math.floor(Number(skill?.hits ?? 1) || 1)), probability: 1 }];
  }
  if (skill && typeof skill === 'object') ENEMY_HIT_CHOICES_CACHE.set(skill, result);
  return result;
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
  if (statusRefreshWouldBeNoop(ally, effect)) return { hit:[], miss:[branch] };
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

function executeCompanionAquaVitaSkill(runtime, enemyHpDist, skill) {
  const bossCount = bossHpSlotCount(runtime);
  const companionBySlot = new Map();
  for (const i of targetableEnemyCompanionIndexes(runtime)) {
    const companion = runtime.companions?.[i];
    const slot = Number(companion?.hpSlot);
    if (Number.isInteger(slot) && slot >= 0) companionBySlot.set(slot, i);
  }
  const healFor = (attribute, race) => {
    const water = String(attribute ?? '').trim() === 'water';
    const aquatic = normalizeEnemyRace(race) === 'aquatic';
    if (water && aquatic) return Math.max(0, trunc0(Number(skill.healWaterAquatic ?? 150) || 0));
    if (water || aquatic) return Math.max(0, trunc0(Number(skill.healWaterOrAquatic ?? 110) || 0));
    return Math.max(0, trunc0(Number(skill.healNormal ?? 70) || 0));
  };
  const out = [];
  for (const [hp, probability] of enemyHpDist) {
    const parts = enemyHpPartArray(hp);
    const candidates = [];
    for (let slot = 0; slot < Math.min(bossCount, parts.length); slot++) {
      if (parts[slot] > 0) candidates.push({ slot, companionIndex:null, attribute:runtime.enemy?.attribute, race:runtime.enemy?.race });
    }
    for (const [slot, companionIndex] of companionBySlot) {
      if ((parts[slot] ?? 0) <= 0) continue;
      const companion = runtime.companions?.[companionIndex];
      const profile = enemyCompanionProfile(companion?.name ?? '');
      candidates.push({
        slot, companionIndex,
        attribute:companion?.attribute ?? profile?.attribute,
        race:companion?.race ?? profile?.race
      });
    }
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
      next[target.slot] = Math.min(cap, Math.max(0, next[target.slot]) + healFor(target.attribute, target.race));
      out.push({ runtime:rt, hpDist:new Map([[next.length > 1 ? multiHpKey(next) : next[0], weight]]) });
    }
  }
  return mergeRuntimeBranches(out);
}

function executeCompanionSelfBlessingSkill(runtime, enemyHpDist, skill) {
  const companionIndex = Number(runtime?.actingCompanionIndex);
  const companion = Number.isInteger(companionIndex) ? runtime.companions?.[companionIndex] : null;
  if (!companion || companion.active === false) return [{ runtime, hpDist:enemyHpDist }];
  if (companion.selfBlessing && Number(skill.attackGainIfBlessed ?? 0) !== 0) {
    companion.flatAttackBonus = Number(companion.flatAttackBonus ?? 0) + Number(skill.attackGainIfBlessed ?? 0);
  }
  companion.selfBlessing = { mode:'attackPercent', value:Number(skill.value ?? 120) || 120 };
  return [{ runtime, hpDist:enemyHpDist }];
}

function executeCompanionHpCostSummonSkill(runtime, enemyHpDist, skill) {
  const companionIndex = Number(runtime?.actingCompanionIndex);
  const companion = Number.isInteger(companionIndex) ? runtime.companions?.[companionIndex] : null;
  const cost = Math.max(0, Math.trunc(Number(skill.hpCost ?? 0) || 0));
  const summon = skill.summon && typeof skill.summon === 'object' ? skill.summon : null;
  if (!companion || companion.active === false || !Number.isInteger(Number(companion.hpSlot)) || !summon) {
    return [{ runtime, hpDist:enemyHpDist }];
  }
  // 敵チーム上限はBOSS+お供2体。空きがなければ召喚もHP消費も起こさない。
  if ((runtime.companions ?? []).filter(x => x?.active !== false).length >= 2) {
    return [{ runtime, hpDist:enemyHpDist }];
  }
  const slot = Number(companion.hpSlot);
  const out = [];
  for (const [hp, probability] of enemyHpDist) {
    const parts = enemyHpPartArray(hp);
    const current = Math.max(0, Number(parts[slot] ?? 0) || 0);
    // HPを必要量消費できない場合は不発。0になる支払いも不可としてHP>costを要求する。
    if (!(current > cost)) {
      out.push({ runtime:cloneRuntimeState(runtime), hpDist:new Map([[hp, probability]]) });
      continue;
    }
    const rt = cloneRuntimeState(runtime);
    const next = parts.slice();
    next[slot] = current - cost;
    let dist = new Map([[next.length > 1 ? multiHpKey(next) : next[0], probability]]);
    const added = summonEnemyCompanion(rt, { type:'summonCompanion', ...summon });
    if (added.length) dist = appendEnemyHpSlots(dist, added.map(index => rt.companions[index]?.maxHp ?? 0));
    out.push({ runtime:rt, hpDist:dist });
  }
  return mergeRuntimeBranches(out);
}

function applyCompanionSelfBlessingAfterAction(runtime, hpDist, companionIndex) {
  const companion = runtime?.companions?.[companionIndex];
  const blessing = companion?.selfBlessing;
  if (!companion || companion.active === false || !blessing || !Number.isInteger(Number(companion.hpSlot))) return hpDist;
  const attack = applyMods(
    Number(companion.baseAttack ?? 0) + Number(companion.flatAttackBonus ?? 0),
    companion.attackMods ?? [], { clampMin:0, clampMax:999 }
  );
  const amount = blessing.mode === 'flat'
    ? trunc0(Number(blessing.value ?? 0) || 0)
    : trunc0(attack * (Number(blessing.value ?? 0) || 0) / 100);
  return amount > 0
    ? addEnemyHpSlotDistribution(hpDist, Number(companion.hpSlot), amount, Math.max(1, Number(companion.maxHp ?? 1) || 1))
    : hpDist;
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
  if (skill.kind === 'companionAquaVita') return executeCompanionAquaVitaSkill(runtime, enemyHpDist, skill);
  if (skill.kind === 'companionSelfBlessing') return executeCompanionSelfBlessingSkill(runtime, enemyHpDist, skill);
  if (skill.kind === 'companionHpCostSummon') return executeCompanionHpCostSummonSkill(runtime, enemyHpDist, skill);
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

function resolveDeferredParalysisForAllyScenarios(scenarios, allyIndex) {
  if (!scenarios?.length) return scenarios ?? [];
  const out = [];
  for (const sc of scenarios) {
    const ally = sc.runtime?.allies?.[allyIndex];
    const q = Math.max(0, Math.min(1, Number(ally?.deferredParalysisChance ?? 0) || 0));
    if (!(q > 0) || !ally || ally.active === false || ally.statuses?.paralysis) {
      if (ally?.deferredParalysisChance) delete ally.deferredParalysisChance;
      out.push(sc);
      continue;
    }
    if (q >= 1) {
      const rt = cloneRuntimeState(sc.runtime);
      delete rt.allies[allyIndex].deferredParalysisChance;
      rt.allies[allyIndex].statuses ??= {};
      rt.allies[allyIndex].statuses.paralysis = { remaining:1 };
      out.push({ ...sc, runtime:rt });
      continue;
    }
    const missRt = cloneRuntimeState(sc.runtime);
    delete missRt.allies[allyIndex].deferredParalysisChance;
    const hitRt = cloneRuntimeState(sc.runtime);
    delete hitRt.allies[allyIndex].deferredParalysisChance;
    hitRt.allies[allyIndex].statuses ??= {};
    hitRt.allies[allyIndex].statuses.paralysis = { remaining:1 };
    out.push({ ...sc, runtime:missRt, hpDist:scaleDistribution(sc.hpDist, 1 - q) });
    out.push({ ...sc, runtime:hitRt, hpDist:scaleDistribution(sc.hpDist, q) });
  }
  return mergeScenarios(out);
}

function canonicalizeFinalTurnOneShotStatuses(runtime) {
  // 最終ターンでは各味方の通常行動機会は残り1回だけなので、暗闇・沈黙・風邪の
  // 2ターン以上という差は撃破判定には影響しない。一方、ターン終了時の状態サマリーでは
  // remaining=1 は消滅し、remaining>=2 は残るため、その2クラスは必ず保持する。
  for (const ally of runtime?.allies ?? []) {
    if (!ally?.statuses) continue;
    for (const status of ['darkness','silence','cold']) {
      const current = ally.statuses[status];
      if (current) current.remaining = Math.min(2, Math.max(1, Number(current.remaining ?? 1)));
    }
  }
  return runtime;
}

function scenarioStatusSummary(scenarios, allyCount) {
  const out = Array.from({ length: allyCount }, () => ({ paralysis: 0, confusion: 0, silence: 0, darkness: 0, sleep: 0, petrification:0, cold:0, brainwash:0, curse:0 }));
  for (const sc of scenarios) {
    const mass = distributionMass(sc.hpDist);
    for (let i = 0; i < allyCount; i++) {
      const ally = sc.runtime.allies[i];
      for (const status of HARMFUL_STATUSES) if (ally?.statuses?.[status]) out[i][status] += mass;
      if (!ally?.statuses?.paralysis) out[i].paralysis += mass * Math.max(0, Math.min(1, Number(ally?.deferredParalysisChance ?? 0) || 0));
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
  if (effect.type === 'poison' || effect.type === 'deadlyPoison' || effect.type === 'poisonToDeadly') {
    if (effect.type === 'poisonToDeadly') {
      if (boss) {
        if (bossPoisonState(runtime, slot) === 'poison') setBossPoisonState(runtime, slot, 'deadlyPoison');
      } else {
        const ci = companionIndexForHpSlot(runtime, slot);
        if (ci >= 0 && runtime.companions?.[ci]?.poison === 'poison') runtime.companions[ci].poison = 'deadlyPoison';
      }
      return;
    }
    const value = effect.type === 'deadlyPoison' ? 'deadlyPoison' : 'poison';
    if (boss) {
      const current = bossPoisonState(runtime, slot);
      if (value === 'deadlyPoison' || current === 'none') setBossPoisonState(runtime, slot, value);
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

function enemyUnitStatusEffectWouldChange(runtime, slot, effect) {
  const boss = slot < bossHpSlotCount(runtime);
  if (effect.type === 'enemyParalysis') {
    if (boss) return !runtime.enemy?.paralysis;
    const ci = companionIndexForHpSlot(runtime, slot);
    return ci >= 0 && !runtime.companions?.[ci]?.statuses?.paralysis;
  }
  if (effect.type === 'poison' || effect.type === 'deadlyPoison' || effect.type === 'poisonToDeadly') {
    const current = boss
      ? bossPoisonState(runtime, slot)
      : String(runtime.companions?.[companionIndexForHpSlot(runtime, slot)]?.poison ?? 'none');
    if (effect.type === 'poisonToDeadly') return current === 'poison';
    if (effect.type === 'deadlyPoison') return current !== 'deadlyPoison';
    return current === 'none';
  }
  return true;
}

function deferKujeskaEnemyParalysis(runtime, slot, chance) {
  if (!(chance > 0)) return;
  const boss = slot < bossHpSlotCount(runtime);
  if (boss) {
    const old = Math.max(0, Math.min(1, Number(runtime.enemy?.deferredParalysisChance ?? 0) || 0));
    runtime.enemy.deferredParalysisChance = 1 - (1 - old) * (1 - chance);
    return;
  }
  const ci = companionIndexForHpSlot(runtime, slot);
  if (ci < 0 || !runtime.companions?.[ci]) return;
  const c = runtime.companions[ci];
  const old = Math.max(0, Math.min(1, Number(c.deferredParalysisChance ?? 0) || 0));
  c.deferredParalysisChance = 1 - (1 - old) * (1 - chance);
}

function resolveDeferredKujeskaEnemyParalysisScenarios(scenarios, actor) {
  if (!Array.isArray(scenarios) || !scenarios.length) return scenarios ?? [];
  const out = [];
  for (const sc of scenarios) {
    const runtime = sc.runtime;
    let chance = 0;
    if (actor.side === 'enemy') chance = Math.max(0, Math.min(1, Number(runtime?.enemy?.deferredParalysisChance ?? 0) || 0));
    else if (actor.side === 'companion') chance = Math.max(0, Math.min(1, Number(runtime?.companions?.[actor.index]?.deferredParalysisChance ?? 0) || 0));
    if (!(chance > 0)) { out.push(sc); continue; }

    if (chance < 1) {
      const missRt = cloneRuntimeState(runtime);
      if (actor.side === 'enemy') delete missRt.enemy.deferredParalysisChance;
      else if (missRt.companions?.[actor.index]) delete missRt.companions[actor.index].deferredParalysisChance;
      out.push({ ...sc, runtime:missRt, hpDist:scaleDistribution(sc.hpDist, 1 - chance) });
    }
    const hitRt = cloneRuntimeState(runtime);
    if (actor.side === 'enemy') {
      delete hitRt.enemy.deferredParalysisChance;
      hitRt.enemy.paralysis = true;
      clearEnemyEffectsBrokenByActionDisable(hitRt);
    } else if (hitRt.companions?.[actor.index]) {
      delete hitRt.companions[actor.index].deferredParalysisChance;
      hitRt.companions[actor.index].statuses ??= {};
      hitRt.companions[actor.index].statuses.paralysis = { remaining:1 };
    }
    out.push({ ...sc, runtime:hitRt, hpDist:scaleDistribution(sc.hpDist, chance) });
  }
  return mergeScenarios(out);
}

function branchEnemyUnitStatusEffect(branches, effect, sourceAction) {
  const out = [];
  const baseChance = Math.max(0, Math.min(1, Number(effect.chance ?? 100) / 100));
  for (const branch of branches) {
    // 単体BOSS・お供なしでは対象slot集合はHP値に依存しない。
    // HPごとのgroup Map構築を省き、生存/撃破の2分割だけで同値に処理する。
    if (bossHpSlotCount(branch.runtime) === 1 && (branch.runtime?.companions?.length ?? 0) === 0) {
      const fixedRawSlots = Array.isArray(branch.runtime.lastAllyAttackHitSlots)
        ? branch.runtime.lastAllyAttackHitSlots
        : null;
      const rawSlots = fixedRawSlots ?? allyTargetedEnemySlots(branch.runtime, 1, sourceAction ?? {});
      if (!rawSlots.includes(0)) { out.push(branch); continue; }
      const { dead, live } = splitEnemyAliveDistribution(branch.hpDist);
      if (dead.size) out.push({ runtime:branch.runtime, hpDist:dead });
      if (!live.size) continue;
      if (!enemyUnitStatusEffectWouldChange(branch.runtime, 0, effect)) { out.push({ runtime:branch.runtime, hpDist:live }); continue; }
      const chance = effect.type === 'poisonToDeadly' ? 1 : Math.max(0, Math.min(1, baseChance - enemyUnitStatusAvoid(branch.runtime, 0, sourceAction)));
      if (chance <= 0) { out.push({ runtime:branch.runtime, hpDist:live }); continue; }
      if (chance >= 1) {
        const hitRt = cloneRuntimeState(branch.runtime);
        applyEnemyUnitStatus(hitRt, 0, effect);
        out.push({ runtime:hitRt, hpDist:live });
        continue;
      }
      const hitRt = cloneRuntimeState(branch.runtime);
      applyEnemyUnitStatus(hitRt, 0, effect);
      out.push({ runtime:branch.runtime, hpDist:scaleDistribution(live, 1 - chance) });
      out.push({ runtime:hitRt, hpDist:scaleDistribution(live, chance) });
      continue;
    }

    // v0.5.76: HP乱数値ごとに同じ状態異常枝を作るのではなく、
    // 「この効果の対象として生存しているslot集合」が同じHPを先にまとめる。
    // 状態異常確率・耐性はHP値に依存しないため、各集合につきruntime分岐は1回で完全に同値。
    const grouped = new Map();
    const fixedRawSlots = Array.isArray(branch.runtime.lastAllyAttackHitSlots)
      ? branch.runtime.lastAllyAttackHitSlots
      : null;
    for (const [hp, probability] of branch.hpDist) {
      if (!(probability > 0)) continue;
      const parts = enemyHpPartArray(hp);
      const rawSlots = fixedRawSlots ?? allyTargetedEnemySlots(branch.runtime, hp, sourceAction ?? {});
      const slots = rawSlots.filter(slot => Number(parts[slot] ?? 0) > 0);
      const key = slots.join(',');
      let group = grouped.get(key);
      if (!group) {
        group = { slots, hpDist:new Map() };
        grouped.set(key, group);
      }
      group.hpDist.set(hp, (group.hpDist.get(hp) ?? 0) + probability);
    }

    for (const group of grouped.values()) {
      // 攻撃を伴わないランダム単体効果（例: 悪疫グラス）は、生存候補から1体だけを等確率で選ぶ。
      // 攻撃由来のランダム技は lastAllyAttackHitSlots が既に実際の命中slotを保持しているため、ここには入らない。
      if (!fixedRawSlots && (sourceAction?.enemyTarget ?? 'single') === 'random' && group.slots.length > 1) {
        const targetWeight = 1 / group.slots.length;
        for (const slot of group.slots) {
          const chance = effect.type === 'poisonToDeadly'
            ? 1
            : Math.max(0, Math.min(1, baseChance - enemyUnitStatusAvoid(branch.runtime, slot, sourceAction)));
          if (chance <= 0 || !enemyUnitStatusEffectWouldChange(branch.runtime, slot, effect)) {
            out.push({ runtime:branch.runtime, hpDist:scaleDistribution(group.hpDist, targetWeight) });
            continue;
          }
          if (chance < 1) {
            out.push({ runtime:branch.runtime, hpDist:scaleDistribution(group.hpDist, targetWeight * (1 - chance)) });
          }
          const hitRt = cloneRuntimeState(branch.runtime);
          applyEnemyUnitStatus(hitRt, slot, effect);
          out.push({ runtime:hitRt, hpDist:scaleDistribution(group.hpDist, targetWeight * chance) });
        }
        continue;
      }

      // v0.5.85: クジェスカ標準チャートのシビレ斬りはキャプテン・アズールが
      // BOSS/お供より後に行動するため、麻痺判定は必ず次回の対象行動時まで未使用。
      // 成否を今ここで枝分岐せず、確率だけ対象ユニットへ保持して次回行動直前に解決する。
      if (branch.runtime?.enemy?.presetId === 'old5_kujeska'
          && String(sourceAction?.skillPresetId ?? '') === 'shibire_giri'
          && effect.type === 'enemyParalysis'
          && group.slots.length === 1) {
        const slot = group.slots[0];
        if (!enemyUnitStatusEffectWouldChange(branch.runtime, slot, effect)) {
          out.push({ runtime:branch.runtime, hpDist:group.hpDist });
          continue;
        }
        const chance = Math.max(0, Math.min(1, baseChance - enemyUnitStatusAvoid(branch.runtime, slot, sourceAction)));
        if (!(chance > 0)) { out.push({ runtime:branch.runtime, hpDist:group.hpDist }); continue; }
        const rt = cloneRuntimeState(branch.runtime);
        deferKujeskaEnemyParalysis(rt, slot, chance);
        out.push({ runtime:rt, hpDist:group.hpDist });
        continue;
      }
      let local = [{ runtime:branch.runtime, hpDist:group.hpDist }];
      for (const slot of group.slots) {
        const next = [];
        for (const item of local) {
          // 既に同等以上の状態なら、成功しても失敗してもruntimeが変わらないため枝分岐しない。
          if (!enemyUnitStatusEffectWouldChange(item.runtime, slot, effect)) { next.push(item); continue; }
          const chance = effect.type === 'poisonToDeadly' ? 1 : Math.max(0, Math.min(1, baseChance - enemyUnitStatusAvoid(item.runtime, slot, sourceAction)));
          if (chance <= 0) { next.push(item); continue; }
          if (chance >= 1) {
            const hitRt = cloneRuntimeState(item.runtime);
            applyEnemyUnitStatus(hitRt, slot, effect);
            next.push({ runtime:hitRt, hpDist:item.hpDist });
            continue;
          }
          // miss側はruntime不変、hit側だけコピーする。両枝のHP分布は確率係数だけ異なる。
          const hitRt = cloneRuntimeState(item.runtime);
          applyEnemyUnitStatus(hitRt, slot, effect);
          next.push({ runtime:item.runtime, hpDist:scaleDistribution(item.hpDist, 1 - chance) });
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
    if (sourceAction && ['poison','deadlyPoison','poisonToDeadly','enemyParalysis'].includes(effect.type)) {
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

function allyBuffForAction(runtime, actorIndex, action, characterId = '') {
  let buff = swordDanceBuffFor(runtime, actorIndex, action);
  // 太陽讃歌を七十二変化で使用した場合、使用者はラー(火属性)へ変化しているため
  // 元の属性が風のソンゴクウでも自身が火属性対象に含まれる。
  if (action?.skillPresetId === 'sun_hymn' && buff?.target === 'fireAllies'
      && characterId === 'son_goku') {
    return { ...buff, target:['fireAllies', `ally${actorIndex + 1}`] };
  }
  return buff;
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

function trialGunTargetMaxHp(runtime, slot) {
  if (slot < bossHpSlotCount(runtime)) return Math.max(1, Number(runtime?.maxHp ?? 1) || 1);
  const companion = runtime?.companions?.[companionIndexForHpSlot(runtime, slot)];
  return Math.max(1, Number(companion?.maxHp ?? 1) || 1);
}

function trialGunTargetDefense(runtime, state, slot, action) {
  if (slot < bossHpSlotCount(runtime)) {
    return {
      attribute:state.enemy?.attribute ?? 'none',
      race:runtime.enemy?.race ?? 'normal',
      defenseMods:applicableDefenseMods(runtime.enemy?.defenseMods ?? [], action.attackType, attackAttributesFromConfig(action))
    };
  }
  const companion = runtime?.companions?.[companionIndexForHpSlot(runtime, slot)] ?? {};
  return {
    attribute:companion.attribute ?? 'none',
    race:normalizeEnemyRace(companion.race ?? 'normal'),
    defenseMods:applicableDefenseMods(companion.defenseMods ?? [], action.attackType, attackAttributesFromConfig(action))
  };
}

// 試作魔銃: 基礎威力=攻撃×3×対象残HP/対象最大HP。HP1を残して撃破不可。
// HP依存なので通常の「先にdamageDistを作る」経路ではなく、HP値ごとに厳密計算する。
function applyTrialGunAttack(runtime, hpDist, action, actorIndex, state) {
  const attack = effectiveAllyAttack(runtime.allies[actorIndex]);
  const outByRuntime = new Map();
  for (const [hp, hpProbability] of hpDist) {
    if (!(hpProbability > 0) || enemyHpDefeated(hp)) {
      const key = stringifyRuntimeForMerge(runtime);
      const bucket = outByRuntime.get(key) ?? { runtime, dist:new Map() };
      bucket.dist.set(hp, (bucket.dist.get(hp) ?? 0) + hpProbability);
      outByRuntime.set(key, bucket);
      continue;
    }
    const slots = allyTargetedEnemySlots(runtime, hp, action);
    const slot = slots[0] ?? -1;
    if (slot < 0) {
      const key = stringifyRuntimeForMerge(runtime);
      const bucket = outByRuntime.get(key) ?? { runtime, dist:new Map() };
      bucket.dist.set(hp, (bucket.dist.get(hp) ?? 0) + hpProbability);
      outByRuntime.set(key, bucket);
      continue;
    }
    const parts = enemyHpPartArray(hp);
    const currentHp = Math.max(0, Math.trunc(Number(parts[slot] ?? 0) || 0));
    // HP1なら「スカ」。命中扱いにもせずEXを増やさない。
    if (currentHp <= 1) {
      const key = stringifyRuntimeForMerge(runtime);
      const bucket = outByRuntime.get(key) ?? { runtime, dist:new Map() };
      bucket.dist.set(hp, (bucket.dist.get(hp) ?? 0) + hpProbability);
      outByRuntime.set(key, bucket);
      continue;
    }
    const maxTargetHp = trialGunTargetMaxHp(runtime, slot);
    const hpScaledBase = Math.trunc(attack * 3 * currentHp / maxTargetHp);
    const target = trialGunTargetDefense(runtime, state, slot, action);
    const damageDist = oneHitDistribution({
      attack:hpScaledBase, speed:0, skillMultiplier:'100',
      attackAttribute:action.attackAttribute, attackAttribute2:action.attackAttribute2,
      defenderAttribute:target.attribute, defenderRace:target.race,
      attackType:action.attackType, defenseMods:target.defenseMods,
      weaknessBoost:runtime.allies[actorIndex].weaknessMods.length > 0
    });
    for (const [damage, damageProbability] of damageDist) {
      const nextParts = parts.slice();
      nextParts[slot] = Math.max(1, currentHp - Math.max(0, Math.trunc(Number(damage) || 0)));
      const nextHp = multiHpParts(hp) ? multiHpKey(nextParts) : nextParts[0];
      const rt = cloneRuntimeState(runtime);
      rt.lastAllyAttackHitSlots = [slot];
      addEnemyEx(rt, 1);
      applyEnemyDefenseOnHitEx(rt, action, [slot], 1);
      consumeCompanionOneHitGuards(rt, hp, action);
      syncCompanionActivityFromHp(rt, nextHp);
      wakeCompanionsHitByPhysicalAllyAttack(rt, nextHp, action);
      const key = stringifyRuntimeForMerge(rt);
      const bucket = outByRuntime.get(key) ?? { runtime:rt, dist:new Map() };
      const probability = hpProbability * damageProbability;
      bucket.dist.set(nextHp, (bucket.dist.get(nextHp) ?? 0) + probability);
      outByRuntime.set(key, bucket);
    }
  }
  return [...outByRuntime.values()].map(({runtime,dist}) => ({runtime,hpDist:dist}));
}

function baseAllySkillMultiplier(runtime, action, state) {
  let skillMultiplier = action.skillMultiplier;
  if (action.weakDefenderAttribute && action.weakSkillMultiplier !== ''
      && state.enemy?.attribute === action.weakDefenderAttribute) {
    skillMultiplier = action.weakSkillMultiplier;
  }
  return raceSkillMultiplier(action, runtime.enemy.race, skillMultiplier);
}

function allyAttackDamageConfig(runtime, action, actorIndex, state, skillMultiplier, hits = '1') {
  const attack = effectiveAllyAttack(runtime.allies[actorIndex]);
  const speed = effectiveAllySpeed(runtime.allies[actorIndex]);
  return {
    attack, speed, skillMultiplier, damageFormula: action.damageFormula,
    skillMultiplierMin: action.skillMultiplierMin, skillMultiplierMax: action.skillMultiplierMax, skillMultiplierStep: action.skillMultiplierStep,
    attackAttribute: action.attackAttribute, attackAttribute2: action.attackAttribute2, attackType: action.attackType,
    defenderAttribute: state.enemy?.attribute ?? 'none', defenderRace: runtime.enemy.race,
    defenseMods: applicableDefenseMods(runtime.enemy.defenseMods, action.attackType, attackAttributesFromConfig(action)),
    weaknessBoost: runtime.allies[actorIndex].weaknessMods.length > 0,
    hits:String(hits), hitsMin:'', hitsMax:''
  };
}

function poisonConditionalDamageDistForSlot(runtime, action, actorIndex, state, slot, hits = 1) {
  const baseMultiplier = baseAllySkillMultiplier(runtime, action, state);
  const skillMultiplier = poisonConditionalSkillMultiplier(runtime, action, slot, baseMultiplier);
  return attackDamageDistribution(allyAttackDamageConfig(runtime, action, actorIndex, state, skillMultiplier, hits));
}

function poisonConditionalOneHitVectorDistribution(runtime, action, actorIndex, state) {
  const slotCount = bossHpSlotCount(runtime);
  const baseMultiplier = baseAllySkillMultiplier(runtime, action, state);
  const configs = Array.from({ length:slotCount }, (_, slot) => {
    const skillMultiplier = poisonConditionalSkillMultiplier(runtime, action, slot, baseMultiplier);
    return allyAttackDamageConfig(runtime, action, actorIndex, state, skillMultiplier, 1);
  });
  const out = new Map();
  for (let r = -50; r <= 50; r++) {
    const vector = configs.map(config => oneHitDamageForRoll(config, r));
    const key = vector.join(',');
    out.set(key, (out.get(key) ?? 0) + 1 / 101);
  }
  return out;
}

function convolveDamageVectors(a, b, slotCount) {
  const out = new Map();
  for (const [ka, pa] of a) {
    const va = String(ka).split(',').map(Number);
    for (const [kb, pb] of b) {
      const vb = String(kb).split(',').map(Number);
      const vector = Array.from({ length:slotCount }, (_, i) => (va[i] ?? 0) + (vb[i] ?? 0));
      const key = vector.join(',');
      out.set(key, (out.get(key) ?? 0) + pa * pb);
    }
  }
  return out;
}

function poisonConditionalAllTargetDamageVectors(runtime, action, actorIndex, state, hits) {
  const slotCount = bossHpSlotCount(runtime);
  const one = poisonConditionalOneHitVectorDistribution(runtime, action, actorIndex, state);
  let total = new Map([[Array(slotCount).fill(0).join(','), 1]]);
  for (let i = 0; i < Math.max(1, Math.trunc(Number(hits) || 1)); i++) {
    total = convolveDamageVectors(total, one, slotCount);
  }
  return total;
}

function applyPoisonConditionalAllTargetAttack(runtime, hpDist, action, actorIndex, state, hits) {
  const damageVectors = poisonConditionalAllTargetDamageVectors(runtime, action, actorIndex, state, hits);
  const grouped = new Map();
  for (const [hp, hpProb] of hpDist) {
    if (!(hpProb > 0)) continue;
    if (enemyHpDefeated(hp)) {
      const key = multiHpParts(hp) ? multiHpKey(multiHpParts(hp).map(() => 0)) : 0;
      const groupKey = '0|';
      const bucket = grouped.get(groupKey) ?? { gain:0, sampleHp:key, hitSlots:[], dist:new Map() };
      bucket.dist.set(key, (bucket.dist.get(key) ?? 0) + hpProb);
      grouped.set(groupKey, bucket);
      continue;
    }
    const parts = enemyHpPartArray(hp);
    const hitSlots = enemyHitSlotsByAllyAttack(runtime, hp, action);
    for (const [vectorKey, vectorProb] of damageVectors) {
      if (!(vectorProb > 0)) continue;
      const vector = String(vectorKey).split(',').map(Number);
      const nextParts = parts.slice();
      for (const slot of hitSlots) {
        const damage = Math.max(0, Math.trunc(Number(vector[slot] ?? 0) || 0));
        nextParts[slot] = Math.max(0, Number(nextParts[slot] ?? 0) - damage);
      }
      const nextHp = multiHpKey(nextParts);
      const exGain = Math.max(0, Math.max(1, Math.trunc(Number(hits) || 1)) * hitSlots.length + enemyDeathsBetweenHp(hp, nextHp));
      const groupKey = `${exGain}|${hitSlots.join(',')}`;
      const bucket = grouped.get(groupKey) ?? { gain:exGain, sampleHp:nextHp, hitSlots:hitSlots.slice(), dist:new Map() };
      bucket.dist.set(nextHp, (bucket.dist.get(nextHp) ?? 0) + hpProb * vectorProb);
      grouped.set(groupKey, bucket);
    }
  }
  return [...grouped.values()].map(({ gain, sampleHp, hitSlots, dist }) => {
    const rt = cloneRuntimeState(runtime);
    rt.lastAllyAttackHitSlots = hitSlots.slice();
    addEnemyEx(rt, gain);
    applyEnemyDefenseOnHitEx(rt, action, hitSlots, hits);
    syncCompanionActivityFromHp(rt, sampleHp);
    return { runtime:rt, hpDist:dist };
  });
}

function applyPoisonConditionalSingleTargetAttack(runtime, hpDist, action, actorIndex, state, hits) {
  const bySlot = new Map();
  const untargeted = new Map();
  for (const [hp, probability] of hpDist) {
    if (!(probability > 0)) continue;
    if (enemyHpDefeated(hp)) {
      untargeted.set(hp, (untargeted.get(hp) ?? 0) + probability);
      continue;
    }
    const slot = allyTargetedEnemySlots(runtime, hp, action)[0] ?? -1;
    if (slot < 0) {
      untargeted.set(hp, (untargeted.get(hp) ?? 0) + probability);
      continue;
    }
    const dist = bySlot.get(slot) ?? new Map();
    dist.set(hp, (dist.get(hp) ?? 0) + probability);
    bySlot.set(slot, dist);
  }
  const out = untargeted.size ? [{ runtime, hpDist:untargeted }] : [];
  for (const [slot, dist] of bySlot) {
    const damageDist = poisonConditionalDamageDistForSlot(runtime, action, actorIndex, state, slot, hits);
    out.push(...applyAllyAttackWithEnemyEx(runtime, dist, damageDist, { ...action, enemyTargetSlot:String(slot) }, hits));
  }
  return mergeRuntimeBranches(out);
}

function applyActivatedAllyActionResolved(runtime, hpDist, action, actorIndex, state) {
  let nextHp = hpDist;
  const exRequired = Math.max(0, Number(action?.playerExRequired ?? 0) || 0);
  if (exRequired > 0) {
    if (playerExGauge(runtime) < exRequired) return [{ runtime, hpDist:nextHp }];
    const spend = Math.max(0, Number(action?.playerExSpend ?? exRequired) || 0);
    runtime.playerExGauge = Math.max(0, playerExGauge(runtime) - spend);
  }
  if (action.chargeSkillPresetId) {
    const releasePreset = SKILL_PRESET_BY_ID.get(action.chargeSkillPresetId);
    if (releasePreset) {
      runtime.allies[actorIndex].chargedAction = ensureAction({
        ...releasePreset,
        skillPresetId: releasePreset.id,
        enemyTargetSlot: action.enemyTargetSlot ?? 'auto',
        presetTarget: action.presetTarget ?? ''
      }, 'ally');
    }
  }
  if (action.kind === 'attack') {
    if (action.damageFormula === 'trial_gun') {
      const branches = applyTrialGunAttack(runtime, nextHp, action, actorIndex, state);
      for (const branch of branches) {
        if (branch.runtime) delete branch.runtime.lastAllyAttackHitSlots;
      }
      return mergeRuntimeBranches(branches);
    }
    const attack = effectiveAllyAttack(runtime.allies[actorIndex]);
    let skillMultiplier = baseAllySkillMultiplier(runtime, action, state);
    if (runtime.enemy.poison !== 'none' && action.poisonedSkillMultiplier !== '') skillMultiplier = action.poisonedSkillMultiplier;
    if (runtime.enemy.poison === 'deadlyPoison' && action.deadlyPoisonSkillMultiplier !== '') skillMultiplier = action.deadlyPoisonSkillMultiplier;
    const speed = effectiveAllySpeed(runtime.allies[actorIndex]);
    // EXゲージは被弾1ヒットごとに増えるため、ヒット数可変技はヒット数枝を分けて保持する。
    const hitChoices = allyAttackHitCountChoices(action, speed);
    let attackBranches = [];
    for (const choice of hitChoices) {
      const randomEachHit = (action.enemyTarget ?? 'single') === 'random';
      const collapseRandomHits = randomEachHit && canCollapseRandomHitsToSingleBoss(runtime, nextHp, action);
      const targetSpecificPoisonPower = bossHpSlotCount(runtime) > 1 && hasPoisonConditionalSkillMultiplier(action);
      if (targetSpecificPoisonPower) {
        const weightedHp = scaleDistribution(nextHp, choice.probability);
        if ((action.enemyTarget ?? 'single') === 'all') {
          attackBranches.push(...applyPoisonConditionalAllTargetAttack(runtime, weightedHp, action, actorIndex, state, choice.hits));
          continue;
        }
        if (randomEachHit) {
          const baseMultiplier = baseAllySkillMultiplier(runtime, action, state);
          const cache = new Map();
          const damageDistForSlot = (rt, slot) => {
            const multiplier = poisonConditionalSkillMultiplier(rt, action, slot, baseMultiplier);
            const key = `${slot}|${multiplier}`;
            let dist = cache.get(key);
            if (!dist) {
              dist = attackDamageDistribution(allyAttackDamageConfig(rt, action, actorIndex, state, multiplier, 1));
              cache.set(key, dist);
            }
            return dist;
          };
          const fallback = damageDistForSlot(runtime, 0);
          attackBranches.push(...applyRandomAllyAttackWithEnemyEx(runtime, weightedHp, fallback, action, choice.hits, damageDistForSlot));
          continue;
        }
        attackBranches.push(...applyPoisonConditionalSingleTargetAttack(runtime, weightedHp, action, actorIndex, state, choice.hits));
        continue;
      }
      const damageDist = attackDamageDistribution({
        attack, speed, skillMultiplier, damageFormula: action.damageFormula,
        skillMultiplierMin: action.skillMultiplierMin, skillMultiplierMax: action.skillMultiplierMax, skillMultiplierStep: action.skillMultiplierStep,
        attackAttribute: action.attackAttribute, attackAttribute2: action.attackAttribute2, attackType: action.attackType,
        defenderAttribute: state.enemy?.attribute ?? 'none', defenderRace: runtime.enemy.race,
        defenseMods: applicableDefenseMods(runtime.enemy.defenseMods, action.attackType, attackAttributesFromConfig(action)), weaknessBoost: runtime.allies[actorIndex].weaknessMods.length > 0,
        // 対象が複数なら1ヒットずつ厳密分岐。BOSS1体だけなら同値な多段畳み込みへ短絡する。
        hits: randomEachHit && !collapseRandomHits ? '1' : String(choice.hits), hitsMin: '', hitsMax: ''
      });
      const weightedHp = scaleDistribution(nextHp, choice.probability);
      attackBranches.push(...(randomEachHit && !collapseRandomHits
        ? applyRandomAllyAttackWithEnemyEx(runtime, weightedHp, damageDist, action, choice.hits)
        : applyAllyAttackWithEnemyEx(runtime, weightedHp, damageDist, action, choice.hits)));
    }
    // 攻撃で全敵撃破した質量には、その後の追加効果・自己変化を適用しない。
    // 戦闘は撃破した瞬間に終了するため、ここを枝展開すると結果を変えずに計算量だけ増える。
    const terminalBranches = [];
    let branches = [];
    for (const attackBranch of attackBranches) {
      const { dead, live } = splitEnemyAliveDistribution(attackBranch.hpDist);
      const deadMass = distributionMass(dead);
      const liveMass = distributionMass(live);
      if (deadMass > 0) terminalBranches.push({ runtime:attackBranch.runtime, hpDist:dead });
      if (liveMass <= 0) continue;
      const liveRuntime = deadMass > 0 ? cloneRuntimeState(attackBranch.runtime) : attackBranch.runtime;
      const local = branchAllyEffects(liveRuntime, live, action.effects ?? [], actorIndex, action);
      branches.push(...local);
    }
    for (const branch of branches) {
      advanceSwordDanceState(branch.runtime, actorIndex, action);
      if (action.selfDestruct === true) branch.runtime.allies[actorIndex].active = false;
    }
    return mergeRuntimeBranches([...terminalBranches, ...branches]);
  } else if (action.kind === 'buff') {
    allyEffect(runtime, allyBuffForAction(runtime, actorIndex, action, state.allies?.[actorIndex]?.characterId ?? ''), actorIndex);
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
  const evasion = action?.kind === 'attack' && action?.attackType === 'physical' && (action?.enemyTarget ?? 'single') !== 'random'
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
  '燃えている', '笑っている', 'みくだしている', 'ときをまつ', 'さむさにたえている', 'うつむいている', '様子を見ている'
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
    presetTarget: configuredAction?.presetTarget ?? '',
    enemyTargetSlot: configuredAction?.enemyTargetSlot ?? 'auto'
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


const PLAYER_EX_IRRELEVANT_PRESETS = new Set([
  'old0_red_princess','old0_quicksilver','old0_red_dragon','old0_muus','old0_heavy_behemoth',
  'old0_blue_dragon','old0_riviere','old0_mushufushu','old0_silver_dragon',
  'old1_fafnir','old1_grim','old5_frost_dragon','old5_kujeska'
]);

function isStandardOld5KujeskaChart(state) {
  if (String(state?.enemy?.presetId ?? '') !== 'old5_kujeska') return false;
  const allyIds = (state?.allies ?? []).slice(0,3).map(a => String(a?.characterId ?? ''));
  if (allyIds.join('|') !== 'son_goku|mermaid_mellow|captain_azul') return false;
  const variants = (state?.allies ?? []).slice(0,3).map(a => String(a?.commandVariant ?? ''));
  if (variants[0] !== 'forward4') return false;
  const expected = [
    ['growl','bubble_grand','shibire_giri'],
    ['loki_brand','bubble_grand','shibire_giri'],
    ['red_point_2','bubble_grand','shibire_giri'],
    ['venom_salamanda','bubble_grand','shibire_giri']
  ];
  const turnCount = Math.min(expected.length, state?.turns?.length ?? 0);
  if (turnCount < 1) return false;
  for (let t=0; t<turnCount; t++) {
    for (let i=0; i<3; i++) {
      if (String(state.turns?.[t]?.allyActions?.[i]?.skillPresetId ?? '') !== expected[t][i]) return false;
    }
  }
  return true;
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
    enemyActionsDisabled:(state.turns ?? []).every(turn => turn?.enemyAction?.enabled === false),
    ignorePlayerExTracking:PLAYER_EX_IRRELEVANT_PRESETS.has(presetId),
    kujeskaFenrirMarkov: isStandardOld5KujeskaChart(state),
    allies: Array.from({ length: allyCount }, (_, i) => {
      return {
        baseAttack: parseNumber(state.allies?.[i]?.attack, `キャラ${i + 1}の攻撃力`, { min: 0 }),
        baseSpeed: parseNumber(state.allies?.[i]?.speed, `キャラ${i + 1}の素早さ`, { min: 0 }),
        star: state.allies?.[i]?.star ?? '', attribute: state.allies?.[i]?.attribute ?? '', race: normalizeEnemyRace(state.allies?.[i]?.race ?? 'normal'),
        attackMods: [], speedMods: [], weaknessMods: [],
        statusAvoidMods: [], statusImmuneMods: [], damageTakenMods: [], statusVulnerabilityMods: [], statuses: {},
        rotAttackMultiplier: 1, rotSpeedMultiplier: 1, activeProgressiveDecay: null, actionLockRemaining:0,
        actionsTaken: 0, active: true, swordDanceAutoRemaining: 0, swordDanceStage: 0, chargedAction: null
      };
    }),
    enemy: {
      name: bossPreset?.name ?? 'BOSS', presetId,
      baseAttack: (configuredEnemyAttack != null && configuredEnemyAttack > 0) ? configuredEnemyAttack : (bossProfile?.attack ?? configuredEnemyAttack ?? 0),
      baseSpeed: enemyBaseSpeed, attribute:String(state.enemy?.attribute ?? ''), speedMods: [], attackMods: [], defenseMods: [], poison: 'none',
      poisonByBoss: bossCount > 1 ? Array(bossCount).fill('none') : undefined, race: normalizeEnemyRace(state.enemy?.race),
      postActionAttackGain: 0, flatAttackBonus: 0, postActionSpeedGain:0, flatSpeedBonus:0, blessingMods: [], reactiveEffects: [], statusAvoidMods: [], disabledCommands: [], transientDisabledCommands: [], commandOverrides: {}, charge:null, paralysis:false,
      actionSerial:0, physicalEvasion:null, singleTargetUntargetable:null, barbadosWaterStack:0, exGauge:0, exActivations:0, deathSerial:0,
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
    const weighted = scaleDistribution(enemyHpDist, activationChance);
    const statusEffect = skill.effects[0];
    // 手動入力では 1 / 2 / 3 / 1・2 / ... の対象指定を厳密に守る。
    // executeEnemySkill の汎用target文字列へ変換すると配列指定が全体化するため、
    // ここでは既存のnormalizeTarget + status分岐を直接使う。
    const indexes = normalizeTarget(effect, 0, hitRt);
    out.push(...branchStatusOnTargets([{ runtime: hitRt, hpDist: weighted }], indexes, statusEffect, skill));
  }
  return mergeRuntimeBranches(out);
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
  const known = HP_DEFEAT_STATE_CACHE.get(dist);
  if (known === 'live') return { dead:new Map(), live:dist };
  if (known === 'dead') return { dead:dist, live:new Map() };
  const dead = new Map();
  const live = new Map();
  for (const [hp, p] of dist) {
    const target = enemyHpDefeated(hp) ? dead : live;
    target.set(hp, (target.get(hp) ?? 0) + p);
  }
  if (dead.size) HP_DEFEAT_STATE_CACHE.set(dead, 'dead');
  if (live.size) HP_DEFEAT_STATE_CACHE.set(live, 'live');
  return { dead, live };
}

// v0.5.74: 全敵撃破が確定した確率質量は、その瞬間に戦闘終了。
// 以後の味方・BOSS・お供・ターン処理へ流さず、成功確率だけを回収する。
// runtime の差は勝敗確定後には意味を持たないため、成功枝そのものは保持しない。
function extractBattleDefeatedScenarios(scenarios) {
  const liveScenarios = [];
  const defeatedHpDist = new Map();
  let defeatedMass = 0;
  for (const sc of scenarios ?? []) {
    const known = HP_DEFEAT_STATE_CACHE.get(sc.hpDist);
    if (known === 'live') { liveScenarios.push(sc); continue; }
    if (known === 'dead') {
      defeatedMass += distributionMass(sc.hpDist);
      addDistribution(defeatedHpDist, sc.hpDist);
      continue;
    }
    let hadDead = false;
    const live = new Map();
    for (const [hp, probability] of sc.hpDist ?? []) {
      if (!(probability > 0)) continue;
      if (enemyHpDefeated(hp)) {
        defeatedMass += probability;
        defeatedHpDist.set(hp, (defeatedHpDist.get(hp) ?? 0) + probability);
        hadDead = true;
      } else {
        live.set(hp, (live.get(hp) ?? 0) + probability);
      }
    }
    if (!hadDead) { HP_DEFEAT_STATE_CACHE.set(sc.hpDist, 'live'); liveScenarios.push(sc); }
    else if (live.size) { HP_DEFEAT_STATE_CACHE.set(live, 'live'); liveScenarios.push({ ...sc, hpDist: live }); }
  }
  return { scenarios: liveScenarios, defeatedMass, defeatedHpDist };
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
  if (!branches?.length) return [];
  if (branches.length === 1) return branches;
  const byKey = new Map();
  for (const branch of branches) {
    const key = `${stringifyRuntimeForMerge(branch.runtime)}|${branch.nextReel ?? 0}`;
    const existing = byKey.get(key);
    if (existing) {
      if (!existing._hpOwned) { existing.hpDist = new Map(existing.hpDist); existing._hpOwned = true; }
      addDistribution(existing.hpDist, branch.hpDist);
    } else byKey.set(key, { runtime:branch.runtime, hpDist:branch.hpDist, nextReel:branch.nextReel ?? 0, _hpOwned:false });
  }
  const out = [...byKey.values()];
  for (const branch of out) delete branch._hpOwned;
  return out;
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

const DOCK_LOW_BASE_ROWS = Object.freeze([
  Object.freeze({ moon:2, shout:0, terminal:Object.freeze([['こうげき!',1],['ぬすむ',1]]), up:2, upTo:1, down:0, downTo:0 }),
  Object.freeze({ moon:0, shout:2, terminal:Object.freeze([['会心の一撃',1],['ぬすむ',1]]), up:2, upTo:2, down:0, downTo:0 }),
  Object.freeze({ moon:2, shout:0, terminal:Object.freeze([['会心の一撃',2]]), up:2, upTo:3, down:0, downTo:0 }),
  Object.freeze({ moon:1, shout:1, terminal:Object.freeze([['ぬすむ',1],['会心の一撃',2]]), up:1, upTo:4, down:0, downTo:0 }),
  Object.freeze({ moon:1, shout:1, terminal:Object.freeze([['ぬすむ',1],['大海流',2]]), up:1, upTo:5, down:0, downTo:0 }),
  Object.freeze({ moon:1, shout:1, terminal:Object.freeze([['必殺の一撃',2],['ミス',1]]), up:1, upTo:6, down:0, downTo:0 }),
  Object.freeze({ moon:0, shout:0, terminal:Object.freeze([['大海流',3],['必殺の一撃',1]]), up:0, upTo:6, down:2, downTo:0 })
]);
const DOCK_POW3 = Object.freeze([1,3,9,27,81,243,729]);

function dockDigit(sig, reel) {
  return Math.floor(sig / DOCK_POW3[reel]) % 3;
}

function dockIncDigit(sig, reel) {
  return sig + DOCK_POW3[reel];
}

// ドック・ロー専用。使用済みの同名マスは「どのマスか」ではなく、
// 各リールで何個使ったかだけで将来の抽選分布が決まる。
// オブジェクトのcommandOverridesを毎回再構築せず、2個のbase-3整数で表現する。
const DOCK_TRANSITION_CACHE = new Map();
function dockLowCommandTransitions(startReel, moonSig, shoutSig) {
  const cacheKey = `${startReel}|${moonSig}|${shoutSig}`;
  const cached = DOCK_TRANSITION_CACHE.get(cacheKey);
  if (cached) return cached;

  const memo = new Map();
  function solve(reel, downCount) {
    const mk = reel * 5 + downCount;
    const hit = memo.get(mk);
    if (hit) return hit;
    // cycle can only occur through reel6 -> reel0; downCount increments, so recursion is acyclic.
    const row = DOCK_LOW_BASE_ROWS[reel];
    const out = new Map();
    const add = (name, nextReel, stopReel, p) => {
      if (!(p > 0)) return;
      const k = `${name}|${nextReel}|${stopReel}`;
      out.set(k, (out.get(k) ?? 0) + p);
    };
    const mergeScaled = (sub, factor) => {
      for (const [k,p] of sub) out.set(k, (out.get(k) ?? 0) + p * factor);
    };
    const moonAvail = Math.max(0, row.moon - dockDigit(moonSig, reel));
    const shoutAvail = Math.max(0, row.shout - dockDigit(shoutSig, reel));
    const used = (row.moon - moonAvail) + (row.shout - shoutAvail);
    if (moonAvail) add('蒼染の月明', reel, reel, moonAvail / 6);
    if (shoutAvail) add('深海の叫び', reel, reel, shoutAvail / 6);
    // 使った再行動マスはミスへ置換される。
    if (used) add('ミス', reel, reel, used / 6);
    for (const [name,count] of row.terminal) add(name, reel, reel, count / 6);
    if (row.up) mergeScaled(solve(row.upTo, downCount), row.up / 6);
    if (row.down) {
      if (downCount >= 4) add('', reel, reel, row.down / 6);
      else mergeScaled(solve(row.downTo, downCount + 1), row.down / 6);
    }
    memo.set(mk, out);
    return out;
  }

  const raw = solve(Math.max(0, Math.min(6, Number(startReel) || 0)), 0);
  const result = [];
  for (const [k, probability] of raw) {
    const [commandName, nextText, stopText] = k.split('|');
    result.push({ commandName, nextReel:Number(nextText), stopReel:Number(stopText), probability });
  }
  DOCK_TRANSITION_CACHE.set(cacheKey, result);
  return result;
}

function dockOverridesToSigs(overrides) {
  let moonSig = 0, shoutSig = 0;
  const matrix = enemyBossProfile('q_dock_low')?.matrix ?? [];
  for (const [key,value] of Object.entries(overrides ?? {})) {
    if (String(value) !== 'ミス') continue;
    const [rText,sText] = key.split(':');
    const r = Number(rText), slot = Number(sText);
    if (!Number.isInteger(r) || !Number.isInteger(slot) || r < 0 || r >= matrix.length) continue;
    const original = String(matrix[r]?.[slot] ?? '').trim();
    if (original === '蒼染の月明') moonSig = dockIncDigit(moonSig, r);
    else if (original === '深海の叫び') shoutSig = dockIncDigit(shoutSig, r);
  }
  return { moonSig, shoutSig };
}

function dockSigsToOverrides(moonSig, shoutSig) {
  const matrix = enemyBossProfile('q_dock_low')?.matrix ?? [];
  const out = {};
  for (let r=0; r<matrix.length; r++) {
    let m = dockDigit(moonSig, r), sh = dockDigit(shoutSig, r);
    if (!m && !sh) continue;
    for (let slot=0; slot<(matrix[r]?.length ?? 0); slot++) {
      const original = String(matrix[r][slot] ?? '').trim();
      if (original === '蒼染の月明' && m > 0) { out[`${r}:${slot}`] = 'ミス'; m--; }
      else if (original === '深海の叫び' && sh > 0) { out[`${r}:${slot}`] = 'ミス'; sh--; }
    }
  }
  return out;
}

const DOCK_FINAL_OUTCOMES = Object.freeze(['', 'ミス', 'こうげき!', 'ぬすむ', '会心の一撃', '大海流', '必殺の一撃']);
const DOCK_FINAL_OUTCOME_INDEX = new Map(DOCK_FINAL_OUTCOMES.map((x,i)=>[x,i]));
const DOCK_FINAL_SKILLS = Object.freeze(['蒼染の月明','深海の叫び','こうげき!','ぬすむ','会心の一撃','大海流','必殺の一撃']);
const DOCK_FINAL_SKILL_INDEX = new Map(DOCK_FINAL_SKILLS.map((x,i)=>[x,i]));
const DOCK_SIG_SUM = new Uint8Array(2187);
for (let sig=0; sig<2187; sig++) {
  let x=sig, n=0;
  for (let r=0;r<7;r++) { n += x % 3; x = Math.floor(x / 3); }
  DOCK_SIG_SUM[sig]=n;
}

// 最終ターン専用：runtime/commandOverridesを一切作らず、固定長数値ベクトルだけで
// ドック・ローの再行動連鎖を厳密に吸収計算する。
function dockLowFinalChainOutcomes(runtime, startReel) {
  const { moonSig:initialMoonSig, shoutSig:initialShoutSig } = dockOverridesToSigs(runtime.enemy?.commandOverrides);
  const initialEx = enemyExGauge(runtime);
  const outcomeN = DOCK_FINAL_OUTCOMES.length;
  const skillN = DOCK_FINAL_SKILLS.length;
  const exIndex = outcomeN;
  const totalN = outcomeN + 1 + skillN;
  const memo = new Map();

  const solve = (reel, downCount, moonSig, shoutSig) => {
    const packed = ((((moonSig * 2187) + shoutSig) * 7 + reel) * 5 + downCount);
    const cached = memo.get(packed);
    if (cached) return cached;
    const out = new Float64Array(totalN);
    const row = DOCK_LOW_BASE_ROWS[reel];
    const moonUsed = dockDigit(moonSig, reel);
    const shoutUsed = dockDigit(shoutSig, reel);
    const moonAvail = Math.max(0, row.moon - moonUsed);
    const shoutAvail = Math.max(0, row.shout - shoutUsed);
    const usedHere = moonUsed + shoutUsed;
    const usedTotal = DOCK_SIG_SUM[moonSig] + DOCK_SIG_SUM[shoutSig];

    const addChild = (child, w) => {
      for (let i=0;i<totalN;i++) out[i] += child[i] * w;
    };
    const addTerminal = (name, count) => {
      if (!count) return;
      const w = count / 6;
      out[DOCK_FINAL_OUTCOME_INDEX.get(name) ?? 0] += w;
      const si = DOCK_FINAL_SKILL_INDEX.get(name);
      if (si != null) out[outcomeN + 1 + si] += w;
    };
    const addContinue = (name, count, nextMoonSig, nextShoutSig) => {
      if (!count) return;
      const w = count / 6;
      const si = DOCK_FINAL_SKILL_INDEX.get(name);
      if (si != null) out[outcomeN + 1 + si] += w;
      if (initialEx + usedTotal + 1 >= 10) out[exIndex] += w;
      else addChild(solve(reel, 0, nextMoonSig, nextShoutSig), w);
    };

    addContinue('蒼染の月明', moonAvail, dockIncDigit(moonSig, reel), shoutSig);
    addContinue('深海の叫び', shoutAvail, moonSig, dockIncDigit(shoutSig, reel));
    // 使用済み再行動マスはミスへ置換され、その時点で行動終了。
    if (usedHere) out[DOCK_FINAL_OUTCOME_INDEX.get('ミス')] += usedHere / 6;
    for (const [name,count] of row.terminal) addTerminal(name, count);
    if (row.up) addChild(solve(row.upTo, downCount, moonSig, shoutSig), row.up / 6);
    if (row.down) {
      if (downCount >= 4) out[DOCK_FINAL_OUTCOME_INDEX.get('')] += row.down / 6;
      else addChild(solve(row.downTo, downCount + 1, moonSig, shoutSig), row.down / 6);
    }
    memo.set(packed, out);
    return out;
  };

  const vec = solve(Math.max(0, Math.min(6, Number(startReel) || 0)), 0, initialMoonSig, initialShoutSig);
  const outcomes = [];
  for (let i=0;i<outcomeN;i++) {
    const probability=vec[i];
    if (probability > 0) outcomes.push({ probability, exTriggered:false, commandName:DOCK_FINAL_OUTCOMES[i], nextReel:0, terminalSkill:null, ex:0, moon:0, shout:0, moonSig:0, shoutSig:0 });
  }
  if (vec[exIndex] > 0) outcomes.push({ probability:vec[exIndex], exTriggered:true, commandName:'', nextReel:0, terminalSkill:null, ex:10, moon:0, shout:0, moonSig:0, shoutSig:0 });
  const expected={};
  for (let i=0;i<skillN;i++) {
    const v=vec[outcomeN+1+i];
    if (v > 0) expected[DOCK_FINAL_SKILLS[i]]=v;
  }
  return { outcomes, expected };
}

function dockLowChainOutcomes(runtime, startReel) {
  if (ACTIVE_FINAL_BOSS_CHAIN) return dockLowFinalChainOutcomes(runtime, startReel);
  const { moonSig:initialMoonSig, shoutSig:initialShoutSig } = dockOverridesToSigs(runtime.enemy?.commandOverrides);
  let active = [{ reel:startReel, moonSig:initialMoonSig, shoutSig:initialShoutSig, ex:enemyExGauge(runtime), moon:0, shout:0, probability:1 }];
  const finished = [];
  const finalStream = ACTIVE_FINAL_BOSS_CHAIN ? new Map() : null;
  const expected = {};
  const emitFinished = st => {
    if (!finalStream) { finished.push(st); return; }
    const key = `${st.exTriggered ? 1 : 0}|${st.commandName ?? ''}`;
    const prev = finalStream.get(key);
    if (prev) prev.probability += st.probability;
    else finalStream.set(key, {
      probability:st.probability, exTriggered:Boolean(st.exTriggered), commandName:st.commandName ?? '',
      nextReel:0, terminalSkill:st.terminalSkill ?? null, ex:st.ex ?? 0, moon:0, shout:0, moonSig:0, shoutSig:0
    });
  };
  for (let step=0; step<24 && active.length; step++) {
    const nextMap = new Map();
    for (const st of active) {
      if (step > 0 && st.ex >= 10) { emitFinished({ ...st, exTriggered:true, commandName:'', nextReel:st.reel }); continue; }
      const transitions = dockLowCommandTransitions(st.reel, st.moonSig, st.shoutSig);
      for (const tr of transitions) {
        if (!(tr.probability > 0)) continue;
        const p = st.probability * tr.probability;
        const name = tr.commandName;
        const skill = enemySkillForCommand(name, 'q_dock_low');
        if (skill) expected[name] = (expected[name] ?? 0) + p;
        const nextReel = tr.nextReel;
        if (skill?.turnContinue) {
          let moonSig = st.moonSig, shoutSig = st.shoutSig;
          if (name === '蒼染の月明') moonSig = dockIncDigit(moonSig, tr.stopReel);
          else if (name === '深海の叫び') shoutSig = dockIncDigit(shoutSig, tr.stopReel);
          const ns = {
            reel:nextReel, moonSig, shoutSig,
            ex:Math.min(10, st.ex + Math.max(0, Number(skill.enemyExGain ?? 0) || 0)),
            moon:st.moon + (name === '蒼染の月明' ? 1 : 0),
            shout:st.shout + (name === '深海の叫び' ? 1 : 0), probability:p
          };
          const key = `${ns.reel}|${ns.ex}|${ns.moonSig}|${ns.shoutSig}`;
          const prev = nextMap.get(key);
          if (prev) prev.probability += p; else nextMap.set(key, ns);
        } else {
          emitFinished({ ...st, probability:p, commandName:name, nextReel, terminalSkill:skill });
        }
      }
    }
    active = [...nextMap.values()];
  }
  for (const st of active) emitFinished({...st, commandName:'', nextReel:st.reel});
  if (finalStream) return { outcomes:[...finalStream.values()], expected };
  const mergedFinished = new Map();
  for (const st of finished) {
    const key = `${st.exTriggered ? 1 : 0}|${st.commandName ?? ''}|${st.nextReel ?? st.reel ?? 0}|${st.ex ?? 0}|${st.moon ?? 0}|${st.shout ?? 0}|${st.moonSig}|${st.shoutSig}`;
    const prev = mergedFinished.get(key);
    if (prev) prev.probability += st.probability; else mergedFinished.set(key, st);
  }
  return { outcomes:[...mergedFinished.values()], expected };
}

function executeDockLowCommandChain(runtime, hpDist, state, startReel, activationBucket, missingEffects) {
  const sourceMass = distributionMass(hpDist);
  const chain = dockLowChainOutcomes(runtime, startReel);
  for (const [name,count] of Object.entries(chain.expected)) activationBucket[name] = (activationBucket[name] ?? 0) + sourceMass * count;
  const out = [];
  for (const outcome of chain.outcomes) {
    if (!(outcome.probability > 0)) continue;
    const rt = cloneRuntimeState(runtime);
    if (!ACTIVE_FINAL_BOSS_CHAIN) {
      rt.enemy.commandOverrides = dockSigsToOverrides(outcome.moonSig ?? 0, outcome.shoutSig ?? 0);
      rt.enemy.exGauge = Math.max(0, Math.min(10, Number(outcome.ex ?? enemyExGauge(rt)) || 0));
      if (outcome.moon) rt.maxHp = Math.max(1, Number(rt.maxHp ?? 1) + 30 * outcome.moon);
      if (outcome.shout) rt.enemy.flatAttackBonus = Number(rt.enemy.flatAttackBonus ?? 0) + 5 * outcome.shout;
    }
    const weighted = scaleDistribution(hpDist, outcome.probability);
    if (outcome.exTriggered || (!ACTIVE_FINAL_BOSS_CHAIN && rt.enemy.exGauge >= 10 && !outcome.commandName)) {
      rt.enemy.exTriggered = true;
      out.push({ runtime:rt, hpDist:weighted, nextReel:outcome.nextReel });
      continue;
    }
    const name = String(outcome.commandName ?? '').trim();
    const skill = outcome.terminalSkill ?? enemySkillForCommand(name, 'q_dock_low');
    if (!skill && !isStructuralOrNoEffectCommand(name) && name) missingEffects.add(`敵:${name}`);
    addEnemyEx(rt, enemyExGainFromCommandName(name));
    const branches = skill ? executeEnemySkill(rt, weighted, state, skill) : [{runtime:rt,hpDist:weighted}];
    for (const branch of branches) out.push({ runtime:branch.runtime, hpDist:branch.hpDist, nextReel:outcome.nextReel });
  }
  return mergeBossCommandChainBranches(out);
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
      branch.hpDist = applyCompanionSelfBlessingAfterAction(branch.runtime, branch.hpDist, companionIndex);
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

// v0.5.73: 撃破率へ同じ影響しか与えない敵コマンドを、実行前に同一枝へまとめる。
// 発動率表示は元コマンド名ごとに先に集計するので、UI上の統計精度は落とさない。
// 純粋攻撃ではダメージ量を追跡しないため、対象方式・ヒット数・物理睡眠解除だけが状態差になる。
function bossCommandOperationalKey(presetId, runtime, tr, effectiveCommandName, skill) {
  // コマンド名そのものが後続処理の条件になる特殊BOSSは保守的に圧縮しない。
  if (presetId === 'q_zarigarion' || presetId === 'q_nataraja' || presetId === 'q_michael') return null;

  const nextReel = Number(tr?.nextReel ?? 0) || 0;
  const exGain = enemyExGainFromCommandName(effectiveCommandName);
  if (!skill) {
    return isStructuralOrNoEffectCommand(effectiveCommandName)
      ? JSON.stringify({ kind:'noop', nextReel, exGain })
      : null;
  }

  // 再行動・リール操作・使用枠変化などはコマンド固有性があるため通常処理へ残す。
  if (skill.turnContinue || skill.turnContinueIfActiveCompanion || skill.turnContinueIfNoActiveCompanionNames
      || skill.replaceUsedSlotWith || Number(skill.bossReelShift ?? 0)
      || Number(skill.enemyExGain ?? 0) || Number(skill.enemyExSpend ?? 0)
      || Number(skill.attackAddPermanent ?? 0) || skill.curesDarkness) return null;

  const relevantEffects = (skill.effects ?? []).filter(effect => {
    return !(effect?.type === 'status' && (effect.status === 'poison' || effect.status === 'deadlyPoison'));
  });

  if (skill.kind === 'attack' && relevantEffects.length === 0) {
    // プレイヤーEXを追跡しない戦闘では、純粋攻撃の対象数・ヒット数は結果へ影響しない。
    // ただし物理攻撃は睡眠解除を起こすため、睡眠中の味方がいる時だけ従来どおり区別する。
    const anySleepingAlly = (runtime.allies ?? []).some(ally => ally?.active !== false && ally?.statuses?.sleep);
    if (runtime.ignorePlayerExTracking === true && !anySleepingAlly) {
      return JSON.stringify({ kind:'noop', nextReel, exGain });
    }
    const hitChoices = enemyHitCountChoices(skill).map(x => [Number(x.hits) || 0, Number(x.probability) || 0]);
    return JSON.stringify({
      kind:'pureAttack', nextReel, exGain,
      target:String(skill.target ?? 'random'),
      physical:skill.attackType === 'physical',
      hitChoices
    });
  }

  // 完全な無効果技だけをnoopとしてまとめる。
  if (skill.kind !== 'attack' && relevantEffects.length === 0) {
    const specialKeys = [
      'enemySelfAttackPercent','enemySelfDefensePercent','enemySelfSpeedPercent','enemySelfSpeedFlat',
      'postActionAttackGain','postActionSpeedGain','enemyExSet','healPercent','healFlat','healAttackPercent'
    ];
    if (!specialKeys.some(key => Number(skill?.[key] ?? 0) !== 0)) {
      return JSON.stringify({ kind:'noop', nextReel, exGain });
    }
  }
  return null;
}

function compressBossCommandTransitions(presetId, runtime, transitions) {
  const out = [];
  const grouped = new Map();
  for (const tr of transitions ?? []) {
    if (!(tr?.probability > 0)) continue;
    const commandName = String(tr.commandName ?? '').trim();
    const effectiveCommandName = presetId === 'q_zarigarion' && runtime.enemy?.pincerRushActive && commandName === '鋏竜の猛攻'
      ? '竜のしっぽ'
      : commandName;
    const skill = enemySkillForCommand(effectiveCommandName, presetId);
    const key = bossCommandOperationalKey(presetId, runtime, tr, effectiveCommandName, skill);
    if (key == null) {
      out.push({ ...tr, commandName, effectiveCommandName, skill });
      continue;
    }
    const existing = grouped.get(key);
    if (existing) existing.probability += tr.probability;
    else grouped.set(key, { ...tr, commandName, effectiveCommandName, skill });
  }
  return [...out, ...grouped.values()];
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
  // 発動率・未実装警告は圧縮前の全コマンドから集計する。
  for (const tr of transitions) {
    if (tr.probability <= 0) continue;
    const commandName = String(tr.commandName ?? '').trim();
    const effectiveCommandName = presetId === 'q_zarigarion' && runtime.enemy?.pincerRushActive && commandName === '鋏竜の猛攻'
      ? '竜のしっぽ'
      : commandName;
    const skill = enemySkillForCommand(effectiveCommandName, presetId);
    if (skill) activationBucket[effectiveCommandName] = (activationBucket[effectiveCommandName] ?? 0) + sourceMass * tr.probability;
    else if (!isStructuralOrNoEffectCommand(effectiveCommandName) && effectiveCommandName) missingEffects.add(`敵:${effectiveCommandName}`);
  }

  const executionTransitions = compressBossCommandTransitions(presetId, runtime, transitions);
  const out = [];
  for (const tr of executionTransitions) {
    if (tr.probability <= 0) continue;
    const commandName = tr.commandName ?? String(tr.commandName ?? '').trim();
    const effectiveCommandName = tr.effectiveCommandName ?? commandName;
    const skill = tr.skill ?? enemySkillForCommand(effectiveCommandName, presetId);

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
  if (!(branches ?? []).some(branch => (branch.runtime?.enemy?.reactiveEffects?.length ?? 0) > 0)) return branches;
  const out = [];
  for (const branch of branches) {
    // 全敵撃破済みなら反応効果は発生する前に戦闘終了。cloneも不要。
    const allDead = [...branch.hpDist.keys()].every(hp => enemyHpDefeated(hp));
    if (allDead) { out.push(branch); continue; }
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


let ACTIVE_ALLY_ACTION_CACHE = null;
let ACTIVE_ACTION_KEY_CACHE = null;
let ACTIVE_CACHE_HITS = 0, ACTIVE_CACHE_MISSES = 0;

function normalizedHpDistributionCacheKey(dist) {
  const cached = HP_NORMALIZED_KEY_CACHE.get(dist);
  if (cached != null) return cached;
  const mass = distributionMass(dist);
  if (!(mass > 0)) return '0';
  const parts = new Array(dist.size + 1);
  parts[0] = `${dist.size}|`;
  let i = 1;
  for (const [hp, probability] of dist) parts[i++] = `${hp}:${(probability / mass).toPrecision(12)};`;
  const out = parts.join('');
  HP_NORMALIZED_KEY_CACHE.set(dist, out);
  return out;
}

function cachedActivatedAllyActionAndReactions(runtime, hpDist, action, actorIndex, state) {
  if (!ACTIVE_ALLY_ACTION_CACHE || action?.kind !== 'attack' || hpDist.size < 16) {
    let branches = applyActivatedAllyAction(runtime, hpDist, action, actorIndex, state);
    return applyEnemyReactiveEffectsAfterAllyAction(branches, actorIndex, action);
  }
  const sourceMass = distributionMass(hpDist);
  if (!(sourceMass > 0)) return [];
  let actionKey = ACTIVE_ACTION_KEY_CACHE?.get(action);
  if (actionKey == null) { actionKey = JSON.stringify(action); ACTIVE_ACTION_KEY_CACHE?.set(action, actionKey); }
  const key = `${actorIndex}|${state.enemy?.attribute ?? ''}|${stringifyRuntimeForMerge(runtime)}|${actionKey}|${normalizedHpDistributionCacheKey(hpDist)}`;
  const cached = ACTIVE_ALLY_ACTION_CACHE.get(key);
  if (cached) {
    ACTIVE_CACHE_HITS++;
    return cached.map(branch => ({
      runtime: cloneRuntimeState(branch.runtime),
      hpDist: scaleDistribution(branch.hpDist, sourceMass)
    }));
  }
  ACTIVE_CACHE_MISSES++;
  let branches = applyActivatedAllyAction(runtime, hpDist, action, actorIndex, state);
  branches = applyEnemyReactiveEffectsAfterAllyAction(branches, actorIndex, action);
  ACTIVE_ALLY_ACTION_CACHE.set(key, branches.map(branch => ({
    runtime: cloneRuntimeState(branch.runtime),
    hpDist: scaleDistribution(branch.hpDist, 1 / sourceMass)
  })));
  return branches;
}



function bossReelCanonicalizationEligible(presetId) {
  const profile = enemyBossProfile(presetId ?? '');
  if (!profile?.matrix?.length) return false;
  if (presetId === 'q_zarigarion' || presetId === 'q_dock_low') return false;
  for (const row of profile.matrix) {
    for (const commandName of row) {
      const skill = enemySkillForCommand(commandName, presetId);
      if (!skill) continue;
      if (skill.turnContinue || skill.turnContinueIfActiveCompanion || skill.turnContinueIfNoActiveCompanionNames) return false;
      if (skill.replaceUsedSlotWith != null) return false;
    }
  }
  return true;
}

function buildBossReelCanonicalizers(presetId, turns) {
  const profile = enemyBossProfile(presetId ?? '');
  if (!bossReelCanonicalizationEligible(presetId)) return null;
  const reelCount = profile.matrix.length;
  const byTurn = Array.from({ length:turns.length }, () => new Map());
  let nextClass = Array(reelCount).fill(0);
  for (let turnIndex = turns.length - 1; turnIndex >= 0; turnIndex--) {
    const signatureToClass = new Map();
    const currentClass = Array(reelCount).fill(0);
    let classSeq = 0;
    for (let reel = 0; reel < reelCount; reel++) {
      const transitions = enemyCommandTransitions(presetId, reel, []) ?? [];
      const outcomes = new Map();
      for (const tr of transitions) {
        const nextReel = Math.max(0, Math.min(reelCount - 1, Number(tr.nextReel ?? reel) || 0));
        const name = String(tr.commandName ?? '');
        const key = `${name}|n${nextClass[nextReel]}`;
        outcomes.set(key, (outcomes.get(key) ?? 0) + Number(tr.probability ?? 0));
      }
      const signature = [...outcomes.entries()].sort(([a],[b]) => a.localeCompare(b, 'ja')).map(([key,p]) => `${key}=${p}`).join('||');
      if (!signatureToClass.has(signature)) signatureToClass.set(signature, { id:classSeq++, representative:reel });
      const cls = signatureToClass.get(signature);
      currentClass[reel] = cls.id;
      byTurn[turnIndex].set(reel, cls.representative);
    }
    nextClass = currentClass;
  }
  return byTurn;
}

function finalTurnBossReelCanonical(runtime, presetId, currentReel) {
  const profile = enemyBossProfile(presetId ?? '');
  if (!profile?.matrix?.length) return currentReel;
  if (Object.keys(runtime?.enemy?.commandOverrides ?? {}).length) return currentReel;
  if ((runtime?.enemy?.transientDisabledCommands ?? []).length) return currentReel;
  // 即時再行動・条件付き再行動を含むBOSSは、停止後のnextReelが同一行動内で再参照されるため対象外。
  for (const row of profile.matrix) {
    for (const commandName of row) {
      const skill = enemySkillForCommand(commandName, presetId);
      if (skill?.turnContinue || skill?.turnContinueIfActiveCompanion || skill?.turnContinueIfNoActiveCompanionNames) return currentReel;
    }
  }
  const disabled = runtime?.enemy?.disabledCommands ?? [];
  const signatures = new Map();
  const canonical = new Map();
  for (let reel = 0; reel < profile.matrix.length; reel++) {
    const transitions = enemyCommandTransitions(presetId, reel, disabled) ?? [];
    const outcomes = new Map();
    for (const tr of transitions) {
      const name = String(tr.commandName ?? '');
      const skill = enemySkillForCommand(name, presetId);
      // 最終ターン後のnextReelは参照されない。さらに、撃破確率上の効果が同じ
      // 純粋攻撃/待機/移動は技名が違っても同一 outcome としてまとめる。
      const operational = bossCommandOperationalKey(presetId, runtime, { ...tr, nextReel:0 }, name, skill);
      const key = operational ?? `raw:${name}`;
      outcomes.set(key, (outcomes.get(key) ?? 0) + Number(tr.probability ?? 0));
    }
    const signature = [...outcomes.entries()].sort(([a],[b]) => a.localeCompare(b, 'ja')).map(([key,p]) => `${key}:${p}`).join('|');
    if (!signatures.has(signature)) signatures.set(signature, reel);
    canonical.set(reel, signatures.get(signature));
  }
  return canonical.get(currentReel) ?? currentReel;
}


function allyRolledOutcomeKey(commandName, configuredAction) {
  const name = String(commandName ?? '').trim();
  const exGain = playerExGainFromCommandName(name || configuredAction?.skillName);
  if (isStructuralOrNoEffectCommand(name)) return `N:${name}|x${exGain}`;
  const rolled = actionForRolledCommand(name, configuredAction);
  if (!rolled.action) return `M:${name}|x${exGain}`;
  return `A:${name}|x${exGain}|${JSON.stringify(rolled.action)}`;
}

function buildAllyReelCanonicalizers(state, turns, allyCount) {
  const byTurn = Array.from({ length:turns.length }, () => Array.from({ length:allyCount }, () => new Map()));
  // nextClass[i][reel] は次ターン以降の挙動等価クラス。最終ターンの先は全て同じ。
  let nextClass = Array.from({ length:allyCount }, () => [0,0,0,0]);
  for (let turnIndex = turns.length - 1; turnIndex >= 0; turnIndex--) {
    const currentClass = Array.from({ length:allyCount }, () => [0,0,0,0]);
    for (let actorIndex = 0; actorIndex < allyCount; actorIndex++) {
      const characterId = state.allies?.[actorIndex]?.characterId ?? '';
      const { action:configuredAction } = resolveAction(turns, turnIndex, 'ally', actorIndex);
      const rawTurnAction = turns[turnIndex]?.allyActions?.[actorIndex] ?? {};
      const fixedCharacterSkill = String(rawTurnAction.fixedCharacterSkill ?? '').trim();
      const commandVariant = state.allies?.[actorIndex]?.commandVariant ?? '';
      const signatureToClass = new Map();
      let classSeq = 0;
      for (let reel = 0; reel < 4; reel++) {
        const outcomes = new Map();
        if (fixedCharacterSkill && characterId !== 'son_goku' && characterId !== 'gyumao') {
          const key = `F:${fixedCharacterSkill}|n${nextClass[actorIndex][reel]}`;
          outcomes.set(key, 1);
        } else {
          const transitions = commandTransitionsFor({
            characterId,
            skillPresetId:configuredAction.skillPresetId,
            skillName:configuredAction.skillName,
            startReel:reel,
            commandVariant
          });
          if (!transitions) {
            const key = `D:${JSON.stringify(configuredAction)}|n${nextClass[actorIndex][reel]}`;
            outcomes.set(key, 1);
          } else {
            for (const tr of transitions) {
              const nextReel = Math.max(0, Math.min(3, Number(tr.nextReel ?? reel) || 0));
              const key = `${allyRolledOutcomeKey(tr.commandName, configuredAction)}|n${nextClass[actorIndex][nextReel]}`;
              outcomes.set(key, (outcomes.get(key) ?? 0) + Number(tr.probability ?? 0));
            }
          }
        }
        const signature = [...outcomes.entries()].sort(([a],[b]) => a.localeCompare(b, 'ja')).map(([key,p]) => `${key}=${p}`).join('||');
        if (!signatureToClass.has(signature)) signatureToClass.set(signature, { id:classSeq++, representative:reel });
        const cls = signatureToClass.get(signature);
        currentClass[actorIndex][reel] = cls.id;
        byTurn[turnIndex][actorIndex].set(reel, cls.representative);
      }
    }
    nextClass = currentClass;
  }
  return byTurn;
}

function finalTurnAllyReelCanonicalizer(state, turns, turnIndex, allyCount) {
  const maps = Array.from({ length:allyCount }, () => new Map());
  for (let actorIndex = 0; actorIndex < allyCount; actorIndex++) {
    const characterId = state.allies?.[actorIndex]?.characterId ?? '';
    const { action:configuredAction } = resolveAction(turns, turnIndex, 'ally', actorIndex);
    const rawTurnAction = turns[turnIndex]?.allyActions?.[actorIndex] ?? {};
    const fixedCharacterSkill = String(rawTurnAction.fixedCharacterSkill ?? '').trim();
    const commandVariant = state.allies?.[actorIndex]?.commandVariant ?? '';
    const signatures = new Map();
    for (let reel = 0; reel < 4; reel++) {
      let signature;
      if (fixedCharacterSkill && characterId !== 'son_goku' && characterId !== 'gyumao') {
        signature = `fixed:${fixedCharacterSkill}`;
      } else {
        const transitions = commandTransitionsFor({
          characterId,
          skillPresetId:configuredAction.skillPresetId,
          skillName:configuredAction.skillName,
          startReel:reel,
          commandVariant
        });
        if (!transitions) signature = `direct:${configuredAction.skillName ?? ''}`;
        else {
          const byCommand = new Map();
          for (const tr of transitions) {
            const name = String(tr.commandName ?? '');
            byCommand.set(name, (byCommand.get(name) ?? 0) + Number(tr.probability ?? 0));
          }
          signature = [...byCommand.entries()].sort(([a],[b]) => a.localeCompare(b, 'ja')).map(([name,p]) => `${name}:${p}`).join('|');
        }
      }
      if (!signatures.has(signature)) signatures.set(signature, reel);
      maps[actorIndex].set(reel, signatures.get(signature));
    }
  }
  return maps;
}


function buildSilenceRelevantAllies(state, turns, allyCount) {
  const relevant = new Set();
  for (let actorIndex = 0; actorIndex < allyCount; actorIndex++) {
    const characterId = String(state.allies?.[actorIndex]?.characterId ?? '');
    // 七十二変化そのものが魔法扱いなので、変化先の攻撃種別に関係なく沈黙が影響する。
    if (characterId === 'son_goku' || characterId === 'gyumao') { relevant.add(actorIndex); continue; }
    let matters = false;
    for (let turnIndex = 0; turnIndex < turns.length && !matters; turnIndex++) {
      const { action:configuredAction } = resolveAction(turns, turnIndex, 'ally', actorIndex);
      const rawTurnAction = turns[turnIndex]?.allyActions?.[actorIndex] ?? {};
      const fixedCharacterSkill = String(rawTurnAction.fixedCharacterSkill ?? '').trim();
      const candidates = [];
      if (fixedCharacterSkill) {
        const presetId = presetIdForSkillName(fixedCharacterSkill);
        const preset = presetId ? SKILL_PRESET_BY_ID.get(presetId) : null;
        if (preset) candidates.push(preset);
      } else if (characterId) {
        const names = commandSkillNamesForCharacter(characterId, configuredAction?.skillName ?? '', state.allies?.[actorIndex]?.commandVariant ?? '');
        for (const name of names) {
          const presetId = presetIdForSkillName(name);
          const preset = presetId ? SKILL_PRESET_BY_ID.get(presetId) : null;
          if (preset) candidates.push(preset);
        }
      }
      candidates.push(configuredAction);
      if (candidates.some(action => String(action?.attackType ?? '') === 'magic')) matters = true;
    }
    if (matters) relevant.add(actorIndex);
  }
  return relevant;
}

function buildDarknessRelevantAllies(state, turns, allyCount) {
  const relevant = new Set();
  for (let actorIndex = 0; actorIndex < allyCount; actorIndex++) {
    const characterId = String(state.allies?.[actorIndex]?.characterId ?? '');
    let matters = false;
    for (let turnIndex = 0; turnIndex < turns.length && !matters; turnIndex++) {
      const { action:configuredAction } = resolveAction(turns, turnIndex, 'ally', actorIndex);
      const rawTurnAction = turns[turnIndex]?.allyActions?.[actorIndex] ?? {};
      const fixedCharacterSkill = String(rawTurnAction.fixedCharacterSkill ?? '').trim();
      const candidates = [];
      if (fixedCharacterSkill) {
        const presetId = presetIdForSkillName(fixedCharacterSkill);
        const preset = presetId ? SKILL_PRESET_BY_ID.get(presetId) : null;
        if (preset) candidates.push(preset);
      } else if (characterId) {
        const names = commandSkillNamesForCharacter(characterId, configuredAction?.skillName ?? '', state.allies?.[actorIndex]?.commandVariant ?? '');
        for (const name of names) {
          const presetId = presetIdForSkillName(name);
          const preset = presetId ? SKILL_PRESET_BY_ID.get(presetId) : null;
          if (preset) candidates.push(preset);
        }
      }
      candidates.push(configuredAction);
      if (candidates.some(action => action?.kind === 'attack' && String(action?.attackType ?? '') === 'physical')) matters = true;
    }
    if (matters) relevant.add(actorIndex);
  }
  return relevant;
}

function simulateKillProbabilityWithActivation(state) {
  ACTIVE_ALLY_ACTION_CACHE = new Map(); ACTIVE_ACTION_KEY_CACHE = new WeakMap(); ACTIVE_CACHE_HITS = 0; ACTIVE_CACHE_MISSES = 0;
  const maxHp = parseIntValue(state.enemy?.maxHp, '敵HP', { min: 1, max: 9999999 });
  const enemyBaseSpeed = parseNumber(state.enemy?.speed, '敵の素早さ', { min: 0 });
  const allyCount = parseIntValue(state.allyCount, '味方人数', { min: 1, max: 3 });
  const enemyExAllowance = parseIntValue(state.enemy?.enemyExAllowance ?? '0', '敵EX許容回数', { min: 0, max: 99 });
  const turns = Array.isArray(state.turns) && state.turns.length ? state.turns : [];
  if (!turns.length) throw new Error('ターンを1つ以上設定してください');
  ACTIVE_SILENCE_RELEVANT_ALLIES = buildSilenceRelevantAllies(state, turns, allyCount);
  ACTIVE_DARKNESS_RELEVANT_ALLIES = buildDarknessRelevantAllies(state, turns, allyCount);
  const allyReelCanonicalByTurn = buildAllyReelCanonicalizers(state, turns, allyCount);

  const presetId = state.enemy?.presetId ?? '';
  const bossReelCanonicalByTurn = buildBossReelCanonicalizers(presetId, turns);
  const bossProfile = state.enemy?.manualActions === true ? null : enemyBossProfile(presetId);
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
  // 勝敗が確定した枝を以後のシミュレーションから除外する累積成功確率。
  let terminalSuccessMass = 0;
  const terminalSuccessHpDist = new Map();

  for (let turnIndex = 0; turnIndex < turns.length; turnIndex++) {
    const __turnStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const turn = turns[turnIndex] ?? {};
    const isFinalTurn = turnIndex === turns.length - 1;
    const finished = [];

    if (scenarios.length > 1) {
      if (isFinalTurn) {
        for (const candidate of scenarios) canonicalizeFinalTurnOneShotStatuses(candidate.runtime);
      }
      const canonical = allyReelCanonicalByTurn[turnIndex];
      for (const sc of scenarios) {
        const reels = sc.reels?.slice() ?? [];
        for (let i = 0; i < allyCount; i++) reels[i] = canonical[i].get(reels[i] ?? 0) ?? (reels[i] ?? 0);
        sc.reels = reels;
        if (isFinalTurn) {
          sc.enemyReel = finalTurnBossReelCanonical(sc.runtime, presetId, sc.enemyReel ?? 0);
        } else if (bossReelCanonicalByTurn && !Object.keys(sc.runtime?.enemy?.commandOverrides ?? {}).length && !(sc.runtime?.enemy?.disabledCommands?.length)) {
          sc.enemyReel = bossReelCanonicalByTurn[turnIndex]?.get(sc.enemyReel ?? 0) ?? (sc.enemyReel ?? 0);
        }
      }
      scenarios = mergeScenarios(scenarios);
    }

    // v0.5.76: 前ターンから来たシナリオを1本ずつ完走させず、
    // ターン開始時の行動順が同じ枝をまとめて処理する。各行動後のmergeScenariosが
    // 別の元シナリオ同士にも効くため、リール状態×状態異常の直積爆発を大幅に抑えられる。
    const orderGroups = new Map();
    for (const baseScenario of scenarios) {
      const order = actorOrder(baseScenario.runtime);
      const orderKey = order.map(actor => `${actor.side}:${actor.index}`).join('|');
      let group = orderGroups.get(orderKey);
      if (!group) { group = { order, scenarios:[] }; orderGroups.set(orderKey, group); }
      group.scenarios.push(baseScenario);
    }

    const kujeskaFinalStream = isFinalTurn
      && String(state.enemy?.presetId ?? '') === 'old5_kujeska'
      && typeof process !== 'undefined'
      && process?.env?.ORECA_KUJESKA_FINAL_STREAM === '1';
    function* groupsForProcessing() {
      for (const group of orderGroups.values()) {
        if (!kujeskaFinalStream || group.scenarios.length <= 64) {
          yield group;
          continue;
        }
        const source = group.scenarios;
        for (let offset = 0; offset < source.length; offset += 64) {
          const end = Math.min(source.length, offset + 64);
          const chunk = source.slice(offset, end);
          // stream診断では元scenarios配列への参照を順次切り、処理済みHP MapをGC可能にする。
          for (let i = offset; i < end; i++) source[i] = null;
          yield { order:group.order, scenarios:chunk };
        }
      }
    }
    if (kujeskaFinalStream) scenarios = [];

    for (const group of groupsForProcessing()) {
      const order = group.order;
      if (!firstFinalOrder.length && isFinalTurn) firstFinalOrder = order;
      const finalCutoffPosition = isFinalTurn ? finalTurnCutoffPosition(state, order) : -1;
      let active = group.scenarios.map(baseScenario => ({ ...baseScenario, order }));
      // 指定キャラがこの枝では既に不在なら、そのキャラの行動機会は存在しないため
      // 最終ターン開始時点で打ち切る。既に撃破済みの確率質量だけを結果へ残す。
      if (isFinalTurn && finalCutoffPosition < 0) {
        finished.push(...active);
        active = [];
      }

      for (let pos = 0; pos < order.length; pos++) {
        const actor = order[pos];
        const __actorStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        if (actor.side === 'ally' && String(state.enemy?.presetId ?? '') === 'old5_kujeska') {
          active = resolveDeferredConfusionForAllyScenarios(active, actor.index);
          active = resolveDeferredParalysisForAllyScenarios(active, actor.index);
        }
        if ((actor.side === 'enemy' || actor.side === 'companion') && String(state.enemy?.presetId ?? '') === 'old5_kujeska') {
          active = resolveDeferredKujeskaEnemyParalysisScenarios(active, actor);
        }
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
            const chargedAction = baseRt.allies[actor.index]?.chargedAction ?? null;
            const autoDance = (baseRt.allies[actor.index]?.swordDanceAutoRemaining ?? 0) > 0;
            let configuredAction;
            let commandBranches;
            if (chargedAction) {
              configuredAction = ensureAction(chargedAction, 'ally');
              baseRt.allies[actor.index].chargedAction = null;
              commandBranches = [{ nextReel: sc.reels[actor.index] ?? 0, commandName: configuredAction.skillName, probability: 1, directAction: true }];
            } else if (autoDance) {
              const preset = SKILL_PRESET_BY_ID.get('sword_dance');
              configuredAction = ensureAction({ ...preset, skillPresetId: 'sword_dance' }, 'ally');
              commandBranches = [{ nextReel: sc.reels[actor.index] ?? 0, commandName: 'つるぎの舞', probability: 1, directAction: true }];
            } else {
              ({ action: configuredAction } = resolveAction(turns, turnIndex, 'ally', actor.index));
              const rawTurnAction = turns[turnIndex]?.allyActions?.[actor.index] ?? {};
              // 状態異常を見て手動で変化先を切り替える周回チャート用。
              // 現状はチヴィエール戦で必要な混乱時の代替技を一般フィールドとして扱う。
              const confusionPresetId = baseRt.allies[actor.index]?.statuses?.confusion
                ? String(rawTurnAction.confusionSkillPresetId ?? '').trim() : '';
              if (confusionPresetId) {
                const confusionPreset = SKILL_PRESET_BY_ID.get(confusionPresetId);
                if (confusionPreset) configuredAction = ensureAction({ ...confusionPreset, skillPresetId:confusionPresetId }, 'ally');
              }
              const fixedCharacterSkill = String(rawTurnAction.fixedCharacterSkill ?? '').trim();
              if (fixedCharacterSkill && characterId !== 'son_goku' && characterId !== 'gyumao') {
                // キャラ固定技の手動指定。コマンド抽選を完全に飛ばし、現在リールを保持したまま
                // 指定技をこのターンの停止コマンドとして100%実行する。
                configuredAction = {
                  ...configuredAction,
                  presetTarget: rawTurnAction.presetTarget ?? configuredAction.presetTarget ?? '',
                  enemyTargetSlot: rawTurnAction.enemyTargetSlot ?? configuredAction.enemyTargetSlot ?? 'auto'
                };
                commandBranches = [{
                  nextReel: sc.reels[actor.index] ?? 0,
                  commandName: fixedCharacterSkill,
                  probability: 1,
                  directAction: false
                }];
              } else {
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
            }

            for (const tr of commandBranches) {
              if (tr.probability <= 0) continue;
              const rt = cloneRuntimeState(baseRt);
              const reels = sc.reels.slice();
              reels[actor.index] = isFinalTurn ? 0 : (allyReelCanonicalByTurn[turnIndex + 1]?.[actor.index]?.get(tr.nextReel) ?? tr.nextReel);
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
                actionBranches = cachedActivatedAllyActionAndReactions(rt, weightedEnemyHp, rolled.action, actor.index, state);
              }

              // v0.5.85: 魔皇クジェスカにはお供蘇生が無い。味方攻撃でその時点の全お供が
              // 撃破された枝は、同一ターン中でも死体HPスロットを即座にBOSS単体へ畳む。
              // actorOrderには元のお供indexが残るが、runtime.companions=[] なら後続のお供行動は
              // そのままskipされるため、行動順の意味を変えずHP直積だけを消せる。
              if (String(state.enemy?.presetId ?? '') === 'old5_kujeska') {
                actionBranches = actionBranches.map(branch => {
                  const companions = branch.runtime?.companions ?? [];
                  if (!companions.length || !companions.every(c => c?.active === false && c?.revivable !== true)) return branch;
                  const compacted = compactInactiveCompanionsAtTurnBoundary({
                    runtime:branch.runtime, hpDist:branch.hpDist, companionReels:[]
                  }, true);
                  return { runtime:compacted.runtime, hpDist:compacted.hpDist };
                });
              }

              for (const actionBranch of actionBranches) {
                const { dead, live } = splitEnemyAliveDistribution(actionBranch.hpDist);
                const deadMass = distributionMass(dead);
                const liveMass = distributionMass(live);
                // 撃破済み質量は行動後の状態更新も不要。直後の共通終端処理へ渡す。
                if (deadMass > 0) {
                  next.push({ runtime: actionBranch.runtime, reels: reels.slice(), enemyReel: sc.enemyReel ?? 0, companionReels: sc.companionReels?.slice() ?? [], hpDist: dead, order });
                }
                if (liveMass <= 0) continue;
                const branchRuntime = deadMass > 0 ? cloneRuntimeState(actionBranch.runtime) : actionBranch.runtime;
                branchRuntime.allies[actor.index].actionsTaken += 1;
                advanceProgressiveDecayAfterAction(branchRuntime, actor.index);
                finishAllyStatusOpportunity(branchRuntime, actor.index, true);
                expireSourceLinkedMods(branchRuntime, actor.index, 'end');
                const branchReels = reels.slice();
                applyPendingReelBoosts(branchRuntime, branchReels);
                next.push({ runtime: branchRuntime, reels: branchReels.slice(), enemyReel: sc.enemyReel ?? 0, companionReels: sc.companionReels?.slice() ?? [], hpDist: live, order });
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
            // 敵EXが10の枝では、敵の行動機会でEXが発動する。
            // 「敵EX許容回数」まではEXを受け流してゲージを0へ戻し、その行動機会を消費。
            // 許容回数を超えるEX（0なら1回目、1なら2回目…）で周回失敗とする。
            if (rawEnemyAction.enabled !== false && enemyExGauge(runtime) >= 10 && enemyExIsAvailable(runtime)) {
              if (enemyExActivationCount(runtime) >= enemyExAllowance) {
                const failed = distributionMass(live);
                enemyExFailureChance += failed;
                enemyExFailureByTurn[turnIndex] += failed;
                continue;
              }
              const rt = cloneRuntimeState(runtime);
              consumeAllowedEnemyEx(rt);
              beginEnemyCommandAction(rt);
              let hp = finishEnemyCommandAction(rt, new Map(live));
              hp = applyPoison(rt, hp);
              const branchReels = sc.reels.slice();
              applyPendingReelBoosts(rt, branchReels);
              next.push({ runtime:rt, reels:branchReels, enemyReel:sc.enemyReel ?? 0, companionReels:sc.companionReels?.slice() ?? [], hpDist:hp, order });
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
              const tokaiTerminalSafe = isFinalTurn && String(state.enemy?.presetId ?? '') === 'old6_tokai';
              const noLaterEnemyActors = isFinalTurn && (tokaiTerminalSafe || order.slice(pos + 1, finalCutoffPosition + 1).every(a => a.side === 'ally'));
              const prevStatusRelevant = ACTIVE_FINAL_STATUS_RELEVANT_ALLIES;
              const prevStatusTypes = ACTIVE_FINAL_STATUS_RELEVANT_TYPES;
              if (noLaterEnemyActors) {
                const relevant = new Set();
                const typeMap = new Map();
                for (let futurePos = pos + 1; futurePos <= finalCutoffPosition; futurePos++) {
                  const futureActor = order[futurePos];
                  if (futureActor?.side !== 'ally') continue;
                  const characterId = state.allies?.[futureActor.index]?.characterId ?? '';
                  const futureAction = resolveAction(turns, turnIndex, 'ally', futureActor.index).action;
                  if (futureAction?.kind === 'skip') continue;
                  relevant.add(futureActor.index);
                  const types = typeMap.get(futureActor.index) ?? new Set();
                  types.add('sleep'); types.add('paralysis'); types.add('petrification');
                  if (futureAction?.kind !== 'skip') types.add('brainwash');
                  if (characterId === 'son_goku' || characterId === 'gyumao' || futureAction?.attackType === 'magic') types.add('silence');
                  if (futureAction?.kind === 'attack') types.add('confusion');
                  if (futureAction?.kind === 'attack' && futureAction?.attackType === 'physical') types.add('darkness');
                  if (futureAction?.attackType === 'breath' || /(?:ブレス|いき|息)/.test(String(futureAction?.skillName ?? ''))) types.add('cold');
                  types.add('curse');
                  typeMap.set(futureActor.index, types);
                }
                ACTIVE_FINAL_STATUS_RELEVANT_ALLIES = relevant;
                ACTIVE_FINAL_STATUS_RELEVANT_TYPES = typeMap;
              }
              const prevFinalBossChain = ACTIVE_FINAL_BOSS_CHAIN;
              ACTIVE_FINAL_BOSS_CHAIN = isFinalTurn;
              const chainBranches = executeBossCommandChain(
                runtime, live, state, state.enemy?.presetId ?? '', sc.enemyReel ?? 0,
                enemySkillActivation[turnIndex], missingEffects
              );
              ACTIVE_FINAL_BOSS_CHAIN = prevFinalBossChain;
              ACTIVE_FINAL_STATUS_RELEVANT_ALLIES = prevStatusRelevant;
              ACTIVE_FINAL_STATUS_RELEVANT_TYPES = prevStatusTypes;
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
                  enemyReel: isFinalTurn ? 0 : (bossReelCanonicalByTurn?.[turnIndex + 1]?.get(shifted.enemyReel) ?? shifted.enemyReel), companionReels: shifted.companionReels,
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
            // BOSS本体が倒れても、お供・召喚個体が残っている限り戦闘は継続する。
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
            // 敵チームEXは共有。お供の行動機会でも10ならEXが発動する。
            // 許容回数内ならゲージを0へ戻してその行動機会を消費し、超過時だけ周回失敗。
            if (rawEnemyAction.enabled !== false && enemyExGauge(runtime) >= 10 && enemyExIsAvailable(runtime)) {
              if (enemyExActivationCount(runtime) >= enemyExAllowance) {
                const failed = distributionMass(live);
                enemyExFailureChance += failed;
                enemyExFailureByTurn[turnIndex] += failed;
                continue;
              }
              const rt = cloneRuntimeState(runtime);
              consumeAllowedEnemyEx(rt);
              const hp = applyCompanionPoison(rt, new Map(live), actor.index);
              next.push({ runtime:rt, reels:sc.reels.slice(), enemyReel:sc.enemyReel ?? 0, companionReels:sc.companionReels?.slice() ?? [], hpDist:hp, order });
              continue;
            }
            if (rawEnemyAction.enabled === false) {
              const rt = cloneRuntimeState(runtime);
              const hp = applyCompanionPoison(rt, new Map(live), actor.index);
              next.push({ runtime: rt, reels: sc.reels.slice(), enemyReel: sc.enemyReel ?? 0, companionReels: sc.companionReels?.slice() ?? [], hpDist:hp, order });
              continue;
            }
            // 手動敵行動モードでは固定お供のコマンド抽選・妨害・回復等は行わない。
            // ただし実際の行動機会は残すため、共有EX=10判定（上）と毒/猛毒tickは維持する。
            if (state.enemy?.manualActions === true) {
              const rt = cloneRuntimeState(runtime);
              const hp = applyCompanionPoison(rt, new Map(live), actor.index);
              next.push({ runtime: rt, reels: sc.reels.slice(), enemyReel: sc.enemyReel ?? 0, companionReels: sc.companionReels?.slice() ?? [], hpDist:hp, order });
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
            const rawTransitions = companionName ? enemyCompanionCommandTransitions(companionName, startReel) : null;
            const transitions = rawTransitions ? compactCompanionTransitionsForKillProbability(companionName, rawTransitions, runtime) : null;
            // v0.5.83: 全枠が純粋な待機コマンドのお供は、行動順と確率係数を維持したまま
            // clone/skill dispatch/後処理を省略する。0.9999999999999999 の遷移確率も従来どおり
            // scaleDistributionへ通すため、浮動小数点の結果まで変えない。
            if (transitions?.length === 1) {
              const tr = transitions[0];
              const commandName = String(tr.commandName ?? '').trim();
              const pureWait = commandName === 'ときをまつ'
                && !enemyCompanionSkillForCommand(commandName, companionName)
                && enemyExGainFromCommandName(commandName) === 0
                && (tr.nextReel ?? startReel) === startReel
                && (companion.poison ?? 'none') === 'none'
                && Number(companion.postActionSpeedGain ?? 0) === 0
                && Number(companion.postActionEnemyExGain ?? 0) === 0
                && (runtime.pendingReelBoosts?.length ?? 0) === 0
                && (runtime.pendingReelSets?.length ?? 0) === 0
                && Number(runtime.enemy?.pendingReelShift ?? 0) === 0
                && !objectHasEnumerableKeys(runtime.pendingCompanionReelShifts);
              if (pureWait) {
                next.push({
                  runtime, reels:sc.reels.slice(), enemyReel:sc.enemyReel ?? 0,
                  companionReels:sc.companionReels?.slice() ?? [],
                  hpDist:scaleDistribution(live, tr.probability), order
                });
                continue;
              }
            }
            if (!transitions?.length) {
              next.push({ runtime: cloneRuntimeState(runtime), reels: sc.reels.slice(), enemyReel: sc.enemyReel ?? 0, companionReels: sc.companionReels?.slice() ?? [], hpDist:new Map(live), order });
              continue;
            }

            const fenrirMarkovBranches = companionName === 'フェンリル' && Array.isArray(companion?.fenrirStateDist)
              ? executeKujeskaFenrirMarkov(runtime, live, state, actor.index, enemySkillActivation[turnIndex], missingEffects)
              : null;
            const companionBranches = fenrirMarkovBranches
              ? fenrirMarkovBranches
              : companionName === 'アヴァドンフード'
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
                    const activationBreakdown = tr.activationBreakdown ?? [{ commandName, probability:tr.probability }];
                    for (const part of activationBreakdown) {
                      const partName = String(part?.commandName ?? '').trim();
                      const partSkill = partName ? enemyCompanionSkillForCommand(partName, companionName) : null;
                      const activationLabel = `お供:${companionName} / ${partName || '移動'}`;
                      if (partSkill) {
                        enemySkillActivation[turnIndex][activationLabel] = (enemySkillActivation[turnIndex][activationLabel] ?? 0) + sourceMass * Number(part?.probability ?? 0);
                      } else if (!isStructuralOrNoEffectCommand(partName) && partName) {
                        missingEffects.add(`お供:${companionName}:${partName}`);
                      }
                    }
                    const rt = cloneRuntimeState(runtime);
                    addEnemyEx(rt, enemyExGainFromCommandName(commandName));
                    rt.actingCompanionIndex = actor.index;
                    const weighted = scaleDistribution(live, tr.probability);
                    const branches = skill ? executeEnemySkill(rt, weighted, state, skill) : [{ runtime:rt, hpDist:weighted }];
                    for (const branch of branches) {
                      branch.hpDist = applyCompanionSelfBlessingAfterAction(branch.runtime, branch.hpDist, actor.index);
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
        // 最終ターンでは、この行動機会を終えたactorの次リールはもう参照されない。
        // その値だけが違う枝をmerge前に正規化し、不要な状態直積を消す。
        if (isFinalTurn) {
          for (const candidate of next) {
            if (actor.side === 'ally' && Array.isArray(candidate.reels)) candidate.reels[actor.index] = 0;
            else if (actor.side === 'enemy') candidate.enemyReel = 0;
            else if (actor.side === 'companion' && Array.isArray(candidate.companionReels)) candidate.companionReels[actor.index] = 0;
          }
        } else if (presetId === 'old5_kujeska' && turnIndex + 1 === turns.length - 1
                   && String(state?.finalTurnCutoff ?? '') === 'ally1') {
          // クジェスカ標準チャートでは最終ターンの評価終了位置がキャラ1直後で、
          // キャラ2/3・BOSS・全お供は必ずその後にしか行動しない（各枝の次ターンorderで検証済み）。
          // よってペナルティメイトターンで当該actorが行動し終えた時点から、
          // そのactorの「次ターン用リール」を即座に捨ててmergeできる。
          for (const candidate of next) {
            if (actor.side === 'ally' && actor.index > 0 && Array.isArray(candidate.reels)) {
              candidate.reels[actor.index] = 0;
            } else if (actor.side === 'enemy') {
              candidate.enemyReel = 0;
            } else if (actor.side === 'companion' && Array.isArray(candidate.companionReels)) {
              candidate.companionReels[actor.index] = 0;
              const companion = candidate.runtime?.companions?.[actor.index];
              if (companion?.name === 'フェンリル') delete companion.fenrirStateDist;
            }
          }
        }
        // v0.5.81: 魔王サッカーラには死亡お供の蘇生技が無い。
        // ベージが味方行動の途中で倒れた枝は、merge前に死体HPスロットを除去して
        // BOSS単体の数値HP経路へ戻す。先に正規化することで死体slot付き状態を一度mergeして
        // 直後に再mergeする無駄も避ける。古神兵召喚は後から新規slotを追加するため両立する。
        let nextForMerge = String(state.enemy?.presetId ?? '') === 'old2_soccerra'
          ? next.map(sc => ((sc.runtime?.companions ?? []).length > 0
              && (sc.runtime.companions ?? []).every(c => c?.active === false))
            ? compactInactiveCompanionsAtTurnBoundary(sc, true) : sc)
          : next;
        if (isFinalTurn) {
          for (const candidate of nextForMerge) canonicalizeFinalTurnOneShotStatuses(candidate.runtime);
        }
        active = splitBrokenEnemyChargeScenarios(mergeScenarios(nextForMerge));
        if (typeof process !== 'undefined' && process?.env?.ORECA_DEBUG_ACTORS === '1') {
          const rk = new Set(active.map(x => stringifyRuntimeForMerge(x.runtime)));
          const __actorNow = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
          console.error('ACTOR_DEBUG', {turn:turnIndex+1,pos,actor:actor.side+(actor.index>=0?actor.index:''),active:active.length,runtimes:rk.size,ms:__actorNow-__actorStart});
        }
        const terminalized = extractBattleDefeatedScenarios(active);
        terminalSuccessMass += terminalized.defeatedMass;
        addDistribution(terminalSuccessHpDist, terminalized.defeatedHpDist);
        active = terminalized.scenarios;
        if (isFinalTurn && pos === finalCutoffPosition) {
          // 診断用ストリーム経路では、最終終了位置まで生存した枝は撃破失敗として
          // 以後参照不要。撃破済み質量は直前のextractBattleDefeatedScenariosで既に
          // terminalSuccessMassへ加算済みなので、ここで保持しなくても撃破率は同一。
          if (!kujeskaFinalStream) finished.push(...active);
          active = [];
          break;
        }
      }
      if (active.length) {
        const turnBoundaryLive = [];
        for (const sc of active) {
          sc.hpDist = advanceSummonCurses(sc.runtime, sc.hpDist);
          const terminalized = extractBattleDefeatedScenarios([sc]);
          terminalSuccessMass += terminalized.defeatedMass;
          addDistribution(terminalSuccessHpDist, terminalized.defeatedHpDist);
          if (!terminalized.scenarios.length) continue;
          const liveSc = terminalized.scenarios[0];
          decrementTimedEffects(liveSc.runtime);
          // 次ターンが最終ターンなら、最終ターン開始時に行う一回性状態の正規化を
          // このターン境界へ前倒しする。間に行動は存在しないため完全同値で、境界mergeから効く。
          if (!isFinalTurn && turnIndex + 1 === turns.length - 1) {
            canonicalizeFinalTurnOneShotStatuses(liveSc.runtime);
            if (presetId === 'old5_kujeska' && String(state?.finalTurnCutoff ?? '') === 'ally1') {
              const nextOrder = actorOrder(liveSc.runtime);
              const nextCut = finalTurnCutoffPosition(state, nextOrder);
              if (nextCut === 0 && nextOrder[0]?.side === 'ally' && nextOrder[0]?.index === 0) {
                liveSc.runtime.kujeskaFinalAlly0Only = true;
              }
            }
          }
          // EXゲージは双方とも各ターン終了時に+1。最終ターンは指定した終了位置で結果を確定するため加算しない。
          if (!isFinalTurn) {
            addEnemyEx(liveSc.runtime, 1);
            if ((liveSc.runtime.allies ?? []).some(x => x?.active !== false)) addPlayerEx(liveSc.runtime, 1);
          }
          if (!isFinalTurn && turnIndex + 1 === turns.length - 1 && typeof process !== 'undefined' && process?.env?.ORECA_DEBUG_FINAL_ORDER === '1') {
            const nextOrder = actorOrder(liveSc.runtime);
            const nextCut = finalTurnCutoffPosition(state, nextOrder);
            const key = nextOrder.map((a,pos)=>`${a.side}:${a.index}:${pos<=nextCut?'pre':'post'}:${a.speed}`).join('|');
            globalThis.__orecaFinalOrderCounts ??= new Map();
            globalThis.__orecaFinalOrderCounts.set(key, (globalThis.__orecaFinalOrderCounts.get(key) ?? 0) + 1);
          }
          if (!isFinalTurn) {
            const nextCanonical = allyReelCanonicalByTurn[turnIndex + 1];
            liveSc.reels = (liveSc.reels ?? []).map((reel, i) => nextCanonical?.[i]?.get(reel ?? 0) ?? (reel ?? 0));
            if (turnIndex + 1 === turns.length - 1) {
              liveSc.enemyReel = finalTurnBossReelCanonical(liveSc.runtime, presetId, liveSc.enemyReel ?? 0);
            } else if (bossReelCanonicalByTurn && !Object.keys(liveSc.runtime?.enemy?.commandOverrides ?? {}).length && !(liveSc.runtime?.enemy?.disabledCommands?.length)) {
              liveSc.enemyReel = bossReelCanonicalByTurn[turnIndex + 1]?.get(liveSc.enemyReel ?? 0) ?? (liveSc.enemyReel ?? 0);
            }
          }
            if (String(state.enemy?.presetId ?? '') === 'old5_kujeska' && turnIndex + 1 === turns.length - 1) liveSc.companionReels = (liveSc.companionReels ?? []).map(()=>0);
          turnBoundaryLive.push(liveSc);
        }
        finished.push(...turnBoundaryLive);
      }
    }
    // 離脱済みのお供はターン境界で配列から除き、召喚→自爆を繰り返すBOSSの履歴差だけによる枝爆発を防ぐ。
    scenarios = mergeScenarios(finished.map(sc => compactInactiveCompanionsAtTurnBoundary(sc, !isFinalTurn)));
    if (presetId === 'old5_kujeska') scenarios = mergeKujeskaFenrirMarginals(scenarios);
    if (typeof process !== 'undefined' && process?.env?.ORECA_DEBUG_STATES === '1') {
      const runtimeKeys = new Set(scenarios.map(sc => stringifyRuntimeForMerge(sc.runtime)));
      const hpSignatures = new Set(scenarios.map(sc => [...sc.hpDist].map(([h,p]) => `${h}:${p}`).join(';')));
      const hpSupports = new Set(scenarios.map(sc => [...sc.hpDist.keys()].join(',')));
      const hpNormalized = new Set(scenarios.map(sc => {
        const m = distributionMass(sc.hpDist) || 1;
        return [...sc.hpDist].map(([h,p]) => `${h}:${(p/m).toPrecision(12)}`).join(';');
      }));
      const reelKeys = new Set(scenarios.map(sc => JSON.stringify([sc.reels,sc.enemyReel,sc.companionReels])));
      const propGroups = new Map();
      let strictPropMiss = 0;
      for (const sc of scenarios) {
        const rk = stringifyRuntimeForMerge(sc.runtime) + '|' + [...sc.hpDist.keys()].join(',');
        const prior = propGroups.get(rk);
        if (!prior) { propGroups.set(rk, sc.hpDist); continue; }
        const ai = prior.entries(), bi = sc.hpDist.entries();
        const a0 = ai.next().value, b0 = bi.next().value;
        const factor = (a0 && b0 && a0[1] !== 0) ? b0[1] / a0[1] : 1;
        let ok = Boolean(a0 && b0 && a0[0] === b0[0]);
        if (ok && b0[1] !== a0[1] * factor) ok = false;
        while (ok) {
          const a=ai.next(), b=bi.next();
          if (a.done || b.done) { ok = a.done && b.done; break; }
          if (a.value[0] !== b.value[0] || b.value[1] !== a.value[1] * factor) { ok=false; break; }
        }
        if (!ok) strictPropMiss++;
      }
      console.error('STATE_DEBUG', {turn:turnIndex+1, scenarios:scenarios.length, runtimes:runtimeKeys.size, hpSigs:hpSignatures.size, hpSupports:hpSupports.size, hpNormalized:hpNormalized.size, reels:reelKeys.size, propGroups:propGroups.size, strictPropMiss});
    }
    if (presetId === 'old5_kujeska' && typeof process !== 'undefined' && process?.env?.ORECA_DEBUG_KUJESKA === '1') {
      const uniq = fn => new Set(scenarios.map(fn));
      const summary = {
        turn:turnIndex+1, n:scenarios.length,
        allyReels:uniq(sc => JSON.stringify(sc.reels)).size,
        enemyReels:[...uniq(sc => String(sc.enemyReel ?? 0))].sort(),
        companionReels:uniq(sc => JSON.stringify(sc.companionReels ?? [])).size,
        companionReelVals:[...uniq(sc => JSON.stringify(sc.companionReels ?? []))].slice(0,30),
        enemyEx:[...uniq(sc => String(sc.runtime?.enemy?.exGauge ?? 0))].sort((a,b)=>Number(a)-Number(b)),
        playerEx:[...uniq(sc => String(sc.runtime?.playerExGauge ?? 0))].sort((a,b)=>Number(a)-Number(b)),
        allyStatuses:uniq(sc => JSON.stringify((sc.runtime?.allies ?? []).map(a=>a.statuses ?? {}))).size,
        allyStatusVals:[...uniq(sc => JSON.stringify((sc.runtime?.allies ?? []).map(a=>a.statuses ?? {})))].slice(0,40),
        companionNames:uniq(sc => JSON.stringify((sc.runtime?.companions ?? []).map(c=>c.name))).size,
        companionNameVals:[...uniq(sc => JSON.stringify((sc.runtime?.companions ?? []).map(c=>c.name)))].slice(0,40),
        companionStates:uniq(sc => JSON.stringify((sc.runtime?.companions ?? []).map(c=>[c.name,c.active,c.statuses,c.sleepBlessing,c.deathSeq,c.revivable,c.startReel]))).size,
        fenrirDists:uniq(sc => JSON.stringify((sc.runtime?.companions ?? []).filter(c=>c?.name==='フェンリル').map(c=>c.fenrirStateDist ?? null))).size,
        fenrirDistVals:[...uniq(sc => JSON.stringify((sc.runtime?.companions ?? []).filter(c=>c?.name==='フェンリル').map(c=>c.fenrirStateDist ?? null)))].slice(0,60),
        deferredParalysis:uniq(sc => JSON.stringify((sc.runtime?.allies ?? []).map(a=>a.deferredParalysisChance ?? 0))).size,
        deferredParalysisVals:[...uniq(sc => JSON.stringify((sc.runtime?.allies ?? []).map(a=>a.deferredParalysisChance ?? 0)))].slice(0,60),
        deferredConfusion:uniq(sc => JSON.stringify(sc.runtime?.deferredConfusionEvents ?? [])).size,
        deferredConfusionVals:[...uniq(sc => JSON.stringify(sc.runtime?.deferredConfusionEvents ?? []))].slice(0,30),
        enemyMods:uniq(sc => JSON.stringify([sc.runtime?.enemy?.attackMods,sc.runtime?.enemy?.speedMods,sc.runtime?.enemy?.defenseMods,sc.runtime?.enemy?.deathSerial])).size,
        enemyModVals:[...uniq(sc => JSON.stringify([sc.runtime?.enemy?.attackMods,sc.runtime?.enemy?.speedMods,sc.runtime?.enemy?.defenseMods,sc.runtime?.enemy?.deathSerial]))].slice(0,40),
        companionStateVals:[...uniq(sc => JSON.stringify((sc.runtime?.companions ?? []).map(c=>[c.name,c.active,c.statuses,c.sleepBlessing,c.deathSeq,c.revivable,c.startReel,c.attackMods,c.speedMods])))].slice(0,40),
        allyMods:uniq(sc => JSON.stringify((sc.runtime?.allies ?? []).map(a=>[a.attackMods,a.speedMods,a.actionsTaken,a.activeProgressiveDecay]))).size,
        lastHit:uniq(sc => JSON.stringify(sc.runtime?.lastAllyAttackHitSlots ?? [])).size,
        hpEntriesTotal:scenarios.reduce((n,sc)=>n+(sc.hpDist?.size??0),0),
        hpEntriesMax:Math.max(0,...scenarios.map(sc=>sc.hpDist?.size??0)),
        hpUniqueValues:(()=>{ const z=new Set(); for (const sc of scenarios) for (const hp of sc.hpDist?.keys?.() ?? []) z.add(hp); return z.size; })()
      };
      console.error('KUJESKA_DEBUG', summary);
    }
    const combined = combinedHpDistribution(scenarios);
    const sampleRuntime = scenarios[0]?.runtime ?? initialRuntime;
    const range = battleHpRange(sampleRuntime, combined);
    const turnEndLabel = isFinalTurn && String(state?.finalTurnCutoff ?? 'lastAlly') !== 'turnEnd'
      ? `T${turnIndex + 1} ${finalTurnCutoffLabel(state)}`
      : `T${turnIndex + 1}終了`;
    timeline.push({ turn: turnIndex + 1, label: turnEndLabel, kind: 'turn', killChance: Math.max(0, Math.min(1, terminalSuccessMass + battleKillChance(sampleRuntime, combined))), minLiveHp: range.min, maxLiveHp: range.max });
    statusSummaryByTurn.push(scenarioStatusSummary(scenarios, allyCount));
    scenarioCountByTurn.push(scenarios.length);
    if (typeof process !== 'undefined' && process?.env?.ORECA_DEBUG_FINAL_ORDER === '1' && turnIndex + 1 === turns.length - 1 && globalThis.__orecaFinalOrderCounts) {
      console.error('FINAL_ORDER_DEBUG', [...globalThis.__orecaFinalOrderCounts.entries()]);
    }
    if (typeof process !== 'undefined' && process?.env?.ORECA_DEBUG_TURN_TIME === '1') {
      const __now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      console.error('TURN_TIME', turnIndex + 1, __now - __turnStart);
    }
    if (isFinalTurn) break;
    if (typeof process !== 'undefined' && Number(process?.env?.ORECA_DEBUG_STOP_AFTER_TURN ?? 0) === turnIndex + 1) break;
  }

  if (typeof process !== 'undefined' && process?.env?.ORECA_DEBUG_CACHE === '1') console.error('CACHE_DEBUG', {hits:ACTIVE_CACHE_HITS, misses:ACTIVE_CACHE_MISSES, size:ACTIVE_ALLY_ACTION_CACHE?.size ?? 0, smallHits:SMALL_CACHE_HITS, smallMisses:SMALL_CACHE_MISSES, smallByAction:Object.fromEntries(SMALL_CACHE_BY_ACTION)});
  const hpDistribution = combinedHpDistribution(scenarios);
  // 成功枝は内部では早期終端しているため、公開結果には撃破時の0HPキーで成功質量を戻す。
  addDistribution(hpDistribution, terminalSuccessHpDist);
  const hasEnabledEnemyAction = turns.some(t => t?.enemyAction?.enabled !== false);
  const bossPresetForResult = BOSS_PRESET_BY_ID.get(state.enemy?.presetId ?? '');
  // 同一BOSS複数体（マシュまろ等）はcompanions表示が遭遇データ上の同名個体でも、
  // 実ランタイムではmultiBossCountで管理するため、お供プロファイル警告の対象外。
  const presetCompanions = Math.max(1, Number(bossPresetForResult?.enemyCount ?? 1) || 1) > 1
    ? []
    : (bossPresetForResult?.companions ?? []);
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
    killChance: Math.max(0, Math.min(1, terminalSuccessMass + battleKillChance(scenarios[0]?.runtime ?? initialRuntime, combinedHpDistribution(scenarios)))),
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
    enemyExAllowance,
    playerExGaugeDistribution,
    enemyExGaugeDistribution,
    finalTurnCutoffLabel: finalTurnCutoffLabel(state)
  };
}


function stableCacheValue(value) {
  if (Array.isArray(value)) return value.map(stableCacheValue);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const key of Object.keys(value).sort()) out[key] = stableCacheValue(value[key]);
  return out;
}

function old5ActionCacheProjection(raw) {
  const a = ensureAction(raw, 'ally');
  return [
    a.kind, a.skillPresetId, a.skillMultiplier, a.skillMultiplierMin, a.skillMultiplierMax, a.skillMultiplierStep,
    a.attackAttribute, a.attackAttribute2, a.attackType, a.hits, a.hitsMin, a.hitsMax,
    a.undeadSkillMultiplier, a.poisonedSkillMultiplier, a.deadlyPoisonSkillMultiplier,
    a.weakDefenderAttribute, a.weakSkillMultiplier, stableCacheValue(a.raceSkillMultipliers),
    a.damageFormula, a.selfDestruct, a.enemyTarget, a.enemyTargetSlot,
    stableCacheValue(a.buff), stableCacheValue(a.effects), a.skillName, a.presetTarget,
    a.fixedCharacterSkill, a.playerExRequired, a.playerExSpend,
    String(raw?.confusionSkillPresetId ?? '')
  ];
}

function old5EnemyActionCacheProjection(raw) {
  const action = raw ?? {};
  const effect = action.effect ?? {};
  return [
    action.enabled !== false,
    String(effect.type ?? 'none'), String(effect.target ?? 'all'), String(effect.mode ?? 'mult'),
    String(effect.value ?? '20'), String(effect.duration ?? '1'),
    String(effect.activationChance ?? ''), String(effect.chance ?? ''), String(effect.attackType ?? ''),
    stableCacheValue(effect.attackTypes ?? [])
  ];
}

function old5StandardCacheSignature(state) {
  const allyCount = Math.max(0, Math.min(3, Number(state?.allyCount ?? 0) || 0));
  const enemy = state?.enemy ?? {};
  const presetId = String(enemy.presetId ?? '');
  const profileAttack = Number(enemyBossProfile(presetId)?.attack ?? 0) || 0;
  const configuredAttack = Number(enemy.attack ?? 0) || 0;
  // BOSSプリセット選択時は attack=0/空欄でも実計算側が profile.attack を使う。
  // 事前計算キャッシュの署名も「画面上の生値」ではなく実効ATKに揃える。
  const effectiveAttack = configuredAttack > 0 ? configuredAttack : profileAttack;
  return JSON.stringify([
    [presetId, Boolean(enemy.bossOnlyVictory), String(enemy.maxHp ?? ''),
      String(enemy.attribute ?? ''), String(enemy.race ?? ''), String(effectiveAttack), String(enemy.speed ?? '')],
    allyCount,
    String(state?.finalTurnCutoff ?? 'lastAlly'),
    Array.from({ length: allyCount }, (_, i) => {
      const ally = state?.allies?.[i] ?? {};
      return [String(ally.characterId ?? ''), String(ally.attack ?? ''), String(ally.speed ?? ''),
        String(ally.star ?? ''), String(ally.attribute ?? ''), String(ally.race ?? 'normal'), String(ally.commandVariant ?? '')];
    }),
    (Array.isArray(state?.turns) ? state.turns : []).map(turn => [
      Array.from({ length: allyCount }, (_, i) => old5ActionCacheProjection(turn?.allyActions?.[i])),
      old5EnemyActionCacheProjection(turn?.enemyAction)
    ])
  ]);
}

function old5PresetAction(id, enemyTargetSlot = 'auto') {
  const preset = SKILL_PRESET_BY_ID.get(id);
  if (!preset) throw new Error(`旧5章標準キャッシュ用技プリセットが見つかりません: ${id}`);
  return { ...preset, skillPresetId:id, enemyTargetSlot };
}

function old5StandardState(presetId, allies, actionRows, finalTurnCutoff = 'lastAlly', enemyAttack = '0') {
  const state = cloneDefaultState();
  const preset = BOSS_PRESET_BY_ID.get(presetId);
  if (!preset) throw new Error(`旧5章標準キャッシュ用BOSSプリセットが見つかりません: ${presetId}`);
  state.enemy = {
    ...state.enemy,
    presetId:preset.id, bossOnlyVictory:false, maxHp:String(preset.hp), attribute:preset.attribute,
    race:preset.race, attack:String(enemyAttack), speed:String(preset.speed)
  };
  state.allyCount = 3;
  state.allies = allies;
  state.turns = actionRows.map(ids => ({
    allyActions: ids.map(([id, slot]) => old5PresetAction(id, slot)),
    enemyAction:{ enabled:true, effect:{ type:'skip', mode:'mult', value:'0', duration:'1' } }
  }));
  state.finalTurnCutoff = finalTurnCutoff;
  return state;
}

const OLD5_STANDARD_CACHE_SIGNATURES = (() => {
  const char = (characterId, attack, speed, star, attribute, commandVariant = '') => ({
    characterId, attack:String(attack), speed:String(speed), star:String(star), attribute, race:'normal', commandVariant
  });
  const frost = old5StandardState('old5_frost_dragon', [
    char('son_goku',84,78,4,'wind','stop3'), char('gyumao',94,15,4,'fire','stop2'), char('mimitoshishi',42,63,1,'water','mixed')
  ], [
    [['loki_brand','0'],['oni_spirit','0'],['attack_bang','1']],
    [['oni_spirit','0'],['ninja_fire','0'],['attack_bang','1']],
    [['red_point_2','0'],['ninja_fire','0'],['attack_bang','1']]
  ], 'lastAlly', '65');
  const kujeska = old5StandardState('old5_kujeska', [
    char('son_goku',84,78,4,'wind','forward4'), char('mermaid_mellow',68,73,3,'water'), char('captain_azul',63,42,3,'water')
  ], [
    [['growl','0'],['bubble_grand','1'],['shibire_giri','1']],
    [['loki_brand','0'],['bubble_grand','1'],['shibire_giri','1']],
    [['red_point_2','0'],['bubble_grand','1'],['shibire_giri','1']],
    [['venom_salamanda','0'],['bubble_grand','1'],['shibire_giri','1']]
  ], 'ally1', '50');
  return new Map([
    [old5StandardCacheSignature(frost), 'old5_frost_dragon'],
    [old5StandardCacheSignature(kujeska), 'old5_kujeska']
  ]);
})();

function old5PrecomputedResultFor(state) {
  if (state?.enemy?.manualActions === true) return null;
  if (typeof process !== 'undefined' && process?.env?.ORECA_DISABLE_PRECOMPUTED === '1') return null;
  const presetId = String(state?.enemy?.presetId ?? '');
  if (presetId !== 'old5_frost_dragon' && presetId !== 'old5_kujeska') return null;
  const cacheId = OLD5_STANDARD_CACHE_SIGNATURES.get(old5StandardCacheSignature(state));
  if (!cacheId) return null;
  return reviveOld5PrecomputedResult(OLD5_PRECOMPUTED_RESULTS[cacheId]);
}

export function simulateKillProbability(state) {
  const precomputed = old5PrecomputedResultFor(state);
  if (precomputed) return precomputed;
  return hasAnyActivationModel(state) ? simulateKillProbabilityWithActivation(state) : simulateKillProbabilityLegacy(state);
}

function validateEnemyOffPublicState(state) {
  // v0.5.87: 複数BOSSの毒/猛毒は個体別に追跡し、対象個体の状態に応じた威力変化と
  // 毒→猛毒変化も対象slot単位で処理できるため、旧版のfail-closed制限は不要。
  return state;
}

// Public manual-enemy mode: BOSS command roulette is disabled, but the per-turn
// manual enemy effect entered by the user is executed at the BOSS action opportunity.
// Fixed companions do not auto-roll commands in this mode; their action opportunities
// remain for poison/deadly-poison ticks and shared enemy-EX timing.
export function simulateKillProbabilityEnemyManual(state) {
  const safeState = JSON.parse(JSON.stringify(state ?? {}));
  safeState.enemy ??= {};
  safeState.enemy.manualActions = true;
  safeState.turns = Array.isArray(safeState.turns) ? safeState.turns : [];
  const allowedManualTypes = new Set([...ENEMY_EFFECT_TYPES.map(([type]) => type), 'same']);
  for (const turn of safeState.turns) {
    turn.enemyAction ??= { enabled: false, effect: { type: 'none' } };
    if (turn.enemyAction.enabled == null) turn.enemyAction.enabled = false;
    turn.enemyAction.effect ??= { type: 'none' };
    if (!allowedManualTypes.has(String(turn.enemyAction.effect.type ?? 'none'))) {
      turn.enemyAction.effect = { type:'none' };
    }
  }
  return simulateKillProbability(safeState);
}

// Public GitHub mode: enemy command execution is hard-disabled regardless of saved/UI state.
// Enemy/companion action opportunities remain in the order so poison/deadly-poison ticks
// and final-turn cutoffs keep the same timing as the full simulator.
export function simulateKillProbabilityEnemyOff(state) {
  const safeState = JSON.parse(JSON.stringify(state ?? {}));
  safeState.turns = Array.isArray(safeState.turns) ? safeState.turns : [];
  for (const turn of safeState.turns) {
    turn.enemyAction ??= { effect: { type: 'none' } };
    turn.enemyAction.enabled = false;
  }
  validateEnemyOffPublicState(safeState);
  return simulateKillProbability(safeState);
}
