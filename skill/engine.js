export const PROCESS = Object.freeze({
  NORMAL: 0,
  TO_MISS: 1,
  TO_MISS_REACT: 2,
  SIMON: 3,
  LOCK: 4,
});

export const MAX_REELS = 8;

export function emptyReel() {
  return {
    hit: 0,
    miss: 0,
    charge: 0,
    move: 0,
    down: 0,
    knife: 0,
    axe: 0,
    heart: 0,
    punch: 0,
    kick: 0,
    getback: 0,
    finisher: 0,
  };
}

export function parseSlots(slotMatrix, processMode) {
  return slotMatrix.map((slots, col) => {
    const reel = emptyReel();
    for (const raw of slots) {
      const v = String(raw || '').trim();
      if (!v) continue;
      if (v === '目当ての技') reel.hit += 1;
      else if (v === '投げナイフ') reel.knife += 1;
      else if (v === '投げオノ') reel.axe += 1;
      else if (v === '悪魔の心臓') reel.heart += 1;
      else if (v === 'パンチコンボ') reel.punch += 1;
      else if (v === 'キックコンボ') reel.kick += 1;
      else if (v === 'ゲットバックコンボ') reel.getback += 1;
      else if (v === 'コンボフィニッシャー') reel.finisher += 1;
      else if (v === 'ミス') reel.miss += 1;
      else if (v === 'ためる') reel.charge += 1;
      else if (v === '上がる') reel.move += 1;
      else if (v === '★へ戻る') reel.down += 1;
      else throw new Error(`不正なコマンドです: ${v}`);
    }
    return reel;
  });
}

export function validateReels(reels, n, processMode) {
  if (!Number.isInteger(n) || n < 1 || n > MAX_REELS) throw new Error('使用リール数が不正です。');
  if (!Array.isArray(reels) || reels.length < n) throw new Error('リール入力が不足しています。');
  const isSimon = processMode === PROCESS.SIMON;
  const isLock = processMode === PROCESS.LOCK;

  for (let i = 0; i < n; i += 1) {
    const r = reels[i];
    const sum = Object.values(r).reduce((a, b) => a + Number(b || 0), 0);
    if (sum !== 6) throw new Error(`${i + 1}リール目は6マスすべて入力してください。`);
    if (i === 0 && r.down > 0) throw new Error('★には「★へ戻る」を入れられません。');
    if ((isSimon || isLock) && r.down > 0) throw new Error('ロック・シモンでは「★へ戻る」は使用できません。');
    if (i === n - 1 && (r.move > 0 || r.charge > 0)) throw new Error('最後の使用リールには「上がる」「ためる」を入れられません。');
    if (n === 1 && (r.move > 0 || r.down > 0 || r.charge > 0)) throw new Error('★だけ使用する場合、移動系・ためるは使用できません。');
    if (isSimon && r.heart > 2) throw new Error('悪魔の心臓は1つのリールに2個までです。');
  }
}

export function runFixedTurnMode({ reels, turnCount, processMode = PROCESS.NORMAL }) {
  const n = reels.length;
  if (!Number.isInteger(turnCount) || turnCount < 1 || turnCount > 10) throw new Error('ターン数は1〜10の整数にしてください。');
  validateReels(reels, n, processMode);

  const initialHits = reels.map(r => r.hit);
  let dp = new Map();
  dp.set(makeKey(0, 0, initialHits), 1);

  for (let turn = 0; turn < turnCount; turn += 1) {
    const nextDp = new Map();
    for (const [key, prob] of dp.entries()) {
      const state = parseKey(key);
      const transitions = resolveTurn(state.reel, state.hits, reels, n, processMode);
      for (const tr of transitions) {
        const newSuccess = state.success + tr.add;
        const nextHits = processMode === PROCESS.TO_MISS_REACT ? initialHits.slice() : tr.nextHits;
        addToMap(nextDp, makeKey(tr.nextReel, newSuccess, nextHits), prob * tr.prob);
      }
    }
    dp = nextDp;
  }

  const result = new Map();
  let expected = 0;
  let total = 0;
  for (const [key, prob] of dp.entries()) {
    const state = parseKey(key);
    addToMap(result, state.success, prob);
    expected += state.success * prob;
    total += prob;
  }
  const maxSuccess = result.size ? Math.max(...result.keys()) : 0;
  const distribution = [];
  for (let s = 0; s <= maxSuccess; s += 1) distribution.push({ success: s, probability: result.get(s) || 0 });
  return { distribution, expected, totalProbability: total };
}

