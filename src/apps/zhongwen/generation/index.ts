import type { SiteStorage } from "../../../platform/types";
import type {
  RadicalBreakdownRecord,
  SentenceInputArgs,
  SentenceRecord,
  SiteDatabase,
} from "../data";
import type { Word } from "../model";
import {
  RADICAL_SYSTEM_PROMPT,
  SENTENCE_SYSTEM_PROMPT,
  buildRadicalUserMessage,
  buildSentenceUserMessage,
} from "./prompts";

const TOKEN_KEY = "apiToken";
const TOPICS_KEY = "topics";
const DEFAULT_TOPICS = ["software/coding", "gym", "daily life"];

const SENTENCE_MODEL = "claude-haiku-4-5-20251001";
const RADICAL_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 512;

export type GenerationErrorCode = "auth" | "rate" | "network" | "invalid";

export class GenerationError extends Error {
  readonly code: GenerationErrorCode;
  constructor(code: GenerationErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "GenerationError";
    this.code = code;
  }
}

export interface SentencePrefs {
  style: string;
  topics?: string[];
}

export interface GenerateSentenceArgs {
  targetWord: Word;
  knownWords: Word[];
  recentTopics: string[];
  prefs: SentencePrefs;
}

export interface GenerateRadicalArgs {
  hanzi: string;
  knownComponents: string[];
  l1Hint: string;
}

export interface GenerationDeps {
  storage: SiteStorage;
  db: SiteDatabase;
}

export interface Generation {
  generateT1Sentence(args: GenerateSentenceArgs): Promise<SentenceRecord>;
  generateRadicalAndMnemonic(args: GenerateRadicalArgs): Promise<RadicalBreakdownRecord>;
  regenerate(sentenceId: string): Promise<SentenceRecord>;
}

export function createGeneration({ storage, db }: GenerationDeps): Generation {
  return {
    async generateT1Sentence(args) {
      const topics = effectiveTopics(args.prefs, storage);
      const cacheKey = await sentenceCacheKey(args.targetWord.id, topics, args.prefs.style);
      const cached = await db.sentences.get(cacheKey);
      if (cached && knownIsSubset(cached.knownWordIds, args.knownWords)) {
        return cached;
      }
      const fresh = await generateSentence(storage, args, topics, cacheKey);
      await db.sentences.put(fresh);
      return fresh;
    },

    async generateRadicalAndMnemonic(args) {
      const cacheKey = await radicalCacheKey(args);
      const cached = await db.radicalBreakdowns.get(cacheKey);
      if (cached) return cached;
      const fresh = await generateRadical(storage, args, cacheKey);
      await db.radicalBreakdowns.put(fresh);
      return fresh;
    },

    async regenerate(sentenceId) {
      const existing = await db.sentences.get(sentenceId);
      if (!existing) {
        throw new GenerationError("invalid", `No cached sentence with id "${sentenceId}"`);
      }
      const topics = effectiveTopics(existing.inputArgs.prefs, storage);
      const fresh = await generateSentence(storage, existing.inputArgs, topics, sentenceId);
      await db.sentences.put(fresh);
      return fresh;
    },
  };
}

function knownIsSubset(cachedKnownIds: string[], current: Word[]): boolean {
  const currentIds = new Set(current.map((w) => w.id));
  for (const id of cachedKnownIds) {
    if (!currentIds.has(id)) return false;
  }
  return true;
}

async function sentenceCacheKey(targetWordId: string, topics: string[], style: string): Promise<string> {
  const sorted = topics.slice().sort();
  return sha256Hex(`sentence|${targetWordId}|${sorted.join(",")}|${style}`);
}

