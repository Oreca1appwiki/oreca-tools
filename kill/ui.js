import { APP_VERSION } from '../assets/version.js';
import {
  ALLY_EFFECT_TYPES,
  ATTACK_ATTRIBUTES,
  ATTACK_TYPE_OPTIONS,
  ENEMY_ATTRIBUTE_OPTIONS,
  ENEMY_RACE_OPTIONS,
  ENEMY_EFFECT_TYPES,
  cloneDefaultState,
  simulateKillProbability
} from './engine.js';
import {
  SKILL_PRESETS,
  SKILL_PRESET_BY_ID,
  caminekoPresetForEnemy,
  darkBahamutPresetForEnemy,
  presetIdForSkillName
} from './presets.js';

const STORAGE_KEY = 'oreca-tools.kill.v0.4.12';
const DIRECT_STORAGE_KEYS = ['oreca-tools.kill.v0.4.11', 'oreca-tools.kill.v0.4.10', 'oreca-tools.kill.v0.4.9'];
// v0.4.5～v0.4.8 は攻撃力バフの乗算値を「増加量」で保存（50 = ×1.5）。
// v0.4.9 からはダメージ計算と同じく最終倍率を直接保存（150 = ×1.5）。
const AMOUNT_STORAGE_KEYS = ['oreca-tools.kill.v0.4.8', 'oreca-tools.kill.v0.4.7', 'oreca-tools.kill.v0.4.6', 'oreca-tools.kill.v0.4.5'];
const LEGACY_STORAGE_KEYS = ['oreca-tools.kill.v0.4.4', 'oreca-tools.kill.v0.4.3', 'oreca-tools.kill.v0.4.2', 'oreca-tools.kill.v0.4.1', 'oreca-tools.kill.v0.4.0'];
const root = document.getElementById('killRoot');
const resetButton = document.getElementById('resetButton');

for (const el of document.querySelectorAll('[data-app-version]')) el.textContent = APP_VERSION;

const ALLY_BUFF_TYPES = Object.freeze([['atkBuff', '攻撃力'], ['speedBuff', '素早さ']]);
const ENEMY_BUFF_TYPES = Object.freeze([['enemyAtkBuff', '攻撃力'], ['enemySpeedBuff', '素早さ']]);
const MONSTER_ATTRIBUTE_OPTIONS = Object.freeze([['', '選択してください'], ['fire', '火'], ['water', '水'], ['earth', '土'], ['wind', '風']]);

const CHARACTER_PRESETS = Object.freeze([
  { id: '', name: '選択なし', group: 'none', skill: '', attack: '0', speed: '0' },
  { id: 'son_goku', name: '斉天大聖ソンゴクウ', group: 'general', skill: 'ロキブランド', attack: '84', speed: '78', star: '4', attribute: 'wind', kind: 'buff' },
  { id: 'gyumao', name: '牛魔王', group: 'general', skill: '鬼の気合入れ', attack: '94', speed: '15', star: '4', attribute: 'fire', kind: 'buff' },
  { id: 'sylph', name: 'シルフ', group: 'general', skill: 'こうげき！', attack: '31', speed: '42', star: '1', attribute: 'wind', kind: 'attack' },
  { id: 'crow', name: 'カラス', group: 'general', skill: 'こうげき！', attack: '31', speed: '63', star: '1', attribute: 'wind', kind: 'attack' },
  { id: 'platinum_drake', name: 'プラチナドレイク', group: 'general', skill: '竜のしっぽ', attack: '78', speed: '78', star: '4', attribute: 'earth', kind: 'attack' },
  { id: 'clear_blue_dragon', name: 'クリア・ブルードラゴン', group: 'general', skill: 'アクアブレス', attack: '73', speed: '68', star: '4', attribute: 'water', kind: 'attack' },
  { id: 'bahamut', name: '天界竜バハムート', group: 'general', skill: 'シャイニングブレス', attack: '89', speed: '73', star: '4', attribute: 'earth', kind: 'attack' },
  { id: 'mimitoshishi', name: 'ミミトシシ', group: 'general', skill: 'こうげき！', attack: '42', speed: '63', star: '1', attribute: 'water', kind: 'attack' },
  { id: 'dark_bahamut', name: '冥界竜ダークバハムート', group: 'general', skill: 'ブレス系統（敵属性で選択）', attack: '89', speed: '73', star: '4', attribute: 'earth', kind: 'attack' },
  { id: 'magora', name: 'マゴラ', group: 'general', skill: 'さけぶ', attack: '36', speed: '57', star: '1', attribute: 'wind', kind: 'buff' },
  { id: 'kerogon_green', name: 'ケロゴン(緑)', group: 'general', skill: '竜のしっぽ', attack: '31', speed: '52', star: '1', attribute: 'wind', kind: 'attack' },
  { id: 'oniwaka_monk', name: '僧兵オニワカ', group: 'general', skill: '足ばらい', attack: '63', speed: '47', star: '3', attribute: 'wind', kind: 'attack' },
  { id: 'oniwaka', name: 'オニワカ', group: 'general', skill: '足ばらい', attack: '57', speed: '42', star: '2', attribute: 'wind', kind: 'attack' },
  { id: 'red_empress', name: '赤のエンプレス', group: 'general', skill: '行動スキップ', attack: '63', speed: '84', star: '4', attribute: 'water', kind: 'skip' },
  { id: 'raijin_kukulkan', name: '雷神竜ククルカン', group: 'general', skill: 'つつきまくり', attack: '78', speed: '89', star: '4', attribute: 'wind', kind: 'attack' },
  { id: 'venom_behemoth', name: '猛毒竜ベヒモス', group: 'general', skill: 'おしつぶし', attack: '73', speed: '15', star: '4', attribute: 'earth', kind: 'attack' },
  { id: 'heavy_behemoth', name: '重竜ベヒモス', group: 'general', skill: 'おしつぶし', attack: '63', speed: '10', star: '4', attribute: 'earth', kind: 'attack' },
  { id: 'kerogon_yellow', name: 'ケロゴン(黄)', group: 'general', skill: '竜のしっぽ', attack: '31', speed: '21', star: '1', attribute: 'earth', kind: 'attack' },
  { id: 'guardian_powan', name: '魔海の守護者ポワン', group: 'both', skill: 'シャボン・グラン', attack: '73', speed: '73', star: '4', attribute: 'water', kind: 'attack' },
  { id: 'kerogon_blue', name: 'ケロゴン(青)', group: 'general', skill: '竜のしっぽ', attack: '31', speed: '42', star: '1', attribute: 'water', kind: 'attack' },
  { id: 'dartan', name: '無幻銃士ダルタン', group: 'general', skill: '連撃', attack: '78', speed: '36', star: '4', attribute: 'earth', kind: 'attack' },
  { id: 'kerogon_gold', name: 'ケロゴン(金)', group: 'general', skill: '竜のしっぽ', attack: '36', speed: '10', star: '1', attribute: 'fire', kind: 'attack' },
  { id: 'camineko', name: 'キャミネコ', group: 'general', skill: 'ファイア！／アイス！／サンダー！（敵属性で選択）', attack: '42', speed: '68', star: '1', attribute: 'wind', kind: 'attack' },
  { id: 'garanezumi', name: 'ガラネズミ', group: 'general', skill: 'こうげき！', attack: '31', speed: '73', star: '1', attribute: 'earth', kind: 'attack' },
  { id: 'black_knight_gebolg', name: '黒騎士ゲボルグ', group: 'general', skill: 'ヒートウェイブ', attack: '74', speed: '31', star: '3', attribute: 'fire', kind: 'attack' },
  { id: 'rakshasa', name: 'ラクシャーサ', group: 'general', skill: 'ヒートウェイブ', attack: '53', speed: '21', star: '2', attribute: 'earth', kind: 'attack' },
  { id: 'scarlet_dragon', name: 'スカーレッド・ドラゴン', group: 'general', skill: '竜のしっぽ', attack: '89', speed: '47', star: '4', attribute: 'fire', kind: 'attack' },
  { id: 'kenran_kukulkan', name: '絢蘭竜ククルカン', group: 'general', skill: 'つつきまくり', attack: '78', speed: '89', star: '4', attribute: 'wind', kind: 'attack' },
  { id: 'shinjuryu_kukulkan', name: '神樹竜ククルカン', group: 'general', skill: 'つつきまくり', attack: '78', speed: '84', star: '4', attribute: 'wind', kind: 'attack' },
  { id: 'ifrit', name: '大魔神イフリート', group: 'general', skill: 'ファイア‼︎', attack: '84', speed: '42', star: '4', attribute: 'fire', kind: 'attack' },
  { id: 'astaroth', name: '魔公爵アスタロト', group: 'general', skill: 'メテオ！', attack: '68', speed: '31', star: '4', attribute: 'fire', kind: 'attack' },
  { id: 'loki', name: 'ロキ', group: 'general', skill: 'ロキブランド', attack: '63', speed: '68', star: '4', attribute: 'earth', kind: 'buff' },
  { id: 'toritamago', name: '魔王のトリタマゴ', group: 'condition', skill: 'こうげき！', attack: '1', speed: '1', star: '1', attribute: 'fire', kind: 'attack' },
  { id: 'ares', name: '熱剣士アレス', group: 'condition', skill: 'こうげき！', attack: '73', speed: '21', star: '3', attribute: 'fire', kind: 'attack' },
  { id: 'chibimuus', name: 'チビムウス', group: 'condition', skill: 'こうげき！', attack: '45', speed: '15', star: '2', attribute: 'fire', kind: 'attack' },
  { id: 'lafroig', name: '魔皇ラフロイグ', group: 'condition', skill: 'こうげき！', attack: '94', speed: '57', star: '4', attribute: 'fire', kind: 'attack' },
  { id: 'mermaid_mellow', name: 'マーメイドメロウ', group: 'condition', skill: 'こうげき！', attack: '68', speed: '73', star: '3', attribute: 'water', kind: 'attack' },
  { id: 'captain_azul', name: 'キャプテン・アズール', group: 'condition', skill: 'シビレ斬り', attack: '63', speed: '42', star: '3', attribute: 'water', kind: 'attack' },
  { id: 'elysion', name: '光王エーリュシオン', group: 'condition', skill: '行動スキップ', attack: '78', speed: '52', star: '4', attribute: 'earth', kind: 'skip', secondSkill: '浄化の炎', secondKind: 'attack' },
  { id: 'hien', name: '剣豪ヒエン', group: 'condition', skill: '紫電', attack: '63', speed: '78', star: '3', attribute: 'wind', kind: 'attack' },
  { id: 'marduk', name: '王子マルドク', group: 'condition', skill: '会心の一撃', attack: '79', speed: '95', star: '4', attribute: 'wind', kind: 'attack' },
  { id: 'enki', name: '老将エンキ', group: 'condition', skill: '会心の一撃', attack: '78', speed: '57', star: '4', attribute: 'wind', kind: 'attack' },
  { id: 'damkina', name: 'ダムキナ', group: 'condition', skill: 'ウィンド‼︎', attack: '68', speed: '89', star: '4', attribute: 'wind', kind: 'attack' },
  { id: 'saezer', name: '棘騎士サエザー', group: 'condition', skill: 'こうげき！', attack: '68', speed: '52', star: '3', attribute: 'water', kind: 'attack' },
  { id: 'dante_magic_swordsman', name: '魔剣士ダンテ', group: 'condition', skill: 'こうげき！', attack: '68', speed: '31', star: '3', attribute: 'fire', kind: 'attack' },
  { id: 'simon', name: 'シモン', group: 'condition', skill: 'こうげき！', attack: '68', speed: '47', star: '3', attribute: 'fire', kind: 'attack' },
  { id: 'hayate', name: '風隠の戦士ハヤテ', group: 'condition', skill: 'こうげき！', attack: '57', speed: '84', star: '3', attribute: 'wind', kind: 'attack' },
  { id: 'sky_clay', name: '天空騎士クレイ', group: 'condition', skill: 'こうげき！', attack: '73', speed: '73', star: '4', attribute: 'earth', kind: 'attack' },
  { id: 'djinn', name: '大魔神ジン', group: 'condition', skill: 'ウィンド‼︎', attack: '63', speed: '84', star: '4', attribute: 'wind', kind: 'attack' },
  { id: 'gate_dante', name: '魔界の門番ダンテ', group: 'condition', skill: 'こうげき！', attack: '78', speed: '36', star: '4', attribute: 'fire', kind: 'attack' },
  { id: 'yamato', name: 'ヤマト', group: 'condition', skill: 'こうげき！', attack: '78', speed: '78', star: '4', attribute: 'fire', kind: 'attack' },
  { id: 'susanoo', name: 'スサノヲ', group: 'condition', skill: 'こうげき！', attack: '73', speed: '78', star: '4', attribute: 'fire', kind: 'attack' },
  { id: 'nanawarai', name: '魔王ナナワライ', group: 'condition', skill: 'こうげき！', attack: '84', speed: '63', star: '4', attribute: 'wind', kind: 'attack' },
  { id: 'ginger_ale', name: '魔王ジンジャーエイル', group: 'condition', skill: 'こうげき！', attack: '84', speed: '52', star: '4', attribute: 'fire', kind: 'attack' },
  { id: 'soccerra', name: '邪神サッカーラ', group: 'condition', skill: 'こうげき！', attack: '92', speed: '26', star: '4', attribute: 'earth', kind: 'attack' },
  { id: 'fire_drake', name: '煌竜王ファイアドレイク', group: 'condition', skill: 'こうげき！', attack: '84', speed: '47', star: '4', attribute: 'fire', kind: 'attack' }
]);