export function runTargetMode({ reels, target, processMode = PROCESS.NORMAL, maxTurn = 20 }) {
  const n = reels.length;
  if (!Number.isInteger(target) || target < 1) throw new Error('目標発動回数は1以上の整数にしてください。');
  validateReels(reels, n, processMode);

  const initialHits = reels.map(r => r.hit);
  let dp = new Map();
  dp.set(makeKey(0, 0, initialHits), 1);
  let cumulative = 0;
  let weightedSum = 0;
  const rows = [];

  for (let turn = 1; turn <= maxTurn; turn += 1) {
    const nextDp = new Map();
    let achievedThisTurn = 0;
    for (const [key, prob] of dp.entries()) {
      const state = parseKey(key);
      const transitions = resolveTurn(state.reel, state.hits, reels, n, processMode);
      for (const tr of transitions) {
        const newSuccess = state.success + tr.add;
        const p = prob * tr.prob;
        if (newSuccess >= target) {
          achievedThisTurn += p;
        } else {
          const nextHits = processMode === PROCESS.TO_MISS_REACT ? initialHits.slice() : tr.nextHits;
          addToMap(nextDp, makeKey(tr.nextReel, newSuccess, nextHits), p);
        }
      }
    }
    cumulative += achievedThisTurn;
    weightedSum += turn * achievedThisTurn;
    rows.push({ turn, achievedThisTurn, cumulative });
    dp = nextDp;
  }

  const averageTurnWithinLimit = cumulative > 0 ? weightedSum / cumulative : 0;
  return { rows, cumulative, averageTurnWithinLimit, remainingProbability: Math.max(0, 1 - cumulative) };
}

export function resolveTurn(startReel, hits, reels, n, processMode) {
  const absorbing = [];
  let active = new Map();
  active.set(makeTurnKey(startReel, 0, 0, hits), 1);
  const EPS = 1e-9;
  const MAX_ITER = 5000;

  for (let iter = 0; iter < MAX_ITER; iter += 1) {
    if (active.size === 0) break;
    const nextActive = new Map();
    let activeMass = 0;

    for (const [key, prob] of active.entries()) {
      if (prob < EPS) continue;
      activeMass += prob;
      const state = parseTurnKey(key);
      const r = reels[state.reel];
      const currentHit = processMode === PROCESS.NORMAL ? r.hit : state.hits[state.reel];
      const convertedMiss = processMode === PROCESS.NORMAL ? 0 : r.hit - state.hits[state.reel];
      const currentMiss = r.miss + convertedMiss;

      if (currentHit > 0) {
        const p = prob * currentHit / 6;
        if (processMode === PROCESS.NORMAL) {
          absorbing.push({ nextReel: state.reel, nextHits: state.hits.slice(), add: state.add + 1, prob: p });
        } else if (processMode === PROCESS.TO_MISS) {
          const nh = state.hits.slice();
          nh[state.reel] -= 1;
          absorbing.push({ nextReel: state.reel, nextHits: nh, add: state.add + 1, prob: p });
        } else if (processMode === PROCESS.TO_MISS_REACT) {
          const nh = state.hits.slice();
          nh[state.reel] -= 1;
          addToMap(nextActive, makeTurnKey(state.reel, state.downCount, state.add + 1, nh), p);
        }
      }

      if (currentMiss > 0) {
        absorbing.push({ nextReel: state.reel, nextHits: state.hits.slice(), add: state.add, prob: prob * currentMiss / 6 });
      }

      if (r.move > 0 && state.reel < n - 1) {
        addToMap(nextActive, makeTurnKey(state.reel + 1, state.downCount, state.add, state.hits), prob * r.move / 6);
      }

      if (r.down > 0 && state.reel > 0) {
        if (state.downCount === 4) {
          absorbing.push({ nextReel: state.reel, nextHits: state.hits.slice(), add: state.add, prob: prob * r.down / 6 });
        } else {
          addToMap(nextActive, makeTurnKey(0, state.downCount + 1, state.add, state.hits), prob * r.down / 6);
        }
      }

      if (r.charge > 0 && state.reel < n - 1) {
        absorbing.push({ nextReel: state.reel + 1, nextHits: state.hits.slice(), add: state.add, prob: prob * r.charge / 6 });
      }
    }

    if (activeMass < EPS) break;
    active = nextActive;
  }
  return absorbing;
}

