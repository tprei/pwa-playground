import { useMemo, useRef, useState } from "react";
import type { PlaygroundSite, SiteStorage } from "../../../platform/types";
import { createMandarinAudio, DEFAULT_VOICE, readAudioSettings, type PlaybackHandle } from "../audio";
import { ReaderHeader } from "./ReaderHeader";
import { SentenceLine } from "./SentenceLine";
import { HSK1_STARTER_STORY } from "./story";
import { readReaderSettings, writeAlwaysShowPinyin } from "./settings";
import { WordSheet } from "./WordSheet";
import type { ReaderSentence, ReaderToken } from "./types";

interface ReaderProps {
  site: PlaygroundSite;
  storage: SiteStorage;
}

interface SelectedToken {
  sentenceId: string;
  tokenIndex: number;
  token: ReaderToken;
}

interface PlayingSentence {
  sentenceId: string;
  activeTokenIndex: number;
}

export default function Reader({ site, storage }: ReaderProps) {
  const audio = useMemo(() => createMandarinAudio(site), [site]);
  const [alwaysShowPinyin, setAlwaysShowPinyin] = useState(
    () => readReaderSettings(storage).alwaysShowPinyin,
  );
  const [selected, setSelected] = useState<SelectedToken | null>(null);
  const [playing, setPlaying] = useState<PlayingSentence | null>(null);
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioMessage, setAudioMessage] = useState<string | null>(null);
  const playbackRef = useRef<PlaybackHandle | null>(null);
  const timerRef = useRef<number | null>(null);

  function setPinyinPreference(next: boolean): void {
    setAlwaysShowPinyin(next);
    writeAlwaysShowPinyin(storage, next);
  }

  function stopPlayback(): void {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    playbackRef.current?.cancel();
    playbackRef.current = null;
    setPlaying(null);
  }

  async function playSentence(sentence: ReaderSentence): Promise<void> {
    stopPlayback();
    setAudioMessage(null);
    const speakable = sentence.tokens.filter((token) => token.pinyin);
    setPlaying({ sentenceId: sentence.id, activeTokenIndex: 0 });
    try {
      const settings = readAudioSettings(site);
      const handle = await audio.playSentence(sentence.hanzi, settings.voiceId || DEFAULT_VOICE);
      playbackRef.current = handle;
      timerRef.current = window.setInterval(() => {
        const duration = Number.isFinite(handle.audio.duration) && handle.audio.duration > 0
          ? handle.audio.duration
          : Math.max(2.4, speakable.length * 0.55);
        const progress = Math.min(0.999, handle.audio.currentTime / duration);
        const activeTokenIndex = Math.min(
          speakable.length - 1,
          Math.max(0, Math.floor(progress * speakable.length)),
        );
        setPlaying({ sentenceId: sentence.id, activeTokenIndex });
      }, 90);
      await handle.ended;
    } catch (error) {
      setAudioMessage(messageOf(error));
    } finally {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      playbackRef.current = null;
      setPlaying(null);
    }
  }

  async function playTokenAudio(text: string): Promise<void> {
    setAudioBusy(true);
    setAudioMessage(null);
    try {
      const settings = readAudioSettings(site);
      await audio.play(text, settings.voiceId || DEFAULT_VOICE);
    } catch (error) {
      setAudioMessage(messageOf(error));
    } finally {
      setAudioBusy(false);
    }
  }

  function handleTapToken(sentenceId: string, tokenIndex: number, token: ReaderToken): void {
    setSelected({ sentenceId, tokenIndex, token });
  }

  const selectedToken = selected?.token ?? null;

  return (
    <main className="reader-shell">
      <ReaderHeader
        alwaysShowPinyin={alwaysShowPinyin}
        onToggleAlwaysShowPinyin={setPinyinPreference}
      />

      <article className="reader-story" aria-labelledby="reader-title">
        <header className="reader-story__masthead">
          <p className="reader-story__level">HSK {HSK1_STARTER_STORY.hskLevel}</p>
          <h1 id="reader-title">{HSK1_STARTER_STORY.title}</h1>
          <p>{HSK1_STARTER_STORY.description}</p>
        </header>

        <div className="reader-story__body">
          {HSK1_STARTER_STORY.sentences.map((sentence) => (
            <SentenceLine
              key={sentence.id}
              sentence={sentence}
              blurred={!alwaysShowPinyin}
              isPlaying={playing?.sentenceId === sentence.id}
              activeTokenIndex={playing?.sentenceId === sentence.id ? playing.activeTokenIndex : -1}
              onTapToken={handleTapToken}
              onPlay={() => void playSentence(sentence)}
              onStop={stopPlayback}
            />
          ))}
        </div>

        {audioMessage ? <p className="reader-story__notice">{audioMessage}</p> : null}
      </article>

      <WordSheet
        token={selectedToken}
        open={selectedToken !== null}
        onClose={() => setSelected(null)}
        onPlayAudio={(text) => void playTokenAudio(text)}
        audioBusy={audioBusy}
      />
    </main>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Audio playback failed";
}
