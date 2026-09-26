import assert from 'node:assert/strict';
import { cloneDefaultState, simulateKillProbabilityEnemyManual } from '../kill/engine.js';
import { SKILL_PRESET_BY_ID } from '../kill/presets.js';
import { applyBossPresetToEnemy, BOSS_PRESET_BY_ID } from '../kill/boss-presets.js';
import { enemyCompanionProfile, enemyCompanionBaseHp } from '../kill/enemy-actions.js';

const chars = {
  son_goku:{attack:'84',speed:'78',star:'4',attribute:'wind'},
  gyumao:{attack:'94',speed:'15',star:'4',attribute:'fire'},
  oniwaka_monk:{attack:'63',speed:'47',star:'3',attribute:'wind'},
  guardian_powan:{attack:'73',speed:'73',star:'4',attribute:'water'},
  captain_azul:{attack:'63',speed:'42',star:'3',attribute:'water'},
  black_knight_gebolg:{attack:'74',speed:'31',star:'3',attribute:'fire'},
  rakshasa:{attack:'53',speed:'21',star:'2',attribute:'earth'},
  // マシュまろ周回ではペンタ／ヤタガラスの技は撃破に関与しないため、実ステータス相当でskipさせる。
  penta:{attack:'30',speed:'50',star:'1',attribute:'water'},
  yatagarasu:{attack:'30',speed:'60',star:'1',attribute:'wind'},
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

// 固定編成を先に回帰。マシュまろはenemyCount=3の専用処理なので、同名2体はruntimeのお供として二重追加しない。
assert.equal(BOSS_PRESET_BY_ID.get('new5_mashumaro').enemyCount, 3);
assert.deepEqual(BOSS_PRESET_BY_ID.get('new5_glacier_dragon').companions, ['竜氷山']);
assert.deepEqual(BOSS_PRESET_BY_ID.get('new5_barolo').companions, []);
assert.deepEqual(BOSS_PRESET_BY_ID.get('new5_sea_serpent').companions, ['深海タマゴ']);
assert.deepEqual(BOSS_PRESET_BY_ID.get('new5_god_barolo').companions, ['巫女ラムーネ']);
assert.equal(enemyCompanionBaseHp('深海タマゴ'), 6);
assert.equal(enemyCompanionProfile('深海タマゴ')?.speed, 2);
assert.equal(enemyCompanionBaseHp('巫女ラムーネ'), 161);
assert.equal(enemyCompanionProfile('巫女ラムーネ')?.speed, 59);

export function buildNew5States(){
  // マシュまろ①：ペンタ／ヤタガラスは金策・補助枠で、撃破そのものには関与しない。
  const mashu1 = state('new5_mashumaro', [
    char('son_goku','stop1'), char('penta'), char('yatagarasu')
  ], [
    turn(['oni_spirit','skip','skip']),
    turn(['self_destruct','skip','skip'])
  ]);

  // マシュまろ②：ヒートウェイブ2体で全体攻撃を連打。2Tまで追跡。
  const mashu2 = state('new5_mashumaro', [
    char('black_knight_gebolg'), char('rakshasa'), char('penta')
  ], [
    turn(['heat_wave','heat_wave','skip']),
    turn(['heat_wave','heat_wave','skip'])
  ]);

  const glacier = state('new5_glacier_dragon', [
    char('son_goku','stop1'), char('gyumao','stop2'), char('oniwaka_monk')
  ], [
    turn(['loki_brand','oni_spirit',['foot_sweep',{enemyTargetSlot:'0'}]]),
    turn(['spirit_blessing',['ninja_fire',{enemyTargetSlot:'0'}],['foot_sweep',{enemyTargetSlot:'0'}]]),
    turn([['fire2',{enemyTargetSlot:'0'}],'skip',['foot_sweep',{enemyTargetSlot:'0'}]])
  ]);

  const barolo = state('new5_barolo', [
    char('son_goku','stop2'), char('gyumao','stop3'), char('captain_azul')
  ], [
    turn(['sun_blessing','loki_brand',['shibire_giri',{enemyTargetSlot:'0'}]]),
    turn(['oni_spirit','oni_spirit',['shibire_giri',{enemyTargetSlot:'0'}]]),
    turn([['ninja_fire',{enemyTargetSlot:'0'}],['red_point_2',{enemyTargetSlot:'0'}],['shibire_giri',{enemyTargetSlot:'0'}]])
  ]);

  const serpent = state('new5_sea_serpent', [
    char('son_goku','stop1'), char('gyumao','stop2'), char('oniwaka_monk')
  ], [
    turn(['loki_brand','oni_spirit',['foot_sweep',{enemyTargetSlot:'0'}]]),
    turn(['spirit_blessing',['ninja_fire',{enemyTargetSlot:'0'}],['foot_sweep',{enemyTargetSlot:'0'}]]),
    turn([['fire2',{enemyTargetSlot:'0'}],'skip',['foot_sweep',{enemyTargetSlot:'0'}]])
  ]);

  // 初手：ソンゴクウの全体ヒートウェイブ→ポワンが巫女ラムーネ(slot1)を狙って処理。
  // 牛魔王の女王のごほうびはソンゴクウ(ally1)固定。
  const godBarolo = state('new5_god_barolo', [
    char('son_goku','stop24'), char('gyumao','stop3'), char('guardian_powan')
  ], [
    turn(['heat_wave',['queen_reward',{presetTarget:'ally1'}],['bubble_grand',{enemyTargetSlot:'1'}]]),
    turn(['kerakuzu','oni_spirit',['bubble_grand',{enemyTargetSlot:'0'}]]),
    turn(['loki_brand',['red_point_2',{enemyTargetSlot:'0'}],['bubble_grand',{enemyTargetSlot:'0'}]]),
    turn([['dark_fire',{enemyTargetSlot:'0'}],'skip',['bubble_grand',{enemyTargetSlot:'0'}]])
  ]);

  return { mashu1, mashu2, glacier, barolo, serpent, godBarolo };
}

const built = buildNew5States();
const results = Object.fromEntries(Object.entries(built).map(([k,s]) => [k,simulateKillProbabilityEnemyManual(s)]));
approx(results.mashu1.killChance, 1);
approx(results.mashu1.enemyExFailureChance, 0);
approx(results.mashu2.killChance, 0.9999999999999977);
approx(results.mashu2.enemyExFailureChance, 0);
approx(results.glacier.killChance, 0.9953614358489352);
approx(results.glacier.enemyExFailureChance, 0.000007594343232582174);
approx(results.barolo.killChance, 0.9681379553421748);
approx(results.barolo.enemyExFailureChance, 0);
approx(results.serpent.killChance, 0.9953703703703943);
approx(results.serpent.enemyExFailureChance, 0);
approx(results.godBarolo.killChance, 0.9708401815180007);
approx(results.godBarolo.enemyExFailureChance, 0.02915981848199589);

// 神海帝バローロはWiki指示どおり、T1のヒートウェイブ＋ポワンのシャボン・グランでラムーネを行動前に確実に処理する。
{
  const s = structuredClone(built.godBarolo);
  s.turns = s.turns.slice(0,1);
  s.finalTurnCutoff = 'ally3';
  const r = simulateKillProbabilityEnemyManual(s);
  assert.ok([...r.hpDistribution.keys()].every(k => String(k).split(',')[1] === '0'), '巫女ラムーネがT1終了時に残存');
}

for (const [name,r] of Object.entries(results)) {
  assert.equal(r.missingCompanionCommandProfiles.length,0, `${name}: missing companion profile`);
  assert.equal(r.missingCommandProfiles.length,0, `${name}: missing command profile`);
  assert.equal(r.missingCommandEffects.length,0, `${name}: missing command effect`);
  assert.ok(r.enemySkillActivation.every(x=>Object.keys(x).length===0), `${name}: enemy auto action leaked`);
}

console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([k,r]) => [k,{killChance:r.killChance,enemyExFailureChance:r.enemyExFailureChance,companions:r.activeCompanionCommandProfiles}]))));
console.log('new5-manual-regression.test.js: OK');
