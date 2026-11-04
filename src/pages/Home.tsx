import { useState } from 'react';
import { START_OPTIONS } from '../lib/engine';
import { go } from '../lib/router';
import { getSettings, setCurrent, upsertStudent } from '../lib/store';
import type { Level } from '../types';

export default function Home() {
  const settings = getSettings();
  const [f, setF] = useState({ name: '', studentNo: '', nationality: '', className: '' });
  const [start, setStart] = useState<Level>(1);
  const ok = f.name.trim() && f.studentNo.trim() && f.nationality.trim();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    const s = upsertStudent({
      name: f.name.trim(), studentNo: f.studentNo.trim(),
      nationality: f.nationality.trim(), className: f.className.trim(),
    });
    setCurrent(s.id, start);
    go('/test');
  };

  const field = (k: keyof typeof f, ko: string, en: string, required = true) => (
    <label className="field">
      <span>{ko} <small>{en}</small>{required && <b className="req">*</b>}</span>
      <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </label>
  );

  return (
    <div className="narrow">
      <section className="hero">
        <p className="eyebrow">{settings.institution}</p>
        <h1>한국어 레벨테스트</h1>
        <p className="sub">Korean Placement &amp; Progress Test</p>
        <ul className="facts">
          <li><b>약 20분</b><span>About 20 min</span></li>
          <li><b>1~6급</b><span>TOPIK-aligned</span></li>
          <li><b>적응형</b><span>Adaptive</span></li>
        </ul>
      </section>

      <form className="card" onSubmit={submit}>
        <h2>응시자 정보 <small>Your information</small></h2>
        {field('name', '이름', 'Name')}
        {field('studentNo', '학번', 'Student ID')}
        {field('nationality', '국적', 'Nationality')}
        {field('className', '반', 'Class (optional)', false)}

        <fieldset className="field">
          <span>한국어를 얼마나 공부했어요? <small>How long have you studied Korean?</small></span>
          {START_OPTIONS.map((o) => (
            <label key={o.level} className={`radio ${start === o.level ? 'on' : ''}`}>
              <input type="radio" name="start" checked={start === o.level} onChange={() => setStart(o.level)} />
              {o.label}
            </label>
          ))}
        </fieldset>

        <div className="notice">
          🎧 듣기 문제가 있으니 이어폰을 준비하세요. 마지막에 말하기 녹음이 있어요.<br />
          <small>Please use earphones. There is a short speaking recording at the end.</small>
        </div>
        <button className="btn primary block" disabled={!ok}>시작하기 · Start</button>
      </form>
    </div>
  );
}
