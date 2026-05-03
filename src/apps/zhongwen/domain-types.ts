import type { SiteDatabaseMigration, SiteDatabaseSchema } from "../../platform/types";

export type KnownState = "want-to-learn" | "learning" | "known" | "ignored";

export interface WordEntry {
  hanzi: string;
  state: KnownState;
  /** Epoch ms — first time the user touched this word. */
  addedAt: number;
  /** Epoch ms — most recent state mutation. */
  updatedAt: number;
}

export type WordGraph = ReadonlyMap<string, WordEntry>;

export const WORDS_STORE = "words";

export const ZHONGWEN_DB_CONFIG: SiteDatabaseSchema = {
  version: 1,
  migrate({ database, oldVersion }: SiteDatabaseMigration): void {
    if (oldVersion < 1) {
      const store = database.createObjectStore(WORDS_STORE, { keyPath: "hanzi" });
      store.createIndex("byState", "state");
    }
  },
};
