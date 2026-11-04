import { useEffect, useMemo, useState } from 'react';
import { LEVEL_INFO } from '../data/items';
import { loadRecording } from '../lib/media';
import { go } from '../lib/router';
import {
  attemptsOf, clearAll, exportCsv, getAttempts, getSettings, getStudent, getStudents,
  levelOf, saveAttempt, saveSettings, seedDemo,
} from '../lib/store';
import type { Attempt, Level, Settings } from '../types';
import { Distribution, LevelTrend, SectionBars } from './Charts';

export default function Admin({ sub }: { sub: string[] }) {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('klt.admin') === '1');
  if (!authed) return <Pin onOk={() => { sessionStorage.setItem('klt.admin', '1'); setAuthed(true); }} />;
  return (
    <div className="wide">
      <nav className="tabs">
        <a className={!sub[0] ? 'on' : ''} href="#/admin">대시보드</a>
        <a className={sub[0] === 'settings' ? 'on' : ''} href="#/admin/settings">설정</a>
      </nav>
      {sub[0] === 'student' && sub[1] ? <StudentDetail id={sub[1]} /> : sub[0] === 'settings' ? <SettingsPage /> : <Dashboard />}
    </div>
  );
}

function Pin({ onOk }: { onOk: () => void }) {
  const [v, setV] = useState('');
  const [err, setErr] = useState(false);
  return (
    <form className="narrow card" onSubmit={(e) => { e.preventDefault(); v === getSettings().pin ? onOk() : setErr(true); }}>
      <h2>관리자 로그인</h2>
      <label className="field"><span>PIN</span><input type="password" inputMode="numeric" value={v} onChange={(e) => setV(e.target.value)} autoFocus /></label>
      {err && <p className="error">PIN이 올바르지 않습니다.</p>}
      <p className="muted">데모 PIN: 1234</p>
      <button className="btn primary block">들어가기</button>
    </form>
  );
}

