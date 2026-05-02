import { createSiteDatabase, type SiteDatabase } from "../../../platform/database";
import type { PlaygroundSite } from "../../../platform/types";
import { loadFrequency, loadHsk, type FrequencyList, type HskEntry } from "../data";
import {
  WORDS_STORE,
  ZHONGWEN_DB_CONFIG,
  type WordEntry,
  type WordGraph,
} from "../domain-types";

export interface PickNextNewWordOptions {
  /** Frequency-ordered hanzi list, most-frequent first. */
  frequency: FrequencyList;
  /**
   * Restrict candidates to this set when present. Used to scope T1 picks to
   * the HSK 1+2 vocabulary so the user sees beginner words first.
   */
  allowList?: ReadonlySet<string>;
}

/**
 * Pure picker. Returns null when nothing new can be introduced — either the
 * frequency list is exhausted, or every remaining candidate is already
 * tracked or filtered out.
 */
export function pickNextNewWord(
  graph: WordGraph,
  opts: PickNextNewWordOptions,
): string | null {
  const inAllow = (h: string) => !opts.allowList || opts.allowList.has(h);

  const rank = new Map<string, number>();
  for (let i = 0; i < opts.frequency.length; i++) {
    rank.set(opts.frequency[i]!, i);
  }

  let bestWanted: string | null = null;
  let bestWantedRank = Number.POSITIVE_INFINITY;
  for (const [hanzi, entry] of graph) {
    if (entry.state !== "want-to-learn") continue;
    if (!inAllow(hanzi)) continue;
    const r = rank.get(hanzi) ?? Number.POSITIVE_INFINITY;
    if (r < bestWantedRank) {
      bestWanted = hanzi;
      bestWantedRank = r;
    }
  }
  if (bestWanted) return bestWanted;

  for (const hanzi of opts.frequency) {
    if (!inAllow(hanzi)) continue;
    if (graph.has(hanzi)) continue;
    return hanzi;
  }
  return null;
}

/**
 * Pure helper. The candidate context for a T1 sentence is every word the
 * user already knows, minus the target itself. The downstream LLM picks the
 * actual subset to fit a sentence, so this just hands over the full pool.
 */
export function pickT1ContextWords(
  targetWord: string,
  knownWords: Iterable<string>,
): readonly string[] {
  const seen = new Set<string>();
  for (const word of knownWords) {
    if (word !== targetWord) seen.add(word);
  }
  return [...seen];
}

const dbCache = new WeakMap<PlaygroundSite, Promise<SiteDatabase>>();

function openWordDb(site: PlaygroundSite): Promise<SiteDatabase> {
  let pending = dbCache.get(site);
  if (!pending) {
    pending = createSiteDatabase(site, ZHONGWEN_DB_CONFIG);
    dbCache.set(site, pending);
  }
  return pending;
}

export async function loadWordGraph(site: PlaygroundSite): Promise<WordGraph> {
  const db = await openWordDb(site);
  const entries = await db.getAll<WordEntry>(WORDS_STORE);
  return new Map(entries.map((entry) => [entry.hanzi, entry]));
}

export async function saveWordEntry(site: PlaygroundSite, entry: WordEntry): Promise<void> {
  const db = await openWordDb(site);
  await db.put<WordEntry>(WORDS_STORE, entry);
}

/**
 * IDB-backed convenience wrapper: loads the persisted graph plus the
 * frequency/HSK reference data, then runs the pure picker over them.
 */
export async function pickNextT1Word(site: PlaygroundSite): Promise<string | null> {
  const [graph, frequency, hsk] = await Promise.all([
    loadWordGraph(site),
    loadFrequency(),
    loadHsk(),
  ]);
  const allowList = new Set(hsk.map((entry: HskEntry) => entry.hanzi));
  return pickNextNewWord(graph, { frequency, allowList });
}
