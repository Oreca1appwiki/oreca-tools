import assert from 'node:assert/strict';
import { cloneDefaultState, simulateKillProbability } from '../kill/engine.js';
import { SKILL_PRESET_BY_ID } from '../kill/presets.js';

function approx(actual, expected, eps = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= eps, `expected ${expected}, got ${actual}`);
}

// v0.5.63: 麻痺は次の敵行動を1回失わせ、EX10でもその行動機会ではEXを発動させない。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'', maxHp:'9999', attribute:'none', race:'normal', attack:'0', speed:'50' };
  s.allies[0] = { characterId:'', attack:'1', speed:'100', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns[0].allyActions[0] = {
    kind:'attack', skillName:'麻痺試験', skillMultiplier:'1', attackAttribute:'none', attackAttribute2:'none',
    attackType:'physical', enemyTarget:'single', hits:'10', effects:[{ type:'enemyParalysis', chance:'100' }]
  };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].allyActions[0] = { kind:'skip', effects:[] };
  const r = simulateKillProbability(s);
  approx(r.enemyExFailureByTurn[0], 0, 1e-12);
}

// 同じ条件で麻痺なしなら、10ヒットでEX10に達し、その敵行動機会が即失敗になる。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'', maxHp:'9999', attribute:'none', race:'normal', attack:'0', speed:'50' };
  s.allies[0] = { characterId:'', attack:'1', speed:'100', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns[0].allyActions[0] = {
    kind:'attack', skillName:'非麻痺試験', skillMultiplier:'1', attackAttribute:'none', attackAttribute2:'none',
    attackType:'physical', enemyTarget:'single', hits:'10', effects:[]
  };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].allyActions[0] = { kind:'skip', effects:[] };
  const r = simulateKillProbability(s);
  approx(r.enemyExFailureByTurn[0], 1, 1e-12);
}

// 全体100%麻痺はBOSSとお供の双方に付与され、同ターンの敵側行動を全て止める。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'new4_garp', maxHp:'9999', attribute:'fire', race:'demon', attack:'60', speed:'70' };
  s.allies[0] = { characterId:'', attack:'1', speed:'100', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns[0].allyActions[0] = {
    kind:'attack', skillName:'全体麻痺試験', skillMultiplier:'1', attackAttribute:'none', attackAttribute2:'none',
    attackType:'magic', enemyTarget:'all', hits:'1', effects:[{ type:'enemyParalysis', chance:'100' }]
  };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].allyActions[0] = { kind:'skip', effects:[] };
  const r = simulateKillProbability(s);
  const t1Activation = Object.values(r.enemySkillActivation[0] ?? {}).reduce((a,b) => a + b, 0);
  approx(t1Activation, 0, 1e-12);
}

// BOSS側の状態異常耐性45は麻痺100%を55%へ下げる。T2のEX失敗は非麻痺45%枝だけ。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'', maxHp:'9999', attribute:'none', race:'normal', attack:'0', speed:'100' };
  s.allies[0] = { characterId:'', attack:'1', speed:'1', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns[0].allyActions[0] = {
    kind:'attack', skillName:'耐性麻痺試験', skillMultiplier:'1', attackAttribute:'none', attackAttribute2:'none',
    attackType:'physical', enemyTarget:'single', hits:'10', effects:[{ type:'enemyParalysis', chance:'100' }]
  };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'enemyStatusAvoid', value:45, duration:3, nonStacking:true } };
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].allyActions[0] = { kind:'skip', effects:[] };
  s.turns[1].enemyAction = { enabled:true, effect:{ type:'none' } };
  const r = simulateKillProbability(s);
  approx(r.enemyExFailureByTurn[1], 0.45, 1e-9);
}

// プラチナドレイクの雷竜の壁は、麻痺付与に成功した時点で解除される。
// T1で壁を引いた1/6枝もT2攻撃前には軽減が消えるため、HP160は全枝で2発以内に倒せる。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'q_platinum_drake', maxHp:'160', attribute:'light', race:'dragon', attack:'0', speed:'100' };
  s.allies[0] = { characterId:'', attack:'100', speed:'1', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns[0].allyActions[0] = {
    kind:'attack', skillName:'壁解除試験', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none',
    attackType:'physical', enemyTarget:'single', hits:'1', effects:[{ type:'enemyParalysis', chance:'100' }]
  };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].allyActions[0] = {
    kind:'attack', skillName:'追撃試験', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none',
    attackType:'physical', enemyTarget:'single', hits:'1', effects:[]
  };
  const r = simulateKillProbability(s);
  approx(r.killChance, 1, 1e-12);
}

// 実プリセットの確率値を固定。
assert.equal(SKILL_PRESET_BY_ID.get('crush')?.effects?.find(x => x.type === 'enemyParalysis')?.chance, '15');
assert.equal(SKILL_PRESET_BY_ID.get('roaring_lightning')?.effects?.find(x => x.type === 'enemyParalysis')?.chance, '45');
assert.equal(SKILL_PRESET_BY_ID.get('paralysis_arrow')?.effects?.find(x => x.type === 'enemyParalysis')?.chance, '25');
assert.equal(SKILL_PRESET_BY_ID.get('shout')?.effects?.find(x => x.type === 'enemyParalysis')?.chance, '80');
assert.equal(SKILL_PRESET_BY_ID.get('shibire_giri')?.effects?.find(x => x.type === 'enemyParalysis')?.chance, '30');
assert.equal(SKILL_PRESET_BY_ID.get('poison_crush')?.effects?.find(x => x.type === 'poison')?.chance, '20');
assert.equal(SKILL_PRESET_BY_ID.get('venom_salamanda')?.effects?.find(x => x.type === 'poison')?.chance, '40');
assert.equal(SKILL_PRESET_BY_ID.get('foot_sweep')?.effects?.find(x => x.type === 'enemyParalysis')?.chance, '15');

console.log('ally-enemy-status.test.js: OK');
