import siteConfig from "../../sites.json";
import type { SitesConfig } from "../platform/types";

interface Env {
  ASSETS: Fetcher;
}

const config = siteConfig as SitesConfig;
const siteSlugs = new Set(config.sites.map((site) => site.slug));
const siteAssetNames = new Set([
  "manifest.webmanifest",
  "sw.js",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const [slug] = url.pathname.split("/").filter(Boolean);

    if (url.pathname === "/") {
      return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
    }

    if (slug && siteSlugs.has(slug)) {
      if (url.pathname === `/${slug}`) {
        url.pathname = `/${slug}/`;
        return Response.redirect(url, 308);
      }

      const assetName = siteAssetName(url.pathname, slug);
      if (assetName) {
        return fetchSiteAsset(request, env, slug, assetName);
      }

      if (isSiteShellRequest(url.pathname, slug)) {
        return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
      }
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) return assetResponse;

    return assetResponse;
  },
} satisfies ExportedHandler<Env>;

async function fetchSiteAsset(request: Request, env: Env, slug: string, assetName: string): Promise<Response> {
  const assetUrl = new URL(`/_pwa/${slug}/${assetName}`, request.url);
  const response = await env.ASSETS.fetch(new Request(assetUrl, request));

  if (assetName !== "sw.js") return response;

  const headers = new Headers(response.headers);
  headers.set("Service-Worker-Allowed", `/${slug}/`);
  headers.set("Cache-Control", "no-cache");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function siteAssetName(pathname: string, slug: string): string | null {
  const routePrefix = `/${slug}/`;
  if (!pathname.startsWith(routePrefix)) return null;
  const localPath = pathname.slice(routePrefix.length);
  if (localPath.includes("/")) return null;
  return siteAssetNames.has(localPath) ? localPath : null;
}

function isSiteShellRequest(pathname: string, slug: string): boolean {
  const routePrefix = `/${slug}/`;
  if (!pathname.startsWith(routePrefix)) return false;
  const localPath = pathname.slice(routePrefix.length);
  if (localPath === "") return true;
  const lastSegment = localPath.split("/").at(-1) ?? "";
  return !/\.[a-z0-9]+$/i.test(lastSegment);
}