export function runSimonFixedTurnMode({ reels, turnCount, initialEx }) {
  const n = reels.length;
  if (n !== 3) throw new Error('シモンでは★〜★★★の3リールを使用してください。');
  if (!Number.isInteger(turnCount) || turnCount < 1 || turnCount > 10) throw new Error('ターン数は1〜10の整数にしてください。');
  validateSimonEx(initialEx);
  validateReels(reels, n, PROCESS.SIMON);

  const initialKnife = reels.map(r => r.knife);
  const initialAxe = reels.map(r => r.axe);
  const turnMemo = new Map();
  let dp = new Map();
  addState(dp, makeSimonKey(0, initialEx, initialKnife, initialAxe), 1, 0, 0);

  for (let turn = 0; turn < turnCount; turn += 1) {
    const nextDp = new Map();
    for (const [key, data] of dp.entries()) {
      const state = parseSimonKey(key);
      const transitions = resolveSimonTurn(state.reel, state.ex, state.knife, state.axe, reels, n, turnMemo);
      for (const tr of transitions) {
        const newKey = makeSimonKey(tr.nextReel, tr.ex, tr.knife, tr.axe);
        addState(
          nextDp,
          newKey,
          data.prob * tr.prob,
          data.expectedSuccess * tr.prob + data.prob * tr.expectedAdd,
          data.expectedMultiplier * tr.prob + data.prob * tr.expectedMultiplierAdd,
        );
      }
    }
    dp = nextDp;
  }

  let expectedSuccess = 0;
  let expectedMultiplier = 0;
  let totalProbability = 0;
  for (const data of dp.values()) {
    expectedSuccess += data.expectedSuccess;
    expectedMultiplier += data.expectedMultiplier;
    totalProbability += data.prob;
  }
  return { expectedSuccess, expectedMultiplier, totalProbability };
}

