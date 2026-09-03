'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Lock, Mail, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';

import { ProtectedRoute } from '../components/protected-route';
import { API_ROUTES, ROUTES } from '../constants';
import { apiClient } from '../lib/axios';
import { useTheme } from '../providers/theme-provider';
import { useAuthStore } from '../store/auth-store';
import { ApiResponse, AuthData } from '../types/api';
import { showErrorToast } from '../utils/error-handler';
import { setAccessToken, setRefreshToken } from '../utils/token';

const loginValidationSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginValidationSchema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams?.get('redirect') || ROUTES.DASHBOARD;
  const { theme, toggleTheme } = useTheme();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginValidationSchema as any),
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
        values,
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
      router.replace(redirectTarget);
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
          <button
            onClick={toggleTheme}
            className="theme-toggle-btn"
            aria-label="Toggle Theme"
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>

        <div className="login-card glass-card">
          <div className="login-logo-section">
            <div className="logo-badge">
              <img
                src="/assets/hello-orbit-logo.png"
                alt="Hello Orbit Logo"
                className="login-logo-img"
              />
            </div>
            <h1 className="login-app-title">
              HELLO
              <span className="text-[#2563EB]" style={{ color: '#2563EB' }}>
                {' '}
                ORBIT
              </span>
            </h1>
            <p className="login-app-subtitle">Enterprise Security Portal</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="login-form">
            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email Address
              </label>
              <div className="input-with-icon">
                <span className="input-icon-left">
                  <Mail size={18} />
                </span>
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
                <span className="input-icon-left">
                  <Lock size={18} />
                </span>
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  placeholder="••••••••"
                  className={`form-input icon-padded icon-padded-right ${errors.password ? 'border-danger' : ''}`}
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  onMouseDown={(e) => e.preventDefault()}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <span className="form-error-msg">
                  {errors.password.message}
                </span>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={submitting}
            >
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
          .logo-badge {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            padding: 6px;
            box-shadow: 0 0 15px var(--primary-glow);
          }
          .login-logo-img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            border-radius: 4px;
          }
          .login-app-title {
            font-size: 1.75rem;
            font-weight: 700;
            margin-top: 16px;
            margin-bottom: 4px;
            letter-spacing: -0.02em;
          }
          .login-app-title span:first-child {
            color: #0f172a;
          }
          :global(html.dark) .login-app-title span:first-child {
            color: var(--text-primary);
          }
          .login-app-title span:last-child {
            color: #2563eb;
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
            width: 100%;
          }
          .input-icon-left {
            position: absolute;
            left: 14px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted);
            pointer-events: none;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
            z-index: 2;
          }
          .password-toggle-btn {
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            background: transparent;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 5px;
            width: 28px;
            height: 28px;
            border-radius: 4px;
            z-index: 2;
            transition: color 0.15s ease;
          }
          .password-toggle-btn:hover {
            color: var(--text-primary);
          }
          .form-input.icon-padded {
            padding-left: 44px;
          }
          .form-input.icon-padded-right {
            padding-right: 44px;
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
