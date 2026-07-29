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

interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  designation?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  identificationMethod: 'QR' | 'RFID';
  createdAt: string;
}

export default function EmployeesPage() {
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
    employeeId: string;
    name: string;
    targetStatus: boolean;
  }>({
    isOpen: false,
    employeeId: '',
    name: '',
    targetStatus: false,
  });

  // Query Employees List
  const { data: employeesRes, isLoading } = useQuery<ApiResponse<Employee[]>>({
    queryKey: ['employees'],
    queryFn: () => apiClient.get('/employees'),
    refetchOnMount: true,
    staleTime: 0,
  });

  // Query Resource Limits for Client
  const { data: limitsRes } = useQuery<ApiResponse<any>>({
    queryKey: ['resource-limits'],
    queryFn: () => apiClient.get('/clients/resource-limits'),
  });
  const limits = limitsRes?.data;

  // Status toggle mutation
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/employees/${id}/${isActive ? 'activate' : 'deactivate'}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success(
        `Employee "${confirmDialog.name}" successfully ${
          variables.isActive ? 'activated' : 'deactivated'
        }.`
      );
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update employee status.');
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

  const openStatusConfirm = (employee: Employee, targetStatus: boolean) => {
    setConfirmDialog({
      isOpen: true,
      employeeId: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
      targetStatus,
    });
  };

  const handleConfirmStatusChange = () => {
    toggleStatusMutation.mutate({
      id: confirmDialog.employeeId,
      isActive: confirmDialog.targetStatus,
    });
  };

  // Local filtering & pagination
  let employees = employeesRes?.data || [];

  if (search) {
    const s = search.toLowerCase();
    employees = employees.filter(
      (c) =>
        c.firstName.toLowerCase().includes(s) ||
        c.lastName.toLowerCase().includes(s) ||
        c.employeeNumber.toLowerCase().includes(s) ||
        (c.email && c.email.toLowerCase().includes(s))
    );
  }

  if (statusFilter !== 'ALL') {
    employees = employees.filter((c) => c.status === statusFilter);
  }

  // Sort logic
  const sortedEmployees = [...employees].sort((a, b) => {
    let aVal: any = a[sortBy as keyof Employee] ?? '';
    let bVal: any = b[sortBy as keyof Employee] ?? '';

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

  const limit = 10;
  const totalPages = Math.max(1, Math.ceil(sortedEmployees.length / limit));
  const safePage = Math.min(page, totalPages);
  const paginatedEmployees = sortedEmployees.slice((safePage - 1) * limit, safePage * limit);

  const columns = [
    { key: 'employeeNumber', label: 'ID Number', sortable: true },
    {
      key: 'name',
      label: 'Staff Name',
      sortable: true,
      render: (row: Employee) => (
        <span style={{ fontWeight: 600 }}>
          {row.firstName} {row.lastName}
        </span>
      ),
    },
    { key: 'designation', label: 'Designation / Role', sortable: true },
    { key: 'email', label: 'Email Address' },
    { key: 'phone', label: 'Phone' },
    {
      key: 'identificationMethod',
      label: 'ID Method',
      render: (row: Employee) => (
        <span style={{ fontSize: '0.8rem', padding: '2px 6px', background: 'var(--bg-tertiary)', borderRadius: '4px', fontWeight: 500 }}>
          {row.identificationMethod}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row: Employee) => <StatusChip status={row.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: Employee) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link
            href={`/dashboard/employees/${row.id}`}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.8rem', gap: '4px', textDecoration: 'none' }}
          >
            <Eye size={14} />
            <span>Details</span>
          </Link>
          <Link
            href={`/dashboard/employees/${row.id}/edit`}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.8rem', gap: '4px', textDecoration: 'none' }}
          >
            <Edit2 size={14} />
            <span>Edit</span>
          </Link>
          <button
            onClick={() => openStatusConfirm(row, row.status !== 'ACTIVE')}
            className="btn btn-secondary"
            style={{
              padding: '6px 10px',
              fontSize: '0.8rem',
              gap: '4px',
              color: row.status === 'ACTIVE' ? 'var(--danger)' : 'var(--success)',
            }}
          >
            {row.status === 'ACTIVE' ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
            <span>{row.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {limits && (
        <div
          className="glass-card"
          style={{
            padding: '16px 20px',
            borderRadius: '12px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderLeft: limits.remainingEmployees === 0 ? '4px solid #ef4444' : '4px solid #3b82f6',
          }}
        >
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Employee Resource Limit Allocation
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: '2px' }}>
              {limits.currentEmployeeCount} / {limits.maxEmployees} Employees Created ({limits.remainingEmployees} Available)
            </div>
          </div>
          {limits.remainingEmployees === 0 && (
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '20px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
              }}
            >
              ⚠️ Employee Limit Reached
            </span>
          )}
        </div>
      )}

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
            placeholder="Search employees by name, ID number or email..."
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
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>

        <Link
          href="/dashboard/employees/new"
          className="btn btn-primary"
          style={{ gap: '8px', textDecoration: 'none' }}
        >
          <Plus size={16} />
          <span>Enroll Guard / Staff</span>
        </Link>
      </div>

      <DataTable
        columns={columns}
        data={paginatedEmployees}
        isLoading={isLoading}
        emptyMessage="No enrolled employees found."
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
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmStatusChange}
        title={confirmDialog.targetStatus ? 'Activate Employee' : 'Deactivate Employee'}
        description={`Are you sure you want to ${
          confirmDialog.targetStatus ? 'activate' : 'deactivate'
        } employee "${confirmDialog.name}"? ${
          !confirmDialog.targetStatus ? 'Associated system user account credentials will be disabled.' : ''
        }`}
        confirmText={confirmDialog.targetStatus ? 'Activate' : 'Deactivate'}
        isDanger={!confirmDialog.targetStatus}
        isLoading={toggleStatusMutation.isPending}
      />
    </div>
  );
}
