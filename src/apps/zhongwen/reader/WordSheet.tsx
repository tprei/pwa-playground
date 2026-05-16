import { useEffect, useState } from "react";
import { lookupCedict, type CedictLookup } from "./cedict";
import type { ReaderToken } from "./types";

export interface WordSheetProps {
  token: ReaderToken | null;
  open: boolean;
  onClose(): void;
  onPlayAudio(text: string): void;
  audioBusy: boolean;
}

export function WordSheet({ token, open, onClose, onPlayAudio, audioBusy }: WordSheetProps) {
  const [lookup, setLookup] = useState<CedictLookup | null>(null);
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "missing">("idle");

  useEffect(() => {
    if (!token) {
      setLookup(null);
      setLookupState("idle");
      return;
    }
    let cancelled = false;
    setLookupState("loading");
    setLookup(null);
    lookupCedict(token.hanzi)
      .then((result) => {
        if (cancelled) return;
        if (result) {
          setLookup(result);
          setLookupState("idle");
        } else {
          setLookupState("missing");
        }
      })
      .catch(() => {
        if (!cancelled) setLookupState("missing");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const displayPinyin = lookup?.pinyin ?? token?.pinyin ?? "";
  const glosses: readonly string[] = lookup?.glosses ?? (token?.glossEn ? [token.glossEn] : []);
  const sheetClass = `word-sheet${open ? " word-sheet--open" : ""}`;
  const backdropClass = `word-sheet__backdrop${open ? " word-sheet__backdrop--open" : ""}`;

  return (
    <>
      <div className={backdropClass} aria-hidden={!open} onClick={onClose} />
      <aside
        className={sheetClass}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-label={token ? `Details for ${token.hanzi}` : "Word details"}
      >
        <div className="word-sheet__handle" aria-hidden="true" />
        {token ? (
          <div className="word-sheet__body">
            <div className="word-sheet__hanzi-row">
              <span className="word-sheet__hanzi">{token.hanzi}</span>
              <button
                type="button"
                className="word-sheet__audio"
                onClick={() => onPlayAudio(token.hanzi)}
                disabled={audioBusy}
                aria-label="Play audio"
              >
                ▶
              </button>
            </div>
            <p className="word-sheet__pinyin">{displayPinyin}</p>
            {lookupState === "loading" ? (
              <p className="word-sheet__hint">Looking up…</p>
            ) : glosses.length > 0 ? (
              <ul className="word-sheet__glosses">
                {glosses.map((gloss, idx) => (
                  <li key={`${gloss}-${idx}`}>{gloss}</li>
                ))}
              </ul>
            ) : (
              <p className="word-sheet__hint">No dictionary entry.</p>
            )}
          </div>
        ) : null}
      </aside>
    </>
  );
}
