'use client';

import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Cog,
  Droplets,
  Eye,
  FileCheck,
  LifeBuoy,
  Play,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Wrench,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../../../lib/axios';

export interface ApplySubtaskMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteId: string;
  siteName: string;
  checkpointCount: number;
  onSuccess?: () => void;
}

const ROLE_PRESENTATION_MAP: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  SECURITY: { label: 'Security Guard', icon: ShieldCheck, color: '#2563eb' },
  TECHNICIAN: { label: 'Technician', icon: Wrench, color: '#d97706' },
  CLEANER: { label: 'House Keeping', icon: Sparkles, color: '#059669' },
  SUPERVISOR: { label: 'Supervisor', icon: UserCheck, color: '#7c3aed' },
  MANAGER: { label: 'Manager', icon: Briefcase, color: '#475569' },
  SERVICE_ENGINEER: { label: 'Service Engineer', icon: Cog, color: '#0891b2' },
  LIFE_GUARD: { label: 'Life Guard', icon: LifeBuoy, color: '#e11d48' },
  PLUMBER: { label: 'Plumber', icon: Droplets, color: '#0284c7' },
};

const ALL_ROLES = Object.keys(ROLE_PRESENTATION_MAP);

export default function ApplySubtaskMasterModal({
  isOpen,
  onClose,
  siteId,
  siteName,
  checkpointCount,
  onSuccess,
}: ApplySubtaskMasterModalProps) {
  const [mastersMap, setMastersMap] = useState<Record<string, { id: string; itemCount: number }>>({});
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [executionResult, setExecutionResult] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchClientMasters();
    } else {
      setSelectedRoles([]);
      setPreviewData(null);
      setExecutionResult(null);
    }
  }, [isOpen]);

  const fetchClientMasters = async () => {
    try {
      const res: any = await apiClient.get('/client/subtask-masters');
      if (res.success && Array.isArray(res.data)) {
        const map: Record<string, { id: string; itemCount: number }> = {};
        const availableRoles: string[] = [];

        res.data.forEach((m: any) => {
          const activeCount = (m.items || []).filter((i: any) => i.isActive).length;
          map[m.role] = { id: m.id, itemCount: activeCount };
          if (activeCount > 0) {
            availableRoles.push(m.role);
          }
        });
        setMastersMap(map);
        setSelectedRoles(availableRoles);
      }
    } catch (err: any) {
      console.error('Failed to load client subtask masters:', err);
    }
  };

  const handleToggleRole = (role: string) => {
    setPreviewData(null);
    if (selectedRoles.includes(role)) {
      setSelectedRoles(selectedRoles.filter((r) => r !== role));
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  const handleSelectAll = () => {
    setPreviewData(null);
    const configured = ALL_ROLES.filter((r) => (mastersMap[r]?.itemCount || 0) > 0);
    setSelectedRoles(configured.length > 0 ? configured : ALL_ROLES);
  };

  const handleClearAll = () => {
    setPreviewData(null);
    setSelectedRoles([]);
  };

  const handlePreview = async () => {
    if (selectedRoles.length === 0) {
      toast.error('Please select at least one role to preview.');
      return;
    }

    setIsPreviewing(true);
    try {
      const res: any = await apiClient.post(`/sites/${siteId}/apply-subtask-master/preview`, {
        roles: selectedRoles,
      });

      if (res.success && res.data) {
        setPreviewData(res.data);
      } else {
        toast.error(res.error?.message || 'Failed to generate apply preview.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Error generating apply preview.');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleApply = async () => {
    if (selectedRoles.length === 0) {
      toast.error('Please select at least one role to apply.');
      return;
    }

    setIsApplying(true);
    try {
      const res: any = await apiClient.post(`/sites/${siteId}/apply-subtask-master`, {
        roles: selectedRoles,
      });

      if (res.success && res.data) {
        setExecutionResult(res.data);
        toast.success(`Subtask master applied successfully! ${res.data.createdTasksCount} new tasks created.`);
        if (onSuccess) onSuccess();
      } else {
        toast.error(res.error?.message || 'Failed to apply subtask master.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Error applying subtask master.');
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0,
          boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileCheck size={22} className="text-primary" />
            <div>
              <h3 style={{ fontWeight: 700, fontSize: '1.1rem', margin: 0, color: 'var(--text-primary)' }}>
                Apply Subtask Master — {siteName}
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Bulk-apply role inspection tasks across all site checkpoints idempotently
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Content */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Site Checkpoints Summary Card */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              background: 'var(--bg-tertiary)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
            }}
          >
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                TARGET SITE
              </span>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                {siteName}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                CHECKPOINTS COUNT
              </span>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary)' }}>
                {checkpointCount} Checkpoint{checkpointCount !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {/* Execution Completion View */}
          {executionResult ? (
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '8px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={24} style={{ color: '#10b981' }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                    Subtask Master Applied Successfully!
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Processed {executionResult.checkpointCount} checkpoints for {siteName}
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  background: 'var(--card-bg)',
                  padding: '14px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>New Tasks Created</span>
                  <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#10b981' }}>
                    +{executionResult.createdTasksCount}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Existing Skipped</span>
                  <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-muted)' }}>
                    {executionResult.skippedTasksCount}
                  </div>
                </div>
              </div>

              {/* Roles Breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Breakdown by Role:
                </span>
                {executionResult.roles.map((r: any) => (
                  <div
                    key={r.role}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.8rem',
                      padding: '4px 8px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '4px',
                    }}
                  >
                    <span>{r.roleDisplay}</span>
                    <span style={{ fontWeight: 600, color: r.createCount > 0 ? '#10b981' : 'var(--text-muted)' }}>
                      {r.createCount} created, {r.skipCount} skipped
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Role Selection Header & Quick Actions */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    Select Roles to Apply:
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--primary)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Select Configured Roles
                    </button>
                    <span style={{ color: 'var(--border-color)' }}>|</span>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Roles Checkboxes List */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                  {ALL_ROLES.map((roleKey) => {
                    const roleInfo = ROLE_PRESENTATION_MAP[roleKey];
                    const isChecked = selectedRoles.includes(roleKey);
                    const master = mastersMap[roleKey];
                    const itemCount = master?.itemCount || 0;
                    const RoleIcon = roleInfo.icon;

                    return (
                      <div
                        key={roleKey}
                        onClick={() => handleToggleRole(roleKey)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          background: isChecked ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                          border: isChecked ? `1.5px solid var(--primary)` : '1px solid var(--border-color)',
                          cursor: 'pointer',
                          userSelect: 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <RoleIcon size={16} style={{ color: roleInfo.color }} />
                          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            {roleInfo.label}
                          </span>
                        </div>

                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: itemCount > 0 ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-secondary)',
                            color: itemCount > 0 ? 'var(--primary)' : 'var(--text-muted)',
                            fontWeight: 600,
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          {itemCount > 0 ? `${itemCount} tasks` : 'No Master'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Preview Summary Box */}
              {previewData && (
                <div
                  style={{
                    background: 'var(--bg-tertiary)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Eye size={16} className="text-primary" />
                    <span>Apply Operation Preview</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'center' }}>
                    <div style={{ padding: '8px', background: 'var(--card-bg)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Target Checkpoints</span>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{previewData.checkpointCount}</div>
                    </div>
                    <div style={{ padding: '8px', background: 'var(--card-bg)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>New Tasks to Create</span>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#10b981' }}>+{previewData.totalCreateCount}</div>
                    </div>
                    <div style={{ padding: '8px', background: 'var(--card-bg)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Duplicates Skipped</span>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-muted)' }}>{previewData.totalSkipCount}</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-secondary)',
          }}
        >
          {executionResult ? (
            <button
              type="button"
              onClick={onClose}
              className="btn btn-primary"
              style={{ width: '100%', padding: '8px 16px', height: '38px' }}
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handlePreview}
                disabled={isPreviewing || isApplying || selectedRoles.length === 0}
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', padding: '6px 14px', height: '36px', gap: '6px' }}
              >
                <Eye size={15} />
                <span>{isPreviewing ? 'Calculating...' : 'Preview'}</span>
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '6px 14px', height: '36px' }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleApply}
                  disabled={isApplying || selectedRoles.length === 0}
                  className="btn btn-primary"
                  style={{ fontSize: '0.82rem', padding: '6px 18px', height: '36px', gap: '6px' }}
                >
                  <Play size={15} />
                  <span>
                    {isApplying
                      ? `Applying tasks to ${checkpointCount} checkpoints...`
                      : 'Apply to All Checkpoints'}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
