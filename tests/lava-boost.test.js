import assert from 'node:assert/strict';
import { cloneDefaultState, simulateKillProbabilityEnemyManual } from '../kill/engine.js';
import { SKILL_PRESET_BY_ID } from '../kill/presets.js';
import { normalCommandTransitions } from '../kill/commands.js';

function action(id, extra={}) {
  const p = SKILL_PRESET_BY_ID.get(id);
  assert.ok(p, `missing preset: ${id}`);
  return { ...p, skillPresetId:id, ...extra };
}
function skip() { return { kind:'skip', skillName:'', effects:[] }; }
function manualTurn(allyAction) {
  return { allyActions:[allyAction, skip(), skip()], enemyAction:{enabled:true,effect:{type:'none'}} };
}
function approx(a,b,eps=1e-12){assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);}

// 1) ラヴァブーストは発動ターンにダメージを与えない。
{
  const s=cloneDefaultState();
  s.enemy={...s.enemy,presetId:'',maxHp:'100',attribute:'wind',race:'normal',attack:'0',speed:'1',enemyExAllowance:'0'};
  s.allyCount=1;
  s.allies[0]={characterId:'',attack:'73',speed:'68',star:'3',attribute:'fire',race:'normal',commandVariant:''};
  s.turns=[manualTurn(action('lava_boost',{enemyTargetSlot:'0'}))];
  const r=simulateKillProbabilityEnemyManual(s);
  approx(r.killChance,0);
}

// 2) 次の自身の行動機会に500%熱属性単体魔法を自動発動する。
{
  const s=cloneDefaultState();
  s.enemy={...s.enemy,presetId:'',maxHp:'100',attribute:'wind',race:'normal',attack:'0',speed:'1',enemyExAllowance:'0'};
  s.allyCount=1;
  s.allies[0]={characterId:'',attack:'73',speed:'68',star:'3',attribute:'fire',race:'normal',commandVariant:''};
  s.turns=[manualTurn(action('lava_boost',{enemyTargetSlot:'0'})),manualTurn(skip())];
  const r=simulateKillProbabilityEnemyManual(s);
  approx(r.killChance,1);
  assert.ok((r.allySkillActivation?.[1]?.[0]?.['ラヴァブースト（発動）'] ?? 0) > 0.999999999);
}

// 3) Wiki掲載のコマンド型を登録し、停止コマンド確率が各リールで1になる。
{
  for (const id of ['red_magician','magician']) {
    const reelCount=id==='red_magician'?3:2;
    for (let reel=0; reel<reelCount; reel++) {
      const transitions=normalCommandTransitions(id,reel,'');
      approx(transitions.reduce((sum,x)=>sum+x.probability,0),1);
    }
  }
  assert.equal(SKILL_PRESET_BY_ID.get('lava')?.skillMultiplier,'50');
  assert.equal(SKILL_PRESET_BY_ID.get('lava_boost_release')?.skillMultiplier,'500');
}

// 4) 溜め済み／未溜めの確率枝を最適化で誤統合しない。
// レッド・マジシャン＋マジシャンの実コマンド型で、1Tにラヴァブーストを引いた枝だけ
// 2Tの自身の行動機会で自動発動する。低HPの単体BOSSなら撃破率は13/24。
{
  const s=cloneDefaultState();
  s.enemy={...s.enemy,presetId:'',maxHp:'900',attribute:'wind',race:'normal',attack:'0',speed:'1',enemyExAllowance:'0'};
  s.allyCount=3;
  s.allies=[
    {characterId:'red_magician',attack:'73',speed:'68',star:'3',attribute:'fire',race:'normal',commandVariant:''},
    {characterId:'magician',attack:'63',speed:'57',star:'2',attribute:'fire',race:'normal',commandVariant:''},
    {characterId:'',attack:'21',speed:'94',star:'1',attribute:'earth',race:'normal',commandVariant:''}
  ];
  const t={allyActions:[action('lava_boost',{enemyTargetSlot:'0'}),action('lava_boost',{enemyTargetSlot:'0'}),skip()],enemyAction:{enabled:true,effect:{type:'none'}}};
  s.turns=[structuredClone(t),structuredClone(t)];
  const r=simulateKillProbabilityEnemyManual(s);
  approx(r.killChance,13/24,1e-10);
}

console.log('lava-boost.test.js: OK');
