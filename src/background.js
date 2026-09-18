import {DEFAULT_SETTINGS,newSession,appendEntries,answerQuestion,mergeQuestions,offlineAnalysis,offlineRefine,clone,clean} from './core.js';
import {requestAnalysis} from './providers.js';
import {CASE_STUDY,DEMO_ANSWERS} from './sample.js';
let chain=Promise.resolve(),running=false;
// Only short storage mutations are serialized. Network calls never hold this lock.
export function transaction(fn) {const p=chain.then(fn);chain=p.catch(()=>{});return p;}
async function load() {
  const d=await chrome.storage.local.get(['sessions','activeId','settings']);
  if(!d.sessions?.length){const s=newSession();d.sessions=[s];d.activeId=s.id;}
  d.settings={...DEFAULT_SETTINGS,...d.settings};return d;
}
async function save(d){await chrome.storage.local.set(d);}
function current(d){return d.sessions.find(s=>s.id===d.activeId)||d.sessions[0];}
function queue(s){s.job={status:'pending',requestedAt:Date.now()};s.error=null;}
async function init(){
  await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  await chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  await transaction(async()=>save(await load()));
  await chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true});
  await chrome.alarms.create('reqai-resume',{periodInMinutes:0.5});
}
const ready=init();
chrome.runtime.onInstalled.addListener(()=>ready.catch(()=>{}));
chrome.runtime.onStartup.addListener(()=>ready.catch(()=>{}));
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='reqai-resume')void pump();});
async function pump(){
  await ready;if(running)return;running=true;
  try {
    // A persisted working job is retryable after a worker restart. The revision check prevents stale commits.
    for(let attempt=0;attempt<4;attempt++) {
      const work=await transaction(async()=>{
        const d=await load(),s=d.sessions.find(s=>s.job&&['pending','working'].includes(s.job.status));
        if(!s)return null;s.job.status='working';await save(d);return {session:clone(s),settings:clone(d.settings)};
      });
      if(!work)break;
      const {session:s,settings}=work,rev=s.revision;
      try {
        if(!s.transcript.length)throw Error('Add transcript statements before running analysis.');
        const key=(await chrome.storage.session.get('keys')).keys?.[settings.provider]||'';
        const base=settings.provider==='offline'?offlineAnalysis(s.transcript):await requestAnalysis(settings,key,s.transcript);
        mergeQuestions(s,base.questions,settings.provider);
        let refined=clone(base.requirements);
        if(s.questions.some(q=>q.status==='answered')) {
          refined=settings.provider==='offline'?offlineRefine(base.requirements,s.questions):(await requestAnalysis(settings,key,s.transcript,s.questions,base.requirements)).requirements;
        }
        await transaction(async()=>{
          const d=await load(),live=d.sessions.find(x=>x.id===s.id);if(!live)return;
          if(live.revision!==rev){queue(live);await save(d);return;}
          live.questions=s.questions;live.baseline=base.requirements;live.refined=refined;
          live.analysisRevision=rev;live.analysisProvider=settings.provider==='offline'?'Offline rules':`${settings.provider} / ${settings.model}`;
          live.analyzedAt=Date.now();live.job=null;live.error=null;await save(d);
        });
      }catch(e){
        await transaction(async()=>{const d=await load(),live=d.sessions.find(x=>x.id===s.id);if(!live)return;
          if(live.revision!==rev)queue(live);else{live.job=null;live.error=clean(e.message,500);}await save(d);
        });
      }
    }
  } finally {running=false;}
}
chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
  (async()=>{
    await ready;
    const fromPage=!!sender.tab;
    if(fromPage) {
      let host='';try{host=new URL(sender.url||sender.tab.url).hostname;}catch{}
      if(!(host==='zoom.us'||host.endsWith('.zoom.us'))||!['CAPTURE_BATCH','CAPTURE_STATUS'].includes(msg.type))throw Error('Message origin is not authorized.');
    } else if(sender.id!==chrome.runtime.id)throw Error('Untrusted message.');
    const result=await transaction(async()=>{
      const d=await load(),s=current(d);
      switch(msg.type){
        case 'GET': {const keys=(await chrome.storage.session.get('keys')).keys||{};return {state:d,keySaved:!!keys[d.settings.provider]};}
        case 'CAPTURE_STATUS':return {active:s.capture.active&&s.capture.tabId===sender.tab.id,sessionId:s.id};
        case 'CAPTURE_BATCH':
          if(!s.capture.active||s.capture.tabId!==sender.tab.id||msg.sessionId!==s.id)return {accepted:false};
          if(appendEntries(s,msg.items,'zoom')&&d.settings.autoAnalyze)queue(s);s.capture.receivedAt=Date.now();break;
        case 'APPEND':if(appendEntries(s,msg.items,msg.source==='import'?'import':'manual')&&d.settings.autoAnalyze)queue(s);break;
        case 'ANALYZE':queue(s);break;
        case 'ANSWER':answerQuestion(s,msg.id,msg.answer,msg.answeredBy);queue(s);break;
        case 'DISMISS':{const q=s.questions.find(x=>x.id===msg.id);if(!q)throw Error('Question not found.');q.status=q.status==='dismissed'?'pending':'dismissed';s.revision++;queue(s);break;}
        case 'NEW': {
          if(d.sessions.length>=20)throw Error('Archive limit is 20 sessions. Export and delete an old session first.');
          d.sessions.forEach(x=>x.capture.active=false);const n=newSession(msg.title);d.sessions.unshift(n);d.activeId=n.id;break;
        }
        case 'DEMO': {
          if(d.sessions.length>=20)throw Error('Delete an old session before adding the case study.');
          d.sessions.forEach(x=>x.capture.active=false);const n=newSession('Resume analyzer · assignment case study',true);
          appendEntries(n,CASE_STUDY,'case-study');queue(n);d.sessions.unshift(n);d.activeId=n.id;break;
        }
        case 'DEMO_ANSWERS':
          if(!s.demo)throw Error('Sample answers are available only in the case-study session.');
          for(const q of s.questions)if(DEMO_ANSWERS[q.topic]&&q.status!=='answered')answerQuestion(s,q.id,DEMO_ANSWERS[q.topic],'Sample stakeholder','simulated');queue(s);break;
        case 'SELECT':if(!d.sessions.some(x=>x.id===msg.id))throw Error('Session not found.');d.sessions.forEach(x=>x.capture.active=false);d.activeId=msg.id;break;
        case 'RENAME':s.title=clean(msg.title,120)||s.title;break;
        case 'DELETE':d.sessions=d.sessions.filter(x=>x.id!==s.id);if(!d.sessions.length)d.sessions=[newSession()];d.activeId=d.sessions[0].id;break;
        case 'SETTINGS': {
          const p=msg.settings?.provider;if(!['offline','openai','gemini'].includes(p))throw Error('Unknown provider.');
          d.settings={provider:p,model:clean(msg.settings.model,120),autoAnalyze:!!msg.settings.autoAnalyze,allowRemote:!!msg.settings.allowRemote};
          const keys=(await chrome.storage.session.get('keys')).keys||{};
          if(msg.clearKey)delete keys[p];else if(msg.key)keys[p]=clean(msg.key,500);
          await chrome.storage.session.set({keys});
          // Invalidate in-flight results if a provider changes.
          d.sessions.forEach(x=>{if(x.job){x.revision++;queue(x);}});break;
        }
        case 'START_CAPTURE': {
          const tabs=await chrome.tabs.query({active:true,lastFocusedWindow:true});const tab=tabs[0];
          let host='';try{host=new URL(tab?.url).hostname;}catch{}
          if(!tab||!(host==='zoom.us'||host.endsWith('.zoom.us')))throw Error('Select your Zoom web meeting tab, then start capture from the side panel.');
          Object.assign(s.capture,{active:true,tabId:tab.id,receivedAt:null});break;
        }
        case 'STOP_CAPTURE':s.capture.active=false;break;
        default:throw Error('Unknown action.');
      }
      await save(d);return {state:d};
    });
    sendResponse({ok:true,...result});void pump();
  })().catch(e=>sendResponse({ok:false,error:clean(e.message,500)}));
  return true;
});
