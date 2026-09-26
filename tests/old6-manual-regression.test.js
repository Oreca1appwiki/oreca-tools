import assert from 'node:assert/strict';
import { cloneDefaultState, simulateKillProbabilityEnemyManual } from '../kill/engine.js';
import { SKILL_PRESET_BY_ID } from '../kill/presets.js';
import { applyBossPresetToEnemy } from '../kill/boss-presets.js';
import { enemyCompanionProfile } from '../kill/enemy-actions.js';

const chars={
  son_goku:{attack:'84',speed:'78',star:'4',attribute:'wind'},
  gyumao:{attack:'94',speed:'15',star:'4',attribute:'fire'},
  garanezumi:{attack:'31',speed:'73',star:'1',attribute:'earth'},
  clear_blue_dragon:{attack:'73',speed:'68',star:'4',attribute:'water'},
  dartan:{attack:'78',speed:'36',star:'4',attribute:'earth'},
  elysion:{attack:'78',speed:'52',star:'4',attribute:'earth'},
};
function char(id,v=''){return {characterId:id,...chars[id],race:'normal',commandVariant:v};}
function freeChar(attack,speed,star,attribute){return {characterId:'',attack:String(attack),speed:String(speed),star:String(star),attribute,race:'normal',commandVariant:''};}
function action(id,extra={}){if(id==='skip')return {kind:'skip',skillName:'',effects:[],...extra};const p=SKILL_PRESET_BY_ID.get(id);assert.ok(p,`missing ${id}`);return {...p,skillPresetId:id,...extra};}
function turn(specs){return {allyActions:specs.map(x=>Array.isArray(x)?action(x[0],x[1]??{}):action(x)),enemyAction:{enabled:true,effect:{type:'none'}}};}
function state(pid,allies,turns,cut='lastAlly'){const s=cloneDefaultState();s.enemy=applyBossPresetToEnemy(s.enemy,pid);s.enemy.enemyExAllowance='0';s.allyCount=3;s.allies=allies;s.turns=turns;s.finalTurnCutoff=cut;return s;}
function approx(a,b,eps=1e-12){assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);}

assert.equal(enemyCompanionProfile('白竜のタマゴ')?.speed,1);
assert.equal(enemyCompanionProfile('シャックル')?.speed,4);
assert.equal(enemyCompanionProfile('デュラ')?.speed,25);

const white=simulateKillProbabilityEnemyManual(state('old6_white_dragon',[char('son_goku','stop1'),char('gyumao','stop2'),char('garanezumi')],[
  turn([['spirit_blessing',{enemyTargetSlot:'0'}],['oni_spirit',{enemyTargetSlot:'0'}],['attack_bang',{enemyTargetSlot:'1'}]]),
  turn([['loki_brand',{enemyTargetSlot:'0'}],['ninja_fire',{enemyTargetSlot:'0'}],['attack_bang',{enemyTargetSlot:'0'}]]),
  turn([['fire2',{enemyTargetSlot:'0'}],['ninja_fire',{enemyTargetSlot:'0'}],['attack_bang',{enemyTargetSlot:'0'}]])
]));
approx(white.killChance,0.9953631502393695);
approx(white.enemyExFailureChance,0.00000722013102517797);
assert.deepEqual(white.activeCompanionCommandProfiles,['白竜のタマゴ']);
assert.equal(white.missingCompanionCommandProfiles.length,0);
assert.ok(white.enemySkillActivation.every(x=>Object.keys(x).length===0));

const enma=simulateKillProbabilityEnemyManual(state('old6_enma',[char('son_goku','stop2'),char('clear_blue_dragon'),char('dartan')],[
  turn([['loki_brand',{enemyTargetSlot:'0'}],['aqua_breath',{enemyTargetSlot:'auto'}],['rengeki',{enemyTargetSlot:'auto'}]]),
  turn([['oni_spirit',{enemyTargetSlot:'0'}],['aqua_breath',{enemyTargetSlot:'auto'}],['rengeki',{enemyTargetSlot:'auto'}]]),
  turn([['ninja_water',{enemyTargetSlot:'0'}],['aqua_breath',{enemyTargetSlot:'auto'}],['rengeki',{enemyTargetSlot:'auto'}]])
]));
approx(enma.killChance,0.9938271604938322);
approx(enma.enemyExFailureChance,0.006172839506172829);
assert.deepEqual(enma.activeCompanionCommandProfiles,['シャックル','シャックル']);
assert.equal(enma.missingCompanionCommandProfiles.length,0);
assert.ok(enma.enemySkillActivation.every(x=>Object.keys(x).length===0));

const tokaiFast=simulateKillProbabilityEnemyManual(state('old6_tokai',[char('son_goku','stop2'),char('gyumao','stop2'),char('elysion')],[
  turn([['sun_blessing'],['princess_cheer',{presetTarget:'ally3'}],['purifying_flame',{enemyTargetSlot:'auto'}]]),
  turn([['loki_brand'],['oni_spirit'],['purifying_flame',{enemyTargetSlot:'auto'}]]),
  turn([['sword_dance'],['ninja_water',{enemyTargetSlot:'auto'}],['purifying_flame',{enemyTargetSlot:'auto'}]]),
  turn([['ninja_water',{enemyTargetSlot:'auto'}],['ikazuchi',{enemyTargetSlot:'auto'}],['purifying_flame',{enemyTargetSlot:'auto'}]])
]));
approx(tokaiFast.killChance,0.998964081209244);
approx(tokaiFast.enemyExFailureChance,0.0002688122351805373);
assert.deepEqual(tokaiFast.activeCompanionCommandProfiles,['ゾンビ','デュラ']);
assert.equal(tokaiFast.missingCompanionCommandProfiles.length,0);
assert.ok(tokaiFast.enemySkillActivation.every(x=>Object.keys(x).length===0));

// 変化周回ではエーリュシオンは攻撃不要。キャラ固有の浄化の炎型を発火させないため、
// 同ステータスの自由入力キャラとして完全スキップさせてWiki記載の条件を再現する。
const tokaiTransform=simulateKillProbabilityEnemyManual(state('old6_tokai',[char('son_goku','stop2'),freeChar(78,52,4,'earth'),char('gyumao','stop2')],[
  turn([['sun_blessing'],['skip'],['oni_spirit']]),
  turn([['loki_brand'],['skip'],['ikazuchi',{enemyTargetSlot:'auto'}]]),
  turn([['oni_spirit'],['skip'],['blue_aqua_breath',{enemyTargetSlot:'auto'}]]),
  turn([['ninja_water',{enemyTargetSlot:'auto'}],['skip'],['blue_aqua_breath',{enemyTargetSlot:'auto'}]])
]));
approx(tokaiTransform.killChance,0.9977339232594514);
approx(tokaiTransform.enemyExFailureChance,0.0002084635718188951);
assert.deepEqual(tokaiTransform.activeCompanionCommandProfiles,['ゾンビ','デュラ']);
assert.equal(tokaiTransform.missingCompanionCommandProfiles.length,0);
assert.ok(tokaiTransform.enemySkillActivation.every(x=>Object.keys(x).length===0));

console.log('old6-manual-regression.test.js: OK');
