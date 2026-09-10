'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Layers, Plus, Power, Trash2, UserCheck } from 'lucide-react';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import ConfirmationDialog from '../../components/ui/ConfirmationDialog';
import DataTable from '../../components/ui/DataTable';
import { FormInput } from '../../components/ui/FormControls';
import Modal from '../../components/ui/Modal';
import StatusChip from '../../components/ui/StatusChip';
import { apiClient } from '../../lib/axios';
import { useAuthStore } from '../../store/auth-store';
import { formatPatrolDateTime } from '@/lib/date-formatter';

interface ClientOption {
  id: string;
  companyName: string;
  clientCode: string;
  email: string;
}

interface CentralizedManager {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  lastLogin?: string;
  rawPassword?: string;
  createdAt: string;
  assignedClients: ClientOption[];
}

const enrollSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().optional(),
  isActive: z.boolean().default(true),
});

type EnrollValues = z.infer<typeof enrollSchema>;

export default function ManagersPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [isEnrollOpen, setIsEnrollOpen] = useState(false);
  const [createdInfo, setCreatedInfo] = useState<{ message: string; tempPassword?: string } | null>(null);

  // Super Admin specific state
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [manageAccessManager, setManageAccessManager] = useState<CentralizedManager | null>(null);
  const [accessClientIds, setAccessClientIds] = useState<string[]>([]);
  const [viewProfileManager, setViewProfileManager] = useState<CentralizedManager | null>(null);
  const [toggleStatusUser, setToggleStatusUser] = useState<{ id: string; email: string; isActive: boolean } | null>(null);
  const [removeManagerId, setRemoveManagerId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EnrollValues>({
    resolver: zodResolver(enrollSchema as any),
    defaultValues: {
      isActive: true,
    },
  });

  // Query Client list for multi-select
  const { data: clientOptions = [] } = useQuery<ClientOption[]>({
    queryKey: ['all-clients-list'],
    queryFn: async () => {
      const res: any = await apiClient.get('/clients?limit=100');
      const items = res?.data?.items || res?.data || [];
      return Array.isArray(items)
        ? items.map((c: any) => ({
            id: c.id,
            companyName: c.companyName,
            clientCode: c.clientCode,
            email: c.email,
          }))
        : [];
    },
    enabled: isSuperAdmin,
  });

  // Query Managers (Super Admin centralized list or Client Admin client-list)
  const { data: managers = [], isLoading } = useQuery<CentralizedManager[]>({
    queryKey: ['enrolled-managers', isSuperAdmin],
    queryFn: async () => {
      const endpoint = isSuperAdmin ? '/manager/centralized-list' : '/manager/client-list';
      const res: any = await apiClient.get(endpoint);
      if (res && res.success === false) {
        throw new Error(res.error?.message || 'Failed to fetch managers');
      }
      return Array.isArray(res?.data) ? res.data : [];
    },
  });

  // Mutation: Enroll Centralized Manager (Super Admin)
  const superEnrollMutation = useMutation({
    mutationFn: async (values: EnrollValues) => {
      const payload = {
        ...values,
        clientIds: selectedClientIds,
      };
      const res: any = await apiClient.post('/manager/centralized-enroll', payload);
      if (res && res.success === false) {
        throw new Error(res.error?.message || 'Failed to create Centralized Manager');
      }
      return res?.data ?? res;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['enrolled-managers'] });
      setIsEnrollOpen(false);
      reset();
      setSelectedClientIds([]);
      const msg = data?.message || 'Centralized Manager created successfully.';
      toast.success(msg);
      if (data?.temporaryPassword) {
        setCreatedInfo({
          message: msg,
          tempPassword: data.temporaryPassword,
        });
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || err.message || 'Failed to create manager.');
    },
  });

  // Mutation: Enroll Manager (Client Admin)
  const clientEnrollMutation = useMutation({
    mutationFn: async (values: EnrollValues) => {
      const res: any = await apiClient.post('/manager/enroll', values);
      if (res && res.success === false) {
        throw new Error(res.error?.message || 'Failed to enroll manager');
      }
      return res?.data ?? res;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['enrolled-managers'] });
      setIsEnrollOpen(false);
      reset();
      const msg = data?.message || 'Manager enrolled successfully.';
      toast.success(msg);
      if (data?.temporaryPassword) {
        setCreatedInfo({
          message: msg,
          tempPassword: data.temporaryPassword,
        });
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || err.message || 'Failed to enroll manager.');
    },
  });

  // Mutation: Update Memberships (Super Admin Manage Access)
  const updateMembershipsMutation = useMutation({
    mutationFn: async ({ userId, clientIds }: { userId: string; clientIds: string[] }) => {
      const res: any = await apiClient.put(`/manager/centralized-memberships/${userId}`, { clientIds });
      if (res && res.success === false) {
        throw new Error(res.error?.message || 'Failed to update access');
      }
      return res?.data ?? res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrolled-managers'] });
      setManageAccessManager(null);
      toast.success('Assigned organizations updated successfully.');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || err.message || 'Failed to update access.');
    },
  });

  // Mutation: Toggle Status (Super Admin Activate/Deactivate)
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res: any = await apiClient.patch(`/manager/centralized-status/${id}`, { isActive });
      if (res && res.success === false) {
        throw new Error(res.error?.message || 'Failed to change status');
      }
      return res?.data ?? res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrolled-managers'] });
      setToggleStatusUser(null);
      toast.success('Manager account status updated.');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || err.message || 'Failed to change status.');
    },
  });

  // Mutation: Remove Manager Membership (Client Admin)
  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res: any = await apiClient.delete(`/manager/client-list/${userId}`);
      if (res && res.success === false) {
        throw new Error(res.error?.message || 'Failed to remove manager');
      }
      return res?.data ?? res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrolled-managers'] });
      setRemoveManagerId(null);
      toast.success('Manager removed from organization.');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || err.message || 'Failed to remove manager.');
    },
  });

  const handleCheckboxToggle = (clientId: string, currentList: string[], setList: (val: string[]) => void) => {
    if (currentList.includes(clientId)) {
      setList(currentList.filter((id) => id !== clientId));
    } else {
      setList([...currentList, clientId]);
    }
  };

  const openManageAccess = (row: CentralizedManager) => {
    setManageAccessManager(row);
    const assignedIds = Array.isArray(row.assignedClients) ? row.assignedClients.map((c) => c.id) : [];
    setAccessClientIds(assignedIds);
  };

  const columns = [
    {
      key: 'name',
      label: 'Manager Name',
      render: (row: CentralizedManager) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'var(--primary-bg, rgba(37, 99, 235, 0.12))',
              color: 'var(--primary-color, #2563EB)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.9rem',
            }}
          >
            {row.name ? row.name.charAt(0).toUpperCase() : 'M'}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{row.name}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'assignedClients',
      label: 'Assigned Organizations',
      render: (row: CentralizedManager) => {
        const clients = row.assignedClients || [];
        if (clients.length === 0) {
          return <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>No clients assigned</span>;
        }
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '320px' }}>
            {clients.map((c) => (
              <span
                key={c.id}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(37, 99, 235, 0.1)',
                  color: '#2563EB',
                  border: '1px solid rgba(37, 99, 235, 0.2)',
                }}
              >
                {c.companyName}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: CentralizedManager) => <StatusChip status={row.isActive} />,
    },
    {
      key: 'lastLogin',
      label: 'Last Login',
      render: (row: CentralizedManager) => (row.lastLogin ? formatPatrolDateTime(row.lastLogin) : 'Never'),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: CentralizedManager) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isSuperAdmin ? (
            <>
              <button
                className="btn btn-sm btn-ghost"
                title="View Profile Details"
                onClick={() => setViewProfileManager(row)}
              >
                <Eye size={15} />
              </button>
              <button
                className="btn btn-sm btn-ghost"
                title="Edit Assigned Organizations"
                onClick={() => openManageAccess(row)}
                style={{ color: '#2563EB' }}
              >
                <Layers size={15} />
              </button>
              <button
                className={`btn btn-sm btn-ghost ${row.isActive ? 'danger-text' : 'success-text'}`}
                title={row.isActive ? 'Deactivate Account' : 'Activate Account'}
                onClick={() => setToggleStatusUser({ id: row.userId || row.id, email: row.email, isActive: row.isActive })}
              >
                <Power size={15} />
              </button>
            </>
          ) : (
            <button
              className="btn btn-sm btn-ghost danger-text"
              title="Remove Manager from Organization"
              onClick={() => setRemoveManagerId(row.userId || row.id)}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="page-container" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <UserCheck size={24} style={{ color: '#2563EB' }} />
            {isSuperAdmin ? 'Centralized Managers Directory' : 'Organization Managers'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
            {isSuperAdmin
              ? 'Manage multi-client Centralized Managers overseeing Client Admin organizations.'
              : 'Manage read-only monitoring & inspection managers assigned to your organization.'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsEnrollOpen(true)} style={{ gap: '6px' }}>
          <Plus size={16} />
          <span>{isSuperAdmin ? 'Create Centralized Manager' : 'Enroll Manager'}</span>
        </button>
      </div>

      <div className="card" style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <DataTable columns={columns} data={managers} isLoading={isLoading} emptyMessage="No Centralized Managers enrolled yet." />
      </div>

      {/* Modal 1: Create / Enroll Manager */}
      <Modal isOpen={isEnrollOpen} onClose={() => setIsEnrollOpen(false)} title={isSuperAdmin ? 'Create Centralized Manager' : 'Enroll Manager'}>
        <form
          onSubmit={handleSubmit((data) => {
            if (isSuperAdmin) {
              superEnrollMutation.mutate(data);
            } else {
              clientEnrollMutation.mutate(data);
            }
          })}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <FormInput label="Full Name" error={errors.name?.message} {...register('name')} placeholder="e.g. John Manager" />
          <FormInput label="Email Address" error={errors.email?.message} {...register('email')} placeholder="manager@kaizen.com" />
          <FormInput label="Initial Password (Optional)" error={errors.password?.message} {...register('password')} placeholder="Leave blank to auto-generate" type="password" />

          {isSuperAdmin && (
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                Assigned Client Admins ({selectedClientIds.length} selected)
              </label>
              <div
                style={{
                  maxHeight: '180px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  backgroundColor: 'var(--bg-tertiary)',
                }}
              >
                {clientOptions.map((c) => {
                  const isChecked = selectedClientIds.includes(c.id);
                  return (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleCheckboxToggle(c.id, selectedClientIds, setSelectedClientIds)}
                      />
                      <div>
                        <span style={{ fontWeight: 700 }}>{c.companyName}</span>
                        <span style={{ color: 'var(--text-secondary)', marginLeft: '6px', fontSize: '11px' }}>
                          ({c.clientCode}) • {c.email}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
            ℹ️ If this email already belongs to an existing Manager account, access to selected organizations will be granted without resetting credentials.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsEnrollOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={superEnrollMutation.isPending || clientEnrollMutation.isPending}>
              {superEnrollMutation.isPending || clientEnrollMutation.isPending ? 'Saving...' : isSuperAdmin ? 'Create Manager' : 'Enroll Manager'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Manage Access (Edit Assigned Organizations for Super Admin) */}
      {manageAccessManager && (
        <Modal isOpen={!!manageAccessManager} onClose={() => setManageAccessManager(null)} title={`Manage Access — ${manageAccessManager.name}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
              Select the Client Admin organizations this Centralized Manager is authorized to monitor ({accessClientIds.length} selected).
            </p>

            <div
              style={{
                maxHeight: '240px',
                overflowY: 'auto',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                backgroundColor: 'var(--bg-tertiary)',
              }}
            >
              {clientOptions.map((c) => {
                const isChecked = accessClientIds.includes(c.id);
                return (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleCheckboxToggle(c.id, accessClientIds, setAccessClientIds)}
                    />
                    <div>
                      <span style={{ fontWeight: 700 }}>{c.companyName}</span>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: '6px', fontSize: '11px' }}>
                        ({c.clientCode}) • {c.email}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setManageAccessManager(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={updateMembershipsMutation.isPending}
                onClick={() =>
                  updateMembershipsMutation.mutate({
                    userId: manageAccessManager.userId || manageAccessManager.id,
                    clientIds: accessClientIds,
                  })
                }
              >
                {updateMembershipsMutation.isPending ? 'Updating...' : 'Save Access Config'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal 3: View Profile Details */}
      {viewProfileManager && (
        <Modal isOpen={!!viewProfileManager} onClose={() => setViewProfileManager(null)} title="Centralized Manager Profile">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: '#2563EB',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '18px',
                }}
              >
                {viewProfileManager.name ? viewProfileManager.name.charAt(0).toUpperCase() : 'M'}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>{viewProfileManager.name}</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>{viewProfileManager.email}</p>
              </div>
            </div>

            <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-tertiary)', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div><strong>Role:</strong> {viewProfileManager.role}</div>
              <div><strong>Status:</strong> {viewProfileManager.isActive ? 'Active' : 'Inactive'}</div>
              <div><strong>Portal Password:</strong> {viewProfileManager.rawPassword || 'Hidden/Encrypted'}</div>
              <div><strong>Last Login:</strong> {viewProfileManager.lastLogin ? formatPatrolDateTime(viewProfileManager.lastLogin) : 'Never'}</div>
              <div><strong>Enrolled Date:</strong> {formatPatrolDateTime(viewProfileManager.createdAt)}</div>
            </div>

            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 800, margin: '0 0 6px 0' }}>Assigned Organizations ({viewProfileManager.assignedClients?.length || 0})</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(viewProfileManager.assignedClients || []).map((c) => (
                  <span key={c.id} style={{ fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563EB', border: '1px solid rgba(37, 99, 235, 0.2)' }}>
                    {c.companyName} ({c.clientCode})
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setViewProfileManager(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal 4: Created Info / Temp Password */}
      {createdInfo && (
        <Modal isOpen={!!createdInfo} onClose={() => setCreatedInfo(null)} title="Manager Account Created">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: 0, fontWeight: 500 }}>{createdInfo.message}</p>
            {createdInfo.tempPassword && (
              <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '8px', border: '1px dashed var(--primary-color)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Temporary Password</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '1px', color: 'var(--primary-color)' }}>
                  {createdInfo.tempPassword}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button className="btn btn-primary" onClick={() => setCreatedInfo(null)}>
                Got it
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation Dialog: Toggle Account Status */}
      <ConfirmationDialog
        isOpen={!!toggleStatusUser}
        onClose={() => setToggleStatusUser(null)}
        onConfirm={() => toggleStatusUser && toggleStatusMutation.mutate({ id: toggleStatusUser.id, isActive: !toggleStatusUser.isActive })}
        title={toggleStatusUser?.isActive ? 'Deactivate Account' : 'Activate Account'}
        description={`Are you sure you want to ${toggleStatusUser?.isActive ? 'deactivate' : 'activate'} access for ${toggleStatusUser?.email}?`}
        confirmText={toggleStatusUser?.isActive ? 'Deactivate' : 'Activate'}
        isDanger={toggleStatusUser?.isActive}
        isLoading={toggleStatusMutation.isPending}
      />

      {/* Confirmation Dialog: Remove Client Admin Manager */}
      <ConfirmationDialog
        isOpen={!!removeManagerId}
        onClose={() => setRemoveManagerId(null)}
        onConfirm={() => removeManagerId && removeMutation.mutate(removeManagerId)}
        title="Remove Manager"
        description="Are you sure you want to remove this Manager from your organization? The manager account will remain active for any other assigned organizations."
        confirmText="Remove Manager"
        isDanger
        isLoading={removeMutation.isPending}
      />
    </div>
  );
}
