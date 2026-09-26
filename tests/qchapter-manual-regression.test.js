import assert from 'node:assert/strict';
import { cloneDefaultState, simulateKillProbabilityEnemyManual } from '../kill/engine.js';
import { SKILL_PRESET_BY_ID } from '../kill/presets.js';
import { applyBossPresetToEnemy } from '../kill/boss-presets.js';

const chars = {
  son_goku:{attack:'84',speed:'78',star:'4',attribute:'wind'}, gyumao:{attack:'94',speed:'15',star:'4',attribute:'fire'},
  red_empress:{attack:'63',speed:'84',star:'4',attribute:'water'}, raijin_kukulkan:{attack:'78',speed:'89',star:'4',attribute:'wind'},
  kenran_kukulkan:{attack:'78',speed:'89',star:'4',attribute:'wind'}, shinjuryu_kukulkan:{attack:'78',speed:'84',star:'4',attribute:'wind'},
  ifrit:{attack:'84',speed:'42',star:'4',attribute:'fire'}, great_mimitoshishi:{attack:'90',speed:'70',star:'4',attribute:'fire'},
  oniwaka_monk:{attack:'63',speed:'47',star:'3',attribute:'wind'}, astaroth:{attack:'68',speed:'31',star:'4',attribute:'fire'},
  great_cliff:{attack:'60',speed:'60',star:'3',attribute:'wind'}, dark_bahamut:{attack:'89',speed:'73',star:'4',attribute:'earth'},
  venom_behemoth:{attack:'73',speed:'15',star:'4',attribute:'earth'}, heavy_behemoth:{attack:'63',speed:'10',star:'4',attribute:'earth'},
  loki:{attack:'63',speed:'68',star:'4',attribute:'earth'}, dartan:{attack:'78',speed:'36',star:'4',attribute:'earth'},
  guardian_powan:{attack:'73',speed:'73',star:'4',attribute:'water'}, djinn:{attack:'63',speed:'84',star:'4',attribute:'wind'},
  gate_dante:{attack:'78',speed:'36',star:'4',attribute:'fire'}, yamato:{attack:'78',speed:'78',star:'4',attribute:'fire'},
  hien:{attack:'63',speed:'77',star:'3',attribute:'wind'}, nanawarai:{attack:'84',speed:'63',star:'4',attribute:'wind'},
  platinum_drake:{attack:'78',speed:'78',star:'4',attribute:'earth'}, soccerra:{attack:'92',speed:'26',star:'4',attribute:'earth'},
  fire_drake:{attack:'84',speed:'47',star:'4',attribute:'fire'}, magora:{attack:'36',speed:'57',star:'1',attribute:'wind'},
};
function char(id, variant=''){ return { characterId:id, ...chars[id], race:'normal', commandVariant:variant }; }
function action(id, extra={}) { if (id==='skip') return {kind:'skip',skillName:'',effects:[],...extra}; const p=SKILL_PRESET_BY_ID.get(id); assert.ok(p,`missing skill ${id}`); return {...p,skillPresetId:id,...extra}; }
function turn(specs){ return { allyActions:specs.map(x=>Array.isArray(x)?action(x[0],x[1]??{}):action(x)), enemyAction:{enabled:true,effect:{type:'none'}} }; }
function state(pid, allies, turns, allowance=0, cutoff='lastAlly'){ const s=cloneDefaultState(); s.enemy=applyBossPresetToEnemy(s.enemy,pid); s.enemy.enemyExAllowance=String(allowance); s.allyCount=allies.length; s.allies=allies; s.turns=turns; s.finalTurnCutoff=cutoff; return s; }
const qr=(target)=>['queen_reward',{presetTarget:target}];

