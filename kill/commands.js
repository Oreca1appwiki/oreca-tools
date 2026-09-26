import { getChangeReels, resolveFixedChangeTurn } from '../skill/engine.js';
import { normalizeSkillName } from './presets.js';

// Google Drive「モンスター」フォルダのユーザー所持個体画像、および既存Wiki確認分から
// 撃破確率計算に使うコマンド構成を登録する。
// matrix はリールごとに6マス。適切な型を確認できない個体は登録せず、UIで不足データとして通知する。
export const COMMAND_PROFILES = Object.freeze({
  // 既存Wiki確認分
  kerogon_green: [['竜のしっぽ','竜のしっぽ','竜のしっぽ','竜のしっぽ','竜のしっぽ','竜のしっぽ']],
  oniwaka: [
    ['足ばらい','足ばらい','足ばらい','足ばらい','足ばらい','足ばらい'],
    ['足ばらい','足ばらい','足ばらい','足ばらい','足ばらい','足ばらい']
  ],
  clear_blue_dragon: [
    // 現行Wikiの1止め型: アクアブレス×5＋クリアアクアブレス×1。
    ['アクアブレス','アクアブレス','アクアブレス','アクアブレス','アクアブレス','クリアアクアブレス'],
    ['アクアブレス','アクアブレス','アクアブレス','クリアアクアブレス','クリアアクアブレス','クリアアクアブレス'],
    ['アクアブレス','クリアアクアブレス','クリアアクアブレス','クリアアクアブレス','クリアアクアブレス','クリアアクアブレス'],
    ['クリアアクアブレス','クリアアクアブレス','クリアアクアブレス','クリアアクアブレス','クリアアクアブレス','クリアアクアブレス']
  ],
  bahamut: [
    ['シャイニングブレス','シャイニングブレス','シャイニングブレス','シャイニングブレス','シャイニングブレス','シャイニングブレス'],
    ['シャイニングブレス','シャイニングブレス','シャイニングブレス','シャイニングブレス','シャイニングブレス','シャイニングブレス'],
    ['シャイニングブレス','シャイニングブレス','シャイニングブレス','シャイニングブレス','シャイニングブレス','シャイニングブレス'],
    ['シャイニングブレス','シャイニングブレス','シャイニングブレス','シャイニングブレス','シャイニングブレス','シャイニングブレス']
  ],
  dark_bahamut_red: [
    ['ほほえんでいる','レッドファイアブレス','レッドファイアブレス','レッドファイアブレス','レッドファイアブレス','レッドファイアブレス'],
    ['レッドファイアブレス','レッドファイアブレス','レッドファイアブレス','レッドファイアブレス','レッドファイアブレス','レッドファイアブレス'],
    ['レッドファイアブレス','レッドファイアブレス','レッドファイアブレス','レッドファイアブレス','レッドファイアブレス','レッドファイアブレス'],
    ['レッドファイアブレス','レッドファイアブレス','レッドファイアブレス','レッドファイアブレス','レッドファイアブレス','レッドファイアブレス']
  ],
  dark_bahamut_blue: [
    ['ほほえんでいる','ブルーアクアブレス','ブルーアクアブレス','ブルーアクアブレス','ブルーアクアブレス','ブルーアクアブレス'],
    ['ブルーアクアブレス','ブルーアクアブレス','ブルーアクアブレス','ブルーアクアブレス','ブルーアクアブレス','ブルーアクアブレス'],
    ['ブルーアクアブレス','ブルーアクアブレス','ブルーアクアブレス','ブルーアクアブレス','ブルーアクアブレス','ブルーアクアブレス'],
    ['ブルーアクアブレス','ブルーアクアブレス','ブルーアクアブレス','ブルーアクアブレス','ブルーアクアブレス','ブルーアクアブレス']
  ],
  dark_bahamut_yellow: [
    ['ほほえんでいる','イエローアースブレス','イエローアースブレス','イエローアースブレス','イエローアースブレス','イエローアースブレス'],
    ['イエローアースブレス','イエローアースブレス','イエローアースブレス','イエローアースブレス','イエローアースブレス','イエローアースブレス'],
    ['イエローアースブレス','イエローアースブレス','イエローアースブレス','イエローアースブレス','イエローアースブレス','イエローアースブレス'],
    ['イエローアースブレス','イエローアースブレス','イエローアースブレス','イエローアースブレス','イエローアースブレス','イエローアースブレス']
  ],
  dark_bahamut_green: [
    ['ほほえんでいる','グリーンエアブレス','グリーンエアブレス','グリーンエアブレス','グリーンエアブレス','グリーンエアブレス'],
    ['グリーンエアブレス','グリーンエアブレス','グリーンエアブレス','グリーンエアブレス','グリーンエアブレス','グリーンエアブレス'],
    ['グリーンエアブレス','グリーンエアブレス','グリーンエアブレス','グリーンエアブレス','グリーンエアブレス','グリーンエアブレス'],
    ['グリーンエアブレス','グリーンエアブレス','グリーンエアブレス','グリーンエアブレス','グリーンエアブレス','グリーンエアブレス']
  ],
  raijin_kukulkan: [
    ['つつきまくり','つつきまくり','つつきまくり','つつきまくり','つつきまくり','つつきまくり'],
    ['つつきまくり','つつきまくり','つつきまくり','つつきまくり','つつきまくり','つつきまくり'],
    ['つつきまくり','つつきまくり','つつきまくり','つつきまくり','つつきまくり','つつきまくり'],
    ['つつきまくり','つつきまくり','つつきまくり','つつきまくり','つつきまくり','つつきまくり']
  ],
  // 雷神竜ククルカン 〖轟く稲妻〗型（Wiki掲載の1ターン目発動率重視型）。
  raijin_kukulkan_roaring: [
    ['はばたき','★→★★','★→★★','★→★★','★→★★','★→★★'],
    ['ミス','轟く稲妻','轟く稲妻','★★→★★★','★★→★★★','★★→★★★'],
    ['ミス','轟く稲妻','轟く稲妻','★★★→★★★★','★★★→★★★★','★★★→★★★★'],
    Array(6).fill('轟く稲妻')
  ],
  // 赤のエンプレスを通常編成するときのコマンド型。
  // 変化先用の【王女のせいえん】【女王のごほうび】プロファイルとは分離している。
  red_empress: [
    ['王女のせいえん','王女のせいえん','王女のせいえん','女王のごほうび','女王のごほうび','女王のごほうび'],
    ['王女のせいえん','女王のごほうび','女王のごほうび','女王のごほうび','女王のごほうび','女王のごほうび'],
    ['女王のごほうび','女王のごほうび','女王のごほうび','女王のごほうび','女王のごほうび','女王のごほうび'],
    ['女王のごほうび','女王のごほうび','女王のごほうび','女王のごほうび','女王のごほうび','女王のごほうび']
  ],
  red_empress_critical5: [
    ['王女のせいえん','王女のせいえん','王女のせいえん','女王のごほうび','女王のごほうび','女王のごほうび'],
    ['王女のせいえん','女王のごほうび','女王のごほうび','女王のごほうび','女王のごほうび','女王のごほうび'],
    ['会心の一撃','会心の一撃','会心の一撃','会心の一撃','会心の一撃','こうげき！'],
    ['会心の一撃','会心の一撃','会心の一撃','会心の一撃','会心の一撃','会心の一撃']
  ],
  red_empress_critical4: [
    ['王女のせいえん','王女のせいえん','王女のせいえん','女王のごほうび','女王のごほうび','女王のごほうび'],
    ['王女のせいえん','女王のごほうび','女王のごほうび','女王のごほうび','女王のごほうび','女王のごほうび'],
    ['会心の一撃','会心の一撃','会心の一撃','会心の一撃','こうげき！','こうげき！'],
    ['会心の一撃','会心の一撃','会心の一撃','会心の一撃','会心の一撃','会心の一撃']
  ],

  // Google Drive「モンスター」画像から読み取った、現在のモンスタープリセット技に合う型
  sylph: [['こうげき！','こうげき！','こうげき！','こうげき！','こうげき！','こうげき！']],
  crow: [['こうげき！','こうげき！','こうげき！','こうげき！','こうげき！','こうげき！']],
  mimitoshishi_attack6: [['こうげき！','こうげき！','こうげき！','こうげき！','こうげき！','こうげき！']],
  mimitoshishi_mixed: [['こうげき！','こうげき！','プチ・アイスストーム','プチ・アイスストーム','プチ・アイスストーム','プチ・アイスストーム']],
  magora: [['さけぶ','さけぶ','さけぶ','さけぶ','さけぶ','さけぶ']],
  oniwaka_monk: [
    ['足ばらい','足ばらい','足ばらい','足ばらい','足ばらい','足ばらい'],
    ['足ばらい','足ばらい','足ばらい','足ばらい','足ばらい','足ばらい'],
    ['足ばらい','足ばらい','足ばらい','足ばらい','足ばらい','足ばらい']
  ],
  venom_behemoth: [
    ['おしつぶし','★→★★','★→★★','★→★★','★→★★','★→★★'],
    ['おしつぶし','おしつぶし','おしつぶし','おしつぶし','おしつぶし','おしつぶし'],
    ['おしつぶし','おしつぶし','おしつぶし','おしつぶし','おしつぶし','おしつぶし'],
    ['おしつぶし','おしつぶし','おしつぶし','おしつぶし','おしつぶし','おしつぶし']
  ],
  heavy_behemoth: [
    ['おしつぶし','★→★★','★→★★','★→★★','★→★★','★→★★'],
    ['ためる','★★→★★★','★★→★★★','★★→★★★','★★→★★★','★★→★★★'],
    ['★★★→★★★★','★★★→★★★★','★★★→★★★★','★★★→★★★★','★★★→★★★★','★★★→★★★★'],
    ['おしつぶし','おしつぶし','おしつぶし','おしつぶし','おしつぶし','おしつぶし']
  ],
  kerogon_yellow: [['竜のしっぽ','竜のしっぽ','竜のしっぽ','竜のしっぽ','竜のしっぽ','竜のしっぽ']],
  guardian_powan: [
    ['シャボン・グラン','シャボン・グラン','シャボン・グラン','シャボン・グラン','★→★★','★→★★'],
    ['シャボン・グラン','シャボン・グラン','シャボン・グラン','シャボン・グラン','シャボン・グラン','シャボン・グラン'],
    ['シャボン・グラン','シャボン・グラン','シャボン・グラン','シャボン・グラン','シャボン・グラン','シャボン・グラン'],
    ['シャボン・グラン','シャボン・グラン','シャボン・グラン','シャボン・グラン','シャボン・グラン','シャボン・グラン']
  ],
  kerogon_blue: [['竜のしっぽ','竜のしっぽ','竜のしっぽ','竜のしっぽ','竜のしっぽ','竜のしっぽ']],
  // 新6章 鬼竜ネクロドラゴン周回用。現行Wiki掲載の〖ウォーターブレス〗型。
  kerogon_blue_water: [['竜のしっぽ','ウォーターブレス','ウォーターブレス','ウォーターブレス','ウォーターブレス','ウォーターブレス']],
  // 新4章 魔将ガープ周回用。Wiki掲載の〖アイスブレス〗1止め型。
  grand_blue_dragon: [['アイスブレス','アイスブレス','アイスブレス','アイスブレス','アイスブレス','アイスブレス']],
  docteur: [
    // 旧2章イフリート用『こうげき!／試作魔銃 1止め型』。
    // 1リールの最大キャパ16.2に対し、こうげき!=2.0、試作魔銃=4.6。
    // チャート記載の2技だけで1リールを構成すると試作魔銃は最大1個なので、残り5枠はこうげき!となる。
    ['こうげき!','こうげき!','こうげき!','こうげき!','こうげき!','試作魔銃']
  ],
  dartan: [
    ['連撃','連撃','連撃','連撃','連撃','連撃'],
    ['連撃','連撃','連撃','連撃','連撃','連撃'],
    ['連撃','連撃','連撃','連撃','連撃','連撃'],
    ['連撃','連撃','連撃','連撃','連撃','連撃']
  ],
  // 新6章 研究者カイス周回用。〖こうげき!〗1止め型。
  dartan_attack1: [
    ['こうげき！','こうげき！','こうげき！','こうげき！','こうげき！','こうげき！']
  ],
  kerogon_gold: [['竜のしっぽ','竜のしっぽ','竜のしっぽ','竜のしっぽ','金のいき','金のいき']],
  camineko_fire: [['ファイア！','ファイア！','ファイア！','ファイア！','ファイア！','ファイア！']],
  camineko_ice: [['アイス！','アイス！','アイス！','アイス！','アイス！','アイス！']],
  camineko_thunder: [['サンダー！','サンダー！','サンダー！','サンダー！','サンダー！','サンダー！']],
  // 新2章 魔神アープ周回用。Wiki掲載の『3回こうげき』型（コマ4以上）。
  bero: [['こうげき！','3回こうげき','3回こうげき','3回こうげき','3回こうげき','3回こうげき']],
  garanezumi: [['こうげき！','こうげき！','こうげき！','こうげき！','こうげき！','こうげき！']],
  black_knight_gebolg: [
    ['ヒートウェイブ','ヒートウェイブ','ヒートウェイブ','ヒートウェイブ','ヒートウェイブ','ヒートウェイブ'],
    ['ヒートウェイブ','ヒートウェイブ','ヒートウェイブ','ヒートウェイブ','ヒートウェイブ','ヒートウェイブ'],
    ['ヒートウェイブ','ヒートウェイブ','ヒートウェイブ','ヒートウェイブ','ヒートウェイブ','ヒートウェイブ']
  ],
  rakshasa: [
    ['ヒートウェイブ','ヒートウェイブ','ヒートウェイブ','ヒートウェイブ','ヒートウェイブ','ヒートウェイブ'],
    ['ヒートウェイブ','ヒートウェイブ','ヒートウェイブ','ヒートウェイブ','ヒートウェイブ','ヒートウェイブ']
  ],
  scarlet_dragon: [
    ['竜のしっぽ','竜のしっぽ','竜のしっぽ','竜のしっぽ','業火のいき','業火のいき'],
    ['竜のしっぽ','竜のしっぽ','業火のいき','業火のいき','業火のいき','業火のいき'],
    ['業火のいき','業火のいき','業火のいき','業火のいき','業火のいき','極炎のいき'],
    ['極炎のいき','極炎のいき','極炎のいき','極炎のいき','極炎のいき','極炎のいき']
  ],
  kenran_kukulkan: [
    ['つつきまくり','つつきまくり','つつきまくり','つつきまくり','つつきまくり','つつきまくり'],
    ['つつきまくり','つつきまくり','つつきまくり','つつきまくり','つつきまくり','つつきまくり'],
    ['つつきまくり','つつきまくり','つつきまくり','つつきまくり','つつきまくり','つつきまくり'],
    ['つつきまくり','つつきまくり','つつきまくり','つつきまくり','つつきまくり','つつきまくり']
  ],
  ifrit: [
    ['ファイア！','ファイア!!','ファイア!!','ファイア!!','ファイア!!','ファイア!!'],
    ['ファイア!!','ファイア!!','ファイア!!','ファイア!!!','ファイア!!!','ファイア!!!'],
    ['ファイア!!!','ファイア!!!','ファイア!!!','ファイア!!!','ファイア!!!','ファイア!!!'],
    ['ファイア!!!','ファイア!!!','ファイア!!!','ファイア!!!!','ファイア!!!!','ファイア!!!!']
  ],
  loki: [
    ['ロキブランド','ロキブランド','ロキブランド','★→★★','★→★★','★→★★'],
    ['ロキブランド','ロキブランド','ロキブランド','ロキブランド','ロキブランド','ロキブランド'],
    ['ロキブランド','ロキブランド','ロキブランド','ロキブランド','ロキブランド','ロキブランド'],
    ['ロキブランド','ロキブランド','ロキブランド','ロキブランド','ロキブランド','ロキブランド']
  ],
  ares: [
    ['こうげき！','こうげき！','こうげき！','こうげき！','こうげき！','超熱剣プラズマセイバー'],
    ['こうげき！','こうげき！','こうげき！','こうげき！','熱剣ヒートセイバー','超熱剣プラズマセイバー'],
    ['こうげき！','こうげき！','こうげき！','熱剣ヒートセイバー','超熱剣プラズマセイバー','超熱剣プラズマセイバー']
  ],
  chibimuus: [
    ['こうげき！','こうげき！','こうげき！','こうげき！','こうげき！','会心の一撃'],
    ['こうげき！','こうげき！','会心の一撃','会心の一撃','会心の一撃','会心の一撃']
  ],
  lafroig: [
    ['こうげき！','こうげき！','こうげき！','こうげき！','こうげき！','ウォーターブレイク'],
    ['こうげき！','こうげき！','こうげき！','ウォーターブレイク','ウォーターブレイク','ウォーターブレイク'],
    ['こうげき！','こうげき！','ウォーターブレイク','ウォーターブレイク','ウォーターブレイク','ウォーターブレイク'],
    ['ウォーターブレイク','ウォーターブレイク','ウォーターブレイク','ウォーターブレイク','ウォーターブレイク','ウォーターブレイク']
  ],
  mermaid_mellow: [
    ['ミス','★→★★','★→★★','★→★★','★→★★','★→★★'],
    ['シャボン・グラン','シャボン・グラン','シャボン・グラン','シャボン・グラン','シャボン・グラン','シャボン・グラン'],
    ['シャボン・グラン','シャボン・グラン','シャボン・グラン','シャボン・グラン','シャボン・グラン','シャボン・グラン']
  ],
  captain_azul: [
    ['シビレ斬り','シビレ斬り','シビレ斬り','シビレ斬り','シビレ斬り','シビレ斬り'],
    ['シビレ斬り','シビレ斬り','シビレ斬り','シビレ斬り','シビレ斬り','シビレ斬り'],
    ['シビレ斬り','シビレ斬り','シビレ斬り','シビレ斬り','シビレ斬り','シビレ斬り']
  ],
  elysion: [
    ['ためる','ためる','ためる','ためる','ためる','ためる'],
    ['ためる','ためる','ためる','ためる','ためる','ためる'],
    ['ためる','ためる','ためる','ためる','ためる','ためる'],
    ['浄化の炎','浄化の炎','浄化の炎','浄化の炎','浄化の炎','浄化の炎']
  ],
  hien: [
    ['紫電','紫電','紫電','紫電','紫電','紫電'],
    ['紫電','紫電','紫電','紫電','紫電','紫電'],
    ['紫電','紫電','紫電','紫電','紫電','紫電']
  ],
  // 旧7章 斉天大聖ソンゴクウ周回用。Wiki掲載のラヴァブースト型。
  red_magician: [
    ['ミス','ラヴァブースト','ラヴァブースト','★→★★','★→★★','★→★★'],
    ['ためる','ラヴァブースト','ラヴァブースト','ラヴァブースト','ラヴァブースト','ラヴァブースト'],
    ['ラヴァブースト','ラヴァブースト','ラヴァブースト','ラヴァブースト','ラヴァブースト','ラヴァブースト']
  ],
  magician: [
    ['ミス','ラヴァブースト','★→★★','★→★★','★→★★','★→★★'],
    ['ラヴァ','ラヴァブースト','ラヴァブースト','ラヴァブースト','ラヴァブースト','ラヴァブースト']
  ],
  marduk: [
    ['★→★★','★→★★','★→★★','★→★★','★→★★','★→★★'],
    ['こうげき！','★★→★★★','★★→★★★','★★→★★★','★★→★★★','★★→★★★'],
    ['こうげき！','会心の一撃','会心の一撃','会心の一撃','会心の一撃','会心の一撃'],
    ['こうげき！','会心の一撃','会心の一撃','必殺の一撃','必殺の一撃','必殺の一撃']
  ],
  enki: [
    ['★→★★','★→★★','★→★★','★→★★','★→★★','★→★★'],
    ['こうげき！','★★→★★★','★★→★★★','★★→★★★','★★→★★★','★★→★★★'],
    ['会心の一撃','会心の一撃','会心の一撃','会心の一撃','会心の一撃','会心の一撃'],
    ['会心の一撃','会心の一撃','会心の一撃','必殺の一撃','必殺の一撃','必殺の一撃']
  ],
  damkina: [
    ['ためる','★→★★','★→★★','★→★★','★→★★','★→★★'],
    ['ウィンド!!','ウィンド!!','ウィンド!!','ウィンド!!','ウィンド!!','ウィンド!!'],
    ['ウィンド!!','ウィンド!!','ウィンド!!','ウィンド!!','ウィンド!!','ウィンド!!'],
    ['ウィンド!!','ウィンド!!!','ウィンド!!!','ウィンド!!!','ウィンド!!!','ウィンド!!!']
  ],
  saezer: [
    ['こうげき！','こうげき！','こうげき！','こうげき！','サザエニードル','サザエニードル'],
    ['こうげき！','こうげき！','こうげき！','サザエニードル','サザエニードル','サザエニードル'],
    ['サザエニードル','サザエニードル','サザエニードル','サザエニードル','サザエニードル','サザエニードル']
  ],
  dante_magic_swordsman: [
    ['こうげき！','こうげき！','こうげき！','必殺の一撃','必殺の一撃','必殺の一撃'],
    ['こうげき！','こうげき！','こうげき！','必殺の一撃','必殺の一撃','必殺の一撃'],
    ['こうげき！','こうげき！','こうげき！','必殺の一撃','必殺の一撃','必殺の一撃']
  ],
  // ?章周回チャート用。大魔導ミミトシシの1リールは、ファイア!!を5枠積める
  // キャパシティ範囲内の周回用ファイア!!型として扱う。
  great_mimitoshishi: [
    ['ファイア','ファイア!!','ファイア!!','ファイア!!','ファイア!!','ファイア!!']
  ],
  // Wiki掲載の「精霊の加護」型。全リールを精霊の加護で固定。
  great_cliff: Array.from({ length: 3 }, () => Array(6).fill('精霊の加護')),

  gate_dante: [
    ['こうげき！','会心の一撃','会心の一撃','会心の一撃','会心の一撃','会心の一撃'],
    ['こうげき！','会心の一撃','会心の一撃','会心の一撃','会心の一撃','会心の一撃'],
    ['こうげき！','会心の一撃','会心の一撃','会心の一撃','会心の一撃','会心の一撃'],
    ['会心の一撃','会心の一撃','会心の一撃','会心の一撃','必殺の一撃','必殺の一撃']
  ],
  yamato: [
    ['こうげき！','こうげき！','こうげき！','こうげき！','こうげき！','会心の一撃'],
    ['こうげき！','こうげき！','こうげき！','こうげき！','会心の一撃','会心の一撃'],
    ['こうげき！','こうげき！','こうげき！','会心の一撃','会心の一撃','会心の一撃'],
    ['こうげき！','こうげき！','会心の一撃','会心の一撃','会心の一撃','会心の一撃']
  ],
  susanoo: [
    ['こうげき！','こうげき！','こうげき！','こうげき！','こうげき！','会心の一撃'],
    ['こうげき！','こうげき！','こうげき！','こうげき！','会心の一撃','会心の一撃'],
    ['こうげき！','こうげき！','こうげき！','会心の一撃','会心の一撃','会心の一撃'],
    ['こうげき！','会心の一撃','会心の一撃','会心の一撃','会心の一撃','会心の一撃']
  ],
  ginger_ale: [
    ['こうげき！','こうげき！','こうげき！','こうげき！','邪光波','邪光波'],
    ['こうげき！','こうげき！','邪光波','邪光波','邪光波','邪光波'],
    ['こうげき！','邪光波','邪光波','邪光波','邪光波','邪光波'],
    ['邪光波','邪光波','邪光波','邪光波','邪光波','邪光波']
  ],
  fire_drake: [
    ['こうげき！','こうげき！','こうげき！','会心の一撃','会心の一撃','会心の一撃'],
    ['こうげき！','こうげき！','こうげき！','こうげき！','会心の一撃','会心の一撃'],
    ['会心の一撃','会心の一撃','会心の一撃','会心の一撃','会心の一撃','会心の一撃'],
    ['会心の一撃','会心の一撃','会心の一撃','会心の一撃','会心の一撃','会心の一撃']
  ],
  gate_dante_attack1: [Array(6).fill('こうげき！')],
  yamato_attack1: [Array(6).fill('こうげき！')],
  susanoo_attack1: [Array(6).fill('こうげき！')],
  nanawarai_attack1: [Array(6).fill('こうげき！')],
  ginger_ale_attack1: [Array(6).fill('こうげき！')],
  fire_drake_attack1: [Array(6).fill('こうげき！')],
  soccerra_deadly3: [
    Array(6).fill('★→★★'),
    Array(6).fill('★★→★★★'),
    Array(6).fill('必殺の一撃'),
    Array(6).fill('必殺の一撃')
  ],

  simon: [
    ['こうげき！','こうげき！','こうげき！','こうげき！','会心の一撃','必殺の一撃'],
    ['こうげき！','こうげき！','こうげき！','会心の一撃','会心の一撃','必殺の一撃'],
    ['こうげき！','会心の一撃','会心の一撃','会心の一撃','会心の一撃','会心の一撃']
  ],
  hayate: [
    ['こうげき！','こうげき！','こうげき！','こうげき！','会心の一撃','会心の一撃'],
    ['こうげき！','こうげき！','こうげき！','会心の一撃','会心の一撃','会心の一撃'],
    ['こうげき！','会心の一撃','会心の一撃','会心の一撃','会心の一撃','会心の一撃']
  ],
  sky_clay: [
    ['こうげき！','こうげき！','こうげき！','こうげき！','会心の一撃','会心の一撃'],
    ['こうげき！','こうげき！','会心の一撃','会心の一撃','会心の一撃','会心の一撃'],
    ['こうげき！','会心の一撃','会心の一撃','会心の一撃','会心の一撃','聖なる一撃'],
    ['会心の一撃','会心の一撃','会心の一撃','会心の一撃','会心の一撃','聖なる一撃']
  ],
  djinn: [
    ['ウィンド！','ウィンド!!','ウィンド!!','ウィンド!!','ウィンド!!','ウィンド!!'],
    ['ウィンド!!','ウィンド!!','ウィンド!!','ウィンド!!!','ウィンド!!!','ウィンド!!!'],
    ['ウィンド!!!','ウィンド!!!','ウィンド!!!','ウィンド!!!','ウィンド!!!','ウィンド!!!'],
    ['ウィンド!!!','ウィンド!!!','ウィンド!!!','ウィンド!!!!','ウィンド!!!!','ウィンド!!!!']
  ],
  nanawarai: [
    ['こうげき！','こうげき！','こうげき！','こうげき！','こうげき！','必殺の一撃'],
    ['こうげき！','こうげき！','こうげき！','必殺の一撃','必殺の一撃','必殺の一撃'],
    ['こうげき！','こうげき！','必殺の一撃','必殺の一撃','必殺の一撃','必殺の一撃'],
    ['こうげき！','必殺の一撃','必殺の一撃','必殺の一撃','必殺の一撃','必殺の一撃']
  ],
  soccerra: [
    ['★→★★','★→★★','★→★★','★→★★','★→★★','★→★★'],
    ['こうげき！','★★→★★★★','★★→★★★★','★★→★★★★','★★→★★★★','★★→★★★★'],
    ['必殺の一撃','必殺の一撃','必殺の一撃','必殺の一撃','必殺の一撃','必殺の一撃'],
    ['必殺の一撃','必殺の一撃','必殺の一撃','必殺の一撃','必殺の一撃','必殺の一撃']
  ],


  platinum_drake: [
    ['竜のしっぽ','竜のしっぽ','竜のしっぽ','竜のしっぽ','竜のしっぽ','光のいき'],
    ['竜のしっぽ','竜のしっぽ','竜のしっぽ','竜のしっぽ','光のいき','光のいき'],
    ['竜のしっぽ','竜のしっぽ','光のいき','光のいき','光のいき','光のいき'],
    ['竜のしっぽ','光のいき','光のいき','光のいき','光のいき','光のいき']
  ],
  shinjuryu_kukulkan: [
    ['つつきまくり','つつきまくり','つつきまくり','つつきまくり','つつきまくり','つつきまくり'],
    ['つつきまくり','つつきまくり','つつきまくり','つつきまくり','つつきまくり','つつきまくり'],
    ['つつきまくり','つつきまくり','つつきまくり','つつきまくり','つつきまくり','つつきまくり'],
    ['つつきまくり','つつきまくり','つつきまくり','つつきまくり','つつきまくり','つつきまくり']
  ],
  astaroth: [
    ['メテオ！','メテオ！','メテオ！','メテオ！','メテオ！','メテオ！'],
    ['メテオ！','メテオ！','メテオ！','メテオ！','メテオ！','メテオ！'],
    ['メテオ！','メテオ！','メテオ！','メテオ！','メテオ！','メテオ！'],
    ['メテオ！','メテオ！','メテオ！','メテオ！','メテオ！','メテオ！']
  ],
  toritamago: [['ミス','ミス','ミス','ミス','ミス','ミス']],

  // 変化先。Wiki「変化先コマンドサンプル一覧」、個別ページ、ユーザー所持個体を使用。
  // 七十二変化の術では変化先の★移動は同一ターン内の発動率計算に使うが、
  // 変化終了後のソンゴクウ／牛魔王の停止リール自体は変化させない。
  transform_loki: [
    ['ロキブランド','ロキブランド','ロキブランド','★→★★','★→★★','★→★★'],
    ['ロキブランド','ロキブランド','ロキブランド','ロキブランド','ロキブランド','ロキブランド'],
    ['ロキブランド','ロキブランド','ロキブランド','ロキブランド','ロキブランド','ロキブランド'],
    ['ロキブランド','ロキブランド','ロキブランド','ロキブランド','ロキブランド','ロキブランド']
  ],
  transform_oni_spirit: [
    ['鬼の気合入れ','鬼の気合入れ','鬼の気合入れ','鬼の気合入れ','鬼の気合入れ','鬼の気合入れ'],
    ['鬼の気合入れ','鬼の気合入れ','鬼の気合入れ','鬼の気合入れ','鬼の気合入れ','鬼の気合入れ'],
    ['鬼の気合入れ','鬼の気合入れ','鬼の気合入れ','鬼の気合入れ','鬼の気合入れ','鬼の気合入れ']
  ],
  transform_sea_king_gaze: Array.from({ length: 4 }, () => Array(6).fill('海王のまなざし')),
  transform_spirit_blessing: Array.from({ length: 2 }, () => Array(6).fill('精霊の加護')),
  transform_growl: [
    ['ためる','うなる','うなる','うなる','うなる','うなる'],
    Array(6).fill('うなる'), Array(6).fill('うなる'), Array(6).fill('うなる')
  ],
  transform_sun_hymn: [
    ['ほほえんでいる','太陽讃歌','太陽讃歌','太陽讃歌','太陽讃歌','★→★★'],
    ['こうげき！','太陽讃歌','太陽讃歌','太陽讃歌','太陽讃歌','太陽讃歌'],
    Array(6).fill('太陽讃歌'), Array(6).fill('太陽讃歌')
  ],
  transform_name_announcement: [
    ['ミス','名乗り上げ','★→★★','★→★★','★→★★','★→★★'],
    ['ミス','名乗り上げ','名乗り上げ','名乗り上げ','名乗り上げ','名乗り上げ'],
    ['こうげき！','名乗り上げ','名乗り上げ','名乗り上げ','名乗り上げ','名乗り上げ'],
    Array(6).fill('名乗り上げ')
  ],
  transform_ninja_wind: [
    ['ミス','忍法 風迅の術','忍法 風迅の術','忍法 風迅の術','忍法 風迅の術','★→★★'],
    Array(6).fill('忍法 風迅の術'), Array(6).fill('忍法 風迅の術')
  ],
  transform_ninja_fire: [
    ['ミス','忍法 鬼火の術','忍法 鬼火の術','忍法 鬼火の術','忍法 鬼火の術','★→★★'],
    Array(6).fill('忍法 鬼火の術'), Array(6).fill('忍法 鬼火の術')
  ],
  transform_ninja_water: [
    ['ミス','忍法 蛇水の術','忍法 蛇水の術','忍法 蛇水の術','忍法 蛇水の術','★→★★'],
    Array(6).fill('忍法 蛇水の術'), Array(6).fill('忍法 蛇水の術')
  ],
  transform_red_point: [
    ['こうげき','レッドポイント','レッドポイント','レッドポイント','レッドポイント','レッドポイント'],
    ['こうげき！','レッドポイント','レッドポイント','レッドポイント','レッドポイント','レッドポイント'],
    Array(6).fill('レッドポイント')
  ],
  transform_blue_point: [
    ['こうげき','ブルーポイント','ブルーポイント','ブルーポイント','ブルーポイント','ブルーポイント'],
    ['こうげき！','ブルーポイント','ブルーポイント','ブルーポイント','ブルーポイント','ブルーポイント'],
    Array(6).fill('ブルーポイント')
  ],
  transform_yellow_point: [
    ['こうげき','イエローポイント','イエローポイント','イエローポイント','イエローポイント','イエローポイント'],
    ['こうげき！','イエローポイント','イエローポイント','イエローポイント','イエローポイント','イエローポイント'],
    Array(6).fill('イエローポイント')
  ],
  transform_green_point: [
    ['こうげき','グリーンポイント','グリーンポイント','グリーンポイント','グリーンポイント','グリーンポイント'],
    ['こうげき！','グリーンポイント','グリーンポイント','グリーンポイント','グリーンポイント','グリーンポイント'],
    Array(6).fill('グリーンポイント')
  ],
  transform_crush: [
    ['おしつぶし','★→★★','★→★★','★→★★','★→★★','★→★★'],
    Array(6).fill('おしつぶし'), Array(6).fill('おしつぶし'), Array(6).fill('おしつぶし')
  ],
  transform_peck_many: Array.from({ length: 4 }, () => Array(6).fill('つつきまくり')),

  // ファイア!!専用: 1リール停止だけ魔導師ジョンガリを使う。
  // 2～4リール停止では大魔神イフリートを使用する。
  transform_jongari_fire2: [Array(6).fill('ファイア!!')],
  transform_ifrit: [
    ['ファイア！','ファイア!!','ファイア!!','ファイア!!','ファイア!!','ファイア!!'],
    ['ファイア!!','ファイア!!','ファイア!!','ファイア!!!','ファイア!!!','ファイア!!!'],
    Array(6).fill('ファイア!!!'),
    ['ファイア!!!','ファイア!!!','ファイア!!!','ファイア!!!!','ファイア!!!!','ファイア!!!!']
  ],
  transform_arp_aqua: [
    ['アクア！','アクア!!','アクア!!','アクア!!','アクア!!','アクア!!'],
    ['アクア!!','アクア!!','アクア!!','アクア!!!','アクア!!!','アクア!!!'],
    Array(6).fill('アクア!!!'),
    ['アクア!!!','アクア!!!','アクア!!!','アクア!!!!','アクア!!!!','アクア!!!!']
  ],
  transform_djinn_wind2: [
    ['ウィンド！','ウィンド!!','ウィンド!!','ウィンド!!','ウィンド!!','ウィンド!!'],
    ['ウィンド!!','ウィンド!!','ウィンド!!','ウィンド!!!','ウィンド!!!','ウィンド!!!'],
    Array(6).fill('ウィンド!!!'),
    ['ウィンド!!!','ウィンド!!!','ウィンド!!!','ウィンド!!!!','ウィンド!!!!','ウィンド!!!!']
  ],
  transform_fire_torture: [
    ['ためる','火責め','火責め','火責め','火責め','火責め'],
    Array(6).fill('火責め'), Array(6).fill('火責め')
  ],
  transform_water_torture: [
    ['ためる','水責め','水責め','水責め','水責め','水責め'],
    Array(6).fill('水責め'), Array(6).fill('水責め')
  ],
  transform_wet_slicer: [
    ['アクア！','ウェットスライサー','ウェットスライサー','★→★★','★→★★','★→★★'],
    Array(6).fill('ウェットスライサー'), Array(6).fill('ウェットスライサー'), Array(6).fill('ウェットスライサー')
  ],
  transform_roaring_lightning: [
    ['はばたき','★→★★','★→★★','★→★★','★→★★','★→★★'],
    ['ミス','轟く稲妻','轟く稲妻','★★→★★★','★★→★★★','★★→★★★'],
    ['ミス','轟く稲妻','轟く稲妻','★★★→★★★★','★★★→★★★★','★★★→★★★★'],
    Array(6).fill('轟く稲妻')
  ],
  transform_rock_throw: [
    ['ミス','岩飛ばし','岩飛ばし','岩飛ばし','岩飛ばし','岩飛ばし'],
    Array(6).fill('岩飛ばし'), Array(6).fill('岩飛ばし')
  ],
  transform_poison_crush: [
    Array(6).fill('★→★★'), Array(6).fill('★★→★★★'),
    ['おしつぶし','どくつぶし','どくつぶし','どくつぶし','どくつぶし','どくつぶし'],
    Array(6).fill('どくつぶし')
  ],
  transform_kamaitachi: [
    ['ミス','カマイタチ','カマイタチ','カマイタチ','カマイタチ','カマイタチ'],
    ['カマイタチ','カマイタチ','カマイタチ','カマイタチ','カマイタチ','タツマキ']
  ],
  transform_tatsumaki: [
    ['ミス','カマイタチ','カマイタチ','カマイタチ','カマイタチ','タツマキ'],
    ['カマイタチ','カマイタチ','カマイタチ','カマイタチ','タツマキ','タツマキ'],
    Array(6).fill('タツマキ')
  ],
  transform_dark_fire: [
    ['ほほえんでいる','ほほえんでいる','★→★★','★→★★','★→★★','★→★★'],
    ['ほほえんでいる','ほほえんでいる','★★→★★★','★★→★★★','★★→★★★','★★→★★★'],
    ['ファイアストーム','★★★→★★★★','★★★→★★★★','★★★→★★★★','★★★→★★★★','★★★→★★★★'],
    Array(6).fill('ダークファイア')
  ],
  transform_rain_god_spear: [
    ['ミス','★→★★','★→★★','★→★★','★→★★','★→★★'],
    ['ミス','ミス','雨神の戟','雨神の戟','雨神の戟','雨神の戟'],
    ['ミス','雨の戟','雨神の戟','雨神の戟','雨神の戟','雨神の戟'],
    Array(6).fill('雨神の戟')
  ],
  transform_marking_arrow: [
    ['ミス','マーキングアロー','マーキングアロー','★→★★','★→★★','★→★★'],
    ['こうげき','マーキングアロー','マーキングアロー','マーキングアロー','マーキングアロー','マーキングアロー'],
    Array(6).fill('マーキングアロー')
  ],
  transform_paralysis_arrow: Array.from({ length: 4 }, () => Array(6).fill('マヒ矢')),
  transform_neck_cut_reward: Array.from({ length: 3 }, () => Array(6).fill('くびかりのほうしゅう')),
  transform_deadly_blow: [
    Array(6).fill('★→★★'), Array(6).fill('★★→★★★'),
    ['会心の一撃','★★★→★★★★','★★★→★★★★','★★★→★★★★','★★★→★★★★','★★★→★★★★'],
    Array(6).fill('必殺の一撃')
  ],
  transform_self_destruct: Array.from({ length: 2 }, () => Array(6).fill('自爆')),
  transform_ikazuchi: [
    Array(6).fill('★→★★'),
    ['イカズチ','★★→★★★','★★→★★★','★★→★★★','★★→★★★','★★→★★★'],
    Array(6).fill('イカズチ')
  ],
  transform_venom_salamanda: [
    ['ミス','ためる','ためる','★→★★','★→★★','★→★★'],
    ['ミス','ミス','★★→★★★','★★→★★★','★★→★★★','★★→★★★'],
    ['サラマンダ','ヴェノム・サラマンダ','ヴェノム・サラマンダ','ヴェノム・サラマンダ','ヴェノム・サラマンダ','ヴェノム・サラマンダ'],
    Array(6).fill('ヴェノム・サラマンダ')
  ],
  transform_fire_ice_breath2: [
    Array(6).fill('★→★★'),
    ['ミス','EXゲージ+3','★★→★★★','★★→★★★','★★→★★★','★★→★★★'],
    ['ミス','EXゲージ+4','★★★→★★★★','★★★→★★★★','★★★→★★★★','★★★→★★★★'],
    Array(6).fill('炎と氷のいき!!')
  ],
  transform_shout: [Array(6).fill('さけぶ')],
  transform_headwind: [
    ['ウィンド','むかい風','むかい風','むかい風','むかい風','むかい風'],
    Array(6).fill('むかい風'), Array(6).fill('むかい風'), Array(6).fill('むかい風')
  ],
  transform_bubble_grand: [
    ['シャボン・グラン','シャボン・グラン','シャボン・グラン','シャボン・グラン','★→★★','★→★★'],
    Array(6).fill('シャボン・グラン'), Array(6).fill('シャボン・グラン'), Array(6).fill('シャボン・グラン')
  ],
  transform_rengeki: Array.from({ length: 4 }, () => Array(6).fill('連撃')),
  transform_heat_wave: Array.from({ length: 3 }, () => Array(6).fill('ヒートウェイブ')),
  transform_ice_storm_strike: [
    Array(6).fill('氷嵐撃'), Array(6).fill('氷嵐撃'),
    ['氷嵐撃','氷嵐撃','氷嵐撃','氷嵐撃','氷嵐撃','氷嵐撃'],
    Array(6).fill('氷嵐撃')
  ],
  transform_suck_dry: [
    ['ためる','吸いつくし','吸いつくし','吸いつくし','吸いつくし','吸いつくし'],
    Array(6).fill('吸いつくし'), Array(6).fill('吸いつくし'), Array(6).fill('吸いつくし')
  ],
  transform_epidemic_glass: [
    ['ドウン！','悪疫グラス','悪疫グラス','★→★★','★→★★','★→★★'],
    Array(6).fill('悪疫グラス'), Array(6).fill('悪疫グラス')
  ],

  // 変化用の残り主要技。Wiki掲載の育成サンプルを基準に、
  // 「目当て技を引く確率」が一意になる構成を採用する。
  transform_sword_dance: [
    ['ミス','つるぎの舞','つるぎの舞','つるぎの舞','つるぎの舞','つるぎの舞'],
    Array(6).fill('つるぎの舞'), Array(6).fill('つるぎの舞')
  ],
  transform_windmill: [
    ['ミス','★→★★','★→★★','★→★★','★→★★','★→★★'],
    ['ミス','こうげき！','風車','風車','風車','風車']
  ],
  transform_poison_bite: [
    ['ミス','★→★★','★→★★','★→★★','★→★★','★→★★'],
    ['ミス','こうげき','ためる','★★→★★★','★★→★★★','★★→★★★'],
    Array(6).fill('どくかみつき'), Array(6).fill('どくかみつき')
  ],
  transform_melting_breath: [
    ['ためる','★→★★','★→★★','★→★★','★→★★','★→★★'],
    ['ほほえんでいる','こうげき！','★★→★★★','★★→★★★','★★→★★★','★★→★★★'],
    ['ほほえんでいる','こうげき','★★★→★★★★','★★★→★★★★','★★★→★★★★','★★★→★★★★'],
    Array(6).fill('とけるいき')
  ],
  // 新4章 魔将ガープ周回用。グランブルー・ドラゴンのWiki掲載○○ブレス型。
  transform_ice_breath: [
    Array(6).fill('アイスブレス'),
    ['アイスブレス','アイスブレス','ブリザードブレス','ブリザードブレス','ブリザードブレス','ブリザードブレス'],
    ['ブリザードブレス','ブリザードブレス','ブリザードブレス','ブリザードブレス','ブリザードブレス','ダイヤモンドダストの息'],
    Array(6).fill('ダイヤモンドダストの息')
  ],
  // ケロゴン(青)の現行Wiki掲載〖ウォーターブレス〗型。☆1なので1リールのみ。
  transform_water_breath: [
    ['竜のしっぽ','ウォーターブレス','ウォーターブレス','ウォーターブレス','ウォーターブレス','ウォーターブレス']
  ],
  // アクアブレスはユーザー確認済みのクリア・ブルードラゴン型を使用する。
  // 1～4リールのアクアブレス数は 1,3,1,0。
  transform_aqua_breath: [
    ['アクアブレス','クリアアクアブレス','クリアアクアブレス','クリアアクアブレス','クリアアクアブレス','クリアアクアブレス'],
    ['アクアブレス','アクアブレス','アクアブレス','クリアアクアブレス','クリアアクアブレス','クリアアクアブレス'],
    ['アクアブレス','クリアアクアブレス','クリアアクアブレス','クリアアクアブレス','クリアアクアブレス','クリアアクアブレス'],
    Array(6).fill('クリアアクアブレス')
  ],
  // 会心の一撃はアルカードの会心型。
  transform_critical_hit: [
    ['こうげき！','★→★★','★→★★','★→★★','★→★★','★→★★'],
    ['ミス','★★→★★★','★★→★★★','★★→★★★','★★→★★★','★★→★★★'],
    ['こうげき！','会心の一撃','会心の一撃','会心の一撃','会心の一撃','会心の一撃']
  ],
  // 研究者カイスのアイテムパーツ型（コマンド潜在）。
  transform_item_parts: [
    ['ミス','アイテムパーツ','アイテムパーツ','★→★★','★→★★','★→★★'],
    ['ミス','アイテムパーツ','アイテムパーツ','アイテムパーツ','アイテムパーツ','アイテムパーツ'],
    Array(6).fill('アイテムパーツ'), Array(6).fill('アイテムパーツ')
  ],

  // ?章の大魔皇ラフロイグ戦で使用するブルー・マジシャンのアイス!!!型。
  transform_blue_magician_ice3: [
    ['アイス','★→★★','★→★★','★→★★','★→★★','★→★★'],
    ['ミス','★★→★★★','★★→★★★','★★→★★★','★★→★★★','★★→★★★'],
    Array(6).fill('アイス!!!')
  ],

  // 「その他」でも変化先として型が確定しているもの。
  transform_foot_sweep: Array.from({ length: 3 }, () => Array(6).fill('足ばらい')),
  transform_shibire_giri: Array.from({ length: 3 }, () => Array(6).fill('シビレ斬り')),
  transform_dragon_tail: [Array(6).fill('竜のしっぽ')],
  transform_shining_breath: Array.from({ length: 4 }, () => Array(6).fill('シャイニングブレス')),
  transform_fire1: [Array(6).fill('ファイア！')],
  transform_ice1: [Array(6).fill('アイス！')],
  transform_thunder1: [Array(6).fill('サンダー！')],
  transform_meteor: Array.from({ length: 4 }, () => Array(6).fill('メテオ！')),
  transform_purifying_flame: [
    Array(6).fill('ためる'), Array(6).fill('ためる'), Array(6).fill('ためる'), Array(6).fill('浄化の炎')
  ],
  transform_shiden: Array.from({ length: 3 }, () => Array(6).fill('紫電')),
  transform_princess_cheer: [
    ['王女のせいえん','王女のせいえん','王女のせいえん','女王のごほうび','女王のごほうび','女王のごほうび'],
    ['王女のせいえん','女王のごほうび','女王のごほうび','女王のごほうび','女王のごほうび','女王のごほうび'],
    Array(6).fill('女王のごほうび'), Array(6).fill('女王のごほうび')
  ],
  // ベロの3回こうげき型（コマ4以上）。☆1のため1リールのみ。
  transform_triple_attack: [['こうげき！','3回こうげき','3回こうげき','3回こうげき','3回こうげき','3回こうげき']],
  transform_queen_reward: [
    ['王女のせいえん','王女のせいえん','王女のせいえん','女王のごほうび','女王のごほうび','女王のごほうび'],
    ['王女のせいえん','女王のごほうび','女王のごほうび','女王のごほうび','女王のごほうび','女王のごほうび'],
    Array(6).fill('女王のごほうび'), Array(6).fill('女王のごほうび')
  ],
  // バトル入手チャート掲載の状態異常対策技。
  transform_kerakuzu: [
    ['ミス','ケラクズ','ケラクズ','★→★★','★→★★','★→★★'],
    ['ミス','ケラクズ','ケラクズ','ケラクズ','ケラクズ','ケラクズ'],
    Array(6).fill('ケラクズ')
  ],
  transform_sun_blessing: Array.from({ length: 4 }, () => Array(6).fill('太陽の加護')),
  // スフク・オアシス（1〜3リール）＋スライム・マナ（4リール）のWiki掲載例を統合。
  // 1〜2リールは確定移動、3リールは4/6でEX+8・2/6で1リールへ戻る。
  // 戻り枝にもミス/停止技が無く、最終的な吸収先はEX+8だけなので、有限打切り誤差を避けて
  // 変化後の最終停止結果を各リールともEX+8=100%として正規化する。
  transform_ex_plus_8: Array.from({ length:4 }, () => Array(6).fill('EXゲージ+8'))
});

