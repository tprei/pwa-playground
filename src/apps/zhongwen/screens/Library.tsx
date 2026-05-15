import { useEffect, useMemo, useState } from "react";
import { createSiteDatabase } from "../../../platform/database";
import type { PlaygroundSite, SiteDatabase } from "../../../platform/types";
import { zhongwenSchema } from "../model/schema";
import {
  deleteWordState,
  selectLibraryEntries,
  writeWordState,
  type LibraryEntry,
} from "../model/selector";
import type { WordStateKind } from "../model/types";

const PAGE_SIZE = 20;

type FilterChip = "want-to-learn" | "learning" | "known" | "ignored";

const CHIPS: readonly { id: FilterChip; label: string }[] = [
  { id: "want-to-learn", label: "Want to learn" },
  { id: "learning", label: "Learning" },
  { id: "known", label: "Known" },
  { id: "ignored", label: "Ignored" },
];

const STATE_LABEL: Record<WordStateKind, string> = {
  unknown: "Unknown",
  learning: "Learning",
  known: "Known",
  "want-to-learn": "Want to learn",
  ignored: "Ignored",
};

const SELECTABLE_STATES: readonly WordStateKind[] = [
  "unknown",
  "want-to-learn",
  "learning",
  "known",
  "ignored",
];

export interface LibraryProps {
  site: PlaygroundSite;
  confirm?: (message: string) => boolean;
}

export default function Library({ site, confirm: confirmOverride }: LibraryProps) {
  const database = useMemo<SiteDatabase>(() => createSiteDatabase(site, zhongwenSchema), [site]);

  const [entries, setEntries] = useState<LibraryEntry[] | null>(null);
  const [search, setSearch] = useState<string>("");
  const [chip, setChip] = useState<FilterChip | null>(null);
  const [page, setPage] = useState<number>(0);
  const [busyHanzi, setBusyHanzi] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    try {
      const data = await selectLibraryEntries(database);
      data.sort((a, b) => b.addedAt - a.addedAt);
      setEntries(data);
    } catch (caught) {
      setError(messageOf(caught));
    }
  }

  useEffect(() => {
    void refresh();
  }, [database]);

  useEffect(() => {
    setPage(0);
  }, [search, chip]);

  const filtered = useMemo<LibraryEntry[]>(() => {
    if (!entries) return [];
    const needle = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (chip && entry.state !== chip) return false;
      if (needle.length > 0) {
        const text = [
          entry.hanzi,
          entry.word?.pinyin ?? "",
          entry.word?.glossEn ?? "",
          entry.word?.glossPt ?? "",
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

  async function withBusy(hanzi: string, action: () => Promise<void>): Promise<void> {
    if (busyHanzi) return;
    setBusyHanzi(hanzi);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusyHanzi(null);
    }
  }

  function handleStateChange(hanzi: string, state: WordStateKind): void {
    void withBusy(hanzi, async () => {
      await writeWordState(database, hanzi, state, Date.now());
    });
  }

  function handleDelete(hanzi: string): void {
    const ask = confirmOverride ?? ((message: string) => window.confirm(message));
    if (!ask(`Remove ${hanzi} from your library?`)) return;
    void withBusy(hanzi, async () => {
      await deleteWordState(database, hanzi);
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
        <p className="library__hint">No words yet — your library is empty.</p>
      ) : filtered.length === 0 ? (
        <p className="library__hint">No words match these filters.</p>
      ) : (
        <ul className="library__list">
          {pageEntries.map((entry) => (
            <LibraryRow
              key={entry.hanzi}
              entry={entry}
              busy={busyHanzi === entry.hanzi}
              onStateChange={(state) => handleStateChange(entry.hanzi, state)}
              onDelete={() => handleDelete(entry.hanzi)}
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
  busy: boolean;
  onStateChange: (state: WordStateKind) => void;
  onDelete: () => void;
}

function LibraryRow({ entry, busy, onStateChange, onDelete }: LibraryRowProps) {
  return (
    <li className="library__row">
      <div className="library__row-head">
        <div className="library__row-title">
          <strong>{entry.hanzi}</strong>
          {entry.word?.pinyin ? <span>{entry.word.pinyin}</span> : null}
          {entry.word?.glossEn ? <small>{entry.word.glossEn}</small> : null}
        </div>
        <div className="library__row-meta">
          <span className={`library__state library__state--${entry.state}`}>
            {STATE_LABEL[entry.state]}
          </span>
          {entry.word?.hsk !== undefined ? (
            <span className="library__tag">HSK {entry.word.hsk}</span>
          ) : null}
        </div>
      </div>

      <div className="library__actions">
        <label className="library__state-select">
          <span className="library__state-select-label">State</span>
          <select
            value={entry.state}
            disabled={busy}
            onChange={(event) => onStateChange(event.target.value as WordStateKind)}
          >
            {SELECTABLE_STATES.map((state) => (
              <option key={state} value={state}>
                {STATE_LABEL[state]}
              </option>
            ))}
          </select>
        </label>
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

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
