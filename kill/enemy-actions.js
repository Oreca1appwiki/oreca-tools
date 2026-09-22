import { commandTransitionsFromMatrix } from './commands.js';

// 敵行動のうち、撃破確率に直接影響する攻撃・状態異常・強化解除などを扱う。
// BOSSコマンドはBOSS専用ページの表を使用する。未登録技は推測せず、結果画面で警告する。
const skill = (name, data = {}) => Object.freeze({ name, ...data });

export const ENEMY_SKILLS = Object.freeze({
  'こうげき': skill('こうげき', { kind: 'attack', multiplier: 50, target: 'random', attackType: 'physical' }),
  'こうげき!': skill('こうげき!', { kind: 'attack', multiplier: 100, target: 'random', attackType: 'physical' }),
  'こうげき！': skill('こうげき！', { kind: 'attack', multiplier: 100, target: 'random', attackType: 'physical' }),
  '会心の一撃': skill('会心の一撃', { kind: 'attack', multiplier: 200, target: 'random', attackType: 'physical' }),
  '必殺の一撃': skill('必殺の一撃', { kind: 'attack', multiplier: 250, target: 'random', attackType: 'physical' }),
  // v0.5.65: 内部skill_data.csvで効果確認済みの旧章技。
  '吸収攻撃': skill('吸収攻撃', { kind:'lifestealAttack', multiplier:140, healRate:70, target:'random', attackType:'physical', attributes:['dark'] }),
  // 魔皇クジェスカ。両技とも『自分以外』が対象で、召喚した味方も巻き込む。
  // ブラックルシアンは撃破した対象の最大HP30%を回復、ブラッディメアリーは味方撃破時のEX増加まで追跡する。
  'ブラックルシアン': skill('ブラックルシアン', { kind:'kujeskaBlackRussian', multiplier:320, target:'allOtherRandom', attackType:'magic', attributes:['dark'] }),
  'ブラッディメアリー': skill('ブラッディメアリー', { kind:'kujeskaBloodyMary', multiplier:150, target:'allOther', attackType:'magic', attributes:['evil'] }),
  'ほねをやすめている': skill('ほねをやすめている', { kind:'effect', target:'self', attackType:'other', effects:[] }),
  // 浄玻璃鏡は通常コマンドだがEXゲージを2消費する。敵→味方ダメージ量は現モデルでは不要。
  '浄玻璃鏡': skill('浄玻璃鏡', { kind:'attack', target:'all', attackType:'other', attributes:['holy'], enemyExSpend:2 }),
  // 魔皇トカイ。死霊を呼ぶ声は空き枠を最大2体のゾンビビで埋める。
  '死霊を呼ぶ声': skill('死霊を呼ぶ声', { kind:'effect', target:'self', attackType:'magic', effects:[{ type:'summonCompanion', name:'ゾンビビ', startReel:0, fillEmpty:true, summonCurseTurns:2 }] }),
  '灰色のカビ': skill('灰色のカビ', {
    kind:'effect', target:'enemySingle', attackType:'other',
    // 内部IKENIE_SYOKAN: ゾンビビ(ID413)、猶予2ターン、元個体HP/ATKの50%を加算。
    effects:[{ type:'transformCompanionToZombie', hpCarryPercent:50, attackCarryPercent:50, summonCurseTurns:2 }]
  }),
  // 相手EX残量に応じて0/1/2/3/4を奪い、同量を自軍EXへ加算する。敵使用時はゴールド効果なし。
  // v0.5.65: 通常召喚候補が使用する内部skill_data準拠の技。
  'かいふくのいのり': skill('かいふくのいのり', { kind:'heal', value:50, target:'enemySingle', attackType:'magic' }),
  'マインドクラッシュ': skill('マインドクラッシュ', { kind:'effect', target:'random', attackType:'other', effects:[{ type:'status', status:'brainwash', chance:100, duration:1 }] }),
  'そせいの秘法': skill('そせいの秘法', { kind:'effect', target:'enemyTeam', attackType:'magic', effects:[{ type:'reviveEnemyCompanionHp', hp:1 }] }),
  'とっこう': skill('とっこう', { kind:'attack', multiplier:300, target:'all', attackType:'physical', effects:[{ type:'companionSelfDestruct' }] }),
  'ファイア!': skill('ファイア!', { kind:'attack', multiplier:100, target:'random', attackType:'magic', attributes:['fire'] }),
  'アイスニードル': skill('アイスニードル', { kind:'attack', multiplier:90, target:'all', attackType:'magic', attributes:['ice'] }),
  'サンダー!': skill('サンダー!', { kind:'attack', multiplier:100, target:'random', attackType:'magic', attributes:['thunder'] }),
  'デンゲキ': skill('デンゲキ', { kind:'attack', multiplier:80, target:'all', attackType:'magic', attributes:['thunder'] }),
  '炎と氷のいき': skill('炎と氷のいき', { kind:'attack', multiplier:200, target:'all', attackType:'breath', attributes:['fire','ice'] }),
  '2回こうげき': skill('2回こうげき', { kind:'attack', multiplier:50, hits:2, target:'randomEachHit', attackType:'physical' }),
  '3回こうげき': skill('3回こうげき', { kind:'attack', multiplier:50, hits:3, target:'randomEachHit', attackType:'physical' }),
  '4回こうげき': skill('4回こうげき', { kind:'attack', multiplier:50, hits:4, target:'randomEachHit', attackType:'physical' }),
  '5回こうげき': skill('5回こうげき', { kind:'attack', multiplier:50, hits:5, target:'randomEachHit', attackType:'physical' }),
  '追いつめる死霊の手': skill('追いつめる死霊の手', { kind:'attack', multiplier:200, target:'random', attackType:'physical' }),
  'ぬすむ': skill('ぬすむ', { kind:'stealEx', target:'playerTeam', attackType:'other' }),
  'マシュまるま': skill('マシュまるま', { kind:'attack', multiplier:175, multiplierMin:100, multiplierMax:250, multiplierStep:1, target:'random', attackType:'physical', attributes:['none'] }),
  // 第7章。敵側の純粋ダメージは撃破率では無視するが、コマンド実行履歴と副次効果を保持する。
  '如意棒': skill('如意棒', { kind:'attack', multiplier:250, target:'random', attackType:'physical', attributes:['wind'] }),
  'あばれまくり': skill('あばれまくり', { kind:'attack', multiplier:60, multiplierMin:50, multiplierMax:70, multiplierStep:0.1, hits:5, target:'randomEachHit', attackType:'physical', attributes:['none'] }),
  // v0.5.50: カルラの大喝。相手側のメリット効果だけを解除し、麻痺は付与しない。
  '大喝': skill('大喝', { kind:'effect', target:'all', attackType:'other', effects:[{ type:'purgeBeneficial' }] }),
  '無影暗殺拳': skill('無影暗殺拳', {
    kind:'attack', multiplier:240, target:'random', attackType:'physical', attributes:['evil'],
    effects:[{ type:'instantDeath', status:'instantDeath', chance:10, immuneRaces:['undead'], target:'damaged' }]
  }),
  '秘宗重拳': skill('秘宗重拳', {
    // 1ターン溜め。溜め中は被ダメ20%軽減し、最大HPの50%分の被ダメで解除。
    // 次のBOSS行動は純粋ダメージの放出に使うため、撃破率モデルではコマンド再抽選を行わない。
    kind:'enemyCharge', target:'self', attackType:'physical', attributes:['evil'], defenseValue:20, breakDamagePercent:50
  }),
  '狂風の乱撃': skill('狂風の乱撃', { kind:'attack', multiplier:80, hits:4, target:'randomEachHit', attackType:'physical', attributes:['wind'] }),

  // v0.5.40: 魔王アヴァドン／ダイダラボッチ。
  'おかわり': skill('おかわり', {
    kind:'effect', target:'self', attackType:'magic',
    effects:[{ type:'summonCompanion', name:'アヴァドンフード', startReel:0, fillEmpty:true }]
  }),
  'フードをたべる': skill('フードをたべる', {
    // フードがいれば1体だけ消費し、HP150回復・攻撃+50。いない場合はミス化してその場で再行動。
    kind:'consumeCompanionHealBuff', target:'self', attackType:'physical',
    companionNames:['アヴァドンフード'], healValue:150, attackAdd:50,
    turnContinueIfNoActiveCompanionNames:['アヴァドンフード']
  }),
  'カンガエル': skill('カンガエル', { kind:'effect', target:'self', attackType:'other', effects:[{ type:'enemyAtkBuff', mode:'mult', value:110, duration:99 }] }),
  'オコル': skill('オコル', { kind:'effect', target:'self', attackType:'other', bossReelShift:1, effects:[{ type:'enemySpeedBuff', mode:'mult', value:110, duration:99 }] }),
  'ワラウ': skill('ワラウ', { kind:'effect', target:'self', attackType:'other', bossReelShift:-1, effects:[{ type:'enemyAtkBuff', mode:'mult', value:120, duration:99 }] }),
  'カナシイ': skill('カナシイ', { kind:'effect', target:'self', attackType:'other', bossReelShift:1, effects:[{ type:'enemyAtkBuff', mode:'mult', value:90, duration:99 }] }),
  'ヤスム': skill('ヤスム', { kind:'heal', target:'self', attackType:'other', attackMultiplier:80 }),
  'ナク': skill('ナク', { kind:'effect', target:'all', attackType:'magic', effects:[{ type:'status', status:'paralysis', chance:80, duration:1 }] }),
  'タタカウ': skill('タタカウ', {
    // 実倍率は被ダメージに応じて200%→最大400%へ上昇するが、敵の純粋ダメージは撃破率で追跡しない。
    kind:'attack', multiplier:200, target:'random', attackType:'physical', attributes:['none']
  }),

  // v0.5.45: 銀月のルシフェル／大魔皇ラフロイグ。
  '銀色の光': skill('銀色の光', {
    kind:'attack', multiplier:130, target:'random', attackType:'magic', attributes:['light'],
    effects:[{ type:'status', status:'darkness', chance:50, duration:3, target:'damaged' }]
  }),
  '月の闇': skill('月の闇', {
    kind:'effect', target:'all', attackType:'magic', replaceUsedSlotWith:'銀色の光',
    effects:[{ type:'status', status:'confusion', chance:40, duration:1 }]
  }),
  'フォーリン・ダウン': skill('フォーリン・ダウン', {
    // 非リーダー1体をランダム選択して55%即死。成功時は次のBOSS行動を召喚だけに固定する。
    kind:'fallingDown', target:'randomNonLeader', attackType:'magic', chance:55, immuneRaces:['demon','undead']
  }),
  'フォッグブレイク': skill('フォッグブレイク', { kind:'attack', multiplier:170, multiplierIfAttribute:{ water:280 }, target:'random', attackType:'physical', attributes:['heat'] }),
  'ブレイジング・ブラッド': skill('ブレイジング・ブラッド', {
    kind:'lifestealAttack', multiplier:100, healRate:20, target:'all', attackType:'magic', attributes:['heat'],
    effects:[{ type:'enemyAtkBuff', mode:'add', value:10, duration:3, nonStacking:true, stackKey:'ブレイジング・ブラッド:攻撃' }]
  }),
  '大魔皇の一撃': skill('大魔皇の一撃', { kind:'attack', multiplier:150, target:'all', attackType:'physical', attributes:['dark'] }),
  '火族召喚★★★★': skill('火族召喚★★★★', {
    kind:'effect', target:'self', attackType:'magic', effects:[{ type:'summonCompanion', name:'ピートー', attack:50, speed:25, startReel:0 }]
  }),
  '火に油を注ぐ': skill('火に油を注ぐ', {
    kind:'effect', target:'enemyTeam', attackType:'other', effects:[{ type:'fireTeamReelShift', amount:3 }]
  }),
  '火の用心': skill('火の用心', {
    kind:'effect', target:'enemyTeam', attackType:'other',
    effects:[{ type:'enemyDefenseBuff', value:60, duration:99, attributes:['fire'], nonStacking:true, stackKey:'火の用心:火属性軽減', scope:'enemyTeam' }]
  }),
  '燃えるこぶし': skill('燃えるこぶし', { kind:'attack', multiplier:200, target:'random', attackType:'physical', attributes:['fire'] }),

  // v0.5.44: 大魔王アズール／大魔王サッカーラ。
  '海王の海開き': skill('海王の海開き', { kind:'attack', multiplier:135, target:'all', attackType:'physical', attributes:['water'] }),
  'バルバドスの水': skill('バルバドスの水', {
    kind:'effect', target:'self', attackType:'other', effects:[{ type:'barbadosWater' }]
  }),
  // フィスト2種は敵側の純粋ダメージだけなので、撃破率では発動履歴のみ保持する。
  'ハンドレッドフィスト': skill('ハンドレッドフィスト', { kind:'attack', hits:10, target:'randomEachHit', attackType:'physical', attributes:['none'] }),
  'ミリオンズフィスト': skill('ミリオンズフィスト', { kind:'attack', hits:10, target:'randomEachHit', attackType:'physical', attributes:['none'] }),

  // v0.5.43: 騎士団長エンキ／灼熱剣士アレス。
  // エンキの号令は、対象となるお供がいる時だけ成功して即時再行動する。
  // 号令で付くお供側の防御・攻撃変更は、現行モデルがお供HPと敵側純粋ダメージを追跡しないため省略。
  'フェザーキラー': skill('フェザーキラー', { kind:'attack', multiplier:155, multiplierMin:130, multiplierMax:180, target:'random', attackType:'physical', attributes:['wind'] }),
  '超熱血!': skill('超熱血!', {
    kind:'effect', target:'self', attackType:'other',
    // 攻撃+10（永続・重複可）と暗闇治療は敵の純粋ダメージ側にしか影響しないため、撃破率状態には持たせない。
    attackAddPermanent:10, curesDarkness:true,
    effects:[{
      type:'transformEnemyCommands',
      mapping:{
        'ミス':'熱剣ヒートセイバー',
        'こうげき':'熱剣ヒートセイバー',
        'こうげき!':'熱剣ヒートセイバー',
        '熱剣ヒートセイバー':'灼熱剣バニングセイバー',
        '灼熱剣バニングセイバー':'真熱剣ソーラセイバー'
      }
    }]
  }),
  '熱剣ヒートセイバー': skill('熱剣ヒートセイバー', { kind:'attack', multiplier:200, target:'random', attackType:'physical', attributes:['heat'] }),
  '灼熱剣バニングセイバー': skill('灼熱剣バニングセイバー', { kind:'attack', multiplier:245, target:'random', attackType:'physical', attributes:['heat'] }),
  '真熱剣ソーラセイバー': skill('真熱剣ソーラセイバー', { kind:'attack', multiplier:290, target:'random', attackType:'physical', attributes:['heat'] }),

  // v0.5.42: 幽鬼ジャンヌ／時元銃士ダルタン。
  // 現行の撃破率モデルでは敵側の純粋ダメージを無視するため、妄執の自動追撃・攻撃対象固定、
  // 狙い撃ちの1ターン溜めは発動履歴用の技情報だけ保持する。いずれもこちらの与ダメージや行動可否には影響しない。
  '妄執の攻撃': skill('妄執の攻撃', { kind:'attack', multiplier:180, multiplierMin:160, multiplierMax:200, target:'random', attackType:'physical', attributes:['holy'] }),
  '強信の一撃': skill('強信の一撃', { kind:'attack', multiplier:250, target:'random', attackType:'physical', attributes:['holy'] }),
  '狙い撃ち': skill('狙い撃ち', { kind:'attack', multiplier:350, target:'random', attackType:'physical', attributes:['none'], chargeTurns:1 }),
  '魔弾': skill('魔弾', { kind:'attack', multiplier:130, hits:1, hitsMin:1, hitsMax:3, target:'randomEachHit', attackType:'physical', attributes:['dark'] }),

  // v0.5.41: 舞王ナタラジャ／鋏竜ザリガリオン。
  // 踊りの攻撃ダメージ自体は敵純粋ダメージなので無視し、連続踊りによる生命の踊り強化だけをBOSS HPへ反映する。
  '生命の踊り': skill('生命の踊り', { kind:'dance', danceType:'life', target:'enemySingle', attackType:'other', healNormal:50, healEnhanced:60, blessingFlat:35 }),
  '火神の踊り': skill('火神の踊り', { kind:'dance', danceType:'fire', target:'all', attackType:'physical', multiplier:100, attributes:['fire'] }),
  '踏魔の踊り': skill('踏魔の踊り', { kind:'dance', danceType:'evil', target:'all', attackType:'physical', multiplier:90, attributes:['evil'] }),

  'フグバサミ': skill('フグバサミ', {
    kind:'attack', multiplier:100, target:'random', attackType:'physical', attributes:['poison'],
    effects:[{ type:'status', status:'poison', chance:80, duration:99, target:'damaged' }]
  }),
  'クラゲバサミ': skill('クラゲバサミ', {
    kind:'attack', multiplier:100, target:'random', attackType:'physical', attributes:['lightning'],
    effects:[{ type:'status', status:'paralysis', chance:50, duration:1, target:'damaged' }]
  }),
  'オニバサミ': skill('オニバサミ', { kind:'attack', multiplier:250, target:'random', attackType:'physical', attributes:['none'] }),
  '鋏竜の猛攻': skill('鋏竜の猛攻', {
    // その場で再行動し、以後この行動チェーン中はハサミ技のたびに再行動する。
    // 細かな一時コマンド変化は executeBossCommandChain 側で処理する。
    kind:'effect', target:'self', attackType:'other', turnContinue:true, effects:[]
  }),

  // 汎用魔王系
  '魔王の一撃': skill('魔王の一撃', { kind: 'attack', multiplier: 120, target: 'all', attackType: 'physical', attributes: ['dark'] }),
  '魔皇の一撃': skill('魔皇の一撃', { kind: 'attack', multiplier: 130, target: 'all', attackType: 'physical', attributes: ['dark'] }),
  'メテオ!': skill('メテオ!', { kind: 'attack', multiplier: 160, target: 'random', attackType: 'magic', attributes: ['all'] }),
  '女魔王の冷笑': skill('女魔王の冷笑', { kind: 'effect', target: 'all', attackType: 'other', effects: [{ type:'status', status:'paralysis', chance:40, duration:1 }] }),
  '女魔王の哄笑': skill('女魔王の哄笑', { kind: 'effect', target: 'all', attackType: 'other', effects: [{ type:'status', status:'paralysis', chance:50, duration:1 }] }),
  '女魔王の高笑': skill('女魔王の高笑', { kind: 'effect', target: 'all', attackType: 'other', effects: [{ type:'status', status:'paralysis', chance:60, duration:1 }] }),
  '女魔王の狂笑': skill('女魔王の狂笑', {
    kind: 'effect', target: 'all', attackType: 'other',
    effects: [
      { type:'status', status:'confusion', chance:70, duration:1 },
      { type:'enemyAtkBuff', mode:'add', value:5, duration:3 }
    ]
  }),

  // 召喚系。敵チームの空き枠に実際のお供を追加し、次ターン以降は独立して行動する。
  '古神兵召喚': skill('古神兵召喚', { kind:'effect', target:'self', attackType:'other', effects:[{ type:'summonCompanion', name:'古神兵サルベージ', startReel:0 }] }),
  'ソルティドッグ': skill('ソルティドッグ', { kind:'effect', target:'self', attackType:'magic', effects:[{ type:'summonCompanion', name:'フェンリル', startReel:2 }] }),
  '気合': skill('気合', { kind:'effect', target:'self', attackType:'other', effects:[{ type:'enemyAtkBuff', mode:'add', value:10, duration:99 }] }),
  'ほえる': skill('ほえる', { kind:'effect', target:'all', attackType:'other', effects:[{ type:'status', status:'paralysis', chance:60, duration:1 }] }),
  'うなる': skill('うなる', { kind:'effect', target:'self', attackType:'other', effects:[{ type:'enemyAtkBuff', mode:'mult', value:150, duration:3 }] }),
  'まるかじり': skill('まるかじり', { kind:'attack', multiplier:200, target:'random', attackType:'physical', attributes:['none'] }),

  // ドラゴン系
  '竜のしっぽ': skill('竜のしっぽ', { kind:'attack', multiplier:90, target:'all', attackType:'physical', attributes:['none'], effects:[{ type:'status', status:'poison', chance:25, duration:99 }] }),
  '闇のいき': skill('闇のいき', { kind:'attack', multiplier:115, target:'all', attackType:'breath', attributes:['dark'] }),
  '暗黒のいき': skill('暗黒のいき', { kind:'attack', multiplier:125, target:'all', attackType:'breath', attributes:['dark'] }),
  '終焉のいき': skill('終焉のいき', { kind:'attack', multiplier:130, target:'all', attackType:'breath', attributes:['dark'], effects:[{ type:'status', status:'silence', chance:20, duration:3 }] }),
  'ポイズンブレス': skill('ポイズンブレス', { kind:'attack', multiplier:85, target:'all', attackType:'breath', attributes:['poison'], effects:[{ type:'status', status:'poison', chance:45, duration:99 }] }),
  '石化ブレス': skill('石化ブレス', { kind:'attack', multiplier:110, target:'all', attackType:'breath', attributes:['earth'], effects:[{ type:'status', status:'petrification', chance:20, duration:99 }] }),
  '叢雲の尾': skill('叢雲の尾', { kind:'attack', multiplier:130, multiplierIfAnyHarmfulStatus:170, target:'all', attackType:'physical', attributes:['none'] }),

  'たいあたり': skill('たいあたり', { kind:'attack', multiplier:90, target:'all', attackType:'physical', attributes:['none'], effects:[{ type:'status', status:'paralysis', chance:15, duration:1 }] }),
  'ファイアーブレス': skill('ファイアーブレス', { kind:'attack', multiplier:105, target:'all', attackType:'breath', attributes:['fire'] }),
  '業火のいき': skill('業火のいき', { kind:'attack', multiplier:120, target:'all', attackType:'breath', attributes:['fire'] }),
  // v0.5.46: 煌竜王ファイアドレイク／滅竜王ブラックドレイク。
  // 爪は攻撃後に味方全体ATK+15（3ターン）。召喚お供の吸収回復量などにも波及するため敵チーム全体へ反映する。
  '雷光の爪': skill('雷光の爪', { kind:'attack', multiplier:210, target:'random', attackType:'physical', attributes:['light'], effects:[{ type:'enemyAtkBuff', mode:'add', value:15, duration:3, nonStacking:true, stackKey:'雷光の爪:攻撃', scope:'enemyTeam' }] }),
  'いにしえの火炎のいき': skill('いにしえの火炎のいき', { kind:'attack', multiplier:140, target:'all', attackType:'breath', attributes:['fire'], enemyExSpend:1, effects:[{ type:'purgeBeneficial', target:'damaged' }] }),
  '暗黒の爪': skill('暗黒の爪', { kind:'attack', multiplier:210, target:'random', attackType:'physical', attributes:['dark'], effects:[{ type:'enemyAtkBuff', mode:'add', value:15, duration:3, nonStacking:true, stackKey:'暗黒の爪:攻撃', scope:'enemyTeam' }] }),
  'いにしえの暗黒のいき': skill('いにしえの暗黒のいき', { kind:'attack', multiplier:140, target:'all', attackType:'breath', attributes:['dark'], enemyExSpend:1, effects:[{ type:'purgeBeneficial', target:'damaged' }] }),
  '冥界の神罰': skill('冥界の神罰', {
    // 自身ATK+20は敵側純粋ダメージだけに影響するため省略。被ダメ1.2倍だけ撃破率へ反映する。
    kind:'attack', multiplier:300, target:'random', attackType:'magic', attributes:['dark'],
    effects:[{ type:'enemyDefenseDebuff', value:20, duration:3, nonStacking:true, stackKey:'冥界の神罰:被ダメ' }]
  }),
  // v0.5.47: 陰龍インシェンロン／プラチナドレイク。
  '竜の旋廻': skill('竜の旋廻', { kind:'attack', multiplier:110, target:'all', attackType:'physical', attributes:['none'], bossReelShift:1 }),
  // BOSSページでは一部セルが異体字の「迴」表記なので同じ技として扱う。
  '竜の旋迴': skill('竜の旋迴', { kind:'attack', multiplier:110, target:'all', attackType:'physical', attributes:['none'], bossReelShift:1 }),
  '蛍光の宝玉': skill('蛍光の宝玉', { kind:'attack', multiplier:70, multiplierMin:50, multiplierMax:90, multiplierStep:1, hits:4, target:'randomEachHit', attackType:'physical', attributes:['light'], enemyExGain:2 }),
  'ブラックライトブレス': skill('ブラックライトブレス', {
    kind:'attack', multiplier:95, target:'all', attackType:'breath', attributes:['heat','dark'],
    effects:[{ type:'allyReelRandomSet', target:'damaged' }, { type:'fixedExAbsorb', value:1 }]
  }),
  '雷竜の壁': skill('雷竜の壁', {
    kind:'effect', target:'enemyTeam', attackType:'magic',
    // 無分類技(other)だけは軽減対象外。重ね掛け不可で再使用時は残り3ターンへ更新。
    effects:[{ type:'enemyDefenseBuff', value:25, duration:3, attackTypes:['physical','magic','breath'], nonStacking:true, stackKey:'雷竜の壁:被ダメ軽減', breakOnActionDisable:true, scope:'enemyTeam' }]
  }),
  '光のいき': skill('光のいき', { kind:'attack', multiplier:140, target:'all', attackType:'breath', attributes:['light'], multiplierIfRace:{ demon:180, undead:180 } }),
  // v0.5.49: 海賊王ドック・ロー。再行動技は使用したそのマスだけ永続でミス化する。
  // EXゲージ+1は敵EXへ実加算。〖ぬすむ〗はプレイヤー共有EX残量を参照して移す。
  '蒼染の月明': skill('蒼染の月明', {
    kind:'effect', target:'self', attackType:'other', turnContinue:true, replaceUsedSlotWith:'ミス', enemyExGain:1,
    effects:[{ type:'enemyMaxHpAdd', value:30 }]
  }),
  '深海の叫び': skill('深海の叫び', {
    kind:'effect', target:'self', attackType:'other', turnContinue:true, replaceUsedSlotWith:'ミス', enemyExGain:1,
    effects:[{ type:'enemyPermanentAttackAdd', value:5 }]
  }),
  '大海流': skill('大海流', {
    kind:'attack', multiplier:180, target:'all', attackType:'magic', attributes:['water'],
    effects:[{ type:'enemyAtkBuff', mode:'add', value:15, duration:3, nonStacking:true, stackKey:'大海流:攻撃', scope:'enemyTeam' }]
  }),

  // v0.5.48: ミートマニア。敵の純粋ダメージは撃破率で無視するため、
  // 〖たべる〗のHP回復だけ状態へ反映し、攻撃+5と〖渾身の一撃〗の成長条件は技メタデータとして保持する。
  'たべる': skill('たべる', {
    kind:'heal', value:80, target:'self', attackType:'other',
    enemyAttackAdd:5, enemyAttackAddPermanent:true, enemyAttackAddStacking:true
  }),
  '渾身の一撃': skill('渾身の一撃', {
    kind:'attack', multiplier:180, target:'random', attackType:'physical', attributes:['none'],
    selfBuffUseMultiplierGain:80, selfBuffUseMultiplierMaxUses:5,
    selfBuffUseCommands:['たべる','ガッツパワー'], maxMultiplier:580
  }),
  '金のいき': skill('金のいき', { kind:'attack', multiplier:120, target:'all', attackType:'breath', attributes:['all'] }),
  // v0.5.37: 海竜ストリームドラゴン／灰竜アッシュドラゴン。
  'ウォーターブレス': skill('ウォーターブレス', { kind:'attack', multiplier:105, target:'all', attackType:'breath', attributes:['water'] }),
  'クリアアクアブレス': skill('クリアアクアブレス', { kind:'attack', multiplier:145, target:'all', attackType:'breath', attributes:['water'] }),
  'ストリームアタック': skill('ストリームアタック', { kind:'attack', multiplier:90, hits:2, hitsMin:2, hitsMax:3, target:'randomEachHit', attackType:'physical', attributes:['water'] }),
  'オプティカルカモフラージュ': skill('オプティカルカモフラージュ', {
    kind:'effect', target:'self', attackType:'other', turnContinue:true,
    effects:[
      { type:'enemySingleTargetUntargetable' },
      { type:'enemyPhysicalEvasion', chance:40 },
      { type:'disableEnemyCommandNameDuringChain', commandName:'オプティカルカモフラージュ' }
    ]
  }),
  'ひっかき': skill('ひっかき', { kind:'attack', multiplier:120, target:'random', attackType:'physical', attributes:['none'] }),
  'ひっかき!': skill('ひっかき!', { kind:'attack', multiplier:170, target:'random', attackType:'physical', attributes:['none'] }),
  'ヴォイドブレス': skill('ヴォイドブレス', { kind:'attack', multiplier:130, target:'all', attackType:'breath', attributes:['dark'] }),
  'ブラックヴォイドブレス': skill('ブラックヴォイドブレス', { kind:'attack', multiplier:145, target:'all', attackType:'breath', attributes:['dark'] }),

  // v0.5.40: 魔王アヴァドン／ダイダラボッチ。
  // v0.5.39: 神人ニラーハラー／魔将ガープ。
  'ムチミ突き': skill('ムチミ突き', { kind:'attack', multiplier:210, target:'random', attackType:'physical', attributes:['water'] }),
  '怒涛の攻め': skill('怒涛の攻め', { kind:'effect', target:'enemyTeam', attackType:'physical', effects:[] }),
  'ナンクルマルオーリトーリ': skill('ナンクルマルオーリトーリ', {
    kind:'effect', target:'self', attackType:'other',
    effects:[
      // 既に場にいるナンクルマルだけを強化してから、新しい1体を召喚する。最大HP+80も同じ非重複効果として反映。
      { type:'companionPermanentStats', names:['ナンクルマル'], attack:25, speed:25, maxHp:80, nonStackingKey:'ナンクルマルオーリトーリ' },
      { type:'summonCompanion', name:'ナンクルマル', startReel:0 }
    ]
  }),
  'サキムイ': skill('サキムイ', {
    // 味方全体を50回復し、発動時の生存味方数に応じて攻撃を永続強化（1体:+10 / 2体:+15 / 3体:+20）。同名効果は上書き。
    kind:'heal', target:'enemyTeam', attackType:'other', value:50,
    effects:[{ type:'enemyTeamAttackBuffByCount', values:{ 1:10, 2:15, 3:20 }, duration:99, stackKey:'サキムイ:攻撃' }]
  }),
  'かみくだき': skill('かみくだき', { kind:'lifestealAttack', multiplier:180, healRate:20, target:'random', attackType:'physical', attributes:['none'] }),
  'ゆうらん': skill('ゆうらん', { kind:'companionExcursionHeal', target:'self', attackType:'physical', healValue:100 }),
  // 2ターン行動不能。状態異常回避とは別枠で扱い、敵が1体だけなら不発。使用者も2行動機会ぶん拘束する。
  'すいこみ': skill('すいこみ', { kind:'actionLock', target:'random', attackType:'other', duration:2, minimumActiveTargets:2, lockSource:true }),
  'ガープの物理法則': skill('ガープの物理法則', {
    // 自分以外の味方へ物理1.6倍・物理被ダメ半減(永続)+眠り。撃破率では被ダメ半減と眠りを追跡する。
    kind:'effect', target:'enemyCompanions', attackType:'other', effects:[
      { type:'companionTeamDefenseBuff', value:50, duration:99, attackTypes:['physical'], nonStacking:true, stackKey:'ガープの物理法則:物理防御' },
      { type:'companionTeamSleep', duration:5 }
    ]
  }),
  '魔将の教鞭': skill('魔将の教鞭', { kind:'companionDiscipline', target:'enemyCompanion', attackType:'physical', multiplier:10 }),
  'ボルガノン': skill('ボルガノン', { kind:'attack', multiplier:110, target:'all', attackType:'magic', attributes:['heat'] }),
  'ハイクラス・ボルガノン': skill('ハイクラス・ボルガノン', { kind:'attack', multiplier:130, target:'all', attackType:'magic', attributes:['heat'] }),
  'エナジーフィール': skill('エナジーフィール', {
    // 味方単体120回復+眠り治療。BOSS自身と固定お供を対象候補として分岐する。
    kind:'companionHealCureSleep', target:'enemyCompanion', attackType:'magic', value:120
  }),
  '黒炎のいき': skill('黒炎のいき', { kind:'attack', multiplier:120, target:'all', attackType:'breath', attributes:['fire','dark'] }),

  // クイックシルバー／ベヒモス系。BOSSプロファイル追加前でも内部効果を共通技として保持する。
  'はしりまわり': skill('はしりまわり', { kind:'attack', multiplier:55, multiplierMin:45, multiplierMax:65, multiplierStep:0.1, hits:3, target:'randomEachHit', attackType:'physical', attributes:['earth'], effects:[{ type:'enemySpeedBuff', mode:'add', value:12, duration:99 }] }),
  'あばれまわり': skill('あばれまわり', { kind:'attack', multiplier:70, multiplierMin:45, multiplierMax:95, multiplierStep:0.1, hits:4, target:'randomEachHit', attackType:'physical', attributes:['earth'] }),
  'おしつぶし': skill('おしつぶし', { kind:'attack', multiplier:65, hits:4, target:'randomEachHit', attackType:'physical', attributes:['earth'], effects:[{ type:'status', status:'paralysis', chance:15, duration:1, target:'damaged' }] }),
  'サンダーブレス': skill('サンダーブレス', { kind:'attack', multiplier:105, target:'all', attackType:'breath', attributes:['thunder'] }),
  '轟雷雲': skill('轟雷雲', { kind:'attack', multiplier:140, target:'all', attackType:'breath', attributes:['thunder'] }),
  'ブリザードブレス': skill('ブリザードブレス', { kind:'attack', multiplier:130, target:'all', attackType:'breath', attributes:['ice'] }),
  'チビまおうの一撃': skill('チビまおうの一撃', { kind:'attack', multiplier:120, target:'all', attackType:'physical', attributes:['dark'] }),
  'フラッシュ': skill('フラッシュ', { kind:'attack', multiplier:40, target:'all', attackType:'magic', attributes:['light'], effects:[{ type:'status', status:'darkness', chance:20, duration:3 }] }),
  'ハイ・フラッシュ': skill('ハイ・フラッシュ', { kind:'attack', multiplier:80, target:'all', attackType:'magic', attributes:['light'], effects:[{ type:'status', status:'darkness', chance:30, duration:3 }] }),
  'ホワイトブレス': skill('ホワイトブレス', { kind:'attack', multiplier:100, target:'all', attackType:'breath', attributes:['holy'] }),
  'ホーリーブレス': skill('ホーリーブレス', { kind:'attack', multiplier:120, target:'all', attackType:'breath', attributes:['holy'] }),
  'ウォーターブレイク': skill('ウォーターブレイク', { kind:'attack', multiplier:150, multiplierIfAttribute:{ water:200 }, target:'random', attackType:'physical', attributes:['fire'] }),
  'ストレートフラッシュ': skill('ストレートフラッシュ', { kind:'attack', multiplier:50, target:'all', attackType:'physical', attributes:['light'], effects:[{ type:'status', status:'darkness', chance:15, duration:3 }] }),
  'ロックラーヴァ': skill('ロックラーヴァ', { kind:'attack', multiplier:100, target:'all', attackType:'magic', attributes:['heat'] }),
  // かばうは撃破確率では再現しない（ユーザー指定）。
  'かばう': skill('かばう', { kind:'effect', target:'self', attackType:'other', effects:[] }),

  // 追加BOSS用の固定技
  'かみつき': skill('かみつき', { kind:'attack', multiplier:120, target:'random', attackType:'physical', attributes:['none'] }),
  '水鉄砲': skill('水鉄砲', { kind:'attack', multiplier:165, multiplierMin:100, multiplierMax:230, multiplierStep:0.1, target:'random', attackType:'breath', attributes:['water'] }),
  '地獄の牙': skill('地獄の牙', { kind:'attack', multiplier:130, target:'random', attackType:'physical', attributes:['fire'], effects:[{ type:'enemyAtkBuff', mode:'add', value:20, duration:3 }] }),
  '水竜の牙': skill('水竜の牙', { kind:'attack', multiplier:130, target:'random', attackType:'physical', attributes:['water'], effects:[{ type:'enemyAtkBuff', mode:'add', value:20, duration:3 }] }),
  '氷のムチ': skill('氷のムチ', { kind:'attack', multiplier:110, target:'all', attackType:'physical', attributes:['ice'] }),
  '氷のムチ!': skill('氷のムチ!', { kind:'attack', multiplier:150, target:'all', attackType:'physical', attributes:['ice'] }),
  'エメラルドブレス': skill('エメラルドブレス', { kind:'attack', multiplier:130, target:'all', attackType:'breath', attributes:['wind'] }),
  'エメラルドカット': skill('エメラルドカット', { kind:'attack', multiplier:210, target:'random', attackType:'physical', attributes:['wind'] }),
  'エメラルドショット': skill('エメラルドショット', { kind:'attack', multiplier:60, hits:4, target:'randomEachHit', attackType:'physical', attributes:['earth'] }),
  'エメラルドフラッシュ': skill('エメラルドフラッシュ', { kind:'effect', target:'all', attackType:'other', effects:[{ type:'status', status:'confusion', chance:40, duration:1 }, { type:'enemyAtkBuff', mode:'add', value:10, duration:99 }] }),

  // ククルカン
  'つっつき': skill('つっつき', { kind:'attack', multiplier:150, target:'random', attackType:'physical', attributes:['wind'] }),
  'つつきまくり': skill('つつきまくり', { kind:'attack', multiplier:70, hits:3, target:'randomEachHit', attackType:'physical', attributes:['wind'] }),
  'はばたき': skill('はばたき', { kind:'attack', multiplier:50, target:'all', attackType:'physical', attributes:['wind'], effects:[{ type:'status', status:'paralysis', chance:30, duration:1 }] }),
  '輝く風': skill('輝く風', { kind:'attack', multiplier:90, target:'all', attackType:'physical', attributes:['wind'], effects:[{ type:'status', status:'paralysis', chance:45, duration:1 }] }),

  // ナナワライ
  '天狗のうちわ': skill('天狗のうちわ', { kind:'attack', multiplier:200, target:'random', attackType:'physical', attributes:['wind'] }),
  '大音声': skill('大音声', { kind:'effect', target:'all', attackType:'other', effects:[{ type:'purgeBeneficial' }, { type:'status', status:'paralysis', chance:30, duration:1 }] }),
  '風の刃': skill('風の刃', { kind:'attack', multiplier:120, target:'all', attackType:'physical', attributes:['wind'] }),
  '大怒号': skill('大怒号', { kind:'effect', target:'all', attackType:'other', effects:[{ type:'purgeBeneficial' }, { type:'status', status:'paralysis', chance:37, duration:1 }] }),
  '大風起こし': skill('大風起こし', { kind:'attack', multiplier:90, hitsMin:2, hitsMax:3, target:'randomEachHit', attackType:'magic', attributes:['wind'] }),
  '大雷落とし': skill('大雷落とし', { kind:'attack', multiplier:90, hitsMin:2, hitsMax:3, target:'randomEachHit', attackType:'magic', attributes:['thunder'] }),

  // フロストドラゴン
  'アイスブレス': skill('アイスブレス', { kind:'attack', multiplier:105, target:'all', attackType:'breath', attributes:['ice'] }),
  'フローズンブレス': skill('フローズンブレス', { kind:'attack', multiplier:85, target:'all', attackType:'breath', attributes:['ice'], effects:[{ type:'status', status:'paralysis', chance:35, duration:1 }] }),
  '凍てつく息': skill('凍てつく息', { kind:'attack', multiplier:100, target:'all', attackType:'breath', attributes:['ice'], effects:[{ type:'status', status:'paralysis', chance:40, duration:1 }] }),
  'カチワリゴオリ': skill('カチワリゴオリ', { kind:'attack', multiplier:200, target:'random', attackType:'physical', attributes:['ice'] }),
  'カキゴオリ': skill('カキゴオリ', { kind:'heal', attackMultiplier:125 }),

  // 閻魔
  '拘束': skill('拘束', { kind:'attack', multiplier:190, target:'random', attackType:'physical', attributes:['none'], effects:[{ type:'status', status:'paralysis', chance:25, duration:1 }] }),
  '閻魔仕置': skill('閻魔仕置', { kind:'attack', multiplier:200, target:'random', attackType:'physical', attributes:['holy'], effects:[{ type:'status', status:'silence', chance:50, duration:3 }] }),

  // トカイ
  '甘いいき': skill('甘いいき', {
    kind:'attack', multiplier:60, target:'all', attackType:'breath', attributes:['evil'],
    effects:[
      { type:'status', status:'sleep', chance:10, duration:5 },
      { type:'status', status:'paralysis', chance:10, duration:1 },
      { type:'status', status:'poison', chance:10, duration:99 },
      { type:'status', status:'confusion', chance:10, duration:1 },
      { type:'status', status:'darkness', chance:10, duration:3 },
      { type:'status', status:'silence', chance:10, duration:3 },
      { type:'status', status:'cold', chance:10, duration:3 }
    ]
  }),
  'とけるいき': skill('とけるいき', {
    kind:'attack', multiplier:60, multiplierIfStatus:{ deadlyPoison:120 }, target:'all', attackType:'breath', attributes:['poison','dark'],
    effects:[
      { type:'status', status:'deadlyPoison', chance:33, chanceIfStatus:{ poison:100 }, duration:99 },
      { type:'status', status:'paralysis', chance:13, duration:1 },
      { type:'status', status:'sleep', chance:13, duration:5 },
      { type:'status', status:'confusion', chance:13, duration:1 }
    ]
  }),

  // グノーム
  'ごうりきの土': skill('ごうりきの土', { kind:'effect', target:'all', attackType:'magic', effects:[{ type:'enemyPostActionAttackGain', value:10 }] }),
  'がんきょうの土': skill('がんきょうの土', { kind:'effect', target:'all', attackType:'magic', effects:[{ type:'enemyDefenseBuff', value:65, duration:3, attackTypes:['physical'] }] }),
  'ロック!!': skill('ロック!!', { kind:'attack', multiplier:150, target:'random', attackType:'magic', attributes:['earth'] }),
  'ロック!!!': skill('ロック!!!', { kind:'attack', multiplier:200, target:'random', attackType:'magic', attributes:['earth'] }),
  'ロック!!!!': skill('ロック!!!!', { kind:'attack', multiplier:250, target:'random', attackType:'magic', attributes:['earth'] }),
  'グランドスタンプ': skill('グランドスタンプ', { kind:'attack', multiplier:60, target:'all', attackType:'physical', attributes:['earth'], effects:[{ type:'status', status:'paralysis', chance:37, duration:1 }] }),

  // アイアンドラゴン
  'はがねのしっぽ': skill('はがねのしっぽ', { kind:'attack', multiplier:90, target:'all', attackType:'physical', attributes:['none'], effects:[{ type:'status', status:'paralysis', chance:15, duration:1 }] }),
  'くろがねのしっぽ': skill('くろがねのしっぽ', { kind:'attack', multiplier:120, target:'all', attackType:'physical', attributes:['none'], effects:[{ type:'status', status:'paralysis', chance:20, duration:1 }] }),
  'ソリッドブレス': skill('ソリッドブレス', { kind:'attack', multiplier:150, target:'all', attackType:'breath', attributes:['none'] }),
  'ブレイクブラスト': skill('ブレイクブラスト', { kind:'attack', multiplier:170, target:'all', attackType:'breath', attributes:['none'] }),
  // 反撃ダメージは無視し、こちらの物理与ダメージ40%軽減だけを2ターン再現。
  'アイアンカウンター': skill('アイアンカウンター', { kind:'effect', target:'self', attackType:'other', effects:[{ type:'enemyCounterGuard', value:40, duration:2, attackTypes:['physical'], nonStacking:true, stackKey:'アイアンカウンター:物理', onHitEnemyExGain:1 }] }),

  // v0.5.23: 追加BOSS／お供。v0.5.26以降は純粋な敵攻撃は完全に無視し、
  // 状態異常など撃破確率へ影響する追加効果がある技だけ対象抽選を追跡する。
  'とっしん': skill('とっしん', { kind:'attack', multiplier:200, target:'random', attackType:'physical', attributes:['none'] }),
  'プロペラソード': skill('プロペラソード', { kind:'attack', multiplier:150, hits:2, target:'randomEachHit', attackType:'physical', attributes:['wind'] }),
  'ソバット': skill('ソバット', { kind:'attack', multiplier:125, target:'random', attackType:'physical', attributes:['none'] }),
  'ドロップキック': skill('ドロップキック', { kind:'attack', multiplier:200, target:'random', attackType:'physical', attributes:['none'] }),
  'チョップ': skill('チョップ', { kind:'attack', multiplier:150, target:'random', attackType:'physical', attributes:['none'] }),
  'ラリアット': skill('ラリアット', { kind:'attack', multiplier:200, target:'random', attackType:'physical', attributes:['none'] }),
  'アイアンクロー': skill('アイアンクロー', { kind:'attack', multiplier:140, target:'random', attackType:'physical', attributes:['none'], effects:[{ type:'status', status:'confusion', chance:30, duration:1 }] }),
  'かみつき!': skill('かみつき!', { kind:'attack', multiplier:150, target:'random', attackType:'physical', attributes:['none'] }),
  'かみつき!!': skill('かみつき!!', { kind:'attack', multiplier:180, target:'random', attackType:'physical', attributes:['none'] }),
  'マヒかみつき': skill('マヒかみつき', { kind:'attack', multiplier:120, target:'random', attackType:'physical', attributes:['none'], effects:[{ type:'status', status:'paralysis', chance:25, duration:1 }] }),
  'マヒかみつき!': skill('マヒかみつき!', { kind:'attack', multiplier:150, target:'random', attackType:'physical', attributes:['none'], effects:[{ type:'status', status:'paralysis', chance:30, duration:1 }] }),
  'ちょうちん': skill('ちょうちん', { kind:'effect', target:'all', attackType:'other', effects:[{ type:'status', status:'darkness', chance:30, duration:3 }] }),
  '足ばらい': skill('足ばらい', { kind:'attack', multiplier:40, target:'all', attackType:'physical', attributes:['none'], effects:[{ type:'status', status:'paralysis', chance:15, duration:1 }] }),
  // かばう系の仁王立ち／ベンケイ立ちはユーザー指定により撃破確率では無視する。
  '仁王立ち': skill('仁王立ち', { kind:'effect', target:'self', attackType:'other', effects:[] }),
  'ベンケイ立ち': skill('ベンケイ立ち', { kind:'effect', target:'self', attackType:'other', effects:[] }),
  'ウィンド': skill('ウィンド', { kind:'attack', multiplier:100, target:'random', attackType:'magic', attributes:['wind'] }),
  'ウィンド!': skill('ウィンド!', { kind:'attack', multiplier:150, target:'random', attackType:'magic', attributes:['wind'] }),
  'ウィンド!!': skill('ウィンド!!', { kind:'attack', multiplier:200, target:'random', attackType:'magic', attributes:['wind'] }),
  'ウィンド!!!': skill('ウィンド!!!', { kind:'attack', multiplier:250, target:'random', attackType:'magic', attributes:['wind'] }),
  // v0.5.65: ダムキナ。味方単体回復は生存中のBOSS＋お供からCPU完全ランダムで対象選択する。
  // めぐみの風の風属性攻撃強化は敵純粋ダメージのみなので省略。
  'いやしの風': skill('いやしの風', { kind:'heal', value:60, target:'enemySingle', attackType:'other' }),
  'めぐみの風': skill('めぐみの風', {
    kind:'heal', value:90, target:'enemySingle', attackType:'other',
    effects:[{ type:'enemyStatusCure' }]
  }),
  // 参謀エンリル。3ターン、自身への物理攻撃を50%で行動単位回避する。
  // 同時に攻撃+10（重ね掛け可）もあるが、敵→味方の純粋ダメージを追跡しない現行撃破率では数値結果に影響しないため省略。
  'ミラージュ': skill('ミラージュ', {
    kind:'effect', target:'self', attackType:'magic',
    effects:[{ type:'companionSelfPhysicalEvasion', chance:50, duration:3, stackKey:'ミラージュ:物理回避' }]
  }),
  '補給命令': skill('補給命令', { kind:'heal', value:70, target:'enemyTeam', attackType:'other' }),
  '特配': skill('特配', { kind:'heal', value:90, target:'enemyTeam', attackType:'other' }),
  'アクアカッター': skill('アクアカッター', { kind:'attack', multiplier:250, target:'random', attackType:'physical', attributes:['water'] }),
  // 召喚後の新規行動者追加は別段階で実装する。技自体は明示的に未処理として残すためここには登録しない。

  // フィスカ。アイスバインドは火属性への二段階麻痺判定をengine側で専用処理する。
  'アイスデン': skill('アイスデン', { kind:'effect', target:'self', attackType:'other', effects:[{ type:'enemyDefenseBuff', value:100, duration:2, attributes:['fire'], nonStacking:true, stackKey:'アイスデン:火属性無効', scope:'enemyTeam' }] }),
  'アイスパーティクル': skill('アイスパーティクル', { kind:'attack', multiplier:200, multiplierMin:150, multiplierMax:250, multiplierStep:0.1, target:'random', attackType:'magic', attributes:['ice'] }),
  'アイスバインド': skill('アイスバインド', { kind:'iceBind', target:'random', attackType:'magic', attributes:['ice'] }),

  // v0.5.25: 大魔皇クジェスカ／大魔王ムウス／薄氷の剣士ダンテ。
  // 敵ダメージ量そのものは計算対象外。v0.5.26以降、追加効果のない純粋な攻撃は物理でも完全に無視する。
  'アイスバーグ': skill('アイスバーグ', { kind:'attack', multiplier:190, target:'random', attackType:'magic', attributes:['ice'] }),
  'ホワイトルシアン': skill('ホワイトルシアン', { kind:'attack', multiplier:150, multiplierIfAttribute:{ water:30 }, target:'all', attackType:'magic', attributes:['ice'] }),
  'モスコミューズ': skill('モスコミューズ', {
    kind:'effect', target:'all', attackType:'magic',
    effects:[{ type:'status', status:'sleep', chance:15, chanceIfAttribute:{ fire:42.2, wind:42.2, earth:42.2, light:42.2, dark:42.2 }, duration:5 }]
  }),
  '大魔王の一撃': skill('大魔王の一撃', { kind:'attack', target:'all', attackType:'physical', attributes:['none'] }),
  'グリルファイア': skill('グリルファイア', { kind:'attack', multiplier:180, target:'random', attackType:'magic', attributes:['fire'] }),
  // グリルブーストの次ターン高威力攻撃・火傷は、現在の「敵ダメージを計算しない」モードでは撃破率へ影響しない。
  'グリルブースト': skill('グリルブースト', { kind:'effect', target:'self', attackType:'magic', effects:[] }),
  'アイスウェイブ': skill('アイスウェイブ', { kind:'attack', multiplier:90, target:'all', attackType:'physical', attributes:['ice'] }),
  'アイスウェイブ・グラン': skill('アイスウェイブ・グラン', { kind:'attack', multiplier:135, target:'all', attackType:'physical', attributes:['ice'] }),
  '氷葬の儀': skill('氷葬の儀', { kind:'effect', target:'self', attackType:'other', effects:[{ type:'enemyAtkBuff', mode:'mult', value:120, duration:99 }] }),
  '血凍の太刀': skill('血凍の太刀', { kind:'attack', multiplier:235, target:'random', attackType:'physical', attributes:['ice'], effects:[{ type:'status', status:'paralysis', chance:20, duration:1 }] }),

  // v0.5.26: 絢蘭竜ククルカン。アロマは同名コマンドを全てミス化して、その場で再行動する。
  // ポイズン・アロマの猛毒は味方の行動/与ダメージへ影響しないため、反撃ダメージ同様に追跡しない。
  'ポイズン・アロマ': skill('ポイズン・アロマ', {
    kind:'effect', target:'self', attackType:'other', turnContinue:true,
    effects:[{ type:'disableEnemyCommandName', commandName:'ポイズン・アロマ' }]
  }),
  'スリープ・アロマ': skill('スリープ・アロマ', {
    kind:'effect', target:'self', attackType:'other', turnContinue:true,
    effects:[
      { type:'enemyReactiveStatus', status:'sleep', chance:40, reactionDuration:2, statusDuration:5, triggerAttackTypes:['physical'], nonStacking:true, stackKey:'スリープ・アロマ' },
      { type:'disableEnemyCommandName', commandName:'スリープ・アロマ' }
    ]
  }),
  'イチリンザシ': skill('イチリンザシ', { kind:'attack', multiplier:180, target:'random', attackType:'physical', attributes:['none'] }),
  'ウイングビート': skill('ウイングビート', {
    kind:'attack', multiplier:110, multiplierIfStatus:{ sleep:150 }, target:'all', attackType:'physical', attributes:['wind'],
    effects:[{ type:'status', status:'paralysis', chance:100, duration:1, requiresStatusAtHit:'sleep' }]
  }),

  // v0.5.27: チヴィエール／デスフィアープラント。
  // 純粋なダメージ・毒は無視し、混乱、リール低下、永続ステータス低下だけ追跡する。
  'プチメテオ': skill('プチメテオ', { kind:'attack', multiplier:150, target:'random', attackType:'magic', attributes:['all'] }),
  'ヒメの笑い声': skill('ヒメの笑い声', {
    kind:'effect', target:'all', attackType:'other',
    effects:[{ type:'status', status:'confusion', chance:50, duration:1 }]
  }),
  'アクマのながしめ': skill('アクマのながしめ', {
    kind:'attack', multiplier:50, target:'random', attackType:'other', attributes:['evil'],
    effects:[{ type:'allyReelShift', amount:-1, target:'damaged' }]
  }),
  'アクマのくちづけ': skill('アクマのくちづけ', {
    kind:'attack', multiplier:50, target:'random', attackType:'other', attributes:['evil'],
    effects:[{ type:'allyReelShift', amount:-2, target:'damaged' }]
  }),
  // お供HP/撃破を追跡するため、蘇生による再ターゲット化も撃破率へ反映する。
  'ふっかつの秘法': skill('ふっかつの秘法', {
    kind:'effect', target:'enemyTeam', attackType:'magic',
    // 離脱した味方1体を最大HPで完全蘇生する。BOSS自身は蘇生対象外。
    effects:[{ type:'reviveEnemyCompanionFull' }]
  }),
  'パワーロートブレス': skill('パワーロートブレス', {
    kind:'attack', multiplier:90, target:'all', attackType:'breath', attributes:['poison'],
    effects:[{ type:'progressiveStatDecay', stat:'attack', factor:0.9, target:'damaged' }]
  }),
  'スピードロートブレス': skill('スピードロートブレス', {
    kind:'attack', multiplier:90, target:'all', attackType:'breath', attributes:['poison'],
    effects:[{ type:'progressiveStatDecay', stat:'speed', factor:0.82, target:'damaged' }]
  }),



  // v0.5.31: 呪い系BOSS。敵ダメージは無視し、呪いによる離脱だけ追跡する。
  'ノロイの息': skill('ノロイの息', {
    kind:'attack', target:'all', attackType:'breath', attributes:['evil'],
    effects:[{ type:'status', status:'curse', chance:40, duration:4, target:'damaged' }]
  }),
  '呪殺の息': skill('呪殺の息', {
    kind:'attack', target:'all', attackType:'breath', attributes:['evil'],
    effects:[{ type:'status', status:'curse', chance:30, duration:4, target:'damaged' }]
  }),
  '復讐のツメ': skill('復讐のツメ', {
    kind:'attack', target:'random', attackType:'physical', attributes:['evil'],
    effects:[{ type:'status', status:'curse', chance:40, duration:4, target:'damaged' }]
  }),
  'ウラミのツメ': skill('ウラミのツメ', { kind:'attack', target:'random', attackType:'physical', attributes:['evil'] }),
  '呪いのツメ': skill('呪いのツメ', {
    kind:'attack', target:'random', attackType:'physical', attributes:['dark'],
    effects:[{ type:'status', status:'curse', chance:15, duration:4, target:'damaged' }]
  }),
  'イエローアースブレス': skill('イエローアースブレス', { kind:'attack', target:'all', attackType:'breath', attributes:['earth'] }),

  // v0.5.32: 金陽のミカエル／聖竜アークドラゴン。
  // 純粋ダメージは無視し、即死・状態異常回避・技変化・行動順へ関わる速度強化だけを追跡する。
  '太陽の加護': skill('太陽の加護', {
    kind:'effect', target:'self', attackType:'physical', replaceUsedSlotWith:'金色の刻印',
    effects:[
      { type:'enemyStatusCure' },
      { type:'enemyStatusAvoid', value:45, duration:3, nonStacking:true, stackKey:'太陽の加護:状態異常回避' }
    ]
  }),
  '金色の刻印': skill('金色の刻印', {
    kind:'effect', target:'self', attackType:'physical',
    effects:[
      { type:'enemyAtkBuff', mode:'mult', value:140, duration:2, nonStacking:true, stackKey:'金色の刻印:攻撃' },
      // speedBuff系は従来「上昇量%」入力なので +40 = ×1.4。
      { type:'enemySpeedBuff', mode:'mult', value:40, duration:2, nonStacking:true, stackKey:'金色の刻印:素早さ' }
    ]
  }),
  'ライト・イレイザー': skill('ライト・イレイザー', {
    kind:'attack', target:'random', attackType:'magic', attributes:['light'],
    effects:[{ type:'instantDeath', status:'instantDeath', chance:50, chanceIfRace:{ demon:100 }, target:'damaged' }]
  }),
  'リヒト!!!!': skill('リヒト!!!!', { kind:'attack', target:'random', attackType:'magic', attributes:['light'] }),
  '低空ダイブ': skill('低空ダイブ', { kind:'attack', target:'random', attackType:'physical', attributes:['none'] }),
  'グランダイブ': skill('グランダイブ', { kind:'attack', target:'random', attackType:'physical', attributes:['none'] }),

  // v0.5.61: 赤のプリンセスの味方単体リール+1を実計算化。
  // CPUの味方単体対象選択は完全ランダムとして、BOSS自身＋生存お供を等確率で分岐する。
  'プリンセスのおうえん': skill('プリンセスのおうえん', {
    kind:'effect', target:'enemyTeam', attackType:'magic',
    effects:[{ type:'enemyTeamSingleReelShift', amount:1 }]
  }),
  // ドウン!は追加効果のない単体魔法攻撃。敵ダメージのみなので発動だけ保持する。
  'ドウン!': skill('ドウン!', { kind:'attack', target:'random', attackType:'magic', attributes:['evil'] }),
  // 死神グリムの即死。アンデッドは無効。属性即死系は対応属性かつ☆3以下だけ100%判定。
  'デス': skill('デス', {
    kind:'attack', target:'random', attackType:'magic', attributes:['dark'],
    effects:[{ type:'instantDeath', status:'instantDeath', chance:60, immuneRaces:['undead'], target:'damaged' }]
  }),
  '火は消える': skill('火は消える', {
    kind:'attack', target:'random', attackType:'magic',
    effects:[{ type:'instantDeath', status:'instantDeath', chance:100, requiredAttribute:'fire', maxStar:3, immuneRaces:['undead'], target:'damaged' }]
  }),
  '水は涸れる': skill('水は涸れる', {
    kind:'attack', target:'random', attackType:'magic',
    effects:[{ type:'instantDeath', status:'instantDeath', chance:100, requiredAttribute:'water', maxStar:3, immuneRaces:['undead'], target:'damaged' }]
  }),
  '土は崩れる': skill('土は崩れる', {
    kind:'attack', target:'random', attackType:'magic',
    effects:[{ type:'instantDeath', status:'instantDeath', chance:100, requiredAttribute:'earth', maxStar:3, immuneRaces:['undead'], target:'damaged' }]
  }),
  '風は止む': skill('風は止む', {
    kind:'attack', target:'random', attackType:'magic',
    effects:[{ type:'instantDeath', status:'instantDeath', chance:100, requiredAttribute:'wind', maxStar:3, immuneRaces:['undead'], target:'damaged' }]
  }),

  // v0.5.33: 光王エーリュシオン／死霊使いワイト。
  // エーリュシオンの「罰」は追撃ダメージだけなので現モデルでは発動のみ保持する。
  '浄化の炎': skill('浄化の炎', { kind:'attack', multiplier:50, target:'all', attackType:'magic', attributes:['fire','holy'] }),
  '色欲の罰': skill('色欲の罰', { kind:'attack', multiplier:80, target:'all', attackType:'magic', attributes:['holy'] }),
  '憤怒の罰': skill('憤怒の罰', { kind:'effect', target:'self', attackType:'magic', effects:[] }),
  '怠惰の罰': skill('怠惰の罰', { kind:'effect', target:'self', attackType:'magic', effects:[] }),
  '大食の罰': skill('大食の罰', { kind:'effect', target:'self', attackType:'magic', effects:[] }),
  '聖なる光': skill('聖なる光', { kind:'attack', target:'random', attackType:'magic', attributes:['holy'] }),
  '聖なる一撃': skill('聖なる一撃', { kind:'attack', target:'random', attackType:'physical', attributes:['holy'] }),
  // カマエルの攻撃力加算は敵から受けるダメージだけを変えるため、撃破率では発動のみ保持する。
  '力天使の加護': skill('力天使の加護', { kind:'effect', target:'enemyTeam', attackType:'magic', effects:[] }),
  // ワイトの召喚。アルラウネ召喚は空き枠を可能な限りアルラで埋める。
  'アルラウネ召喚': skill('アルラウネ召喚', {
    kind:'effect', target:'self', attackType:'magic',
    effects:[{ type:'summonCompanion', name:'アルラ', startReel:0, fillEmpty:true }]
  }),
  'アンデッド召喚★★★': skill('アンデッド召喚★★★', {
    kind:'effect', target:'self', attackType:'magic',
    effects:[{ type:'summonCompanion', name:'アルラウネ', startReel:0 }]
  }),
  // かばう部分はユーザー指定により再現しない。
  'アンデッドガード': skill('アンデッドガード', { kind:'effect', target:'enemyTeam', attackType:'physical', effects:[] }),
  // アルラ系がいれば全て自爆で離脱。いなければ同名コマンドをその再行動中だけミス扱いにして再抽選する。
  'アルラウネアタック': skill('アルラウネアタック', {
    kind:'effect', target:'all', attackType:'physical',
    turnContinueIfNoActiveCompanionNames:['アルラ','アルラウネ'],
    effects:[{ type:'consumeCompanions', names:['アルラ','アルラウネ'] }]
  }),
  // 自身以外への55%毒。味方側への毒ダメージは無視するが、敵BOSS自身への毒→猛毒化は撃破率へ影響するので追跡する。
  'どくガス': skill('どくガス', {
    kind:'effect', target:'all', attackType:'physical',
    effects:[{ type:'enemyPoisonProgression', chance:55 }]
  }),

  // v0.5.38: 吸血竜ヴァンプスドラゴン／魔海竜シーサーペント。
  // 吸血系は与ダメージの70%をBOSS HPへ還元するため、敵側の純粋ダメージを通常は無視する方針の例外として
  // ダメージ分布を回復量の算出にだけ使用する。
  '吸血': skill('吸血', { kind:'lifestealAttack', multiplier:100, healRate:70, target:'random', attackType:'physical', attributes:['evil'] }),
  '吸血!': skill('吸血!', { kind:'lifestealAttack', multiplier:130, healRate:70, target:'random', attackType:'physical', attributes:['evil'] }),
  '吸血!!': skill('吸血!!', { kind:'lifestealAttack', multiplier:150, healRate:70, target:'random', attackType:'physical', attributes:['evil'] }),
  '吸血!!!': skill('吸血!!!', { kind:'lifestealAttack', multiplier:170, healRate:70, target:'random', attackType:'physical', attributes:['evil'] }),
  'ブラックデプス': skill('ブラックデプス', { kind:'attack', multiplier:125, target:'all', attackType:'breath', attributes:['water','dark'] }),
  '海竜の舌なめずり': skill('海竜の舌なめずり', { kind:'effect', target:'enemyTeam', attackType:'other', effects:[{ type:'seaDragonTongueEx', base:3, perWaterRace:2 }] }),
  'アビスコール': skill('アビスコール', {
    kind:'effect', target:'all', attackType:'magic',
    effects:[{ type:'status', status:'curse', chance:65, duration:4 }]
  }),
  '常闇のいき': skill('常闇のいき', {
    kind:'attack', multiplier:135, target:'all', attackType:'breath', attributes:['dark'],
    effects:[{ type:'status', status:'darkness', chance:15, duration:3, target:'damaged' }]
  }),

  // v0.5.30: 闇の女神官／ファントム。
  // ダメージそのものではなく、沈黙・防御・洗脳・こちらの攻撃/速度バフ解除だけを撃破率へ反映する。
  'ダーク': skill('ダーク', { kind:'attack', target:'random', attackType:'magic', attributes:['dark'], effects:[{ type:'status', status:'silence', chance:15, duration:3, target:'damaged' }] }),
  'ダーク!': skill('ダーク!', { kind:'attack', target:'random', attackType:'magic', attributes:['dark'], effects:[{ type:'status', status:'silence', chance:40, duration:3, target:'damaged' }] }),
  'ダーク!!': skill('ダーク!!', { kind:'attack', target:'random', attackType:'magic', attributes:['dark'], effects:[{ type:'status', status:'silence', chance:50, duration:3, target:'damaged' }] }),
  'ダーク!!!': skill('ダーク!!!', { kind:'attack', target:'random', attackType:'magic', attributes:['dark'], effects:[{ type:'status', status:'silence', chance:60, duration:3, target:'damaged' }] }),
  '宵闇の裁き': skill('宵闇の裁き', {
    kind:'attack', target:'random', attackType:'magic', attributes:['dark'], turnContinue:true,
    effects:[{ type:'disableEnemyCommandNameDuringChain', commandName:'宵闇の裁き' }]
  }),
  '宵闇の杖': skill('宵闇の杖', {
    kind:'effect', target:'self', attackType:'other', turnContinue:true,
    effects:[{ type:'disableEnemyCommandNameDuringChain', commandName:'宵闇の杖' }]
  }),
  '冥界の城': skill('冥界の城', {
    kind:'effect', target:'enemyTeam', attackType:'magic', turnContinue:true,
    effects:[
      { type:'enemyDefenseBuff', value:10, duration:5, stackRefreshGroup:'冥界の城:防御', scope:'enemyTeam' },
      { type:'disableEnemyCommandNameDuringChain', commandName:'冥界の城' }
    ]
  }),
  'ステアボイス': skill('ステアボイス', { kind:'stareVoice', target:'random', attackType:'breath' }),
  'リチャーズ・バーン': skill('リチャーズ・バーン', {
    kind:'attack', target:'all', attackType:'magic', attributes:['fire'],
    effects:[{ type:'purgeOffensiveBeneficial', target:'all' }]
  }),
  '幻影のチェイサー': skill('幻影のチェイサー', { kind:'attack', target:'random', attackType:'physical', attributes:['evil'] }),

  // v0.5.29: 大樹竜ルートドラゴン系。
  // 敵側の対プレイヤーダメージ量は追跡せず、敵チームHP回復・被ダメ軽減・行動順に関わる速度成長を反映する。
  'ディープグリーンブレス': skill('ディープグリーンブレス', {
    kind:'heal', value:60, target:'enemyTeam', attackType:'breath',
    effects:[{ type:'enemyDefenseBuff', value:15, duration:3, nonStacking:true, stackKey:'ディープグリーンブレス:防御', scope:'enemyTeam' }]
  }),
  'パワー・グロウ': skill('パワー・グロウ', { kind:'effect', target:'enemyTeam', attackType:'physical', effects:[] }),
  'スピード・グロウ': skill('スピード・グロウ', { kind:'effect', target:'enemyTeam', attackType:'physical', effects:[] }),
  'スピリット・グロウ': skill('スピリット・グロウ', {
    kind:'effect', target:'enemyTeam', attackType:'physical', enemyExGain:1,
    // 発動時EX+1に加え、自身以外の味方へ『行動後EX+1』を付与する。
    effects:[{ type:'companionPostActionEnemyExGain', value:1, nonStacking:true }]
  }),
  // BOSS戦では初期3枠が埋まっているため、開始時点ではブランチによる追加召喚余地がない。
  'ブランチ': skill('ブランチ', { kind:'effect', target:'self', attackType:'other', effects:[{ type:'summonCompanion', name:'ルートン', startReel:0 }] }),

  // v0.5.28: 魔神アープ／研究者カイス。
  // ダメージだけの攻撃は登録だけ行い、撃破率計算では無視する。
  'アクア': skill('アクア', { kind:'attack', target:'random', attackType:'magic', attributes:['water'] }),
  'アクア!': skill('アクア!', { kind:'attack', target:'random', attackType:'magic', attributes:['water'] }),
  'アクア!!': skill('アクア!!', { kind:'attack', target:'random', attackType:'magic', attributes:['water'] }),
  'アクア!!!': skill('アクア!!!', { kind:'attack', target:'random', attackType:'magic', attributes:['water'] }),
  'アクア!!!!': skill('アクア!!!!', { kind:'attack', target:'random', attackType:'magic', attributes:['water'] }),
  'ウェットスライサー': skill('ウェットスライサー', { kind:'attack', multiplier:50, hits:4, target:'randomEachHit', attackType:'physical', attributes:['water'] }),
  'きよめの水': skill('きよめの水', {
    kind:'heal', value:20, target:'enemyTeam', attackType:'other',
    effects:[{ type:'enemyStatusCure' }]
  }),
  '粘着攻撃': skill('粘着攻撃', {
    kind:'attack', target:'random', attackType:'physical', attributes:['none'],
    effects:[
      { type:'allySpeedDebuff', mode:'add', value:30, duration:99, target:'damaged' },
      { type:'status', status:'paralysis', chance:30, duration:1, target:'damaged' }
    ]
  }),
  '試作魔銃': skill('試作魔銃', { kind:'attack', target:'random', attackType:'physical', attributes:['none'] }),
  'ロボ修復': skill('ロボ修復', {
    // 機械族の味方1体を120回復し、状態異常を全快する。CPU単体対象は等確率。
    kind:'heal', value:120, target:'enemySingle', targetRace:'machine', attackType:'physical',
    effects:[{ type:'enemyStatusCure' }]
  }),
  'ワンツーパンチ': skill('ワンツーパンチ', {
    kind:'attack', target:'random', attackType:'physical', attributes:['none'],
    effects:[{ type:'status', status:'paralysis', chance:25, duration:1, target:'damaged' }]
  }),
  'クロスカウンター': skill('クロスカウンター', {
    kind:'effect', target:'self', attackType:'other',
    // 1ターン物理被ダメージ半減。反撃ダメージは味方HP非追跡のため省略。
    effects:[{ type:'enemySelfDefenseBuff', value:50, duration:1, attackTypes:['physical'], nonStacking:true, stackKey:'クロスカウンター:物理半減' }]
  }),
  // 毒65%は味方の行動・与ダメージへ影響しないため、技定義上は攻撃だけ保持する。
  'ヘルスロートブレス': skill('ヘルスロートブレス', { kind:'attack', multiplier:70, target:'all', attackType:'breath', attributes:['poison'] }),

  // v0.5.24: ファンロン／ヴォルケイノドラゴン／グレイシアドラゴン。
  // 純粋な敵ダメージは計算外だが、こちらの与ダメージへ影響する防御効果は保持する。
  '土剋水の息': skill('土剋水の息', { kind:'attack', multiplier:170, target:'all', attackType:'breath', attributes:['poison'] }),
  '五黄土星': skill('五黄土星', {
    kind:'attack', multiplier:170, target:'all', attackType:'physical', attributes:['earth'],
    effects:[{ type:'enemyDefenseBuff', value:10, duration:3, nonStacking:true, stackKey:'五黄土星:防御', scope:'enemyTeam' }]
  }),
  'かたいしっぽ': skill('かたいしっぽ', {
    kind:'attack', multiplier:90, target:'all', attackType:'physical', attributes:['none'],
    effects:[{ type:'enemyDefenseBuff', value:15, duration:3, attackTypes:['physical'], nonStacking:true, stackKey:'かたいしっぽ:物理防御' }]
  }),
  'スピットファイア': skill('スピットファイア', { kind:'attack', multiplier:200, target:'random', attackType:'breath', attributes:['fire'] }),
  'マグマブレス': skill('マグマブレス', { kind:'attack', multiplier:120, target:'all', attackType:'breath', attributes:['heat'] }),
  'マグマアーマー': skill('マグマアーマー', {
    kind:'effect', target:'self', attackType:'other',
    effects:[
      { type:'enemyDefenseBuff', value:50, duration:3, attackTypes:['physical'], nonStacking:true, stackKey:'マグマアーマー:物理' },
      { type:'enemyDefenseBuff', value:50, duration:3, attributes:['water'], nonStacking:true, stackKey:'マグマアーマー:水' }
    ]
  }),
  'つめたいしっぽ': skill('つめたいしっぽ', {
    kind:'attack', multiplier:75, target:'all', attackType:'physical', attributes:['ice'],
    effects:[{ type:'enemyDefenseBuff', value:15, duration:3, attackTypes:['physical'], nonStacking:true, stackKey:'つめたいしっぽ:物理防御' }]
  }),
  'スピットアイス': skill('スピットアイス', { kind:'attack', multiplier:190, target:'random', attackType:'breath', attributes:['ice'] }),
  'オーロラブレス': skill('オーロラブレス', { kind:'attack', multiplier:100, target:'all', attackType:'breath', attributes:['ice','light'], effects:[{ type:'auroraExTransfer' }] }),
  'オーロラアーマー': skill('オーロラアーマー', {
    kind:'effect', target:'self', attackType:'other',
    effects:[{ type:'enemyDefenseBuff', value:35, duration:3, attackTypes:['physical'], nonStacking:true, stackKey:'オーロラアーマー:物理防御', onHitEnemyExGain:1, onHitPlayerExLoss:1 }]
  }),

  // 風隠の族長オロシ。毒は撃破行動を阻害しないため省略。
  '菖蒲の扇': skill('菖蒲の扇', { kind:'attack', multiplier:120, target:'random', attackType:'physical', attributes:['wind','poison'] }),
  '山吹の扇': skill('山吹の扇', { kind:'attack', multiplier:120, target:'random', attackType:'physical', attributes:['wind','poison'], effects:[{ type:'status', status:'confusion', chance:30, duration:1 }] }),
  '御伽莉花の幻': skill('御伽莉花の幻', { kind:'oroshiIllusion', target:'random', attackType:'magic' }),

  // バローロ
  '海王の一撃': skill('海王の一撃', { kind: 'attack', multiplier: 110, target: 'all', attackType: 'physical', attributes: ['water','dark'] }),
  '海帝の一撃': skill('海帝の一撃', { kind: 'attack', multiplier: 115, target: 'all', attackType: 'physical', attributes: ['water','evil'] }),
  '深海の抱擁': skill('深海の抱擁', {
    kind: 'percentHp', percent: 33, target: 'all', attackType: 'magic', attributes: ['water','dark'],
    effects: [
      { type: 'damageTakenUp', value: 10, duration: 2 },
      { type: 'statusVulnerability', value: 10, duration: 2 }
    ]
  }),
  '暗寧のシジマ': skill('暗寧のシジマ', {
    kind: 'effect', target: 'all', attackType: 'magic',
    effects: [
      { type: 'allySpeedDebuff', value: 40, duration: 99, nonStacking: true },
      { type: 'status', status: 'silence', chance: 30, duration: 3 },
      { type: 'status', status: 'sleep', chance: 35, duration: 5 }
    ]
  }),
  '浸食する潮': skill('浸食する潮', {
    kind: 'effect', target: 'all', attackType: 'magic',
    effects: [
      { type: 'allySpeedDebuff', value: 30, duration: 99, nonStacking: true },
      { type: 'status', status: 'poison', chance: 50, duration: 99 },
      { type: 'status', status: 'confusion', chance: 50, duration: 1 }
    ]
  })
});

