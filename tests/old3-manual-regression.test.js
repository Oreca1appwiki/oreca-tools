import assert from 'node:assert/strict';
import { cloneDefaultState, simulateKillProbabilityEnemyManual } from '../kill/engine.js';
import { SKILL_PRESET_BY_ID } from '../kill/presets.js';
import { applyBossPresetToEnemy } from '../kill/boss-presets.js';

const chars = {
  son_goku:{attack:'84',speed:'78',star:'4',attribute:'wind'},
  gyumao:{attack:'94',speed:'15',star:'4',attribute:'fire'},
  kerogon_gold:{attack:'36',speed:'10',star:'1',attribute:'fire'},
  oniwaka_monk:{attack:'63',speed:'47',star:'3',attribute:'wind'},
  venom_behemoth:{attack:'73',speed:'15',star:'4',attribute:'earth'},
  guardian_powan:{attack:'73',speed:'73',star:'4',attribute:'water'},
  garanezumi:{attack:'31',speed:'73',star:'1',attribute:'earth'},
};
const char=(id,v='')=>({characterId:id,...chars[id],race:'normal',commandVariant:v});
const action=(id,extra={})=>({...SKILL_PRESET_BY_ID.get(id),skillPresetId:id,...extra});
function turn(ids, extras={}) { return {allyActions:ids.map((id,i)=>action(id,extras[i]??{})),enemyAction:{enabled:true,effect:{type:'none',mode:'mult',value:'0',duration:'1'}}}; }
function state(id, allies, turns, cutoff='lastAlly') { const s=cloneDefaultState(); s.enemy=applyBossPresetToEnemy(s.enemy,id); s.enemy.enemyExAllowance='0'; s.allyCount=3; s.allies=allies; s.turns=turns; s.finalTurnCutoff=cutoff; return s; }
function approx(a,b,eps=1e-12){assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`)}

const yamataStable=simulateKillProbabilityEnemyManual(state('old3_yamata',[char('son_goku','stop3'),char('gyumao','stop2'),char('kerogon_gold')],[
  turn(['oni_spirit','loki_brand','dragon_tail']),turn(['crush','rock_throw','dragon_tail']),turn(['yellow_point_2','rock_throw','dragon_tail'])
]));
approx(yamataStable.killChance,0.9600408471582285); approx(yamataStable.enemyExFailureChance,0.03995915284176912);

const yamataStop1=simulateKillProbabilityEnemyManual(state('old3_yamata',[char('son_goku','stop1'),char('gyumao','stop3'),char('garanezumi')],[
  turn(['loki_brand','oni_spirit','attack_bang'],{2:{enemyTargetSlot:'1'}}),
  turn(['oni_spirit','crush','attack_bang'],{2:{enemyTargetSlot:'1'}}),
  turn(['crush','crush','attack_bang'],{2:{enemyTargetSlot:'1'}})
]));
approx(yamataStop1.killChance,1); approx(yamataStop1.enemyExFailureChance,0);

const kukulkan=simulateKillProbabilityEnemyManual(state('old3_kukulkan',[char('son_goku','stop1'),char('gyumao','stop3'),char('oniwaka_monk')],[
  turn(['sun_blessing','spirit_blessing','foot_sweep']),turn(['loki_brand','oni_spirit','foot_sweep']),turn(['crush','crush','foot_sweep'])
]));
approx(kukulkan.killChance,1); approx(kukulkan.enemyExFailureChance,0);

const nanawarai=simulateKillProbabilityEnemyManual(state('old3_nanawarai',[char('son_goku','stop1'),char('gyumao','stop3'),char('venom_behemoth')],[
  turn(['loki_brand','oni_spirit','crush']),turn(['paralysis_arrow','crush','crush']),turn(['paralysis_arrow','crush','crush'])
]));
approx(nanawarai.killChance,1); approx(nanawarai.enemyExFailureChance,0);

const fanlong=simulateKillProbabilityEnemyManual(state('old3_fanlong',[char('son_goku','stop1'),char('gyumao','stop2'),char('guardian_powan')],[
  turn(['sun_blessing','sea_king_gaze','bubble_grand'],{2:{enemyTargetSlot:'1'}}),
  turn(['loki_brand','oni_spirit','bubble_grand'],{2:{enemyTargetSlot:'0'}}),
  turn(['spirit_blessing','ninja_water','bubble_grand'],{2:{enemyTargetSlot:'0'}}),
  turn(['rengeki','ninja_water','bubble_grand'],{2:{enemyTargetSlot:'0'}}),
]));
approx(fanlong.killChance,0.9992283950617296); approx(fanlong.enemyExFailureChance,0);

const fanlongAfterRengeki=simulateKillProbabilityEnemyManual(state('old3_fanlong',[char('son_goku','stop1'),char('gyumao','stop2'),char('guardian_powan')],[
  turn(['sun_blessing','sea_king_gaze','bubble_grand'],{2:{enemyTargetSlot:'1'}}),
  turn(['loki_brand','oni_spirit','bubble_grand'],{2:{enemyTargetSlot:'0'}}),
  turn(['spirit_blessing','ninja_water','bubble_grand'],{2:{enemyTargetSlot:'0'}}),
  turn(['rengeki','ninja_water','bubble_grand'],{2:{enemyTargetSlot:'0'}}),
],'ally1'));
approx(fanlongAfterRengeki.killChance,0.6436064986946206);

console.log('old3-manual-regression.test.js: OK');
