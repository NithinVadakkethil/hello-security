'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Eye, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';

import { apiClient } from '../../lib/axios';
import { ApiResponse } from '../../types/api';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import SearchBar from '../../components/ui/SearchBar';
import StatusChip from '../../components/ui/StatusChip';
import ConfirmationDialog from '../../components/ui/ConfirmationDialog';

interface Site {
  id: string;
  siteCode: string;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radius: number;
  contactPerson?: string | null;
  contactPhone?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: {
    gates: number;
    patrolRoutes: number;
  };
}

export default function SitesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Sort State
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Confirmation state for Activation/Deactivation
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    siteId: string;
    siteName: string;
    targetStatus: boolean;
  }>({
    isOpen: false,
    siteId: '',
    siteName: '',
    targetStatus: false,
  });

  // Query Sites List
  const { data, isLoading } = useQuery<ApiResponse<Site[]>>({
    queryKey: ['sites'],
    queryFn: () => apiClient.get('/sites'),
  });

  // Status toggle mutation
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/sites/${id}/${isActive ? 'activate' : 'deactivate'}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      toast.success(
        `Site "${confirmDialog.siteName}" successfully ${
          variables.isActive ? 'activated' : 'deactivated'
        }.`
      );
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update site status.');
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

  const openStatusConfirm = (site: Site, targetStatus: boolean) => {
    setConfirmDialog({
      isOpen: true,
      siteId: site.id,
      siteName: site.name,
      targetStatus,
    });
  };

  const handleConfirmStatusChange = () => {
    toggleStatusMutation.mutate({
      id: confirmDialog.siteId,
      isActive: confirmDialog.targetStatus,
    });
  };

  // Local filtering & sorting (since backend list returns full tenant array)
  let sites = data?.data || [];

  if (search) {
    const s = search.toLowerCase();
    sites = sites.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.siteCode.toLowerCase().includes(s) ||
        (c.address && c.address.toLowerCase().includes(s))
    );
  }

  if (statusFilter !== 'ALL') {
    const activeBool = statusFilter === 'ACTIVE';
    sites = sites.filter((c) => c.isActive === activeBool);
  }

  // Sort logic
  const sortedSites = [...sites].sort((a, b) => {
    let aVal: any = a[sortBy as keyof Site] ?? '';
    let bVal: any = b[sortBy as keyof Site] ?? '';

    if (sortBy === 'createdAt') {
      aVal = new Date(a.createdAt).getTime();
      bVal = new Date(b.createdAt).getTime();
    }

    if (typeof aVal === 'string') {
      return sortOrder === 'asc'
        ? aVal.localeCompare(bVal as string)
        : (bVal as string).localeCompare(aVal);
    } else {
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    }
  });

  // Client-side pagination
  const limit = 10;
  const totalPages = Math.max(1, Math.ceil(sortedSites.length / limit));
  const paginatedSites = sortedSites.slice((page - 1) * limit, page * limit);

  const columns = [
    { key: 'siteCode', label: 'Site Code', sortable: true },
    { key: 'name', label: 'Site Name', sortable: true },
    {
      key: 'location',
      label: 'Location Details',
      render: (row: Site) => (
        <span style={{ fontSize: '0.85rem' }}>
          {row.latitude && row.longitude
            ? `${row.latitude.toFixed(4)}, ${row.longitude.toFixed(4)} (Radius: ${row.radius}m)`
            : 'No GPS coordinates'}
        </span>
      ),
    },
    { key: 'contactPerson', label: 'Contact Manager' },
    {
      key: 'isActive',
      label: 'Status',
      sortable: true,
      render: (row: Site) => <StatusChip status={row.isActive} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: Site) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link
            href={`/dashboard/sites/${row.id}`}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.8rem', gap: '4px', textDecoration: 'none' }}
          >
            <Eye size={14} />
            <span>Details</span>
          </Link>
          <Link
            href={`/dashboard/sites/${row.id}/edit`}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.8rem', gap: '4px', textDecoration: 'none' }}
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
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            placeholder="Search sites by name, code or address..."
          />

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="form-input"
            style={{ maxWidth: '180px' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        <Link
          href="/dashboard/sites/new"
          className="btn btn-primary"
          style={{ gap: '8px', textDecoration: 'none' }}
        >
          <Plus size={16} />
          <span>Add Monitored Site</span>
        </Link>
      </div>

      <DataTable
        columns={columns}
        data={paginatedSites}
        isLoading={isLoading}
        emptyMessage="No monitored sites found."
        onSort={handleSort}
        sortBy={sortBy}
        sortOrder={sortOrder}
      />

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={(p) => setPage(p)}
      />

      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmStatusChange}
        title={confirmDialog.targetStatus ? 'Activate Monitored Site' : 'Deactivate Monitored Site'}
        description={`Are you sure you want to ${
          confirmDialog.targetStatus ? 'activate' : 'deactivate'
        } site "${confirmDialog.siteName}"?`}
        confirmText={confirmDialog.targetStatus ? 'Activate' : 'Deactivate'}
        isDanger={!confirmDialog.targetStatus}
        isLoading={toggleStatusMutation.isPending}
      />
    </div>
  );
}
