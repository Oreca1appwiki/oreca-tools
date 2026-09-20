import { APP_VERSION } from '../assets/version.js';
import {
  PROCESS,
  parseSlots,
  runFixedTurnMode,
  runTargetMode,
  runSimonFixedTurnMode,
  runLockFixedTurnMode,
  runChangeRateMode,
} from './engine.js';

for (const el of document.querySelectorAll('[data-app-version]')) el.textContent = APP_VERSION;

const STORAGE_KEY = 'oreca-tools-skill-v1';

const els = {
  calcMode: document.getElementById('calcMode'),
  processMode: document.getElementById('processMode'),
  turnField: document.getElementById('turnField'),
  turnCount: document.getElementById('turnCount'),
  targetField: document.getElementById('targetField'),
  targetCount: document.getElementById('targetCount'),
  exField: document.getElementById('exField'),
  initialEx: document.getElementById('initialEx'),
  reelCount: document.getElementById('reelCount'),
  bossField: document.getElementById('bossField'),
  bossMode: document.getElementById('bossMode'),
  reelGrid: document.getElementById('reelGrid'),
  fillMiss: document.getElementById('fillMiss'),
  calculate: document.getElementById('calculate'),
  reset: document.getElementById('reset'),
  errorBox: document.getElementById('errorBox'),
  resultPanel: document.getElementById('resultPanel'),
  resultSummary: document.getElementById('resultSummary'),
  resultDetail: document.getElementById('resultDetail'),
};

let slots = Array.from({ length: 8 }, () => Array(6).fill('ミス'));
let lastProcess = PROCESS.NORMAL;

const PROCESS_LABELS = new Map([
  [PROCESS.NORMAL, '通常'],
  [PROCESS.TO_MISS, 'ミスに変化'],
  [PROCESS.TO_MISS_REACT, 'ミスに変化+再行動'],
  [PROCESS.LOCK, 'ロック'],
  [PROCESS.SIMON, 'シモン'],
]);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function pct(value, digits = 2) {
  return `${(value * 100).toFixed(digits)}%`;
}

function getProcess() {
  return Number(els.processMode.value);
}

function allowedProcesses() {
  const mode = els.calcMode.value;
  if (mode.startsWith('change_')) return [PROCESS.NORMAL, PROCESS.TO_MISS_REACT];
  if (mode === 'target') return [PROCESS.NORMAL, PROCESS.TO_MISS, PROCESS.TO_MISS_REACT];
  if (els.bossMode.checked) return [PROCESS.NORMAL, PROCESS.TO_MISS, PROCESS.TO_MISS_REACT];
  return [PROCESS.NORMAL, PROCESS.TO_MISS, PROCESS.TO_MISS_REACT, PROCESS.LOCK, PROCESS.SIMON];
}

function updateProcessOptions() {
  const previous = getProcess();
  const options = allowedProcesses();
  els.processMode.innerHTML = options.map(value => `<option value="${value}">${PROCESS_LABELS.get(value)}</option>`).join('');
  els.processMode.value = String(options.includes(previous) ? previous : PROCESS.NORMAL);
}

function maxReels() {
  const process = getProcess();
  if (process === PROCESS.SIMON) return 3;
  if (els.calcMode.value.startsWith('change_')) return 4;
  if (els.bossMode.checked) return 8;
  return 4;
}

function updateReelCountOptions({ preserve = true } = {}) {
  const process = getProcess();
  const max = maxReels();
  const previous = preserve ? Number(els.reelCount.value || 4) : Math.min(4, max);
  const fixed = process === PROCESS.SIMON;
  const values = fixed ? [3] : Array.from({ length: max }, (_, i) => i + 1);
  els.reelCount.innerHTML = values.map(n => `<option value="${n}">${n}</option>`).join('');
  els.reelCount.value = String(values.includes(previous) ? previous : (fixed ? 3 : Math.min(previous, max)));
}

