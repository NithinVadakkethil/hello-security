'use client';

import { ArrowLeft, Building2, Check, ChevronDown, Search } from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { OrganizationMetric } from './CentralManagerOrganizationSelector';

interface CentralCompanyHeaderProps {
  selectedClientId: string;
  organizations: OrganizationMetric[];
  moduleName: string;
  onBackToOrganizations: () => void;
  onSelectOrganization: (clientId: string) => void;
}

export function CentralCompanyHeader({
  selectedClientId,
  organizations,
  moduleName,
  onBackToOrganizations,
  onSelectOrganization,
}: CentralCompanyHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; placeAbove: boolean }>({
    top: 0,
    left: 0,
    width: 280,
    placeAbove: false,
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentOrg = organizations.find((o) => o.id === selectedClientId);

  const getInitials = (name?: string) => {
    if (!name) return 'ORG';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverHeight = 320;
      const spaceBelow = window.innerHeight - rect.bottom;
      const placeAbove = spaceBelow < popoverHeight && rect.top > popoverHeight;
      const width = Math.max(rect.width, 280);
      const idealLeft = rect.right - width;
      const left = Math.max(12, Math.min(idealLeft, window.innerWidth - width - 12));
      const top = placeAbove
        ? Math.max(12, rect.top - popoverHeight - 6)
        : rect.bottom + 6;

      setCoords({ top, left, width, placeAbove });
    }
  }, []);

  // Update position on open, window scroll, and window resize
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  // Close popover when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setSearchQuery('');
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen && organizations.length > 5 && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, organizations.length]);

  const filteredOrganizations = useMemo(() => {
    if (!searchQuery.trim()) return organizations;
    const q = searchQuery.toLowerCase().trim();
    return organizations.filter(
      (org) =>
        org.companyName?.toLowerCase().includes(q) ||
        org.clientCode?.toLowerCase().includes(q),
    );
  }, [organizations, searchQuery]);

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        marginBottom: '20px',
        padding: '14px 20px',
        borderRadius: '10px',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={onBackToOrganizations}
          className="btn btn-secondary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            padding: '8px 14px',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={16} />
          <span>All Projects</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <span>{moduleName}</span>
          <span>/</span>
          <strong style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {currentOrg?.companyName || 'Selected Project'}
          </strong>
        </div>
      </div>

      {/* Compact Organization Switcher */}
      <div style={{ position: 'relative' }}>
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={() => {
            if (!isOpen) {
              setSearchQuery('');
            }
            setIsOpen(!isOpen);
          }}
          className="btn btn-secondary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '6px 14px',
            fontSize: '13px',
            cursor: 'pointer',
            border: '1px solid #2563EB',
            backgroundColor: 'rgba(37, 99, 235, 0.05)',
          }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '4px',
              backgroundColor: 'rgba(37, 99, 235, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: '800',
              color: '#2563EB',
              overflow: 'hidden',
            }}
          >
            {currentOrg?.clientLogoUrl ? (
              <img src={currentOrg.clientLogoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              getInitials(currentOrg?.companyName)
            )}
          </div>
          <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
            {currentOrg?.companyName || 'Switch Project'}
          </span>
          <ChevronDown
            size={14}
            style={{
              color: '#2563EB',
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
            }}
          />
        </button>

        {mounted && isOpen && createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Switch Assigned Project"
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              zIndex: 99999,
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '10px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              padding: '8px 0',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '340px',
            }}
          >
            <div
              style={{
                padding: '4px 14px 8px 14px',
                borderBottom: '1px solid var(--border-color, #f1f5f9)',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: 'var(--text-muted, #64748b)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Switch Assigned Project
              </div>
              {organizations.length > 5 && (
                <div style={{ position: 'relative', marginTop: '6px' }}>
                  <Search
                    size={13}
                    style={{
                      position: 'absolute',
                      left: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted, #94a3b8)',
                    }}
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search projects..."
                    style={{
                      width: '100%',
                      padding: '5px 8px 5px 26px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color, #cbd5e1)',
                      backgroundColor: 'var(--bg-input, #f8fafc)',
                      outline: 'none',
                      color: 'var(--text-primary, #0f172a)',
                    }}
                  />
                </div>
              )}
            </div>

            <div
              role="menu"
              style={{
                overflowY: 'auto',
                flex: 1,
                padding: '4px 0',
                maxHeight: '260px',
              }}
            >
              {filteredOrganizations.map((org) => {
                const isSelected = org.id === selectedClientId;
                return (
                  <button
                    key={org.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onSelectOrganization(org.id);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 14px',
                      fontSize: '13px',
                      fontWeight: isSelected ? '700' : '500',
                      backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                      color: isSelected ? '#2563EB' : 'var(--text-primary, #0f172a)',
                      border: 'none',
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Building2
                      size={16}
                      style={{
                        color: isSelected ? '#2563EB' : 'var(--text-muted, #94a3b8)',
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {org.companyName}
                    </span>
                    {org.clientCode && (
                      <span
                        style={{
                          fontSize: '10px',
                          color: 'var(--text-muted, #94a3b8)',
                          flexShrink: 0,
                          padding: '2px 6px',
                          backgroundColor: 'rgba(0,0,0,0.04)',
                          borderRadius: '4px',
                        }}
                      >
                        {org.clientCode}
                      </span>
                    )}
                    {isSelected && <Check size={14} style={{ color: '#2563EB', flexShrink: 0 }} />}
                  </button>
                );
              })}
              {filteredOrganizations.length === 0 && (
                <div
                  style={{
                    padding: '12px 14px',
                    fontSize: '12px',
                    color: 'var(--text-muted, #64748b)',
                    textAlign: 'center',
                  }}
                >
                  No projects match &ldquo;{searchQuery}&rdquo;
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
      </div>
    </div>
  );
}

export default CentralCompanyHeader;
