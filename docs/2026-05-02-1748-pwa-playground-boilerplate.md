# PWA playground boilerplate

## Goal

Create a deployable playground repo where minions can add independent PWAs without touching DNS, Cloudflare Tunnel, or shared application code outside an explicit platform API.

## Chosen shape

- One origin: `play.prschdt.xyz`.
- One route per app: `/<slug>/`.
- One Cloudflare Worker deployment with Vite static assets.
- Route-scoped manifests and service workers generated from `sites.json`.
- Boundary checks enforce app isolation.

## Operational notes

- Keep `minions.prschdt.xyz` on the existing Cloudflare Tunnel and Access application.
- Put playground apps on paths under `play.prschdt.xyz` to avoid wildcard certificate and Worker route overlap.
- Add private app access at Cloudflare Access by path only when a concrete private app exists.