function commandOptions(reelIndex, reelCount, process) {
  const isLast = reelIndex === reelCount - 1;
  const out = [];
  if (process === PROCESS.SIMON) {
    out.push('投げナイフ', '投げオノ', '悪魔の心臓', 'ミス');
  } else if (process === PROCESS.LOCK) {
    out.push('パンチコンボ', 'キックコンボ', 'ゲットバックコンボ', 'コンボフィニッシャー', 'ミス');
  } else {
    out.push('目当ての技', 'ミス');
  }
  if (!isLast) out.push('ためる', '上がる');
  if (![PROCESS.SIMON, PROCESS.LOCK].includes(process) && reelIndex > 0) out.push('★へ戻る');
  return out;
}

function reelLabel(index) {
  if (index < 6) return '★'.repeat(index + 1);
  return `第${index + 1}リール`;
}

function normalizeSlotsForCurrentMode() {
  const process = getProcess();
  const count = Number(els.reelCount.value || 1);
  for (let r = 0; r < count; r += 1) {
    const options = commandOptions(r, count, process);
    for (let s = 0; s < 6; s += 1) {
      if (!options.includes(slots[r][s])) slots[r][s] = 'ミス';
    }
  }
}

function renderReels() {
  normalizeSlotsForCurrentMode();
  const count = Number(els.reelCount.value || 1);
  const process = getProcess();
  els.reelGrid.innerHTML = Array.from({ length: count }, (_, r) => {
    const options = commandOptions(r, count, process);
    const slotHtml = Array.from({ length: 6 }, (_, s) => {
      const value = slots[r][s];
      return `
        <label class="skill-slot-row">
          <span>${s + 1}</span>
          <select data-reel="${r}" data-slot="${s}">
            ${options.map(option => `<option value="${escapeHtml(option)}"${option === value ? ' selected' : ''}>${escapeHtml(option)}</option>`).join('')}
          </select>
        </label>`;
    }).join('');
    return `<div class="skill-reel-card"><h3>${escapeHtml(reelLabel(r))}</h3>${slotHtml}</div>`;
  }).join('');

  els.reelGrid.querySelectorAll('select[data-reel]').forEach(select => {
    select.addEventListener('change', () => {
      const r = Number(select.dataset.reel);
      const s = Number(select.dataset.slot);
      slots[r][s] = select.value;
      saveState();
    });
  });
}

function updateVisibility() {
  const mode = els.calcMode.value;
  const process = getProcess();
  const isChange = mode.startsWith('change_');
  els.turnField.hidden = mode === 'target';
  els.targetField.hidden = mode !== 'target';
  els.exField.hidden = process !== PROCESS.SIMON;
  els.bossField.hidden = isChange || [PROCESS.SIMON, PROCESS.LOCK].includes(process);
}

function syncMode({ processChanged = false } = {}) {
  const previousProcess = lastProcess;
  if (!processChanged) updateProcessOptions();
  const process = getProcess();
  if (process === PROCESS.SIMON || process === PROCESS.LOCK || els.calcMode.value.startsWith('change_')) {
    els.bossMode.checked = false;
  }
  updateProcessOptions();
  if (getProcess() !== process && allowedProcesses().includes(process)) els.processMode.value = String(process);
  updateReelCountOptions({ preserve: true });
  updateVisibility();
  if (processChanged && previousProcess !== getProcess()) {
    // 特殊モードへ切替時は無効コマンドだけミスへ置換し、共通の「ミス」「ためる」「上がる」は保持。
    normalizeSlotsForCurrentMode();
  }
  lastProcess = getProcess();
  renderReels();
  saveState();
  clearResult();
}

function collectReels() {
  const count = Number(els.reelCount.value);
  const process = getProcess();
  return parseSlots(slots.slice(0, count).map(row => row.slice()), process);
}

function summaryCard(label, value, note = '') {
  return `<div class="result-card"><span class="result-label">${escapeHtml(label)}</span><strong class="skill-result-number">${escapeHtml(value)}</strong>${note ? `<small>${escapeHtml(note)}</small>` : ''}</div>`;
}