export function resolveSimonTurn(startReel, startEx, startKnife, startAxe, reels, n, memo = null) {
  const memoKey = makeSimonKey(startReel, startEx, startKnife, startAxe);
  if (memo?.has(memoKey)) return memo.get(memoKey);
  const absorbing = new Map();
  let active = new Map();
  addWeightedState(active, makeSimonTurnKey(startReel, startEx, startKnife, startAxe), 1, 0, 0);
  const EPS = 1e-7;
  const MAX_ITER = 12000;

  for (let iter = 0; iter < MAX_ITER; iter += 1) {
    if (active.size === 0) break;
    const nextActive = new Map();
    let activeMass = 0;

    for (const [key, data] of active.entries()) {
      const prob = data.prob;
      if (prob < EPS) continue;
      activeMass += prob;
      const state = parseSimonTurnKey(key);
      const r = reels[state.reel];
      const convertedKnife = r.knife - state.knife[state.reel];
      const convertedAxe = r.axe - state.axe[state.reel];
      const currentMiss = r.miss + convertedKnife + convertedAxe;

      if (state.knife[state.reel] > 0) {
        const q = state.knife[state.reel] / 6;
        const p = prob * q;
        if (state.ex >= 1) {
          const nk = state.knife.slice();
          nk[state.reel] -= 1;
          addWeightedState(nextActive, makeSimonTurnKey(state.reel, state.ex - 1, nk, state.axe), p, data.expectedAdd * q + p, data.expectedMultiplierAdd * q + p * 70);
        } else {
          addSimonTransition(absorbing, { nextReel: state.reel, ex: state.ex, knife: state.knife.slice(), axe: state.axe.slice() }, p, data.expectedAdd * q, data.expectedMultiplierAdd * q);
        }
      }

      if (state.axe[state.reel] > 0) {
        const q = state.axe[state.reel] / 6;
        const p = prob * q;
        if (state.ex >= 2) {
          const na = state.axe.slice();
          na[state.reel] -= 1;
          addWeightedState(nextActive, makeSimonTurnKey(state.reel, state.ex - 2, state.knife, na), p, data.expectedAdd * q + p, data.expectedMultiplierAdd * q + p * 150);
        } else {
          addSimonTransition(absorbing, { nextReel: state.reel, ex: state.ex, knife: state.knife.slice(), axe: state.axe.slice() }, p, data.expectedAdd * q, data.expectedMultiplierAdd * q);
        }
      }

      if (r.heart > 0) {
        const q = r.heart / 6;
        const p = prob * q;
        const restoredKnife = reels.map(x => x.knife);
        const restoredAxe = reels.map(x => x.axe);
        const hasRestored = arraySum(restoredKnife) > arraySum(state.knife) || arraySum(restoredAxe) > arraySum(state.axe);
        if (hasRestored) {
          addWeightedState(nextActive, makeSimonTurnKey(state.reel, Math.min(10, state.ex + 3), restoredKnife, restoredAxe), p, data.expectedAdd * q, data.expectedMultiplierAdd * q);
        } else {
          addSimonTransition(absorbing, { nextReel: state.reel, ex: state.ex, knife: state.knife.slice(), axe: state.axe.slice() }, p, data.expectedAdd * q, data.expectedMultiplierAdd * q);
        }
      }

      if (currentMiss > 0) {
        const q = currentMiss / 6;
        const p = prob * q;
        addSimonTransition(absorbing, { nextReel: state.reel, ex: state.ex, knife: state.knife.slice(), axe: state.axe.slice() }, p, data.expectedAdd * q, data.expectedMultiplierAdd * q);
      }

      if (r.move > 0 && state.reel < n - 1) {
        const q = r.move / 6;
        const p = prob * q;
        addWeightedState(nextActive, makeSimonTurnKey(state.reel + 1, state.ex, state.knife, state.axe), p, data.expectedAdd * q, data.expectedMultiplierAdd * q);
      }

      if (r.charge > 0 && state.reel < n - 1) {
        const q = r.charge / 6;
        const p = prob * q;
        addSimonTransition(absorbing, { nextReel: state.reel + 1, ex: state.ex, knife: state.knife.slice(), axe: state.axe.slice() }, p, data.expectedAdd * q, data.expectedMultiplierAdd * q);
      }
    }

    if (activeMass < EPS) break;
    active = nextActive;
  }

  const result = Array.from(absorbing.values());
  if (memo) memo.set(memoKey, result);
  return result;
}

export function runLockFixedTurnMode({ reels, turnCount }) {
  const n = reels.length;
  if (!Number.isInteger(turnCount) || turnCount < 1 || turnCount > 10) throw new Error('ターン数は1〜10の整数にしてください。');
  validateReels(reels, n, PROCESS.LOCK);

  const initialPunch = reels.map(r => r.punch);
  const initialKick = reels.map(r => r.kick);
  const initialGetback = reels.map(r => r.getback);
  const turnMemo = new Map();
  let dp = new Map();
  addState(dp, makeLockKey(0, initialPunch, initialKick, initialGetback), 1, 0, 0);

  for (let turn = 0; turn < turnCount; turn += 1) {
    const nextDp = new Map();
    for (const [key, data] of dp.entries()) {
      const state = parseLockKey(key);
      const transitions = resolveLockTurn(state.reel, state.punchRem, state.kickRem, state.getbackRem, reels, n, turnMemo);
      for (const tr of transitions) {
        const newKey = makeLockKey(tr.nextReel, tr.punchRem, tr.kickRem, tr.getbackRem);
        addState(
          nextDp,
          newKey,
          data.prob * tr.prob,
          data.expectedSuccess * tr.prob + data.prob * tr.expectedAdd,
          data.expectedMultiplier * tr.prob + data.prob * tr.expectedMultiplierAdd,
        );
      }
    }
    dp = nextDp;
  }

  let expectedSuccess = 0;
  let expectedMultiplier = 0;
  let totalProbability = 0;
  for (const data of dp.values()) {
    expectedSuccess += data.expectedSuccess;
    expectedMultiplier += data.expectedMultiplier;
    totalProbability += data.prob;
  }
  return { expectedSuccess, expectedMultiplier, firstTurnMaxMultiplier: getLockFirstTurnMaxMultiplier(reels, n), totalProbability };
}

