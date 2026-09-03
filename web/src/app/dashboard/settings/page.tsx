'use client';

import { Bell, Moon, Settings, ShieldAlert, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { apiClient } from '../../lib/axios';
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

          {/* COMPLETED PATROL EMAIL NOTIFICATIONS */}
          <CompletedPatrolNotificationSettings />

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

const SUPPORTED_EMPLOYEE_ROLES = [
  { id: 'SECURITY', label: 'Security Guard' },
  { id: 'TECHNICIAN', label: 'Technician' },
  { id: 'CLEANER', label: 'House Keeping' },
  { id: 'SUPERVISOR', label: 'Supervisor' },
  { id: 'MANAGER', label: 'Manager' },
  { id: 'SERVICE_ENGINEER', label: 'Service Engineer' },
  { id: 'LIFE_GUARD', label: 'Life Guard' },
  { id: 'PLUMBER', label: 'Plumber' },
];

function CompletedPatrolNotificationSettings() {
  const [enabled, setEnabled] = useState(true);
  const [globalRecipients, setGlobalRecipients] = useState<string[]>([]);
  const [newGlobalEmail, setNewGlobalEmail] = useState('');
  
  // Role-wise recipients mapping: { SECURITY: string[], TECHNICIAN: string[], ... }
  const [roleRecipientsMap, setRoleRecipientsMap] = useState<Record<string, string[]>>({});
  const [selectedRole, setSelectedRole] = useState('SECURITY');
  const [newRoleEmail, setNewRoleEmail] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const response: any = await apiClient.get('/client/settings/notifications');
        if (response.success && response.data) {
          setEnabled(response.data.patrolCompletedEmailEnabled ?? true);
          setGlobalRecipients(response.data.recipients || []);

          const map: Record<string, string[]> = {};
          (response.data.roleRecipients || []).forEach((rr: any) => {
            map[rr.role] = rr.recipients || [];
          });
          setRoleRecipientsMap(map);
        }
      } catch (err) {
        console.error('Failed to load completed patrol notification settings:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleAddGlobalRecipient = () => {
    const trimmed = newGlobalEmail.trim().toLowerCase();
    if (!trimmed) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      toast.error('Please enter a valid email address format.');
      return;
    }

    if (globalRecipients.includes(trimmed)) {
      toast.error('This email address is already added under Global Recipients.');
      return;
    }

    setGlobalRecipients([...globalRecipients, trimmed]);
    setNewGlobalEmail('');
  };

  const handleRemoveGlobalRecipient = (emailToRemove: string) => {
    setGlobalRecipients(globalRecipients.filter((email) => email !== emailToRemove));
  };

  const handleAddRoleRecipient = () => {
    const trimmed = newRoleEmail.trim().toLowerCase();
    if (!trimmed) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      toast.error('Please enter a valid email address format.');
      return;
    }

    const currentList = roleRecipientsMap[selectedRole] || [];
    if (currentList.includes(trimmed)) {
      toast.error(`This email address is already added for role ${selectedRole}.`);
      return;
    }

    setRoleRecipientsMap({
      ...roleRecipientsMap,
      [selectedRole]: [...currentList, trimmed],
    });
    setNewRoleEmail('');
  };

  const handleRemoveRoleRecipient = (role: string, emailToRemove: string) => {
    const currentList = roleRecipientsMap[role] || [];
    setRoleRecipientsMap({
      ...roleRecipientsMap,
      [role]: currentList.filter((e) => e !== emailToRemove),
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const roleRecipientsPayload = Object.keys(roleRecipientsMap)
        .map((role) => ({
          role,
          recipients: roleRecipientsMap[role] || [],
        }))
        .filter((rr) => rr.recipients.length > 0);

      const response: any = await apiClient.put('/client/settings/notifications', {
        patrolCompletedEmailEnabled: enabled,
        recipients: globalRecipients,
        roleRecipients: roleRecipientsPayload,
      });

      if (response.success) {
        toast.success('Completed patrol email notification settings saved successfully.');
      } else {
        toast.error(response.error?.message || 'Failed to save settings.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.message || 'Error saving settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const activeRoleEmailList = roleRecipientsMap[selectedRole] || [];
  const selectedRoleLabel = SUPPORTED_EMPLOYEE_ROLES.find((r) => r.id === selectedRole)?.label || selectedRole;

  return (
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
        <Bell size={16} style={{ color: 'var(--primary)' }} />
        <h4 style={{ fontWeight: 600, fontSize: '0.95rem', margin: 0 }}>
          Completed Patrol Email Notifications
        </h4>
      </div>
      <p
        style={{
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          marginBottom: '16px',
        }}
      >
        Send an email notification whenever an employee completes their full assigned patrol route cycle.
      </p>

      {isLoading ? (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Loading notification preferences...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Switch
            label="Enable Completed Patrol Email Notifications"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />

          {/* Section 1: Global Recipients */}
          <div
            style={{
              padding: '16px',
              borderRadius: '8px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
              GLOBAL RECIPIENTS — ALL USERS ({globalRecipients.length})
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              These recipients receive completed patrol-cycle emails for all employee roles.
            </div>

            {globalRecipients.length === 0 ? (
              <div
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  fontStyle: 'italic',
                  marginBottom: '12px',
                }}
              >
                No global recipient email addresses added yet.
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  marginBottom: '12px',
                }}
              >
                {globalRecipients.map((email) => (
                  <div
                    key={email}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      ✉️ {email}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveGlobalRecipient(email)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="email"
                placeholder="global.admin@client.com"
                value={newGlobalEmail}
                onChange={(e) => setNewGlobalEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddGlobalRecipient();
                  }
                }}
                className="form-input"
                style={{ flex: 1, fontSize: '0.85rem' }}
              />
              <button
                type="button"
                onClick={handleAddGlobalRecipient}
                className="btn btn-secondary"
                style={{ fontSize: '0.85rem' }}
              >
                + Add Email Address
              </button>
            </div>
          </div>

          {/* Section 2: Role-wise Recipients */}
          <div
            style={{
              padding: '16px',
              borderRadius: '8px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
              ROLE-WISE EMAIL RECIPIENTS
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Configure additional recipients who should receive completed patrol-cycle emails only for employees in the selected role.
            </div>

            {/* Role selector dropdown / pills */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Select Employee Role:
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="form-input"
                style={{ width: '100%', fontSize: '0.85rem', fontWeight: 600 }}
              >
                {SUPPORTED_EMPLOYEE_ROLES.map((role) => {
                  const count = (roleRecipientsMap[role.id] || []).length;
                  return (
                    <option key={role.id} value={role.id}>
                      {role.label} ({count} {count === 1 ? 'recipient' : 'recipients'})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Selected Role Recipient List Card */}
            <div
              style={{
                padding: '14px',
                borderRadius: '6px',
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  {selectedRoleLabel} Recipients ({activeRoleEmailList.length})
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: 'var(--primary-light)', color: 'var(--primary)' }}>
                  Role: {selectedRole}
                </span>
              </div>

              {activeRoleEmailList.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '12px' }}>
                  No recipient email addresses added for {selectedRoleLabel} yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  {activeRoleEmailList.map((email) => (
                    <div
                      key={email}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                        ✉️ {email}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveRoleRecipient(selectedRole, email)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="email"
                  placeholder={`${selectedRole.toLowerCase()}.manager@client.com`}
                  value={newRoleEmail}
                  onChange={(e) => setNewRoleEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddRoleRecipient();
                    }
                  }}
                  className="form-input"
                  style={{ flex: 1, fontSize: '0.85rem' }}
                />
                <button
                  type="button"
                  onClick={handleAddRoleRecipient}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.85rem' }}
                >
                  + Add Role Email
                </button>
              </div>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="btn btn-primary"
              style={{ fontSize: '0.85rem', width: '100%' }}
            >
              {isSaving ? 'Saving Preferences...' : 'Save Notification Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

