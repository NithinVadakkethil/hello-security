import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number | 'all';
  pageSizeOptions?: (number | 'all')[];
  onPageSizeChange?: (size: number | 'all') => void;
  totalRecords?: number;
}

export function getPageItems(
  currentPage: number,
  totalPages: number,
): (number | 'left-ellipsis' | 'right-ellipsis')[] {
  const page = Math.max(1, Math.min(currentPage, totalPages));
  const total = Math.max(1, totalPages);

  if (total <= 10) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  let startPage = page - 4;
  let endPage = page + 5;

  if (startPage <= 2) {
    startPage = 1;
    endPage = 10;
  } else if (endPage >= total - 1) {
    endPage = total;
    startPage = total - 9;
  }

  const items: (number | 'left-ellipsis' | 'right-ellipsis')[] = [];

  if (startPage > 1) {
    items.push(1);
    if (startPage > 2) {
      items.push('left-ellipsis');
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    items.push(i);
  }

  if (endPage < total) {
    if (endPage < total - 1) {
      items.push('right-ellipsis');
    }
    items.push(total);
  }

  return items;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  totalRecords,
}: PaginationProps) {
  const pageNum = Number(currentPage) || 1;
  const total = Number(totalPages) || 1;
  const isAllSelected = pageSize === 'all';

  // If total pages <= 1, no page size options, and page is 1, hide completely
  if (total <= 1 && pageNum <= 1 && !pageSizeOptions && !isAllSelected) return null;

  const pageItems = getPageItems(pageNum, total);

  const handlePageClick = (page: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (page !== pageNum && page >= 1 && page <= total) {
      onPageChange(page);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '24px',
        padding: '8px 4px',
        flexWrap: 'wrap',
        gap: '12px',
      }}
    >
      {/* Left Info & Page Size */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          {isAllSelected ? (
            <>
              Showing <strong style={{ color: 'var(--text-primary)' }}>All</strong>
              {totalRecords !== undefined && (
                <> ({totalRecords} total record{totalRecords === 1 ? '' : 's'})</>
              )}
            </>
          ) : (
            <>
              Page <strong style={{ color: 'var(--text-primary)' }}>{pageNum}</strong> of{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{total}</strong>
              {totalRecords !== undefined && (
                <> ({totalRecords} total record{totalRecords === 1 ? '' : 's'})</>
              )}
            </>
          )}
        </span>

        {pageSizeOptions && onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Rows per page:
            </span>
            <select
              value={isAllSelected ? 'all' : pageSize}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                onPageSizeChange(val);
              }}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-color)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={String(opt)} value={opt}>
                  {opt === 'all' ? 'All' : opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right Controls: Previous, Numbered Pages, Next */}
      {!isAllSelected && total > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {/* Previous Button */}
          <button
            type="button"
            onClick={(e) => handlePageClick(pageNum - 1, e)}
            disabled={pageNum <= 1}
            className="btn btn-secondary"
            style={{
              padding: '6px 12px',
              minHeight: '36px',
              opacity: pageNum <= 1 ? 0.45 : 1,
              cursor: pageNum <= 1 ? 'not-allowed' : 'pointer',
              gap: '4px',
              fontSize: '0.85rem',
              borderRadius: '8px',
            }}
            aria-label="Go to previous page"
          >
            <ChevronLeft size={16} />
            <span>Previous</span>
          </button>

          {/* Numbered Page Buttons */}
          {pageItems.map((item, index) => {
            if (item === 'left-ellipsis' || item === 'right-ellipsis') {
              return (
                <span
                  key={`${item}-${index}`}
                  style={{
                    color: 'var(--text-muted)',
                    padding: '0 4px',
                    fontSize: '0.85rem',
                    userSelect: 'none',
                  }}
                >
                  ...
                </span>
              );
            }

            const num = item as number;
            const isActive = num === pageNum;

            return (
              <button
                key={num}
                type="button"
                onClick={(e) => handlePageClick(num, e)}
                style={{
                  minWidth: '36px',
                  height: '36px',
                  padding: '0 8px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: isActive ? 700 : 500,
                  border: isActive ? '1px solid var(--primary, #2563eb)' : '1px solid var(--border-color, #e2e8f0)',
                  backgroundColor: isActive ? 'var(--primary, #2563eb)' : 'var(--surface-color, #ffffff)',
                  color: isActive ? '#ffffff' : 'var(--text-primary, #0f172a)',
                  cursor: isActive ? 'default' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? '0 2px 6px rgba(37, 99, 235, 0.25)' : 'none',
                }}
                aria-label={`Go to page ${num}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {num}
              </button>
            );
          })}

          {/* Next Button */}
          <button
            type="button"
            onClick={(e) => handlePageClick(pageNum + 1, e)}
            disabled={pageNum >= total}
            className="btn btn-secondary"
            style={{
              padding: '6px 12px',
              minHeight: '36px',
              opacity: pageNum >= total ? 0.45 : 1,
              cursor: pageNum >= total ? 'not-allowed' : 'pointer',
              gap: '4px',
              fontSize: '0.85rem',
              borderRadius: '8px',
            }}
            aria-label="Go to next page"
          >
            <span>Next</span>
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
