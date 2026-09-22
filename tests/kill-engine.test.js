import assert from 'node:assert/strict';
import { attackDamageDistribution, cloneDefaultState, simulateKillProbability, stealExAmount, stealExTransfer, playerExGainFromEnemyAttack } from '../kill/engine.js';
import { SKILL_PRESETS, SKILL_PRESET_BY_ID } from '../kill/presets.js';
import { normalActivationTransitions, transformActivationTransitions, transformTargetActivationTransitions, normalCommandTransitions, transformTargetCommandTransitions, TRANSFORM_PROFILE_BY_SKILL } from '../kill/commands.js';

function approx(actual, expected, eps = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= eps, `expected ${expected}, got ${actual}`);
}

// 1) 十分低いHPなら1発で確定撃破。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy.maxHp = '10';
  s.turns[0].allyActions[0] = { kind: 'attack', skillMultiplier: '100', attackAttribute: 'none', hits: '1', effects: [] };
  s.turns[0].enemyAction.enabled = false;
  const r = simulateKillProbability(s);
  approx(r.killChance, 1);
}

// 2) 敵行動OFFでも毒は敵の行動タイミングで発生する。
// キャラ1が猛毒を付与、敵が同ターン中に行動タイミングを迎え、20%減る。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy.maxHp = '1000';
  s.enemy.speed = '50';
  s.allies[0].attack = '0';
  s.allies[0].speed = '100';
  s.turns[0].allyActions[0] = {
    kind: 'buff', skillMultiplier: '200', attackAttribute: 'none', hits: '1',
    effects: [{ type: 'deadlyPoison' }]
  };
  s.turns[0].enemyAction.enabled = false;
  // 最終ターンは味方最終行動で止まるので、毒タイミングを含めるため2ターンにする。
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].allyActions[0] = { kind: 'skip', skillMultiplier: '200', attackAttribute: 'none', hits: '1', effects: [] };
  const r = simulateKillProbability(s);
  const poisonEvent = r.timeline.find(x => x.kind === 'poison');
  assert.ok(poisonEvent);
  assert.equal(poisonEvent.minLiveHp, 800);
  assert.equal(poisonEvent.maxLiveHp, 800);
}

// 3) 同速では味方が敵より先。味方同士は番号順。
{
  const s = cloneDefaultState();
  s.enemy.speed = '100';
  s.allies[0].speed = '100';
  s.allies[1].speed = '100';
  s.allies[2].speed = '100';
  const r = simulateKillProbability(s);
  assert.deepEqual(r.finalOrder.map(x => x.side === 'enemy' ? 'E' : `A${x.index + 1}`), ['A1','A2','A3','E']);
}

// 4) 最終ターンでは最後の味方行動後に敵が遅ければ、敵毒タイミングは含めない。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy.maxHp = '100';
  s.enemy.speed = '10';
  s.allies[0].speed = '100';
  s.turns[0].allyActions[0] = { kind: 'buff', skillMultiplier: '200', attackAttribute: 'none', hits: '1', effects: [{ type: 'deadlyPoison' }] };
  s.turns[0].enemyAction.enabled = false;
  const r = simulateKillProbability(s);
  assert.equal(r.timeline.some(x => x.kind === 'poison'), false);
}

console.log('kill-engine tests: OK');

// 5) v0.4.0 のデフォルト値。
{
  const s = cloneDefaultState();
  assert.equal(s.enemy.maxHp, '1500');
  assert.equal(s.enemy.attribute, 'fire');
  assert.equal(s.enemy.speed, '45');
  assert.deepEqual(s.allies, [
    { characterId: 'son_goku', attack: '84', speed: '78', star: '4', attribute: 'wind', race: 'normal', commandVariant: '' },
    { characterId: 'gyumao', attack: '94', speed: '15', star: '4', attribute: 'fire', race: 'normal', commandVariant: '' },
    { characterId: '', attack: '0', speed: '0', star: '', attribute: '', race: 'normal', commandVariant: '' }
  ]);
  assert.equal(s.turns[0].allyActions[0].skillName, 'ロキブランド');
  assert.equal(s.turns[0].allyActions[0].buff.value, '150');
  assert.equal(s.turns[0].allyActions[1].skillName, '鬼の気合入れ');
  assert.equal(s.turns[0].allyActions[1].buff.value, '200');
}

// 6) 基本行動「バフ」の主効果が次ターンの攻撃に反映される。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy.maxHp = '159';
  s.enemy.speed = '10';
  s.allies[0].attack = '84';
  s.allies[0].speed = '100';
  s.turns[0].allyActions[0] = {
    kind: 'buff', skillMultiplier: '200', attackAttribute: 'none', hits: '1',
    buff: { type: 'atkBuff', target: 'self', mode: 'mult', value: '200', duration: '2' },
    effects: []
  };
  s.turns[0].enemyAction.enabled = false;
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].allyActions[0] = {
    kind: 'attack', skillMultiplier: '100', attackAttribute: 'none', hits: '1',
    buff: { type: 'atkBuff', target: 'self', mode: 'mult', value: '150', duration: '1' },
    effects: []
  };
  const r = simulateKillProbability(s);
  approx(r.killChance, 1);
}

// 7) 「同行動」は前回の同モンスターの具体的な行動を再利用する。
{
  const base = cloneDefaultState();
  base.allyCount = 1;
  base.enemy.maxHp = '250';
  base.enemy.speed = '10';
  base.allies[0].attack = '84';
  base.allies[0].speed = '100';
  base.turns[0].allyActions[0] = {
    kind: 'attack', skillMultiplier: '150', attackAttribute: 'none', hits: '1',
    buff: { type: 'atkBuff', target: 'self', mode: 'mult', value: '150', duration: '1' },
    effects: []
  };
  base.turns[0].enemyAction.enabled = false;
  base.turns.push(JSON.parse(JSON.stringify(base.turns[0])));

  const explicit = JSON.parse(JSON.stringify(base));
  const same = JSON.parse(JSON.stringify(base));
  same.turns[1].allyActions[0].kind = 'same';

  const a = simulateKillProbability(explicit);
  const b = simulateKillProbability(same);
  approx(a.killChance, b.killChance);
  assert.deepEqual([...a.hpDistribution.entries()], [...b.hpDistribution.entries()]);
}


// 8) 敵の防御アップは被ダメージ倍率として攻撃ダメージを減らす。
{
  const base = cloneDefaultState();
  base.allyCount = 1;
  base.enemy.maxHp = '90';
  base.enemy.speed = '100';
  base.allies[0].attack = '100';
  base.allies[0].speed = '10';
  base.turns[0].enemyAction = { enabled: true, effect: { type: 'enemyDefenseBuff', mode: 'mult', value: '50', duration: '1' } };
  base.turns[0].allyActions[0] = { kind: 'attack', skillMultiplier: '100', attackAttribute: 'none', hits: '1', effects: [] };
  const r = simulateKillProbability(base);
  approx(r.killChance, 0);
}

// 9) アンデッド補正：物理0.8、魔法1.2、それ以外1.0。
{
  const base = {
    attack: 100, skillMultiplier: 100, attackAttribute: 'none', attackAttribute2: 'none',
    defenderAttribute: 'fire', defenderRace: 'undead', defenseMods: [], hits: 1
  };
  const phys = attackDamageDistribution({ ...base, attackType: 'physical' });
  const magic = attackDamageDistribution({ ...base, attackType: 'magic' });
  const other = attackDamageDistribution({ ...base, attackType: 'other' });
  assert.equal(Math.min(...phys.keys()), 76);
  assert.equal(Math.max(...phys.keys()), 84);
  assert.equal(Math.min(...magic.keys()), 114);
  assert.equal(Math.max(...magic.keys()), 126);
  assert.equal(Math.min(...other.keys()), 95);
  assert.equal(Math.max(...other.keys()), 105);
}

