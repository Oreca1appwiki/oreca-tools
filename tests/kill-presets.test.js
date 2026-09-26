import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SKILL_PRESETS,
  caminekoPresetForEnemy,
  darkBahamutPresetForEnemy,
  presetIdForSkillName
} from '../kill/presets.js';
import { COMMAND_PROFILES, commandSkillNamesForCharacter, isTransformSkillPresetId } from '../kill/commands.js';

const byId = new Map(SKILL_PRESETS.map(p => [p.id, p]));
const otherIds = [
  'foot_sweep', 'shibire_giri', 'attack_bang', 'dragon_tail',
  'aqua_breath', 'shining_breath', 'fire1', 'ice1', 'thunder1', 'meteor',
  'purifying_flame', 'shiden', 'critical_hit'
];
for (const id of otherIds) {
  const preset = byId.get(id);
  assert.ok(preset, `${id} should exist`);
  assert.equal(preset.major, true, `${id} should be selectable`);
  assert.equal(preset.majorGroup, 'other', `${id} should appear under その他`);
}

// CHARACTER_PRESETS に書かれた固定技は、UIで選択させなくても内部プリセットへ解決できること。
const uiSource = fs.readFileSync(new URL('../kill/ui.js', import.meta.url), 'utf8');
const characterBlock = uiSource.match(/const CHARACTER_PRESETS = Object\.freeze\(\[(.*?)\n\]\);/s)?.[1] ?? '';
const skillNames = [...characterBlock.matchAll(/(?:^|[,\s])(?:skill|secondSkill):\s*'([^']+)'/g)].map(m => m[1]);
for (const name of new Set(skillNames)) {
  if (name === '行動スキップ' || name.includes('敵属性で選択')) continue;
  const id = presetIdForSkillName(name);
  assert.ok(id, `${name} should resolve to a preset`);
  assert.ok(byId.get(id), `${name} preset should exist`);
}

for (const attr of ['fire', 'water', 'earth', 'wind']) {
  const caminekoId = caminekoPresetForEnemy(attr);
  assert.equal(byId.get(caminekoId)?.majorGroup, 'other', `camineko ${attr} skill should be under その他`);
  const darkBahamutId = darkBahamutPresetForEnemy(attr);
  assert.equal(byId.get(darkBahamutId)?.major, true, `dark bahamut ${attr} skill should be visible`);
}

assert.ok(uiSource.includes("applySkillPresetToAction(action, SKIP_ACTION_PRESET);"), 'character skip should select 行動スキップ');
assert.ok(!uiSource.includes("if (SKILL_PRESET_BY_ID.get(presetId)?.major !== true) action.skillPresetId = '';"), 'auto-selected character skills should retain preset selection');


// v0.5.68: キャラ固定コマンドは複数技を / 区切り表示する。
assert.deepEqual(commandSkillNamesForCharacter('chibimuus', 'こうげき！'), ['こうげき！', '会心の一撃']);
assert.deepEqual(commandSkillNamesForCharacter('mimitoshishi', 'こうげき！', 'mixed'), ['こうげき！', 'プチ・アイスストーム']);
assert.deepEqual(commandSkillNamesForCharacter('marduk', '会心の一撃'), ['こうげき！', '会心の一撃', '必殺の一撃']);
assert.deepEqual(commandSkillNamesForCharacter('red_empress', '行動スキップ', 'critical5'), ['王女のせいえん', '女王のごほうび', '会心の一撃', 'こうげき！']);

// 変化用セレクタには変化先として実装済みの技だけを入れる。
assert.equal(isTransformSkillPresetId('critical_hit'), true);
assert.equal(isTransformSkillPresetId('loki_brand'), true);
assert.equal(isTransformSkillPresetId('petit_ice_storm'), false);
assert.ok(uiSource.includes('使用技（キャラ固定）'), 'fixed character skill display should exist');
assert.ok(uiSource.includes("transformCharacter ? '変化先の技' : '技プリセット'"), 'transform picker should be separated from fixed character display');



// v0.5.72: 雷神竜ククルカン〖轟く稲妻〗型を独立プリセットとして保持する。
assert.deepEqual(COMMAND_PROFILES.raijin_kukulkan_roaring[0], ['はばたき','★→★★','★→★★','★→★★','★→★★','★→★★']);
assert.deepEqual(COMMAND_PROFILES.raijin_kukulkan_roaring[3], Array(6).fill('轟く稲妻'));
assert.ok(!uiSource.includes("id: 'raijin_kukulkan_roaring'"), 'roaring lightning Kukulkan must be merged into the main preset');
assert.ok(uiSource.includes("['peck','つつきまくり型'], ['roaring','轟く稲妻型']"), 'Kukulkan type selector should expose both command types');

// v0.5.71: 攻撃対象分類の回帰監査。
for (const id of [
  'ikazuchi', 'venom_salamanda', 'headwind', 'melting_breath', 'foot_sweep',
  'purifying_flame', 'petit_ice_storm', 'flutter', 'salamanda_hidden', 'fire_storm_hidden'
]) {
  assert.equal(byId.get(id)?.enemyTarget, 'all', `${id} should target all living enemies`);
}
for (const id of [
  'ninja_wind', 'ninja_fire', 'ninja_water', 'crush', 'peck_many', 'wet_slicer',
  'roaring_lightning', 'poison_crush', 'kamaitachi', 'tatsumaki', 'shout', 'rengeki',
  'ice_storm_strike', 'epidemic_glass'
]) {
  assert.equal(byId.get(id)?.enemyTarget, 'random', `${id} should retarget randomly on each hit`);
}
for (const id of ['dark_fire', 'meteor', 'marking_arrow', 'shibire_giri']) {
  assert.equal(byId.get(id)?.enemyTarget, 'single', `${id} should remain single-target`);
}
for (const id of [
  'red_fire_breath', 'blue_aqua_breath', 'yellow_earth_breath', 'green_air_breath',
  'fire_ice_breath2', 'melting_breath', 'aqua_breath', 'shining_breath',
  'clear_aqua_breath', 'gold_breath', 'light_breath', 'hellfire_breath', 'extreme_flame_breath'
]) {
  assert.equal(byId.get(id)?.attackType, 'breath', `${id} should use breath classification`);
}

console.log('kill presets: OK');

// v0.5.69: 固定キャラの技候補から1技だけを手動固定できるUI。
assert.ok(uiSource.includes('fixed-character-skill'), 'fixed character skill selector should exist');
assert.ok(uiSource.includes('だけに固定'), 'fixed character skill selector should expose per-skill fixed choices');
assert.ok(uiSource.includes('自動抽選（'), 'fixed character selector should keep automatic command-roll mode');
