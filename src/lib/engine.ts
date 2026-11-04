import type { BlockResult, Item, Level } from '../types';
import { SECTIONS } from '../types';

/**
 * 블록 적응형(Block-adaptive) 판정 엔진.
 *  - 한 블록 = 같은 급의 어휘·문법·읽기·듣기 각 1문항(4문항)
 *  - 75% 이상 정답 → 통과, 한 급 위로 / 25% 이하 → 미달, 한 급 아래로 / 그 사이 → 그 급으로 판정
 *  - 통과한 급 바로 위가 미달이면 통과한 급으로, 미달한 급 바로 아래가 통과면 그 아래 급으로 확정
 * 각 급은 최대 한 번만 방문하므로 블록 수는 최대 6개(24문항)다.
 */
export const BLOCK_SIZE = 4;
const PASS = 0.75;
const FAIL = 0.25;

export interface EngineState {
  level: Level;
  passed: Level[];
  failed: Level[];
  used: string[];
  blocks: BlockResult[];
  done: boolean;
  result?: Level;
}

export function initEngine(start: Level): EngineState {
  return { level: start, passed: [], failed: [], used: [], blocks: [], done: false };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 현재 급에서 영역별 1문항씩 뽑는다. avoid(직전 응시 문항)는 가능하면 피한다. */
export function pickBlock(state: EngineState, bank: Item[], avoid: Set<string> = new Set(), rng = Math.random): Item[] {
  const pool = bank.filter((i) => i.level === state.level && !state.used.includes(i.id));
  const picked: Item[] = [];
  for (const sec of SECTIONS) {
    const cands = pool.filter((i) => i.section === sec);
    const fresh = cands.filter((i) => !avoid.has(i.id));
    const choice = shuffle(fresh.length ? fresh : cands, rng)[0];
    if (choice) picked.push(choice);
  }
  // 영역 문항이 부족하면 같은 급의 남은 문항으로 채움
  for (const i of shuffle(pool, rng)) {
    if (picked.length >= BLOCK_SIZE) break;
    if (!picked.includes(i)) picked.push(i);
  }
  return picked;
}

function step(level: Level, d: 1 | -1): Level {
  return Math.min(6, Math.max(1, level + d)) as Level;
}

export function submitBlock(state: EngineState, items: Item[], correct: number): EngineState {
  const total = items.length;
  const L = state.level;
  const s: EngineState = {
    ...state,
    used: [...state.used, ...items.map((i) => i.id)],
    blocks: [...state.blocks, { level: L, correct, total }],
    passed: [...state.passed],
    failed: [...state.failed],
  };
  const finish = (r: Level): EngineState => ({ ...s, done: true, result: r });
  const ratio = total ? correct / total : 0;

  if (ratio >= PASS) {
    s.passed.push(L);
    if (L === 6 || s.failed.includes(step(L, 1))) return finish(L);
    return { ...s, level: step(L, 1) };
  }
  if (ratio <= FAIL) {
    s.failed.push(L);
    if (L === 1) return finish(1);
    if (s.passed.includes(step(L, -1))) return finish(step(L, -1));
    return { ...s, level: step(L, -1) };
  }
  return finish(L);
}

/** 학습 기간 자가 응답 → 시작 급 */
export const START_OPTIONS: { label: string; level: Level }[] = [
  { label: '처음 배워요 / Just started (0–6 months)', level: 1 },
  { label: '6개월~1년 / 6 months – 1 year', level: 2 },
  { label: '1~2년 / 1–2 years', level: 3 },
  { label: '2년 이상 / More than 2 years', level: 4 },
];