const profile = (attack, matrix, skills = null) => Object.freeze({
  attack,
  matrix: Object.freeze(matrix.map(row => Object.freeze(row.slice()))),
  ...(skills ? { skills:Object.freeze(skills) } : {})
});

const BOSS_COMMAND_PROFILES = Object.freeze({
  // v0.5.23: 状態異常・味方火力へ影響する未対応BOSSを追加。
  old0_quicksilver: profile(55, [
    ['ミス','ミス','こうげき','こうげき!','★→★★','★→★★'],
    ['ミス','こうげき','こうげき!','とっしん','★★→★★★','★★→★★★'],
    ['こうげき','こうげき!','とっしん','はしりまわり','★★★→★★★★','★★★→★★★★'],
    ['こうげき!','とっしん','はしりまわり','あばれまわり','★★★★→★★★★★','★★★★→★★★★★'],
    ['とっしん','はしりまわり','あばれまわり','あばれまわり','★★★★★→★','★★★★★→★']
  ]),

  old0_heavy_behemoth: profile(60, [
    ['ミス','ミス','こうげき','ためる','ためる','ためる'],
    ['ミス','こうげき','こうげき','ためる','ためる','ためる'],
    ['こうげき','こうげき','こうげき','ためる','ためる','ためる'],
    ['おしつぶし','おしつぶし','おしつぶし','ためる','ためる','ためる'],
    ['とっしん','とっしん','とっしん','ためる','ためる','ためる'],
    ['あばれまわり','あばれまわり','あばれまわり','あばれまわり','あばれまわり','あばれまわり']
  ]),

  // v0.5.35: 第7章。BOSS専用リールをそのまま登録。
  old7_son_goku: profile(60, [
    ['ミス','こうげき','こうげき','★→★★','こうげき!','会心の一撃'],
    ['こうげき','こうげき','こうげき!','★★→★★★','こうげき!','会心の一撃'],
    ['こうげき','こうげき!','こうげき!','★★★→★★★★','会心の一撃','如意棒'],
    ['こうげき!','こうげき!','会心の一撃','★★★★→★★★★★','如意棒','如意棒'],
    ['こうげき!','会心の一撃','会心の一撃','★★★★★→★★★★★★','如意棒','あばれまくり'],
    ['こうげき!','会心の一撃','如意棒','如意棒','あばれまくり','あばれまくり']
  ]),

  old7_maotai: profile(65, [
    ['ほほえんでいる','こうげき','秘宗重拳','ためる','★→★★','無影暗殺拳'],
    ['ほほえんでいる','無影暗殺拳','無影暗殺拳','ためる','ためる','秘宗重拳'],
    ['こうげき','こうげき!','こうげき!','★★★→★★★★','★★★→★★★★','★★★→★★★★'],
    ['秘宗重拳','秘宗重拳','無影暗殺拳','★★★★→★★★★★','ためる','無影暗殺拳'],
    ['こうげき!','こうげき!','魔皇の一撃','★★★★★→★★★★★★','ためる','無影暗殺拳'],
    ['ほほえんでいる','魔皇の一撃','魔皇の一撃','★★★★★★→★★★★★★★','★★★★★★→★★★★★★★','秘宗重拳'],
    ['こうげき!','魔皇の一撃','魔皇の一撃','無影暗殺拳','無影暗殺拳','秘宗重拳']
  ]),

  // v0.5.36: 新序章。BOSS専用コマンド表を登録。
  new0_damkina: profile(60, [
    ['ミス','ウィンド','★→★★','ウィンド!','★→★★','ウィンド!!'],
    ['いやしの風','ウィンド!','★★→★★★','ウィンド!','★★→★★★','ウィンド!!'],
    ['こうげき','ウィンド!','★★★→★★★★','★★★→★★★★','★★★→★★★★','ウィンド!!'],
    ['いやしの風','ためる','★★★★→★★★★★','めぐみの風','★★★★→★★★★★','ウィンド!!!'],
    ['こうげき','いやしの風','★★★★★→★★★★★★','ウィンド!!!','★★★★★→★★★★★★','ウィンド!!!'],
    ['めぐみの風','ウィンド!!','ウィンド!!','ウィンド!!','ウィンド!!!','ウィンド!!!']
  ]),

  new0_marduk: profile(75, [
    ['ミス','★→★★','狂風の乱撃','★→★★','ミス','★→★★'],
    ['こうげき!','ためる','ためる','ためる','こうげき!','会心の一撃'],
    ['ミス','ミス','狂風の乱撃','狂風の乱撃','★★★→★★★★','★★★→★★★★'],
    ['こうげき!','こうげき!','★★★★→★★★★★','★★★★→★★★★★','★★★★→★★★★★','こうげき'],
    ['こうげき!','会心の一撃','★★★★★→★★★★★★','★★★★★→★★★★★★','こうげき!','必殺の一撃'],
    ['★★★★★★→★★★★★★★','ためる','狂風の乱撃','狂風の乱撃','会心の一撃','★★★★★★→★★★★★★★'],
    ['こうげき!','会心の一撃','★★★★★★★→★★★★★★★★','★★★★★★★→★★★★★★★★','狂風の乱撃','狂風の乱撃'],
    ['会心の一撃','必殺の一撃','必殺の一撃','ミス','狂風の乱撃','狂風の乱撃']
  ]),

  // v0.5.37: 新1章／新2章のドラゴンBOSS。
  new1_stream_dragon: profile(60, [
    ['ミス','こうげき','★→★★','こうげき!','★→★★','ウォーターブレス'],
    ['こうげき','こうげき!','★★→★★★','ウォーターブレス','★★→★★★','オプティカルカモフラージュ'],
    ['こうげき','こうげき!','★★★→★★★★','ウォーターブレス','★★★→★★★★','クリアアクアブレス'],
    ['オプティカルカモフラージュ','こうげき!','★★★★→★★★★★','ウォーターブレス','★★★★→★★★★★','ストリームアタック'],
    ['ウォーターブレス','ウォーターブレス','★★★★★→★★★★★★','ストリームアタック','★★★★★→★★★★★★','クリアアクアブレス'],
    ['オプティカルカモフラージュ','ウォーターブレス','クリアアクアブレス','クリアアクアブレス','ストリームアタック','ストリームアタック']
  ]),

  new2_ash_dragon: profile(60, [
    ['ミス','こうげき','こうげき','ためる','★→★★','ヴォイドブレス'],
    ['こうげき!','ひっかき','ひっかき','ためる','★★→★★★','ブラックヴォイドブレス'],
    ['ひっかき','ひっかき','ひっかき!','★★★→★★★★','ためる','ヴォイドブレス'],
    ['ひっかき','ヴォイドブレス','ためる','ためる','ためる','ブラックヴォイドブレス'],
    ['ひっかき','ひっかき!','ひっかき!','★★★★★→★★★★★★','★★★★★→★★★★★★','ブラックヴォイドブレス'],
    ['ひっかき!','ヴォイドブレス','ヴォイドブレス','ブラックヴォイドブレス','ブラックヴォイドブレス','ブラックヴォイドブレス']
  ]),

  // v0.5.38: 新2章／新5章。BOSS専用8リールを登録。
  new2_vamps_dragon: profile(85, [
    ['ミス','こうげき','吸血','吸血!','★→★★','ためる'],
    ['ダーク!!','吸血!!','ダーク!','吸血!','ためる','ためる'],
    ['こうげき','吸血','ダーク!!','吸血!!','★★★→★★★★','★★★→★★★★'],
    ['ダーク!!','ダーク!!','吸血','吸血!!!','ためる','ためる'],
    ['ダーク!!!','ダーク!!','★★★★★→★★★★★★','ミス','★★★★★→★★★★★★','★★★★★→★★★★★★'],
    ['こうげき!','ダーク!!','吸血!','吸血!!!','★★★★★★→★★★★★★★','★★★★★★→★★★★★★★'],
    ['ダーク!!','ダーク!!','吸血!!','吸血!!!','★★★★★★★→★★★★★★★★','★★★★★★★→★★★★★★★★'],
    ['ダーク!!','ダーク!!!','ダーク!!!','ダーク!!!','吸血!!!','吸血!!!']
  ]),

  new5_sea_serpent: profile(65, [
    ['ほほえんでいる','★→★★','こうげき','★→★★','海竜の舌なめずり','ブラックデプス'],
    ['ほほえんでいる','たいあたり','★★→★★★','こうげき!','★★→★★★','ブラックデプス'],
    ['たいあたり','たいあたり','こうげき!','★★★→★★★★','常闇のいき','★★★→★★★★'],
    ['こうげき!','ブラックデプス','★★★★→★★★★★','ブラックデプス','★★★★→★★★★★','海竜の舌なめずり'],
    ['こうげき!','アビスコール','ためる','ためる','ためる','常闇のいき'],
    ['ブラックデプス','海竜の舌なめずり','★★★★★★→★★★★★★★','アビスコール','★★★★★★→★★★★★★★','常闇のいき'],
    ['たいあたり','たいあたり','常闇のいき','常闇のいき','★★★★★★★→★★★★★★★★','★★★★★★★→★★★★★★★★'],
    ['海竜の舌なめずり','こうげき!','ブラックデプス','たいあたり','常闇のいき','アビスコール']
  ]),

  // v0.5.39: 新3章／新4章。BOSS専用7リール。
  new3_nirahalar: profile(65, [
    ['ためる','ほほえんでいる','ためる','ムチミ突き','★→★★','ナンクルマルオーリトーリ'],
    // 公開BOSS表の3マス目には「オーリートーリ」表記があるが、技名側へ合わせて正規化。
    ['ほほえんでいる','ムチミ突き','ナンクルマルオーリトーリ','★★→★★★','★★→★★★','ムチミ突き'],
    ['ためる','★★★→★★★★','ためる','ほほえんでいる','こうげき!','怒涛の攻め'],
    ['ナンクルマルオーリトーリ','サキムイ','ムチミ突き','★★★★→★★★★★','ムチミ突き','★★★★→★★★★★'],
    ['サキムイ','こうげき!','★★★★★→★★★★★★','ムチミ突き','ムチミ突き','★★★★★→★★★★★★'],
    ['ナンクルマルオーリトーリ','ナンクルマルオーリトーリ','ためる','★★★★★★→★★★★★★★','★★★★★★→★★★★★★★','怒涛の攻め'],
    ['サキムイ','ムチミ突き','怒涛の攻め','ムチミ突き','ムチミ突き','怒涛の攻め']
  ]),

  new4_garp: profile(60, [
    ['ガープの物理法則','ガープの物理法則','★→★★','★→★★','★→★★','ガープの物理法則'],
    ['魔将の教鞭','ガープの物理法則','ボルガノン','★★→★★★','ボルガノン','★★→★★★'],
    ['こうげき!','エナジーフィール','★★★→★★★★','ボルガノン','★★★→★★★★','ボルガノン'],
    ['エナジーフィール','ボルガノン','★★★★→★★★★★','ボルガノン','★★★★→★★★★★','ハイクラス・ボルガノン'],
    ['こうげき','ボルガノン','ハイクラス・ボルガノン','★★★★★→★★★★★★','★★★★★→★★★★★★','ハイクラス・ボルガノン'],
    ['こうげき!','エナジーフィール','ハイクラス・ボルガノン','★★★★★★→★★★★★★★','★★★★★★→★★★★★★★','ハイクラス・ボルガノン'],
    ['ボルガノン','ハイクラス・ボルガノン','ハイクラス・ボルガノン','こうげき','ハイクラス・ボルガノン','ハイクラス・ボルガノン']
  ]),

  // v0.5.40: 新4章。BOSS専用7リール。
  new4_avaddon: profile(20, [
    ['ほほえんでいる','ためる','ためる','こうげき!','会心の一撃','★→★★'],
    ['ほほえんでいる','ためる','ためる','魔王の一撃','フードをたべる','★★→★★★'],
    ['こうげき!','魔王の一撃','ためる','ためる','★★★→★★★★','フードをたべる'],
    ['おかわり','こうげき!','会心の一撃','★★★★→★★★★★','★★★★→★★★★★','魔王の一撃'],
    ['こうげき!','★★★★★→★★★★★★','ためる','ためる','魔王の一撃','おかわり'],
    ['会心の一撃','ためる','フードをたべる','ためる','魔王の一撃','ためる'],
    ['こうげき!','こうげき!','魔王の一撃','魔王の一撃','魔王の一撃','おかわり']
  ]),

  // BOSS専用7～8リール表を転記。
  new1_fiska: profile(82, [
    ['ミス','こうげき','アイスバインド','★→★★','アイスパーティクル','アイスパーティクル'],
    ['アイスデン','こうげき!','会心の一撃','★★→★★★','アイスバインド','アイスバインド'],
    ['こうげき','こうげき!','アイスデン','★★★→★★★★','アイスパーティクル','アイスパーティクル'],
    ['アイスバインド','こうげき','会心の一撃','★★★★→★★★★★','会心の一撃','必殺の一撃'],
    ['アイスデン','こうげき!','アイスパーティクル','★★★★★→★★★★★★','アイスパーティクル','必殺の一撃'],
    ['アイスパーティクル','こうげき!','アイスバインド','★★★★★★→★★★★★★★','アイスパーティクル','アイスパーティクル'],
    ['アイスデン','こうげき!','会心の一撃','★★★★★★★→★★★★★★★★','会心の一撃','アイスパーティクル'],
    ['アイスバインド','アイスバインド','会心の一撃','必殺の一撃','アイスパーティクル','アイスパーティクル']
  ]),

  new1_robo_03: profile(55, [
    ['ミス','こうげき','チャージ','チャージ','チャージ','ソバット'],
    ['こうげき','こうげき!','ソバット','★★→★★★','★★→★★★','ドロップキック'],
    ['こうげき!','ソバット','チャージ','チャージ','チャージ','ドロップキック'],
    ['こうげき!','ソバット','ソバット','★★★★→★★★★★','★★★★→★★★★★','ドロップキック'],
    ['ミス','ドロップキック','チャージ','チャージ','★★★★★→★★★★★★','ドロップキック'],
    ['ソバット','ソバット','ソバット','★★★★★★→★★★★★★★','チャージ','ドロップキック'],
    ['ソバット','ソバット','ドロップキック','ドロップキック','ドロップキック','ドロップキック']
  ]),

  // v0.5.29: BOSS専用7リール。v0.5.52以降はEX増加も敵EX失敗判定へ反映。
  new3_root_dragon: profile(60, [
    ['ミス','こうげき!','ためる','こうげき!','ためる','ブランチ'],
    ['ブランチ','こうげき!','こうげき!','ためる','★★→★★★','ブランチ'],
    ['パワー・グロウ','ディープグリーンブレス','ためる','会心の一撃','スピリット・グロウ','★★★→★★★★'],
    ['こうげき!','★★★★→★★★★★','ブランチ','パワー・グロウ','ためる','会心の一撃'],
    ['スピード・グロウ','こうげき!','★★★★★→★★★★★★','ためる','ブランチ','会心の一撃'],
    ['ディープグリーンブレス','こうげき!','スピード・グロウ','★★★★★★→★★★★★★★','ためる','会心の一撃'],
    ['パワー・グロウ','スピード・グロウ','ブランチ','会心の一撃','会心の一撃','会心の一撃']
  ], {
    // 自身以外への技なので、BOSSが使った場合はお供の素早さだけ成長させる。
    'スピード・グロウ': skill('スピード・グロウ', {
      kind:'effect', target:'enemyTeam', attackType:'physical',
      effects:[{ type:'companionSpeedGrow', value:15 }]
    }),
    // 内部CPU自動召喚テーブルでは召喚グループ50の候補はルートン(ID661)のみ。
    // ルートドラン(ID662)は手動召喚可能判定には含まれるがCPU自動選択テーブルには存在しない。
    'ブランチ': skill('ブランチ', {
      kind:'effect', target:'self', attackType:'other',
      effects:[{ type:'summonCompanion', name:'ルートン', startReel:0 }]
    })
  }),

  new3_oroshi: profile(70, [
    ['ほほえんでいる','こうげき','御伽莉花の幻','★→★★','山吹の扇','★→★★'],
    ['こうげき','菖蒲の扇','御伽莉花の幻','★★→★★★','御伽莉花の幻','★★→★★★'],
    ['こうげき!','山吹の扇','菖蒲の扇','★★★→★★★★','★★★→★★★★','御伽莉花の幻'],
    ['菖蒲の扇','★★★★→★★★★★','御伽莉花の幻','★★★★→★★★★★','会心の一撃','こうげき!'],
    ['ほほえんでいる','★★★★★→★★★★★★','菖蒲の扇','★★★★★→★★★★★★','御伽莉花の幻','菖蒲の扇'],
    ['こうげき!','山吹の扇','★★★★★★→★★★★★★★','★★★★★★→★★★★★★★','山吹の扇','会心の一撃'],
    ['菖蒲の扇','山吹の扇','山吹の扇','会心の一撃','会心の一撃','菖蒲の扇']
  ]),

  // ネルガル本体は撃破確率に関わる追加効果を持たないが、お供エンリルの行動順を成立させるため登録。
  new0_nergal: profile(70, [
    ['ミス','こうげき','こうげき!','ためる','ためる','会心の一撃'],
    ['ミス','こうげき!','こうげき!','ためる','ためる','必殺の一撃'],
    ['こうげき!','こうげき!','会心の一撃','ためる','ためる','プロペラソード'],
    ['★★★★→★','こうげき!','会心の一撃','必殺の一撃','プロペラソード','プロペラソード']
  ]),

  old0_red_dragon: profile(70, [
    ['ほほえんでいる','ほほえんでいる','こうげき','こうげき','★→★★','★→★★'],
    ['ほほえんでいる','こうげき','こうげき','こうげき','★★→★★★','★★→★★★'],
    ['ほほえんでいる','こうげき','こうげき','竜のしっぽ','★★★→★★★★','★★★→★★★★'],
    ['こうげき','こうげき','竜のしっぽ','ファイアーブレス','★★★★→★★★★★','★★★★→★★★★★'],
    ['こうげき','竜のしっぽ','竜のしっぽ','ファイアーブレス','★★★★★→★★★★★★','★★★★★→★★★★★★'],
    ['こうげき','竜のしっぽ','ファイアーブレス','ファイアーブレス','★★★★★★→★★★★★★★','★★★★★★→★★★★★★★'],
    ['こうげき','竜のしっぽ','ファイアーブレス','業火のいき','★★★★★★★→★★★★★★★★','★★★★★★★→★★★★★★★★'],
    ['業火のいき','業火のいき','業火のいき','業火のいき','業火のいき','業火のいき']
  ]),

  old0_muus: profile(85, [
    ['ほほえんでいる','ほほえんでいる','ほほえんでいる','★→★★','★→★★','★→★★'],
    ['ほほえんでいる','ほほえんでいる','★★→★★★','★★→★★★','★★→★★★','★★→★★★'],
    ['召喚★','会心の一撃','会心の一撃','必殺の一撃','★★★→★★★★','★★★→★★★★'],
    ['召喚★','会心の一撃','必殺の一撃','必殺の一撃','★★★★→★★★★★','★★★★→★★★★★'],
    ['召喚★','必殺の一撃','必殺の一撃','魔王の一撃','★★★★★→★★★★★★','★★★★★→★★★★★★'],
    ['召喚★','魔王の一撃','魔王の一撃','魔王の一撃','★★★★★★→★','★★★★★★→★']
  ], {
    // 内部CPU自動召喚テーブル group1。weightは実データ値。
    '召喚★': skill('召喚★', { kind:'effect', target:'self', attackType:'magic', effects:[{ type:'summonCompanionWeighted', choices:[
      { name:'スライム', weight:400, maxHp:10, attack:10, speed:60, attribute:'water', race:'slime', startReel:0 },
      { name:'ジバクガエル', weight:300, maxHp:40, attack:25, speed:10, attribute:'wind', race:'aquatic', startReel:0 },
      { name:'ウサミコ', weight:200, maxHp:35, attack:20, speed:40, attribute:'water', race:'beast', startReel:0 },
      { name:'チビドラゴン', weight:100, maxHp:75, attack:25, speed:20, attribute:'water', race:'dragon', startReel:0 }
    ] }] })
  }),

  old0_blue_dragon: profile(38, [
    ['ほほえんでいる','こうげき','たいあたり','たいあたり','★→★★','★→★★'],
    ['ほほえんでいる','こうげき','たいあたり','アイスブレス','★★→★★★','★★→★★★'],
    ['こうげき','こうげき','たいあたり','アイスブレス','★★★→★★★★','★★★→★★★★'],
    ['こうげき','たいあたり','アイスブレス','アイスブレス','★★★★→★★★★★','★★★★→★★★★★'],
    ['たいあたり','アイスブレス','アイスブレス','ブリザードブレス','★★★★★→★★★★★★','★★★★★→★★★★★★'],
    ['たいあたり','アイスブレス','ブリザードブレス','ブリザードブレス','★★★★★★→★★★★★★★','★★★★★★→★★★★★★★'],
    ['アイスブレス','アイスブレス','ブリザードブレス','ブリザードブレス','★★★★★★★→★★★★★★★★','★★★★★★★→★★★★★★★★'],
    ['アイスブレス','ブリザードブレス','ブリザードブレス','ブリザードブレス','ブリザードブレス','ブリザードブレス']
  ]),

  old0_silver_dragon: profile(75, [
    ['こうげき','たいあたり','たいあたり','たいあたり','ためる','ためる'],
    ['こうげき','たいあたり','たいあたり','たいあたり','ためる','ためる'],
    ['こうげき','たいあたり','たいあたり','たいあたり','ためる','ためる'],
    ['こうげき','たいあたり','たいあたり','たいあたり','ためる','ためる'],
    ['こうげき','たいあたり','たいあたり','サンダーブレス','ためる','ためる'],
    ['こうげき','たいあたり','サンダーブレス','サンダーブレス','ためる','ためる'],
    ['こうげき','たいあたり','サンダーブレス','轟雷雲','ためる','ためる'],
    ['轟雷雲','轟雷雲','轟雷雲','轟雷雲','轟雷雲','轟雷雲']
  ]),

  old1_genbu: profile(80, [
    ['かばう','こうげき','たいあたり','ためる','ためる','ためる'],
    ['かばう','こうげき','たいあたり','ためる','ためる','ためる'],
    ['かばう','こうげき','たいあたり','ためる','ためる','ためる'],
    ['かばう','こうげき','たいあたり','ためる','ためる','ためる'],
    ['かばう','こうげき','たいあたり','ためる','ためる','ためる'],
    ['たいあたり','たいあたり','たいあたり','たいあたり','たいあたり','たいあたり']
  ]),

  old1_azul: profile(97, [
    ['ほほえんでいる','ほほえんでいる','こうげき!','ためる','ためる','魔王の一撃'],
    ['ほほえんでいる','ほほえんでいる','こうげき!','ためる','ためる','魔王の一撃'],
    ['ほほえんでいる','ほほえんでいる','こうげき!','ためる','ためる','魔王の一撃'],
    ['ほほえんでいる','こうげき','こうげき!','ためる','ためる','魔王の一撃'],
    ['ほほえんでいる','こうげき!','こうげき!','ためる','ためる','魔王の一撃'],
    ['ほほえんでいる','こうげき!','会心の一撃','ためる','ためる','魔王の一撃'],
    ['ほほえんでいる','会心の一撃','必殺の一撃','ためる','ためる','魔王の一撃'],
    ['必殺の一撃','必殺の一撃','必殺の一撃','必殺の一撃','必殺の一撃','必殺の一撃']
  ]),

  old1_blizzard_dragon: profile(100, [
    ['ほほえんでいる','ほほえんでいる','ほほえんでいる','ほほえんでいる','ためる','こうげき'],
    ['アイスブレス','アイスブレス','アイスブレス','アイスブレス','★★→★★★','アイスブレス'],
    ['たいあたり','たいあたり','たいあたり','たいあたり','★★★→★★★★','たいあたり'],
    ['ブリザードブレス','ブリザードブレス','ブリザードブレス','ブリザードブレス','★★★★→★★★★★','ブリザードブレス'],
    ['ブリザードブレス','ブリザードブレス','ブリザードブレス','ブリザードブレス','★★★★★→★★★★★★','ブリザードブレス'],
    ['ブリザードブレス','ブリザードブレス','ブリザードブレス','ブリザードブレス','ブリザードブレス','ブリザードブレス']
  ]),

  old4_chibimuus: profile(45, [
    ['ほほえんでいる','こうげき','こうげき','こうげき!','★→★★','チビまおうの一撃'],
    ['ほほえんでいる','こうげき','こうげき!','会心の一撃','★★→★★★','チビまおうの一撃'],
    ['こうげき!','こうげき!','会心の一撃','会心の一撃','★★★→★★★★','チビまおうの一撃'],
    ['こうげき!','会心の一撃','会心の一撃','チビまおうの一撃','★★★★→★★★★★','チビまおうの一撃'],
    ['会心の一撃','チビまおうの一撃','チビまおうの一撃','チビまおうの一撃','チビまおうの一撃','チビまおうの一撃']
  ]),

  old4_lafroig: profile(70, [
    ['ほほえんでいる','こうげき','こうげき!','ウォーターブレイク','★→★★','ストレートフラッシュ'],
    ['こうげき','こうげき!','こうげき!','ウォーターブレイク','★★→★★★','ストレートフラッシュ'],
    ['こうげき!','こうげき!','こうげき!','ウォーターブレイク','★★★→★★★★','ストレートフラッシュ'],
    ['こうげき!','こうげき!','ウォーターブレイク','ウォーターブレイク','★★★★→★★★★★','ストレートフラッシュ'],
    ['こうげき!','ウォーターブレイク','ストレートフラッシュ','ストレートフラッシュ','★★★★★→★★★★★★','ロックラーヴァ'],
    ['こうげき!','ウォーターブレイク','ストレートフラッシュ','ロックラーヴァ','★★★★★→★★★★★★','ロックラーヴァ'],
    ['こうげき!','ウォーターブレイク','ロックラーヴァ','ロックラーヴァ','★★★★★★→★★★★★★★','魔皇の一撃'],
    ['ストレートフラッシュ','魔皇の一撃','魔皇の一撃','魔皇の一撃','魔皇の一撃','魔皇の一撃']
  ]),

  old6_white_dragon: profile(75, [
    ['フラッシュ','フラッシュ','★→★★','★→★★','フラッシュ','ハイ・フラッシュ'],
    ['フラッシュ','フラッシュ','★★→★★★','★★→★★★','ハイ・フラッシュ','ホワイトブレス'],
    ['フラッシュ','フラッシュ','★★★→★★★★','★★★→★★★★','ホワイトブレス','ホワイトブレス'],
    ['フラッシュ','ハイ・フラッシュ','★★★★→★★★★★','★★★★→★★★★★','ホワイトブレス','ホワイトブレス'],
    ['フラッシュ','ハイ・フラッシュ','★★★★★→★★★★★★','★★★★★→★★★★★★','ホワイトブレス','ホーリーブレス'],
    ['ハイ・フラッシュ','ハイ・フラッシュ','★★★★★★→★★★★★★★','★★★★★★→★★★★★★★','ホーリーブレス','ホーリーブレス'],
    ['ハイ・フラッシュ','ホワイトブレス','ホワイトブレス','ホーリーブレス','ホーリーブレス','ホーリーブレス']
  ]),
  old0_riviere: profile(82, [
    ['女魔王の冷笑','メテオ!','メテオ!','★→★★','★→★★','★→★★'],
    ['女魔王の哄笑','メテオ!','メテオ!','★★→★★★','★★→★★★','★★→★★★'],
    ['女魔王の高笑','メテオ!','メテオ!','★★★→★★★★','★★★→★★★★','★★★→★★★★'],
    ['女魔王の狂笑','魔王の一撃','魔王の一撃','★★★★→★★★★★','★★★★→★★★★★','★★★★→★★★★★'],
    ['召喚★','魔王の一撃','魔王の一撃','★★★★★→★★★★★★','★★★★★→★★★★★★','★★★★★→★★★★★★'],
    ['召喚★★','魔王の一撃','魔王の一撃','★★★★★★→★★★★★★★','★★★★★★→★★★★★★★','★★★★★★→★★★★★★★'],
    ['召喚★★★','魔王の一撃','魔王の一撃','★★★★★★★→★★★★★★★★','★★★★★★★→★★★★★★★★','★★★★★★★→★★★★★★★★'],
    ['召喚★★★★','召喚★★★★','召喚★★★★','召喚★★★★','魔王の一撃','★★★★★★★★→★']
  ], {
    // 内部CPU自動召喚テーブル group1～4。候補とweightをそのまま使用する。
    '召喚★': skill('召喚★', { kind:'effect', target:'self', attackType:'magic', effects:[{ type:'summonCompanionWeighted', choices:[
      { name:'スライム', weight:400, maxHp:10, attack:10, speed:60, attribute:'water', race:'slime', startReel:0 },
      { name:'ジバクガエル', weight:300, maxHp:40, attack:25, speed:10, attribute:'wind', race:'aquatic', startReel:0 },
      { name:'ウサミコ', weight:200, maxHp:35, attack:20, speed:40, attribute:'water', race:'beast', startReel:0 },
      { name:'チビドラゴン', weight:100, maxHp:75, attack:25, speed:20, attribute:'water', race:'dragon', startReel:0 }
    ] }] }),
    '召喚★★': skill('召喚★★', { kind:'effect', target:'self', attackType:'magic', effects:[{ type:'summonCompanionWeighted', choices:[
      { name:'スライム・シルバー', weight:400, maxHp:60, attack:20, speed:70, attribute:'wind', race:'slime', startReel:0 },
      { name:'魔法使いジヨン', weight:300, maxHp:80, attack:45, speed:60, attribute:'water', race:'magician', startReel:0 },
      { name:'ライジイ', weight:200, maxHp:70, attack:40, speed:60, attribute:'wind', race:'warrior', startReel:0 },
      { name:'ケツアル', weight:100, maxHp:100, attack:30, speed:60, attribute:'wind', race:'dragon', startReel:0 }
    ] }] }),
    '召喚★★★': skill('召喚★★★', { kind:'effect', target:'self', attackType:'magic', effects:[{ type:'summonCompanionWeighted', choices:[
      { name:'スライム・ゴールド', weight:450, maxHp:90, attack:30, speed:80, attribute:'earth', race:'slime', startReel:0 },
      { name:'吟遊詩人キドリ', weight:300, maxHp:150, attack:45, speed:70, attribute:'wind', race:'birdbeast', startReel:0 },
      { name:'スフク', weight:200, maxHp:170, attack:50, speed:40, attribute:'earth', race:'birdbeast', startReel:0 },
      { name:'死神モート', weight:50, maxHp:199, attack:44, speed:44, attribute:'earth', race:'demon', startReel:0 }
    ] }] }),
    '召喚★★★★': skill('召喚★★★★', { kind:'effect', target:'self', attackType:'magic', effects:[{ type:'summonCompanionWeighted', choices:[
      { name:'スライム・マナ', weight:490, maxHp:270, attack:40, speed:90, attribute:'fire', race:'slime', startReel:0 },
      { name:'王子マルドク', weight:300, maxHp:230, attack:75, speed:90, attribute:'wind', race:'angel', startReel:0 },
      { name:'アヴァドン', weight:200, maxHp:450, attack:15, speed:5, attribute:'earth', race:'aquatic', startReel:0 },
      { name:'レッドドラゴン', weight:10, maxHp:350, attack:70, speed:30, attribute:'fire', race:'dragon', startReel:0 }
    ] }] })
  }),

  old1_fafnir: profile(100, [
    ['ほほえんでいる','ほほえんでいる','ほほえんでいる','ほほえんでいる','★→★★','竜のしっぽ'],
    ['こうげき','こうげき','こうげき','こうげき','★★→★★★','闇のいき'],
    ['竜のしっぽ','竜のしっぽ','竜のしっぽ','竜のしっぽ','★★★→★★★★','闇のいき'],
    ['闇のいき','闇のいき','闇のいき','闇のいき','★★★★→★★★★★','暗黒のいき'],
    ['暗黒のいき','暗黒のいき','暗黒のいき','暗黒のいき','★★★★★→★★★★★★','終焉のいき'],
    ['暗黒のいき','暗黒のいき','暗黒のいき','暗黒のいき','★★★★★★→★★★★★★★','終焉のいき'],
    ['暗黒のいき','暗黒のいき','暗黒のいき','暗黒のいき','★★★★★★★→★★★★★★★★','終焉のいき'],
    ['終焉のいき','終焉のいき','終焉のいき','終焉のいき','終焉のいき','終焉のいき']
  ], {
    '終焉のいき': skill('終焉のいき', { kind:'attack', multiplier:130, target:'all', attackType:'breath', attributes:['dark'], effects:[{ type:'status', status:'silence', chance:20, duration:3 }] })
  }),

  old2_soccerra: profile(80, [
    ['ほほえんでいる','気合','こうげき!','ためる','★→★★','魔王の一撃'],
    ['ほほえんでいる','気合','こうげき!','ためる','★★→★★★','魔王の一撃'],
    ['気合','気合','こうげき!','ためる','★★★→★★★★','魔王の一撃'],
    ['気合','こうげき!','こうげき!','ためる','★★★★→★★★★★','魔王の一撃'],
    ['気合','こうげき!','会心の一撃','ためる','★★★★★→★★★★★★','古神兵召喚'],
    ['気合','会心の一撃','会心の一撃','ためる','★★★★★★→★★★★★★★','古神兵召喚'],
    ['気合','会心の一撃','必殺の一撃','ためる','★★★★★★★→★★★★★★★★','古神兵召喚'],
    ['気合','魔王の一撃','魔王の一撃','ハンドレッドフィスト','ハンドレッドフィスト','古神兵召喚']
  ]),

  old2_ifrit: profile(65, [
    ['ミス','ミス','EXゲージ+1','ためる','ためる','EXゲージ+2'],
    ['ミス','EXゲージ+1','EXゲージ+2','ためる','ためる','EXゲージ+2'],
    ['ミス','EXゲージ+1','EXゲージ+2','ためる','ためる','EXゲージ+3'],
    ['ミス','EXゲージ+2','EXゲージ+3','ためる','ためる','EXゲージ+3'],
    ['ミス','EXゲージ+2','EXゲージ+3','ためる','ためる','EXゲージ+4'],
    ['EXゲージ+2','EXゲージ+3','EXゲージ+4','EXゲージ+4','EXゲージ+4','EXゲージ+4']
  ]),

  old5_kujeska: profile(50, [
    ['ほほえんでいる','こうげき','こうげき','こうげき!','★→★★','ソルティドッグ'],
    ['ほほえんでいる','こうげき','こうげき!','こうげき!','★★→★★★','ソルティドッグ'],
    ['こうげき','こうげき!','こうげき!','こうげき!','★★★→★★★★','魔皇の一撃'],
    ['こうげき!','こうげき!','こうげき!','ブラックルシアン','★★★★→★★★★★','魔皇の一撃'],
    ['こうげき!','こうげき!','ブラックルシアン','魔皇の一撃','★★★★★→★★★★★★','ブラッディメアリー'],
    ['こうげき!','ブラックルシアン','ブラックルシアン','魔皇の一撃','★★★★★★→★★★★★★★','ブラッディメアリー'],
    ['こうげき!','こうげき!','魔皇の一撃','魔皇の一撃','ブラッディメアリー','ブラッディメアリー']
  ]),

  old2_skullbone: profile(60, [
    ['ためる','ためる','ためる','こうげき!','こうげき!','ほねをやすめている'],
    ['ためる','ためる','ためる','吸収攻撃','吸収攻撃','ほねをやすめている'],
    ['ためる','ためる','ためる','吸収攻撃','吸収攻撃','ポイズンブレス'],
    ['ためる','ためる','ためる','こうげき!','ポイズンブレス','石化ブレス'],
    ['ためる','ためる','ためる','吸収攻撃','石化ブレス','石化ブレス'],
    ['ためる','ためる','ためる','ポイズンブレス','ポイズンブレス','石化ブレス'],
    ['石化ブレス','石化ブレス','石化ブレス','石化ブレス','石化ブレス','石化ブレス']
  ], {
    '石化ブレス': skill('石化ブレス', { kind:'attack', multiplier:110, target:'all', attackType:'breath', attributes:['earth'], effects:[{ type:'status', status:'petrification', chance:15, duration:99 }] })
  }),

  old3_yamata: profile(65, [
    ['ミス','こうげき','かみつき','ためる','ためる','★→★★'],
    ['こうげき','かみつき','かみつき','ためる','ためる','★★→★★★'],
    ['かみつき','水鉄砲','水鉄砲','ためる','ためる','★★★→★★★★'],
    ['竜のしっぽ','竜のしっぽ','ポイズンブレス','ためる','ためる','★★★★→★★★★★'],
    ['ポイズンブレス','ポイズンブレス','轟雷雲','ためる','ためる','★★★★★→★★★★★★'],
    ['ポイズンブレス','ポイズンブレス','轟雷雲','轟雷雲','叢雲の尾','叢雲の尾']
  ], {
    // BOSS版は現行解説どおり毒50%。敵→味方の毒自体は撃破確率上の行動制限にならないため追跡しない。
    'ポイズンブレス': skill('ポイズンブレス', { kind:'attack', multiplier:85, target:'all', attackType:'breath', attributes:['poison'], effects:[{ type:'status', status:'poison', chance:50, duration:99 }] })
  }),

  old3_kukulkan: profile(70, [
    ['ほほえんでいる','ほほえんでいる','こうげき!','こうげき!','★→★★','★→★★'],
    ['ほほえんでいる','こうげき!','つっつき','つっつき','★★→★★★','★★→★★★'],
    ['ほほえんでいる','つつきまくり','はばたき','はばたき','★★★→★★★★','★★★→★★★★'],
    ['こうげき!','つっつき','つっつき','輝く風','★★★★→★★★★★','★★★★→★★★★★'],
    ['つっつき','つつきまくり','はばたき','輝く風','★★★★★→★★★★★★','★★★★★→★★★★★★'],
    ['つつきまくり','つつきまくり','はばたき','輝く風','★★★★★★→★★★★★★★','★★★★★★→★★★★★★★'],
    ['つつきまくり','つつきまくり','はばたき','輝く風','輝く風','輝く風']
  ]),

  old3_nanawarai: profile(80, [
    ['ほほえんでいる','こうげき','こうげき','ためる','★→★★','天狗のうちわ'],
    ['ほほえんでいる','こうげき','こうげき!','ためる','★★→★★★','天狗のうちわ'],
    ['大音声','こうげき','こうげき!','ためる','★★★→★★★★','必殺の一撃'],
    ['大音声','こうげき!','こうげき!','ためる','★★★★→★★★★★','必殺の一撃'],
    ['大音声','こうげき!','こうげき!','ためる','★★★★★→★★★★★★','魔王の一撃'],
    ['大音声','こうげき!','天狗のうちわ','ためる','★★★★★★→★★★★★★★','魔王の一撃'],
    ['大音声','必殺の一撃','必殺の一撃','必殺の一撃','魔王の一撃','魔王の一撃']
  ]),

  old5_frost_dragon: profile(65, [
    ['ミス','ミス','こうげき','アイスブレス','★→★★','★→★★'],
    ['ミス','こうげき','こうげき!','アイスブレス','★★→★★★','★★→★★★'],
    ['こうげき','こうげき!','こうげき!','アイスブレス','★★★→★★★★','★★★→★★★★'],
    ['こうげき','こうげき!','カチワリゴオリ','フローズンブレス','★★★★→★★★★★','★★★★→★★★★★'],
    ['こうげき!','カチワリゴオリ','カチワリゴオリ','フローズンブレス','★★★★★→★★★★★★','★★★★★→★★★★★★'],
    ['カキゴオリ','凍てつく息','凍てつく息','凍てつく息','凍てつく息','凍てつく息']
  ]),

  old6_enma: profile(85, [
    ['ためる','ためる','ほほえんでいる','こうげき','こうげき!','拘束'],
    ['ためる','ためる','こうげき','こうげき!','拘束','拘束'],
    ['ためる','ためる','こうげき!','拘束','拘束','拘束'],
    ['ためる','ためる','こうげき!','拘束','拘束','閻魔仕置'],
    ['ためる','ためる','こうげき!','拘束','閻魔仕置','浄玻璃鏡'],
    ['ためる','ためる','拘束','拘束','閻魔仕置','浄玻璃鏡'],
    ['拘束','拘束','閻魔仕置','閻魔仕置','浄玻璃鏡','浄玻璃鏡']
  ]),

  old6_tokai: profile(75, [
    ['ほほえんでいる','こうげき','★→★★','★→★★','甘いいき','灰色のカビ'],
    ['ほほえんでいる','こうげき!','★★→★★★','★★→★★★','甘いいき','灰色のカビ'],
    ['灰色のカビ','こうげき!','★★★→★★★★','★★★→★★★★','甘いいき','死霊を呼ぶ声'],
    ['灰色のカビ','甘いいき','★★★★→★★★★★','★★★★→★★★★★','甘いいき','死霊を呼ぶ声'],
    ['死霊を呼ぶ声','甘いいき','★★★★★→★★★★★★','★★★★★→★★★★★★','甘いいき','魔皇の一撃'],
    ['死霊を呼ぶ声','甘いいき','★★★★★★→★★★★★★★','★★★★★★→★★★★★★★','魔皇の一撃','魔皇の一撃'],
    ['死霊を呼ぶ声','甘いいき','甘いいき','魔皇の一撃','魔皇の一撃','魔皇の一撃']
  ]),

  new2_gnome: profile(50, [
    ['ごうりきの土','ためる','ごうりきの土','ためる','ためる','ごうりきの土'],
    ['ごうりきの土','ロック!!','ためる','ためる','★★→★★★','グランドスタンプ'],
    ['がんきょうの土','がんきょうの土','ためる','★★★→★★★★','ためる','ロック!!!'],
    ['ごうりきの土','ロック!!','ためる','★★★★→★★★★★','グランドスタンプ','グランドスタンプ'],
    ['がんきょうの土','ロック!!','★★★★★→★★★★★★','ロック!!!','★★★★★→★★★★★★','ロック!!!'],
    ['ごうりきの土','ごうりきの土','グランドスタンプ','★★★★★★→★★★★★★★','★★★★★★→★★★★★★★','ロック!!!!'],
    ['がんきょうの土','ロック!!!','グランドスタンプ','グランドスタンプ','ロック!!!!','ロック!!!!']
  ]),

  new4_iron_dragon: profile(65, [
    ['こうげき','こうげき!','ためる','★→★★','はがねのしっぽ','アイアンカウンター'],
    ['アイアンカウンター','こうげき!','ためる','★★→★★★','はがねのしっぽ','ソリッドブレス'],
    ['こうげき!','こうげき!','ためる','★★★→★★★★','はがねのしっぽ','くろがねのしっぽ'],
    ['ミス','くろがねのしっぽ','ためる','★★★★→★★★★★','アイアンカウンター','アイアンカウンター'],
    ['こうげき','はがねのしっぽ','はがねのしっぽ','★★★★★→★★★★★★','★★★★★→★★★★★★','ソリッドブレス'],
    ['こうげき','こうげき!','くろがねのしっぽ','★★★★★★→★★★★★★★','★★★★★★→★★★★★★★','ブレイクブラスト'],
    ['はがねのしっぽ','はがねのしっぽ','ブレイクブラスト','★★★★★★★→★★★★★★★★','★★★★★★★→★★★★★★★★','アイアンカウンター'],
    ['アイアンカウンター','くろがねのしっぽ','くろがねのしっぽ','アイアンカウンター','ブレイクブラスト','ブレイクブラスト']
  ]),

  q_black_red_dragon: profile(90, [
    ['こうげき','竜のしっぽ','★→★★','★→★★','★→★★','ファイアーブレス'],
    ['こうげき','かみつき','★★→★★★','★★→★★★','★★→★★★','ファイアーブレス'],
    ['かみつき','かみつき','★★★→★★★★','★★★→★★★★','★★★→★★★★','ファイアーブレス'],
    ['ファイアーブレス','ファイアーブレス','★★★★→★★★★★','★★★★→★★★★★','★★★★→★★★★★','業火のいき'],
    ['業火のいき','業火のいき','業火のいき','業火のいき','業火のいき','業火のいき']
  ]),

  q_kerogon_gold: profile(65, [
    ['ミス','こうげき!','こうげき!','金のいき','★→★★','金のいき'],
    ['こうげき!','こうげき!','竜のしっぽ','金のいき','★★→★★★','金のいき'],
    ['こうげき!','竜のしっぽ','金のいき','金のいき','★★★→★★★★','金のいき'],
    ['こうげき!','金のいき','金のいき','金のいき','★★★★→★★★★★','金のいき'],
    ['金のいき','金のいき','金のいき','金のいき','金のいき','金のいき']
  ]),

  q_great_nanawarai: profile(85, [
    ['ほほえんでいる','こうげき!','風の刃','★→★★','大怒号','★→★★'],
    ['風の刃','こうげき','こうげき!','★★→★★★','会心の一撃','★★→★★★'],
    ['大怒号','こうげき!','風の刃','★★★→★★★★','大風起こし','★★★→★★★★'],
    ['大風起こし','風の刃','大怒号','★★★★→★★★★★','会心の一撃','★★★★→★★★★★'],
    ['風の刃','大風起こし','★★★★★→★★★★★★','大怒号','★★★★★→★★★★★★','大雷落とし'],
    ['こうげき!','こうげき!','★★★★★★→★★★★★★★','会心の一撃','★★★★★★→★★★★★★★','大風起こし'],
    ['ほほえんでいる','風の刃','★★★★★★★→★★★★★★★★','大怒号','★★★★★★★→★★★★★★★★','大雷落とし'],
    ['大怒号','風の刃','大雷落とし','大風起こし','大雷落とし','大風起こし']
  ]),

  q_emerald_dragon: profile(65, [
    ['ほほえんでいる','こうげき','エメラルドブレス','★→★★','★→★★','★→★★'],
    ['ほほえんでいる','こうげき!','エメラルドショット','★★→★★★','★★→★★★','エメラルドフラッシュ'],
    ['こうげき','★★★→★★★★','エメラルドブレス','★★★→★★★★','エメラルドフラッシュ','エメラルドカット'],
    ['こうげき!','エメラルドカット','★★★★→★★★★★','★★★★→★★★★★','★★★★→★★★★★','エメラルドショット'],
    ['エメラルドブレス','★★★★★→★★★★★★','エメラルドフラッシュ','★★★★★→★★★★★★','エメラルドブレス','エメラルドショット'],
    ['こうげき!','★★★★★★→★★★★★★★','エメラルドカット','エメラルドカット','★★★★★★→★★★★★★★','エメラルドショット'],
    ['エメラルドフラッシュ','エメラルドフラッシュ','エメラルドブレス','エメラルドブレス','エメラルドカット','エメラルドカット']
  ]),

  q_fire_drake: profile(50, [
    ['ミス','こうげき','こうげき!','ためる','★→★★','ファイアーブレス'],
    ['ミス','竜のしっぽ','竜のしっぽ','ためる','★★→★★★','ファイアーブレス'],
    ['こうげき','こうげき!','こうげき','ためる','★★★→★★★★','地獄の牙'],
    ['こうげき','竜のしっぽ','ファイアーブレス','ためる','ためる','地獄の牙'],
    ['ミス','地獄の牙','地獄の牙','ファイアーブレス','業火のいき','業火のいき']
  ]),

  // v0.5.46: ドラゴンコレクション系BOSS。BOSS専用ページのコマンド表をそのまま転置して保持する。
  q_shining_fire_drake: profile(80, [
    ['こうげき!','こうげき!','竜のしっぽ','ためる','★→★★','業火のいき'],
    ['こうげき!','竜のしっぽ','竜のしっぽ','ためる','★★→★★★','地獄の牙'],
    ['ほほえんでいる','ファイアーブレス','ファイアーブレス','ためる','★★→★★★','業火のいき'],
    ['地獄の牙','地獄の牙','地獄の牙','ためる','★★★★→★★★★★','業火のいき'],
    ['竜のしっぽ','竜のしっぽ','会心の一撃','ためる','★★★★★→★★★★★★','いにしえの火炎のいき'],
    ['雷光の爪','雷光の爪','竜のしっぽ','ためる','ためる','ためる'],
    ['ほほえんでいる','雷光の爪','雷光の爪','いにしえの火炎のいき','いにしえの火炎のいき','いにしえの火炎のいき']
  ]),

  q_black_drake: profile(66, [
    ['★→★★','闇のいき','竜のしっぽ','竜のしっぽ','闇のいき','★→★★'],
    ['★★→★★★','暗黒の爪','こうげき!','こうげき!','暗黒の爪','★★→★★★'],
    ['★★★→★★★★','冥界の神罰','会心の一撃','会心の一撃','冥界の神罰','★★★→★★★★'],
    ['★★★★→★★★★★','いにしえの暗黒のいき','暗黒のいき','暗黒のいき','いにしえの暗黒のいき','★★★★→★★★★★'],
    ['暗黒の爪','暗黒の爪','ためる','ためる','いにしえの暗黒のいき','いにしえの暗黒のいき'],
    ['★★★★★★→★★★★★★★','竜のしっぽ','闇のいき','暗黒のいき','いにしえの暗黒のいき','★★★★★★→★★★★★★★'],
    ['ためる','ためる','ためる','ためる','ためる','ためる'],
    ['暗黒の爪','暗黒の爪','冥界の神罰','冥界の神罰','いにしえの暗黒のいき','いにしえの暗黒のいき']
  ]),

  // v0.5.47: 第7章／ドラゴンコレクション系BOSS。BOSS専用ページの表を転置して保持する。
  q_yinlong: profile(80, [
    ['ミス','こうげき','★→★★','★→★★','竜の旋廻','蛍光の宝玉'],
    ['こうげき','かみつき','★★→★★★','★★→★★★','竜の旋廻','蛍光の宝玉'],
    ['こうげき','かみつき','★★★→★★★★','竜の旋迴','蛍光の宝玉','蛍光の宝玉'],
    ['ブラックライトブレス','かみつき','竜の旋迴','竜の旋迴','蛍光の宝玉','蛍光の宝玉'],
    ['ブラックライトブレス','竜の旋迴','竜の旋迴','蛍光の宝玉','蛍光の宝玉','蛍光の宝玉']
  ]),

  q_platinum_drake: profile(70, [
    ['こうげき!','こうげき!','竜のしっぽ','ためる','ためる','雷竜の壁'],
    ['ほほえんでいる','竜のしっぽ','竜のしっぽ','★★→★★★','★★→★★★','地獄の牙'],
    ['こうげき!','こうげき!','会心の一撃','ためる','ためる','雷竜の壁'],
    ['ほほえんでいる','竜のしっぽ','竜のしっぽ','★★★★→★★★★★','★★★★→★★★★★','光のいき'],
    ['こうげき!','地獄の牙','地獄の牙','ためる','ためる','必殺の一撃'],
    ['地獄の牙','雷竜の壁','光のいき','ためる','ためる','ためる'],
    ['地獄の牙','地獄の牙','雷竜の壁','雷竜の壁','光のいき','光のいき']
  ]),

  q_ice_valkyrie: profile(45, [
    ['ミス','こうげき','こうげき!','こうげき!','★→★★','★→★★'],
    ['こうげき','こうげき','こうげき!','氷のムチ','★★→★★★','★★→★★★'],
    ['こうげき','こうげき','こうげき','氷のムチ','★★★→★★★★','会心の一撃'],
    ['こうげき','氷のムチ','こうげき!','氷のムチ','ためる','ためる'],
    ['ミス','こうげき!','こうげき!','水竜の牙','氷のムチ','氷のムチ!']
  ]),

  // v0.5.48: ドラゴンコレクション系BOSS。BOSS専用ページの5リールをそのまま転置して保持する。
  q_meat_mania: profile(40, [
    ['たべる','たべる','たべる','ためる','ためる','ためる'],
    ['ミス','たべる','たべる','こうげき!','★★→★★★','★★→★★★'],
    ['ミス','たべる','こうげき!','会心の一撃','★★★→★★★★','★★★→★★★★'],
    ['こうげき!','ためる','会心の一撃','ためる','こうげき!','ためる'],
    ['ミス','たべる','こうげき!','会心の一撃','必殺の一撃','渾身の一撃']
  ]),

  q_great_tokai: profile(65, [
    ['ほほえんでいる','こうげき','こうげき!','★→★★','ためる','こうげき!'],
    ['とけるいき','とけるいき','★★→★★★','こうげき','★★→★★★','ほほえんでいる'],
    ['とけるいき','こうげき','ほほえんでいる','ためる','死霊を呼ぶ声','ためる'],
    ['こうげき!','死霊を呼ぶ声','★★★★→★★★★★','死霊を呼ぶ声','★★★★→★★★★★','こうげき'],
    ['ほほえんでいる','ほほえんでいる','追いつめる死霊の手','ためる','会心の一撃','ためる'],
    ['ほほえんでいる','追いつめる死霊の手','★★★★★★→★★★★★★★','とけるいき','とけるいき','★★★★★★→★★★★★★★'],
    ['会心の一撃','死霊を呼ぶ声','死霊を呼ぶ声','★★★★★★★→★★★★★★★★','ほほえんでいる','とけるいき'],
    ['会心の一撃','追いつめる死霊の手','死霊を呼ぶ声','追いつめる死霊の手','会心の一撃','ほほえんでいる']
  ]),

  q_cursed_yamata: profile(90, [
    ['ミス','ポイズンブレス','★→★★','★→★★','ポイズンブレス','叢雲の尾'],
    ['ポイズンブレス','ポイズンブレス','★★→★★★','★★→★★★','ポイズンブレス','叢雲の尾'],
    ['ポイズンブレス','ポイズンブレス','★★★→★★★★','★★★→★★★★','石化ブレス','叢雲の尾'],
    ['ポイズンブレス','石化ブレス','★★★★→★★★★★','★★★★→★★★★★','叢雲の尾','叢雲の尾'],
    ['終焉のいき','終焉のいき','終焉のいき','終焉のいき','終焉のいき','終焉のいき']
  ], {
    'ポイズンブレス': skill('ポイズンブレス', { kind:'attack', multiplier:85, target:'all', attackType:'breath', attributes:['poison'], effects:[{ type:'status', status:'poison', chance:50, duration:99 }] }),
    '石化ブレス': skill('石化ブレス', { kind:'attack', multiplier:110, target:'all', attackType:'breath', attributes:['earth'], effects:[{ type:'status', status:'petrification', chance:15, duration:99 }] }),
    '終焉のいき': skill('終焉のいき', { kind:'attack', multiplier:130, target:'all', attackType:'breath', attributes:['dark'], effects:[{ type:'status', status:'silence', chance:20, duration:3 }] })
  }),

  old3_fanlong: profile(65, [
    ['ミス','ミス','ミス','★→★★','ためる','たいあたり'],
    ['ミス','ミス','こうげき','★★→★★★','ためる','たいあたり'],
    ['ミス','こうげき','こうげき','★★★→★★★★','ためる','サンダーブレス'],
    ['ミス','こうげき!','こうげき!','★★★★→★★★★★','ためる','サンダーブレス'],
    ['ミス','こうげき!','サンダーブレス','★★★★★→★★★★★★','ためる','土剋水の息'],
    ['ミス','たいあたり','たいあたり','★★★★★★→★★★★★★★','ためる','土剋水の息'],
    ['ミス','たいあたり','たいあたり','★★★★★★★→★★★★★★★★','ためる','五黄土星'],
    ['土剋水の息','土剋水の息','土剋水の息','五黄土星','五黄土星','五黄土星']
  ]),

  new0_volcano_dragon: profile(75, [
    ['マグマアーマー','ためる','ためる','ためる','マグマアーマー','スピットファイア'],
    ['ミス','こうげき!','かたいしっぽ','ためる','ためる','スピットファイア'],
    ['マグマアーマー','こうげき!','スピットファイア','ためる','★★★→★★★★','マグマブレス'],
    ['マグマブレス','★★★★→★★★★★','かたいしっぽ','★★★★→★★★★★','スピットファイア','★★★★→★★★★★'],
    ['マグマアーマー','かたいしっぽ','かたいしっぽ','★★★★★→★★★★★★','★★★★★→★★★★★★','マグマブレス'],
    ['こうげき!','こうげき!','スピットファイア','★★★★★★→★★★★★★★','★★★★★★→★★★★★★★','マグマアーマー'],
    ['マグマアーマー','かたいしっぽ','スピットファイア','スピットファイア','マグマブレス','マグマブレス']
  ]),

  // v0.5.51: 同一BOSS3体編成。通常コマンドは3体共通。
  // 敵側の純粋攻撃ダメージは撃破率モデルの対象外だが、ルーレット自体は正確に保持する。
  new5_mashumaro: profile(31, [
    ['ミス','こうげき','EXゲージ＋1','★→★★','こうげき!','こうげき'],
    ['ミス','こうげき','EXゲージ＋1','★★→★★★','こうげき!','マシュまるま'],
    ['★★★→★★★★','こうげき','EXゲージ＋2','★★★→★★★★','マシュまるま','EXゲージ＋3'],
    ['こうげき!','ミス','EXゲージ＋3','★★★★→★★★★★','こうげき!','マシュまるま'],
    ['EXゲージ＋2','マシュまるま','EXゲージ＋2','こうげき','EXゲージ＋3','マシュまるま']
  ]),

  new5_glacier_dragon: profile(75, [
    ['こうげき','オーロラアーマー','★→★★','ためる','ためる','スピットアイス'],
    ['オーロラアーマー','スピットアイス','★★→★★★','★★→★★★','こうげき!','オーロラアーマー'],
    ['つめたいしっぽ','スピットアイス','こうげき!','★★★→★★★★','★★★→★★★★','オーロラブレス'],
    ['オーロラアーマー','こうげき!','★★★★→★★★★★','スピットアイス','★★★★→★★★★★','オーロラブレス'],
    ['つめたいしっぽ','オーロラブレス','★★★★★→★★★★★★','★★★★★→★★★★★★','スピットアイス','スピットアイス'],
    ['こうげき!','オーロラアーマー','★★★★★★→★★★★★★★','★★★★★★→★★★★★★★','★★★★★★→★★★★★★★','オーロラブレス'],
    ['こうげき!','オーロラブレス','ためる','ためる','ためる','スピットアイス'],
    ['オーロラアーマー','スピットアイス','スピットアイス','オーロラブレス','オーロラブレス','オーロラブレス']
  ]),

  old4_chiviere: profile(40, [
    ['ミス','こうげき','こうげき!','会心の一撃','★→★★','召喚★★'],
    ['こうげき!','プチメテオ','ヒメの笑い声','ヒメの笑い声','★★→★★★','召喚★★'],
    ['ヒメの笑い声','プチメテオ','プチメテオ','会心の一撃','★★★→★★★★','召喚★★'],
    ['ヒメの笑い声','プチメテオ','会心の一撃','会心の一撃','★★★★→★★★★★','召喚★★'],
    ['会心の一撃','会心の一撃','ヒメの笑い声','ヒメの笑い声','召喚★★','召喚★★']
  ], {
    '召喚★★': skill('召喚★★', { kind:'effect', target:'self', attackType:'other', effects:[{ type:'summonCompanion', name:'デメラ', startReel:0 }] })
  }),

  new3_deathfear_plant: profile(65, [
    ['こうげき','こうげき!','ヘルスロートブレス','ためる','ためる','ためる'],
    ['こうげき','スピードロートブレス','スピードロートブレス','ヘルスロートブレス','ためる','ためる'],
    ['こうげき','パワーロートブレス','ためる','★★★→★★★★','★★★→★★★★','ヘルスロートブレス'],
    ['こうげき!','ヘルスロートブレス','★★★★→★★★★★','ためる','★★★★→★★★★★','会心の一撃'],
    ['パワーロートブレス','会心の一撃','ためる','★★★★★→★★★★★★','ためる','スピードロートブレス'],
    ['パワーロートブレス','★★★★★★→★★★★★★★','★★★★★★→★★★★★★★','ためる','ミス','ヘルスロートブレス'],
    ['ヘルスロートブレス','スピードロートブレス','パワーロートブレス','会心の一撃','会心の一撃','会心の一撃']
  ]),

  new2_arp: profile(50, [
    ['ミス','ためる','アクア','アクア','アクア!','ためる'],
    ['きよめの水','アクア','ためる','アクア!','★★→★★★','ウェットスライサー'],
    ['きよめの水','アクア!','★★★→★★★★','ためる','アクア!!','ウェットスライサー'],
    ['きよめの水','アクア!!','アクア!!','ためる','ためる','ウェットスライサー'],
    ['きよめの水','アクア!!','アクア!!!','ウェットスライサー','ウェットスライサー','アクア!!!!']
  ]),

  new6_kais: profile(60, [
    ['ミス','こうげき','粘着攻撃','チャージ','チャージ','★→★★'],
    ['ミス','こうげき','チャージ','★★→★★★','★★→★★★','ロボ召喚★★★'],
    ['ロボ修復','★★★→★★★★','チャージ','チャージ','粘着攻撃','こうげき!'],
    ['こうげき','こうげき!','★★★★→★★★★★','ロボ修復','★★★★→★★★★★','試作魔銃'],
    ['粘着攻撃','こうげき!','試作魔銃','チャージ','チャージ','ロボ召喚★★★'],
    ['こうげき!','こうげき','ロボ修復','試作魔銃','チャージ','★★★★★★→★★★★★★★'],
    ['こうげき!','こうげき!','試作魔銃','粘着攻撃','試作魔銃','こうげき!']
  ], {
    // BOSS専用挙動ではロボ弐式を召喚する。
    'ロボ召喚★★★': skill('ロボ召喚★★★', { kind:'effect', target:'self', attackType:'other', effects:[{ type:'summonCompanion', name:'ロボ弐式', startReel:0 }] })
  }),

  new4_phantom: profile(65, [
    ['ほほえんでいる?','★→★★','こうげき','こうげき','★→★★','ステアボイス'],
    ['ほほえんでいる?','★★→★★★','こうげき','こうげき!','★★→★★★','ロックラーヴァ'],
    ['ほほえんでいる?','ステアボイス','★★★→★★★★','★★★→★★★★','幻影のチェイサー','リチャーズ・バーン'],
    ['こうげき!','こうげき!','★★★★→★★★★★','★★★★→★★★★★','ステアボイス','ロックラーヴァ'],
    ['幻影のチェイサー','こうげき','リチャーズ・バーン','リチャーズ・バーン','★★★★★→★★★★★★','★★★★★→★★★★★★'],
    ['ほほえんでいる?','ステアボイス','ステアボイス','ロックラーヴァ','★★★★★★→★★★★★★★','★★★★★★→★★★★★★★'],
    ['こうげき!','ステアボイス','リチャーズ・バーン','ロックラーヴァ','リチャーズ・バーン','ロックラーヴァ']
  ]),



  // v0.5.31: 鬼竜ネクロドラゴン。呪いだけを撃破率へ反映する。
  new6_necro_dragon: profile(55, [
    ['ミス','こうげき','こうげき','ためる','ためる','ウラミのツメ'],
    ['ノロイの息','こうげき','こうげき!','ためる','★★→★★★','ノロイの息'],
    ['ミス','こうげき','ウラミのツメ','ためる','ためる','ノロイの息'],
    ['こうげき','ミス','ノロイの息','★★★★→★★★★★','★★★★→★★★★★','ウラミのツメ'],
    ['ミス','こうげき!','復讐のツメ','ためる','★★★★★→★★★★★★','ノロイの息'],
    ['こうげき','ウラミのツメ','ウラミのツメ','ためる','ためる','呪殺の息'],
    ['こうげき!','ウラミのツメ','ノロイの息','ノロイの息','復讐のツメ','呪殺の息']
  ]),

  // v0.5.31: 冥界竜ダークバハムート。属性ブレスは純粋ダメージなので土属性名で代表登録。
  q_dark_bahamut: profile(75, [
    ['呪いのツメ','イエローアースブレス','イエローアースブレス','こうげき!','イエローアースブレス','イエローアースブレス'],
    ['呪いのツメ','イエローアースブレス','イエローアースブレス','こうげき!','イエローアースブレス','イエローアースブレス'],
    ['呪いのツメ','イエローアースブレス','イエローアースブレス','こうげき!','イエローアースブレス','イエローアースブレス'],
    ['呪いのツメ','イエローアースブレス','イエローアースブレス','こうげき!','イエローアースブレス','イエローアースブレス'],
    ['呪いのツメ','イエローアースブレス','イエローアースブレス','こうげき!','イエローアースブレス','イエローアースブレス']
  ]),

  // v0.5.60: 赤のプリンセス。BOSS専用〖召喚★★〗は内部BOSS召喚枠の吟遊詩人キドリを補充する。
  old0_red_princess: profile(20, [
    ['ミス','こうげき','こうげき','こうげき','★→★★','★→★★'],
    ['プリンセスのおうえん','プリンセスのおうえん','プリンセスのおうえん','プリンセスのおうえん','★★→★★★','召喚★★'],
    ['プリンセスのおうえん','プリンセスのおうえん','プリンセスのおうえん','プリンセスのおうえん','★★★→★★★★','召喚★★'],
    ['プリンセスのおうえん','プリンセスのおうえん','プリンセスのおうえん','プリンセスのおうえん','★★★★→★★★★★','召喚★★'],
    ['プリンセスのおうえん','召喚★★','プリンセスのおうえん','召喚★★','プリンセスのおうえん','召喚★★']
  ], {
    // 実行ファイルのBOSS専用召喚設定（ally1/ally2）とparam_enemy8の編成から、
    // 現行アプリでは倒れた／不在の吟遊詩人キドリを空き枠へ補充する。生存中は重複召喚しない。
    '召喚★★': skill('召喚★★', { kind:'effect', target:'self', attackType:'magic', effects:[{ type:'summonCompanion', name:'吟遊詩人キドリ', startReel:0, onlyIfMissing:true }] })
  }),

  // v0.5.34: 死神グリム。属性即死とデス、グリ2体のダーク!沈黙を追跡する。
  old1_grim: profile(70, [
    ['★→★★','ほほえんでいる','ダーク!','ドウン!','こうげき','★→★★'],
    ['★★→★★★','火は消える','火は消える','火は消える','火は消える','★★→★★★'],
    ['★★★→★★★★','水は涸れる','水は涸れる','水は涸れる','水は涸れる','★★★→★★★★'],
    ['★★★★→★★★★★','土は崩れる','土は崩れる','土は崩れる','土は崩れる','★★★★→★★★★★'],
    ['デス','風は止む','風は止む','風は止む','風は止む','デス']
  ]),

  // v0.5.33: 光王エーリュシオン。罰の追撃は純粋ダメージのみなので発動確率だけ保持する。
  new6_elysion: profile(69, [
    ['なげいている','★→★★','★→★★','ためる','ためる','浄化の炎'],
    ['なげいている','怠惰の罰','怠惰の罰','ためる','★★→★★★','怠惰の罰'],
    ['こうげき!','憤怒の罰','こうげき!','憤怒の罰','★★★→★★★★','★★★→★★★★'],
    ['こうげき!','色欲の罰','★★★★→★★★★★','ためる','浄化の炎','色欲の罰'],
    ['大食の罰','★★★★★→★★★★★★','大食の罰','★★★★★→★★★★★★','ためる','大食の罰'],
    ['こうげき!','浄化の炎','憤怒の罰','浄化の炎','★★★★★★→★★★★★★★','★★★★★★→★★★★★★★'],
    ['必殺の一撃','なげいている','会心の一撃','怠惰の罰','浄化の炎','憤怒の罰']
  ]),

  // v0.5.33: 死霊使いワイト。召喚とアルラ系の自爆離脱／不成立時再行動を追跡する。
  new6_wight: profile(40, [
    ['様子を見ている','こうげき','こうげき!','アンデッドガード','★→★★','会心の一撃'],
    ['様子を見ている','アルラウネ召喚','こうげき','アルラウネ召喚','★★→★★★','アルラウネアタック'],
    ['アンデッド召喚★★★','様子を見ている','アンデッドガード','アンデッドガード','★★★→★★★★','会心の一撃'],
    ['こうげき!','会心の一撃','アルラウネ召喚','こうげき!','★★★★→★★★★★','アンデッドガード'],
    ['アルラウネ召喚','アンデッド召喚★★★','アルラウネアタック','アルラウネアタック','会心の一撃','アルラウネアタック']
  ]),

  // v0.5.32: 聖竜アークドラゴン。通常コマンドはすべて純粋ダメージなので、行動確率だけ保持する。
  new6_arc_dragon: profile(60, [
    ['ほほえんでいる','こうげき','こうげき!','★→★★','ためる','ホワイトブレス'],
    ['ほほえんでいる','ホワイトブレス','こうげき!','★★→★★★','ためる','低空ダイブ'],
    ['こうげき','こうげき!','低空ダイブ','★★★→★★★★','ためる','ホワイトブレス'],
    ['こうげき','こうげき!','ホワイトブレス','★★★★→★★★★★','★★★★→★★★★★','グランダイブ'],
    ['低空ダイブ','ほほえんでいる','ホワイトブレス','ためる','★★★★★→★★★★★★','ホワイトブレス'],
    ['こうげき!','ホワイトブレス','低空ダイブ','ためる','★★★★★★→★★★★★★★','グランダイブ'],
    ['ホワイトブレス','ホワイトブレス','低空ダイブ','グランダイブ','低空ダイブ','グランダイブ']
  ]),

  // v0.5.32: 金陽のミカエル。太陽の加護は使用した「そのマス」だけ金色の刻印へ変化する。
  q_michael: profile(75, [
    ['うつむいている','こうげき','太陽の加護','★→★★','★→★★','ライト・イレイザー'],
    ['★★→★★★','こうげき!','金色の刻印','★★→★★★','金色の刻印','★★→★★★'],
    ['こうげき!','こうげき','リヒト!!!!','★★★→★★★★','★★★→★★★★','リヒト!!!!'],
    ['太陽の加護','金色の刻印','★★★★→★★★★★','こうげき!','★★★★→★★★★★','ライト・イレイザー'],
    ['金色の刻印','うつむいている','★★★★★→★★★★★★','★★★★★→★★★★★★','★★★★★→★★★★★★','リヒト!!!!'],
    ['ライト・イレイザー','こうげき!','★★★★★★→★★★★★★★','リヒト!!!!','★★★★★★→★★★★★★★','ライト・イレイザー'],
    ['金色の刻印','こうげき','ライト・イレイザー','★★★★★★★→★★★★★★★★','★★★★★★★→★★★★★★★★','ライト・イレイザー'],
    ['太陽の加護','リヒト!!!!','こうげき!','リヒト!!!!','ライト・イレイザー','金色の刻印']
  ]),

  // v0.5.49: 海賊王ドック・ロー。BOSS専用7リール。
  q_dock_low: profile(75, [
    ['蒼染の月明','蒼染の月明','こうげき!','ぬすむ','★→★★','★→★★'],
    ['深海の叫び','深海の叫び','会心の一撃','ぬすむ','★★→★★★','★★→★★★'],
    ['蒼染の月明','蒼染の月明','会心の一撃','会心の一撃','★★★→★★★★','★★★→★★★★'],
    ['蒼染の月明','深海の叫び','ぬすむ','会心の一撃','会心の一撃','★★★★→★★★★★'],
    ['蒼染の月明','深海の叫び','ぬすむ','大海流','大海流','★★★★★→★★★★★★'],
    ['蒼染の月明','深海の叫び','必殺の一撃','必殺の一撃','ミス','★★★★★★→★★★★★★★'],
    ['★★★★★★★→★','★★★★★★★→★','大海流','大海流','大海流','必殺の一撃']
  ]),

  // v0.5.50: 創造神ロケーシャ。BOSS専用8リール。
  // 召喚先はBOSSページで確認された固定対応（★=バロ、★★=イシザル、★★★=カルラ、★★★★=アシユラ）。
  q_lokesha: profile(75, [
    ['召喚★','★→★★','★→★★','★→★★','★→★★','召喚★'],
    ['召喚★★','★★→★★★','★★→★★★','プラパンチャ','★★→★★★','召喚★★'],
    ['召喚★★★','こうげき!','★★★→★★★★','ブラフマーストラ','★★★→★★★★','召喚★★★'],
    ['会心の一撃','こうげき!','ためる','ためる','ためる','召喚★★★'],
    ['ヨガテラピー','こうげき!','★★★★★→★★★★★★','ブラフマーストラ','★★★★★→★★★★★★','召喚★★★'],
    ['ヨガテラピー','ブラフマーストラ','★★★★★★→★★★★★★★','会心の一撃','★★★★★★→★★★★★★★','召喚★★★★'],
    ['召喚★★★★','ヨガテラピー','ヨガテラピー','★★★★★★★→★★★★★★★★','★★★★★★★→★★★★★★★★','召喚★★★★'],
    ['ヨガテラピー','プラパンチャ','会心の一撃','ブラフマーストラ','ブラフマーストラ','召喚★★★★']
  ], {
    'プラパンチャ': skill('プラパンチャ', {
      kind:'attack', multiplier:100, target:'all', attackType:'magic', attributes:['light'],
      // 実戦ではロケーシャ側の味方1体の属性も付加される。敵の純粋ダメージだけに影響するためメタデータのみ保持。
      addsOneEnemyAllyAttribute:true
    }),
    'ブラフマーストラ': skill('ブラフマーストラ', {
      kind:'attack', multiplier:140, target:'all', attackType:'physical', attributes:['holy'],
      // 左端へ75%火傷。火傷は味方HPだけを減らすため現行の撃破率では追跡しない。
      burnChance:75, burnTarget:'leftmostActive'
    }),
    'ヨガテラピー': skill('ヨガテラピー', {
      // 内部HPPTS/BADSTATUSはいずれもPLAYER_ONE。BOSS＋生存お供からCPU単体対象を等確率で選ぶ。
      kind:'heal', value:80, target:'enemySingle', attackType:'other', effects:[{ type:'enemyStatusCure' }]
    }),
    '召喚★': skill('召喚★', { kind:'effect', target:'self', attackType:'magic', effects:[{ type:'summonCompanion', name:'バロ', startReel:0 }] }),
    '召喚★★': skill('召喚★★', { kind:'effect', target:'self', attackType:'magic', effects:[{ type:'summonCompanion', name:'イシザル', startReel:0 }] }),
    '召喚★★★': skill('召喚★★★', { kind:'effect', target:'self', attackType:'magic', effects:[{ type:'summonCompanion', name:'カルラ', startReel:0 }] }),
    '召喚★★★★': skill('召喚★★★★', { kind:'effect', target:'self', attackType:'magic', effects:[{ type:'summonCompanion', name:'アシユラ', startReel:0 }] })
  }),

  q_dark_priestess: profile(70, [
    ['冥界の城','冥界の城','宵闇の裁き','宵闇の裁き','★→★★','★→★★'],
    ['宵闇の杖','宵闇の杖','ダーク!','ダーク!','★★→★★★','★★→★★★'],
    ['冥界の城','宵闇の裁き','宵闇の杖','ダーク!!!','★★★→★★★★','★★★→★★★★'],
    ['宵闇の裁き','宵闇の裁き','ダーク!','ダーク!!','ダーク!!!','★★★★→★★★★★'],
    ['宵闇の杖','宵闇の杖','ダーク!','ダーク!!','ダーク!!!','★★★★★→★★★★★★'],
    ['冥界の城','宵闇の裁き','宵闇の杖','ダーク!!','ダーク!!','★★★★★★→★★★★★★★'],
    ['★★★★★★★→★','ダーク!!!','ダーク!!!','ダーク!!!','ダーク!!!','ダーク!!!']
  ]),

  // v0.5.41: 第?章。BOSS専用8リール／5リール。
  q_nataraja: profile(70, [
    ['ほほえんでいる','踏魔の踊り','★→★★','生命の踊り','★→★★','踏魔の踊り'],
    ['生命の踊り','ほほえんでいる','★★→★★★','火神の踊り','★★→★★★','火神の踊り'],
    ['火神の踊り','生命の踊り','★★★→★★★★','こうげき','★★★→★★★★','踏魔の踊り'],
    ['こうげき','踏魔の踊り','★★★★→★★★★★','踏魔の踊り','★★★★→★★★★★','火神の踊り'],
    ['火神の踊り','こうげき!','★★★★★→★★★★★★','火神の踊り','★★★★★→★★★★★★','踏魔の踊り'],
    ['踏魔の踊り','火神の踊り','★★★★★★→★★★★★★★','こうげき!','★★★★★★→★★★★★★★','火神の踊り'],
    ['生命の踊り','生命の踊り','★★★★★★★→★★★★★★★★','こうげき!','★★★★★★★→★★★★★★★★','踏魔の踊り'],
    ['こうげき!','生命の踊り','踏魔の踊り','火神の踊り','踏魔の踊り','火神の踊り']
  ]),

  q_zarigarion: profile(60, [
    ['ミス','★→★★','★→★★','竜のしっぽ','竜のしっぽ','オニバサミ'],
    ['ミス','★★→★★★','★★→★★★','竜のしっぽ','オニバサミ','オニバサミ'],
    ['★★★→★★★★','★★★→★★★★','フグバサミ','クラゲバサミ','オニバサミ','オニバサミ'],
    ['ミス','★★★★→★★★★★','フグバサミ','クラゲバサミ','オニバサミ','鋏竜の猛攻'],
    ['フグバサミ','クラゲバサミ','オニバサミ','オニバサミ','鋏竜の猛攻','鋏竜の猛攻']
  ]),

  // v0.5.42: 第?章。BOSS専用6リール／7リール。
  q_ghost_jeanne: profile(60, [
    ['ミス','★→★★','★→★★','こうげき','こうげき!','妄執の攻撃'],
    ['ミス','こうげき!','こうげき!','★★→★★★','★★→★★★','強信の一撃'],
    ['こうげき','★★★→★★★★','★★★→★★★★','こうげき!','妄執の攻撃','妄執の攻撃'],
    ['こうげき','こうげき!','妄執の攻撃','★★★★→★★★★★','★★★★→★★★★★','強信の一撃'],
    ['こうげき','こうげき!','★★★★★→★★★★★★','★★★★★→★★★★★★','強信の一撃','強信の一撃'],
    ['こうげき!','こうげき!','妄執の攻撃','強信の一撃','妄執の攻撃','強信の一撃']
  ]),

  q_dartan: profile(80, [
    ['ミス','こうげき','こうげき!','★→★★','★→★★','狙い撃ち'],
    ['こうげき','こうげき!','狙い撃ち','ためる','★★→★★★','魔弾'],
    ['こうげき','こうげき!','会心の一撃','★★★→★★★★','★★★→★★★★','魔弾'],
    ['必殺の一撃','ためる','魔弾','ためる','ためる','必殺の一撃'],
    ['こうげき','こうげき!','会心の一撃','★★★★★→★★★★★★','★★★★★→★★★★★★','魔弾'],
    ['狙い撃ち','魔弾','ためる','ためる','必殺の一撃','必殺の一撃'],
    ['狙い撃ち','会心の一撃','必殺の一撃','魔弾','必殺の一撃','魔弾']
  ]),

  // v0.5.43: 第?章。騎士団長エンキ／灼熱剣士アレス。
  q_enki: profile(75, [
    ['戦士召喚★★★','戦士召喚★★★','★→★★','ためる','ためる','会心の一撃'],
    ['こうげき','こうげき!','ためる','ためる','★★→★★★','突撃の号令'],
    ['死守の号令','こうげき!','ためる','★★★→★★★★','★★★→★★★★','必殺の一撃'],
    ['突撃の号令','こうげき!','戦士召喚★★★','★★★★→★★★★★','★★★★→★★★★★','戦士召喚★★★'],
    ['こうげき!','死守の号令','突撃の号令','★★★★★→★★★★★★','★★★★★→★★★★★★','必殺の一撃'],
    ['突撃の号令','会心の一撃','会心の一撃','★★★★★★→★★★★★★★','★★★★★★→★★★★★★★','必殺の一撃'],
    ['戦士召喚★★★','必殺の一撃','必殺の一撃','必殺の一撃','必殺の一撃','必殺の一撃']
  ], {
    '戦士召喚★★★': skill('戦士召喚★★★', { kind:'effect', target:'self', attackType:'magic', effects:[{ type:'summonCompanion', name:'ドーシュ', startReel:0 }] }),
    '死守の号令': skill('死守の号令', {
      kind:'effect', target:'enemyCompanion', attackType:'magic', turnContinueIfActiveCompanion:true,
      effects:[
        { type:'companionGuardOrder', duration:2, value:30, warriorValue:60 },
        { type:'disableEnemyCommandNameDuringChain', commandName:'死守の号令' },
        { type:'disableEnemyCommandNameDuringChain', commandName:'突撃の号令' }
      ]
    }),
    '突撃の号令': skill('突撃の号令', {
      kind:'effect', target:'enemyCompanion', attackType:'magic', turnContinueIfActiveCompanion:true,
      effects:[
        { type:'disableEnemyCommandNameDuringChain', commandName:'死守の号令' },
        { type:'disableEnemyCommandNameDuringChain', commandName:'突撃の号令' }
      ]
    })
  }),

  q_blazing_ares: profile(85, [
    ['超熱血!','超熱血!','★→★★','★→★★','超熱血!','★→★★'],
    ['超熱血!','こうげき!','★★→★★★','★★→★★★','★★→★★★','熱剣ヒートセイバー'],
    ['熱剣ヒートセイバー','超熱血!','こうげき!','★★★→★★★★','熱剣ヒートセイバー','★★★→★★★★'],
    ['超熱血!','こうげき!','★★★★→★★★★★','★★★★→★★★★★','こうげき!','熱剣ヒートセイバー'],
    ['★★★★★→★★★★★★','こうげき','こうげき','★★★★★→★★★★★★','★★★★★→★★★★★★','灼熱剣バニングセイバー'],
    ['超熱血!','熱剣ヒートセイバー','こうげき!','★★★★★★→★★★★★★★','灼熱剣バニングセイバー','★★★★★★→★★★★★★★'],
    ['こうげき','ミス','灼熱剣バニングセイバー','真熱剣ソーラセイバー','真熱剣ソーラセイバー','真熱剣ソーラセイバー']
  ]),

  // v0.5.45: 第?章。銀月のルシフェル／大魔皇ラフロイグ。
  q_lucifer: profile(75, [
    ['ほほえんでいる','こうげき','★→★★','こうげき!','★→★★','フォーリン・ダウン'],
    ['こうげき!','フォーリン・ダウン','★★→★★★','★★→★★★','こうげき!','月の闇'],
    ['こうげき!','銀色の光','★★★→★★★★','銀色の光','★★★→★★★★','こうげき'],
    ['ほほえんでいる','月の闇','月の闇','★★★★→★★★★★','★★★★→★★★★★','フォーリン・ダウン'],
    ['★★★★★→★★★★★★','こうげき!','★★★★★→★★★★★★','銀色の光','★★★★★→★★★★★★','月の闇'],
    ['こうげき','月の闇','★★★★★★→★★★★★★★','★★★★★★→★★★★★★★','必殺の一撃','★★★★★★→★★★★★★★'],
    ['銀色の光','★★★★★★★→★★★★★★★★','こうげき!','★★★★★★★→★★★★★★★★','月の闇','フォーリン・ダウン'],
    ['銀色の光','こうげき!','必殺の一撃','月の闇','月の闇','フォーリン・ダウン']
  ]),

  q_great_lafroig: profile(90, [
    ['★→★★','★→★★','火族召喚★★★★','火族召喚★★★★','こうげき!','ほほえんでいる'],
    ['大魔皇の一撃','大魔皇の一撃','★★→★★★','こうげき!','★★→★★★','こうげき'],
    ['会心の一撃','フォッグブレイク','★★★→★★★★','★★★→★★★★','こうげき!','フォッグブレイク'],
    ['大魔皇の一撃','大魔皇の一撃','ためる','★★★★→★★★★★','ブレイジング・ブラッド','ためる'],
    ['こうげき','フォッグブレイク','フォッグブレイク','火族召喚★★★★','★★★★★→★★★★★★','★★★★★→★★★★★★'],
    ['ほほえんでいる','大魔皇の一撃','★★★★★★→★★★★★★★','フォッグブレイク','★★★★★★→★★★★★★★','フォッグブレイク'],
    ['★★★★★★★→★★★★★★★★','★★★★★★★→★★★★★★★★','ブレイジング・ブラッド','ブレイジング・ブラッド','ブレイジング・ブラッド','ブレイジング・ブラッド'],
    ['ほほえんでいる','フォッグブレイク','大魔皇の一撃','火族召喚★★★★','フォッグブレイク','ブレイジング・ブラッド']
  ]),

  // v0.5.44: 第?章。大魔王アズール／大魔王サッカーラ。
  q_great_azul: profile(93, [
    ['ほほえんでいる','ほほえんでいる','★→★★','★→★★','バルバドスの水','海王の海開き'],
    ['ほほえんでいる','こうげき','★★→★★★','★★→★★★','魔海のしもべ召喚★★★','海王の海開き'],
    ['バルバドスの水','こうげき','★★★→★★★★','★★★→★★★★','海王の海開き','海王の海開き'],
    ['魔海のしもべ召喚★★★','こうげき','★★★★→★★★★★','★★★★→★★★★★','バルバドスの水','海王の海開き'],
    ['ほほえんでいる','海王の海開き','★★★★★→★★★★★★','★★★★★→★★★★★★','海王の海開き','バルバドスの水'],
    ['ほほえんでいる','海王の海開き','★★★★★★→★★★★★★★','★★★★★★→★★★★★★★','魔海のしもべ召喚★★★★','海王の海開き'],
    ['こうげき','海王の海開き','★★★★★★★→★★★★★★★★','★★★★★★★→★★★★★★★★','海王の海開き','海王の海開き'],
    ['バルバドスの水','魔海のしもべ召喚★★★★','海王の海開き','海王の海開き','海王の海開き','海王の海開き']
  ], {
    '魔海のしもべ召喚★★★': skill('魔海のしもべ召喚★★★', {
      kind:'effect', target:'self', attackType:'magic', effects:[{ type:'summonCompanion', name:'魔海兵ブリュー', startReel:2 }]
    }),
    '魔海のしもべ召喚★★★★': skill('魔海のしもべ召喚★★★★', {
      kind:'effect', target:'self', attackType:'magic', effects:[{ type:'summonCompanion', name:'魔海将フィスカ', startReel:3 }]
    })
  }),

  q_great_soccerra: profile(90, [
    ['ほほえんでいる','デザートエリート召喚','デザートエリート召喚','★→★★','ためる','★→★★'],
    ['ほほえんでいる','★★→★★★','こうげき!','★★→★★★','デザートエリート召喚','★★→★★★'],
    ['こうげき','こうげき!','会心の一撃','★★★→★★★★','★★★→★★★★','ハンドレッドフィスト'],
    ['こうげき!','ハンドレッドフィスト','会心の一撃','ためる','ためる','ハンドレッドフィスト'],
    ['デザートエリート召喚','デザートエリート召喚','★★★★★→★★★★★★','★★★★★→★★★★★★','デザートエリート召喚','★★★★★→★★★★★★'],
    ['★★★★★★→★★★★★★★','こうげき','★★★★★★→★★★★★★★','ミリオンズフィスト','★★★★★★→★★★★★★★','こうげき'],
    ['ミリオンズフィスト','ハンドレッドフィスト','ほほえんでいる','★★★★★★★→★★★★★★★★','ハンドレッドフィスト','ミリオンズフィスト'],
    ['こうげき!','会心の一撃','会心の一撃','ミリオンズフィスト','ミリオンズフィスト','ミリオンズフィスト']
  ], {
    'デザートエリート召喚': skill('デザートエリート召喚', {
      kind:'effect', target:'self', attackType:'magic', effects:[{
        type:'summonCompanionWeighted', choices:[
          { name:'イムホテプ', weight:30.05, maxHp:140, attack:80, speed:20, startReel:0 },
          { name:'大地の闘士ロック', weight:30.05, maxHp:230, attack:65, speed:40, startReel:0 },
          { name:'古神兵サルベージ', weight:13.3266, maxHp:350, attack:50, speed:90, startReel:3 },
          { name:'岩竜ロックドラゴン', weight:13.2867, maxHp:410, attack:55, speed:5, startReel:0 },
          { name:'スカルボーンドラゴン', weight:13.2867, maxHp:355, attack:60, speed:10, startReel:0 }
        ]
      }]
    })
  }),

  // v0.5.40: 第?章。BOSS専用8リール。
  q_daidarabocchi: profile(85, [
    ['様子を見ている','こうげき','こうげき','ためる','ためる','ナク'],
    ['様子を見ている','こうげき','こうげき!','ためる','ためる','ナク'],
    ['カンガエル','こうげき!','こうげき!','ためる','ためる','ナク'],
    ['カンガエル','こうげき!','こうげき!','ためる','カナシイ','タタカウ'],
    ['ヤスム','こうげき!','こうげき!','ためる','オコル','タタカウ'],
    ['ワラウ','こうげき!','こうげき!','カナシイ','カナシイ','タタカウ'],
    ['ヤスム','こうげき!','タタカウ','オコル','オコル','タタカウ'],
    ['ナク','こうげき!','こうげき!','タタカウ','タタカウ','ワラウ']
  ]),

  q_kenran_kukulkan: profile(65, [
    ['ポイズン・アロマ','★→★★','ポイズン・アロマ','ためる','★→★★','ポイズン・アロマ'],
    ['★★→★★★','スリープ・アロマ','★★→★★★','スリープ・アロマ','ためる','スリープ・アロマ'],
    ['こうげき','ウイングビート','★★★→★★★★','★★★→★★★★','★★★→★★★★','こうげき'],
    ['ウイングビート','こうげき!','★★★★→★★★★★','★★★★→★★★★★','スリープ・アロマ','イチリンザシ'],
    ['イチリンザシ','つつきまくり','ためる','ためる','ウイングビート','ポイズン・アロマ'],
    ['イチリンザシ','イチリンザシ','★★★★★★→★★★★★★★','★★★★★★→★★★★★★★','ウイングビート','つつきまくり'],
    ['こうげき!','ウイングビート','★★★★★★★→★★★★★★★★','★★★★★★★→★★★★★★★★','スリープ・アロマ','イチリンザシ'],
    ['ポイズン・アロマ','ウイングビート','ウイングビート','イチリンザシ','イチリンザシ','イチリンザシ']
  ]),

  q_great_kujeska: profile(75, [
    ['ほほえんでいる','こうげき!','★→★★','★→★★','ためる','こうげき!'],
    ['ほほえんでいる','アイスバーグ','こうげき!','モスコミューズ','ためる','★★→★★★'],
    ['アイスバーグ','こうげき!','モスコミューズ','ほほえんでいる','★★★→★★★★','★★★→★★★★'],
    ['こうげき!','会心の一撃','ホワイトルシアン','こうげき!','★★★★→★★★★★','★★★★→★★★★★'],
    ['モスコミューズ','ホワイトルシアン','会心の一撃','ほほえんでいる','★★★★★→★★★★★★','★★★★★→★★★★★★'],
    ['こうげき!','モスコミューズ','会心の一撃','アイスバーグ','★★★★★★→★★★★★★★','★★★★★★→★★★★★★★'],
    ['アイスバーグ','会心の一撃','アイスバーグ','ホワイトルシアン','★★★★★★★→★★★★★★★★','ほほえんでいる'],
    ['アイスバーグ','アイスバーグ','こうげき','モスコミューズ','会心の一撃','ホワイトルシアン']
  ]),

  q_great_muus: profile(90, [
    ['★→★★','ほほえんでいる','ほほえんでいる','★→★★','★→★★','★→★★'],
    ['大魔王の一撃','★★→★★★','グリルファイア','★★→★★★','グリルブースト','★★→★★★'],
    ['ほほえんでいる','ほほえんでいる','大魔王の一撃','★★★→★★★★','会心の一撃','★★★→★★★★'],
    ['★★★★→★★★★★','グリルブースト','★★★★→★★★★★','こうげき!','★★★★→★★★★★','グリルブースト'],
    ['ほほえんでいる','グリルファイア','ためる','大魔王の一撃','★★★★★→★★★★★★','会心の一撃'],
    ['グリルブースト','こうげき!','★★★★★★→★★★★★★★','こうげき!','★★★★★★→★★★★★★★','グリルファイア'],
    ['ほほえんでいる','ためる','グリルファイア','ためる','グリルブースト','大魔王の一撃'],
    ['グリルブースト','こうげき','大魔王の一撃','会心の一撃','グリルファイア','グリルブースト']
  ]),

  q_ice_dante: profile(70, [
    ['ミス','アイスウェイブ','ためる','アイスウェイブ','★→★★','氷葬の儀'],
    ['こうげき!','アイスウェイブ','ためる','会心の一撃','★★→★★★','アイスウェイブ・グラン'],
    ['こうげき','こうげき!','ためる','アイスウェイブ・グラン','★★★→★★★★','アイスウェイブ・グラン'],
    ['ミス','会心の一撃','★★★★→★★★★★','★★★★→★★★★★','氷葬の儀','アイスウェイブ・グラン'],
    ['こうげき','アイスウェイブ','アイスウェイブ・グラン','★★★★★→★★★★★★','★★★★★→★★★★★★','会心の一撃'],
    ['氷葬の儀','アイスウェイブ・グラン','ためる','ためる','血凍の太刀','★★★★★★→★★★★★★★'],
    ['アイスウェイブ','こうげき!','アイスウェイブ','会心の一撃','アイスウェイブ・グラン','血凍の太刀']
  ]),

  new5_barolo: profile(75, [
    ['みくだしている','こうげき','こうげき!','ためる','★→★★','暗寧のシジマ'],
    ['こうげき','こうげき!','海王の一撃','ためる','★★→★★★','こうげき!'],
    ['みくだしている','こうげき!','暗寧のシジマ','ためる','★★★→★★★★','海王の一撃'],
    ['こうげき','こうげき!','ためる','ためる','会心の一撃','深海の抱擁'],
    ['こうげき!','暗寧のシジマ','★★★★★→★★★★★★','★★★★★→★★★★★★','こうげき!','海王の一撃'],
    ['みくだしている','深海の抱擁','ためる','★★★★★★→★★★★★★★','ためる','会心の一撃'],
    ['暗寧のシジマ','会心の一撃','海王の一撃','こうげき','海王の一撃','必殺の一撃']
  ]),
  new5_god_barolo: profile(85, [
    ['みくだしている','こうげき!','ためる','ためる','ためる','海帝の一撃'],
    ['こうげき','海帝の一撃','ためる','ためる','★★→★★★','浸食する潮'],
    ['こうげき!','浸食する潮','会心の一撃','★★★→★★★★','★★★→★★★★','深海の抱擁'],
    ['浸食する潮','こうげき','★★★★→★★★★★','こうげき!','★★★★→★★★★★','海帝の一撃'],
    ['こうげき!','みくだしている','★★★★★→★★★★★★','深海の抱擁','★★★★★→★★★★★★','必殺の一撃'],
    ['会心の一撃','こうげき','★★★★★★→★★★★★★★','海帝の一撃','★★★★★★→★★★★★★★','深海の抱擁'],
    ['こうげき','深海の抱擁','ためる','ためる','ためる','深海の抱擁'],
    ['みくだしている','こうげき!','必殺の一撃','浸食する潮','海帝の一撃','必殺の一撃']
  ])
});

