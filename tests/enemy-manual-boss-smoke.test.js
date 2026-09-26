import assert from 'node:assert/strict';
import { cloneDefaultState, simulateKillProbabilityEnemyManual } from '../kill/engine.js';
import { BOSS_PRESETS, applyBossPresetToEnemy } from '../kill/boss-presets.js';

let maxMs = 0;
let slowest = '';
for (const preset of BOSS_PRESETS) {
  const s = cloneDefaultState();
  s.enemy = applyBossPresetToEnemy(s.enemy, preset.id);
  s.allyCount = 1;
  s.allies[0] = { characterId:'', attack:'1', speed:'999', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns = [{
    allyActions:[{ kind:'skip', skillName:'', effects:[] }],
    enemyAction:{ enabled:true, effect:{ type:'none' } }
  }];
  s.finalTurnCutoff = 'turnEnd';

  const start = performance.now();
  const r = simulateKillProbabilityEnemyManual(s);
  const elapsed = performance.now() - start;
  if (elapsed > maxMs) { maxMs = elapsed; slowest = preset.id; }

  assert.ok(Number.isFinite(r.killChance), `${preset.id}: non-finite killChance`);
  assert.ok((r.enemySkillActivation ?? []).every(turn => Object.keys(turn ?? {}).length === 0),
    `${preset.id}: preset/companion command leaked into manual mode`);
}

console.log(`enemy-manual-boss-smoke.test.js: OK (${BOSS_PRESETS.length} presets, max ${maxMs.toFixed(3)} ms: ${slowest})`);
