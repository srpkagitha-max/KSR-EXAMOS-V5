import { parseQuestionsDetailed } from './parser.js';

const $ = id => document.getElementById(id);
const REQUIRED_FILES = ['index.html','login.html','dashboard.html','exam.html','result.html','questions.html','question-bank.html','master-data.html','live-monitor.html','style.css','app.js','firebase-config.js','admin-daily.js','parser.js','service-worker.js','manifest.json','icon-192.png','icon-512.png'];
const REQUIRED_DASHBOARD_IDS = ['instituteId','batchId','examId','startTime','endTime','secondsPerQuestion','rawBits','parseBtn','saveExamBtn'];
let checks = [];

function add(name, ok, detail='') { checks.push({name,ok:Boolean(ok),detail}); }
function render(){
  const passed=checks.filter(x=>x.ok).length, failed=checks.length-passed;
  $('totalCount').textContent=checks.length;$('passCount').textContent=passed;$('failCount').textContent=failed;
  $('checkList').innerHTML=checks.map(x=>`<article class="diagnosticItem ${x.ok?'isPass':'isFail'}"><span>${x.ok?'✓':'✕'}</span><div><b>${escapeHtml(x.name)}</b><p>${escapeHtml(x.detail||'')}</p></div></article>`).join('');
  $('overallStatus').className='msg '+(failed?'err':'ok');
  $('overallStatus').textContent=failed?`${failed} check(s) failed. Failed rows చూడండి.`:'All checks passed ✅';
}
function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function fileCheck(file){try{const r=await fetch(`./${file}?check=${Date.now()}`,{cache:'no-store'});add(`File: ${file}`,r.ok,r.ok?`HTTP ${r.status}`:`HTTP ${r.status}`);}catch(e){add(`File: ${file}`,false,e.message);}}
async function run(){
  checks=[];$('overallStatus').className='msg warn';$('overallStatus').textContent='Checking…';$('checkList').innerHTML='';
  await Promise.all(REQUIRED_FILES.map(fileCheck));
  try{localStorage.setItem('ksr_diag','ok');add('Local storage',localStorage.getItem('ksr_diag')==='ok','Draft recovery support available');localStorage.removeItem('ksr_diag');}catch(e){add('Local storage',false,e.message);}
  try{sessionStorage.setItem('ksr_diag','ok');add('Session storage',sessionStorage.getItem('ksr_diag')==='ok','Exam session support available');sessionStorage.removeItem('ksr_diag');}catch(e){add('Session storage',false,e.message);}
  add('Service Worker support','serviceWorker' in navigator,'PWA/offline shell support');
  add('Secure connection',location.protocol==='https:'||location.hostname==='localhost',location.protocol);
  try{await import(`./firebase-config.js?check=${Date.now()}`);const cfg=window.KSR_FIREBASE_CONFIG;add('Firebase configuration',Boolean(cfg&&cfg.apiKey&&cfg.projectId),cfg?.projectId||'Missing apiKey/projectId');}catch(e){add('Firebase configuration',false,e.message);}
  try{
    const sample=`1. Zero additive inverse ఏది?\nA) 0 ●\nB) 1\nC) -1\nD) 2\n\n2. 2 + 2 విలువ?\nA) 2\nB) 3\nC) 4 ●\nD) 5`;
    const out=parseQuestionsDetailed(sample,'Maths');
    add('Question parser',out.questions.length===2&&out.questions.every(q=>q.options.length>=4),`${out.questions.length} / 2 questions parsed`);
    add('Correct answer detection',out.questions[0]?.answer==='A'&&out.questions[1]?.answer==='C',`Detected: ${out.questions.map(q=>q.answer||'-').join(', ')}`);
  }catch(e){add('Question parser',false,e.message);}
  try{const html=await (await fetch(`./dashboard.html?check=${Date.now()}`,{cache:'no-store'})).text();const missing=REQUIRED_DASHBOARD_IDS.filter(id=>!html.includes(`id="${id}"`));add('Create Exam controls',missing.length===0,missing.length?`Missing: ${missing.join(', ')}`:'All required controls found');}catch(e){add('Create Exam controls',false,e.message);}
  render();
}
$('runChecks').addEventListener('click',run);run();
