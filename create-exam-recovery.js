import {
  auth, db, onAuthStateChanged, collection, getDocs, doc, setDoc,
  serverTimestamp, writeBatch, $, esc
} from './app.js?v=20260727-create-exam-core-v5';
import { parseQuestionsDetailed } from './parser.js?v=20260727-create-exam-core-v5';

const CORE = {
  subjects: [{ name: 'General', rawBits: '', questions: [] }],
  active: 0,
  institutes: [], batches: [], students: [],
  previewIndex: 0,
  undo: null
};

const byId = id => document.getElementById(id);
const text = v => String(v ?? '').trim();
const notify = (message, type='ok') => {
  const box = byId('msg');
  if (box) { box.className = `msg ${type === 'err' ? 'err' : 'ok'}`; box.textContent = message; }
  console[type === 'err' ? 'error' : 'log']('[KSR Core V5]', message);
};
const activeSubject = () => CORE.subjects[CORE.active] || CORE.subjects[0];
const allQuestions = () => CORE.subjects.flatMap(s => s.questions.map(q => ({...q, subject: s.name || q.subject || 'General'})));
const clone = x => JSON.parse(JSON.stringify(x));

function normaliseQuestion(q, subject='General') {
  const opts = Array.isArray(q.options) ? q.options : [];
  return {
    id: q.id || `q_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    subject: q.subject || subject,
    lesson: q.lesson || text(byId('qbLesson')?.value) || 'General',
    difficulty: q.difficulty || 'medium',
    question: text(q.question || q.q),
    options: ['A','B','C','D'].map((key,i) => {
      const found = opts.find(o => String(o.key || '').toUpperCase() === key) || opts[i] || {};
      return { key, text: text(found.text ?? found.value ?? found) };
    }),
    answer: String(q.answer || q.correctAnswer || 'A').toUpperCase().replace(/[^A-D]/g,'').slice(0,1) || 'A'
  };
}

function saveCurrentInputs() {
  const s = activeSubject(); if (!s) return;
  s.name = text(byId('subjectName')?.value) || s.name || `Subject ${CORE.active+1}`;
  s.rawBits = byId('rawBits')?.value || '';
  s.questions = s.questions.map(q => ({...q, subject:s.name}));
}
function loadCurrentInputs() {
  const s = activeSubject(); if (!s) return;
  if (byId('subjectName')) byId('subjectName').value = s.name || '';
  if (byId('rawBits')) byId('rawBits').value = s.rawBits || '';
  if (byId('subjectQuestionCount')) byId('subjectQuestionCount').value = s.questions.length;
  renderSubjectTabs(); renderEditor(); renderAllAnalytics();
}
function renderSubjectTabs() {
  const box = byId('subjectTabs'); if (!box) return;
  box.innerHTML = CORE.subjects.map((s,i)=>`<button type="button" class="${i===CORE.active?'active':'gray'} ksrSubjectTab" data-index="${i}">${esc(s.name || `Subject ${i+1}`)} (${s.questions.length})</button>`).join('');
}
function addParser() {
  saveCurrentInputs();
  CORE.subjects.push({name:`Subject ${CORE.subjects.length+1}`,rawBits:'',questions:[]});
  CORE.active = CORE.subjects.length-1;
  loadCurrentInputs();
  byId('subjectName')?.focus();
  notify('New parser added ✅');
}

function parseCurrent() {
  saveCurrentInputs();
  const s = activeSubject();
  const raw = s.rawBits;
  if (!text(raw)) return notify('Paste Bits box empty ga undi.', 'err');
  try {
    const result = parseQuestionsDetailed(raw, s.name || 'General');
    const parsed = (result.questions || []).map(q=>normaliseQuestion(q,s.name));
    if (!parsed.length) return notify('Questions detect avvaledu. Question + A/B/C/D format check cheyyandi.', 'err');
    s.questions = parsed;
    if (byId('subjectQuestionCount')) byId('subjectQuestionCount').value = parsed.length;
    if (byId('parseBtn')) byId('parseBtn').textContent = `Questions Parsed ✅ (${parsed.length})`;
    renderSubjectTabs(); renderEditor(); renderAllAnalytics(result.diagnostics);
    notify(`${parsed.length} questions parsed. Edit / Move / Delete buttons ready ✅`);
  } catch (e) { notify(`Parser error: ${e.message}`, 'err'); }
}

function blankQuestion() {
  const s=activeSubject();
  s.questions.push(normaliseQuestion({question:'',options:['','','',''],answer:'A'},s.name));
  renderEditor(); renderAllAnalytics();
  setTimeout(()=>byId('questionEditor')?.querySelector('textarea[data-field="question"]:last-of-type')?.focus(),50);
}

function renderEditor() {
  const box=byId('questionEditor'); if(!box)return;
  const s=activeSubject();
  if (!s.questions.length) { box.innerHTML='<p class="small">Questions parse చేసిన తర్వాత editable questions ఇక్కడ కనిపిస్తాయి.</p>'; return; }
  box.innerHTML = `<div class="ksrCoreEditorHead"><h3>${esc(s.name)} Questions (${s.questions.length})</h3><span class="healthStatusBadge ready">EDITABLE</span></div>` + s.questions.map((q,i)=>`
    <article class="qcard" data-qindex="${i}">
      <div class="qhead"><b>Q${i+1}</b><div class="action-row compact">
        <button type="button" class="gray ksrEditFocus" data-index="${i}">Edit</button>
        <button type="button" class="gray ksrMoveUp" data-index="${i}" ${i===0?'disabled':''}>↑ Move</button>
        <button type="button" class="gray ksrMoveDown" data-index="${i}" ${i===s.questions.length-1?'disabled':''}>↓ Move</button>
        <button type="button" class="danger ksrDelete" data-index="${i}">Delete</button>
      </div></div>
      <label>Question</label><textarea data-field="question" data-index="${i}">${esc(q.question)}</textarea>
      <div class="grid two">${q.options.map((o,j)=>`<div><label>${o.key}) Option</label><input data-field="option" data-index="${i}" data-option="${j}" value="${esc(o.text)}"></div>`).join('')}</div>
      <div class="grid two"><div><label>Correct Answer</label><select data-field="answer" data-index="${i}">${['A','B','C','D'].map(k=>`<option value="${k}" ${q.answer===k?'selected':''}>${k}</option>`).join('')}</select></div>
      <div><label>Difficulty</label><select data-field="difficulty" data-index="${i}">${['easy','medium','hard'].map(k=>`<option value="${k}" ${q.difficulty===k?'selected':''}>${k[0].toUpperCase()+k.slice(1)}</option>`).join('')}</select></div></div>
    </article>`).join('');
}

function updateQuestionFromInput(el){
  const i=Number(el.dataset.index); const q=activeSubject().questions[i]; if(!q)return;
  if(el.dataset.field==='question')q.question=el.value;
  if(el.dataset.field==='option')q.options[Number(el.dataset.option)].text=el.value;
  if(el.dataset.field==='answer')q.answer=el.value;
  if(el.dataset.field==='difficulty')q.difficulty=el.value;
  renderAllAnalytics();
}
function moveQuestion(i,delta){const a=activeSubject().questions,j=i+delta;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];renderEditor();renderAllAnalytics();}
function deleteQuestion(i){const a=activeSubject().questions;if(!a[i])return;CORE.undo=clone(CORE.subjects);a.splice(i,1);renderEditor();renderSubjectTabs();renderAllAnalytics();notify('Question deleted.');}

function duplicateGroups(list){
 const map=new Map(); list.forEach((q,i)=>{const k=text(q.question).toLowerCase().replace(/[\s\p{P}]+/gu,'');if(!k)return;if(!map.has(k))map.set(k,[]);map.get(k).push(i)});
 return [...map.values()].filter(x=>x.length>1);
}
function classify(q){const t=(q.question+' '+q.options.map(o=>o.text).join(' ')).toLowerCase();if(/assertion|reason|ప్రకటన.*కారణ/.test(t))return'Assertion–Reason';if(/match|జతపరచ|సరిపోల్చ/.test(t))return'Matching';if(/\bi\)|\bii\)|ప్రకటనలను|వాక్యాలను/.test(t))return'Statement';if(/జత|pair/.test(t))return'Pair';return'Standard';}
function renderAllAnalytics(diagnostics={}){
  const list=allQuestions(); const dup=duplicateGroups(list); const valid=list.filter(q=>q.question&&q.options.every(o=>o.text)&&q.answer).length;
  const score=list.length?Math.round(valid/list.length*100):0;
  [['duplicateRawCount',list.length],['duplicateParsedCount',list.length],['duplicateCount',dup.reduce((n,g)=>n+g.length-1,0)],['duplicateUniqueCount',list.length-dup.reduce((n,g)=>n+g.length-1,0)]].forEach(([id,v])=>{if(byId(id))byId(id).textContent=v});
  const dp=byId('duplicatePreview'); if(dp)dp.innerHTML=dup.length?`<p><b>${dup.length}</b> duplicate groups found.</p>`:'<p class="small">No duplicate questions detected ✅</p>';
  ['removeDuplicatesBtn','removeSelectedDuplicatesBtn'].forEach(id=>{if(byId(id))byId(id).disabled=!dup.length});
  const types={};list.forEach(q=>types[classify(q)]=(types[classify(q)]||0)+1);
  const ts=byId('questionTypeSummary');if(ts)ts.innerHTML=list.length?`<div class="health-grid">${Object.entries(types).map(([k,v])=>`<span>${esc(k)} <b>${v}</b></span>`).join('')}</div>`:'<p class="small">No questions.</p>';
  const health=byId('health');if(health)health.innerHTML=`<div class="examHealthTitleRow"><b>Parser Health Dashboard</b><span class="healthStatusBadge ${score>=90?'ready':'review'}">${score>=90?'READY':'REVIEW'}</span></div><div class="health-grid"><span>Total <b>${list.length}</b></span><span>Valid <b>${valid}</b></span><span>Health Score <b>${score}%</b></span><span>Duplicates <b>${dup.length}</b></span></div>`;
  const easy=list.filter(q=>q.difficulty==='easy').length, med=list.filter(q=>q.difficulty==='medium').length, hard=list.filter(q=>q.difficulty==='hard').length;
  const sa=byId('smartAnalyticsSummary');if(sa)sa.innerHTML=`<div class="health-grid"><span>Total Questions <b>${list.length}</b></span><span>Subjects <b>${CORE.subjects.filter(s=>s.questions.length).length}</b></span><span>Estimated Time <b>${Math.ceil(list.length*Number(byId('secondsPerQuestion')?.value||60)/60)} min</b></span><span>Difficulty <b>E:${easy} M:${med} H:${hard}</b></span></div>`;
  const eq=byId('examQualitySummary');if(eq)eq.innerHTML=`<div class="qualityHero"><div><b>Overall Quality</b><h3>${score}/100</h3></div><span class="healthStatusBadge ${score>=90?'ready':'review'}">${score>=90?'READY':'NEEDS REVIEW'}</span></div>`;
  renderBulk();
}
function removeDuplicates(){const list=activeSubject().questions;CORE.undo=clone(CORE.subjects);const seen=new Set();activeSubject().questions=list.filter(q=>{const k=text(q.question).toLowerCase().replace(/[\s\p{P}]+/gu,'');if(seen.has(k))return false;seen.add(k);return true});renderEditor();renderSubjectTabs();renderAllAnalytics();notify('Duplicate questions removed ✅');}

function renderBulk(){const box=byId('bulkQuestionSummary');if(!box)return;const list=allQuestions();box.innerHTML=list.length?`<p><b>${list.length}</b> questions available. Editor పై భాగంలో direct Edit / Move / Delete ఉపయోగించండి.</p>`:'<p class="small">No questions.</p>';}

function preview(){
 saveCurrentInputs();const list=allQuestions();if(!list.length)return notify('Preview కోసం questions లేవు. ముందుగా parse చేయండి.','err');
 CORE.previewIndex=0;const card=byId('previewCard');if(card)card.hidden=false;renderPreview();card?.scrollIntoView({behavior:'smooth'});
}
function renderPreview(){const list=allQuestions(),q=list[CORE.previewIndex],box=byId('previewContent'),nav=byId('previewNav');if(!q||!box)return;byId('previewTitle').textContent=text(byId('examTitle')?.value)||text(byId('examId')?.value)||'Exam Preview';box.innerHTML=`<div class="qcard"><b>Question ${CORE.previewIndex+1} of ${list.length}</b><p>${esc(q.question)}</p>${q.options.map(o=>`<label class="previewOption"><input type="radio" name="pv"> ${o.key}) ${esc(o.text)}</label>`).join('')}<div class="action-row"><button type="button" id="corePrev" class="gray" ${CORE.previewIndex===0?'disabled':''}>Previous</button><button type="button" id="coreNext" ${CORE.previewIndex===list.length-1?'disabled':''}>Next</button></div></div>`;if(nav)nav.innerHTML=list.map((_,i)=>`<button type="button" class="${i===CORE.previewIndex?'active':'gray'} coreNav" data-index="${i}">${i+1}</button>`).join('');}

async function saveExam(){
 saveCurrentInputs();const qs=allQuestions();const examId=text(byId('examId')?.value).toUpperCase();const iid=byId('instituteId')?.value,bid=byId('batchId')?.value;
 if(!iid||!bid)return notify('Institute మరియు Batch select చేయండి.','err');if(!examId)return notify('Exam ID enter చేయండి.','err');if(!qs.length)return notify('Questions parse చేయండి.','err');
 const start=byId('startTime')?.value,end=byId('endTime')?.value;if(!start||!end)return notify('Start Time మరియు End Time select చేయండి.','err');
 try{
  const exam={examId,examCode:examId,examName:text(byId('examTitle')?.value)||examId,instituteId:iid,instituteName:text(byId('instituteName')?.value),batchId:bid,startTime:new Date(start).toISOString(),endTime:new Date(end).toISOString(),loginBefore:byId('loginBefore')?.value?new Date(byId('loginBefore').value).toISOString():new Date(start).toISOString(),secondsPerQuestion:Number(byId('secondsPerQuestion')?.value||60),status:byId('status')?.value||'active',questionShuffle:byId('questionShuffle')?.value||'subject',optionShuffle:byId('optionShuffle')?.value==='yes',studentRandomization:byId('studentRandomization')?.value||'different',questionCount:qs.length,codeCount:Number(byId('codeCount')?.value||10),updatedAt:serverTimestamp()};
  await setDoc(doc(db,'exams',examId),exam,{merge:true});await setDoc(doc(db,'examQuestions',examId),{examId,questions:qs,updatedAt:serverTimestamp()},{merge:true});
  const codeCount=Math.max(1,Math.min(1000,exam.codeCount));const wb=writeBatch(db);const codes=[];for(let i=0;i<codeCount;i++){const code=`${examId}-${String(i+1).padStart(3,'0')}`;codes.push(code);wb.set(doc(db,'examCodes',code),{code,examId,instituteId:iid,batchId:bid,status:'unused',createdAt:serverTimestamp()},{merge:true});}await wb.commit();
  notify(`Exam ${examId} saved successfully ✅ ${qs.length} questions, ${codeCount} codes.`);const panel=byId('codesPanel');if(panel){byId('codesBox').innerHTML=`<pre>${codes.join('\n')}</pre>`;}
 }catch(e){notify(`Exam save failed: ${e.message}`,'err');}
}

async function loadMasters(){
 try{const [is,bs]=await Promise.all([getDocs(collection(db,'institutes')),getDocs(collection(db,'batches'))]);CORE.institutes=[];CORE.batches=[];is.forEach(d=>CORE.institutes.push({id:d.id,...d.data()}));bs.forEach(d=>CORE.batches.push({id:d.id,...d.data()}));const sel=byId('instituteId');if(sel)sel.innerHTML='<option value="">Select Institute</option>'+CORE.institutes.map(x=>`<option value="${x.id}">${esc(x.name||x.instituteName||x.id)}</option>`).join('');renderBatches();}catch(e){notify(`Institute load failed: ${e.message}`,'err');}
}
function renderBatches(){const iid=byId('instituteId')?.value||'',sel=byId('batchId');if(!sel)return;const list=CORE.batches.filter(b=>String(b.instituteId||'')===String(iid));sel.innerHTML=iid?'<option value="">Select Batch</option>'+list.map(b=>`<option value="${b.id}">${esc(b.name||b.batchName||b.id)}</option>`).join(''):'<option value="">Select Institute first</option>';const inst=CORE.institutes.find(x=>x.id===iid);if(byId('instituteName'))byId('instituteName').value=inst?.name||inst?.instituteName||'';}
async function loadStudents(){const iid=byId('instituteId')?.value,bid=byId('batchId')?.value;if(!iid||!bid)return;try{const snap=await getDocs(collection(db,'studentMaster'));let count=0;snap.forEach(d=>{const x=d.data()||{},st=String(x.status||'active').toLowerCase();const sameBatch=String(x.batchId||x.batch||'')===String(bid);const sameInst=!x.instituteId||String(x.instituteId)===String(iid);if(sameBatch&&sameInst&&x.active!==false&&!['inactive','hold','deleted'].includes(st))count++;});if(byId('activeStudentCount'))byId('activeStudentCount').value=count;updateCodeCount();notify(`${count} active students loaded ✅`);}catch(e){notify(`Students load failed: ${e.message}`,'err');}}
function updateCodeCount(){const a=Number(byId('activeStudentCount')?.value||0),b=Number(byId('backupCodeCount')?.value||0);if(byId('codeCount'))byId('codeCount').value=a+b;}

function intercept(id,fn){const el=byId(id);if(!el||el.dataset.ksrV5)return;el.dataset.ksrV5='1';el.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();fn(e);},true);}
function bind(){
  // Keep Active Students auto-filled, but allow manual correction when old data is incomplete.
  byId('activeStudentCount')?.removeAttribute('readonly');
  intercept('addSubjectBtn',addParser);intercept('parseBtn',parseCurrent);intercept('addQuestionBtn',blankQuestion);intercept('previewBtn',preview);intercept('saveGenerateBtn',saveExam);
  intercept('refreshTypeAnalysisBtn',()=>{saveCurrentInputs();renderAllAnalytics();notify('Question Type Analysis refreshed ✅')});
  intercept('refreshSmartAnalyticsBtn',()=>{saveCurrentInputs();renderAllAnalytics();notify('Smart Analytics refreshed ✅')});
  intercept('refreshExamQualityBtn',()=>{saveCurrentInputs();renderAllAnalytics();notify('Exam Quality refreshed ✅')});
  intercept('bulkRefreshBtn',()=>{saveCurrentInputs();renderAllAnalytics();notify('Bulk Manager refreshed ✅')});
  intercept('removeDuplicatesBtn',removeDuplicates);intercept('removeSelectedDuplicatesBtn',removeDuplicates);
  intercept('undoDuplicateRemovalBtn',()=>{if(CORE.undo){CORE.subjects=clone(CORE.undo);CORE.undo=null;loadCurrentInputs();notify('Undo completed ✅')}});
  byId('subjectTabs')?.addEventListener('click',e=>{const b=e.target.closest('.ksrSubjectTab');if(!b)return;e.preventDefault();e.stopImmediatePropagation();saveCurrentInputs();CORE.active=Number(b.dataset.index);loadCurrentInputs();},true);
  byId('questionEditor')?.addEventListener('input',e=>{if(e.target.dataset.field)updateQuestionFromInput(e.target)},true);
  byId('questionEditor')?.addEventListener('change',e=>{if(e.target.dataset.field)updateQuestionFromInput(e.target)},true);
  byId('questionEditor')?.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const i=Number(b.dataset.index);if(b.classList.contains('ksrEditFocus')){e.preventDefault();e.stopImmediatePropagation();byId('questionEditor').querySelector(`[data-qindex="${i}"] textarea`)?.focus()}if(b.classList.contains('ksrMoveUp')){e.preventDefault();e.stopImmediatePropagation();moveQuestion(i,-1)}if(b.classList.contains('ksrMoveDown')){e.preventDefault();e.stopImmediatePropagation();moveQuestion(i,1)}if(b.classList.contains('ksrDelete')){e.preventDefault();e.stopImmediatePropagation();deleteQuestion(i)}},true);
  byId('previewContent')?.addEventListener('click',e=>{if(e.target.id==='corePrev'){CORE.previewIndex--;renderPreview()}if(e.target.id==='coreNext'){CORE.previewIndex++;renderPreview()}},true);
  byId('previewNav')?.addEventListener('click',e=>{const b=e.target.closest('.coreNav');if(!b)return;CORE.previewIndex=Number(b.dataset.index);renderPreview()},true);
  byId('instituteId')?.addEventListener('change',()=>{renderBatches();loadStudents()},true);byId('batchId')?.addEventListener('change',loadStudents,true);
  byId('backupCodeCount')?.addEventListener('input',updateCodeCount,true);byId('activeStudentCount')?.addEventListener('input',updateCodeCount,true);
  byId('subjectName')?.addEventListener('input',()=>{activeSubject().name=byId('subjectName').value;renderSubjectTabs()},true);
  loadCurrentInputs();
}

document.addEventListener('DOMContentLoaded',bind,{once:true});
if(document.readyState!=='loading')bind();
onAuthStateChanged(auth,user=>{if(user)loadMasters();});
window.__KSR_CORE_V5__={state:CORE,parseCurrent,renderAllAnalytics,saveExam};
