import assert from 'node:assert/strict';
import { cloneDefaultState, simulateKillProbabilityEnemyManual } from '../kill/engine.js';
import { SKILL_PRESET_BY_ID } from '../kill/presets.js';
import { applyBossPresetToEnemy, BOSS_PRESET_BY_ID } from '../kill/boss-presets.js';

const chars = {
  son_goku:{attack:'84',speed:'78',star:'4',attribute:'wind'},
  gyumao:{attack:'94',speed:'15',star:'4',attribute:'fire'},
  camineko:{attack:'42',speed:'68',star:'1',attribute:'wind'},
  nanawarai:{attack:'84',speed:'63',star:'4',attribute:'wind'},
  hayate:{attack:'57',speed:'84',star:'3',attribute:'wind'},
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

// 新3章の固定お供順を明示して、対象slotの取り違えを防ぐ。
assert.deepEqual(BOSS_PRESET_BY_ID.get('new3_root_dragon').companions, ['大樹竜の球根','ルートドラン']);
assert.deepEqual(BOSS_PRESET_BY_ID.get('new3_deathfear_plant').companions, ['大樹竜の球根','デスプラント']);
assert.deepEqual(BOSS_PRESET_BY_ID.get('new3_oroshi').companions, ['僧兵オニワカ']);

export function buildNew3States() {
  const root = state('new3_root_dragon', [
    char('son_goku','stop2'), char('gyumao','stop2'), char('camineko')
  ], [
    turn(['sea_king_gaze','loki_brand',['thunder1',{enemyTargetSlot:'0'}]]),
    turn(['oni_spirit','yellow_earth_breath',['thunder1',{enemyTargetSlot:'0'}]]),
    turn(['crush','skip',['thunder1',{enemyTargetSlot:'0'}]])
  ]);

  const deathfear = state('new3_deathfear_plant', [
    char('son_goku','stop2'), char('gyumao','stop2'), char('camineko')
  ], [
    // slot 2 = デスプラント。撃破後は指定slot不在のため本体へフォールバック。
    turn(['loki_brand','oni_spirit',['thunder1',{enemyTargetSlot:'2'}]]),
    turn(['blue_aqua_breath','ninja_water',['thunder1',{enemyTargetSlot:'0'}]]),
    turn(['wet_slicer','skip',['thunder1',{enemyTargetSlot:'0'}]])
  ]);

  const nirahalar = state('new3_nirahalar', [
    char('son_goku','stop2'), char('gyumao','stop1'), char('nanawarai')
  ], [
    turn(['loki_brand','oni_spirit',['attack_bang',{enemyTargetSlot:'0'}]]),
    turn(['oni_spirit','self_destruct',['attack_bang',{enemyTargetSlot:'0'}]]),
    turn(['ninja_fire','skip',['attack_bang',{enemyTargetSlot:'0'}]])
  ]);

  const oroshiSafe = state('new3_oroshi', [
    char('son_goku','stop2'), char('gyumao','stop3'), char('hayate')
  ], [
    // slot 1 = 僧兵オニワカ。ハヤテはまずオニワカを落とし、死亡後は本体へ自動フォールバック。
    turn(['headwind','sea_king_gaze',['attack_bang',{enemyTargetSlot:'1'}]]),
    turn(['growl','kerakuzu',['attack_bang',{enemyTargetSlot:'1'}]]),
    turn(['oni_spirit','loki_brand',['attack_bang',{enemyTargetSlot:'1'}]]),
    turn(['crush','skip',['attack_bang',{enemyTargetSlot:'1'}]])
  ]);
  return { root, deathfear, nirahalar, oroshiSafe };
}

const built = buildNew3States();
const results = Object.fromEntries(Object.entries(built).map(([k,s]) => [k, simulateKillProbabilityEnemyManual(s)]));

// Wikiチャート現行基準値（敵EX許容0、敵行動は手動・未指定は効果なし）。
approx(results.root.killChance, 0.9953703703703649);
approx(results.root.enemyExFailureChance, 0.004012981478719997);
approx(results.deathfear.killChance, 0.9742511357553636);
approx(results.deathfear.enemyExFailureChance, 0.025701175507782968);
approx(results.nirahalar.killChance, 0.993827997663363);
approx(results.nirahalar.enemyExFailureChance, 0);
approx(results.oroshiSafe.killChance, 0.9758965580984634);
approx(results.oroshiSafe.enemyExFailureChance, 0.02048792561629536);

assert.deepEqual(results.root.activeCompanionCommandProfiles, ['大樹竜の球根','ルートドラン']);
assert.deepEqual(results.deathfear.activeCompanionCommandProfiles, ['大樹竜の球根','デスプラント']);
assert.deepEqual(results.nirahalar.activeCompanionCommandProfiles, []);
assert.deepEqual(results.oroshiSafe.activeCompanionCommandProfiles, ['僧兵オニワカ']);
for (const [name,r] of Object.entries(results)) {
  assert.equal(r.missingCompanionCommandProfiles.length,0, `${name}: missing companion profile`);
  assert.equal(r.missingCommandProfiles.length,0, `${name}: missing command profile`);
  assert.equal(r.missingCommandEffects.length,0, `${name}: missing command effect`);
  assert.ok(r.enemySkillActivation.every(x=>Object.keys(x).length===0), `${name}: enemy auto action leaked`);
  assert.ok(Number.isFinite(r.killChance), `${name}: killChance finite`);
  assert.ok(Number.isFinite(r.enemyExFailureChance), `${name}: ex fail finite`);
}

console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([k,r])=>[k,{killChance:r.killChance,enemyExFailureChance:r.enemyExFailureChance,companions:r.activeCompanionCommandProfiles}]))));
console.log('new3-manual-regression.test.js: OK');
