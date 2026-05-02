export interface Word {
  id: string;
  hanzi: string;
  pinyin?: string;
}

export interface Sentence {
  id: string;
  targetWordId: string;
  hanzi: string;
  pinyin: string;
  glossEN: string;
  glossPT: string;
}

export interface RadicalComponent {
  component: string;
  meaning: string;
}

export interface RadicalBreakdown {
  hanzi: string;
  l1Hint: string;
  components: RadicalComponent[];
  mnemonic: string;
}
