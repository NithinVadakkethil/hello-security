'use client';

import React, { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

import { apiClient } from '../../../../lib/axios';
import { ApiResponse } from '../../../../types/api';
import { FormInput, Select } from '../../../../components/ui/FormControls';
import LoadingState from '../../../../components/ui/LoadingState';

const schema = z.object({
  firstName: z.string().min(2, 'First name is required (min 2 characters)'),
  lastName: z.string().optional().or(z.literal('')),
  email: z.string().email('Please enter a valid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  designation: z.string().optional(),
  joiningDate: z.string().optional(),
  role: z.enum([
    'SECURITY',
    'CLEANER',
    'SERVICE_ENGINEER',
    'TECHNICIAN',
    'LIFE_GUARD',
    'PLUMBER',
    'SUPERVISOR',
    'MANAGER',
  ]),
});

type FormValues = z.infer<typeof schema>;

export default function EditEmployeePage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const id = params.id as string;

  // Query Employee details
  const { data, isLoading } = useQuery<ApiResponse<any>>({
    queryKey: ['employee', id],
    queryFn: () => apiClient.get(`/employees/${id}`),
  });

  const employee = data?.data;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema as any),
  });

  useEffect(() => {
    if (employee) {
      reset({
        firstName: employee.firstName,
        lastName: employee.lastName || '',
        email: employee.email || '',
        phone: employee.phone || '',
        designation: employee.designation || '',
        joiningDate: employee.joiningDate ? new Date(employee.joiningDate).toISOString().split('T')[0] : '',
        role: employee.role || employee.user?.role || 'SECURITY',
      });
    }
  }, [employee, reset]);

  const updateEmployeeMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: any = { ...values };
      delete payload.email; // Email is immutable after creation
      if (!payload.lastName) {
        payload.lastName = null;
      }
      if (payload.joiningDate) {
        payload.joiningDate = new Date(payload.joiningDate).toISOString();
      } else {
        payload.joiningDate = null;
      }
      return apiClient.patch(`/employees/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      toast.success('Employee configurations saved!');
      router.push(`/dashboard/employees/${id}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update employee.');
    },
  });

  const onSubmit = (values: FormValues) => {
    updateEmployeeMutation.mutate(values);
  };

  if (isLoading) {
    return <LoadingState message="Loading employee profile..." variant="page" />;
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link
          href={`/dashboard/employees/${id}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: 'var(--text-secondary)', fontWeight: 500 }}
        >
          <ArrowLeft size={16} />
          <span>Back to Employee Details</span>
        </Link>
      </div>

      <div className="glass-card" style={{ padding: '32px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={20} className="text-primary" />
          <span>Modify Employee Profile</span>
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

          <div>
            <FormInput
              label="Email Address (Read-only)"
              type="email"
              placeholder="e.g. mvance@security.acme.com"
              disabled
              readOnly
              style={{ opacity: 0.7, cursor: 'not-allowed', backgroundColor: 'var(--bg-tertiary)' }}
              {...register('email')}
            />
            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Email cannot be changed after employee creation.
            </p>
          </div>

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
              label="Operational Role / App Role *"
              options={[
                { value: 'SECURITY', label: 'Security Guard' },
                { value: 'CLEANER', label: 'House Keeping' },
                { value: 'SERVICE_ENGINEER', label: 'Service Engineer' },
                { value: 'TECHNICIAN', label: 'Technician' },
                { value: 'LIFE_GUARD', label: 'Life Guard' },
                { value: 'PLUMBER', label: 'Plumber' },
                { value: 'SUPERVISOR', label: 'Supervisor' },
                { value: 'MANAGER', label: 'Manager' },
              ]}
              error={errors.role?.message}
              {...register('role')}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '16px' }}
            disabled={updateEmployeeMutation.isPending}
          >
            {updateEmployeeMutation.isPending ? 'Saving modifications...' : 'Save Settings'}
          </button>
        </form>
      </div>
    </div>
  );
}
