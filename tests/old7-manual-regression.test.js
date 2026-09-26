import assert from 'node:assert/strict';
import { cloneDefaultState, simulateKillProbabilityEnemyManual } from '../kill/engine.js';
import { SKILL_PRESET_BY_ID } from '../kill/presets.js';
import { applyBossPresetToEnemy } from '../kill/boss-presets.js';

const chars={
  son_goku:{attack:'84',speed:'78',star:'4',attribute:'wind'},
  gyumao:{attack:'94',speed:'15',star:'4',attribute:'fire'},
  hien:{attack:'63',speed:'77',star:'3',attribute:'wind'},
};
function char(id,v=''){return {characterId:id,...chars[id],race:'normal',commandVariant:v};}
function action(id,extra={}){if(id==='skip')return {kind:'skip',skillName:'',effects:[],...extra};const p=SKILL_PRESET_BY_ID.get(id);assert.ok(p,`missing ${id}`);return {...p,skillPresetId:id,...extra};}
function turn(specs){return {allyActions:specs.map(x=>Array.isArray(x)?action(x[0],x[1]??{}):action(x)),enemyAction:{enabled:true,effect:{type:'none'}}};}
function state(pid,allies,turns,cut='lastAlly'){const s=cloneDefaultState();s.enemy=applyBossPresetToEnemy(s.enemy,pid);s.enemy.enemyExAllowance='0';s.allyCount=3;s.allies=allies;s.turns=turns;s.finalTurnCutoff=cut;return s;}
function approx(a,b,eps=1e-12){assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);}

// 旧7章 魔皇マオタイ。敵行動は手動「効果なし」、敵EX許容0。
const maotai=simulateKillProbabilityEnemyManual(state('old7_maotai',[char('son_goku','stop2'),char('gyumao','stop1'),char('hien')],[
  turn([['loki_brand',{enemyTargetSlot:'0'}],['oni_spirit',{enemyTargetSlot:'0'}],['shiden',{enemyTargetSlot:'0'}]]),
  turn([['rock_throw',{enemyTargetSlot:'0'}],['crush',{enemyTargetSlot:'0'}],['shiden',{enemyTargetSlot:'0'}]])
]));
approx(maotai.killChance,0.9811395756718855);
approx(maotai.enemyExFailureChance,0);
assert.equal(maotai.missingCommandProfiles.length,0);
assert.equal(maotai.missingCommandEffects.length,0);
assert.ok(maotai.enemySkillActivation.every(x=>Object.keys(x).length===0));

// 斉天大聖ソンゴクウ戦はBOSS単体。猿石はプレイヤー側の周回要員。
const gokuBase=state('old7_son_goku',[
  {characterId:'red_magician',attack:'73',speed:'68',star:'3',attribute:'fire',race:'normal',commandVariant:''},
  {characterId:'magician',attack:'63',speed:'57',star:'2',attribute:'fire',race:'normal',commandVariant:''},
  {characterId:'',attack:'21',speed:'94',star:'1',attribute:'earth',race:'normal',commandVariant:''}
],Array.from({length:4},()=>turn([
  ['lava_boost',{enemyTargetSlot:'0'}],
  ['lava_boost',{enemyTargetSlot:'0'}],
  'skip'
])));
const lava=simulateKillProbabilityEnemyManual(gokuBase);
approx(lava.killChance,0.9882512255969921,1e-11);
approx(lava.enemyExFailureChance,0);
assert.deepEqual(lava.activeCompanionCommandProfiles,[]);
assert.equal(lava.missingCompanionCommandProfiles.length,0);
assert.equal(lava.missingCommandProfiles.length,0);
assert.equal(lava.missingCommandEffects.length,0);
assert.ok(lava.enemySkillActivation.every(x=>Object.keys(x).length===0));

console.log('old7-manual-regression.test.js: OK');
