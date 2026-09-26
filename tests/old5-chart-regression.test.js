import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { cloneDefaultState, simulateKillProbability } from '../kill/engine.js';
import { SKILL_PRESET_BY_ID } from '../kill/presets.js';
import { applyBossPresetToEnemy } from '../kill/boss-presets.js';

const chars = {
  son_goku:{attack:'84',speed:'78',star:'4',attribute:'wind'},
  gyumao:{attack:'94',speed:'15',star:'4',attribute:'fire'},
  mimitoshishi:{attack:'42',speed:'63',star:'1',attribute:'water'},
  mermaid_mellow:{attack:'68',speed:'73',star:'3',attribute:'water'},
  captain_azul:{attack:'63',speed:'42',star:'3',attribute:'water'},
};
function char(id, commandVariant='') { return { characterId:id, ...chars[id], race:'normal', commandVariant }; }
function action(id, extra={}) {
  const preset = SKILL_PRESET_BY_ID.get(id);
  assert.ok(preset, `missing skill preset: ${id}`);
  return { ...preset, skillPresetId:id, ...extra };
}
function turn(actions) {
  return { allyActions:actions, enemyAction:{enabled:true,effect:{type:'skip',mode:'mult',value:'0',duration:'1'}} };
}
function state(presetId, allies, turns, finalTurnCutoff='lastAlly') {
  const s = cloneDefaultState();
  s.enemy = applyBossPresetToEnemy(s.enemy, presetId);
  s.allyCount = 3; s.allies = allies; s.turns = turns; s.finalTurnCutoff = finalTurnCutoff;
  return s;
}
function approx(actual, expected, eps=1e-12) { assert.ok(Math.abs(actual-expected)<=eps, `${actual} != ${expected}`); }

const frostState = state('old5_frost_dragon', [
  char('son_goku','stop3'), char('gyumao','stop2'), char('mimitoshishi','mixed')
], [
  turn([action('loki_brand',{enemyTargetSlot:'0'}), action('oni_spirit',{enemyTargetSlot:'0'}), action('attack_bang',{enemyTargetSlot:'1'})]),
  turn([action('oni_spirit',{enemyTargetSlot:'0'}), action('ninja_fire',{enemyTargetSlot:'0'}), action('attack_bang',{enemyTargetSlot:'1'})]),
  turn([action('red_point_2',{enemyTargetSlot:'0'}), action('ninja_fire',{enemyTargetSlot:'0'}), action('attack_bang',{enemyTargetSlot:'1'})]),
]);
let t0 = performance.now();
const frost = simulateKillProbability(frostState);
const frostMs = performance.now() - t0;
assert.equal(frost.precomputedExact, true);
approx(frost.killChance, 0.9339401813926075);
approx(frost.enemyExFailureChance, 0.04166759522696513);
assert.deepEqual(frost.scenarioCountByTurn, [252,918,14]);

const kujeskaState = state('old5_kujeska', [
  char('son_goku','forward4'), char('mermaid_mellow'), char('captain_azul')
], [
  turn([action('growl',{enemyTargetSlot:'0'}), action('bubble_grand',{enemyTargetSlot:'1'}), action('shibire_giri',{enemyTargetSlot:'1'})]),
  turn([action('loki_brand',{enemyTargetSlot:'0'}), action('bubble_grand',{enemyTargetSlot:'1'}), action('shibire_giri',{enemyTargetSlot:'1'})]),
  turn([action('red_point_2',{enemyTargetSlot:'0'}), action('bubble_grand',{enemyTargetSlot:'1'}), action('shibire_giri',{enemyTargetSlot:'1'})]),
  turn([action('venom_salamanda',{enemyTargetSlot:'0'}), action('bubble_grand',{enemyTargetSlot:'1'}), action('shibire_giri',{enemyTargetSlot:'1'})]),
], 'ally1');
t0 = performance.now();
const kujeska = simulateKillProbability(kujeskaState);
const kujeskaMs = performance.now() - t0;
assert.equal(kujeska.precomputedExact, true);
approx(kujeska.killChance, 0.6325154159788914);
approx(kujeska.enemyExFailureChance, 0.12002743484224926);
assert.deepEqual(kujeska.scenarioCountByTurn, [315,2800,928,240]);

// 完全一致しない入力では事前計算を使わない。1Tだけにして汎用経路も軽量に検証する。
const changed = structuredClone(frostState);
changed.turns = changed.turns.slice(0,1);
const changedResult = simulateKillProbability(changed);
assert.notEqual(changedResult.precomputedExact, true);

console.log(`old5-chart-regression.test.js: OK frost=${frostMs.toFixed(2)}ms kujeska=${kujeskaMs.toFixed(2)}ms`);
