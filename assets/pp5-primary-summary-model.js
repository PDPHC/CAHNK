(()=>{'use strict';
 function build(courses,records,ratio,students){
  const errors={},weights=courses.map(c=>c.weight===null||c.weight===undefined||String(c.weight).trim()===''?NaN:Number(c.weight)),validWeights=weights.every(n=>Number.isFinite(n)&&n>=0),totalWeight=weights.reduce((a,b)=>a+b,0),byCode=new Map(records.map(r=>[r.course_code,r.data]));
  for(const c of courses){const data=byCode.get(c.code);if(!data)continue;try{if(!Array.isArray(data.maxima)||data.maxima.length!==2)throw Error('คะแนนเต็มไม่ครบสองภาคเรียน');PrimaryScoreModel.validate(data,ratio);}catch(error){errors[c.code]=error.message;}}
  const rows=students.map(student=>{const grades=courses.map(c=>{const data=byCode.get(c.code),record=data?.scores?.[student.id];if(!record||errors[c.code])return null;try{return PrimaryScoreModel.result(record,data.maxima,ratio).grade}catch{return null;}}),missing=courses.filter((_,i)=>grades[i]===null).map(c=>c.code+' '+c.name),complete=courses.length>0&&missing.length===0,gpa=complete&&validWeights&&totalWeight>0?grades.reduce((sum,g,i)=>sum+g*weights[i],0)/totalWeight:null;return{student,grades,missing,complete,gpa:gpa===null?null:gpa.toFixed(2)};});
  return{rows,errors,validWeights,totalWeight};
 }
 window.PrimarySummaryModel={build};
})();
