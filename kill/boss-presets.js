// 撃破確率用BOSSプリセット v0.5.66
import { PARTY_ROWS } from '../encounter/data.js';
// 旧章 / 新章・?章のバトル入手チャート掲載BOSSを対象。
// 撃破確率エンジンが現在参照するのは HP / 属性 / 種族特効用分類 / 素早さ。

const p = (id, chapter, name, hp, attribute, raceLabel, speed, extra = {}) => ({
  id, chapter, name, hp, attribute, raceLabel, speed,
  race: raceLabel === 'アンデッド' ? 'undead' : raceLabel === '悪魔' ? 'demon' : raceLabel === '天使' ? 'angel' : raceLabel === '鳥獣' ? 'birdBeast' : raceLabel === '水族' ? 'waterRace' : raceLabel === '機械' ? 'machine' : 'normal',
  hpRaw: extra.hpRaw ?? String(hp),
  speedRaw: extra.speedRaw ?? String(speed),
  chart: extra.chart ?? 'old',
  encounterNote: extra.encounterNote ?? '',
  companions: extra.companions ?? [],
  note: extra.note ?? '',
  enemyCount: Math.max(1, Number(extra.enemyCount ?? 1) || 1)
});

const BASE_BOSS_PRESETS = [
  // 旧章チャート
  p('old0_red_princess','序章','赤のプリンセス',333,'water','獣',45,{encounterNote:'吟遊詩人キドリを伴う編成あり'}),
  p('old0_quicksilver','序章','魔獣クイックシルバー',1333,'wind','幻獣',65),
  p('old0_red_dragon','序章','レッドドラゴン',1750,'fire','ドラゴン',30),
  p('old0_muus','序章','魔王ムウス',1500,'fire','悪魔',30),
  p('old0_heavy_behemoth','序章','重竜ベヒモス',1500,'earth','ドラゴン',10),
  p('old0_blue_dragon','序章','ブルードラゴン',1400,'water','ドラゴン',25),
  p('old0_riviere','序章','魔王リヴィエール',1800,'water','悪魔',52,{speedRaw:'50+2'}),
  p('old0_silver_dragon','序章','シルバードラゴン',2567,'wind','ドラゴン',50),

  p('old1_grim','第1章','死神グリム',666,'wind','悪魔',70,{speedRaw:'66+4'}),
  p('old1_genbu','第1章','仙竜ゲンブ',1500,'water','ドラゴン',15),
  p('old1_azul','第1章','魔王アズール',1900,'water','悪魔',57,{speedRaw:'55+2'}),
  p('old1_blizzard_dragon','第1章','ブリザードドラゴン',2200,'water','ドラゴン',50),
  p('old1_fafnir','第1章','暗黒竜ファヴニール',2800,'earth','ドラゴン',30),

  p('old2_soccerra','第2章','魔王サッカーラ',2200,'earth','悪魔',20),
  p('old2_skullbone','第2章','スカルボーンドラゴン',2400,'earth','ドラゴン',10),
  p('old2_ifrit','第2章','魔人イフリート',2000,'fire','火族',0),

  p('old3_yamata','第3章','ヤマタノオロチ',1800,'wind','ドラゴン',70),
  p('old3_kukulkan','第3章','龍神ククルカン',1900,'wind','ドラゴン',80),
  p('old3_nanawarai','第3章','魔王ナナワライ',2000,'wind','悪魔',60),
  p('old3_fanlong','第3章','竜帝ファンロン',2500,'earth','ドラゴン',45,{encounterNote:'金竜のタマゴとの2体編成',companions:['金竜のタマゴ']}),

  p('old4_chibimuus','第4章','チビムウス',850,'fire','悪魔',15),
  p('old4_lafroig','第4章','魔皇ラフロイグ',1400,'fire','悪魔',35),
  p('old4_chiviere','第4章','チヴィエール',800,'water','悪魔',25),

  p('old5_frost_dragon','第5章','凍竜フロストドラゴン',1700,'water','ドラゴン',55),
  p('old5_kujeska','第5章','魔皇クジェスカ',1500,'water','悪魔',50),

  p('old6_white_dragon','第6章','ホワイトドラゴン',1500,'water','ドラゴン',70),
  p('old6_enma','第6章','獄王閻魔',1650,'earth','アンデッド',60),
  p('old6_tokai','第6章','魔皇トカイ',1710,'earth','アンデッド',70,{hpRaw:'1700+10'}),

  p('old7_son_goku','第7章','斉天大聖ソンゴクウ',900,'wind','風族',75),
  p('old7_maotai','第7章','魔皇マオタイ',1500,'wind','悪魔',70),

  // 新章チャート
  p('new0_volcano_dragon','新序章','ヴォルケイノドラゴン',1700,'fire','ドラゴン',25,{chart:'new',encounterNote:'火山弾との2体編成',companions:['火山弾']}),
  p('new0_damkina','新序章','ダムキナ',1200,'wind','天使',85,{chart:'new'}),
  p('new0_nergal','新序章','覇将ネルガル',1200,'wind','戦士',50,{chart:'new',encounterNote:'参謀エンリルとの2体編成',companions:['参謀エンリル']}),
  p('new0_marduk','新序章','狂王マルドク',1600,'wind','悪魔',75,{chart:'new'}),

  p('new1_stream_dragon','新1章','海竜ストリームドラゴン',1300,'water','海竜',65,{chart:'new',note:'BOSS専用パラメータを採用',encounterNote:'海竜のしずくとの2体編成',companions:['海竜のしずく']}),
  p('new1_fiska','新1章','魔海将フィスカ',1650,'water','悪魔',47,{chart:'new',speedRaw:'45+2'}),
  p('new1_robo_03','新1章','ロボ零参式',1620,'earth','機械',25,{chart:'new',hpRaw:'1600+20'}),

  p('new2_arp','新2章','魔神アープ',800,'water','水族',50,{chart:'new'}),
  p('new2_ash_dragon','新2章','灰竜アッシュドラゴン',1250,'earth','ドラゴン',45,{chart:'new',encounterNote:'竜灰との2体編成',companions:['竜灰']}),
  p('new2_gnome','新2章','魔神グノーム',2000,'earth','土族',25,{chart:'new'}),
  p('new2_vamps_dragon','新2章','吸血竜ヴァンプスドラゴン',1500,'fire','ドラゴン',45,{chart:'new'}),

  p('new3_root_dragon','新3章','大樹竜ルートドラゴン',1410,'wind','ドラゴン',64,{chart:'new',hpRaw:'1400+10',speedRaw:'60+4'}),
  p('new3_deathfear_plant','新3章','デスフィアープラント',1600,'earth','植物',50,{chart:'new',encounterNote:'デスプラント・大樹竜の球根との3体編成',companions:['デスプラント','大樹竜の球根']}),
  p('new3_nirahalar','新3章','神人ニラーハラー',1550,'water','悪魔',50,{chart:'new'}),
  p('new3_oroshi','新3章','風隠の族長オロシ',1500,'wind','戦士',65,{chart:'new'}),

  p('new4_iron_dragon','新4章','黒鉄竜アイアンドラゴン',1600,'fire','ドラゴン',35,{chart:'new'}),
  p('new4_garp','新4章','魔将ガープ',1400,'fire','悪魔',70,{chart:'new',encounterNote:'ダークサラマンダー・魔鏡騎士リフレクとの3体編成',companions:['ダークサラマンダー','魔鏡騎士リフレク']}),
  p('new4_phantom','新4章','ファントム',1300,'fire','悪魔',45,{chart:'new'}),
  p('new4_avaddon','新4章','魔王アヴァドン',1510,'earth','悪魔',10,{chart:'new',hpRaw:'1500+10',encounterNote:'アヴァドンフード×2との3体編成',companions:['アヴァドンフード','アヴァドンフード']}),

  p('new5_mashumaro','新5章','マシュまろ',250,'water','幻獣',62,{chart:'new',speedRaw:'60+2',enemyCount:3,encounterNote:'同一BOSS3体編成。3体のHPを個別追跡して撃破率を計算'}),
  p('new5_glacier_dragon','新5章','グレイシアドラゴン',1800,'water','ドラゴン',30,{chart:'new',encounterNote:'竜氷山との2体編成',companions:['竜氷山']}),
  p('new5_barolo','新5章','海王バローロ',1900,'water','悪魔',40,{chart:'new'}),
  p('new5_sea_serpent','新5章','魔海竜シーサーペント',1700,'water','海竜',45,{chart:'new'}),
  p('new5_god_barolo','新5章','神海帝バローロ',2000,'water','悪魔',45,{chart:'new'}),

  p('new6_necro_dragon','新6章','鬼竜ネクロドラゴン',1500,'earth','アンデッド',25,{chart:'new'}),
  p('new6_elysion','新6章','光王エーリュシオン',1950,'earth','天使',45,{chart:'new'}),
  p('new6_wight','新6章','死霊使いワイト',800,'earth','召喚士',60,{chart:'new'}),
  p('new6_arc_dragon','新6章','聖竜アークドラゴン',1350,'earth','ドラゴン',65,{chart:'new'}),
  p('new6_kais','新6章','研究者カイス',1200,'water','機械',65,{chart:'new'}),

  // ?章チャート
  p('q_emerald_dragon','?章','エメラルドドラゴン',1600,'wind','ドラゴン',70,{chart:'new'}),
  p('q_daidarabocchi','?章','ダイダラボッチ',2500,'earth','土族',5,{chart:'new'}),
  p('q_kerogon_gold','?章','ケロゴン(金)',650,'fire','ドラゴン',40,{chart:'new'}),
  p('q_nataraja','?章','舞王ナタラジャ',1400,'fire','悪魔',70,{chart:'new'}),
  p('q_zarigarion','?章','鋏竜ザリガリオン',1950,'water','戦士',30,{chart:'new'}),
  p('q_ghost_jeanne','?章','幽鬼ジャンヌ',1200,'water','戦士',50,{chart:'new'}),
  p('q_dartan','?章','時元銃士ダルタン',1400,'earth','戦士',40,{chart:'new'}),
  p('q_enki','?章','騎士団長エンキ',1500,'wind','戦士',45,{chart:'new'}),
  p('q_kenran_kukulkan','?章','絢蘭竜ククルカン',1800,'wind','ドラゴン',85,{chart:'new'}),
  p('q_ice_dante','?章','薄氷の剣士ダンテ',1400,'water','戦士',50,{chart:'new'}),
  p('q_blazing_ares','?章','灼熱剣士アレス',2900,'fire','火族',30,{chart:'new'}),
  p('q_great_azul','?章','大魔王アズール',1600,'water','悪魔',45,{chart:'new'}),
  p('q_great_soccerra','?章','大魔王サッカーラ',2100,'earth','悪魔',25,{chart:'new'}),
  p('q_great_nanawarai','?章','大魔王ナナワライ',1800,'wind','悪魔',65,{chart:'new'}),
  p('q_great_muus','?章','大魔王ムウス',1800,'fire','悪魔',50,{chart:'new'}),
  p('q_lucifer','?章','銀月のルシフェル',1800,'water','天使',65,{chart:'new'}),
  p('q_michael','?章','金陽のミカエル',1950,'fire','天使',65,{chart:'new'}),
  p('q_great_lafroig','?章','大魔皇ラフロイグ',2600,'fire','悪魔',65,{chart:'new'}),
  p('q_great_kujeska','?章','大魔皇クジェスカ',2300,'water','悪魔',75,{chart:'new'}),
  p('q_great_tokai','?章','大魔皇トカイ',2600,'earth','アンデッド',60,{chart:'new'}),
  p('q_lokesha','?章','創造神ロケーシャ',1600,'fire','悪魔',60,{chart:'new',encounterNote:'アシユラとの2体編成',companions:['アシユラ'],note:'通常召喚は1リール開始。召喚カルラの継承リールは進化元の入手時初期リールを基準に計算します。'}),
  p('q_black_red_dragon','?章','黒いレッドドラゴン',800,'fire','ドラゴン',50,{chart:'new'}),
  p('q_cursed_yamata','?章','祟竜ヤマタノオロチ',850,'fire','ドラゴン',70,{chart:'new'}),
  p('q_yinlong','?章','陰龍インシェンロン',1000,'water','ドラゴン',80,{chart:'new'}),
  p('q_dark_bahamut','?章','冥界竜ダークバハムート',1000,'earth','ドラゴン',50,{chart:'new'}),
  p('q_shining_fire_drake','?章','煌竜王ファイアドレイク',1800,'fire','ドラゴン',45,{chart:'new'}),
  p('q_dock_low','?章','海賊王ドック・ロー',1700,'water','戦士',55,{chart:'new'}),
  p('q_dark_priestess','?章','闇の女神官',1700,'wind','魔法使い',70,{chart:'new'}),
  p('q_black_drake','?章','滅竜王ブラックドレイク',2666,'earth','ドラゴン',66,{chart:'new'}),
  p('q_fire_drake','?章','ファイアドレイク',1000,'fire','ドラゴン',45,{chart:'new'}),
  p('q_ice_valkyrie','?章','アイスワルキューレ',850,'water','戦士',70,{chart:'new'}),
  p('q_meat_mania','?章','ミートマニア',900,'wind','戦士',30,{chart:'new'}),
  p('q_platinum_drake','?章','プラチナドレイク',1500,'earth','ドラゴン',75,{chart:'new'})
];

