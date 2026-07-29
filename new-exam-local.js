import { parseQuestionsDetailed, blankQuestion, analyzeQuestionHealth } from './parser.js?v=20260729-local-parser-v6';

const $ = id => document.getElementById(id);
const state = { questions: [], open: false, subject: 'General' };
window.__KSR_LOCAL_EXAM_STATE__ = state;
window.__KSR_LOCAL_PARSER_LOADED__ = true;

function status(text, type='ok') {
  let box = $('parserInlineStatus');
  if (!box) {
    box = document.createElement('div');
    box.id = 'parserInlineStatus';
    const btn = $('parseBtn');
    btn?.parentElement?.before(box);
  }
  box.className = 'msg ' + type;
  box.style.display = 'block';
  box.textContent = text;
}

function cloneQuestion(q, i=0) {
  return {
    ...q,
    id: q.id || `local_q_${Date.now()}_${i}`,
    subject: q.subject || state.subject,
    options: (q.options || []).map((o, idx) => ({ key: o.key || 'ABCD'[idx], text: o.text || '' })),
    answer: String(q.answer || 'A').toUpperCase()
  };
}

function updateCount() {
  if ($('subjectQuestionCount')) $('subjectQuestionCount').value = String(state.questions.length);
}

function issueList(q) {
  const issues = [];
  if (!String(q.question || '').trim()) issues.push('Question text missing');
  if (!Array.isArray(q.options) || q.options.length < 4) issues.push('4 options missing');
  if ((q.options || []).some(o => !String(o.text || '').trim())) issues.push('Option text missing');
  if (!['A','B','C','D'].includes(String(q.answer || '').toUpperCase())) issues.push('Correct answer missing');
  return issues;
}

function renderHealth() {
  const host = $('health');
  if (!host) return;
  const total = state.questions.length;
  const issueIndexes = [];
  const subjects = new Map();
  state.questions.forEach((q, i) => {
    if (issueList(q).length) issueIndexes.push(i);
    const name = q.subject || state.subject || 'General';
    subjects.set(name, (subjects.get(name) || 0) + 1);
  });
  const valid = total - issueIndexes.length;
  const subjectRows = [...subjects.entries()].map(([name,count]) => `<div class="healthSubjectRow"><b>${escapeHtml(name)}</b><span>${count}</span></div>`).join('');
  const issueButtons = issueIndexes.length
    ? issueIndexes.map(i => `<button type="button" class="localIssueJump" data-index="${i}">Q${i+1}</button>`).join(' ')
    : '<span class="small">Issues levu ✅</span>';
  host.innerHTML = `
    <div class="questionsHealthIntro"><h3>Questions Health Card</h3><p>Local parser health check</p></div>
    <div class="healthStatsGrid">
      <div class="healthStat"><b>${total}</b><span>Total Bits</span></div>
      <div class="healthStat"><b>${valid}</b><span>Valid Bits</span></div>
      <div class="healthStat"><b>${issueIndexes.length}</b><span>Issue Bits</span></div>
      <div class="healthStat"><b>${subjects.size}</b><span>Total Subjects</span></div>
    </div>
    <div class="localIssueBox"><b>Issue Question Numbers:</b><div>${issueButtons}</div></div>
    <div class="localSubjectBox">${subjectRows || '<span class="small">Subject questions levu.</span>'}</div>`;
  host.querySelectorAll('.localIssueJump').forEach(btn => btn.addEventListener('click', () => {
    const card = document.querySelector(`.localQuestionCard[data-index="${btn.dataset.index}"]`);
    card?.scrollIntoView({behavior:'smooth', block:'center'});
    card?.classList.add('issue-focus');
    setTimeout(() => card?.classList.remove('issue-focus'), 1500);
  }));
}

function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function syncFromEditor() {
  document.querySelectorAll('.localQuestionCard').forEach(card => {
    const i = Number(card.dataset.index);
    const q = state.questions[i];
    if (!q) return;
    q.question = card.querySelector('[data-field="question"]')?.value || '';
    q.subject = card.querySelector('[data-field="subject"]')?.value || state.subject;
    q.answer = card.querySelector('[data-field="answer"]')?.value || 'A';
    q.options = ['A','B','C','D'].map(key => ({key, text: card.querySelector(`[data-option="${key}"]`)?.value || ''}));
  });
}

function moveQuestion(index, delta) {
  syncFromEditor();
  const target = index + delta;
  if (target < 0 || target >= state.questions.length) return;
  [state.questions[index], state.questions[target]] = [state.questions[target], state.questions[index]];
  renderEditor();
}