function renderFixed(result) {
  els.resultSummary.innerHTML = summaryCard('発動回数期待値', `${result.expected.toFixed(2)}回`, `${els.turnCount.value}ターン`) +
    summaryCard('1回以上発動', pct(1 - (result.distribution.find(x => x.success === 0)?.probability || 0)));
  els.resultDetail.innerHTML = `
    <div class="table-scroll"><table class="skill-result-table">
      <thead><tr><th>発動回数</th><th>確率</th></tr></thead>
      <tbody>${result.distribution.map(row => `<tr><td>${row.success}回</td><td class="num">${pct(row.probability)}</td></tr>`).join('')}</tbody>
    </table></div>`;
}

function renderTarget(result) {
  els.resultSummary.innerHTML = summaryCard('20ターン以内達成確率', pct(result.cumulative)) +
    summaryCard('20ターン以内平均', `${result.averageTurnWithinLimit.toFixed(2)}ターン`);
  els.resultDetail.innerHTML = `
    <div class="table-scroll"><table class="skill-result-table">
      <thead><tr><th>ターン</th><th>そのターンで初達成</th><th>累積達成確率</th></tr></thead>
      <tbody>${result.rows.map(row => `<tr><td>${row.turn}ターン目</td><td class="num">${pct(row.achievedThisTurn)}</td><td class="num">${pct(row.cumulative)}</td></tr>`).join('')}</tbody>
    </table></div>`;
}

function renderSpecial(result, process) {
  let html = summaryCard('発動回数期待値', `${result.expectedSuccess.toFixed(2)}回`) +
    summaryCard('倍率期待値', `${result.expectedMultiplier.toFixed(2)}%`);
  if (process === PROCESS.LOCK) html += summaryCard('1T目最高倍率', `${result.firstTurnMaxMultiplier.toFixed(0)}%`);
  els.resultSummary.innerHTML = html;
  els.resultDetail.innerHTML = '';
}

function renderChange(result) {
  const type = els.calcMode.value === 'change_monkey' ? '猿' : '牛';
  els.resultSummary.innerHTML = summaryCard('発動率', pct(result.activationRate)) +
    summaryCard('固定変化', `${els.turnCount.value}ターン後`, type);
  els.resultDetail.innerHTML = `
    <h3 class="result-subtitle">${escapeHtml(els.turnCount.value)}ターン後の停止リール分布</h3>
    <div class="table-scroll"><table class="skill-result-table">
      <thead><tr><th>リール</th><th>確率</th></tr></thead>
      <tbody>${result.reelDistribution.map((p, i) => `<tr><td>${escapeHtml(reelLabel(i))}</td><td class="num">${pct(p)}</td></tr>`).join('')}</tbody>
    </table></div>`;
}

function calculate() {
  hideError();
  try {
    const reels = collectReels();
    const process = getProcess();
    let result;
    if (els.calcMode.value === 'fixed') {
      const turnCount = Number(els.turnCount.value);
      if (process === PROCESS.SIMON) {
        result = runSimonFixedTurnMode({ reels, turnCount, initialEx: Number(els.initialEx.value) });
        renderSpecial(result, process);
      } else if (process === PROCESS.LOCK) {
        result = runLockFixedTurnMode({ reels, turnCount });
        renderSpecial(result, process);
      } else {
        result = runFixedTurnMode({ reels, turnCount, processMode: process });
        renderFixed(result);
      }
    } else if (els.calcMode.value === 'target') {
      result = runTargetMode({ reels, target: Number(els.targetCount.value), processMode: process, maxTurn: 20 });
      renderTarget(result);
    } else {
      result = runChangeRateMode({
        reels,
        turnCount: Number(els.turnCount.value),
        processMode: process,
        type: els.calcMode.value === 'change_monkey' ? '猿' : '牛',
      });
      renderChange(result);
    }
    els.resultPanel.hidden = false;
    saveState();
  } catch (error) {
    showError(error?.message || String(error));
  }
}

