'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Building2, CheckCircle2, ShieldCheck, Users, Wrench } from 'lucide-react';

export interface SelectedClientData {
  id: string;
  companyName: string;
  clientCode: string;
  clientLogoUrl?: string | null;
  dashboardImageUrl?: string | null;
  address?: string | null;
  metrics: {
    employeesCount: number;
    completedPatrolsCount: number;
    activePatrolsCount: number;
    totalObservationsCount: number;
    openObservationsCount: number;
    reviewedObservationsCount: number;
    totalSnagsCount: number;
    openSnagsCount: number;
    wipSnagsCount: number;
    closedSnagsCount: number;
    complianceRate: number;
  };
  snagDistribution?: { category: string; count: number }[];
  snagStatusSummary?: {
    total: number;
    open: number;
    wip: number;
    closed: number;
  };
  employeeRoles?: { role: string; count: number }[];
  observationSummary?: {
    total: number;
    open: number;
    reviewed: number;
  };
  patrolSummary?: {
    completedPatrols: number;
    activePatrols: number;
    issuesDetected: number;
    avgCompliance: number;
  };
  attentionRequired?: {
    id: string;
    type: 'SNAG' | 'OBSERVATION';
    title: string;
    description: string;
    status: string;
    createdAt: string;
  }[];
}

interface OrganizationHeroCardProps {
  client: SelectedClientData;
}

export default function OrganizationHeroCard({ client }: OrganizationHeroCardProps) {
  const router = useRouter();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const getInitials = (name?: string) => {
    if (!name) return 'CO';
    const words = name.trim().split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const heroImageSrc =
    !imageError && client.dashboardImageUrl
      ? client.dashboardImageUrl
      : '/assets/building-placeholder.jpg';

  return (
    <div className="org-hero-card">
      {/* Hero Visual Background */}
      <div className="hero-visual-area">
        {!imageError && client.dashboardImageUrl ? (
          <img
            src={heroImageSrc}
            alt={`${client.companyName} Building`}
            className={`hero-bg-image ${imageLoaded ? 'loaded' : ''}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="hero-fallback-bg">
            <Building2 size={64} style={{ opacity: 0.15, color: '#ffffff' }} />
          </div>
        )}
        <div className="hero-gradient-overlay" />

        {/* Company Header Info Overlay */}
        <div className="hero-header-overlay">
          <div className="company-branding-group">
            <div className="client-logo-box">
              {client.clientLogoUrl ? (
                <img src={client.clientLogoUrl} alt={client.companyName} className="logo-img" />
              ) : (
                <span className="logo-initials">{getInitials(client.companyName)}</span>
              )}
            </div>
            <div className="company-text-box">
              <h2 className="company-name">{client.companyName}</h2>
              <p className="company-subtext">
                <span className="code-tag">{client.clientCode}</span>
                {client.address && <span> • {client.address}</span>}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Overlay Strip */}
      <div className="hero-kpi-overlay-strip">
        <button
          type="button"
          onClick={() => router.push(`/central/employees?clientId=${client.id}`)}
          className="kpi-card"
        >
          <div className="kpi-icon-box" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3B82F6' }}>
            <Users size={18} />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{client.metrics.employeesCount}</span>
            <span className="kpi-label">Employees</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => router.push(`/central/reports?clientId=${client.id}`)}
          className="kpi-card"
        >
          <div className="kpi-icon-box" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10B981' }}>
            <CheckCircle2 size={18} />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{client.metrics.completedPatrolsCount}</span>
            <span className="kpi-label">Completed Patrols</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => router.push(`/central/observations?clientId=${client.id}`)}
          className="kpi-card"
        >
          <div className="kpi-icon-box" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B' }}>
            <AlertTriangle size={18} />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{client.metrics.totalObservationsCount}</span>
            <span className="kpi-label">
              Observations <small style={{ color: '#F59E0B' }}>({client.metrics.openObservationsCount} Open)</small>
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => router.push(`/central/snags?clientId=${client.id}`)}
          className="kpi-card"
        >
          <div className="kpi-icon-box" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#EF4444' }}>
            <Wrench size={18} />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{client.metrics.totalSnagsCount}</span>
            <span className="kpi-label">
              Total Snags <small style={{ color: '#EF4444' }}>({client.metrics.openSnagsCount} Open)</small>
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => router.push(`/central/reports?clientId=${client.id}`)}
          className="kpi-card"
        >
          <div className="kpi-icon-box" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#6366F1' }}>
            <ShieldCheck size={18} />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{client.metrics.complianceRate}%</span>
            <span className="kpi-label">Compliance</span>
          </div>
        </button>
      </div>

      <style jsx>{`
        .org-hero-card {
          border-radius: 16px;
          overflow: hidden;
          background: var(--bg-card, #ffffff);
          border: 1px solid var(--border-color, #e2e8f0);
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
          display: flex;
          flex-direction: column;
        }
        .hero-visual-area {
          position: relative;
          width: 100%;
          min-height: 280px;
          background: #0f172a;
          overflow: hidden;
        }
        .hero-bg-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 0.4s ease;
        }
        .hero-bg-image.loaded {
          opacity: 1;
        }
        .hero-fallback-bg {
          width: 100%;
          height: 100%;
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .hero-gradient-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.4) 60%, rgba(15, 23, 42, 0.1) 100%);
        }
        .hero-header-overlay {
          position: absolute;
          bottom: 20px;
          left: 24px;
          right: 24px;
          z-index: 2;
        }
        .company-branding-group {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .client-logo-box {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          background: #ffffff;
          border: 2px solid rgba(255, 255, 255, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          flex-shrink: 0;
        }
        .logo-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          padding: 4px;
        }
        .logo-initials {
          font-size: 1.25rem;
          font-weight: 800;
          color: #2563eb;
        }
        .company-name {
          margin: 0;
          font-size: 1.6rem;
          font-weight: 800;
          color: #ffffff;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
          letter-spacing: -0.01em;
        }
        .company-subtext {
          margin: 4px 0 0 0;
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.85);
        }
        .code-tag {
          font-family: monospace;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.2);
          padding: 2px 8px;
          border-radius: 4px;
        }
        .hero-kpi-overlay-strip {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px;
          padding: 16px 20px;
          background: var(--surface-color, #f8fafc);
          border-top: 1px solid var(--border-color, #e2e8f0);
        }
        .kpi-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          background: var(--bg-card, #ffffff);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
        }
        .kpi-card:hover {
          border-color: #2563eb;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.1);
        }
        .kpi-icon-box {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .kpi-info {
          display: flex;
          flex-direction: column;
        }
        .kpi-value {
          font-size: 1.2rem;
          font-weight: 800;
          color: var(--text-primary, #0f172a);
          line-height: 1.1;
        }
        .kpi-label {
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--text-secondary, #64748b);
          margin-top: 2px;
        }
      `}</style>
    </div>
  );
}
