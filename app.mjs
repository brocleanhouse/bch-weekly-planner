import { COLORS, localISO, parseISO, weekDates, createTask, createBlank, createExample, sanitizeState, summary } from './model.mjs';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const STORAGE_KEY = 'bch-weekly-planner:v1';
const palette = { blue: '#6293d5', green: '#60a58c', orange: '#d4a15e', purple: '#a085c4', pink: '#d88da8', gray: '#93a4ba' };
const paths = {
  print: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6zM18 12h.01"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  up: '<path d="m6 14 6-6 6 6"/>',
  down: '<path d="m6 10 6 6 6-6"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="m16 3 5 5-12 12-6 1 1-6L16 3ZM13 6l5 5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18m-13 4h2m4 0h2"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
};
function icon(name) { return `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`; }
function esc(value = '') { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
function hydrateIcons(root = document) { $$('[data-icon]', root).forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }

let state;
let storageAvailable = true;
let restored = false;
try {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) { state = sanitizeState(JSON.parse(stored)); restored = true; }
} catch { storageAvailable = false; }
if (!state) { state = createBlank(); state.tasks = [createTask()]; }
const collapsed = new Set();
let toastTimer;
let saveTimer;

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4200);
}
function saveNow() {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    storageAvailable = true;
    $('#saveStatus').textContent = '자동 저장됨';
    $('#saveStatus').classList.remove('error');
  } catch {
    storageAvailable = false;
    $('#saveStatus').textContent = '파일로 저장해 주세요';
    $('#saveStatus').classList.add('error');
  }
}
function saveSoon() {
  $('#saveStatus').textContent = storageAvailable ? '저장 중…' : '파일로 저장해 주세요';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 250);
}
function fullDate(iso) {
  const date = parseISO(iso);
  return date ? `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}` : '';
}
function dateRange() {
  const days = weekDates(state.meta.startDate);
  return days.length === 7 ? `${fullDate(days[0].iso)} (${days[0].weekday}) — ${fullDate(days[6].iso)} (${days[6].weekday})` : '';
}
function syncMetaFields() {
  $$('[data-meta]').forEach(el => { el.value = state.meta[el.dataset.meta] ?? ''; });
  $('#startDate').setCustomValidity('');
  $('#dateRange').textContent = dateRange();
}

function renderTasks() {
  const dates = weekDates(state.meta.startDate);
  $('#taskCount').textContent = state.tasks.length;
  $('#addTask').disabled = state.tasks.length >= 50;
  $('#taskList').innerHTML = state.tasks.map((task, index) => `
    <section class="task-card ${collapsed.has(task.id) ? 'is-collapsed' : ''}" data-task-id="${esc(task.id)}">
      <header class="task-card-header">
        <div class="task-index"><button class="icon-button collapse-button" data-action="collapse" type="button" aria-label="${index + 1}번 공정 접기 또는 펼치기" aria-expanded="${!collapsed.has(task.id)}">${icon('down')}</button><strong class="task-card-title"><span class="task-color-dot" style="--task-color:${palette[task.color]}"></span><span class="task-heading-text">${esc(task.name || `공정 ${String(index + 1).padStart(2, '0')}`)}</span></strong></div>
        <div class="task-actions">
          <button class="icon-button" data-action="up" type="button" aria-label="${index + 1}번 공정 위로" title="위로" ${index === 0 ? 'disabled' : ''}>${icon('up')}</button>
          <button class="icon-button" data-action="down" type="button" aria-label="${index + 1}번 공정 아래로" title="아래로" ${index === state.tasks.length - 1 ? 'disabled' : ''}>${icon('down')}</button>
          <button class="icon-button" data-action="duplicate" type="button" aria-label="${index + 1}번 공정 복제" title="공정 복제" ${state.tasks.length >= 50 ? 'disabled' : ''}>${icon('copy')}</button>
          <button class="icon-button danger" data-action="delete" type="button" aria-label="${index + 1}번 공정 삭제" title="삭제">${icon('trash')}</button>
        </div>
      </header>
      <div class="task-form">
        <div class="form-grid">
          <div class="field full"><label for="name-${esc(task.id)}">공정명</label><input id="name-${esc(task.id)}" data-field="name" maxlength="80" value="${esc(task.name)}" placeholder="예: 탄성코트 시공"></div>
          <div class="field full"><label for="contractor-${esc(task.id)}">시공 업체 / 담당 <span class="optional">선택</span></label><input id="contractor-${esc(task.id)}" data-field="contractor" maxlength="60" value="${esc(task.contractor)}" placeholder="예: 브로클린하우스, 타 업체"></div>
          <div class="field full"><label for="detail-${esc(task.id)}">작업 내용 <span class="optional">선택</span></label><input id="detail-${esc(task.id)}" data-field="detail" maxlength="200" value="${esc(task.detail)}" placeholder="예: 베란다·다용도실"></div>
        </div>
        <div class="color-field"><span class="field-label">공정 색상</span><div class="color-picker" role="group" aria-label="공정 ${index + 1} 색상">${COLORS.map(color => `<button type="button" data-action="color" data-color="${color.id}" class="${task.color === color.id ? 'selected' : ''}" style="background:${palette[color.id]}" aria-label="${color.label}" aria-pressed="${task.color === color.id}" title="${color.label}"></button>`).join('')}</div></div>
        <div class="slot-selector" role="group" aria-label="공정 ${index + 1} 작업 시간">${dates.map((date, day) => `
          <div class="slot-day ${date.weekend ? 'weekend' : ''}"><div class="slot-date">${date.label}<span>${date.weekday}</span></div><div class="slot-buttons">${[0, 1].map(period => `<button type="button" data-action="slot" data-slot="${day * 2 + period}" class="${task.slots[day * 2 + period] ? 'selected' : ''}" aria-label="${date.label} ${date.weekday} ${period ? '오후' : '오전'}" aria-pressed="${task.slots[day * 2 + period]}">${period ? '오후' : '오전'}</button>`).join('')}</div></div>`).join('')}</div>
        <div class="slot-batch"><button class="btn btn-ghost btn-small" data-action="all" type="button">일주일 종일</button><button class="btn btn-ghost btn-small" data-action="clear" type="button">시간 비우기</button></div>
      </div>
    </section>`).join('');
  if (!state.tasks.length) $('#taskList').innerHTML = '<div class="empty-state"><strong>첫 공정을 추가해 주세요.</strong><p>공정명을 입력하고 오전·오후를 선택하면<br>공정표에 바로 표시됩니다.</p></div>';
}

