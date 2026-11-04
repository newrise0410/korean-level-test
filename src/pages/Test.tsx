import { useEffect, useMemo, useRef, useState } from 'react';
import { ITEMS, speakingPrompt, writingPrompt } from '../data/items';
import { initEngine, pickBlock, submitBlock, type EngineState } from '../lib/engine';
import { saveRecording, speak, stopSpeaking, ttsAvailable } from '../lib/media';
import { go } from '../lib/router';
import { attemptsOf, getCurrent, saveAttempt, uid } from '../lib/store';
import type { AnswerRecord, Attempt, Item } from '../types';
import { SECTION_LABEL } from '../types';

interface Shown { item: Item; choices: string[] }

function shuffled(item: Item): Shown {
  const c = item.choices.slice();
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return { item, choices: c };
}

export default function Test() {
  const cur = getCurrent();
  const avoid = useMemo(() => {
    if (!cur) return new Set<string>();
    const prev = attemptsOf(cur.studentId).at(-1);
    return new Set(prev?.answers.map((a) => a.itemId) ?? []);
  }, [cur?.studentId]);

  const [startedAt] = useState(() => new Date().toISOString());
  const [eng, setEng] = useState<EngineState>(() => initEngine(cur?.start ?? 1));
  const [block, setBlock] = useState<Shown[]>(() => pickBlock(eng, ITEMS, avoid).map(shuffled));
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [phase, setPhase] = useState<'mcq' | 'writing' | 'speaking'>('mcq');
  const [writing, setWriting] = useState('');

  useEffect(() => {
    if (!cur) go('/');
  }, []);
  if (!cur) return null;

  const done = eng.done ? eng.result! : null;
  const answered = answers.length;
  const q = block[idx];

  const next = () => {
    if (sel == null) return;
    const it = q.item;
    const rec: AnswerRecord = { itemId: it.id, level: it.level, section: it.section, chosen: sel, correct: sel === it.choices[it.answer] };
    const all = [...answers, rec];
    setAnswers(all);
    setSel(null);
    stopSpeaking();
    if (idx < block.length - 1) return setIdx(idx + 1);
    const blockRecs = all.slice(-block.length);
    const nextEng = submitBlock(eng, block.map((b) => b.item), blockRecs.filter((r) => r.correct).length);
    setEng(nextEng);
    if (nextEng.done) return setPhase('writing');
    setBlock(pickBlock(nextEng, ITEMS, avoid).map(shuffled));
    setIdx(0);
  };

  const finish = async (rec: Blob | null) => {
    const id = uid();
    const level = eng.result!;
    const a: Attempt = {
      id, studentId: cur.studentId, startedAt, finishedAt: new Date().toISOString(),
      autoLevel: level, answers, blocks: eng.blocks,
      writingPrompt: writingPrompt(level), writing: writing.trim() || undefined,
      speakingPrompt: speakingPrompt(level), hasSpeaking: !!rec,
    };
    if (rec) {
      try { await saveRecording(id, rec); } catch { a.hasSpeaking = false; }
    }
    saveAttempt(a);
    go(`/result/${id}`);
  };

  if (phase === 'writing' && done) {
    return (
      <div className="narrow">
        <Progress label="쓰기 · Writing" pct={85} />
        <div className="card">
          <p className="tag">쓰기 Writing</p>
          <p className="prompt pre">{writingPrompt(done)}</p>
          <textarea rows={9} value={writing} onChange={(e) => setWriting(e.target.value)} placeholder="여기에 쓰세요 / Write here" />
          <p className="muted right">{writing.replace(/\s/g, '').length}자</p>
          <div className="row">
            <button className="btn ghost" onClick={() => { setWriting(''); setPhase('speaking'); }}>건너뛰기 · Skip</button>
            <button className="btn primary" onClick={() => setPhase('speaking')}>다음 · Next</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'speaking' && done) {
    return (
      <div className="narrow">
        <Progress label="말하기 · Speaking" pct={95} />
        <Speaking prompt={speakingPrompt(done)} onDone={finish} />
      </div>
    );
  }

  return (
    <div className="narrow">
      <Progress label={`문항 ${answered + 1}`} pct={Math.min(80, (answered / 20) * 80)} />
      <div className="card" key={q.item.id}>
        <p className="tag">{SECTION_LABEL[q.item.section]}</p>
        {q.item.audio && <Listen lines={q.item.audio} />}
        {q.item.passage && <div className="passage pre">{q.item.passage}</div>}
        <p className="prompt">{q.item.prompt}</p>
        <div className="choices">
          {q.choices.map((c, i) => (
            <button key={c} className={`choice ${sel === c ? 'on' : ''}`} onClick={() => setSel(c)}>
              <span className="num">{i + 1}</span>{c}
            </button>
          ))}
        </div>
        <button className="btn primary block" disabled={sel == null} onClick={next}>다음 · Next</button>
      </div>
    </div>
  );
}

function Progress({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="progress">
      <span>{label}</span>
      <div className="bar"><i style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function Listen({ lines }: { lines: Item['audio'] & {} }) {
  const [plays, setPlays] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => stopSpeaking(), []);
  if (!ttsAvailable()) return <div className="notice">이 브라우저는 음성 재생을 지원하지 않습니다.</div>;
  const play = () => {
    setPlaying(true);
    setPlays((p) => p + 1);
    speak(lines, () => setPlaying(false));
  };
  return (
    <div className="listen">
      <button className="btn" onClick={play} disabled={playing || plays >= 2}>
        {playing ? '🔊 재생 중…' : plays ? '🔁 다시 듣기 · Replay' : '▶ 듣기 · Play'}
      </button>
      <small className="muted">최대 2번 · Max 2 plays ({plays}/2)</small>
    </div>
  );
}

function Speaking({ prompt, onDone }: { prompt: string; onDone: (b: Blob | null) => void }) {
  const [state, setState] = useState<'idle' | 'rec' | 'done' | 'error'>('idle');
  const [secs, setSecs] = useState(0);
  const [url, setUrl] = useState<string>();
  const [saving, setSaving] = useState(false);
  const recRef = useRef<MediaRecorder>();
  const blobRef = useRef<Blob | null>(null);
  const timer = useRef<number>();

  useEffect(() => () => { window.clearInterval(timer.current); recRef.current?.stream.getTracks().forEach((t) => t.stop()); }, []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const b = new Blob(chunks, { type: mr.mimeType });
        blobRef.current = b;
        setUrl(URL.createObjectURL(b));
        setState('done');
      };
      recRef.current = mr;
      mr.start();
      setSecs(0);
      setState('rec');
      timer.current = window.setInterval(() => setSecs((s) => {
        if (s + 1 >= 120) stop();
        return s + 1;
      }), 1000);
    } catch {
      setState('error');
    }
  };
  const stop = () => {
    window.clearInterval(timer.current);
    if (recRef.current?.state === 'recording') recRef.current.stop();
  };
  const submit = (b: Blob | null) => { setSaving(true); onDone(b); };

  return (
    <div className="card">
      <p className="tag">말하기 Speaking</p>
      <p className="prompt pre">{prompt}</p>
      <div className="rec">
        {state === 'idle' && <button className="btn primary" onClick={start}>🎙 녹음 시작 · Record</button>}
        {state === 'rec' && <button className="btn danger" onClick={stop}>■ 녹음 끝 · Stop ({secs}s)</button>}
        {state === 'done' && (
          <>
            <audio controls src={url} />
            <button className="btn ghost" onClick={start}>다시 녹음 · Re-record</button>
          </>
        )}
        {state === 'error' && <p className="notice">마이크를 사용할 수 없습니다. 건너뛰기를 눌러 주세요.<br /><small>Microphone unavailable. Please skip.</small></p>}
      </div>
      <div className="row">
        <button className="btn ghost" disabled={saving || state === 'rec'} onClick={() => submit(null)}>건너뛰기 · Skip</button>
        <button className="btn primary" disabled={saving || state !== 'done'} onClick={() => submit(blobRef.current)}>제출 · Submit</button>
      </div>
    </div>
  );
}
