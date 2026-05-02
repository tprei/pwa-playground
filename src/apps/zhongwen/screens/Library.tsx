import { useEffect, useMemo, useState } from "react";
import { createSiteDatabase } from "../../../platform/database";
import { createSiteStorage } from "../../../platform/storage";
import type { PlaygroundSite, SiteDatabase, SiteStorage } from "../../../platform/types";
import { zhongwenSchema } from "../model/schema";
import {
  deleteWord as deleteWordFromGraph,
  loadThumbsUpSentences,
  selectLibraryEntries,
  writeKnownState,
  type LibraryEntry,
} from "../model/selector";
import type { KnownState, Sentence } from "../model/types";
import { createSchedulerWith, type Scheduler } from "../srs/scheduler";

const PAGE_SIZE = 20;
const SENTENCES_PER_WORD = 3;

type FilterChip = "hsk-1" | "hsk-2" | "want-to-learn" | "learning" | "known";

const CHIPS: readonly { id: FilterChip; label: string }[] = [
  { id: "hsk-1", label: "HSK 1" },
  { id: "hsk-2", label: "HSK 2" },
  { id: "want-to-learn", label: "Want to learn" },
  { id: "learning", label: "Learning" },
  { id: "known", label: "Known" },
];

const STATE_LABEL: Record<KnownState, string> = {
  unknown: "Unknown",
  learning: "Learning",
  known: "Known",
  "want-to-learn": "Want to learn",
};

const SELECTABLE_STATES: readonly KnownState[] = [
  "unknown",
  "want-to-learn",
  "learning",
  "known",
];

export interface LibraryProps {
  site: PlaygroundSite;
  scheduler?: Scheduler;
  now?: () => number;
  confirm?: (message: string) => boolean;
}

