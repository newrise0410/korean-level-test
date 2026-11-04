export type Section = 'vocab' | 'grammar' | 'reading' | 'listening';
export type Level = 1 | 2 | 3 | 4 | 5 | 6;

export const SECTIONS: Section[] = ['vocab', 'grammar', 'reading', 'listening'];
export const SECTION_LABEL: Record<Section, string> = {
  vocab: '어휘 Vocabulary',
  grammar: '문법 Grammar',
  reading: '읽기 Reading',
  listening: '듣기 Listening',
};

/** 듣기 대본 한 줄. s: 화자(M 남자 / F 여자 / N 안내방송) */
export interface Line {
  s: 'M' | 'F' | 'N';
  t: string;
}

export interface Item {
  id: string;
  level: Level;
  section: Section;
  prompt: string;
  passage?: string;
  audio?: Line[];
  /** choices[answer] 가 정답. 화면에서는 섞어서 보여준다. */
  choices: string[];
  answer: number;
}

export interface Student {
  id: string;
  name: string;
  studentNo: string;
  nationality: string;
  className: string;
  createdAt: string;
}

export interface AnswerRecord {
  itemId: string;
  level: Level;
  section: Section;
  chosen: string;
  correct: boolean;
}

export interface BlockResult {
  level: Level;
  correct: number;
  total: number;
}

export interface Attempt {
  id: string;
  studentId: string;
  startedAt: string;
  finishedAt: string;
  /** 객관식 적응형 문항으로 자동 판정된 급 */
  autoLevel: Level;
  /** 교사가 쓰기·말하기까지 확인한 뒤 확정한 급 (없으면 autoLevel) */
  finalLevel?: Level;
  answers: AnswerRecord[];
  blocks: BlockResult[];
  writingPrompt?: string;
  writing?: string;
  speakingPrompt?: string;
  hasSpeaking?: boolean;
  teacherWriting?: Level;
  teacherSpeaking?: Level;
  teacherNote?: string;
}

export interface Settings {
  institution: string;
  pin: string;
  textbooks: string[]; // index 0 → 1급
}
