'use client';

import { Bell, Moon, Settings, ShieldAlert, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { Select, Switch } from '../../components/ui/FormControls';
import { useTheme } from '../../providers/theme-provider';

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();

  // Local state for settings persisted in LocalStorage
  const [notifications, setNotifications] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState('24h');

  // Load from local storage on mount
  useEffect(() => {
    const savedNotifications = localStorage.getItem('settings_notifications');
    if (savedNotifications !== null) {
      setNotifications(savedNotifications === 'true');
    }

    const savedTimeout = localStorage.getItem('settings_session_timeout');
    if (savedTimeout !== null) {
      setSessionTimeout(savedTimeout);
    }
  }, []);

  const handleNotificationsChange = (checked: boolean) => {
    setNotifications(checked);
    localStorage.setItem('settings_notifications', String(checked));
    toast.success(
      `Notifications ${checked ? 'enabled' : 'disabled'} successfully.`,
    );
  };

  const handleTimeoutChange = (val: string) => {
    setSessionTimeout(val);
    localStorage.setItem('settings_session_timeout', val);
    toast.success('Session timeout threshold updated.');
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="glass-card" style={{ padding: '32px' }}>
        <h3
          style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Settings size={20} className="text-primary" />
          <span>System Settings & Preferences</span>
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Theme card */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '16px',
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            <div>
              <h4
                style={{
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  margin: '0 0 4px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {theme === 'light' ? <Sun size={16} /> : <Moon size={16} />}
                <span>Active Portal Theme</span>
              </h4>
              <p
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  margin: 0,
                }}
              >
                Configure light or dark theme view preferences
              </p>
            </div>
            <button
              onClick={toggleTheme}
              className="btn btn-secondary"
              style={{ padding: '8px 16px', cursor: 'pointer' }}
            >
              Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode
            </button>
          </div>

          {/* Notifications Card */}
          <div
            style={{
              paddingBottom: '16px',
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
              }}
            >
              <Bell size={16} style={{ color: 'var(--text-muted)' }} />
              <h4 style={{ fontWeight: 600, fontSize: '0.95rem', margin: 0 }}>
                System Notifications
              </h4>
            </div>
            <p
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                marginBottom: '12px',
              }}
            >
              Receive real-time alerts for system events and logs
            </p>
            <Switch
              label="Enable Browser Push Notifications"
              checked={notifications}
              onChange={(e) => handleNotificationsChange(e.target.checked)}
            />
          </div>

          {/* Session Timeout */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
              }}
            >
              <ShieldAlert size={16} style={{ color: 'var(--text-muted)' }} />
              <h4 style={{ fontWeight: 600, fontSize: '0.95rem', margin: 0 }}>
                Security Session Timeout
              </h4>
            </div>
            <p
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                marginBottom: '12px',
              }}
            >
              Define maximum inactive period before automatic logout
            </p>
            <Select
              label="Timeout Threshold"
              value={sessionTimeout}
              onChange={(e) => handleTimeoutChange(e.target.value)}
              options={[
                { value: '15m', label: '15 Minutes (Recommended)' },
                { value: '30m', label: '30 Minutes' },
                { value: '1h', label: '1 Hour' },
                { value: '4h', label: '4 Hours' },
                { value: '24h', label: '24 Hours' },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
