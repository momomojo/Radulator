import assert from 'node:assert/strict';
import test from 'node:test';
import { WellsDVT } from '../src/components/calculators/WellsDVT.jsx';

const positive=['active_cancer','paralysis_paresis','bedridden_surgery','tenderness_deep_veins','leg_swelling','calf_swelling','pitting_edema','collateral_veins','previous_dvt'];
const all=[...positive,'alternative_diagnosis'];
const expectedItems={
 active_cancer:'Active cancer: +1',
 paralysis_paresis:'Paralysis/paresis/immobilization: +1',
 bedridden_surgery:'Bedridden at least 3 days or major surgery within 12 weeks requiring general or regional anesthesia: +1',
 tenderness_deep_veins:'Tenderness along deep veins: +1',
 leg_swelling:'Entire leg swollen: +1',
 calf_swelling:'Calf swelling at least 3 cm compared with the asymptomatic leg, measured 10 cm below the tibial tuberosity: +1',
 pitting_edema:'Pitting edema: +1',
 collateral_veins:'Collateral superficial veins: +1',
 previous_dvt:'Previously documented DVT: +1',
 alternative_diagnosis:'Alternative diagnosis as likely: -2',
};
const bands={ '-2':['DVT Unlikely','Low'], '-1':['DVT Unlikely','Low'], 0:['DVT Unlikely','Low'],1:['DVT Unlikely','Moderate'],2:['DVT Likely','Moderate'],3:['DVT Likely','High'],4:['DVT Likely','High'],5:['DVT Likely','High'],6:['DVT Likely','High'],7:['DVT Likely','High'],8:['DVT Likely','High'],9:['DVT Likely','High']};

test('all1024 clinical selections preserve independent weights and category boundaries',()=>{
 for(let mask=0;mask<1024;mask++){
  const input=Object.fromEntries(all.map((key,i)=>[key,Boolean(mask&(1<<i))]));
  const score=positive.reduce((sum,key)=>sum+Number(input[key]),0)-(input.alternative_diagnosis?2:0);
  const result=WellsDVT.compute(input);
  assert.equal(result['Wells Score'],`${score} points`);
  assert.equal(result['2-Tier Assessment (NICE NG158)'],bands[score][0]);
  assert.match(result['3-Tier Assessment'],new RegExp('^'+bands[score][1]));
  const expected=all.filter(k=>input[k]).map(k=>expectedItems[k]);
  if(expected.length)assert.deepEqual(result['Score Breakdown'].split('; '),expected);
  else assert.match(result['Score Breakdown'],/confirm every item was assessed/);
 }
});
test('every supplied clinical flag must be boolean, never truthy coercion',()=>{
 for(const key of all)for(const value of ['false','true',0,1,null,[],{},'']){
  const result=WellsDVT.compute({[key]:value});
  assert.equal(typeof result.Error,'string',key+' '+JSON.stringify(value));
  assert.deepEqual(Object.keys(result),['Error']);
 }
 assert.equal(WellsDVT.compute({})['Wells Score'],'0 points');
});
test('NICE equality definitions reach both input and selected-item report',()=>{
 const label=id=>WellsDVT.fields.find(f=>f.id===id).label;
 assert.match(label('bedridden_surgery'),/at least 3 days/);
 assert.match(label('bedridden_surgery'),/12 weeks/);
 assert.match(label('calf_swelling'),/at least 3 cm/);
 for(const key of ['bedridden_surgery','calf_swelling']){
  const r=WellsDVT.compute({[key]:true,previous_dvt:true});
  assert.equal(r['Wells Score'],'2 points');assert.equal(r['2-Tier Assessment (NICE NG158)'],'DVT Likely');
  assert.match(r['Score Breakdown'],/at least 3/);
 }
});
test('likely pathway conditions repeat imaging on scan extent and D-dimer',()=>{
 const r=WellsDVT.compute({calf_swelling:true,previous_dvt:true});
 assert.match(r.Recommendation,/NICE NG158/);
 assert.match(r.Recommendation,/proximal.*ultrasound/);
 assert.match(r.Recommendation,/negative proximal.*positive D-dimer.*6.?8 days/);
 assert.doesNotMatch(r.Recommendation,/or whole-leg|repeat US in 1 week/);
 assert.match(r['ASH reference context'],/whole-leg.*proximal/);
});
test('unlikely and negative scores are not diagnoses or treatment clearance',()=>{
 for(const input of [{},{alternative_diagnosis:true},{previous_dvt:true}]){
  const r=WellsDVT.compute(input);const text=JSON.stringify(r);
  assert.match(r.Recommendation,/D-dimer/);
  assert.doesNotMatch(text,/DVT (?:is )?(?:effectively )?excluded|NPV >99|very low probability|empiric anticoagulation|extended duration anticoagulation/);
  assert.match(r['Decision boundary'],/does not diagnose or exclude DVT/);
  assert.equal(r._severity,'info');
 }
});
test('historical rates are labeled as cohort context rather than individual calibration',()=>{
 const r=WellsDVT.compute({});
 assert.match(r['Historical cohort context'],/6%.*28%.*5%.*17%.*53%/);
 assert.match(r['Historical cohort context'],/not.*individual/);
 assert.doesNotMatch(r['2-Tier Assessment (NICE NG158)'],/%/);
 assert.doesNotMatch(r['3-Tier Assessment'],/%/);
});
test('special-population and recurrence context never automatically prescribes therapy',()=>{
 const r=WellsDVT.compute(Object.fromEntries(positive.map(k=>[k,true])));
 assert.match(r['Clinical scope'],/adult/i);assert.match(r['Clinical scope'],/pregnan/i);
 assert.match(r['Clinical Notes'],/Prior DVT.*previous imaging/);
 assert.doesNotMatch(JSON.stringify(r),/increases specificity|extended duration anticoagulation|empiric anticoagulation/);
 assert.equal(r['Wells Score'],'9 points');
});
test('references support the actual lower-limb score and named pathways',()=>{
 const refs=JSON.stringify(WellsDVT.refs);
 for(const locator of ['ng158','PMC6258916','16403932','PMC3278048'])assert(refs.includes(locator));
 assert(!refs.includes('rccm.201108-1575ST'));
 assert(!refs.includes('Defined guidelines'));
 assert.match(WellsDVT.guidelineVersion,/NICE NG158/);
});
