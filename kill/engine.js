import { activationTransitionsFor } from './commands.js';
import { SKILL_PRESET_BY_ID } from './presets.js';
// 撃破確率シミュレータ v0.4.12
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
  ['normal', '通常'], ['undead', 'アンデッド']
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
  ['weaknessBuff', '弱点属性強化']
]);

export const ENEMY_EFFECT_TYPES = Object.freeze([
  ['none', '効果なし'],
  ['allyAtkDebuff', '攻撃デバフ'],
  ['allySpeedDebuff', '素早さデバフ'],
  ['enemyAtkBuff', '敵の攻撃アップ'],
  ['enemyDefenseBuff', '敵の防御アップ'],
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
    damageFormula: '',
    buff: defaultAllyBuff(),
    effects: []
  };
}

function defaultSkipAction() {
  return {
    kind: 'skip', skillMultiplier: '200', skillMultiplierMin: '', skillMultiplierMax: '', skillMultiplierStep: '',
    attackAttribute: 'none', attackAttribute2: 'none', attackType: 'physical', hits: '1', hitsMin: '', hitsMax: '',
    undeadSkillMultiplier: '', poisonedSkillMultiplier: '', deadlyPoisonSkillMultiplier: '', weakDefenderAttribute: '', weakSkillMultiplier: '', damageFormula: '', buff: defaultAllyBuff(), effects: []
  };
}