const COMPANION_COMMAND_PROFILES = Object.freeze({
  // v0.5.50: 創造神ロケーシャの固定お供／召喚先。ステータスはLv1最低表示値。
  // バロ・イシザル・アシユラは撃破率に影響する補助・状態異常を持たないため、純粋ダメージ行動を省略する高速経路を使う。
  'バロ': Object.freeze({ attribute:'fire', speed:29, attack:38, killProbabilityInert:true, matrix:Object.freeze([
    Object.freeze(['ミス','こうげき','こうげき','こうげき!','あばれまわり','あばれまわり'])
  ]) }),
  'イシザル': Object.freeze({ attribute:'wind', speed:38, attack:42, killProbabilityInert:true, matrix:Object.freeze([
    Object.freeze(['ミス','ミス','こうげき','こうげき','★→★★','あばれまくり']),
    Object.freeze(['こうげき','こうげき','こうげき','こうげき!','あばれまくり','あばれまくり'])
  ]) }),
  // v0.5.64: 進化後の継承欄はユーザー指定により、進化元の入手時初期リールを基準にする。
  // カルラ1・2リール = 進化元カラステングの初期1・2リール。
  // カラステング1リールも継承欄なので、さらに進化元カラスの入手時初期リールを基準にする。
  'カルラ': Object.freeze({ attribute:'wind', speed:50, attack:46, inheritedBaseline:true, matrix:Object.freeze([
    Object.freeze(['笑っている','笑っている','こうげき','こうげき','こうげき','黒い旋風']),
    Object.freeze(['笑っている','こうげき','こうげき!','大喝','テングツブテ','テングツブテ']),
    Object.freeze(['笑っている','大喝','こうげき!','こうげき!','テングツブテ','蛇殺しの一撃'])
  ]), skills:Object.freeze({
    '大喝': ENEMY_SKILLS['大喝'],
    // 純粋な敵→味方ダメージ量は現行撃破率で追跡しないため、攻撃種別だけ保持する。
    '黒い旋風': skill('黒い旋風', { kind:'attack', target:'random', attackType:'magic', attributes:['dark'] }),
    'テングツブテ': skill('テングツブテ', { kind:'attack', target:'random', attackType:'physical', attributes:['none'] }),
    '蛇殺しの一撃': skill('蛇殺しの一撃', { kind:'attack', target:'random', attackType:'physical', attributes:['none'] })
  }) }),
  'アシユラ': Object.freeze({ attribute:'fire', speed:55, attack:73, killProbabilityInert:true, matrix:Object.freeze([
    Object.freeze(['こうげき','こうげき','こうげき!','ためる','ためる','2回こうげき']),
    Object.freeze(['2回こうげき','2回こうげき','3回こうげき','ためる','ためる','3回こうげき']),
    Object.freeze(['2回こうげき','3回こうげき','3回こうげき','ためる','ためる','4回こうげき']),
    Object.freeze(['3回こうげき','4回こうげき','4回こうげき','4回こうげき','5回こうげき','5回こうげき'])
  ]) }),

  // v0.5.45: 大魔皇ラフロイグの〖火族召喚★★★★〗専用ピートー。
  // 1リール目は進化元ピートの初期コマンドを基準値として採用する（ピートー側は継承枠のため固定表がない）。
  'ピートー': Object.freeze({ attribute:'fire', speed:25, attack:50, matrix:Object.freeze([
    Object.freeze(['燃えている','こうげき','こうげき','こうげき','火に油を注ぐ','火に油を注ぐ']),
    Object.freeze(['燃えている','こうげき!','こうげき!','★★→★★★','火に油を注ぐ','火の用心']),
    Object.freeze(['燃えている','こうげき!','こうげき!','こうげき!','燃えるこぶし','燃えるこぶし'])
  ]), skills:Object.freeze({
    '火に油を注ぐ': ENEMY_SKILLS['火に油を注ぐ'],
    '火の用心': ENEMY_SKILLS['火の用心'],
    '燃えるこぶし': ENEMY_SKILLS['燃えるこぶし']
  }) }),

  // v0.5.44: 大魔王アズール／大魔王サッカーラの召喚先。
  // アズール側はLv1相当・最大リール、サッカーラ側はLv10・最大リール。
  'ブリュー': Object.freeze({ speed:8, attack:50, killProbabilityInert:true, matrix:Object.freeze([
    Object.freeze(['ミス','こうげき','こうげき!','ためる','ためる','会心の一撃']),
    Object.freeze(['ミス','こうげき!','こうげき!','こうげき!','会心の一撃','会心の一撃'])
  ]) }),
  '魔海将フィスカ': Object.freeze({ speed:38, attack:67, matrix:Object.freeze([
    Object.freeze(['ミス','ミス','こうげき','★→★★','会心の一撃','アイスパーティクル']),
    Object.freeze(['ミス','こうげき','こうげき!','★★→★★★','アイスパーティクル','アイスパーティクル']),
    Object.freeze(['アイスデン','こうげき','こうげき!','★★★→★★★★','アイスパーティクル','アイスバインド']),
    Object.freeze(['アイスデン','こうげき!','会心の一撃','会心の一撃','アイスパーティクル','アイスバインド'])
  ]) }),
  'イムホテプ': Object.freeze({ speed:20, attack:80, maxReelBaseline:true, matrix:Object.freeze([
    Object.freeze(['ほほえんでいる','アシド','アシド!','吸収魔法','吸収魔法','デス'])
  ]), skills:Object.freeze({
    'アシド': skill('アシド', { kind:'attack', target:'random', attackType:'magic', attributes:['none'] }),
    'アシド!': skill('アシド!', { kind:'attack', target:'random', attackType:'magic', attributes:['none'] }),
    '吸収魔法': skill('吸収魔法', { kind:'lifestealAttack', multiplier:100, healRate:80, target:'random', attackType:'magic', attributes:['dark'] })
  }) }),
  '大地の闘士ロック': Object.freeze({ speed:40, attack:65, maxReelBaseline:true, killProbabilityInert:true, matrix:Object.freeze([
    Object.freeze(['こうげき','パンチコンボ','パンチコンボ','キックコンボ','キックコンボ','コンボフィニッシャー'])
  ]), skills:Object.freeze({
    'パンチコンボ': skill('パンチコンボ', { kind:'attack', target:'random', attackType:'physical', attributes:['none'] }),
    'キックコンボ': skill('キックコンボ', { kind:'attack', target:'random', attackType:'physical', attributes:['none'] }),
    'コンボフィニッシャー': skill('コンボフィニッシャー', { kind:'attack', target:'random', attackType:'physical', attributes:['none'] })
  }) }),
  '岩竜ロックドラゴン': Object.freeze({ speed:5, attack:55, maxReelBaseline:true, matrix:Object.freeze([
    Object.freeze(['ミス','こうげき','岩落とし','竜の咆哮','ロックブレス','ロックブレス'])
  ]), skills:Object.freeze({
    '岩落とし': skill('岩落とし', { kind:'attack', multiplier:240, target:'random', attackType:'physical', attributes:['earth'] }),
    '竜の咆哮': skill('竜の咆哮', { kind:'effect', target:'all', attackType:'other', effects:[
      { type:'status', status:'paralysis', chance:30, duration:1 },
      { type:'status', status:'confusion', chance:30, duration:1 }
    ] }),
    'ロックブレス': skill('ロックブレス', { kind:'attack', multiplier:150, target:'all', attackType:'breath', attributes:['earth'], effects:[
      { type:'status', status:'petrification', chance:12, duration:99, target:'damaged' }
    ] })
  }) }),
  'スカルボーンドラゴン': Object.freeze({ speed:10, attack:60, maxReelBaseline:true, matrix:Object.freeze([
    Object.freeze(['ほねをやすめている','こうげき','こうげき','石化ブレス','石化ブレス','石化ブレス'])
  ]), skills:Object.freeze({
    'ほねをやすめている': skill('ほねをやすめている', { kind:'effect', target:'self', attackType:'other', effects:[] }),
    '石化ブレス': skill('石化ブレス', { kind:'attack', multiplier:110, target:'all', attackType:'breath', attributes:['earth'], effects:[
      { type:'status', status:'petrification', chance:15, duration:99, target:'damaged' }
    ] })
  }) }),
  // 素早さは入手時(Lv1)の最低表示値を固定基準として使用する。
  // v0.5.43: (BOSS)騎士団長エンキの〖戦士召喚★★★〗で呼び出される個体。
  'ドーシュ': Object.freeze({ attribute:'wind', race:'warrior', speed:16, attack:50, matrix:Object.freeze([
    Object.freeze(['ミス','こうげき','こうげき!','★→★★','狙い撃ち','フェザーキラー']),
    Object.freeze(['こうげき','こうげき','こうげき!','会心の一撃','フェザーキラー','フェザーキラー'])
  ]) }),
  // v0.5.40: (BOSS)魔王アヴァドンの固定お供／召喚先。Lv1最低表示値と初期コマンド。
  'アヴァドンフード': Object.freeze({ speed:29, attack:4, matrix:Object.freeze([
    Object.freeze(['ミス','EXゲージ+1','EXゲージ+1','EXゲージ+2','EXゲージ+3','ふたをする'])
  ]), skills:Object.freeze({
    // 物理技を1度だけ無効化し、使用したマスを永続ミス化して即再行動する。
    // 物理技を無効化した場合、その攻撃に付随する味方→敵の状態異常も命中扱いにしない。
    'ふたをする': skill('ふたをする', {
      kind:'effect', target:'self', attackType:'physical',
      effects:[{ type:'companionOneHitGuard', attackTypes:['physical'] }],
      replaceUsedSlotWith:'ミス', turnContinue:true
    })
  }) }),
  // コマンドは入手時初期コマンド。継承欄がある場合は下位種の初期コマンドを基準にする。
  // v0.5.39: ニラーハラー召喚先／ガープ固定お供。
  'ナンクルマル': Object.freeze({ speed:42, attack:42, matrix:Object.freeze([
    Object.freeze(['ほほえんでいる','ほほえんでいる','こうげき','かみくだき','ためる','★→★★']),
    Object.freeze(['ほほえんでいる','ゆうらん','こうげき!','会心の一撃','ためる','★★→★★★']),
    Object.freeze(['すいこみ','こうげき!','ゆうらん','かみくだき','ためる','★★★→★★★★']),
    Object.freeze(['こうげき!','こうげき!','すいこみ','すいこみ','会心の一撃','かみくだき'])
  ]) }),
  // 1・2リールは「鏡戦士リフレクから継承」。CPU個体の固有継承値は公開資料で確定できないため進化元の初期値を基準にする。
  '魔鏡騎士リフレク': Object.freeze({ attribute:'water', race:'warrior', speed:59, attack:33, matrix:Object.freeze([
    Object.freeze(['ミス','こうげき','こうげき!','★→★★','こうげき!','マジック・リフレクト']),
    Object.freeze(['こうげき','こうげき!','こうげき!','こうげき!','会心の一撃','トール・マジック・リフレクト']),
    Object.freeze(['こうげき','こうげき!','こうげき!','ミラーソード','ミラーソード','グラン・マジック・リフレクト'])
  ]), inheritedBaseline:true, skills:Object.freeze({
    'ミラーソード': skill('ミラーソード', { kind:'attack', multiplier:200, target:'random', attackType:'physical', attributes:['none'] }),
    'マジック・リフレクト': skill('マジック・リフレクト', { kind:'effect', target:'self', attackType:'physical', effects:[{ type:'companionMagicReflect', ratio:40 }] }),
    'トール・マジック・リフレクト': skill('トール・マジック・リフレクト', { kind:'effect', target:'self', attackType:'physical', effects:[{ type:'companionMagicReflect', ratio:70 }] }),
    'グラン・マジック・リフレクト': skill('グラン・マジック・リフレクト', { kind:'effect', target:'self', attackType:'physical', effects:[{ type:'companionMagicReflect', ratio:100 }] })
  }) }),
  'ダークサラマンダー': Object.freeze({ attribute:'fire', race:'dragon', speed:25, attack:46, matrix:Object.freeze([
    Object.freeze(['燃えている','燃えている','こうげき','★→★★','★→★★','黒炎のいき']),
    Object.freeze(['こうげき','こうげき','こうげき','★★→★★★','★★→★★★','黒炎のいき']),
    Object.freeze(['燃えている','こうげき','ファイアーブレス','ファイアーブレス','黒炎のいき','黒炎のいき'])
  ]) }),
  // v0.5.37: ストリームドラゴン／アッシュドラゴンの固定お供。
  '海竜のしずく': Object.freeze({ speed:2, attack:1, matrix:Object.freeze([
    Object.freeze(['ときをまつ','ときをまつ','ときをまつ','ときをまつ','ときをまつ','ときをまつ'])
  ]) }),
  '竜灰': Object.freeze({ speed:1, attack:1, matrix:Object.freeze([
    Object.freeze(['ときをまつ','ときをまつ','ときをまつ','ときをまつ','ときをまつ','ときをまつ'])
  ]) }),
  // v0.5.36: (BOSS)ダムキナの固定お供。Lv1最低表示値と入手時初期コマンド。
  'マト': Object.freeze({ speed:4, attack:33, matrix:Object.freeze([
    Object.freeze(['ミス','こうげき','こうげき','こうげき!','うなる','まるかじり'])
  ]) }),
  'ベージ': Object.freeze({ speed:76, attack:16, killProbabilityInert:true, matrix:Object.freeze([Object.freeze(['ミス','ミス','こうげき','こうげき!','かばう','かばう'])]) }),
  'グリ': Object.freeze({ speed:55, attack:22, matrix:Object.freeze([Object.freeze(['ほほえんでいる','ほほえんでいる','ほほえんでいる','こうげき','こうげき!','ダーク!'])]) }),
  '吟遊詩人キドリ': Object.freeze({ speed:60, attack:38, matrix:Object.freeze([
    Object.freeze(['ミス','ミス','ミス','★→★★','★→★★','会心の一撃']),
    Object.freeze(['ミス','ミス','会心の一撃','★★→★★★','★★→★★★','必殺の一撃']),
    Object.freeze(['★★★→★','★★★→★','★★★→★','必殺の一撃','必殺の一撃','必殺の一撃'])
  ]) }),
  // (BOSS)斉天大聖ソンゴクウの固定お供。Lv1最低表示値。
  // はねまわるは純粋ダメージ。レイキをやどすは敵EXゲージ+2として失敗判定へ反映。
  '猿石': Object.freeze({ speed:4, attack:4, matrix:Object.freeze([
    Object.freeze(['ミス','ミス','ミス','はねまわる','はねまわる','レイキをやどす'])
  ]), skills:Object.freeze({
    'はねまわる': skill('はねまわる', { kind:'attack', multiplier:100, hits:4, target:'randomEachHit', attackType:'physical', attributes:['none'] }),
    'レイキをやどす': skill('レイキをやどす', { kind:'effect', target:'self', attackType:'other', enemyExGain:2, effects:[] })
  }) }),
  '古神兵サルベージ': Object.freeze({ speed:20, attack:45, matrix:Object.freeze([
    Object.freeze(['ミス','ミス','こうげき','こうげき!','★→★★','かばう']),
    Object.freeze(['ミス','こうげき','こうげき!','会心の一撃','★★→★★★','かばう']),
    Object.freeze(['こうげき','こうげき','会心の一撃','かばう','★★★→★★★★','かばう']),
    Object.freeze(['こうげき!','会心の一撃','必殺の一撃','かばう','かばう','召喚★'])
  ]), skills:Object.freeze({
    // CPUでは召喚★からベージを呼ぶ挙動が確認されている。かばう自体は現行方針どおり未再現。
    '召喚★': skill('召喚★', { kind:'effect', target:'self', attackType:'magic', effects:[{ type:'summonCompanion', name:'ベージ', startReel:0 }] })
  }) }),
  // v0.5.65: CPU通常召喚 group1～4。内部chara_data.csvのLv1初期コマンド。
  // HP/攻撃/素早さは召喚effect側で内部値を明示し、BOSS固定個体と同名でも混同しない。
  'スライム': Object.freeze({ attribute:'water', race:'slime', speed:60, attack:10, matrix:Object.freeze([
    Object.freeze(['ミス','ミス','EXゲージ+1','EXゲージ+2','EXゲージ+3','EXゲージ+4'])
  ]) }),
  'ジバクガエル': Object.freeze({ attribute:'wind', race:'aquatic', speed:10, attack:25, matrix:Object.freeze([
    Object.freeze(['ミス','ミス','ミス','こうげき','こうげき!','とっこう'])
  ]) }),
  'ウサミコ': Object.freeze({ attribute:'water', race:'beast', speed:40, attack:20, matrix:Object.freeze([
    Object.freeze(['かいふくのいのり','かいふくのいのり','かいふくのいのり','かいふくのいのり','かいふくのいのり','召喚★'])
  ]), skills:Object.freeze({
    '召喚★': skill('召喚★', { kind:'effect', target:'self', attackType:'magic', effects:[{ type:'summonCompanionWeighted', choices:[
      { name:'スライム', weight:400, maxHp:10, attack:10, speed:60, attribute:'water', race:'slime', startReel:0 },
      { name:'ジバクガエル', weight:300, maxHp:40, attack:25, speed:10, attribute:'wind', race:'aquatic', startReel:0 },
      { name:'ウサミコ', weight:200, maxHp:35, attack:20, speed:40, attribute:'water', race:'beast', startReel:0 },
      { name:'チビドラゴン', weight:100, maxHp:75, attack:25, speed:20, attribute:'water', race:'dragon', startReel:0 }
    ] }] })
  }) }),
  'チビドラゴン': Object.freeze({ attribute:'water', race:'dragon', speed:20, attack:25, matrix:Object.freeze([
    Object.freeze(['こうげき','こうげき','こうげき','こうげき','たいあたり','アイスブレス'])
  ]) }),
  'スライム・シルバー': Object.freeze({ attribute:'wind', race:'slime', speed:70, attack:20, matrix:Object.freeze([
    Object.freeze(['ミス','ミス','EXゲージ+1','EXゲージ+2','★→★★','EXゲージ+4']),
    Object.freeze(['ミス','EXゲージ+1','EXゲージ+2','EXゲージ+2','EXゲージ+3','EXゲージ+4'])
  ]) }),
  '魔法使いジヨン': Object.freeze({ attribute:'water', race:'magician', speed:60, attack:45, matrix:Object.freeze([
    Object.freeze(['ファイア!','ファイア!','ファイア!','★→★★','★→★★','★→★★']),
    Object.freeze(['アイスニードル','アイスニードル','アイスニードル','アイスニードル','アイスニードル','アイスニードル'])
  ]) }),
  'ライジイ': Object.freeze({ attribute:'wind', race:'warrior', speed:60, attack:40, matrix:Object.freeze([
    Object.freeze(['ミス','サンダー!','デンゲキ','デンゲキ','★→★★','★→★★']),
    Object.freeze(['デンゲキ','デンゲキ','デンゲキ','デンゲキ','デンゲキ','デンゲキ'])
  ]) }),
  'ケツアル': Object.freeze({ attribute:'wind', race:'dragon', speed:60, attack:30, matrix:Object.freeze([
    Object.freeze(['こうげき','こうげき','こうげき','こうげき','★→★★','はばたき']),
    Object.freeze(['こうげき','こうげき','こうげき','こうげき','つっつき','はばたき'])
  ]) }),
  'スライム・ゴールド': Object.freeze({ attribute:'earth', race:'slime', speed:80, attack:30, matrix:Object.freeze([
    Object.freeze(['ミス','ミス','EXゲージ+1','EXゲージ+2','★→★★','EXゲージ+4']),
    Object.freeze(['ミス','EXゲージ+1','EXゲージ+2','EXゲージ+2','★★→★★★','EXゲージ+4']),
    Object.freeze(['ミス','EXゲージ+2','EXゲージ+2','EXゲージ+3','EXゲージ+4','EXゲージ+5'])
  ]) }),
  'スフク': Object.freeze({ attribute:'earth', race:'birdbeast', speed:40, attack:50, matrix:Object.freeze([
    Object.freeze(['EXゲージ+1','EXゲージ+1','EXゲージ+2','EXゲージ+2','★→★★','召喚★★']),
    Object.freeze(['EXゲージ+1','EXゲージ+1','EXゲージ+2','EXゲージ+3','★★→★★★','召喚★★★']),
    Object.freeze(['★★★→★','こうげき!','EXゲージ+2','EXゲージ+3','EXゲージ+4','召喚★★★★'])
  ]), skills:Object.freeze({
    '召喚★★': skill('召喚★★', { kind:'effect', target:'self', attackType:'magic', effects:[{ type:'summonCompanionWeighted', choices:[
      { name:'スライム・シルバー', weight:400, maxHp:60, attack:20, speed:70, attribute:'wind', race:'slime', startReel:0 },
      { name:'魔法使いジヨン', weight:300, maxHp:80, attack:45, speed:60, attribute:'water', race:'magician', startReel:0 },
      { name:'ライジイ', weight:200, maxHp:70, attack:40, speed:60, attribute:'wind', race:'warrior', startReel:0 },
      { name:'ケツアル', weight:100, maxHp:100, attack:30, speed:60, attribute:'wind', race:'dragon', startReel:0 }
    ] }] }),
    '召喚★★★': skill('召喚★★★', { kind:'effect', target:'self', attackType:'magic', effects:[{ type:'summonCompanionWeighted', choices:[
      { name:'スライム・ゴールド', weight:450, maxHp:90, attack:30, speed:80, attribute:'earth', race:'slime', startReel:0 },
      { name:'吟遊詩人キドリ', weight:300, maxHp:150, attack:45, speed:70, attribute:'wind', race:'birdbeast', startReel:0 },
      { name:'スフク', weight:200, maxHp:170, attack:50, speed:40, attribute:'earth', race:'birdbeast', startReel:0 },
      { name:'死神モート', weight:50, maxHp:199, attack:44, speed:44, attribute:'earth', race:'demon', startReel:0 }
    ] }] }),
    '召喚★★★★': skill('召喚★★★★', { kind:'effect', target:'self', attackType:'magic', effects:[{ type:'summonCompanionWeighted', choices:[
      { name:'スライム・マナ', weight:490, maxHp:270, attack:40, speed:90, attribute:'fire', race:'slime', startReel:0 },
      { name:'王子マルドク', weight:300, maxHp:230, attack:75, speed:90, attribute:'wind', race:'angel', startReel:0 },
      { name:'アヴァドン', weight:200, maxHp:450, attack:15, speed:5, attribute:'earth', race:'aquatic', startReel:0 },
      { name:'レッドドラゴン', weight:10, maxHp:350, attack:70, speed:30, attribute:'fire', race:'dragon', startReel:0 }
    ] }] })
  }) }),
  '死神モート': Object.freeze({ attribute:'earth', race:'demon', speed:44, attack:44, matrix:Object.freeze([
    Object.freeze(['ほほえんでいる','ほほえんでいる','ダーク','ダーク','★→★★','マインドクラッシュ']),
    Object.freeze(['ほほえんでいる','ほほえんでいる','マインドクラッシュ','マインドクラッシュ','★★→★★★','★★→★★★']),
    Object.freeze(['ほほえんでいる','マインドクラッシュ','マインドクラッシュ','マインドクラッシュ','マインドクラッシュ','そせいの秘法'])
  ]) }),
  'スライム・マナ': Object.freeze({ attribute:'fire', race:'slime', speed:90, attack:40, matrix:Object.freeze([
    Object.freeze(['ミス','ミス','EXゲージ+1','EXゲージ+2','★→★★','EXゲージ+4']),
    Object.freeze(['ミス','EXゲージ+1','EXゲージ+2','EXゲージ+2','★★→★★★','EXゲージ+4']),
    Object.freeze(['ミス','EXゲージ+2','EXゲージ+2','EXゲージ+3','★★★→★★★★','EXゲージ+5']),
    Object.freeze(['炎と氷のいき','炎と氷のいき','炎と氷のいき','炎と氷のいき','炎と氷のいき','炎と氷のいき'])
  ]) }),
  '王子マルドク': Object.freeze({ attribute:'wind', race:'angel', speed:90, attack:75, matrix:Object.freeze([
    Object.freeze(['ミス','召喚★','こうげき!','★→★★','★→★★','会心の一撃']),
    Object.freeze(['ミス','こうげき!','こうげき!','★★→★★★','★★→★★★','会心の一撃']),
    Object.freeze(['ミス','こうげき!','こうげき!','★★★→★★★★','★★★→★★★★','会心の一撃']),
    Object.freeze(['ミス','こうげき!','会心の一撃','会心の一撃','会心の一撃','必殺の一撃'])
  ]), skills:Object.freeze({
    '召喚★': skill('召喚★', { kind:'effect', target:'self', attackType:'magic', effects:[{ type:'summonCompanionWeighted', choices:[
      { name:'スライム', weight:400, maxHp:10, attack:10, speed:60, attribute:'water', race:'slime', startReel:0 },
      { name:'ジバクガエル', weight:300, maxHp:40, attack:25, speed:10, attribute:'wind', race:'aquatic', startReel:0 },
      { name:'ウサミコ', weight:200, maxHp:35, attack:20, speed:40, attribute:'water', race:'beast', startReel:0 },
      { name:'チビドラゴン', weight:100, maxHp:75, attack:25, speed:20, attribute:'water', race:'dragon', startReel:0 }
    ] }] })
  }) }),
  'アヴァドン': Object.freeze({ attribute:'earth', race:'aquatic', speed:5, attack:15, matrix:Object.freeze([
    Object.freeze(['ほほえんでいる','こうげき!','かばう','召喚★','★→★★','魔王の一撃']),
    Object.freeze(['ほほえんでいる','マインドクラッシュ','ふっかつの秘法','召喚★','★★→★★★','魔王の一撃']),
    Object.freeze(['ほほえんでいる','召喚★','たべる','魔王の一撃','★★★→★★★★','魔王の一撃']),
    Object.freeze(['★★★★→★','★★★★→★','たべる','魔王の一撃','たべる','魔王の一撃'])
  ]), skills:Object.freeze({
    '召喚★': skill('召喚★', { kind:'effect', target:'self', attackType:'magic', effects:[{ type:'summonCompanionWeighted', choices:[
      { name:'スライム', weight:400, maxHp:10, attack:10, speed:60, attribute:'water', race:'slime', startReel:0 },
      { name:'ジバクガエル', weight:300, maxHp:40, attack:25, speed:10, attribute:'wind', race:'aquatic', startReel:0 },
      { name:'ウサミコ', weight:200, maxHp:35, attack:20, speed:40, attribute:'water', race:'beast', startReel:0 },
      { name:'チビドラゴン', weight:100, maxHp:75, attack:25, speed:20, attribute:'water', race:'dragon', startReel:0 }
    ] }] })
  }) }),
  'レッドドラゴン': Object.freeze({ attribute:'fire', race:'dragon', speed:30, attack:70, matrix:Object.freeze([
    Object.freeze(['こうげき','こうげき','こうげき','こうげき','★→★★','ファイアーブレス']),
    Object.freeze(['こうげき','こうげき','こうげき','こうげき','★★→★★★','ファイアーブレス']),
    Object.freeze(['竜のしっぽ','竜のしっぽ','竜のしっぽ','竜のしっぽ','★★★→★★★★','ファイアーブレス']),
    Object.freeze(['ファイアーブレス','業火のいき','業火のいき','業火のいき','業火のいき','業火のいき'])
  ]) }),

  // v0.5.66: 〖腐ったにおい〗の内部SYOKAN_RANDOM(group 6)候補。Lv1最低表示値＋初期コマンド。
  'ゾンビ': Object.freeze({ attribute:'earth', race:'undead', speed:17, attack:25, matrix:Object.freeze([
    Object.freeze(['ミス','ミス','★→★★','こうげき','こうげき!','毒のツメ']),
    Object.freeze(['ミス','こうげき','こうげき!','毒のツメ','喰いつき','腐ったにおい'])
  ]), skills:Object.freeze({
    '毒のツメ': skill('毒のツメ', { kind:'attack', multiplier:100, target:'random', attackType:'physical' }),
    '喰いつき': skill('喰いつき', { kind:'lifestealAttack', multiplier:120, healRate:100, target:'random', attackType:'physical', attributes:['poison'] }),
    '腐ったにおい': skill('腐ったにおい', { kind:'effect', target:'self', attackType:'other', effects:[{ type:'summonCompanionWeighted', choices:[{ name:'ゾンビ', weight:300, startReel:0 }, { name:'ゾンビビ', weight:200, startReel:0 }] }] })
  }) }),

  // v0.5.65: 魔皇トカイの〖死霊を呼ぶ声〗召喚先。内部chara_data.csvのLv1値・初期コマンド。
  'ゾンビビ': Object.freeze({ attribute:'earth', race:'undead', speed:30, attack:40, matrix:Object.freeze([
    Object.freeze(['ミス','ミス','★→★★','こうげき','こうげき!','毒のツメ']),
    Object.freeze(['ミス','こうげき','★★→★★★','毒のツメ','喰いつき','腐ったにおい']),
    Object.freeze(['こうげき','ゾンビのゲロ','毒のツメ','喰いつき','喰いつき','猛毒のツメ'])
  ]), skills:Object.freeze({
    // 毒そのものはユーザー指定により無視するが、回復・麻痺・ランダム召喚は撃破率へ反映する。
    '毒のツメ': skill('毒のツメ', { kind:'attack', multiplier:100, target:'random', attackType:'physical' }),
    '喰いつき': skill('喰いつき', { kind:'lifestealAttack', multiplier:120, healRate:100, target:'random', attackType:'physical', attributes:['poison'] }),
    '腐ったにおい': skill('腐ったにおい', { kind:'effect', target:'self', attackType:'other', effects:[{ type:'summonCompanionWeighted', choices:[{ name:'ゾンビ', weight:300, startReel:0 }, { name:'ゾンビビ', weight:200, startReel:0 }] }] }),
    'ゾンビのゲロ': skill('ゾンビのゲロ', { kind:'effect', target:'random', attackType:'other', effects:[{ type:'status', status:'paralysis', chance:50, duration:1 }] }),
    '猛毒のツメ': skill('猛毒のツメ', { kind:'attack', multiplier:200, target:'random', attackType:'physical' })
  }) }),
  // v0.5.61: 大樹竜ルートドラゴンの〖ブランチ〗召喚先。Lv1最低表示値と初期コマンド。
  // 〖パワー・グロウ〗による敵側攻撃力上昇は、味方HPを追跡しない現モデルでは撃破率に影響しないためno-opを維持。
  'ルートン': Object.freeze({ attribute:'wind', race:'dragon', speed:33, attack:33, matrix:Object.freeze([
    Object.freeze(['こうげき','こうげき','こうげき!','ためる','★→★★','パワー・グロウ']),
    Object.freeze(['こうげき','こうげき','こうげき!','こうげき!','パワー・グロウ','パワー・グロウ'])
  ]) }),
  'フェンリル': Object.freeze({ attribute:'wind', race:'beast', speed:46, attack:55, matrix:Object.freeze([
    Object.freeze(['ミス','寝る','こうげき','★→★★','こうげき!','まるかじり']),
    Object.freeze(['ミス','寝る','こうげき!','★★→★★★','まるかじり','ほえる']),
    Object.freeze(['★★★→★','うなる','こうげき!','こうげき!','まるかじり','ほえる'])
  ]), skills:Object.freeze({
    // 発動ターンを含め4回回復し、5ターン目の自動起床では回復しない。
    '寝る': skill('寝る', { kind:'companionSleepBlessing', target:'self', attackType:'other', sleepRemainingAfterCast:4 })
  }) }),
  'ロボ零壱式': Object.freeze({ speed:29, attack:40, matrix:Object.freeze([Object.freeze(['ミス','ミス','こうげき','こうげき!','アイアンクロー','アイアンクロー'])]) }),
  'ロボ零弐式': Object.freeze({ speed:21, attack:50, matrix:Object.freeze([
    Object.freeze(['ミス','こうげき','こうげき','チャージ','チャージ','チョップ']),
    Object.freeze(['こうげき','こうげき!','こうげき!','チョップ','チョップ','ラリアット'])
  ]) }),
  '魔海魚ブブリ': Object.freeze({ speed:42, attack:50, matrix:Object.freeze([
    Object.freeze(['ミス','こうげき','かみつき','★→★★','マヒかみつき','かみつき!']),
    Object.freeze(['ちょうちん','かみつき','かみつき','★★→★★★','かみつき!','マヒかみつき!']),
    Object.freeze(['ちょうちん','かみつき','マヒかみつき','マヒかみつき','マヒかみつき!','かみつき!!'])
  ]) }),
  '魔海兵ブリュー': Object.freeze({ speed:12, attack:55, matrix:Object.freeze([
    Object.freeze(['ミス','こうげき','こうげき!','ためる','ためる','会心の一撃']),
    Object.freeze(['ミス','こうげき!','こうげき!','こうげき!','会心の一撃','会心の一撃']),
    Object.freeze(['魔海サイレン','こうげき','こうげき!','会心の一撃','会心の一撃','アクアカッター'])
  ]), inheritedBaseline:true, skills:Object.freeze({
    // EX由来の通常コマンド。1体を初期コマンドで召喚する。公開確率を正規化して使用。
    '魔海サイレン': skill('魔海サイレン', { kind:'effect', target:'self', attackType:'magic', effects:[{
      type:'summonCompanionWeighted', choices:[
        { name:'ブリュー', weight:33.5556, attack:50, speed:8, startReel:0 },
        { name:'魔海兵ブリュー', weight:44.4444, attack:55, speed:12, startReel:0 },
        { name:'魔海将フィスカ', weight:22.0, attack:67, speed:38, startReel:0 }
      ]
    }] })
  }) }),
  '参謀エンリル': Object.freeze({ speed:59, attack:50, matrix:Object.freeze([
    Object.freeze(['ウィンド','ウィンド','ウィンド!','★→★★','ウィンド!','ミラージュ']),
    Object.freeze(['ウィンド','ウィンド!','ウィンド!','★★→★★★','ウィンド!!','ミラージュ']),
    Object.freeze(['ミラージュ','ウィンド!','ウィンド!!','★★★→★★★★','ウィンド!!','補給命令']),
    Object.freeze(['ミラージュ','ウィンド!','ウィンド!','ウィンド!!!','ウィンド!!!','特配'])
  ]) }),
  '僧兵オニワカ': Object.freeze({ speed:38, attack:50, matrix:Object.freeze([
    // 1・2リールは進化元オニワカの入手時初期コマンドを継承基準とする。
    Object.freeze(['ミス','こうげき','ためる','ためる','足ばらい','ベンケイ立ち']),
    Object.freeze(['こうげき','こうげき!','足ばらい','会心の一撃','ベンケイ立ち','ベンケイ立ち']),
    Object.freeze(['こうげき','足ばらい','足ばらい','仁王立ち','仁王立ち','必殺の一撃'])
  ]), inheritedBaseline:true }),
  // v0.5.29: 大樹竜ルートドラゴン固定お供。1・2リールは継承欄のためCPU個体の固有内訳を公開資料から確定できない。
  // ここでは進化元ルートンの初期コマンドを保守的な基準値として保持し、確定している3リール目を登録する。
  'ルートドラン': Object.freeze({ speed:42, attack:42, matrix:Object.freeze([
    Object.freeze(['こうげき','こうげき','こうげき!','ためる','★→★★','パワー・グロウ']),
    Object.freeze(['こうげき','こうげき','こうげき!','こうげき!','パワー・グロウ','パワー・グロウ']),
    Object.freeze(['こうげき','こうげき!','こうげき!','会心の一撃','スピード・グロウ','ディープグリーンブレス'])
  ]), inheritedBaseline:true, skills:Object.freeze({
    // 自身以外への技。撃破確率へ影響するBOSS本体の速度成長だけを追跡する。
    'スピード・グロウ': skill('スピード・グロウ', {
      kind:'effect', target:'enemyTeam', attackType:'physical',
      effects:[{ type:'bossSpeedGrow', value:15 }]
    })
  }) }),

  // v0.5.28: 研究者カイス固定お供／召喚先。
  'フランケンボーイ': Object.freeze({ speed:21, attack:42, matrix:Object.freeze([
    Object.freeze(['ミス','こうげき','ためる','ためる','ワンツーパンチ','クロスカウンター']),
    Object.freeze(['こうげき','こうげき','こうげき!','ワンツーパンチ','クロスカウンター','クロスカウンター'])
  ]) }),
  'ロボ弐式': Object.freeze({ attribute:'earth', race:'machine', speed:8, attack:25, matrix:Object.freeze([
    Object.freeze(['かばう','こうげき!','こうげき!','こうげき!','★→★★','EXゲージ+1']),
    Object.freeze(['かばう','かばう','かばう','かばう','ベンケイ立ち','会心の一撃'])
  ]) }),

  // v0.5.27: チヴィエールの召喚先とデスフィアープラント固定お供。
  'デメラ': Object.freeze({ speed:55, attack:34, matrix:Object.freeze([
    Object.freeze(['ほほえんでいる','ほほえんでいる','アクマのながしめ','アクマのながしめ','★→★★','★→★★']),
    Object.freeze(['★★→★','★★→★','アクマのくちづけ','アクマのながしめ','アクマのながしめ','ふっかつの秘法'])
  ]) }),
  'デスプラント': Object.freeze({ speed:33, attack:50, matrix:Object.freeze([
    Object.freeze(['ミス','こうげき','ためる','こうげき!','ためる','スピードロートブレス']),
    Object.freeze(['こうげき','こうげき!','ためる','会心の一撃','ためる','パワーロートブレス']),
    Object.freeze(['こうげき','こうげき!','こうげき!','会心の一撃','パワーロートブレス','パワーロートブレス'])
  ]) }),
  '大樹竜の球根': Object.freeze({ speed:2, attack:2, matrix:Object.freeze([Object.freeze(['ときをまつ','ときをまつ','ときをまつ','ときをまつ','ときをまつ','ときをまつ'])]) }),

  // v0.5.33: 新6章BOSS固定お供／ワイト召喚先。Lv1最低表示値を使用。
  'カマエル': Object.freeze({ speed:33, attack:46, matrix:Object.freeze([
    Object.freeze(['ミス','こうげき','こうげき!','こうげき!','★→★★','聖なる光']),
    Object.freeze(['ミス','こうげき','こうげき!','こうげき!','聖なる光','力天使の加護'])
  ]) }),
  '天戦士クレイ': Object.freeze({ speed:38, attack:42, matrix:Object.freeze([
    Object.freeze(['ミス','こうげき','こうげき','★→★★','こうげき!','聖なる一撃']),
    Object.freeze(['ミス','こうげき','こうげき!','こうげき!','聖なる一撃','聖なる一撃'])
  ]) }),
  'アルラ': Object.freeze({ speed:25, attack:33, matrix:Object.freeze([
    Object.freeze(['ミス','こうげき','EXゲージ+1','EXゲージ+2','EXゲージ+2','どくガス'])
  ]) }),
  // 1リールはアルラから継承。CPU個体の継承内訳は公開資料で確定できないためアルラ初期コマンドを基準にする。
  'アルラウネ': Object.freeze({ speed:33, attack:42, matrix:Object.freeze([
    Object.freeze(['ミス','こうげき','EXゲージ+1','EXゲージ+2','EXゲージ+2','どくガス']),
    Object.freeze(['こうげき','こうげき','EXゲージ+2','EXゲージ+2','どくガス','どくガス'])
  ]), inheritedBaseline:true }),

  // v0.5.24: BOSS固定編成のタマゴ系。初期コマンドは全枠【ときをまつ】。
  '金竜のタマゴ': Object.freeze({ speed:0, attack:4, matrix:Object.freeze([Object.freeze(['ときをまつ','ときをまつ','ときをまつ','ときをまつ','ときをまつ','ときをまつ'])]) }),
  '火山弾': Object.freeze({ speed:1, attack:1, matrix:Object.freeze([Object.freeze(['ときをまつ','ときをまつ','ときをまつ','ときをまつ','ときをまつ','ときをまつ'])]) }),
  '竜氷山': Object.freeze({ speed:1, attack:2, matrix:Object.freeze([Object.freeze(['ときをまつ','ときをまつ','ときをまつ','ときをまつ','ときをまつ','ときをまつ'])]) })
});

