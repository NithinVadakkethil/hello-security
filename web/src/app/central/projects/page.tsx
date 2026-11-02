'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../../lib/axios';
import {
  ProjectItem,
  ProjectSelectionCard,
  ProjectCardSkeleton,
  ProjectCardStyles,
} from '../components/ProjectSelectionCard';

export type { ProjectItem };

export default function CentralProjectsPage() {
  const router = useRouter();

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchProjects = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res: any = await apiClient.get('/central-manager/organizations?lite=true');
      const list = res?.data || (Array.isArray(res) ? res : []);
      setProjects(list);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        'Unable to load authorized projects. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleSelectProject = (projectId: string) => {
    router.push(`/central/dashboard?clientId=${projectId}&from=projects`);
  };

  const trimmedSearch = searchTerm.trim().toLowerCase();

  const filteredProjects = useMemo(() => {
    if (!trimmedSearch) return projects;
    return projects.filter((p) =>
      p.companyName.toLowerCase().includes(trimmedSearch)
    );
  }, [projects, trimmedSearch]);

  return (
    <div className="central-projects-root">
      {/* Page Header with Title and Search */}
      <div className="projects-header-row">
        <div>
          <h1 className="projects-title">All Projects</h1>
          <p className="projects-subtitle">
            Select a project to view its operational dashboard.
          </p>
        </div>

        <div className="projects-search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search projects by name..."
            className="projects-search-input"
            aria-label="Search projects by name"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="search-clear-btn"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="projects-grid">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div className="projects-state-card error">
          <AlertTriangle size={44} style={{ color: '#ef4444' }} />
          <h3>Unable to Load Projects</h3>
          <p>{error}</p>
          <button
            type="button"
            onClick={fetchProjects}
            className="btn btn-primary"
            style={{ marginTop: '12px' }}
          >
            <RefreshCw size={16} style={{ marginRight: '6px' }} />
            Retry Loading
          </button>
        </div>
      )}

      {/* Empty State: No assigned projects */}
      {!isLoading && !error && projects.length === 0 && (
        <div className="projects-state-card">
          <Building2
            size={52}
            style={{ color: 'var(--text-muted)', marginBottom: '12px' }}
          />
          <h3>No Projects Assigned</h3>
          <p>You currently have no assigned projects to manage.</p>
        </div>
      )}

      {/* Empty Search Results */}
      {!isLoading && !error && projects.length > 0 && filteredProjects.length === 0 && (
        <div className="projects-state-card">
          <Search
            size={44}
            style={{ color: 'var(--text-muted)', marginBottom: '12px' }}
          />
          <h3>No matching projects found</h3>
          <p>
            No projects match &ldquo;<strong>{searchTerm}</strong>&rdquo;. Try a
            different search term.
          </p>
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="btn btn-secondary"
            style={{ marginTop: '14px' }}
          >
            Clear Search
          </button>
        </div>
      )}

      {/* Project Cards Grid */}
      {!isLoading && !error && filteredProjects.length > 0 && (
        <div className="projects-grid">
          {filteredProjects.map((project) => (
            <ProjectSelectionCard
              key={project.id}
              project={project}
              onSelect={handleSelectProject}
            />
          ))}
        </div>
      )}

      <ProjectCardStyles />
      <style>{`
        .central-projects-root {
          display: flex;
          flex-direction: column;
          gap: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }
        .projects-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .projects-title {
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--text-primary, #0f172a);
          margin: 0;
          letter-spacing: -0.01em;
        }
        .projects-subtitle {
          font-size: 0.875rem;
          color: var(--text-secondary, #64748b);
          margin: 2px 0 0 0;
        }
      `}</style>
    </div>
  );
}

