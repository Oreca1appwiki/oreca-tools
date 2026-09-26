import assert from 'node:assert/strict';
import { cloneDefaultState, simulateKillProbability, simulateKillProbabilityEnemyOff } from '../kill/engine.js';
import { applyBossPresetToEnemy } from '../kill/boss-presets.js';

function approx(actual, expected, eps = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= eps, `expected ${expected}, got ${actual}`);
}

// 1) Public wrapper must ignore an explicitly enabled manual enemy action.
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { ...s.enemy, presetId:'', maxHp:'90', attribute:'none', race:'normal', speed:'100' };
  s.allies[0] = { characterId:'', attack:'100', speed:'10', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns = [{
    allyActions:[{ kind:'attack', skillName:'test', skillMultiplier:'100', attackAttribute:'none', attackType:'physical', hits:'1', effects:[] }],
    enemyAction:{ enabled:true, effect:{ type:'enemyDefenseBuff', mode:'mult', value:'50', duration:'1' } }
  }];
  const full = simulateKillProbability(s);
  const off = simulateKillProbabilityEnemyOff(s);
  approx(full.killChance, 0);
  approx(off.killChance, 1);
  assert.equal(s.turns[0].enemyAction.enabled, true, 'wrapper must not mutate caller state');
  approx(off.enemyExFailureChance ?? 0, 0);
  assert.deepEqual(off.enemySkillActivation?.[0] ?? {}, {});
}

// 2) Enemy OFF still preserves the enemy action opportunity for poison/deadly-poison ticks.
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy.maxHp = '1000';
  s.enemy.speed = '50';
  s.allies[0] = { characterId:'', attack:'0', speed:'100', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns = [{
    allyActions:[{ kind:'buff', skillName:'poison', effects:[{ type:'deadlyPoison' }] }],
    enemyAction:{ enabled:true, effect:{ type:'enemyDefenseBuff', mode:'mult', value:'1', duration:'99' } }
  }];
  s.finalTurnCutoff = 'turnEnd';
  const r = simulateKillProbabilityEnemyOff(s);
  assert.ok([...r.hpDistribution.keys()].every(hp => Number(hp) === 800));
}

