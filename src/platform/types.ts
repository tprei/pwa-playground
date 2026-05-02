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

export interface PlaygroundAppProps {
  site: PlaygroundSite;
  storage: SiteStorage;
}

export interface PlaygroundAppModule {
  default: ComponentType<PlaygroundAppProps>;
}
