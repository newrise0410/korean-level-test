import { LEVEL_INFO } from '../data/items';
import { go } from '../lib/router';
import { attemptsOf, getAttempt, getSettings, getStudent, levelOf } from '../lib/store';
import { LevelTrend, SectionBars } from './Charts';

export default function Result({ id }: { id: string }) {
  const a = getAttempt(id);
  if (!a) return <div className="narrow card">결과를 찾을 수 없습니다.</div>;
  const s = getStudent(a.studentId);
  const settings = getSettings();
  const lv = levelOf(a);
  const history = attemptsOf(a.studentId);
  const prev = history[history.findIndex((h) => h.id === a.id) - 1];
  const diff = prev ? lv - levelOf(prev) : 0;

  return (
    <div className="narrow">
      <div className="card result">
        <p className="eyebrow">{s?.name} · {s?.studentNo}</p>
        <div className="badge">{lv}<small>급</small></div>
        <h2>{LEVEL_INFO[lv].title}</h2>
        {prev && (
          <p className={`delta ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}`}>
            지난 시험 대비 {diff > 0 ? `▲ ${diff}급 상승` : diff < 0 ? `▼ ${-diff}급` : '유지'} · Last test: Level {levelOf(prev)}
          </p>
        )}
        <p className="desc">{LEVEL_INFO[lv].desc}</p>
      </div>

      <div className="card">
        <h3>영역별 결과 <small>By section</small></h3>
        <SectionBars a={a} />
      </div>

      <div className="card reco">
        <h3>추천 교재 <small>Recommended textbook</small></h3>
        <p className="book">📘 {settings.textbooks[lv - 1]}</p>
      </div>

      {history.length > 1 && (
        <div className="card">
          <h3>나의 성장 기록 <small>My progress</small></h3>
          <LevelTrend attempts={history} />
        </div>
      )}

      <p className="muted center">
        쓰기·말하기 답안은 선생님이 확인한 뒤 최종 급이 확정될 수 있습니다.<br />
        Your teacher will review your writing and speaking to confirm the final level.
      </p>
      <button className="btn block" onClick={() => go('/')}>처음으로 · Home</button>
    </div>
  );
}
