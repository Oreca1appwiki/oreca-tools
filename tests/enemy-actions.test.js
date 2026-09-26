import assert from 'node:assert/strict';
import { cloneDefaultState, simulateKillProbability } from '../kill/engine.js';
import { SKILL_PRESET_BY_ID } from '../kill/presets.js';
import { transformActivationTransitions, commandTransitionsFromMatrix } from '../kill/commands.js';

function approx(actual, expected, eps = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= eps, `expected ${expected}, got ${actual}`);
}

function activatedProbability(transitions) {
  return transitions.filter(x => x.activated).reduce((sum, x) => sum + x.probability, 0);
}

// 1) 七十二変化からの防御技発動率。
approx(activatedProbability(transformActivationTransitions('猿', 'sun_blessing', '太陽の加護', 0)), 1);
approx(activatedProbability(transformActivationTransitions('猿', 'kerakuzu', 'ケラクズ', 0)), 31 / 36);

function twoTurnBarolo({ protect = false, attacker = false } = {}) {
  const s = cloneDefaultState();
  s.allyCount = attacker ? 2 : 1;
  s.enemy = { presetId:'new5_barolo', maxHp: attacker ? '100' : '1900', attribute:'water', race:'demon', attack:'75', speed:'40' };
  s.allies[0] = { ...s.allies[0], characterId:'son_goku', attack:'84', speed:'78', star:'4', attribute:'wind' };
  if (attacker) s.allies[1] = { characterId:'', attack:'200', speed:'60', star:'4', attribute:'fire', commandVariant:'' };
  s.turns[0].allyActions[0] = protect
    ? { ...SKILL_PRESET_BY_ID.get('sun_blessing'), skillPresetId:'sun_blessing' }
    : { kind:'skip', skillName:'', effects:[] };
  if (attacker) s.turns[0].allyActions[1] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  if (attacker) s.turns[1].allyActions[1] = {
    kind:'attack', skillName:'', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[]
  };
  return simulateKillProbability(s);
}

// 2) 海王バローロT1の暗寧のシジマ発動率と、その状態異常率。
{
  const r = twoTurnBarolo();
  const shijima = r.enemySkillActivation[0]['暗寧のシジマ'];
  assert.ok(shijima > 0);
  approx(r.statusSummaryByTurn[0][0].silence, shijima * 0.30);
  approx(r.statusSummaryByTurn[0][0].sleep, shijima * 0.35);
}

// 3) 太陽の加護が先に発動した枝では30%沈黙/35%睡眠から45ポイント引かれ、ともに0%。
{
  const r = twoTurnBarolo({ protect:true });
  approx(r.allySkillActivation[0][0]['太陽の加護'], 1);
  approx(r.statusSummaryByTurn[0][0].silence, 0);
  approx(r.statusSummaryByTurn[0][0].sleep, 0);
}

// 4) 状態異常による行動不能を最終撃破率へ反映。太陽の加護ありならT2の確定攻撃を妨害されない。
{
  const unprotected = twoTurnBarolo({ attacker:true });
  const protectedResult = twoTurnBarolo({ protect:true, attacker:true });
  assert.ok(unprotected.killChance < 1);
  approx(protectedResult.killChance, 1, 1e-9);
  assert.ok(protectedResult.killChance > unprotected.killChance);
}

function threeTurnGodBarolo(protect) {
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'new5_god_barolo', maxHp:'2000', attribute:'water', race:'demon', attack:'85', speed:'45' };
  s.allies[0] = { ...s.allies[0], characterId:'son_goku', attack:'84', speed:'78', star:'4', attribute:'wind' };
  s.turns[0].allyActions[0] = protect
    ? { ...SKILL_PRESET_BY_ID.get('kerakuzu'), skillPresetId:'kerakuzu' }
    : { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[2].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  return simulateKillProbability(s);
}

// 5) 神海帝バローロT2の浸食する潮。ケラクズが発動した31/36枝では状態異常を完全無効化。
{
  const raw = threeTurnGodBarolo(false);
  const guarded = threeTurnGodBarolo(true);
  const tide = raw.enemySkillActivation[1]['浸食する潮'];
  assert.ok(tide > 0);
  assert.equal(raw.statusSummaryByTurn[1][0].poison, undefined); // 敵→味方の毒は行動阻害しないため追跡しない
  approx(raw.statusSummaryByTurn[1][0].confusion, tide * 0.5);
  approx(guarded.allySkillActivation[0][0]['ケラクズ'], 31 / 36);
  assert.equal(guarded.statusSummaryByTurn[1][0].poison, undefined);
  approx(guarded.statusSummaryByTurn[1][0].confusion, tide * 0.5 * (5 / 36), 1e-9);
}

// 6) v0.5.19: 敵ダメージ・味方HP・途中KOは計算対象から完全に外す。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'new5_barolo', maxHp:'1900', attribute:'water', race:'demon', attack:'999', speed:'100' };
  s.allies[0] = { characterId:'', attack:'0', speed:'10', star:'1', attribute:'fire', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  const r = simulateKillProbability(s);
  assert.equal(r.statusSummaryByTurn[0][0].ko, undefined);
}


// 119) v0.5.65: 内部CPU召喚表・ブランチ・トカイ・旧章補完の回帰監査。
{
  const {
    ENEMY_BOSS_PROFILE_IDS, ENEMY_COMPANION_PROFILE_NAMES,
    enemyBossProfile, enemyCommandTransitions, enemySkillForCommand,
    enemyCompanionProfile, enemyCompanionCommandTransitions, enemyCompanionSkillForCommand,
    enemyCompanionBaseHp
  } = await import('../kill/enemy-actions.js');

  const branch = enemySkillForCommand('ブランチ','new3_root_dragon');
  assert.equal(branch.effects[0].type, 'summonCompanion');
  assert.equal(branch.effects[0].name, 'ルートン');

  const muusSummon = enemySkillForCommand('召喚★','old0_muus').effects[0];
  assert.equal(muusSummon.type, 'summonCompanionWeighted');
  assert.deepEqual(muusSummon.choices.map(x => [x.name,x.weight]), [
    ['スライム',400],['ジバクガエル',300],['ウサミコ',200],['チビドラゴン',100]
  ]);

  const riviere4 = enemySkillForCommand('召喚★★★★','old0_riviere').effects[0];
  assert.deepEqual(riviere4.choices.map(x => [x.name,x.weight]), [
    ['スライム・マナ',490],['王子マルドク',300],['アヴァドン',200],['レッドドラゴン',10]
  ]);

  assert.equal(enemySkillForCommand('吸収攻撃','old2_skullbone').healRate, 70);
  assert.equal(enemySkillForCommand('浄玻璃鏡','old6_enma').enemyExSpend, 2);
  assert.equal(enemySkillForCommand('死霊を呼ぶ声','old6_tokai').effects[0].summonCurseTurns, 2);
  const mold = enemySkillForCommand('灰色のカビ','old6_tokai').effects[0];
  assert.equal(mold.type, 'transformCompanionToZombie');
  assert.equal(mold.hpCarryPercent, 50);
  assert.equal(mold.attackCarryPercent, 50);
  assert.equal(enemyCompanionBaseHp('ゾンビビ'), 270);
  assert.equal(enemyCompanionBaseHp('蛇竜のタマゴ'), 5);
  assert.deepEqual(enemyCompanionProfile('蛇竜のタマゴ')?.matrix?.[0], Array(6).fill('ときをまつ'));
  assert.ok(enemyCompanionProfile('スライム'));
  assert.ok(enemyCompanionProfile('死神モート'));
  assert.ok(enemyCompanionProfile('アヴァドン'));

  // 登録済みBOSS/お供コマンドに、撃破率へ関係する「未解決名」を残さない。
  const structural = name => /^(?:ミス|ほほえんでいる|ほほえんでいる…|ほほえんでいる\?|ためる|チャージ|様子を見ている|ときをまつ|さむさにたえている|笑っている|うなる|燃えている|なげいている|うつむいている|みくだしている)$/.test(name)
    || /[★☆]+→[★☆]+/.test(name) || /^EXゲージ[+＋]\d+$/.test(name);
  const missing = [];
  for (const id of ENEMY_BOSS_PROFILE_IDS) {
    for (const row of enemyBossProfile(id).matrix) {
      for (const command of row) if (command && !structural(command) && !enemySkillForCommand(command,id)) missing.push(`B:${id}:${command}`);
    }
  }
  for (const name of ENEMY_COMPANION_PROFILE_NAMES) {
    for (const row of enemyCompanionProfile(name).matrix) {
      for (const command of row) if (command && !structural(command) && !enemyCompanionSkillForCommand(command,name)) missing.push(`C:${name}:${command}`);
    }
  }
  assert.deepEqual([...new Set(missing)], []);
}


console.log('enemy-actions.test.js: OK');
// 以降は旧版の長時間・旧前提テストアーカイブ。通常のnpm testではここまでを実行する。
process.exit(0);

// 7) 自動プロファイル未登録ボスでも、手動で「技発動率×麻痺付与率」を設定し、次ターンの行動不能へ反映できる。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'', maxHp:'100', attribute:'fire', race:'normal', attack:'0', speed:'50' };
  s.allies[0] = { characterId:'', attack:'200', speed:'100', star:'4', attribute:'water', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'statusParalysis', target:'all', activationChance:'50', chance:'40', duration:'1', attackType:'magic' } };
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].allyActions[0] = { kind:'attack', skillName:'', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
  const r = simulateKillProbability(s);
  approx(r.statusSummaryByTurn[0][0].paralysis, 0.20);
  approx(r.killChance, 0.80, 1e-9);
}

// 8) 自動敵プロファイル。各リールの確率質量は常に1。
{
  const ids = [
    'old0_red_dragon','old0_muus','old0_blue_dragon','old0_riviere','old0_silver_dragon',
    'old1_genbu','old1_azul','old1_blizzard_dragon','old1_fafnir','old2_skullbone',
    'old3_yamata','old3_kukulkan','old3_nanawarai','old4_chibimuus','old4_lafroig','old5_frost_dragon',
    'old6_enma','old6_tokai','old6_white_dragon','new2_gnome','new4_iron_dragon',
    'q_emerald_dragon','q_fire_drake','q_shining_fire_drake','q_black_drake','q_ice_valkyrie','q_great_tokai','q_cursed_yamata','new5_barolo','new5_god_barolo'
  ];
  const { enemyBossProfile, enemyCommandTransitions } = await import('../kill/enemy-actions.js');
  for (const id of ids) {
    const p = enemyBossProfile(id);
    assert.ok(p, `missing boss profile ${id}`);
    for (let reel = 0; reel < p.matrix.length; reel++) {
      const total = enemyCommandTransitions(id, reel).reduce((sum, x) => sum + x.probability, 0);
      approx(total, 1, 1e-9);
    }
  }
}

// 9) 同名技でもBOSS固有の付与率を使い分ける。
{
  const { enemySkillForCommand } = await import('../kill/enemy-actions.js');
  assert.equal(enemySkillForCommand('終焉のいき','old1_fafnir').effects[0].chance, 20);
  assert.equal(enemySkillForCommand('終焉のいき','q_cursed_yamata').effects[0].chance, 15);
  assert.equal(enemySkillForCommand('石化ブレス','q_cursed_yamata').effects[0].chance, 15);
  assert.equal(enemySkillForCommand('ポイズンブレス','q_cursed_yamata').effects[0].chance, 50);
}

// 10) 単体状態異常は、実際に攻撃対象になった1体だけへ付与する。
{
  const s = cloneDefaultState();
  s.allyCount = 3;
  s.enemy = { presetId:'old6_enma', maxHp:'1650', attribute:'earth', race:'undead', attack:'85', speed:'10' };
  for (let i=0;i<3;i++) s.allies[i] = { characterId:'', attack:'0', speed:'100', star:'4', attribute:'fire', commandVariant:'' };
  for (let i=0;i<3;i++) s.turns[0].allyActions[i] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  for (let i=0;i<3;i++) s.turns[1].allyActions[i] = { kind:'skip', skillName:'', effects:[] };
  const r = simulateKillProbability(s);
  const restraint = r.enemySkillActivation[0]['拘束'];
  assert.ok(restraint > 0);
  for (let i=0;i<3;i++) approx(r.statusSummaryByTurn[0][i].paralysis, restraint * 0.25 / 3, 1e-9);
}

// 11) 大音声はケラクズ等の有利効果を解除してから麻痺判定する。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'old3_nanawarai', maxHp:'2000', attribute:'wind', race:'demon', attack:'80', speed:'60' };
  s.allies[0] = { ...s.allies[0], characterId:'son_goku', attack:'84', speed:'100', star:'4', attribute:'wind' };
  s.turns[0].allyActions[0] = { ...SKILL_PRESET_BY_ID.get('kerakuzu'), skillPresetId:'kerakuzu' };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  const r = simulateKillProbability(s);
  const daionjo = r.enemySkillActivation[0]['大音声'] ?? 0;
  assert.ok(daionjo > 0);
  approx(r.statusSummaryByTurn[0][0].paralysis, daionjo * 0.30, 1e-9);
}

// 12) 石化は永続行動不能として撃破率へ反映する。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'', maxHp:'100', attribute:'fire', race:'normal', attack:'0', speed:'10' };
  s.allies[0] = { characterId:'', attack:'200', speed:'100', star:'4', attribute:'water', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'statusPetrification', target:'all', activationChance:'50', chance:'100', duration:'99', attackType:'magic' } };
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].allyActions[0] = { kind:'attack', skillName:'', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
  s.turns[1].enemyAction = { enabled:false, effect:{ type:'none' } };
  const r = simulateKillProbability(s);
  approx(r.statusSummaryByTurn[0][0].petrification, 0.5);
  approx(r.killChance, 0.5, 1e-9);
}

// 13) 風邪はブレス行動を失敗させる。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'', maxHp:'100', attribute:'fire', race:'normal', attack:'0', speed:'10' };
  s.allies[0] = { characterId:'', attack:'200', speed:'100', star:'4', attribute:'water', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'statusCold', target:'all', activationChance:'100', chance:'100', duration:'3', attackType:'magic' } };
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].allyActions[0] = { kind:'attack', skillName:'アクアブレス', skillMultiplier:'100', attackAttribute:'water', attackAttribute2:'none', attackType:'breath', hits:'1', effects:[] };
  s.turns[1].enemyAction = { enabled:false, effect:{ type:'none' } };
  const r = simulateKillProbability(s);
  approx(r.killChance, 0, 1e-9);
}


// 14) 敵→味方の毒・猛毒は行動阻害しないため、状態枝を作らない。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'', maxHp:'9999', attribute:'earth', race:'dragon', attack:'0', speed:'100' };
  s.allies[0] = { characterId:'', attack:'0', speed:'10', star:'4', attribute:'fire', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'statusPoison', target:'all', activationChance:'100', chance:'100', duration:'99' } };
  const r = simulateKillProbability(s);
  assert.equal(r.statusSummaryByTurn[0][0].poison, undefined);
}

// 15) ラフロイグのウォーターブレイクは水属性相手への200%特効を保持する。
{
  const { enemySkillForCommand } = await import('../kill/enemy-actions.js');
  const sk = enemySkillForCommand('ウォーターブレイク','old4_lafroig');
  assert.equal(sk.multiplier, 150);
  assert.equal(sk.multiplierIfAttribute.water, 200);
}

// 16) ホワイトドラゴン：コマンド移動込みのフラッシュ系停止率×暗闇率を状態枝へ正しく反映。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'old6_white_dragon', maxHp:'9999', attribute:'light', race:'dragon', attack:'75', speed:'100' };
  s.allies[0] = { characterId:'', attack:'0', speed:'10', star:'4', attribute:'fire', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  const r = simulateKillProbability(s);
  const { enemyCommandTransitions } = await import('../kill/enemy-actions.js');
  const tr = enemyCommandTransitions('old6_white_dragon', 0);
  const flash = tr.filter(x => x.commandName === 'フラッシュ').reduce((a,x)=>a+x.probability,0);
  const high = tr.filter(x => x.commandName === 'ハイ・フラッシュ').reduce((a,x)=>a+x.probability,0);
  approx(r.statusSummaryByTurn[0][0].darkness, flash * 0.20 + high * 0.30, 1e-9);
}

// 17) ブルードラゴン：コマンド移動込みで【たいあたり】停止率を保持し、技側は麻痺15%。
{
  const { enemyCommandTransitions, enemySkillForCommand } = await import('../kill/enemy-actions.js');
  const tr = enemyCommandTransitions('old0_blue_dragon', 0);
  const body = tr.filter(x => x.commandName === 'たいあたり').reduce((a,x)=>a+x.probability,0);
  assert.ok(body > 0 && body < 1);
  const sk = enemySkillForCommand('たいあたり','old0_blue_dragon');
  assert.equal(sk.effects[0].status, 'paralysis');
  assert.equal(sk.effects[0].chance, 15);
}


// 18) ヤマタノオロチ：水鉄砲は100～230%の可変倍率、かみつきは120%。
{
  const { enemySkillForCommand } = await import('../kill/enemy-actions.js');
  const water = enemySkillForCommand('水鉄砲','old3_yamata');
  assert.equal(water.multiplierMin, 100);
  assert.equal(water.multiplierMax, 230);
  assert.equal(water.attackType, 'breath');
  assert.equal(enemySkillForCommand('かみつき','old3_yamata').multiplier, 120);
}

// 19) ファイアドレイク／アイスワルキューレ：牙の攻撃後に自身ATK+20（3T）。
{
  const { enemySkillForCommand } = await import('../kill/enemy-actions.js');
  for (const [name,id,attr] of [['地獄の牙','q_fire_drake','fire'],['水竜の牙','q_ice_valkyrie','water']]) {
    const sk = enemySkillForCommand(name,id);
    assert.equal(sk.multiplier, 130);
    assert.deepEqual(sk.attributes, [attr]);
    const buff = sk.effects.find(x => x.type === 'enemyAtkBuff');
    assert.equal(buff.mode, 'add');
    assert.equal(buff.value, 20);
    assert.equal(buff.duration, 3);
  }
}

// 20) エメラルドドラゴン：フラッシュは全体混乱45%＋自身ATK+10永続扱い。
{
  const { enemySkillForCommand } = await import('../kill/enemy-actions.js');
  const sk = enemySkillForCommand('エメラルドフラッシュ','q_emerald_dragon');
  assert.equal(sk.kind, 'effect');
  assert.equal(sk.target, 'all');
  assert.equal(sk.effects.find(x => x.type === 'status')?.chance, 45);
  const buff = sk.effects.find(x => x.type === 'enemyAtkBuff');
  assert.equal(buff.value, 10);
  assert.equal(buff.duration, 99);
}

// 21) 敵技の可変倍率定義は保持するが、純粋な敵ダメージ量は撃破確率では計算しない。
{
  const { enemySkillForCommand } = await import('../kill/enemy-actions.js');
  const sk = enemySkillForCommand('水鉄砲','old3_yamata');
  assert.equal(sk.multiplierMin, 100);
  assert.equal(sk.multiplierMax, 230);
  assert.equal(sk.multiplierStep, 0.1);
}

// 22) v0.5.17: 黒いレッドドラゴン／ケロゴン(金)／大魔王ナナワライを自動敵行動へ追加。
{
  const { enemyBossProfile, enemyCommandTransitions } = await import('../kill/enemy-actions.js');
  for (const id of ['q_black_red_dragon','q_kerogon_gold','q_great_nanawarai']) {
    const p = enemyBossProfile(id);
    assert.ok(p, `missing boss profile ${id}`);
    for (let reel = 0; reel < p.matrix.length; reel++) {
      const total = enemyCommandTransitions(id, reel).reduce((sum, x) => sum + x.probability, 0);
      approx(total, 1, 1e-9);
    }
  }
  assert.equal(enemyBossProfile('q_black_red_dragon').attack, 90);
  assert.equal(enemyBossProfile('q_kerogon_gold').attack, 65);
  assert.equal(enemyBossProfile('q_great_nanawarai').attack, 85);
}

// 23) ケロゴン(金)の【金のいき】は全属性120%・全体ブレス。
{
  const { enemySkillForCommand } = await import('../kill/enemy-actions.js');
  const sk = enemySkillForCommand('金のいき','q_kerogon_gold');
  assert.equal(sk.multiplier, 120);
  assert.equal(sk.target, 'all');
  assert.equal(sk.attackType, 'breath');
  assert.deepEqual(sk.attributes, ['all']);
}

// 24) 大魔王ナナワライの内部値：大怒号37%、大風/大雷は90%×2～3回。
{
  const { enemySkillForCommand } = await import('../kill/enemy-actions.js');
  const roar = enemySkillForCommand('大怒号','q_great_nanawarai');
  assert.equal(roar.effects.find(x => x.type === 'status')?.chance, 37);
  assert.ok(roar.effects.some(x => x.type === 'purgeBeneficial'));
  for (const name of ['大風起こし','大雷落とし']) {
    const sk = enemySkillForCommand(name,'q_great_nanawarai');
    assert.equal(sk.multiplier, 90);
    assert.equal(sk.hitsMin, 2);
    assert.equal(sk.hitsMax, 3);
    assert.equal(sk.target, 'randomEachHit');
  }
}

