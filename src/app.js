import {parseTranscript,comparison} from './core.js';
import {escapeHTML as h,textReport,docxReport,download} from './reports.js';
const $=id=>document.getElementById(id);let data=null,session=null,view='meeting',mode='refined';const drafts=new Map();
async function send(type,payload={}){const r=await chrome.runtime.sendMessage({type,...payload});if(!r?.ok)throw Error(r?.error||'Extension did not respond. Reload the extension.');return r;}
function notice(text,error=false){$('notice').textContent=text;$('notice').className=error?'error':'';$('notice').hidden=false;}
async function action(type,payload={}){try{const r=await send(type,payload);if(r.state){data=r.state;render();}return r;}catch(e){notice(e.message,true);return null;}}
function empty(title,text){return `<div class="empty"><strong>${h(title)}</strong>${h(text)}</div>`;}
function setView(next){view=next;document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!==`view-${next}`);document.querySelectorAll('.nav').forEach(el=>el.classList.toggle('active',el.dataset.view===next));renderContent();window.scrollTo({top:0,behavior:'instant'});}
function sourceDetails(ids){return `<details><summary>View source statements · ${h(ids.join(', '))}</summary>${ids.map(id=>{const t=session.transcript.find(t=>t.id===id);return `<p class="source-text">${h(id)} · ${h(t?.speaker)}: ${h(t?.text||'Source unavailable')}</p>`;}).join('')}</details>`;}
function render(){
  session=data.sessions.find(s=>s.id===data.activeId)||data.sessions[0];
  $('session-select').innerHTML=data.sessions.map(s=>`<option value="${h(s.id)}" ${s.id===session.id?'selected':''}>${h(s.title)}</option>`).join('');
  $('session-title').textContent=session.title;$('session-kind').textContent=session.demo?'ASSIGNMENT CASE STUDY · DEMONSTRATION':'MEETING WORKSPACE';
  $('session-meta').textContent=`${new Date(session.createdAt).toLocaleDateString(undefined,{day:'numeric',month:'long',year:'numeric'})} · ${session.transcript.length} statements · ${session.questions.filter(q=>q.status==='answered').length} answers recorded`;
  $('provider-badge').textContent=data.settings.provider==='offline'?'Offline rules':data.settings.provider==='openai'?'OpenAI':'Google Gemini';
  $('count-transcript').textContent=session.transcript.length;$('count-questions').textContent=session.questions.filter(q=>q.status==='pending').length;$('count-requirements').textContent=session.refined.length;
  $('analyze').disabled=!!session.job;$('analyze').textContent=session.job?'Analyzing…':'Analyze meeting ↗';
  $('analysis-status').textContent=session.error?`Analysis needs attention: ${session.error}`:session.job?'Analysis in progress. Your transcript is saved; you can keep adding statements.':session.analysisRevision===session.revision?`Updated ${new Date(session.analyzedAt).toLocaleTimeString()} · ${session.analysisProvider}`:session.transcript.length?'New or changed statements need analysis. Previous results remain visible.':'Ready for your first statement.';
  $('capture-label').textContent=session.capture.active?'Zoom capture is active':'Capture is paused';
  $('capture-detail').textContent=session.capture.active?(session.capture.receivedAt?`Last batch received ${new Date(session.capture.receivedAt).toLocaleTimeString()}`:'Waiting for captions. Enable them in Zoom; reload the Zoom tab if the extension was just installed.'):'Open Zoom in your browser and enable captions.';
  $('capture-toggle').textContent=session.capture.active?'Pause capture':'Start Zoom capture';
  renderContent();
}
function renderContent(){if(!session)return;
  if(view==='meeting'){
    $('stream-total').textContent=`${session.transcript.length} statements`;
    $('transcript').innerHTML=session.transcript.length?session.transcript.slice().reverse().map(t=>`<article class="entry"><span class="entry-id">${h(t.id)}</span><div><div class="speaker">${h(t.speaker)}</div><p>${h(t.text)}</p><div class="meta">${h(t.source)} · ${new Date(t.timestamp).toLocaleTimeString()}</div></div></article>`).join(''):empty('Your meeting starts here.','Add a statement above, import a transcript, or explore the assignment case study.');
  }else if(view==='questions'){
    if(document.activeElement?.closest('#questions'))return;
    $('demo-answer-area').hidden=!session.demo||!session.questions.length;
    $('questions').innerHTML=session.questions.length?session.questions.map(q=>`<article class="question ${h(q.status)}"><div class="row"><span class="badge">${h(q.category)}</span><span class="badge ${q.status==='pending'?'warn':''}">${h(q.status)}</span>${q.answerOrigin==='simulated'?'<span class="badge warn">Simulated answer</span>':''}</div><h3>${h(q.question)}</h3><p>${h(q.rationale)}</p>${sourceDetails(q.sourceIds)}<form data-question="${h(q.id)}"><label for="answer-${h(q.id)}">Stakeholder response</label><textarea id="answer-${h(q.id)}" name="answer" rows="3" maxlength="8000" placeholder="Record the stakeholder’s actual answer" required>${h(drafts.get(q.id)?.answer??q.answer)}</textarea><div class="row"><input name="answeredBy" aria-label="Answer recorded by" placeholder="Recorded by (name / role)" maxlength="120" value="${h(drafts.get(q.id)?.answeredBy??q.answeredBy)}"><button class="primary" type="submit">${q.status==='answered'?'Update answer':'Save answer'}</button><button type="button" class="quiet" data-dismiss="${h(q.id)}">${q.status==='dismissed'?'Reopen':'Dismiss'}</button></div></form></article>`).join(''):empty('No clarification questions yet.','Analyze your meeting to identify missing details and ambiguous statements.');
  }else if(view==='requirements'){
    const filter=$('requirement-filter').value,reqs=session[mode].filter(r=>filter==='all'||r.type===filter);
    $('requirements').innerHTML=reqs.length?reqs.map(r=>`<article class="requirement"><div class="row"><span class="badge">${h(r.id)}</span><span class="badge">${h(r.type)} · ${h(r.category)}</span>${r.openIssues.length?'<span class="badge warn">Needs clarification</span>':'<span class="badge">Draft · review required</span>'}</div><h3>${h(r.title)}</h3><p class="statement">${h(r.statement)}</p><div class="criteria"><strong>Acceptance criteria</strong><p>${h(r.acceptanceCriteria||'Not yet specified by the stakeholder.')}</p></div>${r.openIssues.length?`<ul>${r.openIssues.map(x=>`<li>${h(x)}</li>`).join('')}</ul>`:''}${sourceDetails(r.sourceIds)}${r.answerIds.length?`<details><summary>View supporting answers</summary>${r.answerIds.map(id=>{const q=session.questions.find(x=>x.id===id);return `<p class="source-text">${h(q?.question)}<br>${h(q?.answer)}${q?.answerOrigin==='simulated'?' [SIMULATED]':''}</p>`;}).join('')}</details>`:''}</article>`).join(''):empty('No requirements in this view.','Run analysis or choose a different requirement type.');
  }else if(view==='evaluation'){
    const e=comparison(session);$('score-cards').innerHTML=[['Without clarification',e.before.overall===null?'—':e.before.overall+'%','Baseline rubric score'],['With clarification',e.after.overall===null?'—':e.after.overall+'%','Refined rubric score'],['Change',e.delta===null?'—':(e.delta>=0?'+':'')+e.delta,'Percentage points']].map(([title,value,label])=>`<div class="score-card"><span>${title}</span><strong>${value}</strong><span>${label}</span></div>`).join('');
    $('score-table').innerHTML=['clarity','completeness','verifiability','traceability'].map(k=>`<tr><td>${k[0].toUpperCase()+k.slice(1)}</td><td>${e.before[k]??'—'}</td><td>${e.after[k]??'—'}</td><td>${e.before[k]===null?'—':`${e.after[k]-e.before[k]} pp`}</td></tr>`).join('');
    $('requirement-scores').innerHTML=e.after.items.length?e.after.items.map(r=>`<p><b>${h(r.id)} · ${r.score}%</b><br><span class="muted">${Object.entries(r.checks).map(([k,v])=>`${h(k)}: ${v?'pass':'review'}`).join(' · ')}</span></p>`).join(''):empty('No scores yet.','Generate requirements to evaluate their content.');
  }else if(view==='export')$('export-summary').textContent=`${session.questions.filter(q=>q.status==='pending').length} questions are pending. ${session.questions.filter(q=>q.answerOrigin==='simulated').length} answers are simulated. ${session.analysisRevision!==session.revision?'Analysis is outdated; rerun it before sharing.':'Analysis is up to date.'}`;
}
document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$('statement-form').onsubmit=async e=>{e.preventDefault();const text=$('statement').value;const r=await action('APPEND',{items:[{speaker:$('speaker').value,text,eventId:crypto.randomUUID()}]});if(r)$('statement').value='';};
$('analyze').onclick=()=>action('ANALYZE');
$('capture-toggle').onclick=()=>action(session.capture.active?'STOP_CAPTURE':'START_CAPTURE');
$('load-demo').onclick=async()=>{if(await action('DEMO')){setView('meeting');notice('Case study loaded in its own session. Its questions remain unanswered until you respond.');}};
$('sample-answers').onclick=async()=>{if(confirm('Apply clearly labelled simulated answers for demonstration? These are not answers from the assignment.'))await action('DEMO_ANSWERS');};
$('session-select').onchange=()=>action('SELECT',{id:$('session-select').value});
$('new-session').onclick=async()=>{const title=prompt('Meeting name','New requirements meeting');if(title!==null)await action('NEW',{title});};
$('rename-session').onclick=async()=>{const title=prompt('Meeting name',session.title);if(title!==null)await action('RENAME',{title});};
$('delete-session').onclick=async()=>{if(confirm(`Delete “${session.title}” and all its saved statements and answers? Export it first if needed.`)){drafts.clear();await action('DELETE');}};
$('open-full').onclick=()=>chrome.tabs.create({url:chrome.runtime.getURL('index.html')});
$('show-refined').onclick=()=>{mode='refined';$('show-refined').classList.add('selected');$('show-baseline').classList.remove('selected');renderContent();};
$('show-baseline').onclick=()=>{mode='baseline';$('show-baseline').classList.add('selected');$('show-refined').classList.remove('selected');renderContent();};
$('requirement-filter').onchange=renderContent;
$('questions').addEventListener('input',e=>{const form=e.target.closest('form');if(form)drafts.set(form.dataset.question,{answer:form.elements.answer.value,answeredBy:form.elements.answeredBy.value});});
$('questions').addEventListener('submit',async e=>{e.preventDefault();const f=e.target;const r=await action('ANSWER',{id:f.dataset.question,answer:f.elements.answer.value,answeredBy:f.elements.answeredBy.value});if(r){drafts.delete(f.dataset.question);document.activeElement?.blur();renderContent();notice('Answer saved. Requirements are being regenerated from the recorded evidence.');}});
$('questions').addEventListener('click',async e=>{const b=e.target.closest('[data-dismiss]');if(b){b.blur();await action('DISMISS',{id:b.dataset.dismiss});}});
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
$('settings-open').onclick=async()=>{try{const r=await send('GET');const s=r.state.settings;$('provider').value=s.provider;$('model').value=s.model;$('api-key').value='';$('auto-analyze').checked=s.autoAnalyze;$('remote-consent').checked=s.allowRemote;$('key-status').textContent=r.keySaved?'A key is saved for the selected provider in this browser session.':'No key is saved for this provider.';$('settings-dialog').showModal();}catch(e){notice(e.message,true);}};
$('provider').onchange=()=>{$('model').value='';$('key-status').textContent='Enter the model ID for this provider. Leave the key blank to keep its existing saved key.';};
function settings(){return {provider:$('provider').value,model:$('model').value,autoAnalyze:$('auto-analyze').checked,allowRemote:$('remote-consent').checked};}
$('settings-form').onsubmit=async e=>{e.preventDefault();if(await action('SETTINGS',{settings:settings(),key:$('api-key').value})){$('api-key').value='';$('settings-dialog').close();notice('Settings saved. Click Analyze meeting to use the selected engine.');}};
$('clear-key').onclick=async()=>{if(await action('SETTINGS',{settings:settings(),clearKey:true})){$('api-key').value='';$('key-status').textContent='Key cleared for this provider.';}};
$('import-open').onclick=()=>$('import-dialog').showModal();
$('import-file').onchange=async()=>{const f=$('import-file').files[0];if(!f)return;if(f.size>300000){notice('Choose a transcript file under 300 KB.',true);return;}$('import-text').value=await f.text();};
$('import-form').onsubmit=async e=>{e.preventDefault();const items=parseTranscript($('import-text').value);if(!items.length){notice('No statements found in this transcript.',true);return;}
  for(let i=0;i<items.length;i+=100){if(!await action('APPEND',{items:items.slice(i,i+100),source:'import'}))return;}
  $('import-dialog').close();$('import-text').value='';notice(`Imported ${items.length} statements.`);
};
document.querySelectorAll('[data-export]').forEach(b=>b.onclick=async()=>{try{
  const type=b.dataset.export,stem=session.title.replace(/[^a-z0-9]/gi,'_').slice(0,70)||'ReqAI_report';
  if(type==='pdf'){
    const id=crypto.randomUUID();const stored=await chrome.storage.session.get('reports');const reports=Object.fromEntries(Object.entries(stored.reports||{}).slice(-2));reports[id]=structuredClone(session);await chrome.storage.session.set({reports});await chrome.tabs.create({url:chrome.runtime.getURL(`report.html?id=${id}`)});
  }else if(type==='txt')download(new Blob([textReport(session)],{type:'text/plain;charset=utf-8'}),stem+'.txt');
  else if(type==='docx')download(docxReport(session),stem+'.docx');
  else download(new Blob([JSON.stringify({schemaVersion:2,session},null,2)],{type:'application/json'}),stem+'.json');
}catch(e){notice(e.message,true);}});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&(changes.sessions||changes.settings||changes.activeId))void refresh();});
async function refresh(){try{const r=await send('GET');data=r.state;render();}catch(e){notice(e.message,true);}}
void refresh();
