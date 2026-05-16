export interface ReaderHeaderProps {
  alwaysShowPinyin: boolean;
  onToggleAlwaysShowPinyin(next: boolean): void;
}

export function ReaderHeader({ alwaysShowPinyin, onToggleAlwaysShowPinyin }: ReaderHeaderProps) {
  return (
    <header className="reader-header">
      <button type="button" className="reader-header__pill" disabled aria-label="Queue (coming soon)">
        <span className="reader-header__pill-dot" />
        <span className="reader-header__pill-text">Queue · 0</span>
      </button>

      <div className="reader-header__actions">
        <label className="reader-header__toggle" title="Always show pinyin">
          <input
            type="checkbox"
            checked={alwaysShowPinyin}
            onChange={(event) => onToggleAlwaysShowPinyin(event.target.checked)}
          />
          <span>Always show</span>
        </label>

        <button
          type="button"
          className="reader-header__icon"
          disabled
          aria-label="Library (coming soon)"
          title="Library"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 4h6v16H4z" />
            <path d="M14 4h6v16h-6z" />
          </svg>
        </button>

        <button
          type="button"
          className="reader-header__icon"
          disabled
          aria-label="Settings (coming soon)"
          title="Settings"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
