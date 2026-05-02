import type { SiteDatabaseConfig } from "../../platform/database";

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

export const ZHONGWEN_DB_CONFIG: SiteDatabaseConfig = {
  version: 1,
  stores: {
    [WORDS_STORE]: {
      keyPath: "hanzi",
      indexes: [{ name: "byState", keyPath: "state" }],
    },
  },
};