export function buildQChapterStates(){
  const K=()=>char('shinjuryu_kukulkan');
  return {
    emerald: state('q_emerald_dragon',[char('son_goku','stop1'),char('gyumao','stop2'),char('red_empress')],[
      turn(['kerakuzu','loki_brand',qr('ally1')]), turn(['oni_spirit','rock_throw',qr('ally1')]), turn(['crush','crush',qr('ally1')])]),
    daidara: state('q_daidarabocchi',[char('son_goku','stop1'),char('gyumao','stop1'),char('red_empress')],[
      turn(['spirit_blessing','kerakuzu',qr('ally2')]), turn(['sun_hymn','oni_spirit',qr('ally1')]), turn(['loki_brand','roaring_lightning',qr('ally2')]), turn(['blue_point_2','skip','skip'])],0,'ally1'),
    kerogonGold: state('q_kerogon_gold',[char('raijin_kukulkan'),char('kenran_kukulkan'),char('shinjuryu_kukulkan')],[turn(['peck_many','peck_many','peck_many'])]),
    nataraja: state('q_nataraja',[char('son_goku','stop1'),K(),K()],[turn(['loki_brand','peck_many','peck_many']),turn(['peck_many','peck_many','peck_many'])]),
    zarigarion: state('q_zarigarion',[char('son_goku','stop2'),char('gyumao','stop2'),char('ifrit')],[turn(['loki_brand','oni_spirit','fire2']),turn(['oni_spirit','fire_torture','fire2']),turn(['ninja_fire','skip','fire2'])]),
    ghostJeanne: state('q_ghost_jeanne',[char('son_goku','stop2'),char('great_mimitoshishi'),char('ifrit')],[turn(['loki_brand','fire2','fire2']),turn(['ninja_fire','fire2','fire2'])]),
    dartan: state('q_dartan',[char('son_goku','stop1'),char('gyumao','stop2'),char('oniwaka_monk')],[turn(['loki_brand','oni_spirit','foot_sweep']),turn(['bubble_grand','ninja_water','foot_sweep'])]),
    enki: state('q_enki',[char('son_goku','stop2'),char('gyumao','stop1'),char('astaroth')],[turn(['loki_brand','oni_spirit','meteor']),turn(['rock_throw','crush','meteor'])]),
    kenran: state('q_kenran_kukulkan',[char('son_goku','stop1'),char('gyumao','stop3'),char('great_cliff')],[turn(['loki_brand','oni_spirit','spirit_blessing']),turn(['crush','crush','spirit_blessing'])]),
    iceDante: state('q_ice_dante',[char('son_goku','stop1'),char('gyumao','stop2'),char('ifrit')],[turn(['loki_brand','oni_spirit','fire2']),turn(['self_destruct','ninja_fire','fire2'])]),
    blazingAres: state('q_blazing_ares',[char('son_goku','stop1'),char('gyumao','forward4'),char('red_empress')],[turn(['sun_hymn','sea_king_gaze',qr('ally1')]),turn(['loki_brand','name_announcement',qr('ally1')]),turn(['green_point_2','oni_spirit',qr('ally1')]),turn(['ninja_wind','tatsumaki',qr('ally1')])]),
    greatAzul: state('q_great_azul',[char('son_goku','stop2'),char('gyumao','stop1'),char('ifrit')],[turn(['loki_brand','oni_spirit','fire2']),turn(['oni_spirit','self_destruct','fire2']),turn(['ninja_fire','skip','fire2'])]),
    greatSoccerra: state('q_great_soccerra',[char('son_goku','stop1'),char('gyumao','stop2'),char('dark_bahamut')],[turn(['loki_brand','sea_king_gaze','blue_aqua_breath']),turn(['bubble_grand','oni_spirit','blue_aqua_breath']),turn(['self_destruct','ninja_water','blue_aqua_breath'])]),
    greatNanawarai: state('q_great_nanawarai',[char('son_goku','stop1'),char('heavy_behemoth'),char('venom_behemoth')],[turn(['loki_brand','crush','crush']),turn(['self_destruct','crush','crush'])]),
    greatMuus: state('q_great_muus',[char('son_goku','stop1'),char('gyumao','stop2'),K()],[turn(['loki_brand','oni_spirit','peck_many']),turn(['self_destruct','ninja_wind','peck_many'])]),
    lucifer: state('q_lucifer',[char('son_goku','stop3'),char('gyumao','stop2'),char('red_empress')],[turn(['sun_hymn','loki_brand',qr('ally1')]),turn(['kerakuzu','fire2',qr('ally1')]),turn(['red_point_2','ninja_fire',qr('ally1')])]),
    michael: state('q_michael',[char('son_goku','stop1'),char('gyumao','stop1'),char('red_empress')],[turn(['kerakuzu','loki_brand',qr('ally1')]),turn(['oni_spirit','ninja_wind',qr('ally2')]),turn(['green_point_2','tatsumaki',qr('ally2')]),turn(['skip','peck_many','skip'])]),
    greatLafroig: state('q_great_lafroig',[char('son_goku','stop1'),char('gyumao','stop1'),char('red_empress')],[turn(['sun_hymn','loki_brand',qr('ally1')]),turn(['ice3_hidden','wind3_hidden',qr('ally2')]),turn(['green_point_2','fire_ice_breath2',qr('ally2')])]),
    greatKujeska: state('q_great_kujeska',[char('son_goku','stop2'),char('gyumao','stop3'),char('dartan')],[turn(['sun_blessing','loki_brand','rengeki']),turn(['oni_spirit','oni_spirit','rengeki']),turn(['ninja_fire','red_point_2','rengeki'])]),
    greatTokai: state('q_great_tokai',[char('son_goku','stop3'),char('gyumao','stop2'),char('guardian_powan')],[turn(['sun_blessing','loki_brand','bubble_grand']),turn(['oni_spirit','oni_spirit','bubble_grand']),turn(['aqua3','ninja_water','bubble_grand'])]),
    lokesha: state('q_lokesha',[char('son_goku','stop2'),char('gyumao','stop3'),char('djinn')],[turn(['loki_brand','oni_spirit','wind2']),turn(['oni_spirit','ninja_wind','wind2']),turn(['green_point_2','skip','wind2'])]),
    blackRed: state('q_black_red_dragon',[char('gate_dante','attack1'),K(),K()],[turn(['attack_bang','peck_many','peck_many']),turn(['attack_bang','peck_many','peck_many'])]),
    cursedYamata: state('q_cursed_yamata',[char('yamato','attack1'),K(),K()],[turn(['attack_bang','peck_many','peck_many']),turn(['attack_bang','peck_many','peck_many'])]),
    yinlong: state('q_yinlong',[char('son_goku','stop1'),char('gyumao','stop2'),char('hien')],[turn(['loki_brand','oni_spirit','skip']),turn(['self_destruct','ninja_fire','skip'])]),
    darkBahamut: state('q_dark_bahamut',[char('son_goku','stop2'),char('loki'),char('nanawarai','attack1')],[turn(['oni_spirit','loki_brand','attack_bang']),turn(['ninja_water','loki_brand','attack_bang'])]),
    shiningFireDrake: state('q_shining_fire_drake',[char('son_goku','stop1'),char('gyumao','stop1'),K()],[turn(['loki_brand','oni_spirit','peck_many']),turn(['ice_storm_strike','peck_many','peck_many'])]),
    dockLow: state('q_dock_low',[char('son_goku','stop3'),char('gyumao','stop2'),char('platinum_drake')],[turn(['loki_brand','oni_spirit','dragon_tail']),turn(['oni_spirit','ninja_fire','dragon_tail']),turn(['fire3','skip','dragon_tail'])]),
    darkPriestess: state('q_dark_priestess',[char('son_goku','stop2'),char('gyumao','stop1'),char('soccerra','deadly3')],[turn(['sun_blessing','oni_spirit','deadly_blow']),turn(['loki_brand','crush','deadly_blow']),turn(['rock_throw','skip','deadly_blow'])]),
    blackDrake: state('q_black_drake',[char('son_goku','stop2'),char('gyumao','stop2'),char('fire_drake','attack1')],[turn(['spirit_blessing','sea_king_gaze','attack_bang']),turn(['loki_brand','oni_spirit','attack_bang']),turn(['oni_spirit','ninja_water','attack_bang']),turn(['wet_slicer','skip','attack_bang'])]),
    fireDrake: state('q_fire_drake',[char('son_goku','stop1'),char('dartan'),char('loki')],[turn(['oni_spirit','rengeki','loki_brand']),turn(['peck_many','rengeki','loki_brand'])]),
    iceValkyrie: state('q_ice_valkyrie',[char('son_goku','stop1'),char('gyumao','stop1'),char('loki')],[turn(['oni_spirit','fire2','loki_brand']),turn(['rengeki','fire2','loki_brand'])]),
    meatMania: state('q_meat_mania',[char('son_goku','stop1'),char('loki'),char('magora')],[turn(['oni_spirit','loki_brand','shout']),turn(['crush','loki_brand','shout'])]),
    platinumDrake: state('q_platinum_drake',[char('son_goku','stop1'),char('gyumao','stop2'),char('guardian_powan')],[turn(['loki_brand','oni_spirit','bubble_grand']),turn(['spirit_blessing','ninja_water','bubble_grand']),turn(['self_destruct','skip','bubble_grand'])]),
  };
}

