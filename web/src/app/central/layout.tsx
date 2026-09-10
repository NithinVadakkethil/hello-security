'use client';

import {
  AlertTriangle,
  FileText,
  LayoutDashboard,
  LogOut,
  Moon,
  Sun,
  User,
  Users,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { ProtectedRoute } from '../components/protected-route';
import { useTheme } from '../providers/theme-provider';
import { useAuthStore } from '../store/auth-store';
import { clearTokens } from '../utils/token';

export default function CentralManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { user, clearAuth } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = () => {
    clearTokens();
    clearAuth();
    toast.success('Signed out successfully.');
    router.push('/login');
  };

  const getInitials = (email?: string) => {
    if (!email) return 'CM';
    return email.substring(0, 2).toUpperCase();
  };

  const menuItems = [
    { href: '/central/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/central/employees', label: 'Employees', icon: Users },
    { href: '/central/observations', label: 'Observation Reports', icon: AlertTriangle },
    { href: '/central/snags', label: 'Snag List', icon: Wrench },
    { href: '/central/reports', label: 'Reports & Analytics', icon: FileText },
    { href: '/central/profile', label: 'My Profile', icon: User },
  ];

  const getHeaderTitle = () => {
    const activeItem = menuItems.find((item) => pathname.startsWith(item.href));
    return activeItem ? activeItem.label : 'Central Manager Portal';
  };

  if (!mounted) return null;

  return (
    <ProtectedRoute isPublic={false}>
      <div className="app-container">
        {/* Sidebar */}
        <aside className="app-sidebar">
          <div className="sidebar-header">
            <div
              className="logo-icon"
              style={{
                overflow: 'hidden',
                padding: '2px',
                background: 'var(--bg-tertiary)',
              }}
            >
              <img
                src="/assets/hello-orbit-logo.png"
                alt="Hello Orbit Logo"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  borderRadius: '4px',
                }}
              />
            </div>
            <span className="logo-text">
              HELLO
              <span style={{ color: '#2563EB', fontWeight: '800' }}> ORBIT</span>
            </span>
          </div>

          <div
            style={{
              padding: '6px 12px',
              margin: '0 12px 12px',
              borderRadius: '6px',
              backgroundColor: 'rgba(37, 99, 235, 0.12)',
              border: '1px solid rgba(37, 99, 235, 0.3)',
            }}
          >
            <p
              style={{
                fontSize: '11px',
                fontWeight: '800',
                color: '#2563EB',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                margin: 0,
                textAlign: 'center',
              }}
            >
              Centralized Manager Portal
            </p>
          </div>

          <nav className="sidebar-menu">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

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
              href="/central/profile"
              className="user-profile-badge hover-effect"
              style={{
                textDecoration: 'none',
                color: 'inherit',
                marginBottom: '8px',
              }}
            >
              <div className="user-avatar">{getInitials(user?.email)}</div>
              <div className="user-details">
                <p className="user-name" style={{ fontSize: '12px', fontWeight: '700' }}>
                  {user?.email}
                </p>
                <p className="user-role" style={{ color: '#2563EB', fontWeight: '800', fontSize: '10px' }}>
                  CENTRAL MANAGER
                </p>
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

          <main className="main-scrollable" style={{ padding: '24px' }}>
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
