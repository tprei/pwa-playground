import type { PlaygroundSite } from "./types";

export interface SiteDatabase {
  get<T = unknown>(table: string, key: string): Promise<T | undefined>;
  put<T = unknown>(table: string, key: string, value: T): Promise<void>;
  delete(table: string, key: string): Promise<void>;
}

export function createSiteDatabase(site: PlaygroundSite, tables: readonly string[]): SiteDatabase {
  const dbName = `${site.slug}:v1`;
  let dbPromise: Promise<IDBDatabase> | null = null;

  function open(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;
    dbPromise = (async () => {
      const initial = await openDatabase(dbName);
      const missing = tables.filter((table) => !initial.objectStoreNames.contains(table));
      if (missing.length === 0) return initial;
      const nextVersion = initial.version + 1;
      initial.close();
      return openDatabase(dbName, nextVersion, missing);
    })();
    return dbPromise;
  }

  async function withStore<T>(
    table: string,
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await open();
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(table, mode);
      const request = run(transaction.objectStore(table));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return {
    async get<T = unknown>(table: string, key: string): Promise<T | undefined> {
      const value = await withStore<unknown>(table, "readonly", (store) => store.get(key));
      return value as T | undefined;
    },
    async put<T = unknown>(table: string, key: string, value: T): Promise<void> {
      await withStore(table, "readwrite", (store) => store.put(value, key));
    },
    async delete(table: string, key: string): Promise<void> {
      await withStore(table, "readwrite", (store) => store.delete(key));
    },
  };
}

function openDatabase(
  name: string,
  version?: number,
  storesToCreate: readonly string[] = [],
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = version === undefined ? indexedDB.open(name) : indexedDB.open(name, version);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const store of storesToCreate) {
        if (!database.objectStoreNames.contains(store)) {
          database.createObjectStore(store);
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error(`IndexedDB open blocked for ${name}`));
  });
}
