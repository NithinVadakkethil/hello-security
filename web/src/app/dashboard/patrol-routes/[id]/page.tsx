'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Edit, MapPin, Clock } from 'lucide-react';
import Link from 'next/link';

import { apiClient } from '../../../lib/axios';
import { ApiResponse } from '../../../types/api';
import StatusChip from '../../../components/ui/StatusChip';
import LoadingState from '../../../components/ui/LoadingState';

interface Gate {
  id: string;
  name: string;
  gateCode: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface RouteGate {
  id: string;
  sequence: number;
  expectedDuration?: number | null;
  gate: Gate;
}

interface PatrolRoute {
  id: string;
  routeCode: string;
  name: string;
  description?: string | null;
  siteId: string;
  isActive: boolean;
  createdAt: string;
  site: {
    id: string;
    name: string;
    address?: string | null;
  };
  routeGates: RouteGate[];
}

export default function PatrolRouteDetailPage() {
  const params = useParams();
  const id = params.id as string;

  // Fetch Patrol Route Details
  const { data: routeRes, isLoading, isError } = useQuery<ApiResponse<PatrolRoute>>({
    queryKey: ['patrol-route', id],
    queryFn: () => apiClient.get(`/patrol-routes/${id}`),
  });

  const route = routeRes?.data;

  if (isLoading) {
    return <LoadingState message="Loading route details..." variant="page" />;
  }

  if (isError || !route) {
    return (
      <div className="error-panel glass-card" style={{ maxWidth: '600px', margin: '50px auto' }}>
        <h3>Patrol Route Not Found</h3>
        <p>The requested route configuration could not be loaded.</p>
        <Link href="/dashboard/patrol-routes" className="btn btn-primary" style={{ marginTop: '16px', textDecoration: 'none' }}>
          Back to Routes
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Back button */}
      <div>
        <Link
          href="/dashboard/patrol-routes"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: 'var(--text-secondary)', fontWeight: 500 }}
        >
          <ArrowLeft size={16} />
          <span>Back to Routes List</span>
        </Link>
      </div>

      {/* Overview Panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
        <div className="glass-card" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                ROUTE CODE: {route.routeCode}
              </span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '4px 0 8px 0' }}>{route.name}</h2>
              <StatusChip status={route.isActive} />
            </div>

            <Link
              href={`/dashboard/patrol-routes/${route.id}/edit`}
              className="btn btn-secondary"
              style={{ gap: '6px', fontSize: '0.85rem', textDecoration: 'none' }}
            >
              <Edit size={14} />
              <span>Modify Route</span>
            </Link>
          </div>

          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>DESCRIPTION / POST ORDERS</p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
              {route.description || 'No special post instructions or patrol tasks registered for this route.'}
            </p>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '28px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={18} className="text-primary" />
            <span>Assigned Location</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>SITE NAME</p>
              <p style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>{route.site?.name}</p>
            </div>

            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>SITE ADDRESS</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                {route.site?.address || 'No Address Listed'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Route Checkpoints Timeline */}
      <div className="glass-card" style={{ padding: '28px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '24px' }}>Path Scan Timeline Checkpoints</h3>

        {route.routeGates?.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '20px 0' }}>
            No checkpoints registered in this route sequence.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', paddingLeft: '24px' }}>
            {/* Vertical Line */}
            <div
              style={{
                position: 'absolute',
                left: '7px',
                top: '12px',
                bottom: '12px',
                width: '2px',
                background: 'var(--border-color)',
                zIndex: 0,
              }}
            ></div>

            {route.routeGates
              .sort((a, b) => a.sequence - b.sequence)
              .map((rg, index) => (
                <div key={rg.id} style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 1 }}>
                  {/* Timeline Dot */}
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      background: 'var(--primary)',
                      border: '4px solid var(--bg-primary)',
                      boxShadow: '0 0 8px var(--primary-glow)',
                      marginTop: '4px',
                      marginLeft: '-23px',
                    }}
                  ></div>

                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: 'var(--bg-tertiary)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>
                        Checkpoint {rg.sequence}
                      </span>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '2px 0' }}>{rg.gate?.name}</h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, fontFamily: 'monospace' }}>
                        GATE CODE: {rg.gate?.gateCode}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      {rg.gate?.latitude && rg.gate?.longitude && (
                        <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>GPS: </span>
                          <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>
                            {rg.gate.latitude.toFixed(5)}, {rg.gate.longitude.toFixed(5)}
                          </span>
                        </div>
                      )}

                      {index < route.routeGates.length - 1 && rg.expectedDuration && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)',
                            background: 'var(--bg-primary)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          <Clock size={12} />
                          <span>+{rg.expectedDuration}m to next</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
