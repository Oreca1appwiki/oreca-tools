import assert from 'node:assert/strict';
import { attackDamageDistribution, cloneDefaultState, simulateKillProbability } from '../kill/engine.js';
import { SKILL_PRESETS, SKILL_PRESET_BY_ID } from '../kill/presets.js';

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
    { characterId: 'son_goku', attack: '84', speed: '78' },
    { characterId: 'gyumao', attack: '94', speed: '15' },
    { characterId: '', attack: '0', speed: '0' }
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


// 12) 「主要技」はバトル入手チャート末尾のコマンドサンプル一覧と明示追加技だけ。
// キャラクタープリセット専用技は自動入力には使うが、主要技メニューには出さない。
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
    'epidemic_glass', 'poison_bite', 'melting_breath', 'suck_dry'
  ]) assert.ok(majorIds.has(id), `${id} should be a major skill`);

  for (const id of [
    'foot_sweep', 'attack_bang', 'dragon_tail', 'aqua_breath', 'shining_breath',
    'fire1', 'ice1', 'thunder1', 'meteor', 'purifying_flame', 'shiden', 'critical_hit',
    'shibire_giri', 'ninja_thunder'
  ]) assert.equal(majorIds.has(id), false, `${id} must stay character-preset-only`);
}


// 12b) ユーザー指定で復帰した追加主要技の内容を保持する。
{
  const suck = SKILL_PRESET_BY_ID.get('suck_dry');
  assert.equal(suck.major, true);
  assert.equal(suck.kind, 'buff');
  assert.deepEqual(suck.buff, { type: 'atkBuff', target: 'self', mode: 'add', value: '15', duration: '3' });

  const loki = SKILL_PRESET_BY_ID.get('loki_brand');
  assert.deepEqual(loki.buff, { type: 'atkBuff', target: 'all', mode: 'mult', value: '150', duration: '2' });
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


// 22) 「その他」カテゴリは悪疫グラスだけ。
{
  const others = SKILL_PRESETS.filter(x => x.major === true && x.majorGroup === 'other');
  assert.deepEqual(others.map(x => x.id), ['epidemic_glass']);
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
  assert.equal(loki.buff.target, 'all');
  assert.deepEqual(sun.buff.target, ['ally1', 'ally2']);
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