const EXPECTED = {
  emerald:[0.9953703703703752,0], daidara:[0.9999999999999964,0], kerogonGold:[0.9999999999999998,0],
  nataraja:[1,0], zarigarion:[0.9892261088248864,0], ghostJeanne:[0.967184542023872,0],
  dartan:[0.9953696010023854,0], enki:[0.9815138119964966,0], kenran:[1,0],
  iceDante:[0.9953703703703739,0], blazingAres:[0.9975473297569217,0], greatAzul:[0.9938271604938406,0],
  greatSoccerra:[0.9419808594767639,0], greatNanawarai:[0.18756691305101833,0.6221527777777767],
  greatMuus:[0.9126017491671059,0], lucifer:[0.99922839506173,0],
  michael:[0.758953927052624,0.24104607294737734], greatLafroig:[0.9778867467559058,0],
  greatKujeska:[0.9681379553421754,0], greatTokai:[0.9779903795260931,0],
  lokesha:[0.7476001454547362,0.1451080881523948], blackRed:[0.9999999999999987,0],
  cursedYamata:[0.9999999999999989,0], yinlong:[0.9953703703703619,0], darkBahamut:[0.9814814814814845,0],
  shiningFireDrake:[0.9986929141288879,0], dockLow:[0.9942882840295476,0], darkPriestess:[0.9999999999999888,0],
  blackDrake:[0.9972081887290076,0.002790223606502227], fireDrake:[1,0],
  iceValkyrie:[0.9999999999999982,0], meatMania:[0.9999999999999991,0], platinumDrake:[0.9953703703703775,0],
};
function close(actual, expected, label, eps=1e-12) {
  assert.ok(Math.abs(actual-expected) <= eps, `${label}: expected ${expected}, got ${actual}`);
}

