import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../mining/index.html', import.meta.url), 'utf8');
const root = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');

assert.equal((html.match(/<section class="itemsection"/g) || []).length, 50, '採掘アイテムは50種');
assert.equal((html.match(/<h2 class="exclusive">/g) || []).length, 8, '採掘限定は8種');
assert.ok(!html.includes('★10–12'), '★10–12は採掘ページに掲載しない');
assert.ok(html.includes('★3–6') && html.includes('★7–9'), '対象クラスを掲載');
for (const item of ['狂いコンパス','朽ち地図','歪みレンズ','メソタニアの宝珠','監獄の砂','邪葡萄のタネ','マシュマシュマロ','天界竜のウロコ']) {
  const re = new RegExp(`<h2 class="exclusive">${item}</h2>`);
  assert.match(html, re, `${item} を採掘限定表示`);
}
assert.ok(root.includes('href="./mining/"'), 'トップページから採掘へ導線あり');
assert.ok(sw.includes("'./mining/'") && sw.includes("'./mining/index.html'"), 'PWAキャッシュに採掘を追加');
console.log('mining-static: ok');
