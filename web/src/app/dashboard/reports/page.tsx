'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { apiClient } from '../../lib/axios';
import { ApiResponse } from '../../types/api';
import { exportToCsv } from '../../../lib/export';

import AnalyticsCards, { AnalyticsData } from './components/AnalyticsCards';
import AdvancedFilterPanel, { FilterState } from './components/AdvancedFilterPanel';
import InspectionReportTable, { InspectionRow } from './components/InspectionReportTable';
import DetailedReportModal from './components/DetailedReportModal';
import ReportPrintTemplate from './components/ReportPrintTemplate';

const INITIAL_FILTERS: FilterState = {
  datePreset: 'ALL',
  startDate: '',
  endDate: '',
  employeeId: '',
  siteId: '',
  gateId: '',
  status: 'ALL',
  search: '',
};

export default function ReportsPage() {
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState('startedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [selectedReport, setSelectedReport] = useState<InspectionRow | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch employees for dropdown
  const { data: employeesRes } = useQuery<ApiResponse<any[]>>({
    queryKey: ['employees'],
    queryFn: () => apiClient.get('/employees'),
  });
  const employees = employeesRes?.data || [];

  // Fetch sites for dropdown
  const { data: sitesRes } = useQuery<ApiResponse<any[]>>({
    queryKey: ['sites'],
    queryFn: () => apiClient.get('/sites'),
  });
  const sites = sitesRes?.data || [];

  // Fetch gates/checkpoints based on selected site
  const { data: gatesRes } = useQuery<ApiResponse<any[]>>({
    queryKey: ['gates', filters.siteId],
    queryFn: () => apiClient.get(`/gates${filters.siteId ? `?siteId=${filters.siteId}` : ''}`),
  });
  const checkpoints = gatesRes?.data || [];

  // Query params helper
  const queryParams = new URLSearchParams({
    ...(filters.datePreset !== 'ALL' && { datePreset: filters.datePreset }),
    ...(filters.startDate && { startDate: filters.startDate }),
    ...(filters.endDate && { endDate: filters.endDate }),
    ...(filters.employeeId && { employeeId: filters.employeeId }),
    ...(filters.siteId && { siteId: filters.siteId }),
    ...(filters.gateId && { gateId: filters.gateId }),
    ...(filters.status !== 'ALL' && { status: filters.status }),
    ...(filters.search && { search: filters.search }),
    page: page.toString(),
    limit: limit.toString(),
    sortBy,
    sortOrder,
  });

  // Query Analytics Metrics
  const { data: analyticsRes, isLoading: isAnalyticsLoading } = useQuery<ApiResponse<AnalyticsData>>({
    queryKey: ['reports-analytics', queryParams.toString()],
    queryFn: () => apiClient.get(`/reports/analytics?${queryParams.toString()}`),
  });
  const analyticsData = analyticsRes?.data;

  // Query Inspection Logs
  const { data: inspectionsRes, isLoading: isInspectionsLoading } = useQuery<ApiResponse<InspectionRow[]>>({
    queryKey: ['reports-inspections', queryParams.toString()],
    queryFn: () => apiClient.get(`/reports/inspections?${queryParams.toString()}`),
  });
  const inspectionRows = inspectionsRes?.data || [];
  const pagination = (inspectionsRes as any)?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 };

  const handleFilterChange = (updated: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...updated }));
    setPage(1); // Reset to page 1 on filter change
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setPage(1);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      const csvStr = await apiClient.get<string>(`/reports/export/csv?${queryParams.toString()}`);
      if (typeof csvStr === 'string' && csvStr) {
        const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inspection_report_${Date.now()}.csv`;
        a.click();
      } else {
        // Fallback to client-side row export
        const exportRows = inspectionRows.map((r) => ({
          'Report ID': r.id,
          'Patrol Code': r.patrolCode,
          'Started At': new Date(r.startedAt).toLocaleString(),
          'Guard Name': `${r.assignment.employee.firstName} ${r.assignment.employee.lastName}`,
          'Employee ID': r.assignment.employee.employeeNumber,
          'Site Name': r.assignment.site.name,
          'Route / Target': r.assignment.patrolRoute?.name || 'Direct Checkpoints',
          Status: r.status,
          'Duration (Mins)': r.totalDuration ? Math.round(r.totalDuration / 60) : 0,
        }));
        exportToCsv(`inspection_report_${Date.now()}.csv`, exportRows);
      }
      toast.success('CSV Export downloaded successfully.');
    } catch (err: any) {
      toast.error('Failed to export CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSelectRow = (row: InspectionRow) => {
    setSelectedReport(row);
    setIsModalOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      {/* Analytics Summary Cards */}
      <AnalyticsCards data={analyticsData} isLoading={isAnalyticsLoading} />

      {/* Advanced Filter Section */}
      <AdvancedFilterPanel
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
        onExportCsv={handleExportCsv}
        onPrint={handlePrint}
        employees={employees}
        sites={sites}
        checkpoints={checkpoints}
        isExporting={isExporting}
      />

      {/* Inspection Data Table */}
      <InspectionReportTable
        data={inspectionRows}
        isLoading={isInspectionsLoading}
        page={page}
        totalPages={pagination.totalPages}
        totalItems={pagination.total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
        onSelectRow={handleSelectRow}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
      />

      {/* Detailed Audit Modal */}
      <DetailedReportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        report={selectedReport}
      />

      {/* Hidden Print Template for Browser PDF Export */}
      <ReportPrintTemplate
        analytics={analyticsData}
        sessions={inspectionRows}
        filters={filters}
      />
    </div>
  );
}
