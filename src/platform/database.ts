import type { PlaygroundSite } from "./types";

export interface SiteStore<T> {
  get(key: string): Promise<T | undefined>;
  getAll(): Promise<T[]>;
  put(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface SiteDatabaseConfig {
  /** Stable name within the site. Becomes part of the IDB database name. */
  name: string;
  /** Bump when adding stores so onupgradeneeded fires. */
  version: number;
  /** Object store names that the database guarantees to provide. */
  stores: readonly string[];
}

export interface SiteDatabase {
  store<T>(name: string): SiteStore<T>;
  close(): void;
}

export function createSiteDatabase(
  site: PlaygroundSite,
  config: SiteDatabaseConfig,
): SiteDatabase {
  const dbName = `${site.slug}:${config.name}`;
  let dbPromise: Promise<IDBDatabase> | null = null;

  function open(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = window.indexedDB.open(dbName, config.version);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const store of config.stores) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store);
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () =>
        reject(new Error(`Database upgrade blocked for "${dbName}"`));
    });
    return dbPromise;
  }

  function ensureKnown(name: string) {
    if (!config.stores.includes(name)) {
      throw new Error(`Unknown store "${name}" for database "${dbName}"`);
    }
  }

  function store<T>(name: string): SiteStore<T> {
    ensureKnown(name);
    return {
      async get(key) {
        const db = await open();
        return run<T | undefined>(
          db.transaction(name, "readonly").objectStore(name).get(key),
        );
      },
      async getAll() {
        const db = await open();
        return run<T[]>(
          db.transaction(name, "readonly").objectStore(name).getAll(),
        );
      },
      async put(key, value) {
        const db = await open();
        await run(
          db.transaction(name, "readwrite").objectStore(name).put(value, key),
        );
      },
      async delete(key) {
        const db = await open();
        await run(
          db.transaction(name, "readwrite").objectStore(name).delete(key),
        );
      },
      async clear() {
        const db = await open();
        await run(
          db.transaction(name, "readwrite").objectStore(name).clear(),
        );
      },
    };
  }

  return {
    store,
    close() {
      const pending = dbPromise;
      dbPromise = null;
      if (!pending) return;
      void pending.then((db) => db.close()).catch(() => {});
    },
  };
}

function run<T>(req: IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}