export function resolveLockTurn(startReel, startPunch, startKick, startGetback, reels, n, memo = null) {
  const memoKey = makeLockKey(startReel, startPunch, startKick, startGetback);
  if (memo?.has(memoKey)) return memo.get(memoKey);
  const absorbing = new Map();
  let active = new Map();
  addWeightedState(active, makeLockTurnKey(startReel, startPunch, startKick, startGetback), 1, 0, 0);
  const EPS = 1e-12;
  const MAX_ITER = 10000;

  for (let iter = 0; iter < MAX_ITER; iter += 1) {
    if (active.size === 0) break;
    const nextActive = new Map();
    let activeMass = 0;

    for (const [key, data] of active.entries()) {
      const prob = data.prob;
      if (prob < EPS) continue;
      activeMass += prob;
      const state = parseLockTurnKey(key);
      const r = reels[state.reel];
      const idx = state.reel;
      const currentPunch = state.punchRem[idx];
      const currentKick = state.kickRem[idx];
      const currentGetback = state.getbackRem[idx];
      const convertedMiss = (r.punch - currentPunch) + (r.kick - currentKick) + (r.getback - currentGetback);
      const currentMiss = r.miss + convertedMiss;

      if (currentPunch > 0) {
        const q = currentPunch / 6;
        const p = prob * q;
        const rem = state.punchRem.slice(); rem[idx] -= 1;
        addWeightedState(nextActive, makeLockTurnKey(state.reel, rem, state.kickRem, state.getbackRem), p, data.expectedAdd * q + p, data.expectedMultiplierAdd * q + p * 60);
      }
      if (currentKick > 0) {
        const q = currentKick / 6;
        const p = prob * q;
        const rem = state.kickRem.slice(); rem[idx] -= 1;
        addWeightedState(nextActive, makeLockTurnKey(state.reel, state.punchRem, rem, state.getbackRem), p, data.expectedAdd * q + p, data.expectedMultiplierAdd * q + p * 80);
      }
      if (currentGetback > 0) {
        const q = currentGetback / 6;
        const p = prob * q;
        const rem = state.getbackRem.slice(); rem[idx] -= 1;
        addWeightedState(nextActive, makeLockTurnKey(state.reel, state.punchRem, state.kickRem, rem), p, data.expectedAdd * q + p, data.expectedMultiplierAdd * q + p * 40);
      }
      if (r.finisher > 0) {
        const q = r.finisher / 6;
        const p = prob * q;
        const comboCountExpectedForThisPath = data.expectedAdd / Math.max(prob, 1e-300);
        const finisherMultiplierExpected = 150 + comboCountExpectedForThisPath * 50;
        addLockTransition(absorbing, { nextReel: state.reel, punchRem: state.punchRem.slice(), kickRem: state.kickRem.slice(), getbackRem: state.getbackRem.slice() }, p, data.expectedAdd * q + p, data.expectedMultiplierAdd * q + p * finisherMultiplierExpected);
      }
      if (currentMiss > 0) {
        const q = currentMiss / 6;
        const p = prob * q;
        addLockTransition(absorbing, { nextReel: state.reel, punchRem: state.punchRem.slice(), kickRem: state.kickRem.slice(), getbackRem: state.getbackRem.slice() }, p, data.expectedAdd * q, data.expectedMultiplierAdd * q);
      }
      if (r.move > 0 && state.reel < n - 1) {
        const q = r.move / 6;
        const p = prob * q;
        addWeightedState(nextActive, makeLockTurnKey(state.reel + 1, state.punchRem, state.kickRem, state.getbackRem), p, data.expectedAdd * q, data.expectedMultiplierAdd * q);
      }
      if (r.charge > 0 && state.reel < n - 1) {
        const q = r.charge / 6;
        const p = prob * q;
        addLockTransition(absorbing, { nextReel: state.reel + 1, punchRem: state.punchRem.slice(), kickRem: state.kickRem.slice(), getbackRem: state.getbackRem.slice() }, p, data.expectedAdd * q, data.expectedMultiplierAdd * q);
      }
    }

    if (activeMass < EPS) break;
    active = nextActive;
  }

  const result = Array.from(absorbing.values());
  if (memo) memo.set(memoKey, result);
  return result;
}

