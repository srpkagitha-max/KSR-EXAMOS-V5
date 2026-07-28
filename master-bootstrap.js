import './firebase-config.js';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const status = (message, type='loading') => {
  const box = $('masterLoadStatus');
  if (!box) return;
  box.className = `masterLoadStatus ${type}`;
  box.textContent = message;
};

function decodeValue(value) {
  if (!value || typeof value !== 'object') return value;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {});
  return value;
}
function decodeFields(fields={}) {
  return Object.fromEntries(Object.entries(fields).map(([k,v]) => [k, decodeValue(v)]));
}

async function fetchCollection(name) {
  const cfg = window.KSR_FIREBASE_CONFIG || {};
  if (!cfg.projectId || !cfg.apiKey) throw new Error('Firebase config missing');
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}/databases/(default)/documents/${encodeURIComponent(name)}?pageSize=1000&key=${encodeURIComponent(cfg.apiKey)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {cache:'no-store', signal: controller.signal});
    if (!response.ok) throw new Error(`${name} REST ${response.status}`);
    const payload = await response.json();
    return (payload.documents || []).map(doc => ({
      id: String(doc.name || '').split('/').pop(),
      ...decodeFields(doc.fields || {})
    }));
  } finally {
    clearTimeout(timer);
  }
}

let institutes = [];
let batches = [];

function renderBatches() {
  const instituteId = String($('instituteId')?.value || '');
  const select = $('batchId');
  if (!select) return;
  const rows = batches.filter(b => String(b.instituteId || '') === instituteId && b.active !== false);
  select.innerHTML = instituteId
    ? (rows.length ? '<option value="">Select Batch</option>' + rows.map(b => `<option value="${esc(b.id)}">${esc(b.name || b.batchName || 'Batch')}</option>`).join('') : '<option value="">No batches found</option>')
    : '<option value="">Select institute first</option>';
  select.disabled = false;
}

async function updateStudents() {
  const instituteId = String($('instituteId')?.value || '');
  const batchId = String($('batchId')?.value || '');
  const active = $('activeStudentCount');
  if (!active) return;
  if (!instituteId || !batchId) { active.value = '0'; return; }
  try {
    const students = await fetchCollection('studentMaster');
    const count = students.filter(s => String(s.instituteId || '') === instituteId && String(s.batchId || '') === batchId && s.active !== false && !['inactive','hold','deleted'].includes(String(s.status || 'active').toLowerCase())).length;
    active.value = String(count);
    const backup = Math.max(0, Number($('backupCodeCount')?.value || 10));
    if ($('codeCount')) $('codeCount').value = String(count + backup);
    active.dispatchEvent(new Event('input', {bubbles:true}));
  } catch (error) {
    console.warn('[KSR bootstrap] student count failed', error);
  }
}

async function loadMastersBootstrap() {
  const instituteSelect = $('instituteId');
  const batchSelect = $('batchId');
  if (!instituteSelect || !batchSelect) return;
  status('Direct master loader starting...', 'loading');
  instituteSelect.disabled = true;
  batchSelect.disabled = true;
  instituteSelect.innerHTML = '<option value="">Loading institutes...</option>';
  batchSelect.innerHTML = '<option value="">Select institute first</option>';
  try {
    [institutes, batches] = await Promise.all([fetchCollection('institutes'), fetchCollection('batches')]);
    institutes = institutes.filter(x => x.active !== false);
    batches = batches.filter(x => x.active !== false);
    instituteSelect.innerHTML = institutes.length
      ? '<option value="">Select Institute</option>' + institutes.map(i => `<option value="${esc(i.id)}">${esc(i.name || i.instituteName || 'Institute')}</option>`).join('')
      : '<option value="">No institutes found</option>';
    instituteSelect.disabled = false;
    renderBatches();
    status(`${institutes.length} institute, ${batches.length} batch loaded ✅`, 'ok');
  } catch (error) {
    instituteSelect.disabled = false;
    batchSelect.disabled = false;
    instituteSelect.innerHTML = '<option value="">Institute load failed</option>';
    batchSelect.innerHTML = '<option value="">Batch load failed</option>';
    status(`Direct loader failed: ${error.message || error}`, 'err');
    console.error('[KSR bootstrap] master load failed', error);
  }
}

$('instituteId')?.addEventListener('change', () => { renderBatches(); updateStudents(); });
$('batchId')?.addEventListener('change', updateStudents);
$('refreshMastersBtn')?.addEventListener('click', loadMastersBootstrap);
window.KSRBootstrapLoadMasters = loadMastersBootstrap;
loadMastersBootstrap();

// admin-daily.js is loaded once by dashboard.html.
