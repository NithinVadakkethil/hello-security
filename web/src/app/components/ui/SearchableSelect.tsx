'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export interface SearchableOption {
  id: string;
  label: string;
  subLabel?: string;
  description?: string;
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
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const updatePosition = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  // Update position on open, window scroll, and window resize
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  // Close popover when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

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
    const matchDesc = opt.description ? opt.description.toLowerCase().includes(term) : false;
    const matchFields = opt.searchValues
      ? opt.searchValues.some((val) => val && val.toLowerCase().includes(term))
      : false;
    return matchLabel || matchSub || matchDesc || matchFields;
  });

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setSearchTerm('');
  };

  const popoverContent =
    isOpen && typeof document !== 'undefined' ? (
      <div
        ref={popoverRef}
        style={{
          position: 'fixed',
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          width: `${coords.width}px`,
          zIndex: 99999,
          backgroundColor: 'var(--surface-color, #ffffff)',
          border: '1px solid var(--border-color, #cbd5e1)',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.18)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
      >
        {/* Top Search Input */}
        <div
          style={{
            padding: '8px 10px',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
            backgroundColor: 'var(--bg-color, #f8fafc)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Search size={15} style={{ color: 'var(--text-muted, #94a3b8)', flexShrink: 0 }} />
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
              color: 'var(--text-primary, #0f172a)',
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
                color: 'var(--text-muted, #94a3b8)',
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
              color: value === '' ? 'var(--primary, #2563eb)' : 'var(--text-secondary, #475569)',
              fontWeight: value === '' ? 700 : 500,
              transition: 'background-color 0.12s ease',
            }}
            className="hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <span>{defaultLabel}</span>
            {value === '' && <Check size={14} style={{ color: 'var(--primary, #2563eb)' }} />}
          </div>

          {filteredOptions.length === 0 ? (
            <div
              style={{
                padding: '16px 12px',
                textAlign: 'center',
                fontSize: '0.8rem',
                color: 'var(--text-muted, #94a3b8)',
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
                    color: isSelected ? 'var(--primary, #2563eb)' : 'var(--text-primary, #0f172a)',
                    fontWeight: isSelected ? 700 : 500,
                    gap: '8px',
                  }}
                  className="hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600 }}>{opt.label}</span>
                    {opt.subLabel && (
                      <span
                        style={{
                          fontSize: '0.74rem',
                          color: 'var(--text-secondary, #64748b)',
                          marginTop: '1px',
                        }}
                      >
                        {opt.subLabel}
                      </span>
                    )}
                    {opt.description && (
                      <span
                        style={{
                          fontSize: '0.70rem',
                          color: 'var(--text-muted, #64748b)',
                          fontFamily: 'monospace',
                          marginTop: '1px',
                        }}
                      >
                        {opt.description}
                      </span>
                    )}
                  </div>
                  {isSelected && <Check size={14} style={{ color: 'var(--primary, #2563eb)', flexShrink: 0 }} />}
                </div>
              );
            })
          )}
        </div>
      </div>
    ) : null;

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
          border: '1px solid var(--border-color, #cbd5e1)',
          backgroundColor: 'var(--bg-color, #ffffff)',
          color: 'var(--text-primary, #0f172a)',
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
            color: selectedOption ? 'var(--text-primary, #0f172a)' : 'var(--text-secondary, #64748b)',
          }}
        >
          {displayLabel}
          {selectedOption?.subLabel ? ` (${selectedOption.subLabel})` : ''}
        </span>
        <ChevronDown
          size={16}
          style={{
            color: 'var(--text-muted, #94a3b8)',
            flexShrink: 0,
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease',
          }}
        />
      </button>

      {/* Portaled Popover Dropdown */}
      {popoverContent ? createPortal(popoverContent, document.body) : null}
    </div>
  );
}
