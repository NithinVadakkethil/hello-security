import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceTime?: number;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Search...',
  debounceTime = 300,
}: SearchBarProps) {
  const [innerValue, setInnerValue] = useState(value);
  const onChangeRef = useRef(onChange);
  const lastEmittedValueRef = useRef<string>(value);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Sync external value updates (e.g. clear filters, external navigation),
  // but avoid clobbering user typing if value is an echo of what was just emitted.
  useEffect(() => {
    if (value !== lastEmittedValueRef.current) {
      setInnerValue(value);
      lastEmittedValueRef.current = value;
    }
  }, [value]);

  useEffect(() => {
    if (innerValue === lastEmittedValueRef.current) return;

    const handler = setTimeout(() => {
      lastEmittedValueRef.current = innerValue;
      onChangeRef.current(innerValue);
    }, debounceTime);

    return () => {
      clearTimeout(handler);
    };
  }, [innerValue, debounceTime]);

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
      <Search
        size={18}
        style={{
          position: 'absolute',
          left: '14px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-muted)',
          pointerEvents: 'none',
        }}
      />
      <input
        type="text"
        value={innerValue}
        onChange={(e) => setInnerValue(e.target.value)}
        placeholder={placeholder}
        className="form-input"
        style={{ paddingLeft: '44px' }}
      />
    </div>
  );
}
