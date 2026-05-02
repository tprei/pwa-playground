export const SENTENCE_SYSTEM_PROMPT = `You are a beginner Mandarin Chinese tutor writing one short example sentence.

HARD CONSTRAINTS — failure means the output is unusable:
1. The sentence must contain the target word exactly once.
2. Every other Chinese word in the sentence must come from the provided "known vocabulary" list. No other vocabulary is allowed, including common particles or measure words unless they appear in the list.
3. Choose a context from the user's allowed topics. Prefer a topic NOT in "recently used topics" if possible.
4. Tone: short, natural, spoken-register Mandarin. Avoid translationese, dictionary-style phrasing, and stilted constructions. Aim for what a native speaker would actually say.
5. Glosses must be provided in English (en) and Brazilian Portuguese (pt-BR). Glosses are full natural translations, not word-by-word.

Reply with strict JSON only — no prose, no markdown fences. Shape:
{
  "hanzi": "<the Mandarin sentence>",
  "pinyin": "<pinyin with tone marks>",
  "glossEN": "<natural English translation>",
  "glossPT": "<natural Brazilian Portuguese translation>"
}`;

export interface SentencePromptInput {
  targetHanzi: string;
  targetPinyin?: string;
  knownHanzi: string[];
  topics: string[];
  recentTopics: string[];
  style: string;
}

export function buildSentenceUserMessage(input: SentencePromptInput): string {
  const lines = [
    `Target word: ${input.targetHanzi}${input.targetPinyin ? ` (${input.targetPinyin})` : ""}`,
    `Known vocabulary (use ONLY these plus the target):`,
    input.knownHanzi.length > 0 ? input.knownHanzi.join(" ") : "(none)",
    `Allowed topics: ${input.topics.join(", ")}`,
  ];
  if (input.recentTopics.length > 0) {
    lines.push(`Recently used topics (avoid repeating): ${input.recentTopics.join(", ")}`);
  }
  lines.push(`Register: ${input.style}`);
  lines.push(`Return only the JSON object described in the system prompt.`);
  return lines.join("\n");
}

export const RADICAL_SYSTEM_PROMPT = `You break down a single Chinese hanzi into its visual components and write a memorable mnemonic.

OUTPUT REQUIREMENTS:
- "components": list each meaningful visual part of the character with a one-word meaning. Prefer reusing the learner's already-known components where applicable.
- "mnemonic": one vivid sentence tying the components to the character's meaning. Write the mnemonic in the language indicated by "l1Hint" (e.g., "en", "pt-BR").

Reply with strict JSON only — no prose, no markdown fences. Shape:
{
  "components": [{"component": "<radical/part>", "meaning": "<one-word meaning>"}],
  "mnemonic": "<one-sentence mnemonic in the L1>"
}`;

export interface RadicalPromptInput {
  hanzi: string;
  knownComponents: string[];
  l1Hint: string;
}

export function buildRadicalUserMessage(input: RadicalPromptInput): string {
  const lines = [`Hanzi: ${input.hanzi}`, `Mnemonic language (l1Hint): ${input.l1Hint}`];
  if (input.knownComponents.length > 0) {
    lines.push(`Already-known components (prefer reusing): ${input.knownComponents.join(", ")}`);
  }
  lines.push(`Return only the JSON object described in the system prompt.`);
  return lines.join("\n");
}
