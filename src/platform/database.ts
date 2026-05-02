import type { PlaygroundSite } from "./types";

export interface ObjectStoreDescriptor {
  keyPath?: string;
  autoIncrement?: boolean;
  indexes?: ReadonlyArray<{
    name: string;
    keyPath: string | readonly string[];
    options?: IDBIndexParameters;
  }>;
}

export interface SiteDatabaseConfig {
  version: number;
  stores: Readonly<Record<string, ObjectStoreDescriptor>>;
}

export interface SiteDatabase {
  get<T>(store: string, key: IDBValidKey): Promise<T | undefined>;
  getAll<T>(store: string): Promise<T[]>;
  put<T>(store: string, value: T, key?: IDBValidKey): Promise<void>;
  delete(store: string, key: IDBValidKey): Promise<void>;
  count(store: string): Promise<number>;
  close(): void;
}

export async function createSiteDatabase(
  site: PlaygroundSite,
  config: SiteDatabaseConfig,
): Promise<SiteDatabase> {
  const db = await openDb(`${site.slug}:v1`, config);

  const tx = (store: string, mode: IDBTransactionMode) =>
    db.transaction(store, mode).objectStore(store);

  return {
    get: <T>(store: string, key: IDBValidKey) =>
      promisifyRequest<T | undefined>(tx(store, "readonly").get(key) as IDBRequest<T | undefined>),
    getAll: <T>(store: string) =>
      promisifyRequest<T[]>(tx(store, "readonly").getAll() as IDBRequest<T[]>),
    put: <T>(store: string, value: T, key?: IDBValidKey) => {
      const objectStore = tx(store, "readwrite");
      const request = key === undefined ? objectStore.put(value) : objectStore.put(value, key);
      return promisifyRequest(request).then(() => undefined);
    },
    delete: (store, key) =>
      promisifyRequest(tx(store, "readwrite").delete(key)).then(() => undefined),
    count: (store) => promisifyRequest<number>(tx(store, "readonly").count()),
    close: () => db.close(),
  };
}

function openDb(name: string, config: SiteDatabaseConfig): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(name, config.version);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const [storeName, descriptor] of Object.entries(config.stores)) {
        const store = db.objectStoreNames.contains(storeName)
          ? request.transaction!.objectStore(storeName)
          : db.createObjectStore(storeName, {
              keyPath: descriptor.keyPath,
              autoIncrement: descriptor.autoIncrement,
            });
        for (const index of descriptor.indexes ?? []) {
          if (store.indexNames.contains(index.name)) continue;
          store.createIndex(index.name, index.keyPath as string | string[], index.options);
        }
      }
    };
  });
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
