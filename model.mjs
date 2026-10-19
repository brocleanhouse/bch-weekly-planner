export const COLORS = Object.freeze([
  { id: 'blue', label: '파랑' },
  { id: 'green', label: '초록' },
  { id: 'orange', label: '주황' },
  { id: 'purple', label: '보라' },
  { id: 'pink', label: '분홍' },
  { id: 'gray', label: '회색' },
]);

export const WEEKDAYS = Object.freeze(['일', '월', '화', '수', '목', '금', '토']);

const COLOR_IDS = new Set(COLORS.map(({ id }) => id));
const META_LIMITS = Object.freeze({
  title: 60, site: 100, address: 180, manager: 50, phone: 40, company: 60, notes: 2000,
});

export function uid() {
  return globalThis.crypto?.randomUUID?.()
    ?? `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export function localISO(date = new Date()) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return '';
  const year = date.getFullYear();
  if (year < 1000 || year > 9999) return '';
  return `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseISO(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Local noon keeps date arithmetic stable across ordinary daylight-saving changes.
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function addDays(iso, count) {
  const date = parseISO(iso);
  if (!date || !Number.isInteger(count)) return '';
  date.setDate(date.getDate() + count);
  return localISO(date);
}

export function weekDates(iso) {
  if (!parseISO(iso)) return [];
  const result = [];
  for (let day = 0; day < 7; day += 1) {
    const nextISO = addDays(iso, day);
    const date = parseISO(nextISO);
    if (!date) return [];
    const weekday = date.getDay();
    result.push({
      iso: nextISO,
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      weekday: WEEKDAYS[weekday],
      weekend: weekday === 0 || weekday === 6,
    });
  }
  return result;
}

function cleanText(value, limit, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, limit);
}

function safeSlots(value) {
  return Array.from({ length: 14 }, (_, index) => Array.isArray(value) && value[index] === true);
}

export function createTask(overrides = {}) {
  const source = overrides && typeof overrides === 'object' ? overrides : {};
  return {
    id: cleanText(source.id, 100) || uid(),
    name: cleanText(source.name, 80),
    contractor: cleanText(source.contractor, 60),
    detail: cleanText(source.detail, 200),
    color: COLOR_IDS.has(source.color) ? source.color : 'blue',
    slots: safeSlots(source.slots),
  };
}

export function createBlank(startDate = localISO()) {
  if (weekDates(startDate).length !== 7) {
    throw new Error('7일 일정을 만들 수 있는 올바른 시작 날짜를 입력해 주세요.');
  }
  return {
    version: 1,
    meta: {
      title: '주간 공정표',
      site: '',
      address: '',
      manager: '',
      phone: '010-5940-4804',
      startDate,
      notes: '',
      company: '브로클린하우스',
    },
    tasks: [],
  };
}

export function createExample(startDate = localISO()) {
  const state = createBlank(startDate);
  state.meta.site = '우리집 리모델링';
  state.meta.address = '서울시 강남구 · 101동 1001호';
  state.meta.manager = '현장 담당자';
  state.meta.notes = '현장 상황에 따라 일정이 조정될 수 있습니다.\n공정별 작업 전 담당자와 일정을 확인해 주세요.';
  const task = (name, contractor, color, selected, detail = '') => createTask({
    name, contractor, color, detail,
    slots: Array.from({ length: 14 }, (_, index) => selected.includes(index)),
  });
  state.tasks = [
    task('현장 인수 · 보양', '현장 담당', 'gray', [0, 1], '작업 구역 확인 및 바닥·출입구 보양'),
    task('탄성코트', '도장팀', 'blue', [2, 3], '베란다 탄성코트 시공'),
    task('양생', '', 'orange', [4, 5, 6, 7], '충분한 건조 후 다음 공정 진행'),
    task('케라폭시 줄눈', '줄눈팀', 'purple', [8, 9], '욕실·현관 줄눈 시공'),
    task('입주청소', '청소팀', 'green', [10, 11], '전체 공간 청소 및 마감 확인'),
    task('에어컨 설치', '설치팀', 'pink', [10], '오전 설치 · 청소팀과 동선 협의'),
  ];
  return state;
}

export function sanitizeState(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1) {
    throw new Error('지원하지 않는 공정표 파일입니다. 버전 1 파일을 선택해 주세요.');
  }
  if (!raw.meta || typeof raw.meta !== 'object' || Array.isArray(raw.meta)) {
    throw new Error('공정표 기본 정보가 없습니다.');
  }
  if (weekDates(raw.meta.startDate).length !== 7) {
    throw new Error('공정표의 시작 날짜로 7일 일정을 만들 수 없습니다.');
  }
  if (!Array.isArray(raw.tasks)) {
    throw new Error('공정 목록이 올바르지 않습니다.');
  }
  const state = createBlank(raw.meta.startDate);
  for (const [field, limit] of Object.entries(META_LIMITS)) {
    state.meta[field] = cleanText(raw.meta[field], limit, state.meta[field]);
  }
  const seenIDs = new Set();
  state.tasks = raw.tasks.slice(0, 50).map((source) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      throw new Error('공정 목록에 올바르지 않은 항목이 있습니다.');
    }
    const task = createTask(source);
    while (seenIDs.has(task.id)) task.id = uid();
    seenIDs.add(task.id);
    return task;
  });
  return state;
}

export function summary(state) {
  const activeDays = new Set();
  let slots = 0;
  for (const task of state.tasks) {
    for (let index = 0; index < 14; index += 1) {
      if (task.slots[index] === true) {
        slots += 1;
        activeDays.add(Math.floor(index / 2));
      }
    }
  }
  return { processes: state.tasks.length, activeDays: activeDays.size, slots };
}
