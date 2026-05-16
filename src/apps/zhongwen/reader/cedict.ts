import { loadCedict, type CedictEntry } from "../data";
import { numberedPinyinToToneMark } from "./pinyin";
import type { Tone } from "./types";

export interface CedictLookup {
  hanzi: string;
  pinyin: string;
  tones: readonly Tone[];
  glosses: readonly string[];
}

let cachedIndex: Promise<ReadonlyMap<string, CedictEntry>> | null = null;

function buildIndex(entries: readonly CedictEntry[]): ReadonlyMap<string, CedictEntry> {
  const map = new Map<string, CedictEntry>();
  for (const entry of entries) {
    if (!map.has(entry.hanzi)) map.set(entry.hanzi, entry);
  }
  return map;
}

export function loadCedictIndex(): Promise<ReadonlyMap<string, CedictEntry>> {
  if (!cachedIndex) {
    cachedIndex = loadCedict().then(buildIndex);
  }
  return cachedIndex;
}

export async function lookupCedict(hanzi: string): Promise<CedictLookup | null> {
  const index = await loadCedictIndex();
  const entry = index.get(hanzi);
  if (!entry) return null;
  const { display, tones } = numberedPinyinToToneMark(entry.pinyin);
  return {
    hanzi: entry.hanzi,
    pinyin: display,
    tones,
    glosses: entry.glosses,
  };
}
