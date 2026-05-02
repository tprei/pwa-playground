import { createSiteDatabase } from "../../../platform/database";
import { createSiteStorage } from "../../../platform/storage";
import type { PlaygroundSite, SiteDatabase, SiteStorage } from "../../../platform/types";
import { tableNames, zhongwenSchema } from "../model/schema";
import type { Card, CardMode, Review, ReviewGrade } from "../model/types";
import { applyGrade, initialFsrsState } from "./fsrs";
import { readCounters, readSettings, writeCounters } from "./settings";

export interface Scheduler {
  getDueCards(now: number, limit: number): Promise<Card[]>;
  gradeCard(cardId: string, grade: ReviewGrade, now: number): Promise<Card>;
  createCardsForWord(wordId: string, modes: CardMode[]): Promise<Card[]>;
  suspendCard(cardId: string): Promise<Card>;
  suspendWord(wordId: string): Promise<Card[]>;
  unsuspendWord(wordId: string): Promise<Card[]>;
}

export function createScheduler(site: PlaygroundSite): Scheduler {
  const database = createSiteDatabase(site, zhongwenSchema);
  const storage = createSiteStorage(site);
  return createSchedulerWith(database, storage);
}

export function createSchedulerWith(database: SiteDatabase, storage: SiteStorage): Scheduler {
  return {
    getDueCards(now, limit) {
      return getDueCards(database, storage, now, limit);
    },
    gradeCard(cardId, grade, now) {
      return gradeCard(database, storage, cardId, grade, now);
    },
    createCardsForWord(wordId, modes) {
      return createCardsForWord(database, wordId, modes);
    },
    suspendCard(cardId) {
      return setSuspended(database, cardId, true);
    },
    suspendWord(wordId) {
      return setWordSuspended(database, wordId, true);
    },
    unsuspendWord(wordId) {
      return setWordSuspended(database, wordId, false);
    },
  };
}

async function getDueCards(
  database: SiteDatabase,
  storage: SiteStorage,
  now: number,
  limit: number,
): Promise<Card[]> {
  if (limit <= 0) return [];

  const settings = readSettings(storage);
  const counters = readCounters(storage, now);
  const remainingNew = Math.max(0, settings.newPerDay - counters.newCount);
  const remainingReview = Math.max(0, settings.reviewsPerDay - counters.reviewCount);
  if (remainingNew === 0 && remainingReview === 0) return [];

  const range = IDBKeyRange.upperBound(now);
  const due = await database.query<Card>(tableNames.cards, "due", range);

  const newCards: Card[] = [];
  const reviewCards: Card[] = [];
  for (const card of due) {
    if (card.suspended) continue;
    if (card.fsrs.reps === 0) newCards.push(card);
    else reviewCards.push(card);
  }
  newCards.sort((a, b) => a.fsrs.due - b.fsrs.due);
  reviewCards.sort((a, b) => a.fsrs.due - b.fsrs.due);

  const picked: Card[] = [
    ...reviewCards.slice(0, remainingReview),
    ...newCards.slice(0, remainingNew),
  ];
  picked.sort((a, b) => a.fsrs.due - b.fsrs.due);
  return picked.slice(0, limit);
}

async function gradeCard(
  database: SiteDatabase,
  storage: SiteStorage,
  cardId: string,
  grade: ReviewGrade,
  now: number,
): Promise<Card> {
  const updated = await database.transaction<Card>(
    [tableNames.cards, tableNames.reviews],
    "readwrite",
    async (tx) => {
      const card = await tx.get<Card>(tableNames.cards, cardId);
      if (!card) throw new Error(`Card ${cardId} not found`);

      const wasNew = card.fsrs.reps === 0;
      const { next } = applyGrade(card.fsrs, grade, now);
      const updatedCard: Card = { ...card, fsrs: next };
      await tx.put<Card>(tableNames.cards, updatedCard);

      const review: Review = {
        id: reviewId(cardId, now),
        cardId,
        grade,
        reviewedAt: now,
      };
      await tx.put<Review>(tableNames.reviews, review);

      bumpCounter(storage, now, wasNew);
      return updatedCard;
    },
  );
  return updated;
}

async function createCardsForWord(
  database: SiteDatabase,
  wordId: string,
  modes: CardMode[],
): Promise<Card[]> {
  if (modes.length === 0) return [];

  const now = Date.now();
  return database.transaction<Card[]>(tableNames.cards, "readwrite", async (tx) => {
    const created: Card[] = [];
    for (const mode of modes) {
      const existing = await tx.query<Card>(tableNames.cards, "wordId_mode", [wordId, mode]);
      if (existing.length > 0) {
        created.push(existing[0]);
        continue;
      }
      const card: Card = {
        id: cardId(wordId, mode),
        wordId,
        mode,
        fsrs: initialFsrsState(now),
        suspended: false,
      };
      await tx.put<Card>(tableNames.cards, card);
      created.push(card);
    }
    return created;
  });
}

async function setSuspended(
  database: SiteDatabase,
  cardId: string,
  suspended: boolean,
): Promise<Card> {
  return database.transaction<Card>(tableNames.cards, "readwrite", async (tx) => {
    const card = await tx.get<Card>(tableNames.cards, cardId);
    if (!card) throw new Error(`Card ${cardId} not found`);
    const updated: Card = { ...card, suspended };
    await tx.put<Card>(tableNames.cards, updated);
    return updated;
  });
}

async function setWordSuspended(
  database: SiteDatabase,
  wordId: string,
  suspended: boolean,
): Promise<Card[]> {
  return database.transaction<Card[]>(tableNames.cards, "readwrite", async (tx) => {
    const cards = await tx.query<Card>(tableNames.cards, "wordId", wordId);
    const updated: Card[] = [];
    for (const card of cards) {
      if (card.suspended === suspended) {
        updated.push(card);
        continue;
      }
      const next: Card = { ...card, suspended };
      await tx.put<Card>(tableNames.cards, next);
      updated.push(next);
    }
    return updated;
  });
}

function bumpCounter(storage: SiteStorage, now: number, wasNew: boolean): void {
  const counters = readCounters(storage, now);
  if (wasNew) counters.newCount += 1;
  else counters.reviewCount += 1;
  writeCounters(storage, now, counters);
}

function cardId(wordId: string, mode: CardMode): string {
  return `${wordId}:${mode}`;
}

function reviewId(cardId: string, now: number): string {
  return `${cardId}:${now}`;
}