// 10) 倍率レンジ・ヒット数レンジの確率合計は1になる。
{
  const dist = attackDamageDistribution({
    attack: 100,
    skillMultiplier: 80,
    skillMultiplierMin: 70,
    skillMultiplierMax: 90,
    skillMultiplierStep: 0.1,
    attackAttribute: 'wind',
    attackAttribute2: 'none',
    attackType: 'magic',
    defenderAttribute: 'fire',
    defenderRace: 'normal',
    defenseMods: [],
    hits: 3,
    hitsMin: 3,
    hitsMax: 5
  });
  approx([...dist.values()].reduce((a, b) => a + b, 0), 1, 1e-9);
}


// 11) 足ばらい・マーキングアローの防御ダウン定義をプリセットが保持する。
{
  const foot = SKILL_PRESET_BY_ID.get('foot_sweep');
  assert.equal(foot.attackType, 'physical');
  assert.deepEqual(foot.effects[0], {
    type: 'defenseDown', mode: 'mult', value: '20', duration: '99', expiry: 'sourceNextActionStart'
  });
  const marking = SKILL_PRESET_BY_ID.get('marking_arrow');
  assert.equal(marking.attackType, 'physical');
  assert.deepEqual(marking.effects[0], {
    type: 'defenseDown', mode: 'mult', value: '40', duration: '99', expiry: 'sourceNextActionEnd'
  });
}


// 12) バトル入手チャート由来の主要技に加え、モンスタープリセット由来の補助技も選択可能にする。
// モンスタープリセット由来の技は「その他」にまとめる。
{
  const majorIds = new Set(SKILL_PRESETS.filter(x => x.major === true).map(x => x.id));
  for (const id of [
    'loki_brand', 'oni_spirit', 'sea_king_gaze', 'spirit_blessing', 'growl', 'sun_hymn', 'item_parts',
    'sword_dance', 'name_announcement', 'fire2', 'fire3', 'aqua2', 'aqua3', 'wind2',
    'marking_arrow', 'self_destruct', 'bubble_grand', 'rengeki', 'windmill',
    'heat_wave', 'ice_storm_strike',
    'red_fire_breath', 'blue_aqua_breath', 'yellow_earth_breath', 'green_air_breath',
    'red_point_2', 'blue_point_2', 'yellow_point_2', 'green_point_2',
    // ユーザー指定の追加枠
    'epidemic_glass', 'poison_bite', 'melting_breath', 'suck_dry',
    // モンスタープリセット由来の「その他」
    'foot_sweep', 'attack_bang', 'dragon_tail', 'aqua_breath', 'shining_breath',
    'fire1', 'ice1', 'thunder1', 'meteor', 'purifying_flame', 'shiden', 'critical_hit', 'shibire_giri'
  ]) assert.ok(majorIds.has(id), `${id} should be selectable`);

  assert.equal(majorIds.has('ninja_thunder'), false, 'removed ninja_thunder must stay unavailable');
}


// 12b) ユーザー指定で復帰した追加主要技の内容を保持する。
{
  const suck = SKILL_PRESET_BY_ID.get('suck_dry');
  assert.equal(suck.major, true);
  assert.equal(suck.kind, 'buff');
  assert.deepEqual(suck.buff, { type: 'atkBuff', target: 'self', mode: 'add', value: '15', duration: '3' });

  const loki = SKILL_PRESET_BY_ID.get('loki_brand');
  assert.deepEqual(loki.buff, { type: 'atkBuff', target: 'star4', mode: 'mult', value: '150', duration: '2' });
  const gaze = SKILL_PRESET_BY_ID.get('sea_king_gaze');
  assert.deepEqual(gaze.buff, { type: 'atkBuff', target: 'self', mode: 'add', value: '30', duration: '99' });

  const bite = SKILL_PRESET_BY_ID.get('poison_bite');
  assert.deepEqual([bite.skillMultiplier, bite.attackAttribute, bite.attackType], ['140', 'poison', 'physical']);
  assert.deepEqual(bite.effects, [{ type: 'poison' }]);

  const melt = SKILL_PRESET_BY_ID.get('melting_breath');
  assert.deepEqual([melt.skillMultiplier, melt.deadlyPoisonSkillMultiplier, melt.attackType], ['60', '120', 'other']);
  assert.deepEqual(melt.effects, [{ type: 'poisonToDeadly' }]);
}

// 13) ファイア!! / アクア!! だけは例外として !!! 版も主要技に持つ。
{
  const fire2 = SKILL_PRESET_BY_ID.get('fire2');
  const fire3 = SKILL_PRESET_BY_ID.get('fire3');
  const aqua2 = SKILL_PRESET_BY_ID.get('aqua2');
  const aqua3 = SKILL_PRESET_BY_ID.get('aqua3');
  const wind2 = SKILL_PRESET_BY_ID.get('wind2');
  assert.deepEqual([fire2.skillName, fire2.skillMultiplier, fire2.attackType], ['ファイア!!', '150', 'magic']);
  assert.deepEqual([fire3.skillName, fire3.skillMultiplier, fire3.attackType], ['ファイア!!!', '200', 'magic']);
  assert.deepEqual([aqua2.skillName, aqua2.skillMultiplier, aqua2.attackType], ['アクア!!', '150', 'magic']);
  assert.deepEqual([aqua3.skillName, aqua3.skillMultiplier, aqua3.attackType], ['アクア!!!', '200', 'magic']);
  assert.deepEqual([wind2.skillName, wind2.skillMultiplier, wind2.attackType], ['ウィンド!!', '150', 'magic']);
  assert.equal(SKILL_PRESETS.some(x => x.skillName === 'ウィンド!!!' && x.major === true), false);
}

// 14) どくつぶしは敵がすでに毒・猛毒なら技倍率105%を使う。
{
  const poisonCrush = SKILL_PRESET_BY_ID.get('poison_crush');
  assert.equal(poisonCrush.skillMultiplier, '80');
  assert.equal(poisonCrush.poisonedSkillMultiplier, '105');
}


// 15) 攻撃力バフはダメージ計算と同じ表記。乗算150%=×1.5、加算+30=ATK+30。
{
  const mult = cloneDefaultState();
  mult.allyCount = 1;
  mult.enemy.maxHp = '145';
  mult.enemy.speed = '10';
  mult.allies[0].attack = '100';
  mult.allies[0].speed = '100';
  mult.turns[0].allyActions[0] = {
    kind: 'buff', skillMultiplier: '100', attackAttribute: 'none', hits: '1',
    buff: { type: 'atkBuff', target: ['ally1'], mode: 'mult', value: '150', duration: '2' }, effects: []
  };
  mult.turns[0].enemyAction.enabled = false;
  mult.turns.push(JSON.parse(JSON.stringify(mult.turns[0])));
  mult.turns[1].allyActions[0] = { kind: 'attack', skillMultiplier: '100', attackAttribute: 'none', hits: '1', effects: [] };
  const multResult = simulateKillProbability(mult);
  assert.ok(multResult.killChance > 0);

  const add = cloneDefaultState();
  add.allyCount = 1;
  add.enemy.maxHp = '125';
  add.enemy.speed = '10';
  add.allies[0].attack = '100';
  add.allies[0].speed = '100';
  add.turns[0].allyActions[0] = {
    kind: 'buff', skillMultiplier: '100', attackAttribute: 'none', hits: '1',
    buff: { type: 'atkBuff', target: ['ally1'], mode: 'add', value: '30', duration: '2' }, effects: []
  };
  add.turns[0].enemyAction.enabled = false;
  add.turns.push(JSON.parse(JSON.stringify(add.turns[0])));
  add.turns[1].allyActions[0] = { kind: 'attack', skillMultiplier: '100', attackAttribute: 'none', hits: '1', effects: [] };
  const addResult = simulateKillProbability(add);
  assert.ok(addResult.killChance > 0);
}

// 16) バフ対象は配列で複数指定できる。
{
  const s = cloneDefaultState();
  s.allyCount = 2;
  s.enemy.maxHp = '180';
  s.enemy.speed = '10';
  s.allies[0].attack = '1'; s.allies[0].speed = '100';
  s.allies[1].attack = '100'; s.allies[1].speed = '90';
  s.turns[0].allyActions[0] = { kind: 'buff', buff: { type: 'atkBuff', target: ['ally1','ally2'], mode: 'mult', value: '200', duration: '2' }, effects: [] };
  s.turns[0].allyActions[1] = { kind: 'skip', effects: [] };
  s.turns[0].enemyAction.enabled = false;
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].allyActions[0] = { kind: 'skip', effects: [] };
  s.turns[1].allyActions[1] = { kind: 'attack', skillMultiplier: '100', attackAttribute: 'none', hits: '1', effects: [] };
  const r = simulateKillProbability(s);
  assert.ok(r.killChance > 0);
}


