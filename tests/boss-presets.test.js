import assert from 'node:assert/strict';
import { BOSS_PRESETS, BOSS_PRESET_BY_ID, applyBossPresetToEnemy } from '../kill/boss-presets.js';

assert.equal(BOSS_PRESETS.length, 92, 'チャート掲載BOSSは92体');
assert.equal(new Set(BOSS_PRESETS.map(x => x.id)).size, BOSS_PRESETS.length, 'preset id重複なし');

const tokai = BOSS_PRESETS.find(x => x.name === '魔皇トカイ');
assert.ok(tokai);
assert.equal(tokai.hp, 1710);
assert.equal(tokai.hpRaw, '1700+10');
assert.equal(tokai.race, 'undead');

const riviere = BOSS_PRESETS.find(x => x.name === '魔王リヴィエール');
assert.ok(riviere);
assert.equal(riviere.speed, 52);
assert.equal(riviere.speedRaw, '50+2');
assert.deepEqual(riviere.companions, ['デメラ', 'スライム']);

const fiska = BOSS_PRESETS.find(x => x.name === '魔海将フィスカ');
assert.deepEqual(fiska.companions, ['魔海兵ブリュー', '魔海魚ブブリ']);

const mash = BOSS_PRESETS.find(x => x.name === 'マシュまろ');
assert.deepEqual(mash.companions, ['マシュまろ', 'マシュまろ']);
assert.equal(mash.enemyCount, 3);
assert.match(mash.encounterNote, /3体/);

const blackDrake = BOSS_PRESETS.find(x => x.name === '滅竜王ブラックドレイク');
assert.equal(blackDrake.hp, 2666);
assert.equal(blackDrake.speed, 66);


const damkina = BOSS_PRESETS.find(x => x.name === 'ダムキナ');
assert.equal(damkina.race, 'angel');
const muus = BOSS_PRESETS.find(x => x.name === '魔王ムウス');
assert.equal(muus.race, 'demon');
const arp = BOSS_PRESETS.find(x => x.name === '魔神アープ');
assert.equal(arp.race, 'waterRace');

const applied = applyBossPresetToEnemy({ presetId:'', maxHp:'1', attribute:'fire', race:'normal', speed:'1' }, tokai.id);
assert.deepEqual(applied, { presetId:tokai.id, maxHp:'1710', attribute:'earth', race:'undead', speed:'70' });

assert.equal(BOSS_PRESET_BY_ID.get('q_platinum_drake')?.name, 'プラチナドレイク');
assert.deepEqual(BOSS_PRESET_BY_ID.get('q_lokesha')?.companions, ['アシユラ']);
assert.deepEqual(BOSS_PRESET_BY_ID.get('new4_garp')?.companions, ['魔鏡騎士リフレク','ダークサラマンダー']);
assert.match(BOSS_PRESET_BY_ID.get('q_lokesha')?.note ?? '', /カルラ.*進化元.*初期リール/);
console.log('boss-presets.test.js: OK');
