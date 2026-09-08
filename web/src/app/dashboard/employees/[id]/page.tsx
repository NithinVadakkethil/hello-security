'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Edit, Key, Shield, User, Mail, Phone, Check, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

import { apiClient } from '../../../lib/axios';
import { ApiResponse } from '../../../types/api';
import StatusChip from '../../../components/ui/StatusChip';
import Modal from '../../../components/ui/Modal';
import ConfirmationDialog from '../../../components/ui/ConfirmationDialog';
import LoadingState from '../../../components/ui/LoadingState';
import { formatPatrolDate, formatPatrolDateTime } from '@/lib/date-formatter';

interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  designation?: string | null;
  role?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  identificationMethod: 'QR' | 'RFID';
  joiningDate?: string | null;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    role: string;
    isActive: boolean;
    lastLogin?: string | null;
    rawPassword?: string | null;
  } | null;
}

export default function EmployeeDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Fetch Employee details
  const { data: employeeRes, isLoading, isError } = useQuery<ApiResponse<Employee>>({
    queryKey: ['employee', id],
    queryFn: () => apiClient.get(`/employees/${id}`),
  });

  const employee = employeeRes?.data;

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: (userId: string) => apiClient.post(`/users/${userId}/reset-password`),
    onSuccess: (res: any) => {
      toast.success('Password reset successful!');
      setIsResetConfirmOpen(false);
      if (res.data?.data?.temporaryPassword) {
        setTempPassword(res.data.data.temporaryPassword);
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to reset password.');
    },
  });

  const handleCopy = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      toast.success('Password copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading employee profile..." variant="page" />;
  }

  if (isError || !employee) {
    return (
      <div className="error-panel glass-card" style={{ maxWidth: '600px', margin: '50px auto' }}>
        <h3>Employee Record Not Found</h3>
        <p>The requested employee record could not be loaded.</p>
        <Link href="/dashboard/employees" className="btn btn-primary" style={{ marginTop: '16px', textDecoration: 'none' }}>
          Back to Employees
        </Link>
      </div>
    );
  }

  const getInitials = () => {
    const first = employee.firstName?.[0] || '';
    const last = employee.lastName?.[0] || '';
    return (first + last).toUpperCase() || 'E';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Back button */}
      <div>
        <Link
          href="/dashboard/employees"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: 'var(--text-secondary)', fontWeight: 500 }}
        >
          <ArrowLeft size={16} />
          <span>Back to Employee List</span>
        </Link>
      </div>

      {/* Main Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
        {/* Left Side: General Profile Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Header Card */}
          <div className="glass-card" style={{ padding: '32px', display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: 'var(--primary)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.8rem',
                fontWeight: 700,
                boxShadow: '0 0 20px var(--primary-glow)',
              }}
            >
              {getInitials()}
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                STAFF ID: {employee.employeeNumber}
              </span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '4px 0 8px 0' }}>
                {[employee.firstName, employee.lastName].filter(Boolean).join(' ')}
              </h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <StatusChip status={employee.status} />
                <span style={{ fontSize: '0.8rem', padding: '2px 8px', background: 'var(--bg-tertiary)', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                  ID Mode: {employee.identificationMethod}
                </span>
              </div>
            </div>

            <Link
              href={`/dashboard/employees/${employee.id}/edit`}
              className="btn btn-secondary"
              style={{ gap: '6px', fontSize: '0.85rem', textDecoration: 'none' }}
            >
              <Edit size={14} />
              <span>Edit Profile</span>
            </Link>
          </div>

          {/* Details Info List */}
          <div className="glass-card" style={{ padding: '28px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '20px' }}>Employee Specifications</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>DESIGNATION</p>
                <p style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>{employee.designation || 'Security Officer'}</p>
              </div>

              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>JOINED DATE</p>
                <p style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>
                  {employee.joiningDate ? formatPatrolDate(employee.joiningDate) : 'N/A'}
                </p>
              </div>

              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>EMAIL ADDRESS</p>
                <p style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail size={14} style={{ color: 'var(--text-muted)' }} />
                  <span>{employee.email || 'None'}</span>
                </p>
              </div>

              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>PHONE NUMBER</p>
                <p style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={14} style={{ color: 'var(--text-muted)' }} />
                  <span>{employee.phone || 'None'}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Associated User Account Details */}
        <div className="glass-card" style={{ padding: '28px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={18} className="text-primary" />
            <span>Portal Credentials</span>
          </h3>

          {employee.user ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>USER ROLE</p>
                <span style={{ fontSize: '0.8rem', padding: '3px 8px', background: 'var(--primary-glow)', color: 'var(--primary)', fontWeight: 600, borderRadius: '4px' }}>
                  {(employee.role || employee.user?.role || 'SECURITY').replace('_', ' ')}
                </span>
              </div>

              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>USER STATUS</p>
                <StatusChip status={employee.user.isActive} />
              </div>

              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>PORTAL USERNAME / EMAIL</p>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0, wordBreak: 'break-all' }}>
                  {employee.user.email}
                </p>
              </div>

              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>PORTAL PASSWORD</p>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0, fontFamily: 'monospace', color: 'var(--text)', background: 'var(--bg-tertiary)', padding: '6px 10px', borderRadius: '4px', display: 'inline-block' }}>
                  {employee.user.rawPassword || 'Hidden/Encrypted'}
                </p>
              </div>

              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>LAST PORTAL LOGIN</p>
                <p style={{ fontSize: '0.9rem', fontWeight: 500, margin: 0 }}>
                  {employee.user.lastLogin ? formatPatrolDateTime(employee.user.lastLogin, undefined, false) : 'Never logged in'}
                </p>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '10px' }}>
                <button
                  onClick={() => setIsResetConfirmOpen(true)}
                  className="btn btn-secondary w-full"
                  style={{ gap: '8px', color: 'var(--danger)', cursor: 'pointer' }}
                >
                  <Key size={16} />
                  <span>Reset Portal Password</span>
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', textAlign: 'center', padding: '10px 0' }}>
              <User size={36} style={{ color: 'var(--text-muted)' }} />
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                This employee does not have a mapped system user account.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Reset Password Confirmation */}
      <ConfirmationDialog
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={() => resetPasswordMutation.mutate(employee.user!.id)}
        title="Reset Account Password"
        description={`Are you sure you want to reset the portal password for employee user "${employee.user?.email}"? A temporary random password will be created.`}
        confirmText="Reset Password"
        isDanger={true}
        isLoading={resetPasswordMutation.isPending}
      />

      {/* Password temporary display modal */}
      <Modal isOpen={tempPassword !== null} onClose={() => setTempPassword(null)} title="Account Password Reset">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
            The temporary password for this user has been reset. Please secure copy it now:
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
            <span style={{ fontSize: '1.2rem', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--primary)' }}>
              {tempPassword}
            </span>
            <button
              onClick={handleCopy}
              className="btn btn-secondary"
              style={{ padding: '8px', minWidth: '40px', height: '40px' }}
            >
              {copied ? <Check size={18} style={{ color: 'var(--success)' }} /> : <Copy size={18} />}
            </button>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--danger)', fontWeight: 500 }}>
            ⚠️ This password will not be shown again.
          </p>

          <button onClick={() => setTempPassword(null)} className="btn btn-primary" style={{ width: '100%' }}>
            Dismiss Credentials
          </button>
        </div>
      </Modal>
    </div>
  );
}
