import type { ComponentType } from "react";

export type SiteSlug = string;

export interface SiteDefinition {
  slug: SiteSlug;
  title: string;
  description: string;
  themeColor: string;
  backgroundColor: string;
}

export interface PlaygroundSite extends SiteDefinition {
  route: `/${string}/`;
}

export interface SitesConfig {
  defaultHost: string;
  sites: SiteDefinition[];
}

export interface SiteStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export type SiteDatabaseMode = "readonly" | "readwrite";

export interface SiteDatabaseMigration {
  database: IDBDatabase;
  transaction: IDBTransaction;
  oldVersion: number;
  newVersion: number;
}

export interface SiteDatabaseSchema {
  version: number;
  migrate(context: SiteDatabaseMigration): void;
}

export interface SiteDatabaseTransaction {
  get<T>(table: string, key: IDBValidKey): Promise<T | undefined>;
  put<T>(table: string, value: T): Promise<IDBValidKey>;
  delete(table: string, key: IDBValidKey): Promise<void>;
  getAll<T>(table: string): Promise<T[]>;
  query<T>(
    table: string,
    indexName: string,
    range: IDBKeyRange | IDBValidKey | null,
  ): Promise<T[]>;
}

export interface SiteDatabase extends SiteDatabaseTransaction {
  transaction<T>(
    tables: string | string[],
    mode: SiteDatabaseMode,
    fn: (tx: SiteDatabaseTransaction) => Promise<T>,
  ): Promise<T>;
}

export interface PlaygroundAppProps {
  site: PlaygroundSite;
  storage: SiteStorage;
}

export interface PlaygroundAppModule {
  default: ComponentType<PlaygroundAppProps>;
}