function renderPaper() {
  const { meta, tasks } = state;
  const dates = weekDates(meta.startDate);
  const today = localISO();
  const dateClass = date => `${date.weekend ? 'weekend' : ''} ${date.iso === today ? 'today' : ''}`;
  const hasDetails = tasks.some(task => task.detail.trim());
  const rows = tasks.map((task, index) => `<tr data-print-task="${esc(task.id)}">
    <th scope="row"><div class="task-name ${task.name ? '' : 'task-empty-label'}"><span class="task-color-dot" style="--task-color:${palette[task.color]}"></span>${esc(task.name || '공정명 입력')}</div>${task.detail ? `<div class="task-detail">${esc(task.detail)}</div>` : ''}</th>
    <td class="contractor-cell">${esc(task.contractor || '—')}</td>
    ${dates.map((date, day) => [0, 1].map(period => {
      const slot = day * 2 + period;
      const selected = task.slots[slot];
      return `<td class="slot ${period ? 'pm' : 'am'} ${dateClass(date)} ${selected ? `scheduled color-${task.color}` : ''}"><button type="button" class="slot-button" data-paper-task="${esc(task.id)}" data-paper-slot="${slot}" aria-label="${esc(task.name || `공정 ${index + 1}`)} ${date.label} ${period ? '오후' : '오전'} ${selected ? '선택됨' : '선택 안 됨'}" aria-pressed="${selected}">${selected ? '<span class="slot-dot" aria-hidden="true">●</span>' : '<span class="blank-mark" aria-hidden="true">+</span>'}</button></td>`;
    }).join('')).join('')}</tr>`).join('');
  const fillerCount = Math.max(0, 6 - tasks.length);
  const fillerRows = Array.from({ length: fillerCount }, (_, index) => `<tr class="empty-row" aria-hidden="true"><td>${tasks.length === 0 && index === 0 ? '<span class="task-empty-label">공정 추가 후 입력</span>' : '&nbsp;'}</td><td></td>${Array.from({ length: 14 }, () => '<td></td>').join('')}</tr>`).join('');
  $('#printArea').innerHTML = `
    <header class="paper-header">
      <div class="paper-brand"><div class="wordmark">Bro<em>Clean</em>House<small>CLEAN SPACE FOR A BRIGHTER TOMORROW</small></div><div class="paper-company-label">${esc(meta.company || '브로클린하우스')}</div></div>
      <div class="paper-heading paper-title-block"><p class="period-tag">WEEKLY CONSTRUCTION SCHEDULE</p><h2 class="paper-title">${esc(meta.title || '주간 공정표')}</h2>${meta.site ? `<p class="paper-site">${esc(meta.site)}</p>` : ''}<p class="paper-subtitle">${dateRange()}</p></div>
    </header>
    <dl class="paper-meta"><div class="meta-address"><dt>현장</dt><dd>${esc(meta.address || meta.site || '현장명 입력')}</dd></div><div><dt>담당자</dt><dd>${esc(meta.manager || '—')}</dd></div><div><dt>연락처</dt><dd>${esc(meta.phone || '—')}</dd></div></dl>
    <table class="schedule-table" aria-label="7일 오전 오후 공정표"><colgroup><col class="process-col"><col class="contractor-col">${Array.from({ length: 14 }, () => '<col>').join('')}</colgroup>
      <thead><tr><th scope="col" rowspan="2" class="process-head">공정 / 작업 내용</th><th scope="col" rowspan="2">업체 / 담당</th>${dates.map(date => `<th scope="colgroup" colspan="2" class="${dateClass(date)}"><span class="date-number">${date.label} <span class="day-name">(${date.weekday})</span></span></th>`).join('')}</tr><tr>${dates.map(date => `<th scope="col" class="am ${dateClass(date)}">오전</th><th scope="col" class="pm ${dateClass(date)}">오후</th>`).join('')}</tr></thead>
      <tbody>${rows}${fillerRows}</tbody>
    </table>
    <div class="paper-legend"><span><i class="legend-dot"></i>작업 예정 시간</span><span>오전·오후 모두 표시하면 종일 작업</span>${hasDetails ? '<span>세부 내용은 공정명 아래에 표시</span>' : ''}</div>
    ${meta.notes.trim() ? `<section class="paper-notes"><h3>안내사항</h3><p class="notes-lines">${esc(meta.notes)}</p></section>` : ''}
    <footer class="paper-footer"><div><strong>${esc(meta.company || '브로클린하우스')}</strong><p>WEEKLY CONSTRUCTION SCHEDULE</p></div><div class="footer-contact">${esc([meta.manager, meta.phone].filter(Boolean).join(' · '))}</div></footer>`;
  const stats = summary(state);
  $('#summaryProcesses').textContent = `${stats.processes}개`;
  $('#summaryDays').textContent = `${stats.activeDays}일`;
  $('#summarySlots').textContent = `${stats.slots}칸`;
  $('#dateRange').textContent = dateRange();
  requestAnimationFrame(fitPaper);
}
function fitPaper() {
  if (window.matchMedia('print').matches) return;
  const scroll = $('#previewScroll');
  if (!scroll.clientWidth) return;
  const styles = getComputedStyle(scroll);
  const available = scroll.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
  const scale = Math.min(1, Math.max(window.innerWidth <= 760 ? .66 : .35, available / 1123));
  const paper = $('#printArea');
  paper.style.transform = `scale(${scale})`;
  $('#paperStage').style.width = `${1123 * scale}px`;
  $('#paperStage').style.height = `${paper.offsetHeight * scale}px`;
}
function renderAll() { syncMetaFields(); renderTasks(); renderPaper(); saveSoon(); }
function changed() { renderPaper(); saveSoon(); }

