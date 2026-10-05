'use client';

import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  ChevronDown,
  ChevronUp,
  Cog,
  Droplets,
  FolderTree,
  Layers,
  LifeBuoy,
  MapPin,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  UserCog,
  Wrench,
  X,
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

interface CategorySubTask {
  id?: string;
  role: string;
  taskName: string;
  description?: string;
  displayOrder: number;
  isRequired: boolean;
  isActive: boolean;
}

interface CheckpointCategorySummary {
  id: string;
  clientId: string;
  name: string;
  normalizedName: string;
  description?: string | null;
  checkpointsCount: number;
  subTasksCount: number;
  subTasksByRole: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

interface CheckpointCategoryDetail {
  id: string;
  clientId: string;
  name: string;
  normalizedName: string;
  description?: string | null;
  gates: Array<{
    id: string;
    name: string;
    gateCode: string;
    description: string;
    sequence: number;
    site?: { id: string; name: string };
  }>;
  subTasks: CategorySubTask[];
  _count: {
    gates: number;
    subTasks: number;
  };
}

export default function CheckpointCategorySettings() {
  const [categories, setCategories] = useState<CheckpointCategorySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Selected Category for Details & Subtasks management
  const [selectedCategory, setSelectedCategory] = useState<CheckpointCategoryDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [selectedRole, setSelectedRole] = useState('SECURITY');
  const [currentSubTasks, setCurrentSubTasks] = useState<CategorySubTask[]>([]);
  const [isSavingSubTasks, setIsSavingSubTasks] = useState(false);

  // Category Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CheckpointCategorySummary | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [isSubmittingModal, setIsSubmittingModal] = useState(false);

  // Delete Category Confirmation Modal State
  const [deletingCategory, setDeletingCategory] = useState<CheckpointCategorySummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const res: any = await apiClient.get('/checkpoint-categories');
      if (res.success && res.data) {
        setCategories(res.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to load checkpoint categories.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategoryDetail = async (categoryId: string) => {
    setIsLoadingDetail(true);
    try {
      const res: any = await apiClient.get(`/checkpoint-categories/${categoryId}`);
      if (res.success && res.data) {
        setSelectedCategory(res.data);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to load category details.');
      setSelectedCategory(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Update currentSubTasks when selectedCategory or selectedRole changes
  useEffect(() => {
    if (selectedCategory) {
      const roleTasks = (selectedCategory.subTasks || [])
        .filter((st) => st.role === selectedRole)
        .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      setCurrentSubTasks(roleTasks);
    } else {
      setCurrentSubTasks([]);
    }
  }, [selectedCategory, selectedRole]);

  // Modal Handlers
  const handleOpenCreateModal = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryDescription('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cat: CheckpointCategorySummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setCategoryDescription(cat.description || '');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setCategoryName('');
    setCategoryDescription('');
  };

  const handleSubmitCategoryModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = categoryName.trim();
    if (!trimmed) {
      toast.error('Please enter a valid category name.');
      return;
    }

    setIsSubmittingModal(true);
    try {
      if (editingCategory) {
        const res: any = await apiClient.patch(`/checkpoint-categories/${editingCategory.id}`, {
          name: trimmed,
          description: categoryDescription.trim() || null,
        });
        if (res.success) {
          toast.success(`Category "${trimmed}" updated successfully.`);
          handleCloseModal();
          await fetchCategories();
          if (selectedCategory && selectedCategory.id === editingCategory.id) {
            await fetchCategoryDetail(editingCategory.id);
          }
        }
      } else {
        const res: any = await apiClient.post('/checkpoint-categories', {
          name: trimmed,
          description: categoryDescription.trim() || null,
        });
        if (res.success) {
          toast.success(`Category "${trimmed}" created successfully.`);
          handleCloseModal();
          await fetchCategories();
          if (res.data?.id) {
            await fetchCategoryDetail(res.data.id);
          }
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Error saving checkpoint category.');
    } finally {
      setIsSubmittingModal(false);
    }
  };

  // Delete Category Handlers
  const handleOpenDeleteModal = (cat: CheckpointCategorySummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingCategory(cat);
  };

  const handleConfirmDelete = async () => {
    if (!deletingCategory) return;
    if (deletingCategory.checkpointsCount > 0) {
      toast.error(
        `This category is currently assigned to ${deletingCategory.checkpointsCount} checkpoint(s). Reassign those checkpoints before deleting it.`
      );
      return;
    }

    setIsDeleting(true);
    try {
      const res: any = await apiClient.delete(`/checkpoint-categories/${deletingCategory.id}`);
      if (res.success) {
        toast.success(`Category "${deletingCategory.name}" deleted successfully.`);
        setDeletingCategory(null);
        if (selectedCategory && selectedCategory.id === deletingCategory.id) {
          setSelectedCategory(null);
        }
        await fetchCategories();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Error deleting category.');
    } finally {
      setIsDeleting(false);
    }
  };

  // SubTasks Editor Handlers
  const handleAddSubTaskRow = () => {
    const nextOrder = currentSubTasks.length + 1;
    setCurrentSubTasks([
      ...currentSubTasks,
      {
        role: selectedRole,
        taskName: '',
        description: '',
        displayOrder: nextOrder,
        isRequired: true,
        isActive: true,
      },
    ]);
  };

  const handleUpdateSubTaskField = (index: number, field: keyof CategorySubTask, value: any) => {
    const updated = [...currentSubTasks];
    updated[index] = { ...updated[index], [field]: value };
    setCurrentSubTasks(updated);
  };

  const handleRemoveSubTaskRow = (index: number) => {
    const updated = currentSubTasks.filter((_, idx) => idx !== index);
    const reordered = updated.map((item, idx) => ({
      ...item,
      displayOrder: idx + 1,
    }));
    setCurrentSubTasks(reordered);
  };

  const handleMoveSubTask = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= currentSubTasks.length) return;

    const updated = [...currentSubTasks];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;

    const reordered = updated.map((item, idx) => ({
      ...item,
      displayOrder: idx + 1,
    }));
    setCurrentSubTasks(reordered);
  };

  const handleSaveRoleSubTasks = async () => {
    if (!selectedCategory) return;

    const validTasks = currentSubTasks.filter((t) => t.taskName.trim().length > 0);

    setIsSavingSubTasks(true);
    try {
      // Find existing tasks for this role from server detail
      const existingRoleTasks = (selectedCategory.subTasks || []).filter((st) => st.role === selectedRole);
      const existingIds = new Set(existingRoleTasks.map((t) => t.id).filter(Boolean));
      const submittedIds = new Set(validTasks.map((t) => t.id).filter(Boolean));

      // 1. Delete tasks that were removed
      for (const oldTask of existingRoleTasks) {
        if (oldTask.id && !submittedIds.has(oldTask.id)) {
          await apiClient.delete(`/checkpoint-categories/${selectedCategory.id}/sub-tasks/${oldTask.id}`);
        }
      }

      // 2. Create or update tasks
      for (let i = 0; i < validTasks.length; i++) {
        const task = validTasks[i];
        const payload = {
          role: selectedRole as any,
          taskName: task.taskName.trim(),
          description: task.description?.trim() || null,
          displayOrder: i + 1,
          isRequired: task.isRequired,
          isActive: task.isActive,
        };

        if (task.id && existingIds.has(task.id)) {
          await apiClient.patch(
            `/checkpoint-categories/${selectedCategory.id}/sub-tasks/${task.id}`,
            payload
          );
        } else {
          await apiClient.post(
            `/checkpoint-categories/${selectedCategory.id}/sub-tasks`,
            payload
          );
        }
      }

      const roleLabel = ROLE_PRESENTATION_MAP[selectedRole]?.label || selectedRole;
      toast.success(`Subtasks for "${roleLabel}" saved successfully.`);
      await fetchCategoryDetail(selectedCategory.id);
      await fetchCategories();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to save category subtasks.');
    } finally {
      setIsSavingSubTasks(false);
    }
  };

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
      {/* SECTION HEADER */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px',
          paddingBottom: '16px',
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
            <FolderTree size={20} className="text-primary" />
            <span>CHECKPOINT CATEGORIES / UTILITIES</span>
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
            Configure master checkpoint categories (e.g. Garbage Room, Electrical Room, Fire Safety) with role-based subtasks inherited across all matching checkpoints.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.84rem',
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: 600,
          }}
        >
          <Plus size={16} />
          <span>Create New Category</span>
        </button>
      </div>

      {/* VIEW: CATEGORY DETAILS & ROLE SUBTASKS */}
      {isLoadingDetail ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Loading category details...
        </div>
      ) : selectedCategory ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Back bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-secondary)',
              padding: '12px 16px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'rgba(37, 99, 235, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                }}
              >
                <Layers size={18} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {selectedCategory.name}
                  </h4>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: 'rgba(37, 99, 235, 0.1)',
                      color: 'var(--primary)',
                      fontWeight: 600,
                    }}
                  >
                    {selectedCategory._count.gates} Checkpoint(s) Inheriting
                  </span>
                </div>
                {selectedCategory.description && (
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {selectedCategory.description}
                  </p>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={(e) => handleOpenEditModal(selectedCategory as any, e)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  borderRadius: '6px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                <Pencil size={14} />
                <span>Rename</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  fontSize: '0.8rem',
                  borderRadius: '6px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                <X size={15} />
                <span>Back to Categories</span>
              </button>
            </div>
          </div>

          {/* Assigned Checkpoints Pill strip */}
          {selectedCategory.gates && selectedCategory.gates.length > 0 && (
            <div
              style={{
                padding: '10px 14px',
                background: 'rgba(37, 99, 235, 0.04)',
                border: '1px dashed rgba(37, 99, 235, 0.25)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Assigned Checkpoints:
              </span>
              {selectedCategory.gates.map((g) => (
                <span
                  key={g.id}
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <MapPin size={11} className="text-primary" />
                  <span>{g.name} ({g.description})</span>
                </span>
              ))}
            </div>
          )}

          {/* Role Tabs */}
          <div>
            <div
              style={{
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Select Employee Role:
            </div>
            <div
              style={{
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                paddingBottom: '8px',
              }}
            >
              {SUPPORTED_ROLES.map((r) => {
                const isSelected = selectedRole === r.id;
                const roleTaskCount = (selectedCategory.subTasks || []).filter((st) => st.role === r.id).length;
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
                        background: roleTaskCount > 0 ? (isSelected ? r.color : 'var(--text-muted)') : 'transparent',
                        color: roleTaskCount > 0 ? '#ffffff' : 'var(--text-muted)',
                        border: roleTaskCount > 0 ? 'none' : '1px solid var(--border-color)',
                        fontWeight: 600,
                      }}
                    >
                      {roleTaskCount > 0 ? `${roleTaskCount} tasks` : '0'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Role Subtask Checklist Container */}
          <div
            style={{
              border: `1.5px solid ${selectedRoleStyle.border}`,
              borderRadius: '12px',
              padding: '20px',
              background: selectedRoleStyle.bg,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <SelectedIcon size={20} style={{ color: selectedRoleStyle.color }} />
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {selectedRoleStyle.label} Subtasks for &quot;{selectedCategory.name}&quot;
                </h4>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleAddSubTaskRow}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    fontSize: '0.82rem',
                    borderRadius: '6px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={15} className="text-primary" />
                  <span>Add Subtask</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveRoleSubTasks}
                  disabled={isSavingSubTasks}
                  className="btn-primary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 16px',
                    fontSize: '0.82rem',
                    borderRadius: '6px',
                    fontWeight: 600,
                  }}
                >
                  <Save size={15} />
                  <span>{isSavingSubTasks ? 'Saving...' : 'Save Role Subtasks'}</span>
                </button>
              </div>
            </div>

            {/* Checklist Table / Rows */}
            {currentSubTasks.length === 0 ? (
              <div
                style={{
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: 'var(--bg-primary)',
                  borderRadius: '8px',
                  border: '1px dashed var(--border-color)',
                }}
              >
                <p style={{ margin: '0 0 12px 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  No subtasks configured for <strong>{selectedRoleStyle.label}</strong> under this category.
                </p>
                <button
                  type="button"
                  onClick={handleAddSubTaskRow}
                  className="btn-primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    fontSize: '0.82rem',
                    borderRadius: '6px',
                    fontWeight: 600,
                  }}
                >
                  <Plus size={15} />
                  <span>+ Add Subtask</span>
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {currentSubTasks.map((task, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      background: 'var(--bg-primary)',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    {/* Index & Reorder */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <button
                        type="button"
                        onClick={() => handleMoveSubTask(idx, 'up')}
                        disabled={idx === 0}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: idx === 0 ? 'not-allowed' : 'pointer',
                          opacity: idx === 0 ? 0.3 : 0.8,
                          padding: 0,
                          color: 'var(--text-primary)',
                        }}
                      >
                        <ChevronUp size={14} />
                      </button>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                        #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleMoveSubTask(idx, 'down')}
                        disabled={idx === currentSubTasks.length - 1}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: idx === currentSubTasks.length - 1 ? 'not-allowed' : 'pointer',
                          opacity: idx === currentSubTasks.length - 1 ? 0.3 : 0.8,
                          padding: 0,
                          color: 'var(--text-primary)',
                        }}
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>

                    {/* Inputs */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <input
                        type="text"
                        placeholder="Subtask Title (e.g. Check garbage room door, verify bins)..."
                        value={task.taskName}
                        onChange={(e) => handleUpdateSubTaskField(idx, 'taskName', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          fontSize: '0.86rem',
                          fontWeight: 500,
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Optional Instructions / Description..."
                        value={task.description || ''}
                        onChange={(e) => handleUpdateSubTaskField(idx, 'description', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-muted)',
                          fontSize: '0.78rem',
                        }}
                      />
                    </div>

                    {/* Required Checkbox */}
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: task.isRequired ? 'var(--primary)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={task.isRequired}
                        onChange={(e) => handleUpdateSubTaskField(idx, 'isRequired', e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span>Mandatory</span>
                    </label>

                    {/* Delete Row Button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveSubTaskRow(idx)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.8,
                      }}
                      title="Remove subtask"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* VIEW: CATEGORIES GRID / TABLE */
        <div>
          {/* Search bar & Stats */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ position: 'relative', width: '300px', maxWidth: '100%' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 32px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.84rem',
                }}
              />
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Total Master Categories: <strong>{categories.length}</strong>
            </div>
          </div>

          {isLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Loading checkpoint categories...
            </div>
          ) : filteredCategories.length === 0 ? (
            <div
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                background: 'var(--bg-secondary)',
                borderRadius: '10px',
                border: '1px dashed var(--border-color)',
              }}
            >
              <FolderTree size={36} className="text-muted" style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
              <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: 'var(--text-primary)' }}>
                No Checkpoint Categories Found
              </h4>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {searchTerm ? 'No categories matched your search term.' : 'Get started by creating your first reusable category.'}
              </p>
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  fontSize: '0.84rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                }}
              >
                <Plus size={16} />
                <span>+ Create New Category</span>
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '16px',
              }}
            >
              {filteredCategories.map((cat) => (
                <div
                  key={cat.id}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '14px',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            background: 'rgba(37, 99, 235, 0.1)',
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Layers size={16} />
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {cat.name}
                          </h4>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {cat.checkpointsCount} checkpoint{cat.checkpointsCount === 1 ? '' : 's'} assigned
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={(e) => handleOpenEditModal(cat, e)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                          }}
                          title="Edit Category Name"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleOpenDeleteModal(cat, e)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: cat.checkpointsCount > 0 ? 'var(--text-muted)' : '#ef4444',
                            cursor: cat.checkpointsCount > 0 ? 'not-allowed' : 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            opacity: cat.checkpointsCount > 0 ? 0.4 : 0.8,
                          }}
                          title={cat.checkpointsCount > 0 ? 'Cannot delete category with assigned checkpoints' : 'Delete Category'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {cat.description && (
                      <p
                        style={{
                          margin: '10px 0 0 0',
                          fontSize: '0.8rem',
                          color: 'var(--text-muted)',
                          lineHeight: '1.4',
                        }}
                      >
                        {cat.description}
                      </p>
                    )}

                    {/* Role subtasks badges */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
                      {Object.entries(cat.subTasksByRole || {}).map(([roleKey, count]) => {
                        const rStyle = ROLE_PRESENTATION_MAP[roleKey];
                        if (!rStyle || count === 0) return null;
                        return (
                          <span
                            key={roleKey}
                            style={{
                              fontSize: '0.72rem',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              background: rStyle.bg,
                              color: rStyle.color,
                              border: `1px solid ${rStyle.border}`,
                              fontWeight: 600,
                            }}
                          >
                            {rStyle.label}: {count}
                          </span>
                        );
                      })}
                      {cat.subTasksCount === 0 && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          No subtasks configured yet
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => fetchCategoryDetail(cat.id)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '6px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--primary)',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <span>View & Manage Role Subtasks</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT CATEGORY MODAL */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              background: 'var(--bg-primary)',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
                paddingBottom: '12px',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {editingCategory ? 'Edit Checkpoint Category' : 'Create New Category / Utility'}
              </h3>
              <button
                type="button"
                onClick={handleCloseModal}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitCategoryModal} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '6px',
                  }}
                >
                  Category Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Garbage Room, Electrical Room, Fire Safety, Swimming Pool..."
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  required
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '6px',
                  }}
                >
                  Description (Optional)
                </label>
                <textarea
                  placeholder="Brief description of the utility / area..."
                  value={categoryDescription}
                  onChange={(e) => setCategoryDescription(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.84rem',
                    resize: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-muted)',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingModal}
                  className="btn-primary"
                  style={{
                    padding: '8px 18px',
                    borderRadius: '6px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                  }}
                >
                  {isSubmittingModal ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingCategory && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '440px',
              padding: '24px',
              background: 'var(--bg-primary)',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            }}
          >
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Delete Category &quot;{deletingCategory.name}&quot;?
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0 0 20px 0', lineHeight: 1.5 }}>
              Are you sure you want to delete this master category? Its configured subtasks will also be removed. This action cannot be undone.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeletingCategory(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  background: '#ef4444',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