export const TRANSFORM_PROFILE_BY_SKILL = Object.freeze({
  loki_brand: 'transform_loki',
  oni_spirit: 'transform_oni_spirit',
  sea_king_gaze: 'transform_sea_king_gaze',
  spirit_blessing: 'transform_spirit_blessing',
  growl: 'transform_growl',
  sun_hymn: 'transform_sun_hymn',
  name_announcement: 'transform_name_announcement',
  ninja_wind: 'transform_ninja_wind',
  ninja_fire: 'transform_ninja_fire',
  ninja_water: 'transform_ninja_water',
  red_point_2: 'transform_red_point',
  blue_point_2: 'transform_blue_point',
  yellow_point_2: 'transform_yellow_point',
  green_point_2: 'transform_green_point',
  crush: 'transform_crush',
  peck_many: 'transform_peck_many',
  fire3: 'transform_ifrit',
  aqua2: 'transform_arp_aqua',
  aqua3: 'transform_arp_aqua',
  wind2: 'transform_djinn_wind2',
  wind3_hidden: 'transform_djinn_wind2',
  ice3_hidden: 'transform_blue_magician_ice3',
  fire_torture: 'transform_fire_torture',
  water_torture: 'transform_water_torture',
  wet_slicer: 'transform_wet_slicer',
  roaring_lightning: 'transform_roaring_lightning',
  rock_throw: 'transform_rock_throw',
  poison_crush: 'transform_poison_crush',
  kamaitachi: 'transform_kamaitachi',
  tatsumaki: 'transform_tatsumaki',
  dark_fire: 'transform_dark_fire',
  rain_god_spear: 'transform_rain_god_spear',
  marking_arrow: 'transform_marking_arrow',
  paralysis_arrow: 'transform_paralysis_arrow',
  neck_cut_reward: 'transform_neck_cut_reward',
  deadly_blow: 'transform_deadly_blow',
  self_destruct: 'transform_self_destruct',
  ikazuchi: 'transform_ikazuchi',
  venom_salamanda: 'transform_venom_salamanda',
  fire_ice_breath2: 'transform_fire_ice_breath2',
  shout: 'transform_shout',
  headwind: 'transform_headwind',
  bubble_grand: 'transform_bubble_grand',
  rengeki: 'transform_rengeki',
  heat_wave: 'transform_heat_wave',
  ice_storm_strike: 'transform_ice_storm_strike',
  suck_dry: 'transform_suck_dry',
  epidemic_glass: 'transform_epidemic_glass',
  sword_dance: 'transform_sword_dance',
  windmill: 'transform_windmill',
  poison_bite: 'transform_poison_bite',
  melting_breath: 'transform_melting_breath',
  aqua_breath: 'transform_aqua_breath',
  water_breath: 'transform_water_breath',
  ice_breath: 'transform_ice_breath',
  critical_hit: 'transform_critical_hit',
  item_parts: 'transform_item_parts',
  // ユーザー所持個体の確定コマンドを変化先として再利用。
  red_fire_breath: 'dark_bahamut_red',
  blue_aqua_breath: 'dark_bahamut_blue',
  yellow_earth_breath: 'dark_bahamut_yellow',
  green_air_breath: 'dark_bahamut_green',
  attack_bang: 'sylph',
  triple_attack: 'transform_triple_attack',
  foot_sweep: 'transform_foot_sweep',
  shibire_giri: 'transform_shibire_giri',
  dragon_tail: 'transform_dragon_tail',
  shining_breath: 'transform_shining_breath',
  fire1: 'transform_fire1',
  ice1: 'transform_ice1',
  thunder1: 'transform_thunder1',
  meteor: 'transform_meteor',
  purifying_flame: 'transform_purifying_flame',
  shiden: 'transform_shiden',
  princess_cheer: 'transform_princess_cheer',
  queen_reward: 'transform_queen_reward',
  kerakuzu: 'transform_kerakuzu',
  sun_blessing: 'transform_sun_blessing',
  ex_plus_8: 'transform_ex_plus_8',
  trial_gun: 'docteur'
});