// Wiki「バトル入手チャート」2ページでの採用・登場頻度を基準にした表示順。
// 同系統のキャラは近接配置し、同程度のものは従来順を尊重する。
const CHARACTER_USAGE_ORDER = Object.freeze([
  'son_goku','gyumao','loki','kerogon_green','camineko','magora','guardian_powan','dark_bahamut',
  'oniwaka_monk','clear_blue_dragon','dartan','kerogon_yellow','kerogon_blue','kerogon_gold',
  'raijin_kukulkan','kenran_kukulkan','shinjuryu_kukulkan','venom_behemoth','heavy_behemoth',
  'red_empress','oniwaka','platinum_drake','scarlet_dragon','sylph','crow','garanezumi','ifrit',
  'black_knight_gebolg','rakshasa','bahamut','mimitoshishi','astaroth',
  // 条件枠
  'captain_azul','toritamago','elysion','hien','fire_drake','nanawarai','ginger_ale','lafroig',
  'ares','chibimuus','mermaid_mellow','marduk','enki','damkina','saezer','dante_magic_swordsman',
  'simon','hayate','sky_clay','djinn','gate_dante','yamato','susanoo','soccerra'
]);
const CHARACTER_USAGE_RANK = new Map(CHARACTER_USAGE_ORDER.map((id, i) => [id, i]));

// 技もカテゴリ内で使用頻度順。忍法・ポイント・属性ブレス等の同系統は連続配置する。
const SKILL_USAGE_ORDER = Object.freeze([
  // バフ・強化
  'loki_brand','oni_spirit','spirit_blessing','sea_king_gaze','growl','sun_hymn','name_announcement','sword_dance','suck_dry','item_parts',
  // 攻撃
  'crush',
  'ninja_fire','ninja_water','ninja_wind',
  'red_point_2','blue_point_2','yellow_point_2','green_point_2',
  'peck_many','self_destruct',
  'fire2','fire3','aqua2','aqua3','wind2',
  'wet_slicer',
  'red_fire_breath','blue_aqua_breath','yellow_earth_breath','green_air_breath',
  'rock_throw','dark_fire','venom_salamanda','bubble_grand','rengeki','roaring_lightning',
  'fire_torture','water_torture','tatsumaki','kamaitachi','rain_god_spear','marking_arrow','paralysis_arrow',
  'poison_crush','deadly_blow','ikazuchi','fire_ice_breath2','shout','headwind','heat_wave','ice_storm_strike',
  'poison_bite','melting_breath','windmill',
  // その他（モンスタープリセット由来の技を優先）
  'attack_bang','dragon_tail','foot_sweep','shibire_giri',
  'aqua_breath','shining_breath','fire1','ice1','thunder1','meteor',
  'purifying_flame','shiden','critical_hit','epidemic_glass'
]);
const SKILL_USAGE_RANK = new Map(SKILL_USAGE_ORDER.map((id, i) => [id, i]));

function sortByUsage(items, rankMap) {
  return [...items].sort((a, b) => (rankMap.get(a.id) ?? 9999) - (rankMap.get(b.id) ?? 9999));
}

const CHARACTER_BY_ID = new Map(CHARACTER_PRESETS.map(x => [x.id, x]));

function defaultCharacterStats() {
  return Object.fromEntries(
    CHARACTER_PRESETS
      .filter(x => x.id && x.attack !== undefined && x.speed !== undefined)
      .map(x => [x.id, { attack: x.attack, speed: x.speed }])
  );
}

function statusForCharacter(state, characterId) {
  const preset = CHARACTER_BY_ID.get(characterId);
  const saved = state.characterStats?.[characterId] ?? {};
  return {
    attack: preset?.attack ?? saved.attack ?? '',
    speed: preset?.speed ?? saved.speed ?? '',
    star: preset?.star ?? saved.star ?? '',
    attribute: preset?.attribute ?? saved.attribute ?? ''
  };
}

