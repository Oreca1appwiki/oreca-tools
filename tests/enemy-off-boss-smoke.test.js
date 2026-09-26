import assert from 'node:assert/strict';
import { cloneDefaultState, simulateKillProbabilityEnemyOff } from '../kill/engine.js';
import { BOSS_PRESETS, applyBossPresetToEnemy } from '../kill/boss-presets.js';

for (const preset of BOSS_PRESETS) {
  const s = cloneDefaultState();
  s.enemy = applyBossPresetToEnemy(s.enemy, preset.id);
  s.allyCount = 1;
  s.allies[0] = { characterId:'', attack:'1', speed:'999', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns = [{
    allyActions:[{ kind:'skip', skillName:'', effects:[] }],
    // Deliberately ON in input: the public wrapper must force it OFF.
    enemyAction:{ enabled:true, effect:{ type:'enemyDefenseBuff', mode:'mult', value:'99', duration:'99' } }
  }];
  s.finalTurnCutoff = 'turnEnd';
  const r = simulateKillProbabilityEnemyOff(s);
  assert.ok(Number.isFinite(r.killChance), `${preset.id}: non-finite killChance`);
  assert.equal(r.enemyExFailureChance ?? 0, 0, `${preset.id}: enemy EX leaked into OFF mode`);
  assert.ok((r.enemySkillActivation ?? []).every(turn => Object.keys(turn ?? {}).length === 0), `${preset.id}: enemy command leaked into OFF mode`);
}

console.log(`enemy-off-boss-smoke.test.js: OK (${BOSS_PRESETS.length} presets)`);
