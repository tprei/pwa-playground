import type { SiteDatabase } from "../../../platform/types";
import { tableNames } from "./schema";
import type { Sentence, Word, WordState, WordStateKind } from "./types";

export interface LibraryEntry {
  word?: Word;
  hanzi: string;
  state: WordStateKind;
  lastSeenAt: number;
  addedAt: number;
}

export async function selectLibraryEntries(database: SiteDatabase): Promise<LibraryEntry[]> {
  const [states, words] = await Promise.all([
    database.getAll<WordState>(tableNames.wordStates),
    database.getAll<Word>(tableNames.words),
  ]);

  const wordByHanzi = new Map<string, Word>();
  for (const word of words) wordByHanzi.set(word.hanzi, word);

  return states.map((wordState) => ({
    word: wordByHanzi.get(wordState.hanzi),
    hanzi: wordState.hanzi,
    state: wordState.state,
    lastSeenAt: wordState.lastSeenAt,
    addedAt: wordState.addedAt,
  }));
}

export async function writeWordState(
  database: SiteDatabase,
  hanzi: string,
  state: WordStateKind,
  now: number,
): Promise<WordState> {
  return database.transaction<WordState>(tableNames.wordStates, "readwrite", async (tx) => {
    const existing = await tx.get<WordState>(tableNames.wordStates, hanzi);
    const next: WordState = {
      hanzi,
      state,
      addedAt: existing?.addedAt ?? now,
      updatedAt: now,
      lastSeenAt: existing?.lastSeenAt ?? now,
    };
    await tx.put<WordState>(tableNames.wordStates, next);
    return next;
  });
}

export async function deleteWordState(database: SiteDatabase, hanzi: string): Promise<void> {
  await database.delete(tableNames.wordStates, hanzi);
}

export async function loadThumbsUpSentences(
  database: SiteDatabase,
  wordId: string,
  limit: number,
): Promise<Sentence[]> {
  const sentences = await database.query<Sentence>(tableNames.sentences, "targetWordId", wordId);
  return sentences
    .filter((sentence) => sentence.thumbsUp === true)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}
