import { useState, type FormEvent, type KeyboardEvent } from "react";
import type { PlaygroundAppProps } from "../../../platform/types";

const DEFAULT_TOPICS = ["software", "gym", "daily life", "food"] as const;

interface OnboardingProps extends PlaygroundAppProps {
  onComplete?: () => void;
}

export default function Onboarding({ site, storage, onComplete }: OnboardingProps) {
  const [topics, setTopics] = useState<readonly string[]>([...DEFAULT_TOPICS]);
  const [selectedTopics, setSelectedTopics] = useState<ReadonlySet<string>>(new Set());
  const [topicDraft, setTopicDraft] = useState("");
  const [apiToken, setApiToken] = useState("");

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

  function finish(persist: boolean) {
    if (persist) {
      storage.set("settings:preferredTopics", JSON.stringify([...selectedTopics]));
      const token = apiToken.trim();
      if (token) storage.set("settings:apiToken", token);
    }
    storage.set("settings:firstLaunchDone", "true");
    onComplete?.();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    finish(true);
  }

  return (
    <main className="app app--zhongwen onboarding">
      <header className="onboarding__header">
        <p className="eyebrow">/{site.slug}/ · setup</p>
        <h1>Quick setup</h1>
        <p className="onboarding__lede">
          Pick a few topics and paste an API token if you have one. Everything here is optional —
          you can change it later in Settings.
        </p>
      </header>

      <form className="onboarding__panel onboarding__settings" onSubmit={handleSubmit}>
        <fieldset className="onboarding__field">
          <legend>Preferred topics</legend>
          <div className="onboarding__chips">
            {topics.map((topic) => (
              <button
                key={topic}
                type="button"
                className={`onboarding__chip${
                  selectedTopics.has(topic) ? " onboarding__chip--selected" : ""
                }`}
                onClick={() => toggleTopic(topic)}
                aria-pressed={selectedTopics.has(topic)}
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
              value={topicDraft}
              onChange={(e) => setTopicDraft(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTopic();
                }
              }}
              placeholder="e.g. travel"
            />
          </label>
          <button type="button" onClick={addTopic} disabled={!topicDraft.trim()}>
            Add
          </button>
        </div>

        <label className="onboarding__field">
          <span>Personal API token</span>
          <input
            type="password"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste your token (optional)"
          />
        </label>

        <div className="onboarding__actions">
          <button type="submit" className="onboarding__primary">
            Save and continue
          </button>
          <button
            type="button"
            className="onboarding__secondary"
            onClick={() => finish(false)}
          >
            Skip for now
          </button>
        </div>
      </form>
    </main>
  );
}
