'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wrench } from 'lucide-react';

export interface SnagCategoryItem {
  category: string;
  count: number;
  percentage?: number;
}

interface SnagDonutChartProps {
  clientId: string;
  totalSnags: number;
  openSnags: number;
  wipSnags: number;
  closedSnags: number;
  categories: SnagCategoryItem[];
}

// Stable accessible color palette for categories
const CATEGORY_COLORS = [
  '#3B82F6', // Blue
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#EAB308', // Yellow
];

export default function SnagDonutChart({
  clientId,
  totalSnags,
  openSnags,
  wipSnags,
  closedSnags,
  categories = [],
}: SnagDonutChartProps) {
  const router = useRouter();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const getCategoryColor = (index: number) => {
    return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
  };

  const handleCategoryClick = (categoryName: string) => {
    router.push(`/central/snags?clientId=${clientId}&category=${encodeURIComponent(categoryName)}`);
  };

  const handleStatusClick = (status: string) => {
    router.push(`/central/snags?clientId=${clientId}&status=${status}`);
  };

  // Calculate SVG donut segments
  const size = 180;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentAngle = 0;
  const segments = categories.map((cat, idx) => {
    const pct = totalSnags > 0 ? cat.count / totalSnags : 0;
    const strokeDasharray = `${pct * circumference} ${circumference}`;
    const strokeDashoffset = -currentAngle * circumference;
    currentAngle += pct;
    return {
      ...cat,
      color: getCategoryColor(idx),
      strokeDasharray,
      strokeDashoffset,
      index: idx,
    };
  });

  return (
    <div className="snag-donut-container">
      {/* Top Status Strip */}
      <div className="status-summary-strip">
        <button
          onClick={() => handleStatusClick('ALL')}
          className="status-summary-item"
        >
          <span className="status-label">Total</span>
          <span className="status-value">{totalSnags}</span>
        </button>
        <button
          onClick={() => handleStatusClick('OPEN')}
          className="status-summary-item"
        >
          <span className="status-label" style={{ color: '#F59E0B' }}>Open</span>
          <span className="status-value" style={{ color: '#F59E0B' }}>{openSnags}</span>
        </button>
        <button
          onClick={() => handleStatusClick('IN_PROGRESS')}
          className="status-summary-item"
        >
          <span className="status-label" style={{ color: '#3B82F6' }}>WIP</span>
          <span className="status-value" style={{ color: '#3B82F6' }}>{wipSnags}</span>
        </button>
        <button
          onClick={() => handleStatusClick('CLOSED')}
          className="status-summary-item"
        >
          <span className="status-label" style={{ color: '#10B981' }}>Closed</span>
          <span className="status-value" style={{ color: '#10B981' }}>{closedSnags}</span>
        </button>
      </div>

      {totalSnags === 0 ? (
        <div className="empty-donut-box">
          <Wrench size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            No snag reports logged for this organization.
          </p>
        </div>
      ) : (
        <div className="donut-and-legend-grid">
          {/* SVG Donut */}
          <div className="donut-chart-wrapper">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut-svg">
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="var(--border-color, #e2e8f0)"
                strokeWidth={strokeWidth}
              />
              {segments.map((seg) => (
                <circle
                  key={seg.index}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth={hoveredIdx === seg.index ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={seg.strokeDasharray}
                  strokeDashoffset={seg.strokeDashoffset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  onMouseEnter={() => setHoveredIdx(seg.index)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onClick={() => handleCategoryClick(seg.category)}
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    opacity: hoveredIdx === null || hoveredIdx === seg.index ? 1 : 0.45,
                  }}
                />
              ))}
            </svg>
            <div className="donut-center-text">
              <span className="center-count">
                {hoveredIdx !== null ? categories[hoveredIdx].count : totalSnags}
              </span>
              <span className="center-label">
                {hoveredIdx !== null ? categories[hoveredIdx].category : 'Total Snags'}
              </span>
            </div>
          </div>

          {/* Colored Clickable Category Text Legend */}
          <div className="category-legend-list">
            {categories.map((cat, idx) => {
              const color = getCategoryColor(idx);
              const isHovered = hoveredIdx === idx;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleCategoryClick(cat.category)}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className={`category-legend-item ${isHovered ? 'hovered' : ''}`}
                  style={{ color }}
                >
                  <span className="cat-bullet" style={{ backgroundColor: color }} />
                  <span className="cat-name">{cat.category}</span>
                  <span className="cat-count">({cat.count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <style jsx>{`
        .snag-donut-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
          height: 100%;
        }
        .status-summary-strip {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          background: var(--surface-color, #f8fafc);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 10px;
          padding: 8px;
        }
        .status-summary-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          transition: background 0.15s ease;
        }
        .status-summary-item:hover {
          background: var(--bg-card, #ffffff);
        }
        .status-label {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--text-secondary, #64748b);
        }
        .status-value {
          font-size: 1.1rem;
          font-weight: 800;
          color: var(--text-primary, #0f172a);
          line-height: 1.2;
        }
        .empty-donut-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 36px 16px;
          border: 1px dashed var(--border-color, #e2e8f0);
          border-radius: 12px;
          text-align: center;
        }
        .donut-and-legend-grid {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 20px;
          align-items: center;
        }
        .donut-chart-wrapper {
          position: relative;
          width: 180px;
          height: 180px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .donut-center-text {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          text-align: center;
          padding: 0 10px;
        }
        .center-count {
          font-size: 1.6rem;
          font-weight: 800;
          color: var(--text-primary, #0f172a);
          line-height: 1;
        }
        .center-label {
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--text-secondary, #64748b);
          text-transform: uppercase;
          margin-top: 4px;
          max-width: 110px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .category-legend-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 180px;
          overflow-y: auto;
          padding-right: 6px;
        }
        .category-legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 600;
          text-align: left;
          padding: 4px 8px;
          border-radius: 6px;
          transition: all 0.15s ease;
        }
        .category-legend-item:hover,
        .category-legend-item.hovered {
          background: var(--surface-color, #f1f5f9);
          transform: translateX(4px);
        }
        .cat-bullet {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .cat-name {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .cat-count {
          font-weight: 700;
          opacity: 0.85;
        }
        @media (max-width: 640px) {
          .donut-and-legend-grid {
            grid-template-columns: 1fr;
            justify-items: center;
          }
          .category-legend-list {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