$$('[data-meta]').forEach(input => input.addEventListener('input', event => {
  const { meta } = event.target.dataset;
  if (meta === 'startDate') {
    const dates = weekDates(event.target.value);
    if (dates.length !== 7) { event.target.setCustomValidity('7일 일정을 만들 수 있는 올바른 시작일을 입력해 주세요.'); return; }
    event.target.setCustomValidity('');
    state.meta.startDate = event.target.value;
    renderTasks();
  } else state.meta[meta] = event.target.value;
  changed();
}));
$('#metaForm').addEventListener('submit', event => event.preventDefault());
$('#taskList').addEventListener('input', event => {
  const input = event.target.closest('[data-field]');
  if (!input) return;
  const card = input.closest('[data-task-id]');
  const task = state.tasks.find(item => item.id === card.dataset.taskId);
  if (!task) return;
  task[input.dataset.field] = input.value;
  if (input.dataset.field === 'name') $('.task-heading-text', card).textContent = task.name || `공정 ${String(state.tasks.indexOf(task) + 1).padStart(2, '0')}`;
  changed();
});

function mutateTask(id, action, button) {
  const index = state.tasks.findIndex(task => task.id === id);
  if (index < 0) return;
  const task = state.tasks[index];
  let refresh = true;
  switch (action) {
    case 'slot': {
      const slot = Number(button.dataset.slot);
      if (!Number.isInteger(slot) || slot < 0 || slot > 13) return;
      task.slots[slot] = !task.slots[slot];
      button.classList.toggle('selected', task.slots[slot]);
      button.setAttribute('aria-pressed', String(task.slots[slot]));
      refresh = false;
      break;
    }
    case 'collapse': {
      const card = button.closest('[data-task-id]');
      if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
      card.classList.toggle('is-collapsed', collapsed.has(id));
      button.setAttribute('aria-expanded', String(!collapsed.has(id)));
      return;
    }
    case 'color': task.color = button.dataset.color; break;
    case 'all': task.slots.fill(true); break;
    case 'clear': task.slots.fill(false); break;
    case 'delete': state.tasks.splice(index, 1); collapsed.delete(id); toast('공정을 삭제했습니다.'); break;
    case 'duplicate': if (state.tasks.length >= 50) return; state.tasks.splice(index + 1, 0, createTask({ ...task, id: undefined, slots: [...task.slots] })); break;
    case 'up': if (index === 0) return; [state.tasks[index - 1], state.tasks[index]] = [state.tasks[index], state.tasks[index - 1]]; break;
    case 'down': if (index === state.tasks.length - 1) return; [state.tasks[index], state.tasks[index + 1]] = [state.tasks[index + 1], state.tasks[index]]; break;
    default: return;
  }
  if (refresh) renderTasks();
  changed();
}
$('#taskList').addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (button) mutateTask(button.closest('[data-task-id]').dataset.taskId, button.dataset.action, button);
});
$('#printArea').addEventListener('click', event => {
  const button = event.target.closest('[data-paper-task]');
  if (!button) return;
  const task = state.tasks.find(item => item.id === button.dataset.paperTask);
  if (!task) return;
  const slot = Number(button.dataset.paperSlot);
  task.slots[slot] = !task.slots[slot];
  const card = $$('[data-task-id]').find(el => el.dataset.taskId === task.id);
  const editorButton = card && $(`[data-slot="${slot}"]`, card);
  if (editorButton) { editorButton.classList.toggle('selected', task.slots[slot]); editorButton.setAttribute('aria-pressed', String(task.slots[slot])); }
  changed();
  requestAnimationFrame(() => {
    const newButton = $$('[data-paper-task]').find(el => el.dataset.paperTask === task.id && Number(el.dataset.paperSlot) === slot);
    newButton?.focus({ preventScroll: true });
  });
});
$('#addTask').addEventListener('click', () => {
  if (state.tasks.length >= 50) { toast('공정은 최대 50개까지 추가할 수 있습니다.'); return; }
  const task = createTask();
  state.tasks.push(task);
  renderTasks(); changed();
  const input = document.getElementById(`name-${task.id}`);
  input?.focus();
});

