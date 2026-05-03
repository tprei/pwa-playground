import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import type { PlaygroundAppProps } from "../../../platform/types";
import { loadCedict, loadFrequency, type CedictEntry } from "../data";
import type { KnownState, WordEntry } from "../domain-types";
import { saveWordEntry } from "../srs/t1Selector";

const CALIBRATION_COUNT = 150;
const DEFAULT_DAILY_MINUTES = 10;
const DEFAULT_TOPICS = ["software", "gym", "daily life", "food"] as const;

export type TranslationLanguage = "pt-br" | "en" | "both" | "none";

const LANGUAGE_OPTIONS: ReadonlyArray<{ value: TranslationLanguage; label: string }> = [
  { value: "pt-br", label: "PT-BR" },
  { value: "en", label: "EN" },
  { value: "both", label: "Both" },
  { value: "none", label: "None" },
];

type Step = "calibrate" | "settings" | "finish";

interface CalibrationChoice {
  id: KnownState | "skip";
  label: string;
}

const CHOICES: readonly CalibrationChoice[] = [
  { id: "known", label: "Known" },
  { id: "learning", label: "Learning" },
  { id: "want-to-learn", label: "Want to learn" },
  { id: "skip", label: "Skip" },
];

interface OnboardingProps extends PlaygroundAppProps {
  onComplete?: () => void;
}

export default function Onboarding({ site, storage, onComplete }: OnboardingProps) {
  const [step, setStep] = useState<Step>("calibrate");
  const [words, setWords] = useState<readonly string[] | null>(null);
  const [glosses, setGlosses] = useState<ReadonlyMap<string, CedictEntry> | null>(null);
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const [dailyMinutes, setDailyMinutes] = useState(DEFAULT_DAILY_MINUTES);
  const [topics, setTopics] = useState<readonly string[]>([...DEFAULT_TOPICS]);
  const [selectedTopics, setSelectedTopics] = useState<ReadonlySet<string>>(new Set());
  const [topicDraft, setTopicDraft] = useState("");
  const [language, setLanguage] = useState<TranslationLanguage>("both");
  const [apiToken, setApiToken] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadFrequency(), loadCedict()]).then(([freq, cedict]) => {
      if (cancelled) return;
      setWords(freq.slice(0, CALIBRATION_COUNT));
      const map = new Map<string, CedictEntry>();
      for (const entry of cedict) map.set(entry.hanzi, entry);
      setGlosses(map);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (step === "finish" && onComplete) {
      onComplete();
    }
  }, [step, onComplete]);

  const totalWords = words?.length ?? CALIBRATION_COUNT;
  const currentWord = words?.[index];
  const currentEntry = currentWord ? glosses?.get(currentWord) : undefined;

  async function recordChoice(choice: CalibrationChoice["id"]) {
    if (!currentWord || !words || saving) return;
    setSaving(true);
    try {
      if (choice !== "skip") {
        const now = Date.now();
        const entry: WordEntry = {
          hanzi: currentWord,
          state: choice,
          addedAt: now,
          updatedAt: now,
        };
        await saveWordEntry(site, entry);
      }
      const next = index + 1;
      if (next >= words.length) {
        setStep("settings");
      } else {
        setIndex(next);
      }
    } finally {
      setSaving(false);
    }
  }

  function toggleTopic(topic: string) {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  }

  function addTopic() {
    const trimmed = topicDraft.trim();
    if (!trimmed) return;
    setTopics((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setSelectedTopics((prev) => {
      if (prev.has(trimmed)) return prev;
      const next = new Set(prev);
      next.add(trimmed);
      return next;
    });
    setTopicDraft("");
  }

  function commitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    storage.set("settings:dailyTargetMinutes", String(dailyMinutes));
    storage.set("settings:preferredTopics", JSON.stringify([...selectedTopics]));
    storage.set("settings:translationLanguage", language);
    storage.set("settings:apiToken", apiToken.trim());
    storage.set("settings:firstLaunchDone", "true");
    setStep("finish");
  }

  return (
    <main className="app app--zhongwen onboarding">
      <header className="onboarding__header">
        <p className="eyebrow">/{site.slug}/ · setup</p>
        <h1>{stepHeading(step)}</h1>
        <ProgressBar step={step} index={index} total={totalWords} />
      </header>

      {step === "calibrate" && (
        <CalibrationPanel
          word={currentWord}
          entry={currentEntry}
          index={index}
          total={totalWords}
          ready={!!words}
          saving={saving}
          onChoose={recordChoice}
        />
      )}

      {step === "settings" && (
        <SettingsPanel
          dailyMinutes={dailyMinutes}
          onDailyMinutes={setDailyMinutes}
          topics={topics}
          selectedTopics={selectedTopics}
          onToggleTopic={toggleTopic}
          topicDraft={topicDraft}
          onTopicDraft={setTopicDraft}
          onAddTopic={addTopic}
          language={language}
          onLanguage={setLanguage}
          apiToken={apiToken}
          onApiToken={setApiToken}
          onSubmit={commitSettings}
        />
      )}

      {step === "finish" && <FinishPanel route={site.route} />}
    </main>
  );
}

