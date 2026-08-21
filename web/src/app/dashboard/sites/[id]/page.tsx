'use client';

import React, { useState } from 'react';
import { useParams, useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Edit, Plus, MapPin, ToggleLeft, ToggleRight, QrCode, CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

import { apiClient } from '../../../lib/axios';
import { ApiResponse } from '../../../types/api';
import DataTable from '../../../components/ui/DataTable';
import LoadingState from '../../../components/ui/LoadingState';
import Pagination from '../../../components/ui/Pagination';
import SearchBar from '../../../components/ui/SearchBar';
import Modal from '../../../components/ui/Modal';
import ConfirmationDialog from '../../../components/ui/ConfirmationDialog';
import { FormInput } from '../../../components/ui/FormControls';
import StatusChip from '../../../components/ui/StatusChip';
import GateSubTasksModal from '../components/GateSubTasksModal';
import CheckpointQrModal from '../components/CheckpointQrModal';

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
  client?: { id: string; companyName: string } | null;
}

interface Gate {
  id: string;
  gateCode: string;
  name: string;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  sequence: number;
  isActive: boolean;
}

const gateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  latitude: z.any().optional(),
  longitude: z.any().optional(),
  sequence: z.any(),
});

type GateValues = z.infer<typeof gateSchema>;

export default function SiteDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  // Dialog / Modal state
  const [isGateModalOpen, setIsGateModalOpen] = useState(false);
  const [editingGate, setEditingGate] = useState<Gate | null>(null);

  const [confirmGateStatus, setConfirmGateStatus] = useState<{
    isOpen: boolean;
    gateId: string;
    gateName: string;
    targetStatus: boolean;
  }>({
    isOpen: false,
    gateId: '',
    gateName: '',
    targetStatus: false,
  });

  const [subTaskModal, setSubTaskModal] = useState<{
    isOpen: boolean;
    gateId: string;
    gateName: string;
  }>({
    isOpen: false,
    gateId: '',
    gateName: '',
  });

  const [qrModal, setQrModal] = useState<{
    isOpen: boolean;
    gate: Gate | null;
  }>({
    isOpen: false,
    gate: null,
  });

  // Dynamic Pagination & Search state for gates synced via URL
  const gatePage = searchParams.get('gatePage') ? Number(searchParams.get('gatePage')) : 1;
  const gateSearch = searchParams.get('gateSearch') || '';

  const updateUrlParams = (newPage: number, newSearch: string) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));

    if (newPage > 1) {
      current.set('gatePage', String(newPage));
    } else {
      current.delete('gatePage');
    }

    if (newSearch.trim()) {
      current.set('gateSearch', newSearch.trim());
    } else {
      current.delete('gateSearch');
    }

    const query = current.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const handleGateSearchChange = (val: string) => {
    updateUrlParams(1, val);
  };

  const handleGatePageChange = (newPage: number) => {
    updateUrlParams(newPage, gateSearch);
  };

  // Fetch Site Details
  const { data: siteRes, isLoading: isSiteLoading } = useQuery<ApiResponse<Site>>({
    queryKey: ['site', id],
    queryFn: () => apiClient.get(`/sites/${id}`),
  });

  // Fetch Site Gates (Paginated & Searched)
  const { data: gatesRes, isLoading: isGatesLoading } = useQuery<ApiResponse<Gate[]> & { pagination?: any }>({
    queryKey: ['gates', id, gatePage, gateSearch],
    queryFn: () =>
      apiClient.get('/gates', {
        params: {
          siteId: id,
          page: gatePage,
          limit: 10,
          search: gateSearch.trim() || undefined,
        },
      }),
    placeholderData: (previousData) => previousData,
  });

  const site = siteRes?.data;
  const gates = Array.isArray(gatesRes?.data)
    ? gatesRes.data
    : (gatesRes?.data as any)?.items || [];
  const gatePagination =
    gatesRes?.pagination ||
    (gatesRes as any)?.pagination || {
      page: 1,
      limit: 10,
      total: gates.length,
      totalPages: 1,
    };

  // Query Resource Limits for Client
  const { data: limitsRes } = useQuery<ApiResponse<any>>({
    queryKey: ['resource-limits'],
    queryFn: () => apiClient.get('/clients/resource-limits'),
  });
  const limits = limitsRes?.data;

  const {
    register: registerGate,
    handleSubmit: handleGateSubmit,
    reset: resetGate,
    formState: { errors: gateErrors },
  } = useForm<GateValues>({
    resolver: zodResolver(gateSchema),
  });

  // Create Gate mutation
  const createGateMutation = useMutation({
    mutationFn: (values: GateValues) => apiClient.post('/gates', { ...values, siteId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gates', id] });
      toast.success('Security gate checkpoint added successfully!');
      setIsGateModalOpen(false);
      resetGate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to add gate.');
    },
  });

  // Update Gate mutation
  const updateGateMutation = useMutation({
    mutationFn: ({ gateId, values }: { gateId: string; values: GateValues }) =>
      apiClient.patch(`/gates/${gateId}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gates', id] });
      toast.success('Gate checkpoint settings updated.');
      setIsGateModalOpen(false);
      setEditingGate(null);
      resetGate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update gate.');
    },
  });

  // Toggle Gate Status mutation
  const toggleGateStatusMutation = useMutation({
    mutationFn: ({ gateId, isActive }: { gateId: string; isActive: boolean }) =>
      apiClient.patch(`/gates/${gateId}/${isActive ? 'activate' : 'deactivate'}`),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['gates', id] });
      toast.success(`Gate checkpoint ${vars.isActive ? 'activated' : 'deactivated'}.`);
      setConfirmGateStatus((prev) => ({ ...prev, isOpen: false }));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to toggle gate status.');
      setConfirmGateStatus((prev) => ({ ...prev, isOpen: false }));
    },
  });

  const handleOpenAddGate = () => {
    if (limits && limits.remainingCheckpoints === 0) {
      toast.error(
        `Checkpoint creation limit reached. Maximum allowed across client: ${limits.maxCheckpoints}. Current count: ${limits.currentCheckpointCount}.`
      );
      return;
    }
    setEditingGate(null);
    resetGate({
      name: '',
      description: '',
      latitude: undefined,
      longitude: undefined,
      sequence: gates.length + 1,
    });
    setIsGateModalOpen(true);
  };

  const handleOpenEditGate = (gate: Gate) => {
    setEditingGate(gate);
    resetGate({
      name: gate.name,
      description: gate.description || '',
      latitude: gate.latitude ?? undefined,
      longitude: gate.longitude ?? undefined,
      sequence: gate.sequence,
    });
    setIsGateModalOpen(true);
  };

  const handleOpenQrModal = (gate: Gate) => {
    setQrModal({ isOpen: true, gate });
  };

  const onSubmitGate = (values: GateValues) => {
    const payload = {
      name: values.name,
      description: values.description || undefined,
      sequence: Number(values.sequence),
      latitude: values.latitude === '' || values.latitude === undefined ? undefined : Number(values.latitude),
      longitude: values.longitude === '' || values.longitude === undefined ? undefined : Number(values.longitude),
    };
    if (editingGate) {
      updateGateMutation.mutate({ gateId: editingGate.id, values: payload as any });
    } else {
      createGateMutation.mutate(payload as any);
    }
  };

  const gateColumns = [
    { key: 'sequence', label: 'Seq #', sortable: true },
    { key: 'gateCode', label: 'Gate Code', sortable: true },
    { key: 'name', label: 'Gate / Checkpoint Name', sortable: true },
    {
      key: 'coordinates',
      label: 'GPS Coordinates',
      render: (row: Gate) => (
        <span>
          {row.latitude && row.longitude
            ? `${row.latitude.toFixed(5)}, ${row.longitude.toFixed(5)}`
            : 'No GPS coords'}
        </span>
      ),
    },
    { key: 'description', label: 'Checkpoint Description' },
    {
      key: 'isActive',
      label: 'Status',
      render: (row: Gate) => <StatusChip status={row.isActive} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: Gate) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => handleOpenQrModal(row)}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.8rem', gap: '4px', color: 'var(--primary)' }}
            title="Print or Download Checkpoint QR"
          >
            <QrCode size={14} />
            <span>QR Code</span>
          </button>
          <button
            onClick={() => setSubTaskModal({ isOpen: true, gateId: row.id, gateName: row.name })}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.8rem', gap: '4px', color: 'var(--primary)' }}
            title="Configure Verification Sub-Tasks"
          >
            <CheckSquare size={14} />
            <span>Sub Tasks ({(row as any).subTasks?.length || 0})</span>
          </button>
          <button
            onClick={() => handleOpenEditGate(row)}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.8rem', gap: '4px' }}
          >
            <Edit size={12} />
            <span>Edit</span>
          </button>
          <button
            onClick={() =>
              setConfirmGateStatus({
                isOpen: true,
                gateId: row.id,
                gateName: row.name,
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
            {row.isActive ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
            <span>{row.isActive ? 'Deactivate' : 'Activate'}</span>
          </button>
        </div>
      ),
    },
  ];

  if (isSiteLoading) {
    return <LoadingState message="Loading site & gates details..." variant="page" />;
  }

  if (!site) {
    return (
      <div className="error-panel glass-card" style={{ maxWidth: '600px', margin: '50px auto' }}>
        <h3>Monitored Site Not Found</h3>
        <p>The requested site may have been deleted or moved.</p>
        <Link href="/dashboard/sites" className="btn btn-primary" style={{ marginTop: '16px', textDecoration: 'none' }}>
          Back to Sites
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Back button */}
      <div>
        <Link
          href="/dashboard/sites"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: 'var(--text-secondary)', fontWeight: 500 }}
        >
          <ArrowLeft size={16} />
          <span>Back to Sites List</span>
        </Link>
      </div>

      {/* Main Details Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
        <div className="glass-card" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                SITE CODE: {site.siteCode}
              </span>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 700, margin: '4px 0 8px 0' }}>{site.name}</h2>
              <StatusChip status={site.isActive} />
            </div>

            <Link
              href={`/dashboard/sites/${site.id}/edit`}
              className="btn btn-secondary"
              style={{ gap: '6px', fontSize: '0.85rem', textDecoration: 'none' }}
            >
              <Edit size={14} />
              <span>Modify Configs</span>
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>STREET ADDRESS</p>
              <p style={{ fontSize: '0.95rem', margin: 0, fontWeight: 500 }}>{site.address || 'No Address Listed'}</p>
            </div>

            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>DESCRIPTION / POST ORDERS</p>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                {site.description || 'No specific post orders or instructions registered for this site.'}
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '28px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={18} className="text-primary" />
            <span>Post GPS Scope</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>GEOLOCATION</p>
              <p style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>
                {site.latitude && site.longitude
                  ? `${site.latitude.toFixed(6)}, ${site.longitude.toFixed(6)}`
                  : 'Coordinates Unset'}
              </p>
            </div>

            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>VALIDATION RADIUS</p>
              <p style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>{site.radius} meters</p>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>PRIMARY SITE MANAGER</p>
              <p style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 4px 0' }}>
                {site.contactPerson || 'Unassigned'}
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                {site.contactPhone || ''}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Gates / Checkpoint List */}
      <div className="glass-card" style={{ padding: '28px', marginTop: '32px' }}>
        {limits && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: 'var(--surface-color)',
              border: limits.remainingCheckpoints === 0 ? '1px solid #ef4444' : '1px solid var(--border-color)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Client Checkpoint Resource Usage
              </span>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, marginTop: '2px' }}>
                {limits.currentCheckpointCount} / {limits.maxCheckpoints} Checkpoints Created Across Client ({limits.remainingCheckpoints} Remaining)
              </div>
            </div>
            {limits.remainingCheckpoints === 0 && (
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.15)', padding: '4px 8px', borderRadius: '4px' }}>
                ⚠️ Checkpoint Limit Reached
              </span>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0 }}>Security Gates & Patrol Checkpoints</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Chronological check-in sequence for guard patrols.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <SearchBar
              value={gateSearch}
              onChange={handleGateSearchChange}
              placeholder="Search checkpoints by name or ID..."
            />
            <button onClick={handleOpenAddGate} className="btn btn-primary" style={{ gap: '8px' }}>
              <Plus size={16} />
              <span>Add Checkpoint</span>
            </button>
          </div>
        </div>

        <DataTable
          columns={gateColumns}
          data={gates}
          isLoading={isGatesLoading}
          emptyMessage={
            gateSearch
              ? 'No security gate checkpoints found matching your search.'
              : "No gate checkpoints registered for this site yet. Click 'Add Checkpoint' to create one."
          }
        />

        <Pagination
          currentPage={gatePage}
          totalPages={gatePagination.totalPages}
          onPageChange={handleGatePageChange}
        />
      </div>

      {/* ADD/EDIT GATE CHECKPOINT MODAL */}
      <Modal
        isOpen={isGateModalOpen}
        onClose={() => setIsGateModalOpen(false)}
        title={editingGate ? 'Edit Checkpoint Details' : 'Add Security Gate Checkpoint'}
      >
        <form onSubmit={handleGateSubmit(onSubmitGate)} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <FormInput
            label="Checkpoint / Gate Name"
            placeholder="e.g. Back Loading Dock Gate B"
            error={gateErrors.name?.message as string | undefined}
            {...registerGate('name')}
          />

          <FormInput
            label="Sequence Number (Patrol Order)"
            type="number"
            error={gateErrors.sequence?.message as string | undefined}
            {...registerGate('sequence')}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <FormInput
              label="Latitude (Optional)"
              type="number"
              step="any"
              placeholder="e.g. 37.7749"
              error={gateErrors.latitude?.message as string | undefined}
              {...registerGate('latitude')}
            />

            <FormInput
              label="Longitude (Optional)"
              type="number"
              step="any"
              placeholder="e.g. -122.4194"
              error={gateErrors.longitude?.message as string | undefined}
              {...registerGate('longitude')}
            />
          </div>

          <div>
            <label className="form-label">Checkpoint Location Instructions</label>
            <textarea
              className="form-input"
              style={{ minHeight: '80px', resize: 'vertical' }}
              placeholder="e.g. Located on the outer perimeter fence next to dumpster."
              {...registerGate('description')}
            />
            {gateErrors.description?.message && (
              <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '4px' }}>
                {gateErrors.description.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '16px' }}
            disabled={createGateMutation.isPending || updateGateMutation.isPending}
          >
            {createGateMutation.isPending || updateGateMutation.isPending
              ? 'Saving gate configs...'
              : editingGate
              ? 'Save Gate'
              : 'Add Gate'}
          </button>
        </form>
      </Modal>

      {/* CONFIRM TOGGLE GATE STATUS */}
      <ConfirmationDialog
        isOpen={confirmGateStatus.isOpen}
        onClose={() => setConfirmGateStatus((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={() =>
          toggleGateStatusMutation.mutate({
            gateId: confirmGateStatus.gateId,
            isActive: confirmGateStatus.targetStatus,
          })
        }
        title={confirmGateStatus.targetStatus ? 'Activate Checkpoint' : 'Deactivate Checkpoint'}
        description={`Are you sure you want to ${
          confirmGateStatus.targetStatus ? 'activate' : 'deactivate'
        } checkpoint "${confirmGateStatus.gateName}"?`}
        confirmText={confirmGateStatus.targetStatus ? 'Activate' : 'Deactivate'}
        isDanger={!confirmGateStatus.targetStatus}
        isLoading={toggleGateStatusMutation.isPending}
      />

      <GateSubTasksModal
        isOpen={subTaskModal.isOpen}
        onClose={() => setSubTaskModal((prev) => ({ ...prev, isOpen: false }))}
        gateId={subTaskModal.gateId}
        gateName={subTaskModal.gateName}
      />

      <CheckpointQrModal
        isOpen={qrModal.isOpen}
        onClose={() => setQrModal({ isOpen: false, gate: null })}
        gate={qrModal.gate}
        siteName={site?.name || ''}
        companyName={(site as any)?.client?.companyName || 'HELLO ORBIT'}
      />
    </div>
  );
}