export const DEFAULT_STATE = Object.freeze({
  enemy: { maxHp: '1500', attribute: 'fire', race: 'normal', speed: '45' },
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
    { characterId: 'son_goku', attack: '84', speed: '78', star: '4', attribute: 'wind', commandVariant: '' },
    { characterId: 'gyumao', attack: '94', speed: '15', star: '4', attribute: 'fire', commandVariant: '' },
    { characterId: '', attack: '0', speed: '0', star: '', attribute: '', commandVariant: '' }
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

function mapHpDistribution(hpDist, mapper) {
  const out = new Map();
  for (const [hp, probability] of hpDist) {
    if (hp <= 0) {
      out.set(0, (out.get(0) ?? 0) + probability);
      continue;
    }
    const nextHp = Math.max(0, trunc0(mapper(hp)));
    out.set(nextHp, (out.get(nextHp) ?? 0) + probability);
  }
  return out;
}

function applyAttackToHp(hpDist, damageDist) {
  const out = new Map();
  for (const [hp, hpProb] of hpDist) {
    if (hp <= 0) {
      out.set(0, (out.get(0) ?? 0) + hpProb);
      continue;
    }
    for (const [damage, damageProb] of damageDist) {
      const nextHp = Math.max(0, hp - damage);
      out.set(nextHp, (out.get(nextHp) ?? 0) + hpProb * damageProb);
    }
  }
  return out;
}

function killChance(hpDist) {
  return Math.max(0, Math.min(1, hpDist.get(0) ?? 0));
}

function hpRange(hpDist) {
  const live = [...hpDist.keys()].filter(hp => hp > 0);
  if (!live.length) return { min: 0, max: 0 };
  return { min: Math.min(...live), max: Math.max(...live) };
}

function normalizeTarget(effect, actorIndex, runtime) {
  const target = effect.target ?? 'self';
  const allyCount = runtime.allyCount;
  if (Array.isArray(target)) {
    return [...new Set(target.flatMap(item => normalizeTarget({ target: item }, actorIndex, runtime)))];
  }
  if (target === 'all') return Array.from({ length: allyCount }, (_, i) => i);
  if (target === 'self') return [actorIndex];
  if (target === 'others') return Array.from({ length: allyCount }, (_, i) => i).filter(i => i !== actorIndex);
  if (target === 'star4') return runtime.allies.map((ally, i) => Number(ally.star) === 4 ? i : -1).filter(i => i >= 0);
  if (target === 'fireAllies') return runtime.allies.map((ally, i) => ally.attribute === 'fire' ? i : -1).filter(i => i >= 0);
  const m = /^ally(\d)$/.exec(target);
  if (m) {
    const i = Number(m[1]) - 1;
    return i >= 0 && i < allyCount ? [i] : [];
  }
  return [];
}

function effectDirection(type) {
  // +1: 数値が上がる（攻撃/速度アップ、敵の防御ダウン=被ダメ増）
  // -1: 数値が下がる（デバフ、敵の防御アップ=被ダメ減）
  return ['allyAtkDebuff', 'allySpeedDebuff', 'speedDown', 'enemyDefenseBuff'].includes(type) ? -1 : 1;
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

function addTimedFlag(list, effect, seq) {
  const duration = Math.max(1, parseIntValue(effect.duration ?? '1', '継続ターン', { min: 1, max: 99 }));
  list.push({ remaining: duration, seq, justApplied: true });
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
  }
  runtime.enemy.speedMods = dec(runtime.enemy.speedMods);
  runtime.enemy.attackMods = dec(runtime.enemy.attackMods);
  runtime.enemy.defenseMods = dec(runtime.enemy.defenseMods);
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
      runtime.enemy.poison = 'poison';
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
    case 'enemySpeedBuff':
      addTimedMod(runtime.enemy.speedMods, effect, runtime.seq);
      return hpDist;
    case 'enemyAtkBuff':
      addTimedMod(runtime.enemy.attackMods, effect, runtime.seq);
      return hpDist;
    case 'enemyDefenseBuff':
      addTimedMod(runtime.enemy.defenseMods, effect, runtime.seq);
      return hpDist;
    case 'heal': {
      const value = parseNumber(effect.value ?? '0', '回復量', { min: 0 });
      const mode = effect.mode ?? 'flat';
      const amount = mode === 'maxPercent' ? trunc0(runtime.maxHp * value / 100) : trunc0(value);
      return mapHpDistribution(hpDist, hp => Math.min(runtime.maxHp, hp + amount));
    }
    default:
      return hpDist;
  }
}

function applyPoison(runtime, hpDist) {
  if (runtime.enemy.poison === 'poison') {
    return mapHpDistribution(hpDist, hp => hp - Math.floor(hp * 0.10));
  }
  if (runtime.enemy.poison === 'deadlyPoison') {
    return mapHpDistribution(hpDist, hp => hp - Math.floor(hp * 0.20));
  }
  return hpDist;
}

function actorOrder(runtime) {
  const actors = [];
  for (let i = 0; i < runtime.allyCount; i++) {
    actors.push({
      side: 'ally',
      index: i,
      speed: applyMods(runtime.allies[i].baseSpeed, runtime.allies[i].speedMods, { clampMin: 0 })
    });
  }
  actors.push({
    side: 'enemy',
    index: -1,
    speed: applyMods(runtime.enemy.baseSpeed, runtime.enemy.speedMods, { clampMin: 0 })
  });

  actors.sort((a, b) => {
    if (a.speed !== b.speed) return b.speed - a.speed;
    if (a.side !== b.side) return a.side === 'ally' ? -1 : 1;
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
    damageFormula: action?.damageFormula ?? '',
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
      actionsTaken: 0
    })),
    enemy: {
      baseSpeed: enemyBaseSpeed,
      speedMods: [],
      attackMods: [],
      defenseMods: [],
      poison: 'none',
      race: state.enemy?.race === 'undead' ? 'undead' : 'normal'
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
          if (runtime.enemy.race === 'undead' && action.undeadSkillMultiplier !== '') skillMultiplier = action.undeadSkillMultiplier;
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
            defenseMods: runtime.enemy.defenseMods,
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
          const labelMap = {
            none: '効果なし', allyAtkDebuff: '攻撃デバフ', allySpeedDebuff: '素早さデバフ',
            enemyAtkBuff: '敵の攻撃アップ', enemyDefenseBuff: '敵の防御アップ',
            enemySpeedBuff: '敵の素早さアップ', heal: '回復'
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

function addDistribution(into, from) {
  for (const [hp, p] of from) into.set(hp, (into.get(hp) ?? 0) + p);
}

function runtimeScenarioKey(runtime, reels) {
  return JSON.stringify({ runtime, reels });
}

function mergeScenarios(scenarios) {
  const byKey = new Map();
  for (const sc of scenarios) {
    const key = runtimeScenarioKey(sc.runtime, sc.reels);
    const existing = byKey.get(key);
    if (existing) addDistribution(existing.hpDist, sc.hpDist);
    else byKey.set(key, { runtime: sc.runtime, reels: sc.reels.slice(), hpDist: new Map(sc.hpDist), order: sc.order });
  }
  return [...byKey.values()];
}

function combinedHpDistribution(scenarios) {
  const out = new Map();
  for (const sc of scenarios) addDistribution(out, sc.hpDist);
  return out;
}

function applyActivatedAllyAction(runtime, hpDist, action, actorIndex, state) {
  let nextHp = hpDist;
  if (action.kind === 'attack') {
    const attack = applyMods(runtime.allies[actorIndex].baseAttack, runtime.allies[actorIndex].attackMods, { clampMin: 1, clampMax: 999 });
    let skillMultiplier = action.skillMultiplier;
    if (action.weakDefenderAttribute && action.weakSkillMultiplier !== '' && state.enemy?.attribute === action.weakDefenderAttribute) skillMultiplier = action.weakSkillMultiplier;
    if (runtime.enemy.race === 'undead' && action.undeadSkillMultiplier !== '') skillMultiplier = action.undeadSkillMultiplier;
    if (runtime.enemy.poison !== 'none' && action.poisonedSkillMultiplier !== '') skillMultiplier = action.poisonedSkillMultiplier;
    if (runtime.enemy.poison === 'deadlyPoison' && action.deadlyPoisonSkillMultiplier !== '') skillMultiplier = action.deadlyPoisonSkillMultiplier;
    const speed = applyMods(runtime.allies[actorIndex].baseSpeed, runtime.allies[actorIndex].speedMods, { clampMin: 0, clampMax: 999 });
    const damageDist = attackDamageDistribution({
      attack, speed, skillMultiplier, damageFormula: action.damageFormula,
      skillMultiplierMin: action.skillMultiplierMin, skillMultiplierMax: action.skillMultiplierMax, skillMultiplierStep: action.skillMultiplierStep,
      attackAttribute: action.attackAttribute, attackAttribute2: action.attackAttribute2, attackType: action.attackType,
      defenderAttribute: state.enemy?.attribute ?? 'none', defenderRace: runtime.enemy.race,
      defenseMods: runtime.enemy.defenseMods, weaknessBoost: runtime.allies[actorIndex].weaknessMods.length > 0,
      hits: action.hits, hitsMin: action.hitsMin, hitsMax: action.hitsMax
    });
    nextHp = applyAttackToHp(nextHp, damageDist);
  } else if (action.kind === 'buff') {
    allyEffect(runtime, action.buff, actorIndex);
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

  if (action.kind !== 'skip') {
    for (const effect of action.effects ?? []) allyEffect(runtime, effect, actorIndex);
  }
  return nextHp;
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
  if (!runtime.pendingReelBoosts?.length) return;
  for (const b of runtime.pendingReelBoosts) reels[b.index] = Math.max(0, Math.min(3, (reels[b.index] ?? 0) + b.amount));
  runtime.pendingReelBoosts = [];
}

function hasAnyActivationModel(state) {
  const turns = Array.isArray(state.turns) ? state.turns : [];
  for (let i = 0; i < Number(state.allyCount ?? 0); i++) {
    const characterId = state.allies?.[i]?.characterId;
    if (!characterId) continue;
    for (let t = 0; t < turns.length; t++) {
      const { action } = resolveAction(turns, t, 'ally', i);
      if (action.skillPresetId && action.kind !== 'skip') return true;
    }
  }
  return false;
}

function makeInitialRuntime(state, maxHp, allyCount, enemyBaseSpeed) {
  return {
    maxHp, allyCount, seq: 0,
    allies: Array.from({ length: allyCount }, (_, i) => ({
      baseAttack: parseNumber(state.allies?.[i]?.attack, `キャラ${i + 1}の攻撃力`, { min: 0 }),
      baseSpeed: parseNumber(state.allies?.[i]?.speed, `キャラ${i + 1}の素早さ`, { min: 0 }),
      star: state.allies?.[i]?.star ?? '', attribute: state.allies?.[i]?.attribute ?? '',
      attackMods: [], speedMods: [], weaknessMods: [], actionsTaken: 0
    })),
    enemy: { baseSpeed: enemyBaseSpeed, speedMods: [], attackMods: [], defenseMods: [], poison: 'none', race: state.enemy?.race === 'undead' ? 'undead' : 'normal' },
    pendingReelBoosts: []
  };
}

function simulateKillProbabilityWithActivation(state) {
  const maxHp = parseIntValue(state.enemy?.maxHp, '敵HP', { min: 1, max: 9999999 });
  const enemyBaseSpeed = parseNumber(state.enemy?.speed, '敵の素早さ', { min: 0 });
  const allyCount = parseIntValue(state.allyCount, '味方人数', { min: 1, max: 3 });
  const turns = Array.isArray(state.turns) && state.turns.length ? state.turns : [];
  if (!turns.length) throw new Error('ターンを1つ以上設定してください');

  let scenarios = [{ runtime: makeInitialRuntime(state, maxHp, allyCount, enemyBaseSpeed), reels: Array(allyCount).fill(0), hpDist: new Map([[maxHp, 1]]) }];
  const timeline = [];
  const missing = new Set();
  let firstFinalOrder = [];

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
            expireSourceLinkedMods(runtime, actor.index, 'start');
            const { action } = resolveAction(turns, turnIndex, 'ally', actor.index);
            const characterId = state.allies?.[actor.index]?.characterId ?? '';
            const transitions = activationTransitionsFor({ characterId, skillPresetId: action.skillPresetId, skillName: action.skillName, startReel: sc.reels[actor.index] ?? 0, commandVariant: state.allies?.[actor.index]?.commandVariant ?? '' });
            if (!transitions && characterId && action.skillPresetId) missing.add(`${characterId}:${action.skillName}`);
            const branches = transitions ?? [{ nextReel: sc.reels[actor.index] ?? 0, activated: true, probability: 1 }];

            for (const tr of branches) {
              if (tr.probability <= 0) continue;
              const rt = cloneRuntimeState(runtime);
              const reels = sc.reels.slice();
              reels[actor.index] = tr.nextReel;
              let hp = scaleDistribution(sc.hpDist, tr.probability);
              if (tr.activated) hp = applyActivatedAllyAction(rt, hp, action, actor.index, state);
              rt.allies[actor.index].actionsTaken += 1;
              expireSourceLinkedMods(rt, actor.index, 'end');
              applyPendingReelBoosts(rt, reels);
              next.push({ runtime: rt, reels, hpDist: hp, order });
            }
          } else {
            const rt = cloneRuntimeState(runtime);
            let hp = new Map(sc.hpDist);
            const rawEnemyAction = turn.enemyAction ?? { enabled: false, effect: { type: 'none' } };
            let effect = rawEnemyAction.effect ?? { type: 'none' };
            if (effect.type === 'same') {
              for (let i = turnIndex - 1; i >= 0; i--) {
                const prev = turns[i]?.enemyAction?.effect;
                if (prev && prev.type !== 'same') { effect = prev; break; }
              }
              if (effect.type === 'same') effect = { type: 'none' };
            }
            if (rawEnemyAction.enabled !== false) hp = enemyEffect(rt, effect, hp);
            hp = applyPoison(rt, hp);
            next.push({ runtime: rt, reels: sc.reels.slice(), hpDist: hp, order });
          }
        }
        active = mergeScenarios(next);
        if (isFinalTurn && pos === lastAllyPosition) {
          finished.push(...active);
          active = [];
          break;
        }
      }
      if (active.length) {
        for (const sc of active) decrementTimedEffects(sc.runtime);
        finished.push(...active);
      }
    }
    scenarios = mergeScenarios(finished);
    const combined = combinedHpDistribution(scenarios);
    const range = hpRange(combined);
    timeline.push({ turn: turnIndex + 1, label: `T${turnIndex + 1}終了`, kind: 'turn', killChance: killChance(combined), minLiveHp: range.min, maxLiveHp: range.max });
    if (isFinalTurn) break;
  }

  const hpDistribution = combinedHpDistribution(scenarios);
  return { killChance: killChance(hpDistribution), hpDistribution, timeline, finalTurn: turns.length, finalOrder: firstFinalOrder, missingCommandProfiles: [...missing] };
}

export function simulateKillProbability(state) {
  return hasAnyActivationModel(state) ? simulateKillProbabilityWithActivation(state) : simulateKillProbabilityLegacy(state);
}
