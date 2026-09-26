import assert from 'node:assert/strict';
import {
  cloneDefaultState,
  simulateKillProbability,
  simulateKillProbabilityEnemyManual,
  simulateKillProbabilityEnemyOff,
  ENEMY_EFFECT_TYPES,
  attackDamageDistribution
} from '../kill/engine.js';
import { applyBossPresetToEnemy } from '../kill/boss-presets.js';

function approx(actual, expected, eps = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= eps, `expected ${expected}, got ${actual}`);
}

function basicPresetState(presetId = 'old0_quicksilver') {
  const s = cloneDefaultState();
  s.enemy = applyBossPresetToEnemy(s.enemy, presetId);
  s.allyCount = 1;
  s.allies[0] = { characterId:'', attack:'100', speed:'10', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns = [{
    allyActions:[{ kind:'attack', skillName:'test', skillMultiplier:'100', attackAttribute:'none', attackType:'physical', hits:'1', effects:[] }],
    enemyAction:{ enabled:true, effect:{ type:'none' } }
  }];
  s.finalTurnCutoff = 'turnEnd';
  return s;
}

// 1) Preset BOSS commands must not auto-roll in manual mode.
{
  const s = cloneDefaultState();
  s.enemy = applyBossPresetToEnemy(s.enemy, 'new5_barolo');
  s.allyCount = 1;
  s.allies[0] = { characterId:'', attack:'0', speed:'1', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns = [{ allyActions:[{ kind:'skip', skillName:'', effects:[] }], enemyAction:{ enabled:true, effect:{ type:'none' } } }];
  s.finalTurnCutoff = 'turnEnd';
  const manual = simulateKillProbabilityEnemyManual(s);
  assert.deepEqual(manual.enemySkillActivation?.[0] ?? {}, {}, 'manual mode must suppress preset BOSS command roulette');
  const statuses = manual.statusSummaryByTurn?.[0]?.[0] ?? {};
  assert.ok(Object.values(statuses).every(v => Number(v) === 0), `manual none must not apply automatic statuses: ${JSON.stringify(statuses)}`);
}

// 2) Manual defense buff on a preset BOSS must affect later ally damage.
{
  const s = basicPresetState();
  s.enemy.maxHp = '90';
  s.enemy.speed = '100';
  s.turns[0].enemyAction.effect = { type:'enemyDefenseBuff', mode:'mult', value:'50', duration:'1' };
  const manual = simulateKillProbabilityEnemyManual(s);
  const off = simulateKillProbabilityEnemyOff(s);
  approx(manual.killChance, 0);
  approx(off.killChance, 1);
}

// 3) Manual attack debuff on a preset BOSS must affect the selected ally target.
{
  const s = basicPresetState();
  s.enemy.maxHp = '90';
  s.enemy.speed = '100';
  s.turns[0].enemyAction.effect = { type:'allyAtkDebuff', target:['ally1'], mode:'mult', value:'20', duration:'1' };
  const manual = simulateKillProbabilityEnemyManual(s);
  const off = simulateKillProbabilityEnemyOff(s);
  approx(manual.killChance, 0);
  approx(off.killChance, 1);
}

// 4) Manual heal is applied at the BOSS action opportunity.
{
  const s = basicPresetState();
  s.enemy.maxHp = '150';
  s.enemy.speed = '10';
  s.allies[0].speed = '100';
  s.turns[0].enemyAction.effect = { type:'heal', mode:'flat', value:'100' };
  const manual = simulateKillProbabilityEnemyManual(s);
  assert.ok([...manual.hpDistribution.keys()].every(hp => Number(hp) >= 145 && Number(hp) <= 150),
    `manual heal not reflected: ${[...manual.hpDistribution.keys()].join(',')}`);
}

// 5) Public manual choices are intentionally limited, and 防御アップ is a separate reduction layer.
{
  const types = ENEMY_EFFECT_TYPES.map(([type]) => type);
  for (const removed of ['enemyAtkBuff','statusParalysis','statusConfusion','statusSilence','statusDarkness','statusSleep','statusPetrification','statusCold','statusBrainwash']) {
    assert.ok(!types.includes(removed), `removed manual type leaked: ${removed}`);
  }
  assert.ok(types.includes('enemyDamageReduction'));
  assert.ok(types.includes('enemyDefenseBuff'));
  assert.ok(types.includes('enemyDefenseDebuff'));
}

// 5b) 防御アップ uses the damage-chart reduction layer after ordinary defense mods.
{
  const s = basicPresetState();
  s.enemy.maxHp = '70';
  s.enemy.speed = '100';
  s.turns[0].enemyAction.effect = { type:'enemyDamageReduction', value:'40', duration:'1' };
  const manual = simulateKillProbabilityEnemyManual(s);
  const off = simulateKillProbabilityEnemyOff(s);
  approx(manual.killChance, 0);
  approx(off.killChance, 1);

  // Layer order is fixed to 防御バフ/デバフ → 防御アップ, even if array order is reversed.
  const dist = attackDamageDistribution({
    attack:100, skillMultiplier:100, attackAttribute:'none', attackAttribute2:'none',
    defenderAttribute:'none', defenderRace:'normal', attackType:'physical', hits:1,
    defenseMods:[
      { mode:'mult', value:90, layer:'reduction', seq:1 },
      { mode:'mult', value:150, seq:2 }
    ]
  });
  assert.equal(Math.min(...dist.keys()), 127);
  assert.equal(Math.max(...dist.keys()), 141);
}

// 6) Fixed companions keep action opportunities but do not auto-roll commands in manual mode.
{
  const s = cloneDefaultState();
  s.enemy = applyBossPresetToEnemy(s.enemy, 'new0_damkina'); // fixed companion: マト
  s.allyCount = 1;
  s.allies[0] = { characterId:'', attack:'0', speed:'1', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns = [{ allyActions:[{ kind:'skip', skillName:'', effects:[] }], enemyAction:{ enabled:true, effect:{ type:'none' } } }];
  s.finalTurnCutoff = 'turnEnd';
  const manual = simulateKillProbabilityEnemyManual(s);
  const labels = Object.keys(manual.enemySkillActivation?.[0] ?? {});
  assert.ok(!labels.some(x => x.startsWith('お供:')), `companion auto action leaked into manual mode: ${labels.join(', ')}`);
}

console.log('enemy-manual-public.test.js: OK');