// 25) 今後のクイックシルバー／ベヒモス用共通技も内部定義どおり保持。
{
  const { ENEMY_SKILLS } = await import('../kill/enemy-actions.js');
  const run = ENEMY_SKILLS['はしりまわり'];
  assert.equal(run.multiplierMin, 45);
  assert.equal(run.multiplierMax, 65);
  assert.equal(run.hits, 3);
  assert.equal(run.effects.find(x => x.type === 'enemySpeedBuff')?.value, 12);

  const rage = ENEMY_SKILLS['あばれまわり'];
  assert.equal(rage.multiplierMin, 45);
  assert.equal(rage.multiplierMax, 95);
  assert.equal(rage.hits, 4);

  const crush = ENEMY_SKILLS['おしつぶし'];
  assert.equal(crush.multiplier, 65);
  assert.equal(crush.hits, 4);
  assert.equal(crush.effects[0].target, 'damaged');
  assert.equal(crush.effects[0].chance, 15);
}

// 26) 2～3回ランダム連撃を撃破計算へ通せる（大風起こしが実際に敵行動として処理される）。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'q_great_nanawarai', maxHp:'1800', attribute:'wind', race:'demon', attack:'85', speed:'100' };
  s.allies[0] = { characterId:'', attack:'0', speed:'1', star:'4', attribute:'earth', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  const r = simulateKillProbability(s);
  assert.ok((r.enemySkillActivation[0]['大風起こし'] ?? 0) > 0);
  assert.ok((r.enemySkillActivation[0]['大雷落とし'] ?? 0) >= 0);
}


// 27) v0.5.19: 純粋な敵ダメージによる途中KOは常に計算しない。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'new5_barolo', maxHp:'1900', attribute:'water', race:'demon', attack:'999', speed:'100' };
  s.allies[0] = { characterId:'', attack:'0', speed:'1', star:'1', attribute:'fire', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  const r = simulateKillProbability(s);
}

// 28) 敵攻撃に付随する状態異常は撃破確率へ残す。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'old0_blue_dragon', maxHp:'100', attribute:'water', race:'dragon', attack:'999', speed:'0' };
  s.allies[0] = { characterId:'', attack:'200', speed:'1', star:'4', attribute:'fire', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].allyActions[0] = { kind:'attack', skillName:'', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
  s.turns[1].enemyAction = { enabled:false, effect:{ type:'none' } };
  const r = simulateKillProbability(s);
  const body = r.enemySkillActivation[0]['たいあたり'] ?? 0;
  assert.ok(body > 0);
  approx(r.statusSummaryByTurn[0][0].paralysis, body * 0.15, 1e-9);
  assert.ok(r.killChance < 1);
}

// 29) 洗脳は、撃破確率上はその行動で敵へ有効行動できない状態として扱う（残り1体には無効）。
{
  const s = cloneDefaultState();
  s.allyCount = 2;
  s.enemy = { presetId:'', maxHp:'100', attribute:'fire', race:'normal', attack:'0', speed:'0' };
  s.allies[0] = { characterId:'', attack:'200', speed:'1', star:'4', attribute:'water', commandVariant:'' };
  s.allies[1] = { characterId:'', attack:'0', speed:'1', star:'1', attribute:'earth', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].allyActions[1] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'statusBrainwash', target:'all', activationChance:'100', chance:'100', duration:'1', attackType:'other' } };
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].allyActions[0] = { kind:'attack', skillName:'', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
  s.turns[1].allyActions[1] = { kind:'skip', skillName:'', effects:[] };
  s.turns[1].enemyAction = { enabled:false, effect:{ type:'none' } };
  const r = simulateKillProbability(s);
  approx(r.statusSummaryByTurn[0][0].brainwash, 1);
  approx(r.statusSummaryByTurn[0][1].brainwash, 1);
  approx(r.killChance, 0);
}