export default function Library({
  site,
  scheduler: schedulerOverride,
  now = Date.now,
  confirm: confirmOverride,
}: LibraryProps) {
  const database = useMemo<SiteDatabase>(() => createSiteDatabase(site, zhongwenSchema), [site]);
  const storage = useMemo<SiteStorage>(() => createSiteStorage(site), [site]);
  const scheduler = useMemo<Scheduler>(
    () => schedulerOverride ?? createSchedulerWith(database, storage),
    [database, storage, schedulerOverride],
  );

  const [entries, setEntries] = useState<LibraryEntry[] | null>(null);
  const [search, setSearch] = useState<string>("");
  const [chip, setChip] = useState<FilterChip | null>(null);
  const [page, setPage] = useState<number>(0);
  const [busyWordId, setBusyWordId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    try {
      const data = await selectLibraryEntries(database, storage);
      data.sort((a, b) => b.word.addedAt - a.word.addedAt);
      setEntries(data);
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  useEffect(() => {
    void refresh();
  }, [database, storage]);

  useEffect(() => {
    setPage(0);
  }, [search, chip]);

  const filtered = useMemo<LibraryEntry[]>(() => {
    if (!entries) return [];
    const needle = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (chip === "hsk-1" && entry.word.hsk !== 1) return false;
      if (chip === "hsk-2" && entry.word.hsk !== 2) return false;
      if (chip === "want-to-learn" && entry.knownState !== "want-to-learn") return false;
      if (chip === "learning" && entry.knownState !== "learning") return false;
      if (chip === "known" && entry.knownState !== "known") return false;
      if (needle.length > 0) {
        const text = [
          entry.word.hanzi,
          entry.word.pinyin,
          entry.word.glossEn ?? "",
          entry.word.glossPt ?? "",
        ]
          .join("\n")
          .toLowerCase();
        if (!text.includes(needle)) return false;
      }
      return true;
    });
  }, [entries, search, chip]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageEntries = useMemo<LibraryEntry[]>(
    () => filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [filtered, safePage],
  );

  async function withBusy(wordId: string, action: () => Promise<void>): Promise<void> {
    if (busyWordId) return;
    setBusyWordId(wordId);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusyWordId(null);
    }
  }

  function handleSuspend(wordId: string): void {
    void withBusy(wordId, async () => {
      await scheduler.suspendWord(wordId);
    });
  }

  function handleUnsuspend(wordId: string): void {
    void withBusy(wordId, async () => {
      await scheduler.unsuspendWord(wordId);
    });
  }

  function handleStateChange(wordId: string, state: KnownState): void {
    void withBusy(wordId, async () => {
      writeKnownState(storage, wordId, state);
    });
  }

  function handleDelete(wordId: string, hanzi: string): void {
    const ask = confirmOverride ?? ((message: string) => window.confirm(message));
    if (!ask(`Delete ${hanzi} and all its cards/sentences?`)) return;
    void withBusy(wordId, async () => {
      await deleteWordFromGraph(database, storage, wordId);
    });
  }

  if (entries === null) {
    return <p className="library__hint">Loading library…</p>;
  }

  return (
    <section className="library">
      <header className="library__filters">
        <input
          type="search"
          className="library__search"
          placeholder="Search hanzi, pinyin, gloss"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="library__chips" role="tablist" aria-label="Filter by state">
          {CHIPS.map((option) => {
            const active = chip === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`library__chip${active ? " is-active" : ""}`}
                onClick={() => setChip(active ? null : option.id)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </header>

      {error ? <p className="library__hint library__hint--error">{error}</p> : null}

      {entries.length === 0 ? (
        <p className="library__hint">No words yet — add your first word to get started.</p>
      ) : filtered.length === 0 ? (
        <p className="library__hint">No words match these filters.</p>
      ) : (
        <ul className="library__list">
          {pageEntries.map((entry) => (
            <LibraryRow
              key={entry.word.id}
              entry={entry}
              database={database}
              now={now}
              busy={busyWordId === entry.word.id}
              onSuspend={() => handleSuspend(entry.word.id)}
              onUnsuspend={() => handleUnsuspend(entry.word.id)}
              onStateChange={(state) => handleStateChange(entry.word.id, state)}
              onDelete={() => handleDelete(entry.word.id, entry.word.hanzi)}
            />
          ))}
        </ul>
      )}

      {filtered.length > PAGE_SIZE ? (
        <nav className="library__pagination" aria-label="Pagination">
          <button
            type="button"
            className="library__page-button"
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
          >
            Previous
          </button>
          <span className="library__page-status">
            Page {safePage + 1} of {totalPages}
          </span>
          <button
            type="button"
            className="library__page-button"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage(safePage + 1)}
          >
            Next
          </button>
        </nav>
      ) : null}
    </section>
  );
}

interface LibraryRowProps {
  entry: LibraryEntry;
  database: SiteDatabase;
  now: () => number;
  busy: boolean;
  onSuspend: () => void;
  onUnsuspend: () => void;
  onStateChange: (state: KnownState) => void;
  onDelete: () => void;
}

function LibraryRow({
  entry,
  database,
  now,
  busy,
  onSuspend,
  onUnsuspend,
  onStateChange,
  onDelete,
}: LibraryRowProps) {
  const [sentences, setSentences] = useState<Sentence[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadThumbsUpSentences(database, entry.word.id, SENTENCES_PER_WORD)
      .then((loaded) => {
        if (!cancelled) setSentences(loaded);
      })
      .catch(() => {
        if (!cancelled) setSentences([]);
      });
    return () => {
      cancelled = true;
    };
  }, [database, entry.word.id]);

  const dueLabel = formatDueLabel(entry.earliestDue, entry.suspended, now());

  return (
    <li className="library__row">
      <div className="library__row-head">
        <div className="library__row-title">
          <strong>{entry.word.hanzi}</strong>
          <span>{entry.word.pinyin}</span>
          {entry.word.glossEn ? <small>{entry.word.glossEn}</small> : null}
        </div>
        <div className="library__row-meta">
          <span className={`library__state library__state--${entry.knownState}`}>
            {STATE_LABEL[entry.knownState]}
          </span>
          {entry.word.hsk !== undefined ? (
            <span className="library__tag">HSK {entry.word.hsk}</span>
          ) : null}
          {dueLabel ? <span className="library__due">{dueLabel}</span> : null}
        </div>
      </div>

      {sentences && sentences.length > 0 ? (
        <ul className="library__sentences">
          {sentences.map((sentence) => (
            <li key={sentence.id} className="library__sentence">
              <span>{sentence.hanzi}</span>
              <small>{sentence.glossLineEn}</small>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="library__actions">
        <label className="library__state-select">
          <span className="library__state-select-label">State</span>
          <select
            value={entry.knownState}
            disabled={busy}
            onChange={(event) => onStateChange(event.target.value as KnownState)}
          >
            {SELECTABLE_STATES.map((state) => (
              <option key={state} value={state}>
                {STATE_LABEL[state]}
              </option>
            ))}
          </select>
        </label>
        {entry.suspended ? (
          <button
            type="button"
            className="library__action"
            disabled={busy || entry.cards.length === 0}
            onClick={onUnsuspend}
          >
            Unsuspend
          </button>
        ) : (
          <button
            type="button"
            className="library__action"
            disabled={busy || entry.cards.length === 0}
            onClick={onSuspend}
          >
            Suspend
          </button>
        )}
        <button
          type="button"
          className="library__action library__action--danger"
          disabled={busy}
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </li>
  );
}

const DAY_MS = 86_400_000;

function formatDueLabel(due: number | undefined, suspended: boolean, currentTime: number): string | null {
  if (suspended) return "Suspended";
  if (due === undefined) return null;
  const diffDays = Math.round((due - currentTime) / DAY_MS);
  if (diffDays <= 0) return "Due now";
  if (diffDays === 1) return "Due tomorrow";
  return `Due in ${diffDays} days`;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
