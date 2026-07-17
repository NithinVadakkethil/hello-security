'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Sun, Moon, Shield, Lock, Mail } from 'lucide-react';

import { useTheme } from '../providers/theme-provider';
import { useAuthStore } from '../store/auth-store';
import { setAccessToken, setRefreshToken } from '../utils/token';
import { apiClient } from '../lib/axios';
import { API_ROUTES } from '../constants';
import { showErrorToast } from '../utils/error-handler';
import { ProtectedRoute } from '../components/protected-route';
import { ApiResponse, AuthData } from '../types/api';

const loginValidationSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginValidationSchema>;

export default function LoginPage() {
  const { theme, toggleTheme } = useTheme();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginValidationSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitting(true);
    try {
      // Direct API Call using auth client endpoints
      const response = (await apiClient.post(
        API_ROUTES.LOGIN,
        values
      )) as unknown as ApiResponse<AuthData>;

      const authData = response.data;
      
      // Save tokens in cookies
      setAccessToken(authData.accessToken);
      if (authData.refreshToken) {
        setRefreshToken(authData.refreshToken);
      }

      // Sync Zustand Auth Store
      setAuth(authData.user);
      
      toast.success('Signed in successfully!');
    } catch (error) {
      showErrorToast(error, 'Sign in failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProtectedRoute isPublic={true}>
      <div className="login-page-container">
        {/* Floating gradient lights */}
        <div className="glow-light blue"></div>
        <div className="glow-light purple"></div>

        <div className="login-header-actions">
          <button onClick={toggleTheme} className="theme-toggle-btn" aria-label="Toggle Theme">
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>

        <div className="login-card glass-card">
          <div className="login-logo-section">
            <div className="logo-icon">
              <Shield size={22} fill="currentColor" />
            </div>
            <h1 className="login-app-title">Hello Orbit</h1>
            <p className="login-app-subtitle">Enterprise Security Portal</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="login-form">
            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email Address
              </label>
              <div className="input-with-icon">
                <Mail className="input-icon" size={18} />
                <input
                  {...register('email')}
                  type="email"
                  id="email"
                  placeholder="admin@hellosecurity.com"
                  className={`form-input icon-padded ${errors.email ? 'border-danger' : ''}`}
                  disabled={submitting}
                />
              </div>
              {errors.email && (
                <span className="form-error-msg">{errors.email.message}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Password
              </label>
              <div className="input-with-icon">
                <Lock className="input-icon" size={18} />
                <input
                  {...register('password')}
                  type="password"
                  id="password"
                  placeholder="••••••••"
                  className={`form-input icon-padded ${errors.password ? 'border-danger' : ''}`}
                  disabled={submitting}
                />
              </div>
              {errors.password && (
                <span className="form-error-msg">{errors.password.message}</span>
              )}
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
              {submitting ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>

        <style jsx>{`
          .login-page-container {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background-color: var(--bg-primary);
            position: relative;
            overflow: hidden;
            padding: 20px;
          }
          .glow-light {
            position: absolute;
            width: 400px;
            height: 400px;
            border-radius: 50%;
            filter: blur(100px);
            opacity: 0.15;
            z-index: 0;
            pointer-events: none;
          }
          .glow-light.blue {
            background: #00d2ff;
            top: -100px;
            left: -100px;
          }
          .glow-light.purple {
            background: #9b51e0;
            bottom: -100px;
            right: -100px;
          }
          .login-header-actions {
            position: absolute;
            top: 24px;
            right: 24px;
            z-index: 5;
          }
          .login-card {
            width: 100%;
            max-width: 420px;
            padding: 40px;
            z-index: 2;
            animation: floatUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .login-logo-section {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-bottom: 32px;
          }
          .login-app-title {
            font-size: 1.75rem;
            font-weight: 700;
            margin-top: 16px;
            margin-bottom: 4px;
            letter-spacing: -0.02em;
          }
          .login-app-subtitle {
            font-size: 0.9rem;
            color: var(--text-secondary);
          }
          .login-form {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .input-with-icon {
            position: relative;
            display: flex;
            align-items: center;
          }
          .input-icon {
            position: absolute;
            left: 16px;
            color: var(--text-muted);
            pointer-events: none;
          }
          .form-input.icon-padded {
            padding-left: 48px;
          }
          .border-danger {
            border-color: var(--danger) !important;
          }
          .border-danger:focus {
            box-shadow: 0 0 0 3px var(--danger-glow) !important;
          }
          .w-full {
            width: 100%;
            padding: 14px;
            margin-top: 10px;
          }
        `}</style>
      </div>
    </ProtectedRoute>
  );
}