// 17) 攻撃力バフ1ターンは、付与ターン終了時に消えず次ターンの攻撃へ反映される。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy.maxHp = '200';
  s.enemy.speed = '10';
  s.allies[0].attack = '100';
  s.allies[0].speed = '100';
  s.turns[0].allyActions[0] = {
    kind: 'buff',
    buff: { type: 'atkBuff', target: 'self', mode: 'mult', value: '200', duration: '1' },
    effects: []
  };
  s.turns[0].enemyAction.enabled = false;
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].allyActions[0] = {
    kind: 'attack', skillMultiplier: '100', attackAttribute: 'none', attackAttribute2: 'none',
    attackType: 'physical', hits: '1', effects: []
  };
  const r = simulateKillProbability(s);
  // ATK200、100%技の最低乱数は190。敵HP200なので+5%以上の一部だけ撃破。
  assert.ok(r.killChance > 0 && r.killChance < 1);
  const attackEvent = r.timeline.find(x => x.kind === 'attack' && x.turn === 2);
  assert.equal(attackEvent.maxLiveHp, 10);
}

// 18) 技倍率→第1属性→第2属性→アンデッド補正→乱数の順で整数化する。
{
  const dist = attackDamageDistribution({
    attack: 101,
    skillMultiplier: '100',
    attackAttribute: 'fire',
    attackAttribute2: 'light',
    attackType: 'magic',
    defenderAttribute: 'water',
    defenderRace: 'undead',
    defenseMods: [],
    weaknessBoost: false,
    hits: '1', hitsMin: '', hitsMax: ''
  });
  const damages = [...dist.keys()];
  // 101 -> 火弱点151 -> 光1.05で158 -> アンデッド魔法1.2で189 -> 95%=179, 105%=198
  assert.equal(Math.min(...damages), 179);
  assert.equal(Math.max(...damages), 198);
}

// 19) 小数技倍率も浮動小数誤差で1下がらない。
{
  const dist = attackDamageDistribution({
    attack: 125,
    skillMultiplier: '258.4',
    attackAttribute: 'none',
    attackAttribute2: 'none',
    attackType: 'physical',
    defenderAttribute: 'fire',
    defenderRace: 'normal',
    defenseMods: [],
    weaknessBoost: false,
    hits: '1', hitsMin: '', hitsMax: ''
  });
  // 125×258.4%=323 exactly before variance.
  // 乱数0%（係数1000）は101通りの中央に存在するため323ダメージが分布に含まれる。
  assert.ok(dist.has(323));
}

// 20) 防御ダウン20は乱数後のダメージを1.2倍する。
{
  const dist = attackDamageDistribution({
    attack: 100,
    skillMultiplier: '100',
    attackAttribute: 'none',
    attackAttribute2: 'none',
    attackType: 'physical',
    defenderAttribute: 'fire',
    defenderRace: 'normal',
    defenseMods: [{ mode: 'mult', value: 120, seq: 1 }],
    weaknessBoost: false,
    hits: '1', hitsMin: '', hitsMax: ''
  });
  const damages = [...dist.keys()];
  assert.equal(Math.min(...damages), 114);
  assert.equal(Math.max(...damages), 126);
}

// 21) 弱点属性強化は1.5→1.9、1.4→1.8として属性段階で適用する。
{
  const fireWeak = attackDamageDistribution({
    attack: 100, skillMultiplier: '100', attackAttribute: 'fire', attackAttribute2: 'none',
    attackType: 'physical', defenderAttribute: 'water', defenderRace: 'normal', defenseMods: [],
    weaknessBoost: true, hits: '1', hitsMin: '', hitsMax: ''
  });
  const heatWeak = attackDamageDistribution({
    attack: 100, skillMultiplier: '100', attackAttribute: 'heat', attackAttribute2: 'none',
    attackType: 'physical', defenderAttribute: 'wind', defenderRace: 'normal', defenseMods: [],
    weaknessBoost: true, hits: '1', hitsMin: '', hitsMax: ''
  });
  assert.equal(Math.min(...fireWeak.keys()), 180); // floor(190×0.95)
  assert.equal(Math.min(...heatWeak.keys()), 171); // floor(180×0.95)
}


// 22) 「その他」カテゴリには悪疫グラスとモンスタープリセット由来の補助技を表示する。
{
  const others = SKILL_PRESETS.filter(x => x.major === true && x.majorGroup === 'other');
  assert.deepEqual(others.map(x => x.id), [
    'epidemic_glass',
    'foot_sweep', 'shibire_giri', 'attack_bang', 'dragon_tail',
    'aqua_breath', 'shining_breath', 'fire1', 'ice1', 'thunder1', 'meteor',
    'purifying_flame', 'shiden', 'critical_hit', 'princess_cheer', 'queen_reward'
  ]);
}

// 23) ポイントは2EX相当の250%だけを残し、表示名からEX表記を外す。
{
  for (const [id, name, attr] of [
    ['red_point_2','レッドポイント','fire'],
    ['blue_point_2','ブルーポイント','water'],
    ['yellow_point_2','イエローポイント','earth'],
    ['green_point_2','グリーンポイント','wind']
  ]) {
    const p = SKILL_PRESET_BY_ID.get(id);
    assert.deepEqual([p.skillName, p.skillMultiplier, p.attackAttribute], [name, '250', attr]);
  }
  for (const id of ['red_point_0','red_point_1','blue_point_0','blue_point_1','yellow_point_0','yellow_point_1','green_point_0','green_point_1']) {
    assert.equal(SKILL_PRESET_BY_ID.has(id), false);
  }
}

// 24) 冥界竜ダークバハムートの4属性ブレスを個別保持し、特効時150%→属性補正込み225%になる。
{
  const breath = SKILL_PRESET_BY_ID.get('red_fire_breath');
  assert.deepEqual(
    [breath.skillMultiplier, breath.attackAttribute, breath.attackType, breath.weakDefenderAttribute, breath.weakSkillMultiplier],
    ['90','fire','other','water','150']
  );
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy.attribute = 'water';
  s.enemy.maxHp = '230';
  s.enemy.speed = '10';
  s.allies[0].attack = '100';
  s.allies[0].speed = '100';
  s.turns[0].allyActions[0] = {
    kind: 'attack', skillMultiplier: breath.skillMultiplier, attackAttribute: breath.attackAttribute,
    attackAttribute2: 'none', attackType: breath.attackType, hits: '1', effects: [],
    weakDefenderAttribute: breath.weakDefenderAttribute, weakSkillMultiplier: breath.weakSkillMultiplier
  };
  s.turns[0].enemyAction.enabled = false;
  const r = simulateKillProbability(s);
  // 100×150%=150 → 火→水1.5=225 → 乱数213～236。
  assert.ok(r.killChance > 0 && r.killChance < 1);
}

// 25) キャプテン・アズール用のシビレ斬りは毒属性100%物理。
{
  const p = SKILL_PRESET_BY_ID.get('shibire_giri');
  assert.deepEqual([p.skillMultiplier, p.attackAttribute, p.attackType], ['100','poison','physical']);
}


// 26) ロキブランドは全員、太陽讃歌は1/2がデフォルト対象。
{
  const loki = SKILL_PRESET_BY_ID.get('loki_brand');
  const sun = SKILL_PRESET_BY_ID.get('sun_hymn');
  assert.equal(loki.buff.target, 'star4');
  assert.equal(sun.buff.target, 'fireAllies');
}

// 27) アイテムパーツは自身の攻撃+25・素早さ+60を3ターン付与する。
{
  const p = SKILL_PRESET_BY_ID.get('item_parts');
  assert.equal(p.major, true);
  assert.deepEqual(p.buff, { type: 'atkBuff', target: 'self', mode: 'add', value: '25', duration: '3' });
  assert.deepEqual(p.effects, [{ type: 'speedBuff', target: 'self', mode: 'add', value: '60', duration: '3' }]);
}

