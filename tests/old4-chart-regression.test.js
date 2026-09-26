import assert from 'node:assert/strict';
import { cloneDefaultState, simulateKillProbability } from '../kill/engine.js';
import { SKILL_PRESET_BY_ID } from '../kill/presets.js';
import { applyBossPresetToEnemy } from '../kill/boss-presets.js';

const chars = {
  son_goku:{attack:'84',speed:'78',star:'4',attribute:'wind'},
  gyumao:{attack:'94',speed:'15',star:'4',attribute:'fire'},
  kerogon_green:{attack:'31',speed:'52',star:'1',attribute:'wind'},
  raijin_kukulkan:{attack:'78',speed:'89',star:'4',attribute:'wind'},
  camineko:{attack:'42',speed:'68',star:'1',attribute:'wind'},
  ares:{attack:'73',speed:'21',star:'3',attribute:'fire'},
  chibimuus:{attack:'45',speed:'15',star:'2',attribute:'fire'},
  lafroig:{attack:'94',speed:'57',star:'4',attribute:'fire'},
};
function char(id, commandVariant='') { return { characterId:id, ...chars[id], race:'normal', commandVariant }; }
function blankAlly() { return { characterId:'', attack:'0', speed:'1', star:'2', attribute:'earth', race:'normal', commandVariant:'' }; }
function action(id, extra={}) {
  if (id === 'skip') return { kind:'skip', skillName:'', effects:[], ...extra };
  const preset = SKILL_PRESET_BY_ID.get(id);
  assert.ok(preset, `missing skill preset: ${id}`);
  return { ...preset, skillPresetId:id, ...extra };
}
function turn(actions) {
  return { allyActions:actions, enemyAction:{enabled:true,effect:{type:'skip',mode:'mult',value:'0',duration:'1'}} };
}
function state(presetId, allies, turns, finalTurnCutoff='lastAlly') {
  const s = cloneDefaultState();
  s.enemy = applyBossPresetToEnemy(s.enemy, presetId);
  s.allyCount = 3; s.allies = allies; s.turns = turns; s.finalTurnCutoff = finalTurnCutoff;
  return s;
}
function approx(actual, expected, eps=1e-12) { assert.ok(Math.abs(actual-expected)<=eps, `${actual} != ${expected}`); }

// BOSSチビムウスは単体戦。魔王のトリタマゴは撃破後の入手形態で、お供ではない。
const chibimuus = simulateKillProbability(state('old4_chibimuus', [
  char('raijin_kukulkan'), char('camineko'), blankAlly()
], [
  turn([action('peck_many'),action('ice1'),action('skip')]),
  turn([action('peck_many'),action('ice1'),action('skip')]),
  turn([action('peck_many'),action('ice1'),action('skip')])
], 'ally2'));
approx(chibimuus.killChance, 1, 1e-11);
approx(chibimuus.enemyExFailureChance, 0);
assert.deepEqual(chibimuus.scenarioCountByTurn, [12,27,27]);

const salamander = simulateKillProbability(state('old4_salamander', [
  char('son_goku','stop1'), char('gyumao','stop3'), char('kerogon_green')
], [
  turn([action('spirit_blessing'),action('oni_spirit'),action('dragon_tail')]),
  turn([action('loki_brand'),action('tatsumaki'),action('dragon_tail')]),
  turn([action('peck_many'),action('skip'),action('dragon_tail')])
], 'ally3'));
approx(salamander.killChance, 0.9659788481821058);
approx(salamander.enemyExFailureChance, 0);
assert.deepEqual(salamander.scenarioCountByTurn, [96,222,74]);

// Wikiで①より速いとされる②: EX+8 → 鬼の気合入れ → 下位EX。
const lafroig = simulateKillProbability(state('old4_lafroig', [
  char('son_goku','stop1'), char('ares'), char('chibimuus')
], [
  turn([action('ex_plus_8'),action('attack_bang'),action('attack_bang')]),
  turn([action('oni_spirit'),action('attack_bang'),action('attack_bang')]),
  turn([action('goku_lower_ex'),action('attack_bang'),action('attack_bang')])
]));
approx(lafroig.killChance, 0.8628614175860084);
approx(lafroig.enemyExFailureChance, 0.1371385824139093);
assert.deepEqual(lafroig.scenarioCountByTurn, [26,90,0]);

// チヴィエール: 混乱時はWikiの別行動へ切り替える。
const chiviere = simulateKillProbability(state('old4_chiviere', [
  char('son_goku','stop2'), char('gyumao','stop1'), char('lafroig')
], [
  turn([
    action('oni_spirit'),
    action('self_destruct',{confusionSkillPresetId:'sea_king_gaze'}),
    action('attack_bang')
  ]),
  turn([
    action('ninja_fire',{confusionSkillPresetId:'suck_dry'}),
    action('ninja_fire'),
    action('attack_bang')
  ])
]));
approx(chiviere.killChance, 0.9514046599505038);
approx(chiviere.enemyExFailureChance, 0);
assert.deepEqual(chiviere.scenarioCountByTurn, [86,63]);

console.log('old4-chart-regression.test.js: OK');