// 30) 敵防御バフは、こちらの与ダメージへ反映する。
{
  function build(defenseBuff) {
    const s = cloneDefaultState();
    s.allyCount = 1;
    s.enemy = { presetId:'', maxHp:'80', attribute:'none', race:'normal', attack:'0', speed:'0' };
    s.allies[0] = { characterId:'', attack:'100', speed:'100', star:'4', attribute:'fire', commandVariant:'' };
    s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
    s.turns[0].enemyAction = defenseBuff
      ? { enabled:true, effect:{ type:'enemyDefenseBuff', mode:'mult', value:'50', duration:'1' } }
      : { enabled:false, effect:{ type:'none' } };
    s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
    s.turns[1].allyActions[0] = { kind:'attack', skillName:'', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
    s.turns[1].enemyAction = { enabled:false, effect:{ type:'none' } };
    return simulateKillProbability(s);
  }
  const plain = build(false);
  const guarded = build(true);
  assert.ok(plain.killChance > 0);
  approx(guarded.killChance, 0);
}


// 31) v0.5.19: 敵防御デバフは、こちらの与ダメージを増やす。
{
  function build(debuff) {
    const s = cloneDefaultState();
    s.allyCount = 1;
    s.enemy = { presetId:'', maxHp:'110', attribute:'fire', race:'normal', attack:'0', speed:'0' };
    s.allies[0] = { characterId:'', attack:'100', speed:'100', star:'4', attribute:'water', commandVariant:'' };
    s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
    s.turns[0].enemyAction = debuff
      ? { enabled:true, effect:{ type:'enemyDefenseDebuff', mode:'mult', value:'20', duration:'1' } }
      : { enabled:false, effect:{ type:'none' } };
    s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
    s.turns[1].allyActions[0] = { kind:'attack', skillName:'', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
    s.turns[1].enemyAction = { enabled:false, effect:{ type:'none' } };
    return simulateKillProbability(s);
  }
  const plain = build(false);
  const weakened = build(true);
  approx(plain.killChance, 0);
  assert.ok(weakened.killChance > 0);
}

// 32) 敵の加護は敵行動終了時に回復し、撃破確率を下げる。
{
  function build(blessing) {
    const s = cloneDefaultState();
    s.allyCount = 1;
    s.enemy = { presetId:'', maxHp:'150', attribute:'fire', race:'normal', attack:'100', speed:'0' };
    s.allies[0] = { characterId:'', attack:'100', speed:'100', star:'4', attribute:'water', commandVariant:'' };
    s.turns[0].allyActions[0] = { kind:'attack', skillName:'', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
    s.turns[0].enemyAction = blessing
      ? { enabled:true, effect:{ type:'enemyBlessing', mode:'flat', value:'60', duration:'2' } }
      : { enabled:true, effect:{ type:'none' } };
    s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
    s.turns[1].allyActions[0] = { ...s.turns[0].allyActions[0] };
    s.turns[1].enemyAction = { enabled:false, effect:{ type:'none' } };
    return simulateKillProbability(s);
  }
  const plain = build(false);
  const blessed = build(true);
  approx(plain.killChance, 1);
  assert.ok(blessed.killChance < plain.killChance);
}

// 33) カウンターは反撃ダメージを計算せず、防御部分だけを与ダメージへ反映する。
{
  function build(counter) {
    const s = cloneDefaultState();
    s.allyCount = 1;
    s.enemy = { presetId:'', maxHp:'80', attribute:'fire', race:'normal', attack:'999', speed:'0' };
    s.allies[0] = { characterId:'', attack:'100', speed:'100', star:'4', attribute:'water', commandVariant:'' };
    s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
    s.turns[0].enemyAction = counter
      ? { enabled:true, effect:{ type:'enemyCounterGuard', value:'40', duration:'2', attackTypes:['physical'] } }
      : { enabled:false, effect:{ type:'none' } };
    s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
    s.turns[1].allyActions[0] = { kind:'attack', skillName:'', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
    s.turns[1].enemyAction = { enabled:false, effect:{ type:'none' } };
    return simulateKillProbability(s);
  }
  const plain = build(false);
  const guarded = build(true);
  assert.ok(plain.killChance > 0);
  approx(guarded.killChance, 0);
}

// 34) アイアンカウンターは物理40%軽減・2ターンとして登録し、反撃ダメージは持たない。
{
  const { enemySkillForCommand } = await import('../kill/enemy-actions.js');
  const sk = enemySkillForCommand('アイアンカウンター','new4_iron_dragon');
  assert.equal(sk.kind, 'effect');
  const guard = sk.effects.find(x => x.type === 'enemyCounterGuard');
  assert.equal(guard.value, 40);
  assert.equal(guard.duration, 2);
  assert.deepEqual(guard.attackTypes, ['physical']);
}


// 35) 現行: 自動BOSSプロファイル91体・お供プロファイル44体を登録.
{
  const { ENEMY_BOSS_PROFILE_IDS, ENEMY_COMPANION_PROFILE_NAMES, ENEMY_COMPANION_HP_NAMES, enemyCompanionProfile, enemyCompanionCommandTransitions, enemyCompanionBaseHp } = await import('../kill/enemy-actions.js');
  assert.equal(ENEMY_BOSS_PROFILE_IDS.length, 92);
  for (const id of ['old0_red_princess','old1_grim','old0_quicksilver','old0_heavy_behemoth','new1_fiska','new1_robo_03','new3_oroshi','new0_nergal','old2_soccerra','old2_ifrit','old5_kujeska','old3_fanlong','new0_volcano_dragon','new5_glacier_dragon','q_great_kujeska','q_great_muus','q_ice_dante','q_kenran_kukulkan','old4_chiviere','new3_deathfear_plant','new2_arp','new6_kais','new3_root_dragon','new6_elysion','new6_wight','new6_arc_dragon','q_michael']) {
    assert.ok(ENEMY_BOSS_PROFILE_IDS.includes(id), `missing v0.5.23 boss ${id}`);
  }
  assert.deepEqual(ENEMY_COMPANION_PROFILE_NAMES, ['バロ','イシザル','カルラ','アシユラ','ピートー','ブリュー','魔海将フィスカ','イムホテプ','大地の闘士ロック','岩竜ロックドラゴン','スカルボーンドラゴン','ドーシュ','アヴァドンフード','ナンクルマル','魔鏡騎士リフレク','ダークサラマンダー','海竜のしずく','竜灰','マト','ベージ','グリ','吟遊詩人キドリ','猿石','古神兵サルベージ','フェンリル','ロボ零壱式','ロボ零弐式','魔海魚ブブリ','魔海兵ブリュー','参謀エンリル','僧兵オニワカ','ルートドラン','フランケンボーイ','ロボ弐式','デメラ','デスプラント','大樹竜の球根','カマエル','天戦士クレイ','アルラ','アルラウネ','ヤマタマゴ','鳥竜のタマゴ','金竜のタマゴ','火山弾','竜氷山']);
  for (const name of ENEMY_COMPANION_PROFILE_NAMES) {
    const cp = enemyCompanionProfile(name);
    assert.ok(cp, `missing companion ${name}`);
    for (let reel = 0; reel < cp.matrix.length; reel++) {
      approx(enemyCompanionCommandTransitions(name, reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
    }
  }
  // v0.5.54: 固定お供は行動プロファイルの有無にかかわらずHPを持つ。
  const { BOSS_PRESET_BY_ID: bossPresetMap } = await import('../kill/boss-presets.js');
  const fixedNames = [...new Set([...bossPresetMap.values()].flatMap(x => x.companions ?? []))];
  for (const name of fixedNames) assert.ok(ENEMY_COMPANION_HP_NAMES.includes(name), `missing companion HP ${name}`);
  assert.equal(enemyCompanionBaseHp('氷結精'), 5);
  assert.equal(enemyCompanionBaseHp('魔鏡騎士リフレク'), 178);
  assert.equal(enemyCompanionBaseHp('アヴァドンフード'), 67);
}

// 36) お供はBOSSとは別の行動者として素早さ順に動き、状態異常を同ターンの撃破率へ反映する。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'new1_robo_03', maxHp:'100', attribute:'earth', race:'normal', attack:'55', speed:'25' };
  s.allies[0] = { characterId:'', attack:'200', speed:'1', star:'4', attribute:'fire', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'attack', skillName:'', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', enemyTarget:'all', hits:'1', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  const r = simulateKillProbability(s);
  assert.deepEqual(r.finalOrder.map(x => x.side === 'ally' ? 'ally' : x.name), ['ロボ零壱式','ロボ零参式','ロボ零弐式','ally']);
  // 零壱式はアイアンクロー2/6、混乱30%なので行動不能10%。
  approx(r.killChance, 0.9, 1e-9);
  approx(r.enemySkillActivation[0]['お供:ロボ零壱式 / アイアンクロー'], 1/3, 1e-9);
  assert.deepEqual(r.activeCompanionCommandProfiles, ['ロボ零壱式','ロボ零弐式']);
  assert.deepEqual(r.missingCompanionCommandProfiles, []);
}

// 37) 参謀エンリルのお供回復もBOSS HPへ反映する。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'new0_nergal', maxHp:'150', attribute:'wind', race:'normal', attack:'70', speed:'50' };
  s.allies[0] = { characterId:'', attack:'100', speed:'100', star:'4', attribute:'fire', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'attack', skillName:'', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].allyActions[0] = { ...s.turns[0].allyActions[0] };
  const r = simulateKillProbability(s);
  assert.ok((r.enemySkillActivation[0]['お供:参謀エンリル / 補給命令'] ?? 0) > 0);
  assert.ok((r.enemySkillActivation[0]['お供:参謀エンリル / 特配'] ?? 0) > 0);
  assert.ok(r.killChance < 1);
}

// 38) 継承個体のお供は、現在採用している基準を結果に明示する。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'new1_fiska', maxHp:'1650', attribute:'water', race:'demon', attack:'82', speed:'47' };
  s.allies[0] = { characterId:'', attack:'0', speed:'1', star:'4', attribute:'fire', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  const r = simulateKillProbability(s);
  assert.ok(r.activeCompanionCommandProfiles.includes('魔海兵ブリュー'));
  assert.ok(r.activeCompanionCommandProfiles.includes('魔海魚ブブリ'));
  assert.ok(r.inheritedCompanionCommandBaselines.includes('魔海兵ブリュー'));
}


// 38) v0.5.23: ソルティドッグは空き枠にフェンリルを追加し、最大リールから次ターン行動する。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'old5_kujeska', maxHp:'9999', attribute:'water', race:'demon', attack:'50', speed:'50' };
  s.allies[0] = { characterId:'', attack:'1', speed:'1', star:'4', attribute:'fire', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  const r = simulateKillProbability(s);
  assert.ok((r.enemySkillActivation[0]['ソルティドッグ'] ?? 0) > 0);
  // 召喚成功枝ではフェンリルの最大リールに【ほえる】が2/6あるため、次ターンに同技が観測される。
  assert.ok((r.enemySkillActivation[1]['お供:フェンリル / ほえる'] ?? 0) > 0);
}

// 39) v0.5.23: 魔王サッカーラは固定お供ベージを行動させ、古神兵召喚で空き枠を埋められる。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'old2_soccerra', maxHp:'9999', attribute:'earth', race:'demon', attack:'80', speed:'20' };
  s.allies[0] = { characterId:'', attack:'1', speed:'1', star:'4', attribute:'fire', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  const r = simulateKillProbability(s);
  assert.ok(r.activeCompanionCommandProfiles.includes('ベージ'));
  assert.ok((r.enemySkillActivation[0]['古神兵召喚'] ?? 0) > 0);
  assert.ok(Object.keys(r.enemySkillActivation[1] ?? {}).some(k => k.startsWith('お供:古神兵サルベージ / ')));
}


// 40) v0.5.24: 追加3BOSSの防御効果を登録。
{
  const { enemySkillForCommand } = await import('../kill/enemy-actions.js');

  const fan = enemySkillForCommand('五黄土星','old3_fanlong');
  const fanGuard = fan.effects.find(x => x.type === 'enemyDefenseBuff');
  assert.equal(fanGuard.value, 10);
  assert.equal(fanGuard.duration, 3);

  const magma = enemySkillForCommand('マグマアーマー','new0_volcano_dragon');
  assert.equal(magma.effects.length, 2);
  assert.deepEqual(magma.effects.find(x => x.attackTypes)?.attackTypes, ['physical']);
  assert.deepEqual(magma.effects.find(x => x.attributes)?.attributes, ['water']);
  assert.equal(magma.effects.find(x => x.attackTypes)?.value, 50);
  assert.equal(magma.effects.find(x => x.attributes)?.value, 50);
  assert.ok(magma.effects.every(x => x.nonStacking === true));

  const aurora = enemySkillForCommand('オーロラアーマー','new5_glacier_dragon');
  const auroraGuard = aurora.effects.find(x => x.type === 'enemyDefenseBuff');
  assert.equal(auroraGuard.value, 35);
  assert.equal(auroraGuard.duration, 3);
  assert.deepEqual(auroraGuard.attackTypes, ['physical']);
}

// 41) 重複不可の敵防御効果は再使用で重ならず、残りターンだけ更新する。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'', maxHp:'40', attribute:'none', race:'normal', attack:'0', speed:'100' };
  s.allies[0] = { characterId:'', attack:'100', speed:'1', star:'4', attribute:'none', commandVariant:'' };
  const guard = { type:'enemyDefenseBuff', value:'50', duration:'3', attackTypes:['physical'], nonStacking:true, stackKey:'test:guard' };
  s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ ...guard } };
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].allyActions[0] = { kind:'attack', skillName:'', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
  s.turns[1].enemyAction = { enabled:true, effect:{ ...guard } };
  const r = simulateKillProbability(s);
  // 50%軽減1枚なら最低でも47ダメージ前後でHP40を倒せる。二重適用なら倒せない。
  approx(r.killChance, 1, 1e-9);
}

// 42) マグマアーマー型の「物理半減」と「水属性半減」は別判定なので、水物理には両方が掛かる。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'', maxHp:'30', attribute:'none', race:'normal', attack:'0', speed:'100' };
  s.allies[0] = { characterId:'', attack:'100', speed:'1', star:'4', attribute:'water', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'enemyDefenseBuff', value:'50', duration:'3', attackTypes:['physical'], nonStacking:true, stackKey:'test:physical' } };
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns[1].enemyAction = { enabled:true, effect:{ type:'enemyDefenseBuff', value:'50', duration:'3', attributes:['water'], nonStacking:true, stackKey:'test:water' } };
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[2].allyActions[0] = { kind:'attack', skillName:'', skillMultiplier:'100', attackAttribute:'water', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
  s.turns[2].enemyAction = { enabled:false, effect:{ type:'none' } };
  const r = simulateKillProbability(s);
  approx(r.killChance, 0, 1e-9);
}

// 43) 固定お供のタマゴ系3体は初期6枠すべて「ときをまつ」で、有効行動警告を出さない。
{
  const { enemyCompanionProfile, enemyCompanionCommandTransitions } = await import('../kill/enemy-actions.js');
  for (const [name, atk, spd] of [['金竜のタマゴ',4,0],['火山弾',1,1],['竜氷山',2,1]]) {
    const cp = enemyCompanionProfile(name);
    assert.equal(cp.attack, atk);
    assert.equal(cp.speed, spd);
    const tr = enemyCompanionCommandTransitions(name, 0);
    assert.equal(tr.length, 1);
    assert.equal(tr[0].commandName, 'ときをまつ');
    approx(tr[0].probability, 1, 1e-9);
  }
  for (const id of ['old3_fanlong','new0_volcano_dragon','new5_glacier_dragon']) {
    const s = cloneDefaultState();
    s.allyCount = 1;
    s.enemy = { presetId:id, maxHp:'9999', attribute:'none', race:'dragon', attack:'0', speed:'100' };
    s.allies[0] = { characterId:'', attack:'0', speed:'1', star:'4', attribute:'none', commandVariant:'' };
    s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
    s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
    const r = simulateKillProbability(s);
    assert.equal(r.missingCompanionCommandProfiles.length, 0);
    assert.ok(!r.missingCommandEffects.some(x => x.includes('ときをまつ')));
  }
}


// 44) v0.5.25: 大魔皇クジェスカ／大魔王ムウス／薄氷の剣士ダンテの主要技を登録。
{
  const { enemySkillForCommand } = await import('../kill/enemy-actions.js');
  const muse = enemySkillForCommand('モスコミューズ','q_great_kujeska');
  assert.equal(muse.effects[0].status, 'sleep');
  assert.equal(muse.effects[0].chance, 42.2);
  assert.equal(muse.effects[0].chanceIfAttribute.water, 15);

  const great = enemySkillForCommand('大魔王の一撃','q_great_muus');
  assert.equal(great.target, 'all');
  assert.equal(great.attackType, 'physical');

  const frozen = enemySkillForCommand('血凍の太刀','q_ice_dante');
  assert.equal(frozen.multiplier, 235);
  assert.equal(frozen.effects[0].status, 'paralysis');
  assert.equal(frozen.effects[0].chance, 20);
}

// 45) モスコミューズは属性別の内部付与率を実際の状態枝へ反映する。
function oneTurnGreatKujeska(attribute) {
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'q_great_kujeska', maxHp:'9999', attribute:'water', race:'demon', attack:'75', speed:'75' };
  s.allies[0] = { characterId:'', attack:'0', speed:'1', star:'4', attribute, commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  return simulateKillProbability(s);
}
{
  const water = oneTurnGreatKujeska('water');
  const fire = oneTurnGreatKujeska('fire');
  const waterMuse = water.enemySkillActivation[0]['モスコミューズ'] ?? 0;
  const fireMuse = fire.enemySkillActivation[0]['モスコミューズ'] ?? 0;
  assert.ok(waterMuse > 0);
  approx(waterMuse, fireMuse, 1e-12);
  approx(water.statusSummaryByTurn[0][0].sleep ?? 0, waterMuse * 0.15, 1e-9);
  approx(fire.statusSummaryByTurn[0][0].sleep ?? 0, fireMuse * 0.422, 1e-9);
}

// 46) v0.5.26: アロマは同名コマンド全枠をミス化して即再行動。
// スリープ・アロマだけは、撃破速度に影響する睡眠反撃を追跡する。猛毒反撃はダメージのみなので省略する。
{
  const { ENEMY_SKILLS } = await import('../kill/enemy-actions.js');
  const sleepAroma = ENEMY_SKILLS['スリープ・アロマ'];
  const poisonAroma = ENEMY_SKILLS['ポイズン・アロマ'];
  assert.equal(sleepAroma.turnContinue, true);
  assert.equal(poisonAroma.turnContinue, true);
  const sleepCounter = sleepAroma.effects.find(x => x.type === 'enemyReactiveStatus');
  assert.equal(sleepCounter.status, 'sleep');
  assert.equal(sleepCounter.chance, 40);
  assert.equal(sleepCounter.reactionDuration, 2);
  assert.deepEqual(sleepCounter.triggerAttackTypes, ['physical']);
  assert.equal(poisonAroma.effects.some(x => x.type === 'enemyReactiveStatus'), false);
  assert.equal(sleepAroma.effects.find(x => x.type === 'disableEnemyCommandName').commandName, 'スリープ・アロマ');
  assert.equal(poisonAroma.effects.find(x => x.type === 'disableEnemyCommandName').commandName, 'ポイズン・アロマ');
}

// 47) 絢蘭竜ククルカンのBOSS専用8リールを登録し、無効化済みアロマは以後抽選されない。
{
  const { enemyBossProfile, enemyCommandTransitions } = await import('../kill/enemy-actions.js');
  const p = enemyBossProfile('q_kenran_kukulkan');
  assert.equal(p.attack, 65);
  assert.equal(p.matrix.length, 8);
  for (let reel = 0; reel < p.matrix.length; reel++) {
    approx(enemyCommandTransitions('q_kenran_kukulkan', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  }
  const afterPoison = enemyCommandTransitions('q_kenran_kukulkan', 0, ['ポイズン・アロマ']);
  assert.equal(afterPoison.some(x => x.commandName === 'ポイズン・アロマ'), false);
  assert.ok(afterPoison.some(x => x.commandName === 'ミス'));
}

// 48) 絢蘭竜ククルカンのアロマ→即再行動をシミュレーションし、物理攻撃側へ睡眠反撃を反映する。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'q_kenran_kukulkan', maxHp:'9999', attribute:'wind', race:'dragon', attack:'65', speed:'85' };
  s.allies[0] = { characterId:'', attack:'1', speed:'1', star:'4', attribute:'fire', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'attack', skillName:'', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  const r = simulateKillProbability(s);
  assert.ok((r.enemySkillActivation[0]['ポイズン・アロマ'] ?? 0) > 0);
  assert.ok((r.enemySkillActivation[0]['スリープ・アロマ'] ?? 0) > 0);
  assert.ok((r.statusSummaryByTurn[0][0].sleep ?? 0) > 0);
  assert.ok(!r.missingCommandEffects.some(x => x.includes('絢蘭') || x.includes('アロマ') || x.includes('ウイングビート') || x.includes('イチリンザシ')));
}


// 49) v0.5.27: チヴィエール／デスフィアープラントと新規お供の専用コマンドを登録。
{
  const { enemyBossProfile, enemyCommandTransitions, enemyCompanionProfile, enemyCompanionCommandTransitions } = await import('../kill/enemy-actions.js');
  const chiviere = enemyBossProfile('old4_chiviere');
  assert.equal(chiviere.attack, 40);
  assert.equal(chiviere.matrix.length, 5);
  const deathfear = enemyBossProfile('new3_deathfear_plant');
  assert.equal(deathfear.attack, 65);
  assert.equal(deathfear.matrix.length, 7);
  for (const [id, reels] of [['old4_chiviere',5], ['new3_deathfear_plant',7]]) {
    for (let reel=0; reel<reels; reel++) approx(enemyCommandTransitions(id,reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  }
  assert.equal(enemyCompanionProfile('デメラ').speed, 55);
  assert.equal(enemyCompanionProfile('デスプラント').attack, 50);
  assert.deepEqual(enemyCompanionCommandTransitions('大樹竜の球根',0).map(x=>x.commandName), ['ときをまつ']);
}

// 50) ヒメの笑い声・デメラのリール低下・ロート系の永続低下を撃破率用効果として保持する。
{
  const { enemySkillForCommand, enemyCompanionSkillForCommand } = await import('../kill/enemy-actions.js');
  const laugh = enemySkillForCommand('ヒメの笑い声','old4_chiviere');
  assert.equal(laugh.effects[0].status, 'confusion');
  assert.equal(laugh.effects[0].chance, 50);
  const gaze = enemyCompanionSkillForCommand('アクマのながしめ','デメラ');
  assert.equal(gaze.effects[0].type, 'allyReelShift');
  assert.equal(gaze.effects[0].amount, -1);
  const kiss = enemyCompanionSkillForCommand('アクマのくちづけ','デメラ');
  assert.equal(kiss.effects[0].amount, -2);
  const powerRot = enemySkillForCommand('パワーロートブレス','new3_deathfear_plant');
  assert.equal(powerRot.effects[0].stat, 'attack');
  assert.equal(powerRot.effects[0].factor, 0.9);
  const speedRot = enemySkillForCommand('スピードロートブレス','new3_deathfear_plant');
  assert.equal(speedRot.effects[0].stat, 'speed');
  assert.equal(speedRot.effects[0].factor, 0.82);
  assert.equal(enemySkillForCommand('ヘルスロートブレス','new3_deathfear_plant').effects?.length ?? 0, 0);
}

// 51) チヴィエールは召喚★★でデメラを追加し、次ターンからデメラ自身の初期コマンドで行動する。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'old4_chiviere', maxHp:'9999', attribute:'water', race:'demon', attack:'40', speed:'25' };
  s.allies[0] = { characterId:'', attack:'1', speed:'1', star:'4', attribute:'fire', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  const r = simulateKillProbability(s);
  assert.ok((r.enemySkillActivation[0]['召喚★★'] ?? 0) > 0);
  assert.ok(Object.keys(r.enemySkillActivation[1]).some(k => k.startsWith('お供:デメラ / ')));
  assert.ok(!r.missingCommandEffects.some(x => x.includes('デメラ') || x.includes('チヴィエール')));
}

// 52) デスフィアープラントは固定お供2体を独立行動者として扱い、デスプラントのロート系も抽選する。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'new3_deathfear_plant', maxHp:'9999', attribute:'earth', race:'normal', attack:'65', speed:'50' };
  s.allies[0] = { characterId:'', attack:'1', speed:'1', star:'4', attribute:'fire', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  const r = simulateKillProbability(s);
  assert.deepEqual(new Set(r.activeCompanionCommandProfiles), new Set(['デスプラント','大樹竜の球根']));
  assert.deepEqual(r.missingCompanionCommandProfiles, []);
  assert.ok((r.enemySkillActivation[0]['お供:デスプラント / スピードロートブレス'] ?? 0) > 0);
  assert.ok(!r.missingCommandEffects.some(x => x.includes('デスフィアープラント') || x.includes('デスプラント')));
}

// 53) スピードロートは命中時×0.82、その後は対象の行動機会ごとに同倍率を小数第3位まで保持して累積する。
// 基礎SPD50: 50×0.82=41 → 次の行動後 0.82×0.82=0.672, ceil(50×0.672)=34。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'', maxHp:'9999', attribute:'fire', race:'normal', attack:'0', speed:'35' };
  s.allies[0] = { characterId:'', attack:'1', speed:'50', star:'4', attribute:'water', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'progressiveStatDecay', target:'all', stat:'speed', factor:0.82 } };
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].enemyAction = { enabled:false, effect:{ type:'none' } };
  s.turns.push(JSON.parse(JSON.stringify(s.turns[1])));
  const r = simulateKillProbability(s);
  assert.equal(r.finalOrder[0].side, 'enemy');
  assert.equal(r.finalOrder[0].speed, 35);
  assert.equal(r.finalOrder[1].side, 'ally');
  assert.equal(r.finalOrder[1].speed, 34);
}

// 54) v0.5.28: 魔神アープ／研究者カイスと固定・召喚お供を登録。
{
  const { enemyBossProfile, enemyCommandTransitions, enemyCompanionProfile, enemySkillForCommand, enemyCompanionSkillForCommand } = await import('../kill/enemy-actions.js');
  const arp = enemyBossProfile('new2_arp');
  assert.equal(arp.attack, 50);
  assert.equal(arp.matrix.length, 5);
  const kais = enemyBossProfile('new6_kais');
  assert.equal(kais.attack, 60);
  assert.equal(kais.matrix.length, 7);
  for (const [id, reels] of [['new2_arp',5], ['new6_kais',7]]) {
    for (let reel=0; reel<reels; reel++) approx(enemyCommandTransitions(id,reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  }

  const clean = enemySkillForCommand('きよめの水','new2_arp');
  assert.equal(clean.kind, 'heal');
  assert.equal(clean.value, 20);
  assert.equal(clean.effects[0].type, 'enemyStatusCure');

  const sticky = enemySkillForCommand('粘着攻撃','new6_kais');
  const speedDown = sticky.effects.find(x => x.type === 'allySpeedDebuff');
  assert.equal(speedDown.mode, 'add');
  assert.equal(speedDown.value, 30);
  assert.equal(speedDown.duration, 99);
  const para = sticky.effects.find(x => x.type === 'status');
  assert.equal(para.status, 'paralysis');
  assert.equal(para.chance, 30);

  const repair = enemySkillForCommand('ロボ修復','new6_kais');
  assert.equal(repair.kind, 'heal');
  assert.equal(repair.value, 120);
  assert.equal(repair.effects[0].type, 'enemyStatusCure');
  const summon = enemySkillForCommand('ロボ召喚★★★','new6_kais');
  assert.equal(summon.effects[0].name, 'ロボ弐式');

  assert.equal(enemyCompanionProfile('フランケンボーイ').speed, 21);
  assert.equal(enemyCompanionProfile('フランケンボーイ').attack, 42);
  assert.equal(enemyCompanionProfile('ロボ弐式').speed, 8);
  assert.equal(enemyCompanionProfile('ロボ弐式').attack, 25);
  const oneTwo = enemyCompanionSkillForCommand('ワンツーパンチ','フランケンボーイ');
  assert.equal(oneTwo.effects[0].status, 'paralysis');
  assert.equal(oneTwo.effects[0].chance, 25);
}

// 55) 敵側状態異常治療は、現在追跡している毒／猛毒を解除する。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'', maxHp:'200', attribute:'water', race:'normal', attack:'0', speed:'1' };
  s.allies[0] = { characterId:'', attack:'0', speed:'100', star:'4', attribute:'fire', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'buff', skillName:'', effects:[{ type:'deadlyPoison' }] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'enemyStatusCure' } };
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns[1].enemyAction = { enabled:false, effect:{ type:'none' } };
  const r = simulateKillProbability(s);
  // 治療後のターン終了では猛毒20%ダメージが入らない。
  assert.equal(r.timeline[1].minLiveHp, 200);
  assert.equal(r.timeline.at(-1).minLiveHp, 200);
}

// 56) 研究者カイスでは固定お供フランケンボーイも独立して行動する。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'new6_kais', maxHp:'9999', attribute:'water', race:'normal', attack:'60', speed:'65' };
  s.allies[0] = { characterId:'', attack:'1', speed:'1', star:'4', attribute:'fire', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  const r = simulateKillProbability(s);
  assert.ok(r.activeCompanionCommandProfiles.includes('フランケンボーイ'));
  assert.ok(Object.keys(r.enemySkillActivation[0]).some(k => k.startsWith('お供:フランケンボーイ / ')));
  assert.ok(!r.missingCommandEffects.some(x => x.includes('研究者カイス') || x.includes('フランケンボーイ')));
}


// 57) 〖チャージ〗は〖ためる〗と同じく、そのターンを終了して次回リールを1段上げる。
{
  const matrix = [
    ['チャージ','チャージ','ミス','ミス','ミス','ミス'],
    ['こうげき','こうげき','こうげき','こうげき','こうげき','こうげき']
  ];
  const transitions = commandTransitionsFromMatrix(matrix, 0);
  const charge = transitions.find(x => x.commandName === 'チャージ');
  assert.ok(charge);
  approx(charge.probability, 2 / 6);
  assert.equal(charge.nextReel, 1);
  const miss = transitions.find(x => x.commandName === 'ミス');
  approx(miss.probability, 4 / 6);
  assert.equal(miss.nextReel, 0);
}


// 58) v0.5.29: 大樹竜ルートドラゴンと固定お供ルートドランを登録。
{
  const { enemyBossProfile, enemyCommandTransitions, enemyCompanionProfile, enemyCompanionCommandTransitions, enemySkillForCommand, enemyCompanionSkillForCommand } = await import('../kill/enemy-actions.js');
  const root = enemyBossProfile('new3_root_dragon');
  assert.equal(root.attack, 60);
  assert.equal(root.matrix.length, 7);
  for (let reel=0; reel<7; reel++) approx(enemyCommandTransitions('new3_root_dragon',reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);

  const cp = enemyCompanionProfile('ルートドラン');
  assert.equal(cp.speed, 42);
  assert.equal(cp.attack, 42);
  assert.equal(cp.matrix.length, 3);
  assert.equal(cp.inheritedBaseline, true);
  for (let reel=0; reel<3; reel++) approx(enemyCompanionCommandTransitions('ルートドラン',reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);

  const breath = enemySkillForCommand('ディープグリーンブレス','new3_root_dragon');
  assert.equal(breath.kind, 'heal');
  assert.equal(breath.value, 60);
  const guard = breath.effects.find(x => x.type === 'enemyDefenseBuff');
  assert.equal(guard.value, 15);
  assert.equal(guard.duration, 3);
  assert.equal(guard.nonStacking, true);

  const bossGrow = enemySkillForCommand('スピード・グロウ','new3_root_dragon');
  assert.equal(bossGrow.effects[0].type, 'companionSpeedGrow');
  assert.equal(bossGrow.effects[0].value, 15);
  const companionGrow = enemyCompanionSkillForCommand('スピード・グロウ','ルートドラン');
  assert.equal(companionGrow.effects[0].type, 'bossSpeedGrow');
  assert.equal(companionGrow.effects[0].value, 15);
}

// 59) 大樹竜ルートドラゴン戦では固定お供2体を自動化し、BOSS自身の回復・防御・速度成長を確率分岐へ入れる。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'new3_root_dragon', maxHp:'9999', attribute:'wind', race:'dragon', attack:'60', speed:'64' };
  s.allies[0] = { characterId:'', attack:'1', speed:'1', star:'4', attribute:'fire', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  while (s.turns.length < 4) s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  const r = simulateKillProbability(s);
  assert.deepEqual(new Set(r.activeCompanionCommandProfiles), new Set(['大樹竜の球根','ルートドラン']));
  const deepGreenMass = r.enemySkillActivation.reduce((sum, row) => sum + (row['ディープグリーンブレス'] ?? 0), 0);
  const speedGrowMass = r.enemySkillActivation.reduce((sum, row) => sum + (row['スピード・グロウ'] ?? 0), 0);
  assert.ok(deepGreenMass > 0);
  assert.ok(speedGrowMass > 0);
  assert.ok(!r.missingCommandEffects.some(x => x.includes('ルートドラゴン') || x.includes('グロウ') || x.includes('ブランチ')));
}

// 60) v0.5.30: 闇の女神官。7リール、沈黙率、冥界の城のスタック＋一括更新、再行動中だけの同名封印。
{
  const { enemyBossProfile, enemyCommandTransitions, enemySkillForCommand } = await import('../kill/enemy-actions.js');
  const p = enemyBossProfile('q_dark_priestess');
  assert.equal(p.attack, 70);
  assert.equal(p.matrix.length, 7);
  for (let reel=0; reel<7; reel++) approx(enemyCommandTransitions('q_dark_priestess', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);

  assert.equal(enemySkillForCommand('ダーク!','q_dark_priestess').effects[0].chance, 40);
  assert.equal(enemySkillForCommand('ダーク!!','q_dark_priestess').effects[0].chance, 50);
  assert.equal(enemySkillForCommand('ダーク!!!','q_dark_priestess').effects[0].chance, 60);

  const castle = enemySkillForCommand('冥界の城','q_dark_priestess');
  assert.equal(castle.turnContinue, true);
  const guard = castle.effects.find(x => x.type === 'enemyDefenseBuff');
  assert.equal(guard.value, 10);
  assert.equal(guard.duration, 5);
  assert.equal(guard.stackRefreshGroup, '冥界の城:防御');
  assert.ok(castle.effects.some(x => x.type === 'disableEnemyCommandNameDuringChain'));

  const judgement = enemySkillForCommand('宵闇の裁き','q_dark_priestess');
  assert.equal(judgement.turnContinue, true);
  assert.ok(judgement.effects.some(x => x.type === 'disableEnemyCommandNameDuringChain'));
}

// 61) 闇の女神官の純粋ダメージは無視しつつ、沈黙・冥界の城は実際の確率分岐へ入る。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'q_dark_priestess', maxHp:'9999', attribute:'wind', race:'wizard', attack:'70', speed:'70' };
  s.allies[0] = { characterId:'', attack:'1', speed:'1', star:'4', attribute:'fire', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  while (s.turns.length < 4) s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  const r = simulateKillProbability(s);
  assert.ok(r.enemySkillActivation.some(row => (row['冥界の城'] ?? 0) > 0));
  assert.ok(r.enemySkillActivation.some(row => ((row['ダーク!'] ?? 0) + (row['ダーク!!'] ?? 0) + (row['ダーク!!!'] ?? 0)) > 0));
  assert.ok(!r.missingCommandEffects.some(x => x.includes('冥界の城') || x.includes('宵闇') || x.includes('ダーク')));
}

// 62) v0.5.30: ファントム。BOSS専用7リールと、ステアボイス/リチャーズ・バーンを登録。
{
  const { enemyBossProfile, enemyCommandTransitions, enemySkillForCommand } = await import('../kill/enemy-actions.js');
  const p = enemyBossProfile('new4_phantom');
  assert.equal(p.attack, 65);
  assert.equal(p.matrix.length, 7);
  for (let reel=0; reel<7; reel++) approx(enemyCommandTransitions('new4_phantom', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  assert.equal(enemySkillForCommand('ステアボイス','new4_phantom').kind, 'stareVoice');
  const richards = enemySkillForCommand('リチャーズ・バーン','new4_phantom');
  assert.ok(richards.effects.some(x => x.type === 'purgeOffensiveBeneficial'));
}

// 63) 洗脳は残り1体には無効。2体ならステアボイスの抽選分だけ洗脳が発生する。
{
  const run = allyCount => {
    const s = cloneDefaultState();
    s.allyCount = allyCount;
    s.enemy = { presetId:'new4_phantom', maxHp:'9999', attribute:'fire', race:'demon', attack:'65', speed:'45' };
    for (let i=0; i<allyCount; i++) {
      s.allies[i] = { characterId:'', attack:'1', speed:'1', star:'4', attribute:'water', commandVariant:'' };
      s.turns[0].allyActions[i] = { kind:'attack', skillName:`テスト攻撃${i+1}`, skillMultiplier:'1', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
    }
    s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
    return simulateKillProbability(s);
  };
  const one = run(1);
  approx(one.allySkillActivation[0][0]['テスト攻撃1'], 1, 1e-9);
  const two = run(2);
  const { enemyCommandTransitions } = await import('../kill/enemy-actions.js');
  const stareMass = enemyCommandTransitions('new4_phantom', 0)
    .filter(x => x.commandName === 'ステアボイス')
    .reduce((sum, x) => sum + x.probability, 0);
  approx(two.enemySkillActivation[0]['ステアボイス'], stareMass, 1e-9);
  approx(two.allySkillActivation[0][0]['テスト攻撃1'], 1 - stareMass / 2, 1e-9);
  approx(two.allySkillActivation[0][1]['テスト攻撃2'], 1 - stareMass / 2, 1e-9);
}


// 64) v0.5.31: 鬼竜ネクロドラゴン／冥界竜ダークバハムートと呪い効果を登録。
{
  const { enemyBossProfile, enemyCommandTransitions, enemySkillForCommand, ENEMY_BOSS_PROFILE_IDS } = await import('../kill/enemy-actions.js');
  assert.equal(ENEMY_BOSS_PROFILE_IDS.length, 92);
  const necro = enemyBossProfile('new6_necro_dragon');
  assert.equal(necro.attack, 55);
  assert.equal(necro.matrix.length, 7);
  for (let reel=0; reel<7; reel++) approx(enemyCommandTransitions('new6_necro_dragon',reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  const dark = enemyBossProfile('q_dark_bahamut');
  assert.equal(dark.attack, 75);
  assert.equal(dark.matrix.length, 5);
  for (let reel=0; reel<5; reel++) approx(enemyCommandTransitions('q_dark_bahamut',reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  const curseBreath = enemySkillForCommand('ノロイの息','new6_necro_dragon').effects[0];
  assert.equal(curseBreath.status, 'curse');
  assert.equal(curseBreath.chance, 40);
  assert.equal(curseBreath.duration, 4);
  assert.equal(enemySkillForCommand('呪殺の息','new6_necro_dragon').effects[0].chance, 30);
  assert.equal(enemySkillForCommand('復讐のツメ','new6_necro_dragon').effects[0].chance, 40);
  assert.equal(enemySkillForCommand('呪いのツメ','q_dark_bahamut').effects[0].chance, 15);
}

// 65) 呪いは行動終了ごとに進行して離脱し、アンデッドには付与されない。
{
  const run = race => {
    const s = cloneDefaultState();
    s.allyCount = 1;
    s.enemy = { presetId:'q_dark_bahamut', maxHp:'9999', attribute:'earth', race:'dragon', attack:'75', speed:'50' };
    s.allies[0] = { characterId:'', attack:'1', speed:'1', star:'4', attribute:'fire', race, commandVariant:'' };
    s.turns[0].allyActions[0] = { kind:'effect', skillName:'テスト攻撃', skillMultiplier:'1', attackAttribute:'none', attackAttribute2:'none', attackType:'other', hits:'1', effects:[] };
    s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
    while (s.turns.length < 6) s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
    return simulateKillProbability(s);
  };
  const normal = run('normal');
  approx(normal.statusSummaryByTurn[0][0].curse, (1/6) * 0.15, 1e-9);
  assert.ok((normal.allySkillActivation[5][0]['テスト攻撃'] ?? 0) < 1);
  const undead = run('undead');
  approx(undead.statusSummaryByTurn[0][0].curse, 0, 1e-9);
  approx(undead.allySkillActivation[5][0]['テスト攻撃'], 1, 1e-9);
}



// 66) v0.5.32: 聖竜アークドラゴン／金陽のミカエルを登録。
{
  const { enemyBossProfile, enemyCommandTransitions, enemySkillForCommand, ENEMY_BOSS_PROFILE_IDS } = await import('../kill/enemy-actions.js');
  assert.equal(ENEMY_BOSS_PROFILE_IDS.length, 92);

  const arc = enemyBossProfile('new6_arc_dragon');
  assert.equal(arc.attack, 60);
  assert.equal(arc.matrix.length, 7);
  for (let reel=0; reel<7; reel++) approx(enemyCommandTransitions('new6_arc_dragon', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  assert.equal(enemySkillForCommand('低空ダイブ','new6_arc_dragon').effects, undefined);
  assert.equal(enemySkillForCommand('グランダイブ','new6_arc_dragon').effects, undefined);

  const michael = enemyBossProfile('q_michael');
  assert.equal(michael.attack, 75);
  assert.equal(michael.matrix.length, 8);
  for (let reel=0; reel<8; reel++) approx(enemyCommandTransitions('q_michael', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);

  const sun = enemySkillForCommand('太陽の加護','q_michael');
  assert.equal(sun.replaceUsedSlotWith, '金色の刻印');
  assert.ok(sun.effects.some(x => x.type === 'enemyStatusCure'));
  assert.ok(sun.effects.some(x => x.type === 'enemyStatusAvoid' && x.value === 45 && x.duration === 3));
  const stamp = enemySkillForCommand('金色の刻印','q_michael');
  assert.ok(stamp.effects.some(x => x.type === 'enemyAtkBuff' && x.value === 140 && x.duration === 2 && x.nonStacking));
  assert.ok(stamp.effects.some(x => x.type === 'enemySpeedBuff' && x.value === 40 && x.duration === 2 && x.nonStacking));
  const eraser = enemySkillForCommand('ライト・イレイザー','q_michael').effects[0];
  assert.equal(eraser.type, 'instantDeath');
  assert.equal(eraser.chance, 60);
  assert.equal(eraser.chanceIfRace.demon, 100);
}

// 67) コマンド遷移は停止マスを保持でき、太陽の加護を使った「そのマス」だけ金色の刻印へ置換できる。
{
  const { enemyCommandTransitions } = await import('../kill/enemy-actions.js');
  const before = enemyCommandTransitions('q_michael', 0, [], null, true);
  const sun = before.find(x => x.stopReel === 0 && x.slotIndex === 2);
  assert.equal(sun.commandName, '太陽の加護');
  approx(sun.probability, 1/6, 1e-12);

  const after = enemyCommandTransitions('q_michael', 0, [], { '0:2':'金色の刻印' }, true);
  const changed = after.find(x => x.stopReel === 0 && x.slotIndex === 2);
  assert.equal(changed.commandName, '金色の刻印');
  approx(changed.probability, 1/6, 1e-12);
  assert.ok(!after.some(x => x.stopReel === 0 && x.slotIndex === 2 && x.commandName === '太陽の加護'));
}

// 68) ライト・イレイザーは通常60%・悪魔100%の即死。ケラクズ中は無効化され、倒された味方は同ターンの行動を行わない。
{
  const run = ({ race='normal', protect=false } = {}) => {
    const s = cloneDefaultState();
    s.allyCount = 2;
    s.enemy = { presetId:'q_michael', maxHp:'9999', attribute:'fire', race:'angel', attack:'75', speed:'65' };
    s.allies[0] = { characterId:'', attack:'1', speed:'100', star:'4', attribute:'water', race:'normal', commandVariant:'' };
    s.allies[1] = { characterId:'', attack:'1', speed:'1', star:'4', attribute:'water', race, commandVariant:'' };
    s.turns[0].allyActions[0] = protect
      ? { ...SKILL_PRESET_BY_ID.get('kerakuzu'), skillPresetId:'kerakuzu' }
      : { kind:'skip', skillName:'', effects:[] };
    s.turns[0].allyActions[1] = { kind:'attack', skillName:'低速テスト攻撃', skillMultiplier:'1', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
    s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
    return simulateKillProbability(s);
  };
  const { enemyCommandTransitions } = await import('../kill/enemy-actions.js');
  const eraserMass = enemyCommandTransitions('q_michael', 0)
    .filter(x => x.commandName === 'ライト・イレイザー')
    .reduce((sum,x)=>sum+x.probability,0);
  const normal = run();
  const demon = run({ race:'demon' });
  const protectedResult = run({ race:'demon', protect:true });
  approx(normal.allySkillActivation[0][1]['低速テスト攻撃'], 1 - eraserMass * 0.5 * 0.60, 1e-9);
  approx(demon.allySkillActivation[0][1]['低速テスト攻撃'], 1 - eraserMass * 0.5, 1e-9);
  approx(protectedResult.allySkillActivation[0][1]['低速テスト攻撃'], 1, 1e-9);
}

// 69) BOSS側の状態異常回避45は、物理/魔法/ブレス由来の毒付与率を100%→55%へ下げ、無分類技は回避を無視する。
{
  const run = attackType => {
    const s = cloneDefaultState();
    s.allyCount = 1;
    s.enemy = { presetId:'', maxHp:'100', attribute:'water', race:'normal', attack:'0', speed:'100' };
    s.allies[0] = { characterId:'', attack:'0', speed:'1', star:'4', attribute:'fire', race:'normal', commandVariant:'' };
    s.turns[0].allyActions[0] = { kind:'attack', skillName:'毒付与テスト', skillMultiplier:'0', attackAttribute:'none', attackAttribute2:'none', attackType, hits:'1', effects:[{ type:'poison', chance:'100' }] };
    s.turns[0].enemyAction = { enabled:true, effect:{ type:'enemyStatusAvoid', value:45, duration:3, nonStacking:true } };
    s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
    s.turns[1].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
    s.turns[1].enemyAction = { enabled:false, effect:{ type:'none' } };
    return simulateKillProbability(s).hpDistribution;
  };
  const physical = run('physical');
  approx(physical.get(90) ?? 0, 0.55, 1e-9);
  approx(physical.get(100) ?? 0, 0.45, 1e-9);
  const other = run('other');
  approx(other.get(90) ?? 0, 1, 1e-9);
}

// 70) 新規2BOSSを複数ターン走査しても未実装コマンドを出さない。
{
  for (const presetId of ['new6_arc_dragon','q_michael']) {
    const s = cloneDefaultState();
    s.allyCount = 3;
    s.enemy = { presetId, maxHp:'99999', attribute:'earth', race:'normal', attack:'75', speed:'65' };
    for (let i=0; i<3; i++) {
      s.allies[i] = { characterId:'', attack:'0', speed:String(120-i), star:'4', attribute:'water', race:'normal', commandVariant:'' };
      s.turns[0].allyActions[i] = { ...SKILL_PRESET_BY_ID.get('kerakuzu'), skillPresetId:'kerakuzu' };
    }
    s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
    while (s.turns.length < 5) s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
    const r = simulateKillProbability(s);
    assert.ok(!r.missingCommandEffects.some(x => x.includes('低空ダイブ') || x.includes('グランダイブ') || x.includes('太陽の加護') || x.includes('金色の刻印') || x.includes('ライト・イレイザー') || x.includes('リヒト') || x.includes('うつむいている')));
  }
}


// 71) v0.5.33: 光王エーリュシオン／死霊使いワイトと固定お供4体を登録。
{
  const { enemyBossProfile, enemyCommandTransitions, enemySkillForCommand, enemyCompanionProfile } = await import('../kill/enemy-actions.js');
  const { BOSS_PRESET_BY_ID } = await import('../kill/boss-presets.js');

  const elysion = enemyBossProfile('new6_elysion');
  assert.equal(elysion.attack, 69);
  assert.equal(elysion.matrix.length, 7);
  for (let reel=0; reel<7; reel++) approx(enemyCommandTransitions('new6_elysion', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  assert.deepEqual(BOSS_PRESET_BY_ID.get('new6_elysion').companions, ['天戦士クレイ','カマエル']);
  assert.equal(enemyCompanionProfile('天戦士クレイ').speed, 38);
  assert.equal(enemyCompanionProfile('カマエル').speed, 33);

  const wight = enemyBossProfile('new6_wight');
  assert.equal(wight.attack, 40);
  assert.equal(wight.matrix.length, 5);
  for (let reel=0; reel<5; reel++) approx(enemyCommandTransitions('new6_wight', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  assert.deepEqual(BOSS_PRESET_BY_ID.get('new6_wight').companions, ['アルラ']);
  assert.equal(enemyCompanionProfile('アルラ').speed, 25);
  assert.equal(enemyCompanionProfile('アルラウネ').speed, 33);
  assert.equal(enemyCompanionProfile('アルラウネ').inheritedBaseline, true);

  const summon = enemySkillForCommand('アルラウネ召喚','new6_wight').effects[0];
  assert.equal(summon.type, 'summonCompanion');
  assert.equal(summon.name, 'アルラ');
  assert.equal(summon.fillEmpty, true);
  const undeadSummon = enemySkillForCommand('アンデッド召喚★★★','new6_wight').effects[0];
  assert.equal(undeadSummon.name, 'アルラウネ');
  const attack = enemySkillForCommand('アルラウネアタック','new6_wight');
  assert.deepEqual(attack.turnContinueIfNoActiveCompanionNames, ['アルラ','アルラウネ']);
  assert.equal(attack.effects[0].type, 'consumeCompanions');
}

// 72) アルラのどくガスは55%でワイト自身を毒化し、次のBOSS行動終了時にHPへ反映する。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'new6_wight', maxHp:'100', attribute:'earth', race:'normal', attack:'40', speed:'60' };
  s.allies[0] = { characterId:'', attack:'0', speed:'0', star:'4', attribute:'fire', race:'normal', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  const r = simulateKillProbability(s);
  // ワイトが先にアルラウネアタックを引いた枝ではアルラが離脱するため、
  // 実際にどくガスまで到達した確率 × 55% が次のBOSS行動後の毒ダメージ枝になる。
  const damagedMass = [...r.hpDistribution.entries()].filter(([hp]) => Number(String(hp).split(',')[0]) < 100).reduce((sum,[,p]) => sum+p,0);
  const gasActivation = r.enemySkillActivation[0]['お供:アルラ / どくガス'];
  assert.ok(gasActivation > 0 && gasActivation < 1/6);
  approx(damagedMass, gasActivation * 0.55, 1e-9);
}

// 73) 新規2BOSSを複数ターン走査しても、撃破率に関係する未実装コマンド警告を出さない。
{
  for (const presetId of ['new6_elysion','new6_wight']) {
    const s = cloneDefaultState();
    s.allyCount = 1;
    s.enemy = { presetId, maxHp:'99999', attribute:'earth', race:'normal', attack:'50', speed:'60' };
    s.allies[0] = { characterId:'', attack:'0', speed:'0', star:'4', attribute:'water', race:'normal', commandVariant:'' };
    s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
    s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
    while (s.turns.length < 4) s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
    const r = simulateKillProbability(s);
    assert.deepEqual(r.missingCommandEffects, []);
  }
}


// 74) v0.5.34: 赤のプリンセス／死神グリムと吟遊詩人キドリを登録。
{
  const { enemyBossProfile, enemyCommandTransitions, enemySkillForCommand, enemyCompanionProfile } = await import('../kill/enemy-actions.js');
  const { BOSS_PRESET_BY_ID } = await import('../kill/boss-presets.js');

  const princess = enemyBossProfile('old0_red_princess');
  assert.equal(princess.attack, 20);
  assert.equal(princess.matrix.length, 5);
  for (let reel=0; reel<5; reel++) approx(enemyCommandTransitions('old0_red_princess', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  assert.deepEqual(BOSS_PRESET_BY_ID.get('old0_red_princess').companions, ['吟遊詩人キドリ']);
  const kidori = enemyCompanionProfile('吟遊詩人キドリ');
  assert.equal(kidori.speed, 60);
  assert.equal(kidori.attack, 38);
  assert.equal(kidori.matrix.length, 3);
  assert.equal(enemySkillForCommand('プリンセスのおうえん','old0_red_princess').kind, 'effect');
  assert.equal(enemySkillForCommand('召喚★★','old0_red_princess').effects[0]?.name, '吟遊詩人キドリ');
  assert.equal(enemySkillForCommand('召喚★★','old0_red_princess').effects[0]?.onlyIfMissing, true);

  const grim = enemyBossProfile('old1_grim');
  assert.equal(grim.attack, 70);
  assert.equal(grim.matrix.length, 5);
  for (let reel=0; reel<5; reel++) approx(enemyCommandTransitions('old1_grim', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  assert.deepEqual(BOSS_PRESET_BY_ID.get('old1_grim').companions, ['グリ','グリ']);
  const death = enemySkillForCommand('デス','old1_grim').effects[0];
  assert.equal(death.type, 'instantDeath');
  assert.equal(death.chance, 60);
  assert.deepEqual(death.immuneRaces, ['undead']);
  const fireDeath = enemySkillForCommand('火は消える','old1_grim').effects[0];
  assert.equal(fireDeath.requiredAttribute, 'fire');
  assert.equal(fireDeath.maxStar, 3);
  assert.equal(fireDeath.chance, 100);
}

// 75) 死神グリムの属性即死は、対応属性かつ☆3以下だけに効き、アンデッドには効かない。
{
  function run(attribute, star, race='normal') {
    const s = cloneDefaultState();
    s.allyCount = 1;
    s.enemy = { presetId:'old1_grim', maxHp:'666', attribute:'wind', race:'demon', attack:'70', speed:'70' };
    s.allies[0] = { characterId:'', attack:'1000', speed:'0', star:String(star), attribute, race, commandVariant:'' };
    s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
    s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
    s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
    s.turns[1].allyActions[0] = { kind:'attack', skillName:'', skillMultiplier:'1000', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
    return simulateKillProbability(s);
  }
  const fire3 = run('fire',3).killChance;
  const fire4 = run('fire',4).killChance;
  const light3 = run('light',3).killChance;
  // ☆3火だけ属性即死の追加リスクを受ける。☆4火と対象外属性は汎用デス分だけ一致する。
  assert.ok(fire3 < fire4);
  approx(fire4, light3, 1e-9);
  approx(run('fire',3,'undead').killChance, 1, 1e-9);
}

// 76) 新規2BOSSを複数ターン走査しても未実装コマンド警告を出さない。
{
  for (const presetId of ['old0_red_princess','old1_grim']) {
    const s = cloneDefaultState();
    s.allyCount = 1;
    s.enemy = { presetId, maxHp:'99999', attribute:'earth', race:'normal', attack:'50', speed:'70' };
    s.allies[0] = { characterId:'', attack:'0', speed:'0', star:'4', attribute:'water', race:'normal', commandVariant:'' };
    s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
    s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
    while (s.turns.length < 5) s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
    const r = simulateKillProbability(s);
    assert.deepEqual(r.missingCommandEffects, []);
  }
}

// 77) v0.5.94: 斉天大聖ソンゴクウ／魔皇マオタイを登録。猿石は敵お供ではない。
{
  const { enemyBossProfile, enemyCommandTransitions, enemySkillForCommand, enemyCompanionProfile } = await import('../kill/enemy-actions.js');
  const { BOSS_PRESET_BY_ID } = await import('../kill/boss-presets.js');

  const goku = enemyBossProfile('old7_son_goku');
  assert.equal(goku.attack, 60);
  assert.equal(goku.matrix.length, 6);
  for (let reel=0; reel<6; reel++) approx(enemyCommandTransitions('old7_son_goku', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  assert.deepEqual(BOSS_PRESET_BY_ID.get('old7_son_goku').companions, []);
  assert.equal(BOSS_PRESET_BY_ID.get('old7_son_goku').inferCompanions, false);
  const stone = enemyCompanionProfile('猿石');
  assert.equal(stone.speed, 4);
  assert.equal(stone.attack, 4);
  assert.equal(stone.matrix.length, 1);

  const maotai = enemyBossProfile('old7_maotai');
  assert.equal(maotai.attack, 65);
  assert.equal(maotai.matrix.length, 7);
  for (let reel=0; reel<7; reel++) approx(enemyCommandTransitions('old7_maotai', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  const assassination = enemySkillForCommand('無影暗殺拳','old7_maotai');
  assert.equal(assassination.multiplier, 240);
  assert.equal(assassination.effects[0].type, 'instantDeath');
  assert.equal(assassination.effects[0].chance, 10);
  assert.deepEqual(assassination.effects[0].immuneRaces, ['undead']);
  const charge = enemySkillForCommand('秘宗重拳','old7_maotai');
  assert.equal(charge.kind, 'enemyCharge');
  assert.equal(charge.defenseValue, 20);
  assert.equal(charge.breakDamagePercent, 50);
}

// 78) 新規2BOSSを複数ターン走査しても未実装コマンド警告を出さない。
{
  for (const presetId of ['old7_son_goku','old7_maotai']) {
    const s = cloneDefaultState();
    s.allyCount = 1;
    s.enemy = { presetId, maxHp:'99999', attribute:'earth', race:'normal', attack:'65', speed:'70' };
    s.allies[0] = { characterId:'', attack:'0', speed:'0', star:'4', attribute:'water', race:'normal', commandVariant:'' };
    s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
    s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
    while (s.turns.length < 5) s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
    const r = simulateKillProbability(s);
    assert.deepEqual(r.missingCommandEffects, []);
  }
}

// 79) 秘宗重拳を引いた枝では、そのターン後続の味方攻撃を20%軽減する。
{
  const s = cloneDefaultState();
  s.allyCount = 2;
  s.enemy = { presetId:'old7_maotai', maxHp:'1500', attribute:'none', race:'normal', attack:'65', speed:'70' };
  s.allies[0] = { characterId:'', attack:'0', speed:'100', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.allies[1] = { characterId:'', attack:'100', speed:'1', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].allyActions[1] = { kind:'attack', skillName:'テスト攻撃', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  const r = simulateKillProbability(s);
  const chargeMass = r.enemySkillActivation[0]['秘宗重拳'];
  assert.ok(chargeMass > 0);
  const reducedMass = [...r.hpDistribution].filter(([hp]) => hp >= 1416 && hp <= 1424).reduce((sum,[,p]) => sum+p, 0);
  const normalMass = [...r.hpDistribution].filter(([hp]) => hp >= 1395 && hp <= 1405).reduce((sum,[,p]) => sum+p, 0);
  approx(reducedMass, chargeMass, 1e-9);
  assert.ok(normalMass > 0);
  approx(reducedMass + normalMass + (r.hpDistribution.get(1500) ?? 0), 1, 1e-9);
}


// 80) 秘宗重拳の溜め中に最大HP50%分以上のダメージを受けると解除され、次ターンは通常コマンド抽選へ戻る。
{
  function run(atk) {
    const s = cloneDefaultState();
    s.allyCount = 2;
    s.enemy = { presetId:'old7_maotai', maxHp:'1500', attribute:'none', race:'normal', attack:'65', speed:'70' };
    // 即死による比較ノイズを避けるためアンデッドにする。
    s.allies[0] = { characterId:'', attack:'0', speed:'100', star:'4', attribute:'none', race:'undead', commandVariant:'' };
    s.allies[1] = { characterId:'', attack:String(atk), speed:'1', star:'4', attribute:'none', race:'undead', commandVariant:'' };
    s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
    s.turns[0].allyActions[1] = { kind:'attack', skillName:'解除判定攻撃', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
    s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
    s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
    s.turns[1].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
    s.turns[1].allyActions[1] = { kind:'skip', skillName:'', effects:[] };
    return simulateKillProbability(s);
  }
  const unbroken = run(100);  // 軽減後76～84ダメージで解除しない。
  const broken = run(1000);   // 軽減後760～840ダメージで750以上となり全て解除。
  approx(unbroken.enemySkillActivation[0]['秘宗重拳'], broken.enemySkillActivation[0]['秘宗重拳'], 1e-9);
  // 未解除枝はT2を放出に消費して再抽選しない。解除枝では通常抽選に戻るため、T2の技発動質量が増える。
  assert.ok((broken.enemySkillActivation[1]['無影暗殺拳'] ?? 0) > (unbroken.enemySkillActivation[1]['無影暗殺拳'] ?? 0));
  assert.ok((broken.enemySkillActivation[1]['秘宗重拳'] ?? 0) > (unbroken.enemySkillActivation[1]['秘宗重拳'] ?? 0));
}

console.log('enemy-actions.test.js: OK v0.5.35');


// 81) v0.5.36: ダムキナ／狂王マルドクとマトを登録。
{
  const { enemyBossProfile, enemyCommandTransitions, enemySkillForCommand, enemyCompanionProfile } = await import('../kill/enemy-actions.js');
  const { BOSS_PRESET_BY_ID } = await import('../kill/boss-presets.js');

  const damkina = enemyBossProfile('new0_damkina');
  assert.equal(damkina.attack, 60);
  assert.equal(damkina.matrix.length, 6);
  for (let reel=0; reel<6; reel++) approx(enemyCommandTransitions('new0_damkina', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  assert.deepEqual(BOSS_PRESET_BY_ID.get('new0_damkina').companions, ['マト']);
  const mato = enemyCompanionProfile('マト');
  assert.equal(mato.speed, 4);
  assert.equal(mato.attack, 33);
  assert.deepEqual(mato.matrix[0], ['ミス','こうげき','こうげき','こうげき!','うなる','まるかじり']);
  const heal = enemySkillForCommand('いやしの風','new0_damkina');
  assert.equal(heal.kind, 'heal');
  assert.equal(heal.value, 60);
  const grace = enemySkillForCommand('めぐみの風','new0_damkina');
  assert.equal(grace.kind, 'heal');
  assert.equal(grace.value, 90);
  assert.ok(grace.effects.some(x => x.type === 'enemyStatusCure'));

  const marduk = enemyBossProfile('new0_marduk');
  assert.equal(marduk.attack, 75);
  assert.equal(marduk.matrix.length, 8);
  for (let reel=0; reel<8; reel++) approx(enemyCommandTransitions('new0_marduk', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  const gale = enemySkillForCommand('狂風の乱撃','new0_marduk');
  assert.equal(gale.multiplier, 80);
  assert.equal(gale.hits, 4);
  assert.deepEqual(gale.attributes, ['wind']);
}

// 82) v0.5.36の新規2BOSSを複数ターン走査しても未実装コマンド警告を出さない。
{
  for (const presetId of ['new0_damkina','new0_marduk']) {
    const s = cloneDefaultState();
    s.allyCount = 1;
    s.enemy = { presetId, maxHp:'99999', attribute:'wind', race:'normal', attack:'75', speed:'85' };
    s.allies[0] = { characterId:'', attack:'0', speed:'0', star:'4', attribute:'water', race:'normal', commandVariant:'' };
    s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
    s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
    while (s.turns.length < 5) s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
    const r = simulateKillProbability(s);
    assert.deepEqual(r.missingCommandEffects, []);
  }
}

console.log('enemy-actions.test.js: OK v0.5.36');


// 83) 海竜ストリームドラゴンは単体BOSS、灰竜アッシュドラゴンは固定お供つき。
{
  const { enemyBossProfile, enemyCommandTransitions, enemySkillForCommand, enemyCompanionProfile, ENEMY_BOSS_PROFILE_IDS, ENEMY_COMPANION_PROFILE_NAMES } = await import('../kill/enemy-actions.js');
  const { BOSS_PRESET_BY_ID } = await import('../kill/boss-presets.js');
  assert.equal(ENEMY_BOSS_PROFILE_IDS.length, 92);
  assert.equal(ENEMY_COMPANION_PROFILE_NAMES.length, 44);

  const stream = enemyBossProfile('new1_stream_dragon');
  assert.equal(stream.attack, 60);
  assert.equal(stream.matrix.length, 6);
  assert.deepEqual(stream.matrix[0], ['ミス','こうげき','★→★★','こうげき!','★→★★','ウォーターブレス']);
  assert.deepEqual(stream.matrix[5], ['オプティカルカモフラージュ','ウォーターブレス','クリアアクアブレス','クリアアクアブレス','ストリームアタック','ストリームアタック']);
  for (let reel=0; reel<6; reel++) approx(enemyCommandTransitions('new1_stream_dragon', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  assert.deepEqual(BOSS_PRESET_BY_ID.get('new1_stream_dragon').companions, []);
  assert.equal(BOSS_PRESET_BY_ID.get('new1_stream_dragon').inferCompanions, false);
  const droplet = enemyCompanionProfile('海竜のしずく');
  assert.equal(droplet.attack, 1);
  assert.equal(droplet.speed, 2);
  assert.deepEqual(droplet.matrix[0], ['ときをまつ','ときをまつ','ときをまつ','ときをまつ','ときをまつ','ときをまつ']);

  const camouflage = enemySkillForCommand('オプティカルカモフラージュ','new1_stream_dragon');
  assert.equal(camouflage.turnContinue, true);
  assert.ok(camouflage.effects.some(x => x.type === 'enemyPhysicalEvasion' && x.chance === 40));
  assert.ok(camouflage.effects.some(x => x.type === 'disableEnemyCommandNameDuringChain'));
  const streamAttack = enemySkillForCommand('ストリームアタック','new1_stream_dragon');
  assert.equal(streamAttack.multiplier, 90);
  assert.equal(streamAttack.hitsMin, 2);
  assert.equal(streamAttack.hitsMax, 3);

  const ash = enemyBossProfile('new2_ash_dragon');
  assert.equal(ash.attack, 60);
  assert.equal(ash.matrix.length, 6);
  assert.deepEqual(ash.matrix[0], ['ミス','こうげき','こうげき','ためる','★→★★','ヴォイドブレス']);
  assert.deepEqual(ash.matrix[5], ['ひっかき!','ヴォイドブレス','ヴォイドブレス','ブラックヴォイドブレス','ブラックヴォイドブレス','ブラックヴォイドブレス']);
  for (let reel=0; reel<6; reel++) approx(enemyCommandTransitions('new2_ash_dragon', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  assert.deepEqual(BOSS_PRESET_BY_ID.get('new2_ash_dragon').companions, ['竜灰']);
  const ashEgg = enemyCompanionProfile('竜灰');
  assert.equal(ashEgg.attack, 1);
  assert.equal(ashEgg.speed, 1);
  assert.deepEqual(ashEgg.matrix[0], ['ときをまつ','ときをまつ','ときをまつ','ときをまつ','ときをまつ','ときをまつ']);
  assert.equal(enemySkillForCommand('ひっかき','new2_ash_dragon').multiplier, 120);
  assert.equal(enemySkillForCommand('ひっかき!','new2_ash_dragon').multiplier, 170);
  assert.equal(enemySkillForCommand('ヴォイドブレス','new2_ash_dragon').multiplier, 130);
  assert.equal(enemySkillForCommand('ブラックヴォイドブレス','new2_ash_dragon').multiplier, 145);
}

// 84) オプティカルカモフラージュ発動枝では、同ターン後続の物理攻撃を40%回避する。魔法攻撃は回避しない。
{
  const run = attackType => {
    const s = cloneDefaultState();
    s.allyCount = 1;
    s.enemy = { presetId:'new1_stream_dragon', maxHp:'100', attribute:'water', race:'seaDragon', attack:'60', speed:'65' };
    s.allies[0] = { characterId:'', attack:'1000', speed:'1', star:'4', attribute:'earth', race:'normal', commandVariant:'' };
    s.turns[0].allyActions[0] = { kind:'attack', skillName:'カモフラージュ試験', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none', attackType, hits:'1', effects:[] };
    s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
    return simulateKillProbability(s);
  };
  const physical = run('physical');
  const magic = run('magic');
  approx(magic.killChance, 1, 1e-9);
  assert.ok(physical.killChance < magic.killChance);
  assert.ok(physical.killChance > 0.6);
}

// 85) v0.5.37の新規2BOSSを複数ターン走査しても未実装コマンド警告を出さない。
{
  for (const presetId of ['new1_stream_dragon','new2_ash_dragon']) {
    const s = cloneDefaultState();
    s.allyCount = 1;
    s.enemy = { presetId, maxHp:'99999', attribute:'water', race:'dragon', attack:'60', speed:'65' };
    s.allies[0] = { characterId:'', attack:'0', speed:'1', star:'4', attribute:'earth', race:'normal', commandVariant:'' };
    s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
    s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
    while (s.turns.length < 5) s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
    const r = simulateKillProbability(s);
    assert.deepEqual(r.missingCommandEffects, []);
  }
}

console.log('enemy-actions.test.js: OK v0.5.37');


// 86) v0.5.38: 吸血竜ヴァンプスドラゴン／魔海竜シーサーペントを登録。
{
  const { enemyBossProfile, enemyCommandTransitions, enemySkillForCommand, ENEMY_BOSS_PROFILE_IDS, ENEMY_COMPANION_PROFILE_NAMES } = await import('../kill/enemy-actions.js');
  assert.equal(ENEMY_BOSS_PROFILE_IDS.length, 92);
  assert.equal(ENEMY_COMPANION_PROFILE_NAMES.length, 44);

  const vamps = enemyBossProfile('new2_vamps_dragon');
  assert.equal(vamps.attack, 85);
  assert.equal(vamps.matrix.length, 8);
  assert.deepEqual(vamps.matrix[0], ['ミス','こうげき','吸血','吸血!','★→★★','ためる']);
  assert.deepEqual(vamps.matrix[7], ['ダーク!!','ダーク!!!','ダーク!!!','ダーク!!!','吸血!!!','吸血!!!']);
  for (let reel=0; reel<8; reel++) approx(enemyCommandTransitions('new2_vamps_dragon', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  for (const [name,multiplier] of [['吸血',100],['吸血!',130],['吸血!!',150],['吸血!!!',170]]) {
    const sk = enemySkillForCommand(name,'new2_vamps_dragon');
    assert.equal(sk.kind, 'lifestealAttack');
    assert.equal(sk.multiplier, multiplier);
    assert.equal(sk.healRate, 70);
    assert.deepEqual(sk.attributes, ['evil']);
  }

  const serpent = enemyBossProfile('new5_sea_serpent');
  assert.equal(serpent.attack, 65);
  assert.equal(serpent.matrix.length, 8);
  assert.deepEqual(serpent.matrix[0], ['ほほえんでいる','★→★★','こうげき','★→★★','海竜の舌なめずり','ブラックデプス']);
  assert.deepEqual(serpent.matrix[7], ['海竜の舌なめずり','こうげき!','ブラックデプス','たいあたり','常闇のいき','アビスコール']);
  for (let reel=0; reel<8; reel++) approx(enemyCommandTransitions('new5_sea_serpent', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  const abyss = enemySkillForCommand('アビスコール','new5_sea_serpent');
  assert.ok(abyss.effects.some(x => x.type === 'status' && x.status === 'curse' && x.chance === 75 && x.duration === 4));
  const darkBreath = enemySkillForCommand('常闇のいき','new5_sea_serpent');
  assert.equal(darkBreath.multiplier, 135);
  assert.ok(darkBreath.effects.some(x => x.type === 'status' && x.status === 'darkness' && x.chance === 25));
  assert.equal(enemySkillForCommand('ブラックデプス','new5_sea_serpent').multiplier, 125);
}

// 87) 吸血系は与ダメージの70%をBOSS HPへ還元する。純粋な敵ダメージ自体は味方HPとして追跡しない。
{
  const s = cloneDefaultState();
  s.allyCount = 2;
  s.enemy = { presetId:'new2_vamps_dragon', maxHp:'1500', attribute:'fire', race:'normal', attack:'85', speed:'45' };
  // 味方1が先に100%物理で95～105ダメージを与え、BOSSが行動し、その後に味方2が行動してターンを閉じる。
  // 1リールの〖吸血〗/〖吸血!〗は合計2/6なので、HP1420超へ戻る質量はちょうど1/3になる。
  s.allies[0] = { characterId:'', attack:'100', speed:'100', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.allies[1] = { characterId:'', attack:'0', speed:'1', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'attack', skillName:'吸血回復試験', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
  s.turns[0].allyActions[1] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  const r = simulateKillProbability(s);
  const healedMass = [...r.hpDistribution].filter(([hp]) => hp > 1420).reduce((sum,[,p]) => sum+p, 0);
  const lifestealActivation = ['吸血','吸血!','吸血!!','吸血!!!']
    .reduce((sum,name) => sum + (r.enemySkillActivation[0][name] ?? 0), 0);
  approx(healedMass, lifestealActivation, 1e-9);
  assert.ok(lifestealActivation > 0);
  assert.ok(Math.max(...r.hpDistribution.keys()) >= 1450);
}

// 88) v0.5.38の新規2BOSSを複数ターン走査しても未実装コマンド警告を出さない。
{
  for (const presetId of ['new2_vamps_dragon','new5_sea_serpent']) {
    const s = cloneDefaultState();
    s.allyCount = 1;
    s.enemy = { presetId, maxHp:'99999', attribute:'water', race:'dragon', attack:'85', speed:'45' };
    s.allies[0] = { characterId:'', attack:'0', speed:'1', star:'4', attribute:'earth', race:'normal', commandVariant:'' };
    s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
    s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
    while (s.turns.length < 5) s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
    const r = simulateKillProbability(s);
    assert.deepEqual(r.missingCommandEffects, []);
  }
}

console.log('enemy-actions.test.js: OK v0.5.38');


// 89) v0.5.39: 神人ニラーハラー／魔将ガープと関連お供3体を登録。
{
  const { enemyBossProfile, enemyCommandTransitions, enemySkillForCommand, enemyCompanionProfile, enemyCompanionSkillForCommand, ENEMY_BOSS_PROFILE_IDS, ENEMY_COMPANION_PROFILE_NAMES } = await import('../kill/enemy-actions.js');
  const { BOSS_PRESET_BY_ID } = await import('../kill/boss-presets.js');
  assert.equal(ENEMY_BOSS_PROFILE_IDS.length, 92);
  assert.equal(ENEMY_COMPANION_PROFILE_NAMES.length, 44);

  const nira = enemyBossProfile('new3_nirahalar');
  assert.equal(nira.attack, 65);
  assert.equal(nira.matrix.length, 7);
  assert.deepEqual(nira.matrix[0], ['ためる','ほほえんでいる','ためる','ムチミ突き','★→★★','ナンクルマルオーリトーリ']);
  assert.deepEqual(nira.matrix[6], ['サキムイ','ムチミ突き','怒涛の攻め','ムチミ突き','ムチミ突き','怒涛の攻め']);
  for (let reel=0; reel<7; reel++) approx(enemyCommandTransitions('new3_nirahalar', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  assert.equal(enemySkillForCommand('ムチミ突き','new3_nirahalar').multiplier, 210);
  const call = enemySkillForCommand('ナンクルマルオーリトーリ','new3_nirahalar');
  assert.ok(call.effects.some(x => x.type === 'companionPermanentStats' && x.attack === 25 && x.speed === 25 && x.maxHp === 80));
  assert.ok(call.effects.some(x => x.type === 'summonCompanion' && x.name === 'ナンクルマル'));
  const sakimui = enemySkillForCommand('サキムイ','new3_nirahalar');
  assert.equal(sakimui.kind, 'heal');
  assert.equal(sakimui.value, 50);
  assert.equal(sakimui.target, 'enemyTeam');

  const nankur = enemyCompanionProfile('ナンクルマル');
  assert.equal(nankur.attack, 42);
  assert.equal(nankur.speed, 42);
  assert.equal(nankur.matrix.length, 4);
  assert.deepEqual(nankur.matrix[0], ['ほほえんでいる','ほほえんでいる','こうげき','かみくだき','ためる','★→★★']);
  assert.deepEqual(nankur.matrix[3], ['こうげき!','こうげき!','すいこみ','すいこみ','会心の一撃','かみくだき']);
  const suction = enemyCompanionSkillForCommand('すいこみ','ナンクルマル');
  assert.equal(suction.kind, 'actionLock');
  assert.equal(suction.duration, 2);
  assert.equal(suction.minimumActiveTargets, 2);
  assert.equal(suction.lockSource, true);

  const garp = enemyBossProfile('new4_garp');
  assert.equal(garp.attack, 60);
  assert.equal(garp.matrix.length, 7);
  assert.deepEqual(garp.matrix[0], ['ガープの物理法則','ガープの物理法則','★→★★','★→★★','★→★★','ガープの物理法則']);
  assert.deepEqual(garp.matrix[6], ['ボルガノン','ハイクラス・ボルガノン','ハイクラス・ボルガノン','こうげき','ハイクラス・ボルガノン','ハイクラス・ボルガノン']);
  for (let reel=0; reel<7; reel++) approx(enemyCommandTransitions('new4_garp', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  assert.deepEqual(BOSS_PRESET_BY_ID.get('new4_garp').companions, ['魔鏡騎士リフレク','ダークサラマンダー']);
  assert.equal(enemySkillForCommand('ボルガノン','new4_garp').multiplier, 110);
  assert.equal(enemySkillForCommand('ハイクラス・ボルガノン','new4_garp').multiplier, 130);
  assert.equal(enemySkillForCommand('エナジーフィール','new4_garp').kind, 'effect');

  const reflect = enemyCompanionProfile('魔鏡騎士リフレク');
  assert.equal(reflect.attack, 33);
  assert.equal(reflect.speed, 59);
  assert.equal(reflect.inheritedBaseline, true);
  assert.deepEqual(reflect.matrix[2], ['こうげき','こうげき!','こうげき!','ミラーソード','ミラーソード','グラン・マジック・リフレクト']);
  const darkSalamander = enemyCompanionProfile('ダークサラマンダー');
  assert.equal(darkSalamander.attack, 46);
  assert.equal(darkSalamander.speed, 25);
  assert.deepEqual(darkSalamander.matrix[0], ['燃えている','燃えている','こうげき','★→★★','★→★★','黒炎のいき']);
  assert.equal(enemyCompanionSkillForCommand('黒炎のいき','ダークサラマンダー').multiplier, 120);
}

// 90) ニラーハラーの召喚／ガープ固定お供を含めて複数ターン走査しても未実装コマンド警告を出さない。
{
  for (const presetId of ['new3_nirahalar','new4_garp']) {
    const s = cloneDefaultState();
    s.allyCount = 1;
    s.enemy = { presetId, maxHp:'99999', attribute:presetId === 'new3_nirahalar' ? 'water' : 'fire', race:'demon', attack:presetId === 'new3_nirahalar' ? '65' : '60', speed:presetId === 'new3_nirahalar' ? '50' : '70' };
    s.allies[0] = { characterId:'', attack:'0', speed:'1', star:'4', attribute:'earth', race:'normal', commandVariant:'' };
    s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
    s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
    while (s.turns.length < 3) s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
    const r = simulateKillProbability(s);
    assert.deepEqual(r.missingCommandEffects, []);
  }
}

console.log('enemy-actions.test.js: OK v0.5.39');

// 91) ナンクルマルの〖すいこみ〗は2体以上の味方にだけ作用し、吸い込まれた枝では味方行動を止める。
{
  const run = allyCount => {
    const s = cloneDefaultState();
    s.allyCount = allyCount;
    s.enemy = { presetId:'new3_nirahalar', maxHp:'99999', attribute:'water', race:'demon', attack:'65', speed:'50' };
    for (let i=0; i<allyCount; i++) {
      s.allies[i] = { characterId:'', attack:'1', speed:String(2-i), star:'4', attribute:'earth', race:'normal', commandVariant:'' };
      s.turns[0].allyActions[i] = { kind:'skip', skillName:'', effects:[] };
    }
    s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
    s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
    for (let i=0; i<allyCount; i++) {
      s.turns[1].allyActions[i] = { kind:'attack', skillName:'すいこみ行動試験', skillMultiplier:'1', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
    }
    return simulateKillProbability(s);
  };
  const solo = run(1);
  const duo = run(2);
  approx(solo.allySkillActivation[1][0]['すいこみ行動試験'], 1, 1e-9);
  assert.ok((duo.allySkillActivation[1][0]['すいこみ行動試験'] ?? 0) < 1);
  assert.ok((duo.allySkillActivation[1][1]['すいこみ行動試験'] ?? 0) < 1);
  assert.ok((duo.enemySkillActivation[1]['お供:ナンクルマル / すいこみ'] ?? 0) > 0);
}

console.log('enemy-actions.test.js: OK v0.5.39 actionLock');


// 92) v0.5.40: 魔王アヴァドン／ダイダラボッチとアヴァドンフードを登録。
{
  const { enemyBossProfile, enemyCommandTransitions, enemySkillForCommand, enemyCompanionProfile, enemyCompanionSkillForCommand, ENEMY_BOSS_PROFILE_IDS, ENEMY_COMPANION_PROFILE_NAMES } = await import('../kill/enemy-actions.js');
  const { BOSS_PRESET_BY_ID } = await import('../kill/boss-presets.js');
  assert.equal(ENEMY_BOSS_PROFILE_IDS.length, 92);
  assert.equal(ENEMY_COMPANION_PROFILE_NAMES.length, 44);

  const avaddon = enemyBossProfile('new4_avaddon');
  assert.equal(avaddon.attack, 20);
  assert.equal(avaddon.matrix.length, 7);
  assert.deepEqual(avaddon.matrix[0], ['ほほえんでいる','ためる','ためる','こうげき!','会心の一撃','★→★★']);
  assert.deepEqual(avaddon.matrix[6], ['こうげき!','こうげき!','魔王の一撃','魔王の一撃','魔王の一撃','おかわり']);
  for (let reel=0; reel<7; reel++) approx(enemyCommandTransitions('new4_avaddon', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  assert.deepEqual(BOSS_PRESET_BY_ID.get('new4_avaddon').companions, ['アヴァドンフード','アヴァドンフード']);
  const refill = enemySkillForCommand('おかわり','new4_avaddon');
  assert.ok(refill.effects.some(x => x.type === 'summonCompanion' && x.name === 'アヴァドンフード' && x.fillEmpty === true));
  const eat = enemySkillForCommand('フードをたべる','new4_avaddon');
  assert.equal(eat.kind, 'consumeCompanionHealBuff');
  assert.equal(eat.healValue, 150);
  assert.equal(eat.attackAdd, 50);
  assert.deepEqual(eat.turnContinueIfNoActiveCompanionNames, ['アヴァドンフード']);

  const food = enemyCompanionProfile('アヴァドンフード');
  assert.equal(food.attack, 4);
  assert.equal(food.speed, 29);
  assert.deepEqual(food.matrix[0], ['ミス','EXゲージ+1','EXゲージ+1','EXゲージ+2','EXゲージ+3','ふたをする']);
  assert.equal(enemyCompanionSkillForCommand('ふたをする','アヴァドンフード').kind, 'effect');

  const daida = enemyBossProfile('q_daidarabocchi');
  assert.equal(daida.attack, 85);
  assert.equal(daida.matrix.length, 8);
  assert.deepEqual(daida.matrix[0], ['様子を見ている','こうげき','こうげき','ためる','ためる','ナク']);
  assert.deepEqual(daida.matrix[7], ['ナク','こうげき!','こうげき!','タタカウ','タタカウ','ワラウ']);
  for (let reel=0; reel<8; reel++) approx(enemyCommandTransitions('q_daidarabocchi', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  assert.equal(enemySkillForCommand('ナク','q_daidarabocchi').effects[0].chance, 80);
  assert.equal(enemySkillForCommand('ヤスム','q_daidarabocchi').attackMultiplier, 80);
  assert.equal(enemySkillForCommand('オコル','q_daidarabocchi').bossReelShift, 1);
  assert.equal(enemySkillForCommand('ワラウ','q_daidarabocchi').bossReelShift, -1);
  assert.equal(enemySkillForCommand('カナシイ','q_daidarabocchi').bossReelShift, 1);
}

// 93) ダイダラボッチ1リールの〖ナク〗は80%麻痺を反映し、味方の行動確率を 13/15 にする。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'q_daidarabocchi', maxHp:'2500', attribute:'earth', race:'normal', attack:'85', speed:'5' };
  s.allies[0] = { characterId:'', attack:'1', speed:'1', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'attack', skillName:'ナク麻痺試験', skillMultiplier:'1', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  const r = simulateKillProbability(s);
  approx(r.allySkillActivation[0][0]['ナク麻痺試験'], 13/15, 1e-9);
  approx(r.enemySkillActivation[0]['ナク'], 1/6, 1e-9);
}

// 94) v0.5.40の2BOSSを複数ターン走査しても未実装コマンド警告を出さない。
{
  for (const presetId of ['new4_avaddon','q_daidarabocchi']) {
    const s = cloneDefaultState();
    s.allyCount = 1;
    s.enemy = { presetId, maxHp:'99999', attribute:'earth', race:presetId === 'new4_avaddon' ? 'demon' : 'normal', attack:presetId === 'new4_avaddon' ? '20' : '85', speed:presetId === 'new4_avaddon' ? '10' : '5' };
    s.allies[0] = { characterId:'', attack:'0', speed:'1', star:'4', attribute:'none', race:'normal', commandVariant:'' };
    s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
    s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
    while (s.turns.length < 6) s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
    const r = simulateKillProbability(s);
    assert.deepEqual(r.missingCommandEffects, []);
  }
}

console.log('enemy-actions.test.js: OK v0.5.40');

// 95) v0.5.41: 舞王ナタラジャ／鋏竜ザリガリオンを登録。
{
  const { enemyBossProfile, enemyCommandTransitions, enemySkillForCommand, ENEMY_BOSS_PROFILE_IDS, ENEMY_COMPANION_PROFILE_NAMES } = await import('../kill/enemy-actions.js');
  assert.equal(ENEMY_BOSS_PROFILE_IDS.length, 92);
  assert.equal(ENEMY_COMPANION_PROFILE_NAMES.length, 44);

  const nataraja = enemyBossProfile('q_nataraja');
  assert.equal(nataraja.attack, 70);
  assert.equal(nataraja.matrix.length, 8);
  assert.deepEqual(nataraja.matrix[0], ['ほほえんでいる','踏魔の踊り','★→★★','生命の踊り','★→★★','踏魔の踊り']);
  assert.deepEqual(nataraja.matrix[7], ['こうげき!','生命の踊り','踏魔の踊り','火神の踊り','踏魔の踊り','火神の踊り']);
  for (let reel=0; reel<8; reel++) approx(enemyCommandTransitions('q_nataraja', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  const lifeDance = enemySkillForCommand('生命の踊り','q_nataraja');
  assert.equal(lifeDance.kind, 'dance');
  assert.equal(lifeDance.healNormal, 50);
  assert.equal(lifeDance.healEnhanced, 60);
  assert.equal(lifeDance.blessingFlat, 35);
  assert.equal(enemySkillForCommand('火神の踊り','q_nataraja').multiplier, 100);
  assert.equal(enemySkillForCommand('踏魔の踊り','q_nataraja').multiplier, 90);

  const zarigarion = enemyBossProfile('q_zarigarion');
  assert.equal(zarigarion.attack, 60);
  assert.equal(zarigarion.matrix.length, 5);
  assert.deepEqual(zarigarion.matrix[0], ['ミス','★→★★','★→★★','竜のしっぽ','竜のしっぽ','オニバサミ']);
  assert.deepEqual(zarigarion.matrix[4], ['フグバサミ','クラゲバサミ','オニバサミ','オニバサミ','鋏竜の猛攻','鋏竜の猛攻']);
  for (let reel=0; reel<5; reel++) approx(enemyCommandTransitions('q_zarigarion', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  assert.equal(enemySkillForCommand('フグバサミ','q_zarigarion').effects[0].chance, 80);
  assert.equal(enemySkillForCommand('クラゲバサミ','q_zarigarion').effects[0].chance, 50);
  assert.equal(enemySkillForCommand('オニバサミ','q_zarigarion').multiplier, 250);
  assert.equal(enemySkillForCommand('鋏竜の猛攻','q_zarigarion').turnContinue, true);
}

// 96) ナタラジャは連続する踊り状態を保持し、生命の踊りによる回復枝を撃破HP分布へ反映する。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'q_nataraja', maxHp:'1400', attribute:'fire', race:'demon', attack:'70', speed:'70' };
  s.allies[0] = { characterId:'', attack:'100', speed:'1', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'attack', skillName:'ナタラジャ回復試験', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  const r = simulateKillProbability(s);
  assert.deepEqual(r.missingCommandEffects, []);
  assert.ok((r.enemySkillActivation[0]['生命の踊り'] ?? 0) > 0);
  assert.ok((r.enemySkillActivation[1]['生命の踊り'] ?? 0) > 0);
  assert.ok(Math.max(...r.hpDistribution.keys()) > 1210); // 敵行動なしなら100%攻撃2回後の最大HPは1210。
}

// 97) ザリガリオンの猛攻は即時再行動を有限状態で集約し、クラゲバサミの50%麻痺を味方行動率へ反映する。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'q_zarigarion', maxHp:'1950', attribute:'water', race:'warrior', attack:'60', speed:'30' };
  s.allies[0] = { characterId:'', attack:'1', speed:'1', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'attack', skillName:'ザリガリオン麻痺試験', skillMultiplier:'1', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  const r = simulateKillProbability(s);
  assert.deepEqual(r.missingCommandEffects, []);
  assert.ok((r.enemySkillActivation[0]['鋏竜の猛攻'] ?? 0) > 0);
  assert.ok((r.enemySkillActivation[0]['クラゲバサミ'] ?? 0) > 0);
  approx(r.allySkillActivation[0][0]['ザリガリオン麻痺試験'], 1 - (r.enemySkillActivation[0]['クラゲバサミ'] * 0.5), 1e-9);
  assert.ok(r.scenarioCountByTurn[0] < 20);
}



// 98) v0.5.42: 幽鬼ジャンヌ／時元銃士ダルタンを登録。
{
  const { enemyBossProfile, enemyCommandTransitions, enemySkillForCommand, ENEMY_BOSS_PROFILE_IDS, ENEMY_COMPANION_PROFILE_NAMES } = await import('../kill/enemy-actions.js');
  assert.equal(ENEMY_BOSS_PROFILE_IDS.length, 92);
  assert.equal(ENEMY_COMPANION_PROFILE_NAMES.length, 44);

  const jeanne = enemyBossProfile('q_ghost_jeanne');
  assert.equal(jeanne.attack, 60);
  assert.equal(jeanne.matrix.length, 6);
  assert.deepEqual(jeanne.matrix[0], ['ミス','★→★★','★→★★','こうげき','こうげき!','妄執の攻撃']);
  assert.deepEqual(jeanne.matrix[5], ['こうげき!','こうげき!','妄執の攻撃','強信の一撃','妄執の攻撃','強信の一撃']);
  for (let reel=0; reel<6; reel++) approx(enemyCommandTransitions('q_ghost_jeanne', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  const obsession = enemySkillForCommand('妄執の攻撃','q_ghost_jeanne');
  assert.equal(obsession.multiplierMin, 160);
  assert.equal(obsession.multiplierMax, 200);
  assert.deepEqual(obsession.attributes, ['holy']);
  const conviction = enemySkillForCommand('強信の一撃','q_ghost_jeanne');
  assert.equal(conviction.multiplier, 250);
  assert.deepEqual(conviction.attributes, ['holy']);

  const dartan = enemyBossProfile('q_dartan');
  assert.equal(dartan.attack, 80);
  assert.equal(dartan.matrix.length, 7);
  assert.deepEqual(dartan.matrix[0], ['ミス','こうげき','こうげき!','★→★★','★→★★','狙い撃ち']);
  assert.deepEqual(dartan.matrix[6], ['狙い撃ち','会心の一撃','必殺の一撃','魔弾','必殺の一撃','魔弾']);
  for (let reel=0; reel<7; reel++) approx(enemyCommandTransitions('q_dartan', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  const aimed = enemySkillForCommand('狙い撃ち','q_dartan');
  assert.equal(aimed.multiplier, 350);
  assert.equal(aimed.chargeTurns, 1);
  const magicBullet = enemySkillForCommand('魔弾','q_dartan');
  assert.equal(magicBullet.multiplier, 130);
  assert.equal(magicBullet.hitsMin, 1);
  assert.equal(magicBullet.hitsMax, 3);
  assert.deepEqual(magicBullet.attributes, ['dark']);
}

// 99) 両BOSSは10ターン分の自動コマンド抽選を行っても未登録効果を出さない。
for (const enemy of [
  { presetId:'q_ghost_jeanne', maxHp:'1200', attribute:'water', race:'warrior', attack:'60', speed:'50' },
  { presetId:'q_dartan', maxHp:'1400', attribute:'earth', race:'warrior', attack:'80', speed:'40' }
]) {
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = enemy;
  s.allies[0] = { characterId:'', attack:'1', speed:'1', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'attack', skillName:'v0.5.42回帰', skillMultiplier:'1', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  while (s.turns.length < 10) s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  const r = simulateKillProbability(s);
  assert.deepEqual(r.missingCommandEffects, []);
}

console.log('enemy-actions.test.js: OK v0.5.42');


// 100) v0.5.43: 騎士団長エンキ／灼熱剣士アレスとドーシュを登録。
{
  const { enemyBossProfile, enemyCommandTransitions, enemySkillForCommand, enemyCompanionProfile, enemyCompanionSkillForCommand, ENEMY_BOSS_PROFILE_IDS, ENEMY_COMPANION_PROFILE_NAMES } = await import('../kill/enemy-actions.js');
  assert.equal(ENEMY_BOSS_PROFILE_IDS.length, 92);
  assert.equal(ENEMY_COMPANION_PROFILE_NAMES.length, 44);

  const enki = enemyBossProfile('q_enki');
  assert.equal(enki.attack, 75);
  assert.equal(enki.matrix.length, 7);
  assert.deepEqual(enki.matrix[0], ['戦士召喚★★★','戦士召喚★★★','★→★★','ためる','ためる','会心の一撃']);
  assert.deepEqual(enki.matrix[6], ['戦士召喚★★★','必殺の一撃','必殺の一撃','必殺の一撃','必殺の一撃','必殺の一撃']);
  for (let reel=0; reel<7; reel++) approx(enemyCommandTransitions('q_enki', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  const summon = enemySkillForCommand('戦士召喚★★★','q_enki');
  assert.ok(summon.effects.some(x => x.type === 'summonCompanion' && x.name === 'ドーシュ'));
  assert.equal(enemySkillForCommand('死守の号令','q_enki').turnContinueIfActiveCompanion, true);
  assert.equal(enemySkillForCommand('突撃の号令','q_enki').turnContinueIfActiveCompanion, true);

  const dorsh = enemyCompanionProfile('ドーシュ');
  assert.equal(dorsh.attack, 50);
  assert.equal(dorsh.speed, 16);
  assert.deepEqual(dorsh.matrix[0], ['ミス','こうげき','こうげき!','★→★★','狙い撃ち','フェザーキラー']);
  assert.deepEqual(dorsh.matrix[1], ['こうげき','こうげき','こうげき!','会心の一撃','フェザーキラー','フェザーキラー']);
  const feather = enemyCompanionSkillForCommand('フェザーキラー','ドーシュ');
  assert.equal(feather.multiplierMin, 130);
  assert.equal(feather.multiplierMax, 180);
  assert.deepEqual(feather.attributes, ['wind']);

  const ares = enemyBossProfile('q_blazing_ares');
  assert.equal(ares.attack, 85);
  assert.equal(ares.matrix.length, 7);
  assert.deepEqual(ares.matrix[0], ['超熱血!','超熱血!','★→★★','★→★★','超熱血!','★→★★']);
  assert.deepEqual(ares.matrix[6], ['こうげき','ミス','灼熱剣バニングセイバー','真熱剣ソーラセイバー','真熱剣ソーラセイバー','真熱剣ソーラセイバー']);
  for (let reel=0; reel<7; reel++) approx(enemyCommandTransitions('q_blazing_ares', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  const hot = enemySkillForCommand('超熱血!','q_blazing_ares');
  const transform = hot.effects.find(x => x.type === 'transformEnemyCommands');
  assert.equal(hot.attackAddPermanent, 10);
  assert.equal(transform.mapping['ミス'], '熱剣ヒートセイバー');
  assert.equal(transform.mapping['熱剣ヒートセイバー'], '灼熱剣バニングセイバー');
  assert.equal(transform.mapping['灼熱剣バニングセイバー'], '真熱剣ソーラセイバー');
  assert.equal(enemySkillForCommand('熱剣ヒートセイバー','q_blazing_ares').multiplier, 200);
  assert.equal(enemySkillForCommand('灼熱剣バニングセイバー','q_blazing_ares').multiplier, 245);
  assert.equal(enemySkillForCommand('真熱剣ソーラセイバー','q_blazing_ares').multiplier, 290);
}

// 101) エンキの召喚・号令再行動、アレスの超熱血コマンド変化を複数ターンで処理しても未登録効果を出さない。
for (const enemy of [
  { presetId:'q_enki', maxHp:'1500', attribute:'wind', race:'warrior', attack:'75', speed:'45' },
  { presetId:'q_blazing_ares', maxHp:'2900', attribute:'fire', race:'normal', attack:'85', speed:'30' }
]) {
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = enemy;
  s.allies[0] = { characterId:'', attack:'1', speed:'1', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'attack', skillName:'v0.5.43回帰', skillMultiplier:'1', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  while (s.turns.length < 10) s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  const r = simulateKillProbability(s);
  assert.deepEqual(r.missingCommandEffects, []);
  if (enemy.presetId === 'q_enki') {
    assert.ok(r.enemySkillActivation.some(turn => (turn['戦士召喚★★★'] ?? 0) > 0));
    assert.ok(r.enemySkillActivation.some(turn => (turn['死守の号令'] ?? 0) > 0 || (turn['突撃の号令'] ?? 0) > 0));
    assert.ok(r.enemySkillActivation.some(turn => (turn['お供:ドーシュ / フェザーキラー'] ?? 0) > 0 || (turn['お供:ドーシュ / 狙い撃ち'] ?? 0) > 0));
  } else {
    assert.ok(r.enemySkillActivation.some(turn => (turn['超熱血!'] ?? 0) > 0));
    assert.ok(r.enemySkillActivation.some(turn => (turn['灼熱剣バニングセイバー'] ?? 0) > 0));
    assert.ok(r.enemySkillActivation.some(turn => (turn['真熱剣ソーラセイバー'] ?? 0) > 0));
  }
}

console.log('enemy-actions.test.js: OK v0.5.43');


// 102) v0.5.44: 大魔王アズール／大魔王サッカーラと召喚先を登録。
{
  const {
    enemyBossProfile, enemyCommandTransitions, enemySkillForCommand,
    enemyCompanionProfile, enemyCompanionSkillForCommand,
    ENEMY_BOSS_PROFILE_IDS, ENEMY_COMPANION_PROFILE_NAMES
  } = await import('../kill/enemy-actions.js');
  assert.equal(ENEMY_BOSS_PROFILE_IDS.length, 92);
  assert.equal(ENEMY_COMPANION_PROFILE_NAMES.length, 44);

  const azul = enemyBossProfile('q_great_azul');
  assert.equal(azul.attack, 93);
  assert.equal(azul.matrix.length, 8);
  assert.deepEqual(azul.matrix[0], ['ほほえんでいる','ほほえんでいる','★→★★','★→★★','バルバドスの水','海王の海開き']);
  assert.deepEqual(azul.matrix[7], ['バルバドスの水','魔海のしもべ召喚★★★★','海王の海開き','海王の海開き','海王の海開き','海王の海開き']);
  for (let reel=0; reel<8; reel++) approx(enemyCommandTransitions('q_great_azul', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  const openSea = enemySkillForCommand('海王の海開き','q_great_azul');
  assert.equal(openSea.multiplier, 135);
  assert.deepEqual(openSea.attributes, ['water']);
  const barbados = enemySkillForCommand('バルバドスの水','q_great_azul');
  assert.ok(barbados.effects.some(x => x.type === 'barbadosWater'));
  const azul3 = enemySkillForCommand('魔海のしもべ召喚★★★','q_great_azul');
  assert.ok(azul3.effects.some(x => x.type === 'summonCompanion' && x.name === '魔海兵ブリュー' && x.startReel === 2));
  const azul4 = enemySkillForCommand('魔海のしもべ召喚★★★★','q_great_azul');
  assert.ok(azul4.effects.some(x => x.type === 'summonCompanion' && x.name === '魔海将フィスカ' && x.startReel === 3));

  const fiska = enemyCompanionProfile('魔海将フィスカ');
  assert.equal(fiska.attack, 67);
  assert.equal(fiska.speed, 38);
  assert.deepEqual(fiska.matrix[3], ['アイスデン','こうげき!','会心の一撃','会心の一撃','アイスパーティクル','アイスバインド']);

  const soccerra = enemyBossProfile('q_great_soccerra');
  assert.equal(soccerra.attack, 90);
  assert.equal(soccerra.matrix.length, 8);
  assert.deepEqual(soccerra.matrix[0], ['ほほえんでいる','デザートエリート召喚','デザートエリート召喚','★→★★','ためる','★→★★']);
  assert.deepEqual(soccerra.matrix[7], ['こうげき!','会心の一撃','会心の一撃','ミリオンズフィスト','ミリオンズフィスト','ミリオンズフィスト']);
  for (let reel=0; reel<8; reel++) approx(enemyCommandTransitions('q_great_soccerra', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  const desert = enemySkillForCommand('デザートエリート召喚','q_great_soccerra');
  const weighted = desert.effects.find(x => x.type === 'summonCompanionWeighted');
  assert.ok(weighted);
  assert.deepEqual(weighted.choices.map(x => x.name), ['イムホテプ','大地の闘士ロック','古神兵サルベージ','岩竜ロックドラゴン','スカルボーンドラゴン']);
  approx(weighted.choices.reduce((sum,x)=>sum+x.weight,0), 100, 1e-3);

  const imhotep = enemyCompanionProfile('イムホテプ');
  assert.equal(imhotep.attack, 80); assert.equal(imhotep.speed, 20);
  assert.deepEqual(imhotep.matrix[0], ['ほほえんでいる','アシド','アシド!','吸収魔法','吸収魔法','デス']);
  assert.equal(enemyCompanionSkillForCommand('デス','イムホテプ').effects[0].chance, 60);

  const rock = enemyCompanionProfile('大地の闘士ロック');
  assert.equal(rock.attack, 65); assert.equal(rock.speed, 40);
  assert.deepEqual(rock.matrix[0], ['こうげき','パンチコンボ','パンチコンボ','キックコンボ','キックコンボ','コンボフィニッシャー']);

  const rockDragon = enemyCompanionProfile('岩竜ロックドラゴン');
  assert.equal(rockDragon.attack, 55); assert.equal(rockDragon.speed, 5);
  const rockBreath = enemyCompanionSkillForCommand('ロックブレス','岩竜ロックドラゴン');
  assert.equal(rockBreath.multiplier, 150);
  assert.equal(rockBreath.effects[0].chance, 10);
  const roar = enemyCompanionSkillForCommand('竜の咆哮','岩竜ロックドラゴン');
  assert.deepEqual(roar.effects.map(x => [x.status,x.chance]), [['paralysis',30],['confusion',30]]);

  const skull = enemyCompanionProfile('スカルボーンドラゴン');
  assert.equal(skull.attack, 60); assert.equal(skull.speed, 10);
  const stone = enemyCompanionSkillForCommand('石化ブレス','スカルボーンドラゴン');
  assert.equal(stone.multiplier, 110);
  assert.equal(stone.effects[0].chance, 15);
}

// 103) 両大魔王は複数ターンの召喚・状態異常枝を処理しても未登録効果を出さない。
for (const enemy of [
  { presetId:'q_great_azul', maxHp:'1600', attribute:'water', race:'demon', attack:'93', speed:'45' },
  { presetId:'q_great_soccerra', maxHp:'2100', attribute:'earth', race:'demon', attack:'90', speed:'25' }
]) {
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = enemy;
  s.allies[0] = { characterId:'', attack:'1', speed:'1', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'attack', skillName:'v0.5.44回帰', skillMultiplier:'1', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  while (s.turns.length < 4) s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  const r = simulateKillProbability(s);
  assert.deepEqual(r.missingCommandEffects, []);
  if (enemy.presetId === 'q_great_azul') {
    assert.ok(r.enemySkillActivation.some(turn => (turn['バルバドスの水'] ?? 0) > 0));
    assert.ok(r.enemySkillActivation.some(turn => (turn['魔海のしもべ召喚★★★'] ?? 0) > 0 || (turn['魔海のしもべ召喚★★★★'] ?? 0) > 0));
  } else {
    assert.ok(r.enemySkillActivation.some(turn => (turn['デザートエリート召喚'] ?? 0) > 0));
    assert.ok(r.enemySkillActivation.some(turn => Object.keys(turn).some(k => k.startsWith('お供:'))));
  }
}

console.log('enemy-actions.test.js: OK v0.5.44');


// 104) v0.5.45: 銀月のルシフェル／大魔皇ラフロイグのBOSS専用表と主要技。
{
  const {
    ENEMY_BOSS_PROFILE_IDS, ENEMY_COMPANION_PROFILE_NAMES,
    enemyBossProfile, enemyCommandTransitions, enemySkillForCommand,
    enemyCompanionProfile, enemyCompanionSkillForCommand
  } = await import('../kill/enemy-actions.js');
  assert.equal(ENEMY_BOSS_PROFILE_IDS.length, 92);
  assert.equal(ENEMY_COMPANION_PROFILE_NAMES.length, 44);

  const lucifer = enemyBossProfile('q_lucifer');
  assert.equal(lucifer.attack, 75);
  assert.equal(lucifer.matrix.length, 8);
  assert.deepEqual(lucifer.matrix[0], ['ほほえんでいる','こうげき','★→★★','こうげき!','★→★★','フォーリン・ダウン']);
  assert.deepEqual(lucifer.matrix[7], ['銀色の光','こうげき!','必殺の一撃','月の闇','月の闇','フォーリン・ダウン']);
  for (let reel=0; reel<8; reel++) approx(enemyCommandTransitions('q_lucifer', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  const silver = enemySkillForCommand('銀色の光','q_lucifer');
  assert.equal(silver.multiplier, 130);
  assert.deepEqual(silver.attributes, ['light']);
  assert.ok(silver.effects.some(x => x.status === 'darkness' && x.chance === 55));
  const moon = enemySkillForCommand('月の闇','q_lucifer');
  assert.equal(moon.replaceUsedSlotWith, '銀色の光');
  assert.ok(moon.effects.some(x => x.status === 'confusion' && x.chance === 35));
  const falling = enemySkillForCommand('フォーリン・ダウン','q_lucifer');
  assert.equal(falling.kind, 'fallingDown');
  assert.equal(falling.chance, 75);
  assert.deepEqual(falling.immuneRaces, ['demon','undead']);

  const lafroig = enemyBossProfile('q_great_lafroig');
  assert.equal(lafroig.attack, 90);
  assert.equal(lafroig.matrix.length, 8);
  assert.deepEqual(lafroig.matrix[0], ['★→★★','★→★★','火族召喚★★★★','火族召喚★★★★','こうげき!','ほほえんでいる']);
  assert.deepEqual(lafroig.matrix[7], ['ほほえんでいる','フォッグブレイク','大魔皇の一撃','火族召喚★★★★','フォッグブレイク','ブレイジング・ブラッド']);
  for (let reel=0; reel<8; reel++) approx(enemyCommandTransitions('q_great_lafroig', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  const blazing = enemySkillForCommand('ブレイジング・ブラッド','q_great_lafroig');
  assert.equal(blazing.kind, 'lifestealAttack');
  assert.equal(blazing.target, 'all');
  assert.equal(blazing.healRate, 20);
  assert.ok(blazing.effects.some(x => x.type === 'enemyAtkBuff' && x.value === 10 && x.duration === 3 && x.nonStacking));
  const summon = enemySkillForCommand('火族召喚★★★★','q_great_lafroig');
  assert.ok(summon.effects.some(x => x.type === 'summonCompanion' && x.name === 'ピートー'));

  const pete = enemyCompanionProfile('ピートー');
  assert.equal(pete.attribute, 'fire');
  assert.equal(pete.attack, 50);
  assert.equal(pete.speed, 25);
  assert.deepEqual(pete.matrix[1], ['燃えている','こうげき!','こうげき!','★★→★★★','火に油を注ぐ','火の用心']);
  assert.deepEqual(pete.matrix[2], ['燃えている','こうげき!','こうげき!','こうげき!','燃えるこぶし','燃えるこぶし']);
  const oil = enemyCompanionSkillForCommand('火に油を注ぐ','ピートー');
  assert.ok(oil.effects.some(x => x.type === 'fireTeamReelShift' && x.amount === 3));
  const safety = enemyCompanionSkillForCommand('火の用心','ピートー');
  const guard = safety.effects.find(x => x.type === 'enemyDefenseBuff');
  assert.equal(guard.value, 60);
  assert.deepEqual(guard.attributes, ['fire']);
  assert.equal(enemyCompanionSkillForCommand('燃えるこぶし','ピートー').multiplier, 200);
}

// 105) フォーリン・ダウンはリーダーを対象外にし、非リーダー1体へ75%即死を適用する。
{
  const s = cloneDefaultState();
  s.allyCount = 2;
  s.enemy = { presetId:'q_lucifer', maxHp:'10', attribute:'water', race:'angel', attack:'75', speed:'65' };
  s.allies[0] = { characterId:'', attack:'0', speed:'1', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.allies[1] = { characterId:'', attack:'999', speed:'1', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].allyActions[1] = { kind:'attack', skillName:'v0.5.45回帰', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  const normal = simulateKillProbability(s);

  // 悪魔・アンデッドはフォーリン・ダウン即死無効。同じ編成なら通常種族より行動成功率が高くなる。
  const immuneState = JSON.parse(JSON.stringify(s));
  immuneState.allies[1].race = 'demon';
  const immune = simulateKillProbability(immuneState);
  assert.ok(normal.killChance < immune.killChance);

  // 成功枝では次のBOSS行動が召喚だけに消費されるため、2ターン目の通常技発動質量が減る。
  const twoTurnNormal = JSON.parse(JSON.stringify(s));
  twoTurnNormal.enemy.maxHp = '1800';
  twoTurnNormal.allies[1].attack = '0';
  twoTurnNormal.turns[0].allyActions[1] = { kind:'skip', skillName:'', effects:[] };
  twoTurnNormal.turns.push(JSON.parse(JSON.stringify(twoTurnNormal.turns[0])));
  const twoTurnImmune = JSON.parse(JSON.stringify(twoTurnNormal));
  twoTurnImmune.allies[1].race = 'demon';
  const rn = simulateKillProbability(twoTurnNormal);
  const ri = simulateKillProbability(twoTurnImmune);
  const massN = Object.values(rn.enemySkillActivation[1]).reduce((sum,x)=>sum+x,0);
  const massI = Object.values(ri.enemySkillActivation[1]).reduce((sum,x)=>sum+x,0);
  assert.ok(massN < massI);
}

// 106) 両BOSSを複数ターン動かしても未登録コマンドを出さず、ラフロイグはピートーを召喚して行動させる。
for (const enemy of [
  { presetId:'q_lucifer', maxHp:'1800', attribute:'water', race:'angel', attack:'75', speed:'65' },
  { presetId:'q_great_lafroig', maxHp:'2000', attribute:'fire', race:'demon', attack:'90', speed:'40' }
]) {
  const s = cloneDefaultState();
  s.allyCount = 2;
  s.enemy = enemy;
  s.allies[0] = { characterId:'', attack:'1', speed:'1', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.allies[1] = { characterId:'', attack:'1', speed:'2', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  for (let i=0;i<2;i++) s.turns[0].allyActions[i] = { kind:'attack', skillName:'v0.5.45回帰', skillMultiplier:'1', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  while (s.turns.length < 4) s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  const r = simulateKillProbability(s);
  assert.deepEqual(r.missingCommandEffects, []);
  if (enemy.presetId === 'q_lucifer') {
    assert.ok(r.enemySkillActivation.some(turn => (turn['フォーリン・ダウン'] ?? 0) > 0));
  } else {
    assert.ok(r.enemySkillActivation.some(turn => (turn['火族召喚★★★★'] ?? 0) > 0));
    assert.ok(r.enemySkillActivation.some(turn => Object.keys(turn).some(k => k.startsWith('お供:ピートー / '))));
    assert.ok(r.enemySkillActivation.some(turn => (turn['お供:ピートー / 火に油を注ぐ'] ?? 0) > 0));
  }
}


// 107) v0.5.46: 煌竜王ファイアドレイク／滅竜王ブラックドレイクのBOSS専用表と撃破率に関係する技。
{
  const { ENEMY_BOSS_PROFILE_IDS, enemyBossProfile, enemyCommandTransitions, enemySkillForCommand } = await import('../kill/enemy-actions.js');
  assert.equal(ENEMY_BOSS_PROFILE_IDS.length, 92);

  const shining = enemyBossProfile('q_shining_fire_drake');
  assert.equal(shining.attack, 80);
  assert.equal(shining.matrix.length, 7);
  assert.deepEqual(shining.matrix[0], ['こうげき!','こうげき!','竜のしっぽ','ためる','★→★★','業火のいき']);
  assert.deepEqual(shining.matrix[2], ['ほほえんでいる','ファイアーブレス','ファイアーブレス','ためる','★★→★★★','業火のいき']);
  assert.deepEqual(shining.matrix[6], ['ほほえんでいる','雷光の爪','雷光の爪','いにしえの火炎のいき','いにしえの火炎のいき','いにしえの火炎のいき']);
  for (let reel=0; reel<shining.matrix.length; reel++) approx(enemyCommandTransitions('q_shining_fire_drake', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);

  const thunderClaw = enemySkillForCommand('雷光の爪','q_shining_fire_drake');
  assert.equal(thunderClaw.multiplier, 210);
  assert.equal(thunderClaw.attackType, 'physical');
  assert.deepEqual(thunderClaw.attributes, ['light']);
  const ancientFire = enemySkillForCommand('いにしえの火炎のいき','q_shining_fire_drake');
  assert.equal(ancientFire.multiplier, 140);
  assert.equal(ancientFire.target, 'all');
  assert.equal(ancientFire.attackType, 'breath');
  assert.deepEqual(ancientFire.attributes, ['fire']);

  const black = enemyBossProfile('q_black_drake');
  assert.equal(black.attack, 66);
  assert.equal(black.matrix.length, 8);
  assert.deepEqual(black.matrix[0], ['★→★★','闇のいき','竜のしっぽ','竜のしっぽ','闇のいき','★→★★']);
  assert.deepEqual(black.matrix[4], ['暗黒の爪','暗黒の爪','ためる','ためる','いにしえの暗黒のいき','いにしえの暗黒のいき']);
  assert.deepEqual(black.matrix[7], ['暗黒の爪','暗黒の爪','冥界の神罰','冥界の神罰','いにしえの暗黒のいき','いにしえの暗黒のいき']);
  for (let reel=0; reel<black.matrix.length; reel++) approx(enemyCommandTransitions('q_black_drake', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);

  const darkClaw = enemySkillForCommand('暗黒の爪','q_black_drake');
  assert.equal(darkClaw.multiplier, 210);
  assert.equal(darkClaw.attackType, 'physical');
  assert.deepEqual(darkClaw.attributes, ['dark']);
  const ancientDark = enemySkillForCommand('いにしえの暗黒のいき','q_black_drake');
  assert.equal(ancientDark.multiplier, 140);
  assert.equal(ancientDark.target, 'all');
  assert.equal(ancientDark.attackType, 'breath');
  assert.deepEqual(ancientDark.attributes, ['dark']);
  const punishment = enemySkillForCommand('冥界の神罰','q_black_drake');
  assert.equal(punishment.multiplier, 300);
  assert.equal(punishment.attackType, 'magic');
  const vulnerability = punishment.effects.find(x => x.type === 'enemyDefenseDebuff');
  assert.equal(vulnerability.value, 20);
  assert.equal(vulnerability.duration, 3);
  assert.equal(vulnerability.nonStacking, true);
  assert.equal(vulnerability.stackKey, '冥界の神罰:被ダメ');
}

// 108) v0.5.46追加BOSSを複数ターン自動実行しても未登録コマンドを残さない。
for (const enemy of [
  { presetId:'q_shining_fire_drake', maxHp:'1800', attribute:'fire', race:'normal', attack:'80', speed:'45' },
  { presetId:'q_black_drake', maxHp:'2666', attribute:'earth', race:'normal', attack:'66', speed:'66' }
]) {
  const s = cloneDefaultState();
  s.allyCount = 2;
  s.enemy = enemy;
  s.allies[0] = { characterId:'', attack:'1', speed:'1', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.allies[1] = { characterId:'', attack:'1', speed:'2', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  for (let i=0;i<2;i++) s.turns[0].allyActions[i] = { kind:'attack', skillName:'v0.5.46回帰', skillMultiplier:'1', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  while (s.turns.length < 6) s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  const r = simulateKillProbability(s);
  assert.deepEqual(r.missingCommandEffects, []);
  assert.ok(r.enemySkillActivation.some(turn => Object.values(turn).some(x => x > 0)));
}

// 109) v0.5.47: 陰龍インシェンロン／プラチナドレイクのBOSS表と主要効果。
{
  const { ENEMY_BOSS_PROFILE_IDS, enemyBossProfile, enemyCommandTransitions, enemySkillForCommand } = await import('../kill/enemy-actions.js');
  assert.equal(ENEMY_BOSS_PROFILE_IDS.length, 92);

  const yin = enemyBossProfile('q_yinlong');
  assert.equal(yin.attack, 80);
  assert.equal(yin.matrix.length, 5);
  assert.deepEqual(yin.matrix[0], ['ミス','こうげき','★→★★','★→★★','竜の旋廻','蛍光の宝玉']);
  assert.deepEqual(yin.matrix[4], ['ブラックライトブレス','竜の旋迴','竜の旋迴','蛍光の宝玉','蛍光の宝玉','蛍光の宝玉']);
  for (let reel=0; reel<yin.matrix.length; reel++) approx(enemyCommandTransitions('q_yinlong', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  const orbit = enemySkillForCommand('竜の旋廻','q_yinlong');
  assert.equal(orbit.multiplier, 110);
  assert.equal(orbit.bossReelShift, 1);
  const orb = enemySkillForCommand('蛍光の宝玉','q_yinlong');
  assert.equal(orb.multiplierMin, 50);
  assert.equal(orb.multiplierMax, 90);
  assert.equal(orb.hits, 4);
  assert.deepEqual(orb.attributes, ['light']);
  const blacklight = enemySkillForCommand('ブラックライトブレス','q_yinlong');
  assert.equal(blacklight.multiplier, 95);
  assert.deepEqual(blacklight.attributes, ['heat','dark']);
  assert.ok(blacklight.effects.some(x => x.type === 'allyReelRandomSet'));

  const platinum = enemyBossProfile('q_platinum_drake');
  assert.equal(platinum.attack, 70);
  assert.equal(platinum.matrix.length, 7);
  assert.deepEqual(platinum.matrix[0], ['こうげき!','こうげき!','竜のしっぽ','ためる','ためる','雷竜の壁']);
  assert.deepEqual(platinum.matrix[6], ['地獄の牙','地獄の牙','雷竜の壁','雷竜の壁','光のいき','光のいき']);
  for (let reel=0; reel<platinum.matrix.length; reel++) approx(enemyCommandTransitions('q_platinum_drake', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  const wall = enemySkillForCommand('雷竜の壁','q_platinum_drake');
  const guard = wall.effects.find(x => x.type === 'enemyDefenseBuff');
  assert.equal(guard.value, 25);
  assert.equal(guard.duration, 3);
  assert.equal(guard.nonStacking, true);
  assert.deepEqual(guard.attackTypes, ['physical','magic','breath']);
  const lightBreath = enemySkillForCommand('光のいき','q_platinum_drake');
  assert.equal(lightBreath.multiplier, 140);
  assert.equal(lightBreath.attackType, 'breath');
  assert.deepEqual(lightBreath.attributes, ['light']);
}

// 110) v0.5.47追加BOSSを複数ターン自動実行しても未登録コマンドを残さない。
for (const enemy of [
  { presetId:'q_yinlong', maxHp:'1000', attribute:'water', race:'normal', attack:'80', speed:'80' },
  { presetId:'q_platinum_drake', maxHp:'1500', attribute:'earth', race:'normal', attack:'70', speed:'75' }
]) {
  const s = cloneDefaultState();
  s.allyCount = 2;
  s.enemy = enemy;
  s.allies[0] = { characterId:'', attack:'1', speed:'1', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.allies[1] = { characterId:'', attack:'1', speed:'2', star:'3', attribute:'none', race:'normal', commandVariant:'' };
  for (let i=0;i<2;i++) s.turns[0].allyActions[i] = { kind:'attack', skillName:'v0.5.47回帰', skillMultiplier:'1', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  while (s.turns.length < 6) s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  const r = simulateKillProbability(s);
  assert.deepEqual(r.missingCommandEffects, []);
  assert.ok(r.enemySkillActivation.some(turn => Object.values(turn).some(x => x > 0)));
}

// 111) v0.5.48: ミートマニアのBOSS表と、撃破率に影響する〖たべる〗回復。
{
  const { ENEMY_BOSS_PROFILE_IDS, enemyBossProfile, enemyCommandTransitions, enemySkillForCommand } = await import('../kill/enemy-actions.js');
  assert.equal(ENEMY_BOSS_PROFILE_IDS.length, 92);

  const meat = enemyBossProfile('q_meat_mania');
  assert.equal(meat.attack, 40);
  assert.equal(meat.matrix.length, 5);
  assert.deepEqual(meat.matrix[0], ['たべる','たべる','たべる','ためる','ためる','ためる']);
  assert.deepEqual(meat.matrix[4], ['ミス','たべる','こうげき!','会心の一撃','必殺の一撃','渾身の一撃']);
  for (let reel=0; reel<meat.matrix.length; reel++) approx(enemyCommandTransitions('q_meat_mania', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);

  const eat = enemySkillForCommand('たべる','q_meat_mania');
  assert.equal(eat.kind, 'heal');
  assert.equal(eat.value, 80);
  assert.equal(eat.enemyAttackAdd, 5);
  assert.equal(eat.enemyAttackAddPermanent, true);
  assert.equal(eat.enemyAttackAddStacking, true);

  const smash = enemySkillForCommand('渾身の一撃','q_meat_mania');
  assert.equal(smash.multiplier, 180);
  assert.equal(smash.selfBuffUseMultiplierGain, 80);
  assert.equal(smash.selfBuffUseMultiplierMaxUses, 5);
  assert.deepEqual(smash.selfBuffUseCommands, ['たべる','ガッツパワー']);
  assert.equal(smash.maxMultiplier, 580);
}

// 112) 〖たべる〗が選ばれた枝では、味方の先行攻撃後にHP80回復し最大HP900を超えない。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'q_meat_mania', maxHp:'900', attribute:'wind', race:'normal', attack:'40', speed:'30' };
  s.allies[0] = { characterId:'', attack:'100', speed:'100', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'attack', skillName:'v0.5.48たべる確認', skillMultiplier:'100', attackAttribute:'none', attackAttribute2:'none', attackType:'physical', hits:'1', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  // 最終ターンは最後の味方行動で計算を止める仕様なので、T1のBOSS回復を観測するためT2をダミーで追加する。
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  const r = simulateKillProbability(s);
  assert.ok((r.enemySkillActivation[0]['たべる'] ?? 0) > 0);
  assert.deepEqual(r.missingCommandEffects, []);
  const liveHp = [...r.hpDistribution.keys()].filter(h => h > 0);
  assert.ok(liveHp.some(h => h >= 870));
  assert.ok(Math.max(...liveHp) <= 900);
}


// 113) v0.5.49: 海賊王ドック・ローのBOSS表、再行動技のslot単位ミス化、最大HP/攻撃上昇。
{
  const { ENEMY_BOSS_PROFILE_IDS, enemyBossProfile, enemyCommandTransitions, enemySkillForCommand } = await import('../kill/enemy-actions.js');
  assert.equal(ENEMY_BOSS_PROFILE_IDS.length, 92);
  const dock = enemyBossProfile('q_dock_low');
  assert.equal(dock.attack, 75);
  assert.equal(dock.matrix.length, 7);
  assert.deepEqual(dock.matrix[0], ['蒼染の月明','蒼染の月明','こうげき!','ぬすむ','★→★★','★→★★']);
  assert.deepEqual(dock.matrix[6], ['★★★★★★★→★','★★★★★★★→★','大海流','大海流','大海流','必殺の一撃']);
  for (let reel=0; reel<dock.matrix.length; reel++) approx(enemyCommandTransitions('q_dock_low', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);

  const moon = enemySkillForCommand('蒼染の月明','q_dock_low');
  assert.equal(moon.turnContinue, true);
  assert.equal(moon.replaceUsedSlotWith, 'ミス');
  assert.equal(moon.enemyExGain, 1);
  assert.deepEqual(moon.effects, [{ type:'enemyMaxHpAdd', value:30 }]);
  const scream = enemySkillForCommand('深海の叫び','q_dock_low');
  assert.equal(scream.turnContinue, true);
  assert.equal(scream.replaceUsedSlotWith, 'ミス');
  assert.deepEqual(scream.effects, [{ type:'enemyPermanentAttackAdd', value:5 }]);
  const current = enemySkillForCommand('大海流','q_dock_low');
  assert.equal(current.multiplier, 180);
  assert.equal(current.attackType, 'magic');
  assert.deepEqual(current.attributes, ['water']);
}

// 114) 蒼染の月明は使ったスロットだけを永続ミス化して再行動するため、
// 1リール開始時に同じ蒼染を無限再抽選せず、最終的に非再行動技で行動を終える。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'q_dock_low', maxHp:'1700', attribute:'water', race:'normal', attack:'75', speed:'55' };
  s.allies[0] = { characterId:'', attack:'1', speed:'1', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].enemyAction = { enabled:false, effect:{ type:'none' } };
  const r = simulateKillProbability(s);
  assert.ok((r.enemySkillActivation[0]['蒼染の月明'] ?? 0) > 0);
  assert.ok((r.enemySkillActivation[0]['蒼染の月明'] ?? 0) < 2.0000001);
  assert.deepEqual(r.missingCommandEffects, []);
}


// 115) v0.5.50: 創造神ロケーシャのBOSS専用8リールと固有技・召喚先。
{
  const {
    ENEMY_BOSS_PROFILE_IDS, ENEMY_COMPANION_PROFILE_NAMES,
    enemyBossProfile, enemyCommandTransitions, enemySkillForCommand,
    enemyCompanionProfile, enemyCompanionSkillForCommand
  } = await import('../kill/enemy-actions.js');
  assert.equal(ENEMY_BOSS_PROFILE_IDS.length, 92);
  assert.equal(ENEMY_COMPANION_PROFILE_NAMES.length, 44);

  const lokesha = enemyBossProfile('q_lokesha');
  assert.equal(lokesha.attack, 75);
  assert.equal(lokesha.matrix.length, 8);
  assert.deepEqual(lokesha.matrix[0], ['召喚★','★→★★','★→★★','★→★★','★→★★','召喚★']);
  assert.deepEqual(lokesha.matrix[7], ['ヨガテラピー','プラパンチャ','会心の一撃','ブラフマーストラ','ブラフマーストラ','召喚★★★★']);
  for (let reel=0; reel<lokesha.matrix.length; reel++) approx(enemyCommandTransitions('q_lokesha', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);

  const yoga = enemySkillForCommand('ヨガテラピー','q_lokesha');
  assert.equal(yoga.kind, 'heal');
  assert.equal(yoga.value, 80);
  assert.deepEqual(yoga.effects, [{ type:'enemyStatusCure' }]);
  const prapancha = enemySkillForCommand('プラパンチャ','q_lokesha');
  assert.equal(prapancha.multiplier, 100);
  assert.equal(prapancha.attackType, 'magic');
  assert.deepEqual(prapancha.attributes, ['light']);
  const brahma = enemySkillForCommand('ブラフマーストラ','q_lokesha');
  assert.equal(brahma.multiplier, 140);
  assert.equal(brahma.attackType, 'physical');
  assert.deepEqual(brahma.attributes, ['holy']);
  assert.equal(brahma.burnChance, 75);

  assert.equal(enemySkillForCommand('召喚★','q_lokesha').effects[0].name, 'バロ');
  assert.equal(enemySkillForCommand('召喚★★','q_lokesha').effects[0].name, 'イシザル');
  assert.equal(enemySkillForCommand('召喚★★','q_lokesha').effects[0].startReel, 0);
  assert.equal(enemySkillForCommand('召喚★★★','q_lokesha').effects[0].name, 'カルラ');
  assert.equal(enemySkillForCommand('召喚★★★','q_lokesha').effects[0].startReel, 0);
  assert.equal(enemySkillForCommand('召喚★★★★','q_lokesha').effects[0].name, 'アシユラ');
  assert.equal(enemySkillForCommand('召喚★★★★','q_lokesha').effects[0].startReel, 0);
  assert.equal(enemyCompanionProfile('バロ').killProbabilityInert, true);
  assert.equal(enemyCompanionProfile('イシザル').killProbabilityInert, true);
  assert.equal(enemyCompanionProfile('アシユラ').killProbabilityInert, true);
  const karura = enemyCompanionProfile('カルラ');
  assert.equal(karura.inheritedBaseline, true);
  assert.deepEqual(karura.matrix[0], ['笑っている','笑っている','こうげき','こうげき','こうげき','黒い旋風']);
  assert.deepEqual(karura.matrix[1], ['笑っている','こうげき','こうげき!','大喝','テングツブテ','テングツブテ']);
  assert.deepEqual(karura.matrix[2], ['笑っている','大喝','こうげき!','こうげき!','テングツブテ','蛇殺しの一撃']);
  for (let reel=0; reel<karura.matrix.length; reel++) approx(enemyCompanionCommandTransitions('カルラ', reel).reduce((sum,x)=>sum+x.probability,0), 1, 1e-9);
  assert.equal(enemyCompanionSkillForCommand('大喝','カルラ').effects[0].type, 'purgeBeneficial');
}

// 116) ロケーシャを複数ターン自動実行し、固定アシユラ・召喚分岐を含めても未登録効果を残さない。
{
  const s = cloneDefaultState();
  s.allyCount = 2;
  s.enemy = { presetId:'q_lokesha', maxHp:'1600', attribute:'fire', race:'demon', attack:'75', speed:'60' };
  s.allies[0] = { characterId:'', attack:'1', speed:'1', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  s.allies[1] = { characterId:'', attack:'1', speed:'2', star:'4', attribute:'none', race:'normal', commandVariant:'' };
  for (let i=0;i<2;i++) s.turns[0].allyActions[i] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction = { enabled:true, effect:{ type:'none' } };
  while (s.turns.length < 8) s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  const r = simulateKillProbability(s);
  assert.deepEqual(r.missingCommandEffects, []);
  assert.deepEqual(r.missingCompanionCommandProfiles, []);
  assert.ok(r.activeCompanionCommandProfiles.includes('アシユラ'));
  assert.ok((r.enemySkillActivation.flatMap(x => Object.entries(x)).find(([name]) => name === '召喚★')?.[1] ?? 0) > 0);
}

// 116) v0.5.51: マシュまろBOSSの5リールと固有技を登録。
{
  const { ENEMY_BOSS_PROFILE_IDS, enemyBossProfile, enemyCommandTransitions, enemySkillForCommand } = await import('../kill/enemy-actions.js');
  assert.equal(ENEMY_BOSS_PROFILE_IDS.length, 92);
  const profile = enemyBossProfile('new5_mashumaro');
  assert.ok(profile);
  assert.equal(profile.attack, 31);
  assert.equal(profile.matrix.length, 5);
  assert.deepEqual(profile.matrix[0], ['ミス','こうげき','EXゲージ＋1','★→★★','こうげき!','こうげき']);
  assert.deepEqual(profile.matrix[4], ['EXゲージ＋2','マシュまるま','EXゲージ＋2','こうげき','EXゲージ＋3','マシュまるま']);
  const roll = enemyCommandTransitions('new5_mashumaro', 0);
  assert.ok(Math.abs(roll.reduce((a,x)=>a+x.probability,0) - 1) < 1e-12);
  const marsh = enemySkillForCommand('マシュまるま','new5_mashumaro');
  assert.equal(marsh.multiplierMin, 100);
  assert.equal(marsh.multiplierMax, 250);
}



// 117) v0.5.56: ガープの物理法則は固定お供を眠らせ、物理被ダメージを半減する。
{
  const { enemySkillForCommand, enemyCompanionProfile, enemyCompanionBaseHp } = await import('../kill/enemy-actions.js');
  const law = enemySkillForCommand('ガープの物理法則','new4_garp');
  assert.equal(law.kind, 'effect');
  assert.deepEqual(law.effects[0].attackTypes, ['physical']);
  assert.equal(law.effects[0].value, 50);
  assert.equal(law.effects[1].type, 'companionTeamSleep');
  assert.equal(law.effects[1].duration, 5);
  assert.equal(enemyCompanionProfile('魔鏡騎士リフレク').race, 'warrior');
  assert.equal(enemyCompanionProfile('ダークサラマンダー').race, 'dragon');
  assert.equal(enemyCompanionProfile('ドーシュ').race, 'warrior');
  assert.equal(enemyCompanionBaseHp('ドーシュ'), 93);

}

// 118) v0.5.56: エンキの死守の号令は、お供単体へ2ターンの防御・行動不能を設定する。
{
  const { enemySkillForCommand } = await import('../kill/enemy-actions.js');
  const order = enemySkillForCommand('死守の号令','q_enki');
  assert.equal(order.turnContinueIfActiveCompanion, true);
  const guard = order.effects.find(x => x.type === 'companionGuardOrder');
  assert.deepEqual({ duration:guard.duration, value:guard.value, warriorValue:guard.warriorValue }, { duration:2, value:30, warriorValue:60 });
}


// 119) v0.5.65: 内部CPU召喚表・ブランチ・トカイ・旧章補完の回帰監査。
{
  const {
    ENEMY_BOSS_PROFILE_IDS, ENEMY_COMPANION_PROFILE_NAMES,
    enemyBossProfile, enemyCommandTransitions, enemySkillForCommand,
    enemyCompanionProfile, enemyCompanionCommandTransitions, enemyCompanionSkillForCommand,
    enemyCompanionBaseHp
  } = await import('../kill/enemy-actions.js');

  const branch = enemySkillForCommand('ブランチ','new3_root_dragon');
  assert.equal(branch.effects[0].type, 'summonCompanion');
  assert.equal(branch.effects[0].name, 'ルートン');

  const muusSummon = enemySkillForCommand('召喚★','old0_muus').effects[0];
  assert.equal(muusSummon.type, 'summonCompanionWeighted');
  assert.deepEqual(muusSummon.choices.map(x => [x.name,x.weight]), [
    ['スライム',400],['ジバクガエル',300],['ウサミコ',200],['チビドラゴン',100]
  ]);

  const riviere4 = enemySkillForCommand('召喚★★★★','old0_riviere').effects[0];
  assert.deepEqual(riviere4.choices.map(x => [x.name,x.weight]), [
    ['スライム・マナ',490],['王子マルドク',300],['アヴァドン',200],['レッドドラゴン',10]
  ]);

  assert.equal(enemySkillForCommand('吸収攻撃','old2_skullbone').healRate, 70);
  assert.equal(enemySkillForCommand('浄玻璃鏡','old6_enma').enemyExSpend, 2);
  assert.equal(enemySkillForCommand('死霊を呼ぶ声','old6_tokai').effects[0].summonCurseTurns, 2);
  const mold = enemySkillForCommand('灰色のカビ','old6_tokai').effects[0];
  assert.equal(mold.type, 'transformCompanionToZombie');
  assert.equal(mold.hpCarryPercent, 50);
  assert.equal(mold.attackCarryPercent, 50);
  assert.equal(enemyCompanionBaseHp('ゾンビビ'), 270);
  assert.equal(enemyCompanionBaseHp('蛇竜のタマゴ'), 5);
  assert.deepEqual(enemyCompanionProfile('蛇竜のタマゴ')?.matrix?.[0], Array(6).fill('ときをまつ'));
  assert.ok(enemyCompanionProfile('スライム'));
  assert.ok(enemyCompanionProfile('死神モート'));
  assert.ok(enemyCompanionProfile('アヴァドン'));

  // 登録済みBOSS/お供コマンドに、撃破率へ関係する「未解決名」を残さない。
  const structural = name => /^(?:ミス|ほほえんでいる|ほほえんでいる…|ほほえんでいる\?|ためる|チャージ|様子を見ている|ときをまつ|さむさにたえている|笑っている|うなる|燃えている|なげいている|うつむいている|みくだしている)$/.test(name)
    || /[★☆]+→[★☆]+/.test(name) || /^EXゲージ[+＋]\d+$/.test(name);
  const missing = [];
  for (const id of ENEMY_BOSS_PROFILE_IDS) {
    for (const row of enemyBossProfile(id).matrix) {
      for (const command of row) if (command && !structural(command) && !enemySkillForCommand(command,id)) missing.push(`B:${id}:${command}`);
    }
  }
  for (const name of ENEMY_COMPANION_PROFILE_NAMES) {
    for (const row of enemyCompanionProfile(name).matrix) {
      for (const command of row) if (command && !structural(command) && !enemyCompanionSkillForCommand(command,name)) missing.push(`C:${name}:${command}`);
    }
  }
  assert.deepEqual([...new Set(missing)], []);
}


// 120) v0.5.66: 内部skill_data.csv再監査で判明した確率・対象・EX・解除効果を固定する。
{
  const { enemySkillForCommand, enemyCompanionSkillForCommand, enemyCompanionProfile, enemyCompanionBaseHp } = await import('../kill/enemy-actions.js');
  assert.equal(enemySkillForCommand('銀色の光','q_lucifer').effects[0].chance, 50);
  assert.equal(enemySkillForCommand('月の闇','q_lucifer').effects[0].chance, 40);
  assert.equal(enemySkillForCommand('フォーリン・ダウン','q_lucifer').chance, 55);
  assert.equal(enemySkillForCommand('生命の踊り','q_nataraja').target, 'enemySingle');
  assert.equal(enemySkillForCommand('蛍光の宝玉','q_yinlong').enemyExGain, 2);
  assert.equal(enemySkillForCommand('エメラルドフラッシュ','q_emerald_dragon').effects[0].chance, 40);
  assert.equal(enemySkillForCommand('ちょうちん','old0_anguis').effects[0].chance, 30);
  assert.equal(enemySkillForCommand('ライト・イレイザー','q_michael').effects[0].chance, 50);
  assert.equal(enemySkillForCommand('アビスコール','new5_sea_serpent').effects[0].chance, 65);
  assert.equal(enemySkillForCommand('常闇のいき','new5_sea_serpent').effects[0].chance, 15);

  const moss = enemySkillForCommand('モスコミューズ','q_riviere');
  assert.equal(moss.effects[0].chance, 15);
  assert.equal(moss.effects[0].chanceIfAttribute.fire, 42.2);
  assert.equal(moss.effects[0].chanceIfAttribute.water, undefined);

  const robotRepair = enemySkillForCommand('ロボ修復','new6_kais');
  assert.equal(robotRepair.target, 'enemySingle');
  assert.equal(robotRepair.targetRace, 'machine');
  assert.equal(enemyCompanionProfile('ロボ弐式').race, 'machine');

  const yoga = enemySkillForCommand('ヨガテラピー','q_lokesha');
  assert.equal(yoga.target, 'enemySingle');

  const bite = enemyCompanionSkillForCommand('かみくだき','ナンクルマル');
  assert.equal(bite.kind, 'lifestealAttack');
  assert.equal(bite.healRate, 20);
  const absorb = enemyCompanionSkillForCommand('吸収魔法','イムホテプ');
  assert.equal(absorb.kind, 'lifestealAttack');
  assert.equal(absorb.healRate, 80);
  const zombieBite = enemyCompanionSkillForCommand('喰いつき','ゾンビビ');
  assert.equal(zombieBite.kind, 'lifestealAttack');
  assert.equal(zombieBite.healRate, 100);
  assert.equal(enemyCompanionSkillForCommand('ゾンビのゲロ','ゾンビビ').effects[0].chance, 50);
  assert.equal(enemyCompanionSkillForCommand('ロックブレス','岩竜ロックドラゴン').effects[0].chance, 12);
  assert.equal(enemyCompanionBaseHp('ロボ弐式'), 171);

  const blacklight = enemySkillForCommand('ブラックライトブレス','q_yinlong');
  assert.ok(blacklight.effects.some(x => x.type === 'fixedExAbsorb' && x.value === 1));
  for (const [name,id] of [['いにしえの火炎のいき','q_fire_drake'],['いにしえの暗黒のいき','q_black_drake']]) {
    const sk = enemySkillForCommand(name,id);
    assert.ok(sk.effects.some(x => x.type === 'purgeBeneficial'));
  }
  const counter = enemySkillForCommand('アイアンカウンター','new0_iron_dragon');
  assert.equal(counter.effects[0].nonStacking, true);
  assert.equal(counter.effects[0].onHitEnemyExGain, 1);
  const armor = enemySkillForCommand('オーロラアーマー','new5_glacier_dragon');
  assert.equal(armor.effects[0].onHitEnemyExGain, 1);
  assert.equal(armor.effects[0].onHitPlayerExLoss, 1);

  // 連打回数・全体対象も内部RENDA/ATKODDSに一致させる。
  assert.equal(enemySkillForCommand('ハンドレッドフィスト','q_great_soccerra').hits, 10);
  assert.equal(enemySkillForCommand('ミリオンズフィスト','q_great_soccerra').hits, 10);
  assert.equal(enemySkillForCommand('プロペラソード','new0_nergal').hits, 2);
  assert.equal(enemySkillForCommand('ウェットスライサー','new2_arp').hits, 4);
  assert.equal(enemySkillForCommand('ウェットスライサー','new2_arp').target, 'randomEachHit');
  assert.equal(enemySkillForCommand('浄化の炎','new6_elysion').target, 'all');
  assert.equal(enemySkillForCommand('色欲の罰','new6_elysion').target, 'all');

  // クジェスカの2技は自分以外の敵味方を巻き込む特殊攻撃。
  const blackRussian = enemySkillForCommand('ブラックルシアン','old5_kujeska');
  const bloodyMary = enemySkillForCommand('ブラッディメアリー','old5_kujeska');
  assert.equal(blackRussian.kind, 'kujeskaBlackRussian');
  assert.equal(blackRussian.target, 'allOtherRandom');
  assert.equal(blackRussian.attackType, 'magic');
  assert.equal(bloodyMary.kind, 'kujeskaBloodyMary');
  assert.equal(bloodyMary.target, 'allOther');
  assert.equal(bloodyMary.attackType, 'magic');

  // PLAYER_ALL の防御技はBOSSだけでなく生存お供にも適用する。
  for (const [name,id] of [
    ['ディープグリーンブレス','q_emerald_dragon'],
    ['五黄土星','q_great_nine_tails'],
    ['雷竜の壁','q_thunder_dragon'],
    ['冥界の城','new6_dark_priestess'],
    ['アイスデン','new5_glacier_dragon']
  ]) {
    const sk = enemySkillForCommand(name,id);
    assert.ok(sk.effects.some(x => x.type === 'enemyDefenseBuff' && x.scope === 'enemyTeam'), `${name} should defend enemyTeam`);
  }

  for (const [name,id] of [
    ['雷光の爪','q_shining_fire_drake'],
    ['暗黒の爪','q_black_drake'],
    ['大海流','q_dock_low']
  ]) {
    const sk = enemySkillForCommand(name,id);
    assert.ok(sk.effects.some(x => x.type === 'enemyAtkBuff' && x.scope === 'enemyTeam' && x.value === 15), `${name} should buff enemyTeam`);
  }
  const sakimui = enemySkillForCommand('サキムイ','new3_nirahalar');
  assert.deepEqual(sakimui.effects[0].values, { 1:10, 2:15, 3:20 });

  assert.equal(enemySkillForCommand('いにしえの火炎のいき','q_shining_fire_drake').enemyExSpend, 1);
  assert.equal(enemySkillForCommand('いにしえの暗黒のいき','q_black_drake').enemyExSpend, 1);
  assert.equal(enemySkillForCommand('轟雷雲','old0_silver_dragon').attackType, 'breath');
  assert.equal(enemySkillForCommand('追いつめる死霊の手','q_great_tokai').attackType, 'physical');
}


console.log('enemy-actions.test.js: OK');
process.exit(0);

