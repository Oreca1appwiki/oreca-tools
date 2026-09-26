import { APP_VERSION } from '../assets/version.js';
import {
  ALLY_EFFECT_TYPES,
  ATTACK_ATTRIBUTES,
  ATTACK_TYPE_OPTIONS,
  ENEMY_ATTRIBUTE_OPTIONS,
  ENEMY_RACE_OPTIONS,
  ENEMY_EFFECT_TYPES,
  cloneDefaultState,
  simulateKillProbabilityEnemyManual
} from './engine.js';
import {
  SKILL_PRESETS,
  SKILL_PRESET_BY_ID,
  caminekoPresetForEnemy,
  darkBahamutPresetForEnemy,
  presetIdForSkillName
} from './presets.js';
import {
  BOSS_PRESETS,
  BOSS_PRESET_BY_ID,
  BOSS_CHAPTER_ORDER,
  applyBossPresetToEnemy
} from './boss-presets.js';
import { enemyBossProfile, enemyCompanionProfile } from './enemy-actions.js';
import { commandSkillNamesForCharacter, isTransformSkillPresetId } from './commands.js';

const STORAGE_KEY = 'oreca-tools.kill.v0.4.13';
const DIRECT_STORAGE_KEYS = ['oreca-tools.kill.v0.4.12', 'oreca-tools.kill.v0.4.11', 'oreca-tools.kill.v0.4.10', 'oreca-tools.kill.v0.4.9'];
// v0.4.5～v0.4.8 は攻撃力バフの乗算値を「増加量」で保存（50 = ×1.5）。
// v0.4.9 からはダメージ計算と同じく最終倍率を直接保存（150 = ×1.5）。
const AMOUNT_STORAGE_KEYS = ['oreca-tools.kill.v0.4.8', 'oreca-tools.kill.v0.4.7', 'oreca-tools.kill.v0.4.6', 'oreca-tools.kill.v0.4.5'];
const LEGACY_STORAGE_KEYS = ['oreca-tools.kill.v0.4.4', 'oreca-tools.kill.v0.4.3', 'oreca-tools.kill.v0.4.2', 'oreca-tools.kill.v0.4.1', 'oreca-tools.kill.v0.4.0'];
const root = document.getElementById('killRoot');
const resetButton = document.getElementById('resetButton');

for (const el of document.querySelectorAll('[data-app-version]')) el.textContent = APP_VERSION;

const V0514_CHANGED_SKILL_PRESETS = new Set([
  'rock_throw', 'self_destruct', 'ice_storm_strike', 'dragon_tail', 'shiden', 'light_breath', 'holy_strike'
]);

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
  { id: 'grand_blue_dragon', name: 'グランブルー・ドラゴン', group: 'general', skill: 'アイスブレス', attack: '78', speed: '52', star: '4', attribute: 'water', kind: 'attack' },
  { id: 'bahamut', name: '天界竜バハムート', group: 'general', skill: 'シャイニングブレス', attack: '89', speed: '73', star: '4', attribute: 'earth', kind: 'attack' },
  { id: 'mimitoshishi', name: 'ミミトシシ', group: 'general', skill: 'こうげき！', attack: '42', speed: '63', star: '1', attribute: 'water', kind: 'attack' },
  { id: 'dark_bahamut', name: '冥界竜ダークバハムート', group: 'general', skill: 'ブレス系統（敵属性で選択）', attack: '89', speed: '73', star: '4', attribute: 'earth', kind: 'attack' },
  { id: 'magora', name: 'マゴラ', group: 'general', skill: 'さけぶ', attack: '36', speed: '57', star: '1', attribute: 'wind', kind: 'buff' },
  { id: 'kerogon_green', name: 'ケロゴン(緑)', group: 'general', skill: '竜のしっぽ', attack: '31', speed: '52', star: '1', attribute: 'wind', kind: 'attack' },
  { id: 'oniwaka_monk', name: '僧兵オニワカ', group: 'general', skill: '足ばらい', attack: '63', speed: '47', star: '3', attribute: 'wind', kind: 'attack' },
  { id: 'oniwaka', name: 'オニワカ', group: 'general', skill: '足ばらい', attack: '57', speed: '42', star: '2', attribute: 'wind', kind: 'attack' },
  { id: 'red_empress', name: '赤のエンプレス', group: 'general', skill: '行動スキップ', attack: '63', speed: '84', star: '4', attribute: 'water', kind: 'skip' },
  { id: 'raijin_kukulkan', name: '雷神竜ククルカン', group: 'general', skill: 'つつきまくり', attack: '78', speed: '89', star: '4', attribute: 'wind', kind: 'attack' },
  { id: 'raijin_kukulkan_roaring', name: '雷神竜ククルカン〖轟く稲妻〗型', group: 'general', skill: '轟く稲妻', attack: '78', speed: '89', star: '4', attribute: 'wind', kind: 'attack' },
  { id: 'venom_behemoth', name: '猛毒竜ベヒモス', group: 'general', skill: 'おしつぶし', attack: '73', speed: '15', star: '4', attribute: 'earth', kind: 'attack' },
  { id: 'heavy_behemoth', name: '重竜ベヒモス', group: 'general', skill: 'おしつぶし', attack: '63', speed: '10', star: '4', attribute: 'earth', kind: 'attack' },
  { id: 'kerogon_yellow', name: 'ケロゴン(黄)', group: 'general', skill: '竜のしっぽ', attack: '31', speed: '21', star: '1', attribute: 'earth', kind: 'attack' },
  { id: 'guardian_powan', name: '魔海の守護者ポワン', group: 'both', skill: 'シャボン・グラン', attack: '73', speed: '73', star: '4', attribute: 'water', kind: 'attack' },
  { id: 'kerogon_blue', name: 'ケロゴン(青)', group: 'general', skill: '竜のしっぽ', attack: '31', speed: '42', star: '1', attribute: 'water', kind: 'attack' },
  { id: 'docteur', name: 'ドクトル', group: 'general', skill: '試作魔銃', attack: '57', speed: '63', star: '3', attribute: 'water', kind: 'attack' },
  { id: 'dartan', name: '無幻銃士ダルタン', group: 'general', skill: '連撃', attack: '78', speed: '36', star: '4', attribute: 'earth', kind: 'attack' },
  { id: 'kerogon_gold', name: 'ケロゴン(金)', group: 'general', skill: '竜のしっぽ', attack: '36', speed: '10', star: '1', attribute: 'fire', kind: 'attack' },
  { id: 'camineko', name: 'キャミネコ', group: 'general', skill: 'ファイア！／アイス！／サンダー！（敵属性で選択）', attack: '42', speed: '68', star: '1', attribute: 'wind', kind: 'attack' },
  { id: 'bero', name: 'ベロ', group: 'general', skill: '3回こうげき', attack: '47', speed: '42', star: '1', attribute: 'wind', kind: 'attack' },
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
  { id: 'mermaid_mellow', name: 'マーメイドメロウ', group: 'condition', skill: 'シャボン・グラン', attack: '68', speed: '73', star: '3', attribute: 'water', kind: 'attack' },
  { id: 'captain_azul', name: 'キャプテン・アズール', group: 'condition', skill: 'シビレ斬り', attack: '63', speed: '42', star: '3', attribute: 'water', kind: 'attack' },
  { id: 'elysion', name: '光王エーリュシオン', group: 'condition', skill: '行動スキップ', attack: '78', speed: '52', star: '4', attribute: 'earth', kind: 'skip', secondSkill: '浄化の炎', secondKind: 'attack' },
  { id: 'hien', name: '剣豪ヒエン', group: 'condition', skill: '紫電', attack: '63', speed: '78', star: '3', attribute: 'wind', kind: 'attack' },
  { id: 'red_magician', name: 'レッド・マジシャン', group: 'condition', skill: 'ラヴァブースト', attack: '73', speed: '68', star: '3', attribute: 'fire', kind: 'effect' },
  { id: 'magician', name: 'マジシャン', group: 'condition', skill: 'ラヴァブースト', attack: '63', speed: '57', star: '2', attribute: 'fire', kind: 'effect' },
  { id: 'beige', name: 'ベージ', group: 'condition', skill: '行動スキップ', attack: '21', speed: '94', star: '1', attribute: 'earth', kind: 'skip' },
  { id: 'marduk', name: '王子マルドク', group: 'condition', skill: '会心の一撃', attack: '79', speed: '95', star: '4', attribute: 'wind', kind: 'attack' },
  { id: 'enki', name: '老将エンキ', group: 'condition', skill: '会心の一撃', attack: '78', speed: '57', star: '4', attribute: 'wind', kind: 'attack' },
  { id: 'damkina', name: 'ダムキナ', group: 'condition', skill: 'ウィンド‼︎', attack: '68', speed: '89', star: '4', attribute: 'wind', kind: 'attack' },
  { id: 'saezer', name: '棘騎士サエザー', group: 'condition', skill: 'こうげき！', attack: '68', speed: '52', star: '3', attribute: 'water', kind: 'attack' },
  { id: 'dante_magic_swordsman', name: '魔剣士ダンテ', group: 'condition', skill: 'こうげき！', attack: '68', speed: '31', star: '3', attribute: 'fire', kind: 'attack' },
  { id: 'simon', name: 'シモン', group: 'condition', skill: 'こうげき！', attack: '68', speed: '47', star: '3', attribute: 'fire', kind: 'attack' },
  { id: 'hayate', name: '風隠の戦士ハヤテ', group: 'condition', skill: 'こうげき！', attack: '57', speed: '84', star: '3', attribute: 'wind', kind: 'attack' },
  { id: 'sky_clay', name: '天空騎士クレイ', group: 'condition', skill: 'こうげき！', attack: '73', speed: '73', star: '4', attribute: 'earth', kind: 'attack' },
  { id: 'djinn', name: '大魔神ジン', group: 'condition', skill: 'ウィンド‼︎', attack: '63', speed: '84', star: '4', attribute: 'wind', kind: 'attack' },
  { id: 'great_mimitoshishi', name: '大魔導ミミトシシ', group: 'condition', skill: 'ファイア!!', attack: '90', speed: '70', star: '4', attribute: 'fire', kind: 'attack' },
  { id: 'great_cliff', name: '大僧侶クリフ', group: 'condition', skill: '精霊の加護', attack: '60', speed: '60', star: '3', attribute: 'wind', kind: 'effect' },
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
  'son_goku','gyumao','loki','kerogon_green','camineko','bero','magora','guardian_powan','dark_bahamut',
  'oniwaka_monk','clear_blue_dragon','docteur','dartan','kerogon_yellow','kerogon_blue','kerogon_gold',
  'raijin_kukulkan','raijin_kukulkan_roaring','kenran_kukulkan','shinjuryu_kukulkan','venom_behemoth','heavy_behemoth',
  'red_empress','oniwaka','platinum_drake','scarlet_dragon','sylph','crow','garanezumi','ifrit','red_magician','magician','beige',
  'black_knight_gebolg','rakshasa','bahamut','mimitoshishi','astaroth',
  // 条件枠
  'captain_azul','toritamago','elysion','hien','fire_drake','nanawarai','ginger_ale','lafroig',
  'ares','chibimuus','mermaid_mellow','marduk','enki','damkina','saezer','dante_magic_swordsman',
  'simon','hayate','sky_clay','djinn','great_mimitoshishi','great_cliff','gate_dante','yamato','susanoo','soccerra'
]);
const CHARACTER_USAGE_RANK = new Map(CHARACTER_USAGE_ORDER.map((id, i) => [id, i]));

