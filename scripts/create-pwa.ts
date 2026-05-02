import fs from "node:fs/promises";
import path from "node:path";
import config from "../sites.json";
import type { SitesConfig } from "../src/platform/types";

const siteConfig = config as SitesConfig;
const root = process.cwd();
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const slug = args.slug;
  const title = args.title;
  const description = args.description ?? `${title} workspace.`;

  if (!slug || !title) {
    throw new Error('Usage: pnpm run new:pwa -- --slug my-tool --title "My tool" --description "Short description"');
  }

  if (!slugPattern.test(slug)) {
    throw new Error(`Invalid slug "${slug}". Use lowercase kebab-case.`);
  }

  if (siteConfig.sites.some((site) => site.slug === slug)) {
    throw new Error(`${slug} already exists in sites.json.`);
  }

  const appDir = path.join(root, "src", "apps", slug);
  await fs.mkdir(appDir, { recursive: true });

  const entryPath = path.join(appDir, "entry.tsx");
  await writeNewFile(entryPath, appTemplate(slug, title));

  siteConfig.sites.push({
    slug,
    title,
    description,
    themeColor: "#334155",
    backgroundColor: "#f8fafc",
  });
  siteConfig.sites.sort((a, b) => a.slug.localeCompare(b.slug));

  await fs.writeFile(path.join(root, "sites.json"), `${JSON.stringify(siteConfig, null, 2)}\n`);

  console.log(`Created /${slug}/.`);
}

function parseArgs(args: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      parsed[key] = "true";
    } else {
      parsed[key] = value;
      index += 1;
    }
  }
  return parsed;
}

async function writeNewFile(filePath: string, content: string) {
  try {
    await fs.writeFile(filePath, content, { flag: "wx" });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new Error(`${path.relative(root, filePath)} already exists.`);
    }
    throw error;
  }
}

function appTemplate(slug: string, title: string): string {
  const componentName = toComponentName(slug);
  return `import type { PlaygroundAppProps } from "../../platform/types";

export default function ${componentName}App({ site }: PlaygroundAppProps) {
  return (
    <main className="app">
      <header className="app__header">
        <div>
          <p className="eyebrow">/{site.slug}/</p>
          <h1>${escapeTsxText(title)}</h1>
        </div>
      </header>
    </main>
  );
}
`;
}

function toComponentName(slug: string): string {
  return slug
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join("");
}

function escapeTsxText(value: string): string {
  return value.replace(/[{}<>]/g, "");
}

await main();
