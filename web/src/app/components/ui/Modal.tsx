import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
  width?: string;
  className?: string;
  containerStyle?: React.CSSProperties;
  headerContent?: React.ReactNode;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth,
  width,
  className,
  containerStyle,
  headerContent,
}: ModalProps) {
  // Lock background scroll and handle Escape key with focus preservation
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const previousActiveElement = document.activeElement as HTMLElement | null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow || 'unset';
      window.removeEventListener('keydown', handleKeyDown);
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const customStyle: React.CSSProperties = {
    ...containerStyle,
    ...(maxWidth ? { maxWidth } : {}),
    ...(width ? { width } : {}),
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const modalContent = (
    <div
      className="modal-overlay"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title-heading"
    >
      <div
        className={`glass-card modal-container ${className || ''}`}
        style={customStyle}
      >
        <div className="modal-header">
          <h3 id="modal-title-heading" className="modal-title">
            {title}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {headerContent}
            <button
              onClick={onClose}
              className="modal-close-btn"
              aria-label="Close modal"
              type="button"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="modal-content-body">{children}</div>
      </div>
      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(15, 23, 42, 0.68);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 16px;
          box-sizing: border-box;
          animation: modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          overflow-y: auto;
        }
        .modal-container {
          width: 100%;
          max-width: 600px;
          display: flex;
          flex-direction: column;
          max-height: calc(100vh - 32px);
          margin: auto;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
          overflow: hidden;
          position: relative;
          animation: modalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @media (max-height: 720px) {
          .modal-overlay {
            padding: 12px;
          }
          .modal-container {
            max-height: calc(100vh - 24px);
            border-radius: 12px;
          }
        }
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-secondary);
          flex-shrink: 0;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .modal-title {
          font-size: 1.12rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }
        .modal-close-btn {
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
          border-radius: var(--radius-sm, 6px);
          border: 1px solid transparent;
          background: transparent;
          cursor: pointer;
          transition: all var(--transition-fast, 0.15s ease);
        }
        .modal-close-btn:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border-color: var(--border-color);
        }
        .modal-content-body {
          padding: 20px;
          overflow-y: auto;
          flex: 1 1 auto;
          min-height: 0;
        }
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalSlideUp {
          from { transform: translateY(16px) scale(0.98); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );

  return modalContent;
}
