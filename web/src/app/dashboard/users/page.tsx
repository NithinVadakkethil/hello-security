'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Check,
  Copy,
  Edit2,
  Key,
  Plus,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';

import ConfirmationDialog from '../../components/ui/ConfirmationDialog';
import DataTable from '../../components/ui/DataTable';
import { FormInput, Select } from '../../components/ui/FormControls';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import SearchBar from '../../components/ui/SearchBar';
import StatusChip from '../../components/ui/StatusChip';
import { apiClient } from '../../lib/axios';
import { useAuthStore } from '../../store/auth-store';
import { ApiResponse } from '../../types/api';

interface User {
  id: string;
  email: string;
  role: string;
  clientId: string | null;
  employeeId: string | null;
  isActive: boolean;
  lastLogin?: string | null;
  createdAt: string;
  client?: {
    id: string;
    companyName: string;
  } | null;
}

// Zod schemas
const createSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.enum([
    'SUPER_ADMIN',
    'CLIENT_ADMIN',
    'MANAGER',
    'SUPERVISOR',
    'SECURITY',
    'CLEANER',
    'SERVICE_ENGINEER',
    'TECHNICIAN',
    'LIFE_GUARD',
    'PLUMBER',
  ]),
  clientId: z.string().optional(),
  password: z.string().optional(),
});

const editSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.enum([
    'SUPER_ADMIN',
    'CLIENT_ADMIN',
    'MANAGER',
    'SUPERVISOR',
    'SECURITY',
    'CLEANER',
    'SERVICE_ENGINEER',
    'TECHNICIAN',
    'LIFE_GUARD',
    'PLUMBER',
  ]),
  clientId: z.string().optional(),
});

