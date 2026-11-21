'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';

export interface WeekRange {
  startDate: string; // YYYY-MM-DD (Monday)
  endDate: string; // YYYY-MM-DD (Sunday)
  label: string; // e.g. "26 Oct – 01 Nov 2026"
}

interface WeekPickerPopoverProps {
  value: string; // YYYY-MM-DD (any date in the week, or Monday)
  onChange: (dateStr: string, weekRange: WeekRange) => void;
  disabled?: boolean;
}

// Helpers for date manipulation without timezone shift issues
function parseYMD(str?: string): { year: number; month: number; day: number } {
  if (str && str.includes('-')) {
    const parts = str.split('T')[0].split('-').map(Number);
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return { year: parts[0], month: parts[1] - 1, day: parts[2] };
    }
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
}

function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getWeekBoundaries(dateInput?: string | Date): WeekRange {
  let ref: Date;
  if (!dateInput) {
    ref = new Date();
  } else if (typeof dateInput === 'string') {
    const p = parseYMD(dateInput);
    ref = new Date(p.year, p.month, p.day, 12, 0, 0, 0);
  } else {
    ref = new Date(dateInput.getTime());
  }

  const dayOfWeek = ref.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  // Monday is start of the week: diff = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek
  const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;

  const mon = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + diffToMonday, 0, 0, 0, 0);
  const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6, 23, 59, 59, 999);

  const startFormatted = `${mon.getDate()} ${mon.toLocaleDateString('en-US', { month: 'short' })}${
    mon.getFullYear() !== sun.getFullYear() ? ` ${mon.getFullYear()}` : ''
  }`;
  const endFormatted = `${sun.getDate()} ${sun.toLocaleDateString('en-US', { month: 'short' })} ${sun.getFullYear()}`;

  return {
    startDate: formatYMD(mon),
    endDate: formatYMD(sun),
    label: `${startFormatted} – ${endFormatted}`,
  };
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function WeekPickerPopover({
  value,
  onChange,
  disabled = false,
}: WeekPickerPopoverProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const currentWeek = useMemo(() => getWeekBoundaries(value), [value]);

  // Calendar navigation state (year & month currently viewed)
  const initialParsed = useMemo(() => parseYMD(value), [value]);
  const [viewYear, setViewYear] = useState(initialParsed.year);
  const [viewMonth, setViewMonth] = useState(initialParsed.month);
  const [hoveredWeekStart, setHoveredWeekStart] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; placeAbove: boolean }>({
    top: 0,
    left: 0,
    width: 320,
    placeAbove: false,
  });

  // Keep view in sync when value changes externally
  useEffect(() => {
    const p = parseYMD(value);
    setViewYear(p.year);
    setViewMonth(p.month);
  }, [value]);

  const updatePosition = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const popoverHeight = 360;
      const spaceBelow = window.innerHeight - rect.bottom;
      const placeAbove = spaceBelow < popoverHeight && rect.top > popoverHeight;

      setCoords({
        top: placeAbove ? rect.top - popoverHeight - 6 : rect.bottom + 6,
        left: Math.max(10, Math.min(rect.left, window.innerWidth - 340)),
        width: Math.max(rect.width, 320),
        placeAbove,
      });
    }
  }, []);

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

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
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

  // Quick Controls
  const handlePreviousWeek = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const p = parseYMD(currentWeek.startDate);
    const prevMon = new Date(p.year, p.month, p.day - 7, 12, 0, 0, 0);
    const newWeek = getWeekBoundaries(prevMon);
    onChange(newWeek.startDate, newWeek);
  };

  const handleNextWeek = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const p = parseYMD(currentWeek.startDate);
    const nextMon = new Date(p.year, p.month, p.day + 7, 12, 0, 0, 0);
    const newWeek = getWeekBoundaries(nextMon);
    onChange(newWeek.startDate, newWeek);
  };

  const handleThisWeek = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const today = new Date();
    const thisWeek = getWeekBoundaries(today);
    onChange(thisWeek.startDate, thisWeek);
    const p = parseYMD(thisWeek.startDate);
    setViewYear(p.year);
    setViewMonth(p.month);
  };

  const handleSelectDay = (dayDate: Date) => {
    const newWeek = getWeekBoundaries(dayDate);
    onChange(newWeek.startDate, newWeek);
    setIsOpen(false);
  };

  // Build Month Grid (6 rows of 7 days, Monday to Sunday)
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1, 12, 0, 0, 0);
    const dayOfWeek = firstDayOfMonth.getDay(); // 0 is Sun, 1 is Mon...
    const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;

    const startDate = new Date(viewYear, viewMonth, 1 + diffToMonday, 12, 0, 0, 0);

    const days: Array<{
      date: Date;
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      weekStartStr: string;
      isWeekStart: boolean;
      isWeekEnd: boolean;
    }> = [];

    const todayStr = formatYMD(new Date());

    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i, 12, 0, 0, 0);
      const dateStr = formatYMD(d);
      const dOfWeek = d.getDay();
      const diffMon = (dOfWeek === 0 ? -6 : 1) - dOfWeek;
      const weekMon = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffMon, 12, 0, 0, 0);

      days.push({
        date: d,
        dateStr,
        dayNum: d.getDate(),
        isCurrentMonth: d.getMonth() === viewMonth,
        isToday: dateStr === todayStr,
        weekStartStr: formatYMD(weekMon),
        isWeekStart: i % 7 === 0,
        isWeekEnd: i % 7 === 6,
      });
    }

    return days;
  }, [viewYear, viewMonth]);

  const popoverContent =
    isOpen && typeof document !== 'undefined' ? (
      <div
        ref={popoverRef}
        style={{
          position: 'fixed',
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          width: '320px',
          zIndex: 99999,
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #cbd5e1',
          boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.18), 0 4px 12px -2px rgba(0, 0, 0, 0.08)',
          padding: '16px',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
        }}
      >
        {/* Popover Header: Month / Year Navigation */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <button
              type="button"
              onClick={() => setViewYear((y) => y - 1)}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                borderRadius: '6px',
                cursor: 'pointer',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Previous Year"
            >
              <ChevronsLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (viewMonth === 0) {
                  setViewMonth(11);
                  setViewYear((y) => y - 1);
                } else {
                  setViewMonth((m) => m - 1);
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                borderRadius: '6px',
                cursor: 'pointer',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Previous Month"
            >
              <ChevronLeft size={16} />
            </button>
          </div>

          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <button
              type="button"
              onClick={() => {
                if (viewMonth === 11) {
                  setViewMonth(0);
                  setViewYear((y) => y + 1);
                } else {
                  setViewMonth((m) => m + 1);
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                borderRadius: '6px',
                cursor: 'pointer',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Next Month"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => setViewYear((y) => y + 1)}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                borderRadius: '6px',
                cursor: 'pointer',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Next Year"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>

        {/* Day-of-week Headers (Monday to Sunday) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '2px',
            textAlign: 'center',
            marginBottom: '6px',
          }}
        >
          {WEEKDAY_NAMES.map((name) => (
            <div
              key={name}
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#64748b',
                padding: '4px 0',
                textTransform: 'uppercase',
              }}
            >
              {name}
            </div>
          ))}
        </div>

        {/* Calendar Grid (6 rows x 7 days) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '2px 0px',
            rowGap: '3px',
          }}
          onMouseLeave={() => setHoveredWeekStart(null)}
        >
          {calendarDays.map((item, idx) => {
            const isSelectedWeek = item.weekStartStr === currentWeek.startDate;
            const isHovered = hoveredWeekStart === item.weekStartStr && !isSelectedWeek;

            // Background & border-radius styling for entire week strip
            let backgroundColor = 'transparent';
            if (isSelectedWeek) {
              backgroundColor = '#2563eb';
            } else if (isHovered) {
              backgroundColor = '#eff6ff';
            }

            let borderRadius = '0';
            if (item.isWeekStart) {
              borderRadius = '8px 0 0 8px';
            } else if (item.isWeekEnd) {
              borderRadius = '0 8px 8px 0';
            }

            let textColor = item.isCurrentMonth ? '#1e293b' : '#94a3b8';
            if (isSelectedWeek) {
              textColor = '#ffffff';
            } else if (item.isToday) {
              textColor = '#2563eb';
            }

            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredWeekStart(item.weekStartStr)}
                onClick={() => handleSelectDay(item.date)}
                style={{
                  height: '34px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  backgroundColor,
                  borderRadius,
                  color: textColor,
                  fontSize: '0.82rem',
                  fontWeight: isSelectedWeek || item.isToday ? 700 : 500,
                  position: 'relative',
                  transition: 'background-color 0.1s ease',
                  userSelect: 'none',
                }}
              >
                <span>{item.dayNum}</span>
                {item.isToday && !isSelectedWeek && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '2px',
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      backgroundColor: '#2563eb',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Popover Footer: Shortcut & Selected Week Info */}
        <div
          style={{
            marginTop: '14px',
            paddingTop: '12px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <button
            type="button"
            onClick={handleThisWeek}
            style={{
              padding: '5px 10px',
              fontSize: '0.78rem',
              fontWeight: 600,
              borderRadius: '6px',
              backgroundColor: '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <RotateCcw size={12} />
            <span>This Week</span>
          </button>

          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              color: '#2563eb',
            }}
          >
            {currentWeek.label}
          </span>
        </div>
      </div>
    ) : null;

  return (
    <div ref={containerRef} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      {/* Quick Previous Week button */}
      <button
        type="button"
        onClick={handlePreviousWeek}
        disabled={disabled}
        aria-label="Previous Week"
        style={{
          padding: '8px',
          borderRadius: '8px',
          border: '1px solid #cbd5e1',
          backgroundColor: '#ffffff',
          color: '#475569',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
        }}
        title="Go to previous week"
      >
        <ChevronLeft size={16} />
      </button>

      {/* Main Week Selector Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-label="Select reporting week"
        style={{
          flex: 1,
          padding: '8px 12px',
          borderRadius: '8px',
          border: isOpen ? '1px solid #2563eb' : '1px solid #cbd5e1',
          backgroundColor: '#ffffff',
          color: '#1e293b',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.88rem',
          fontWeight: 600,
          boxShadow: isOpen ? '0 0 0 2px rgba(37, 99, 235, 0.15)' : 'none',
          transition: 'all 0.15s ease',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <CalendarIcon size={15} style={{ color: '#2563eb', flexShrink: 0 }} />
          <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {currentWeek.label}
          </span>
        </div>
        <ChevronDown size={15} style={{ color: '#64748b', flexShrink: 0 }} />
      </button>

      {/* Quick Next Week button */}
      <button
        type="button"
        onClick={handleNextWeek}
        disabled={disabled}
        aria-label="Next Week"
        style={{
          padding: '8px',
          borderRadius: '8px',
          border: '1px solid #cbd5e1',
          backgroundColor: '#ffffff',
          color: '#475569',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
        }}
        title="Go to next week"
      >
        <ChevronRight size={16} />
      </button>

      {/* Render Popover via Portal */}
      {popoverContent && createPortal(popoverContent, document.body)}
    </div>
  );
}