function stepHeading(step: Step): string {
  if (step === "calibrate") return "Calibrate your vocabulary";
  if (step === "settings") return "Set your study preferences";
  return "You're all set";
}

function ProgressBar({ step, index, total }: { step: Step; index: number; total: number }) {
  const ratio = step === "calibrate" ? Math.min(1, index / Math.max(1, total)) : step === "settings" ? 1 : 1;
  return (
    <div
      className="onboarding__progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
    >
      <span style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}

interface CalibrationPanelProps {
  word: string | undefined;
  entry: CedictEntry | undefined;
  index: number;
  total: number;
  ready: boolean;
  saving: boolean;
  onChoose: (choice: CalibrationChoice["id"]) => void;
}

function CalibrationPanel({ word, entry, index, total, ready, saving, onChoose }: CalibrationPanelProps) {
  if (!ready || !word) {
    return (
      <section className="onboarding__panel onboarding__panel--loading">
        <p>Loading reference data…</p>
      </section>
    );
  }

  return (
    <section className="onboarding__panel">
      <p className="onboarding__count">
        Word {index + 1} of {total}
      </p>
      <article className="onboarding__word">
        <strong>{word}</strong>
        {entry ? (
          <>
            <span>{entry.pinyin}</span>
            <small>{entry.glosses.slice(0, 3).join(", ")}</small>
          </>
        ) : (
          <small>(no dictionary entry)</small>
        )}
      </article>
      <div className="onboarding__choices">
        {CHOICES.map((choice) => (
          <button
            key={choice.id}
            type="button"
            className={`onboarding__choice onboarding__choice--${choice.id}`}
            onClick={() => onChoose(choice.id)}
            disabled={saving}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </section>
  );
}

interface SettingsPanelProps {
  dailyMinutes: number;
  onDailyMinutes: (value: number) => void;
  topics: readonly string[];
  selectedTopics: ReadonlySet<string>;
  onToggleTopic: (topic: string) => void;
  topicDraft: string;
  onTopicDraft: (value: string) => void;
  onAddTopic: () => void;
  language: TranslationLanguage;
  onLanguage: (value: TranslationLanguage) => void;
  apiToken: string;
  onApiToken: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function SettingsPanel(props: SettingsPanelProps) {
  return (
    <form className="onboarding__panel onboarding__settings" onSubmit={props.onSubmit}>
      <label className="onboarding__field">
        <span>Daily target (minutes)</span>
        <input
          type="number"
          min={1}
          max={240}
          step={1}
          value={props.dailyMinutes}
          onChange={(e) => props.onDailyMinutes(clampMinutes(Number(e.target.value)))}
        />
      </label>

      <fieldset className="onboarding__field">
        <legend>Preferred topics</legend>
        <div className="onboarding__chips">
          {props.topics.map((topic) => (
            <button
              key={topic}
              type="button"
              className={`onboarding__chip${
                props.selectedTopics.has(topic) ? " onboarding__chip--selected" : ""
              }`}
              onClick={() => props.onToggleTopic(topic)}
              aria-pressed={props.selectedTopics.has(topic)}
            >
              {topic}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="onboarding__field onboarding__add-topic">
        <label>
          <span>Add a topic</span>
          <input
            type="text"
            value={props.topicDraft}
            onChange={(e) => props.onTopicDraft(e.target.value)}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") {
                e.preventDefault();
                props.onAddTopic();
              }
            }}
            placeholder="e.g. travel"
          />
        </label>
        <button type="button" onClick={props.onAddTopic} disabled={!props.topicDraft.trim()}>
          Add
        </button>
      </div>

      <fieldset className="onboarding__field">
        <legend>Translation language</legend>
        <div className="onboarding__lang">
          {LANGUAGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`onboarding__lang-option${
                props.language === option.value ? " onboarding__lang-option--selected" : ""
              }`}
              onClick={() => props.onLanguage(option.value)}
              aria-pressed={props.language === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="onboarding__field">
        <span>Personal API token</span>
        <input
          type="password"
          value={props.apiToken}
          onChange={(e) => props.onApiToken(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste your token"
        />
      </label>

      <button type="submit" className="onboarding__primary">
        Save and continue
      </button>
    </form>
  );
}

function FinishPanel({ route }: { route: string }) {
  return (
    <section className="onboarding__panel onboarding__finish">
      <p>Your vocabulary baseline is saved and your study preferences are stored on this device.</p>
      <a className="onboarding__primary" href={route}>
        Go to Today
      </a>
    </section>
  );
}

function clampMinutes(raw: number): number {
  if (!Number.isFinite(raw) || raw < 1) return 1;
  if (raw > 240) return 240;
  return Math.round(raw);
}
