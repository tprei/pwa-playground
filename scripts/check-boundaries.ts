import fs from "node:fs/promises";
import path from "node:path";
import config from "../sites.json";
import type { SitesConfig } from "../src/platform/types";

const root = process.cwd();
const srcDir = path.join(root, "src");
const appsDir = path.join(srcDir, "apps");
const platformDir = path.join(srcDir, "platform");
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const importPattern = /\bfrom\s+["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
const forbiddenApiPattern = /\b(localStorage|sessionStorage|indexedDB)\b|document\.cookie|navigator\.serviceWorker/;

const siteConfig = config as SitesConfig;
const errors: string[] = [];

async function main() {
  const slugs = new Set<string>();

  for (const site of siteConfig.sites) {
    if (!slugPattern.test(site.slug)) {
      errors.push(`Invalid slug "${site.slug}". Use lowercase kebab-case.`);
    }

    if (slugs.has(site.slug)) {
      errors.push(`Duplicate site slug "${site.slug}".`);
    }

    slugs.add(site.slug);

    if (!site.title.trim()) errors.push(`${site.slug} is missing a title.`);
    if (!site.description.trim()) errors.push(`${site.slug} is missing a description.`);
    if (!isHexColor(site.themeColor)) errors.push(`${site.slug} themeColor must be a hex color.`);
    if (!isHexColor(site.backgroundColor)) errors.push(`${site.slug} backgroundColor must be a hex color.`);

    const entryPath = path.join(appsDir, site.slug, "entry.tsx");
    if (!(await exists(entryPath))) {
      errors.push(`${site.slug} is missing src/apps/${site.slug}/entry.tsx.`);
    }
  }

  const appDirs = await listDirectories(appsDir);
  for (const appDir of appDirs) {
    if (!slugs.has(appDir)) {
      errors.push(`src/apps/${appDir} exists without a sites.json entry.`);
    }
  }

  for (const slug of slugs) {
    await checkApp(slug);
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`Route boundary check passed for ${slugs.size} app(s).`);
}

async function checkApp(slug: string) {
  const appDir = path.join(appsDir, slug);
  const files = await listSourceFiles(appDir);

  for (const file of files) {
    const source = await fs.readFile(file, "utf8");
    const relativeFile = path.relative(root, file);

    if (forbiddenApiPattern.test(source)) {
      errors.push(`${relativeFile} uses origin-scoped browser APIs directly. Use platform APIs.`);
    }

    for (const specifier of importSpecifiers(source)) {
      if (!specifier.startsWith(".")) continue;

      const resolved = path.resolve(path.dirname(file), specifier);
      if (isInside(resolved, appDir) || isInside(resolved, platformDir)) continue;

      if (isInside(resolved, appsDir)) {
        errors.push(`${relativeFile} imports another app through "${specifier}".`);
      } else {
        errors.push(`${relativeFile} imports outside its app and platform APIs through "${specifier}".`);
      }
    }
  }
}

function importSpecifiers(source: string): string[] {
  const matches: string[] = [];
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1] ?? match[2];
    if (specifier) matches.push(specifier);
  }
  return matches;
}

async function listSourceFiles(dir: string): Promise<string[]> {
  if (!(await exists(dir))) return [];

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return listSourceFiles(fullPath);
      if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) return [fullPath];
      return [];
    }),
  );

  return files.flat();
}

async function listDirectories(dir: string): Promise<string[]> {
  if (!(await exists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

function isInside(candidate: string, parent: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

await main();