type CreateValues = z.infer<typeof createSchema>;
type EditValues = z.infer<typeof editSchema>;

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);

  // Password Display State
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Status confirm dialog state
  const [statusConfirm, setStatusConfirm] = useState<{
    isOpen: boolean;
    userId: string;
    email: string;
    targetStatus: boolean;
  }>({
    isOpen: false,
    userId: '',
    email: '',
    targetStatus: false,
  });

  // Reset password confirm dialog state
  const [resetConfirm, setResetConfirm] = useState<{
    isOpen: boolean;
    userId: string;
    email: string;
  }>({
    isOpen: false,
    userId: '',
    email: '',
  });

  // React Hook Forms
  const {
    register: registerCreate,
    handleSubmit: handleCreateSubmit,
    watch: watchCreate,
    reset: resetCreate,
    formState: { errors: createErrors },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema as any),
    defaultValues: { role: 'CLIENT_ADMIN' },
  });

  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    watch: watchEdit,
    setValue: setEditValue,
    formState: { errors: editErrors },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema as any),
  });

  const selectedCreateRole = watchCreate('role');
  const selectedEditRole = watchEdit('role');

  // Fetch Users
  const { data, isLoading } = useQuery<
    ApiResponse<{ items: User[]; pagination: { totalPages: number } }>
  >({
    queryKey: ['users', page, search, roleFilter],
    queryFn: () =>
      apiClient.get('/users', {
        params: {
          page,
          limit: 10,
          search: search || undefined,
          role: roleFilter !== 'ALL' ? roleFilter : undefined,
        },
      }),
    placeholderData: keepPreviousData,
  });

  // Fetch Clients (for dropdown)
  const { data: clientsData } = useQuery<
    ApiResponse<{ items: { id: string; companyName: string }[] }>
  >({
    queryKey: ['clients-dropdown'],
    queryFn: () => apiClient.get('/clients', { params: { limit: 100 } }),
    enabled: currentUser?.role === 'SUPER_ADMIN',
  });

  const clientsList = clientsData?.data?.items || [];
  const clientOptions = [
    { value: '', label: '-- Select Client Company --' },
    ...clientsList.map((c) => ({ value: c.id, label: c.companyName })),
  ];

  // Role options (filter CLIENT_ADMIN permissions if applicable)
  const operationalRoles = [
    { value: 'SECURITY', label: 'Security Guard' },
    { value: 'CLEANER', label: 'House Keeping' },
    { value: 'SERVICE_ENGINEER', label: 'Service Engineer' },
    { value: 'TECHNICIAN', label: 'Technician' },
    { value: 'LIFE_GUARD', label: 'Life Guard' },
    { value: 'PLUMBER', label: 'Plumber' },
  ];

  const roleOptions =
    currentUser?.role === 'SUPER_ADMIN'
      ? [
          { value: 'SUPER_ADMIN', label: 'Super Admin' },
          { value: 'CLIENT_ADMIN', label: 'Client Admin' },
          { value: 'MANAGER', label: 'Manager' },
          { value: 'SUPERVISOR', label: 'Supervisor' },
          ...operationalRoles,
        ]
      : [
          { value: 'MANAGER', label: 'Manager' },
          { value: 'SUPERVISOR', label: 'Supervisor' },
          ...operationalRoles,
        ];

  // User Actions Mutations
  const createUserMutation = useMutation({
    mutationFn: (values: CreateValues) => apiClient.post('/users', values),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User account created successfully!');
      setIsCreateOpen(false);
      resetCreate();
      if (res.data?.data?.temporaryPassword) {
        setTempPassword(res.data.data.temporaryPassword);
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create user.');
    },
  });

  const editUserMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: EditValues }) =>
      apiClient.patch(`/users/${id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated successfully!');
      setEditUserId(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update user.');
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/users/${id}/${isActive ? 'activate' : 'deactivate'}`),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(
        `User "${statusConfirm.email}" successfully ${vars.isActive ? 'activated' : 'deactivated'}.`,
      );
      setStatusConfirm((prev) => ({ ...prev, isOpen: false }));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update status.');
      setStatusConfirm((prev) => ({ ...prev, isOpen: false }));
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/users/${id}/reset-password`),
    onSuccess: (res: any) => {
      toast.success(`Password reset successful for "${resetConfirm.email}".`);
      setResetConfirm((prev) => ({ ...prev, isOpen: false }));
      if (res.data?.data?.temporaryPassword) {
        setTempPassword(res.data.data.temporaryPassword);
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to reset password.');
      setResetConfirm((prev) => ({ ...prev, isOpen: false }));
    },
  });

  const handleOpenEdit = (user: User) => {
    setEditUserId(user.id);
    setEditValue('email', user.email);
    setEditValue('role', user.role as any);
    setEditValue('clientId', user.clientId || '');
  };

  const handleCopy = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      toast.success('Password copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const columns = [
    { key: 'email', label: 'Email', sortable: true },
    {
      key: 'role',
      label: 'Role',
      sortable: true,
      render: (row: User) => (
        <span
          style={{
            fontSize: '0.8rem',
            textTransform: 'uppercase',
            padding: '2px 8px',
            background: 'var(--bg-tertiary)',
            borderRadius: '4px',
            fontWeight: 500,
          }}
        >
          {row.role === 'CLEANER' ? 'HOUSE KEEPING' : row.role.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'client',
      label: 'Company / Client',
      render: (row: User) =>
        row.client?.companyName || (
          <em style={{ color: 'var(--text-muted)' }}>Global / System</em>
        ),
    },
    {
      key: 'lastLogin',
      label: 'Last Login',
      render: (row: User) =>
        row.lastLogin ? new Date(row.lastLogin).toLocaleString() : 'Never',
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row: User) => <StatusChip status={row.isActive} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: User) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => handleOpenEdit(row)}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.8rem', gap: '4px' }}
            title="Edit User"
          >
            <Edit2 size={14} />
            <span>Edit</span>
          </button>
          <button
            onClick={() =>
              setResetConfirm({
                isOpen: true,
                userId: row.id,
                email: row.email,
              })
            }
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.8rem', gap: '4px' }}
            title="Reset Password"
          >
            <Key size={14} />
            <span>Reset PW</span>
          </button>
          {row.id !== currentUser?.id && (
            <button
              onClick={() =>
                setStatusConfirm({
                  isOpen: true,
                  userId: row.id,
                  email: row.email,
                  targetStatus: !row.isActive,
                })
              }
              className="btn btn-secondary"
              style={{
                padding: '6px 10px',
                fontSize: '0.8rem',
                gap: '4px',
                color: row.isActive ? 'var(--danger)' : 'var(--success)',
              }}
            >
              {row.isActive ? (
                <ToggleLeft size={16} />
              ) : (
                <ToggleRight size={16} />
              )}
              <span>{row.isActive ? 'Deactivate' : 'Activate'}</span>
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            width: '100%',
            maxWidth: '640px',
          }}
        >
          <SearchBar
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            placeholder="Search users by email..."
          />

          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="form-input"
            style={{ maxWidth: '180px' }}
          >
            <option value="ALL">All Roles</option>
            {currentUser?.role === 'SUPER_ADMIN' && (
              <option value="CLIENT_ADMIN">Client Admin</option>
            )}
            <option value="MANAGER">Manager</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="SECURITY">Security Guard</option>
            <option value="CLEANER">House Keeping</option>
            <option value="SERVICE_ENGINEER">Service Engineer</option>
            <option value="TECHNICIAN">Technician</option>
            <option value="LIFE_GUARD">Life Guard</option>
            <option value="PLUMBER">Plumber</option>
          </select>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="btn btn-primary"
          style={{ gap: '8px', cursor: 'pointer' }}
        >
          <Plus size={16} />
          <span>Create User</span>
        </button>
      </div>

      <DataTable
        columns={columns}
        data={data?.data?.items}
        isLoading={isLoading}
        emptyMessage="No users found matching criteria."
      />

      <Pagination
        currentPage={page}
        totalPages={data?.data?.pagination?.totalPages || 1}
        onPageChange={(p) => setPage(p)}
      />

      {/* CREATE USER MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create User Account"
      >
        <form
          onSubmit={handleCreateSubmit((vals) =>
            createUserMutation.mutate(vals),
          )}
          style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
          <FormInput
            label="Email Address"
            type="email"
            placeholder="e.g. user@acme.com"
            error={createErrors.email?.message}
            {...registerCreate('email')}
          />

          <Select
            label="Security Role"
            options={roleOptions}
            error={createErrors.role?.message}
            {...registerCreate('role')}
          />

          {currentUser?.role === 'SUPER_ADMIN' &&
            selectedCreateRole !== 'SUPER_ADMIN' && (
              <Select
                label="Assigned Client"
                options={clientOptions}
                error={createErrors.clientId?.message}
                {...registerCreate('clientId')}
              />
            )}

          <FormInput
            label="Password (Optional - generates temporary if empty)"
            type="password"
            placeholder="Min 6 characters"
            error={createErrors.password?.message}
            {...registerCreate('password')}
          />

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '16px' }}
            disabled={createUserMutation.isPending}
          >
            {createUserMutation.isPending
              ? 'Creating Account...'
              : 'Create Account'}
          </button>
        </form>
      </Modal>

      {/* EDIT USER MODAL */}
      <Modal
        isOpen={editUserId !== null}
        onClose={() => setEditUserId(null)}
        title="Edit User Settings"
      >
        <form
          onSubmit={handleEditSubmit((vals) =>
            editUserMutation.mutate({ id: editUserId!, values: vals }),
          )}
          style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
          <FormInput
            label="Email Address"
            type="email"
            error={editErrors.email?.message}
            {...registerEdit('email')}
          />

          <Select
            label="Security Role"
            options={roleOptions}
            error={editErrors.role?.message}
            {...registerEdit('role')}
          />

          {currentUser?.role === 'SUPER_ADMIN' &&
            selectedEditRole !== 'SUPER_ADMIN' && (
              <Select
                label="Assigned Client"
                options={clientOptions}
                error={editErrors.clientId?.message}
                {...registerEdit('clientId')}
              />
            )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '16px' }}
            disabled={editUserMutation.isPending}
          >
            {editUserMutation.isPending ? 'Saving changes...' : 'Save Settings'}
          </button>
        </form>
      </Modal>

      {/* Password temporary display modal */}
      <Modal
        isOpen={tempPassword !== null}
        onClose={() => setTempPassword(null)}
        title="Account Credentials Ready"
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '0.95rem',
              lineHeight: 1.6,
            }}
          >
            The temporary password for this user is shown below. Please secure
            copy it now:
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-tertiary)',
              padding: '16px 20px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
            }}
          >
            <span
              style={{
                fontSize: '1.2rem',
                fontFamily: 'monospace',
                fontWeight: 700,
                letterSpacing: '0.05em',
                color: 'var(--primary)',
              }}
            >
              {tempPassword}
            </span>
            <button
              onClick={handleCopy}
              className="btn btn-secondary"
              style={{ padding: '8px', minWidth: '40px', height: '40px' }}
            >
              {copied ? (
                <Check size={18} style={{ color: 'var(--success)' }} />
              ) : (
                <Copy size={18} />
              )}
            </button>
          </div>

          <p
            style={{
              fontSize: '0.8rem',
              color: 'var(--danger)',
              fontWeight: 500,
            }}
          >
            ⚠️ This password will not be shown again.
          </p>

          <button
            onClick={() => setTempPassword(null)}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            Dismiss Credentials
          </button>
        </div>
      </Modal>

      {/* Status Toggle Confirm */}
      <ConfirmationDialog
        isOpen={statusConfirm.isOpen}
        onClose={() => setStatusConfirm((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={() =>
          toggleStatusMutation.mutate({
            id: statusConfirm.userId,
            isActive: statusConfirm.targetStatus,
          })
        }
        title={statusConfirm.targetStatus ? 'Activate User' : 'Deactivate User'}
        description={`Are you sure you want to ${statusConfirm.targetStatus ? 'activate' : 'deactivate'} user "${statusConfirm.email}"? ${
          !statusConfirm.targetStatus
            ? 'They will not be able to log in to the portal.'
            : ''
        }`}
        confirmText={statusConfirm.targetStatus ? 'Activate' : 'Deactivate'}
        isDanger={!statusConfirm.targetStatus}
        isLoading={toggleStatusMutation.isPending}
      />

      {/* Password Reset Confirm */}
      <ConfirmationDialog
        isOpen={resetConfirm.isOpen}
        onClose={() => setResetConfirm((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={() => resetPasswordMutation.mutate(resetConfirm.userId)}
        title="Reset User Password"
        description={`Are you sure you want to reset the password for user "${resetConfirm.email}"? A new random temporary password will be generated for them.`}
        confirmText="Reset Password"
        isDanger={true}
        isLoading={resetPasswordMutation.isPending}
      />
    </div>
  );
}
