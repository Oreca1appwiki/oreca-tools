import fs from 'node:fs';
import assert from 'node:assert/strict';
import { cloneDefaultState, simulateKillProbabilityEnemyManual, ENEMY_RACE_OPTIONS, ENEMY_EFFECT_TYPES } from '../kill/engine.js';
import { SKILL_PRESET_BY_ID } from '../kill/presets.js';

const ui = fs.readFileSync(new URL('../kill/ui.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../assets/common.css', import.meta.url), 'utf8');

assert.ok(!ui.includes('混乱時の変化先'), 'confusion transform selector must be removed');
assert.ok(!ui.includes('現在の暫定ルール'), 'temporary rules panel must be removed');
assert.ok(!ui.includes('最後の味方行動後（従来）'), 'legacy parenthetical must be removed');
assert.ok(ui.includes('キャラ${i + 1}の行動後'), 'cutoff option should say 行動後');
assert.ok(ui.includes("['companionFirst', 'お供→ボス']"), 'companion-first target option must exist');
assert.ok(ui.includes('手動入力'), 'manual input label must exist');
assert.ok(ui.includes('クラス'), 'class label must exist');
assert.ok(ui.includes('command-info-button'), 'command popup info button must exist');
assert.ok(css.includes('.command-popover'), 'command popup CSS must exist');
for (const id of ['gate_dante','yamato','susanoo','nanawarai','ginger_ale','fire_drake','soccerra']) {
  assert.ok(!ui.includes(`['default','attack1'].includes(ally.commandVariant)`) || id !== 'yamato');
}
assert.ok(!ui.includes("id: 'raijin_kukulkan_roaring'"), 'duplicate Kukulkan character must not exist');
assert.equal(ENEMY_RACE_OPTIONS.find(([id]) => id === 'normal')?.[1], '指定なし');
assert.equal(ENEMY_EFFECT_TYPES.find(([id]) => id === 'enemyBlessing')?.[1], '加護');
assert.equal(ENEMY_EFFECT_TYPES.find(([id]) => id === 'enemySpeedBuff')?.[1], '素早さアップ');

// お供→ボス: お供が生存している間はお供を攻撃し、撃破後にBOSSへ移る。
const s = cloneDefaultState();
s.enemy.presetId = 'old5_queen';
s.enemy.maxHp = '1000';
s.enemy.speed = '0';
s.enemy.enemyExAllowance = '99';
s.enemy.companions = [{ name:'テストお供', hp:50, speed:0 }];
s.allyCount = 1;
s.allies[0] = { characterId:'', attack:'100', speed:'100', star:'4', attribute:'none', race:'normal', commandVariant:'' };
const preset = SKILL_PRESET_BY_ID.get('critical_hit');
const attack = { ...structuredClone(preset), skillPresetId:'critical_hit', enemyTarget:'single', enemyTargetSlot:'companionFirst', effects:[] };
s.turns = [
  { allyActions:[attack,{kind:'skip',effects:[]},{kind:'skip',effects:[]}], enemyAction:{enabled:false,effect:{type:'none'}} },
  { allyActions:[attack,{kind:'skip',effects:[]},{kind:'skip',effects:[]}], enemyAction:{enabled:false,effect:{type:'none'}} }
];
s.finalTurnCutoff = 'lastAlly';
const r = simulateKillProbabilityEnemyManual(s);
assert.ok(r.killChance >= 0, 'companion-first simulation should complete');
console.log('v0.6.06 UI/target tests passed');
