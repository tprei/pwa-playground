import { useState, type FormEvent } from "react";
import { createSiteDatabase } from "../../../platform/database";
import type { PlaygroundSite, SiteStorage } from "../../../platform/types";
import { tableSpecs, zhongwenSchema } from "../model/schema";

export interface SettingsScreenProps {
  site: PlaygroundSite;
  storage: SiteStorage;
}

const TRANSLATION_OPTIONS = [
  { value: "pt-br", label: "Portuguese (BR)" },
  { value: "en", label: "English" },
  { value: "both", label: "Both" },
  { value: "none", label: "None" },
] as const;

type TranslationLanguage = (typeof TRANSLATION_OPTIONS)[number]["value"];

const TTS_VOICES = [
  { value: "cmn-CN-Neural2-A", label: "Neural2 A — female" },
  { value: "cmn-CN-Neural2-B", label: "Neural2 B — male" },
  { value: "cmn-CN-Neural2-C", label: "Neural2 C — male" },
  { value: "cmn-CN-Neural2-D", label: "Neural2 D — female" },
] as const;

type TtsVoice = (typeof TTS_VOICES)[number]["value"];

const STORAGE_KEYS = {
  apiToken: "settings:apiToken",
  dailyTargetMinutes: "settings:dailyTargetMinutes",
  dailyNewCardCap: "settings:dailyNewCardCap",
  dailyReviewCap: "settings:dailyReviewCap",
  preferredTopics: "settings:preferredTopics",
  translationLanguage: "settings:translationLanguage",
  ttsVoice: "settings:ttsVoice",
  webSpeechFallback: "settings:webSpeechFallback",
} as const;

const APP_DATA_KEYS = ["streak"] as const;

const DEFAULTS = {
  apiToken: "",
  dailyTargetMinutes: 20,
  dailyNewCardCap: 10,
  dailyReviewCap: 200,
  preferredTopics: [] as string[],
  translationLanguage: "both" as TranslationLanguage,
  ttsVoice: "cmn-CN-Neural2-A" as TtsVoice,
  webSpeechFallback: true,
};

interface SettingsState {
  apiToken: string;
  dailyTargetMinutes: number;
  dailyNewCardCap: number;
  dailyReviewCap: number;
  preferredTopics: string[];
  translationLanguage: TranslationLanguage;
  ttsVoice: TtsVoice;
  webSpeechFallback: boolean;
}

type ResetStage = "idle" | "confirm-1" | "confirm-2" | "wiping" | "done" | "error";

function readNonNegativeInt(raw: string | null, fallback: number): number {
  if (raw === null) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function readBool(raw: string | null, fallback: boolean): boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return fallback;
}

function readTopics(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
}

function readTranslation(raw: string | null): TranslationLanguage {
  return TRANSLATION_OPTIONS.some((option) => option.value === raw)
    ? (raw as TranslationLanguage)
    : DEFAULTS.translationLanguage;
}

function readVoice(raw: string | null): TtsVoice {
  return TTS_VOICES.some((voice) => voice.value === raw)
    ? (raw as TtsVoice)
    : DEFAULTS.ttsVoice;
}

function loadSettings(storage: SiteStorage): SettingsState {
  return {
    apiToken: storage.get(STORAGE_KEYS.apiToken) ?? DEFAULTS.apiToken,
    dailyTargetMinutes: readNonNegativeInt(
      storage.get(STORAGE_KEYS.dailyTargetMinutes),
      DEFAULTS.dailyTargetMinutes,
    ),
    dailyNewCardCap: readNonNegativeInt(
      storage.get(STORAGE_KEYS.dailyNewCardCap),
      DEFAULTS.dailyNewCardCap,
    ),
    dailyReviewCap: readNonNegativeInt(
      storage.get(STORAGE_KEYS.dailyReviewCap),
      DEFAULTS.dailyReviewCap,
    ),
    preferredTopics: readTopics(storage.get(STORAGE_KEYS.preferredTopics)),
    translationLanguage: readTranslation(storage.get(STORAGE_KEYS.translationLanguage)),
    ttsVoice: readVoice(storage.get(STORAGE_KEYS.ttsVoice)),
    webSpeechFallback: readBool(
      storage.get(STORAGE_KEYS.webSpeechFallback),
      DEFAULTS.webSpeechFallback,
    ),
  };
}

