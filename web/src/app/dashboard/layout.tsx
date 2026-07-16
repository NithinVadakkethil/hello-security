'use client';

import {
  Activity,
  AlertTriangle,
  Calendar,
  FileText,
  LogOut,
  MapPin,
  Moon,
  Route,
  Settings,
  Shield,
  Sun,
  User,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
import toast from 'react-hot-toast';

import { ProtectedRoute } from '../components/protected-route';
import { useTheme } from '../providers/theme-provider';
import { useAuthStore } from '../store/auth-store';
import { clearTokens } from '../utils/token';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { user, clearAuth } = useAuthStore();

  const handleLogout = () => {
    clearTokens();
    clearAuth();
    toast.success('Signed out successfully.');
  };

  const getInitials = (email?: string) => {
    if (!email) return 'U';
    return email.substring(0, 2).toUpperCase();
  };

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // Navigation config based on role
  const menuItems = isSuperAdmin
    ? [
        { href: '/dashboard', label: 'Dashboard', icon: Activity },
        {
          href: '/dashboard/clients',
          label: 'Client Management',
          icon: Shield,
        },
        { href: '/dashboard/users', label: 'User Management', icon: Users },
        { href: '/dashboard/audit-logs', label: 'Audit Logs', icon: FileText },
        { href: '/dashboard/profile', label: 'My Profile', icon: User },
        { href: '/dashboard/settings', label: 'Settings', icon: Settings },
      ]
    : [
        { href: '/dashboard', label: 'Dashboard', icon: Activity },
        { href: '/dashboard/sites', label: 'Sites & Gates', icon: MapPin },
        { href: '/dashboard/shifts', label: 'Shifts', icon: Calendar },
        { href: '/dashboard/employees', label: 'Employees', icon: Users },
        { href: '/dashboard/users', label: 'Users', icon: Shield },
        {
          href: '/dashboard/patrol-routes',
          label: 'Patrol Routes',
          icon: Route,
        },
        {
          href: '/dashboard/assignments',
          label: 'Guard Assignments',
          icon: FileText,
        },
        {
          href: '/dashboard/patrol-sessions',
          label: 'Active Patrols',
          icon: Activity,
        },
        // {
        //   href: '/dashboard/patrol-history',
        //   label: 'Patrol History',
        //   icon: Clock,
        // },
        {
          href: '/dashboard/incidents',
          label: 'Incident Reports',
          icon: AlertTriangle,
        },
        {
          href: '/dashboard/reports',
          label: 'Reports & Analytics',
          icon: FileText,
        },
        // { href: '/dashboard/profile', label: 'My Profile', icon: User },
        { href: '/dashboard/settings', label: 'Settings', icon: Settings },
      ];

  const getHeaderTitle = () => {
    const activeItem = menuItems.find((item) => {
      if (item.href === '/dashboard') {
        return pathname === '/dashboard';
      }
      return pathname.startsWith(item.href);
    });
    return activeItem ? activeItem.label : 'Security Portal';
  };

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
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`menu-item ${isActive ? 'active' : ''}`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <Link
              href="/dashboard/profile"
              className="user-profile-badge hover-effect"
              style={{
                textDecoration: 'none',
                color: 'inherit',
                marginBottom: '8px',
              }}
            >
              <div className="user-avatar">{getInitials(user?.email)}</div>
              <div className="user-details">
                <p className="user-name">{user?.email}</p>
                <p className="user-role">ADMIN</p>
                {/* <p className="user-role">{user?.role?.replace('_', ' ')}</p> */}
              </div>
            </Link>
            <button
              onClick={handleLogout}
              className="btn btn-secondary w-full"
              style={{ gap: '8px', cursor: 'pointer' }}
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="app-content">
          <header className="app-header">
            <h2 className="page-title">{getHeaderTitle()}</h2>
            <div className="header-actions">
              <button
                onClick={toggleTheme}
                className="theme-toggle-btn"
                aria-label="Toggle Theme"
                style={{ cursor: 'pointer' }}
              >
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
            </div>
          </header>

          <main className="main-scrollable">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
