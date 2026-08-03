'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tag,
  Plus,
  Trash2,
  FolderPlus,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../../components/ui/Modal';
import { apiClient } from '../../../lib/axios';
import { ApiResponse } from '../../../types/api';

interface SubCategory {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  subCategories: SubCategory[];
  _count?: { snags: number };
}

export default function SnagCategoriesPage() {
  const queryClient = useQueryClient();
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');

  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);
  const [subName, setSubName] = useState('');

  // 1. Fetch Categories
  const { data: catRes, isLoading } = useQuery<ApiResponse<Category[]>>({
    queryKey: ['snag-categories'],
    queryFn: () => apiClient.get('/snag-categories'),
  });
  const categories = catRes?.data || [];

  // Mutations
  const createCategoryMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      apiClient.post('/snag-categories', data),
    onSuccess: () => {
      toast.success('Category created successfully');
      setIsCategoryModalOpen(false);
      setCatName('');
      setCatDesc('');
      queryClient.invalidateQueries({ queryKey: ['snag-categories'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create category');
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/snag-categories/${id}`, { isActive }),
    onSuccess: () => {
      toast.success('Category status updated');
      queryClient.invalidateQueries({ queryKey: ['snag-categories'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update category');
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/snag-categories/${id}`),
    onSuccess: () => {
      toast.success('Category deleted');
      queryClient.invalidateQueries({ queryKey: ['snag-categories'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete category');
    },
  });

  const createSubCategoryMutation = useMutation({
    mutationFn: ({ catId, name, description }: { catId: string; name: string; description?: string }) =>
      apiClient.post(`/snag-categories/${catId}/sub-categories`, { name, description }),
    onSuccess: () => {
      toast.success('Sub-category added');
      setSubName('');
      queryClient.invalidateQueries({ queryKey: ['snag-categories'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to add sub-category');
    },
  });

  const deleteSubCategoryMutation = useMutation({
    mutationFn: (subId: string) => apiClient.delete(`/snag-categories/sub-categories/${subId}`),
    onSuccess: () => {
      toast.success('Sub-category deleted');
      queryClient.invalidateQueries({ queryKey: ['snag-categories'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete sub-category');
    },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(59, 130, 246, 0.3)',
            }}
          >
            <Tag size={20} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Snag Master Categories
            </h2>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Configure defect categories and dependent sub-categories for guard inspection reporting
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsCategoryModalOpen(true)}
          className="btn btn-primary"
          style={{ padding: '8px 16px', fontSize: '0.82rem', gap: '6px' }}
        >
          <Plus size={16} />
          <span>Add New Category</span>
        </button>
      </div>

      {/* Categories Accordion List */}
      {isLoading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading snag master categories...
        </div>
      ) : categories.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--surface-color)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          No custom snag categories defined yet. Create your first category above.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {categories.map((cat) => {
            const isExpanded = expandedCatId === cat.id;
            return (
              <div
                key={cat.id}
                style={{
                  borderRadius: '12px',
                  backgroundColor: 'var(--surface-color)',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden',
                }}
              >
                {/* Category Header Bar */}
                <div
                  style={{
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    backgroundColor: isExpanded ? 'var(--bg-secondary)' : 'transparent',
                  }}
                  onClick={() => setExpandedCatId(isExpanded ? null : cat.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {isExpanded ? <ChevronDown size={18} style={{ color: 'var(--primary)' }} /> : <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />}
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {cat.name}
                      </div>
                      {cat.description && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {cat.description}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {cat.subCategories.length} Sub-categories
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateCategoryMutation.mutate({ id: cat.id, isActive: !cat.isActive });
                      }}
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                    >
                      {cat.isActive ? 'Active' : 'Inactive'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to delete category "${cat.name}"?`)) {
                          deleteCategoryMutation.mutate(cat.id);
                        }
                      }}
                      className="btn btn-danger"
                      style={{ padding: '4px 8px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Sub-categories Panel */}
                {isExpanded && (
                  <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Dependent Sub-Categories:
                    </div>

                    {/* Sub-categories Table */}
                    {cat.subCategories.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {cat.subCategories.map((sub) => (
                          <div
                            key={sub.id}
                            style={{
                              padding: '10px 14px',
                              borderRadius: '8px',
                              backgroundColor: 'var(--bg-secondary)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              • {sub.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => deleteSubCategoryMutation.mutate(sub.id)}
                              style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.78rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                        No sub-categories added yet.
                      </div>
                    )}

                    {/* Add Sub-category Form */}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <input
                        type="text"
                        placeholder="Sub-category name (e.g. Latch Broken, Pipe Leak)..."
                        value={subName}
                        onChange={(e) => setSubName(e.target.value)}
                        className="form-input"
                        style={{ fontSize: '0.82rem', flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!subName.trim()) {
                            toast.error('Please enter sub-category name');
                            return;
                          }
                          createSubCategoryMutation.mutate({ catId: cat.id, name: subName });
                        }}
                        disabled={createSubCategoryMutation.isPending}
                        className="btn btn-secondary"
                        style={{ padding: '8px 14px', fontSize: '0.82rem', gap: '6px' }}
                      >
                        <FolderPlus size={16} />
                        <span>Add Sub-category</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Category Creation Modal */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Create New Snag Master Category"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '10px 0' }}>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
              Category Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Electrical & Lighting, Plumbing..."
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
              Description
            </label>
            <textarea
              placeholder="Description of defect types covered under this category..."
              value={catDesc}
              onChange={(e) => setCatDesc(e.target.value)}
              className="form-input"
              rows={3}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!catName.trim()) {
                  toast.error('Category name is required');
                  return;
                }
                createCategoryMutation.mutate({ name: catName, description: catDesc });
              }}
              disabled={createCategoryMutation.isPending}
              className="btn btn-primary"
            >
              {createCategoryMutation.isPending ? 'Saving...' : 'Create Category'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
