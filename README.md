# PWA playground

A single-domain PWA factory designed for minions.

Each app lives under one route:

```txt
https://play.prschdt.xyz/zhongwen/
https://play.prschdt.xyz/finance/
```

The platform shell loads the matching app module, attaches the matching manifest, and registers a route-scoped service worker.

## Start

```bash
pnpm install
pnpm dev
```

Open:

```txt
http://localhost:5177/zhongwen/
http://localhost:5177/finance/
```

## Add an app

```bash
pnpm run new:pwa -- --slug timer --title "Timer" --description "A focused timer"
pnpm run check
```

The script updates `sites.json` and creates `src/apps/timer/entry.tsx`.

## Deploy through Cloudflare

Connect this GitHub repo in the Cloudflare dashboard:

```txt
Workers & Pages -> Create application -> Import a repository
Repository: tprei/pwa-playground
Production branch: main
Build command: pnpm install --frozen-lockfile && pnpm run check
Deploy command: pnpm wrangler deploy
```

Cloudflare will deploy on every push to `main`, so merged minion PRs update the live PWAs.

The default Worker custom domain is `play.prschdt.xyz`, configured in `wrangler.jsonc`. Change that before connecting the repo if you want a different hostname. Keep `minions.prschdt.xyz` on its existing Cloudflare Tunnel and Zero Trust Access application.

GitHub Actions still checks every pull request and push with `pnpm run check`. Cloudflare owns production deploys.

## Bind this repo in minions

Add this repo to `<workspace>/repos.json`:

```json
{
  "id": "playground",
  "label": "PWA playground",
  "remote": "https://github.com/<you>/pwa-playground.git",
  "defaultBranch": "main"
}
```

Use prompts like:

```txt
Create a new PWA at /timer/. Follow CLAUDE.md. Keep the module isolated. Run pnpm run check.
```
