const assert=require('node:assert/strict');
const {Calculator,gradeFromScore}=require('../assets/pp5-calc.js');
const template={IN:{C4:{v:'S1'},K4:{v:''},L4:{v:0},M4:{v:99}},F:{CT7:{v:99}}};
const cases=[[49,0],[50,1],[54,1],[55,1.5],[59,1.5],[60,2],[64,2],[65,2.5],[69,2.5],[70,3],[74,3],[75,3.5],[79,3.5],[80,4],[100,4]];
let passed=0;
for(const [score,expected] of cases){
 assert.equal(gradeFromScore(score),expected,`gradeFromScore(${score})`);
 const calc=new Calculator(template,{'IN!K4':0,'IN!L4':score});
 assert.equal(calc.get('IN','M4'),expected,`IN!M4 for score ${score}`);
 assert.equal(calc.get('F','CT7'),expected,`printed F!CT7 for score ${score}`);passed+=3;
}
for(const special of ['ร','มส','มส.','-']){
 const calc=new Calculator(template,{'IN!K4':special,'IN!L4':80});
 assert.equal(calc.get('IN','M4'),special);assert.equal(calc.get('F','CT7'),special);passed+=2;
}
console.log(JSON.stringify({passed,gradeBoundaries:cases.length,specialStatuses:4}));
