import { PARTY_ROWS } from './data.js';

export const CHAPTERS = ['序章','第1章','第2章','第3章','第4章','第5章','第6章','第7章'];
export const BANDS = ['3–6','7–9','10–12'];
export const FIXED_LEVEL_TOTAL = 30;
export const FIXED_AVERAGE_LEVEL = 10;

const TYPE = Object.freeze({ NORMAL: 'N', RARE: 'R', BOSS: 'B', RANDOM_BOSS: 'X' });

export function splitParty(party) {
  return String(party || '').split(' / ').filter(Boolean).map(raw => {
    const trimmed = raw.trim();
    const isBoss = trimmed.startsWith('(BOSS)');
    return { name: isBoss ? trimmed.slice(6) : trimmed, isBoss };
  });
}

function localeSort(a, b) {
  return a.localeCompare(b, 'ja');
}

export function getMonsterTargets(rows = PARTY_ROWS) {
  const names = new Set();
  const bossNames = new Set();
  for (const row of rows) {
    for (const part of splitParty(row[3])) {
      names.add(part.name);
      if (part.isBoss) bossNames.add(part.name);
    }
  }
  return [...names].sort(localeSort).map(name => ({
    value: name,
    label: bossNames.has(name) ? `(BOSS)${name}` : name,
    isBoss: bossNames.has(name),
  }));
}

export function getPartyTargets(rows = PARTY_ROWS) {
  return [...new Set(rows.map(row => row[3]))].sort(localeSort).map(value => ({ value, label: value }));
}

export function rowMatchesTarget(row, kind, targetValue) {
  if (kind === 'party') return row[3] === targetValue;
  if (kind === 'monster') return splitParty(row[3]).some(part => part.name === targetValue);
  return false;
}