const states=buildQChapterStates();
const out={};
for (const [name,s] of Object.entries(states)) {
  const r=simulateKillProbabilityEnemyManual(s);
  assert.equal(r.missingCompanionCommandProfiles.length,0,`${name}: missing companion profile`);
  assert.equal(r.missingCommandProfiles.length,0,`${name}: missing command profile`);
  assert.equal(r.missingCommandEffects.length,0,`${name}: missing command effect`);
  assert.ok(r.enemySkillActivation.every(x=>Object.keys(x).length===0),`${name}: enemy auto action leaked`);
  assert.ok(EXPECTED[name],`${name}: missing numeric baseline`);
  close(r.killChance, EXPECTED[name][0], `${name}: killChance`);
  close(r.enemyExFailureChance, EXPECTED[name][1], `${name}: enemyExFailureChance`);
  close(r.unresolvedProbabilityMass ?? 0, 0, `${name}: unresolvedProbabilityMass`);
  out[name]={killChance:r.killChance,enemyExFailureChance:r.enemyExFailureChance,unresolved:r.unresolvedProbabilityMass};
}
assert.equal(Object.keys(EXPECTED).length,33,'?章 baseline count');

// Low-rate cases: separate enemy-EX failures from command/damage randomness.
for (const [name, expectedKill] of [['michael',1],['greatNanawarai',0.6759168037874529],['lokesha',0.7476001454547362]]) {
  const s=structuredClone(states[name]);
  s.enemy.enemyExAllowance='1';
  const r=simulateKillProbabilityEnemyManual(s);
  close(r.killChance,expectedKill,`${name}: allowance1 killChance`);
  close(r.enemyExFailureChance,0,`${name}: allowance1 enemyExFailureChance`);
}

console.log(JSON.stringify(out,null,2));
console.log('qchapter-manual-regression.test.js: OK');