const TRANSFORM_SELF_REELS = Object.freeze({
  son_goku: Object.freeze({
    stop1: Object.freeze([{ miss:6, move:0 },{ miss:6, move:0 },{ miss:6, move:0 },{ miss:6, move:0 }]),
    forward4: Object.freeze([{ miss:2, move:4 },{ miss:3, move:3 },{ miss:3, move:3 },{ miss:6, move:0 }]),
    stop3: Object.freeze([{ miss:2, move:4 },{ miss:3, move:3 },{ miss:6, move:0 },{ miss:6, move:0 }]),
    stop2: Object.freeze([{ miss:2, move:4 },{ miss:6, move:0 },{ miss:3, move:3 },{ miss:6, move:0 }])
  }),
  gyumao: Object.freeze({
    stop1: Object.freeze([{ miss:6, move:0 },{ miss:6, move:0 },{ miss:6, move:0 },{ miss:6, move:0 }]),
    forward4: Object.freeze([{ miss:1, move:5 },{ miss:3, move:3 },{ miss:3, move:3 },{ miss:6, move:0 }]),
    stop3: Object.freeze([{ miss:1, move:5 },{ miss:3, move:3 },{ miss:6, move:0 },{ miss:6, move:0 }]),
    // Wikiの「2-4止め」型。2リールは七十二変化×6、3リールは七十二変化×3＋4送り×3。
    // stop2 は旧保存データ互換の別名として同じ挙動を維持する。
    stop24: Object.freeze([{ miss:1, move:5 },{ miss:6, move:0 },{ miss:3, move:3 },{ miss:6, move:0 }]),
    stop2: Object.freeze([{ miss:1, move:5 },{ miss:6, move:0 },{ miss:3, move:3 },{ miss:6, move:0 }])
  })
});