function confirmChange(title, message, label = '계속') {
  const dialog = $('#confirmDialog');
  $('#confirmTitle').textContent = title;
  $('#confirmText').textContent = message;
  $('#confirmOk').textContent = label;
  return new Promise(resolve => {
    const cleanup = () => { $('#confirmOk').removeEventListener('click', okay); $('#confirmCancel').removeEventListener('click', cancel); dialog.removeEventListener('cancel', cancel); };
    const finish = result => { cleanup(); dialog.close(); resolve(result); };
    const okay = () => finish(true);
    const cancel = event => { event?.preventDefault(); finish(false); };
    $('#confirmOk').addEventListener('click', okay);
    $('#confirmCancel').addEventListener('click', cancel);
    dialog.addEventListener('cancel', cancel);
    dialog.showModal();
  });
}
function hasWork() {
  const defaults = createBlank(state.meta.startDate).meta;
  return state.tasks.some(task => task.name || task.contractor || task.detail || task.slots.some(Boolean))
    || Object.keys(defaults).some(key => key !== 'startDate' && state.meta[key] !== defaults[key]);
}
function validDateForAction() {
  const date = $('#startDate');
  if (date.checkValidity()) return true;
  document.body.dataset.mobileView = 'edit';
  document.body.classList.remove('preview-only');
  syncViewButtons();
  date.reportValidity();
  toast('시작일에 올바른 날짜를 입력해 주세요.');
  return false;
}
$('#newBtn').addEventListener('click', async () => {
  if (hasWork() && !await confirmChange('빈 공정표로 시작할까요?', '현재 입력 내용이 새 공정표로 바뀝니다.\n필요한 일정은 먼저 ‘파일로 저장’해 주세요.', '새로 시작')) return;
  state = createBlank(state.meta.startDate); state.tasks = [createTask()]; collapsed.clear();
  renderAll(); toast('빈 공정표를 만들었습니다.');
});
$('#exampleBtn').addEventListener('click', async () => {
  if (hasWork() && !await confirmChange('예시 일정을 불러올까요?', '현재 입력 내용이 6개 공정의 예시 일정으로 바뀝니다.\n시작일은 현재 설정한 날짜를 사용합니다.', '예시 불러오기')) return;
  state = createExample(state.meta.startDate); collapsed.clear(); state.tasks.slice(1).forEach(task => collapsed.add(task.id));
  renderAll(); toast('예시입니다. 공정과 날짜를 현장에 맞게 수정해 주세요.');
});
$('#exportBtn').addEventListener('click', () => {
  if (!validDateForAction()) return;
  saveNow();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json;charset=utf-8' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `${(state.meta.site || state.meta.title || '주간공정표').replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_').slice(0, 60)}_${state.meta.startDate}.json`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('공정표 파일을 저장했습니다. ‘불러오기’로 다시 열 수 있습니다.');
});
$('#importBtn').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { toast('2MB 이하의 공정표 JSON 파일을 선택해 주세요.'); return; }
  let imported;
  try { imported = sanitizeState(JSON.parse(await file.text())); }
  catch (error) { toast(error instanceof SyntaxError ? '공정표 JSON 파일 형식을 확인해 주세요.' : error.message); return; }
  if (!weekDates(imported.meta.startDate).length) { toast('7일 일정을 만들 수 있는 시작일인지 확인해 주세요.'); return; }
  if (hasWork() && !await confirmChange('저장한 공정표를 불러올까요?', '현재 입력 내용이 선택한 파일의 공정표로 바뀝니다.', '불러오기')) return;
  state = imported; collapsed.clear(); state.tasks.slice(1).forEach(task => collapsed.add(task.id));
  $('#startDate').setCustomValidity(''); renderAll(); saveNow(); toast('공정표를 불러왔습니다.');
});

$('#printBtn').addEventListener('click', async () => {
  if (!validDateForAction()) return;
  if (!state.tasks.length) { toast('출력할 공정을 먼저 추가해 주세요.'); return; }
  const missing = state.tasks.find(task => !task.name.trim());
  if (missing) {
    collapsed.delete(missing.id); renderTasks();
    document.body.dataset.mobileView = 'edit';
    document.body.classList.remove('preview-only');
    syncViewButtons();
    document.getElementById(`name-${missing.id}`)?.focus();
    toast('공정명을 입력해 주세요. 사용하지 않는 공정은 삭제할 수 있습니다.'); return;
  }
  saveNow();
  const printButton = $('#printBtn');
  printButton.disabled = true;
  printButton.setAttribute('aria-busy', 'true');
  printButton.querySelector('span:last-child').textContent = '인쇄 준비 중…';
  await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 2500))]);
  const previousTitle = document.title;
  document.title = `${state.meta.site ? `${state.meta.site} ` : ''}${state.meta.title || '주간 공정표'}_${state.meta.startDate}`;
  window.print();
  document.title = previousTitle;
  printButton.disabled = false;
  printButton.removeAttribute('aria-busy');
  printButton.querySelector('span:last-child').textContent = '인쇄 / PDF';
});
function syncViewButtons() {
  const full = document.body.classList.contains('preview-only');
  $('#fullView').classList.toggle('active', full); $('#fullView').setAttribute('aria-pressed', String(full));
  $('#editView').classList.toggle('active', !full); $('#editView').setAttribute('aria-pressed', String(!full));
  $$('.mobile-tabs [data-mobile-view]').forEach(button => { const active = button.dataset.mobileView === document.body.dataset.mobileView; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
  requestAnimationFrame(fitPaper);
}
$('#fullView').addEventListener('click', () => { document.body.classList.add('preview-only'); syncViewButtons(); });
$('#editView').addEventListener('click', () => { document.body.classList.remove('preview-only'); syncViewButtons(); });
$$('.mobile-tabs [data-mobile-view]').forEach(button => button.addEventListener('click', () => { document.body.dataset.mobileView = button.dataset.mobileView; syncViewButtons(); }));
window.addEventListener('resize', fitPaper);
window.addEventListener('afterprint', () => requestAnimationFrame(fitPaper));
window.addEventListener('pagehide', saveNow);
window.addEventListener('beforeunload', saveNow);
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => requestAnimationFrame(fitPaper)).observe($('#previewScroll'));
document.fonts.ready.then(fitPaper);
hydrateIcons(); syncMetaFields(); renderTasks(); renderPaper(); saveNow();
if (restored) $('#saveStatus').textContent = '이전 일정 불러옴';
