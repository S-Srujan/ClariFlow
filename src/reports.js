import {comparison} from './core.js';
export const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function reportLines(s) {
  const e=comparison(s),lines=[];const add=(style,text)=>lines.push({style,text:String(text??'')});
  add('Title',s.title);add('Subtitle','Clariflow · Requirement analysis report');
  add('Normal',`Generated: ${new Date().toLocaleString()} | Session: ${s.id}`);
  add('Normal',`Analysis engine: ${s.analysisProvider||'Not analyzed'} | ${s.demo?'Assignment case study; sample answers, if applied, are simulated.':'Meeting session'}`);
  add('Normal',`Analysis status: ${s.analysisRevision===s.revision?'Up to date':'OUTDATED — rerun analysis before relying on these results.'}`);
  add('Heading1','1. Executive summary');
  add('Normal',`${s.transcript.length} statements; ${s.questions.length} clarification questions; ${s.questions.filter(q=>q.status==='answered').length} answered.`);
  add('Normal',`Baseline: ${e.before.overall??'N/A'}; clarified: ${e.after.overall??'N/A'}; change: ${e.delta===null?'N/A':`${e.delta>=0?'+':''}${e.delta} percentage points`}. Scores are rubric indicators, not independently validated quality claims.`);
  add('Heading1','2. Clarification log');
  for(const [i,q] of s.questions.entries()){
    add('Heading2',`${i+1}. ${q.question}`);add('Normal',`Category: ${q.category}; sources: ${q.sourceIds.join(', ')}; status: ${q.status}`);
    add('Normal',`Reason: ${q.rationale}`);add('Normal',`Answer: ${q.answer||'Not answered'}`);
    if(q.answer)add('Normal',`Recorded by: ${q.answeredBy}; origin: ${q.answerOrigin==='simulated'?'SIMULATED EXAMPLE':q.answerOrigin}; answer ID: ${q.id}`);
  }
  for(const [heading,reqs] of [['3. Without clarification',s.baseline],['4. With clarification',s.refined]]){
    add('Heading1',heading);if(!reqs.length)add('Normal','No requirements generated.');
    for(const r of reqs){add('Heading2',`${r.id} · ${r.type} · ${r.title}`);add('Normal',`Category: ${r.category}`);add('Normal',r.statement);add('Normal',`Acceptance criteria: ${r.acceptanceCriteria||'Not specified'}`);add('Normal',`Open issues: ${r.openIssues.join('; ')||'None recorded; still requires human review.'}`);add('Normal',`Sources: ${r.sourceIds.join(', ')} | Answers: ${r.answerIds.join(', ')||'None'}`);}
  }
  add('Heading1','5. Evaluation and paired comparison');
  for(const key of ['clarity','completeness','verifiability','traceability'])add('Normal',`${key}: baseline ${e.before[key]??'N/A'} → clarified ${e.after[key]??'N/A'}`);
  for(const r of s.refined){const base=s.baseline.find(x=>x.id===r.id);add('Heading2',r.id);add('Normal',`Before: ${base?.statement||'No matching baseline requirement'}`);add('Normal',`After: ${r.statement}`);const score=e.after.items.find(x=>x.id===r.id);add('Normal',`Checks: ${Object.entries(score?.checks||{}).map(([k,v])=>`${k}: ${v?'pass':'review'}`).join('; ')}`);}
  add('Heading1','6. Evaluation method and limits');
  add('Normal','Each requirement earns one point per check: clarity (no detected vague words, placeholders or open issues); completeness (statement and acceptance criteria, no open issues); verifiability (observable action for FRs or number for NFRs/constraints in acceptance criteria); traceability (valid transcript and answer IDs). Each dimension is the percentage passing; overall is the mean. Change is measured in percentage points.');
  add('Normal','This English-language text rubric does not verify semantic correctness, realistic thresholds, fairness, feasibility, security or compliance. AI output and offline drafts require stakeholder review. Offline rules do not provide general AI reasoning. Unanswered questions are not stakeholder approvals.');
  add('Heading1','7. Source transcript');
  for(const t of s.transcript)add('Normal',`${t.id} [${t.source}] ${t.speaker}: ${t.text}`);
  add('Heading1','8. Answer revision history');
  for(const h of s.history)add('Normal',`${new Date(h.at).toISOString()} | ${h.questionId} | ${h.by} (${h.origin}) | Previous: ${h.previousAnswer||'None'} | New: ${h.newAnswer}`);
  return lines;
}
export function textReport(s){return reportLines(s).map(x=>x.style.startsWith('Heading')?`\n${x.text}\n`:x.text).join('\n');}
export function htmlReport(s){return reportLines(s).map(x=>{const tag={Title:'h1',Subtitle:'p',Heading1:'h2',Heading2:'h3',Normal:'p'}[x.style];return `<${tag}>${escapeHTML(x.text)}</${tag}>`;}).join('\n');}
const encoder=new TextEncoder();
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
// Minimal ZIP writer (stored entries), used for genuine Office Open XML exports without remote libraries.
export function zip(files){
  const chunks=[],central=[];let offset=0;
  for(const [name,content] of Object.entries(files)){
    const n=encoder.encode(name),data=encoder.encode(content),crc=crc32(data);
    const local=new Uint8Array(30+n.length),v=new DataView(local.buffer);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,n.length,true);local.set(n,30);
    const c=new Uint8Array(46+n.length),cv=new DataView(c.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,n.length,true);cv.setUint32(42,offset,true);c.set(n,46);
    chunks.push(local,data);central.push(c);offset+=local.length+data.length;
  }
  const size=central.reduce((n,c)=>n+c.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,central.length,true);ev.setUint16(10,central.length,true);ev.setUint32(12,size,true);ev.setUint32(16,offset,true);
  return new Blob([...chunks,...central,end],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}
export function docxReport(s){
  const xml=s=>escapeHTML(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
  const paragraphs=reportLines(s).map(x=>`<w:p><w:pPr><w:pStyle w:val="${x.style}"/></w:pPr><w:r><w:t xml:space="preserve">${xml(x.text)}</w:t></w:r></w:p>`).join('');
  return zip({
    '[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
    '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/_rels/document.xml.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'word/document.xml':`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`,
    'word/styles.xml':`<?xml version="1.0"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>${[['Normal',22],['Title',40],['Subtitle',24],['Heading1',30],['Heading2',24]].map(([name,size])=>`<w:style w:type="paragraph" w:styleId="${name}"><w:name w:val="${name}"/><w:pPr>${name!=='Normal'?'<w:keepNext/><w:spacing w:before="240" w:after="120"/>':''}</w:pPr><w:rPr><w:sz w:val="${size}"/>${name!=='Normal'?'<w:b/><w:color w:val="173335"/>':''}</w:rPr></w:style>`).join('')}</w:styles>`
  });
}
export function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
