import assert from 'node:assert/strict';
import { cloneDefaultState, simulateKillProbabilityEnemyManual } from '../kill/engine.js';
import { SKILL_PRESET_BY_ID } from '../kill/presets.js';
import { applyBossPresetToEnemy } from '../kill/boss-presets.js';
import { enemyCompanionProfile, enemyCompanionBaseHp } from '../kill/enemy-actions.js';

const chars={
  son_goku:{attack:'84',speed:'78',star:'4',attribute:'wind'},
  gyumao:{attack:'94',speed:'15',star:'4',attribute:'fire'},
  kerogon_blue:{attack:'31',speed:'42',star:'1',attribute:'water'},
  marduk:{attack:'79',speed:'95',star:'4',attribute:'wind'},
  enki:{attack:'78',speed:'57',star:'4',attribute:'wind'},
  damkina:{attack:'68',speed:'89',star:'4',attribute:'wind'},
};
function char(id,v=''){return {characterId:id,...chars[id],race:'normal',commandVariant:v};}
function freeChar(attack,speed,star,attribute){return {characterId:'',attack:String(attack),speed:String(speed),star:String(star),attribute,race:'normal',commandVariant:''};}
function action(id,extra={}){if(id==='skip')return {kind:'skip',skillName:'',effects:[],...extra};const p=SKILL_PRESET_BY_ID.get(id);assert.ok(p,`missing ${id}`);return {...p,skillPresetId:id,...extra};}
function turn(specs){return {allyActions:specs.map(x=>Array.isArray(x)?action(x[0],x[1]??{}):action(x)),enemyAction:{enabled:true,effect:{type:'none'}}};}
function state(pid,allies,turns,cut='lastAlly'){const s=cloneDefaultState();s.enemy=applyBossPresetToEnemy(s.enemy,pid);s.enemy.enemyExAllowance='0';s.allyCount=allies.length;s.allies=allies;s.turns=turns;s.finalTurnCutoff=cut;return s;}
function approx(a,b,eps=1e-12){assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);}

// 新序章 覇将ネルガル戦の参謀エンリルは通常個体ではなくBOSS版。
assert.equal(enemyCompanionBaseHp('参謀エンリル'),650);
assert.equal(enemyCompanionProfile('参謀エンリル')?.speed,60);
assert.equal(enemyCompanionProfile('参謀エンリル')?.attack,50);
assert.equal(enemyCompanionProfile('参謀エンリル')?.attribute,'wind');
assert.equal(enemyCompanionProfile('参謀エンリル')?.matrix.length,6);

const volcano=simulateKillProbabilityEnemyManual(state('new0_volcano_dragon',[char('son_goku','stop1'),char('gyumao','stop2'),char('kerogon_blue')],[
  turn(['spirit_blessing','sea_king_gaze','dragon_tail']),
  turn(['loki_brand','oni_spirit','dragon_tail']),
  turn(['foot_sweep','ninja_wind','dragon_tail'])
]));
approx(volcano.killChance,0.9992283950617262);
approx(volcano.enemyExFailureChance,0);
assert.deepEqual(volcano.activeCompanionCommandProfiles,['火山弾']);

const damkina=simulateKillProbabilityEnemyManual(state('new0_damkina',[char('son_goku','stop1'),char('gyumao','stop1'),freeChar(0,10,1,'fire')],[
  turn(['loki_brand','oni_spirit','skip']),
  turn(['self_destruct','crush','skip'])
]));
approx(damkina.killChance,1);
approx(damkina.enemyExFailureChance,0);
assert.deepEqual(damkina.activeCompanionCommandProfiles,['マト']);

const nergal=simulateKillProbabilityEnemyManual(state('new0_nergal',[char('son_goku','stop1'),char('gyumao','stop2'),char('marduk')],[
  turn(['loki_brand','oni_spirit',['critical_hit',{enemyTargetSlot:'0'}]]),
  turn([['queen_reward',{presetTarget:'ally2'}],'fire_ice_breath2',['critical_hit',{enemyTargetSlot:'0'}]])
]));
approx(nergal.killChance,0.8506185325244581,1e-11);
approx(nergal.enemyExFailureChance,0);
assert.deepEqual(nergal.activeCompanionCommandProfiles,['参謀エンリル']);

const marduk=simulateKillProbabilityEnemyManual(state('new0_marduk',[char('son_goku','stop2'),char('enki'),char('damkina')],[
  turn(['loki_brand',['critical_hit',{enemyTargetSlot:'0'}],['wind2',{enemyTargetSlot:'0'}]]),
  turn(['oni_spirit',['critical_hit',{enemyTargetSlot:'0'}],['wind2',{enemyTargetSlot:'0'}]]),
  turn([['crush',{enemyTargetSlot:'0'}],['critical_hit',{enemyTargetSlot:'0'}],['wind2',{enemyTargetSlot:'0'}]])
]));
approx(marduk.killChance,0.9911913953263881,1e-11);
approx(marduk.enemyExFailureChance,0.008803890707648938,1e-11);

for (const r of [volcano,damkina,nergal,marduk]) {
  assert.equal(r.missingCompanionCommandProfiles.length,0);
  assert.equal(r.missingCommandProfiles.length,0);
  assert.equal(r.missingCommandEffects.length,0);
  assert.ok(r.enemySkillActivation.every(x=>Object.keys(x).length===0));
}
console.log('new0-manual-regression.test.js: OK');