function renderEditor() {
  const host = $('questionEditor');
  if (!host) return;
  if (!state.open) { host.innerHTML = ''; renderHealth(); return; }
  host.innerHTML = state.questions.map((q, i) => `
    <div class="card localQuestionCard" data-index="${i}">
      <div class="questionCardHead"><h3>Question ${i+1}</h3><div class="action-row compact-actions">
        <button type="button" class="gray localMoveUp" data-index="${i}">↑ Move</button>
        <button type="button" class="gray localMoveDown" data-index="${i}">↓ Move</button>
        <button type="button" class="danger localDelete" data-index="${i}">Delete</button>
      </div></div>
      <label>Subject</label><input data-field="subject" value="${escapeHtml(q.subject || state.subject)}">
      <label>Question</label><textarea data-field="question">${escapeHtml(q.question || '')}</textarea>
      ${['A','B','C','D'].map((key,idx)=>`<label>Option ${key}</label><textarea data-option="${key}">${escapeHtml(q.options?.[idx]?.text || '')}</textarea>`).join('')}
      <label>Correct Answer</label><select data-field="answer">${['A','B','C','D'].map(k=>`<option ${q.answer===k?'selected':''}>${k}</option>`).join('')}</select>
      <div class="small localQuestionIssue">${issueList(q).join(' • ') || 'Valid ✅'}</div>
    </div>`).join('');
  host.querySelectorAll('input,textarea,select').forEach(el => el.addEventListener('input', () => { syncFromEditor(); renderHealth(); }));
  host.querySelectorAll('.localMoveUp').forEach(b => b.addEventListener('click', () => moveQuestion(Number(b.dataset.index), -1)));
  host.querySelectorAll('.localMoveDown').forEach(b => b.addEventListener('click', () => moveQuestion(Number(b.dataset.index), 1)));
  host.querySelectorAll('.localDelete').forEach(b => b.addEventListener('click', () => {
    syncFromEditor(); state.questions.splice(Number(b.dataset.index), 1); updateCount(); renderEditor();
  }));
  renderHealth();
}

function parseNow() {
  const raw = $('rawBits')?.value || '';
  state.subject = ($('subjectName')?.value || 'General').trim() || 'General';
  if (!raw.trim()) { status('Questions Paste Box empty ga undhi.', 'err'); return; }
  if (state.open && state.questions.length) {
    syncFromEditor();
    state.open = false;
    renderEditor();
    status(`${state.questions.length} questions saved ✅. Malli Parse Questions press chesthe editor open avuthundi.`);
    return;
  }
  if (state.questions.length && !state.open) {
    state.open = true;
    renderEditor();
    status(`${state.questions.length} saved questions editor open అయ్యింది ✅`);
    return;
  }
  try {
    const result = parseQuestionsDetailed(raw, state.subject);
    state.questions = (result.questions || []).map(cloneQuestion);
    if (!state.questions.length) { status('Questions detect కాలేదు. Number + A/B/C/D format check చేయండి.', 'err'); return; }
    state.open = true;
    updateCount();
    renderEditor();
    status(`${state.questions.length} questions parsed ✅ · LOCAL-PARSER-V6`);
  } catch (err) {
    console.error(err);
    status(`Parser error: ${err?.message || err}`, 'err');
  }
}

function addQuestion() {
  syncFromEditor();
  state.subject = ($('subjectName')?.value || state.subject || 'General').trim() || 'General';
  state.questions.push(cloneQuestion(blankQuestion(state.subject), state.questions.length));
  state.open = true;
  updateCount(); renderEditor();
  setTimeout(() => document.querySelector('.localQuestionCard:last-child')?.scrollIntoView({behavior:'smooth', block:'center'}), 50);
  status('New question add అయ్యింది. Details fill చేయండి.');
}

function clearAll() {
  state.questions = []; state.open = false;
  if ($('rawBits')) $('rawBits').value = '';
  if ($('subjectQuestionCount')) $('subjectQuestionCount').value = '0';
  renderEditor(); renderHealth(); status('Parser clear అయ్యింది.');
}

function bind(id, handler) {
  const el = $(id); if (!el) return;
  el.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); handler(); }, true);
}
bind('parseBtn', parseNow);
bind('clearParserBtn', clearAll);
bind('addQuestionBtn', addQuestion);

status('Local Parser V6 ready ✅. Firebase load కాకపోయినా Parse పనిచేస్తుంది.');
renderHealth();