// 28) 風車はATK×0.6+SPD×0.15の1発威力、SPD20ごとにヒット数増加（最大10）。
{
  const p = SKILL_PRESET_BY_ID.get('windmill');
  assert.deepEqual([p.damageFormula, p.attackAttribute, p.attackType], ['windmill', 'wind', 'physical']);
  const dist = attackDamageDistribution({
    attack: 57, speed: 84, skillMultiplier: '100', damageFormula: 'windmill',
    attackAttribute: 'wind', attackAttribute2: 'none', attackType: 'physical',
    defenderAttribute: 'fire', defenderRace: 'normal', defenseMods: [], weaknessBoost: false,
    hits: '1', hitsMin: '', hitsMax: ''
  });
  // floor(57×0.6 + 84×0.15)=46 → 風弱点×1.5=69 → 1発65～72、SPD84で4ヒット。
  assert.equal(Math.min(...dist.keys()), 260);
  assert.equal(Math.max(...dist.keys()), 288);

  const capped = attackDamageDistribution({
    attack: 100, speed: 999, skillMultiplier: '100', damageFormula: 'windmill',
    attackAttribute: 'none', attackAttribute2: 'none', attackType: 'physical',
    defenderAttribute: 'fire', defenderRace: 'normal', defenseMods: [], weaknessBoost: false,
    hits: '1', hitsMin: '', hitsMax: ''
  });
  // 10ヒット上限。1発の最低はfloor(floor(100×0.6+999×0.15)×0.95)=198。
  assert.equal(Math.min(...capped.keys()), 1980);
}

// 29) アイテムパーツ後の風車は攻撃・素早さの両方の上昇を参照する。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy.attribute = 'fire';
  s.enemy.maxHp = '500';
  s.enemy.speed = '10';
  s.allies[0].attack = '57';
  s.allies[0].speed = '84';
  s.turns[0].allyActions[0] = {
    kind: 'buff',
    buff: { type: 'atkBuff', target: 'self', mode: 'add', value: '25', duration: '3' },
    effects: [{ type: 'speedBuff', target: 'self', mode: 'add', value: '60', duration: '3' }]
  };
  s.turns[0].enemyAction.enabled = false;
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].allyActions[0] = {
    kind: 'attack', skillMultiplier: '100', damageFormula: 'windmill',
    attackAttribute: 'wind', attackAttribute2: 'none', attackType: 'physical',
    hits: '1', hitsMin: '', hitsMax: '', effects: []
  };
  const r = simulateKillProbability(s);
  // ATK82・SPD144 -> 1発 floor(49.2+21.6)=70、風弱点105、7ヒット。最低各99で693なので500は確定撃破。
  approx(r.killChance, 1);
}


// 追加) ロキブランドは★4だけを自動対象にする。
{
  const make = star => {
    const s = cloneDefaultState();
    s.allyCount = 2;
    s.enemy.maxHp = '140';
    s.enemy.speed = '1';
    s.allies[0] = { characterId: '', attack: '0', speed: '100', star: '4', attribute: 'wind' };
    s.allies[1] = { characterId: '', attack: '100', speed: '50', star, attribute: 'water' };
    s.turns[0].allyActions[0] = {
      kind: 'buff',
      buff: { type: 'atkBuff', target: 'star4', mode: 'mult', value: '150', duration: '2' },
      effects: []
    };
    s.turns[0].allyActions[1] = { kind: 'skip', effects: [] };
    s.turns[0].enemyAction.enabled = false;
    s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
    s.turns[1].allyActions[0] = { kind: 'skip', effects: [] };
    s.turns[1].allyActions[1] = { kind: 'attack', skillMultiplier: '100', attackAttribute: 'none', hits: '1', effects: [] };
    return simulateKillProbability(s);
  };
  approx(make('4').killChance, 1);
  approx(make('3').killChance, 0);
}

// 追加) 太陽讃歌は火属性だけを自動対象にする。
{
  const make = attribute => {
    const s = cloneDefaultState();
    s.allyCount = 2;
    s.enemy.maxHp = '140';
    s.enemy.speed = '1';
    s.allies[0] = { characterId: '', attack: '0', speed: '100', star: '4', attribute: 'wind' };
    s.allies[1] = { characterId: '', attack: '100', speed: '50', star: '3', attribute };
    s.turns[0].allyActions[0] = {
      kind: 'buff',
      buff: { type: 'atkBuff', target: 'fireAllies', mode: 'add', value: '50', duration: '2' },
      effects: []
    };
    s.turns[0].allyActions[1] = { kind: 'skip', effects: [] };
    s.turns[0].enemyAction.enabled = false;
    s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
    s.turns[1].allyActions[0] = { kind: 'skip', effects: [] };
    s.turns[1].allyActions[1] = { kind: 'attack', skillMultiplier: '100', attackAttribute: 'none', hits: '1', effects: [] };
    return simulateKillProbability(s);
  };
  approx(make('fire').killChance, 1);
  approx(make('water').killChance, 0);
}

// 24) ケロゴン(緑)は「竜のしっぽ」6個で確定発動する。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.allies[0] = { characterId: 'kerogon_green', attack: '100', speed: '100', star: '1', attribute: 'wind' };
  s.enemy.maxHp = '80';
  s.enemy.speed = '1';
  const p = SKILL_PRESET_BY_ID.get('dragon_tail');
  s.turns[0].allyActions[0] = { ...p, skillPresetId: 'dragon_tail' };
  s.turns[0].enemyAction.enabled = false;
  const r = simulateKillProbability(s);
  approx(r.killChance, 1, 1e-12);
}

// 25) 赤のエンプレス「女王のごほうび」は対象を3リール上げ、発動率も含める。
{
  const s = cloneDefaultState();
  s.allyCount = 2;
  s.allies[0] = { characterId: 'red_empress', attack: '63', speed: '100', star: '4', attribute: 'water' };
  s.allies[1] = { characterId: 'clear_blue_dragon', attack: '100', speed: '90', star: '4', attribute: 'water' };
  s.enemy.maxHp = '1';
  s.enemy.speed = '1';
  s.turns[0].allyActions[0] = { ...SKILL_PRESET_BY_ID.get('queen_reward'), skillPresetId: 'queen_reward', presetTarget: 'ally2' };
  s.turns[0].allyActions[1] = { ...SKILL_PRESET_BY_ID.get('aqua_breath'), skillPresetId: 'aqua_breath' };
  s.turns[0].enemyAction.enabled = false;
  const r = simulateKillProbability(s);
  // v0.5.11ではルーレットで止まった全コマンドを実行する。
  // アクアブレス以外のクリアアクアブレスもダメージになるため、HP1は全枝で撃破。
  approx(r.killChance, 1, 1e-12);
}


// 25b) 赤のエンプレスのコマンド型は通常編成時だけ切り替わる。
{
  const rate = (variant, skillName, startReel) => normalActivationTransitions('red_empress', skillName, startReel, variant)
    .filter(x => x.activated)
    .reduce((a, x) => a + x.probability, 0);

  // ①従来型は3・4リールとも女王のごほうび×6。
  approx(rate('support', '女王のごほうび', 2), 1);
  approx(rate('support', '女王のごほうび', 3), 1);

  // ② 3R 会心×5＋こうげき！×1、4R 会心×6。
  approx(rate('critical5', '会心の一撃', 2), 5 / 6);
  approx(rate('critical5', 'こうげき！', 2), 1 / 6);
  approx(rate('critical5', '会心の一撃', 3), 1);

  // ③ 3R 会心×4＋こうげき！×2、4R 会心×6。
  approx(rate('critical4', '会心の一撃', 2), 4 / 6);
  approx(rate('critical4', 'こうげき！', 2), 2 / 6);
  approx(rate('critical4', '会心の一撃', 3), 1);

  // 変化先用は通常編成の commandVariant と無関係で、従来型のまま。
  const transformReward = transformTargetActivationTransitions('queen_reward', '女王のごほうび', 2)
    .filter(x => x.activated)
    .reduce((a, x) => a + x.probability, 0);
  approx(transformReward, 1);
}

