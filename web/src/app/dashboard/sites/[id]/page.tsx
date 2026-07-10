'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Edit, Plus, MapPin, RefreshCw, ToggleLeft, ToggleRight, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

import { apiClient } from '../../../lib/axios';
import { ApiResponse } from '../../../types/api';
import DataTable from '../../../components/ui/DataTable';
import Modal from '../../../components/ui/Modal';
import ConfirmationDialog from '../../../components/ui/ConfirmationDialog';
import { FormInput } from '../../../components/ui/FormControls';
import StatusChip from '../../../components/ui/StatusChip';

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

  // Fetch Site Details
  const { data: siteRes, isLoading: isSiteLoading } = useQuery<ApiResponse<Site>>({
    queryKey: ['site', id],
    queryFn: () => apiClient.get(`/sites/${id}`),
  });

  // Fetch Site Gates
  const { data: gatesRes, isLoading: isGatesLoading } = useQuery<ApiResponse<Gate[]>>({
    queryKey: ['gates', id],
    queryFn: () => apiClient.get('/gates', { params: { siteId: id } }),
  });

  const site = siteRes?.data;
  const gates = gatesRes?.data || [];

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

  const handlePrintQr = (gate: Gate) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Checkpoint QR - ${gate.name}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 90vh;
              margin: 0;
              background-color: #fff;
              color: #000;
            }
            .qr-card {
              border: 3px double #000;
              padding: 40px;
              text-align: center;
              max-width: 360px;
              width: 100%;
              border-radius: 12px;
            }
            .logo-header {
              font-size: 1.6rem;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-bottom: 4px;
              color: #000;
            }
            .site-title {
              font-size: 1.05rem;
              font-weight: 600;
              margin-bottom: 20px;
              color: #555;
            }
            .qr-img {
              width: 240px;
              height: 240px;
              margin: 15px auto;
              display: block;
            }
            .gate-title {
              font-size: 1.25rem;
              font-weight: 700;
              margin-top: 15px;
              margin-bottom: 4px;
            }
            .gate-code {
              font-size: 0.85rem;
              font-family: monospace;
              color: #555;
              margin-bottom: 20px;
            }
            .instructions {
              font-size: 0.75rem;
              color: #666;
              line-height: 1.4;
              border-top: 1px solid #ddd;
              padding-top: 15px;
            }
            @media print {
              body {
                height: auto;
              }
              .qr-card {
                border: 3px double #000 !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="qr-card">
            <div class="logo-header">Hello Security</div>
            <div class="site-title">${site?.name || 'Monitored Facility'}</div>
            <div class="gate-title">${gate.name}</div>
            <div class="gate-code">CHECKPOINT ID: ${gate.gateCode}</div>
            <img class="qr-img" src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(gate.id)}" alt="Checkpoint QR" />
            <div class="instructions">
              <strong>OFFICIAL SECURITY PERIMETER POST</strong><br />
              Scan this QR code using the Hello Security Guard mobile app to log check-in sequence status.
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
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
            onClick={() => handlePrintQr(row)}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.8rem', gap: '4px', color: 'var(--primary)' }}
          >
            <QrCode size={14} />
            <span>Print QR</span>
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
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
        <RefreshCw className="spin-animation" size={32} />
      </div>
    );
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
      <div className="glass-card" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0 }}>Security Gates & Patrol Checkpoints</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Chronological check-in sequence for guard patrols.
            </p>
          </div>

          <button onClick={handleOpenAddGate} className="btn btn-primary" style={{ gap: '8px' }}>
            <Plus size={16} />
            <span>Add Checkpoint</span>
          </button>
        </div>

        <DataTable
          columns={gateColumns}
          data={gates}
          isLoading={isGatesLoading}
          emptyMessage="No gate checkpoints registered for this site yet. Click 'Add Checkpoint' to create one."
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
    </div>
  );
}
