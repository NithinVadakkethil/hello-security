'use client';

import {
  AlertTriangle,
  FileText,
  LayoutDashboard,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  User,
  Users,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { DEMO_KAIZEN_FEATURES } from '@/config/demo-config';
import { ProtectedRoute } from '../components/protected-route';
import NotificationBell from '../dashboard/components/NotificationBell';
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
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('hello_orbit_central_sidebar_collapsed');
      if (saved !== null) {
        setIsCollapsed(saved === 'true');
      } else if (typeof window !== 'undefined' && window.innerWidth <= 1280) {
        // Automatically default to collapsed on laptop viewports if not previously customized
        setIsCollapsed(true);
      }
    } catch {
      // LocalStorage access errors ignored
    }
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('hello_orbit_central_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

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

  const rawMenuItems = [
    { href: '/central/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/central/employees', label: 'Employees', icon: Users },
    {
      href: '/central/observations',
      label: 'Observation Reports',
      icon: AlertTriangle,
    },
    { href: '/central/snags', label: 'Snag List', icon: Wrench },
    { href: '/central/reports', label: 'Reports & Analytics', icon: FileText },
    { href: '/central/profile', label: 'My Profile', icon: User },
  ];

  const menuItems = rawMenuItems.filter((item) => {
    if (
      item.href === '/central/observations' &&
      !DEMO_KAIZEN_FEATURES.observations
    )
      return false;
    if (item.href === '/central/snags' && !DEMO_KAIZEN_FEATURES.snags)
      return false;
    return true;
  });

  const getHeaderTitle = () => {
    if (pathname.startsWith('/central/projects')) {
      return 'All Projects';
    }
    const activeItem = menuItems.find((item) => pathname.startsWith(item.href));
    return activeItem ? activeItem.label : 'Community Manager Portal';
  };

  if (!mounted) return null;

  return (
    <ProtectedRoute isPublic={false}>
      <div className="app-container">
        {/* Sidebar */}
        <aside
          className={`app-sidebar central-sidebar ${isCollapsed ? 'collapsed' : 'expanded'}`}
          aria-label="Community Manager Navigation"
        >
          {/* Header Bar */}
          <div className="sidebar-header">
            <div className="logo-group">
              <div
                className="logo-icon"
                style={{
                  overflow: 'hidden',
                  padding: '2px',
                  background: 'var(--bg-tertiary)',
                  width: '32px',
                  height: '32px',
                  flexShrink: 0,
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
              {!isCollapsed && (
                <span className="logo-text">
                  HELLO
                  <span style={{ color: '#2563EB', fontWeight: '800' }}>
                    {' '}
                    ORBIT
                  </span>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={toggleSidebar}
              className="sidebar-collapse-toggle-btn"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <PanelLeftOpen size={18} />
              ) : (
                <PanelLeftClose size={18} />
              )}
            </button>
          </div>

          {/* Kaizen Security Manager Badge */}
          {!isCollapsed ? (
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
                Kaizen Security Manager
              </p>
            </div>
          ) : (
            <div
              style={{
                margin: '0 auto 12px',
                padding: '3px 6px',
                borderRadius: '6px',
                backgroundColor: 'rgba(37, 99, 235, 0.12)',
                border: '1px solid rgba(37, 99, 235, 0.3)',
                cursor: 'pointer',
              }}
              title="Kaizen Security Manager"
              aria-label="Kaizen Security Manager"
            >
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: '800',
                  color: '#2563EB',
                  letterSpacing: '0.5px',
                }}
              >
                KSM
              </span>
            </div>
          )}

          {/* Navigation Menu */}
          <nav className="sidebar-menu">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + '/');

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`menu-item ${isActive ? 'active' : ''}`}
                  title={isCollapsed ? item.label : undefined}
                  aria-label={item.label}
                >
                  <Icon size={18} style={{ flexShrink: 0 }} />
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          {/* Footer Area */}
          <div className="sidebar-footer">
            {!isCollapsed ? (
              <>
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
                    <p
                      className="user-name"
                      style={{ fontSize: '12px', fontWeight: '700' }}
                    >
                      {user?.email}
                    </p>
                    <p
                      className="user-role"
                      style={{
                        color: '#2563EB',
                        fontWeight: '800',
                        fontSize: '10px',
                      }}
                    >
                      KAIZEN SECURITY MANAGER
                    </p>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="btn btn-secondary w-full"
                  style={{ gap: '8px', cursor: 'pointer' }}
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <Link
                  href="/central/profile"
                  className="user-avatar"
                  title={user?.email || 'Profile'}
                  style={{
                    textDecoration: 'none',
                    width: '36px',
                    height: '36px',
                  }}
                >
                  {getInitials(user?.email)}
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="btn btn-secondary"
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="app-content">
          <header className="app-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <h2 className="page-title">{getHeaderTitle()}</h2>
            </div>
            <div
              className="header-actions"
              style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
            >
              <NotificationBell />
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

          <main className="main-scrollable central-main-scrollable">
            {children}
          </main>
        </div>
      </div>

      <style>{`
        .central-sidebar {
          width: 250px;
          transition: width 0.22s cubic-bezier(0.4, 0, 0.2, 1);
          overflow-x: hidden;
          flex-shrink: 0;
        }
        .central-sidebar.collapsed {
          width: 68px;
        }
        .central-sidebar .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 16px;
          gap: 8px;
        }
        .central-sidebar.collapsed .sidebar-header {
          flex-direction: column;
          padding: 16px 8px;
          gap: 12px;
          justify-content: center;
        }
        .logo-group {
          display: flex;
          align-items: center;
          gap: 10px;
          overflow: hidden;
        }
        .sidebar-collapse-toggle-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
          border-radius: 6px;
          border: 1px solid var(--border-color, #e2e8f0);
          background: var(--bg-tertiary, #f1f5f9);
          color: var(--text-secondary, #64748b);
          cursor: pointer;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }
        .sidebar-collapse-toggle-btn:hover {
          background: var(--primary-glow, rgba(37, 99, 235, 0.1));
          color: var(--primary, #2563eb);
          border-color: var(--primary, #2563eb);
        }
        .central-sidebar.collapsed .menu-item {
          justify-content: center;
          padding: 12px;
        }
        .central-sidebar.collapsed .sidebar-footer {
          padding: 16px 8px;
        }
        .central-main-scrollable {
          padding: 24px;
          overflow-x: hidden;
          max-width: 100%;
        }
        @media (max-width: 1440px) {
          .central-main-scrollable {
            padding: 18px 20px;
          }
        }
        @media (max-width: 768px) {
          .central-main-scrollable {
            padding: 14px;
          }
        }
      `}</style>
    </ProtectedRoute>
  );
}
