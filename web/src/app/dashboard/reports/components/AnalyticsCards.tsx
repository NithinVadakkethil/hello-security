'use client';

import React from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Building2,
  TrendingUp,
  AlertTriangle,
  Award,
} from 'lucide-react';

export interface AnalyticsData {
  totalInspections: number;
  completedInspections: number;
  failedInspections: number;
  pendingInspections: number;
  totalGuards: number;
  totalSites: number;
  totalCheckpoints: number;
  complianceRate: number;
  averageDurationMins: number;
  totalIssuesReported: number;
}

interface AnalyticsCardsProps {
  data?: AnalyticsData;
  isLoading: boolean;
}

export default function AnalyticsCards({ data, isLoading }: AnalyticsCardsProps) {
  const stats = [
    {
      title: 'Total Inspections',
      value: data?.totalInspections ?? 0,
      icon: Activity,
      color: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.12)',
      sub: 'All logged sweeps',
    },
    {
      title: 'Completed Sweeps',
      value: data?.completedInspections ?? 0,
      icon: CheckCircle2,
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.12)',
      sub: 'Successfully finished',
    },
    {
      title: 'Cancelled / Failed',
      value: data?.failedInspections ?? 0,
      icon: XCircle,
      color: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.12)',
      sub: 'Interrupted sweeps',
    },
    {
      title: 'Active / Pending',
      value: data?.pendingInspections ?? 0,
      icon: Clock,
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.12)',
      sub: 'Currently in progress',
    },
    {
      title: 'Compliance Rate',
      value: `${data?.complianceRate ?? 0}%`,
      icon: Award,
      color: '#8b5cf6',
      bg: 'rgba(139, 92, 246, 0.12)',
      sub: 'Overall route score',
    },
    {
      title: 'Avg Sweep Time',
      value: `${data?.averageDurationMins ?? 0}m`,
      icon: TrendingUp,
      color: '#06b6d4',
      bg: 'rgba(6, 182, 212, 0.12)',
      sub: 'Per completed patrol',
    },
    {
      title: 'Total Officers',
      value: data?.totalGuards ?? 0,
      icon: Shield,
      color: '#6366f1',
      bg: 'rgba(99, 102, 241, 0.12)',
      sub: 'Active security staff',
    },
    {
      title: 'Monitored Sites',
      value: data?.totalSites ?? 0,
      icon: Building2,
      color: '#ec4899',
      bg: 'rgba(236, 72, 153, 0.12)',
      sub: 'Client facilities',
    },
    {
      title: 'Issues Reported',
      value: data?.totalIssuesReported ?? 0,
      icon: AlertTriangle,
      color: '#f43f5e',
      bg: 'rgba(244, 63, 94, 0.12)',
      sub: 'Incidents & gate issues',
    },
  ];

  if (isLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="glass-card stat-card skeleton-loading"
            style={{ height: '110px', borderRadius: '12px' }}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
      {stats.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div
            key={idx}
            className="glass-card"
            style={{
              padding: '18px 20px',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '12px',
              position: 'relative',
              overflow: 'hidden',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {item.title}
              </span>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: item.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: item.color,
                }}
              >
                <Icon size={20} />
              </div>
            </div>

            <div>
              <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                {item.value}
              </div>
              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '6px' }}>{item.sub}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
