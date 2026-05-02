export type WordSource = "hsk" | "frequency" | "user" | "derived";

export interface Word {
  id: string;
  hanzi: string;
  pinyin: string;
  glossEn?: string;
  glossPt?: string;
  hsk?: number;
  frequencyRank?: number;
  addedAt: number;
  source: WordSource;
}

export type KnownState = "unknown" | "learning" | "known" | "want-to-learn";

export interface WordEntry {
  word: Word;
  knownState: KnownState;
  wantedReason?: string;
}

export type CardMode = "reading" | "listening" | "writing-strokes";

export type FsrsState = "new" | "learning" | "review" | "relearning";

export interface FsrsCardState {
  state: FsrsState;
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  lastReview?: number;
}

export interface Card {
  id: string;
  wordId: string;
  mode: CardMode;
  fsrs: FsrsCardState;
  suspended: boolean;
}

export type ReviewGrade = "again" | "hard" | "good" | "easy";

export interface Review {
  id: string;
  cardId: string;
  grade: ReviewGrade;
  reviewedAt: number;
}

export interface Sentence {
  id: string;
  hanzi: string;
  pinyin: string;
  glossLineEn: string;
  glossLinePt: string;
  targetWordId: string;
  knownWordIds: string[];
  audioBlobId?: string;
  model: string;
  createdAt: number;
  thumbsUp?: boolean;
}

export interface RadicalComponent {
  hanzi: string;
  meaning: string;
  contributesTo: string;
}

export interface RadicalRelatedWord {
  hanzi: string;
  pinyin: string;
  gloss: string;
}

export interface RadicalBreakdown {
  hanzi: string;
  components: RadicalComponent[];
  mnemonic: string;
  relatedWords: RadicalRelatedWord[];
}

export type BlobKind = "audio" | "character-data";

export interface BlobRecord {
  hash: string;
  kind: BlobKind;
  data: Blob;
  mediaType?: string;
}