// v0.5.54: BOSS固定お供／召喚お供のHP。CPU固定個体を個体値まで特定できないものは、
// 既存のお供コマンド実装と同じくLv1の最低表示値（F相当）を基準値として使用する。
// マシュまろBOSSだけは enemyCount=3 の専用複数BOSS処理で管理するため、この表の値は通常個体用。
const COMPANION_BASE_HP = Object.freeze({
  '吟遊詩人キドリ':128,
  '火竜のタマゴ':4,
  '太竜のタマゴ':7,
  '水竜のタマゴ':3,
  'デメラ':77,
  'スライム':8,
  'グリ':37,
  'カメのタマゴ':4,
  'タツドン':42,
  'ブリュー':101,
  '氷結精':5,
  '黒竜のタマゴ':8,
  'ベージ':67,
  '竜のズコツ':4,
  'ヤマタマゴ':12,
  '鳥竜のタマゴ':4,
  '金竜のタマゴ':8,
  '魔王のトリタマゴ':1,
  '凍竜のタマゴ':5,
  '白竜のタマゴ':5,
  'ゾンビ':135,
  'ゾンビビ':270,
  'デュラ':118,
  '猿石':76,
  '火山弾':12,
  'マト':76,
  '参謀エンリル':186,
  '海竜のしずく':5,
  '魔海兵ブリュー':195,
  '魔海魚ブブリ':169,
  'ロボ零壱式':72,
  'ロボ零弐式':157,
  '竜灰':5,
  '吸血竜のタマゴ':6,
  '大樹竜の球根':5,
  'ルートン':101,
  'ルートドラン':169,
  'フェンリル':174,
  'デスプラント':212,
  '僧兵オニワカ':203,
  '鉄のタマゴ':6,
  '魔鏡騎士リフレク':178,
  'ダークサラマンダー':199,
  'アヴァドンフード':67,
  'ドーシュ':93,
  'マシュまろ':33,
  '竜氷山':8,
  '深海タマゴ':6,
  '鬼竜骨':15,
  '天戦士クレイ':93,
  'カマエル':84,
  'アルラ':50,
  '聖なるタマゴ':5,
  'フランケンボーイ':144,
  'アシユラ':197,
  // v0.5.66: 召喚時HP=1フォールバックを防ぐ。通常召喚はLv1最低表示値を基準にする。
  'バロ':42,
  'イシザル':84,
  'カルラ':144,
  'ロボ弐式':171,
  '魔海将フィスカ':233
});

