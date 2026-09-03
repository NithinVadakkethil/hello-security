'use client';

import React, { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

import { apiClient } from '../../../../lib/axios';
import { ApiResponse } from '../../../../types/api';
import { FormInput, Select, Switch } from '../../../../components/ui/FormControls';
import LoadingState from '../../../../components/ui/LoadingState';

const schema = z.object({
  companyName: z.string().min(2, 'Company name is required (min 2 characters)'),
  authorizedPerson: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  maxEmployees: z.any().refine((val) => {
    const num = Number(val);
    return !isNaN(num) && num > 0;
  }, 'Maximum employees must be a positive number'),
  maxCheckpoints: z.any().refine((val) => {
    const num = Number(val);
    return !isNaN(num) && num > 0;
  }, 'Maximum checkpoints must be a positive number'),
  identificationMethod: z.enum(['QR', 'RFID']),
  subscriptionStatus: z.enum(['TRIAL', 'ACTIVE', 'EXPIRED', 'SUSPENDED']),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export default function EditClientPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();

  // Fetch current client details
  const { data, isLoading, isError, refetch } = useQuery<ApiResponse<any>>({
    queryKey: ['client', id],
    queryFn: () => apiClient.get(`/clients/${id}`),
  });

  const client = data?.data;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema as any),
  });

  useEffect(() => {
    if (client) {
      reset({
        companyName: client.companyName,
        authorizedPerson: client.authorizedPerson || '',
        phone: client.phone || '',
        address: client.address || '',
        maxEmployees: client.maxEmployees,
        maxCheckpoints: client.maxCheckpoints || 50,
        identificationMethod: client.identificationMethod,
        subscriptionStatus: client.subscriptionStatus,
        isActive: client.isActive,
      });
    }
  }, [client, reset]);

  const updateClientMutation = useMutation({
    mutationFn: (values: FormValues) => apiClient.patch(`/clients/${id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', id] });
      toast.success('Client updated successfully!');
      router.push('/dashboard/clients');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update client.');
    },
  });

  const onSubmit = (values: FormValues) => {
    const payload = {
      ...values,
      maxEmployees: Number(values.maxEmployees),
      maxCheckpoints: Number(values.maxCheckpoints),
    };
    updateClientMutation.mutate(payload);
  };

  if (isLoading) {
    return <LoadingState message="Loading client details..." variant="page" />;
  }

  if (isError || !client) {
    return (
      <div className="error-panel glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h3>Failed to load client details</h3>
        <p>There was an error communicating with the administration api.</p>
        <button onClick={() => refetch()} className="btn btn-primary" style={{ marginTop: '16px' }}>
          Retry Request
        </button>
      </div>
    );
  }

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
          <span>Edit Client Details</span>
        </h3>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <FormInput
            label="Company Name"
            error={errors.companyName?.message}
            {...register('companyName')}
          />

          <FormInput
            label="Authorised Person"
            error={errors.authorizedPerson?.message}
            {...register('authorizedPerson')}
          />

          <FormInput
            label="Phone"
            error={errors.phone?.message}
            {...register('phone')}
          />

          <FormInput
            label="Address"
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

          <Select
            label="Subscription Status"
            options={[
              { value: 'TRIAL', label: 'Trial Subscription' },
              { value: 'ACTIVE', label: 'Active Paid Subscription' },
              { value: 'EXPIRED', label: 'Expired' },
              { value: 'SUSPENDED', label: 'Suspended' },
            ]}
            error={errors.subscriptionStatus?.message}
            {...register('subscriptionStatus')}
          />

          <div style={{ margin: '8px 0' }}>
            <Switch
              label="Account Active State"
              checked={!!watch('isActive')}
              {...register('isActive')}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '16px' }}
            disabled={updateClientMutation.isPending}
          >
            {updateClientMutation.isPending ? 'Saving changes...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
