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
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const customStyle: React.CSSProperties = {
    ...containerStyle,
    ...(maxWidth ? { maxWidth } : {}),
    ...(width ? { width } : {}),
  };

  return (
    <div className="modal-overlay">
      <div
        className={`glass-card modal-container ${className || ''}`}
        style={customStyle}
      >
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {headerContent}
            <button onClick={onClose} className="modal-close-btn" aria-label="Close modal">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="modal-content-body">{children}</div>
      </div>
      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
          padding: 20px;
          animation: fadeIn 0.2s ease-out;
        }
        .modal-container {
          width: 100%;
          max-width: 600px;
          display: flex;
          flex-direction: column;
          max-height: 90vh;
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          overflow: hidden;
        }
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-color);
        }
        .modal-title {
          font-size: 1.15rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        .modal-close-btn {
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
        }
        .modal-close-btn:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }
        .modal-content-body {
          padding: 24px;
          overflow-y: auto;
          flex: 1;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
