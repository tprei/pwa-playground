/**
 * Lazy loaders for the bundled Chinese reference datasets.
 *
 * The JSON files in this directory total a few MB uncompressed. Reach for
 * them only on demand so the entry chunk stays small and first paint is fast:
 *
 *   const cedict = await loadCedict();
 *
 * App code MUST go through these loaders. Importing the JSON files directly
 * (e.g. `import data from "./cedict.json"`) defeats the splitting and pulls
 * the whole dataset into the entry chunk.
 */

export interface CedictEntry {
  hanzi: string;
  traditional: string;
  pinyin: string;
  glosses: string[];
}

export interface HskEntry {
  hanzi: string;
  pinyin: string;
  hsk: 1 | 2;
}

export type FrequencyList = readonly string[];

export const loadCedict = (): Promise<readonly CedictEntry[]> =>
  import("./cedict.json").then((mod) => mod.default as CedictEntry[]);

export const loadHsk = (): Promise<readonly HskEntry[]> =>
  import("./hsk.json").then((mod) => mod.default as HskEntry[]);

export const loadFrequency = (): Promise<FrequencyList> =>
  import("./frequency.json").then((mod) => mod.default as string[]);
