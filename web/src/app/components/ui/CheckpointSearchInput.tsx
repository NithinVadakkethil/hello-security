import React from 'react';
import { Search, X } from 'lucide-react';

interface CheckpointSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
  ariaLabel?: string;
  style?: React.CSSProperties;
}

export default function CheckpointSearchInput({
  value,
  onChange,
  onClear,
  placeholder = 'Search checkpoints by name or gate code...',
  ariaLabel = 'Search available checkpoints',
  style,
}: CheckpointSearchInputProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-sm, 6px)',
        width: '100%',
        boxSizing: 'border-box',
        transition: 'border-color 0.15s ease',
        ...style,
      }}
    >
      <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        style={{
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'var(--text-primary)',
          width: '100%',
          fontSize: '0.85rem',
        }}
      />
      {value && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2px',
            borderRadius: '50%',
            flexShrink: 0,
          }}
          title="Clear search"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export function HighlightText({ text, query }: { text: string; query: string }) {
  const trimmed = query.trim();
  if (!trimmed) return <>{text}</>;

  try {
    const escaped = trimmed.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));

    return (
      <>
        {parts.map((part, idx) =>
          part.toLowerCase() === trimmed.toLowerCase() ? (
            <mark
              key={idx}
              style={{
                backgroundColor: 'rgba(234, 179, 8, 0.25)',
                color: 'var(--text-primary)',
                borderRadius: '2px',
                padding: '0 2px',
              }}
            >
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  } catch (e) {
    return <>{text}</>;
  }
}
