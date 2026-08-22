'use client';

import React from 'react';
import { Search, Calendar, Filter, RefreshCw, Download, Printer } from 'lucide-react';

export interface FilterState {
  datePreset: string;
  startDate: string;
  endDate: string;
  employeeId: string;
  siteId: string;
  gateId: string;
  status: string;
  search: string;
}

interface AdvancedFilterPanelProps {
  filters: FilterState;
  onFilterChange: (updated: Partial<FilterState>) => void;
  onReset: () => void;
  onExportCsv: () => void;
  onPrint: () => void;
  employees: { id: string; firstName: string; lastName: string }[];
  sites: { id: string; name: string }[];
  checkpoints: { id: string; name: string; gateCode?: string }[];
  isExporting?: boolean;
}

const DATE_PRESETS = [
  { id: 'ALL', label: 'All Time' },
  { id: 'TODAY', label: 'Today' },
  { id: 'YESTERDAY', label: 'Yesterday' },
  { id: 'LAST_7_DAYS', label: 'Last 7 Days' },
  { id: 'LAST_30_DAYS', label: 'Last 30 Days' },
  { id: 'THIS_MONTH', label: 'This Month' },
  { id: 'PREVIOUS_MONTH', label: 'Previous Month' },
  { id: 'CUSTOM', label: 'Custom Range' },
];

const STATUS_OPTIONS = [
  { id: 'ALL', label: 'All Statuses' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'IN_PROGRESS', label: 'In Progress' },
  { id: 'PAUSED', label: 'Paused' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

export default function AdvancedFilterPanel({
  filters,
  onFilterChange,
  onReset,
  onExportCsv,
  onPrint,
  employees,
  sites,
  checkpoints,
  isExporting = false,
}: AdvancedFilterPanelProps) {
  return (
    <div className="glass-card" style={{ padding: '24px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Bar: Title & Primary Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Filter size={20} style={{ color: 'var(--primary)' }} />
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Advanced Report Filters</h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={onReset}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', padding: '8px 14px', gap: '6px' }}
          >
            <RefreshCw size={14} />
            <span>Reset Filters</span>
          </button>
          <button
            type="button"
            onClick={onExportCsv}
            disabled={isExporting}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', padding: '8px 14px', gap: '6px' }}
          >
            <Download size={14} />
            <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="btn btn-primary"
            style={{ fontSize: '0.85rem', padding: '8px 16px', gap: '6px' }}
          >
            <Printer size={14} />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Date Preset Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: '6px' }}>
          Date Range:
        </span>
        {DATE_PRESETS.map((preset) => {
          const isSel = filters.datePreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onFilterChange({ datePreset: preset.id })}
              style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: '20px',
                border: isSel ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                backgroundColor: isSel ? 'rgba(59, 130, 246, 0.15)' : 'var(--surface-color)',
                color: isSel ? 'var(--primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Custom Date Range Inputs */}
      {filters.datePreset === 'CUSTOM' && (
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', backgroundColor: 'var(--surface-color)', padding: '12px 16px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Start Date:</span>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => onFilterChange({ startDate: e.target.value })}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-color)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>End Date:</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => onFilterChange({ endDate: e.target.value })}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-color)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            />
          </div>
        </div>
      )}

      {/* Filter Options Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {/* Global Search */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Search Logs</label>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search guard, site, code..."
              value={filters.search}
              onChange={(e) => onFilterChange({ search: e.target.value })}
              style={{
                width: '100%',
                paddingLeft: '36px',
                paddingRight: '12px',
                paddingTop: '8px',
                paddingBottom: '8px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-color)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            />
          </div>
        </div>

        {/* Security Officer Select */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Security Officer</label>
          <select
            value={filters.employeeId}
            onChange={(e) => onFilterChange({ employeeId: e.target.value })}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-color)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          >
            <option value="">All Security Officers</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.firstName} {emp.lastName}
              </option>
            ))}
          </select>
        </div>

        {/* Monitored Site Select */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Monitored Site</label>
          <select
            value={filters.siteId}
            onChange={(e) => onFilterChange({ siteId: e.target.value, gateId: '' })}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-color)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          >
            <option value="">All Monitored Sites</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </div>

        {/* Checkpoint / Gate Select */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Checkpoint / Gate
          </label>
          <select
            value={filters.gateId}
            onChange={(e) => onFilterChange({ gateId: e.target.value })}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-color)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          >
            <option value="">
              {filters.siteId ? 'All Checkpoints in Site' : 'All Checkpoints'}
            </option>
            {checkpoints.map((gate) => (
              <option key={gate.id} value={gate.id}>
                {gate.name} {gate.gateCode ? `(${gate.gateCode})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Status Select */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Inspection Status</label>
          <select
            value={filters.status}
            onChange={(e) => onFilterChange({ status: e.target.value })}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-color)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