// 3) Fixed companions also take poison/deadly-poison at their own action opportunity while enemy actions are OFF.
{
  const s = cloneDefaultState();
  s.enemy = applyBossPresetToEnemy(s.enemy, 'old1_grim'); // BOSS + グリ2体 (HP37 each)
  s.allyCount = 1;
  s.allies[0] = { characterId:'', attack:'1', speed:'999', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns = [{
    allyActions:[{
      kind:'attack', skillName:'companion-poison-test', skillMultiplier:'100', attackAttribute:'none', attackType:'physical',
      enemyTarget:'single', enemyTargetSlot:'1', hits:'1', effects:[{ type:'deadlyPoison', chance:100 }]
    }],
    enemyAction:{ enabled:true, effect:{ type:'none' } }
  }];
  s.finalTurnCutoff = 'turnEnd';
  const r = simulateKillProbabilityEnemyOff(s);
  const targetHp = [...r.hpDistribution.keys()].map(key => Number(String(key).split(',')[1]));
  assert.ok(targetHp.length > 0);
  assert.ok(Math.max(...targetHp) <= 30, `expected companion deadly-poison tick, got HP ${targetHp.join(',')}`);
  assert.ok(Math.min(...targetHp) >= 29);
}

// 4) Multi-BOSS poison is tracked per target; poisoning one Mashumaro must not poison all three.
{
  const s = cloneDefaultState();
  s.enemy = applyBossPresetToEnemy(s.enemy, 'new5_mashumaro');
  s.allyCount = 1;
  s.allies[0] = { characterId:'', attack:'1', speed:'999', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns = [{
    allyActions:[{
      kind:'attack', skillName:'multi-boss-poison-test', skillMultiplier:'0', attackAttribute:'none', attackType:'physical',
      enemyTarget:'single', enemyTargetSlot:'1', hits:'1', effects:[{ type:'deadlyPoison', chance:100 }]
    }],
    enemyAction:{ enabled:true, effect:{ type:'none' } }
  }];
  s.finalTurnCutoff = 'turnEnd';
  const r = simulateKillProbabilityEnemyOff(s);
  const keys = [...r.hpDistribution.keys()].map(String);
  assert.ok(keys.length > 0);
  for (const key of keys) {
    const hp = key.split(',').map(Number);
    assert.equal(hp[0], 250);
    assert.equal(hp[1], 200);
    assert.equal(hp[2], 250);
  }
}

// 5) Multi-BOSS single-target poison-dependent power uses the selected target's poison state.
{
  const s = cloneDefaultState();
  s.enemy = applyBossPresetToEnemy(s.enemy, 'new5_mashumaro');
  s.allyCount = 1;
  s.allies[0] = { characterId:'', attack:'100', speed:'999', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns = [
    {
      allyActions:[{
        kind:'attack', skillName:'poison-setup', skillMultiplier:'0', attackAttribute:'none', attackType:'physical',
        enemyTarget:'single', enemyTargetSlot:'1', hits:'1', effects:[{ type:'poison', chance:100 }]
      }],
      enemyAction:{ enabled:true, effect:{ type:'none' } }
    },
    {
      allyActions:[{
        kind:'attack', skillName:'poison-dependent-test', skillMultiplier:'80', poisonedSkillMultiplier:'105',
        attackAttribute:'none', attackType:'physical', enemyTarget:'single', enemyTargetSlot:'1', hits:'1', effects:[]
      }],
      enemyAction:{ enabled:true, effect:{ type:'none' } }
    }
  ];
  s.finalTurnCutoff = 'turnEnd';
  const r = simulateKillProbabilityEnemyOff(s);
  for (const key of r.hpDistribution.keys()) {
    const hp = String(key).split(',').map(Number);
    assert.equal(hp[0], 250);
    assert.ok(hp[1] >= 104 && hp[1] <= 114, `expected poisoned 105% target damage, got ${key}`);
    assert.equal(hp[2], 250);
  }
}

// 6) Multi-BOSS random target attacks choose the power from the actually selected target's poison state.
{
  const s = cloneDefaultState();
  s.enemy = applyBossPresetToEnemy(s.enemy, 'new5_mashumaro');
  s.allyCount = 1;
  s.allies[0] = { characterId:'', attack:'100', speed:'999', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns = [
    {
      allyActions:[{
        kind:'attack', skillName:'poison-setup', skillMultiplier:'0', attackAttribute:'none', attackType:'physical',
        enemyTarget:'single', enemyTargetSlot:'1', hits:'1', effects:[{ type:'poison', chance:100 }]
      }], enemyAction:{ enabled:true, effect:{ type:'none' } }
    },
    {
      allyActions:[{
        kind:'attack', skillName:'random-poison-power', skillMultiplier:'80', poisonedSkillMultiplier:'105',
        attackAttribute:'none', attackType:'physical', enemyTarget:'random', hits:'1', effects:[]
      }], enemyAction:{ enabled:true, effect:{ type:'none' } }
    }
  ];
  s.finalTurnCutoff = 'ally1';
  const r = simulateKillProbabilityEnemyOff(s);
  let poisonedTargetMass = 0;
  let normalTargetMass = 0;
  for (const [key, probability] of r.hpDistribution) {
    const hp = String(key).split(',').map(Number);
    if (hp[1] < 225) {
      poisonedTargetMass += probability;
      assert.ok(hp[1] >= 115 && hp[1] <= 126, `expected 105% damage on poisoned random target, got ${key}`);
    } else {
      normalTargetMass += probability;
      const changed = [0,2].filter(i => hp[i] < 250);
      assert.equal(changed.length, 1, `expected exactly one normal random target hit, got ${key}`);
      assert.ok(hp[changed[0]] >= 166 && hp[changed[0]] <= 174, `expected 80% damage on normal random target, got ${key}`);
    }
  }
  approx(poisonedTargetMass, 1 / 3, 1e-10);
  approx(normalTargetMass, 2 / 3, 1e-10);
}

// 7) Multi-BOSS all-target attacks may use a different power for each BOSS in the same hit.
{
  const s = cloneDefaultState();
  s.enemy = applyBossPresetToEnemy(s.enemy, 'new5_mashumaro');
  s.allyCount = 1;
  s.allies[0] = { characterId:'', attack:'100', speed:'999', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns = [
    {
      allyActions:[{
        kind:'attack', skillName:'deadly-setup', skillMultiplier:'0', attackAttribute:'none', attackType:'physical',
        enemyTarget:'single', enemyTargetSlot:'1', hits:'1', effects:[{ type:'deadlyPoison', chance:100 }]
      }], enemyAction:{ enabled:true, effect:{ type:'none' } }
    },
    {
      allyActions:[{
        kind:'attack', skillName:'all-deadly-power', skillMultiplier:'60', deadlyPoisonSkillMultiplier:'120',
        attackAttribute:'none', attackType:'physical', enemyTarget:'all', hits:'1', effects:[]
      }], enemyAction:{ enabled:true, effect:{ type:'none' } }
    }
  ];
  s.finalTurnCutoff = 'turnEnd';
  const r = simulateKillProbabilityEnemyOff(s);
  for (const key of r.hpDistribution.keys()) {
    const hp = String(key).split(',').map(Number);
    assert.equal(hp[0], hp[2], `same-status BOSSes must receive the same shared-roll damage: ${key}`);
    assert.ok(hp[0] >= 187 && hp[0] <= 193, `expected normal 60% damage, got ${key}`);
    assert.ok(hp[1] >= 60 && hp[1] <= 69, `expected deadly-poison 120% damage plus tick, got ${key}`);
  }
}

// 8) Random single-target poison->deadly effects (悪疫グラス model) upgrade exactly one living BOSS.
{
  const s = cloneDefaultState();
  s.enemy = applyBossPresetToEnemy(s.enemy, 'new5_mashumaro');
  s.allyCount = 1;
  s.allies[0] = { characterId:'', attack:'100', speed:'999', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns = [
    {
      allyActions:[{
        kind:'attack', skillName:'poison-all-setup', skillMultiplier:'0', attackAttribute:'none', attackType:'physical',
        enemyTarget:'all', hits:'1', effects:[{ type:'poison', chance:100 }]
      }], enemyAction:{ enabled:true, effect:{ type:'none' } }
    },
    {
      allyActions:[{ kind:'effect', skillName:'悪疫グラス', enemyTarget:'random', effects:[{ type:'poisonToDeadly' }] }],
      enemyAction:{ enabled:true, effect:{ type:'none' } }
    }
  ];
  s.finalTurnCutoff = 'turnEnd';
  const r = simulateKillProbabilityEnemyOff(s);
  assert.equal(r.hpDistribution.size, 3);
  const expected = new Map([
    ['180,203,203', 1 / 3],
    ['203,180,203', 1 / 3],
    ['203,203,180', 1 / 3]
  ]);
  for (const [key, probability] of r.hpDistribution) approx(probability, expected.get(String(key)) ?? -1);
}

// 9) Even companions whose commands are otherwise kill-probability-inert keep an action opportunity for poison ticks in OFF mode.
{
  const make = withPoison => {
    const s = cloneDefaultState();
    s.enemy = applyBossPresetToEnemy(s.enemy, 'old3_fanlong'); // 金竜のタマゴ is killProbabilityInert
    s.allyCount = 1;
    s.allies[0] = { characterId:'', attack:'1', speed:'999', star:'4', attribute:'none', race:'normal', commandVariant:'' };
    s.turns = [{
      allyActions:[{
        kind:'attack', skillName:'inert-companion-poison-test', skillMultiplier:'0', attackAttribute:'none', attackType:'physical',
        enemyTarget:'single', enemyTargetSlot:'1', hits:'1', effects:withPoison ? [{ type:'deadlyPoison', chance:100 }] : []
      }],
      enemyAction:{ enabled:true, effect:{ type:'none' } }
    }];
    s.finalTurnCutoff = 'turnEnd';
    return simulateKillProbabilityEnemyOff(s);
  };
  const plain = make(false);
  const poisoned = make(true);
  const plainHp = Number(String([...plain.hpDistribution.keys()][0]).split(',')[1]);
  const poisonedHp = Number(String([...poisoned.hpDistribution.keys()][0]).split(',')[1]);
  assert.ok(poisonedHp < plainHp, `expected poison tick on inert companion, got plain=${plainHp}, poisoned=${poisonedHp}`);
  assert.ok(poisoned.finalOrder.some(actor => actor.side === 'companion' && actor.name === '金竜のタマゴ'));
}

console.log('enemy-off-public.test.js: OK');
