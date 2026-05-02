// T1 selector — picks the next word to introduce and the candidate context
// words for a generated sentence. Selection is split into pure inner
// functions (graph in, decision out) so the ranking logic is testable
// without loading the reference data.
//
// The persistence layer is intentionally absent: the prompt expects it to
// consume a WordEntry / KnownState model from a sibling domain-types module
// and a createSiteDatabase factory from src/platform/database.ts, neither of
// which exists on this branch yet. The locally-declared types below should
// be replaced with imports once those modules land.

import { loadFrequency, loadHsk } from "../data";

export type KnownState = "unknown" | "want-to-learn" | "learning" | "known";

export interface WordEntry {
  word: string;
  state: KnownState;
}

export type WordStateGraph = ReadonlyMap<string, WordEntry>;

export interface PickNextNewWordOptions {
  /** Restrict candidates to a specific HSK level. Omit to allow any word. */
  hskLevel?: 1 | 2;
}

/**
 * Pure ranking step for {@link pickNextNewWord}. Caller supplies the
 * frequency list and (optionally) the set of HSK-allowed words so this
 * function makes no I/O.
 */
export function selectNextNewWord(
  graph: WordStateGraph,
  frequency: readonly string[],
  hskAllowList?: ReadonlySet<string>,
): string | null {
  const wantToLearn = rankByFrequency(
    collectByState(graph, "want-to-learn"),
    frequency,
    hskAllowList,
  );
  if (wantToLearn !== null) return wantToLearn;

  for (const word of frequency) {
    if (hskAllowList && !hskAllowList.has(word)) continue;
    if (isAlreadyTracked(graph, word)) continue;
    return word;
  }

  return null;
}

/**
 * Async wrapper that loads the frequency list (and HSK filter, if requested)
 * from the lazy reference-data loaders and delegates to
 * {@link selectNextNewWord}.
 */
export async function pickNextNewWord(
  graph: WordStateGraph,
  opts: PickNextNewWordOptions = {},
): Promise<string | null> {
  const frequency = await loadFrequency();
  const hskAllowList = opts.hskLevel
    ? await loadHskAllowList(opts.hskLevel)
    : undefined;
  return selectNextNewWord(graph, frequency, hskAllowList);
}

/**
 * Candidate supporting words for a T1 example sentence. Returns every word
 * the user already knows, minus the target. The LLM picks the actual subset
 * to weave into the sentence.
 */
export function pickT1ContextWords(
  targetWord: string,
  knownWords: ReadonlySet<string>,
): ReadonlySet<string> {
  if (!knownWords.has(targetWord)) return knownWords;
  const candidates = new Set(knownWords);
  candidates.delete(targetWord);
  return candidates;
}

function collectByState(graph: WordStateGraph, state: KnownState): Set<string> {
  const out = new Set<string>();
  for (const entry of graph.values()) {
    if (entry.state === state) out.add(entry.word);
  }
  return out;
}

function rankByFrequency(
  candidates: ReadonlySet<string>,
  frequency: readonly string[],
  hskAllowList?: ReadonlySet<string>,
): string | null {
  if (candidates.size === 0) return null;
  for (const word of frequency) {
    if (!candidates.has(word)) continue;
    if (hskAllowList && !hskAllowList.has(word)) continue;
    return word;
  }
  return null;
}

function isAlreadyTracked(graph: WordStateGraph, word: string): boolean {
  const entry = graph.get(word);
  if (!entry) return false;
  return entry.state !== "unknown";
}

async function loadHskAllowList(level: 1 | 2): Promise<ReadonlySet<string>> {
  const hsk = await loadHsk();
  const out = new Set<string>();
  for (const entry of hsk) {
    if (entry.hsk <= level) out.add(entry.hanzi);
  }
  return out;
}
