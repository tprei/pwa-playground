import fs from "node:fs/promises";
import path from "node:path";
import config from "../sites.json";
import type { SitesConfig, SiteDefinition } from "../src/platform/types";

const root = process.cwd();
const siteConfig = config as SitesConfig;

async function main() {
  for (const site of siteConfig.sites) {
    const publicDir = path.join(root, "public", site.slug);
    await fs.mkdir(publicDir, { recursive: true });
    await fs.writeFile(path.join(publicDir, "manifest.webmanifest"), `${JSON.stringify(manifest(site), null, 2)}\n`);
    await fs.writeFile(path.join(publicDir, "sw.js"), serviceWorker(site));
    await fs.writeFile(path.join(publicDir, "icon.svg"), icon(site));
  }

  console.log(`Generated PWA assets for ${siteConfig.sites.length} app(s).`);
}

function manifest(site: SiteDefinition) {
  return {
    name: site.title,
    short_name: site.title,
    description: site.description,
    start_url: `/${site.slug}/`,
    scope: `/${site.slug}/`,
    display: "standalone",
    theme_color: site.themeColor,
    background_color: site.backgroundColor,
    icons: [
      {
        src: `/${site.slug}/icon.svg`,
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
    ],
  };
}

function serviceWorker(site: SiteDefinition): string {
  return `const CACHE_PREFIX = "pwa-playground:${site.slug}:";
const CACHE_NAME = CACHE_PREFIX + "v1";
const APP_SCOPE = "/${site.slug}/";
const SHELL_URLS = [APP_SCOPE, "/index.html", "/${site.slug}/manifest.webmanifest", "/${site.slug}/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin || !url.pathname.startsWith(APP_SCOPE)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match(APP_SCOPE))),
  );
});
`;
}

function icon(site: SiteDefinition): string {
  const safeTitle = escapeXml(site.title.slice(0, 2).toUpperCase());
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="${site.themeColor}"/>
  <circle cx="384" cy="128" r="84" fill="${site.backgroundColor}" opacity="0.92"/>
  <text x="64" y="322" fill="${site.backgroundColor}" font-family="Arial, sans-serif" font-size="148" font-weight="800">${safeTitle}</text>
</svg>
`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

await main();
