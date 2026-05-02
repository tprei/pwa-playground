import { useMemo, useRef, useState } from "react";
import { createSiteDatabase } from "../../../platform/database";
import { createSiteStorage } from "../../../platform/storage";
import type { PlaygroundSite, SiteDatabase, SiteStorage } from "../../../platform/types";
import { tableNames, zhongwenSchema } from "../model/schema";
import type { CardMode, Word } from "../model/types";
import { createSchedulerWith, type Scheduler } from "../srs/scheduler";

type InputMode = "cn" | "en" | "intent";

const V1_CARD_MODES: CardMode[] = ["reading", "listening", "writing-strokes"];

const TAB_ORDER: InputMode[] = ["cn", "en", "intent"];

const TAB_LABEL: Record<InputMode, string> = {
  cn: "CN",
  en: "EN / butchery",
  intent: "Intent",
};

const TAB_PLACEHOLDER: Record<InputMode, string> = {
  cn: "Paste hanzi or pinyin",
  en: 'e.g. "how do you say tired in chinese" or just "tired"',
  intent: "Free-form: I want to ask people for space politely",
};

export interface PickCandidate {
  hanzi: string;
  pinyin: string;
  glossEn: string;
  usage?: string;
}

export interface CedictEntry {
  hanzi: string;
  pinyin: string;
  gloss: string;
}

export type CedictDictionary = Record<string, CedictEntry[]>;

export interface PicksRequest {
  mode: InputMode;
  input: string;
}

export type CedictLookup = (input: string) => Promise<CedictEntry[]>;
export type PicksRequester = (request: PicksRequest) => Promise<PickCandidate[]>;

export interface AddWordProps {
  site: PlaygroundSite;
  scheduler?: Scheduler;
  cedictLookup?: CedictLookup;
  requestPicks?: PicksRequester;
  onAdded?: (word: Word) => void;
}

type CandidateSource = "cedict" | "llm-cache" | "llm";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; candidates: PickCandidate[]; source: CandidateSource }
  | { kind: "empty" }
  | { kind: "error"; message: string };

export default function AddWord({
  site,
  scheduler: schedulerOverride,
  cedictLookup: cedictOverride,
  requestPicks: requestPicksOverride,
  onAdded,
}: AddWordProps) {
  const database = useMemo<SiteDatabase>(() => createSiteDatabase(site, zhongwenSchema), [site]);
  const storage = useMemo<SiteStorage>(() => createSiteStorage(site), [site]);
  const scheduler = useMemo<Scheduler>(
    () => schedulerOverride ?? createSchedulerWith(database, storage),
    [database, storage, schedulerOverride],
  );
  const cedictLookup = useMemo<CedictLookup>(
    () => cedictOverride ?? defaultCedictLookup(site.slug),
    [site.slug, cedictOverride],
  );
  const requestPicks = useMemo<PicksRequester>(
    () => requestPicksOverride ?? defaultRequestPicks(site.slug),
    [site.slug, requestPicksOverride],
  );

  const [activeMode, setActiveMode] = useState<InputMode>("cn");
  const [inputs, setInputs] = useState<Record<InputMode, string>>({ cn: "", en: "", intent: "" });
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [adding, setAdding] = useState<string | null>(null);
  const requestId = useRef(0);

  function setInput(mode: InputMode, value: string) {
    setInputs((previous) => ({ ...previous, [mode]: value }));
  }

  function selectTab(mode: InputMode) {
    if (mode === activeMode) return;
    setActiveMode(mode);
    setStatus({ kind: "idle" });
    setSelectedIndex(0);
  }

  async function handleLookup() {
    const trimmed = inputs[activeMode].trim();
    if (!trimmed) {
      setStatus({ kind: "error", message: "Type something to look up." });
      return;
    }
    const ticket = ++requestId.current;
    setStatus({ kind: "loading" });
    setSelectedIndex(0);

    try {
      const resolved = await resolveCandidates(activeMode, trimmed, {
        cedictLookup,
        requestPicks,
        storage,
      });
      if (ticket !== requestId.current) return;
      if (resolved.candidates.length === 0) {
        setStatus({ kind: "empty" });
        return;
      }
      setStatus({ kind: "ready", candidates: resolved.candidates, source: resolved.source });
    } catch (error) {
      if (ticket !== requestId.current) return;
      setStatus({ kind: "error", message: messageOf(error) });
    }
  }

  async function handleAdd(candidate: PickCandidate) {
    if (adding) return;
    const id = wordIdFor(candidate.hanzi);
    setAdding(id);
    try {
      const word: Word = {
        id,
        hanzi: candidate.hanzi,
        pinyin: candidate.pinyin,
        glossEn: candidate.glossEn,
        addedAt: Date.now(),
        source: "user",
      };
      await database.put<Word>(tableNames.words, word);
      await scheduler.createCardsForWord(word.id, V1_CARD_MODES);
      onAdded?.(word);
      setInputs((previous) => ({ ...previous, [activeMode]: "" }));
      setStatus({ kind: "idle" });
      setSelectedIndex(0);
    } catch (error) {
      setStatus({ kind: "error", message: messageOf(error) });
    } finally {
      setAdding(null);
    }
  }

  return (
    <section className="add-word">
      <header className="add-word__tabs" role="tablist" aria-label="Add word input mode">
        {TAB_ORDER.map((mode) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={mode === activeMode}
            className={`add-word__tab${mode === activeMode ? " is-active" : ""}`}
            onClick={() => selectTab(mode)}
          >
            {TAB_LABEL[mode]}
          </button>
        ))}
      </header>

      <div className="add-word__form">
        <textarea
          className="add-word__input"
          rows={activeMode === "intent" ? 3 : 1}
          value={inputs[activeMode]}
          placeholder={TAB_PLACEHOLDER[activeMode]}
          onChange={(event) => setInput(activeMode, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleLookup();
            }
          }}
        />
        <button
          type="button"
          className="add-word__lookup"
          disabled={status.kind === "loading"}
          onClick={() => void handleLookup()}
        >
          {status.kind === "loading" ? "Looking up…" : "Look up"}
        </button>
      </div>

      <div className="add-word__results" aria-live="polite">
        {renderStatus(status, {
          selectedIndex,
          onSelect: setSelectedIndex,
          adding,
          onAdd: (candidate) => void handleAdd(candidate),
        })}
      </div>
    </section>
  );
}

