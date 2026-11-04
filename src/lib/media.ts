import type { Line } from '../types';

// ─── 듣기: 브라우저 TTS ───
// 데모용. 실서비스에서는 성우 녹음 또는 고품질 TTS로 미리 만든 mp3 파일을 쓰는 것을 권장.
export function ttsAvailable() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function koVoices(): SpeechSynthesisVoice[] {
  return speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('ko'));
}

export function speak(lines: Line[], onEnd: () => void) {
  speechSynthesis.cancel();
  const voices = koVoices();
  const female = voices.find((v) => /heami|sunhi|yuna|female|여/i.test(v.name)) ?? voices[0];
  const male = voices.find((v) => /injoon|minsu|male|남/i.test(v.name) && v !== female) ?? voices[1] ?? voices[0];
  lines.forEach((ln, i) => {
    const u = new SpeechSynthesisUtterance(ln.t);
    u.lang = 'ko-KR';
    u.rate = 0.95;
    const v = ln.s === 'F' ? female : male;
    if (v) u.voice = v;
    // 목소리가 하나뿐이면 음높이로 화자를 구분
    u.pitch = ln.s === 'F' ? 1.25 : ln.s === 'M' ? 0.8 : 1;
    if (i === lines.length - 1) u.onend = onEnd;
    speechSynthesis.speak(u);
  });
}

export function stopSpeaking() {
  if (ttsAvailable()) speechSynthesis.cancel();
}

// ─── 말하기 녹음 저장 (IndexedDB) ───
const DB = 'klt-audio';
function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('rec');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export async function saveRecording(attemptId: string, blob: Blob) {
  const d = await db();
  await new Promise<void>((res, rej) => {
    const tx = d.transaction('rec', 'readwrite');
    tx.objectStore('rec').put(blob, attemptId);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
export async function loadRecording(attemptId: string): Promise<Blob | undefined> {
  const d = await db();
  return new Promise((res, rej) => {
    const r = d.transaction('rec').objectStore('rec').get(attemptId);
    r.onsuccess = () => res(r.result as Blob | undefined);
    r.onerror = () => rej(r.error);
  });
}
