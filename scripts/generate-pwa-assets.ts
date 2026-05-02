import fs from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";
import config from "../sites.json";
import type { SitesConfig, SiteDefinition } from "../src/platform/types";

const root = process.cwd();
const siteConfig = config as SitesConfig;

async function main() {
  for (const site of siteConfig.sites) {
    const publicDir = path.join(root, "public", "_pwa", site.slug);
    await fs.mkdir(publicDir, { recursive: true });
    await fs.writeFile(path.join(publicDir, "manifest.webmanifest"), `${JSON.stringify(manifest(site), null, 2)}\n`);
    await fs.writeFile(path.join(publicDir, "sw.js"), serviceWorker(site));
    await fs.writeFile(path.join(publicDir, "icon.svg"), icon(site));
    await fs.writeFile(path.join(publicDir, "icon-192.png"), pngIcon(site, 192));
    await fs.writeFile(path.join(publicDir, "icon-512.png"), pngIcon(site, 512));
    await fs.writeFile(path.join(publicDir, "apple-touch-icon.png"), pngIcon(site, 180));
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
      {
        src: `/${site.slug}/icon-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: `/${site.slug}/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };
}

function serviceWorker(site: SiteDefinition): string {
  return `const CACHE_PREFIX = "pwa-playground:${site.slug}:";
const CACHE_NAME = CACHE_PREFIX + "v1";
const APP_SCOPE = "/${site.slug}/";
const SHELL_URLS = [
  APP_SCOPE,
  "/index.html",
  "/${site.slug}/manifest.webmanifest",
  "/${site.slug}/icon.svg",
  "/${site.slug}/icon-192.png",
  "/${site.slug}/icon-512.png",
  "/${site.slug}/apple-touch-icon.png",
];

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

function pngIcon(site: SiteDefinition, size: number): Buffer {
  const background = hexToRgb(site.themeColor);
  const accent = hexToRgb(site.backgroundColor);
  const pixels = Buffer.alloc(size * size * 4);
  const radius = Math.floor(size * 0.18);
  const accentRadius = Math.floor(size * 0.18);
  const accentCx = Math.floor(size * 0.74);
  const accentCy = Math.floor(size * 0.26);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const outsideCorner =
        (x < radius && y < radius && distance(x, y, radius, radius) > radius) ||
        (x >= size - radius && y < radius && distance(x, y, size - radius - 1, radius) > radius) ||
        (x < radius && y >= size - radius && distance(x, y, radius, size - radius - 1) > radius) ||
        (x >= size - radius &&
          y >= size - radius &&
          distance(x, y, size - radius - 1, size - radius - 1) > radius);

      if (outsideCorner) {
        pixels[offset] = 0;
        pixels[offset + 1] = 0;
        pixels[offset + 2] = 0;
        pixels[offset + 3] = 0;
        continue;
      }

      const inAccent = distance(x, y, accentCx, accentCy) <= accentRadius;
      const inBarA = x >= size * 0.18 && x <= size * 0.7 && y >= size * 0.38 && y <= size * 0.5;
      const inBarB = x >= size * 0.18 && x <= size * 0.56 && y >= size * 0.58 && y <= size * 0.7;
      const color = inAccent || inBarA || inBarB ? accent : background;
      pixels[offset] = color.r;
      pixels[offset + 1] = color.g;
      pixels[offset + 2] = color.b;
      pixels[offset + 3] = 255;
    }
  }

  return encodePng(size, size, pixels);
}

function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr(width, height)),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function ihdr(width: number, height: number): Buffer {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;
  data[9] = 6;
  data[10] = 0;
  data[11] = 0;
  data[12] = 0;
  return data;
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(input: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of input) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff]!;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeCrcTable(): number[] {
  const table: number[] = [];
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

function hexToRgb(value: string): { r: number; g: number; b: number } {
  const normalized = value.replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function distance(x: number, y: number, cx: number, cy: number): number {
  return Math.hypot(x - cx, y - cy);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const crcTable = makeCrcTable();

await main();
