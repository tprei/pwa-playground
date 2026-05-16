import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { ReaderToken, Tone } from "./types";

const UNBLUR_DURATION_MS = 2500;

export interface TokenRubyProps {
  token: ReaderToken;
  active: boolean;
  blurred: boolean;
  onTap(token: ReaderToken, rect: DOMRect): void;
}

export function TokenRuby({ token, active, blurred, onTap }: TokenRubyProps) {
  const [tempReveal, setTempReveal] = useState(false);
  const [pulse, setPulse] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!tempReveal) return;
    const timer = window.setTimeout(() => setTempReveal(false), UNBLUR_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [tempReveal]);

  if (!token.pinyin || !token.tones) {
    return <span className="reader-punctuation">{token.hanzi}</span>;
  }

  function triggerPulse(): void {
    setPulse(false);
    requestAnimationFrame(() => setPulse(true));
  }

  function handleClick(event: React.MouseEvent<HTMLButtonElement>): void {
    triggerPulse();
    if (blurred) {
      setTempReveal(true);
    }
    const rect = event.currentTarget.getBoundingClientRect();
    onTap(token, rect);
  }

  const characters = Array.from(token.hanzi);
  const pinyinSyllables = (token.pinyin ?? "").split(/\s+/).filter(Boolean);
  const tones = token.tones;
  const showPinyin = !blurred || tempReveal;

  const classes = [
    "reader-token",
    active ? "reader-token--active" : "",
    pulse ? "reader-token--pulse" : "",
    showPinyin ? "reader-token--reveal" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={buttonRef}
      type="button"
      className={classes}
      onClick={handleClick}
      onAnimationEnd={() => setPulse(false)}
      aria-label={`${token.hanzi}${token.glossEn ? `, ${token.glossEn}` : ""}`}
    >
      {characters.map((char, idx) => {
        const tone: Tone = tones[idx] ?? 5;
        const pinyin = pinyinSyllables[idx] ?? "";
        const rtStyle: CSSProperties = {
          filter: showPinyin ? "none" : "blur(6px)",
        };
        return (
          <ruby key={`${char}-${idx}`} className={`reader-ruby tone-${tone}`}>
            {char}
            <rt className="reader-rt" style={rtStyle} aria-hidden={!showPinyin}>
              {pinyin}
            </rt>
          </ruby>
        );
      })}
    </button>
  );
}
