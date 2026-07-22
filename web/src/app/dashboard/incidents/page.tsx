'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Clock, Eye, Shield, RefreshCw } from 'lucide-react';
import Link from 'next/link';

import { apiClient } from '../../lib/axios';
import { ApiResponse } from '../../types/api';
import { resolveImageUrl } from '../../../lib/image';
import SearchBar from '../../components/ui/SearchBar';
import Pagination from '../../components/ui/Pagination';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
}

interface Incident {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  images: string[];
  createdAt: string;
  employee: Employee;
}

export default function IncidentsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  // Fetch Incident logs from API
  const { data: incidentsRes, isLoading } = useQuery<ApiResponse<Incident[]>>({
    queryKey: ['incidents-list'],
    queryFn: () => apiClient.get('/incidents'),
  });

  const allIncidents = incidentsRes?.data || [];

  // Filter based on search query
  let incidents = allIncidents;
  if (search) {
    const s = search.toLowerCase();
    incidents = allIncidents.filter(
      (inc) =>
        inc.type.toLowerCase().includes(s) ||
        inc.severity.toLowerCase().includes(s) ||
        inc.description.toLowerCase().includes(s) ||
        `${inc.employee.firstName} ${inc.employee.lastName}`.toLowerCase().includes(s)
    );
  }

  const limit = 6;
  const totalPages = Math.max(1, Math.ceil(incidents.length / limit));
  const paginatedIncidents = incidents.slice((page - 1) * limit, page * limit);

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' };
      case 'HIGH':
        return { bg: '#ffedd5', text: '#c2410c', border: '#fed7aa' };
      case 'MEDIUM':
        return { bg: '#fef9c3', text: '#854d0e', border: '#fef08a' };
      default:
        return { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' };
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
        <RefreshCw className="spin-animation" size={32} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Incident Reports</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Browse and review safety & security incidents logged by on-site officers.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card" style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search by type, severity, description or officer..." />
        </div>
      </div>

      {/* Incidents Grid */}
      {paginatedIncidents.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {paginatedIncidents.map((incident) => {
            const sevColors = getSeverityColor(incident.severity);

            return (
              <div key={incident.id} className="glass-card hover-effect" style={{ display: 'flex', flexDirection: 'column', padding: '20px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                
                {/* Header: Type and Severity */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={18} style={{ color: sevColors.text }} />
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{incident.type}</span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '4px 8px',
                      borderRadius: '6px',
                      backgroundColor: sevColors.bg,
                      color: sevColors.text,
                      border: `1px solid ${sevColors.border}`,
                    }}
                  >
                    {incident.severity}
                  </span>
                </div>

                {/* Description Body */}
                <p style={{ fontSize: '0.85rem', lineHeight: '1.5', margin: '0 0 16px 0', flex: 1, color: 'var(--text-color)' }}>
                  {incident.description.length > 120 
                    ? `${incident.description.substring(0, 120)}...`
                    : incident.description}
                </p>

                {/* Image Previews */}
                {incident.images && incident.images.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    {incident.images.slice(0, 3).map((img, idx) => (
                      <div key={idx} style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                        <img src={resolveImageUrl(img)} alt="Incident" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        {idx === 2 && incident.images.length > 3 && (
                          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontSize: '0.8rem', fontWeight: 700 }}>
                            +{incident.images.length - 3}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer details */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: 'auto' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Shield size={12} />
                      Officer: {incident.employee.firstName} {incident.employee.lastName}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} />
                      {new Date(incident.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <Link href={`/dashboard/incidents/${incident.id}`} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 12px' }}>
                    <Eye size={14} />
                    <span>Details</span>
                  </Link>
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
          <AlertTriangle size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px', display: 'inline-block' }} />
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 700 }}>No Incidents Logged</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            There are no safety or security incidents matching your filters.
          </p>
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
