import assert from 'node:assert/strict';
import {
  PROCESS,
  emptyReel,
  runFixedTurnMode,
  runTargetMode,
  runSimonFixedTurnMode,
  runLockFixedTurnMode,
  runChangeRateMode,
  applyOneFixedChangeTurn,
  getChangeReels,
} from '../skill/engine.js';

function reel(values = {}) { return { ...emptyReel(), ...values }; }
function near(actual, expected, eps = 1e-9) { assert.ok(Math.abs(actual - expected) <= eps, `expected ${expected}, got ${actual}`); }

// 1リール全部目当てなら毎ターン必ず1回。
{
  const r = runFixedTurnMode({ reels: [reel({ hit: 6 })], turnCount: 3, processMode: PROCESS.NORMAL });
  near(r.expected, 3);
  assert.deepEqual(r.distribution.map(x => [x.success, x.probability]), [[0,0],[1,0],[2,0],[3,1]]);
}

// 3/6で2ターンなら二項分布。
{
  const r = runFixedTurnMode({ reels: [reel({ hit: 3, miss: 3 })], turnCount: 2, processMode: PROCESS.NORMAL });
  near(r.expected, 1);
  near(r.distribution[0].probability, 0.25);
  near(r.distribution[1].probability, 0.5);
  near(r.distribution[2].probability, 0.25);
}

// 1リール目が全上がる、2リール目が全目当てなら必ず発動。
{
  const r = runFixedTurnMode({ reels: [reel({ move: 6 }), reel({ hit: 6 })], turnCount: 1, processMode: PROCESS.NORMAL });
  near(r.expected, 1);
}

// 目標1回、発動率1/2なら20ターン以内は1-(1/2)^20。
{
  const r = runTargetMode({ reels: [reel({ hit: 3, miss: 3 })], target: 1, processMode: PROCESS.NORMAL, maxTurn: 20 });
  near(r.cumulative, 1 - 0.5 ** 20, 1e-10);
  near(r.rows[0].achievedThisTurn, 0.5);
}

// 猿の固定変化1ターン後の停止リール分布。
{
  const d = applyOneFixedChangeTurn([1,0,0,0], getChangeReels('猿'));
  near(d[0], 1/3);
  near(d[1], 1/3);
  near(d[2], 1/6);
  near(d[3], 1/6);
}

// 各リールが全部目当てなら、変化後の開始位置に関係なく発動率100%。
{
  const r = runChangeRateMode({
    reels: [reel({ hit: 6 }), reel({ hit: 6 }), reel({ hit: 6 }), reel({ hit: 6 })],
    turnCount: 3,
    processMode: PROCESS.NORMAL,
    type: '牛',
  });
  near(r.activationRate, 1, 1e-10);
}

// シモン：全マス投げナイフ、EX1なら最初の1回だけ成功し70%。
{
  const reels = [reel({ knife: 6 }), reel({ knife: 6 }), reel({ knife: 6 })];
  const r = runSimonFixedTurnMode({ reels, turnCount: 1, initialEx: 1 });
  near(r.expectedSuccess, 1, 1e-7);
  near(r.expectedMultiplier, 70, 1e-5);
  assert.ok(r.totalProbability > 0.999999);
}

// ロック：全マスフィニッシャーなら1回・150%。
{
  const r = runLockFixedTurnMode({ reels: [reel({ finisher: 6 })], turnCount: 1 });
  near(r.expectedSuccess, 1, 1e-10);
  near(r.expectedMultiplier, 150, 1e-10);
  near(r.firstTurnMaxMultiplier, 150, 1e-10);
}

console.log('skill-engine.test.js: ok');
