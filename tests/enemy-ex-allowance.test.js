import assert from 'node:assert/strict';
import { cloneDefaultState, simulateKillProbabilityEnemyManual } from '../kill/engine.js';

assert.equal(cloneDefaultState().enemy.enemyExAllowance, '0', 'default enemy EX allowance must be 0');

function exState(allowance) {
  const s = cloneDefaultState();
  s.enemy = {
    ...s.enemy,
    presetId:'',
    maxHp:'999999',
    attribute:'none', race:'normal', attack:'0', speed:'100',
    enemyExAllowance:String(allowance)
  };
  s.allyCount = 1;
  s.allies[0] = { characterId:'', attack:'1', speed:'1', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  const attack = { kind:'attack', skillName:'10hit-test', skillMultiplier:'100', attackAttribute:'none', attackType:'physical', hits:'10', effects:[] };
  s.turns = Array.from({ length:3 }, () => ({
    allyActions:[{ ...attack }],
    enemyAction:{ enabled:true, effect:{ type:'none' } }
  }));
  s.finalTurnCutoff = 'turnEnd';
  return s;
}

// Enemy acts before the ally. T1 ally fills EX to 10, so first enemy EX is T2.
// T2 ally fills it again, so second enemy EX is T3.
{
  const r = simulateKillProbabilityEnemyManual(exState(0));
  assert.ok(r.enemyExFailureChance > 0.999999999, `allowance 0 must fail on first EX: ${r.enemyExFailureChance}`);
  assert.equal(r.enemyExAllowance, 0);
}
{
  const r = simulateKillProbabilityEnemyManual(exState(1));
  assert.ok(r.enemyExFailureChance > 0.999999999, `allowance 1 must fail on second EX: ${r.enemyExFailureChance}`);
  assert.ok((r.enemyExFailureByTurn?.[1] ?? 0) < 1e-12, `first EX should be allowed: ${r.enemyExFailureByTurn}`);
  assert.ok((r.enemyExFailureByTurn?.[2] ?? 0) > 0.999999999, `second EX should fail on T3: ${r.enemyExFailureByTurn}`);
  assert.equal(r.enemyExAllowance, 1);
}
{
  const r = simulateKillProbabilityEnemyManual(exState(2));
  assert.ok(r.enemyExFailureChance < 1e-12, `allowance 2 should permit the two EX activations in 3 turns: ${r.enemyExFailureChance}`);
  assert.equal(r.enemyExAllowance, 2);
}

console.log('enemy-ex-allowance.test.js: OK');
