'use client';

import {
  Bell,
  Briefcase,
  Building,
  Cog,
  Droplets,
  Image as ImageIcon,
  LifeBuoy,
  Mail,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  UserCog,
  Wrench,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { Select, Switch } from '../../components/ui/FormControls';
import { apiClient } from '../../lib/axios';

interface RoleStyle {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
}

const ROLE_PRESENTATION_MAP: Record<string, RoleStyle> = {
  SECURITY: {
    id: 'SECURITY',
    label: 'Security Guard',
    icon: ShieldCheck,
    color: '#2563eb', // Blue
    bg: 'rgba(37, 99, 235, 0.08)',
    border: 'rgba(37, 99, 235, 0.2)',
  },
  TECHNICIAN: {
    id: 'TECHNICIAN',
    label: 'Technician',
    icon: Wrench,
    color: '#d97706', // Amber
    bg: 'rgba(217, 119, 6, 0.08)',
    border: 'rgba(217, 119, 6, 0.2)',
  },
  CLEANER: {
    id: 'CLEANER',
    label: 'House Keeping',
    icon: Sparkles,
    color: '#059669', // Emerald
    bg: 'rgba(5, 150, 105, 0.08)',
    border: 'rgba(5, 150, 105, 0.2)',
  },
  SUPERVISOR: {
    id: 'SUPERVISOR',
    label: 'Supervisor',
    icon: UserCheck,
    color: '#7c3aed', // Purple
    bg: 'rgba(124, 58, 237, 0.08)',
    border: 'rgba(124, 58, 237, 0.2)',
  },
  MANAGER: {
    id: 'MANAGER',
    label: 'Manager',
    icon: Briefcase,
    color: '#475569', // Slate
    bg: 'rgba(71, 85, 105, 0.08)',
    border: 'rgba(71, 85, 105, 0.2)',
  },
  SERVICE_ENGINEER: {
    id: 'SERVICE_ENGINEER',
    label: 'Service Engineer',
    icon: Cog,
    color: '#0891b2', // Cyan
    bg: 'rgba(8, 145, 178, 0.08)',
    border: 'rgba(8, 145, 178, 0.2)',
  },
  LIFE_GUARD: {
    id: 'LIFE_GUARD',
    label: 'Life Guard',
    icon: LifeBuoy,
    color: '#e11d48', // Rose
    bg: 'rgba(225, 29, 72, 0.08)',
    border: 'rgba(225, 29, 72, 0.2)',
  },
  PLUMBER: {
    id: 'PLUMBER',
    label: 'Plumber',
    icon: Droplets,
    color: '#0284c7', // Sky
    bg: 'rgba(2, 132, 199, 0.08)',
    border: 'rgba(2, 132, 199, 0.2)',
  },
  SHOP_KEEPER: {
    id: 'SHOP_KEEPER',
    label: 'Shop Keeper',
    icon: ShoppingBag,
    color: '#9333ea', // Violet
    bg: 'rgba(147, 51, 234, 0.08)',
    border: 'rgba(147, 51, 234, 0.2)',
  },
};

const SUPPORTED_EMPLOYEE_ROLES = Object.values(ROLE_PRESENTATION_MAP);

const getRolePresentation = (roleId: string): RoleStyle => {
  if (ROLE_PRESENTATION_MAP[roleId]) {
    return ROLE_PRESENTATION_MAP[roleId];
  }
  const formattedLabel = roleId
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  return {
    id: roleId,
    label: formattedLabel || 'Field Employee',
    icon: UserCog,
    color: 'var(--primary)',
    bg: 'var(--bg-secondary)',
    border: 'var(--border-color)',
  };
};

import SubtaskMasterSettings from './components/SubtaskMasterSettings';

export default function SettingsPage() {
  // Local state for settings persisted in LocalStorage
  const [notifications, setNotifications] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState('24h');

  // Completed Patrol Notification Settings State
  const [patrolEmailEnabled, setPatrolEmailEnabled] = useState(true);
  const [globalRecipients, setGlobalRecipients] = useState<string[]>([]);
  const [newGlobalEmail, setNewGlobalEmail] = useState('');
  const [roleRecipientsMap, setRoleRecipientsMap] = useState<Record<string, string[]>>({});
  const [selectedRole, setSelectedRole] = useState('SECURITY');
  const [newRoleEmail, setNewRoleEmail] = useState('');

  // Client Branding State
  const [clientLogoUrl, setClientLogoUrl] = useState<string | null>(null);
  const [dashboardImageUrl, setDashboardImageUrl] = useState<string | null>(null);
  const [dashboardImageAspectRatio, setDashboardImageAspectRatio] = useState<number | null>(null);
  const [dashboardImageOrientation, setDashboardImageOrientation] = useState<string>('LANDSCAPE');
  const [dashboardImageFocalPosition, setDashboardImageFocalPosition] = useState<string>('center');

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingDashboard, setIsUploadingDashboard] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const roleEditorRef = useRef<HTMLDivElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const dashboardFileRef = useRef<HTMLInputElement>(null);

  // Load settings on mount
  useEffect(() => {
    const savedNotifications = localStorage.getItem('settings_notifications');
    if (savedNotifications !== null) {
      setNotifications(savedNotifications === 'true');
    }

    const savedTimeout = localStorage.getItem('settings_session_timeout');
    if (savedTimeout !== null) {
      setSessionTimeout(savedTimeout);
    }

    async function loadNotificationSettings() {
      try {
        const response: any = await apiClient.get('/client/settings/notifications');
        if (response.success && response.data) {
          setPatrolEmailEnabled(response.data.patrolCompletedEmailEnabled ?? true);
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

    async function loadBrandingSettings() {
      try {
        const response: any = await apiClient.get('/client/settings/branding');
        if (response.success && response.data) {
          setClientLogoUrl(response.data.clientLogoUrl || null);
          setDashboardImageUrl(response.data.dashboardImageUrl || null);
          setDashboardImageAspectRatio(response.data.dashboardImageAspectRatio || null);
          setDashboardImageOrientation(response.data.dashboardImageOrientation || 'LANDSCAPE');
          setDashboardImageFocalPosition(response.data.dashboardImageFocalPosition || 'center');
        }
      } catch (err) {
        console.error('Failed to load client branding settings:', err);
      }
    }

    loadNotificationSettings();
    loadBrandingSettings();
  }, []);

  const handleNotificationsChange = (checked: boolean) => {
    setNotifications(checked);
    localStorage.setItem('settings_notifications', String(checked));
    toast.success(`Browser push notifications ${checked ? 'enabled' : 'disabled'}.`);
  };

  const handleTimeoutChange = (val: string) => {
    setSessionTimeout(val);
    localStorage.setItem('settings_session_timeout', val);
    toast.success('Session timeout threshold updated.');
  };

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

  const handleSaveNotificationSettings = async () => {
    setIsSaving(true);
    try {
      const roleRecipientsPayload = Object.keys(roleRecipientsMap)
        .map((role) => ({
          role,
          recipients: roleRecipientsMap[role] || [],
        }))
        .filter((rr) => rr.recipients.length > 0);

      const response: any = await apiClient.put('/client/settings/notifications', {
        patrolCompletedEmailEnabled: patrolEmailEnabled,
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

  const handleManageRole = (roleId: string) => {
    setSelectedRole(roleId);
    if (roleEditorRef.current) {
      roleEditorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Logo must be PNG, WebP, JPEG, or SVG format.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo file size must be smaller than 2 MB.');
      return;
    }

    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const response: any = await apiClient.post('/client/settings/branding/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.success && response.data) {
        setClientLogoUrl(response.data.clientLogoUrl);
        toast.success('Client logo updated successfully.');
      } else {
        toast.error(response.error?.message || 'Failed to upload client logo.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Error uploading client logo.');
    } finally {
      setIsUploadingLogo(false);
      if (logoFileRef.current) logoFileRef.current.value = '';
    }
  };

  const handleDashboardFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Building image must be JPEG, PNG, or WebP format.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Building image file size must be smaller than 10 MB.');
      return;
    }

    setIsUploadingDashboard(true);
    try {
      const formData = new FormData();
      formData.append('dashboardImage', file);
      const response: any = await apiClient.post('/client/settings/branding/dashboard-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.success && response.data) {
        setDashboardImageUrl(response.data.dashboardImageUrl);
        setDashboardImageAspectRatio(response.data.dashboardImageAspectRatio || null);
        setDashboardImageOrientation(response.data.dashboardImageOrientation || 'LANDSCAPE');
        setDashboardImageFocalPosition(response.data.dashboardImageFocalPosition || 'center');
        toast.success('Dashboard building image updated successfully.');
      } else {
        toast.error(response.error?.message || 'Failed to upload building image.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Error uploading building image.');
    } finally {
      setIsUploadingDashboard(false);
      if (dashboardFileRef.current) dashboardFileRef.current.value = '';
    }
  };

  const handleFocalPositionChange = async (focalPosition: string) => {
    setDashboardImageFocalPosition(focalPosition);
    try {
      const response: any = await apiClient.patch('/client/settings/branding/focal-position', {
        focalPosition,
      });
      if (response.success) {
        toast.success(`Image focal position updated to ${focalPosition}.`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to update image focal position.');
    }
  };

  const handleRemoveLogo = async () => {
    try {
      const response: any = await apiClient.delete('/client/settings/branding/logo');
      if (response.success) {
        setClientLogoUrl(null);
        toast.success('Client logo removed successfully.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Error removing logo.');
    }
  };

  const handleRemoveDashboardImage = async () => {
    try {
      const response: any = await apiClient.delete('/client/settings/branding/dashboard-image');
      if (response.success) {
        setDashboardImageUrl(null);
        setDashboardImageAspectRatio(null);
        setDashboardImageOrientation('LANDSCAPE');
        setDashboardImageFocalPosition('center');
        toast.success('Dashboard building image removed successfully.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Error removing building image.');
    }
  };

  const activeRoleEmailList = roleRecipientsMap[selectedRole] || [];
  const selectedRoleInfo = getRolePresentation(selectedRole);
  const SelectedIcon = selectedRoleInfo.icon;

  const configuredRolesCount = Object.keys(roleRecipientsMap).filter(
    (roleKey) => (roleRecipientsMap[roleKey] || []).length > 0,
  ).length;

  return (
    <div style={{ width: '100%', padding: '8px 12px 40px 12px' }}>
      {/* Page Title */}
      <div style={{ marginBottom: '24px' }}>
        <h2
          style={{
            fontSize: '1.4rem',
            fontWeight: 700,
            margin: '0 0 4px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: 'var(--text-primary)',
          }}
        >
          <Settings size={24} className="text-primary" />
          <span>System Settings & Preferences</span>
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
          Manage portal notification dispatching, client branding assets, role email recipients, and security policies
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* CARD 0: ROLE-WISE SUBTASK MASTER */}
        <SubtaskMasterSettings />

        {/* CARD 1: SYSTEM NOTIFICATIONS */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <Bell size={18} className="text-primary" />
            <h3 style={{ fontWeight: 600, fontSize: '1.05rem', margin: 0, color: 'var(--text-primary)' }}>
              SYSTEM NOTIFICATIONS
            </h3>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Receive real-time alerts for system events, logs, and completed patrol cycles
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '32px',
              alignItems: 'center',
            }}
          >
            {/* Left Option: Push Notifications */}
            <div>
              <Switch
                label="Enable Browser Push Notifications"
                checked={notifications}
                onChange={(e) => handleNotificationsChange(e.target.checked)}
              />
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '-4px' }}>
                Get real-time alerts and updates directly in your browser.
              </div>
            </div>

            {/* Right Option: Patrol Email Notifications */}
            <div
              style={{
                paddingLeft: '16px',
                borderLeft: '1px solid var(--border-color)',
              }}
            >
              <Switch
                label="Enable Completed Patrol Email Notifications"
                checked={patrolEmailEnabled}
                onChange={(e) => setPatrolEmailEnabled(e.target.checked)}
              />
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '-4px' }}>
                Send an email when an employee completes their full assigned patrol route cycle.
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: CLIENT BRANDING */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            <div>
              <h3
                style={{
                  fontWeight: 600,
                  fontSize: '1.05rem',
                  margin: '0 0 4px 0',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Building size={18} className="text-primary" />
                <span>CLIENT BRANDING</span>
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                Customize your company logo and dashboard property image
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '24px',
              alignItems: 'start',
            }}
          >
            {/* Left Column: Client Logo */}
            <div
              style={{
                padding: '18px',
                borderRadius: '8px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                Client Logo
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                Recommended: PNG, WebP, or SVG with transparent background (Max 2MB).
              </p>

              {/* Logo Preview Box */}
              <div
                style={{
                  height: '110px',
                  borderRadius: '6px',
                  background: 'var(--card-bg)',
                  border: '1px dashed var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '14px',
                  padding: '12px',
                  overflow: 'hidden',
                }}
              >
                {clientLogoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={clientLogoUrl}
                    alt="Client logo preview"
                    style={{ maxHeight: '70px', maxWidth: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                    <ImageIcon size={24} />
                    <span style={{ fontSize: '0.78rem' }}>No logo uploaded</span>
                  </div>
                )}
              </div>

              {/* Logo Action Buttons */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  ref={logoFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  onChange={handleLogoFileChange}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => logoFileRef.current?.click()}
                  disabled={isUploadingLogo}
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Upload size={14} />
                  <span>{isUploadingLogo ? 'Uploading...' : clientLogoUrl ? 'Replace Logo' : 'Upload Logo'}</span>
                </button>

                {clientLogoUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '6px 14px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Trash2 size={14} />
                    <span>Remove</span>
                  </button>
                )}
              </div>
            </div>

            {/* Right Column: Dashboard Building Image */}
            <div
              style={{
                padding: '18px',
                borderRadius: '8px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  Dashboard Building Image
                </div>
                {dashboardImageUrl && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '10px',
                      background: dashboardImageOrientation === 'PORTRAIT' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(37, 99, 235, 0.15)',
                      color: dashboardImageOrientation === 'PORTRAIT' ? '#d97706' : '#2563eb',
                      border: `1px solid ${dashboardImageOrientation === 'PORTRAIT' ? 'rgba(234, 179, 8, 0.3)' : 'rgba(37, 99, 235, 0.3)'}`,
                    }}
                  >
                    📷 {dashboardImageOrientation} {dashboardImageAspectRatio ? `(${dashboardImageAspectRatio})` : ''}
                  </span>
                )}
              </div>

              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                Landscape, Square, or Portrait format (Max 10MB). Automatically adapts layout.
              </p>

              {/* Adaptive Building Image Preview Box */}
              <div
                style={{
                  height: '180px',
                  borderRadius: '6px',
                  background: 'var(--card-bg)',
                  border: '1px dashed var(--border-color)',
                  overflow: 'hidden',
                  position: 'relative',
                  marginBottom: '12px',
                }}
              >
                {dashboardImageUrl ? (
                  dashboardImageOrientation === 'LANDSCAPE' ? (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        backgroundImage: `linear-gradient(90deg, #1e1b4b 0%, rgba(30, 27, 75, 0.85) 50%, transparent 100%), url(${dashboardImageUrl})`,
                        backgroundPosition: `${dashboardImageFocalPosition} center`,
                        backgroundSize: 'cover',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '12px',
                      }}
                    >
                      <div style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 600 }}>
                        Landscape Banner Preview
                      </div>
                    </div>
                  ) : (
                    /* Portrait / Square Adaptive Preview */
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#0f172a',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundImage: `url(${dashboardImageUrl})`,
                          backgroundPosition: dashboardImageFocalPosition,
                          backgroundSize: 'cover',
                          filter: 'blur(16px) brightness(0.5)',
                          transform: 'scale(1.2)',
                          opacity: 0.5,
                        }}
                      />
                      <div style={{ position: 'relative', zIndex: 2, paddingLeft: '12px', color: '#fff', fontSize: '0.75rem', fontWeight: 600 }}>
                        {dashboardImageOrientation} Banner Preview
                      </div>
                      <div style={{ position: 'relative', zIndex: 2, height: '100%', padding: '6px 12px', display: 'flex', alignItems: 'center' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={dashboardImageUrl}
                          alt="Portrait building preview"
                          style={{
                            height: '100%',
                            objectFit: 'contain',
                            objectPosition: dashboardImageFocalPosition,
                            borderRadius: '4px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                          }}
                        />
                      </div>
                    </div>
                  )
                ) : (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                    <Building size={24} />
                    <span style={{ fontSize: '0.78rem' }}>No building image uploaded</span>
                  </div>
                )}
              </div>

              {/* Image Focal Position Control */}
              {dashboardImageUrl && (
                <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    Focal Position:
                  </label>
                  <select
                    value={dashboardImageFocalPosition}
                    onChange={(e) => handleFocalPositionChange(e.target.value)}
                    className="form-input"
                    style={{ fontSize: '0.78rem', padding: '4px 8px', height: '30px' }}
                  >
                    <option value="center">Center</option>
                    <option value="top">Top</option>
                    <option value="bottom">Bottom</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </div>
              )}

              {/* Building Image Action Buttons */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  ref={dashboardFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleDashboardFileChange}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => dashboardFileRef.current?.click()}
                  disabled={isUploadingDashboard}
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Upload size={14} />
                  <span>{isUploadingDashboard ? 'Uploading...' : dashboardImageUrl ? 'Replace Image' : 'Upload Image'}</span>
                </button>

                {dashboardImageUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveDashboardImage}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '6px 14px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Trash2 size={14} />
                    <span>Remove</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3: EMAIL RECIPIENT MANAGEMENT */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              paddingBottom: '14px',
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            <div>
              <h3
                style={{
                  fontWeight: 600,
                  fontSize: '1.05rem',
                  margin: '0 0 4px 0',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Mail size={18} className="text-primary" />
                <span>EMAIL RECIPIENT MANAGEMENT</span>
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                Configure global and role-wise email recipients for completed patrol route notifications
              </p>
            </div>
          </div>

          {isLoading ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '16px 0' }}>
              Loading recipient preferences...
            </div>
          ) : (
            <>
              {/* Two-Column Layout (40% / 60%) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                  gap: '24px',
                  alignItems: 'start',
                }}
              >
                {/* LEFT COLUMN: GLOBAL RECIPIENTS */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '4px',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                      Global Recipients — All Users
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: 'var(--primary-light)',
                        color: 'var(--primary)',
                      }}
                    >
                      {globalRecipients.length} {globalRecipients.length === 1 ? 'recipient' : 'recipients'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                    These recipients receive completed patrol-cycle emails for all employee roles.
                  </p>

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
                          <span style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>
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
                              fontSize: '0.78rem',
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
                      placeholder="Add another email address..."
                      value={newGlobalEmail}
                      onChange={(e) => setNewGlobalEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddGlobalRecipient();
                        }
                      }}
                      className="form-input"
                      style={{ flex: 1, fontSize: '0.82rem' }}
                    />
                    <button
                      type="button"
                      onClick={handleAddGlobalRecipient}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                    >
                      + Add Email
                    </button>
                  </div>
                </div>

                {/* RIGHT COLUMN: ROLE-WISE RECIPIENTS */}
                <div
                  ref={roleEditorRef}
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '4px',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                      Role-wise Email Recipients
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: 'var(--primary-light)',
                        color: 'var(--primary)',
                      }}
                    >
                      {configuredRolesCount} {configuredRolesCount === 1 ? 'role configured' : 'roles configured'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                    Configure additional recipients who should receive completed patrol-cycle emails only for employees in the selected role.
                  </p>

                  {/* Select Role Dropdown */}
                  <div style={{ marginBottom: '14px' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        marginBottom: '6px',
                      }}
                    >
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
                      border: `1px solid ${selectedRoleInfo.border}`,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: selectedRoleInfo.bg,
                            color: selectedRoleInfo.color,
                            border: `1px solid ${selectedRoleInfo.border}`,
                          }}
                        >
                          <SelectedIcon size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            {selectedRoleInfo.label}
                          </div>
                          <div
                            style={{
                              fontSize: '0.78rem',
                              color: activeRoleEmailList.length > 0 ? selectedRoleInfo.color : 'var(--text-muted)',
                              fontWeight: activeRoleEmailList.length > 0 ? 600 : 400,
                            }}
                          >
                            {activeRoleEmailList.length} {activeRoleEmailList.length === 1 ? 'recipient' : 'recipients'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {activeRoleEmailList.length === 0 ? (
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--text-muted)',
                          fontStyle: 'italic',
                          marginBottom: '12px',
                        }}
                      >
                        No recipient email addresses added for {selectedRoleInfo.label} yet.
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
                                fontSize: '0.78rem',
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
                        placeholder={`Add email for ${selectedRoleInfo.label} role...`}
                        value={newRoleEmail}
                        onChange={(e) => setNewRoleEmail(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddRoleRecipient();
                          }
                        }}
                        className="form-input"
                        style={{ flex: 1, fontSize: '0.82rem' }}
                      />
                      <button
                        type="button"
                        onClick={handleAddRoleRecipient}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                      >
                        + Add Role Email
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* OVERVIEW TABLE: ALL CONFIGURED ROLES */}
              <div
                style={{
                  marginTop: '28px',
                  paddingTop: '20px',
                  borderTop: '1px solid var(--border-color)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  All Configured Roles Overview
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                  Quick overview of role-wise email recipient configuration.
                </div>

                <div style={{ overflowX: 'auto', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '0.82rem',
                      textAlign: 'left',
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: 'var(--bg-secondary)',
                          borderBottom: '1px solid var(--border-color)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <th style={{ padding: '10px 14px', fontWeight: 600, width: '50%' }}>ROLE</th>
                        <th style={{ padding: '10px 14px', fontWeight: 600, width: '25%' }}>RECIPIENTS</th>
                        <th style={{ padding: '10px 14px', fontWeight: 600, width: '25%', textAlign: 'right' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SUPPORTED_EMPLOYEE_ROLES.map((role) => {
                        const list = roleRecipientsMap[role.id] || [];
                        const count = list.length;
                        const isSelected = selectedRole === role.id;
                        const roleInfo = getRolePresentation(role.id);
                        const RoleIcon = roleInfo.icon;

                        return (
                          <tr
                            key={role.id}
                            style={{
                              borderBottom: '1px solid var(--border-color)',
                              background: isSelected ? 'var(--bg-secondary)' : 'transparent',
                            }}
                          >
                            <td style={{ padding: '10px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '6px',
                                    background: roleInfo.bg,
                                    color: roleInfo.color,
                                    border: `1px solid ${roleInfo.border}`,
                                  }}
                                >
                                  <RoleIcon size={15} />
                                </div>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {roleInfo.label}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-primary)' }}>
                              {count === 0 ? (
                                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>0 recipients</span>
                              ) : (
                                <span style={{ fontWeight: 600, color: roleInfo.color }}>
                                  {count} {count === 1 ? 'recipient' : 'recipients'} ({list.join(', ')})
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => handleManageRole(role.id)}
                                className="btn btn-secondary"
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '4px 12px',
                                  fontWeight: 600,
                                  borderColor: isSelected ? roleInfo.border : undefined,
                                  color: isSelected ? roleInfo.color : undefined,
                                  background: isSelected ? roleInfo.bg : undefined,
                                }}
                              >
                                {isSelected ? 'Managing' : 'Manage'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SAVE BUTTON AREA */}
              <div style={{ marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={handleSaveNotificationSettings}
                  disabled={isSaving}
                  className="btn btn-primary"
                  style={{
                    fontSize: '0.85rem',
                    padding: '10px 28px',
                    minWidth: '220px',
                  }}
                >
                  {isSaving ? 'Saving Preferences...' : 'Save Notification Changes'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* CARD 4: SECURITY SESSION TIMEOUT */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px',
                }}
              >
                <ShieldAlert size={18} className="text-primary" />
                <h3 style={{ fontWeight: 600, fontSize: '1.05rem', margin: 0, color: 'var(--text-primary)' }}>
                  Security Session Timeout
                </h3>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                Define maximum inactive period before automatic logout
              </p>
            </div>

            <div style={{ minWidth: '220px' }}>
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
    </div>
  );
}