export const ENEMY_COMPANION_HP_NAMES = Object.freeze(Object.keys(COMPANION_BASE_HP));

export function enemyCompanionBaseHp(name) {
  const value = COMPANION_BASE_HP[String(name ?? '').trim()];
  return Number.isFinite(value) ? value : null;
}

export const ENEMY_COMPANION_PROFILE_NAMES = Object.freeze(Object.keys(COMPANION_COMMAND_PROFILES));

export function enemyCompanionProfile(name) {
  return COMPANION_COMMAND_PROFILES[String(name ?? '').trim()] ?? null;
}

export function enemyCompanionCommandTransitions(name, startReel = 0, commandOverrides = null, preserveSlots = false) {
  const companion = enemyCompanionProfile(name);
  if (!companion) return null;
  const overrides = commandOverrides && typeof commandOverrides === 'object' ? commandOverrides : null;
  const matrix = companion.matrix.map((row, reel) => row.map((command, slotIndex) => {
    const key = `${reel}:${slotIndex}`;
    return overrides && Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : command;
  }));
  return commandTransitionsFromMatrix(matrix, startReel, { preserveSlots });
}

export function enemyCompanionSkillForCommand(commandName, name = '') {
  const command = String(commandName ?? '').trim();
  const companion = enemyCompanionProfile(name);
  return companion?.skills?.[command] ?? ENEMY_SKILLS[command] ?? null;
}

