import type { SiteDatabase, SiteStorage } from "../../../platform/types";
import { tableNames } from "./schema";
import type { Card, KnownState, Sentence, Word } from "./types";

const KNOWN_STATE_PREFIX = "known-state:";

const KNOWN_STATES: readonly KnownState[] = ["unknown", "learning", "known", "want-to-learn"];

export interface LibraryEntry {
  word: Word;
  knownState: KnownState;
  cards: Card[];
  earliestDue?: number;
  suspended: boolean;
}

export async function selectLibraryEntries(
  database: SiteDatabase,
  storage: SiteStorage,
): Promise<LibraryEntry[]> {
  const [words, allCards] = await Promise.all([
    database.getAll<Word>(tableNames.words),
    database.getAll<Card>(tableNames.cards),
  ]);

  const cardsByWord = new Map<string, Card[]>();
  for (const card of allCards) {
    const list = cardsByWord.get(card.wordId);
    if (list) list.push(card);
    else cardsByWord.set(card.wordId, [card]);
  }

  return words.map((word) => {
    const cards = cardsByWord.get(word.id) ?? [];
    const active = cards.filter((card) => !card.suspended);
    const earliestDue =
      active.length === 0 ? undefined : active.reduce((min, card) => Math.min(min, card.fsrs.due), Infinity);
    return {
      word,
      knownState: readKnownState(storage, word.id, cards),
      cards,
      earliestDue: earliestDue === Infinity ? undefined : earliestDue,
      suspended: cards.length > 0 && active.length === 0,
    };
  });
}

export function readKnownState(storage: SiteStorage, wordId: string, cards: Card[]): KnownState {
  const override = storage.get(KNOWN_STATE_PREFIX + wordId);
  if (override && (KNOWN_STATES as readonly string[]).includes(override)) {
    return override as KnownState;
  }
  const active = cards.filter((card) => !card.suspended);
  if (active.length === 0) return "unknown";
  if (active.some((card) => card.fsrs.state === "review")) return "known";
  return "learning";
}

export function writeKnownState(storage: SiteStorage, wordId: string, state: KnownState): void {
  storage.set(KNOWN_STATE_PREFIX + wordId, state);
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

export async function deleteWord(
  database: SiteDatabase,
  storage: SiteStorage,
  wordId: string,
): Promise<void> {
  await database.transaction(
    [tableNames.words, tableNames.cards, tableNames.sentences],
    "readwrite",
    async (tx) => {
      const cards = await tx.query<Card>(tableNames.cards, "wordId", wordId);
      for (const card of cards) {
        await tx.delete(tableNames.cards, card.id);
      }
      const sentences = await tx.query<Sentence>(tableNames.sentences, "targetWordId", wordId);
      for (const sentence of sentences) {
        await tx.delete(tableNames.sentences, sentence.id);
      }
      await tx.delete(tableNames.words, wordId);
    },
  );
  storage.remove(KNOWN_STATE_PREFIX + wordId);
}
