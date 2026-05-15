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

export type WordStateKind =
  | "unknown"
  | "want-to-learn"
  | "learning"
  | "known"
  | "ignored";

export interface WordState {
  hanzi: string;
  state: WordStateKind;
  addedAt: number;
  updatedAt: number;
  lastSeenAt: number;
}

export type StoryStatus = "draft" | "ready" | "read";

export interface StoryToken {
  hanzi: string;
  pinyin?: string;
  gloss?: string;
  state?: WordStateKind;
}

export interface StorySentence {
  id: string;
  tokens: StoryToken[];
  glossEn?: string;
  glossPt?: string;
  audioBlobId?: string;
}

export interface Story {
  id: string;
  title?: string;
  status: StoryStatus;
  sentences: StorySentence[];
  topics: string[];
  createdAt: number;
  readAt?: number;
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
