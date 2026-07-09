import React from 'react';

interface StatusChipProps {
  status: string | boolean;
}

export default function StatusChip({ status }: StatusChipProps) {
  let label = '';
  let colorClass = '';

  if (typeof status === 'boolean') {
    label = status ? 'Active' : 'Inactive';
    colorClass = status ? 'green' : 'red';
  } else {
    label = status.toUpperCase();
    switch (label) {
      case 'ACTIVE':
        colorClass = 'green';
        break;
      case 'TRIAL':
        colorClass = 'blue';
        break;
      case 'SUSPENDED':
        colorClass = 'orange';
        break;
      case 'EXPIRED':
        colorClass = 'red';
        break;
      default:
        colorClass = 'gray';
        break;
    }
  }

  return (
    <span className={`status-chip ${colorClass}`}>
      {label}
      <style jsx>{`
        .status-chip {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          font-size: 0.75rem;
          font-weight: 600;
          border-radius: 20px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .green {
          background: var(--success-glow);
          color: var(--success);
        }
        .blue {
          background: var(--primary-glow);
          color: var(--primary);
        }
        .orange {
          background: rgba(245, 158, 11, 0.1);
          color: var(--warning);
        }
        .red {
          background: var(--danger-glow);
          color: var(--danger);
        }
        .gray {
          background: var(--bg-tertiary);
          color: var(--text-muted);
        }
      `}</style>
    </span>
  );
}
