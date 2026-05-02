// Shared domain shapes for the Zhongwen knowledge graph. Persisted by the
// IDB layer (see `src/platform/database.ts`) and consumed by the SRS pickers.

export type KnownState = "unknown" | "want-to-learn" | "learning" | "known";

export interface WordEntry {
  word: string;
  state: KnownState;
  /** Unix ms when the entry was last written. */
  updatedAt: number;
}

export type WordStateGraph = ReadonlyMap<string, WordEntry>;