async function wipeAllData(site: PlaygroundSite, storage: SiteStorage): Promise<void> {
  const db = createSiteDatabase(site, zhongwenSchema);
  const tables = tableSpecs.map((spec) => spec.name);
  await db.transaction(tables, "readwrite", async (tx) => {
    for (const spec of tableSpecs) {
      const rows = await tx.getAll<Record<string, unknown>>(spec.name);
      for (const row of rows) {
        const key = row[spec.keyPath] as IDBValidKey | undefined;
        if (key !== undefined) await tx.delete(spec.name, key);
      }
    }
  });
  for (const key of Object.values(STORAGE_KEYS)) storage.remove(key);
  for (const key of APP_DATA_KEYS) storage.remove(key);
}

export default function Settings({ site, storage }: SettingsScreenProps) {
  const [settings, setSettings] = useState<SettingsState>(() => loadSettings(storage));
  const [showToken, setShowToken] = useState(false);
  const [topicDraft, setTopicDraft] = useState("");
  const [resetStage, setResetStage] = useState<ResetStage>("idle");
  const [resetError, setResetError] = useState<string | null>(null);

  function persist<K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K],
    serialized: string,
  ): void {
    setSettings((current) => ({ ...current, [key]: value }));
    storage.set(STORAGE_KEYS[key], serialized);
  }

  function setNumeric(key: "dailyTargetMinutes" | "dailyNewCardCap" | "dailyReviewCap", raw: string) {
    const parsed = Number.parseInt(raw, 10);
    const value = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    persist(key, value, String(value));
  }

  function addTopic(raw: string) {
    const topic = raw.trim();
    if (!topic) return;
    if (settings.preferredTopics.includes(topic)) {
      setTopicDraft("");
      return;
    }
    const next = [...settings.preferredTopics, topic];
    persist("preferredTopics", next, JSON.stringify(next));
    setTopicDraft("");
  }

  function removeTopic(topic: string) {
    const next = settings.preferredTopics.filter((entry) => entry !== topic);
    persist("preferredTopics", next, JSON.stringify(next));
  }

  function handleTopicSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addTopic(topicDraft);
  }

  async function performReset() {
    setResetStage("wiping");
    setResetError(null);
    try {
      await wipeAllData(site, storage);
      setSettings(loadSettings(storage));
      setShowToken(false);
      setTopicDraft("");
      setResetStage("done");
    } catch (error) {
      setResetError(error instanceof Error ? error.message : String(error));
      setResetStage("error");
    }
  }

  return (
    <main className="app app--zhongwen settings">
      <header className="app__header">
        <div>
          <p className="eyebrow">/{site.slug}/ · Settings</p>
          <h1>Settings</h1>
        </div>
      </header>

      <section className="settings__section">
        <h2>API token</h2>
        <p className="settings__hint">Used for sentence and audio generation. Stored locally.</p>
        <div className="settings__row">
          <input
            className="settings__input"
            type={showToken ? "text" : "password"}
            value={settings.apiToken}
            placeholder="Paste your token"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => persist("apiToken", event.target.value, event.target.value)}
          />
          <button
            className="settings__button"
            type="button"
            onClick={() => setShowToken((current) => !current)}
          >
            {showToken ? "Hide" : "Show"}
          </button>
        </div>
      </section>

      <section className="settings__section">
        <h2>Daily limits</h2>
        <label className="settings__field">
          <span>Target study minutes</span>
          <input
            className="settings__input"
            type="number"
            min={0}
            value={settings.dailyTargetMinutes}
            onChange={(event) => setNumeric("dailyTargetMinutes", event.target.value)}
          />
        </label>
        <label className="settings__field">
          <span>New cards per day</span>
          <input
            className="settings__input"
            type="number"
            min={0}
            value={settings.dailyNewCardCap}
            onChange={(event) => setNumeric("dailyNewCardCap", event.target.value)}
          />
        </label>
        <label className="settings__field">
          <span>Reviews per day</span>
          <input
            className="settings__input"
            type="number"
            min={0}
            value={settings.dailyReviewCap}
            onChange={(event) => setNumeric("dailyReviewCap", event.target.value)}
          />
        </label>
      </section>

      <section className="settings__section">
        <h2>Preferred topics</h2>
        <p className="settings__hint">
          Generated sentences will lean toward these themes.
        </p>
        <ul className="settings__chips">
          {settings.preferredTopics.length === 0 ? (
            <li className="settings__chips-empty">No topics yet</li>
          ) : (
            settings.preferredTopics.map((topic) => (
              <li className="settings__chip" key={topic}>
                <span>{topic}</span>
                <button
                  type="button"
                  aria-label={`Remove ${topic}`}
                  onClick={() => removeTopic(topic)}
                >
                  ×
                </button>
              </li>
            ))
          )}
        </ul>
        <form className="settings__row" onSubmit={handleTopicSubmit}>
          <input
            className="settings__input"
            type="text"
            value={topicDraft}
            placeholder="Add a topic (e.g. cooking)"
            onChange={(event) => setTopicDraft(event.target.value)}
          />
          <button className="settings__button" type="submit">
            Add
          </button>
        </form>
      </section>

      <fieldset className="settings__section">
        <legend>
          <h2>Translation reveal language</h2>
        </legend>
        {TRANSLATION_OPTIONS.map((option) => (
          <label className="settings__radio" key={option.value}>
            <input
              type="radio"
              name="translation-language"
              value={option.value}
              checked={settings.translationLanguage === option.value}
              onChange={() => persist("translationLanguage", option.value, option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="settings__section">
        <legend>
          <h2>TTS voice</h2>
        </legend>
        <p className="settings__hint">Google Cloud Text-to-Speech, Mandarin (cmn-CN) Neural2.</p>
        {TTS_VOICES.map((voice) => (
          <label className="settings__radio" key={voice.value}>
            <input
              type="radio"
              name="tts-voice"
              value={voice.value}
              checked={settings.ttsVoice === voice.value}
              onChange={() => persist("ttsVoice", voice.value, voice.value)}
            />
            <span>{voice.label}</span>
            <code>{voice.value}</code>
          </label>
        ))}
      </fieldset>

      <section className="settings__section">
        <h2>Web Speech fallback</h2>
        <label className="settings__toggle">
          <input
            type="checkbox"
            checked={settings.webSpeechFallback}
            onChange={(event) =>
              persist(
                "webSpeechFallback",
                event.target.checked,
                event.target.checked ? "true" : "false",
              )
            }
          />
          <span>Use the browser's built-in voice when Google TTS is unavailable.</span>
        </label>
      </section>

      <section className="settings__section settings__section--danger">
        <h2>Reset all data</h2>
        <p className="settings__hint">
          Wipes every word, card, sentence, blob, review, and saved preference for this app on
          this device. This cannot be undone.
        </p>
        {resetStage === "idle" && (
          <button
            className="settings__button settings__button--danger"
            type="button"
            onClick={() => setResetStage("confirm-1")}
          >
            Reset all data
          </button>
        )}
        {resetStage === "confirm-1" && (
          <div className="settings__row">
            <span>Are you sure? Continue to the final confirmation.</span>
            <button
              className="settings__button settings__button--danger"
              type="button"
              onClick={() => setResetStage("confirm-2")}
            >
              Continue
            </button>
            <button
              className="settings__button"
              type="button"
              onClick={() => setResetStage("idle")}
            >
              Cancel
            </button>
          </div>
        )}
        {resetStage === "confirm-2" && (
          <div className="settings__row">
            <strong>Last chance — this permanently deletes everything.</strong>
            <button
              className="settings__button settings__button--danger"
              type="button"
              onClick={() => {
                void performReset();
              }}
            >
              Permanently delete
            </button>
            <button
              className="settings__button"
              type="button"
              onClick={() => setResetStage("idle")}
            >
              Cancel
            </button>
          </div>
        )}
        {resetStage === "wiping" && <p>Wiping data…</p>}
        {resetStage === "done" && (
          <div className="settings__row">
            <span>All data has been cleared.</span>
            <button
              className="settings__button"
              type="button"
              onClick={() => setResetStage("idle")}
            >
              Dismiss
            </button>
          </div>
        )}
        {resetStage === "error" && (
          <div className="settings__row">
            <span>Reset failed: {resetError ?? "unknown error"}</span>
            <button
              className="settings__button"
              type="button"
              onClick={() => setResetStage("idle")}
            >
              Dismiss
            </button>
          </div>
        )}
      </section>

      <footer className="settings__attribution">
        <p>
          Dictionary data: <strong>CC-CEDICT</strong>, © MDBG, distributed under{" "}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            target="_blank"
            rel="noreferrer noopener"
          >
            CC BY-SA 4.0
          </a>
          .
        </p>
        <p>
          Full attribution and licensing notes:{" "}
          <a href="/NOTICE.md">NOTICE.md</a>
        </p>
      </footer>
    </main>
  );
}
