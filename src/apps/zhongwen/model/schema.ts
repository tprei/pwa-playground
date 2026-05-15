import type { SiteDatabaseMigration, SiteDatabaseSchema } from "../../../platform/types";

export const ZHONGWEN_DB_VERSION = 2;

export const tableNames = {
  words: "words",
  sentences: "sentences",
  radicalBreakdowns: "radicalBreakdowns",
  blobs: "blobs",
  wordStates: "wordStates",
  stories: "stories",
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
    name: tableNames.blobs,
    keyPath: "hash",
    indexes: [{ name: "kind", keyPath: "kind" }],
  },
  {
    name: tableNames.wordStates,
    keyPath: "hanzi",
    indexes: [
      { name: "state", keyPath: "state" },
      { name: "lastSeenAt", keyPath: "lastSeenAt" },
    ],
  },
  {
    name: tableNames.stories,
    keyPath: "id",
    indexes: [
      { name: "status", keyPath: "status" },
      { name: "createdAt", keyPath: "createdAt" },
      { name: "readAt", keyPath: "readAt" },
    ],
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
  migrate({ database }: SiteDatabaseMigration): void {
    for (const existing of Array.from(database.objectStoreNames)) {
      database.deleteObjectStore(existing);
    }
    for (const spec of tableSpecs) {
      applyTableSpec(database, spec);
    }
  },
};