const CHAPTER_INDEX = Object.freeze({
  '序章': 0, '第1章': 1, '第2章': 2, '第3章': 3, '第4章': 4, '第5章': 5, '第6章': 6, '第7章': 7,
  '新序章': 0, '新1章': 1, '新2章': 2, '新3章': 3, '新4章': 4, '新5章': 5, '新6章': 6
});

function encounterPartyFor(preset) {
  const chapterIndex = CHAPTER_INDEX[preset.chapter];
  if (chapterIndex === undefined) return null;
  return PARTY_ROWS.find(row => row[0] === chapterIndex && String(row[3]).split(' / ').includes(`(BOSS)${preset.name}`)) ?? null;
}

function inferredCompanions(preset) {
  const row = encounterPartyFor(preset);
  if (!row) return preset.companions ?? [];
  const party = String(row[3]).split(' / ').map(name => name.replace(/^\(BOSS\)/, ''));
  let skippedBoss = false;
  return party.filter(name => {
    if (!skippedBoss && name === preset.name) { skippedBoss = true; return false; }
    return true;
  });
}

export const BOSS_PRESETS = Object.freeze(BASE_BOSS_PRESETS.map(preset => {
  const companions = inferredCompanions(preset);
  const encounterNote = preset.encounterNote || (companions.length ? `お供: ${companions.join(' / ')}` : '');
  return Object.freeze({ ...preset, companions: Object.freeze(companions), encounterNote });
}));

export const BOSS_PRESET_BY_ID = new Map(BOSS_PRESETS.map(x => [x.id, x]));

export const BOSS_CHAPTER_ORDER = Object.freeze([
  '序章','第1章','第2章','第3章','第4章','第5章','第6章','第7章',
  '新序章','新1章','新2章','新3章','新4章','新5章','新6章','?章'
]);

export function applyBossPresetToEnemy(enemy, presetId) {
  const preset = BOSS_PRESET_BY_ID.get(presetId);
  if (!preset) return { ...enemy, presetId: '' };
  return {
    ...enemy,
    presetId: preset.id,
    maxHp: String(preset.hp),
    attribute: preset.attribute,
    race: preset.race,
    speed: String(preset.speed)
  };
}