// 26) Google Drive画像から読み取ったコマンド型を発動率へ反映する。
{
  const activationRate = (characterId, skillName, startReel = 0) =>
    normalActivationTransitions(characterId, skillName, startReel)
      .filter(x => x.activated)
      .reduce((a, x) => a + x.probability, 0);

  approx(activationRate('sylph', 'こうげき！'), 1);
  approx(activationRate('crow', 'こうげき！'), 1);
  approx(activationRate('mermaid_mellow', 'シャボン・グラン'), 5 / 6);
  approx(activationRate('soccerra', 'こうげき！'), 1 / 6);
  approx(activationRate('kerogon_gold', '竜のしっぽ'), 4 / 6);
  approx(activationRate('ifrit', 'ファイア!!'), 5 / 6);
  approx(activationRate('damkina', 'ウィンド!!'), 5 / 6);
  approx(activationRate('dartan', '連撃'), 1);
  approx(activationRate('marduk', '会心の一撃'), 25 / 36);
  approx(activationRate('heavy_behemoth', 'おしつぶし'), 31 / 36);
  approx(activationRate('gate_dante', 'こうげき！', 0), 1 / 6);
  approx(activationRate('gate_dante', 'こうげき！', 3), 0);
  approx(activationRate('yamato', 'こうげき！', 0), 5 / 6);
  approx(activationRate('yamato', 'こうげき！', 3), 2 / 6);
  approx(activationRate('susanoo', 'こうげき！', 0), 5 / 6);
  approx(activationRate('susanoo', 'こうげき！', 3), 1 / 6);
  approx(activationRate('ginger_ale', 'こうげき！', 0), 4 / 6);
  approx(activationRate('ginger_ale', 'こうげき！', 3), 0);
  approx(activationRate('fire_drake', 'こうげき！', 0), 3 / 6);
  approx(activationRate('fire_drake', 'こうげき！', 1), 4 / 6);
  approx(activationRate('fire_drake', 'こうげき！', 2), 0);

  // 邪神サッカーラは1リール目から必ず2リール目へ移動し、
  // 2リール目でこうげき！を外すと★★→★★★★で4リール目へ直接移る。
  const soccerra = normalActivationTransitions('soccerra', 'こうげき！', 0);
  approx(soccerra.find(x => x.activated)?.probability ?? 0, 1 / 6);
  approx(soccerra.find(x => !x.activated && x.nextReel === 3)?.probability ?? 0, 5 / 6);
}

// 27) キャミネコは敵属性で選ばれた技ごとに別の所持個体画像を使う。
{
  const rate = skillName => normalActivationTransitions('camineko', skillName, 0)
    .filter(x => x.activated).reduce((a, x) => a + x.probability, 0);
  approx(rate('ファイア！'), 1);
  approx(rate('アイス！'), 1);
  approx(rate('サンダー！'), 1);
}

// 28) ソンゴクウ／牛魔王は変化モード側の固定リールを通す。
{
  const monkey = transformActivationTransitions('猿', 'loki_brand', 'ロキブランド', 0)
    .filter(x => x.activated).reduce((a, x) => a + x.probability, 0);
  const ox = transformActivationTransitions('牛', 'oni_spirit', '鬼の気合入れ', 0)
    .filter(x => x.activated).reduce((a, x) => a + x.probability, 0);
  approx(monkey, 1);
  approx(ox, 1);
}


// 29) v0.5.9 コマンド修正とミミトシシ2型。
{
  const rate = (characterId, skillName, reel = 0, variant = '') =>
    normalActivationTransitions(characterId, skillName, reel, variant)
      .filter(x => x.activated).reduce((a, x) => a + x.probability, 0);

  approx(rate('kerogon_green', '竜のしっぽ'), 1);
  approx(rate('oniwaka', '足ばらい', 0), 1);
  approx(rate('oniwaka', '足ばらい', 1), 1);
  approx(rate('bahamut', 'シャイニングブレス', 0), 1);
  approx(rate('bahamut', 'シャイニングブレス', 3), 1);
  approx(rate('raijin_kukulkan', 'つつきまくり', 0), 1);
  approx(rate('raijin_kukulkan', 'つつきまくり', 3), 1);

  approx(rate('clear_blue_dragon', 'アクアブレス', 0), 1 / 6);
  approx(rate('clear_blue_dragon', 'アクアブレス', 1), 3 / 6);
  approx(rate('clear_blue_dragon', 'アクアブレス', 2), 1 / 6);
  approx(rate('clear_blue_dragon', 'アクアブレス', 3), 0);

  approx(rate('dark_bahamut', 'レッドファイアブレス', 0), 5 / 6);
  approx(rate('dark_bahamut', 'レッドファイアブレス', 1), 1);
  approx(rate('dark_bahamut', 'ブルーアクアブレス', 0), 5 / 6);
  approx(rate('dark_bahamut', 'イエローアースブレス', 2), 1);
  approx(rate('dark_bahamut', 'グリーンエアブレス', 3), 1);

  approx(rate('mimitoshishi', 'こうげき！', 0, 'attack6'), 1);
  approx(rate('mimitoshishi', 'こうげき！', 0, 'mixed'), 2 / 6);

  // エーリュシオンはためるだけで1→2→3→4リールへ進み、4リールで浄化の炎100%。
  const e1 = normalActivationTransitions('elysion', '浄化の炎', 0);
  approx(e1.find(x => !x.activated && x.nextReel === 1)?.probability ?? 0, 1);
  const e2 = normalActivationTransitions('elysion', '浄化の炎', 1);
  approx(e2.find(x => !x.activated && x.nextReel === 2)?.probability ?? 0, 1);
  const e3 = normalActivationTransitions('elysion', '浄化の炎', 2);
  approx(e3.find(x => !x.activated && x.nextReel === 3)?.probability ?? 0, 1);
  approx(rate('elysion', '浄化の炎', 3), 1);

  // 最後に追加した4体。
  approx(rate('platinum_drake', '竜のしっぽ', 0), 5 / 6);
  approx(rate('platinum_drake', '竜のしっぽ', 3), 1 / 6);
  approx(rate('shinjuryu_kukulkan', 'つつきまくり', 0), 1);
  approx(rate('astaroth', 'メテオ！', 0), 1);
  approx(rate('toritamago', 'こうげき！', 0), 0);
}


// 30) ミミトシシのコマンド型選択が撃破確率本体へ渡る。
{
  const make = variant => {
    const s = cloneDefaultState();
    s.allyCount = 1;
    s.allies[0] = { characterId: 'mimitoshishi', attack: '100', speed: '100', star: '1', attribute: 'water', commandVariant: variant };
    s.enemy.maxHp = '50';
    s.enemy.speed = '1';
    const p = SKILL_PRESET_BY_ID.get('attack_bang');
    s.turns[0].allyActions[0] = { ...p, skillPresetId: 'attack_bang' };
    s.turns[0].enemyAction.enabled = false;
    return simulateKillProbability(s).killChance;
  };
  approx(make('attack6'), 1);
  // mixed型でプチ・アイスストームを引いた枝も実ダメージを与えるためHP50は全枝で撃破。
  approx(make('mixed'), 1);
}

// 31) 条件モンスターは自動表示された技を100%固定で使うのではなく、
//     登録コマンド6枠からその技を引く確率を撃破確率へ掛ける。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.allies[0] = { characterId: 'gate_dante', attack: '78', speed: '100', star: '4', attribute: 'fire', commandVariant: '' };
  s.enemy.maxHp = '140';
  s.enemy.attribute = 'fire';
  s.enemy.speed = '1';
  const p = SKILL_PRESET_BY_ID.get('attack_bang');
  s.turns[0].allyActions[0] = { ...p, skillPresetId: 'attack_bang' };
  s.turns[0].enemyAction.enabled = false;
  const r = simulateKillProbability(s);
  // 魔界の門番ダンテ1リールは「こうげき！×1 + 会心の一撃×5」。
  // 攻撃78ではこうげき！は140HPを倒せないが、会心200%は確定で倒せる。
  approx(r.killChance, 5 / 6, 1e-12);
}