export function runChangeRateMode({ reels, turnCount, processMode = PROCESS.NORMAL, type }) {
  const n = reels.length;
  if (!Number.isInteger(turnCount) || turnCount < 1 || turnCount > 10) throw new Error('ターン数は1〜10の整数にしてください。');
  if (![PROCESS.NORMAL, PROCESS.TO_MISS_REACT].includes(processMode)) throw new Error('変化発動率では「通常」または「ミスに変化+再行動」を選択してください。');
  validateReels(reels, n, processMode);
  const fixedReels = getChangeReels(type);
  let dist = [1, 0, 0, 0];
  for (let t = 0; t < turnCount; t += 1) dist = applyOneFixedChangeTurn(dist, fixedReels);

  let finalRate = 0;
  for (let reel = 0; reel < 4; reel += 1) {
    const pStart = dist[reel];
    if (pStart === 0) continue;
    const actualReel = Math.min(reel, n - 1);
    const initialHits = reels.map(r => r.hit);
    const transitions = resolveTurn(actualReel, initialHits, reels, n, processMode);
    let hitProb = 0;
    for (const tr of transitions) if (tr.add >= 1) hitProb += tr.prob;
    finalRate += pStart * hitProb;
  }
  return { reelDistribution: dist, activationRate: finalRate };
}

export function getChangeReels(type) {
  if (type === '猿') return [{ miss: 2, move: 4 }, { miss: 3, move: 3 }, { miss: 3, move: 3 }, { miss: 6, move: 0 }];
  if (type === '牛') return [{ miss: 1, move: 5 }, { miss: 3, move: 3 }, { miss: 3, move: 3 }, { miss: 6, move: 0 }];
  throw new Error('変化発動率タイプが不正です。');
}

export function applyOneFixedChangeTurn(dist, fixedReels) {
  const nextDist = [0, 0, 0, 0];
  for (let start = 0; start < 4; start += 1) {
    const pStart = dist[start];
    if (pStart === 0) continue;
    for (const r of resolveFixedChangeTurn(start, fixedReels)) nextDist[r.reel] += pStart * r.prob;
  }
  return nextDist;
}

export function resolveFixedChangeTurn(start, fixedReels) {
  const results = [];
  function dfs(reel, prob) {
    const r = fixedReels[reel];
    const total = r.miss + r.move;
    if (total <= 0) throw new Error('固定くじの合計が0です。');
    if (r.miss > 0) results.push({ reel, prob: prob * r.miss / total });
    if (r.move > 0 && reel < 3) dfs(reel + 1, prob * r.move / total);
  }
  dfs(start, 1);
  return results;
}

export function getLockFirstTurnMaxMultiplier(reels, n) {
  const initialPunch = reels.map(r => r.punch);
  const initialKick = reels.map(r => r.kick);
  const initialGetback = reels.map(r => r.getback);
  const memo = new Map();

  function dfs(reel, punchRem, kickRem, getbackRem, actionCount) {
    const key = `${reel}|${punchRem.join(',')}|${kickRem.join(',')}|${getbackRem.join(',')}|${actionCount}`;
    if (memo.has(key)) return memo.get(key);
    const r = reels[reel];
    let best = 0;
    if (punchRem[reel] > 0) { const next = punchRem.slice(); next[reel] -= 1; best = Math.max(best, 60 + dfs(reel, next, kickRem, getbackRem, actionCount + 1)); }
    if (kickRem[reel] > 0) { const next = kickRem.slice(); next[reel] -= 1; best = Math.max(best, 80 + dfs(reel, punchRem, next, getbackRem, actionCount + 1)); }
    if (getbackRem[reel] > 0) { const next = getbackRem.slice(); next[reel] -= 1; best = Math.max(best, 40 + dfs(reel, punchRem, kickRem, next, actionCount + 1)); }
    if (r.finisher > 0) best = Math.max(best, 150 + actionCount * 50);
    if (r.move > 0 && reel < n - 1) best = Math.max(best, dfs(reel + 1, punchRem, kickRem, getbackRem, actionCount));
    memo.set(key, best);
    return best;
  }
  return dfs(0, initialPunch, initialKick, initialGetback, 0);
}

