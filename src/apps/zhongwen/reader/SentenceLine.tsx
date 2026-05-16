import { TokenRuby } from "./TokenRuby";
import type { ReaderSentence, ReaderToken } from "./types";

export interface SentenceLineProps {
  sentence: ReaderSentence;
  blurred: boolean;
  isPlaying: boolean;
  activeTokenIndex: number;
  onTapToken(sentenceId: string, tokenIndex: number, token: ReaderToken, rect: DOMRect): void;
  onPlay(sentenceId: string): void;
  onStop(): void;
}

export function SentenceLine({
  sentence,
  blurred,
  isPlaying,
  activeTokenIndex,
  onTapToken,
  onPlay,
  onStop,
}: SentenceLineProps) {
  const tokenIndexes = sentence.tokens
    .map((token, idx) => ({ token, idx }))
    .filter(({ token }) => Boolean(token.pinyin));
  const speakableCount = tokenIndexes.length;
  const activeSpeakableIndex = isPlaying ? activeTokenIndex : -1;

  return (
    <p className="reader-sentence">
      <button
        type="button"
        className={`reader-sentence__play${isPlaying ? " reader-sentence__play--active" : ""}`}
        onClick={() => (isPlaying ? onStop() : onPlay(sentence.id))}
        aria-label={isPlaying ? "Stop sentence" : "Play sentence"}
      >
        {isPlaying ? "■" : "▶"}
      </button>
      <span className="reader-sentence__text">
        {sentence.tokens.map((token, idx) => {
          let active = false;
          if (token.pinyin) {
            const speakableIndex = tokenIndexes.findIndex((entry) => entry.idx === idx);
            active = speakableIndex === activeSpeakableIndex && speakableIndex < speakableCount;
          }
          return (
            <TokenRuby
              key={`${sentence.id}-t${idx}`}
              token={token}
              active={active}
              blurred={blurred}
              onTap={(tappedToken, rect) => onTapToken(sentence.id, idx, tappedToken, rect)}
            />
          );
        })}
      </span>
    </p>
  );
}
