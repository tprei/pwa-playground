import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { PlaygroundSite, SiteStorage } from "../../../platform/types";
import { createSiteDatabase } from "../../../platform/database";
import { loadFrequency } from "../data";
import type { KnownState, WordEntry } from "../domain-types";
import "./Onboarding.css";

const CALIBRATION_WORD_COUNT = 150;
const DEFAULT_TOPICS = ["software", "gym", "daily life", "food"] as const;

export type TranslationLanguage = "pt-br" | "en" | "both" | "none";

export interface OnboardingProps {
  site: PlaygroundSite;
  storage: SiteStorage;
  onComplete?: () => void;
}

type Phase = "calibration" | "settings" | "finish";
type Decision = KnownState | "skip";

interface SettingsForm {
  dailyMinutes: string;
  topicOptions: string[];
  selectedTopics: string[];
  customTopicDraft: string;
  language: TranslationLanguage;
  apiToken: string;
}

const initialSettings: SettingsForm = {
  dailyMinutes: "10",
  topicOptions: [...DEFAULT_TOPICS],
  selectedTopics: [],
  customTopicDraft: "",
  language: "both",
  apiToken: "",
};

export default function Onboarding({ site, storage, onComplete }: OnboardingProps) {
  const wordsStore = useMemo(() => {
    const db = createSiteDatabase(site, {
      name: "knowledge",
      version: 1,
      stores: ["words"],
    });
    return db.store<WordEntry>("words");
  }, [site]);

  const [phase, setPhase] = useState<Phase>("calibration");
  const [words, setWords] = useState<readonly string[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [decisions, setDecisions] = useState<Map<string, Decision>>(new Map());
  const [settings, setSettings] = useState<SettingsForm>(initialSettings);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const writeChainRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    loadFrequency().then(
      (frequency) => {
        if (cancelled) return;
        setWords(frequency.slice(0, CALIBRATION_WORD_COUNT));
      },
      (err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : String(err));
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  function recordDecision(word: string, decision: Decision) {
    setDecisions((prev) => {
      const next = new Map(prev);
      next.set(word, decision);
      return next;
    });

    if (decision !== "skip") {
      const entry: WordEntry = {
        word,
        state: decision,
        updatedAt: Date.now(),
      };
      writeChainRef.current = writeChainRef.current
        .catch(() => undefined)
        .then(() => wordsStore.put(word, entry));
    }

    const nextIndex = index + 1;
    setIndex(nextIndex);
    if (words && nextIndex >= words.length) {
      setPhase("settings");
    }
  }

  function goBack() {
    setIndex((current) => Math.max(0, current - 1));
  }

  async function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const minutes = Number.parseInt(settings.dailyMinutes, 10);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setSubmitError("Daily target must be a positive number of minutes.");
      return;
    }

    setSubmitting(true);
    try {
      await writeChainRef.current;
      storage.set("dailyTargetMinutes", String(minutes));
      storage.set("topics", JSON.stringify(settings.selectedTopics));
      storage.set("translationLanguage", settings.language);
      storage.set("apiToken", settings.apiToken.trim());
      storage.set("firstLaunchDone", "true");
      setPhase("finish");
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? `Could not save your word choices: ${err.message}`
          : "Could not save your word choices.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <main className="onboarding">
        <div className="onboarding__inner">
          <div className="onboarding__card">
            <h1 className="onboarding__title">Couldn't load reference data</h1>
            <p className="onboarding__subtitle">{loadError}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!words) {
    return (
      <main className="onboarding">
        <div className="onboarding__inner">
          <div className="onboarding__card">
            <p className="onboarding__subtitle">Loading words…</p>
          </div>
        </div>
      </main>
    );
  }

  if (phase === "calibration") {
    const word = words[Math.min(index, words.length - 1)]!;
    const progress = ((index + 1) / words.length) * 100;
    return (
      <main className="onboarding">
        <div className="onboarding__inner">
          <header>
            <p className="eyebrow">/{site.slug}/ · setup</p>
            <h1 className="onboarding__title">Mark what you already know</h1>
            <p className="onboarding__subtitle">
              We'll calibrate against the {words.length} most common words. Tap the
              one that fits — there's no swiping required.
            </p>
          </header>

          <div className="onboarding__progress">
            <div className="onboarding__progress-bar">
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="onboarding__progress-meta">
              <span>
                Word {index + 1} of {words.length}
              </span>
              <button
                type="button"
                className="onboarding__back"
                onClick={goBack}
                disabled={index === 0}
              >
                Back
              </button>
            </div>
          </div>

          <div className="onboarding__card">
            <div className="onboarding__hanzi" lang="zh">
              {word}
            </div>
            <div className="onboarding__choices">
              <button
                type="button"
                className="onboarding__choice onboarding__choice--known"
                onClick={() => recordDecision(word, "known")}
              >
                Known
              </button>
              <button
                type="button"
                className="onboarding__choice onboarding__choice--learning"
                onClick={() => recordDecision(word, "learning")}
              >
                Learning
              </button>
              <button
                type="button"
                className="onboarding__choice onboarding__choice--want"
                onClick={() => recordDecision(word, "want-to-learn")}
              >
                Want to learn
              </button>
              <button
                type="button"
                className="onboarding__choice onboarding__choice--skip"
                onClick={() => recordDecision(word, "skip")}
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (phase === "settings") {
    return (
      <main className="onboarding">
        <div className="onboarding__inner">
          <header>
            <p className="eyebrow">/{site.slug}/ · setup</p>
            <h1 className="onboarding__title">A few preferences</h1>
            <p className="onboarding__subtitle">
              Tune how Zhongwen plans your sessions. You can change these later.
            </p>
          </header>

          <form className="onboarding__card" onSubmit={submitSettings}>
            <div className="onboarding__field">
              <label className="onboarding__label" htmlFor="onboarding-minutes">
                Daily target
              </label>
              <span className="onboarding__hint">
                How many minutes a day do you want to study?
              </span>
              <input
                id="onboarding-minutes"
                className="onboarding__input"
                type="number"
                min={1}
                inputMode="numeric"
                value={settings.dailyMinutes}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, dailyMinutes: e.target.value }))
                }
              />
            </div>

            <div className="onboarding__field">
              <span className="onboarding__label">Topics</span>
              <span className="onboarding__hint">
                Pick what you'd like example sentences to lean on.
              </span>
              <div className="onboarding__chips">
                {settings.topicOptions.map((topic) => {
                  const selected = settings.selectedTopics.includes(topic);
                  return (
                    <button
                      key={topic}
                      type="button"
                      className="onboarding__chip"
                      aria-pressed={selected}
                      onClick={() =>
                        setSettings((s) => ({
                          ...s,
                          selectedTopics: selected
                            ? s.selectedTopics.filter((t) => t !== topic)
                            : [...s.selectedTopics, topic],
                        }))
                      }
                    >
                      {topic}
                    </button>
                  );
                })}
              </div>
              <div className="onboarding__chip-add">
                <input
                  className="onboarding__input"
                  type="text"
                  placeholder="Add another topic"
                  value={settings.customTopicDraft}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      customTopicDraft: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomTopic();
                    }
                  }}
                />
                <button
                  type="button"
                  className="onboarding__primary"
                  onClick={addCustomTopic}
                  disabled={!settings.customTopicDraft.trim()}
                >
                  Add
                </button>
              </div>
            </div>

            <fieldset
              className="onboarding__field"
              style={{ border: "none", padding: 0, margin: 0, marginTop: 24 }}
            >
              <legend className="onboarding__label">Translation language</legend>
              <span className="onboarding__hint">
                What should we show alongside Chinese text?
              </span>
              <div className="onboarding__radios">
                {(
                  [
                    ["pt-br", "PT-BR"],
                    ["en", "English"],
                    ["both", "Both"],
                    ["none", "None"],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className={
                      "onboarding__radio" +
                      (settings.language === value
                        ? " onboarding__radio--selected"
                        : "")
                    }
                  >
                    <input
                      type="radio"
                      name="language"
                      value={value}
                      checked={settings.language === value}
                      onChange={() =>
                        setSettings((s) => ({ ...s, language: value }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="onboarding__field">
              <label className="onboarding__label" htmlFor="onboarding-token">
                Personal API token
              </label>
              <span className="onboarding__hint">
                Pasted here so this device can call your model. Stored on this
                device only.
              </span>
              <input
                id="onboarding-token"
                className="onboarding__input"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={settings.apiToken}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, apiToken: e.target.value }))
                }
              />
            </div>

            {submitError && <p className="onboarding__error">{submitError}</p>}

            <div className="onboarding__actions">
              <button
                type="button"
                className="onboarding__back"
                onClick={() => {
                  setIndex(words.length - 1);
                  setPhase("calibration");
                }}
                disabled={submitting}
              >
                Back to words
              </button>
              <button
                type="submit"
                className="onboarding__primary"
                disabled={submitting}
              >
                {submitting ? "Saving…" : "Continue"}
              </button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  const summary = summarize(decisions);
  const todayHref = `${site.route}today`;
  return (
    <main className="onboarding">
      <div className="onboarding__inner">
        <div className="onboarding__card">
          <h1 className="onboarding__title">You're set up</h1>
          <p className="onboarding__subtitle">
            {summary.known} known · {summary.learning} learning ·{" "}
            {summary.wantToLearn} want to learn · {summary.skipped} skipped
          </p>
          <div className="onboarding__actions" style={{ marginTop: 32 }}>
            <a
              className="onboarding__primary"
              href={todayHref}
              style={{ textDecoration: "none" }}
              onClick={(e) => {
                if (onComplete) {
                  e.preventDefault();
                  onComplete();
                }
              }}
            >
              Continue to Today
            </a>
          </div>
        </div>
      </div>
    </main>
  );

  function addCustomTopic() {
    const draft = settings.customTopicDraft.trim();
    if (!draft) return;
    setSettings((s) => {
      if (s.topicOptions.includes(draft)) {
        return {
          ...s,
          customTopicDraft: "",
          selectedTopics: s.selectedTopics.includes(draft)
            ? s.selectedTopics
            : [...s.selectedTopics, draft],
        };
      }
      return {
        ...s,
        topicOptions: [...s.topicOptions, draft],
        selectedTopics: [...s.selectedTopics, draft],
        customTopicDraft: "",
      };
    });
  }
}

interface DecisionSummary {
  known: number;
  learning: number;
  wantToLearn: number;
  skipped: number;
}

function summarize(decisions: ReadonlyMap<string, Decision>): DecisionSummary {
  let known = 0;
  let learning = 0;
  let wantToLearn = 0;
  let skipped = 0;
  for (const decision of decisions.values()) {
    if (decision === "known") known += 1;
    else if (decision === "learning") learning += 1;
    else if (decision === "want-to-learn") wantToLearn += 1;
    else skipped += 1;
  }
  return { known, learning, wantToLearn, skipped };
}