function defaultPrimaryBuff(side = 'ally') {
  return side === 'enemy'
    ? { type: 'enemyAtkBuff', mode: 'mult', value: '150', duration: '1' }
    : { type: 'atkBuff', target: 'self', mode: 'mult', value: '150', duration: '1' };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

const EFFECT_AMOUNT_TYPES = new Set([
  'atkBuff', 'speedBuff', 'defenseDown', 'speedDown',
  'allyAtkDebuff', 'allySpeedDebuff', 'enemyAtkBuff', 'enemyDefenseBuff', 'enemySpeedBuff'
]);

function migrateLegacyEffectAmount(effect) {
  if (!effect || typeof effect !== 'object' || !EFFECT_AMOUNT_TYPES.has(effect.type)) return effect;
  const next = { ...effect };
  const n = Number(next.value);
  if (Number.isFinite(n)) {
    next.value = String(next.mode === 'add' ? Math.abs(n) : Math.abs(n - 100));
  }
  return next;
}

function migrateLegacyActionAmounts(action) {
  if (!action || typeof action !== 'object') return action;
  const next = { ...action };
  if (next.buff) next.buff = migrateLegacyEffectAmount(next.buff);
  if (Array.isArray(next.effects)) next.effects = next.effects.map(migrateLegacyEffectAmount);
  return next;
}

function migrateAttackBuffNotation(effect) {
  if (!effect || typeof effect !== 'object') return effect;
  if (!['atkBuff', 'enemyAtkBuff'].includes(effect.type) || effect.mode === 'add') return effect;
  const next = { ...effect };
  const n = Number(next.value);
  if (Number.isFinite(n)) next.value = String(100 + n);
  return next;
}

function migrateActionAttackBuffNotation(action) {
  if (!action || typeof action !== 'object') return action;
  const next = { ...action };
  if (next.buff) next.buff = migrateAttackBuffNotation(next.buff);
  if (Array.isArray(next.effects)) next.effects = next.effects.map(migrateAttackBuffNotation);
  return next;
}

function normalizeState(saved, legacyAmounts = false, attackBuffAmountNotation = false) {
  const fallback = cloneDefaultState();
  if (!saved || typeof saved !== 'object') return fallback;

  const state = { ...fallback, ...saved };
  state.enemy = { ...fallback.enemy, ...(saved.enemy ?? {}) };
  state.characterStats = { ...defaultCharacterStats(), ...(saved.characterStats ?? {}) };
  state.allyCount = Math.min(3, Math.max(1, Number(saved.allyCount) || fallback.allyCount));
  state.allies = fallback.allies.map((ally, i) => ({ ...ally, ...(saved.allies?.[i] ?? {}), characterId: saved.allies?.[i]?.characterId ?? ally.characterId ?? '' }));
  state.allies.forEach(ally => {
    if (!ally.characterId) {
      ally.star ??= '';
      ally.attribute ??= '';
      return;
    }
    const status = statusForCharacter(state, ally.characterId);
    ally.attack = status.attack || '0';
    ally.speed = status.speed || '0';
    ally.star = status.star || '';
    ally.attribute = status.attribute || '';
  });
  state.turns = Array.isArray(saved.turns) && saved.turns.length ? saved.turns.slice(0, 12) : fallback.turns;

  const allowedEnemyAttrs = new Set(ENEMY_ATTRIBUTE_OPTIONS.map(([value]) => value));
  if (!allowedEnemyAttrs.has(state.enemy.attribute)) state.enemy.attribute = 'fire';
  const allowedEnemyRaces = new Set(ENEMY_RACE_OPTIONS.map(([value]) => value));
  if (!allowedEnemyRaces.has(state.enemy.race)) state.enemy.race = 'normal';

  for (const turn of state.turns) {
    turn.allyActions = Array.from({ length: 3 }, (_, i) => {
      const originalRaw = turn.allyActions?.[i] ?? {};
      const amountNormalizedRaw = legacyAmounts ? migrateLegacyActionAmounts(originalRaw) : originalRaw;
      const raw = attackBuffAmountNotation ? migrateActionAttackBuffNotation(amountNormalizedRaw) : amountNormalizedRaw;
      const legacyPresetMap = {
        red_point_0: 'red_point_2', red_point_1: 'red_point_2',
        blue_point_0: 'blue_point_2', blue_point_1: 'blue_point_2',
        yellow_point_0: 'yellow_point_2', yellow_point_1: 'yellow_point_2',
        green_point_0: 'green_point_2', green_point_1: 'green_point_2',
        dark_bahamut_breath: darkBahamutPresetForEnemy(state.enemy.attribute)
      };
      const rawPresetId = raw.skillPresetId ?? presetIdForSkillName(raw.skillName ?? '');
      const presetId = legacyPresetMap[rawPresetId] ?? rawPresetId;
      const normalized = {
        kind: raw.kind ?? 'skip',
        skillPresetId: presetId,
        skillMultiplier: raw.skillMultiplier ?? '200',
        skillMultiplierMin: raw.skillMultiplierMin ?? '',
        skillMultiplierMax: raw.skillMultiplierMax ?? '',
        skillMultiplierStep: raw.skillMultiplierStep ?? '',
        attackAttribute: raw.attackAttribute ?? 'none',
        attackAttribute2: raw.attackAttribute2 ?? 'none',
        attackType: raw.attackType ?? 'physical',
        hits: raw.hits ?? '1',
        hitsMin: raw.hitsMin ?? '',
        hitsMax: raw.hitsMax ?? '',
        undeadSkillMultiplier: raw.undeadSkillMultiplier ?? '',
        poisonedSkillMultiplier: raw.poisonedSkillMultiplier ?? '',
        deadlyPoisonSkillMultiplier: raw.deadlyPoisonSkillMultiplier ?? '',
        weakDefenderAttribute: raw.weakDefenderAttribute ?? '',
        weakSkillMultiplier: raw.weakSkillMultiplier ?? '',
        damageFormula: raw.damageFormula ?? '',
        buff: { ...defaultPrimaryBuff('ally'), ...(raw.buff ?? {}) },
        effects: Array.isArray(raw.effects) ? raw.effects : [],
        skillName: raw.skillName ?? ''
      };
      // v0.4.2以前にはskillPresetIdが無かったため、既知技は一度だけプリセット値へ移行する。
      if ((raw.skillPresetId === undefined || rawPresetId !== presetId) && presetId) applySkillPresetToAction(normalized, presetId);
      return normalized;
    });
    const legacyEnemyEffect = Array.isArray(turn.enemyAction?.effects) && turn.enemyAction.effects.length
      ? turn.enemyAction.effects[0]
      : turn.enemyAction?.kind === 'buff' ? turn.enemyAction?.buff : null;
    const amountNormalizedEnemyEffect = legacyAmounts
      ? migrateLegacyEffectAmount(turn.enemyAction?.effect ?? legacyEnemyEffect)
      : (turn.enemyAction?.effect ?? legacyEnemyEffect);
    const migratedEnemyEffect = attackBuffAmountNotation
      ? migrateAttackBuffNotation(amountNormalizedEnemyEffect)
      : amountNormalizedEnemyEffect;
    turn.enemyAction = {
      enabled: turn.enemyAction?.enabled !== false,
      effect: { type: 'none', target: 'all', mode: 'mult', value: '20', duration: '1', ...(migratedEnemyEffect ?? {}) }
    };
  }
  return state;
}

function loadState() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return normalizeState(JSON.parse(current), false, false);
    for (const key of DIRECT_STORAGE_KEYS) {
      const previous = localStorage.getItem(key);
      if (previous) return normalizeState(JSON.parse(previous), false, false);
    }
    for (const key of AMOUNT_STORAGE_KEYS) {
      const previous = localStorage.getItem(key);
      if (previous) return normalizeState(JSON.parse(previous), false, true);
    }
    for (const key of LEGACY_STORAGE_KEYS) {
      const legacy = localStorage.getItem(key);
      if (legacy) return normalizeState(JSON.parse(legacy), true, true);
    }
    return normalizeState(cloneDefaultState());
  } catch {
    return normalizeState(cloneDefaultState());
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function optionsHtml(items, selected) {
  return items.map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('');
}

function optionsLabel(items, selected) {
  return items.find(([value]) => value === selected)?.[1] ?? '';
}

function characterOptionsHtml(selected) {
  const general = sortByUsage(CHARACTER_PRESETS.filter(x => x.id && (x.group === 'general' || x.group === 'both')), CHARACTER_USAGE_RANK);
  const condition = sortByUsage(CHARACTER_PRESETS.filter(x => x.id && (x.group === 'condition' || x.group === 'both')), CHARACTER_USAGE_RANK);
  const render = items => items.map(x => `<option value="${escapeHtml(x.id)}" ${x.id === selected ? 'selected' : ''}>${escapeHtml(x.name)}</option>`).join('');
  return `<option value="" ${!selected ? 'selected' : ''}>選択なし</option><optgroup label="汎用">${render(general)}</optgroup><optgroup label="条件">${render(condition)}</optgroup>`;
}

const SKIP_ACTION_PRESET = '__skip_action__';

function skillPresetOptionsHtml(selected) {
  const major = SKILL_PRESETS.filter(x => x.selectable !== false && x.major === true);
  const buffs = sortByUsage(major.filter(x => x.majorGroup === 'buff'), SKILL_USAGE_RANK);
  const attacks = sortByUsage(major.filter(x => x.majorGroup === 'attack'), SKILL_USAGE_RANK);
  const others = sortByUsage(major.filter(x => x.majorGroup === 'other'), SKILL_USAGE_RANK);
  const render = items => items.map(x => `<option value="${escapeHtml(x.id)}" ${x.id === selected ? 'selected' : ''}>${escapeHtml(x.name)}</option>`).join('');
  return `<option value="" ${!selected ? 'selected' : ''}>手動入力</option><option value="${SKIP_ACTION_PRESET}" ${selected === SKIP_ACTION_PRESET ? 'selected' : ''}>行動スキップ</option><optgroup label="バフ・強化技">${render(buffs)}</optgroup><optgroup label="攻撃技">${render(attacks)}</optgroup><optgroup label="その他">${render(others)}</optgroup>`;
}

function resetAttackPresetFields(action) {
  action.skillMultiplier = '100';
  action.skillMultiplierMin = '';
  action.skillMultiplierMax = '';
  action.skillMultiplierStep = '';
  action.attackAttribute = 'none';
  action.attackAttribute2 = 'none';
  action.attackType = 'physical';
  action.hits = '1';
  action.hitsMin = '';
  action.hitsMax = '';
  action.undeadSkillMultiplier = '';
  action.poisonedSkillMultiplier = '';
  action.deadlyPoisonSkillMultiplier = '';
  action.weakDefenderAttribute = '';
  action.weakSkillMultiplier = '';
  action.damageFormula = '';
}

function applySkillPresetToAction(action, presetId) {
  action.skillPresetId = presetId || '';
  if (presetId === SKIP_ACTION_PRESET) {
    action.kind = 'skip';
    action.skillName = '行動スキップ';
    action.effects = [];
    action.presetNote = '';
    return;
  }
  const skill = SKILL_PRESET_BY_ID.get(presetId);
  if (!skill) {
    if (!presetId) action.damageFormula = '';
    return;
  }

  action.kind = skill.kind;
  action.skillName = skill.skillName;
  action.effects = deepClone(skill.effects ?? []);
  action.presetNote = skill.note ?? '';
  resetAttackPresetFields(action);

  if (skill.kind === 'attack') {
    action.skillMultiplier = skill.skillMultiplier ?? '100';
    action.skillMultiplierMin = skill.skillMultiplierMin ?? '';
    action.skillMultiplierMax = skill.skillMultiplierMax ?? '';
    action.skillMultiplierStep = skill.skillMultiplierStep ?? '';
    action.attackAttribute = skill.attackAttribute ?? 'none';
    action.attackAttribute2 = skill.attackAttribute2 ?? 'none';
    action.attackType = skill.attackType ?? 'physical';
    action.hits = skill.hits ?? '1';
    action.hitsMin = skill.hitsMin ?? '';
    action.hitsMax = skill.hitsMax ?? '';
    action.undeadSkillMultiplier = skill.undeadSkillMultiplier ?? '';
    action.poisonedSkillMultiplier = skill.poisonedSkillMultiplier ?? '';
    action.deadlyPoisonSkillMultiplier = skill.deadlyPoisonSkillMultiplier ?? '';
    action.weakDefenderAttribute = skill.weakDefenderAttribute ?? '';
    action.weakSkillMultiplier = skill.weakSkillMultiplier ?? '';
    action.damageFormula = skill.damageFormula ?? '';
  } else if (skill.kind === 'buff') {
    action.buff = deepClone(skill.buff ?? defaultPrimaryBuff('ally'));
  }
}

function presetIdForCharacterSkill(characterId, skillName) {
  if (characterId === 'camineko') return caminekoPresetForEnemy(state.enemy.attribute);
  if (characterId === 'dark_bahamut') return darkBahamutPresetForEnemy(state.enemy.attribute);
  return presetIdForSkillName(skillName);
}

function applyCharacterPreset(allyIndex, characterId) {
  const preset = CHARACTER_BY_ID.get(characterId) ?? CHARACTER_BY_ID.get('');
  const ally = state.allies[allyIndex];
  ally.characterId = characterId;
  const status = statusForCharacter(state, characterId);
  ally.attack = status.attack || '0';
  ally.speed = status.speed || '0';
  ally.star = status.star || '';
  ally.attribute = status.attribute || '';

  state.turns.forEach((turn, turnIndex) => {
    const action = turn.allyActions[allyIndex];
    if (!characterId) {
      action.kind = 'skip'; action.skillName = ''; action.skillPresetId = ''; action.effects = [];
      return;
    }
    if (turnIndex === 0) {
      if (preset.kind === 'skip') {
        applySkillPresetToAction(action, SKIP_ACTION_PRESET);
      } else {
        const presetId = presetIdForCharacterSkill(characterId, preset.skill);
        if (presetId) {
          applySkillPresetToAction(action, presetId);
        } else { action.kind = preset.kind ?? 'attack'; action.skillName = preset.skill; action.skillPresetId = ''; }
      }
    } else if (preset.secondSkill && turnIndex === 1) {
      const presetId = presetIdForCharacterSkill(characterId, preset.secondSkill);
      if (presetId) {
        applySkillPresetToAction(action, presetId);
      } else { action.kind = preset.secondKind ?? 'attack'; action.skillName = preset.secondSkill; action.skillPresetId = ''; }
    } else {
      action.kind = 'same';
      action.skillName = '';
      action.skillPresetId = '';
    }
  });
}

function effectDefault(type, side) {
  if (type === 'poison' || type === 'deadlyPoison' || type === 'poisonToDeadly') return { type };
  if (type === 'weaknessBuff') return { type, target: 'all', duration: '3' };
  if (type === 'heal') return { type, mode: 'flat', value: '200' };
  if (side === 'enemy') {
    if (type === 'allyAtkDebuff' || type === 'allySpeedDebuff') {
      return { type, target: 'all', mode: 'mult', value: '20', duration: '1' };
    }
    if (type === 'enemyDefenseBuff') return { type, mode: 'mult', value: '20', duration: '1' };
    if (type === 'enemyAtkBuff') return { type, mode: 'mult', value: '150', duration: '1' };
    return { type, mode: 'mult', value: '50', duration: '1' };
  }
  if (type === 'defenseDown') return { type, mode: 'mult', value: '20', duration: '1' };
  if (type === 'speedDown') return { type, mode: 'mult', value: '20', duration: '1' };
  if (type === 'atkBuff') return { type, target: 'self', mode: 'mult', value: '150', duration: '1' };
  return { type, target: 'self', mode: 'mult', value: '50', duration: '1' };
}

function resolvedTargetIds(target, actorIndex = 0) {
  if (Array.isArray(target)) return target.filter(x => /^ally[1-3]$/.test(x));
  if (target === 'all') return Array.from({ length: state.allyCount }, (_, i) => `ally${i + 1}`);
  if (target === 'self') return [`ally${actorIndex + 1}`];
  if (target === 'others') return Array.from({ length: state.allyCount }, (_, i) => `ally${i + 1}`).filter(x => x !== `ally${actorIndex + 1}`);
  if (/^ally[1-3]$/.test(target ?? '')) return [target];
  return [];
}

function targetCode(selected, actorIndex = 0) {
  return resolvedTargetIds(selected, actorIndex)
    .map(x => x.replace('ally', ''))
    .sort()
    .join('');
}

function targetFromCode(code) {
  return [...String(code ?? '')]
    .filter(x => /^[1-3]$/.test(x))
    .map(x => `ally${x}`);
}

function targetSelectHtml(selected, actorIndex = 0, className = 'effect-target-select', disabled = false) {
  const choices = state.allyCount <= 1
    ? ['1']
    : state.allyCount === 2
      ? ['1', '2', '12']
      : ['1', '2', '3', '12', '13', '23', '123'];
  const current = targetCode(selected, actorIndex);
  const selectedCode = choices.includes(current) ? current : choices[0];
  return `<select class="${className} target-select" aria-label="対象" ${disabled ? 'disabled' : ''}>
    ${choices.map(code => `<option value="${code}" ${code === selectedCode ? 'selected' : ''}>${[...code].join('/')}</option>`).join('')}
  </select>`;
}

function effectFieldsHtml(effect, side, actorIndex = 0) {
  const type = effect.type;
  if (type === 'poison' || type === 'deadlyPoison') {
    return '<div class="effect-note">後から付与した毒系状態で上書き</div>';
  }
  if (type === 'poisonToDeadly') {
    return '<div class="effect-note">敵が毒なら猛毒に変化</div>';
  }
  if (type === 'weaknessBuff') {
    return `
      ${targetSelectHtml(effect.target ?? 'all', actorIndex)}
      <div class="input-with-suffix compact-input">
        <input class="effect-duration" type="number" inputmode="numeric" step="1" min="1" max="99" value="${escapeHtml(effect.duration ?? '3')}" aria-label="継続ターン" />
        <span class="suffix">ターン</span>
      </div>
      <div class="effect-note">弱点1.5→1.9 / 1.4→1.8</div>`;
  }
  if (type === 'heal') {
    return `
      <select class="effect-mode" aria-label="回復方法">
        <option value="flat" ${effect.mode !== 'maxPercent' ? 'selected' : ''}>固定値</option>
        <option value="maxPercent" ${effect.mode === 'maxPercent' ? 'selected' : ''}>最大HP%</option>
      </select>
      <input class="effect-value" type="number" inputmode="decimal" step="0.1" min="0" value="${escapeHtml(effect.value ?? '200')}" aria-label="回復量" />`;
  }

  const isTargeted = ['atkBuff', 'speedBuff', 'allyAtkDebuff', 'allySpeedDebuff'].includes(type);
  const target = isTargeted
    ? targetSelectHtml(effect.target ?? (side === 'enemy' ? 'all' : 'self'), actorIndex)
    : '';
  const isAttackBuff = type === 'atkBuff' || type === 'enemyAtkBuff';
  const multModeLabel = isAttackBuff ? '乗算' : '割合';
  const addModeLabel = isAttackBuff ? '加算' : '固定値';
  const modeControl = type === 'defenseDown'
    ? ''
    : `<select class="effect-mode" aria-label="補正方式">
        <option value="mult" ${effect.mode !== 'add' ? 'selected' : ''}>${multModeLabel}</option>
        <option value="add" ${effect.mode === 'add' ? 'selected' : ''}>${addModeLabel}</option>
      </select>`;
  const isAdd = type !== 'defenseDown' && effect.mode === 'add';
  const showPlus = isAdd && ['atkBuff', 'speedBuff', 'enemyAtkBuff', 'enemySpeedBuff'].includes(type);
  const valueSuffix = isAdd ? (isAttackBuff ? 'ATK' : '') : '%';

  const expiryLabel = effect.expiry === 'sourceNextActionStart'
    ? '使用者の次の行動開始まで'
    : effect.expiry === 'sourceNextActionEnd' ? '使用者の次の行動終了まで' : '';
  const durationControl = expiryLabel
    ? `<div class="effect-note">${expiryLabel}</div>`
    : `<div class="input-with-suffix compact-input">
        <input class="effect-duration" type="number" inputmode="numeric" step="1" min="1" max="99" value="${escapeHtml(effect.duration ?? '1')}" aria-label="継続ターン" />
        <span class="suffix">ターン</span>
      </div>`;

  return `
    ${target}
    ${modeControl}
    <div class="input-with-suffix compact-input ${showPlus ? 'has-prefix' : ''}">
      ${showPlus ? '<span class="input-prefix">+</span>' : ''}
      <input class="effect-value" type="number" inputmode="decimal" step="0.1" min="0" value="${escapeHtml(effect.value ?? '0')}" aria-label="効果量" />
      ${valueSuffix ? `<span class="suffix">${valueSuffix}</span>` : ''}
    </div>
    ${durationControl}`;
}

function effectsHtml(effects, side, turnIndex, actorKey) {
  const types = side === 'enemy' ? ENEMY_EFFECT_TYPES : ALLY_EFFECT_TYPES;
  if (!effects.length) return '<div class="empty-note compact-empty">追加効果なし</div>';
  return effects.map((effect, effectIndex) => `
    <div class="effect-row" data-turn-index="${turnIndex}" data-actor-key="${actorKey}" data-effect-index="${effectIndex}" data-effect-side="${side}" data-effect-expiry="${escapeHtml(effect.expiry ?? '')}">
      <select class="effect-type" aria-label="追加効果">
        ${optionsHtml(types, effect.type)}
      </select>
      ${effectFieldsHtml(effect, side, actorKey.startsWith('ally') ? Number(actorKey.replace('ally', '')) : 0)}
      <button class="icon-button remove-effect" type="button" aria-label="追加効果を削除">×</button>
    </div>`).join('');
}

function primaryBuffHtml(buff, side, disabled = false, actorIndex = 0) {
  const b = { ...defaultPrimaryBuff(side), ...(buff ?? {}) };
  const types = side === 'enemy' ? ENEMY_BUFF_TYPES : ALLY_BUFF_TYPES;
  const isAdd = b.mode === 'add';
  const isAttackBuff = b.type === 'atkBuff' || b.type === 'enemyAtkBuff';
  const showPlus = isAdd;
  const valueLabel = isAttackBuff ? (isAdd ? '加算値' : '倍率') : '効果量';
  const valueSuffix = isAdd ? (isAttackBuff ? 'ATK' : '') : '%';
  const multModeLabel = isAttackBuff ? '乗算' : '割合';
  const addModeLabel = isAttackBuff ? '加算' : '固定値';
  const target = side === 'ally'
    ? `<label class="mini-field target-field"><span>対象</span>${targetSelectHtml(b.target ?? 'self', actorIndex, 'main-buff-target-select', disabled)}</label>`
    : '';
  return `
    <div class="primary-buff-block">
      <div class="sub-heading"><span>バフ内容</span></div>
      <div class="primary-buff-grid">
        <label class="mini-field"><span>能力</span><select class="main-buff-type" ${disabled ? 'disabled' : ''}>${optionsHtml(types, b.type)}</select></label>
        ${target}
        <label class="mini-field"><span>方式</span><select class="main-buff-mode" ${disabled ? 'disabled' : ''}><option value="mult" ${b.mode !== 'add' ? 'selected' : ''}>${multModeLabel}</option><option value="add" ${b.mode === 'add' ? 'selected' : ''}>${addModeLabel}</option></select></label>
        <label class="mini-field"><span>${valueLabel}</span><div class="input-with-suffix ${showPlus ? 'has-prefix' : ''}">${showPlus ? '<span class="input-prefix">+</span>' : ''}<input class="main-buff-value" type="number" inputmode="decimal" step="0.1" min="0" value="${escapeHtml(b.value ?? (isAttackBuff && !isAdd ? '150' : '50'))}" ${disabled ? 'disabled' : ''}>${valueSuffix ? `<span class="suffix">${valueSuffix}</span>` : ''}</div></label>
        <label class="mini-field"><span>継続</span><div class="input-with-suffix"><input class="main-buff-duration" type="number" inputmode="numeric" min="1" max="99" step="1" value="${escapeHtml(b.duration ?? '1')}" ${disabled ? 'disabled' : ''}><span class="suffix">ターン</span></div></label>
      </div>
    </div>`;
}

function actionKindOptions(action, turnIndex) {
  return `
    <option value="attack" ${action.kind === 'attack' ? 'selected' : ''}>攻撃</option>
    <option value="buff" ${action.kind === 'buff' ? 'selected' : ''}>バフ</option>
    <option value="effect" ${action.kind === 'effect' ? 'selected' : ''}>効果のみ</option>
    ${turnIndex > 0 ? `<option value="same" ${action.kind === 'same' ? 'selected' : ''}>同行動</option>` : ''}
    <option value="skip" ${action.kind === 'skip' ? 'selected' : ''}>行動スキップ</option>`;
}

function actionCardHtml(action, turnIndex, allyIndex) {
  const actorKey = `ally${allyIndex}`;
  const randomMultiplier = action.skillMultiplierMin !== '' && action.skillMultiplierMax !== '';
  const randomHits = action.hitsMin !== '' && action.hitsMax !== '';
  const presetMeta = SKILL_PRESET_BY_ID.get(action.skillPresetId ?? '');
  const presetSelected = Boolean(action.skillPresetId);
  return `
    <div class="action-card" data-turn-index="${turnIndex}" data-actor-key="${actorKey}">
      <div class="action-card-head">
        <strong>キャラ${allyIndex + 1}</strong>
        ${presetSelected
          ? `<span class="preset-kind-label">${escapeHtml(action.kind === 'attack' ? '攻撃' : action.kind === 'buff' ? 'バフ' : action.kind === 'effect' ? '効果のみ' : action.kind === 'skip' ? '行動スキップ' : '同行動')}</span>`
          : `<select class="action-kind" aria-label="キャラ${allyIndex + 1}の基本行動">${actionKindOptions(action, turnIndex)}</select>`}
      </div>
      ${action.kind !== 'same' ? `
        <label class="mini-field"><span>主要技プリセット</span><select class="skill-preset">${skillPresetOptionsHtml(action.skillPresetId ?? '')}</select></label>
        ${presetMeta?.note ? `<p class="inline-note">${escapeHtml(presetMeta.note)}</p>` : ''}${presetSelected ? `<p class="inline-note">プリセット効果を自動適用します。効果内容は編集できません。</p>` : ''}` : ''}
      ${!presetSelected && action.kind === 'attack' ? `
        ${action.damageFormula === 'windmill' ? `<p class="inline-note"><strong>風車式:</strong> 1発=ATK×0.6+SPD×0.15 / ヒット数=max(1, floor(SPD÷20))、最大10回。現在のバフ後ステータスで計算します。</p>` : ''}
        <div class="action-input-grid">
          ${action.damageFormula === 'windmill' ? '' : (randomMultiplier ? `
            <label class="mini-field"><span>技倍率 下限</span><div class="input-with-suffix"><input class="skill-multiplier-min" type="number" inputmode="decimal" step="0.1" min="0" value="${escapeHtml(action.skillMultiplierMin)}"><span class="suffix">%</span></div></label>
            <label class="mini-field"><span>技倍率 上限</span><div class="input-with-suffix"><input class="skill-multiplier-max" type="number" inputmode="decimal" step="0.1" min="0" value="${escapeHtml(action.skillMultiplierMax)}"><span class="suffix">%</span></div></label>
            <label class="mini-field"><span>倍率刻み</span><div class="input-with-suffix"><input class="skill-multiplier-step" type="number" inputmode="decimal" step="0.1" min="0.1" value="${escapeHtml(action.skillMultiplierStep || '0.1')}"><span class="suffix">%</span></div></label>` : `
            <label class="mini-field"><span>技倍率</span><div class="input-with-suffix"><input class="skill-multiplier" type="number" inputmode="decimal" step="0.1" min="0" value="${escapeHtml(action.skillMultiplier)}"><span class="suffix">%</span></div></label>`)}
          <label class="mini-field"><span>技属性</span><select class="attack-attribute">${optionsHtml(ATTACK_ATTRIBUTES, action.attackAttribute)}</select></label>
          <label class="mini-field"><span>第2属性</span><select class="attack-attribute2">${optionsHtml(ATTACK_ATTRIBUTES, action.attackAttribute2 ?? 'none')}</select></label>
          ${state.enemy.race === 'undead' ? `<label class="mini-field"><span>技分類</span><select class="attack-type">${optionsHtml(ATTACK_TYPE_OPTIONS, action.attackType ?? 'physical')}</select></label>` : ''}
          ${action.damageFormula === 'windmill' ? '' : (randomHits ? `
            <label class="mini-field"><span>ヒット数 下限</span><input class="hit-count-min" type="number" inputmode="numeric" step="1" min="1" max="50" value="${escapeHtml(action.hitsMin)}"></label>
            <label class="mini-field"><span>ヒット数 上限</span><input class="hit-count-max" type="number" inputmode="numeric" step="1" min="1" max="50" value="${escapeHtml(action.hitsMax)}"></label>` : `
            <label class="mini-field"><span>ヒット数</span><input class="hit-count" type="number" inputmode="numeric" step="1" min="1" max="50" value="${escapeHtml(action.hits)}"></label>`)}
        </div>` : ''}
      ${!presetSelected && action.kind === 'buff' ? primaryBuffHtml(action.buff, 'ally', false, allyIndex) : ''}
      ${action.kind === 'same' ? '<p class="same-action-note">前回の同モンスターの行動内容をそのまま使用します。</p>' : ''}
      ${!presetSelected && ['attack', 'buff', 'effect'].includes(action.kind) ? `
        <div class="effects-block">
          <div class="sub-heading"><span>追加効果</span><button type="button" class="mini-add add-effect" data-side="ally">＋追加</button></div>
          <div class="effects-list">${effectsHtml(action.effects ?? [], 'ally', turnIndex, actorKey)}</div>
        </div>` : ''}
    </div>`;
}

function enemyEffectFieldsHtml(effect, enabled) {
  const disabled = enabled ? '' : 'disabled';
  if (!effect || effect.type === 'none' || effect.type === 'same') return '';
  if (effect.type === 'heal') {
    return `<div class="enemy-effect-fields">
      <label class="mini-field"><span>回復方法</span><select class="enemy-effect-mode" ${disabled}><option value="flat" ${effect.mode !== 'maxPercent' ? 'selected' : ''}>固定値</option><option value="maxPercent" ${effect.mode === 'maxPercent' ? 'selected' : ''}>最大HP%</option></select></label>
      <label class="mini-field"><span>回復量</span><input class="enemy-effect-value" type="number" inputmode="decimal" step="0.1" min="0" value="${escapeHtml(effect.value ?? '200')}" ${disabled}></label>
    </div>`;
  }
  const targeted = effect.type === 'allyAtkDebuff' || effect.type === 'allySpeedDebuff';
  const isAttackBuff = effect.type === 'enemyAtkBuff';
  const isAdd = effect.mode === 'add';
  const defaultValue = isAttackBuff && !isAdd ? '150' : '20';
  const multModeLabel = isAttackBuff ? '乗算' : '割合';
  const addModeLabel = isAttackBuff ? '加算' : '固定値';
  const valueLabel = isAttackBuff ? (isAdd ? '加算値' : '倍率') : '効果量';
  const valueSuffix = isAdd ? (isAttackBuff ? 'ATK' : '') : '%';
  const showPlus = isAdd && (effect.type === 'enemyAtkBuff' || effect.type === 'enemySpeedBuff');
  return `<div class="enemy-effect-fields">
    ${targeted ? `<label class="mini-field target-field"><span>対象</span>${targetSelectHtml(effect.target ?? 'all', 0, 'enemy-effect-target-select', !enabled)}</label>` : ''}
    <label class="mini-field"><span>方式</span><select class="enemy-effect-mode" ${disabled}><option value="mult" ${!isAdd ? 'selected' : ''}>${multModeLabel}</option><option value="add" ${isAdd ? 'selected' : ''}>${addModeLabel}</option></select></label>
    <label class="mini-field"><span>${valueLabel}</span><div class="input-with-suffix ${showPlus ? 'has-prefix' : ''}">${showPlus ? '<span class="input-prefix">+</span>' : ''}<input class="enemy-effect-value" type="number" inputmode="decimal" step="0.1" min="0" value="${escapeHtml(effect.value ?? defaultValue)}" ${disabled}>${valueSuffix ? `<span class="suffix">${valueSuffix}</span>` : ''}</div></label>
    <label class="mini-field"><span>継続</span><div class="input-with-suffix"><input class="enemy-effect-duration" type="number" inputmode="numeric" min="1" max="99" step="1" value="${escapeHtml(effect.duration ?? '1')}" ${disabled}><span class="suffix">ターン</span></div></label>
  </div>`;
}

function enemyActionHtml(action, turnIndex) {
  const effect = action.effect ?? { type: 'none' };
  const choices = turnIndex > 0 ? [...ENEMY_EFFECT_TYPES, ['same', '同行動']] : ENEMY_EFFECT_TYPES;
  return `
    <div class="action-card enemy-action-card" data-turn-index="${turnIndex}" data-actor-key="enemy">
      <div class="action-card-head enemy-head">
        <strong>敵</strong>
        <label class="toggle-line"><input class="enemy-enabled" type="checkbox" ${action.enabled ? 'checked' : ''}> このターン行動する</label>
      </div>
      <div class="enemy-action-body ${action.enabled ? '' : 'is-disabled'}">
        <label class="mini-field"><span>敵行動効果</span>
          <select class="enemy-effect-type" ${action.enabled ? '' : 'disabled'}>${optionsHtml(choices, effect.type)}</select>
        </label>
        ${enemyEffectFieldsHtml(effect, action.enabled)}
      </div>
      <p class="inline-note poison-note">敵行動OFFでも、この敵の行動タイミングで毒・猛毒ダメージは発生します。</p>
    </div>`;
}

function turnHtml(turn, turnIndex) {
  return `
    <section class="panel turn-panel" data-turn-panel="${turnIndex}">
      <div class="section-heading turn-heading">
        <div><h2>ターン${turnIndex + 1}</h2><p>ターン開始時の素早さで行動順を決定します。</p></div>
        <div class="turn-actions">
          <button type="button" class="mini-add duplicate-turn">複製</button>
          ${state.turns.length > 1 ? '<button type="button" class="mini-danger remove-turn">削除</button>' : ''}
        </div>
      </div>
      <div class="turn-action-list">
        ${Array.from({ length: state.allyCount }, (_, i) => actionCardHtml(turn.allyActions[i], turnIndex, i)).join('')}
        ${enemyActionHtml(turn.enemyAction, turnIndex)}
      </div>
    </section>`;
}

function resultHtml(result, error = '') {
  if (error) {
    return `
      <section class="result-panel kill-result has-error" id="killResultPanel">
        <div class="result-card kill-result-main"><span class="result-label">撃破確率</span><strong class="result-number">—</strong></div>
        <div class="result-meta"><span class="error-text">${escapeHtml(error)}</span></div>
      </section>`;
  }
  const pct = result.killChance * 100;
  const pctText = pct > 0 && pct < 0.01 ? '<0.01%' : `${pct.toFixed(2)}%`;
  const verdict = pct >= 100 - 1e-10 ? '確定撃破' : pct <= 1e-12 ? '撃破不可' : '確率撃破';
  const finalOrder = result.finalOrder.map(a => a.side === 'enemy' ? `敵(${a.speed})` : `キャラ${a.index + 1}(${a.speed})`).join(' → ');
  return `
    <section class="result-panel kill-result" id="killResultPanel">
      <div class="result-card kill-result-main">
        <span class="result-label">撃破確率</span>
        <strong class="result-number">${pctText}</strong>
      </div>
      <div class="result-card kill-verdict-card">
        <span class="result-label">判定</span>
        <strong class="kill-verdict">${verdict}</strong>
      </div>
      <div class="result-meta">最終ターン行動順: ${escapeHtml(finalOrder)}</div>
    </section>`;
}

function timelineHtml(result) {
  if (!result) return '';
  return `
    <details class="panel details-panel">
      <summary>計算経過</summary>
      <div class="timeline-list">
        ${result.timeline.map(item => {
          const p = item.killChance * 100;
          const live = item.minLiveHp === 0 && item.maxLiveHp === 0 ? '生存分岐なし' : `生存HP ${item.minLiveHp}～${item.maxLiveHp}`;
          return `<div class="timeline-row"><span>T${item.turn} ${escapeHtml(item.label)}</span><strong>${p.toFixed(2)}%</strong><small>${live}</small></div>`;
        }).join('')}
      </div>
    </details>`;
}

function calculate() {
  try {
    return { result: simulateKillProbability(state), error: '' };
  } catch (e) {
    return { result: null, error: e.message };
  }
}

function render() {
  const { result, error } = calculate();
  root.innerHTML = `
    ${resultHtml(result, error)}

    <section class="panel">
      <h2>敵</h2>
      <div class="field-grid">
        <label class="field"><span class="field-label">HP</span><input id="enemyHp" type="number" inputmode="numeric" min="1" step="1" value="${escapeHtml(state.enemy.maxHp)}"></label>
        <label class="field"><span class="field-label">属性</span><select id="enemyAttribute">${optionsHtml(ENEMY_ATTRIBUTE_OPTIONS, state.enemy.attribute)}</select></label>
        <label class="field"><span class="field-label">種族</span><select id="enemyRace">${optionsHtml(ENEMY_RACE_OPTIONS, state.enemy.race)}</select></label>
        <label class="field"><span class="field-label">素早さ</span><input id="enemySpeed" type="number" inputmode="decimal" min="0" step="0.1" value="${escapeHtml(state.enemy.speed)}"></label>
      </div>
    </section>

    <section class="panel">
      <div class="section-heading">
        <div><h2>味方</h2><p>1～3体。素早さ同値ならキャラ番号が小さい順、敵と同値なら味方が先です。</p></div>
        <label class="count-select">人数 <select id="allyCount"><option value="1" ${state.allyCount === 1 ? 'selected' : ''}>1</option><option value="2" ${state.allyCount === 2 ? 'selected' : ''}>2</option><option value="3" ${state.allyCount === 3 ? 'selected' : ''}>3</option></select></label>
      </div>
      <div class="ally-grid">
        ${Array.from({ length: state.allyCount }, (_, i) => `
          <div class="ally-card" data-ally-index="${i}">
            <strong>キャラ${i + 1}</strong>
            <label class="mini-field"><span>モンスター</span><select class="ally-character">${characterOptionsHtml(state.allies[i].characterId ?? '')}</select></label>
            ${state.allies[i].characterId ? `
              <div class="preset-status-summary">
                <span>攻撃 ${escapeHtml(state.allies[i].attack)}</span>
                <span>素早さ ${escapeHtml(state.allies[i].speed)}</span>
                <span>★${escapeHtml(state.allies[i].star)}</span>
                <span>${escapeHtml(optionsLabel(MONSTER_ATTRIBUTE_OPTIONS, state.allies[i].attribute))}属性</span>
              </div>` : `
              <label class="mini-field"><span>攻撃力</span><input class="ally-attack" type="number" inputmode="decimal" min="0" step="0.1" value="${escapeHtml(state.allies[i].attack)}"></label>
              <label class="mini-field"><span>素早さ</span><input class="ally-speed" type="number" inputmode="decimal" min="0" step="0.1" value="${escapeHtml(state.allies[i].speed)}"></label>
              <label class="mini-field"><span>★の数</span><input class="ally-star" type="number" inputmode="numeric" min="1" max="4" step="1" value="${escapeHtml(state.allies[i].star ?? '')}"></label>
              <label class="mini-field"><span>属性</span><select class="ally-attribute">${optionsHtml(MONSTER_ATTRIBUTE_OPTIONS, state.allies[i].attribute ?? '')}</select></label>`}
          </div>`).join('')}
      </div>
    </section>

    <section class="panel rule-note-panel">
      <h2>現在の暫定ルール</h2>
      <p>毒=現在HPの10%、猛毒=20%を敵の行動タイミング終了直後に切り捨てダメージ。毒系は後から付与したものが上書きされます。バフ／デバフは付与ターンを1ターン目としてターン終了時に残りターンを1減らします。行動順は各ターン開始時に固定します。</p>
    </section>

    <div class="turn-stack">
      ${state.turns.map((turn, i) => turnHtml(turn, i)).join('')}
    </div>

    <div class="turn-add-row">
      <button type="button" class="add-button" id="addTurn" ${state.turns.length >= 12 ? 'disabled' : ''}>＋ ターン追加</button>
      <button type="button" class="ghost-button" id="duplicateLastTurn" ${state.turns.length >= 12 ? 'disabled' : ''}>最後のターンを複製</button>
    </div>

    <div id="timelineContainer">${timelineHtml(result)}</div>
  `;
}

function collectStateFromDom() {
  state.enemy.maxHp = root.querySelector('#enemyHp')?.value ?? state.enemy.maxHp;
  state.enemy.attribute = root.querySelector('#enemyAttribute')?.value ?? state.enemy.attribute;
  state.enemy.race = root.querySelector('#enemyRace')?.value ?? state.enemy.race;
  state.enemy.speed = root.querySelector('#enemySpeed')?.value ?? state.enemy.speed;
  state.allyCount = Number(root.querySelector('#allyCount')?.value ?? state.allyCount);

  root.querySelectorAll('.ally-card').forEach(card => {
    const i = Number(card.dataset.allyIndex);
    state.allies[i].characterId = card.querySelector('.ally-character')?.value ?? state.allies[i].characterId ?? '';
    state.allies[i].attack = card.querySelector('.ally-attack')?.value ?? state.allies[i].attack;
    state.allies[i].speed = card.querySelector('.ally-speed')?.value ?? state.allies[i].speed;
    state.allies[i].star = card.querySelector('.ally-star')?.value ?? state.allies[i].star ?? '';
    state.allies[i].attribute = card.querySelector('.ally-attribute')?.value ?? state.allies[i].attribute ?? '';
    if (!state.allies[i].characterId) rememberCharacterStats(state.allies[i]);
  });

  root.querySelectorAll('.action-card').forEach(card => {
    const turnIndex = Number(card.dataset.turnIndex);
    const actorKey = card.dataset.actorKey;
    if (!state.turns[turnIndex]) return;

    if (actorKey === 'enemy') {
      const action = state.turns[turnIndex].enemyAction;
      action.enabled = card.querySelector('.enemy-enabled')?.checked ?? action.enabled;
      const type = card.querySelector('.enemy-effect-type')?.value ?? action.effect?.type ?? 'none';
      const effect = { type };
      const targetCodeValue = card.querySelector('.enemy-effect-target-select')?.value;
      const target = targetCodeValue ? targetFromCode(targetCodeValue) : undefined;
      const mode = card.querySelector('.enemy-effect-mode')?.value;
      const value = card.querySelector('.enemy-effect-value')?.value;
      const duration = card.querySelector('.enemy-effect-duration')?.value;
      if (target !== undefined) effect.target = target;
      if (mode !== undefined) effect.mode = mode;
      if (value !== undefined) effect.value = value;
      if (duration !== undefined) effect.duration = duration;
      action.effect = effect;
    } else {
      const allyIndex = Number(actorKey.replace('ally', ''));
      const action = state.turns[turnIndex].allyActions[allyIndex];
      const selectedPresetId = card.querySelector('.skill-preset')?.value ?? action.skillPresetId ?? '';
      action.skillPresetId = selectedPresetId;
      if (!selectedPresetId) {
        action.kind = card.querySelector('.action-kind')?.value ?? action.kind;
        action.skillMultiplier = card.querySelector('.skill-multiplier')?.value ?? action.skillMultiplier;
        action.skillMultiplierMin = card.querySelector('.skill-multiplier-min')?.value ?? action.skillMultiplierMin ?? '';
        action.skillMultiplierMax = card.querySelector('.skill-multiplier-max')?.value ?? action.skillMultiplierMax ?? '';
        action.skillMultiplierStep = card.querySelector('.skill-multiplier-step')?.value ?? action.skillMultiplierStep ?? '';
        action.attackAttribute = card.querySelector('.attack-attribute')?.value ?? action.attackAttribute;
        action.attackAttribute2 = card.querySelector('.attack-attribute2')?.value ?? action.attackAttribute2 ?? 'none';
        action.attackType = card.querySelector('.attack-type')?.value ?? action.attackType ?? 'physical';
        action.hits = card.querySelector('.hit-count')?.value ?? action.hits;
        action.hitsMin = card.querySelector('.hit-count-min')?.value ?? action.hitsMin ?? '';
        action.hitsMax = card.querySelector('.hit-count-max')?.value ?? action.hitsMax ?? '';
        action.buff = collectPrimaryBuff(card, 'ally', action.buff);
        action.effects = collectEffects(card);
      }
    }
  });
}

function collectPrimaryBuff(card, side, current) {
  const type = card.querySelector('.main-buff-type')?.value;
  if (type === undefined) return current ?? defaultPrimaryBuff(side);
  const buff = {
    type,
    mode: card.querySelector('.main-buff-mode')?.value ?? 'mult',
    value: card.querySelector('.main-buff-value')?.value ?? '50',
    duration: card.querySelector('.main-buff-duration')?.value ?? '1'
  };
  const targetCodeValue = card.querySelector('.main-buff-target-select')?.value;
  if (targetCodeValue) buff.target = targetFromCode(targetCodeValue);
  return buff;
}

function collectEffects(card) {
  return [...card.querySelectorAll('.effect-row')].map(row => {
    const type = row.querySelector('.effect-type')?.value;
    const effect = { type };
    const targetCodeValue = row.querySelector('.effect-target-select')?.value;
    const target = targetCodeValue ? targetFromCode(targetCodeValue) : undefined;
    const mode = row.querySelector('.effect-mode')?.value;
    const value = row.querySelector('.effect-value')?.value;
    const duration = row.querySelector('.effect-duration')?.value;
    const expiry = row.dataset.effectExpiry;
    if (target !== undefined) effect.target = target;
    if (mode !== undefined) effect.mode = mode;
    if (value !== undefined) effect.value = value;
    if (duration !== undefined) effect.duration = duration;
    if (expiry) effect.expiry = expiry;
    return effect;
  });
}

function rememberCharacterStats(ally) {
  if (!ally?.characterId) return;
  if (!state.characterStats) state.characterStats = defaultCharacterStats();
  const attack = ally.attack ?? '';
  const speed = ally.speed ?? '';
  if (attack === '' && speed === '') return;
  state.characterStats[ally.characterId] = { attack, speed };
}

function saveAndRender() {
  saveState();
  render();
}

function updateResultOnly() {
  const { result, error } = calculate();
  const old = root.querySelector('#killResultPanel');
  if (old) old.outerHTML = resultHtml(result, error);
  const timeline = root.querySelector('#timelineContainer');
  if (timeline) timeline.innerHTML = timelineHtml(result);
}

let state = loadState();
render();

root.addEventListener('input', event => {
  if (!(event.target instanceof HTMLInputElement)) return;
  collectStateFromDom();
  saveState();
  updateResultOnly();
});

root.addEventListener('change', event => {
  if (!(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLSelectElement)) return;
  if (event.target.classList.contains('ally-character')) {
    const card = event.target.closest('.ally-card');
    const allyIndex = Number(card?.dataset.allyIndex);
    if (Number.isInteger(allyIndex)) applyCharacterPreset(allyIndex, event.target.value);
  } else if (event.target.classList.contains('effect-type')) {
    collectStateFromDom();
    const row = event.target.closest('.effect-row');
    const turnIndex = Number(row?.dataset.turnIndex);
    const actorKey = row?.dataset.actorKey ?? '';
    const effectIndex = Number(row?.dataset.effectIndex);
    const side = row?.dataset.effectSide ?? 'ally';
    const next = effectDefault(event.target.value, side);
    if (side === 'ally' && actorKey.startsWith('ally') && Number.isInteger(turnIndex) && Number.isInteger(effectIndex)) {
      state.turns[turnIndex].allyActions[Number(actorKey.replace('ally', ''))].effects[effectIndex] = next;
    }
  } else if (event.target.classList.contains('enemy-effect-type')) {
    collectStateFromDom();
    const card = event.target.closest('.enemy-action-card');
    const turnIndex = Number(card?.dataset.turnIndex);
    if (Number.isInteger(turnIndex)) state.turns[turnIndex].enemyAction.effect = effectDefault(event.target.value, 'enemy');
  } else if (event.target.id === 'enemyAttribute') {
    collectStateFromDom();
    // 敵属性に応じて技が変わるキャラだけプリセットを更新する。
    state.allies.slice(0, state.allyCount).forEach((ally, allyIndex) => {
      if (ally.characterId === 'camineko' || ally.characterId === 'dark_bahamut') {
        applyCharacterPreset(allyIndex, ally.characterId);
      }
    });
  } else if (event.target.classList.contains('skill-preset')) {
    collectStateFromDom();
    const card = event.target.closest('.action-card');
    const turnIndex = Number(card?.dataset.turnIndex);
    const actorKey = card?.dataset.actorKey ?? '';
    const allyIndex = Number(actorKey.replace('ally', ''));
    const action = state.turns?.[turnIndex]?.allyActions?.[allyIndex];
    if (action) applySkillPresetToAction(action, event.target.value);
  } else {
    collectStateFromDom();
  }

  // 表示項目が変わる選択は全体を再描画。
  if (
    event.target.id === 'allyCount' ||
    event.target.id === 'enemyRace' ||
    event.target.id === 'enemyAttribute' ||
    event.target.classList.contains('action-kind') ||
    event.target.classList.contains('skill-preset') ||
    event.target.classList.contains('enemy-enabled') ||
    event.target.classList.contains('enemy-effect-type') ||
    event.target.classList.contains('ally-character') ||
    event.target.classList.contains('effect-type') ||
    event.target.classList.contains('effect-mode') ||
    event.target.classList.contains('main-buff-mode')
  ) {
    saveAndRender();
  } else {
    saveState();
    updateResultOnly();
  }
});

root.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  collectStateFromDom();

  if (button.id === 'addTurn') {
    const base = deepClone(state.turns[state.turns.length - 1] ?? cloneDefaultState().turns[0]);
    if (state.turns.length < 12) state.turns.push(base);
    saveAndRender();
    return;
  }

  if (button.id === 'duplicateLastTurn') {
    if (state.turns.length < 12) state.turns.push(deepClone(state.turns[state.turns.length - 1]));
    saveAndRender();
    return;
  }

  if (button.classList.contains('duplicate-turn')) {
    const turnIndex = Number(button.closest('[data-turn-panel]')?.dataset.turnPanel);
    if (state.turns.length < 12 && Number.isInteger(turnIndex)) state.turns.splice(turnIndex + 1, 0, deepClone(state.turns[turnIndex]));
    saveAndRender();
    return;
  }

  if (button.classList.contains('remove-turn')) {
    const turnIndex = Number(button.closest('[data-turn-panel]')?.dataset.turnPanel);
    if (state.turns.length > 1 && Number.isInteger(turnIndex)) state.turns.splice(turnIndex, 1);
    saveAndRender();
    return;
  }

  if (button.classList.contains('add-effect')) {
    const card = button.closest('.action-card');
    const turnIndex = Number(card.dataset.turnIndex);
    const actorKey = card.dataset.actorKey;
    const side = button.dataset.side;
    const types = side === 'enemy' ? ENEMY_EFFECT_TYPES : ALLY_EFFECT_TYPES;
    const effect = effectDefault(types[0][0], side);
    if (actorKey === 'enemy') state.turns[turnIndex].enemyAction.effects.push(effect);
    else state.turns[turnIndex].allyActions[Number(actorKey.replace('ally', ''))].effects.push(effect);
    saveAndRender();
    return;
  }

  if (button.classList.contains('remove-effect')) {
    const row = button.closest('.effect-row');
    const turnIndex = Number(row.dataset.turnIndex);
    const effectIndex = Number(row.dataset.effectIndex);
    const actorKey = row.dataset.actorKey;
    if (actorKey === 'enemy') state.turns[turnIndex].enemyAction.effects.splice(effectIndex, 1);
    else state.turns[turnIndex].allyActions[Number(actorKey.replace('ally', ''))].effects.splice(effectIndex, 1);
    saveAndRender();
  }
});

resetButton.addEventListener('click', () => {
  state = normalizeState(cloneDefaultState());
  saveState();
  render();
});