function validateSimonEx(x) {
  if (!Number.isInteger(x) || x < 0 || x > 10) throw new Error('初期EXゲージは0〜10の整数にしてください。');
}
function addToMap(map, key, value) { map.set(key, (map.get(key) || 0) + value); }
function arraySum(arr) { return arr.reduce((a, b) => a + b, 0); }
function makeKey(reel, success, hits) { return `${reel}|${success}|${hits.join(',')}`; }
function parseKey(key) { const p = key.split('|'); return { reel: Number(p[0]), success: Number(p[1]), hits: p[2].split(',').map(Number) }; }
function makeTurnKey(reel, downCount, add, hits) { return `${reel}|${downCount}|${add}|${hits.join(',')}`; }
function parseTurnKey(key) { const p = key.split('|'); return { reel: Number(p[0]), downCount: Number(p[1]), add: Number(p[2]), hits: p[3].split(',').map(Number) }; }
function makeSimonKey(reel, ex, knife, axe) { return `${reel}|${ex}|${knife.join(',')}|${axe.join(',')}`; }
function parseSimonKey(key) { const p = key.split('|'); return { reel: Number(p[0]), ex: Number(p[1]), knife: p[2].split(',').map(Number), axe: p[3].split(',').map(Number) }; }
function makeSimonTurnKey(reel, ex, knife, axe) { return `${reel}|${ex}|${knife.join(',')}|${axe.join(',')}`; }
function parseSimonTurnKey(key) { const p = key.split('|'); return { reel: Number(p[0]), ex: Number(p[1]), knife: p[2].split(',').map(Number), axe: p[3].split(',').map(Number) }; }
function makeLockKey(reel, punchRem, kickRem, getbackRem) { return `${reel}|${punchRem.join(',')}|${kickRem.join(',')}|${getbackRem.join(',')}`; }
function parseLockKey(key) { const p = key.split('|'); return { reel: Number(p[0]), punchRem: p[1].split(',').map(Number), kickRem: p[2].split(',').map(Number), getbackRem: p[3].split(',').map(Number) }; }
function makeLockTurnKey(reel, punchRem, kickRem, getbackRem) { return `${reel}|${punchRem.join(',')}|${kickRem.join(',')}|${getbackRem.join(',')}`; }
function parseLockTurnKey(key) { const p = key.split('|'); return { reel: Number(p[0]), punchRem: p[1].split(',').map(Number), kickRem: p[2].split(',').map(Number), getbackRem: p[3].split(',').map(Number) }; }

function addWeightedState(map, key, prob, expectedAdd, expectedMultiplierAdd) {
  const current = map.get(key) || { prob: 0, expectedAdd: 0, expectedMultiplierAdd: 0 };
  current.prob += prob;
  current.expectedAdd += expectedAdd;
  current.expectedMultiplierAdd += expectedMultiplierAdd;
  map.set(key, current);
}
function addSimonTransition(map, state, prob, expectedAdd, expectedMultiplierAdd) {
  const key = makeSimonKey(state.nextReel, state.ex, state.knife, state.axe);
  const current = map.get(key) || { nextReel: state.nextReel, ex: state.ex, knife: state.knife.slice(), axe: state.axe.slice(), prob: 0, expectedAdd: 0, expectedMultiplierAdd: 0 };
  current.prob += prob; current.expectedAdd += expectedAdd; current.expectedMultiplierAdd += expectedMultiplierAdd; map.set(key, current);
}
function addLockTransition(map, state, prob, expectedAdd, expectedMultiplierAdd) {
  const key = makeLockKey(state.nextReel, state.punchRem, state.kickRem, state.getbackRem);
  const current = map.get(key) || { nextReel: state.nextReel, punchRem: state.punchRem.slice(), kickRem: state.kickRem.slice(), getbackRem: state.getbackRem.slice(), prob: 0, expectedAdd: 0, expectedMultiplierAdd: 0 };
  current.prob += prob; current.expectedAdd += expectedAdd; current.expectedMultiplierAdd += expectedMultiplierAdd; map.set(key, current);
}
function addState(map, key, prob, expectedSuccess, expectedMultiplier) {
  const current = map.get(key) || { prob: 0, expectedSuccess: 0, expectedMultiplier: 0 };
  current.prob += prob; current.expectedSuccess += expectedSuccess; current.expectedMultiplier += expectedMultiplier; map.set(key, current);
}
