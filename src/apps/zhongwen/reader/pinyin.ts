import type { Tone } from "./types";

const TONE_MARKS: Record<string, readonly string[]> = {
  a: ["a", "ā", "á", "ǎ", "à", "a"],
  e: ["e", "ē", "é", "ě", "è", "e"],
  i: ["i", "ī", "í", "ǐ", "ì", "i"],
  o: ["o", "ō", "ó", "ǒ", "ò", "o"],
  u: ["u", "ū", "ú", "ǔ", "ù", "u"],
  "u:": ["ü", "ǖ", "ǘ", "ǚ", "ǜ", "ü"],
  v: ["ü", "ǖ", "ǘ", "ǚ", "ǜ", "ü"],
};

function syllableTone(syllable: string): { base: string; tone: Tone } {
  const match = /([1-5])$/.exec(syllable);
  if (!match) return { base: syllable, tone: 5 };
  const tone = Number.parseInt(match[1], 10) as Tone;
  return { base: syllable.slice(0, -1), tone };
}

function placeToneMark(base: string, tone: Tone): string {
  const lower = base.toLowerCase().replace("u:", "v");
  const order = ["a", "o", "e"];
  let targetIndex = -1;
  for (const vowel of order) {
    const idx = lower.indexOf(vowel);
    if (idx !== -1) {
      targetIndex = idx;
      break;
    }
  }
  if (targetIndex === -1) {
    const iu = /[iuv]/g;
    let last = -1;
    let m: RegExpExecArray | null;
    while ((m = iu.exec(lower)) !== null) last = m.index;
    targetIndex = last;
  }
  if (targetIndex === -1) return base;
  const replacement = TONE_MARKS[lower[targetIndex]]?.[tone] ?? lower[targetIndex];
  return lower.slice(0, targetIndex) + replacement + lower.slice(targetIndex + 1);
}

export function numberedSyllableToToneMark(syllable: string): { display: string; tone: Tone } {
  const { base, tone } = syllableTone(syllable);
  return { display: placeToneMark(base, tone), tone };
}

export function numberedPinyinToToneMark(numbered: string): {
  display: string;
  tones: Tone[];
} {
  const parts = numbered.trim().split(/\s+/).filter(Boolean);
  const tones: Tone[] = [];
  const display = parts
    .map((part) => {
      const { display: syllable, tone } = numberedSyllableToToneMark(part);
      tones.push(tone);
      return syllable;
    })
    .join(" ");
  return { display, tones };
}
