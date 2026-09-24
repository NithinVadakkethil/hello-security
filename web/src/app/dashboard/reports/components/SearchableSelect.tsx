'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export interface SearchableOption {
  id: string;
  label: string;
  subLabel?: string;
  searchValues?: (string | undefined | null)[];
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  defaultLabel: string;
  searchPlaceholder: string;
  emptyMessage: string;
  ariaLabel?: string;
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  defaultLabel,
  searchPlaceholder,
  emptyMessage,
  ariaLabel,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.id === value);
  const displayLabel = selectedOption ? selectedOption.label : defaultLabel;

  const filteredOptions = options.filter((opt) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    const matchLabel = opt.label.toLowerCase().includes(term);
    const matchSub = opt.subLabel ? opt.subLabel.toLowerCase().includes(term) : false;
    const matchFields = opt.searchValues
      ? opt.searchValues.some((val) => val && val.toLowerCase().includes(term))
      : false;
    return matchLabel || matchSub || matchFields;
  });

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={ariaLabel || defaultLabel}
        aria-expanded={isOpen}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-color)',
          color: 'var(--text-primary)',
          fontSize: '0.85rem',
          cursor: 'pointer',
          textAlign: 'left',
          boxSizing: 'border-box',
          gap: '8px',
          transition: 'border-color 0.15s ease',
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: selectedOption ? 600 : 400,
            color: selectedOption ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
        >
          {displayLabel}
          {selectedOption?.subLabel ? ` (${selectedOption.subLabel})` : ''}
        </span>
        <ChevronDown
          size={16}
          style={{
            color: 'var(--text-muted)',
            flexShrink: 0,
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease',
          }}
        />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 100,
            backgroundColor: 'var(--surface-color, #ffffff)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.18)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Top Search Input */}
          <div
            style={{
              padding: '8px 10px',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Options List */}
          <div
            style={{
              maxHeight: '260px',
              overflowY: 'auto',
              padding: '4px',
            }}
          >
            {/* Default / Clear Filter Option */}
            <div
              onClick={() => handleSelect('')}
              style={{
                padding: '8px 10px',
                borderRadius: '6px',
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: value === '' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                color: value === '' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: value === '' ? 700 : 500,
                transition: 'background-color 0.12s ease',
              }}
              className="hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <span>{defaultLabel}</span>
              {value === '' && <Check size={14} style={{ color: 'var(--primary)' }} />}
            </div>

            {filteredOptions.length === 0 ? (
              <div
                style={{
                  padding: '16px 12px',
                  textAlign: 'center',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                }}
              >
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = value === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => handleSelect(opt.id)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontSize: '0.83rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                      color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                      fontWeight: isSelected ? 700 : 500,
                      gap: '8px',
                    }}
                    className="hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span>{opt.label}</span>
                      {opt.subLabel && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            color: 'var(--text-muted)',
                            fontFamily: 'monospace',
                            marginTop: '1px',
                          }}
                        >
                          {opt.subLabel}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
