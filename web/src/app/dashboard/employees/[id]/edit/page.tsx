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

const schema = z
  .object({
    firstName: z.string().min(2, 'First name is required (min 2 characters)'),
    lastName: z.string().optional().or(z.literal('')),
    email: z.string().email('Please enter a valid email address').optional().or(z.literal('')),
    phone: z.string().optional(),
    designation: z.string().optional(),
    companyName: z.string().optional(),
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
    supervisedRole: z.string().optional(),
    siraCardExpiryDate: z.string().optional(),
    siraCardFrontImage: z.string().optional(),
    siraCardBackImage: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.role === 'SUPERVISOR') {
        return !!data.supervisedRole;
      }
      return true;
    },
    {
      message: 'Supervised operational role is required for Supervisor.',
      path: ['supervisedRole'],
    },
  );

type FormValues = z.infer<typeof schema>;

export default function EditEmployeePage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [siraFrontPreview, setSiraFrontPreview] = React.useState<string | null>(null);
  const [siraBackPreview, setSiraBackPreview] = React.useState<string | null>(null);

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
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema as any),
  });

  const selectedRole = watch('role');

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (side === 'front') {
        setSiraFrontPreview(base64);
        setValue('siraCardFrontImage', base64);
      } else {
        setSiraBackPreview(base64);
        setValue('siraCardBackImage', base64);
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (employee) {
      reset({
        firstName: employee.firstName,
        lastName: employee.lastName || '',
        email: employee.email || '',
        phone: employee.phone || '',
        designation: employee.designation || '',
        companyName: employee.companyName || '',
        joiningDate: employee.joiningDate ? new Date(employee.joiningDate).toISOString().split('T')[0] : '',
        siraCardExpiryDate: employee.siraCardExpiryDate ? new Date(employee.siraCardExpiryDate).toISOString().split('T')[0] : '',
        siraCardFrontImage: employee.siraCardFrontImage || '',
        siraCardBackImage: employee.siraCardBackImage || '',
        role: employee.role || employee.user?.role || 'SECURITY',
        supervisedRole: employee.supervisedRole || employee.user?.supervisedRole || 'SECURITY',
      });
      if (employee.siraCardFrontImage) {
        setSiraFrontPreview(employee.siraCardFrontImage);
      }
      if (employee.siraCardBackImage) {
        setSiraBackPreview(employee.siraCardBackImage);
      }
    }
  }, [employee, reset]);

  const updateEmployeeMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: any = { ...values };
      delete payload.email; // Email is immutable after creation
      if (!payload.lastName || !payload.lastName.trim()) {
        payload.lastName = null;
      }
      if (!payload.phone || !payload.phone.trim()) {
        payload.phone = null;
      }
      if (!payload.designation || !payload.designation.trim()) {
        payload.designation = null;
      }
      if (!payload.companyName || !payload.companyName.trim()) {
        payload.companyName = null;
      } else {
        payload.companyName = payload.companyName.trim();
      }
      if (payload.joiningDate) {
        payload.joiningDate = new Date(payload.joiningDate).toISOString();
      } else {
        payload.joiningDate = null;
      }
      if (payload.role === 'SECURITY' || payload.role === 'SUPERVISOR') {
        if (payload.siraCardExpiryDate) {
          payload.siraCardExpiryDate = new Date(payload.siraCardExpiryDate).toISOString();
        } else {
          payload.siraCardExpiryDate = null;
        }
        if (siraFrontPreview) {
          payload.siraCardFrontImage = siraFrontPreview;
        } else {
          payload.siraCardFrontImage = null;
        }
        if (siraBackPreview) {
          payload.siraCardBackImage = siraBackPreview;
        } else {
          payload.siraCardBackImage = null;
        }
      } else {
        payload.siraCardExpiryDate = null;
        payload.siraCardFrontImage = null;
        payload.siraCardBackImage = null;
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
              label="Company Name (Optional)"
              placeholder="e.g. ABC Security Services LLC"
              error={(errors as any).companyName?.message}
              {...register('companyName')}
            />

            <FormInput
              label="Joining Date"
              type="date"
              error={errors.joiningDate?.message}
              {...register('joiningDate')}
            />
          </div>

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

          {selectedRole === 'SUPERVISOR' && (
            <div style={{ marginTop: '4px' }}>
              <Select
                label="Supervised Operational Role (Scope) *"
                options={[
                  { value: 'SECURITY', label: 'Security Guard' },
                  { value: 'CLEANER', label: 'House Keeping / Cleaner' },
                  { value: 'TECHNICIAN', label: 'Technician' },
                  { value: 'SERVICE_ENGINEER', label: 'Service Engineer' },
                  { value: 'LIFE_GUARD', label: 'Life Guard' },
                  { value: 'PLUMBER', label: 'Plumber' },
                ]}
                error={(errors as any).supervisedRole?.message}
                {...register('supervisedRole')}
              />
              <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Changing the supervised role will immediately update the data visible to this supervisor. No historical patrol data will be deleted.
              </p>
            </div>
          )}

          {(selectedRole === 'SECURITY' || selectedRole === 'SUPERVISOR') && (
            <div
              style={{
                marginTop: '12px',
                padding: '20px',
                borderRadius: '12px',
                backgroundColor: 'rgba(59, 130, 246, 0.05)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>🪪 SIRA Card Credentials (Security & Supervisor Staff)</span>
              </h4>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Security and supervisor operational access will automatically be restricted after card expiry date.
              </p>

              <FormInput
                label="SIRA Card Expiry Date"
                type="date"
                error={(errors as any).siraCardExpiryDate?.message}
                {...register('siraCardExpiryDate')}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '6px', color: 'var(--text-primary)' }}>
                    SIRA Card Front Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageFile(e, 'front')}
                    style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}
                  />
                  {siraFrontPreview && (
                    <div style={{ marginTop: '8px' }}>
                      <img
                        src={siraFrontPreview}
                        alt="SIRA Front Preview"
                        style={{ width: '100%', maxHeight: '120px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '6px', color: 'var(--text-primary)' }}>
                    SIRA Card Back Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageFile(e, 'back')}
                    style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}
                  />
                  {siraBackPreview && (
                    <div style={{ marginTop: '8px' }}>
                      <img
                        src={siraBackPreview}
                        alt="SIRA Back Preview"
                        style={{ width: '100%', maxHeight: '120px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

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
