import assert from 'node:assert/strict';
import { cloneDefaultState, simulateKillProbability } from '../kill/engine.js';
import { SKILL_PRESET_BY_ID } from '../kill/presets.js';
import { applyBossPresetToEnemy } from '../kill/boss-presets.js';

const chars = {
  son_goku:{attack:'84',speed:'78',star:'4',attribute:'wind'},
  gyumao:{attack:'94',speed:'15',star:'4',attribute:'fire'},
  kerogon_gold:{attack:'36',speed:'10',star:'1',attribute:'fire'},
  clear_blue_dragon:{attack:'73',speed:'68',star:'4',attribute:'water'},
  guardian_powan:{attack:'73',speed:'73',star:'4',attribute:'water'},
  docteur:{attack:'57',speed:'63',star:'3',attribute:'water'},
  dartan:{attack:'78',speed:'36',star:'4',attribute:'earth'},
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

const rock = simulateKillProbability(state('old2_rock_dragon', [
  char('son_goku','stop1'), char('gyumao','stop2'), char('kerogon_gold')
], [
  turn(['spirit_blessing','sea_king_gaze','dragon_tail']),
  turn(['loki_brand','oni_spirit','dragon_tail']),
  turn(['bubble_grand','ninja_water','dragon_tail'])
]));
approx(rock.killChance, 0.9798188784189384);
assert.deepEqual(rock.scenarioCountByTurn, [12,56,34]);

const soccerra = simulateKillProbability(state('old2_soccerra', [
  char('son_goku','stop1'), char('gyumao','stop2'), char('clear_blue_dragon')
], [
  turn(['spirit_blessing','sea_king_gaze','aqua_breath']),
  turn(['loki_brand','oni_spirit','aqua_breath']),
  turn(['foot_sweep','ninja_water','aqua_breath'])
]));
approx(soccerra.killChance, 0.9992283950617334);
assert.deepEqual(soccerra.scenarioCountByTurn, [66,328,264]);

const skullbone = simulateKillProbability(state('old2_skullbone', [
  char('son_goku','stop1'), char('gyumao','stop2'), char('guardian_powan')
], [
  turn(['spirit_blessing','sea_king_gaze','bubble_grand'], {2:{enemyTargetSlot:'1'}}),
  turn(['loki_brand','oni_spirit','bubble_grand'], {2:{enemyTargetSlot:'0'}}),
  turn(['foot_sweep','ninja_water','bubble_grand'], {2:{enemyTargetSlot:'0'}})
]));
approx(skullbone.killChance, 0.9992137658756676);
assert.deepEqual(skullbone.scenarioCountByTurn, [12,24,24]);

// Wikiルートは3Tで未撃破なら敵EXを受けて継続するが、このツールの周回判定は敵EX到達=失敗。
// turnEndまで含めると、3T撃破質量と敵EX失敗質量が全確率を二分する。
const ifrit = simulateKillProbability(state('old2_ifrit', [
  char('son_goku','stop1'), char('docteur'), char('dartan')
], [
  turn(['ex_plus_8','trial_gun','rengeki']),
  turn(['oni_spirit','trial_gun','rengeki']),
  turn(['goku_lower_ex','trial_gun','rengeki'])
], 'turnEnd'));
approx(ifrit.killChance, 0.6742092153415897);
approx(ifrit.enemyExFailureChance, 0.3257907846584092);
approx(ifrit.killChance + ifrit.enemyExFailureChance, 1, 2e-12);
assert.deepEqual(ifrit.scenarioCountByTurn, [4,7,0]);

console.log('old2-chart-regression.test.js: OK');