interface RenderArgs {
  selectedIndex: number;
  onSelect: (index: number) => void;
  adding: string | null;
  onAdd: (candidate: PickCandidate) => void;
}

function renderStatus(status: Status, args: RenderArgs) {
  if (status.kind === "idle") return null;
  if (status.kind === "loading") return <p className="add-word__hint">Resolving…</p>;
  if (status.kind === "empty") {
    return <p className="add-word__hint">No matches yet — try another phrasing.</p>;
  }
  if (status.kind === "error") {
    return <p className="add-word__hint add-word__hint--error">{status.message}</p>;
  }

  return (
    <>
      <p className="add-word__source">{sourceLabel(status.source)}</p>
      <ul className="add-word__candidates">
        {status.candidates.map((candidate, index) => {
          const id = wordIdFor(candidate.hanzi);
          const isSelected = index === args.selectedIndex;
          return (
            <li
              key={`${candidate.hanzi}:${index}`}
              className={`add-word__candidate${isSelected ? " is-selected" : ""}`}
            >
              <button
                type="button"
                className="add-word__candidate-pick"
                aria-pressed={isSelected}
                onClick={() => args.onSelect(index)}
              >
                <strong>{candidate.hanzi}</strong>
                <span>{candidate.pinyin}</span>
                <small>{candidate.glossEn}</small>
                {candidate.usage ? <em>{candidate.usage}</em> : null}
              </button>
              <button
                type="button"
                className="add-word__candidate-add"
                disabled={args.adding !== null}
                onClick={() => args.onAdd(candidate)}
              >
                {args.adding === id ? "Adding…" : "Add"}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

interface ResolveDeps {
  cedictLookup: CedictLookup;
  requestPicks: PicksRequester;
  storage: SiteStorage;
}

async function resolveCandidates(
  mode: InputMode,
  input: string,
  deps: ResolveDeps,
): Promise<{ candidates: PickCandidate[]; source: CandidateSource }> {
  if (mode === "cn") {
    const direct = await deps.cedictLookup(input);
    if (direct.length > 0) {
      return { candidates: direct.map(toCandidate), source: "cedict" };
    }
  }
  const cacheKey = picksCacheKey(mode, input);
  const cached = readCachedPicks(deps.storage, cacheKey);
  if (cached) {
    return { candidates: cached, source: "llm-cache" };
  }
  const fresh = await deps.requestPicks({ mode, input });
  writeCachedPicks(deps.storage, cacheKey, fresh);
  return { candidates: fresh, source: "llm" };
}

function sourceLabel(source: CandidateSource): string {
  if (source === "cedict") return "From dictionary";
  if (source === "llm-cache") return "Cached from previous lookup";
  return "Suggested for you";
}

function toCandidate(entry: CedictEntry): PickCandidate {
  return { hanzi: entry.hanzi, pinyin: entry.pinyin, glossEn: entry.gloss };
}

function normalizeInput(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

function picksCacheKey(mode: InputMode, input: string): string {
  return `add-word:picks:${mode}:${normalizeInput(input)}`;
}

function readCachedPicks(storage: SiteStorage, key: string): PickCandidate[] | null {
  const raw = storage.get(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed as PickCandidate[];
  } catch {
    return null;
  }
}

function writeCachedPicks(storage: SiteStorage, key: string, picks: PickCandidate[]): void {
  storage.set(key, JSON.stringify(picks));
}

function wordIdFor(hanzi: string): string {
  return `w:${hanzi}`;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function defaultCedictLookup(slug: string): CedictLookup {
  let pending: Promise<CedictDictionary> | null = null;
  function load(): Promise<CedictDictionary> {
    if (!pending) {
      pending = fetch(`/${slug}/cedict.json`)
        .then((response) => {
          if (!response.ok) throw new Error(`Failed to load cedict (${response.status})`);
          return response.json() as Promise<CedictDictionary>;
        })
        .catch((error) => {
          pending = null;
          throw error;
        });
    }
    return pending;
  }
  return async (input) => {
    const dict = await load();
    const trimmed = input.trim();
    if (!trimmed) return [];
    return dict[trimmed] ?? dict[normalizeInput(trimmed)] ?? [];
  };
}

function defaultRequestPicks(slug: string): PicksRequester {
  return async ({ mode, input }) => {
    const response = await fetch(`/${slug}/api/picks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode, input }),
    });
    if (!response.ok) throw new Error(`Pick request failed (${response.status})`);
    const payload = (await response.json()) as { picks?: PickCandidate[] };
    return payload.picks ?? [];
  };
}
