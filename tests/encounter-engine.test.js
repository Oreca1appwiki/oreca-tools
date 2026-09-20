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

console.log('encounter-engine.test.js: ok');