function transformSelfReels(characterId, commandVariant = '') {
  const variants = TRANSFORM_SELF_REELS[characterId];
  if (!variants) return null;
  // 旧保存データは従来挙動（4送り相当）を維持する。
  return variants[commandVariant] ?? variants.forward4;
}

const CHARACTER_SKILL_PROFILE = Object.freeze({
  kerogon_blue: Object.freeze({
    '竜のしっぽ': 'kerogon_blue',
    'ウォーターブレス': 'kerogon_blue_water'
  }),
  dartan: Object.freeze({
    '連撃': 'dartan',
    'こうげき!': 'dartan_attack1'
  }),
  camineko: Object.freeze({
    'ファイア!': 'camineko_fire',
    'アイス!': 'camineko_ice',
    'サンダー!': 'camineko_thunder'
  }),
  dark_bahamut: Object.freeze({
    'レッドファイアブレス': 'dark_bahamut_red',
    'ブルーアクアブレス': 'dark_bahamut_blue',
    'イエローアースブレス': 'dark_bahamut_yellow',
    'グリーンエアブレス': 'dark_bahamut_green'
  })
});

const ATTACK1_VARIANT_CHARACTERS = new Set([
  'gate_dante','yamato','susanoo','nanawarai','ginger_ale','fire_drake'
]);

