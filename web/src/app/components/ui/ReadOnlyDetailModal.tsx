'use client';

import React, { useEffect, useState } from 'react';
import { X, ZoomIn } from 'lucide-react';

interface ReadOnlyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  maxWidth?: string;
  children: React.ReactNode;
}

export default function ReadOnlyDetailModal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  maxWidth = '780px',
  children,
}: ReadOnlyDetailModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="detail-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-modal-title"
    >
      <div
        className="detail-modal-container"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="detail-modal-header">
          <div className="header-title-group">
            {icon && <div className="header-icon-box">{icon}</div>}
            <div>
              <h3 id="detail-modal-title" className="header-title">
                {title}
              </h3>
              {subtitle && <p className="header-subtitle">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="detail-modal-close-btn"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="detail-modal-body">{children}</div>

        {/* Modal Footer */}
        <div className="detail-modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '9px 22px', fontSize: '0.875rem', fontWeight: 600 }}
          >
            Close
          </button>
        </div>
      </div>

      <style jsx>{`
        .detail-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 20px;
          animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .detail-modal-container {
          width: 100%;
          display: flex;
          flex-direction: column;
          max-height: 88vh;
          background: var(--bg-card, #ffffff);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 16px;
          box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25);
          overflow: hidden;
          animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .detail-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 24px;
          background: var(--surface-color, #f8fafc);
          border-bottom: 1px solid var(--border-color, #e2e8f0);
        }
        .header-title-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .header-icon-box {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          background: rgba(59, 130, 246, 0.1);
          color: var(--primary, #2563eb);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .header-title {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text-primary, #0f172a);
          line-height: 1.3;
        }
        .header-subtitle {
          margin: 2px 0 0 0;
          font-size: 0.8rem;
          color: var(--text-secondary, #64748b);
        }
        .detail-modal-close-btn {
          background: transparent;
          border: 1px solid var(--border-color, #e2e8f0);
          color: var(--text-secondary, #64748b);
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .detail-modal-close-btn:hover {
          background: var(--bg-tertiary, #f1f5f9);
          color: var(--text-primary, #0f172a);
          border-color: var(--text-muted, #94a3b8);
        }
        .detail-modal-body {
          padding: 24px;
          overflow-y: auto;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .detail-modal-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 16px 24px;
          background: var(--surface-color, #f8fafc);
          border-top: 1px solid var(--border-color, #e2e8f0);
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(16px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/** Helper component to display structured descriptions */
export function FormattedDescriptionBlock({ text }: { text?: string }) {
  if (!text || !text.trim()) {
    return (
      <div
        style={{
          padding: '12px 16px',
          borderRadius: '10px',
          backgroundColor: 'var(--bg-tertiary, #f8fafc)',
          border: '1px solid var(--border-color, #e2e8f0)',
          fontSize: '0.875rem',
          color: 'var(--text-secondary, #64748b)',
          fontStyle: 'italic',
        }}
      >
        No description provided.
      </div>
    );
  }

  // Check if string contains structured pattern like "Sub-Task Answer:" or "Officer Role:"
  const isStructured =
    text.includes('Sub-Task Answer:') ||
    text.includes('Task Description:') ||
    text.includes('Officer Role:') ||
    text.includes('Remarks:');

  if (isStructured) {
    const keyRegex = /(Sub-Task Answer|Task Description|Officer Role|Remarks|Checkpoint|Patrol Session|Answer):/gi;
    const parts: { key: string; value: string }[] = [];

    const matches = Array.from(text.matchAll(keyRegex));
    if (matches.length > 0) {
      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const key = match[1];
        const startIndex = (match.index || 0) + match[0].length;
        const endIndex = i + 1 < matches.length ? matches[i + 1].index : text.length;
        let value = text.slice(startIndex, endIndex).trim();
        value = value.replace(/[,;]$/, '');
        parts.push({ key, value });
      }

      return (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
            backgroundColor: 'var(--bg-tertiary, #f8fafc)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: '10px',
            padding: '14px',
          }}
        >
          {parts.map((p, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: 'var(--bg-card, #ffffff)',
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: '8px',
                padding: '10px 12px',
              }}
            >
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'var(--text-secondary, #64748b)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {p.key}
              </div>
              <div
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--text-primary, #0f172a)',
                  marginTop: '2px',
                  wordBreak: 'break-word',
                }}
              >
                {p.value || '—'}
              </div>
            </div>
          ))}
        </div>
      );
    }
  }

  // Plain text fallback
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: '10px',
        backgroundColor: 'var(--bg-tertiary, #f8fafc)',
        border: '1px solid var(--border-color, #e2e8f0)',
        fontSize: '0.875rem',
        fontWeight: 500,
        color: 'var(--text-primary, #0f172a)',
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {text}
    </div>
  );
}

/** Helper component to display attached media grid with Zoom Lightbox */
export function MediaGallerySection({ images }: { images?: string[] }) {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  if (!images || images.length === 0) {
    return (
      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #64748b)', fontStyle: 'italic' }}>
        No attached media.
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
          gap: '12px',
          marginTop: '8px',
        }}
      >
        {images.map((imgUrl, idx) => (
          <div
            key={idx}
            onClick={() => setZoomedImage(imgUrl)}
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '1',
              borderRadius: '10px',
              overflow: 'hidden',
              border: '1px solid var(--border-color, #e2e8f0)',
              cursor: 'pointer',
              backgroundColor: 'var(--bg-tertiary, #f1f5f9)',
            }}
            className="media-thumb-container"
          >
            <img
              src={imgUrl}
              alt={`Attachment ${idx + 1}`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
            <div className="thumb-hover-overlay">
              <ZoomIn size={20} color="#ffffff" />
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox / Zoom Modal */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            cursor: 'zoom-out',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={zoomedImage}
              alt="Zoomed Attachment"
              style={{
                maxWidth: '90vw',
                maxHeight: '85vh',
                borderRadius: '12px',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                objectFit: 'contain',
              }}
            />
            <button
              type="button"
              onClick={() => setZoomedImage(null)}
              style={{
                position: 'absolute',
                top: '-16px',
                right: '-16px',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                border: '2px solid #ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .thumb-hover-overlay {
          position: absolute;
          inset: 0;
          background: rgba(15, 23, 42, 0.4);
          opacity: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.2s ease;
        }
        .media-thumb-container:hover .thumb-hover-overlay {
          opacity: 1;
        }
      `}</style>
    </>
  );
}
