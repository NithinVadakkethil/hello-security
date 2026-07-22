'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock, Shield, AlertTriangle, Download, ChevronLeft, ChevronRight, RefreshCw, X } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

import { apiClient } from '../../../lib/axios';
import { ApiResponse } from '../../../types/api';
import { resolveImageUrl } from '../../../../lib/image';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  designation?: string | null;
  email: string;
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

export default function IncidentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [activeImageIdx, setActiveImageIdx] = useState<number | null>(null);

  // Fetch Incident Details
  const { data: incidentRes, isLoading, isError } = useQuery<ApiResponse<Incident>>({
    queryKey: ['incident-details', id],
    queryFn: () => apiClient.get(`/incidents/${id}`),
  });

  const incident = incidentRes?.data;

  const handleDownload = async (imgUrl: string) => {
    try {
      const response = await fetch(resolveImageUrl(imgUrl));
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', imgUrl.split('/').pop() || 'download.jpg');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Image download initiated.');
    } catch {
      toast.error('Failed to download image.');
    }
  };

  const getSeverityColors = (sev: string) => {
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

  if (isError || !incident) {
    return (
      <div className="error-panel glass-card" style={{ maxWidth: '600px', margin: '50px auto', padding: '30px', textAlign: 'center' }}>
        <AlertTriangle size={48} style={{ color: 'var(--text-danger)', marginBottom: '16px', display: 'inline-block' }} />
        <h3>Incident Log Not Found</h3>
        <p>The requested incident report could not be loaded.</p>
        <Link href="/dashboard/incidents" className="btn btn-primary" style={{ marginTop: '16px', textDecoration: 'none', display: 'inline-block' }}>
          Back to Reports
        </Link>
      </div>
    );
  }

  const sevColors = getSeverityColors(incident.severity);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Back Button and Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={() => router.back()} className="btn btn-outline" style={{ padding: '8px', minWidth: 'auto' }}>
          <ArrowLeft size={16} />
        </button>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Incident Details</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Review full details and visual evidence for logged report #{incident.id.substring(0, 8)}.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        
        {/* Left Side: Type, Description and Image Gallery */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Main Info Card */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={24} style={{ color: sevColors.text }} />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>{incident.type}</h3>
              </div>
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  padding: '6px 12px',
                  borderRadius: '6px',
                  backgroundColor: sevColors.bg,
                  color: sevColors.text,
                  border: `1px solid ${sevColors.border}`,
                }}
              >
                {incident.severity} SEVERITY
              </span>
            </div>

            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-muted)' }}>INCIDENT DESCRIPTION</h4>
            <p style={{ fontSize: '0.95rem', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' }}>
              {incident.description}
            </p>
          </div>

          {/* Image Gallery Grid */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Attached Visual Evidence</h3>
            {incident.images && incident.images.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                {incident.images.map((img, idx) => (
                  <div key={idx} className="glass-card hover-effect" style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px', borderRadius: '8px' }}>
                    <div
                      onClick={() => setActiveImageIdx(idx)}
                      style={{ cursor: 'pointer', height: '140px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)' }}
                    >
                      <img src={resolveImageUrl(img)} alt="Evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <button
                      onClick={() => handleDownload(img)}
                      className="btn btn-outline"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', width: '100%', padding: '6px' }}
                    >
                      <Download size={14} />
                      <span>Download</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  No photos were attached to this incident report.
                </p>
              </div>
            )}
          </div>

        </div>

        {/* Right Side: Reporting Officer Details & Timestamp */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Officer Details */}
            <div>
              <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Reporting Officer
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '20px', backgroundColor: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontWeight: 700 }}>
                  <Shield size={20} />
                </div>
                <div>
                  <h5 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
                    {incident.employee.firstName} {incident.employee.lastName}
                  </h5>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    {incident.employee.designation || 'Security Officer'}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Employee ID Number
              </h4>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{incident.employee.employeeNumber}</span>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Email Address
              </h4>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{incident.employee.email}</span>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Timestamp Logged
              </h4>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} />
                {new Date(incident.createdAt).toLocaleString()}
              </span>
            </div>

          </div>

        </div>

      </div>

      {/* LIGHTBOX SLIDESHOW PREVIEW */}
      {activeImageIdx !== null && incident.images && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          
          {/* Lightbox Header Close */}
          <div style={{ position: 'absolute', top: '24px', right: '24px', display: 'flex', gap: '16px' }}>
            <button
              onClick={() => handleDownload(incident.images[activeImageIdx])}
              className="btn"
              style={{ backgroundColor: '#ffffff', color: '#000000', padding: '8px 16px', gap: '6px', display: 'flex', alignItems: 'center', fontSize: '0.85rem' }}
            >
              <Download size={16} />
              <span>Download</span>
            </button>
            <button onClick={() => setActiveImageIdx(null)} style={{ border: 'none', backgroundColor: 'transparent', color: '#ffffff', cursor: 'pointer' }}>
              <X size={28} />
            </button>
          </div>

          {/* Lightbox Slider */}
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: '960px', padding: '0 24px', justifyContent: 'space-between' }}>
            
            <button
              onClick={() => setActiveImageIdx((prev) => (prev! > 0 ? prev! - 1 : incident.images.length - 1))}
              style={{ border: 'none', backgroundColor: 'rgba(255,255,255,0.1)', width: '48px', height: '48px', borderRadius: '24px', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronLeft size={24} />
            </button>

            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', height: '65vh', position: 'relative' }}>
              <img src={resolveImageUrl(incident.images[activeImageIdx])} alt="Slideshow Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>

            <button
              onClick={() => setActiveImageIdx((prev) => (prev! < incident.images.length - 1 ? prev! + 1 : 0))}
              style={{ border: 'none', backgroundColor: 'rgba(255,255,255,0.1)', width: '48px', height: '48px', borderRadius: '24px', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronRight size={24} />
            </button>

          </div>

          {/* Page Counter */}
          <span style={{ color: '#888888', marginTop: '16px', fontSize: '0.9rem', fontWeight: 600 }}>
            Image {activeImageIdx + 1} of {incident.images.length}
          </span>

        </div>
      )}

    </div>
  );
}