// 32) 変化用も「七十二変化の術の停止リール」→「変化先6枠」の2段階で計算する。
//     ファイア!!だけは1リール停止時に魔導師ジョンガリを使い、確定にする。
{
  const rate = xs => xs.filter(x => x.activated).reduce((a, x) => a + x.probability, 0);

  approx(rate(transformTargetActivationTransitions('fire2', 'ファイア!!', 0)), 1);
  approx(rate(transformTargetActivationTransitions('fire2', 'ファイア!!', 1)), 3 / 6);
  approx(rate(transformTargetActivationTransitions('fire2', 'ファイア!!', 2)), 0);
  approx(rate(transformTargetActivationTransitions('fire2', 'ファイア!!', 3)), 0);

  // 1リール開始時の総合発動率。猿/牛自身の変化停止率も含む。
  approx(rate(transformActivationTransitions('猿', 'fire2', 'ファイア!!', 0)), 1 / 2);
  approx(rate(transformActivationTransitions('牛', 'fire2', 'ファイア!!', 0)), 3 / 8);
}

// 33) 変化用で型が確定している補助技・属性ブレスもコマンド確率を使う。
{
  const rate = xs => xs.filter(x => x.activated).reduce((a, x) => a + x.probability, 0);
  // 研究者カイス: 1リールはアイテムパーツ2 + ★→★★3 + ミス1。
  // 移動先2リールはアイテムパーツ5/6なので 2/6 + 3/6*5/6 = 3/4。
  approx(rate(transformTargetActivationTransitions('item_parts', 'アイテムパーツ', 0)), 3 / 4);
  // 所持個体ダークバハムート: 1リール目は各ブレス5/6、2リール以降は6/6。
  approx(rate(transformTargetActivationTransitions('red_fire_breath', 'レッドファイアブレス', 0)), 5 / 6);
  approx(rate(transformTargetActivationTransitions('red_fire_breath', 'レッドファイアブレス', 1)), 1);
  // 所持個体シルフ: こうげき！×6。
  approx(rate(transformTargetActivationTransitions('attack_bang', 'こうげき！', 0)), 1);
}



// 34) 変化用の全技プリセットにコマンド発動率プロファイルを持たせる。
//     これにより、技名は1つに固定表示したままでも実際の6枠から発動率を掛けられる。
{
  const rate = xs => xs.filter(x => x.activated).reduce((a, x) => a + x.probability, 0);

  // 踊り子ロレル: 1リールはミス1 + つるぎの舞5、2リール以降は確定。
  approx(rate(transformTargetActivationTransitions('sword_dance', 'つるぎの舞', 0)), 5 / 6);
  approx(rate(transformTargetActivationTransitions('sword_dance', 'つるぎの舞', 1)), 1);

  // 風の戦士ハヤテ: 1リールは移動5/6→2リール風車4/6。
  approx(rate(transformTargetActivationTransitions('windmill', '風車', 0)), 5 / 9);
  approx(rate(transformTargetActivationTransitions('windmill', '風車', 1)), 4 / 6);

  // 怒る蛇ムシュフシュ: 3リール以降はどくかみつき確定。
  approx(rate(transformTargetActivationTransitions('poison_bite', 'どくかみつき', 0)), 5 / 12);
  approx(rate(transformTargetActivationTransitions('poison_bite', 'どくかみつき', 1)), 1 / 2);
  approx(rate(transformTargetActivationTransitions('poison_bite', 'どくかみつき', 2)), 1);

  // 大魔皇トカイ: 4リールでとけるいき確定。
  approx(rate(transformTargetActivationTransitions('melting_breath', 'とけるいき', 0)), 10 / 27);
  approx(rate(transformTargetActivationTransitions('melting_breath', 'とけるいき', 1)), 4 / 9);
  approx(rate(transformTargetActivationTransitions('melting_breath', 'とけるいき', 2)), 2 / 3);
  approx(rate(transformTargetActivationTransitions('melting_breath', 'とけるいき', 3)), 1);

  // クリア・ブルードラゴンのユーザー確認済みアクアブレス型。
  approx(rate(transformTargetActivationTransitions('aqua_breath', 'アクアブレス', 0)), 1 / 6);
  approx(rate(transformTargetActivationTransitions('aqua_breath', 'アクアブレス', 1)), 1 / 2);
  approx(rate(transformTargetActivationTransitions('aqua_breath', 'アクアブレス', 2)), 1 / 6);
  approx(rate(transformTargetActivationTransitions('aqua_breath', 'アクアブレス', 3)), 0);

  // アルカード会心型。☆3なので4リール停止時は最上位の3リールを使う。
  approx(rate(transformTargetActivationTransitions('critical_hit', '会心の一撃', 0)), 125 / 216);
  approx(rate(transformTargetActivationTransitions('critical_hit', '会心の一撃', 1)), 25 / 36);
  approx(rate(transformTargetActivationTransitions('critical_hit', '会心の一撃', 2)), 5 / 6);
  approx(rate(transformTargetActivationTransitions('critical_hit', '会心の一撃', 3)), 5 / 6);

  const missing = SKILL_PRESETS
    .filter(x => x.selectable !== false)
    .map(x => x.id)
    .filter(id => id !== 'fire2' && !TRANSFORM_PROFILE_BY_SKILL[id]);
  assert.deepEqual(missing, [], `変化用プロファイル未登録: ${missing.join(', ')}`);
}

// 35) 変化用ファイア!!の発動率が撃破確率本体にも掛かる。
{
  const make = characterId => {
    const s = cloneDefaultState();
    s.allyCount = 1;
    s.allies[0] = { characterId, attack: '100', speed: '100', star: '4', attribute: 'fire', commandVariant: '' };
    s.enemy.maxHp = '1';
    s.enemy.speed = '1';
    const p = SKILL_PRESET_BY_ID.get('fire2');
    s.turns[0].allyActions[0] = { ...p, skillPresetId: 'fire2' };
    s.turns[0].enemyAction.enabled = false;
    return simulateKillProbability(s).killChance;
  };
  // ファイア!!以外に止まっても、ファイア!!! / !!!! を実際に実行するためHP1は全枝で撃破。
  approx(make('son_goku'), 1, 1e-12);
  approx(make('gyumao'), 1, 1e-12);
}


// 36) v0.5.11: 実コマンド分岐は「成功/失敗」ではなく、止まった技名そのものを返す。
{
  const xs = normalCommandTransitions('gate_dante', 'こうげき！', 0);
  const prob = name => xs.filter(x => x.commandName === name).reduce((a, x) => a + x.probability, 0);
  approx(prob('こうげき！'), 1 / 6);
  approx(prob('会心の一撃'), 5 / 6);

  const f1 = transformTargetCommandTransitions('fire2', 'ファイア!!', 0);
  approx(f1.filter(x => x.commandName === 'ファイア!!').reduce((a, x) => a + x.probability, 0), 1);
  const f2 = transformTargetCommandTransitions('fire2', 'ファイア!!', 1);
  approx(f2.filter(x => x.commandName === 'ファイア!!').reduce((a, x) => a + x.probability, 0), 1 / 2);
  approx(f2.filter(x => x.commandName === 'ファイア!!!').reduce((a, x) => a + x.probability, 0), 1 / 2);
}

// 37) v0.5.11: 変化用も目当て技以外に止まった場合、その技のダメージを実行する。
// ファイア!!(150%)では倒せず、ファイア!!!(200%)/!!!!(250%)なら倒せるHPで検証。
{
  const make = characterId => {
    const s = cloneDefaultState();
    s.allyCount = 1;
    s.allies[0] = { characterId, attack: '100', speed: '100', star: '4', attribute: 'fire', commandVariant: '' };
    s.enemy.maxHp = '170';
    s.enemy.attribute = 'fire';
    s.enemy.speed = '1';
    const p = SKILL_PRESET_BY_ID.get('fire2');
    s.turns[0].allyActions[0] = { ...p, skillPresetId: 'fire2' };
    s.turns[0].enemyAction.enabled = false;
    return simulateKillProbability(s).killChance;
  };
  approx(make('son_goku'), 1 / 2, 1e-12);
  approx(make('gyumao'), 5 / 8, 1e-12);
}

