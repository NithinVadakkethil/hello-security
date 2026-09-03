'use client';

import React, { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Shield, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

import { apiClient } from '../../../../lib/axios';
import { ApiResponse } from '../../../../types/api';
import { FormInput } from '../../../../components/ui/FormControls';
import LoadingState from '../../../../components/ui/LoadingState';

const schema = z.object({
  name: z.string().min(3, 'Site name must be at least 3 characters'),
  address: z.string().min(5, 'Site address must be at least 5 characters'),
  latitude: z.any().transform((val) => (val === '' ? undefined : Number(val))).optional(),
  longitude: z.any().transform((val) => (val === '' ? undefined : Number(val))).optional(),
  radius: z.any().transform((val) => (val === '' ? undefined : Number(val))).optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function EditSitePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  // Fetch current site details
  const { data, isLoading } = useQuery<ApiResponse<any>>({
    queryKey: ['site', id],
    queryFn: () => apiClient.get(`/sites/${id}`),
  });

  const site = data?.data;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema as any),
  });

  useEffect(() => {
    if (site) {
      reset({
        name: site.name,
        address: site.address || '',
        latitude: site.latitude || '',
        longitude: site.longitude || '',
        radius: site.radius || 100,
        contactPerson: site.contactPerson || '',
        contactPhone: site.contactPhone || '',
        description: site.description || '',
      });
    }
  }, [site, reset]);

  const updateSiteMutation = useMutation({
    mutationFn: (values: FormValues) => apiClient.patch(`/sites/${id}`, values),
    onSuccess: () => {
      toast.success('Site configurations saved!');
      router.push('/dashboard/sites');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update site.');
    },
  });

  const onSubmit = (values: FormValues) => {
    updateSiteMutation.mutate(values);
  };

  if (isLoading) {
    return <LoadingState message="Loading site configuration..." variant="page" />;
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link
          href={`/dashboard/sites/${id}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: 'var(--text-secondary)', fontWeight: 500 }}
        >
          <ArrowLeft size={16} />
          <span>Back to Site Details</span>
        </Link>
      </div>

      <div className="glass-card" style={{ padding: '32px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={20} className="text-primary" />
          <span>Modify Monitored Site Configs</span>
        </h3>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <FormInput
            label="Site Name"
            placeholder="e.g. Acme HQ Warehouse"
            error={errors.name?.message}
            {...register('name')}
          />

          <FormInput
            label="Street Address"
            placeholder="e.g. 123 Industrial Parkway, Suite A"
            error={errors.address?.message}
            {...register('address')}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <FormInput
              label="Latitude"
              type="number"
              step="any"
              placeholder="e.g. 37.7749"
              error={errors.latitude?.message as string | undefined}
              {...register('latitude')}
            />

            <FormInput
              label="Longitude"
              type="number"
              step="any"
              placeholder="e.g. -122.4194"
              error={errors.longitude?.message as string | undefined}
              {...register('longitude')}
            />

            <FormInput
              label="Check-in Radius (meters)"
              type="number"
              placeholder="e.g. 100"
              error={errors.radius?.message as string | undefined}
              {...register('radius')}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <FormInput
              label="Contact Manager Name"
              placeholder="e.g. John Doe"
              error={errors.contactPerson?.message}
              {...register('contactPerson')}
            />

            <FormInput
              label="Contact Manager Phone"
              placeholder="e.g. +1 (555) 019-2834"
              error={errors.contactPhone?.message}
              {...register('contactPhone')}
            />
          </div>

          <div>
            <label className="form-label">Brief Description</label>
            <textarea
              className="form-input"
              style={{ minHeight: '100px', resize: 'vertical' }}
              placeholder="Site specific guard instructions, alert procedures, etc."
              {...register('description')}
            />
            {errors.description?.message && (
              <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '4px' }}>
                {errors.description.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '16px' }}
            disabled={updateSiteMutation.isPending}
          >
            {updateSiteMutation.isPending ? 'Saving modifications...' : 'Save Site Settings'}
          </button>
        </form>
      </div>
    </div>
  );
}
