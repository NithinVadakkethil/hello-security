'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, ShieldAlert, AlertTriangle, CheckCircle, X, LogIn, LogOut, ShieldCheck } from 'lucide-react';
import { apiClient } from '../../lib/axios';
import { ApiResponse } from '../../types/api';

interface NotificationItem {
  id: string;
  recipientId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  metadata?: any;
}

export default function NotificationBell() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch unread count
  const { data: unreadRes } = useQuery<ApiResponse<{ unreadCount: number }>>({
    queryKey: ['notifications-unread-count'],
    queryFn: () => apiClient.get('/notifications/unread-count'),
    refetchInterval: 15000, // Poll every 15s
  });

  const unreadCount = unreadRes?.data?.unreadCount || 0;

  // Fetch notification list when popover is open
  const { data: notificationsRes, isLoading } = useQuery<ApiResponse<NotificationItem[]>>({
    queryKey: ['notifications-list'],
    queryFn: () => apiClient.get('/notifications?limit=15'),
    enabled: isOpen,
    refetchInterval: isOpen ? 10000 : false,
  });

  const notifications = notificationsRes?.data || [];

  // Mark single as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiClient.post('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    },
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'MANDATORY_PATROL_DUE':
        return <ShieldAlert size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} />;
      case 'MANDATORY_PATROL_MISSED':
        return <AlertTriangle size={16} style={{ color: 'var(--warning, #f59e0b)', flexShrink: 0 }} />;
      case 'MANDATORY_PATROL_COMPLETED':
        return <ShieldCheck size={16} style={{ color: 'var(--success, #10b981)', flexShrink: 0 }} />;
      case 'PATROL_COMPLETED':
        return <CheckCircle size={16} style={{ color: 'var(--primary, #3b82f6)', flexShrink: 0 }} />;
      case 'EMPLOYEE_CHECKED_IN':
        return <LogIn size={16} style={{ color: 'var(--success, #10b981)', flexShrink: 0 }} />;
      case 'EMPLOYEE_CHECKED_OUT':
        return <LogOut size={16} style={{ color: 'var(--warning, #f59e0b)', flexShrink: 0 }} />;
      default:
        return <Bell size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />;
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
      if (diff < 60) return 'Just now';
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return `${Math.floor(diff / 86400)}d ago`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="theme-toggle-btn"
        aria-label="Notifications"
        style={{ position: 'relative', cursor: 'pointer' }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              backgroundColor: 'var(--danger)',
              color: '#ffffff',
              fontSize: '0.65rem',
              fontWeight: 800,
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--bg-primary)',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '42px',
            width: '360px',
            maxHeight: '480px',
            backgroundColor: 'var(--bg-secondary, #ffffff)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Popover Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-tertiary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: '#fff',
                    fontSize: '0.7rem',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontWeight: 700,
                  }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsReadMutation.mutate()}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Mark all as read"
                >
                  <CheckCheck size={14} /> Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
            {isLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <Bell size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
                <p>No notifications right now.</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => !item.isRead && markAsReadMutation.mutate(item.id)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: item.isRead ? 'transparent' : 'var(--bg-tertiary, rgba(37, 99, 235, 0.05))',
                    cursor: 'pointer',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <div style={{ marginTop: '2px' }}>{getEventIcon(item.type)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ fontWeight: item.isRead ? 600 : 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        {item.title}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {formatTimeAgo(item.createdAt)}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                      {item.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
