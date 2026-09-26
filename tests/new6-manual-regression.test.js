import assert from 'node:assert/strict';
import { cloneDefaultState, simulateKillProbabilityEnemyManual } from '../kill/engine.js';
import { SKILL_PRESET_BY_ID } from '../kill/presets.js';
import { normalCommandTransitions } from '../kill/commands.js';
import { applyBossPresetToEnemy, BOSS_PRESET_BY_ID } from '../kill/boss-presets.js';
import { enemyCompanionProfile, enemyCompanionBaseHp } from '../kill/enemy-actions.js';

const chars = {
  son_goku:{attack:'84',speed:'78',star:'4',attribute:'wind'},
  gyumao:{attack:'94',speed:'15',star:'4',attribute:'fire'},
  kerogon_blue:{attack:'31',speed:'42',star:'1',attribute:'water'},
  scarlet_dragon:{attack:'89',speed:'47',star:'4',attribute:'fire'},
  camineko:{attack:'42',speed:'68',star:'1',attribute:'wind'},
  magora:{attack:'36',speed:'57',star:'1',attribute:'wind'},
  sky_clay:{attack:'73',speed:'73',star:'4',attribute:'earth'},
  clear_blue_dragon:{attack:'73',speed:'68',star:'4',attribute:'water'},
  dartan:{attack:'78',speed:'36',star:'4',attribute:'earth'},
};
function char(id, variant=''){ return { characterId:id, ...chars[id], race:'normal', commandVariant:variant }; }
function action(id, extra={}) {
  if (id === 'skip') return { kind:'skip', skillName:'', effects:[], ...extra };
  const p = SKILL_PRESET_BY_ID.get(id); assert.ok(p, `missing skill ${id}`);
  return { ...p, skillPresetId:id, ...extra };
}
function turn(specs){ return { allyActions:specs.map(x => Array.isArray(x) ? action(x[0], x[1] ?? {}) : action(x)), enemyAction:{enabled:true,effect:{type:'none'}} }; }
function state(pid, allies, turns, allowance=0, cutoff='lastAlly') {
  const s=cloneDefaultState(); s.enemy=applyBossPresetToEnemy(s.enemy,pid); s.enemy.enemyExAllowance=String(allowance);
  s.allyCount=allies.length; s.allies=allies; s.turns=turns; s.finalTurnCutoff=cutoff; return s;
}
function approx(a,b,eps=1e-11){ assert.ok(Math.abs(a-b)<=eps, `${a} != ${b}`); }

// 新6章の固定編成と行動タイミング用お供データ。
assert.deepEqual(BOSS_PRESET_BY_ID.get('new6_necro_dragon').companions, ['鬼竜骨']);
assert.deepEqual(BOSS_PRESET_BY_ID.get('new6_elysion').companions, ['天戦士クレイ','カマエル']);
assert.deepEqual(BOSS_PRESET_BY_ID.get('new6_wight').companions, ['アルラ']);
assert.deepEqual(BOSS_PRESET_BY_ID.get('new6_arc_dragon').companions, ['聖なるタマゴ']);
assert.deepEqual(BOSS_PRESET_BY_ID.get('new6_kais').companions, ['フランケンボーイ']);
assert.equal(enemyCompanionBaseHp('鬼竜骨'), 15);
assert.equal(enemyCompanionProfile('鬼竜骨')?.speed, 1);
assert.equal(enemyCompanionBaseHp('聖なるタマゴ'), 5);
assert.equal(enemyCompanionProfile('聖なるタマゴ')?.speed, 2);

// Wiki掲載の周回用コマンド型を固定。
{
  const t = normalCommandTransitions('kerogon_blue','ウォーターブレス',0,'');
  assert.equal(t.length,2); assert.equal(t[0].commandName,'竜のしっぽ'); assert.equal(t[1].commandName,'ウォーターブレス');
  approx(t[0].probability,1/6); approx(t[1].probability,5/6);
}
{
  const t = normalCommandTransitions('clear_blue_dragon','アクアブレス',0,'');
  assert.equal(t.length,2); assert.equal(t[0].commandName,'アクアブレス'); assert.equal(t[1].commandName,'クリアアクアブレス');
  approx(t[0].probability,5/6); approx(t[1].probability,1/6);
}
approx(normalCommandTransitions('dartan','こうげき！',0,'')[0]?.probability ?? 0, 1);

