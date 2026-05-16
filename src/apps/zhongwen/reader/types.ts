export type Tone = 1 | 2 | 3 | 4 | 5;

export interface ReaderToken {
  hanzi: string;
  pinyin?: string;
  tones?: readonly Tone[];
  glossEn?: string;
}

export interface ReaderSentence {
  id: string;
  hanzi: string;
  glossEn: string;
  tokens: readonly ReaderToken[];
}

export interface ReaderStory {
  id: string;
  title: string;
  description: string;
  hskLevel: 1 | 2 | 3 | 4 | 5 | 6;
  sentences: readonly ReaderSentence[];
}
