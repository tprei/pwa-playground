import type { PlaygroundSite, SiteStorage } from "./types";

export function createSiteStorage(site: PlaygroundSite): SiteStorage {
  const prefix = `${site.slug}:v1:`;
  return {
    get(key) {
      return window.localStorage.getItem(`${prefix}${key}`);
    },
    set(key, value) {
      window.localStorage.setItem(`${prefix}${key}`, value);
    },
    remove(key) {
      window.localStorage.removeItem(`${prefix}${key}`);
    },
  };
}