function commandProfileId(characterId, skillName = '', commandVariant = '') {
  if (ATTACK1_VARIANT_CHARACTERS.has(characterId) && commandVariant === 'attack1') return `${characterId}_attack1`;
  if (characterId === 'soccerra' && commandVariant === 'deadly3') return 'soccerra_deadly3';
  if (characterId === 'mimitoshishi') {
    return commandVariant === 'attack6' ? 'mimitoshishi_attack6' : 'mimitoshishi_mixed';
  }
  if (characterId === 'red_empress') {
    if (commandVariant === 'critical5') return 'red_empress_critical5';
    if (commandVariant === 'critical4') return 'red_empress_critical4';
    return 'red_empress';
  }
  const bySkill = CHARACTER_SKILL_PROFILE[characterId];
  if (bySkill) return bySkill[normalizeSkillName(skillName)] ?? '';
  return characterId;
}

const DISPLAY_NON_SKILL_COMMANDS = new Set([
  '', 'ミス', 'ほほえんでいる', 'ほほえんでいる?', 'なげいている', 'ためる', 'チャージ',
  '燃えている', '笑っている', 'みくだしている', 'ときをまつ', 'うつむいている', '様子を見ている'
]);

function isDisplaySkillCommand(commandName) {
  const name = String(commandName ?? '').trim();
  if (DISPLAY_NON_SKILL_COMMANDS.has(name)) return false;
  if (/^(★+)→(★+)$/.test(name)) return false;
  if (/^EXゲージ[+＋]\d+$/.test(name)) return false;
  return Boolean(name);
}

