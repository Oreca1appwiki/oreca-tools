import { APP_VERSION } from '../assets/version.js';
import {
  CHAPTERS,
  FIXED_LEVEL_TOTAL,
  getMonsterTargets,
  getPartyTargets,
  optimizeTarget,
} from './engine.js';

for (const el of document.querySelectorAll('[data-app-version]')) el.textContent = APP_VERSION;

const els = {
  kind: document.getElementById('targetKind'),
  chapter: document.getElementById('targetChapter'),
  star: document.getElementById('targetStar'),
  search: document.getElementById('targetSearch'),
  select: document.getElementById('targetSelect'),
  selectLabel: document.getElementById('targetSelectLabel'),
  bestProbability: document.getElementById('bestProbability'),
  bestCondition: document.getElementById('bestCondition'),
  bestMeta: document.getElementById('bestMeta'),
  chapterPanel: document.getElementById('chapterPanel'),
  chapterResults: document.getElementById('chapterResults'),
  detailPanel: document.getElementById('detailPanel'),
  detailHead: document.getElementById('detailHead'),
  detailBody: document.getElementById('detailBody'),
};

const targetCache = {
  monster: getMonsterTargets(),
  party: getPartyTargets(),
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function percent(value, digits = 4) {
  return `${(value * 100).toFixed(digits)}%`;
}

function currentTargets() {
  return targetCache[els.kind.value] || [];
}

function renderChapterOptions() {
  els.chapter.innerHTML = '<option value="">すべて</option>' + CHAPTERS.map((chapter, index) =>
    `<option value="${index}">${escapeHtml(chapter)}</option>`
  ).join('');
}

function renderStarOptions({ preserve = false } = {}) {
  const previous = preserve ? els.star.value : '';
  const options = els.kind.value === 'monster'
    ? [['1', '★1'], ['2', '★2'], ['3', '★3'], ['4', '★4']]
    : [['0', '★3～6'], ['1', '★7～9'], ['2', '★10～12']];
  els.star.innerHTML = '<option value="">すべて</option>' + options.map(([value, label]) =>
    `<option value="${value}">${label}</option>`
  ).join('');
  if (preserve && options.some(([value]) => value === previous)) els.star.value = previous;
}

function renderTargetOptions({ preserve = true } = {}) {
  const previous = preserve ? els.select.value : '';
  const query = els.search.value.trim().toLocaleLowerCase('ja');
  const chapterFilter = els.chapter.value === '' ? null : Number(els.chapter.value);
  const starFilter = els.star.value === '' ? null : Number(els.star.value);
  const targets = currentTargets();
  const filtered = targets.filter(item => {
    if (chapterFilter !== null && !item.chapterIndexes.includes(chapterFilter)) return false;
    if (starFilter !== null) {
      if (els.kind.value === 'monster' && item.star !== starFilter) return false;
      if (els.kind.value === 'party' && !item.bandIndexes.includes(starFilter)) return false;
    }
    if (query && !item.label.toLocaleLowerCase('ja').includes(query) && !item.value.toLocaleLowerCase('ja').includes(query)) return false;
    return true;
  });

  els.select.innerHTML = '<option value="">選択してください</option>' + filtered.map(item =>
    `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`
  ).join('');

  if (previous && filtered.some(item => item.value === previous)) {
    els.select.value = previous;
  } else if (filtered.length === 1 && (query || chapterFilter !== null || starFilter !== null)) {
    els.select.value = filtered[0].value;
  }
  els.selectLabel.textContent = els.kind.value === 'monster' ? 'モンスター' : '敵パーティ';
  if (filtered.length === 0) {
    els.select.innerHTML = '<option value="">該当なし</option>';
  }
  renderResults();
}

function renderEmpty() {
  els.bestProbability.textContent = '—';
  els.bestCondition.textContent = '対象を選択';
  els.bestMeta.textContent = `Lv合計${FIXED_LEVEL_TOTAL}固定`;
  els.chapterPanel.hidden = true;
  els.detailPanel.hidden = true;
  els.chapterResults.innerHTML = '';
  els.detailHead.innerHTML = '';
  els.detailBody.innerHTML = '';
}

function renderResults() {
  const targetValue = els.select.value;
  if (!targetValue) {
    renderEmpty();
    return;
  }

  const result = optimizeTarget(els.kind.value, targetValue);
  if (!result.perChapter.length) {
    renderEmpty();
    els.bestCondition.textContent = '出現データなし';
    return;
  }

  els.bestProbability.textContent = percent(result.globalMax);
  els.bestCondition.innerHTML = result.globalBest.map(item =>
    `${escapeHtml(item.chapter)} ／ ${escapeHtml(item.bestStarsLabel)}`
  ).join('<br>');
  els.bestMeta.textContent = `Lv合計${FIXED_LEVEL_TOTAL}（Lv10×3）固定`;

  els.chapterResults.innerHTML = result.perChapter.map(item => `
    <tr>
      <td><b>${escapeHtml(item.chapter)}</b></td>
      <td>${escapeHtml(item.bestStarsLabel)}</td>
      <td class="num"><b>${percent(item.maxProbability)}</b></td>
    </tr>
  `).join('');
  els.chapterPanel.hidden = false;

  els.detailHead.innerHTML = `<tr><th>★合計</th>${result.perChapter.map(item => `<th>${escapeHtml(item.chapter)}</th>`).join('')}</tr>`;
  els.detailBody.innerHTML = Array.from({ length: 10 }, (_, index) => index + 3).map(starTotal => {
    const cells = result.perChapter.map(item => {
      const entry = item.probabilities.find(p => p.starTotal === starTotal);
      const isBest = item.bestStars.includes(starTotal);
      return `<td class="num${isBest ? ' is-best' : ''}">${entry ? percent(entry.probability) : '—'}</td>`;
    }).join('');
    return `<tr><td><b>★${starTotal}</b></td>${cells}</tr>`;
  }).join('');
  els.detailPanel.hidden = false;
}

els.kind.addEventListener('change', () => {
  els.search.value = '';
  renderStarOptions({ preserve: false });
  renderTargetOptions({ preserve: false });
});
els.chapter.addEventListener('change', () => renderTargetOptions({ preserve: true }));
els.star.addEventListener('change', () => renderTargetOptions({ preserve: true }));
els.search.addEventListener('input', () => renderTargetOptions({ preserve: true }));
els.select.addEventListener('change', renderResults);

renderChapterOptions();
renderStarOptions({ preserve: false });
renderTargetOptions({ preserve: false });
