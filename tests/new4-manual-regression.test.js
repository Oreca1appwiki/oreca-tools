import assert from 'node:assert/strict';
import { cloneDefaultState, simulateKillProbabilityEnemyManual } from '../kill/engine.js';
import { SKILL_PRESET_BY_ID } from '../kill/presets.js';
import { applyBossPresetToEnemy, BOSS_PRESET_BY_ID } from '../kill/boss-presets.js';
import { commandSkillNamesForCharacter } from '../kill/commands.js';

const chars = {
  son_goku:{attack:'84',speed:'78',star:'4',attribute:'wind'},
  gyumao:{attack:'94',speed:'15',star:'4',attribute:'fire'},
  oniwaka_monk:{attack:'63',speed:'47',star:'3',attribute:'wind'},
  grand_blue_dragon:{attack:'78',speed:'52',star:'4',attribute:'water'},
  magora:{attack:'36',speed:'57',star:'1',attribute:'wind'},
  red_empress:{attack:'63',speed:'84',star:'4',attribute:'water'},
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

// 新4章の固定お供を明示する。
assert.deepEqual(BOSS_PRESET_BY_ID.get('new4_iron_dragon').companions, ['鉄のタマゴ']);
assert.deepEqual(BOSS_PRESET_BY_ID.get('new4_garp').companions, ['魔鏡騎士リフレク','ダークサラマンダー']);
assert.deepEqual(BOSS_PRESET_BY_ID.get('new4_phantom').companions, []);
assert.deepEqual(BOSS_PRESET_BY_ID.get('new4_avaddon').companions, ['アヴァドンフード','アヴァドンフード']);
assert.deepEqual(BOSS_PRESET_BY_ID.get('new4_avaddon').enemyExRequiresCompanionNames, ['アヴァドンフード']);
assert.deepEqual(commandSkillNamesForCharacter('grand_blue_dragon'), ['アイスブレス']);

export function buildNew4States(){
  const iron = state('new4_iron_dragon', [
    char('son_goku','stop2'), char('gyumao','stop3'), char('oniwaka_monk')
  ], [
    turn(['loki_brand','oni_spirit','foot_sweep']),
    turn(['ninja_wind','tatsumaki','foot_sweep']),
    turn(['kamaitachi','skip','foot_sweep'])
  ]);

  const garp = state('new4_garp', [
    char('son_goku','stop1'), char('gyumao','stop1'), char('grand_blue_dragon')
  ], [
    turn(['loki_brand','oni_spirit','ice_breath']),
    turn(['self_destruct','peck_many','ice_breath'])
  ]);

  const phantom = state('new4_phantom', [
    char('son_goku','stop1'), char('gyumao','stop24'), char('magora')
  ], [
    turn(['loki_brand','oni_spirit','shout']),
    turn(['peck_many','ninja_wind','shout'])
  ]);

  // Wikiは牛魔王を「鬼の気合入れ→轟く稲妻」までしか指定していない。
  // 3T目は括弧書きのソンゴクウ「忍法 蛇水の術」だけを追撃として扱い、牛魔王の攻撃は追加しない。
  // 赤のエンプレス3T目対象は自由。ソンゴクウはT1支援で既に必要リールへ到達しているため結果には影響しない。
  // またアヴァドンフード全滅後はBOSS EXが使用不能なので、敵EX許容0でもEX失敗にはしない。
  const avaddon = state('new4_avaddon', [
    char('son_goku','stop1'), char('gyumao','stop24'), char('red_empress')
  ], [
    turn(['sun_hymn','oni_spirit',['queen_reward',{presetTarget:'ally1'}]]),
    turn(['blue_aqua_breath','roaring_lightning',['queen_reward',{presetTarget:'ally2'}]]),
    turn(['ninja_water','skip',['queen_reward',{presetTarget:'ally1'}]])
  ], 0, 'ally1');

  const avaddon2 = state('new4_avaddon', [
    char('son_goku','stop1'), char('gyumao','stop24'), char('red_empress')
  ], [
    turn(['sun_hymn','oni_spirit',['queen_reward',{presetTarget:'ally1'}]]),
    turn(['blue_aqua_breath','roaring_lightning',['queen_reward',{presetTarget:'ally2'}]])
  ]);
  return { iron, garp, phantom, avaddon, avaddon2 };
}

const built=buildNew4States();
const results=Object.fromEntries(Object.entries(built).map(([k,s])=>[k,simulateKillProbabilityEnemyManual(s)]));
approx(results.iron.killChance, 0.9917346425458372);
approx(results.iron.enemyExFailureChance, 0.007021505291607609);
approx(results.garp.killChance, 1);
approx(results.garp.enemyExFailureChance, 0);
approx(results.phantom.killChance, 0.99000156639952);
approx(results.phantom.enemyExFailureChance, 0);
approx(results.avaddon.killChance, 0.9930555555555572);
approx(results.avaddon.enemyExFailureChance, 0);
approx(results.avaddon2.killChance, 0.6620369709284548);
approx(results.avaddon2.enemyExFailureChance, 0);

// アヴァドンフード全滅後はEXが使われないため、許容回数を1に変えてもこのチャートの結果は不変。
{
  const s = structuredClone(built.avaddon);
  s.enemy.enemyExAllowance = '1';
  const r = simulateKillProbabilityEnemyManual(s);
  approx(r.killChance, results.avaddon.killChance);
  approx(r.enemyExFailureChance, 0);
}

// Wikiの「1〜3止め何でもよい」を回帰で保証する。
for (const variant of ['stop2','stop3']) {
  const s = structuredClone(built.avaddon);
  s.allies[0].commandVariant = variant;
  const r = simulateKillProbabilityEnemyManual(s);
  approx(r.killChance, results.avaddon.killChance);
  approx(r.enemyExFailureChance, results.avaddon.enemyExFailureChance);
}

for (const [name,r] of Object.entries(results)) {
  assert.equal(r.missingCompanionCommandProfiles.length,0, `${name}: missing companion profile`);
  assert.equal(r.missingCommandProfiles.length,0, `${name}: missing command profile`);
  assert.equal(r.missingCommandEffects.length,0, `${name}: missing command effect`);
  assert.ok(r.enemySkillActivation.every(x=>Object.keys(x).length===0), `${name}: enemy auto action leaked`);
}

console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([k,r])=>[k,{killChance:r.killChance,enemyExFailureChance:r.enemyExFailureChance,companions:r.activeCompanionCommandProfiles}]))));
console.log('new4-manual-regression.test.js: OK');
