import assert from 'node:assert/strict';
import { cloneDefaultState, simulateKillProbability } from '../kill/engine.js';
import { enemyCompanionSkillForCommand, enemySkillForCommand, enemyCompanionProfile, enemyCompanionBaseHp } from '../kill/enemy-actions.js';

function approx(actual, expected, eps = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= eps, `expected ${expected}, got ${actual}`);
}

// v0.5.56: ガープの物理法則が「お供の物理半減 + 睡眠」として実計算される。
const s = cloneDefaultState();
s.allyCount = 1;
s.enemy = { presetId:'new4_garp', maxHp:'100', attribute:'fire', race:'demon', attack:'60', speed:'70' };
s.allies[0] = { characterId:'', attack:'250', speed:'1', star:'4', attribute:'none', race:'normal', commandVariant:'' };
s.turns[0].allyActions[0] = { kind:'attack', skillName:'全体物理試験', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', enemyTarget:'all', hits:'1', effects:[] };
s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
const r = simulateKillProbability(s);
const lawProbability = r.enemySkillActivation[0]['ガープの物理法則'];
approx(lawProbability, 7 / 12, 1e-12);
approx(r.killChance, 1 - lawProbability, 1e-12);
const reflectActivation = Object.entries(r.enemySkillActivation[0])
  .filter(([name]) => name.startsWith('お供:魔鏡騎士リフレク / '))
  .reduce((sum, [,p]) => sum + p, 0);
approx(reflectActivation, (1 - lawProbability) * 5 / 6, 1e-12);



// v0.5.61: 残存no-op監査 — プリンセスのおうえん／ブランチ／フェンリルの寝る。
{
  const cheer = enemySkillForCommand('プリンセスのおうえん', 'old0_red_princess');
  assert.equal(cheer?.effects?.[0]?.type, 'enemyTeamSingleReelShift');
  assert.equal(cheer?.effects?.[0]?.amount, 1);

  // 4ターン回すと、おうえんによるBOSS/キドリのリール上昇を含めても欠落技が出ない。
  const p = cloneDefaultState();
  p.allyCount = 1;
  p.enemy = { presetId:'old0_red_princess', maxHp:'1500', attribute:'fire', race:'demon', attack:'20', speed:'20' };
  p.allies[0] = { characterId:'', attack:'1', speed:'1', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  p.turns[0].allyActions[0] = { kind:'skip', effects:[] };
  p.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  while (p.turns.length < 4) p.turns.push(JSON.parse(JSON.stringify(p.turns[0])));
  const pr = simulateKillProbability(p);
  assert.ok((pr.enemySkillActivation[2]['プリンセスのおうえん'] ?? 0) > 0.5);
  assert.deepEqual(pr.missingCommandEffects, []);

  const branch = enemySkillForCommand('ブランチ', 'new3_root_dragon');
  assert.equal(branch?.effects?.[0]?.type, 'summonCompanion');
  assert.equal(branch.effects[0].name, 'ルートン');
  assert.equal(enemyCompanionBaseHp('ルートン'), 101);
  assert.equal(enemyCompanionProfile('ルートン')?.speed, 33);
  assert.equal(enemyCompanionProfile('ルートン')?.attack, 33);

  // T1で固定お供を全滅させた後のブランチ1/6枝は、内部CPU自動召喚テーブルどおりルートンを100%補充する。
  const b = cloneDefaultState();
  b.allyCount = 1;
  b.enemy = { presetId:'new3_root_dragon', maxHp:'9999', attribute:'wind', race:'dragon', attack:'60', speed:'64' };
  b.allies[0] = { characterId:'', attack:'500', speed:'100', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  b.turns[0].allyActions[0] = { kind:'attack', skillName:'全体魔法試験', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none', attackType:'magic', enemyTarget:'all', hits:'1', effects:[] };
  b.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  b.turns.push(JSON.parse(JSON.stringify(b.turns[0])));
  b.turns[1].allyActions[0] = { kind:'skip', effects:[] };
  const br = simulateKillProbability(b);
  const branchMass = br.enemySkillActivation[0]['ブランチ'] ?? 0;
  approx(branchMass, 1 / 6, 1e-12);
  const rootonMass = [...br.hpDistribution].filter(([hp]) => String(hp).endsWith(',101')).reduce((sum,[,prob]) => sum + prob, 0);
  const rootdranMass = [...br.hpDistribution].filter(([hp]) => String(hp).endsWith(',169')).reduce((sum,[,prob]) => sum + prob, 0);
  approx(rootonMass, branchMass, 1e-12);
  approx(rootdranMass, 0, 1e-12);

  const sleep = enemyCompanionSkillForCommand('寝る', 'フェンリル');
  assert.equal(sleep?.kind, 'companionSleepBlessing');
  assert.equal(sleep?.sleepRemainingAfterCast, 4);
  assert.equal(enemyCompanionBaseHp('フェンリル'), 174);

  // ソルティドッグ召喚直後のフェンリルHPはLv1最低値174。従来の未登録HP=1扱いを防ぐ。
  const f = cloneDefaultState();
  f.allyCount = 1;
  f.enemy = { presetId:'old5_kujeska', maxHp:'9999', attribute:'water', race:'demon', attack:'50', speed:'50' };
  f.allies[0] = { characterId:'', attack:'1', speed:'1', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  f.turns[0].allyActions[0] = { kind:'skip', effects:[] };
  f.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  f.turns.push(JSON.parse(JSON.stringify(f.turns[0])));
  f.turns[1].allyActions[0] = { kind:'skip', effects:[] };
  const fr = simulateKillProbability(f);
  const salty = fr.enemySkillActivation[0]['ソルティドッグ'] ?? 0;
  assert.ok(salty > 0);
  const fenrirHpMass = [...fr.hpDistribution]
    .filter(([hp]) => String(hp).split(',').some((part, index) => index > 0 && part === '174'))
    .reduce((sum,[,prob]) => sum + prob, 0);
  assert.ok(fenrirHpMass > 0);
  assert.ok((fr.enemySkillActivation[1]['お供:フェンリル / 寝る'] ?? 0) > 0);
}

console.log('companion-defense.test.js: OK');

// v0.5.57: リフレクの通常反射技は1ターン、自身への魔法攻撃を無効化する。
// 反射ダメージは味方HPを追跡しないため省略するが、反射された被弾は敵EXにも加算しない。
const m = cloneDefaultState();
m.allyCount = 1;
m.enemy = { presetId:'new4_garp', maxHp:'100', attribute:'fire', race:'demon', attack:'60', speed:'70' };
m.allies[0] = { characterId:'', attack:'250', speed:'1', star:'4', attribute:'none', race:'normal', commandVariant:'' };
m.turns[0].allyActions[0] = { kind:'attack', skillName:'全体魔法試験', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none', attackType:'magic', enemyTarget:'all', hits:'1', effects:[] };
m.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
const mr = simulateKillProbability(m);
const magicReflectProbability =
  (mr.enemySkillActivation[0]['お供:魔鏡騎士リフレク / マジック・リフレクト'] ?? 0) +
  (mr.enemySkillActivation[0]['お供:魔鏡騎士リフレク / トール・マジック・リフレクト'] ?? 0) +
  (mr.enemySkillActivation[0]['お供:魔鏡騎士リフレク / グラン・マジック・リフレクト'] ?? 0);
approx(magicReflectProbability, 35 / 432, 1e-12);
approx(mr.killChance, 1 - magicReflectProbability, 1e-12);

// v0.5.57: アヴァドンフードの【ふたをする】は物理技1回無効+即再行動。
// 2体のお供がそれぞれ1/6で発動するため、全体物理で全滅できるのは両方とも未発動の25/36。
const a = cloneDefaultState();
a.allyCount = 1;
a.enemy = { presetId:'new4_avaddon', maxHp:'100', attribute:'earth', race:'demon', attack:'20', speed:'0' };
a.allies[0] = { characterId:'', attack:'500', speed:'20', star:'4', attribute:'none', race:'normal', commandVariant:'' };
a.turns[0].allyActions[0] = { kind:'attack', skillName:'全体物理試験', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', enemyTarget:'all', hits:'1', effects:[] };
a.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
const ar = simulateKillProbability(a);
approx(ar.enemySkillActivation[0]['お供:アヴァドンフード / ふたをする'] ?? 0, 1 / 3, 1e-12);
approx(ar.killChance, 25 / 36, 1e-12);

// 【ふたをする】後は使用マスをミス化して即再抽選するため、EX+nコマンドの期待加算も1回分増える。
const ax = cloneDefaultState();
ax.allyCount = 1;
ax.enemy = { presetId:'new4_avaddon', maxHp:'100', attribute:'earth', race:'demon', attack:'20', speed:'0' };
ax.allies[0] = { characterId:'', attack:'1', speed:'20', star:'4', attribute:'none', race:'normal', commandVariant:'' };
ax.turns[0].allyActions[0] = { kind:'skip', effects:[] };
ax.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
const axr = simulateKillProbability(ax);
const meanEnemyEx = [...axr.enemyExGaugeDistribution].reduce((sum, [gauge, probability]) => sum + gauge * probability, 0);
approx(meanEnemyEx, 49 / 18, 1e-12);


// v0.5.58: 残存no-op監査で撃破率に直結する3効果を実効果へ接続。
{
  const revive = enemyCompanionSkillForCommand('ふっかつの秘法', 'デメラ');
  assert.equal(revive?.effects?.[0]?.type, 'reviveEnemyCompanionFull');

  const spirit = enemySkillForCommand('スピリット・グロウ', 'new3_root_dragon');
  assert.equal(spirit?.enemyExGain, 1);
  assert.equal(spirit?.effects?.[0]?.type, 'companionPostActionEnemyExGain');
  assert.equal(spirit?.effects?.[0]?.value, 1);

  const counter = enemyCompanionSkillForCommand('クロスカウンター', 'フランケンボーイ');
  assert.equal(counter?.effects?.[0]?.type, 'enemySelfDefenseBuff');
  assert.equal(counter?.effects?.[0]?.value, 50);
  assert.deepEqual(counter?.effects?.[0]?.attackTypes, ['physical']);
  assert.equal(counter?.effects?.[0]?.duration, 1);
}

// v0.5.59: 参謀エンリルの【ミラージュ】は3ターン、物理攻撃を行動単位で50%回避する。
// 発動した確率枝の半分だけ全体物理を回避し、一撃全滅に失敗する。
{
  const mirage = enemyCompanionSkillForCommand('ミラージュ', '参謀エンリル');
  assert.equal(mirage?.effects?.[0]?.type, 'companionSelfPhysicalEvasion');
  assert.equal(mirage?.effects?.[0]?.chance, 50);
  assert.equal(mirage?.effects?.[0]?.duration, 3);

  const e = cloneDefaultState();
  e.allyCount = 1;
  e.enemy = { presetId:'new0_nergal', maxHp:'100', attribute:'wind', race:'warrior', attack:'50', speed:'50' };
  e.allies[0] = { characterId:'', attack:'500', speed:'1', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  e.turns[0].allyActions[0] = { kind:'attack', skillName:'全体物理試験', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', enemyTarget:'all', hits:'3', effects:[] };
  e.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  const er = simulateKillProbability(e);
  const mp = er.enemySkillActivation[0]['お供:参謀エンリル / ミラージュ'] ?? 0;
  assert.ok(mp > 0);
  approx(er.killChance, 1 - mp / 2, 1e-12);
}


// v0.5.59: オプティカルカモフラージュは1ターン単体選択不可 + 物理40%回避。
{
  const optical = enemySkillForCommand('オプティカルカモフラージュ', 'new1_stream_dragon');
  assert.ok(optical?.effects?.some(x => x.type === 'enemySingleTargetUntargetable'));
  assert.ok(optical?.effects?.some(x => x.type === 'enemyPhysicalEvasion' && x.chance === 40));

  const base = () => {
    const s = cloneDefaultState();
    s.allyCount = 1;
    s.enemy = { presetId:'new1_stream_dragon', maxHp:'100', attribute:'water', race:'seaDragon', attack:'60', speed:'65' };
    s.allies[0] = { characterId:'', attack:'1000', speed:'1', star:'4', attribute:'earth', race:'normal', commandVariant:'' };
    s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
    return s;
  };

  // 単体魔法：カモフラージュ枝では単体BOSSを選択できないため、その枝では攻撃不発。
  const single = base();
  single.turns[0].allyActions[0] = { kind:'attack', skillName:'単体魔法試験', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none', attackType:'magic', enemyTarget:'single', hits:'1', effects:[] };
  const sr = simulateKillProbability(single);
  const op = sr.enemySkillActivation[0]['オプティカルカモフラージュ'] ?? 0;
  approx(sr.hpDistribution.get(100) ?? 0, op, 1e-12);
  approx(sr.killChance, 1 - op, 1e-12);

  // 全体物理：単体対象不可は関係せず、BOSS本人だけ40%回避する。
  const allPhysical = base();
  allPhysical.turns[0].allyActions[0] = { kind:'attack', skillName:'全体物理試験', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', enemyTarget:'all', hits:'1', effects:[] };
  const pr = simulateKillProbability(allPhysical);
  approx(pr.killChance, 1 - op * 0.4, 1e-12);

  // 全体魔法は透明化・物理回避のどちらにも阻害されない。
  const allMagic = base();
  allMagic.turns[0].allyActions[0] = { kind:'attack', skillName:'全体魔法試験', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none', attackType:'magic', enemyTarget:'all', hits:'1', effects:[] };
  const mr = simulateKillProbability(allMagic);
  approx(mr.killChance, 1, 1e-12);
}

// v0.5.60: (BOSS)赤のプリンセス専用【召喚★★】は、
// BOSS召喚枠の吟遊詩人キドリが不在のときだけ補充する。
{
  const summon = enemySkillForCommand('召喚★★', 'old0_red_princess');
  const effect = summon?.effects?.[0];
  assert.equal(effect?.type, 'summonCompanion');
  assert.equal(effect?.name, '吟遊詩人キドリ');
  assert.equal(effect?.startReel, 0);
  assert.equal(effect?.onlyIfMissing, true);
}

// v0.5.61: 海竜の舌なめずり — 基礎EX+3、場の水族1体につきさらに+2。
{
  const tongue = enemySkillForCommand('海竜の舌なめずり', 'new5_sea_serpent');
  assert.equal(tongue?.effects?.[0]?.type, 'seaDragonTongueEx');
  assert.equal(tongue?.effects?.[0]?.base, 3);
  assert.equal(tongue?.effects?.[0]?.perWaterRace, 2);

  function seaSerpentState(race) {
    const s = cloneDefaultState();
    s.allyCount = 3;
    s.enemy = { presetId:'new5_sea_serpent', maxHp:'1700', attribute:'water', race:'normal', attack:'60', speed:'45' };
    for (let i = 0; i < 3; i++) {
      s.allies[i] = { characterId:'', attack:'1', speed:'1', star:'4', attribute:'none', race, commandVariant:'' };
    }
    s.turns[0].allyActions = s.allies.slice(0, 3).map(() => ({ kind:'skip', effects:[] }));
    s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
    s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
    return s;
  }

  // 水族0体ならT1舌なめずりは+3止まりで、T2開始前にEX10へ届かない。
  const noWater = simulateKillProbability(seaSerpentState('normal'));
  approx(noWater.enemyExFailureChance, 0, 1e-12);

  // 水族3体なら舌なめずりは+9。T1発動枝はターン終了+1でEX10となり、T2のBOSS行動時に失敗する。
  // v0.6.02以降は固定お供「深海タマゴ」の行動機会も正しく保持するため、T2に舌なめずりを引いた枝も
  // 直後の深海タマゴ行動前にEX10へ到達して失敗する。したがってT2までの失敗率はT1+T2舌なめずり質量。
  const threeWater = simulateKillProbability(seaSerpentState('waterRace'));
  const tongueT1 = threeWater.enemySkillActivation[0]['海竜の舌なめずり'] ?? 0;
  const tongueT2 = threeWater.enemySkillActivation[1]['海竜の舌なめずり'] ?? 0;
  assert.ok(tongueT1 > 0 && tongueT2 > 0);
  approx(threeWater.enemyExFailureChance, tongueT1 + tongueT2, 1e-12);
  approx(threeWater.enemyExFailureByTurn[1], tongueT1 + tongueT2, 1e-12);
}

// v0.5.62: ナンクルマルの【ゆうらん】は一時離脱→次の本人行動でHP100回復して復帰。
{
  const yuran = enemyCompanionSkillForCommand('ゆうらん', 'ナンクルマル');
  assert.equal(yuran?.kind, 'companionExcursionHeal');
  assert.equal(yuran?.target, 'self');
  assert.equal(yuran?.healValue, 100);
}
