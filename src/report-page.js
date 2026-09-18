import {htmlReport} from './reports.js';
document.getElementById('print').onclick=()=>window.print();
const id=new URLSearchParams(location.search).get('id');
try{const data=await chrome.storage.session.get('reports');if(!data.reports?.[id])throw Error('This report snapshot is unavailable. Open a new report from the workbench.');document.getElementById('report').innerHTML=htmlReport(data.reports[id]);}catch(e){document.getElementById('report').textContent=e.message;}
