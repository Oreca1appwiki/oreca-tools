import assert from 'node:assert/strict';
import { cloneDefaultState, simulateKillProbabilityEnemyManual } from '../kill/engine.js';
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
function action(id, extra={}) { const p=SKILL_PRESET_BY_ID.get(id); assert.ok(p, `missing ${id}`); return {...p, skillPresetId:id, ...extra}; }
function turn(actions) { return { allyActions:actions, enemyAction:{enabled:true,effect:{type:'none'}} }; }
function state(presetId, allies, turns, finalTurnCutoff='lastAlly') {
  const s=cloneDefaultState(); s.enemy=applyBossPresetToEnemy(s.enemy,presetId); s.enemy.enemyExAllowance='0';
  s.allyCount=3; s.allies=allies; s.turns=turns; s.finalTurnCutoff=finalTurnCutoff; return s;
}
function approx(a,b,eps=1e-12){ assert.ok(Math.abs(a-b)<=eps, `${a} != ${b}`); }

const frost=simulateKillProbabilityEnemyManual(state('old5_frost_dragon',[
  char('son_goku','stop3'),char('gyumao','stop2'),char('mimitoshishi','mixed')
],[
  turn([action('loki_brand',{enemyTargetSlot:'0'}),action('oni_spirit',{enemyTargetSlot:'0'}),action('attack_bang',{enemyTargetSlot:'1'})]),
  turn([action('oni_spirit',{enemyTargetSlot:'0'}),action('ninja_fire',{enemyTargetSlot:'0'}),action('attack_bang',{enemyTargetSlot:'1'})]),
  turn([action('red_point_2',{enemyTargetSlot:'0'}),action('ninja_fire',{enemyTargetSlot:'0'}),action('attack_bang',{enemyTargetSlot:'1'})]),
]));
approx(frost.killChance,0.9600408664857941);
approx(frost.enemyExFailureChance,0.03532950388660272);
assert.deepEqual(frost.activeCompanionCommandProfiles,['凍竜のタマゴ']);
assert.ok(frost.enemySkillActivation.every(x=>Object.keys(x).length===0));

const kujeska=simulateKillProbabilityEnemyManual(state('old5_kujeska',[
  char('son_goku','forward4'),char('mermaid_mellow'),char('captain_azul')
],[
  turn([action('growl',{enemyTargetSlot:'0'}),action('bubble_grand',{enemyTargetSlot:'1'}),action('shibire_giri',{enemyTargetSlot:'1'})]),
  turn([action('loki_brand',{enemyTargetSlot:'0'}),action('bubble_grand',{enemyTargetSlot:'1'}),action('shibire_giri',{enemyTargetSlot:'1'})]),
  turn([action('red_point_2',{enemyTargetSlot:'0'}),action('bubble_grand',{enemyTargetSlot:'1'}),action('shibire_giri',{enemyTargetSlot:'1'})]),
  turn([action('venom_salamanda',{enemyTargetSlot:'0'}),action('bubble_grand',{enemyTargetSlot:'1'}),action('shibire_giri',{enemyTargetSlot:'1'})]),
],'ally1'));
approx(kujeska.killChance,0.7964038749709987);
approx(kujeska.enemyExFailureChance,0);
assert.deepEqual(kujeska.activeCompanionCommandProfiles,['魔人魚セイレン']);
assert.ok(kujeska.enemySkillActivation.every(x=>Object.keys(x).length===0));
console.log('old5-manual-regression.test.js: OK');
