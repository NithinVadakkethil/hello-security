'use client';

import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  ChevronDown,
  ChevronUp,
  Cog,
  Droplets,
  HelpCircle,
  LifeBuoy,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  UserCog,
  Wrench,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../../../lib/axios';

export interface RoleStyle {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
}

const ROLE_PRESENTATION_MAP: Record<string, RoleStyle> = {
  SECURITY: {
    id: 'SECURITY',
    label: 'Security Guard',
    icon: ShieldCheck,
    color: '#2563eb',
    bg: 'rgba(37, 99, 235, 0.08)',
    border: 'rgba(37, 99, 235, 0.2)',
  },
  TECHNICIAN: {
    id: 'TECHNICIAN',
    label: 'Technician',
    icon: Wrench,
    color: '#d97706',
    bg: 'rgba(217, 119, 6, 0.08)',
    border: 'rgba(217, 119, 6, 0.2)',
  },
  CLEANER: {
    id: 'CLEANER',
    label: 'House Keeping',
    icon: Sparkles,
    color: '#059669',
    bg: 'rgba(5, 150, 105, 0.08)',
    border: 'rgba(5, 150, 105, 0.2)',
  },
  SUPERVISOR: {
    id: 'SUPERVISOR',
    label: 'Supervisor',
    icon: UserCheck,
    color: '#7c3aed',
    bg: 'rgba(124, 58, 237, 0.08)',
    border: 'rgba(124, 58, 237, 0.2)',
  },
  MANAGER: {
    id: 'MANAGER',
    label: 'Manager',
    icon: Briefcase,
    color: '#475569',
    bg: 'rgba(71, 85, 105, 0.08)',
    border: 'rgba(71, 85, 105, 0.2)',
  },
  SERVICE_ENGINEER: {
    id: 'SERVICE_ENGINEER',
    label: 'Service Engineer',
    icon: Cog,
    color: '#0891b2',
    bg: 'rgba(8, 145, 178, 0.08)',
    border: 'rgba(8, 145, 178, 0.2)',
  },
  LIFE_GUARD: {
    id: 'LIFE_GUARD',
    label: 'Life Guard',
    icon: LifeBuoy,
    color: '#e11d48',
    bg: 'rgba(225, 29, 72, 0.08)',
    border: 'rgba(225, 29, 72, 0.2)',
  },
  PLUMBER: {
    id: 'PLUMBER',
    label: 'Plumber',
    icon: Droplets,
    color: '#0284c7',
    bg: 'rgba(2, 132, 199, 0.08)',
    border: 'rgba(2, 132, 199, 0.2)',
  },
};

const SUPPORTED_ROLES = Object.values(ROLE_PRESENTATION_MAP);

export interface MasterItemState {
  id?: string;
  taskName: string;
  description: string;
  isRequired: boolean;
  isActive: boolean;
}

export interface MasterDataState {
  id?: string;
  role: string;
  name: string;
  description: string;
  items: MasterItemState[];
}

