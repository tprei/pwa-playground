import type {
  PlaygroundSite,
  SiteDatabase,
  SiteDatabaseMode,
  SiteDatabaseSchema,
  SiteDatabaseTransaction,
} from "./types";

export function createSiteDatabase(
  site: PlaygroundSite,
  schema: SiteDatabaseSchema,
): SiteDatabase {
  let connection: Promise<IDBDatabase> | null = null;

  function ready(): Promise<IDBDatabase> {
    if (!connection) connection = openDatabase(site.slug, schema);
    return connection;
  }

  async function runTransaction<T>(
    tables: string | string[],
    mode: SiteDatabaseMode,
    fn: (tx: SiteDatabaseTransaction) => Promise<T>,
  ): Promise<T> {
    const db = await ready();
    const tx = db.transaction(tables, mode);
    const wrapped = wrapTransaction(tx);
    const completion = transactionDone(tx);
    let result: T;
    try {
      result = await fn(wrapped);
    } catch (error) {
      try {
        tx.abort();
      } catch {
        // already finished or aborted
      }
      await completion.catch(() => undefined);
      throw error;
    }
    await completion;
    return result;
  }

  return {
    get<T>(table: string, key: IDBValidKey): Promise<T | undefined> {
      return runTransaction(table, "readonly", (tx) => tx.get<T>(table, key));
    },
    put<T>(table: string, value: T): Promise<IDBValidKey> {
      return runTransaction(table, "readwrite", (tx) => tx.put<T>(table, value));
    },
    delete(table: string, key: IDBValidKey): Promise<void> {
      return runTransaction(table, "readwrite", (tx) => tx.delete(table, key));
    },
    getAll<T>(table: string): Promise<T[]> {
      return runTransaction(table, "readonly", (tx) => tx.getAll<T>(table));
    },
    query<T>(
      table: string,
      indexName: string,
      range: IDBKeyRange | IDBValidKey | null,
    ): Promise<T[]> {
      return runTransaction(table, "readonly", (tx) => tx.query<T>(table, indexName, range));
    },
    transaction: runTransaction,
  };
}

function openDatabase(name: string, schema: SiteDatabaseSchema): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(name, schema.version);
    request.onupgradeneeded = (event) => {
      const upgradeTransaction = request.transaction;
      if (!upgradeTransaction) {
        reject(new Error(`IndexedDB upgrade transaction missing for ${name}`));
        return;
      }
      try {
        schema.migrate({
          database: request.result,
          transaction: upgradeTransaction,
          oldVersion: event.oldVersion,
          newVersion: event.newVersion ?? schema.version,
        });
      } catch (error) {
        upgradeTransaction.abort();
        reject(error);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error(`IndexedDB open blocked for ${name}`));
  });
}

function wrapTransaction(tx: IDBTransaction): SiteDatabaseTransaction {
  return {
    get<T>(table: string, key: IDBValidKey): Promise<T | undefined> {
      return awaitRequest<T | undefined>(tx.objectStore(table).get(key));
    },
    put<T>(table: string, value: T): Promise<IDBValidKey> {
      return awaitRequest(tx.objectStore(table).put(value));
    },
    async delete(table: string, key: IDBValidKey): Promise<void> {
      await awaitRequest(tx.objectStore(table).delete(key));
    },
    getAll<T>(table: string): Promise<T[]> {
      return awaitRequest<T[]>(tx.objectStore(table).getAll());
    },
    query<T>(
      table: string,
      indexName: string,
      range: IDBKeyRange | IDBValidKey | null,
    ): Promise<T[]> {
      return awaitRequest<T[]>(tx.objectStore(table).index(indexName).getAll(range));
    },
  };
}

function awaitRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}
