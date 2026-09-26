import assert from 'node:assert/strict';
import { cloneDefaultState, simulateKillProbability } from '../kill/engine.js';
import { SKILL_PRESET_BY_ID } from '../kill/presets.js';
import { applyBossPresetToEnemy } from '../kill/boss-presets.js';

const chars = {
  son_goku:{attack:'84',speed:'78',star:'4',attribute:'wind'},
  gyumao:{attack:'94',speed:'15',star:'4',attribute:'fire'},
  kerogon_gold:{attack:'36',speed:'10',star:'1',attribute:'fire'},
  oniwaka_monk:{attack:'63',speed:'47',star:'3',attribute:'wind'},
  venom_behemoth:{attack:'73',speed:'15',star:'4',attribute:'earth'},
  guardian_powan:{attack:'73',speed:'73',star:'4',attribute:'water'},
};
function char(id, commandVariant='') {
  return { characterId:id, ...chars[id], race:'normal', commandVariant };
}
function action(id, extra={}) {
  const preset = SKILL_PRESET_BY_ID.get(id);
  assert.ok(preset, `missing skill preset: ${id}`);
  return { ...preset, skillPresetId:id, ...extra };
}
function turn(ids, extras={}) {
  return {
    allyActions:ids.map((id, i) => action(id, extras[i] ?? {})),
    enemyAction:{ enabled:true, effect:{type:'skip', mode:'mult', value:'0', duration:'1'} }
  };
}
function state(presetId, allies, turns, finalTurnCutoff='lastAlly') {
  const s = cloneDefaultState();
  s.enemy = applyBossPresetToEnemy(s.enemy, presetId);
  s.allyCount = 3;
  s.allies = allies;
  s.turns = turns;
  s.finalTurnCutoff = finalTurnCutoff;
  return s;
}
function approx(actual, expected, eps=1e-12) {
  assert.ok(Math.abs(actual - expected) <= eps, `${actual} != ${expected}`);
}

const yamata = simulateKillProbability(state('old3_yamata', [
  char('son_goku','stop3'), char('gyumao','stop2'), char('kerogon_gold')
], [
  turn(['oni_spirit','loki_brand','dragon_tail']),
  turn(['crush','rock_throw','dragon_tail']),
  turn(['yellow_point_2','rock_throw','dragon_tail'])
]));
approx(yamata.killChance, 0.9600408471582464);
approx(yamata.enemyExFailureChance, 0.03995915284176907);
assert.deepEqual(yamata.scenarioCountByTurn, [144,432,0]);

const kukulkan = simulateKillProbability(state('old3_kukulkan', [
  char('son_goku','stop1'), char('gyumao','stop3'), char('oniwaka_monk')
], [
  turn(['sun_blessing','spirit_blessing','foot_sweep']),
  turn(['loki_brand','oni_spirit','foot_sweep']),
  turn(['crush','crush','foot_sweep'])
]));
approx(kukulkan.killChance, 0.9929436372602922);
approx(kukulkan.enemyExFailureChance, 0);
assert.deepEqual(kukulkan.scenarioCountByTurn, [54,362,328]);

const nanawarai = simulateKillProbability(state('old3_nanawarai', [
  char('son_goku','stop1'), char('gyumao','stop3'), char('venom_behemoth')
], [
  turn(['loki_brand','oni_spirit','crush']),
  turn(['paralysis_arrow','crush','crush']),
  turn(['paralysis_arrow','crush','crush'])
]));
approx(nanawarai.killChance, 0.9814279585816436);
approx(nanawarai.enemyExFailureChance, 0.011550199500539426);
assert.deepEqual(nanawarai.scenarioCountByTurn, [168,444,33]);

const fanlongFull = simulateKillProbability(state('old3_fanlong', [
  char('son_goku','stop1'), char('gyumao','stop2'), char('guardian_powan')
], [
  turn(['sun_blessing','sea_king_gaze','bubble_grand'], {2:{enemyTargetSlot:'1'}}),
  turn(['loki_brand','oni_spirit','bubble_grand'], {2:{enemyTargetSlot:'0'}}),
  turn(['spirit_blessing','ninja_water','bubble_grand'], {2:{enemyTargetSlot:'0'}}),
  turn(['rengeki','ninja_water','bubble_grand'], {2:{enemyTargetSlot:'0'}}),
]));
approx(fanlongFull.killChance, 0.9992283940063948);
approx(fanlongFull.enemyExFailureChance, 0);
assert.deepEqual(fanlongFull.scenarioCountByTurn, [88,208,504,84]);

// Wiki記載の「4T斉天大聖ソンゴクウの連撃だけなら約65%」も別カットオフで固定する。
const fanlongAfterRengeki = simulateKillProbability(state('old3_fanlong', [
  char('son_goku','stop1'), char('gyumao','stop2'), char('guardian_powan')
], [
  turn(['sun_blessing','sea_king_gaze','bubble_grand'], {2:{enemyTargetSlot:'1'}}),
  turn(['loki_brand','oni_spirit','bubble_grand'], {2:{enemyTargetSlot:'0'}}),
  turn(['spirit_blessing','ninja_water','bubble_grand'], {2:{enemyTargetSlot:'0'}}),
  turn(['rengeki','ninja_water','bubble_grand'], {2:{enemyTargetSlot:'0'}}),
], 'ally1'));
approx(fanlongAfterRengeki.killChance, 0.6435200144715358);

console.log('old3-chart-regression.test.js: OK');
