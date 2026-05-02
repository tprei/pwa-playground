import type { SiteDatabaseMigration, SiteDatabaseSchema } from "../../../platform/types";

export const ZHONGWEN_DB_VERSION = 1;

export const tableNames = {
  words: "words",
  cards: "cards",
  sentences: "sentences",
  radicalBreakdowns: "radicalBreakdowns",
  reviews: "reviews",
  blobs: "blobs",
} as const;

export type ZhongwenTableName = (typeof tableNames)[keyof typeof tableNames];

export interface IndexSpec {
  name: string;
  keyPath: string | readonly string[];
  options?: IDBIndexParameters;
}

export interface TableSpec {
  name: ZhongwenTableName;
  keyPath: string;
  indexes: readonly IndexSpec[];
}

export const tableSpecs: readonly TableSpec[] = [
  {
    name: tableNames.words,
    keyPath: "id",
    indexes: [
      { name: "hanzi", keyPath: "hanzi", options: { unique: true } },
      { name: "source", keyPath: "source" },
      { name: "hsk", keyPath: "hsk" },
      { name: "frequencyRank", keyPath: "frequencyRank" },
      { name: "addedAt", keyPath: "addedAt" },
    ],
  },
  {
    name: tableNames.cards,
    keyPath: "id",
    indexes: [
      { name: "wordId", keyPath: "wordId" },
      { name: "mode", keyPath: "mode" },
      { name: "wordId_mode", keyPath: ["wordId", "mode"], options: { unique: true } },
      { name: "due", keyPath: "fsrs.due" },
    ],
  },
  {
    name: tableNames.sentences,
    keyPath: "id",
    indexes: [
      { name: "targetWordId", keyPath: "targetWordId" },
      { name: "createdAt", keyPath: "createdAt" },
      { name: "knownWordIds", keyPath: "knownWordIds", options: { multiEntry: true } },
      { name: "model", keyPath: "model" },
    ],
  },
  {
    name: tableNames.radicalBreakdowns,
    keyPath: "hanzi",
    indexes: [],
  },
  {
    name: tableNames.reviews,
    keyPath: "id",
    indexes: [
      { name: "cardId", keyPath: "cardId" },
      { name: "reviewedAt", keyPath: "reviewedAt" },
      { name: "cardId_reviewedAt", keyPath: ["cardId", "reviewedAt"] },
    ],
  },
  {
    name: tableNames.blobs,
    keyPath: "hash",
    indexes: [{ name: "kind", keyPath: "kind" }],
  },
];

function applyTableSpec(database: IDBDatabase, spec: TableSpec): void {
  const store = database.createObjectStore(spec.name, { keyPath: spec.keyPath });
  for (const index of spec.indexes) {
    const keyPath = Array.isArray(index.keyPath) ? [...index.keyPath] : index.keyPath;
    store.createIndex(index.name, keyPath, index.options);
  }
}

export const zhongwenSchema: SiteDatabaseSchema = {
  version: ZHONGWEN_DB_VERSION,
  migrate({ database, oldVersion }: SiteDatabaseMigration): void {
    if (oldVersion < 1) {
      for (const spec of tableSpecs) {
        applyTableSpec(database, spec);
      }
    }
  },
};
