const assert=require('node:assert/strict');
global.window=global;
require('../assets/pp5-entry.js');
const read=values=>(_sheet,ref)=>Object.hasOwn(values,ref)?values[ref]:'';
const totalScore=window.PP5Entry.totalScore;

assert.equal(totalScore(read({E4:10,F4:20,G4:5,H4:15,I4:10,J4:40}),4),100,'the recovery score must be included with the other score categories');
assert.equal(totalScore(read({E5:12,F5:18,G5:'',H5:20,I5:10,J5:30}),5),90,'an empty recovery score adds zero');
console.log(JSON.stringify({passed:2,recoveryScoreIncluded:true}));
