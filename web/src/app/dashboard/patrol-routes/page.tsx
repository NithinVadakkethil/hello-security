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

interface PatrolRoute {
  id: string;
  routeCode: string;
  name: string;
  description?: string | null;
  siteId: string;
  isActive: boolean;
  createdAt: string;
  site: {
    id: string;
    name: string;
  };
  routeGates?: {
    id: string;
    sequence: number;
  }[];
}

export default function PatrolRoutesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState('ALL');

  // Sort State
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [confirmStatus, setConfirmStatus] = useState<{
    isOpen: boolean;
    routeId: string;
    routeName: string;
    targetStatus: boolean;
  }>({
    isOpen: false,
    routeId: '',
    routeName: '',
    targetStatus: false,
  });

  // Query Patrol Routes
  const { data: routesRes, isLoading } = useQuery<ApiResponse<PatrolRoute[]>>({
    queryKey: ['patrol-routes'],
    queryFn: () => apiClient.get('/patrol-routes'),
  });

  // Query Sites (for filter dropdown)
  const { data: sitesRes } = useQuery<ApiResponse<{ id: string; name: string }[]>>({
    queryKey: ['sites-dropdown'],
    queryFn: () => apiClient.get('/sites'),
  });

  const sitesList = sitesRes?.data || [];

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/patrol-routes/${id}`, { isActive }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['patrol-routes'] });
      toast.success(
        `Patrol route "${confirmStatus.routeName}" successfully ${
          variables.isActive ? 'activated' : 'deactivated'
        }.`
      );
      setConfirmStatus((prev) => ({ ...prev, isOpen: false }));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update route status.');
      setConfirmStatus((prev) => ({ ...prev, isOpen: false }));
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

  const handleConfirmStatusChange = () => {
    toggleStatusMutation.mutate({
      id: confirmStatus.routeId,
      isActive: confirmStatus.targetStatus,
    });
  };

  // Local filtering & sorting
  let routes = routesRes?.data || [];

  if (search) {
    const s = search.toLowerCase();
    routes = routes.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.routeCode.toLowerCase().includes(s) ||
        c.site.name.toLowerCase().includes(s)
    );
  }

  if (siteFilter !== 'ALL') {
    routes = routes.filter((c) => c.siteId === siteFilter);
  }

  // Sort logic
  const sortedRoutes = [...routes].sort((a, b) => {
    let aVal: any = a[sortBy as keyof PatrolRoute] ?? '';
    let bVal: any = b[sortBy as keyof PatrolRoute] ?? '';

    if (sortBy === 'site') {
      aVal = a.site.name;
      bVal = b.site.name;
    } else if (sortBy === 'createdAt') {
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

  const limit = 10;
  const totalPages = Math.max(1, Math.ceil(sortedRoutes.length / limit));
  const safePage = Math.min(page, totalPages);
  const paginatedRoutes = sortedRoutes.slice((safePage - 1) * limit, safePage * limit);

  const columns = [
    { key: 'routeCode', label: 'Route Code', sortable: true },
    { key: 'name', label: 'Route Name', sortable: true },
    { key: 'site', label: 'Monitored Site', sortable: true, render: (row: PatrolRoute) => row.site.name },
    {
      key: 'checkpointsCount',
      label: 'Checkpoints',
      render: (row: PatrolRoute) => <span>{row.routeGates?.length || 0} gates</span>,
    },
    { key: 'description', label: 'Description' },
    {
      key: 'isActive',
      label: 'Status',
      sortable: true,
      render: (row: PatrolRoute) => <StatusChip status={row.isActive} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: PatrolRoute) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link
            href={`/dashboard/patrol-routes/${row.id}`}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.8rem', gap: '4px', textDecoration: 'none' }}
          >
            <Eye size={14} />
            <span>Details</span>
          </Link>
          <Link
            href={`/dashboard/patrol-routes/${row.id}/edit`}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.8rem', gap: '4px', textDecoration: 'none' }}
          >
            <Edit2 size={14} />
            <span>Edit</span>
          </Link>
          <button
            onClick={() =>
              setConfirmStatus({
                isOpen: true,
                routeId: row.id,
                routeName: row.name,
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
            placeholder="Search routes by name or code..."
          />

          <select
            value={siteFilter}
            onChange={(e) => {
              setSiteFilter(e.target.value);
              setPage(1);
            }}
            className="form-input"
            style={{ maxWidth: '180px' }}
          >
            <option value="ALL">All Sites</option>
            {sitesList.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </div>

        <Link
          href="/dashboard/patrol-routes/new"
          className="btn btn-primary"
          style={{ gap: '8px', textDecoration: 'none' }}
        >
          <Plus size={16} />
          <span>Create Route</span>
        </Link>
      </div>

      <DataTable
        columns={columns}
        data={paginatedRoutes}
        isLoading={isLoading}
        emptyMessage="No patrol routes configured."
        onSort={handleSort}
        sortBy={sortBy}
        sortOrder={sortOrder}
      />

      <Pagination
        currentPage={safePage}
        totalPages={totalPages}
        onPageChange={(p) => setPage(p)}
      />

      <ConfirmationDialog
        isOpen={confirmStatus.isOpen}
        onClose={() => setConfirmStatus((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmStatusChange}
        title={confirmStatus.targetStatus ? 'Activate Patrol Route' : 'Deactivate Patrol Route'}
        description={`Are you sure you want to ${
          confirmStatus.targetStatus ? 'activate' : 'deactivate'
        } patrol route "${confirmStatus.routeName}"?`}
        confirmText={confirmStatus.targetStatus ? 'Activate' : 'Deactivate'}
        isDanger={!confirmStatus.targetStatus}
        isLoading={toggleStatusMutation.isPending}
      />
    </div>
  );
}
