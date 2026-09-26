import assert from 'node:assert/strict';
import { cloneDefaultState, simulateKillProbabilityEnemyManual } from '../kill/engine.js';
import { SKILL_PRESET_BY_ID } from '../kill/presets.js';
import { applyBossPresetToEnemy, BOSS_PRESET_BY_ID } from '../kill/boss-presets.js';

const chars = {
  son_goku:{attack:'84',speed:'78',star:'4',attribute:'wind'},
  gyumao:{attack:'94',speed:'15',star:'4',attribute:'fire'},
  garanezumi:{attack:'31',speed:'73',star:'1',attribute:'earth'},
  red_empress:{attack:'63',speed:'84',star:'4',attribute:'water'},
  clear_blue_dragon:{attack:'73',speed:'68',star:'4',attribute:'water'},
  saezer:{attack:'68',speed:'52',star:'3',attribute:'water'},
  dante_magic_swordsman:{attack:'68',speed:'31',star:'3',attribute:'fire'},
};
function char(id, variant=''){ return { characterId:id, ...chars[id], race:'normal', commandVariant:variant }; }
function action(id, extra={}) {
  if (id === 'skip') return { kind:'skip', skillName:'', effects:[], ...extra };
  const p = SKILL_PRESET_BY_ID.get(id); assert.ok(p, `missing ${id}`);
  return { ...p, skillPresetId:id, ...extra };
}
function turn(specs){ return { allyActions:specs.map(x => Array.isArray(x) ? action(x[0], x[1] ?? {}) : action(x)), enemyAction:{enabled:true,effect:{type:'none'}} }; }
function state(pid, allies, turns, allowance=0, cutoff='lastAlly') {
  const s=cloneDefaultState(); s.enemy=applyBossPresetToEnemy(s.enemy,pid); s.enemy.enemyExAllowance=String(allowance);
  s.allyCount=allies.length; s.allies=allies; s.turns=turns; s.finalTurnCutoff=cutoff; return s;
}
function approx(a,b,eps=1e-12){ assert.ok(Math.abs(a-b)<=eps, `${a} != ${b}`); }

// 新1章 海竜ストリームドラゴンは単体BOSS。海竜のしずくは固定お供ではない。
assert.equal(BOSS_PRESET_BY_ID.get('new1_stream_dragon').inferCompanions, false);
assert.deepEqual(BOSS_PRESET_BY_ID.get('new1_stream_dragon').companions, []);

const stream = simulateKillProbabilityEnemyManual(state('new1_stream_dragon', [
  char('son_goku','stop1'), char('gyumao','stop2'), char('garanezumi')
], [
  turn(['loki_brand','oni_spirit','attack_bang']),
  turn(['spirit_blessing','ninja_fire','attack_bang']),
  turn(['self_destruct','skip','attack_bang'])
]));
approx(stream.killChance, 0.9953703703703667, 1e-11);
approx(stream.enemyExFailureChance, 0);
assert.deepEqual(stream.activeCompanionCommandProfiles, []);

const fiska = simulateKillProbabilityEnemyManual(state('new1_fiska', [
  char('son_goku','stop1'), char('gyumao','stop24'), char('red_empress')
], [
  turn(['kerakuzu','loki_brand',['queen_reward',{presetTarget:'ally1'}]]),
  turn(['fire_ice_breath2','oni_spirit',['queen_reward',{presetTarget:'ally1'}]]),
  turn([['marking_arrow',{enemyTargetSlot:'0'}],'poison_crush',['queen_reward',{presetTarget:'ally2'}]])
]));
approx(fiska.killChance, 0.9988425925925942, 1e-11);
approx(fiska.enemyExFailureChance, 0);
assert.deepEqual(fiska.activeCompanionCommandProfiles, ['魔海兵ブリュー','魔海魚ブブリ']);

// フィスカ周回では赤のエンプレスは「女王のごほうび」(+3)だけでなく
// 「王女のせいえん」(+2)でも必要リールへ届くため、どちらも成功行動として扱える。
function fiskaWithFixedEmpressSkill(skillName) {
  const s = state('new1_fiska', [
    char('son_goku','stop1'), char('gyumao','stop24'), char('red_empress')
  ], [
    turn(['kerakuzu','loki_brand',['queen_reward',{presetTarget:'ally1'}]]),
    turn(['fire_ice_breath2','oni_spirit',['queen_reward',{presetTarget:'ally1'}]]),
    turn([['marking_arrow',{enemyTargetSlot:'0'}],'poison_crush',['queen_reward',{presetTarget:'ally2'}]])
  ]);
  for (const t of s.turns) t.allyActions[2].fixedCharacterSkill = skillName;
  return simulateKillProbabilityEnemyManual(s);
}
const fiskaRewardOnly = fiskaWithFixedEmpressSkill('女王のごほうび');
const fiskaCheerOnly = fiskaWithFixedEmpressSkill('王女のせいえん');
// +3なら牛魔王は必ず4リールへ届くため確定。
// +2でもほぼ成功するが、牛魔王が2ターン連続で1リール停止した枝では3リールから
// 2-4止め型の3/6で停止し、さらにどくつぶし5/6を外す極小失敗枝が残る。
approx(fiskaRewardOnly.killChance, 1, 1e-11);
approx(fiskaCheerOnly.killChance, 0.9976851851851881, 1e-11);
approx(fiska.killChance, (fiskaRewardOnly.killChance + fiskaCheerOnly.killChance) / 2, 1e-11);
// マーキングアローは魔海将フィスカ本体（slot 0）固定。
assert.equal(fiska.activeCompanionCommandProfiles.length, 2);
assert.equal(fiska.timeline.length, 3);

// ロボ零参式のWiki周回は2T目の敵EX自爆を勝ち筋にする。通常験算ルール（許容0）ではEX発動＝失敗。
const robo = simulateKillProbabilityEnemyManual(state('new1_robo_03', [
  char('clear_blue_dragon'), char('saezer'), char('dante_magic_swordsman')
], [
  turn(['aqua_breath','attack_bang','attack_bang']),
  turn(['aqua_breath','attack_bang','attack_bang'])
], 0, 'turnEnd'));
approx(robo.killChance, 0);
approx(robo.enemyExFailureChance, 1);
assert.deepEqual(robo.activeCompanionCommandProfiles, ['ロボ零壱式','ロボ零弐式']);

for (const r of [stream,fiska,robo]) {
  assert.equal(r.missingCompanionCommandProfiles.length,0);
  assert.equal(r.missingCommandProfiles.length,0);
  assert.equal(r.missingCommandEffects.length,0);
  assert.ok(r.enemySkillActivation.every(x=>Object.keys(x).length===0));
}
console.log('new1-manual-regression.test.js: OK');
