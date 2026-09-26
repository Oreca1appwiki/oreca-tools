import fs from 'node:fs';
const src = fs.readFileSync(new URL('../kill/ui.js', import.meta.url), 'utf8');
if (!src.includes('id="calculateKill"')) throw new Error('計算ボタンがありません');

if (!src.includes('id="enemyExAllowance"')) throw new Error('敵EX許容回数の入力欄がありません');
if (!src.includes('敵EX許容回数')) throw new Error('敵EX許容回数の表示名がありません');
const renderBody = src.slice(src.indexOf('function render()'), src.indexOf('function collectStateFromDom()'));
if (renderBody.includes('calculate();')) throw new Error('render() 内で自動計算しています');
const inputBody = src.slice(src.indexOf("root.addEventListener('input'"), src.indexOf("root.addEventListener('change'"));
if (inputBody.includes('calculate();') || inputBody.includes('simulateKillProbability')) throw new Error('inputイベントで自動計算しています');
const changeBody = src.slice(src.indexOf("root.addEventListener('change'"), src.indexOf("root.addEventListener('click'"));
if (changeBody.includes('calculate();') || changeBody.includes('simulateKillProbability')) throw new Error('changeイベントで自動計算しています');
console.log('manual-calc-ui.test.js: OK');