export function buildNew6States(){
  const necro = state('new6_necro_dragon', [
    char('son_goku','stop1'), char('gyumao','stop2'), char('kerogon_blue')
  ], [
    turn(['loki_brand','oni_spirit','water_breath']),
    turn([['bubble_grand',{enemyTargetSlot:'0'}],'ninja_water','water_breath'])
  ]);

  const elysion = state('new6_elysion', [
    char('son_goku','stop2'), char('gyumao','stop2'), char('scarlet_dragon')
  ], [
    turn(['loki_brand','oni_spirit','dragon_tail']),
    turn(['oni_spirit','ninja_water','dragon_tail']),
    turn(['wet_slicer','skip','dragon_tail'])
  ]);

  // キャミネコはアルラ(slot1)を優先。撃破後はengineの単体指定フォールバックでBOSS本体へ移る。
  const wight = state('new6_wight', [
    char('son_goku','stop2'), char('camineko'), char('magora')
  ], [
    turn(['loki_brand',['thunder1',{enemyTargetSlot:'1'}],'shout']),
    turn(['oni_spirit',['thunder1',{enemyTargetSlot:'1'}],'shout']),
    turn(['ninja_water',['thunder1',{enemyTargetSlot:'1'}],'shout'])
  ]);

  const arc = state('new6_arc_dragon', [
    char('son_goku','stop1'), char('gyumao','stop2'), char('sky_clay')
  ], [
    turn(['loki_brand','oni_spirit',['attack_bang',{enemyTargetSlot:'0'}]]),
    turn(['self_destruct','ninja_water',['attack_bang',{enemyTargetSlot:'0'}]])
  ]);

  // 敵行動手動「効果なし」ではカイスのロボ弐式召喚は発生しないため、Wikiの召喚時分岐は不要。
  // ダルタンはフランケンボーイ(slot1)優先、撃破後はBOSS本体へフォールバック。
  const kais = state('new6_kais', [
    char('son_goku','stop3'), char('clear_blue_dragon'), char('dartan')
  ], [
    turn(['loki_brand','aqua_breath',['attack_bang',{enemyTargetSlot:'1'}]]),
    turn(['oni_spirit','aqua_breath',['attack_bang',{enemyTargetSlot:'1'}]]),
    turn(['ninja_fire','aqua_breath',['attack_bang',{enemyTargetSlot:'1'}]])
  ]);

  return { necro, elysion, wight, arc, kais };
}

const built = buildNew6States();
const results = Object.fromEntries(Object.entries(built).map(([k,s]) => [k,simulateKillProbabilityEnemyManual(s)]));
approx(results.necro.killChance, 0.9758043667367944);
approx(results.necro.enemyExFailureChance, 0);
approx(results.elysion.killChance, 0.9905558167589311);
approx(results.elysion.enemyExFailureChance, 0.009444183241066353);
approx(results.wight.killChance, 0.9938271604938296);
approx(results.wight.enemyExFailureChance, 0);
approx(results.arc.killChance, 0.9949643260519946);
approx(results.arc.enemyExFailureChance, 0);
approx(results.kais.killChance, 0.9938271579019234);
approx(results.kais.enemyExFailureChance, 2.5919074238504353e-9);

for (const [name,r] of Object.entries(results)) {
  assert.equal(r.missingCompanionCommandProfiles.length,0, `${name}: missing companion profile`);
  assert.equal(r.missingCommandProfiles.length,0, `${name}: missing command profile`);
  assert.equal(r.missingCommandEffects.length,0, `${name}: missing command effect`);
  assert.ok(r.enemySkillActivation.every(x=>Object.keys(x).length===0), `${name}: enemy auto action leaked`);
}

console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([k,r]) => [k,{killChance:r.killChance,enemyExFailureChance:r.enemyExFailureChance,companions:r.activeCompanionCommandProfiles}]))));
console.log('new6-manual-regression.test.js: OK');