export const ENEMY_BOSS_PROFILE_IDS = Object.freeze(Object.keys(BOSS_COMMAND_PROFILES));

export function enemyBossProfile(presetId) {
  return BOSS_COMMAND_PROFILES[presetId] ?? null;
}

export function enemyCommandTransitions(presetId, startReel = 0, disabledCommands = [], commandOverrides = null, preserveSlots = false) {
  const boss = enemyBossProfile(presetId);
  if (!boss) return null;
  const disabled = new Set((disabledCommands ?? []).map(x => String(x ?? '').trim()).filter(Boolean));
  const overrides = commandOverrides && typeof commandOverrides === 'object' ? commandOverrides : null;
  const matrix = boss.matrix.map((row, reel) => row.map((command, slotIndex) => {
    const key = `${reel}:${slotIndex}`;
    const overridden = overrides && Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : command;
    return disabled.has(String(overridden ?? '').trim()) ? 'ミス' : overridden;
  }));
  return commandTransitionsFromMatrix(matrix, startReel, { preserveSlots });
}

export function enemySkillForCommand(commandName, presetId = '') {
  const name = String(commandName ?? '').trim();
  const boss = enemyBossProfile(presetId);
  return boss?.skills?.[name] ?? ENEMY_SKILLS[name] ?? null;
}