async function radicalCacheKey(args: GenerateRadicalArgs): Promise<string> {
  return sha256Hex(`radical|${args.hanzi}|${args.l1Hint}`);
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function generateSentence(
  storage: SiteStorage,
  args: SentenceInputArgs,
  topics: string[],
  cacheKey: string,
): Promise<SentenceRecord> {
  const userMessage = buildSentenceUserMessage({
    targetHanzi: args.targetWord.hanzi,
    targetPinyin: args.targetWord.pinyin,
    knownHanzi: args.knownWords.map((w) => w.hanzi),
    topics,
    recentTopics: args.recentTopics,
    style: args.prefs.style,
  });

  const text = await callMessages(storage, {
    model: SENTENCE_MODEL,
    system: SENTENCE_SYSTEM_PROMPT,
    user: userMessage,
  });

  const parsed = parseJson<{ hanzi: string; pinyin: string; glossEN: string; glossPT: string }>(text);
  if (!parsed.hanzi || !parsed.pinyin || !parsed.glossEN || !parsed.glossPT) {
    throw new GenerationError("invalid", "Sentence response is missing required fields");
  }
  if (!parsed.hanzi.includes(args.targetWord.hanzi)) {
    throw new GenerationError("invalid", "Sentence does not contain the target word");
  }

  return {
    id: cacheKey,
    cacheKey,
    targetWordId: args.targetWord.id,
    hanzi: parsed.hanzi,
    pinyin: parsed.pinyin,
    glossEN: parsed.glossEN,
    glossPT: parsed.glossPT,
    knownWordIds: args.knownWords.map((w) => w.id),
    topics,
    style: args.prefs.style,
    inputArgs: args,
    generatedAt: Date.now(),
  };
}

async function generateRadical(
  storage: SiteStorage,
  args: GenerateRadicalArgs,
  cacheKey: string,
): Promise<RadicalBreakdownRecord> {
  const userMessage = buildRadicalUserMessage(args);
  const text = await callMessages(storage, {
    model: RADICAL_MODEL,
    system: RADICAL_SYSTEM_PROMPT,
    user: userMessage,
  });

  const parsed = parseJson<{
    components: Array<{ component: string; meaning: string }>;
    mnemonic: string;
  }>(text);
  if (!Array.isArray(parsed.components) || parsed.components.length === 0 || !parsed.mnemonic) {
    throw new GenerationError("invalid", "Radical response is missing required fields");
  }
  for (const c of parsed.components) {
    if (!c || typeof c.component !== "string" || typeof c.meaning !== "string") {
      throw new GenerationError("invalid", "Radical components are malformed");
    }
  }

  return {
    id: cacheKey,
    cacheKey,
    hanzi: args.hanzi,
    l1Hint: args.l1Hint,
    components: parsed.components,
    mnemonic: parsed.mnemonic,
    generatedAt: Date.now(),
  };
}

interface MessagesCall {
  model: string;
  system: string;
  user: string;
}

async function callMessages(storage: SiteStorage, call: MessagesCall): Promise<string> {
  const token = storage.get(TOKEN_KEY);
  if (!token) {
    throw new GenerationError("auth", "Missing API token in settings");
  }

  let response: Response;
  try {
    response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: call.model,
        max_tokens: MAX_TOKENS,
        system: [
          {
            type: "text",
            text: call.system,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: call.user }],
      }),
    });
  } catch (cause) {
    throw new GenerationError("network", "Network request to /api/generate failed", { cause });
  }

  if (response.status === 401 || response.status === 403) {
    throw new GenerationError("auth", `Authorization rejected (${response.status})`);
  }
  if (response.status === 429) {
    throw new GenerationError("rate", "Rate limit exceeded");
  }
  if (!response.ok) {
    throw new GenerationError("network", `Upstream error ${response.status}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (cause) {
    throw new GenerationError("invalid", "Response was not valid JSON", { cause });
  }

  const text = extractText(payload);
  if (!text) {
    throw new GenerationError("invalid", "Response had no text content");
  }
  return text;
}

function extractText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const content = (payload as { content?: unknown }).content;
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (block && typeof block === "object" && (block as { type?: unknown }).type === "text") {
      const text = (block as { text?: unknown }).text;
      if (typeof text === "string") return text;
    }
  }
  return null;
}

function parseJson<T>(text: string): T {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(stripped) as T;
  } catch (cause) {
    throw new GenerationError("invalid", "Model output was not valid JSON", { cause });
  }
}

function effectiveTopics(prefs: SentencePrefs, storage: SiteStorage): string[] {
  if (prefs.topics && prefs.topics.length > 0) return prefs.topics;
  const raw = storage.get(TOPICS_KEY);
  if (!raw) return DEFAULT_TOPICS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((t) => typeof t === "string") && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_TOPICS;
}
