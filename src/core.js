export const VERSION = 2;
export const uid = () => crypto.randomUUID();
export const clean = (s, max = 8000) => String(s ?? '').replace(/\u0000/g, '').trim().slice(0, max);
export const norm = s => clean(s).toLowerCase().replace(/\s+/g, ' ');
export const clone = x => structuredClone(x);
export const DEFAULT_SETTINGS = {provider: 'offline', model: '', autoAnalyze: true, allowRemote: false};
export function newSession(title = 'Untitled meeting', demo = false) {
  return {id: uid(), title: clean(title, 120) || 'Untitled meeting', demo, createdAt: Date.now(), updatedAt: Date.now(), revision: 0,
    transcript: [], questions: [], baseline: [], refined: [], analysisRevision: -1, analysisProvider: '', analyzedAt: null,
    capture: {active: false, tabId: null, receivedAt: null}, job: null, error: null, history: []};
}
export function appendEntries(s, items, source = 'manual') {
  if (!Array.isArray(items) || items.length > 100) throw Error('Send between 1 and 100 statements at a time.');
  let added = 0;
  for (const item of items) {
    const text = clean(item.text), speaker = clean(item.speaker, 120) || 'Stakeholder';
    if (!text) continue;
    const eventId = clean(item.eventId, 180);
    if (eventId && s.transcript.some(t => t.eventId === eventId)) continue;
    if (source === 'zoom' && s.transcript.slice(-30).some(t => t.source === 'zoom' && norm(t.text) === norm(text) && norm(t.speaker) === norm(speaker) && Date.now() - t.receivedAt < 12000)) continue;
    if (s.transcript.length >= 1500 || s.transcript.reduce((n,t) => n+t.text.length,0)+text.length > 180000) throw Error('Session limit reached. Export this meeting and start another session.');
    s.transcript.push({id: `T${s.transcript.length+1}`, eventId, speaker, text, timestamp: Number(item.timestamp) || Date.now(), receivedAt: Date.now(), source});
    added++;
  }
  if (added) {s.revision++; s.updatedAt = Date.now();}
  return added;
}
export const RULES = [
  {key:'performance',category:'Performance',re:/\b(slow|quick|fast|responsive|real.time|latency|throughput)\b/i, question:'What response-time percentile, maximum latency, workload and batch throughput must the system support?', gap:'Response time, percentile and workload are not fully specified.'},
  {key:'ranking',category:'Functional',re:/\b(relevance|profile strength|good companies|solid projects|impactful|strong fresher|average years)\b/i, question:'Which evidence and scoring weights determine relevance, and how should experience and fresher candidates be treated?',gap:'The scoring rubric and evidence rules are undefined.'},
  {key:'accuracy',category:'Reliability',re:/\b(good enough|trust|accurate|accuracy|reliable|reliability)\b/i,question:'Which accuracy metric, acceptance threshold and representative labelled evaluation dataset will determine acceptance?',gap:'Acceptance threshold and evaluation dataset are missing.'},
  {key:'fairness',category:'Fairness',re:/\b(bias|fairness|fair|gender|college background)\b/i,question:'Which protected attributes, fairness metric, threshold and audit process should be used, and who reviews failures?',gap:'Fairness measures and failure handling are unspecified.'},
  {key:'data',category:'Functional',re:/\b(not.*structured|unstructured|historical|past resumes|past.*decisions)\b/i,question:'What data formats, labelling process, consent requirements and missing-data handling are required before training or evaluation?',gap:'Data preparation and validation rules are missing.'},
  {key:'explainability',category:'Explainability',re:/\b(explain|explainability|ranked higher|useful)\b/i,question:'What explanation must accompany each ranking, for which users, and how will its correctness be checked?',gap:'Explanation content and verification are undefined.'},
  {key:'scope',category:'Scope',re:/\b(soon|mvp|asap|urgent)\b/i,question:'What is the exact delivery date, minimum release scope and explicit out-of-scope list?',gap:'Delivery boundary and scope are unspecified.'},
  {key:'security',category:'Security',re:/\b(secure|security|private|privacy|safe|protect|confidential)\b/i,question:'What access controls, encryption, retention and deletion requirements apply, and how will they be verified?',gap:'Security controls and retention rules need confirmation.'},
  {key:'usability',category:'Usability',re:/\b(easy|simple|intuitive|user.friendly)\b/i,question:'Which user task, success rate, completion time and test population define acceptable usability?',gap:'Usability acceptance criteria are missing.'},
  {key:'scale',category:'Performance',re:/\b(scalable|scale|concurrent|high volume|many users)\b/i,question:'What peak concurrent workload and capacity must be supported while maintaining the agreed latency?',gap:'Capacity and load-test conditions are missing.'}
];
const vague = /\b(quick|fast|slow|soon|good|solid|impactful|enough|easy|simple|reliable|useful|appropriate|relevant|relevance|strong|trust|etc)\b/i;
export const substantive = t => !/\?\s*$/.test(t.text) && !/^(okay|ok|thanks|thank you)[.!]?$/i.test(t.text);
export function offlineAnalysis(transcript) {
  const questions = [];
  for (const rule of RULES) {
    const hits = transcript.filter(t => substantive(t) && rule.re.test(t.text));
    if (!hits.length) continue;
    const combined = hits.map(t=>t.text).join(' ');
    // Concrete performance/security statements are not automatically vague merely for containing a keyword.
    if (['performance','scale'].includes(rule.key) && /\d/.test(combined) && /p9[059]|percentile|concurrent|per minute/i.test(combined) && !vague.test(combined)) continue;
    questions.push({topic:rule.key, category:rule.category, sourceIds:hits.map(t=>t.id), question:rule.question, rationale:rule.gap});
  }
  const baseline = transcript.filter(substantive).map(t => {
    const rules = RULES.filter(r=>r.re.test(t.text));
    const category = rules[0]?.category || 'Functional';
    const gaps=questions.filter(q=>q.sourceIds.includes(t.id)).map(q=>q.rationale);
    const concrete=!vague.test(t.text) && (/\d+\s*(seconds?|ms|minutes?|%|users?|requests?|days?|weeks?)|p9[059]/i.test(t.text) || /\b(shall|must)\b.*\b(return|display|reject|export|validate|store)\b/i.test(t.text));
    const sources = [t.id];
    if (/^yes[, .]/i.test(t.text)) {const prev=transcript[transcript.indexOf(t)-1]; if(prev) sources.unshift(prev.id);}
    return {id:`R-${t.id}`,type:category==='Functional'?'FR':category==='Scope'?'Constraint':'NFR',category,
      title:t.text.slice(0,80),statement:t.text,acceptanceCriteria:concrete?t.text:'',sourceIds:sources,answerIds:[],
      openIssues:gaps.length?gaps:concrete?[]:['Confirm observable acceptance criteria with the stakeholder.']};
  });
  return {questions,requirements:baseline};
}
export function mergeQuestions(s, candidates, provider) {
  for (const c of candidates) {
    let q=s.questions.find(q=>norm(q.topic)===norm(c.topic) || norm(q.question)===norm(c.question));
    if(q) {q.sourceIds=[...new Set([...q.sourceIds,...c.sourceIds])]; continue;}
    s.questions.push({...c,id:uid(),status:'pending',answer:'',answeredBy:'',answerOrigin:'',createdAt:Date.now(),provider});
  }
}
export function offlineRefine(baseline, questions) {
  return baseline.map(r=>{
    const answers=questions.filter(q=>q.status==='answered' && q.answer && q.sourceIds.some(id=>r.sourceIds.includes(id)));
    if(!answers.length) return clone(r);
    const unresolved=questions.filter(q=>q.status!=='answered' && q.sourceIds.some(id=>r.sourceIds.includes(id)));
    return {...clone(r),statement:answers.map(q=>q.answer).join(' '),acceptanceCriteria:answers.map(q=>q.answer).join(' '),answerIds:answers.map(q=>q.id),
      openIssues:[...unresolved.map(q=>q.rationale),...answers.filter(q=>q.answer.length<30 || !/\b(shall|must|will|return|display|reject|accept|verify|within|at least|no more)\b|\d/i.test(q.answer)).map(()=> 'Recorded answer still needs an observable requirement or acceptance criterion.')]};
  });
}
export function answerQuestion(s, id, answer, answeredBy, origin='stakeholder') {
  const q=s.questions.find(q=>q.id===id);
  if(!q) throw Error('Question no longer exists. Refresh and try again.');
  answer=clean(answer); if(answer.length<3) throw Error('Enter a stakeholder response.');
  s.history.push({at:Date.now(),kind:'answer',questionId:id,previousAnswer:q.answer,newAnswer:answer,by:clean(answeredBy,120)||'Analyst',origin});
  Object.assign(q,{answer,answeredBy:clean(answeredBy,120)||'Analyst',status:'answered',answerOrigin:origin,answeredAt:Date.now()});
  s.revision++;s.updatedAt=Date.now();
}
export function scoreRequirement(r, transcriptIds, answerIds) {
  const text=`${r.statement} ${r.acceptanceCriteria}`;
  const unresolved=r.openIssues.length>0;
  const checks={
    clarity: !vague.test(text) && !/\b(TBD|unknown|unspecified)\b/i.test(text) && !unresolved,
    completeness: !!r.statement.trim() && !!r.acceptanceCriteria.trim() && !unresolved,
    verifiability: !!r.acceptanceCriteria.trim() && (r.type==='FR' ? /\b(return|display|show|reject|accept|create|export|store|rank|validate|must|shall)\b/i.test(r.acceptanceCriteria) : /\d/.test(r.acceptanceCriteria)) && !/\b(TBD|unknown)\b/i.test(r.acceptanceCriteria),
    traceability: r.sourceIds.length>0 && r.sourceIds.every(id=>transcriptIds.has(id)) && r.answerIds.every(id=>answerIds.has(id))
  };
  return {checks,score:Math.round(Object.values(checks).filter(Boolean).length/4*100)};
}
export function evaluate(requirements, transcript, questions=[]) {
  if(!requirements.length) return {overall:null,clarity:null,completeness:null,verifiability:null,traceability:null,items:[]};
  const t=new Set(transcript.map(x=>x.id)),q=new Set(questions.filter(x=>x.status==='answered').map(x=>x.id));
  const items=requirements.map(r=>({id:r.id,...scoreRequirement(r,t,q)}));
  const result={items};
  for(const k of ['clarity','completeness','verifiability','traceability']) result[k]=Math.round(items.filter(x=>x.checks[k]).length/items.length*100);
  result.overall=Math.round(items.reduce((n,x)=>n+x.score,0)/items.length);
  return result;
}
export function comparison(s) {
  const before=evaluate(s.baseline,s.transcript),after=evaluate(s.refined,s.transcript,s.questions);
  return {before,after,delta:before.overall===null||after.overall===null?null:after.overall-before.overall};
}
export function parseTranscript(text) {
  text=String(text).replace(/^\uFEFF/,'').replace(/\r/g,'');
  let speaker='Stakeholder';const items=[];
  for(let line of text.split('\n')) {
    line=line.trim();
    if(!line || /^WEBVTT|^NOTE\b|^\d+$|-->/.test(line)) continue;
    line=line.replace(/<[^>]*>/g,'').replace(/^\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*/,'');
    const m=line.match(/^([^:]{1,80}):\s*(.*)$/);
    if(m){speaker=m[1].trim();line=m[2].trim();}
    if(line) items.push({speaker,text:line});
  }
  return items;
}
export function validateAnalysis(value, transcript, questions=[], refined=false) {
  if(!value || !Array.isArray(value.requirements) || value.requirements.length>120 || !Array.isArray(value.questions) || value.questions.length>80) throw Error('Provider returned an invalid analysis structure.');
  const ids=new Set(transcript.map(t=>t.id)),answers=new Set(questions.filter(q=>q.status==='answered').map(q=>q.id));
  const string=(v,label)=>{if(typeof v!=='string'||v.length>12000)throw Error(`Invalid ${label} in provider response.`);return v;};
  const refs=(xs,allowed)=>{if(!Array.isArray(xs)||xs.length>100||xs.some(x=>typeof x!=='string'||!allowed.has(x)))throw Error('Provider cited an unknown source.');return xs;};
  const out={questions:value.questions.map(q=>({topic:string(q.topic,'topic'),category:string(q.category,'category'),question:string(q.question,'question'),rationale:string(q.rationale,'rationale'),sourceIds:refs(q.sourceIds,ids)})),requirements:[]};
  const seen=new Set();
  for(const r of value.requirements){
    if(!['FR','NFR','Constraint'].includes(r.type))throw Error('Invalid requirement type.');
    if(!r.id||seen.has(r.id))throw Error('Requirement IDs must be unique.');seen.add(r.id);
    const row={};for(const k of ['id','type','category','title','statement','acceptanceCriteria'])row[k]=string(r[k],k);
    row.sourceIds=refs(r.sourceIds,ids);row.answerIds=refs(r.answerIds,answers);
    if(!row.sourceIds.length)throw Error('Every requirement must cite a transcript statement.');
    if(!refined&&row.answerIds.length)throw Error('Baseline cannot use clarification answers.');
    if(!Array.isArray(r.openIssues)||r.openIssues.length>30)throw Error('Invalid open issues.');row.openIssues=r.openIssues.map(x=>string(x,'open issue'));
    out.requirements.push(row);
  }
  return out;
}
