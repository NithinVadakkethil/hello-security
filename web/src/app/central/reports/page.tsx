'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Clock, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../../lib/axios';
import CentralManagerOrganizationSelector, { OrganizationMetric } from '../components/CentralManagerOrganizationSelector';
import CentralCompanyHeader from '../components/CentralCompanyHeader';
import PeriodicReportGenerator from '../../dashboard/reports/components/PeriodicReportGenerator';
import ProjectAttendanceReportsView from './components/ProjectAttendanceReportsView';

export default function CentralReportsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const clientId = searchParams.get('clientId');
  const tabParam = searchParams.get('tab');
  const activeTab: 'patrol' | 'attendance' = tabParam === 'attendance' ? 'attendance' : 'patrol';

  // State to lazily mount attendance reports on first visit
  const [hasVisitedAttendance, setHasVisitedAttendance] = useState(activeTab === 'attendance');

  useEffect(() => {
    if (activeTab === 'attendance') {
      setHasVisitedAttendance(true);
    }
  }, [activeTab]);

  // Multi-client selector states
  const [organizations, setOrganizations] = useState<OrganizationMetric[]>([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);
  const [orgsError, setOrgsError] = useState<string | null>(null);

  // Sites for filtering in generator
  const [sites, setSites] = useState<any[]>([]);

  // Fetch assigned organizations
  const fetchOrganizations = useCallback(async () => {
    setIsLoadingOrgs(true);
    setOrgsError(null);
    try {
      const res: any = await apiClient.get('/central-manager/organizations?lite=true');
      const orgsList = res?.data || (Array.isArray(res) ? res : []);
      setOrganizations(orgsList);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error?.message || 'Unable to load assigned organizations. Please try again.';
      setOrgsError(msg);
      toast.error(msg);
    } finally {
      setIsLoadingOrgs(false);
    }
  }, []);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  // Fetch sites for filtering
  useEffect(() => {
    if (!clientId) return;
    apiClient
      .get(`/sites?clientId=${clientId}&limit=100`)
      .then((res: any) => setSites(res?.data || (Array.isArray(res) ? res : [])))
      .catch(() => setSites([]));
  }, [clientId]);

  // Handle Top-Level Tab Switching
  const handleTabChange = (newTab: 'patrol' | 'attendance') => {
    if (newTab === activeTab) return;
    const params = new URLSearchParams();
    if (clientId) params.set('clientId', clientId);
    if (newTab === 'attendance') {
      params.set('tab', 'attendance');
    } else {
      params.set('tab', 'patrol');
    }
    router.push(`/central/reports?${params.toString()}`);
  };

  // Keyboard navigation for tablist (W3C ARIA pattern)
  const handleKeyDownTab = (
    e: React.KeyboardEvent,
    currentTab: 'patrol' | 'attendance'
  ) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const nextTab = currentTab === 'patrol' ? 'attendance' : 'patrol';
      handleTabChange(nextTab);
      const nextBtn = document.getElementById(`tab-${nextTab}`);
      nextBtn?.focus();
    }
  };

  // Handle Organization Selection
  const handleSelectOrganization = (orgId: string) => {
    const tabQuery = activeTab === 'attendance' ? '&tab=attendance' : '';
    router.push(`/central/reports?clientId=${orgId}${tabQuery}`);
  };

  // Handle Back to All Organizations
  const handleBackToOrganizations = () => {
    const tabQuery = activeTab === 'attendance' ? '?tab=attendance' : '';
    router.push(`/central/reports${tabQuery}`);
  };

  // STEP 1: ORGANIZATION SELECTION VIEW
  if (!clientId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Reports & Analytics</h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Select an assigned project to view operational patrol reports, checkpoint compliance, and inspection audits.
          </p>
        </div>

        <CentralManagerOrganizationSelector
          organizations={organizations}
          isLoading={isLoadingOrgs}
          error={orgsError}
          onRetry={fetchOrganizations}
          onSelectOrganization={handleSelectOrganization}
          moduleName="Reports & Analytics"
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Reports & Analytics</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
          Read-only inspection reports & compliance metrics for selected project.
        </p>
      </div>

      {/* Organization Context Bar */}
      <CentralCompanyHeader
        selectedClientId={clientId}
        organizations={organizations}
        moduleName="Reports & Analytics"
        onBackToOrganizations={handleBackToOrganizations}
        onSelectOrganization={handleSelectOrganization}
      />

      {/* Top-Level Report Category Tabs */}
      <div
        role="tablist"
        aria-label="Report Category"
        style={{
          display: 'inline-flex',
          padding: '4px',
          borderRadius: '12px',
          backgroundColor: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          gap: '6px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          width: 'fit-content',
        }}
      >
        <button
          type="button"
          role="tab"
          id="tab-patrol"
          aria-selected={activeTab === 'patrol'}
          aria-controls="panel-patrol"
          tabIndex={activeTab === 'patrol' ? 0 : -1}
          onClick={() => handleTabChange('patrol')}
          onKeyDown={(e) => handleKeyDownTab(e, 'patrol')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 22px',
            borderRadius: '8px',
            fontSize: '0.92rem',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            backgroundColor: activeTab === 'patrol' ? '#2563EB' : 'transparent',
            color: activeTab === 'patrol' ? '#ffffff' : 'var(--text-secondary, #64748b)',
            boxShadow: activeTab === 'patrol' ? '0 2px 4px rgba(37, 99, 235, 0.25)' : 'none',
          }}
        >
          <Shield size={18} />
          <span>Patrol Reports</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-attendance"
          aria-selected={activeTab === 'attendance'}
          aria-controls="panel-attendance"
          tabIndex={activeTab === 'attendance' ? 0 : -1}
          onClick={() => handleTabChange('attendance')}
          onKeyDown={(e) => handleKeyDownTab(e, 'attendance')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 22px',
            borderRadius: '8px',
            fontSize: '0.92rem',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            backgroundColor: activeTab === 'attendance' ? '#2563EB' : 'transparent',
            color: activeTab === 'attendance' ? '#ffffff' : 'var(--text-secondary, #64748b)',
            boxShadow: activeTab === 'attendance' ? '0 2px 4px rgba(37, 99, 235, 0.25)' : 'none',
          }}
        >
          <Clock size={18} />
          <span>Attendance Reports</span>
        </button>
      </div>

      {/* Tab Panel 1: Patrol Reports */}
      <div
        id="panel-patrol"
        role="tabpanel"
        aria-labelledby="tab-patrol"
        style={{
          display: activeTab === 'patrol' ? 'block' : 'none',
        }}
      >
        {/* Periodic Summary Report Generator */}
        <PeriodicReportGenerator clientId={clientId} isCentralManager={true} sites={sites} />
      </div>

      {/* Tab Panel 2: Attendance Reports */}
      <div
        id="panel-attendance"
        role="tabpanel"
        aria-labelledby="tab-attendance"
        style={{
          display: activeTab === 'attendance' ? 'block' : 'none',
        }}
      >
        {hasVisitedAttendance && <ProjectAttendanceReportsView clientId={clientId} />}
      </div>
    </div>
  );
}
