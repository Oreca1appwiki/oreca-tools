import assert from 'node:assert/strict';
import { attackDamageDistribution } from '../kill/engine.js';
const table = {
  none:{fire:1000,water:1000,earth:1000,wind:1000},
  fire:{fire:1000,water:1500,earth:900,wind:800},
  heat:{fire:1000,water:900,earth:900,wind:1400},
  water:{fire:800,water:1000,earth:1500,wind:900},
  ice:{fire:1400,water:1000,earth:900,wind:900},
  earth:{fire:900,water:800,earth:1000,wind:1500},
  poison:{fire:900,water:1400,earth:1000,wind:900},
  wind:{fire:1500,water:900,earth:800,wind:1000},
  thunder:{fire:900,water:900,earth:1400,wind:1000},
  light:{fire:1050,water:1050,earth:1050,wind:1050},
  holy:{fire:1070,water:1070,earth:1070,wind:1070},
  dark:{fire:1050,water:1050,earth:1050,wind:1050},
  evil:{fire:1070,water:1070,earth:1070,wind:1070},
  all:{fire:1100,water:1100,earth:1100,wind:1100},
};
function trunc(n,d){return Math.trunc(n/d)}
for (const atk of [31,57,68,73,84,94,101,125]) {
  for (const skill of ['40','90','100','115','135','150','200','230','258.4']) {
    for (const attr of ['none','fire','water','earth','wind','holy','dark','all']) {
      for (const enemy of ['fire','water','earth','wind']) {
        for (const race of ['normal','undead']) {
          for (const type of ['physical','magic','breath','other']) {
            const dist=attackDamageDistribution({attack:atk,skillMultiplier:skill,attackAttribute:attr,attackAttribute2:'none',attackType:type,defenderAttribute:enemy,defenderRace:race,defenseMods:[],weaknessBoost:false,hits:'1',hitsMin:'',hitsMax:''});
            const skill10=Math.round(Number(skill)*10);
            let base=trunc(atk*skill10,1000);
            base=trunc(base*table[attr][enemy],1000);
            if(race==='undead') base=trunc(base*(type==='physical'?800:type==='magic'?1200:1000),1000);
            const expMin=trunc(base*950,1000), expMax=Math.min(trunc(base*1050,1000),999);
            const keys=[...dist.keys()];
            assert.equal(Math.min(...keys),Math.min(expMin,999));
            assert.equal(Math.max(...keys),expMax);
          }
        }
      }
    }
  }
}
console.log('audit kill core: OK');