// 技もカテゴリ内で使用頻度順。忍法・ポイント・属性ブレス等の同系統は連続配置する。
const SKILL_USAGE_ORDER = Object.freeze([
  // バフ・強化
  'loki_brand','oni_spirit','spirit_blessing','sun_blessing','kerakuzu','sea_king_gaze','growl','sun_hymn','name_announcement','sword_dance','suck_dry','item_parts',
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
  'aqua_breath','ice_breath','shining_breath','fire1','ice1','thunder1','meteor',
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
  'allyAtkDebuff', 'allySpeedDebuff', 'enemyAtkBuff', 'enemyDefenseBuff', 'enemyDefenseDebuff', 'enemyCounterGuard', 'enemySpeedBuff'
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
  const allowedFinalTurnCutoffs = new Set(['lastAlly', 'turnEnd', ...Array.from({ length: state.allyCount }, (_, i) => `ally${i + 1}`)]);
  state.finalTurnCutoff = allowedFinalTurnCutoffs.has(saved.finalTurnCutoff) ? saved.finalTurnCutoff : (fallback.finalTurnCutoff ?? 'lastAlly');
  state.allies = fallback.allies.map((ally, i) => ({ ...ally, ...(saved.allies?.[i] ?? {}), characterId: saved.allies?.[i]?.characterId ?? ally.characterId ?? '', race: saved.allies?.[i]?.race ?? ally.race ?? 'normal', commandVariant: saved.allies?.[i]?.commandVariant ?? ally.commandVariant ?? '' }));
  state.allies.forEach(ally => {
    delete ally.hp;
    if (!new Set(ENEMY_RACE_OPTIONS.map(([value]) => value)).has(ally.race)) ally.race = 'normal';
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
    if (ally.characterId === 'son_goku' || ally.characterId === 'gyumao') {
      if (!['stop1','stop2','stop24','stop3','forward4'].includes(ally.commandVariant)) ally.commandVariant = 'forward4';
    } else if (ally.characterId === 'mimitoshishi') {
      if (!['mixed', 'attack6'].includes(ally.commandVariant)) ally.commandVariant = 'mixed';
    } else if (ally.characterId === 'red_empress') {
      if (!['support', 'critical5', 'critical4'].includes(ally.commandVariant)) ally.commandVariant = 'support';
    } else if (['gate_dante','yamato','susanoo','nanawarai','ginger_ale','fire_drake'].includes(ally.characterId)) {
      if (!['default','attack1'].includes(ally.commandVariant)) ally.commandVariant = 'default';
    } else if (ally.characterId === 'soccerra') {
      if (!['default','deadly3'].includes(ally.commandVariant)) ally.commandVariant = 'default';
    } else {
      ally.commandVariant = '';
    }
  });
  state.turns = Array.isArray(saved.turns) && saved.turns.length ? saved.turns.slice(0, 12) : fallback.turns;

  const allowedEnemyAttrs = new Set(ENEMY_ATTRIBUTE_OPTIONS.map(([value]) => value));
  if (!allowedEnemyAttrs.has(state.enemy.attribute)) state.enemy.attribute = 'fire';
  const allowedEnemyRaces = new Set(ENEMY_RACE_OPTIONS.map(([value]) => value));
  if (!allowedEnemyRaces.has(state.enemy.race)) state.enemy.race = 'normal';
  // v0.5.71: BOSS本体だけでは勝利にしない。旧保存データのbossOnlyVictoryも必ず無効化する。
  state.enemy.bossOnlyVictory = false;
  state.enemy.enemyExAllowance = String(Math.max(0, Math.min(99, Math.trunc(Number(state.enemy.enemyExAllowance ?? 0) || 0))));
  delete state.enemy.simulationMode;

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
        raceSkillMultipliers: deepClone(raw.raceSkillMultipliers ?? {}),
        damageFormula: raw.damageFormula ?? '',
        selfDestruct: raw.selfDestruct === true,
        enemyTarget: raw.enemyTarget ?? 'single',
        enemyTargetSlot: raw.enemyTargetSlot ?? 'auto',
        buff: { ...defaultPrimaryBuff('ally'), ...(raw.buff ?? {}) },
        effects: Array.isArray(raw.effects) ? raw.effects : [],
        skillName: raw.skillName ?? '',
        presetTarget: raw.presetTarget ?? '',
        fixedCharacterSkill: raw.fixedCharacterSkill ?? '',
        confusionSkillPresetId: raw.confusionSkillPresetId ?? ''
      };
      // v0.4.2以前にはskillPresetIdが無かったため、既知技は一度だけプリセット値へ移行する。
      if ((raw.skillPresetId === undefined || rawPresetId !== presetId) && presetId) applySkillPresetToAction(normalized, presetId);
      if (presetId && V0514_CHANGED_SKILL_PRESETS.has(presetId)) applySkillPresetToAction(normalized, presetId);
      // v0.5.54: 既存保存データには攻撃範囲が保存されていないため、プリセット定義から復元する。
      if (presetId) {
        const preset = SKILL_PRESET_BY_ID.get(presetId);
        if (preset?.kind === 'attack') normalized.enemyTarget = preset.enemyTarget ?? 'single';
      }
      normalized.enemyTargetSlot = raw.enemyTargetSlot ?? normalized.enemyTargetSlot ?? 'auto';
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
    const normalizedEnemyEffect = { type: 'none', target: 'all', mode: 'mult', value: '20', duration: '1', ...(migratedEnemyEffect ?? {}) };
    const allowedEnemyEffectTypes = new Set([...ENEMY_EFFECT_TYPES.map(([type]) => type), 'same']);
    if (!allowedEnemyEffectTypes.has(String(normalizedEnemyEffect.type ?? 'none'))) {
      Object.assign(normalizedEnemyEffect, { type:'none', target:'all', mode:'mult', value:'20', duration:'1' });
    }
    turn.enemyAction = {
      enabled: Boolean(turn.enemyAction?.enabled),
      effect: normalizedEnemyEffect
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

function bossPresetOptionsHtml(selected) {
  const byChapter = new Map(BOSS_CHAPTER_ORDER.map(chapter => [chapter, []]));
  for (const preset of BOSS_PRESETS) {
    if (!byChapter.has(preset.chapter)) byChapter.set(preset.chapter, []);
    byChapter.get(preset.chapter).push(preset);
  }
  const groups = [...byChapter.entries()]
    .filter(([, items]) => items.length)
    .map(([chapter, items]) => {
      const options = items.map(x => `<option value="${escapeHtml(x.id)}" ${x.id === selected ? 'selected' : ''}>${escapeHtml(x.name)}</option>`).join('');
      return `<optgroup label="${escapeHtml(chapter)}">${options}</optgroup>`;
    }).join('');
  return `<option value="" ${!selected ? 'selected' : ''}>手動入力</option>${groups}`;
}

function bossPresetInfoHtml(presetId) {
  const preset = BOSS_PRESET_BY_ID.get(presetId);
  if (!preset) return '';
  const attr = optionsLabel(ENEMY_ATTRIBUTE_OPTIONS, preset.attribute);
  const calcRace = optionsLabel(ENEMY_RACE_OPTIONS, preset.race) || '通常';
  const rawHp = preset.hpRaw !== String(preset.hp) ? `（元表記 ${escapeHtml(preset.hpRaw)}）` : '';
  const rawSpeed = preset.speedRaw !== String(preset.speed) ? `（元表記 ${escapeHtml(preset.speedRaw)}）` : '';
  const notes = [preset.encounterNote, preset.note].filter(Boolean);
  const enemyCount = Math.max(1, Number(preset.enemyCount ?? 1) || 1);
  const hpLabel = enemyCount > 1
    ? `HP ${escapeHtml(preset.hp)}${rawHp} × ${enemyCount}体（合計 ${escapeHtml(preset.hp * enemyCount)}）`
    : `HP ${escapeHtml(preset.hp)}${rawHp}`;
  return `<div class="boss-preset-info">
    <strong>${escapeHtml(preset.name)}</strong>
    <span>${escapeHtml(attr)}属性 / ${escapeHtml(preset.raceLabel)} / ${hpLabel} / 素早さ ${escapeHtml(preset.speed)}${rawSpeed}</span>
    <small>撃破計算上の種族判定: ${escapeHtml(calcRace)}</small>
    <small>敵行動は各ターンで手動指定します。BOSSコマンドの自動抽選は行いません。</small>
    ${notes.map(note => `<small>${escapeHtml(note)}</small>`).join('')}
  </div>`;
}

function applyEnemyAttributeDependentPresets() {
  state.allies.slice(0, state.allyCount).forEach((ally, allyIndex) => {
    if (ally.characterId === 'camineko' || ally.characterId === 'dark_bahamut') {
      applyCharacterPreset(allyIndex, ally.characterId);
    }
  });
}

function characterOptionsHtml(selected) {
  const general = sortByUsage(CHARACTER_PRESETS.filter(x => x.id && (x.group === 'general' || x.group === 'both')), CHARACTER_USAGE_RANK);
  const condition = sortByUsage(CHARACTER_PRESETS.filter(x => x.id && (x.group === 'condition' || x.group === 'both')), CHARACTER_USAGE_RANK);
  const render = items => items.map(x => `<option value="${escapeHtml(x.id)}" ${x.id === selected ? 'selected' : ''}>${escapeHtml(x.name)}</option>`).join('');
  return `<option value="" ${!selected ? 'selected' : ''}>選択なし</option><optgroup label="汎用">${render(general)}</optgroup><optgroup label="条件">${render(condition)}</optgroup>`;
}

const SKIP_ACTION_PRESET = '__skip_action__';

function skillPresetOptionsHtml(selected, mode = 'manual') {
  let major = SKILL_PRESETS.filter(x => x.selectable !== false && x.major === true);
  if (mode === 'transform') major = major.filter(x => isTransformSkillPresetId(x.id));
  const buffs = sortByUsage(major.filter(x => x.majorGroup === 'buff'), SKILL_USAGE_RANK);
  const attacks = sortByUsage(major.filter(x => x.majorGroup === 'attack'), SKILL_USAGE_RANK);
  const others = sortByUsage(major.filter(x => x.majorGroup === 'other'), SKILL_USAGE_RANK);
  const render = items => items.map(x => `<option value="${escapeHtml(x.id)}" ${x.id === selected ? 'selected' : ''}>${escapeHtml(x.name)}</option>`).join('');
  const first = mode === 'transform'
    ? `<option value="" ${!selected ? 'selected' : ''}>変化先を選択</option>`
    : `<option value="" ${!selected ? 'selected' : ''}>手動入力</option><option value="${SKIP_ACTION_PRESET}" ${selected === SKIP_ACTION_PRESET ? 'selected' : ''}>行動スキップ</option>`;
  const prefix = mode === 'transform' ? '変化先・' : '';
  return `${first}<optgroup label="${prefix}バフ・強化技">${render(buffs)}</optgroup><optgroup label="${prefix}攻撃技">${render(attacks)}</optgroup><optgroup label="${prefix}その他">${render(others)}</optgroup>`;
}

function characterDisplaySeedSkill(characterId, action) {
  if (action?.skillName) return action.skillName;
  const preset = CHARACTER_BY_ID.get(characterId);
  if (!preset) return '';
  const presetId = presetIdForCharacterSkill(characterId, preset.skill ?? '');
  return SKILL_PRESET_BY_ID.get(presetId)?.skillName ?? preset.skill ?? '';
}

function fixedCharacterSkillNames(allyIndex, action) {
  const ally = state.allies?.[allyIndex];
  const characterId = ally?.characterId ?? '';
  if (!characterId || characterId === 'son_goku' || characterId === 'gyumao') return [];
  const seedSkill = characterDisplaySeedSkill(characterId, action);
  return commandSkillNamesForCharacter(characterId, seedSkill, ally?.commandVariant ?? '')
    .filter(name => Boolean(presetIdForSkillName(name)));
}

function fixedCharacterSkillLabel(allyIndex, action) {
  return fixedCharacterSkillNames(allyIndex, action).join('/');
}

function fixedCharacterSkillOptionsHtml(allyIndex, action) {
  const names = fixedCharacterSkillNames(allyIndex, action);
  const selected = names.includes(action?.fixedCharacterSkill ?? '') ? action.fixedCharacterSkill : '';
  const autoLabel = names.length ? `自動抽選（${names.join('/')}）` : '自動抽選';
  const options = [`<option value="" ${!selected ? 'selected' : ''}>${escapeHtml(autoLabel)}</option>`];
  for (const name of names) {
    options.push(`<option value="${escapeHtml(name)}" ${selected === name ? 'selected' : ''}>${escapeHtml(name)}だけに固定</option>`);
  }
  return options.join('');
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
  action.raceSkillMultipliers = {};
  action.damageFormula = '';
  action.selfDestruct = false;
  action.enemyTarget = 'single';
  action.enemyTargetSlot = 'auto';
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
  if (skill.targetRequired && !/^ally[1-3]$/.test(action.presetTarget ?? '')) action.presetTarget = `ally1`;
  action.presetNote = skill.note ?? '';
  resetAttackPresetFields(action);
  if (skill.enemyTarget) action.enemyTarget = skill.enemyTarget;

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
    action.raceSkillMultipliers = deepClone(skill.raceSkillMultipliers ?? {});
    action.damageFormula = skill.damageFormula ?? '';
    action.selfDestruct = skill.selfDestruct === true;
    action.enemyTarget = skill.enemyTarget ?? 'single';
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
  if (characterId === 'son_goku' || characterId === 'gyumao') {
    if (!['stop1','stop2','stop24','stop3','forward4'].includes(ally.commandVariant)) ally.commandVariant = 'forward4';
  } else if (characterId === 'mimitoshishi') {
    if (!['mixed', 'attack6'].includes(ally.commandVariant)) ally.commandVariant = 'mixed';
  } else if (characterId === 'red_empress') {
    if (!['support', 'critical5', 'critical4'].includes(ally.commandVariant)) ally.commandVariant = 'support';
  } else if (['gate_dante','yamato','susanoo','nanawarai','ginger_ale','fire_drake'].includes(characterId)) {
    if (!['default','attack1'].includes(ally.commandVariant)) ally.commandVariant = 'default';
  } else if (characterId === 'soccerra') {
    if (!['default','deadly3'].includes(ally.commandVariant)) ally.commandVariant = 'default';
  } else {
    ally.commandVariant = '';
  }

  state.turns.forEach((turn, turnIndex) => {
    const action = turn.allyActions[allyIndex];
    action.fixedCharacterSkill = '';
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
  if (String(type).startsWith('status')) {
    const durations = { statusSilence:'3', statusDarkness:'3', statusSleep:'5', statusPetrification:'99', statusCold:'3' };
    return { type, target:'all', activationChance:'100', chance:'50', duration: durations[type] ?? '1', attackType:'magic' };
  }
  if (type === 'weaknessBuff') return { type, target: 'all', duration: '3' };
  if (type === 'statusCure') return { type, target: 'all' };
  if (type === 'statusAvoid') return { type, target: 'all', value: '45', duration: '3' };
  if (type === 'statusImmune') return { type, target: 'all', duration: '2' };
  if (type === 'heal') return { type, mode: 'flat', value: '200' };
  if (type === 'enemyBlessing') return { type, mode: 'attackPercent', value: '30', duration: '3' };
  if (type === 'enemyCounterGuard') return { type, mode: 'mult', value: '40', duration: '2', attackTypes:['physical'] };
  if (type === 'enemyDamageReduction') return { type, mode: 'mult', value: '40', duration: '1' };
  if (side === 'enemy') {
    if (type === 'allyAtkDebuff' || type === 'allySpeedDebuff') {
      return { type, target: 'all', mode: 'mult', value: '20', duration: '1' };
    }
    if (type === 'enemyDefenseBuff' || type === 'enemyDefenseDebuff') return { type, mode: 'mult', value: '20', duration: '1' };
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
  if (type === 'statusCure') {
    return `${targetSelectHtml(effect.target ?? 'all', actorIndex)}<div class="effect-note">対象の状態異常を治療</div>`;
  }
  if (type === 'statusAvoid') {
    return `
      ${targetSelectHtml(effect.target ?? 'all', actorIndex)}
      <div class="input-with-suffix compact-input"><input class="effect-value" type="number" inputmode="decimal" step="0.1" min="0" max="100" value="${escapeHtml(effect.value ?? '45')}" aria-label="状態異常耐性" /><span class="suffix">pt</span></div>
      <div class="input-with-suffix compact-input"><input class="effect-duration" type="number" inputmode="numeric" step="1" min="1" max="99" value="${escapeHtml(effect.duration ?? '3')}" aria-label="継続ターン" /><span class="suffix">ターン</span></div>`;
  }
  if (type === 'statusImmune') {
    return `
      ${targetSelectHtml(effect.target ?? 'all', actorIndex)}
      <div class="input-with-suffix compact-input"><input class="effect-duration" type="number" inputmode="numeric" step="1" min="1" max="99" value="${escapeHtml(effect.duration ?? '2')}" aria-label="継続ターン" /><span class="suffix">ターン</span></div>
      <div class="effect-note">状態異常付与を0%</div>`;
  }
  if (type === 'heal') {
    return `
      <select class="effect-mode" aria-label="回復方法">
        <option value="flat" ${effect.mode !== 'maxPercent' ? 'selected' : ''}>固定値</option>
        <option value="maxPercent" ${effect.mode === 'maxPercent' ? 'selected' : ''}>最大HP%</option>
      </select>
      <input class="effect-value" type="number" inputmode="decimal" step="0.1" min="0" value="${escapeHtml(effect.value ?? '200')}" aria-label="回復量" />`;
  }
  if (type === 'enemyBlessing') {
    return `
      <select class="effect-mode" aria-label="加護回復方法">
        <option value="attackPercent" ${!['flat','maxPercent'].includes(effect.mode) ? 'selected' : ''}>敵ATK%</option>
        <option value="flat" ${effect.mode === 'flat' ? 'selected' : ''}>固定値</option>
        <option value="maxPercent" ${effect.mode === 'maxPercent' ? 'selected' : ''}>最大HP%</option>
      </select>
      <input class="effect-value" type="number" inputmode="decimal" step="0.1" min="0" value="${escapeHtml(effect.value ?? '30')}" aria-label="加護回復量" />
      <div class="input-with-suffix compact-input"><input class="effect-duration" type="number" inputmode="numeric" step="1" min="1" max="99" value="${escapeHtml(effect.duration ?? '3')}" aria-label="継続ターン" /><span class="suffix">ターン</span></div>`;
  }
  if (type === 'enemyCounterGuard') {
    return `
      <select class="effect-attack-filter" aria-label="軽減対象">
        <option value="physical" ${(effect.attackTypes?.[0] ?? 'physical') === 'physical' ? 'selected' : ''}>物理</option>
        <option value="magic" ${effect.attackTypes?.[0] === 'magic' ? 'selected' : ''}>魔法</option>
        <option value="breath" ${effect.attackTypes?.[0] === 'breath' ? 'selected' : ''}>ブレス</option>
        <option value="other" ${effect.attackTypes?.[0] === 'other' ? 'selected' : ''}>それ以外</option>
        <option value="all" ${effect.attackTypes?.[0] === 'all' ? 'selected' : ''}>全攻撃</option>
      </select>
      <div class="input-with-suffix compact-input"><input class="effect-value" type="number" inputmode="decimal" step="0.1" min="0" max="100" value="${escapeHtml(effect.value ?? '40')}" aria-label="軽減率" /><span class="suffix">%</span></div>
      <div class="input-with-suffix compact-input"><input class="effect-duration" type="number" inputmode="numeric" step="1" min="1" max="99" value="${escapeHtml(effect.duration ?? '2')}" aria-label="継続ターン" /><span class="suffix">ターン</span></div>`;
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

function enemyAttackTargetOptionsHtml(selected = 'auto') {
  const preset = BOSS_PRESET_BY_ID.get(state.enemy?.presetId ?? '');
  const bossCount = Math.max(1, Number(preset?.enemyCount ?? 1) || 1);
  const options = [['auto', '自動（BOSS優先→残存敵）']];
  for (let i = 0; i < bossCount; i++) {
    const label = bossCount > 1 ? `${preset?.name ?? 'BOSS'} ${i + 1}` : (preset?.name ?? 'BOSS');
    options.push([String(i), label]);
  }
  if (bossCount === 1) {
    for (let i = 0; i < (preset?.companions ?? []).length; i++) {
      options.push([String(1 + i), `お供${i + 1}: ${preset.companions[i]}`]);
    }
  }
  return options.map(([value, label]) => `<option value="${escapeHtml(value)}" ${String(selected) === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('');
}

function actionCardHtml(action, turnIndex, allyIndex) {
  const actorKey = `ally${allyIndex}`;
  const randomMultiplier = action.skillMultiplierMin !== '' && action.skillMultiplierMax !== '';
  const randomHits = action.hitsMin !== '' && action.hitsMax !== '';
  const presetMeta = SKILL_PRESET_BY_ID.get(action.skillPresetId ?? '');
  const characterId = state.allies?.[allyIndex]?.characterId ?? '';
  const transformCharacter = characterId === 'son_goku' || characterId === 'gyumao';
  const fixedCharacter = Boolean(characterId && !transformCharacter);
  const fixedSkillLabel = fixedCharacterSkillLabel(allyIndex, action);
  const fixedSkillNames = fixedCharacter ? fixedCharacterSkillNames(allyIndex, action) : [];
  const selectedFixedSkill = fixedSkillNames.includes(action.fixedCharacterSkill ?? '') ? action.fixedCharacterSkill : '';
  const selectedFixedPreset = selectedFixedSkill ? SKILL_PRESET_BY_ID.get(presetIdForSkillName(selectedFixedSkill)) : null;
  const presetSelected = Boolean(action.skillPresetId);
  const actionLocked = fixedCharacter || presetSelected;
  return `
    <div class="action-card" data-turn-index="${turnIndex}" data-actor-key="${actorKey}">
      <div class="action-card-head">
        <strong>キャラ${allyIndex + 1}</strong>
        ${fixedCharacter
          ? `<span class="preset-kind-label">キャラ固定</span>`
          : presetSelected
            ? `<span class="preset-kind-label">${escapeHtml(action.kind === 'attack' ? '攻撃' : action.kind === 'buff' ? 'バフ' : action.kind === 'effect' ? '効果のみ' : action.kind === 'skip' ? '行動スキップ' : '同行動')}</span>`
            : `<select class="action-kind" aria-label="キャラ${allyIndex + 1}の基本行動">${actionKindOptions(action, turnIndex)}</select>`}
      </div>
      ${fixedCharacter ? `
        <label class="mini-field"><span>使用技（キャラ固定）</span><select class="fixed-character-skill">${fixedCharacterSkillOptionsHtml(allyIndex, action)}</select></label>
        ${selectedFixedPreset?.targetRequired ? `<label class="mini-field"><span>固定技の対象</span>${targetSelectHtml(action.presetTarget ?? `ally${allyIndex + 1}`, allyIndex, 'preset-target-select')}</label>` : ''}
        <p class="inline-note">${selectedFixedSkill
          ? `${escapeHtml(selectedFixedSkill)}を100%選択します。ルーレット抽選・リール移動・ためる・ミスはこのターンだけ行わず、現在のリール位置を保持します。`
          : `通常は ${escapeHtml(fixedSkillLabel || '技なし')} などをキャラプリセットのコマンド表から自動抽選します。リール移動・ためる・ミス等は表示を省略して内部計算します。`}</p>`
        : action.kind !== 'same' ? `
        <label class="mini-field"><span>${transformCharacter ? '変化先の技' : '技プリセット'}</span><select class="skill-preset">${skillPresetOptionsHtml(action.skillPresetId ?? '', transformCharacter ? 'transform' : 'manual')}</select></label>
        ${transformCharacter ? `<label class="mini-field"><span>混乱時の変化先（任意）</span><select class="confusion-skill-preset"><option value="">通常と同じ</option>${skillPresetOptionsHtml(action.confusionSkillPresetId ?? '', 'transform').replace('<option value="">選択してください</option>','')}</select></label>` : ''}
        ${presetMeta?.note ? `<p class="inline-note">${escapeHtml(presetMeta.note)}</p>` : ''}${presetMeta?.targetRequired ? `<label class="mini-field"><span>対象</span>${targetSelectHtml(action.presetTarget ?? `ally${allyIndex + 1}`, allyIndex, 'preset-target-select')}</label>` : ''}${presetSelected ? `<p class="inline-note">プリセット効果を自動適用します。効果内容は編集できません。</p>` : ''}` : ''}
      ${action.kind === 'attack' && (action.enemyTarget ?? presetMeta?.enemyTarget ?? 'single') === 'single' ? `<label class="mini-field"><span>攻撃対象</span><select class="enemy-target-slot">${enemyAttackTargetOptionsHtml(action.enemyTargetSlot ?? 'auto')}</select></label>` : ''}
      ${!actionLocked && action.kind === 'attack' ? `
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
      ${!actionLocked && action.kind === 'buff' ? primaryBuffHtml(action.buff, 'ally', false, allyIndex) : ''}
      ${!fixedCharacter && action.kind === 'same' ? '<p class="same-action-note">前回の同モンスターの行動内容をそのまま使用します。</p>' : ''}
      ${!actionLocked && ['attack', 'buff', 'effect'].includes(action.kind) ? `
        <div class="effects-block">
          <div class="sub-heading"><span>追加効果</span><button type="button" class="mini-add add-effect" data-side="ally">＋追加</button></div>
          <div class="effects-list">${effectsHtml(action.effects ?? [], 'ally', turnIndex, actorKey)}</div>
        </div>` : ''}
    </div>`;
}

function enemyEffectFieldsHtml(effect, enabled) {
  const disabled = enabled ? '' : 'disabled';
  if (!effect || effect.type === 'none' || effect.type === 'same') return '';
  if (String(effect.type).startsWith('status')) {
    return `<div class="enemy-effect-fields">
      <label class="mini-field target-field"><span>対象</span>${targetSelectHtml(effect.target ?? 'all', 0, 'enemy-effect-target-select', !enabled)}</label>
      <label class="mini-field"><span>技発動率</span><div class="input-with-suffix"><input class="enemy-effect-activation" type="number" inputmode="decimal" min="0" max="100" step="0.1" value="${escapeHtml(effect.activationChance ?? '100')}" ${disabled}><span class="suffix">%</span></div></label>
      <label class="mini-field"><span>付与率</span><div class="input-with-suffix"><input class="enemy-effect-chance" type="number" inputmode="decimal" min="0" max="100" step="0.1" value="${escapeHtml(effect.chance ?? '50')}" ${disabled}><span class="suffix">%</span></div></label>
      <label class="mini-field"><span>技分類</span><select class="enemy-effect-attack-type" ${disabled}>${optionsHtml(ATTACK_TYPE_OPTIONS, effect.attackType ?? 'magic')}</select></label>
      <label class="mini-field"><span>継続</span><div class="input-with-suffix"><input class="enemy-effect-duration" type="number" inputmode="numeric" min="1" max="99" step="1" value="${escapeHtml(effect.duration ?? '1')}" ${disabled}><span class="suffix">ターン</span></div></label>
    </div>`;
  }
  if (effect.type === 'heal') {
    return `<div class="enemy-effect-fields">
      <label class="mini-field"><span>回復方法</span><select class="enemy-effect-mode" ${disabled}><option value="flat" ${effect.mode !== 'maxPercent' ? 'selected' : ''}>固定値</option><option value="maxPercent" ${effect.mode === 'maxPercent' ? 'selected' : ''}>最大HP%</option></select></label>
      <label class="mini-field"><span>回復量</span><input class="enemy-effect-value" type="number" inputmode="decimal" step="0.1" min="0" value="${escapeHtml(effect.value ?? '200')}" ${disabled}></label>
    </div>`;
  }
  if (effect.type === 'enemyBlessing') {
    return `<div class="enemy-effect-fields">
      <label class="mini-field"><span>回復方法</span><select class="enemy-effect-mode" ${disabled}><option value="attackPercent" ${!['flat','maxPercent'].includes(effect.mode) ? 'selected' : ''}>敵ATK%</option><option value="flat" ${effect.mode === 'flat' ? 'selected' : ''}>固定値</option><option value="maxPercent" ${effect.mode === 'maxPercent' ? 'selected' : ''}>最大HP%</option></select></label>
      <label class="mini-field"><span>回復量</span><input class="enemy-effect-value" type="number" inputmode="decimal" step="0.1" min="0" value="${escapeHtml(effect.value ?? '30')}" ${disabled}></label>
      <label class="mini-field"><span>継続</span><div class="input-with-suffix"><input class="enemy-effect-duration" type="number" inputmode="numeric" min="1" max="99" step="1" value="${escapeHtml(effect.duration ?? '3')}" ${disabled}><span class="suffix">ターン</span></div></label>
    </div>`;
  }
  if (effect.type === 'enemyDamageReduction') {
    return `<div class="enemy-effect-fields">
      <label class="mini-field"><span>軽減率</span><div class="input-with-suffix"><input class="enemy-effect-value" type="number" inputmode="decimal" step="0.1" min="0" max="100" value="${escapeHtml(effect.value ?? '40')}" ${disabled}><span class="suffix">%</span></div></label>
      <label class="mini-field"><span>継続</span><div class="input-with-suffix"><input class="enemy-effect-duration" type="number" inputmode="numeric" min="1" max="99" step="1" value="${escapeHtml(effect.duration ?? '1')}" ${disabled}><span class="suffix">ターン</span></div></label>
      <div class="effect-note">防御バフ／デバフの後に適用する、ダメージ計算チャートの別枠軽減</div>
    </div>`;
  }
  if (effect.type === 'enemyCounterGuard') {
    const filter = effect.attackTypes?.[0] ?? 'physical';
    return `<div class="enemy-effect-fields">
      <label class="mini-field"><span>軽減対象</span><select class="enemy-effect-attack-filter" ${disabled}><option value="physical" ${filter === 'physical' ? 'selected' : ''}>物理</option><option value="magic" ${filter === 'magic' ? 'selected' : ''}>魔法</option><option value="breath" ${filter === 'breath' ? 'selected' : ''}>ブレス</option><option value="other" ${filter === 'other' ? 'selected' : ''}>それ以外</option><option value="all" ${filter === 'all' ? 'selected' : ''}>全攻撃</option></select></label>
      <label class="mini-field"><span>軽減率</span><div class="input-with-suffix"><input class="enemy-effect-value" type="number" inputmode="decimal" step="0.1" min="0" max="100" value="${escapeHtml(effect.value ?? '40')}" ${disabled}><span class="suffix">%</span></div></label>
      <label class="mini-field"><span>継続</span><div class="input-with-suffix"><input class="enemy-effect-duration" type="number" inputmode="numeric" min="1" max="99" step="1" value="${escapeHtml(effect.duration ?? '2')}" ${disabled}><span class="suffix">ターン</span></div></label>
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
  const bossPreset = BOSS_PRESET_BY_ID.get(state.enemy?.presetId ?? '');
  const activeCompanions = (bossPreset?.companions ?? []).filter(name => enemyCompanionProfile(name));
  const companionSummary = activeCompanions.length
    ? `<div class="preset-status-summary"><span>固定お供 ${activeCompanions.length}体</span><span>${escapeHtml(activeCompanions.join(' / '))}</span></div>`
    : '';
  return `
    <div class="action-card enemy-action-card" data-turn-index="${turnIndex}" data-actor-key="enemy">
      <div class="action-card-head enemy-head">
        <strong>敵</strong>
        <label class="toggle-line"><input class="enemy-enabled" type="checkbox" ${action.enabled ? 'checked' : ''}> このターン敵行動あり</label>
      </div>
      <div class="enemy-action-body ${action.enabled ? '' : 'is-disabled'}">
        ${companionSummary}
        <label class="mini-field"><span>BOSS行動効果</span>
          <select class="enemy-effect-type" ${action.enabled ? '' : 'disabled'}>${optionsHtml(choices, effect.type)}</select>
        </label>
        ${enemyEffectFieldsHtml(effect, action.enabled)}
        <p class="inline-note">BOSSコマンドは自動抽選せず、ここで指定した効果だけをBOSSの行動機会に適用します。固定お供のコマンド効果は自動計算しません。</p>
      </div>
      <p class="inline-note poison-note">純粋な敵ダメージとかばうは計算対象外です。敵EXは共有ゲージが10になった後の敵／お供の行動機会で発動し、「敵EX許容回数」を超えた回で撃破失敗として扱います。</p>
    </div>`;
}

function finalTurnCutoffOptionsHtml() {
  const options = [
    ['lastAlly', '最後の味方行動後（従来）'],
    ...Array.from({ length: state.allyCount }, (_, i) => [`ally${i + 1}`, `キャラ${i + 1}の行動機会直後`]),
    ['turnEnd', 'ターン終了まで（毒・猛毒判定を含む）']
  ];
  return options.map(([value, label]) => `<option value="${value}" ${state.finalTurnCutoff === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('');
}

function finalTurnCutoffControlHtml(turnIndex) {
  if (turnIndex !== state.turns.length - 1) return '';
  return `
    <div class="final-turn-cutoff-box">
      <label class="mini-field"><span>このターンの計算終了位置</span><select id="finalTurnCutoff">${finalTurnCutoffOptionsHtml()}</select></label>
      <p class="inline-note">選択したキャラの行動機会直後で計算を止めます。敵行動は手動入力した効果だけを実行し、敵・お供の行動機会では毒・猛毒と敵EX判定も処理します。行動順は各確率分岐のターン開始時の素早さで判定します。</p>
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
      ${finalTurnCutoffControlHtml(turnIndex)}
      <div class="turn-action-list">
        ${Array.from({ length: state.allyCount }, (_, i) => actionCardHtml(turn.allyActions[i], turnIndex, i)).join('')}
        ${enemyActionHtml(turn.enemyAction ?? { enabled:false, effect:{ type:'none' } }, turnIndex)}
      </div>
    </section>`;
}

function resultHtml(result, error = '', dirty = false) {
  if (error) {
    return `
      <section class="result-panel kill-result has-error" id="killResultPanel">
        <div class="result-card kill-result-main"><span class="result-label">撃破確率</span><strong class="result-number">—</strong></div>
        <div class="result-meta"><span class="error-text">${escapeHtml(error)}</span></div>
      </section>`;
  }
  if (!result) {
    return `
      <section class="result-panel kill-result pending-result" id="killResultPanel">
        <div class="result-card kill-result-main"><span class="result-label">撃破確率</span><strong class="result-number">—</strong></div>
        <div class="result-card kill-verdict-card"><span class="result-label">判定</span><strong class="kill-verdict">未計算</strong></div>
        <div class="result-meta">入力後は自動計算しません。「計算」ボタンを押した時だけ計算します。</div>
      </section>`;
  }
  const pct = result.killChance * 100;
  const pctText = pct > 0 && pct < 0.01 ? '<0.01%' : `${pct.toFixed(2)}%`;
  const verdict = pct >= 100 - 1e-10 ? '確定撃破' : pct <= 1e-12 ? '撃破不可' : '確率撃破';
  const finalOrder = result.finalOrder.map(a => a.side === 'enemy' ? `BOSS(${a.speed})` : a.side === 'companion' ? `${a.name ?? 'お供'}(${a.speed})` : `キャラ${a.index + 1}(${a.speed})`).join(' → ');
  const missingProfiles = [...new Set((result.missingCommandProfiles ?? []).map(x => {
    const [id, skill] = String(x).split(':');
    return `${CHARACTER_BY_ID.get(id)?.name ?? id}（${skill ?? ''}）`;
  }))];
  const missingHtml = missingProfiles.length ? `<div class="result-meta error-text">コマンド内訳未登録のため設定技を100%実行扱い: ${escapeHtml(missingProfiles.join('、'))}</div>` : '';
  const missingEffects = [...new Set(result.missingCommandEffects ?? [])];
  const missingEffectsHtml = missingEffects.length ? `<div class="result-meta error-text">技効果未登録のためダメージ・効果なし扱い: ${escapeHtml(missingEffects.join('、'))}</div>` : '';
  const missingEnemyHtml = result.missingEnemyCommandProfile
    ? `<div class="result-meta error-text">このボスはBOSSコマンド自動計算が未登録です。BOSSは各ターンの「敵行動効果」を手動設定した範囲だけ反映します。</div>` : '';
  const missingCompanions = [...new Set(result.missingCompanionCommandProfiles ?? [])];
  const missingCompanionHtml = missingCompanions.length
    ? `<div class="result-meta error-text">お供コマンド未登録（行動は未計算）: ${escapeHtml(missingCompanions.join('、'))}</div>` : '';
  const inheritedCompanions = [...new Set(result.inheritedCompanionCommandBaselines ?? [])];
  const inheritedCompanionHtml = inheritedCompanions.length
    ? `<div class="result-meta">継承個体のお供は、進化元の入手時初期コマンドを基準に計算: ${escapeHtml(inheritedCompanions.join('、'))}</div>` : '';
  const selectedBossPreset = BOSS_PRESET_BY_ID.get(state.enemy?.presetId ?? '');
  const fixedCompanionApproximation = (selectedBossPreset?.companions ?? []).length > 0 && Math.max(1, Number(selectedBossPreset?.enemyCount ?? 1) || 1) === 1;
  const fixedCompanionApproximationHtml = fixedCompanionApproximation
    ? `<div class="result-meta"><strong>概算・近似:</strong> 最初から出現するお供はCPU個体のコマンド構成がランダムなため、入手時初期コマンド相当を仮定して計算しています。</div>` : '';
  const activeCompanions = [...new Set(result.activeCompanionCommandProfiles ?? [])];
  const companionHtml = activeCompanions.length
    ? `<div class="result-meta">お供自動行動: ${escapeHtml(activeCompanions.join('、'))}</div>` : '';
  const precomputedExactHtml = result.precomputedExact
    ? `<div class="result-meta"><strong>高速計算:</strong> 入力が検証済み標準Wikiチャートと完全一致したため、汎用エンジンで事前計算・回帰固定した厳密結果を再利用しています。入力を変更すると通常計算へ戻ります。</div>`
    : '';
  const exFail = Math.max(0, Math.min(1, Number(result.enemyExFailureChance ?? 0) || 0));
  const exAllowance = Math.max(0, Math.trunc(Number(result.enemyExAllowance ?? state.enemy?.enemyExAllowance ?? 0) || 0));
  const exFailHtml = exFail > 1e-12
    ? `<div class="result-meta error-text">敵EX ${exAllowance + 1}回目以降による周回失敗: ${(exFail * 100).toFixed(2)}%</div>`
    : `<div class="result-meta">敵EX許容回数: ${exAllowance}回（${exAllowance + 1}回目で失敗） / EX失敗: 0.00%</div>`;
  const enemyModeHtml = `<div class="result-meta"><strong>敵行動: 手動入力</strong> — BOSSは各ターンで指定した効果だけを実行します。固定お供はコマンド自動抽選なし。毒・猛毒と共有敵EX判定は行動機会で処理します。敵EXは設定した許容回数を超えた回で失敗にします。</div>`;
  const skillRows = [];
  (result.allySkillActivation ?? []).forEach((turn, ti) => turn.forEach((skills, ai) => {
    for (const [name, prob] of Object.entries(skills ?? {})) {
      if (prob > 1e-8) skillRows.push(`<div class="timeline-row"><span>T${ti + 1} キャラ${ai + 1} ${escapeHtml(name)}</span><strong>${(prob * 100).toFixed(2)}%</strong><small>実際に発動</small></div>`);
    }
  }));
  const statusNames = { paralysis:'麻痺', confusion:'混乱', silence:'沈黙', darkness:'暗闇', sleep:'睡眠', petrification:'石化', cold:'風邪', brainwash:'洗脳' };
  const statusRows = [];
  (result.statusSummaryByTurn ?? []).forEach((allies, ti) => allies.forEach((st, ai) => {
    const parts = Object.entries(statusNames).filter(([key]) => (st?.[key] ?? 0) > 1e-8).map(([key,label]) => `${label} ${(st[key] * 100).toFixed(2)}%`);
    if (parts.length) statusRows.push(`<div class="timeline-row"><span>T${ti + 1} キャラ${ai + 1}</span><strong>${escapeHtml(parts.join(' / '))}</strong><small>ターン終了時</small></div>`);
  }));
  const probabilityDetails = (skillRows.length || statusRows.length) ? `<details class="timeline-details"><summary>発動率・状態異常率</summary><div class="timeline-list">${skillRows.join('')}${statusRows.join('')}</div></details>` : '';
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
      <div class="result-meta">計算終了: ${escapeHtml(result.finalTurnCutoffLabel ?? '最後の味方行動直後')}</div>
      ${precomputedExactHtml}
      ${dirty ? '<div class="result-meta error-text"><strong>入力変更あり:</strong> 表示中の結果は前回計算時のものです。再計算してください。</div>' : ''}
      ${enemyModeHtml}
      ${exFailHtml}
      ${missingHtml}
      ${missingEffectsHtml}
      ${probabilityDetails}
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
    return { result: simulateKillProbabilityEnemyManual(state), error: '' };
  } catch (e) {
    return { result: null, error: e.message };
  }
}

let lastCalculation = { result: null, error: '', dirty: true };

function markCalculationDirty() {
  lastCalculation.dirty = true;
  const old = root.querySelector('#killResultPanel');
  if (old) old.outerHTML = resultHtml(lastCalculation.result, lastCalculation.error, true);
}

function runCalculation() {
  collectStateFromDom();
  saveState();
  const started = performance.now();
  const next = calculate();
  lastCalculation = { ...next, dirty: false, elapsedMs: performance.now() - started };
  const old = root.querySelector('#killResultPanel');
  if (old) old.outerHTML = resultHtml(lastCalculation.result, lastCalculation.error, false);
  const timeline = root.querySelector('#timelineContainer');
  if (timeline) timeline.innerHTML = timelineHtml(lastCalculation.result);
  const meta = root.querySelector('#calculationTiming');
  if (meta) meta.textContent = lastCalculation.error ? '' : `計算時間: ${(lastCalculation.elapsedMs / 1000).toFixed(3)}秒`;
}

function render() {
  const { result, error, dirty } = lastCalculation;
  root.innerHTML = `
    ${resultHtml(result, error, dirty)}

    <section class="panel">
      <h2>敵</h2>
      <label class="field boss-preset-field"><span class="field-label">ボスプリセット</span><select id="bossPreset">${bossPresetOptionsHtml(state.enemy.presetId ?? '')}</select></label>
      ${bossPresetInfoHtml(state.enemy.presetId ?? '')}
      <div class="field-grid">
        <label class="field"><span class="field-label">HP</span><input id="enemyHp" type="number" inputmode="numeric" min="1" step="1" value="${escapeHtml(state.enemy.maxHp)}"></label>
        <label class="field"><span class="field-label">属性</span><select id="enemyAttribute">${optionsHtml(ENEMY_ATTRIBUTE_OPTIONS, state.enemy.attribute)}</select></label>
        <label class="field"><span class="field-label">種族</span><select id="enemyRace">${optionsHtml(ENEMY_RACE_OPTIONS, state.enemy.race)}</select></label>
        <label class="field"><span class="field-label">素早さ</span><input id="enemySpeed" type="number" inputmode="decimal" min="0" step="0.1" value="${escapeHtml(state.enemy.speed)}"></label>
        <label class="field"><span class="field-label">敵EX許容回数</span><input id="enemyExAllowance" type="number" inputmode="numeric" min="0" max="99" step="1" value="${escapeHtml(state.enemy.enemyExAllowance ?? '0')}"></label>
      </div>
      <p class="panel-note">この公開版は敵行動を手動入力します。BOSSプリセットを選んでも敵コマンドは自動抽選せず、各ターンで指定した防御バフ／デバフ、防御アップ、攻撃／素早さデバフ、回復などだけを実行します。固定お供のコマンド効果は自動計算しませんが、毒・猛毒と共有敵EXの発動タイミングとして行動機会は残します。敵EXは「敵EX許容回数」を超えた回（0なら1回目、1なら2回目）で撃破失敗にします。</p>
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
            ${(state.allies[i].characterId === 'son_goku' || state.allies[i].characterId === 'gyumao') ? `
              <label class="mini-field"><span>七十二変化 コマンド型</span><select class="ally-command-variant">
                <option value="stop1" ${state.allies[i].commandVariant === 'stop1' ? 'selected' : ''}>1止め</option>
                <option value="stop2" ${state.allies[i].commandVariant === 'stop2' ? 'selected' : ''}>2止め</option>
                <option value="stop24" ${state.allies[i].commandVariant === 'stop24' ? 'selected' : ''}>2-4止め</option>
                <option value="stop3" ${state.allies[i].commandVariant === 'stop3' ? 'selected' : ''}>3止め</option>
                <option value="forward4" ${!['stop1','stop2','stop24','stop3'].includes(state.allies[i].commandVariant) ? 'selected' : ''}>4送り</option>
              </select></label>` : ''}
            ${state.allies[i].characterId === 'mimitoshishi' ? `
              <label class="mini-field"><span>コマンド型</span><select class="ally-command-variant">
                <option value="attack6" ${state.allies[i].commandVariant === 'attack6' ? 'selected' : ''}>こうげき！×6</option>
                <option value="mixed" ${state.allies[i].commandVariant !== 'attack6' ? 'selected' : ''}>こうげき！×2＋プチ・アイスストーム×4</option>
              </select></label>` : ''}
            ${state.allies[i].characterId === 'red_empress' ? `
              <label class="mini-field"><span>コマンド型</span><select class="ally-command-variant">
                <option value="support" ${state.allies[i].commandVariant === 'support' ? 'selected' : ''}>① 今まで通り</option>
                <option value="critical5" ${state.allies[i].commandVariant === 'critical5' ? 'selected' : ''}>② 3R 会心×5＋こうげき！×1 / 4R 会心×6</option>
                <option value="critical4" ${state.allies[i].commandVariant === 'critical4' ? 'selected' : ''}>③ 3R 会心×4＋こうげき！×2 / 4R 会心×6</option>
              </select></label>` : ''}
            ${['gate_dante','yamato','susanoo','nanawarai','ginger_ale','fire_drake'].includes(state.allies[i].characterId) ? `
              <label class="mini-field"><span>コマンド型</span><select class="ally-command-variant">
                <option value="default" ${state.allies[i].commandVariant !== 'attack1' ? 'selected' : ''}>通常型</option>
                <option value="attack1" ${state.allies[i].commandVariant === 'attack1' ? 'selected' : ''}>こうげき！1止め</option>
              </select></label>` : ''}
            ${state.allies[i].characterId === 'soccerra' ? `
              <label class="mini-field"><span>コマンド型</span><select class="ally-command-variant">
                <option value="default" ${state.allies[i].commandVariant !== 'deadly3' ? 'selected' : ''}>通常型</option>
                <option value="deadly3" ${state.allies[i].commandVariant === 'deadly3' ? 'selected' : ''}>必殺の一撃3止め</option>
              </select></label>` : ''}
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
            <label class="mini-field"><span>種族</span><select class="ally-race">${optionsHtml(ENEMY_RACE_OPTIONS, state.allies[i].race ?? 'normal')}</select></label>
          </div>`).join('')}
      </div>
    </section>

    <section class="panel rule-note-panel">
      <h2>現在の暫定ルール</h2>
      <p>味方はコマンド6枠を抽選し、リール移動を含めて実際に止まった技を実行します。敵はBOSS行動効果を各ターン手動指定し、プリセットの敵コマンド自動抽選は行いません。固定お供・複数BOSSは個別HPを持つ撃破対象として追跡し、毒・猛毒と共有敵EX判定は各自の行動機会で処理します。行動順は各ターン開始時の素早さで固定します。</p>
    </section>


    <div class="calculation-control panel">
      <button type="button" class="primary-button calculate-button" id="calculateKill">計算</button>
      <span id="calculationTiming" class="result-meta">${lastCalculation.elapsedMs != null && !lastCalculation.dirty ? `計算時間: ${(lastCalculation.elapsedMs / 1000).toFixed(3)}秒` : ''}</span>
      <p class="panel-note">入力変更だけでは撃破確率を再計算しません。設定が終わってから「計算」を押してください。</p>
    </div>

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
  state.enemy.presetId = root.querySelector('#bossPreset')?.value ?? state.enemy.presetId ?? '';
  state.enemy.maxHp = root.querySelector('#enemyHp')?.value ?? state.enemy.maxHp;
  state.enemy.attribute = root.querySelector('#enemyAttribute')?.value ?? state.enemy.attribute;
  state.enemy.race = root.querySelector('#enemyRace')?.value ?? state.enemy.race;
  state.enemy.attack = root.querySelector('#enemyAttack')?.value ?? state.enemy.attack ?? '0';
  state.enemy.speed = root.querySelector('#enemySpeed')?.value ?? state.enemy.speed;
  state.enemy.enemyExAllowance = root.querySelector('#enemyExAllowance')?.value ?? state.enemy.enemyExAllowance ?? '0';
  state.allyCount = Number(root.querySelector('#allyCount')?.value ?? state.allyCount);
  state.finalTurnCutoff = root.querySelector('#finalTurnCutoff')?.value ?? state.finalTurnCutoff ?? 'lastAlly';
  if (/^ally([1-3])$/.test(state.finalTurnCutoff)) {
    const index = Number(state.finalTurnCutoff.slice(4));
    if (index > state.allyCount) state.finalTurnCutoff = 'lastAlly';
  }

  root.querySelectorAll('.ally-card').forEach(card => {
    const i = Number(card.dataset.allyIndex);
    state.allies[i].characterId = card.querySelector('.ally-character')?.value ?? state.allies[i].characterId ?? '';
    state.allies[i].attack = card.querySelector('.ally-attack')?.value ?? state.allies[i].attack;
    state.allies[i].speed = card.querySelector('.ally-speed')?.value ?? state.allies[i].speed;
    state.allies[i].star = card.querySelector('.ally-star')?.value ?? state.allies[i].star ?? '';
    state.allies[i].attribute = card.querySelector('.ally-attribute')?.value ?? state.allies[i].attribute ?? '';
    state.allies[i].race = card.querySelector('.ally-race')?.value ?? state.allies[i].race ?? 'normal';
    state.allies[i].commandVariant = card.querySelector('.ally-command-variant')?.value ?? state.allies[i].commandVariant ?? '';
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
      const activationChance = card.querySelector('.enemy-effect-activation')?.value;
      const chance = card.querySelector('.enemy-effect-chance')?.value;
      const attackType = card.querySelector('.enemy-effect-attack-type')?.value;
      const attackFilter = card.querySelector('.enemy-effect-attack-filter')?.value;
      if (target !== undefined) effect.target = target;
      if (mode !== undefined) effect.mode = mode;
      if (value !== undefined) effect.value = value;
      if (duration !== undefined) effect.duration = duration;
      if (activationChance !== undefined) effect.activationChance = activationChance;
      if (chance !== undefined) effect.chance = chance;
      if (attackType !== undefined) effect.attackType = attackType;
      if (attackFilter) effect.attackTypes = attackFilter === 'all' ? ['physical','magic','breath','other'] : [attackFilter];
      action.effect = effect;
    } else {
      const allyIndex = Number(actorKey.replace('ally', ''));
      const action = state.turns[turnIndex].allyActions[allyIndex];
      const fixedCharacterSkill = card.querySelector('.fixed-character-skill')?.value;
      if (fixedCharacterSkill !== undefined) action.fixedCharacterSkill = fixedCharacterSkill;
      const selectedPresetId = card.querySelector('.skill-preset')?.value ?? action.skillPresetId ?? '';
      action.skillPresetId = selectedPresetId;
      const confusionPresetId = card.querySelector('.confusion-skill-preset')?.value;
      if (confusionPresetId !== undefined) action.confusionSkillPresetId = confusionPresetId;
      const presetTargetCode = card.querySelector('.preset-target-select')?.value;
      if (presetTargetCode) action.presetTarget = targetFromCode(presetTargetCode)[0] ?? action.presetTarget;
      const enemyTargetSlot = card.querySelector('.enemy-target-slot')?.value;
      if (enemyTargetSlot !== undefined) action.enemyTargetSlot = enemyTargetSlot;
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
  for (const turn of state.turns) {
    turn.enemyAction ??= { enabled:false, effect: { type: 'none' } };
  }
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
    const attackFilter = row.querySelector('.effect-attack-filter')?.value;
    const expiry = row.dataset.effectExpiry;
    if (target !== undefined) effect.target = target;
    if (mode !== undefined) effect.mode = mode;
    if (value !== undefined) effect.value = value;
    if (duration !== undefined) effect.duration = duration;
    if (attackFilter) effect.attackTypes = attackFilter === 'all' ? ['physical','magic','breath','other'] : [attackFilter];
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
  lastCalculation.dirty = true;
  render();
}

function updateResultOnly() {
  markCalculationDirty();
}


let state = loadState();
render();

root.addEventListener('input', event => {
  if (!(event.target instanceof HTMLInputElement)) return;
  collectStateFromDom();
  saveState();
  markCalculationDirty();
});

root.addEventListener('change', event => {
  if (!(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLSelectElement)) return;
  if (event.target.id === 'bossPreset') {
    collectStateFromDom();
    state.enemy = applyBossPresetToEnemy(state.enemy, event.target.value);
    applyEnemyAttributeDependentPresets();
  } else if (event.target.classList.contains('ally-character')) {
    const card = event.target.closest('.ally-card');
    const allyIndex = Number(card?.dataset.allyIndex);
    if (Number.isInteger(allyIndex)) applyCharacterPreset(allyIndex, event.target.value);
  } else if (event.target.classList.contains('ally-command-variant')) {
    collectStateFromDom();
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
    // 手動で属性を変更した場合、選択中プリセットとの一致は解除する。
    state.enemy.presetId = '';
    applyEnemyAttributeDependentPresets();
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
    event.target.id === 'bossPreset' ||
    event.target.id === 'enemyRace' ||
    event.target.id === 'enemyAttribute' ||
    event.target.classList.contains('action-kind') ||
    event.target.classList.contains('skill-preset') ||
    event.target.classList.contains('enemy-enabled') ||
    event.target.classList.contains('enemy-effect-type') ||
    event.target.classList.contains('ally-character') ||
    event.target.classList.contains('ally-command-variant') ||
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

  if (button.id === 'calculateKill') {
    runCalculation();
    return;
  }

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
  lastCalculation = { result: null, error: '', dirty: true };
  saveState();
  render();
});
