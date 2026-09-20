import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SKILL_PRESETS,
  caminekoPresetForEnemy,
  darkBahamutPresetForEnemy,
  presetIdForSkillName
} from '../kill/presets.js';

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

// CHARACTER_PRESETS に書かれた固定技は、すべて表示可能な技プリセットへ解決できること。
const uiSource = fs.readFileSync(new URL('../kill/ui.js', import.meta.url), 'utf8');
const characterBlock = uiSource.match(/const CHARACTER_PRESETS = Object\.freeze\(\[(.*?)\n\]\);/s)?.[1] ?? '';
const skillNames = [...characterBlock.matchAll(/(?:^|[,\s])(?:skill|secondSkill):\s*'([^']+)'/g)].map(m => m[1]);
for (const name of new Set(skillNames)) {
  if (name === '行動スキップ' || name.includes('敵属性で選択')) continue;
  const id = presetIdForSkillName(name);
  assert.ok(id, `${name} should resolve to a preset`);
  assert.equal(byId.get(id)?.major, true, `${name} should be visible in the preset selector`);
}

for (const attr of ['fire', 'water', 'earth', 'wind']) {
  const caminekoId = caminekoPresetForEnemy(attr);
  assert.equal(byId.get(caminekoId)?.majorGroup, 'other', `camineko ${attr} skill should be under その他`);
  const darkBahamutId = darkBahamutPresetForEnemy(attr);
  assert.equal(byId.get(darkBahamutId)?.major, true, `dark bahamut ${attr} skill should be visible`);
}

assert.ok(uiSource.includes("applySkillPresetToAction(action, SKIP_ACTION_PRESET);"), 'character skip should select 行動スキップ');
assert.ok(!uiSource.includes("if (SKILL_PRESET_BY_ID.get(presetId)?.major !== true) action.skillPresetId = '';"), 'auto-selected character skills should retain preset selection');

console.log('kill presets: OK');