// キャラプリセット自身のコマンド表から、実際に発動し得る「技名」だけを表示用に列挙する。
// リール移動・ためる・ミス・待機系・EXゲージ加算コマンドは、確率計算には残すが技名表示からは除外する。
export function commandSkillNamesForCharacter(characterId, skillName = '', commandVariant = '') {
  const matrix = COMMAND_PROFILES[commandProfileId(characterId, skillName, commandVariant)];
  if (!matrix) return [];
  const out = [];
  const seen = new Set();
  for (const reel of matrix) {
    for (const raw of reel ?? []) {
      const name = String(raw ?? '').trim();
      if (!isDisplaySkillCommand(name) || seen.has(name)) continue;
      seen.add(name);
      out.push(name);
    }
  }
  if (out.length) return out;
  // 実技が1つも無い個体（例: ミスのみ）は、何も表示しないよりコマンド内容が分かる方がよい。
  const fallback = [];
  const fallbackSeen = new Set();
  for (const reel of matrix) {
    for (const raw of reel ?? []) {
      const name = String(raw ?? '').trim();
      if (!name || /^(★+)→(★+)$/.test(name) || /^EXゲージ[+＋]\d+$/.test(name) || fallbackSeen.has(name)) continue;
      fallbackSeen.add(name);
      fallback.push(name);
    }
  }
  return fallback;
}

