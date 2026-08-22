'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Plus, Edit2, Eye, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';

import { apiClient } from '../../lib/axios';
import { ApiResponse } from '../../types/api';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import SearchBar from '../../components/ui/SearchBar';
import StatusChip from '../../components/ui/StatusChip';
import ConfirmationDialog from '../../components/ui/ConfirmationDialog';

interface Client {
  id: string;
  clientCode: string;
  companyName: string;
  email: string;
  authorizedPerson?: string | null;
  phone?: string | null;
  subscriptionStatus: string;
  identificationMethod: string;
  maxEmployees: number;
  maxCheckpoints: number;
  isActive: boolean;
  createdAt: string;
}

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1;
  const search = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || 'ALL';

  const updateUrlParams = (newPage: number, newSearch: string, newStatus: string) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    if (newPage > 1) {
      current.set('page', String(newPage));
    } else {
      current.delete('page');
    }
    if (newSearch.trim()) {
      current.set('search', newSearch.trim());
    } else {
      current.delete('search');
    }
    if (newStatus !== 'ALL') {
      current.set('status', newStatus);
    } else {
      current.delete('status');
    }
    const query = current.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const handlePageChange = (p: number) => {
    updateUrlParams(p, search, statusFilter);
  };

  const handleSearchChange = (s: string) => {
    updateUrlParams(1, s, statusFilter);
  };

  const handleStatusFilterChange = (st: string) => {
    updateUrlParams(1, search, st);
  };
  
  // Sort State
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Confirmation state for Activation/Deactivation
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    clientId: string;
    companyName: string;
    targetStatus: boolean;
  }>({
    isOpen: false,
    clientId: '',
    companyName: '',
    targetStatus: false,
  });

  // Query Client List
  const { data, isLoading } = useQuery<ApiResponse<{ items: Client[]; pagination: { totalPages: number } }>>({
    queryKey: ['clients', page, search],
    queryFn: () =>
      apiClient.get('/clients', {
        params: {
          page,
          limit: 10,
          search: search || undefined,
        },
      }),
    placeholderData: keepPreviousData,
  });

  // Status toggle mutation
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/clients/${id}`, { isActive }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success(
        `Client "${confirmDialog.companyName}" successfully ${
          variables.isActive ? 'activated' : 'deactivated'
        }.`
      );
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update client status.');
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    },
  });



  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
  };

  const openStatusConfirm = (client: Client, targetStatus: boolean) => {
    setConfirmDialog({
      isOpen: true,
      clientId: client.id,
      companyName: client.companyName,
      targetStatus,
    });
  };

  const handleConfirmStatusChange = () => {
    toggleStatusMutation.mutate({
      id: confirmDialog.clientId,
      isActive: confirmDialog.targetStatus,
    });
  };

  // Filter & Sort current data client-side
  let clients = data?.data?.items || [];
  
  if (statusFilter !== 'ALL') {
    clients = clients.filter((c) => c.subscriptionStatus === statusFilter);
  }

  // Sort logic
  const sortedClients = [...clients].sort((a, b) => {
    let aVal: any = a[sortBy as keyof Client] ?? '';
    let bVal: any = b[sortBy as keyof Client] ?? '';

    if (sortBy === 'createdAt') {
      aVal = new Date(a.createdAt).getTime();
      bVal = new Date(b.createdAt).getTime();
    }

    if (typeof aVal === 'string') {
      return sortOrder === 'asc'
        ? aVal.localeCompare(bVal as string)
        : (bVal as string).localeCompare(aVal);
    } else {
      return sortOrder === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    }
  });

  const columns = [
    { key: 'clientCode', label: 'Code', sortable: true },
    { key: 'companyName', label: 'Company Name', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    {
      key: 'maxEmployees',
      label: 'Employee Limit',
      render: (row: Client) => <span>{row.maxEmployees ?? 50} Max</span>,
    },
    {
      key: 'maxCheckpoints',
      label: 'Checkpoint Limit',
      render: (row: Client) => <span>{row.maxCheckpoints ?? 50} Max</span>,
    },
    {
      key: 'subscriptionStatus',
      label: 'Subscription',
      sortable: true,
      render: (row: Client) => <StatusChip status={row.subscriptionStatus} />,
    },
    {
      key: 'isActive',
      label: 'Status',
      sortable: true,
      render: (row: Client) => <StatusChip status={row.isActive} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: Client) => (
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link
            href={`/dashboard/clients/${row.id}`}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.8rem', gap: '4px' }}
            title="View Details"
          >
            <Eye size={14} />
            <span>Details</span>
          </Link>
          <Link
            href={`/dashboard/clients/${row.id}/edit`}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.8rem', gap: '4px' }}
            title="Edit Client"
          >
            <Edit2 size={14} />
            <span>Edit</span>
          </Link>
          <button
            onClick={() => openStatusConfirm(row, !row.isActive)}
            className="btn btn-secondary"
            style={{
              padding: '6px 10px',
              fontSize: '0.8rem',
              gap: '4px',
              color: row.isActive ? 'var(--danger)' : 'var(--success)',
            }}
            title={row.isActive ? 'Deactivate' : 'Activate'}
          >
            {row.isActive ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
            <span>{row.isActive ? 'Deactivate' : 'Activate'}</span>
          </button>
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
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%', maxWidth: '640px' }}>
          <SearchBar
            value={search}
            onChange={handleSearchChange}
            placeholder="Search by company or email..."
          />
          
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className="form-input"
            style={{ maxWidth: '180px' }}
          >
            <option value="ALL">All Subscriptions</option>
            <option value="TRIAL">Trial</option>
            <option value="ACTIVE">Active</option>
            <option value="EXPIRED">Expired</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>

        <Link href="/dashboard/clients/new" className="btn btn-primary" style={{ gap: '8px' }}>
          <Plus size={16} />
          <span>Create Client</span>
        </Link>
      </div>

      <DataTable
        columns={columns}
        data={sortedClients}
        isLoading={isLoading}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        emptyMessage="No clients found matching criteria."
      />

      <Pagination
        currentPage={page}
        totalPages={data?.data?.pagination?.totalPages || 1}
        onPageChange={handlePageChange}
      />

      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmStatusChange}
        title={confirmDialog.targetStatus ? 'Activate Client' : 'Deactivate Client'}
        description={`Are you sure you want to ${
          confirmDialog.targetStatus ? 'activate' : 'deactivate'
        } client "${confirmDialog.companyName}"? This will affect login abilities for their admin and employees.`}
        confirmText={confirmDialog.targetStatus ? 'Activate' : 'Deactivate'}
        isDanger={!confirmDialog.targetStatus}
        isLoading={toggleStatusMutation.isPending}
      />
    </div>
  );
}
