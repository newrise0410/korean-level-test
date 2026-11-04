import type { Attempt } from '../types';
import { SECTIONS, SECTION_LABEL } from '../types';
import { levelOf } from '../lib/store';

export function sectionStats(a: Attempt) {
  return SECTIONS.map((s) => {
    const r = a.answers.filter((x) => x.section === s);
    const c = r.filter((x) => x.correct).length;
    // 어려운 급 문항을 맞힐수록 가중치를 크게: 급별 정답 가중 평균
    const weighted = r.length ? r.reduce((sum, x) => sum + (x.correct ? x.level : 0), 0) / r.reduce((s2, x) => s2 + x.level, 0) : 0;
    return { section: s, label: SECTION_LABEL[s], correct: c, total: r.length, pct: Math.round(weighted * 100) };
  });
}

export function SectionBars({ a }: { a: Attempt }) {
  return (
    <div className="sbars">
      {sectionStats(a).map((s) => (
        <div key={s.section} className="sbar">
          <span>{s.label}</span>
          <div className="bar"><i style={{ width: `${s.pct}%` }} /></div>
          <b>{s.correct}/{s.total}</b>
        </div>
      ))}
    </div>
  );
}

/** 급 변화 추이 (1~6) */
export function LevelTrend({ attempts }: { attempts: Attempt[] }) {
  if (attempts.length === 0) return null;
  const W = 520, H = 180, P = 32;
  const n = attempts.length;
  const x = (i: number) => (n === 1 ? W / 2 : P + (i * (W - P * 2)) / (n - 1));
  const y = (l: number) => H - P - ((l - 1) * (H - P * 2)) / 5;
  const pts = attempts.map((a, i) => [x(i), y(levelOf(a))] as const);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="trend" role="img" aria-label="급 변화 추이">
      {[1, 2, 3, 4, 5, 6].map((l) => (
        <g key={l}>
          <line x1={P} x2={W - 8} y1={y(l)} y2={y(l)} className="grid" />
          <text x={8} y={y(l) + 4} className="axis">{l}급</text>
        </g>
      ))}
      <polyline points={pts.map((p) => p.join(',')).join(' ')} className="line" />
      {pts.map(([px, py], i) => (
        <g key={i}>
          <circle cx={px} cy={py} r={5} className="dot" />
          <text x={px} y={H - 8} textAnchor="middle" className="axis">{attempts[i].finishedAt.slice(2, 10).replace(/-/g, '.')}</text>
        </g>
      ))}
    </svg>
  );
}

export function Distribution({ counts }: { counts: number[] }) {
  const max = Math.max(1, ...counts);
  return (
    <div className="dist">
      {counts.map((c, i) => (
        <div key={i} className="dcol">
          <b>{c}</b>
          <div className="dbar" style={{ height: `${(c / max) * 100}%` }} />
          <span>{i + 1}급</span>
        </div>
      ))}
    </div>
  );
}
