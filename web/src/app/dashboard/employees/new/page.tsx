'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Shield, ArrowLeft, Check, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

import { apiClient } from '../../../lib/axios';
import { FormInput, Select } from '../../../components/ui/FormControls';
import Modal from '../../../components/ui/Modal';

const schema = z.object({
  firstName: z.string().min(2, 'First name is required (min 2 characters)'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Please enter a valid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  designation: z.string().optional(),
  joiningDate: z.string().optional(),
  identificationMethod: z.enum(['QR', 'RFID']),
  role: z.enum(['SUPER_ADMIN', 'CLIENT_ADMIN', 'MANAGER', 'SUPERVISOR', 'SECURITY']),
});

type FormValues = z.infer<typeof schema>;

export default function NewEmployeePage() {
  const router = useRouter();

  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      identificationMethod: 'QR',
      role: 'SECURITY',
    },
  });

  const createEmployeeMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: any = { ...values };
      if (!payload.email) {
        delete payload.email;
      }
      if (payload.joiningDate) {
        payload.joiningDate = new Date(payload.joiningDate).toISOString();
      } else {
        delete payload.joiningDate;
      }
      return apiClient.post('/employees', payload);
    },
    onSuccess: (res: any) => {
      toast.success('Employee registered successfully!');
      if (res.data?.data?.temporaryPassword) {
        setTempPassword(res.data.data.temporaryPassword);
      } else {
        router.push('/dashboard/employees');
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to enroll employee.');
    },
  });

  const onSubmit = (values: FormValues) => {
    createEmployeeMutation.mutate(values);
  };

  const handleCopy = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      toast.success('Password copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCloseCreds = () => {
    setTempPassword(null);
    router.push('/dashboard/employees');
  };

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link
          href="/dashboard/employees"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: 'var(--text-secondary)', fontWeight: 500 }}
        >
          <ArrowLeft size={16} />
          <span>Back to Employee List</span>
        </Link>
      </div>

      <div className="glass-card" style={{ padding: '32px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={20} className="text-primary" />
          <span>Enroll New Employee / Guard</span>
        </h3>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <FormInput
              label="First Name"
              placeholder="e.g. Michael"
              error={errors.firstName?.message}
              {...register('firstName')}
            />

            <FormInput
              label="Last Name"
              placeholder="e.g. Vance"
              error={errors.lastName?.message}
              {...register('lastName')}
            />
          </div>

          <FormInput
            label="Email Address (Used for system portal login)"
            type="email"
            placeholder="e.g. mvance@security.acme.com"
            error={errors.email?.message}
            {...register('email')}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <FormInput
              label="Phone Number"
              placeholder="e.g. +1 (555) 012-3456"
              error={errors.phone?.message}
              {...register('phone')}
            />

            <FormInput
              label="Designation / Position"
              placeholder="e.g. Night Patrol Lead"
              error={errors.designation?.message}
              {...register('designation')}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <FormInput
              label="Joining Date"
              type="date"
              error={errors.joiningDate?.message}
              {...register('joiningDate')}
            />

            <Select
              label="Identification Method"
              options={[
                { value: 'QR', label: 'QR Code scanning' },
                { value: 'RFID', label: 'RFID card scanning' },
              ]}
              error={errors.identificationMethod?.message}
              {...register('identificationMethod')}
            />
          </div>

          <Select
            label="Security Portal Role"
            options={[
              { value: 'SECURITY', label: 'Security Guard' },
              { value: 'SUPERVISOR', label: 'Supervisor' },
              { value: 'MANAGER', label: 'Client Manager' },
              { value: 'CLIENT_ADMIN', label: 'Client Administrator' },
            ]}
            error={errors.role?.message}
            {...register('role')}
          />

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '16px' }}
            disabled={createEmployeeMutation.isPending}
          >
            {createEmployeeMutation.isPending ? 'Enrolling staff...' : 'Enroll Employee'}
          </button>
        </form>
      </div>

      {/* Credentials display modal */}
      <Modal isOpen={tempPassword !== null} onClose={handleCloseCreds} title="Credentials Generated">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
            The employee user account is created. Here is the temporary login password:
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
            ⚠️ Write this down now. It will not be shown again.
          </p>

          <button onClick={handleCloseCreds} className="btn btn-primary" style={{ width: '100%' }}>
            Confirm & Complete Enrollment
          </button>
        </div>
      </Modal>
    </div>
  );
}
