import type { PlaygroundSite } from "./types";

let activeSlug: string | null = null;

export function configurePwaForSite(site: PlaygroundSite) {
  document.title = site.title;
  setMeta("description", site.description);
  setThemeColor(site.themeColor);
  setIcon(site);
  setManifest(site);
  void registerRouteWorker(site);
}

function setMeta(name: string, content: string) {
  const selector = `meta[name="${name}"]`;
  const existing = document.head.querySelector<HTMLMetaElement>(selector);
  const tag = existing ?? document.createElement("meta");
  tag.name = name;
  tag.content = content;
  if (!existing) document.head.appendChild(tag);
}

function setThemeColor(color: string) {
  const tag = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (tag) tag.content = color;
}

function setManifest(site: PlaygroundSite) {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  const tag = existing ?? document.createElement("link");
  tag.rel = "manifest";
  tag.href = `/${site.slug}/manifest.webmanifest`;
  if (!existing) document.head.appendChild(tag);
}

function setIcon(site: PlaygroundSite) {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
  const tag = existing ?? document.createElement("link");
  tag.rel = "icon";
  tag.href = `/${site.slug}/icon.svg`;
  if (!existing) document.head.appendChild(tag);
}

async function registerRouteWorker(site: PlaygroundSite) {
  if (!("serviceWorker" in navigator)) return;
  if (activeSlug === site.slug) return;
  activeSlug = site.slug;
  await navigator.serviceWorker.register(`/${site.slug}/sw.js`, {
    scope: `/${site.slug}/`,
  });
}