// 38) v0.5.14: 直近の内部照合で確定した主要技差分。
{
  const rock = SKILL_PRESET_BY_ID.get('rock_throw');
  assert.deepEqual(rock.raceSkillMultipliers, { angel: '90', birdBeast: '90' });

  const shiden = SKILL_PRESET_BY_ID.get('shiden');
  assert.equal(shiden.skillMultiplier, '100', '紫電はユーザー指定どおり100%固定にする');

  const tail = SKILL_PRESET_BY_ID.get('dragon_tail');
  assert.deepEqual(tail.effects, [{ type: 'poison', chance: '25' }]);

  const light = SKILL_PRESET_BY_ID.get('light_breath');
  assert.equal(light.undeadSkillMultiplier, '180');
  assert.deepEqual(light.raceSkillMultipliers, { demon: '180' });

  const holy = SKILL_PRESET_BY_ID.get('holy_strike');
  assert.equal(holy.undeadSkillMultiplier, '360');

  const ice = SKILL_PRESET_BY_ID.get('ice_storm_strike');
  assert.deepEqual([ice.attackAttribute, ice.attackAttribute2], ['wind', 'ice']);

  const boom = SKILL_PRESET_BY_ID.get('self_destruct');
  assert.equal(boom.selfDestruct, true);
}

// 39) 岩飛ばしは通常180%、天使・鳥獣90%。
{
  const run = race => {
    const s = cloneDefaultState();
    s.allyCount = 1;
    s.allies[0] = { characterId: '', attack: '100', speed: '100', star: '4', attribute: 'earth', commandVariant: '' };
    s.enemy.maxHp = '150';
    s.enemy.attribute = 'fire';
    s.enemy.race = race;
    s.enemy.speed = '1';
    const p = SKILL_PRESET_BY_ID.get('rock_throw');
    s.turns[0].allyActions[0] = { ...p, skillPresetId: p.id };
    s.turns[0].enemyAction.enabled = false;
    return simulateKillProbability(s).killChance;
  };
  approx(run('normal'), 1);
  approx(run('angel'), 0);
  approx(run('birdBeast'), 0);
}

// 40) 光のいきは悪魔・アンデッド180%、聖なる一撃はアンデッド360%。
{
  const run = (presetId, race, hp) => {
    const s = cloneDefaultState();
    s.allyCount = 1;
    s.allies[0] = { characterId: '', attack: '100', speed: '100', star: '4', attribute: 'light', commandVariant: '' };
    s.enemy.maxHp = String(hp);
    s.enemy.attribute = 'earth';
    s.enemy.race = race;
    s.enemy.speed = '1';
    const p = SKILL_PRESET_BY_ID.get(presetId);
    s.turns[0].allyActions[0] = { ...p, skillPresetId: p.id };
    s.turns[0].enemyAction.enabled = false;
    return simulateKillProbability(s).killChance;
  };
  approx(run('light_breath', 'normal', 170), 0);
  approx(run('light_breath', 'demon', 170), 1);
  approx(run('holy_strike', 'normal', 250), 0);
  approx(run('holy_strike', 'undead', 250), 1);
}

// 41) 竜のしっぽの毒25%は確率分岐し、次の敵タイミングで毒ダメージへつながる。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.allies[0] = { characterId: '', attack: '1', speed: '100', star: '1', attribute: 'wind', commandVariant: '' };
  s.enemy.maxHp = '100';
  s.enemy.attribute = 'fire';
  s.enemy.race = 'normal';
  s.enemy.speed = '50';
  const p = SKILL_PRESET_BY_ID.get('dragon_tail');
  s.turns[0].allyActions[0] = { ...p, skillPresetId: p.id };
  s.turns[0].enemyAction.enabled = false;
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].allyActions[0] = { kind: 'skip', skillName: '', effects: [] };
  const r = simulateKillProbability(s);
  // 攻撃力1×90%は整数化で0ダメージ。毒枝だけ100→90。
  approx(r.hpDistribution.get(90) ?? 0, 0.25, 1e-12);
  approx(r.hpDistribution.get(100) ?? 0, 0.75, 1e-12);
}

// 42) 自爆後は使用者が離脱し、次ターンの設定行動を行わない。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.allies[0] = { characterId: '', attack: '100', speed: '100', star: '4', attribute: 'fire', commandVariant: '' };
  s.enemy.maxHp = '250';
  s.enemy.attribute = 'fire';
  s.enemy.speed = '1';
  const boom = SKILL_PRESET_BY_ID.get('self_destruct');
  s.turns[0].allyActions[0] = { ...boom, skillPresetId: boom.id };
  s.turns[0].enemyAction.enabled = false;
  s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  s.turns[1].allyActions[0] = { kind: 'attack', skillMultiplier: '300', attackAttribute: 'none', attackType: 'physical', hits: '1', effects: [] };
  const r = simulateKillProbability(s);
  approx(r.killChance, 0);
}

// 43) つるぎの舞は初回1.20→自動1.25→1.30→1.35を重ねる。
{
  const s = cloneDefaultState();
  s.allyCount = 2;
  s.allies[0] = { characterId: '', attack: '1', speed: '100', star: '3', attribute: 'fire', commandVariant: '' };
  s.allies[1] = { characterId: '', attack: '100', speed: '90', star: '4', attribute: 'fire', commandVariant: '' };
  s.enemy.maxHp = '250';
  s.enemy.attribute = 'fire';
  s.enemy.race = 'normal';
  s.enemy.speed = '1';
  const dance = SKILL_PRESET_BY_ID.get('sword_dance');
  s.turns[0].allyActions[0] = { ...dance, skillPresetId: dance.id };
  s.turns[0].allyActions[1] = { kind: 'skip', skillName: '', effects: [] };
  s.turns[0].enemyAction.enabled = false;
  for (let i = 1; i < 4; i++) s.turns.push(JSON.parse(JSON.stringify(s.turns[0])));
  // 2～4ターン目の踊り子の画面設定はスキップでも、自動継続が優先される。
  for (let i = 1; i < 4; i++) s.turns[i].allyActions[0] = { kind: 'skip', skillName: '', effects: [] };
  s.turns[3].allyActions[1] = { kind: 'attack', skillMultiplier: '100', attackAttribute: 'none', attackType: 'physical', hits: '1', effects: [] };
  const r = simulateKillProbability(s);
  approx(r.killChance, 100 / 101, 1e-12);
}


// 44) v0.5.51: マシュまろ3体はHPを個別追跡し、全体攻撃は3体すべてへ同時に当たる。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy.presetId = 'new5_mashumaro';
  s.enemy.maxHp = '250';
  s.enemy.attribute = 'water';
  s.enemy.race = 'normal';
  s.enemy.speed = '62';
  s.allies[0] = { characterId:'', attack:'200', speed:'100', star:'4', attribute:'fire', race:'normal', commandVariant:'' };
  const boom = SKILL_PRESET_BY_ID.get('self_destruct');
  s.turns[0].allyActions[0] = { ...boom, skillPresetId:boom.id };
  s.turns[0].enemyAction.enabled = false;
  const r = simulateKillProbability(s);
  approx(r.killChance, 1);
  approx(r.hpDistribution.get('0,0,0') ?? 0, 1, 1e-12);
}

// 45) v0.5.51: 単体選択攻撃は1体へ集中するため、1回で3体同時撃破にはならない。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy.presetId = 'new5_mashumaro';
  s.enemy.maxHp = '250';
  s.enemy.attribute = 'water';
  s.enemy.race = 'normal';
  s.enemy.speed = '62';
  s.allies[0] = { characterId:'', attack:'400', speed:'100', star:'4', attribute:'fire', race:'normal', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'attack', skillPresetId:'deadly_blow', skillName:'必殺の一撃', skillMultiplier:'250', attackAttribute:'none', attackType:'physical', enemyTarget:'single', hits:'1', effects:[] };
  s.turns[0].enemyAction.enabled = false;
  const r = simulateKillProbability(s);
  approx(r.killChance, 0);
  assert.ok([...r.hpDistribution.keys()].every(key => String(key).startsWith('0,250,250')));
}

