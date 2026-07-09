'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Shield,
  Users,
  Calendar,
  MapPin,
  Route,
  Activity,
  LogOut,
  Sun,
  Moon,
  Lock,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { useTheme } from '../providers/theme-provider';
import { useAuthStore } from '../store/auth-store';
import { clearTokens } from '../utils/token';
import { apiClient } from '../lib/axios';
import { ProtectedRoute } from '../components/protected-route';
import { ApiResponse } from '../types/api';

interface DashboardCounts {
  employees: number;
  sites: number;
  gates: number;
  shifts: number;
  routes: number;
  assignments: number;
  activePatrols: number;
}

export default function DashboardPage() {
  const { theme, toggleTheme } = useTheme();
  const { user, clearAuth } = useAuthStore();

  const { data: counts, isLoading, isError, refetch, isFetching } = useQuery<ApiResponse<DashboardCounts>, Error>({
    queryKey: ['dashboardCounts'],
    queryFn: () => apiClient.get('/dashboard'),
  });

  const handleLogout = () => {
    clearTokens();
    clearAuth();
    toast.success('Signed out successfully.');
    // Navigation is automatically handled by the ProtectedRoute wrapper
  };

  const getInitials = (email?: string) => {
    if (!email) return 'U';
    return email.substring(0, 2).toUpperCase();
  };

  const dashboardData = counts?.data;

  return (
    <ProtectedRoute isPublic={false}>
      <div className="app-container">
        {/* Sidebar */}
        <aside className="app-sidebar">
          <div className="sidebar-header">
            <div className="logo-icon">
              <Shield size={18} fill="currentColor" />
            </div>
            <span className="logo-text">Hello Security</span>
          </div>

          <nav className="sidebar-menu">
            <a href="#" className="menu-item active">
              <Activity size={18} />
              <span>Dashboard</span>
            </a>
            <a href="#" className="menu-item">
              <Users size={18} />
              <span>Guard Assignments</span>
            </a>
            <a href="#" className="menu-item">
              <Route size={18} />
              <span>Patrol Routes</span>
            </a>
            <a href="#" className="menu-item">
              <Calendar size={18} />
              <span>Shifts</span>
            </a>
            <a href="#" className="menu-item">
              <MapPin size={18} />
              <span>Sites & Gates</span>
            </a>
          </nav>

          <div className="sidebar-footer">
            <div className="user-profile-badge">
              <div className="user-avatar">{getInitials(user?.email)}</div>
              <div className="user-details">
                <p className="user-name">{user?.email}</p>
                <p className="user-role">{user?.role?.replace('_', ' ')}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="btn btn-secondary w-full" style={{ gap: '8px' }}>
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="app-content">
          <header className="app-header">
            <h2 className="page-title">Security Dashboard</h2>
            <div className="header-actions">
              <button onClick={() => refetch()} className="theme-toggle-btn" aria-label="Refresh Data" title="Refresh Data">
                <RefreshCw size={18} className={isFetching ? 'spin-animation' : ''} />
              </button>
              <button onClick={toggleTheme} className="theme-toggle-btn" aria-label="Toggle Theme">
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
            </div>
          </header>

          <main className="main-scrollable">
            <div className="welcome-banner">
              <h1>Welcome Back, Supervisor</h1>
              <p>System status is secure. Active guard monitoring is online.</p>
            </div>

            {isLoading ? (
              <div className="dashboard-grid">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="glass-card stat-card skeleton-loading"></div>
                ))}
              </div>
            ) : isError ? (
              <div className="error-panel glass-card">
                <Lock size={48} className="error-icon" />
                <h3>Failed to load dashboard data</h3>
                <p>There was an error communicating with the security api.</p>
                <button onClick={() => refetch()} className="btn btn-primary" style={{ marginTop: '16px' }}>
                  Retry Request
                </button>
              </div>
            ) : (
              <div className="dashboard-grid">
                {/* Stat 1 */}
                <div className="glass-card stat-card hover-effect">
                  <div className="stat-icon-wrapper blue">
                    <Users size={22} />
                  </div>
                  <div className="stat-info">
                    <p className="stat-label">Active Guard Staff</p>
                    <h3 className="stat-value">{dashboardData?.employees ?? 0}</h3>
                  </div>
                </div>

                {/* Stat 2 */}
                <div className="glass-card stat-card hover-effect">
                  <div className="stat-icon-wrapper green">
                    <Activity size={22} />
                  </div>
                  <div className="stat-info">
                    <p className="stat-label">Active Patrols</p>
                    <h3 className="stat-value">{dashboardData?.activePatrols ?? 0}</h3>
                  </div>
                </div>

                {/* Stat 3 */}
                <div className="glass-card stat-card hover-effect">
                  <div className="stat-icon-wrapper purple">
                    <Shield size={22} />
                  </div>
                  <div className="stat-info">
                    <p className="stat-label">Guard Assignments</p>
                    <h3 className="stat-value">{dashboardData?.assignments ?? 0}</h3>
                  </div>
                </div>

                {/* Stat 4 */}
                <div className="glass-card stat-card hover-effect">
                  <div className="stat-icon-wrapper orange">
                    <MapPin size={22} />
                  </div>
                  <div className="stat-info">
                    <p className="stat-label">Monitored Sites</p>
                    <h3 className="stat-value">{dashboardData?.sites ?? 0}</h3>
                  </div>
                </div>

                {/* Stat 5 */}
                <div className="glass-card stat-card hover-effect">
                  <div className="stat-icon-wrapper cyan">
                    <Route size={22} />
                  </div>
                  <div className="stat-info">
                    <p className="stat-label">Patrol Routes</p>
                    <h3 className="stat-value">{dashboardData?.routes ?? 0}</h3>
                  </div>
                </div>

                {/* Stat 6 */}
                <div className="glass-card stat-card hover-effect">
                  <div className="stat-icon-wrapper gold">
                    <Calendar size={22} />
                  </div>
                  <div className="stat-info">
                    <p className="stat-label">Configured Shifts</p>
                    <h3 className="stat-value">{dashboardData?.shifts ?? 0}</h3>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>

        <style jsx>{`
          .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
            gap: 24px;
            margin-top: 32px;
          }
          .welcome-banner {
            padding: 32px;
            background: linear-gradient(135deg, var(--primary) 0%, #06b6d4 100%);
            border-radius: var(--radius-lg);
            color: #ffffff;
            box-shadow: 0 10px 30px var(--primary-glow);
          }
          .welcome-banner h1 {
            font-size: 1.8rem;
            font-weight: 700;
            margin-bottom: 6px;
            letter-spacing: -0.02em;
          }
          .welcome-banner p {
            font-size: 0.95rem;
            opacity: 0.9;
          }
          .stat-card {
            display: flex;
            align-items: center;
            gap: 20px;
            padding: 24px;
          }
          .stat-icon-wrapper {
            width: 48px;
            height: 48px;
            border-radius: var(--radius-sm);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
          }
          .stat-icon-wrapper.blue { background: #3b82f6; }
          .stat-icon-wrapper.green { background: var(--success); }
          .stat-icon-wrapper.purple { background: var(--primary); }
          .stat-icon-wrapper.orange { background: #f97316; }
          .stat-icon-wrapper.cyan { background: #06b6d4; }
          .stat-icon-wrapper.gold { background: var(--warning); }
          
          .stat-info {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .stat-label {
            font-size: 0.85rem;
            color: var(--text-secondary);
            font-weight: 500;
          }
          .stat-value {
            font-size: 1.6rem;
            font-weight: 700;
            letter-spacing: -0.01em;
          }
          .error-panel {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 60px;
            text-align: center;
            margin-top: 32px;
            gap: 8px;
          }
          .error-icon {
            color: var(--danger);
            margin-bottom: 12px;
          }
          .error-panel h3 {
            font-size: 1.2rem;
            font-weight: 600;
          }
          .error-panel p {
            color: var(--text-secondary);
            font-size: 0.9rem;
          }
          .skeleton-loading {
            height: 96px;
            background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-tertiary) 50%, var(--bg-secondary) 75%);
            background-size: 200% 100%;
            animation: loading-skeleton 1.5s infinite;
          }
          .spin-animation {
            animation: spin 1s linear infinite;
          }
          @keyframes loading-skeleton {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
          @keyframes spin {
            100% { transform: rotate(360deg); }
          }
          .w-full {
            width: 100%;
          }
        `}</style>
      </div>
    </ProtectedRoute>
  );
}
