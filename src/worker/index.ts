import siteConfig from "../../sites.json";
import type { SitesConfig } from "../platform/types";

interface Env {
  ASSETS: Fetcher;
}

const config = siteConfig as SitesConfig;
const siteSlugs = new Set(config.sites.map((site) => site.slug));

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const [slug] = url.pathname.split("/").filter(Boolean);

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) return assetResponse;

    if (slug && siteSlugs.has(slug)) {
      return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
    }

    return assetResponse;
  },
} satisfies ExportedHandler<Env>;
