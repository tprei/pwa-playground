import type { RadicalBreakdown, Sentence, Word } from "../model";

export interface Table<T> {
  get(id: string): Promise<T | undefined>;
  put(value: T): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface SentenceInputArgs {
  targetWord: Word;
  knownWords: Word[];
  recentTopics: string[];
  prefs: { style: string; topics?: string[] };
}

export interface SentenceRecord extends Sentence {
  cacheKey: string;
  knownWordIds: string[];
  topics: string[];
  style: string;
  inputArgs: SentenceInputArgs;
  generatedAt: number;
}

export interface RadicalBreakdownRecord extends RadicalBreakdown {
  id: string;
  cacheKey: string;
  generatedAt: number;
}

export interface SiteDatabase {
  sentences: Table<SentenceRecord>;
  radicalBreakdowns: Table<RadicalBreakdownRecord>;
}
