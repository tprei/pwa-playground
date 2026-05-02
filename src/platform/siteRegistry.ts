import rawConfig from "../../sites.json";
import type { PlaygroundSite, SitesConfig } from "./types";

const config = rawConfig as SitesConfig;

export function listSites(): PlaygroundSite[] {
  return config.sites.map((site) => ({
    ...site,
    route: `/${site.slug}/`,
  }));
}

export function getCurrentSite(pathname: string): PlaygroundSite | null {
  const normalized = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return listSites().find((site) => normalized === site.route || normalized.startsWith(site.route)) ?? null;
}