// 46) v0.5.52: 敵EXゲージが10に達した枝は、次の敵行動機会でEX発動＝周回失敗として除外する。
{
  const make = enabled => {
    const s = cloneDefaultState();
    s.allyCount = 2;
    s.enemy.presetId = 'new5_mashumaro';
    s.enemy.maxHp = '250';
    s.enemy.attribute = 'water';
    s.enemy.race = 'normal';
    s.enemy.speed = '62';
    s.allies[0] = { characterId:'', attack:'1', speed:'100', star:'4', attribute:'fire', race:'normal', commandVariant:'' };
    s.allies[1] = { characterId:'', attack:'400', speed:'10', star:'4', attribute:'fire', race:'normal', commandVariant:'' };
    // 3体への10hit全体攻撃で敵EXは30加算され、10で上限。BOSS行動がA2より先に来る。
    s.turns[0].allyActions[0] = { kind:'attack', skillName:'EX試験10hit', skillMultiplier:'1', attackAttribute:'none', attackType:'physical', enemyTarget:'all', hits:'10', effects:[] };
    const boom = SKILL_PRESET_BY_ID.get('self_destruct');
    s.turns[0].allyActions[1] = { ...boom, skillPresetId:boom.id };
    s.turns[0].enemyAction.enabled = enabled;
    return simulateKillProbability(s);
  };
  const on = make(true);
  approx(on.killChance, 0);
  approx(on.enemyExFailureChance, 1);

  const off = make(false);
  approx(off.killChance, 1);
  approx(off.enemyExFailureChance ?? 0, 0);
}


// 47) v0.5.53: 〖ぬすむ〗はプレイヤー共有EX残量に応じて0/1/2/3/4を移す。
{
  assert.deepEqual(
    Array.from({ length:11 }, (_, gauge) => stealExAmount(gauge)),
    [0,1,1,1,2,2,2,3,3,3,4]
  );
  assert.deepEqual(stealExTransfer(0, 6), { stolen:0, playerGauge:0, enemyGauge:6 });
  assert.deepEqual(stealExTransfer(6, 7), { stolen:2, playerGauge:4, enemyGauge:9 });
  assert.deepEqual(stealExTransfer(10, 8), { stolen:4, playerGauge:6, enemyGauge:10 });
}

// 48) v0.5.53: 敵攻撃の被弾はプレイヤーEXへ反映。全体攻撃は各対象への各ヒットを数える。
{
  assert.equal(playerExGainFromEnemyAttack(1, 'random', 3), 1);
  assert.equal(playerExGainFromEnemyAttack(5, 'randomEachHit', 3), 5);
  assert.equal(playerExGainFromEnemyAttack(1, 'all', 3), 3);
  assert.equal(playerExGainFromEnemyAttack(2, 'all', 3), 6);
  assert.equal(playerExGainFromEnemyAttack(2, 'all', 0), 0);
}

// 49) v0.5.53: 実際のBOSS攻撃でも被弾数がプレイヤーEXへ入る。
// ダークバハムート1リールは単体攻撃2/6・全体攻撃4/6なので、3体編成ではEX1とEX3に分岐する。
{
  const s = cloneDefaultState();
  s.allyCount = 3;
  for (let i = 0; i < 3; i++) {
    s.allies[i] = { characterId:'', attack:'1', speed:String(3 - i), star:'4', attribute:'fire', race:'normal', commandVariant:'' };
    s.turns[0].allyActions[i] = { kind:'skip', skillName:'', effects:[] };
  }
  s.enemy.presetId = 'q_dark_bahamut';
  s.enemy.maxHp = '9999';
  s.enemy.attribute = 'dark';
  s.enemy.race = 'dragon';
  s.enemy.speed = '100';
  s.turns[0].enemyAction.enabled = true;
  const r = simulateKillProbability(s);
  approx(r.playerExGaugeDistribution.get(1) ?? 0, 1 / 3, 1e-12);
  approx(r.playerExGaugeDistribution.get(3) ?? 0, 2 / 3, 1e-12);
}

// 50) v0.5.53: ドック・ローの再行動技で敵EXが10になった場合、再抽選より先にEX発動失敗へ入る。
{
  const s = cloneDefaultState();
  s.allyCount = 2;
  s.allies[0] = { characterId:'', attack:'1', speed:'100', star:'4', attribute:'fire', race:'normal', commandVariant:'' };
  s.allies[1] = { characterId:'', attack:'1', speed:'1', star:'4', attribute:'fire', race:'normal', commandVariant:'' };
  s.enemy.presetId = 'q_dock_low';
  s.enemy.maxHp = '9999';
  s.enemy.attribute = 'water';
  s.enemy.race = 'normal';
  s.enemy.speed = '75';
  // A1の9hitで敵EX=9。BOSSはA1とA2の間に行動する。
  // 1リール目で月明(2/6)を引けばEX+1後の即時再行動機会がEX発動となり、その枝は失敗する。
  s.turns[0].allyActions[0] = { kind:'attack', skillName:'EX9テスト', skillMultiplier:'1', attackAttribute:'none', attackType:'physical', hits:'9', effects:[] };
  s.turns[0].allyActions[1] = { kind:'skip', skillName:'', effects:[] };
  s.turns[0].enemyAction.enabled = true;
  const r = simulateKillProbability(s);
  assert.ok(r.enemyExFailureChance > 1 / 3);
  assert.ok(r.enemyExFailureChance < 1);
}

// 51) v0.5.54: 固定お供は個別HPを持ち、BOSSだけ倒しても敵チーム撃破にはならない。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'old1_grim', maxHp:'100', attribute:'wind', race:'normal', attack:'1', speed:'1' };
  s.allies[0] = { characterId:'', attack:'200', speed:'100', star:'4', attribute:'fire', race:'normal', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'attack', skillName:'単体試験', skillMultiplier:'100', attackAttribute:'none', attackType:'physical', enemyTarget:'single', enemyTargetSlot:'0', hits:'1', effects:[] };
  s.turns[0].enemyAction.enabled = false;
  const r = simulateKillProbability(s);
  approx(r.killChance, 0);
  assert.ok([...r.hpDistribution.keys()].every(key => String(key) === '0,37,37'));
}

// 52) v0.5.54: 全体攻撃はBOSSと生存お供すべてへ当たり、全滅で撃破成功になる。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'old1_grim', maxHp:'100', attribute:'wind', race:'normal', attack:'1', speed:'1' };
  s.allies[0] = { characterId:'', attack:'200', speed:'100', star:'4', attribute:'fire', race:'normal', commandVariant:'' };
  s.turns[0].allyActions[0] = { kind:'attack', skillName:'全体試験', skillMultiplier:'100', attackAttribute:'none', attackType:'physical', enemyTarget:'all', hits:'1', effects:[] };
  s.turns[0].enemyAction.enabled = false;
  const r = simulateKillProbability(s);
  approx(r.killChance, 1);
  approx(r.hpDistribution.get('0,0,0') ?? 0, 1, 1e-12);
}

// 53) v0.5.54: 単体選択ではお供を明示指定でき、倒されたお供は同ターン後半に行動しない。
{
  const s = cloneDefaultState();
  s.allyCount = 1;
  s.enemy = { presetId:'new1_robo_03', maxHp:'9999', attribute:'earth', race:'normal', attack:'55', speed:'25' };
  s.allies[0] = { characterId:'', attack:'200', speed:'200', star:'4', attribute:'fire', race:'normal', commandVariant:'' };
  // hpSlot 1 = ロボ零壱式。HP72なので確定撃破する。
  s.turns[0].allyActions[0] = { kind:'attack', skillName:'お供狙い', skillMultiplier:'100', attackAttribute:'none', attackType:'physical', enemyTarget:'single', enemyTargetSlot:'1', hits:'1', effects:[] };
  s.turns[0].enemyAction.enabled = true;
  const r = simulateKillProbability(s);
  assert.equal(r.enemySkillActivation[0]['お供:ロボ零壱式 / アイアンクロー'] ?? 0, 0);
  assert.ok([...r.hpDistribution.keys()].every(key => String(key).split(',')[1] === '0'));
}
