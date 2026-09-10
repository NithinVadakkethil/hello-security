'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Eye, User, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../../lib/axios';
import { CentralCompanyHeader } from '../components/CentralCompanyHeader';
import {
  CentralManagerOrganizationSelector,
  OrganizationMetric,
} from '../components/CentralManagerOrganizationSelector';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import SearchBar from '../../components/ui/SearchBar';
import StatusChip from '../../components/ui/StatusChip';

const ROLE_LABELS: Record<string, string> = {
  SECURITY: 'Security Guard',
  SECURITY_GUARD: 'Security Guard',
  TECHNICIAN: 'Technician',
  CLEANER: 'House Keeping',
  SERVICE_ENGINEER: 'Service Engineer',
  SUPERVISOR: 'Supervisor',
  MANAGER: 'Manager',
  LIFE_GUARD: 'Lifeguard',
  PLUMBER: 'Plumber',
};

function getRoleLabel(role?: string): string {
  if (!role) return 'Employee';
  return ROLE_LABELS[role.toUpperCase()] || role.replace('_', ' ');
}

export default function CentralEmployeesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = searchParams?.get('clientId') || '';

  const [organizations, setOrganizations] = useState<OrganizationMetric[]>([]);
  const [isOrgsLoading, setIsOrgsLoading] = useState(true);
  const [orgsError, setOrgsError] = useState<string | null>(null);

  const [employees, setEmployees] = useState<any[]>([]);
  const [isEmployeesLoading, setIsEmployeesLoading] = useState(false);

  const [roleCounts, setRoleCounts] = useState<{ total: number; byRole: { role: string; count: number }[] }>({
    total: 0,
    byRole: [],
  });

  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>(searchParams?.get('role') || '');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);

  useEffect(() => {
    const roleParam = searchParams?.get('role') || '';
    if (roleParam !== selectedRole) {
      setSelectedRole(roleParam);
    }
  }, [searchParams]);

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  // 1. Fetch assigned organizations
  const fetchOrganizations = async () => {
    setIsOrgsLoading(true);
    setOrgsError(null);
    try {
      const res: any = await apiClient.get('/central-manager/organizations');
      const orgsList = res?.data || (Array.isArray(res) ? res : []);
      setOrganizations(orgsList);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Unable to load assigned organizations. Please try again.';
      setOrgsError(msg);
      toast.error(msg);
    } finally {
      setIsOrgsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  // 2. Fetch role counts for selected organization
  const fetchRoleCounts = async (targetClientId: string) => {
    try {
      const res: any = await apiClient.get(`/central-manager/employee-role-counts?clientId=${targetClientId}`);
      const data = res?.data || res;
      setRoleCounts(data || { total: 0, byRole: [] });
    } catch (err) {
      // ignore
    }
  };

  // 3. Fetch employees list for selected organization
  const fetchEmployees = async (targetClientId: string, roleFilter?: string, searchQuery?: string) => {
    setIsEmployeesLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('clientId', targetClientId);
      if (roleFilter) params.set('role', roleFilter);
      if (searchQuery) params.set('search', searchQuery);

      const res: any = await apiClient.get(`/central-manager/employees?${params.toString()}`);
      const empList = res?.data || (Array.isArray(res) ? res : []);
      setEmployees(empList);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to fetch employees.');
    } finally {
      setIsEmployeesLoading(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      fetchRoleCounts(clientId);
      fetchEmployees(clientId, selectedRole, search);
    }
  }, [clientId, selectedRole, search]);

  const handleSelectOrganization = (id: string) => {
    setSelectedRole('');
    setSearch('');
    setPage(1);
    router.push(`/central/employees?clientId=${id}`);
  };

  const handleBackToOrganizations = () => {
    setSelectedRole('');
    setSearch('');
    setPage(1);
    router.push('/central/employees');
  };

  // Filter employees locally for status filter
  const filteredEmployees = employees.filter((emp) => {
    if (selectedStatus !== 'ALL' && emp.status !== selectedStatus) return false;
    return true;
  });

  // Pagination calculation
  const limit = pageSize === 'all' ? filteredEmployees.length : Number(pageSize);
  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / (limit || 1)));
  const safePage = Math.min(page, totalPages);
  const paginatedEmployees = pageSize === 'all' ? filteredEmployees : filteredEmployees.slice((safePage - 1) * limit, safePage * limit);

  // DataTable columns definition
  const columns = [
    {
      key: 'employee',
      label: 'Employee',
      render: (row: any) => {
        const initials = row.firstName ? row.firstName[0].toUpperCase() : 'E';
        const fullName = `${row.firstName || ''} ${row.lastName || ''}`.trim() || 'Employee';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'rgba(37, 99, 235, 0.12)',
                color: '#2563eb',
                fontWeight: 700,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{fullName}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '1px' }}>{row.email || 'No Email'}</div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'employeeNumber',
      label: 'Emp Code',
      render: (row: any) => (
        <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
          {row.employeeNumber || 'N/A'}
        </span>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (row: any) => (
        <span
          style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: '12px',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            color: '#2563eb',
            textTransform: 'uppercase',
          }}
        >
          {getRoleLabel(row.role)}
        </span>
      ),
    },
    {
      key: 'designation',
      label: 'Designation',
      render: (row: any) => <span style={{ color: 'var(--text-secondary)' }}>{row.designation || 'Staff Member'}</span>,
    },
    {
      key: 'site',
      label: 'Assigned Site',
      render: (row: any) => (
        <span style={{ color: 'var(--text-secondary)' }}>{row.assignments?.[0]?.site?.name || 'Unassigned'}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: any) => <StatusChip status={row.status || 'ACTIVE'} />,
    },
    {
      key: 'actions',
      label: 'Action',
      render: (row: any) => (
        <button
          onClick={() => setSelectedEmployee(row)}
          className="btn btn-secondary"
          style={{ padding: '6px 12px', fontSize: '0.8rem', gap: '6px', cursor: 'pointer' }}
        >
          <Eye size={14} />
          <span>View</span>
        </button>
      ),
    },
  ];

  // If no company selected, render Organization Selector
  if (!clientId) {
    return (
      <CentralManagerOrganizationSelector
        moduleName="Employees"
        organizations={organizations}
        isLoading={isOrgsLoading}
        error={orgsError}
        onRetry={fetchOrganizations}
        onSelectOrganization={handleSelectOrganization}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Employees</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
          Read-only employee directory for selected organization.
        </p>
      </div>

      {/* Organization Context Bar */}
      <CentralCompanyHeader
        selectedClientId={clientId}
        organizations={organizations}
        moduleName="Employees"
        onBackToOrganizations={handleBackToOrganizations}
        onSelectOrganization={handleSelectOrganization}
      />

      {/* Role Summary Filter Chips */}
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
        <button
          type="button"
          onClick={() => {
            setSelectedRole('');
            setPage(1);
          }}
          className={`btn ${selectedRole === '' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            padding: '8px 16px',
            fontSize: '0.85rem',
            borderRadius: '20px',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
          }}
        >
          All Employees ({roleCounts.total})
        </button>

        {roleCounts.byRole.map((r) => {
          const isSelected = selectedRole === r.role;
          return (
            <button
              key={r.role}
              type="button"
              onClick={() => {
                setSelectedRole(r.role);
                setPage(1);
              }}
              className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                padding: '8px 16px',
                fontSize: '0.85rem',
                borderRadius: '20px',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              {getRoleLabel(r.role)} ({r.count})
            </button>
          );
        })}
      </div>

      {/* Search & Filter Toolbar */}
      <div
        className="glass-card"
        style={{
          padding: '16px 20px',
          borderRadius: '12px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <SearchBar
          value={search}
          onChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          placeholder="Search employees by name, ID number or email..."
        />

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="form-input"
            style={{ maxWidth: '160px', fontSize: '0.85rem' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
      </div>

      {/* Employee Data Table */}
      <DataTable
        columns={columns}
        data={paginatedEmployees}
        isLoading={isEmployeesLoading}
        emptyMessage="No employees found for this organization."
      />

      {/* Pagination */}
      <Pagination
        currentPage={safePage}
        totalPages={totalPages}
        onPageChange={(p) => setPage(p)}
        pageSize={pageSize}
        pageSizeOptions={[10, 25, 50, 'all']}
        onPageSizeChange={(sz) => {
          setPageSize(sz);
          setPage(1);
        }}
        totalRecords={filteredEmployees.length}
      />

      {/* Read-Only Employee Details Modal */}
      {selectedEmployee && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '540px',
              padding: '24px',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <User size={20} style={{ color: '#2563EB' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Employee Details (Read-Only)
                </h3>
              </div>
              <button
                onClick={() => setSelectedEmployee(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.9rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                    FULL NAME
                  </span>
                  <p style={{ margin: '2px 0 0 0', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {selectedEmployee.firstName} {selectedEmployee.lastName || ''}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                    EMPLOYEE CODE
                  </span>
                  <p style={{ margin: '2px 0 0 0', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                    {selectedEmployee.employeeNumber}
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                    ROLE
                  </span>
                  <p style={{ margin: '2px 0 0 0' }}>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(37, 99, 235, 0.1)',
                        color: '#2563eb',
                      }}
                    >
                      {getRoleLabel(selectedEmployee.role)}
                    </span>
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                    DESIGNATION
                  </span>
                  <p style={{ margin: '2px 0 0 0', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {selectedEmployee.designation || 'Staff Member'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                    ORGANIZATION
                  </span>
                  <p style={{ margin: '2px 0 0 0', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {selectedEmployee.client?.companyName || 'N/A'}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                    STATUS
                  </span>
                  <p style={{ margin: '2px 0 0 0' }}>
                    <StatusChip status={selectedEmployee.status || 'ACTIVE'} />
                  </p>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                  EMAIL
                </span>
                <p style={{ margin: '2px 0 0 0', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedEmployee.email || 'N/A'}</p>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                  PHONE
                </span>
                <p style={{ margin: '2px 0 0 0', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedEmployee.phone || selectedEmployee.phoneNumber || 'N/A'}</p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
              <button onClick={() => setSelectedEmployee(null)} className="btn btn-secondary" style={{ padding: '8px 18px', fontSize: '0.85rem' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