function showError(message) {
  els.errorBox.textContent = `エラー: ${message}`;
  els.errorBox.hidden = false;
  els.resultPanel.hidden = true;
}
function hideError() { els.errorBox.hidden = true; els.errorBox.textContent = ''; }
function clearResult() { els.resultPanel.hidden = true; els.resultSummary.innerHTML = ''; els.resultDetail.innerHTML = ''; hideError(); }

function defaultState() {
  return {
    calcMode: 'fixed',
    processMode: PROCESS.NORMAL,
    turnCount: 1,
    targetCount: 1,
    initialEx: 0,
    reelCount: 4,
    bossMode: false,
    slots: Array.from({ length: 8 }, () => Array(6).fill('ミス')),
  };
}

function getState() {
  return {
    calcMode: els.calcMode.value,
    processMode: getProcess(),
    turnCount: Number(els.turnCount.value),
    targetCount: Number(els.targetCount.value),
    initialEx: Number(els.initialEx.value),
    reelCount: Number(els.reelCount.value || 1),
    bossMode: els.bossMode.checked,
    slots,
  };
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(getState())); } catch {}
}

function loadState() {
  let state = defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = { ...state, ...JSON.parse(raw) };
  } catch {}
  els.calcMode.value = state.calcMode || 'fixed';
  els.bossMode.checked = Boolean(state.bossMode);
  els.turnCount.value = Number.isFinite(Number(state.turnCount)) ? state.turnCount : 1;
  els.targetCount.value = Number.isFinite(Number(state.targetCount)) ? state.targetCount : 1;
  els.initialEx.value = Number.isFinite(Number(state.initialEx)) ? state.initialEx : 0;
  if (Array.isArray(state.slots)) {
    slots = Array.from({ length: 8 }, (_, r) => Array.from({ length: 6 }, (_, s) => String(state.slots?.[r]?.[s] || 'ミス')));
  }
  updateProcessOptions();
  const allowed = allowedProcesses();
  els.processMode.value = String(allowed.includes(Number(state.processMode)) ? Number(state.processMode) : PROCESS.NORMAL);
  lastProcess = getProcess();
  updateReelCountOptions({ preserve: false });
  const max = maxReels();
  const savedCount = Number(state.reelCount);
  els.reelCount.value = String(getProcess() === PROCESS.SIMON ? 3 : Math.max(1, Math.min(max, Number.isInteger(savedCount) ? savedCount : 4)));
  updateVisibility();
  renderReels();
}

function reset() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  const state = defaultState();
  els.calcMode.value = state.calcMode;
  els.bossMode.checked = false;
  els.turnCount.value = 1;
  els.targetCount.value = 1;
  els.initialEx.value = 0;
  slots = state.slots;
  updateProcessOptions();
  els.processMode.value = String(PROCESS.NORMAL);
  lastProcess = PROCESS.NORMAL;
  updateReelCountOptions({ preserve: false });
  els.reelCount.value = '4';
  updateVisibility();
  renderReels();
  clearResult();
  saveState();
}

els.calcMode.addEventListener('change', () => syncMode());
els.processMode.addEventListener('change', () => syncMode({ processChanged: true }));
els.bossMode.addEventListener('change', () => syncMode());
els.reelCount.addEventListener('change', () => { renderReels(); saveState(); clearResult(); });
for (const input of [els.turnCount, els.targetCount, els.initialEx]) input.addEventListener('input', saveState);
els.fillMiss.addEventListener('click', () => {
  for (let r = 0; r < 8; r += 1) for (let s = 0; s < 6; s += 1) slots[r][s] = 'ミス';
  renderReels(); saveState(); clearResult();
});
els.calculate.addEventListener('click', calculate);
els.reset.addEventListener('click', reset);

loadState();
