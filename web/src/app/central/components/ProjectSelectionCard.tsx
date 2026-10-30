'use client';

import React, { useState } from 'react';

export interface ProjectItem {
  id: string;
  companyName: string;
  clientCode?: string;
  clientLogoUrl?: string | null;
  dashboardImageUrl?: string | null;
  [key: string]: any;
}

export interface ProjectSelectionCardProps {
  project: ProjectItem;
  onSelect: (id: string) => void;
  ariaLabel?: string;
}

export function getProjectInitials(name?: string): string {
  if (!name) return 'PR';
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

/**
 * Shared Project Selection Card for Community Manager portals:
 * - All Projects (/central/projects)
 * - Reports & Analytics (/central/reports)
 * - Employees (/central/employees)
 *
 * Displays only the project logo and project name.
 * Complete card is clickable with keyboard navigation and responsive hover states.
 */
export function ProjectSelectionCard({
  project,
  onSelect,
  ariaLabel,
}: ProjectSelectionCardProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onSelect(project.id)}
      className="project-card"
      aria-label={ariaLabel || `Open dashboard for ${project.companyName}`}
    >
      <div className="project-logo-box">
        {!imageError && project.clientLogoUrl ? (
          <img
            src={project.clientLogoUrl}
            alt={project.companyName}
            className="project-logo-img"
            onError={() => setImageError(true)}
          />
        ) : (
          <span className="project-logo-fallback">
            {getProjectInitials(project.companyName)}
          </span>
        )}
      </div>

      <div className="project-info-box">
        <h3 className="project-name" title={project.companyName}>
          {project.companyName}
        </h3>
      </div>
    </button>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="project-card-skeleton">
      <div className="skeleton-logo" />
      <div className="skeleton-text" />
    </div>
  );
}

export function ProjectCardStyles() {
  return (
    <style>{`
      .projects-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 20px;
      }
      .project-card {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 20px;
        background: var(--bg-card, #ffffff);
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 14px;
        cursor: pointer;
        text-align: left;
        box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.03);
        transition: all 0.2s ease;
        position: relative;
        width: 100%;
      }
      .project-card:hover {
        border-color: #2563eb;
        transform: translateY(-2px);
        box-shadow: 0 10px 24px -4px rgba(37, 99, 235, 0.12);
      }
      .project-card:focus-visible {
        outline: 2px solid #2563eb;
        outline-offset: 2px;
      }
      .project-logo-box {
        width: 52px;
        height: 52px;
        border-radius: 12px;
        background: rgba(37, 99, 235, 0.08);
        border: 1px solid rgba(37, 99, 235, 0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        flex-shrink: 0;
      }
      .project-logo-img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        padding: 4px;
      }
      .project-logo-fallback {
        font-size: 1.15rem;
        font-weight: 800;
        color: #2563eb;
        letter-spacing: -0.02em;
      }
      .project-info-box {
        flex: 1;
        min-width: 0;
      }
      .project-name {
        margin: 0;
        font-size: 0.975rem;
        font-weight: 800;
        color: var(--text-primary, #0f172a);
        line-height: 1.35;
        letter-spacing: -0.01em;
        white-space: normal;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }
      .project-card-skeleton {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 20px;
        background: var(--bg-card, #ffffff);
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 14px;
      }
      .skeleton-logo {
        width: 52px;
        height: 52px;
        border-radius: 12px;
        background: var(--bg-tertiary, #f1f5f9);
        animation: pulse 1.5s infinite;
        flex-shrink: 0;
      }
      .skeleton-text {
        flex: 1;
        height: 20px;
        border-radius: 6px;
        background: var(--bg-tertiary, #f1f5f9);
        animation: pulse 1.5s infinite;
      }
      .projects-search-wrapper {
        position: relative;
        display: flex;
        align-items: center;
        width: 100%;
        max-width: 360px;
      }
      .search-icon {
        position: absolute;
        left: 14px;
        color: var(--text-muted, #94a3b8);
        pointer-events: none;
      }
      .projects-search-input {
        width: 100%;
        padding: 10px 40px 10px 42px;
        border-radius: 10px;
        border: 1px solid var(--border-color, #e2e8f0);
        background: var(--bg-card, #ffffff);
        color: var(--text-primary, #0f172a);
        font-size: 0.875rem;
        font-weight: 500;
        transition: all 0.15s ease;
      }
      .projects-search-input:focus {
        outline: none;
        border-color: #2563eb;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
      }
      .search-clear-btn {
        position: absolute;
        right: 12px;
        background: transparent;
        border: none;
        color: var(--text-muted, #94a3b8);
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
      }
      .search-clear-btn:hover {
        color: var(--text-primary, #0f172a);
      }
      .projects-state-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 56px 24px;
        background: var(--bg-card, #ffffff);
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 16px;
        text-align: center;
        color: var(--text-secondary);
      }
      .projects-state-card h3 {
        margin: 0 0 6px 0;
        font-size: 1.1rem;
        font-weight: 800;
        color: var(--text-primary, #0f172a);
      }
      .projects-state-card p {
        margin: 0;
        font-size: 0.875rem;
        color: var(--text-secondary, #64748b);
        max-width: 420px;
      }
      @keyframes pulse {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 0.3; }
      }
      @media (max-width: 1200px) {
        .projects-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }
      @media (max-width: 840px) {
        .projects-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @media (max-width: 540px) {
        .projects-grid {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  );
}

export default ProjectSelectionCard;
