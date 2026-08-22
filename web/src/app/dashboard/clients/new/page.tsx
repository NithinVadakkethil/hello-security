'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Shield, ArrowLeft, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

import { apiClient } from '../../../lib/axios';
import { FormInput, Select } from '../../../components/ui/FormControls';
import Modal from '../../../components/ui/Modal';

const schema = z.object({
  companyName: z.string().min(2, 'Company name is required (min 2 characters)'),
  email: z.string().email('Please enter a valid email address'),
  authorizedPerson: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  maxEmployees: z.any().refine((val) => {
    const num = Number(val);
    return !isNaN(num) && num > 0;
  }, 'Maximum employees must be a positive number'),
  maxCheckpoints: z.any().refine((val) => {
    const num = Number(val);
    return !isNaN(num) && num > 0;
  }, 'Maximum checkpoints must be a positive number'),
  identificationMethod: z.enum(['QR', 'RFID']),
});

type FormValues = z.infer<typeof schema>;

export default function NewClientPage() {
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
      maxEmployees: 50,
      maxCheckpoints: 50,
    },
  });

  const createClientMutation = useMutation({
    mutationFn: (values: FormValues) => apiClient.post('/clients', values),
    onSuccess: (response: any) => {
      toast.success('Client created successfully!');
      const tempPass = response.data?.data?.temporaryPassword;
      if (tempPass) {
        setTempPassword(tempPass);
      } else {
        router.push('/dashboard/clients');
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create client.');
    },
  });

  const onSubmit = (values: FormValues) => {
    const payload = {
      ...values,
      maxEmployees: Number(values.maxEmployees),
      maxCheckpoints: Number(values.maxCheckpoints),
    };
    createClientMutation.mutate(payload);
  };

  const handleCopy = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      toast.success('Password copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleModalClose = () => {
    setTempPassword(null);
    router.push('/dashboard/clients');
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <button
        onClick={() => router.back()}
        className="btn btn-secondary"
        style={{ gap: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center' }}
      >
        <ArrowLeft size={16} />
        <span>Back to List</span>
      </button>

      <div className="glass-card" style={{ padding: '32px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={20} className="text-primary" />
          <span>Provision New Client Company</span>
        </h3>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <FormInput
            label="Company Name"
            placeholder="e.g. Acme Protection Services"
            error={errors.companyName?.message}
            {...register('companyName')}
          />

          <FormInput
            label="Client Admin Email"
            type="email"
            placeholder="e.g. admin@acmesecurity.com"
            error={errors.email?.message}
            {...register('email')}
          />

          <FormInput
            label="Authorised Person"
            placeholder="e.g. John Doe"
            error={errors.authorizedPerson?.message}
            {...register('authorizedPerson')}
          />

          <FormInput
            label="Phone"
            placeholder="e.g. +1 555-0199"
            error={errors.phone?.message}
            {...register('phone')}
          />

          <FormInput
            label="Address"
            placeholder="e.g. 100 Security Ave, San Francisco, CA"
            error={errors.address?.message}
            {...register('address')}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <FormInput
              label="Maximum Employee Limit"
              type="number"
              error={errors.maxEmployees?.message as string | undefined}
              {...register('maxEmployees')}
            />

            <FormInput
              label="Maximum Checkpoint Limit"
              type="number"
              error={errors.maxCheckpoints?.message as string | undefined}
              {...register('maxCheckpoints')}
            />
          </div>

          <Select
            label="Identification Method"
            options={[
              { value: 'QR', label: 'QR Code scanning' },
              { value: 'RFID', label: 'RFID card scanning' },
            ]}
            error={errors.identificationMethod?.message}
            {...register('identificationMethod')}
          />

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '16px' }}
            disabled={createClientMutation.isPending}
          >
            {createClientMutation.isPending ? 'Provisioning Client...' : 'Provision Client'}
          </button>
        </form>
      </div>

      {/* Temporary Password Modal */}
      <Modal isOpen={tempPassword !== null} onClose={handleModalClose} title="Client Admin Account Created">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
            The client company has been provisioned and the admin login is ready. Please share this temporary password with the client:
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
              title="Copy to clipboard"
            >
              {copied ? <Check size={18} style={{ color: 'var(--success)' }} /> : <Copy size={18} />}
            </button>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--danger)', fontWeight: 500 }}>
            ⚠️ This password will not be shown again. Make sure to copy it before closing!
          </p>

          <button onClick={handleModalClose} className="btn btn-primary" style={{ width: '100%' }}>
            Done, Back to List
          </button>
        </div>
      </Modal>
    </div>
  );
}