export default function SubtaskMasterSettings() {
  const [selectedRole, setSelectedRole] = useState('SECURITY');
  const [mastersMap, setMastersMap] = useState<Record<string, MasterDataState>>({});
  const [currentItems, setCurrentItems] = useState<MasterItemState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchMasters = async () => {
    setIsLoading(true);
    try {
      const res: any = await apiClient.get('/client/subtask-masters');
      if (res.success && Array.isArray(res.data)) {
        const map: Record<string, MasterDataState> = {};
        res.data.forEach((m: any) => {
          map[m.role] = {
            id: m.id,
            role: m.role,
            name: m.name || `${m.role} Master`,
            description: m.description || '',
            items: (m.items || []).map((i: any) => ({
              id: i.id,
              taskName: i.taskName,
              description: i.description || '',
              isRequired: i.isRequired ?? true,
              isActive: i.isActive ?? true,
            })),
          };
        });
        setMastersMap(map);
      }
    } catch (err: any) {
      console.error('Failed to load subtask masters:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMasters();
  }, []);

  useEffect(() => {
    const existing = mastersMap[selectedRole];
    if (existing && existing.items) {
      setCurrentItems(existing.items);
    } else {
      setCurrentItems([]);
    }
  }, [selectedRole, mastersMap]);

  const handleAddItem = () => {
    setCurrentItems([
      ...currentItems,
      {
        taskName: '',
        description: '',
        isRequired: true,
        isActive: true,
      },
    ]);
  };

  const handleUpdateItem = (index: number, field: keyof MasterItemState, value: any) => {
    const updated = [...currentItems];
    updated[index] = { ...updated[index], [field]: value };
    setCurrentItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setCurrentItems(currentItems.filter((_, idx) => idx !== index));
  };

  const handleMoveItem = (index: number, direction: 'UP' | 'DOWN') => {
    if (
      (direction === 'UP' && index === 0) ||
      (direction === 'DOWN' && index === currentItems.length - 1)
    ) {
      return;
    }
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    const updated = [...currentItems];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setCurrentItems(updated);
  };

  const handleSaveMaster = async () => {
    const cleanItems = currentItems
      .filter((i) => i.taskName.trim().length > 0)
      .map((item, idx) => ({
        taskName: item.taskName.trim(),
        description: item.description.trim() || undefined,
        displayOrder: idx + 1,
        isRequired: item.isRequired,
        isActive: item.isActive,
      }));

    if (cleanItems.length === 0 && currentItems.length > 0) {
      toast.error('Please fill in at least one valid subtask title.');
      return;
    }

    setIsSaving(true);
    try {
      const res: any = await apiClient.post('/client/subtask-masters', {
        role: selectedRole,
        name: `${selectedRole} Master`,
        items: cleanItems,
      });

      if (res.success) {
        toast.success(`Role master for ${ROLE_PRESENTATION_MAP[selectedRole]?.label || selectedRole} saved successfully.`);
        await fetchMasters();
      } else {
        toast.error(res.error?.message || 'Failed to save master.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Error saving subtask master.');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedRoleStyle = ROLE_PRESENTATION_MAP[selectedRole] || {
    id: selectedRole,
    label: selectedRole,
    icon: UserCog,
    color: 'var(--primary)',
    bg: 'var(--bg-secondary)',
    border: 'var(--border-color)',
  };

  const SelectedIcon = selectedRoleStyle.icon;

  return (
    <div className="glass-card" style={{ padding: '24px' }}>
      {/* Title & Description */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          paddingBottom: '14px',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div>
          <h3
            style={{
              fontWeight: 700,
              fontSize: '1.1rem',
              margin: '0 0 4px 0',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <ShieldCheck size={20} className="text-primary" />
            <span>ROLE-WISE SUBTASK MASTER</span>
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
            Create reusable inspection checklists for each employee role and bulk-apply them to site checkpoints
          </p>
        </div>
      </div>

      {/* Role Selector Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '12px',
          marginBottom: '20px',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        {SUPPORTED_ROLES.map((r) => {
          const isSelected = selectedRole === r.id;
          const master = mastersMap[r.id];
          const taskCount = (master?.items || []).length;
          const RoleIcon = r.icon;

          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedRole(r.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '0.83rem',
                fontWeight: isSelected ? 600 : 500,
                background: isSelected ? r.bg : 'var(--bg-secondary)',
                color: isSelected ? r.color : 'var(--text-muted)',
                border: isSelected ? `1.5px solid ${r.border}` : '1px solid var(--border-color)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <RoleIcon size={16} style={{ color: isSelected ? r.color : 'var(--text-muted)' }} />
              <span>{r.label}</span>
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: taskCount > 0 ? (isSelected ? r.color : 'var(--text-muted)') : 'transparent',
                  color: taskCount > 0 ? '#ffffff' : 'var(--text-muted)',
                  border: taskCount > 0 ? 'none' : '1px solid var(--border-color)',
                  fontWeight: 600,
                }}
              >
                {taskCount > 0 ? `${taskCount} tasks` : 'Empty'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Role Header & Actions */}
      {isLoading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Loading role-wise subtask master checklists...
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
          marginBottom: '16px',
          background: selectedRoleStyle.bg,
          border: `1px solid ${selectedRoleStyle.border}`,
          padding: '14px 18px',
          borderRadius: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <SelectedIcon size={22} style={{ color: selectedRoleStyle.color }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              {selectedRoleStyle.label} Master Checklist
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {currentItems.length} inspection subtask{currentItems.length !== 1 ? 's' : ''} configured
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleAddItem}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '6px 12px', height: '34px', gap: '6px' }}
          >
            <Plus size={15} />
            <span>Add Task</span>
          </button>

          <button
            type="button"
            onClick={handleSaveMaster}
            disabled={isSaving}
            className="btn btn-primary"
            style={{ fontSize: '0.8rem', padding: '6px 16px', height: '34px', gap: '6px' }}
          >
            <Save size={15} />
            <span>{isSaving ? 'Saving...' : 'Save Master'}</span>
          </button>
        </div>
      </div>

      {/* Task Items List */}
      {currentItems.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '36px 16px',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px dashed var(--border-color)',
            color: 'var(--text-muted)',
          }}
        >
          <HelpCircle size={28} style={{ marginBottom: '8px', opacity: 0.6 }} />
          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
            No master subtasks configured for {selectedRoleStyle.label}
          </div>
          <p style={{ fontSize: '0.8rem', margin: '0 0 16px 0', color: 'var(--text-muted)' }}>
            Click "Add Task" to start creating reusable checklist items for this role.
          </p>
          <button
            type="button"
            onClick={handleAddItem}
            className="btn btn-primary"
            style={{ fontSize: '0.8rem', padding: '6px 16px' }}
          >
            <Plus size={14} style={{ marginRight: '6px' }} />
            Add First Master Task
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {currentItems.map((item, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
              }}
            >
              {/* Order index badge */}
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  flexShrink: 0,
                }}
              >
                {index + 1}
              </div>

              {/* Task name & description input fields */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <input
                  type="text"
                  placeholder="Task title (e.g. Doors are closed and cleaned)"
                  value={item.taskName}
                  onChange={(e) => handleUpdateItem(index, 'taskName', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--card-bg)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                />
                <input
                  type="text"
                  placeholder="Optional instruction or description..."
                  value={item.description}
                  onChange={(e) => handleUpdateItem(index, 'description', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--card-bg)',
                    color: 'var(--text-muted)',
                    fontSize: '0.78rem',
                  }}
                />
              </div>

              {/* Toggles: Required & Active */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.78rem',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={item.isRequired}
                    onChange={(e) => handleUpdateItem(index, 'isRequired', e.target.checked)}
                  />
                  <span>Required</span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.78rem',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={item.isActive}
                    onChange={(e) => handleUpdateItem(index, 'isActive', e.target.checked)}
                  />
                  <span>Active</span>
                </label>
              </div>

              {/* Reorder & Remove Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => handleMoveItem(index, 'UP')}
                  disabled={index === 0}
                  style={{
                    padding: '4px',
                    background: 'transparent',
                    border: 'none',
                    color: index === 0 ? 'var(--border-color)' : 'var(--text-muted)',
                    cursor: index === 0 ? 'default' : 'pointer',
                  }}
                  title="Move Up"
                >
                  <ChevronUp size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => handleMoveItem(index, 'DOWN')}
                  disabled={index === currentItems.length - 1}
                  style={{
                    padding: '4px',
                    background: 'transparent',
                    border: 'none',
                    color: index === currentItems.length - 1 ? 'var(--border-color)' : 'var(--text-muted)',
                    cursor: index === currentItems.length - 1 ? 'default' : 'pointer',
                  }}
                  title="Move Down"
                >
                  <ChevronDown size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  style={{
                    padding: '4px',
                    background: 'transparent',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    marginLeft: '4px',
                  }}
                  title="Delete Task"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );
}