export function isTransformSkillPresetId(skillPresetId) {
  return skillPresetId === 'fire2' || Boolean(TRANSFORM_PROFILE_BY_SKILL[skillPresetId]);
}

function parseStarArrow(value) {
  const m = String(value ?? '').trim().match(/^(★+)→(★+)$/);
  if (!m) return null;
  return { from: m[1].length - 1, to: m[2].length - 1 };
}

function addTransition(map, reel, downCount, probability) {
  if (!(probability > 0)) return;
  const key = `${reel}|${downCount}`;
  map.set(key, (map.get(key) ?? 0) + probability);
}

// 所持個体画像では「★★→★★★★」のような複数リール飛ばしが存在するため、
// コマンド文字列そのものから遷移先を解決する。通常の★→★★やためる／チャージの挙動は
// 技発動率計算ツールの通常モードと同じ。
function resolveProfileTurn(matrix, skillName, startReel = 0) {
  const n = matrix.length;
  const target = normalizeSkillName(skillName);
  const actual = Math.max(0, Math.min(Number(startReel) || 0, n - 1));
  const absorbing = [];
  let active = new Map([[`${actual}|0`, 1]]);
  const EPS = 1e-12;
  const MAX_ITER = 5000;

  for (let iter = 0; iter < MAX_ITER && active.size; iter += 1) {
    const next = new Map();
    for (const [key, probability] of active.entries()) {
      if (probability < EPS) continue;
      const [reelText, downText] = key.split('|');
      const reel = Number(reelText);
      const downCount = Number(downText);
      const slots = matrix[reel] ?? [];
      const slotProbability = probability / 6;

      for (const raw of slots) {
        const value = String(raw ?? '').trim();
        if (normalizeSkillName(value) === target) {
          absorbing.push({ nextReel: reel, activated: true, probability: slotProbability });
          continue;
        }
        if (value === 'ためる' || value === 'チャージ') {
          absorbing.push({ nextReel: Math.min(reel + 1, n - 1), activated: false, probability: slotProbability });
          continue;
        }
        const arrow = parseStarArrow(value);
        if (arrow) {
          const destination = Math.max(0, Math.min(arrow.to, n - 1));
          if (destination > reel) {
            addTransition(next, destination, downCount, slotProbability);
          } else if (destination < reel) {
            // 技発動率計算ツールの通常モードと同じく、下降の無限循環を抑止する。
            if (downCount >= 4) absorbing.push({ nextReel: reel, activated: false, probability: slotProbability });
            else addTransition(next, destination, downCount + 1, slotProbability);
          } else {
            absorbing.push({ nextReel: reel, activated: false, probability: slotProbability });
          }
          continue;
        }
        absorbing.push({ nextReel: reel, activated: false, probability: slotProbability });
      }
    }
    active = next;
  }

  return aggregateActivationTransitions(absorbing);
}

function aggregateActivationTransitions(items) {
  const out = new Map();
  for (const tr of items) {
    const key = `${tr.nextReel}|${tr.activated ? 1 : 0}`;
    out.set(key, (out.get(key) ?? 0) + tr.probability);
  }
  return [...out.entries()].map(([key, probability]) => {
    const [reel, hit] = key.split('|');
    return { nextReel: Number(reel), activated: hit === '1', probability };
  });
}


function aggregateCommandTransitions(items, preserveSlots = false) {
  const out = new Map();
  for (const tr of items) {
    const name = String(tr.commandName ?? '');
    const slotSuffix = preserveSlots ? `|${tr.stopReel ?? ''}|${tr.slotIndex ?? ''}` : '';
    const key = `${tr.nextReel}|${name}${slotSuffix}`;
    out.set(key, (out.get(key) ?? 0) + tr.probability);
  }
  return [...out.entries()].map(([key, probability]) => {
    const parts = key.split('|');
    const result = { nextReel: Number(parts[0]), commandName: parts[1] ?? '', probability };
    if (preserveSlots) {
      result.stopReel = Number(parts[2]);
      result.slotIndex = Number(parts[3]);
    }
    return result;
  });
}

