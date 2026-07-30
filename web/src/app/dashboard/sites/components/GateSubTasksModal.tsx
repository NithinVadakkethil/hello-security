'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Edit2, Trash2, ArrowUp, ArrowDown, CheckSquare, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';

import { apiClient } from '../../../lib/axios';
import { ApiResponse } from '../../../types/api';
import Modal from '../../../components/ui/Modal';
import { FormInput, FormTextarea } from '../../../components/ui/FormControls';
import ConfirmationDialog from '../../../components/ui/ConfirmationDialog';

export interface GateSubTask {
  id: string;
  gateId: string;
  taskName: string;
  description?: string | null;
  displayOrder: number;
  isRequired: boolean;
  isActive: boolean;
  createdAt: string;
}

interface GateSubTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  gateId: string;
  gateName: string;
}

const subTaskSchema = z.object({
  taskName: z
    .string()
    .min(1, 'Task name is required')
    .max(100, 'Task name cannot exceed 100 characters'),
  description: z.string().max(300, 'Description cannot exceed 300 characters').optional(),
  isRequired: z.boolean(),
  isActive: z.boolean(),
});

type SubTaskValues = z.infer<typeof subTaskSchema>;

export default function GateSubTasksModal({
  isOpen,
  onClose,
  gateId,
  gateName,
}: GateSubTasksModalProps) {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSubTask, setEditingSubTask] = useState<GateSubTask | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    id: string;
    taskName: string;
  }>({
    isOpen: false,
    id: '',
    taskName: '',
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<SubTaskValues>({
    resolver: zodResolver(subTaskSchema),
    defaultValues: {
      isRequired: true,
      isActive: true,
    },
  });

  // Fetch Sub Tasks
  const { data: subTasksRes, isLoading } = useQuery<ApiResponse<GateSubTask[]>>({
    queryKey: ['sub-tasks', gateId],
    queryFn: () => apiClient.get(`/gates/${gateId}/sub-tasks`),
    enabled: isOpen && !!gateId,
  });

  const subTasks = subTasksRes?.data || [];

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (values: SubTaskValues) => apiClient.post(`/gates/${gateId}/sub-tasks`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-tasks', gateId] });
      queryClient.invalidateQueries({ queryKey: ['gates'] });
      toast.success('Sub-task created successfully');
      handleCloseForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create sub-task');
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<SubTaskValues> }) =>
      apiClient.patch(`/gates/${gateId}/sub-tasks/${id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-tasks', gateId] });
      queryClient.invalidateQueries({ queryKey: ['gates'] });
      toast.success('Sub-task updated successfully');
      handleCloseForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update sub-task');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/gates/${gateId}/sub-tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-tasks', gateId] });
      queryClient.invalidateQueries({ queryKey: ['gates'] });
      toast.success('Sub-task deleted successfully');
      setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete sub-task');
      setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
    },
  });

  // Reorder Mutation
  const reorderMutation = useMutation({
    mutationFn: (items: Array<{ id: string; displayOrder: number }>) =>
      apiClient.patch(`/gates/${gateId}/sub-tasks/reorder`, { subTasks: items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-tasks', gateId] });
      queryClient.invalidateQueries({ queryKey: ['gates'] });
      toast.success('Sub-tasks reordered');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to reorder sub-tasks');
    },
  });

  const handleOpenAddForm = () => {
    setEditingSubTask(null);
    reset({
      taskName: '',
      description: '',
      isRequired: true,
      isActive: true,
    });
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (task: GateSubTask) => {
    setEditingSubTask(task);
    setValue('taskName', task.taskName);
    setValue('description', task.description || '');
    setValue('isRequired', task.isRequired);
    setValue('isActive', task.isActive);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingSubTask(null);
    reset();
  };

  const onSubmit = (values: SubTaskValues) => {
    if (editingSubTask) {
      updateMutation.mutate({ id: editingSubTask.id, values });
    } else {
      createMutation.mutate(values);
    }
  };

  const handleMove = (index: number, direction: 'UP' | 'DOWN') => {
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= subTasks.length) return;

    const newTasks = [...subTasks];
    const temp = newTasks[index];
    newTasks[index] = newTasks[targetIndex];
    newTasks[targetIndex] = temp;

    const reorderedItems = newTasks.map((t, idx) => ({
      id: t.id,
      displayOrder: idx,
    }));

    reorderMutation.mutate(reorderedItems);
  };

  const handleToggleActive = (task: GateSubTask) => {
    updateMutation.mutate({
      id: task.id,
      values: { isActive: !task.isActive },
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Checkpoint Verification Sub-Tasks: ${gateName}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: '320px', maxWidth: '680px' }}>
        {/* Top Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Configure mandatory or optional verification questions guards must perform at this checkpoint.
            </span>
          </div>
          {!isFormOpen && (
            <button
              type="button"
              onClick={handleOpenAddForm}
              className="btn btn-primary"
              style={{ padding: '8px 14px', fontSize: '0.85rem', gap: '6px' }}
            >
              <Plus size={16} />
              <span>Add Sub Task</span>
            </button>
          )}
        </div>

        {/* Add / Edit Sub Task Form Drawer */}
        {isFormOpen && (
          <div
            style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: 'var(--surface-color)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
              {editingSubTask ? 'Edit Sub Task' : 'Add New Verification Sub Task'}
            </h4>
            <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <FormInput
                label="Task Question / Title *"
                placeholder="e.g. Is the perimeter gate securely locked?"
                error={errors.taskName?.message}
                {...register('taskName')}
              />
              <FormTextarea
                label="Description / Guard Instructions (Optional)"
                placeholder="e.g. Verify lock mechanism and check for damage"
                error={errors.description?.message}
                {...register('description')}
              />
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="checkbox" {...register('isRequired')} style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }} />
                  <span style={{ fontWeight: 600 }}>Required Answer (Guard cannot skip)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="checkbox" {...register('isActive')} style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }} />
                  <span style={{ fontWeight: 600 }}>Active Status</span>
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button type="button" onClick={handleCloseForm} className="btn btn-secondary" style={{ fontSize: '0.82rem', padding: '6px 14px' }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn btn-primary"
                  style={{ fontSize: '0.82rem', padding: '6px 16px' }}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingSubTask
                    ? 'Update Task'
                    : 'Save Sub Task'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Sub Tasks List */}
        {isLoading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading verification sub tasks...
          </div>
        ) : subTasks.length === 0 ? (
          <div
            style={{
              padding: '36px 20px',
              textAlign: 'center',
              borderRadius: '12px',
              border: '1px dashed var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            <CheckSquare size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 600 }}>No Sub Tasks Created Yet</h4>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Add verification questions to ensure security guards verify critical checkpoints during patrols.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto' }}>
            {subTasks.map((task, idx) => (
              <div
                key={task.id}
                style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  backgroundColor: task.isActive ? 'var(--surface-color)' : 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  opacity: task.isActive ? 1 : 0.65,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                {/* Left reorder controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <button
                    type="button"
                    disabled={idx === 0 || reorderMutation.isPending}
                    onClick={() => handleMove(idx, 'UP')}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: idx === 0 ? 'not-allowed' : 'pointer',
                      opacity: idx === 0 ? 0.3 : 0.8,
                      padding: '2px',
                      color: 'var(--text-primary)',
                    }}
                    title="Move Up"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === subTasks.length - 1 || reorderMutation.isPending}
                    onClick={() => handleMove(idx, 'DOWN')}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: idx === subTasks.length - 1 ? 'not-allowed' : 'pointer',
                      opacity: idx === subTasks.length - 1 ? 0.3 : 0.8,
                      padding: '2px',
                      color: 'var(--text-primary)',
                    }}
                    title="Move Down"
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>

                {/* Sub Task Content */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>#{idx + 1}</span>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{task.taskName}</strong>
                    {task.isRequired ? (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(239, 68, 68, 0.12)',
                          color: '#dc2626',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                        }}
                      >
                        REQUIRED
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        OPTIONAL
                      </span>
                    )}
                  </div>
                  {task.description && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{task.description}</span>
                  )}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(task)}
                    className="btn btn-secondary"
                    style={{
                      padding: '5px 8px',
                      fontSize: '0.75rem',
                      gap: '4px',
                      color: task.isActive ? 'var(--success)' : 'var(--danger)',
                    }}
                    title={task.isActive ? 'Deactivate Sub Task' : 'Activate Sub Task'}
                  >
                    {task.isActive ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                    <span>{task.isActive ? 'Active' : 'Inactive'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEditForm(task)}
                    className="btn btn-secondary"
                    style={{ padding: '5px 8px', fontSize: '0.75rem', gap: '4px' }}
                    title="Edit Sub Task"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm({ isOpen: true, id: task.id, taskName: task.taskName })}
                    className="btn btn-secondary"
                    style={{ padding: '5px 8px', fontSize: '0.75rem', gap: '4px', color: 'var(--danger)' }}
                    title="Delete Sub Task"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '8px 18px', fontSize: '0.85rem' }}>
            Close
          </button>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={() => deleteMutation.mutate(deleteConfirm.id)}
        title="Delete Sub Task"
        description={`Are you sure you want to delete the sub task "${deleteConfirm.taskName}"? This action cannot be undone.`}
        confirmText="Delete"
        isDanger={true}
        isLoading={deleteMutation.isPending}
      />
    </Modal>
  );
}
