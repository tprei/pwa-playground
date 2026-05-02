import siteConfig from "../../sites.json";
import type { SitesConfig } from "../platform/types";

interface Env {
  ASSETS: Fetcher;
  ANTHROPIC_API_KEY: string;
  GOOGLE_TTS_API_KEY: string;
  APP_TOKEN: string;
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

    if (url.pathname === "/api/generate") {
      return handleGenerate(request, env);
    }
    if (url.pathname === "/api/tts") {
      return handleTts(request, env);
    }

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

function authorize(request: Request, env: Env): Response | null {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.APP_TOKEN}`;
  if (!env.APP_TOKEN || header !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

async function handleGenerate(request: Request, env: Env): Promise<Response> {
  const denied = authorize(request, env);
  if (denied) return denied;

  const body = await request.text();
  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body,
  });

  const responseBody = await upstream.text();
  return new Response(responseBody, {
    status: upstream.status,
    headers: { "content-type": "application/json" },
  });
}

async function handleTts(request: Request, env: Env): Promise<Response> {
  const denied = authorize(request, env);
  if (denied) return denied;

  const body = await request.text();
  const upstream = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(env.GOOGLE_TTS_API_KEY)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    },
  );

  if (!upstream.ok) {
    const errorBody = await upstream.text();
    return new Response(errorBody, {
      status: upstream.status,
      headers: { "content-type": "application/json" },
    });
  }

  const payload = (await upstream.json()) as { audioContent?: string };
  if (!payload.audioContent) {
    return new Response(JSON.stringify({ error: "missing audioContent" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  const audioBytes = Uint8Array.from(atob(payload.audioContent), (c) => c.charCodeAt(0));
  return new Response(audioBytes, {
    status: 200,
    headers: { "content-type": "audio/mpeg" },
  });
}
