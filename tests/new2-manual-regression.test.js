import assert from 'node:assert/strict';
import { cloneDefaultState, simulateKillProbabilityEnemyManual } from '../kill/engine.js';
import { SKILL_PRESET_BY_ID } from '../kill/presets.js';
import { applyBossPresetToEnemy, BOSS_PRESET_BY_ID } from '../kill/boss-presets.js';
import { hasCommandProfile } from '../kill/commands.js';

const chars = {
  son_goku:{attack:'84',speed:'78',star:'4',attribute:'wind'},
  gyumao:{attack:'94',speed:'15',star:'4',attribute:'fire'},
  camineko:{attack:'42',speed:'68',star:'1',attribute:'wind'},
  bero:{attack:'47',speed:'42',star:'1',attribute:'wind'},
  kerogon_green:{attack:'31',speed:'52',star:'1',attribute:'wind'},
  djinn:{attack:'63',speed:'84',star:'4',attribute:'wind'},
  simon:{attack:'68',speed:'47',star:'3',attribute:'fire'},
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
function approx(a,b,eps=1e-12){ assert.ok(Math.abs(a-b)<=eps, `${a} != ${b}`); }

// 新2章追加プリセット監査。
assert.ok(hasCommandProfile('bero','3回こうげき'));
assert.ok(hasCommandProfile('simon','こうげき！'));
assert.equal(BOSS_PRESET_BY_ID.get('new2_vamps_dragon').inferCompanions, false);
assert.deepEqual(BOSS_PRESET_BY_ID.get('new2_vamps_dragon').companions, []);
assert.deepEqual(BOSS_PRESET_BY_ID.get('new2_ash_dragon').companions, ['竜灰']);

export function buildNew2States() {
  const arp = state('new2_arp', [
    char('son_goku','stop2'), char('camineko'), char('bero')
  ], [
    turn(['oni_spirit','fire1','triple_attack']),
    turn(['ninja_fire','fire1','triple_attack'])
  ]);

  const ash = state('new2_ash_dragon', [
    char('son_goku','stop2'), char('gyumao','stop2'), char('kerogon_green')
  ], [
    turn(['loki_brand','oni_spirit','dragon_tail']),
    turn(['wet_slicer','ninja_water','dragon_tail'])
  ]);

  const gnome = state('new2_gnome', [
    char('son_goku','stop1'), char('gyumao','stop2'), char('djinn')
  ], [
    turn(['spirit_blessing','sun_blessing','wind2']),
    turn(['loki_brand','oni_spirit','wind2']),
    turn(['oni_spirit','ninja_water','wind2']),
    turn(['bubble_grand','skip','wind2'])
  ]);

  const vamps = state('new2_vamps_dragon', [
    char('son_goku','stop1'), char('gyumao','stop2'), char('simon')
  ], [
    turn(['sun_blessing','sea_king_gaze',['attack_bang',{enemyTargetSlot:'0'}]]),
    turn(['loki_brand','oni_spirit',['attack_bang',{enemyTargetSlot:'0'}]]),
    turn(['peck_many','ninja_wind',['attack_bang',{enemyTargetSlot:'0'}]])
  ]);
  return {arp, ash, gnome, vamps};
}

const built = buildNew2States();
const results = Object.fromEntries(Object.entries(built).map(([k,s]) => [k, simulateKillProbabilityEnemyManual(s)]));

// Wikiチャートの現行基準値（敵EX許容0、敵行動は手動・未指定は効果なし）。
approx(results.arp.killChance, 0.9468549552029052, 1e-11);
approx(results.arp.enemyExFailureChance, 0, 1e-11);
approx(results.ash.killChance, 0.9903656186899263, 1e-11);
approx(results.ash.enemyExFailureChance, 0, 1e-11);
approx(results.gnome.killChance, 0.9992283950609381, 1e-11);
approx(results.gnome.enemyExFailureChance, 7.838496965851564e-13, 1e-11);
approx(results.vamps.killChance, 0.9992283950617145, 1e-11);
approx(results.vamps.enemyExFailureChance, 0, 1e-11);

assert.deepEqual(results.arp.activeCompanionCommandProfiles, []);
assert.deepEqual(results.ash.activeCompanionCommandProfiles, ['竜灰']);
assert.deepEqual(results.gnome.activeCompanionCommandProfiles, []);
assert.deepEqual(results.vamps.activeCompanionCommandProfiles, []);
for (const [name,r] of Object.entries(results)) {
  assert.equal(r.missingCompanionCommandProfiles.length,0, `${name}: missing companion profile`);
  assert.equal(r.missingCommandProfiles.length,0, `${name}: missing command profile`);
  assert.equal(r.missingCommandEffects.length,0, `${name}: missing command effect`);
  assert.ok(r.enemySkillActivation.every(x=>Object.keys(x).length===0), `${name}: enemy auto action leaked`);
  assert.ok(Number.isFinite(r.killChance), `${name}: killChance finite`);
  assert.ok(Number.isFinite(r.enemyExFailureChance), `${name}: ex fail finite`);
}

console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([k,r])=>[k,{killChance:r.killChance,enemyExFailureChance:r.enemyExFailureChance,companions:r.activeCompanionCommandProfiles}]))));
console.log('new2-manual-regression.test.js: OK');
