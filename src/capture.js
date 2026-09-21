(() => {
  if(globalThis.__clariflowV2)return;globalThis.__clariflowV2=true;
  const selectors=['.transcription-list-item','.transcription-item','.transcript-item','[data-testid="transcript-item"]','.closed-caption-window','.closed-caption-container','.cc-container','[data-testid="caption-text"]','.chat-message__content','[data-testid="chat-message-content"]'];
  let active=false,sessionId=null,pending=[],sending=false,lastError='',seen=new WeakMap(),streams=new Map();
  const normalize=s=>(s||'').replace(/\s+/g,' ').trim();
  function read(el){
    const speaker=normalize(el.querySelector('[class*="speaker"],[class*="sender"],[class*="user-name"]')?.textContent)||'Speaker';
    const copy=el.cloneNode(true);copy.querySelectorAll('button,[class*="timestamp"],[class*="speaker"],[class*="sender"],[class*="user-name"]').forEach(x=>x.remove());
    const text=normalize(copy.textContent);if(text.length<3||text.length>8000)return null;
    return {speaker,text};
  }
  function scan(root=document){
    if(!active)return;
    const nodes=new Set(selectors.flatMap(sel=>Array.from(root.querySelectorAll(sel))));
    for(const el of nodes){
      // Prefer an inner transcript row to its wrapper to avoid concatenated duplicates.
      if([...nodes].some(other=>other!==el&&el.contains(other)))continue;
      const item=read(el);if(!item)continue;
      if(seen.get(el)===item.text)continue;
      seen.set(el,item.text);const old=streams.get(el);
      if(old&&old.text!==item.text&&!item.text.startsWith(old.text)&&!old.text.startsWith(item.text))commit(old);
      streams.set(el,{...item,changedAt:Date.now()});
    }
    for(const [el,item] of streams){if(Date.now()-item.changedAt>=1300){commit(item);streams.delete(el);}}
  }
  function commit(item){
    if(pending.length>=300){lastError='Capture buffer full. Check the workbench.';return;}
    pending.push({speaker:item.speaker,text:item.text,eventId:crypto.randomUUID(),timestamp:Date.now()});
  }
  async function flush(){
    if(!active||sending||!pending.length)return;sending=true;
    const batch=pending.slice(0,50);
    try{const r=await chrome.runtime.sendMessage({type:'CAPTURE_BATCH',sessionId,items:batch});
      if(r?.ok){pending.splice(0,batch.length);lastError='';}else lastError=r?.error||'Capture unavailable';
    }catch{lastError='Connection lost. Reload Zoom after reloading the extension.';}finally{sending=false;updateBadge();}
  }
  let badge;
  function updateBadge(){
    if(window!==window.top)return;
    if(!badge){badge=document.createElement('div');badge.id='clariflow-capture-badge';badge.style.cssText='position:fixed;bottom:20px;right:20px;z-index:2147483647;padding:10px 16px;border-radius:24px;background:#142d30;color:white;font:12px system-ui;box-shadow:0 4px 18px #0004;pointer-events:none';document.documentElement.append(badge);}
    badge.textContent=lastError?`Clariflow · ${lastError}`:active?`Clariflow · Capturing captions${pending.length?' · '+pending.length+' queued':''}`:'Clariflow · Capture paused';
  }
  async function status(){
    try{const r=await chrome.runtime.sendMessage({type:'CAPTURE_STATUS'});if(!r?.ok)return;
      if(r.sessionId!==sessionId||active!==r.active){pending=[];streams.clear();seen=new WeakMap();}
      active=r.active;sessionId=r.sessionId;updateBadge();
    }catch{active=false;lastError='Reload this tab to reconnect.';updateBadge();}
  }
  // Restrict mutation scans to one sweep per animation frame.
  let scheduled=false;
  const observer=new MutationObserver(()=>{if(!active||scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;scan();});});
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  setInterval(()=>{scan();void flush();},1600);
  setInterval(status,2500);void status();
})();