// 1回の行動で実際に止まるコマンドまで解決する。
// ★移動は同一ターン内で次のリールを再抽選、ためる／チャージはそのターンを終了して次回リールを+1する。
// それ以外は実際に止まったコマンド名を返し、撃破確率側で対応する技効果を実行する。
// preserveSlots=true の場合は、技変化を正確に行えるよう最終的に停止したリール/マス番号も保持する。
function resolveProfileCommandTurn(matrix, startReel = 0, preserveSlots = false) {
  const n = matrix.length;
  const actual = Math.max(0, Math.min(Number(startReel) || 0, n - 1));
  const absorbing = [];
  let active = new Map([[`${actual}|0`, 1]]);
  const EPS = 1e-12;
  const MAX_ITER = 5000;

  for (let iter = 0; iter < MAX_ITER && active.size; iter += 1) {
    const next = new Map();
    for (const [key, probability] of active.entries()) {
      if (probability < EPS) continue;
      const [reelText, downText] = key.split('|');
      const reel = Number(reelText);
      const downCount = Number(downText);
      const slots = matrix[reel] ?? [];
      const slotProbability = probability / 6;

      for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
        const raw = slots[slotIndex];
        const value = String(raw ?? '').trim();
        if (value === 'ためる' || value === 'チャージ') {
          absorbing.push({ nextReel: Math.min(reel + 1, n - 1), commandName: value, probability: slotProbability, stopReel:reel, slotIndex });
          continue;
        }
        const arrow = parseStarArrow(value);
        if (arrow) {
          const destination = Math.max(0, Math.min(arrow.to, n - 1));
          if (destination > reel) {
            addTransition(next, destination, downCount, slotProbability);
          } else if (destination < reel) {
            if (downCount >= 4) absorbing.push({ nextReel: reel, commandName: '', probability: slotProbability, stopReel:reel, slotIndex });
            else addTransition(next, destination, downCount + 1, slotProbability);
          } else {
            absorbing.push({ nextReel: reel, commandName: '', probability: slotProbability, stopReel:reel, slotIndex });
          }
          continue;
        }
        absorbing.push({ nextReel: reel, commandName: value, probability: slotProbability, stopReel:reel, slotIndex });
      }
    }
    active = next;
  }

  return aggregateCommandTransitions(absorbing, preserveSlots);
}

export function commandTransitionsFromMatrix(matrix, startReel = 0, options = {}) {
  if (!Array.isArray(matrix) || !matrix.length) return null;
  return resolveProfileCommandTurn(matrix, startReel, options?.preserveSlots === true);
}

export function activationTransitionsFromMatrix(matrix, skillName, startReel = 0) {
  if (!Array.isArray(matrix) || !matrix.length) return null;
  return resolveProfileTurn(matrix, skillName, startReel);
}

export function normalCommandTransitions(characterId, skillName = '', startReel = 0, commandVariant = '') {
  const matrix = COMMAND_PROFILES[commandProfileId(characterId, skillName, commandVariant)];
  if (!matrix) return null;
  return resolveProfileCommandTurn(matrix, startReel);
}

// 変化先側で、停止したリールから実際に出る全コマンドを返す。
// ファイア!!だけは1リール停止時に魔導師ジョンガリの確定型を使う。
export function transformTargetCommandTransitions(skillPresetId, skillName, stopReel = 0) {
  const stop = Math.max(0, Math.min(Number(stopReel) || 0, 3));
  if (skillPresetId === 'fire2') {
    const matrix = stop === 0 ? COMMAND_PROFILES.transform_jongari_fire2 : COMMAND_PROFILES.transform_ifrit;
    const actual = stop === 0 ? 0 : Math.min(stop, matrix.length - 1);
    return resolveProfileCommandTurn(matrix, actual);
  }
  const profileId = TRANSFORM_PROFILE_BY_SKILL[skillPresetId];
  const matrix = profileId ? COMMAND_PROFILES[profileId] : null;
  if (!matrix) return null;
  return resolveProfileCommandTurn(matrix, Math.min(stop, matrix.length - 1));
}

export function transformCommandTransitions(type, skillPresetId, skillName, startReel = 0, commandVariant = '') {
  if (skillPresetId !== 'fire2' && !TRANSFORM_PROFILE_BY_SKILL[skillPresetId]) return null;
  const characterId = type === '猿' ? 'son_goku' : type === '牛' ? 'gyumao' : '';
  const fixed = transformSelfReels(characterId, commandVariant) ?? getChangeReels(type);
  const ownStart = Math.max(0, Math.min(startReel, 3));
  const out = [];
  for (const stop of resolveFixedChangeTurn(ownStart, fixed)) {
    const targetTransitions = transformTargetCommandTransitions(skillPresetId, skillName, stop.reel);
    if (!targetTransitions) return null;
    for (const tr of targetTransitions) {
      // 変化終了後はソンゴクウ/牛魔王自身の停止リールを保持する。
      out.push({ nextReel: stop.reel, commandName: tr.commandName, probability: stop.prob * tr.probability });
    }
  }
  return aggregateCommandTransitions(out);
}


const COMMAND_TRANSITIONS_CACHE = new Map();

function cachedCommandTransitions(key, factory) {
  if (COMMAND_TRANSITIONS_CACHE.has(key)) return COMMAND_TRANSITIONS_CACHE.get(key);
  const value = factory();
  COMMAND_TRANSITIONS_CACHE.set(key, value);
  return value;
}

export function commandTransitionsFor({ characterId, skillPresetId, skillName, startReel = 0, commandVariant = '' }) {
  if (!characterId) return null;
  const key = `${characterId}|${skillPresetId ?? ''}|${skillName ?? ''}|${Number(startReel) || 0}|${commandVariant ?? ''}`;
  return cachedCommandTransitions(key, () => {
    if (characterId === 'son_goku' && skillPresetId === 'goku_lower_ex') {
      return [{ nextReel:startReel, commandName:skillName || '身外身の術', probability:1, directAction:true }];
    }
    if (characterId === 'son_goku') return skillPresetId ? transformCommandTransitions('猿', skillPresetId, skillName, startReel, commandVariant) : null;
    if (characterId === 'gyumao') return skillPresetId ? transformCommandTransitions('牛', skillPresetId, skillName, startReel, commandVariant) : null;
    return normalCommandTransitions(characterId, skillName, startReel, commandVariant);
  });
}

export function normalActivationTransitions(characterId, skillName, startReel = 0, commandVariant = '') {
  const matrix = COMMAND_PROFILES[commandProfileId(characterId, skillName, commandVariant)];
  if (!matrix) return null;
  return resolveProfileTurn(matrix, skillName, startReel);
}

// 七十二変化の術で固定リールが止まった後、変化先のコマンドから目当て技を引く確率。
// ファイア!!だけはユーザー指定どおり、1リール停止時に魔導師ジョンガリ、
// 2～4リール停止時に大魔神イフリートを使い分ける。
export function transformTargetActivationTransitions(skillPresetId, skillName, stopReel = 0) {
  const stop = Math.max(0, Math.min(Number(stopReel) || 0, 3));
  if (skillPresetId === 'fire2') {
    const matrix = stop === 0 ? COMMAND_PROFILES.transform_jongari_fire2 : COMMAND_PROFILES.transform_ifrit;
    const actual = stop === 0 ? 0 : Math.min(stop, matrix.length - 1);
    return resolveProfileTurn(matrix, skillName, actual);
  }
  const profileId = TRANSFORM_PROFILE_BY_SKILL[skillPresetId];
  const matrix = profileId ? COMMAND_PROFILES[profileId] : null;
  if (!matrix) return null;
  return resolveProfileTurn(matrix, skillName, Math.min(stop, matrix.length - 1));
}

export function transformActivationTransitions(type, skillPresetId, skillName, startReel = 0, commandVariant = '') {
  // 変化先プロファイルが無い技は従来どおり null を返し、呼び出し側で警告＋暫定100%扱い。
  if (skillPresetId !== 'fire2' && !TRANSFORM_PROFILE_BY_SKILL[skillPresetId]) return null;
  const characterId = type === '猿' ? 'son_goku' : type === '牛' ? 'gyumao' : '';
  const fixed = transformSelfReels(characterId, commandVariant) ?? getChangeReels(type);
  const ownStart = Math.max(0, Math.min(startReel, 3));
  const out = [];
  for (const stop of resolveFixedChangeTurn(ownStart, fixed)) {
    const targetTransitions = transformTargetActivationTransitions(skillPresetId, skillName, stop.reel);
    if (!targetTransitions) return null;
    for (const tr of targetTransitions) {
      out.push({ nextReel: stop.reel, activated: tr.activated, probability: stop.prob * tr.probability });
    }
  }
  return aggregateActivationTransitions(out);
}

export function activationTransitionsFor({ characterId, skillPresetId, skillName, startReel = 0, commandVariant = '' }) {
  if (!characterId || !skillPresetId) return null;
  if (characterId === 'son_goku') return transformActivationTransitions('猿', skillPresetId, skillName, startReel, commandVariant);
  if (characterId === 'gyumao') return transformActivationTransitions('牛', skillPresetId, skillName, startReel, commandVariant);
  return normalActivationTransitions(characterId, skillName, startReel, commandVariant);
}

export function hasCommandProfile(characterId, skillName = '', commandVariant = '') {
  return Boolean(COMMAND_PROFILES[commandProfileId(characterId, skillName, commandVariant)]);
}

