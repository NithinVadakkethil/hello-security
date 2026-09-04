'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Wrench,
  MapPin,
  User,
  MessageSquare,
  History,
  UserPlus,
  ExternalLink,
  ZoomIn,
  Send,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../../../../lib/axios';
import { resolveImageUrl } from '../../../../../lib/image';
import { ApiResponse } from '../../../../types/api';
import LoadingState from '../../../../components/ui/LoadingState';
import { formatPatrolDate, formatPatrolDateTime } from '@/lib/date-formatter';

export default function SnagDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const snagId = params.id as string;

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [statusVal, setStatusVal] = useState<string>('');
  const [statusNotes, setStatusNotes] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [dueDate, setDueDate] = useState('');

  // 1. Fetch Snag Details Ticket
  const { data: snagRes, isLoading } = useQuery<ApiResponse<any>>({
    queryKey: ['snag-detail', snagId],
    queryFn: () => apiClient.get(`/snags/${snagId}`),
  });
  const snag = snagRes?.data;

  React.useEffect(() => {
    if (snag?.status) {
      setStatusVal(snag.status);
    }
  }, [snag?.status]);

  const [staffSearch, setStaffSearch] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState('ALL');

  // 2. Fetch Users list for Assignment dropdown
  const { data: usersRes } = useQuery<ApiResponse<any>>({
    queryKey: ['users-list-assign'],
    queryFn: () => apiClient.get('/users', { params: { limit: 100 } }),
  });
  const rawUsers = usersRes?.data;
  const users: any[] = Array.isArray(rawUsers)
    ? rawUsers
    : Array.isArray(rawUsers?.items)
    ? rawUsers.items
    : [];

  const filteredUsers = users.filter((u) => {
    const roleMatch = staffRoleFilter === 'ALL' || u.role === staffRoleFilter || u.employee?.role === staffRoleFilter;
    if (!roleMatch) return false;
    if (!staffSearch.trim()) return true;
    const s = staffSearch.toLowerCase();
    const name = `${u.employee?.firstName || ''} ${u.employee?.lastName || ''}`.toLowerCase();
    const empNum = (u.employee?.employeeNumber || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const phone = (u.employee?.phone || '').toLowerCase();
    const role = (u.role || '').toLowerCase();
    return name.includes(s) || empNum.includes(s) || email.includes(s) || phone.includes(s) || role.includes(s);
  });

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: (data: { status: string; notes?: string }) =>
      apiClient.patch(`/snags/${snagId}/status`, data),
    onSuccess: () => {
      toast.success('Snag status updated successfully');
      queryClient.invalidateQueries({ queryKey: ['snag-detail', snagId] });
      queryClient.invalidateQueries({ queryKey: ['snag-stats'] });
      setStatusNotes('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update status');
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: (comment: string) => apiClient.post(`/snags/${snagId}/comments`, { comment }),
    onSuccess: () => {
      toast.success('Internal comment added');
      setNewComment('');
      queryClient.invalidateQueries({ queryKey: ['snag-detail', snagId] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to add comment');
    },
  });

  const assignMutation = useMutation({
    mutationFn: (data: { assignedToId: string; dueDate?: string }) =>
      apiClient.post(`/snags/${snagId}/assign`, data),
    onSuccess: () => {
      toast.success('Maintenance personnel assigned successfully');
      queryClient.invalidateQueries({ queryKey: ['snag-detail', snagId] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to assign personnel');
    },
  });

  if (isLoading) {
    return <LoadingState message="Loading maintenance snag ticket data..." variant="page" />;
  }

  if (!snag) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--danger)' }}>
        Snag ticket not found or access denied.
      </div>
    );
  }

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'OPEN':
        return { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)', label: 'Open' };
      case 'IN_PROGRESS':
        return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)', label: 'In Progress' };
      case 'WAITING':
        return { bg: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', border: 'rgba(168, 85, 247, 0.3)', label: 'Waiting for Parts' };
      case 'RESOLVED':
        return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)', label: 'Resolved' };
      case 'CLOSED':
        return { bg: 'rgba(107, 114, 128, 0.15)', color: '#9ca3af', border: 'rgba(107, 114, 128, 0.3)', label: 'Closed' };
      case 'REJECTED':
        return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)', label: 'Rejected' };
      default:
        return { bg: 'var(--bg-secondary)', color: 'var(--text-muted)', border: 'var(--border-color)', label: status };
    }
  };

  const statusStyle = getStatusBadgeStyle(snag.status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn btn-secondary"
            style={{ padding: '8px 12px', fontSize: '0.82rem', gap: '6px' }}
          >
            <ArrowLeft size={16} />
            <span>Back to List</span>
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Snag Ticket #{snag.id.slice(-8).toUpperCase()}
              </h2>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: '8px',
                  backgroundColor: statusStyle.bg,
                  color: statusStyle.color,
                  border: `1px solid ${statusStyle.border}`,
                }}
              >
                {statusStyle.label}
              </span>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Created on {formatPatrolDateTime(snag.createdAt, undefined, false)}
            </span>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr)', gap: '24px' }}>
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Information Card */}
          <div
            style={{
              padding: '20px',
              borderRadius: '12px',
              backgroundColor: 'var(--surface-color)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wrench size={18} style={{ color: 'var(--primary)' }} />
              <span>Snag Description & Category Details</span>
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', backgroundColor: 'var(--bg-secondary)', padding: '14px', borderRadius: '8px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Category</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>{snag.category}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sub Category</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>{snag.subCategory || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Priority Level</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: snag.priority === 'HIGH' ? '#ef4444' : snag.priority === 'MEDIUM' ? '#f59e0b' : '#10b981' }}>
                  {snag.priority} PRIORITY
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last Updated</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{formatPatrolDateTime(snag.updatedAt, undefined, false)}</div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Detailed Observation Notes from Guard Inspection:
              </div>
              <p style={{ margin: 0, padding: '14px', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                {snag.description}
              </p>
            </div>
          </div>

          {/* Photo Attachments Card */}
          <div
            style={{
              padding: '20px',
              borderRadius: '12px',
              backgroundColor: 'var(--surface-color)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ZoomIn size={18} style={{ color: 'var(--primary)' }} />
              <span>Inspection Photo Attachments ({snag.images?.length || 0})</span>
            </h3>

            {snag.images && snag.images.length > 0 ? (
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {snag.images.map((imgUrl: string, idx: number) => {
                  const fullUrl = resolveImageUrl(imgUrl);
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedImage(fullUrl)}
                      style={{
                        width: '110px',
                        height: '110px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        position: 'relative',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <img src={fullUrl} alt={`Snag Photo ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: '0.82rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                📷 No photo attachments uploaded for this snag ticket.
              </div>
            )}
          </div>

          {/* Activity & Timeline Ledger Card */}
          <div
            style={{
              padding: '20px',
              borderRadius: '12px',
              backgroundColor: 'var(--surface-color)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History size={18} style={{ color: 'var(--primary)' }} />
              <span>Audit History & Action Ledger</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {snag.history && snag.history.length > 0 ? (
                snag.history.map((h: any) => (
                  <div
                    key={h.id}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderLeft: '3px solid var(--primary)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {h.action.replace('_', ' ')}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {formatPatrolDateTime(h.createdAt, undefined, false)}
                      </span>
                    </div>
                    {h.notes && (
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {h.notes}
                      </p>
                    )}
                    {h.user && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600 }}>
                        By: {h.user.email}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No historical logs available yet.</div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Status Management Form */}
          <div
            style={{
              padding: '20px',
              borderRadius: '12px',
              backgroundColor: 'var(--surface-color)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Update Ticket Status
            </h3>

            <select
              value={statusVal}
              onChange={(e) => setStatusVal(e.target.value)}
              className="form-input"
              style={{ fontSize: '0.88rem', fontWeight: 700 }}
            >
              <option value="OPEN">🔵 Open</option>
              <option value="IN_PROGRESS">🟠 In Progress</option>
              <option value="WAITING">🟣 Waiting for Parts</option>
              <option value="RESOLVED">🟢 Resolved</option>
              <option value="CLOSED">⚪ Closed</option>
              <option value="REJECTED">🔴 Rejected</option>
            </select>

            <textarea
              placeholder="Status update notes / resolution details..."
              value={statusNotes}
              onChange={(e) => setStatusNotes(e.target.value)}
              className="form-input"
              rows={2}
              style={{ fontSize: '0.82rem' }}
            />

            <button
              type="button"
              onClick={() => updateStatusMutation.mutate({ status: statusVal, notes: statusNotes })}
              disabled={updateStatusMutation.isPending}
              className="btn btn-primary"
              style={{ width: '100%', padding: '10px', fontSize: '0.85rem' }}
            >
              {updateStatusMutation.isPending ? 'Updating...' : 'Save Status Change'}
            </button>
          </div>

          {/* Maintenance Personnel Assignment */}
          <div
            style={{
              padding: '20px',
              borderRadius: '12px',
              backgroundColor: 'var(--surface-color)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserPlus size={18} style={{ color: 'var(--primary)' }} />
              <span>Assign Maintenance Staff</span>
            </h3>

            {snag.assignments && snag.assignments.length > 0 && snag.assignments[0]?.assignedTo && (
              <div
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                  }}
                >
                  {(snag.assignments[0].assignedTo.employee?.firstName || snag.assignments[0].assignedTo.email || 'A')
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Currently Assigned Staff
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {snag.assignments[0].assignedTo.employee
                      ? `${snag.assignments[0].assignedTo.employee.firstName} ${snag.assignments[0].assignedTo.employee.lastName || ''}`
                      : snag.assignments[0].assignedTo.email}
                  </div>
                  {snag.assignments[0].dueDate && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Target Due Date: {formatPatrolDate(snag.assignments[0].dueDate)}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Search Maintenance Staff:
              </label>

              {/* Search & Role Filter Bar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                <input
                  type="text"
                  placeholder="Search by Name, Emp #, Email, Phone..."
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  className="form-input"
                  style={{ fontSize: '0.82rem', padding: '8px 12px' }}
                />

                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {['ALL', 'CLEANER', 'TECHNICIAN', 'SERVICE_ENGINEER', 'LIFE_GUARD', 'PLUMBER', 'SECURITY'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setStaffRoleFilter(r)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '0.72rem',
                        fontWeight: staffRoleFilter === r ? 700 : 500,
                        border: staffRoleFilter === r ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                        backgroundColor: staffRoleFilter === r ? 'var(--primary-light, rgba(59, 130, 246, 0.2))' : 'var(--chip-bg, #222)',
                        color: staffRoleFilter === r ? 'var(--primary)' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {r === 'CLEANER' ? 'House Keeping' : r.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Searchable Staff Cards Scroll List */}
              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px', backgroundColor: 'var(--surface-color)' }}>
                {filteredUsers.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    No matching staff found
                  </div>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelected = assignedToId === u.id;
                    const emp = u.employee;
                    const role = emp?.role || u.role;
                    const name = emp ? `${emp.firstName} ${emp.lastName || ''}`.trim() : u.email;
                    const empNum = emp?.employeeNumber || 'N/A';
                    const phone = emp?.phone || 'No phone';

                    return (
                      <div
                        key={u.id}
                        onClick={() => setAssignedToId(u.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                          border: isSelected ? '1px solid var(--primary)' : '1px solid transparent',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: isSelected ? 'var(--primary)' : '#334155', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-color)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {name}
                            </span>
                            <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '10px', backgroundColor: 'var(--chip-bg, #1e293b)', color: 'var(--primary)', fontWeight: 600 }}>
                              {role}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '10px', fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            <span>Emp #: {empNum}</span>
                            <span>•</span>
                            <span>{phone}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                Target Resolution Due Date:
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="form-input"
                style={{ fontSize: '0.82rem' }}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                if (!assignedToId) {
                  toast.error('Please select a maintenance staff member');
                  return;
                }
                assignMutation.mutate({ assignedToId, dueDate: dueDate || undefined });
              }}
              disabled={assignMutation.isPending}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '10px', fontSize: '0.85rem' }}
            >
              {assignMutation.isPending ? 'Assigning...' : 'Assign Staff'}
            </button>
          </div>

          {/* Location & Google Maps Card */}
          <div
            style={{
              padding: '20px',
              borderRadius: '12px',
              backgroundColor: 'var(--surface-color)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={18} style={{ color: 'var(--primary)' }} />
              <span>Location Context</span>
            </h3>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <strong>Site:</strong> {snag.site?.name || 'N/A'}
            </div>
            {snag.gate && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <strong>Checkpoint:</strong> {snag.gate.name} ({snag.gate.gateCode})
              </div>
            )}
            {snag.latitude && snag.longitude && (
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Coordinates: {snag.latitude.toFixed(5)}, {snag.longitude.toFixed(5)}
                </div>
                <a
                  href={`https://maps.google.com/?q=${snag.latitude},${snag.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', padding: '6px 12px' }}
                >
                  <ExternalLink size={14} />
                  <span>Open in Google Maps</span>
                </a>
              </div>
            )}
          </div>

          {/* Reported By Guard Card */}
          <div
            style={{
              padding: '20px',
              borderRadius: '12px',
              backgroundColor: 'var(--surface-color)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={18} style={{ color: 'var(--primary)' }} />
              <span>Reported By Security Officer</span>
            </h3>

            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {snag.employee ? `${snag.employee.firstName} ${snag.employee.lastName || ''}` : 'Security Guard'}
            </div>
            {snag.employee?.employeeNumber && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Emp #: {snag.employee.employeeNumber}
              </div>
            )}
            {snag.employee?.phone && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Phone: {snag.employee.phone}
              </div>
            )}
          </div>

          {/* Internal Comments Card */}
          <div
            style={{
              padding: '20px',
              borderRadius: '12px',
              backgroundColor: 'var(--surface-color)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={18} style={{ color: 'var(--primary)' }} />
              <span>Internal Admin Comments</span>
            </h3>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Add internal note..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="form-input"
                style={{ fontSize: '0.82rem' }}
              />
              <button
                type="button"
                onClick={() => {
                  if (!newComment.trim()) return;
                  addCommentMutation.mutate(newComment);
                }}
                disabled={addCommentMutation.isPending}
                className="btn btn-primary"
                style={{ padding: '8px 12px' }}
              >
                <Send size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {snag.comments && snag.comments.length > 0 ? (
                snag.comments.map((c: any) => (
                  <div key={c.id} style={{ padding: '10px', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '2px' }}>
                      {c.user?.email} ({formatPatrolDateTime(c.createdAt, undefined, false)})
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>{c.comment}</div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No internal notes posted.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Image Zoom Modal */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          <img src={selectedImage} alt="Zoomed Inspection" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '8px' }} />
        </div>
      )}
    </div>
  );
}
