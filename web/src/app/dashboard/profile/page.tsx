'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Key } from 'lucide-react';
import toast from 'react-hot-toast';

import { apiClient } from '../../lib/axios';
import { ApiResponse } from '../../types/api';
import { FormInput } from '../../components/ui/FormControls';
import { useAuthStore } from '../../store/auth-store';
import LoadingState from '../../components/ui/LoadingState';

const profileSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your new password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { user: storeUser, setAuth } = useAuthStore();

  // Fetch profile details
  const { data, isLoading } = useQuery<ApiResponse<{ id: string; email: string; role: string }>>({
    queryKey: ['profile'],
    queryFn: () => apiClient.get('/auth/me'),
  });

  const profile = data?.data;

  // React Hook Forms
  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema as any),
    values: profile ? { email: profile.email } : undefined,
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    formState: { errors: passwordErrors },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema as any),
  });

  // Mutations
  const updateProfileMutation = useMutation({
    mutationFn: (values: ProfileValues) => apiClient.patch('/auth/profile', values),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Profile details updated successfully!');
      
      // Update store user email
      if (storeUser && res.data?.data) {
        setAuth({
          ...storeUser,
          email: res.data.data.email,
        });
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update profile.');
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (values: PasswordValues) =>
      apiClient.patch('/auth/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    onSuccess: () => {
      toast.success('Password updated successfully!');
      resetPassword({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to change password.');
    },
  });

  const getInitials = (email?: string) => {
    if (!email) return 'U';
    return email.substring(0, 2).toUpperCase();
  };

  if (isLoading) {
    return <LoadingState message="Loading profile..." variant="page" />;
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Header Profile Badge */}
      <div className="glass-card" style={{ padding: '32px', display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '32px' }}>
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'var(--primary)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            fontWeight: 700,
            boxShadow: '0 0 20px var(--primary-glow)',
          }}
        >
          {getInitials(profile?.email)}
        </div>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 6px 0' }}>{profile?.email}</h2>
          <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', padding: '4px 10px', background: 'var(--primary-glow)', color: 'var(--primary)', borderRadius: '20px', fontWeight: 600 }}>
            {profile?.role?.replace('_', ' ')}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '32px' }}>
        {/* Update Profile Email */}
        <div className="glass-card" style={{ padding: '28px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={18} className="text-primary" />
            <span>Profile Details</span>
          </h3>

          <form onSubmit={handleProfileSubmit((vals) => updateProfileMutation.mutate(vals))}>
            <FormInput
              label="Email Address"
              type="email"
              error={profileErrors.email?.message}
              {...registerProfile('email')}
            />

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '16px' }}
              disabled={updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? 'Updating profile...' : 'Update Email'}
            </button>
          </form>
        </div>

        {/* Change Password Card */}
        <div className="glass-card" style={{ padding: '28px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={18} className="text-primary" />
            <span>Change Account Password</span>
          </h3>

          <form onSubmit={handlePasswordSubmit((vals) => changePasswordMutation.mutate(vals))}>
            <FormInput
              label="Current Password"
              type="password"
              placeholder="••••••••"
              error={passwordErrors.currentPassword?.message}
              {...registerPassword('currentPassword')}
            />

            <FormInput
              label="New Password"
              type="password"
              placeholder="••••••••"
              error={passwordErrors.newPassword?.message}
              {...registerPassword('newPassword')}
            />

            <FormInput
              label="Confirm New Password"
              type="password"
              placeholder="••••••••"
              error={passwordErrors.confirmPassword?.message}
              {...registerPassword('confirmPassword')}
            />

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '16px' }}
              disabled={changePasswordMutation.isPending}
            >
              {changePasswordMutation.isPending ? 'Updating password...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
