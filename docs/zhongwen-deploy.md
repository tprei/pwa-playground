# Zhongwen deploy guide

The playground worker exposes two server-side proxy routes used by Zhongwen and any other app that needs LLM or TTS access without shipping API keys to the browser:

- `POST /api/generate` — proxies to the OpenRouter chat completions API (`https://openrouter.ai/api/v1/chat/completions`). Non-streaming; returns the upstream JSON response unchanged.
- `POST /api/tts` — proxies to Google Cloud Text-to-Speech (`https://texttospeech.googleapis.com/v1/text:synthesize`). Decodes the upstream `audioContent` (base64) and returns raw audio bytes with `Content-Type: audio/mpeg`.

Both routes require an `Authorization: Bearer <APP_TOKEN>` header. Mismatches return `401`.

## Secrets

Three secrets back the routes:

| Secret | Used by | Source |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | `/api/generate` | OpenRouter dashboard |
| `GOOGLE_TTS_API_KEY` | `/api/tts` | Google Cloud console (TTS-enabled API key) |
| `APP_TOKEN` | both routes (auth gate) | Generate locally, e.g. `openssl rand -hex 32` |

Set them on the deployed worker with `wrangler secret put`:

```bash
wrangler secret put OPENROUTER_API_KEY
wrangler secret put GOOGLE_TTS_API_KEY
wrangler secret put APP_TOKEN
```

Each command prompts for the value. **Never** add these to `wrangler.jsonc#vars` and never commit values — they are secrets.

To rotate, re-run `wrangler secret put <NAME>` with the new value. To remove, `wrangler secret delete <NAME>`.

## Local development

`pnpm dev` runs Vite alone — fine for app code that does not call `/api/*`. To exercise the proxy routes locally, use:

```bash
pnpm dev:full
```

This runs Vite (`:5177`) and `wrangler dev` (`:8787`) together via `concurrently`. Vite is configured with `server.proxy` so `/api/*` requests from the SPA are forwarded to the local worker.

For the local worker to reach the upstream APIs, provide local secret values via a `.dev.vars` file in the repo root (gitignored, never commit):

```
OPENROUTER_API_KEY=sk-or-...
GOOGLE_TTS_API_KEY=AIza...
APP_TOKEN=dev-token
```

`wrangler dev` reads `.dev.vars` automatically. The SPA must send `Authorization: Bearer dev-token` on requests to `/api/*`.

## Deploy

```bash
pnpm run deploy
```

This runs `pnpm run check` (boundary checks + build) then `wrangler deploy`. Secrets persist across deploys; you only need to re-run `wrangler secret put` when rotating.

After deploy, smoke-test:

```bash
curl -i -X POST https://play.prschdt.xyz/api/generate \
  -H "authorization: Bearer $APP_TOKEN" \
  -H "content-type: application/json" \
  -d '{"model":"anthropic/claude-haiku-4.5","max_tokens":32,"messages":[{"role":"user","content":"ping"}]}'
```

A missing or wrong bearer should yield `401`.
