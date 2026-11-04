import { ITEMS } from '../data/items';
import type { Attempt, Level, Settings, Student } from '../types';
import { initEngine, pickBlock, submitBlock } from './engine';

/**
 * 데이터 저장소. 데모는 브라우저 localStorage를 쓴다.
 * 실서비스에서는 이 모듈만 서버 API(예: Supabase/Firebase/자체 서버) 호출로 바꾸면 된다.
 */
const K = { students: 'klt.students', attempts: 'klt.attempts', settings: 'klt.settings' };

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  localStorage.setItem(key, JSON.stringify(v));
}

export function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export const DEFAULT_SETTINGS: Settings = {
  institution: '○○대학교 한국어문화원',
  pin: '1234',
  textbooks: [1, 2, 3, 4, 5, 6].map((n) => `○○ 한국어 ${n}`),
};

export const getSettings = (): Settings => ({ ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(K.settings, {}) });
export const saveSettings = (s: Settings) => write(K.settings, s);

export const getStudents = () => read<Student[]>(K.students, []);
export const getAttempts = () => read<Attempt[]>(K.attempts, []);
export const getStudent = (id: string) => getStudents().find((s) => s.id === id);
export const getAttempt = (id: string) => getAttempts().find((a) => a.id === id);

export function upsertStudent(input: Omit<Student, 'id' | 'createdAt'>): Student {
  const all = getStudents();
  const existing = all.find((s) => s.studentNo === input.studentNo);
  if (existing) {
    Object.assign(existing, input);
    write(K.students, all);
    return existing;
  }
  const s: Student = { ...input, id: uid(), createdAt: new Date().toISOString() };
  write(K.students, [...all, s]);
  return s;
}

export function saveAttempt(a: Attempt) {
  const all = getAttempts().filter((x) => x.id !== a.id);
  write(K.attempts, [...all, a]);
}

export function attemptsOf(studentId: string): Attempt[] {
  return getAttempts()
    .filter((a) => a.studentId === studentId)
    .sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
}

export const levelOf = (a: Attempt): Level => a.finalLevel ?? a.autoLevel;

// ─── 현재 응시자 세션 ───
export function setCurrent(studentId: string, start: Level) {
  sessionStorage.setItem('klt.current', JSON.stringify({ studentId, start }));
}
export function getCurrent(): { studentId: string; start: Level } | null {
  try {
    return JSON.parse(sessionStorage.getItem('klt.current') || 'null');
  } catch {
    return null;
  }
}

// ─── 데모 데이터 ───
const NAMES: [string, string][] = [
  ['Nguyen Van An', '베트남'], ['Tran Thi Mai', '베트남'], ['Le Hoang Nam', '베트남'], ['Pham Thu Ha', '베트남'],
  ['Wang Hao', '중국'], ['Li Na', '중국'], ['Zhang Wei', '중국'], ['Chen Yu', '중국'], ['Liu Yang', '중국'],
  ['Tanaka Yui', '일본'], ['Sato Ren', '일본'], ['Bat-Erdene', '몽골'], ['Enkhjin', '몽골'],
  ['Aziz Karimov', '우즈베키스탄'], ['Dilnoza Rahimova', '우즈베키스탄'], ['Sardor Tursunov', '우즈베키스탄'],
  ['Ram Shrestha', '네팔'], ['Sita Gurung', '네팔'], ['Anna Müller', '독일'], ['Lucas Martin', '프랑스'],
  ['Maria Garcia', '스페인'], ['Emily Johnson', '미국'], ['Siti Rahma', '인도네시아'], ['Arjun Patel', '인도'],
];

export function seedDemo() {
  const students: Student[] = [];
  const attempts: Attempt[] = [];
  const rand = mulberry32(42);
  const dates = ['2026-03-09', '2026-06-08', '2026-09-07'];

  NAMES.forEach(([name, nat], i) => {
    const base = 1 + rand() * 4.2; // 시작 실력
    const sid = uid();
    const firstLevel = Math.max(1, Math.min(6, Math.round(base))) as Level;
    students.push({
      id: sid, name, nationality: nat,
      studentNo: `2026${String(1001 + i)}`,
      className: `${firstLevel}급 ${'ABC'[i % 3]}반`,
      createdAt: dates[0],
    });
    const nAttempts = 1 + Math.floor(rand() * 3);
    let ability = base;
    let prev = new Set<string>();
    for (let k = 0; k < nAttempts; k++) {
      const { attempt, used } = simulate(sid, ability, dates[k], rand, prev);
      prev = used;
      attempts.push(attempt);
      ability += 0.6 + rand() * 0.7; // 한 학기 동안 성장
    }
  });
  write(K.students, students);
  write(K.attempts, attempts);
}

function simulate(studentId: string, ability: number, date: string, rand: () => number, avoid: Set<string>) {
  let s = initEngine(Math.max(1, Math.min(4, Math.round(ability - 0.5))) as Level);
  const answers: Attempt['answers'] = [];
  while (!s.done) {
    const block = pickBlock(s, ITEMS, avoid, rand);
    let c = 0;
    for (const it of block) {
      const p = 1 / (1 + Math.exp(-2.2 * (ability - it.level + 0.4)));
      const ok = rand() < p;
      if (ok) c++;
      answers.push({ itemId: it.id, level: it.level, section: it.section, chosen: ok ? it.choices[it.answer] : it.choices[1], correct: ok });
    }
    s = submitBlock(s, block, c);
  }
  const t = new Date(date + 'T10:00:00+09:00');
  t.setMinutes(t.getMinutes() + Math.floor(rand() * 300));
  const attempt: Attempt = {
    id: uid(), studentId,
    startedAt: t.toISOString(),
    finishedAt: new Date(t.getTime() + (14 + rand() * 10) * 60000).toISOString(),
    autoLevel: s.result!, answers, blocks: s.blocks,
  };
  return { attempt, used: new Set(s.used) };
}

function mulberry32(a: number) {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clearAll() {
  localStorage.removeItem(K.students);
  localStorage.removeItem(K.attempts);
}

export function exportCsv(): string {
  const students = new Map(getStudents().map((s) => [s.id, s]));
  const rows = [['학번', '이름', '국적', '반', '응시일', '자동판정', '최종급', '어휘', '문법', '읽기', '듣기', '쓰기(교사)', '말하기(교사)', '메모']];
  for (const a of getAttempts().sort((x, y) => x.finishedAt.localeCompare(y.finishedAt))) {
    const s = students.get(a.studentId);
    const sec = (k: string) => {
      const r = a.answers.filter((x) => x.section === k);
      return r.length ? `${r.filter((x) => x.correct).length}/${r.length}` : '';
    };
    rows.push([
      s?.studentNo ?? '', s?.name ?? '', s?.nationality ?? '', s?.className ?? '',
      a.finishedAt.slice(0, 10), String(a.autoLevel), String(levelOf(a)),
      sec('vocab'), sec('grammar'), sec('reading'), sec('listening'),
      a.teacherWriting ? String(a.teacherWriting) : '', a.teacherSpeaking ? String(a.teacherSpeaking) : '', a.teacherNote ?? '',
    ]);
  }
  return '﻿' + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\r\n');
}