function Dashboard() {
  const [ver, setVer] = useState(0);
  const [cls, setCls] = useState('');
  const [q, setQ] = useState('');
  const students = useMemo(getStudents, [ver]);
  const attempts = useMemo(getAttempts, [ver]);

  const rows = useMemo(() => students.map((s) => {
    const list = attempts.filter((a) => a.studentId === s.id).sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
    const last = list.at(-1);
    const prev = list.at(-2);
    return { s, last, n: list.length, diff: last && prev ? levelOf(last) - levelOf(prev) : null, pending: list.some((a) => (a.writing || a.hasSpeaking) && !a.finalLevel) };
  }), [students, attempts]);

  const classes = [...new Set(students.map((s) => s.className).filter(Boolean))].sort();
  const filtered = rows
    .filter((r) => !cls || r.s.className === cls)
    .filter((r) => !q || (r.s.name + r.s.studentNo + r.s.nationality).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.last?.finishedAt ?? '').localeCompare(a.last?.finishedAt ?? ''));

  const latest = filtered.map((r) => r.last).filter(Boolean) as Attempt[];
  const counts = [1, 2, 3, 4, 5, 6].map((l) => latest.filter((a) => levelOf(a) === l).length);
  const avg = latest.length ? (latest.reduce((s, a) => s + levelOf(a), 0) / latest.length).toFixed(1) : '-';
  const ups = filtered.filter((r) => (r.diff ?? 0) > 0).length;
  const withPrev = filtered.filter((r) => r.diff !== null).length;
  const pending = filtered.filter((r) => r.pending).length;

  const download = () => {
    const blob = new Blob([exportCsv()], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `레벨테스트_결과_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  if (students.length === 0) {
    return (
      <div className="card center">
        <h2>아직 응시 기록이 없습니다</h2>
        <p className="muted">시연용 가상 학생 24명(3개 학기 응시 기록)을 만들 수 있습니다.</p>
        <button className="btn primary" onClick={() => { seedDemo(); setVer(ver + 1); }}>데모 데이터 생성</button>
      </div>
    );
  }

  return (
    <>
      <div className="kpis">
        <div className="kpi"><span>등록 학생</span><b>{filtered.length}</b></div>
        <div className="kpi"><span>평균 급</span><b>{avg}</b></div>
        <div className="kpi"><span>지난 시험 대비 상승</span><b>{withPrev ? `${Math.round((ups / withPrev) * 100)}%` : '-'}</b><small>{ups}/{withPrev}명</small></div>
        <div className="kpi"><span>채점 대기 (쓰기·말하기)</span><b>{pending}</b></div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>현재 급 분포</h3>
          <Distribution counts={counts} />
        </div>
        <div className="card">
          <h3>필요 교재 수량 (현재 급 기준)</h3>
          <table className="tbl compact">
            <tbody>
              {getSettings().textbooks.map((t, i) => (
                <tr key={i}><td>{t}</td><td className="right"><b>{counts[i]}</b>권</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <input placeholder="이름·학번·국적 검색" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={cls} onChange={(e) => setCls(e.target.value)}>
            <option value="">전체 반</option>
            {classes.map((c) => <option key={c}>{c}</option>)}
          </select>
          <span className="spacer" />
          <button className="btn" onClick={download}>CSV 내보내기</button>
          <button className="btn ghost" onClick={() => { if (confirm('모든 응시 기록을 삭제할까요?')) { clearAll(); setVer(ver + 1); } }}>초기화</button>
        </div>
        <div className="scroll">
          <table className="tbl">
            <thead>
              <tr><th>이름</th><th>학번</th><th>국적</th><th>반</th><th>응시</th><th>최근 급</th><th>변화</th><th>최근 응시일</th></tr>
            </thead>
            <tbody>
              {filtered.map(({ s, last, n, diff, pending: p }) => (
                <tr key={s.id} className="click" onClick={() => go(`/admin/student/${s.id}`)}>
                  <td>{s.name} {p && <span className="pill warn">채점대기</span>}</td>
                  <td>{s.studentNo}</td><td>{s.nationality}</td><td>{s.className}</td><td>{n}회</td>
                  <td>{last ? <b>{levelOf(last)}급</b> : '-'}</td>
                  <td className={diff ? (diff > 0 ? 'up' : 'down') : ''}>{diff === null ? '-' : diff > 0 ? `▲${diff}` : diff < 0 ? `▼${-diff}` : '–'}</td>
                  <td>{last?.finishedAt.slice(0, 10) ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function StudentDetail({ id }: { id: string }) {
  const s = getStudent(id);
  const [ver, setVer] = useState(0);
  const list = useMemo(() => attemptsOf(id), [id, ver]);
  if (!s) return <div className="card">학생을 찾을 수 없습니다.</div>;
  return (
    <>
      <button className="btn ghost" onClick={() => go('/admin')}>← 목록</button>
      <div className="card">
        <h2>{s.name} <small>{s.studentNo} · {s.nationality} · {s.className}</small></h2>
        <LevelTrend attempts={list} />
      </div>
      {[...list].reverse().map((a) => <AttemptCard key={a.id} a={a} onSaved={() => setVer(ver + 1)} />)}
    </>
  );
}

function AttemptCard({ a, onSaved }: { a: Attempt; onSaved: () => void }) {
  const [w, setW] = useState<Level | undefined>(a.teacherWriting);
  const [sp, setSp] = useState<Level | undefined>(a.teacherSpeaking);
  const [fin, setFin] = useState<Level>(levelOf(a));
  const [note, setNote] = useState(a.teacherNote ?? '');
  const [audio, setAudio] = useState<string>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (a.hasSpeaking) loadRecording(a.id).then((b) => b && setAudio(URL.createObjectURL(b))).catch(() => {});
  }, [a.id]);

  const save = () => {
    saveAttempt({ ...a, teacherWriting: w, teacherSpeaking: sp, finalLevel: fin, teacherNote: note || undefined });
    setSaved(true);
    onSaved();
  };
  const sel = (v: Level | undefined, set: (l: Level | undefined) => void) => (
    <select value={v ?? ''} onChange={(e) => set(e.target.value ? (Number(e.target.value) as Level) : undefined)}>
      <option value="">미평가</option>
      {[1, 2, 3, 4, 5, 6].map((l) => <option key={l} value={l}>{l}급</option>)}
    </select>
  );

  return (
    <div className="card">
      <div className="attempt-head">
        <h3>{a.finishedAt.slice(0, 10)} 응시</h3>
        <span className="pill">자동 판정 {a.autoLevel}급</span>
        {a.finalLevel && <span className="pill ok">최종 {a.finalLevel}급</span>}
        <span className="muted">소요 {Math.round((+new Date(a.finishedAt) - +new Date(a.startedAt)) / 60000)}분 · {a.answers.length}문항</span>
      </div>
      <div className="grid2">
        <div>
          <SectionBars a={a} />
          <p className="muted small">진행 경로: {a.blocks.map((b) => `${b.level}급(${b.correct}/${b.total})`).join(' → ')}</p>
        </div>
        <div>
          {a.writing ? (
            <>
              <p className="label">쓰기 답안</p>
              <p className="muted small pre">{a.writingPrompt?.split('\n')[0]}</p>
              <div className="passage pre">{a.writing}</div>
            </>
          ) : <p className="muted">쓰기 답안 없음</p>}
          {audio ? (<><p className="label">말하기 녹음</p><p className="muted small">{a.speakingPrompt?.split('\n')[0]}</p><audio controls src={audio} /></>) : <p className="muted">말하기 녹음 없음</p>}
        </div>
      </div>
      <div className="grade">
        <label>쓰기 {sel(w, setW)}</label>
        <label>말하기 {sel(sp, setSp)}</label>
        <label>최종 급
          <select value={fin} onChange={(e) => setFin(Number(e.target.value) as Level)}>
            {[1, 2, 3, 4, 5, 6].map((l) => <option key={l} value={l}>{LEVEL_INFO[l].title}</option>)}
          </select>
        </label>
        <input className="grow" placeholder="교사 메모" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn primary" onClick={save}>{saved ? '저장됨 ✓' : '저장'}</button>
      </div>
    </div>
  );
}

function SettingsPage() {
  const [s, setS] = useState<Settings>(getSettings);
  const [ok, setOk] = useState(false);
  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); saveSettings(s); setOk(true); }}>
      <h2>설정</h2>
      <label className="field"><span>기관명</span><input value={s.institution} onChange={(e) => setS({ ...s, institution: e.target.value })} /></label>
      <label className="field"><span>관리자 PIN</span><input value={s.pin} onChange={(e) => setS({ ...s, pin: e.target.value })} /></label>
      <h3>급별 추천 교재</h3>
      <p className="muted small">결과 화면과 '필요 교재 수량'에 표시됩니다.</p>
      {s.textbooks.map((t, i) => (
        <label key={i} className="field inline"><span>{i + 1}급</span>
          <input value={t} onChange={(e) => { const tb = [...s.textbooks]; tb[i] = e.target.value; setS({ ...s, textbooks: tb }); }} />
        </label>
      ))}
      <button className="btn primary">{ok ? '저장됨 ✓' : '저장'}</button>
    </form>
  );
}
