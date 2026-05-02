# PWA playground rules

This repository hosts many small PWAs on one origin. Each PWA owns one immutable top-level route.

## Route ownership

- Every app owns exactly one route: `/<slug>/`.
- Slugs use lowercase kebab-case.
- A new app requires one `sites.json` entry and one `src/apps/<slug>/entry.tsx`.
- App code may not import from another app.
- App code may import shared platform APIs from `src/platform`.
- App code must not use `localStorage`, `sessionStorage`, `indexedDB`, or `document.cookie` directly. Use `createSiteStorage(site)` from `src/platform/storage`.
- App code must not register service workers directly. Use the platform registration path.
- App assets must resolve under the app route.

## Implementation style

- Keep app modules self-contained.
- Prefer explicit types for app props and data.
- Do not add compatibility shims or speculative shared abstractions.
- Run `pnpm run check` before marking work complete.

## Adding a PWA

Use:

```bash
pnpm run new:pwa -- --slug my-tool --title "My tool" --description "Short description"
```

Then edit `src/apps/my-tool/entry.tsx`, run `pnpm run check`, and deploy after merge.
