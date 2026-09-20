import assert from 'node:assert/strict';
import {
  getMonsterTargets,
  getPartyTargets,
  optimizeTarget,
  probabilityForCondition,
  formatStarRanges,
} from '../encounter/engine.js';

function near(actual, expected, eps = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= eps, `expected ${expected}, got ${actual}`);
}

const monsters = getMonsterTargets();
const parties = getPartyTargets();
assert.equal(monsters.length, 669);
assert.equal(monsters.filter(x => x.isBoss).length, 153);
assert.equal(parties.length, 505);

const mash = optimizeTarget('monster', 'マシュまろ');
assert.equal(mash.perChapter.length, 1);
assert.equal(mash.perChapter[0].chapter, '第5章');
assert.deepEqual(mash.perChapter[0].bestStars, [3, 4, 5, 6]);
near(mash.perChapter[0].maxProbability, 0.7515154, 1e-10);
assert.equal(mash.perChapter[0].bestStarsLabel, '★3～6');

near(probabilityForCondition({
  kind: 'party',
  targetValue: '銃士ダルタ / ジャンヌ / ランチュラ',
  chapterIndex: 2,
  starTotal: 9,
}), 0.5692307692307692, 1e-12);

assert.equal(formatStarRanges([3,4,5,6,9,11,12]), '★3～6 / ★9 / ★11～12');

// 同一パーティが同章の別経路に存在するケースも一つの対象として統合する。
const goku = optimizeTarget('party', 'ソンゴクウ / チョハッカイ / サゴジョウ');
assert.equal(goku.perChapter.length, 1);
assert.equal(goku.perChapter[0].chapter, '第7章');
assert.ok(goku.perChapter[0].maxProbability > 0);

// 絞り込み用メタデータ：章、モンスター★、パーティ★帯。
const slime = monsters.find(x => x.value === 'スライム');
assert.equal(slime.star, 1);
assert.ok(slime.chapterIndexes.includes(0));
const captainAzure = monsters.find(x => x.value === 'キャプテン・アズール');
assert.equal(captainAzure.star, 3);
const maouAzure = monsters.find(x => x.value === '魔王アズール');
assert.equal(maouAzure.star, 4);
const qq = monsters.find(x => x.value === 'ロボ参式　ＱＱ型');
assert.equal(qq.star, 3);
assert.equal(monsters.filter(x => x.star == null).length, 0);

const sampleParty = parties.find(x => x.value === '銃士ダルタ / ジャンヌ / ランチュラ');
assert.ok(sampleParty.chapterIndexes.includes(2));
assert.ok(sampleParty.bandIndexes.includes(1));

console.log('encounter-engine.test.js: ok');
