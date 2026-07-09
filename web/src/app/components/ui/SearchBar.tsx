import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    setInnerValue(value);
  }, [value]);

  useEffect(() => {
    const handler = setTimeout(() => {
      onChange(innerValue);
    }, debounceTime);

    return () => {
      clearTimeout(handler);
    };
  }, [innerValue, onChange, debounceTime]);

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
