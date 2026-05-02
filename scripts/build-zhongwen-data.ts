/**
 * Regenerates src/apps/zhongwen/data/{hsk,cedict,frequency}.json from upstream
 * sources. NOT wired into `pnpm build` — running it is an explicit, online,
 * developer-driven step. Build stays deterministic; the JSON files in the
 * repo are committed snapshots produced by a past run of this script.
 *
 * Usage:
 *   pnpm tsx scripts/build-zhongwen-data.ts
 *
 * Sources:
 *   - CC-CEDICT (CC-BY-SA 4.0)
 *       https://www.mdbg.net/chinese/dictionary?page=cc-cedict
 *       Direct: https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz
 *   - BLCU (Beijing Language and Culture University) BCC corpus frequency
 *       http://bcc.blcu.edu.cn/
 *       Direct: http://bcc.blcu.edu.cn/downloads/resources/BCC_LEX_Zh.zip
 *       (We use global_wordfreq.release.txt — modern Chinese only.)
 *   - HSK 2.0 syllabus word lists
 *       https://github.com/clem109/hsk-vocabulary (MIT)
 *
 * If a primary source is unreachable the script aborts loudly. It does NOT
 * fall back silently — the maintainer should pick the substitute and re-run.
 *
 * Size budget: cedict.json + frequency.json + hsk.json must stay under 4 MB
 * uncompressed. The defaults below (~6000 cedict entries, ~6000 frequency
 * ranks, full HSK 1+2) fit well inside that budget.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { gunzipSync, inflateRawSync } from "node:zlib";

const root = process.cwd();
const dataDir = path.join(root, "src", "apps", "zhongwen", "data");

const CEDICT_URL = "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz";
const BLCU_FREQ_URL = "http://bcc.blcu.edu.cn/downloads/resources/BCC_LEX_Zh.zip";
const BLCU_FREQ_INNER = "global_wordfreq.release.txt";
const HSK1_URL = "https://raw.githubusercontent.com/clem109/hsk-vocabulary/master/hsk-vocab-json/hsk-level-1.json";
const HSK2_URL = "https://raw.githubusercontent.com/clem109/hsk-vocabulary/master/hsk-vocab-json/hsk-level-2.json";

const TOP_N = 6000;
const SIZE_BUDGET_BYTES = 4 * 1024 * 1024;

interface CedictEntry {
  hanzi: string;
  traditional: string;
  pinyin: string;
  glosses: string[];
}

interface HskEntry {
  hanzi: string;
  pinyin: string;
  hsk: 1 | 2;
}

interface RawHskEntry {
  hanzi: string;
  pinyin: string;
  translations?: string[];
}

async function main(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });

  console.log("Fetching HSK 1 + 2…");
  const hsk = await buildHsk();
  await writeJson(path.join(dataDir, "hsk.json"), hsk);
  console.log(`  hsk.json: ${hsk.length} entries`);

  console.log("Fetching BLCU frequency list…");
  const frequency = await buildFrequency();
  await writeJson(path.join(dataDir, "frequency.json"), frequency);
  console.log(`  frequency.json: ${frequency.length} entries`);

  console.log("Fetching CC-CEDICT…");
  const cedict = await buildCedict(new Set(frequency));
  await writeJson(path.join(dataDir, "cedict.json"), cedict);
  console.log(`  cedict.json: ${cedict.length} entries`);

  await assertSizeBudget();
  console.log("Done.");
}

async function buildHsk(): Promise<HskEntry[]> {
  const [raw1, raw2] = await Promise.all([fetchJson<RawHskEntry[]>(HSK1_URL), fetchJson<RawHskEntry[]>(HSK2_URL)]);
  const seen = new Set<string>();
  const entries: HskEntry[] = [];
  const append = (raw: RawHskEntry[], level: 1 | 2) => {
    for (const item of raw) {
      const hanzi = item.hanzi.trim();
      if (!hanzi || seen.has(hanzi)) continue;
      seen.add(hanzi);
      entries.push({ hanzi, pinyin: item.pinyin.trim(), hsk: level });
    }
  };
  append(raw1, 1);
  append(raw2, 2);
  return entries;
}

async function buildFrequency(): Promise<string[]> {
  const zip = await fetchBuffer(BLCU_FREQ_URL);
  const entry = await readZipEntry(zip, BLCU_FREQ_INNER);
  if (!entry) {
    throw new Error(`Could not locate "${BLCU_FREQ_INNER}" inside ${BLCU_FREQ_URL}`);
  }
  const text = entry.toString("utf8");
  const words: string[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const word = line.split(/\s+/)[0]?.trim();
    if (!word || seen.has(word)) continue;
    if (!/^[㐀-鿿]+$/.test(word)) continue;
    seen.add(word);
    words.push(word);
    if (words.length >= TOP_N) break;
  }
  if (words.length < TOP_N / 2) {
    throw new Error(`BLCU list too short (${words.length}). Aborting.`);
  }
  return words;
}

async function buildCedict(keep: Set<string>): Promise<CedictEntry[]> {
  const gz = await fetchBuffer(CEDICT_URL);
  const text = gunzipSync(gz).toString("utf8");
  const lineRe = /^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/\s*$/;
  const bySimplified = new Map<string, CedictEntry>();
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const match = lineRe.exec(line);
    if (!match) continue;
    const [, traditional, simplified, pinyin, glossField] = match;
    if (!keep.has(simplified)) continue;
    const glosses = glossField.split("/").filter(Boolean);
    if (bySimplified.has(simplified)) continue;
    bySimplified.set(simplified, { hanzi: simplified, traditional, pinyin, glosses });
  }
  return [...keep].map((hanzi) => bySimplified.get(hanzi)).filter((entry): entry is CedictEntry => Boolean(entry));
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`GET ${url} → ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`GET ${url} → ${response.status}`);
  }
  return (await response.json()) as T;
}

async function writeJson(filePath: string, payload: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(payload)}\n`, "utf8");
}

async function assertSizeBudget(): Promise<void> {
  const files = ["hsk.json", "cedict.json", "frequency.json"];
  let total = 0;
  for (const name of files) {
    const stat = await fs.stat(path.join(dataDir, name));
    total += stat.size;
  }
  if (total > SIZE_BUDGET_BYTES) {
    throw new Error(`Data files total ${total} bytes, over the ${SIZE_BUDGET_BYTES}-byte budget.`);
  }
  console.log(`  total size: ${(total / 1024).toFixed(1)} KB (budget ${(SIZE_BUDGET_BYTES / 1024 / 1024).toFixed(0)} MB)`);
}

async function readZipEntry(zipBuffer: Buffer, fileName: string): Promise<Buffer | null> {
  // Minimal ZIP reader (store + deflate). Walks the central directory so we
  // do not pull in a third-party dep just for this script.
  const eocdSig = 0x06054b50;
  let eocd = -1;
  for (let i = zipBuffer.length - 22; i >= Math.max(0, zipBuffer.length - 0xffff - 22); i -= 1) {
    if (zipBuffer.readUInt32LE(i) === eocdSig) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("ZIP end-of-central-directory not found.");
  const cdEntries = zipBuffer.readUInt16LE(eocd + 10);
  let cdOffset = zipBuffer.readUInt32LE(eocd + 16);

  for (let i = 0; i < cdEntries; i += 1) {
    if (zipBuffer.readUInt32LE(cdOffset) !== 0x02014b50) {
      throw new Error("ZIP central directory header malformed.");
    }
    const nameLen = zipBuffer.readUInt16LE(cdOffset + 28);
    const extraLen = zipBuffer.readUInt16LE(cdOffset + 30);
    const commentLen = zipBuffer.readUInt16LE(cdOffset + 32);
    const localOffset = zipBuffer.readUInt32LE(cdOffset + 42);
    const name = zipBuffer.slice(cdOffset + 46, cdOffset + 46 + nameLen).toString("utf8");

    if (path.basename(name) === fileName) {
      const localNameLen = zipBuffer.readUInt16LE(localOffset + 26);
      const localExtraLen = zipBuffer.readUInt16LE(localOffset + 28);
      const compressionMethod = zipBuffer.readUInt16LE(localOffset + 8);
      const compressedSize = zipBuffer.readUInt32LE(localOffset + 18);
      const dataOffset = localOffset + 30 + localNameLen + localExtraLen;
      const compressed = zipBuffer.slice(dataOffset, dataOffset + compressedSize);
      if (compressionMethod === 0) return compressed;
      if (compressionMethod === 8) return inflateRawSync(compressed);
      throw new Error(`Unsupported ZIP compression method ${compressionMethod} for ${fileName}.`);
    }
    cdOffset += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

await main();
