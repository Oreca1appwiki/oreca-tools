import { cloneDefaultState, simulateKillProbabilityEnemyManual } from '../kill/engine.js';
import { SKILL_PRESET_BY_ID } from '../kill/presets.js';
function a(id,e={}){const p=SKILL_PRESET_BY_ID.get(id);return {...p,skillPresetId:id,...e}}
function sk(){return {kind:'skip',skillName:'',effects:[]}}
const s=cloneDefaultState();s.enemy={...s.enemy,presetId:'',maxHp:'900',attribute:'wind',race:'normal',attack:'0',speed:'75',enemyExAllowance:'0'};s.allyCount=3;s.allies=[
{characterId:'red_magician',attack:'73',speed:'68',star:'3',attribute:'fire',race:'normal',commandVariant:''},
{characterId:'magician',attack:'63',speed:'57',star:'2',attribute:'fire',race:'normal',commandVariant:''},
{characterId:'',attack:'0',speed:'94',star:'1',attribute:'earth',race:'normal',commandVariant:''}
];
const turn=()=>({allyActions:[a('lava_boost',{enemyTargetSlot:'0'}),a('lava_boost',{enemyTargetSlot:'0'}),sk()],enemyAction:{enabled:true,effect:{type:'none'}}});s.turns=[turn(),turn()];s.finalTurnCutoff='lastAlly';
const r=simulateKillProbabilityEnemyManual(s);console.log('kill',r.killChance,'ex',r.enemyExFailureChance,'hp size',r.hpDistribution.size,'mass', [...r.hpDistribution.values()].reduce((a,b)=>a+b,0));console.log([...r.hpDistribution.entries()].sort((a,b)=>a[0]-b[0]).slice(0,30));console.log(r.timeline);console.log(JSON.stringify(r.allySkillActivation,null,2));