function choose(n, k) {
  n = Math.trunc(n);
  k = Math.trunc(k);
  if (n < 0 || k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let out = 1;
  for (let i = 1; i <= k; i += 1) out = (out * (n - k + i)) / i;
  return out;
}

function avoidProbability(total, hit, draws) {
  total = Math.trunc(total);
  hit = Math.trunc(hit);
  draws = Math.trunc(draws);
  if (draws === 0) return 1;
  if (draws < 0 || total <= 0 || draws > total) return 0;
  if (total - hit < draws) return 0;
  const denominator = choose(total, draws);
  return denominator ? choose(total - hit, draws) / denominator : 0;
}

function bandIndexFromStars(starTotal) {
  if (starTotal <= 6) return 0;
  if (starTotal <= 9) return 1;
  return 2;
}

function adjacentBandIndexes(starTotal, averageLevel) {
  const out = [];
  if (starTotal <= 6 && averageLevel >= 3) out.push(1);
  if (starTotal <= 9 && averageLevel >= 7) out.push(2);
  if (starTotal >= 7 && averageLevel <= 3) out.push(0);
  if (starTotal >= 10 && averageLevel <= 5) out.push(1);
  return [...new Set(out)];
}

function rowsFor(chapterIndex, type, bandIndex, rows = PARTY_ROWS) {
  return rows.filter(row => row[0] === chapterIndex && row[1] === type && row[2] === bandIndex);
}

export function probabilityForCondition({
  kind,
  targetValue,
  chapterIndex,
  starTotal,
  averageLevel = FIXED_AVERAGE_LEVEL,
  rows = PARTY_ROWS,
}) {
  if (!['monster', 'party'].includes(kind)) throw new Error('kind must be monster or party');
  if (!targetValue) return 0;
  if (!Number.isInteger(chapterIndex) || chapterIndex < 0 || chapterIndex >= CHAPTERS.length) return 0;
  if (!Number.isFinite(starTotal) || starTotal < 3 || starTotal > 12) return 0;
  if (!Number.isFinite(averageLevel) || averageLevel < 1 || averageLevel > 10) return 0;

  const baseBand = bandIndexFromStars(starTotal);
  const k = chapterIndex === 7 ? 1 : 2;
  const bossRate = Math.min(1, averageLevel / 10);
  const match = row => rowMatchesTarget(row, kind, targetValue);

  const normal = rowsFor(chapterIndex, TYPE.NORMAL, baseBand, rows);
  const rare = rowsFor(chapterIndex, TYPE.RARE, baseBand, rows);
  const boss = rowsFor(chapterIndex, TYPE.BOSS, baseBand, rows);
  const nHit = normal.filter(match).length;
  const rHit = rare.filter(match).length;
  const bHit = boss.filter(match).length;
  const firstNormalHitRate = normal.filter(match).reduce((sum, row) => sum + (Number(row[5]) || 0), 0);

  let baseNoHit = 0;
  for (let rareSlots = 0; rareSlots <= k; rareSlots += 1) {
    const slotProbability = choose(k, rareSlots) * (0.1 ** rareSlots) * (0.9 ** (k - rareSlots));
    for (const bossSucceeded of [0, 1]) {
      const bossProbability = bossSucceeded ? bossRate : 1 - bossRate;
      if (!bossProbability) continue;
      const normalDraws = k - rareSlots + (bossSucceeded ? 0 : 1);
      const rareDraws = Math.min(rareSlots, rare.length);
      const bossDraws = bossSucceeded ? k : 0;
      const normalNoHit = avoidProbability(normal.length - 1, nHit, normalDraws);
      const rareNoHit = avoidProbability(rare.length, rHit, rareDraws);
      const bossNoHit = avoidProbability(boss.length, bHit, bossDraws);
      baseNoHit += slotProbability * bossProbability * normalNoHit * rareNoHit * bossNoHit;
    }
  }
  baseNoHit *= Math.max(0, 1 - firstNormalHitRate);

  let adjacentNoHit = 1;
  for (const adjacentBand of adjacentBandIndexes(starTotal, averageLevel)) {
    const adjacentNormal = rowsFor(chapterIndex, TYPE.NORMAL, adjacentBand, rows);
    if (!adjacentNormal.length) continue;
    const hits = adjacentNormal.filter(match).length;
    adjacentNoHit *= (adjacentNormal.length - hits) / adjacentNormal.length;
  }

  let randomBossNoHit = 1;
  for (const row of rows) {
    if (row[0] !== chapterIndex || row[1] !== TYPE.RANDOM_BOSS || !match(row)) continue;
    randomBossNoHit *= 1 - (Number(row[4]) || 0);
  }

  const noHit = baseNoHit * adjacentNoHit * randomBossNoHit;
  return Math.max(0, Math.min(1, 1 - noHit));
}

export function chaptersForTarget(kind, targetValue, rows = PARTY_ROWS) {
  const hit = new Set();
  rows.forEach(row => {
    if (rowMatchesTarget(row, kind, targetValue)) hit.add(row[0]);
  });
  return [...hit].sort((a, b) => a - b);
}

export function formatStarRanges(stars) {
  if (!stars?.length) return '—';
  const sorted = [...new Set(stars)].sort((a, b) => a - b);
  const groups = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i += 1) {
    const value = sorted[i];
    if (value === prev + 1) {
      prev = value;
      continue;
    }
    groups.push(start === prev ? `${start}` : `${start}～${prev}`);
    start = prev = value;
  }
  groups.push(start === prev ? `${start}` : `${start}～${prev}`);
  return groups.map(group => `★${group}`).join(' / ');
}

export function optimizeTarget(kind, targetValue, rows = PARTY_ROWS) {
  const chapterIndexes = chaptersForTarget(kind, targetValue, rows);
  const perChapter = chapterIndexes.map(chapterIndex => {
    const probabilities = [];
    for (let starTotal = 3; starTotal <= 12; starTotal += 1) {
      probabilities.push({
        starTotal,
        probability: probabilityForCondition({ kind, targetValue, chapterIndex, starTotal, averageLevel: FIXED_AVERAGE_LEVEL, rows }),
      });
    }
    const maxProbability = Math.max(...probabilities.map(item => item.probability));
    const tolerance = 1e-12;
    const bestStars = probabilities.filter(item => Math.abs(item.probability - maxProbability) <= tolerance).map(item => item.starTotal);
    return {
      chapterIndex,
      chapter: CHAPTERS[chapterIndex],
      maxProbability,
      bestStars,
      bestStarsLabel: formatStarRanges(bestStars),
      probabilities,
    };
  });

  const globalMax = perChapter.length ? Math.max(...perChapter.map(item => item.maxProbability)) : 0;
  const tolerance = 1e-12;
  const globalBest = perChapter.filter(item => Math.abs(item.maxProbability - globalMax) <= tolerance);
  return { kind, targetValue, perChapter, globalMax, globalBest };
}
