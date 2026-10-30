'use client';

import CompletedPatrolSessionsTable from '@/app/central/reports/components/CompletedPatrolSessionsTable';
import MissedCheckpointsModal from '@/app/central/reports/components/MissedCheckpointsModal';
import { formatEmiratesId } from '@/lib/emirates-id';
import {
  AlertCircle,
  BarChart2,
  Calendar,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Layers,
  MapPin,
  User,
  Users,
  X,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { resolveImageUrl } from '../../../../lib/image';
import { apiClient } from '../../../lib/axios';
import { getAccessToken } from '../../../utils/token';
import DetailedReportModal from './DetailedReportModal';
import SearchableSelect, { SearchableOption } from './SearchableSelect';
import WeekPickerPopover, { getWeekBoundaries } from './WeekPickerPopover';

export interface PeriodicReportGeneratorProps {
  clientId?: string;
  isCentralManager?: boolean;
  sites?: any[];
  employees?: any[];
}

export interface ReportDataset {
  metadata: {
    reportType?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
    periodType: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
    periodLabel: string;
    startDate: string;
    endDate: string;
    clientName: string;
    clientLogoUrl?: string | null;
    siteName?: string;
    shiftName?: string;
    roleLabel?: string;
    employeeId?: string;
    employeeName?: string;
    employeeRole?: string;
    employeeNumber?: string;
    emiratesId?: string | null;
    generatedAt: string;
    timezone: string;
    includeIncidents?: boolean;
    isKaizen?: boolean;
  };
  summary: {
    totalEmployees: number;
    activeEmployees: number;
    totalShifts: number;
    assignedPatrols: number;
    completedPatrols: number;
    incompletePatrols: number;
    additionalPatrols: number;
    mandatoryScheduled: number;
    mandatoryCompleted: number;
    mandatoryMissed: number;
    mandatoryCompliancePct: number;
    totalCheckpoints: number;
    checkpointsScanned: number;
    checkpointsMissed: number;
    requiredCheckpoints: number;
    completedCheckpoints: number;
    missedCheckpoints: number;
    checkpointCompletionPct: number;
    incidentsCount: number;
    mandatoryPatrolsScheduled?: number;
    mandatoryPatrolsCompleted?: number;
    mandatoryPatrolsMissed?: number;
    mandatoryPatrolCompliancePct?: number;
    totalPatrolDurationSeconds?: number;
    totalPatrolDurationFormatted?: string;
    totalCheckpointDurationSeconds?: number;
    totalCheckpointDurationFormatted?: string;
    completedPatrolsCount?: number;
    completedCheckpointsCount?: number;
    avgPatrolDurationSeconds?: number;
    avgPatrolDurationFormatted?: string;
    avgCheckpointDurationSeconds?: number;
    avgCheckpointDurationFormatted?: string;
    untrackedDurationPatrolsCount?: number;
    untrackedDurationCheckpointsCount?: number;
  };
  attendance: any[];
  patrols: any[];
  mandatoryPatrols: any[];
  checkpoints: any[];
  incidents: any[];
  siteSummary: any[];
  employeeSummary: any[];
  dailyBreakdown?: Array<{
    date: string;
    shiftName?: string;
    siteName?: string;
    patrolSessionsCount: number;
    patrolDurationSeconds: number;
    patrolDurationFormatted: string;
    checkpointsCount: number;
    checkpointDurationSeconds: number;
    checkpointDurationFormatted: string;
  }>;
}

export function formatRoleLabel(
  role?: string | null,
  designation?: string | null,
): string {
  if (designation && designation.trim()) {
    const dLower = designation.trim().toLowerCase();
    if (
      dLower === 'security' ||
      dLower === 'security guard' ||
      dLower === 'guard'
    ) {
      return 'Security Guard';
    }
    return designation.trim();
  }
  if (!role) return 'Security Guard';
  const ROLE_MAP: Record<string, string> = {
    SECURITY: 'Security Guard',
    SECURITY_GUARD: 'Security Guard',
    GUARD: 'Security Guard',
    CLEANER: 'House Keeping',
    HOUSE_KEEPING: 'House Keeping',
    TECHNICIAN: 'Technician',
    SUPERVISOR: 'Supervisor',
    MANAGER: 'Community Manager',
    COMMUNITY_MANAGER: 'Community Manager',
    CENTRAL_MANAGER: 'Community Manager',
    SERVICE_ENGINEER: 'Service Engineer',
    PLUMBER: 'Plumber',
    LIFE_GUARD: 'Lifeguard',
  };
  return ROLE_MAP[role.toUpperCase()] || role;
}

export default function PeriodicReportGenerator({
  clientId,
  isCentralManager = false,
  sites: propSites,
  employees: propEmployees,
}: PeriodicReportGeneratorProps): React.ReactElement {
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlReportType = (searchParams?.get('reportType') || searchParams?.get('periodType')) as any;
  const urlDate = searchParams?.get('date') || searchParams?.get('month');
  const urlStartDate = searchParams?.get('startDate') || searchParams?.get('fromDate');
  const urlEndDate = searchParams?.get('endDate') || searchParams?.get('toDate');
  const urlTab = searchParams?.get('tab') as any;
  const urlSiteId = searchParams?.get('siteId');
  const urlShiftId = searchParams?.get('shiftId');
  const urlRole = searchParams?.get('role');

  // 1. Report Mode State
  const [reportType, setReportType] = useState<
    'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM'
  >(['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'].includes(urlReportType) ? urlReportType : 'DAILY');

  // Date States
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const defaultPastWeekStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(urlDate || todayStr);
  const [customStartDate, setCustomStartDate] =
    useState<string>(urlStartDate || defaultPastWeekStr);
  const [customEndDate, setCustomEndDate] = useState<string>(urlEndDate || todayStr);

  // Filter States
  const [selectedRole, setSelectedRole] = useState<string>(urlRole || 'ALL');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedShiftId, setSelectedShiftId] = useState<string>(urlShiftId || '');
  const [selectedSiteId, setSelectedSiteId] = useState<string>(urlSiteId || '');

  // UI / Async States
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);
  const [reportData, setReportData] = useState<ReportDataset | null>(null);
  const [activeTab, setActiveTab] = useState<
    | 'summary'
    | 'mandatory'
    | 'attendance'
    | 'patrols'
    | 'checkpoints'
    | 'incidents'
    | 'employeeSummary'
  >(['summary', 'mandatory', 'attendance', 'patrols', 'checkpoints', 'incidents', 'employeeSummary'].includes(urlTab) ? urlTab : 'summary');

  // Central Manager Filtered Completed Patrols State
  const [centralPatrolsData, setCentralPatrolsData] = useState<any | null>(null);
  const [isLoadingCentralPatrols, setIsLoadingCentralPatrols] = useState(false);
  const [centralPatrolsPage, setCentralPatrolsPage] = useState<number>(1);
  const [centralPatrolsLimit, setCentralPatrolsLimit] = useState<number | 'all'>(20);
  const [centralPatrolsSortBy, setCentralPatrolsSortBy] = useState<string>('startedAt');
  const [centralPatrolsSortOrder, setCentralPatrolsSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [detailedReportData, setDetailedReportData] = useState<any | null>(null);
  const [selectedMissedPatrolId, setSelectedMissedPatrolId] = useState<string | null>(null);
  const [selectedMissedPatrolCode, setSelectedMissedPatrolCode] = useState<string | null>(null);
  const [lastGeneratedKey, setLastGeneratedKey] = useState<string | null>(null);

  // Sites, Shifts, Employees
  const [localSites, setLocalSites] = useState<any[]>(propSites || []);
  const [localShifts, setLocalShifts] = useState<any[]>([]);
  const [isLoadingShifts, setIsLoadingShifts] = useState(false);
  const [localEmployees, setLocalEmployees] = useState<any[]>(
    propEmployees || [],
  );
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);

  // Load Sites with race-condition prevention
  useEffect(() => {
    let isMounted = true;
    if (propSites && propSites.length > 0) {
      setLocalSites(propSites);
    } else {
      const url = clientId
        ? `/sites?clientId=${clientId}&limit=100`
        : '/sites?limit=100';
      apiClient
        .get(url)
        .then((res: any) => {
          if (isMounted) {
            setLocalSites(res?.data || (Array.isArray(res) ? res : []));
          }
        })
        .catch(() => {
          if (isMounted) setLocalSites([]);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [clientId, propSites]);

  // Load Shifts (Project Scoped — First Filter in Hello Orbit)
  useEffect(() => {
    let isMounted = true;
    setIsLoadingShifts(true);
    const params = new URLSearchParams();
    params.append('isActive', 'true');
    if (clientId) params.append('clientId', clientId);

    const parseShifts = (res: any): any[] => {
      if (Array.isArray(res)) return res;
      if (Array.isArray(res?.data)) return res.data;
      if (Array.isArray(res?.data?.data)) return res.data.data;
      return [];
    };

    const primaryUrl =
      isCentralManager && clientId
        ? `/central-manager/shifts?${params.toString()}`
        : `/shifts?${params.toString()}`;

    apiClient
      .get(primaryUrl)
      .then((res: any) => {
        if (!isMounted) return;
        const list = parseShifts(res);
        if (list.length > 0) {
          setLocalShifts(list);
        } else if (primaryUrl !== `/shifts?${params.toString()}`) {
          // Fallback to standard /shifts
          apiClient
            .get(`/shifts?${params.toString()}`)
            .then((fallbackRes: any) => {
              if (isMounted) setLocalShifts(parseShifts(fallbackRes));
            })
            .catch(() => {
              if (isMounted) setLocalShifts([]);
            });
        } else {
          setLocalShifts([]);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        const fallbackParams = new URLSearchParams();
        fallbackParams.append('isActive', 'true');
        if (clientId) fallbackParams.append('clientId', clientId);
        apiClient
          .get(`/shifts?${fallbackParams.toString()}`)
          .then((fb: any) => {
            if (isMounted) setLocalShifts(parseShifts(fb));
          })
          .catch(() => {
            if (isMounted) setLocalShifts([]);
          });
      })
      .finally(() => {
        if (isMounted) setIsLoadingShifts(false);
      });

    return () => {
      isMounted = false;
    };
  }, [clientId, isCentralManager]);

  // Load Employees (Project Scoped with Assignments & race prevention)
  useEffect(() => {
    let isMounted = true;
    if (propEmployees && propEmployees.length > 0) {
      setLocalEmployees(propEmployees);
    } else {
      setIsLoadingEmployees(true);
      const url =
        isCentralManager && clientId
          ? `/central-manager/employees?clientId=${clientId}&limit=1000`
          : clientId
            ? `/employees?clientId=${clientId}&limit=1000`
            : '/employees?limit=1000';

      apiClient
        .get(url)
        .then((res: any) => {
          if (!isMounted) return;
          const list = res?.data || (Array.isArray(res) ? res : []);
          setLocalEmployees(Array.isArray(list) ? list : []);
        })
        .catch(() => {
          if (isMounted) setLocalEmployees([]);
        })
        .finally(() => {
          if (isMounted) setIsLoadingEmployees(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [clientId, isCentralManager, propEmployees]);

  // Shift-dependent available sites: sites associated with eligible shift assignments
  const availableSites = useMemo(() => {
    if (!selectedShiftId) return localSites;
    const eligibleSiteIds = new Set<string>();
    localEmployees.forEach((emp: any) => {
      emp.assignments?.forEach((a: any) => {
        if (a.isActive !== false && a.shiftId === selectedShiftId && a.siteId) {
          eligibleSiteIds.add(a.siteId);
        }
      });
    });
    if (eligibleSiteIds.size > 0) {
      return localSites.filter((s: any) => eligibleSiteIds.has(s.id));
    }
    return localSites;
  }, [localSites, localEmployees, selectedShiftId]);

  // Shift & Site dependent available roles
  const availableRoles = useMemo(() => {
    const roleMap = new Map<
      string,
      { role: string; label: string; count: number }
    >();

    let pool = localEmployees;
    if (selectedShiftId) {
      pool = pool.filter((emp: any) =>
        emp.assignments?.some(
          (a: any) => a.isActive !== false && a.shiftId === selectedShiftId,
        ),
      );
    }
    if (selectedSiteId) {
      pool = pool.filter((emp: any) =>
        emp.assignments?.some(
          (a: any) => a.isActive !== false && a.siteId === selectedSiteId,
        ),
      );
    }

    pool.forEach((emp: any) => {
      const r = emp.role || 'SECURITY';
      const label = formatRoleLabel(r, emp.designation);
      if (!roleMap.has(r)) {
        roleMap.set(r, { role: r, label, count: 0 });
      }
      roleMap.get(r)!.count += 1;
    });

    return Array.from(roleMap.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [localEmployees, selectedShiftId, selectedSiteId]);

  // Filter employees dependent on chosen Shift, Site, and Category/Role
  const filteredEmployees = useMemo(() => {
    return localEmployees.filter((emp: any) => {
      if (selectedShiftId) {
        const hasShift = emp.assignments?.some(
          (a: any) => a.isActive !== false && a.shiftId === selectedShiftId,
        );
        if (!hasShift) return false;
      }
      if (selectedSiteId) {
        const hasSite = emp.assignments?.some(
          (a: any) => a.isActive !== false && a.siteId === selectedSiteId,
        );
        if (!hasSite) return false;
      }
      if (selectedRole && selectedRole !== 'ALL') {
        if (emp.role !== selectedRole) return false;
      }
      return true;
    });
  }, [localEmployees, selectedShiftId, selectedSiteId, selectedRole]);

  // Handle Shift Change (1st Filter in sequence): cascade to Role, Site, and Employee
  const handleShiftChange = (newShiftId: string) => {
    setSelectedShiftId(newShiftId);
    setReportData(null);

    // Calculate eligible employees for new shift
    const eligibleEmps = newShiftId
      ? localEmployees.filter((emp: any) =>
          emp.assignments?.some(
            (a: any) => a.isActive !== false && a.shiftId === newShiftId,
          ),
        )
      : localEmployees;

    // 1. Recalculate and validate Role
    if (selectedRole !== 'ALL') {
      const roleStillValid = eligibleEmps.some(
        (emp: any) => emp.role === selectedRole,
      );
      if (!roleStillValid) {
        setSelectedRole('ALL');
      }
    }

    // 2. Recalculate and validate Site
    if (selectedSiteId) {
      const eligibleSiteIds = new Set<string>();
      eligibleEmps.forEach((emp: any) => {
        emp.assignments?.forEach((a: any) => {
          if (a.isActive !== false && a.siteId) {
            eligibleSiteIds.add(a.siteId);
          }
        });
      });
      if (eligibleSiteIds.size > 0 && !eligibleSiteIds.has(selectedSiteId)) {
        setSelectedSiteId('');
      }
    }

    // 3. Recalculate and validate Employee
    if (selectedEmployeeId) {
      const empStillValid = eligibleEmps.some(
        (emp: any) => emp.id === selectedEmployeeId,
      );
      if (!empStillValid) {
        setSelectedEmployeeId('');
      }
    }
  };

  // Handle Role Change (2nd Filter): recalculates eligible employees
  const handleRoleChange = (newRole: string) => {
    setSelectedRole(newRole);
    setReportData(null);

    if (selectedEmployeeId && newRole !== 'ALL') {
      const emp = localEmployees.find((e: any) => e.id === selectedEmployeeId);
      if (emp && emp.role !== newRole) {
        setSelectedEmployeeId('');
      }
    }
  };

  // Handle Site Change (4th Filter): recalculates eligible employees
  const handleSiteChange = (newSiteId: string) => {
    setSelectedSiteId(newSiteId);
    setReportData(null);

    if (selectedEmployeeId && newSiteId) {
      const emp = localEmployees.find((e: any) => e.id === selectedEmployeeId);
      const isAssignedToSite = emp?.assignments?.some(
        (a: any) => a.isActive !== false && a.siteId === newSiteId,
      );
      if (emp && !isAssignedToSite) {
        setSelectedEmployeeId('');
      }
    }
  };

  const selectedEmployeeObj = localEmployees.find(
    (e: any) => e.id === selectedEmployeeId,
  );
  const selectedShiftObj = localShifts.find(
    (s: any) => s.id === selectedShiftId,
  );
  const selectedSiteObj = localSites.find((s: any) => s.id === selectedSiteId);

  // Searchable select options for employees
  const employeeOptions: SearchableOption[] = useMemo(() => {
    return filteredEmployees.map((emp: any) => {
      const name =
        `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Employee';
      const role = formatRoleLabel(emp.role, emp.designation);
      const code = emp.employeeNumber || emp.employeeCode || undefined;
      const rawEid = emp.emiratesId;
      const eid = rawEid ? formatEmiratesId(rawEid) : undefined;
      const eidBadge = eid && eid !== 'Not provided' ? `EID: ${eid}` : null;
      const subLabel = [role, code ? `ID: ${code}` : null, eidBadge].filter(Boolean).join(' • ');

      return {
        id: emp.id,
        label: name,
        subLabel,
        searchValues: [
          name,
          emp.firstName,
          emp.lastName,
          code,
          eid,
          emp.emiratesId,
          role,
          emp.role,
          emp.designation,
          emp.email,
        ],
      };
    });
  }, [filteredEmployees]);

  // Validation for Custom Range
  const isCustomRangeInvalid = useMemo(() => {
    if (reportType !== 'CUSTOM') return false;
    if (!customStartDate || !customEndDate) return true;
    return customEndDate < customStartDate;
  }, [reportType, customStartDate, customEndDate]);

  // Query string builder
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.append('reportType', reportType);

    if (reportType === 'CUSTOM') {
      params.append('startDate', customStartDate);
      params.append('endDate', customEndDate);
      params.append('fromDate', customStartDate);
      params.append('toDate', customEndDate);
    } else if (reportType === 'MONTHLY') {
      params.append('month', selectedDate.substring(0, 7));
      params.append('date', selectedDate);
    } else {
      params.append('date', selectedDate);
    }

    if (clientId) params.append('clientId', clientId);
    if (selectedSiteId) params.append('siteId', selectedSiteId);
    if (selectedShiftId) params.append('shiftId', selectedShiftId);
    if (selectedRole && selectedRole !== 'ALL')
      params.append('role', selectedRole);
    if (selectedEmployeeId) params.append('employeeId', selectedEmployeeId);

    return params.toString();
  };

  // Active Filter Key for Detecting Changes
  const currentFilterKey = `${reportType}|${selectedDate}|${customStartDate}|${customEndDate}|${selectedShiftId}|${selectedRole}|${selectedEmployeeId}|${selectedSiteId}`;

  // When any filter changes after report generation, clear previous results so stale data is never shown
  useEffect(() => {
    if (lastGeneratedKey && lastGeneratedKey !== currentFilterKey) {
      setCentralPatrolsData(null);
      setReportData(null);
      setLastGeneratedKey(null);
    }
  }, [currentFilterKey, lastGeneratedKey]);

  // Fetch Central Manager Filtered Patrol Sessions
  const fetchCentralPatrols = useCallback(
    async (
      targetPage: number = centralPatrolsPage,
      targetLimit: number | 'all' = centralPatrolsLimit,
      targetSortBy: string = centralPatrolsSortBy,
      targetSortOrder: 'asc' | 'desc' = centralPatrolsSortOrder,
    ) => {
      if (!clientId) return;
      if (isCustomRangeInvalid) {
        toast.error('To Date cannot be earlier than From Date.');
        return;
      }

      setIsLoadingCentralPatrols(true);
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.append('clientId', clientId);
        params.append('periodType', reportType);

        if (reportType === 'CUSTOM') {
          params.append('startDate', customStartDate);
          params.append('endDate', customEndDate);
          params.append('fromDate', customStartDate);
          params.append('toDate', customEndDate);
        } else if (reportType === 'MONTHLY') {
          params.append('month', selectedDate.substring(0, 7));
          params.append('date', selectedDate);
        } else {
          params.append('date', selectedDate);
        }

        if (selectedSiteId) params.append('siteId', selectedSiteId);
        if (selectedShiftId) params.append('shiftId', selectedShiftId);
        if (selectedRole && selectedRole !== 'ALL') params.append('role', selectedRole);
        if (selectedEmployeeId) params.append('employeeId', selectedEmployeeId);

        params.append('page', String(targetPage));
        params.append('limit', targetLimit === 'all' ? '100' : String(targetLimit));
        params.append('sortBy', targetSortBy);
        params.append('sortOrder', targetSortOrder);

        const res: any = await apiClient.get(
          `/central-manager/reports/employee-patrols?${params.toString()}`,
        );
        const data = res?.data || res;
        setCentralPatrolsData(data);
        setLastGeneratedKey(currentFilterKey);

        const totalCount =
          data?.pagination?.totalRecords ??
          data?.summary?.totalCompletedPatrols ??
          0;
        const scopeDesc = selectedEmployeeObj
          ? `${selectedEmployeeObj.firstName} ${selectedEmployeeObj.lastName || ''}`.trim()
          : selectedRole !== 'ALL'
            ? `All ${formatRoleLabel(selectedRole)}s`
            : 'All Matching Employees';

        toast.success(
          `${reportType} Report generated: ${totalCount} completed patrol session(s) found for ${scopeDesc}!`,
        );
      } catch (err: any) {
        const msg =
          err?.response?.data?.message ||
          err?.response?.data?.error?.message ||
          'Failed to retrieve completed patrol sessions.';
        toast.error(msg);
      } finally {
        setIsLoadingCentralPatrols(false);
        setIsLoading(false);
      }
    },
    [
      clientId,
      isCustomRangeInvalid,
      reportType,
      customStartDate,
      customEndDate,
      selectedDate,
      selectedSiteId,
      selectedShiftId,
      selectedRole,
      selectedEmployeeId,
      currentFilterKey,
      selectedEmployeeObj,
      centralPatrolsPage,
      centralPatrolsLimit,
      centralPatrolsSortBy,
      centralPatrolsSortOrder,
    ],
  );

  const handlePatrolPageChange = (newPage: number) => {
    setCentralPatrolsPage(newPage);
    fetchCentralPatrols(newPage, centralPatrolsLimit, centralPatrolsSortBy, centralPatrolsSortOrder);
  };

  const handlePatrolPageSizeChange = (newSize: number | 'all') => {
    setCentralPatrolsLimit(newSize);
    setCentralPatrolsPage(1);
    fetchCentralPatrols(1, newSize, centralPatrolsSortBy, centralPatrolsSortOrder);
  };

  const handlePatrolSort = (key: string) => {
    const newSortOrder =
      centralPatrolsSortBy === key && centralPatrolsSortOrder === 'desc'
        ? 'asc'
        : 'desc';
    setCentralPatrolsSortBy(key);
    setCentralPatrolsSortOrder(newSortOrder);
    fetchCentralPatrols(
      centralPatrolsPage,
      centralPatrolsLimit,
      key,
      newSortOrder,
    );
  };

  const handleViewReport = async (patrolId: string) => {
    try {
      const res: any = await apiClient.get(
        `/central-manager/reports/${patrolId}?clientId=${clientId}`,
      );
      const data = res?.data || res;
      setDetailedReportData(data);
      setSelectedReportId(patrolId);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || 'Failed to load report details',
      );
    }
  };

  const handleOpenMissedModal = (patrolId: string, patrolCode: string) => {
    setSelectedMissedPatrolId(patrolId);
    setSelectedMissedPatrolCode(patrolCode);
  };

  const handleDownloadSinglePdf = async (
    patrolId: string,
    patrolCode: string,
  ) => {
    try {
      toast.loading('Generating PDF...', { id: 'single-pdf-toast' });
      const response = await apiClient.get(
        `/central-manager/reports/${patrolId}/pdf?clientId=${clientId}`,
        {
          responseType: 'blob',
        },
      );
      const blob = response?.data || response;
      const url = window.URL.createObjectURL(
        new Blob([blob], { type: 'application/pdf' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `Patrol_Report_${patrolCode || patrolId}.pdf`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Report downloaded successfully', {
        id: 'single-pdf-toast',
      });
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || 'Failed to download PDF',
        { id: 'single-pdf-toast' },
      );
    }
  };

  // Generate Report Action
  const handleGenerateReport = async () => {
    if (isCustomRangeInvalid) {
      toast.error('To Date cannot be earlier than From Date.');
      return;
    }

    if (isCentralManager) {
      setCentralPatrolsPage(1);
      await fetchCentralPatrols(1, centralPatrolsLimit, centralPatrolsSortBy, centralPatrolsSortOrder);
      return;
    }

    setIsLoading(true);
    try {
      const qParams = buildQueryParams();
      const res: any = await apiClient.get(
        `/reports/summary/generate?${qParams}`,
      );
      const data = res?.data || res;
      setReportData(data);
      setLastGeneratedKey(currentFilterKey);
      if (!selectedEmployeeId && activeTab === 'patrols') {
        setActiveTab('summary');
      }

      const scopeDesc = selectedEmployeeObj
        ? `${selectedEmployeeObj.firstName} ${selectedEmployeeObj.lastName || ''}`.trim()
        : selectedRole !== 'ALL'
          ? `All ${formatRoleLabel(selectedRole)}s`
          : 'All Employees';

      toast.success(`${reportType} Report generated for ${scopeDesc}!`);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error?.message ||
        'Failed to generate periodic report.';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Drill-down navigation to dedicated employee completed patrols page
  const handleCompletedPatrolsClick = useCallback(
    (emp: any) => {
      const params = new URLSearchParams();
      if (clientId) params.append('clientId', clientId);
      if (emp.employeeId) params.append('employeeId', emp.employeeId);
      const pType = reportData?.metadata?.periodType || reportType;
      params.append('periodType', pType);

      if (pType === 'CUSTOM') {
        if (customStartDate) params.append('startDate', customStartDate);
        if (customEndDate) params.append('endDate', customEndDate);
        if (customStartDate) params.append('fromDate', customStartDate);
        if (customEndDate) params.append('toDate', customEndDate);
      } else if (pType === 'MONTHLY') {
        params.append('month', selectedDate.substring(0, 7));
        params.append('date', selectedDate);
      } else {
        params.append('date', selectedDate);
      }

      if (selectedSiteId) params.append('siteId', selectedSiteId);
      if (selectedShiftId) params.append('shiftId', selectedShiftId);
      if (selectedRole && selectedRole !== 'ALL') params.append('role', selectedRole);

      const targetRoute = isCentralManager
        ? `/central/reports/employee-patrols?${params.toString()}`
        : `/dashboard/reports/employee-patrols?${params.toString()}`;
      router.push(targetRoute);
    },
    [
      clientId,
      reportData,
      reportType,
      customStartDate,
      customEndDate,
      selectedDate,
      selectedSiteId,
      selectedShiftId,
      selectedRole,
      isCentralManager,
      router,
    ],
  );

  // Auto-generate report if returning from drill-down with URL parameters
  const hasAutoTriggeredRef = useRef(false);
  useEffect(() => {
    if (!hasAutoTriggeredRef.current && clientId && (urlReportType || urlDate)) {
      hasAutoTriggeredRef.current = true;
      handleGenerateReport();
    }
  }, [clientId, urlReportType, urlDate]);

  // PDF Export
  const handleDownloadPdf = async () => {
    if (isCustomRangeInvalid) {
      toast.error('Please resolve invalid date range before downloading.');
      return;
    }

    setIsDownloadingPdf(true);
    const toastId = toast.loading('Generating PDF document...');
    try {
      const qParams = buildQueryParams();
      const token = getAccessToken();
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

      const response = await fetch(
        `${API_BASE_URL}/reports/summary/pdf?${qParams}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `HelloOrbit_${reportType}_Report_${selectedDate}.pdf`;
      if (contentDisposition && contentDisposition.includes('filename=')) {
        filename = contentDisposition.split('filename=')[1].replace(/"/g, '');
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('PDF report downloaded successfully!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to download PDF.', { id: toastId });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Excel Export
  const handleDownloadExcel = async () => {
    if (isCustomRangeInvalid) {
      toast.error('Please resolve invalid date range before downloading.');
      return;
    }

    setIsDownloadingExcel(true);
    const toastId = toast.loading('Generating Excel spreadsheet...');
    try {
      const qParams = buildQueryParams();
      const token = getAccessToken();
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

      const response = await fetch(
        `${API_BASE_URL}/reports/summary/excel?${qParams}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error('Failed to download Excel file');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `HelloOrbit_${reportType}_Report_${selectedDate}.xlsx`;
      if (contentDisposition && contentDisposition.includes('filename=')) {
        filename = contentDisposition.split('filename=')[1].replace(/"/g, '');
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('Excel report downloaded successfully!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to download Excel.', { id: toastId });
    } finally {
      setIsDownloadingExcel(false);
    }
  };

  const isEmployeeScoped = Boolean(reportData?.metadata?.employeeId);

  // Real-time formatted period string for summary badge
  const activePeriodSummary = useMemo(() => {
    if (reportType === 'DAILY') {
      const p = selectedDate.split('-');
      if (p.length === 3) {
        const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
        return d.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
        });
      }
      return selectedDate;
    } else if (reportType === 'WEEKLY') {
      return getWeekBoundaries(selectedDate).label;
    } else if (reportType === 'MONTHLY') {
      const p = selectedDate.split('-');
      if (p.length >= 2) {
        const d = new Date(Number(p[0]), Number(p[1]) - 1, 1);
        return d.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        });
      }
      return selectedDate.substring(0, 7);
    } else {
      return `${customStartDate} to ${customEndDate}`;
    }
  }, [reportType, selectedDate, customStartDate, customEndDate]);

  return (
    <div
      className="glass-card"
      style={{
        padding: '24px',
        borderRadius: '16px',
        border: '1px solid rgba(226, 232, 240, 0.8)',
        background: '#ffffff',
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      {/* Header & Mode Switcher */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          paddingBottom: '16px',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              margin: 0,
              color: '#1e293b',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <FileText size={22} className="text-blue-600" />
            Periodic Summary Reports
          </h2>
          <p
            style={{
              fontSize: '0.85rem',
              color: '#64748b',
              margin: '4px 0 0 0',
            }}
          >
            Generate authoritative general, role-scoped, or employee-specific
            compliance, attendance, and patrol reports.
          </p>
        </div>

        {/* 1. Report Mode Selector Buttons (Daily, Weekly, Monthly, Custom Range) */}
        <div
          style={{
            display: 'inline-flex',
            backgroundColor: '#f1f5f9',
            padding: '4px',
            borderRadius: '10px',
            gap: '4px',
          }}
        >
          {(
            [
              { id: 'DAILY', label: 'Daily' },
              { id: 'WEEKLY', label: 'Weekly' },
              { id: 'MONTHLY', label: 'Monthly' },
              { id: 'CUSTOM', label: 'Custom Range' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setReportType(t.id);
                setReportData(null);
              }}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backgroundColor:
                  reportType === t.id ? '#2563eb' : 'transparent',
                color: reportType === t.id ? '#ffffff' : '#64748b',
                boxShadow:
                  reportType === t.id
                    ? '0 2px 4px rgba(37,99,235,0.2)'
                    : 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Controls Toolbar: Order (1. Report Type above, 2. Role, 3. Employee, 4. Shift, 5. Site, 6. Date, 7. Generate) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          backgroundColor: '#f8fafc',
          padding: '20px',
          borderRadius: '14px',
          border: '1px solid #edf2f7',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '16px',
            alignItems: 'end',
          }}
        >
          {/* 1. Shift Selector (First Filter in Hello Orbit) */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#475569',
                marginBottom: '6px',
              }}
            >
              <Clock
                size={14}
                style={{
                  display: 'inline',
                  marginRight: '4px',
                  color: '#2563eb',
                }}
              />
              Shift
            </label>
            <select
              value={selectedShiftId}
              onChange={(e) => handleShiftChange(e.target.value)}
              className="form-input"
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '0.88rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                fontWeight: 500,
              }}
              aria-label="Filter by Shift"
            >
              <option value="">
                {isLoadingShifts
                  ? 'Loading shifts...'
                  : localShifts.length > 0
                    ? `All Shifts (${localShifts.length})`
                    : 'All Shifts'}
              </option>
              {localShifts.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}{' '}
                  {s.startTime && s.endTime
                    ? `(${s.startTime} – ${s.endTime})`
                    : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Employee Category / Role Dropdown (Cascades from Shift) */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#475569',
                marginBottom: '6px',
              }}
            >
              <Users
                size={14}
                style={{
                  display: 'inline',
                  marginRight: '4px',
                  color: '#2563eb',
                }}
              />
              Employee Category / Role
            </label>
            <select
              value={selectedRole}
              onChange={(e) => handleRoleChange(e.target.value)}
              className="form-input"
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '0.88rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                fontWeight: 500,
              }}
              aria-label="Filter by Employee Category or Role"
            >
              <option value="ALL">
                All Roles ({availableRoles.reduce((acc, r) => acc + r.count, 0)}
                )
              </option>
              {availableRoles.map((r) => (
                <option key={r.role} value={r.role}>
                  {r.label} ({r.count})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Searchable Employee Dropdown (Dependent on Shift, Role & Site) */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '6px',
              }}
            >
              <label
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <User size={14} style={{ color: '#2563eb' }} />
                Employee (Optional)
              </label>
              {selectedEmployeeId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEmployeeId('');
                    setReportData(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    padding: '0 4px',
                  }}
                  title="Clear selected employee"
                >
                  <X size={12} /> Clear
                </button>
              )}
            </div>
            <SearchableSelect
              value={selectedEmployeeId}
              onChange={(val) => {
                setSelectedEmployeeId(val);
                setReportData(null);
              }}
              options={employeeOptions}
              defaultLabel={
                isLoadingEmployees
                  ? 'Loading employees...'
                  : selectedRole !== 'ALL'
                    ? `All ${formatRoleLabel(selectedRole)}s (${filteredEmployees.length})`
                    : `All Matching Employees (${filteredEmployees.length})`
              }
              searchPlaceholder="Search by name, role, staff ID..."
              emptyMessage={
                isLoadingEmployees
                  ? 'Loading employee directory...'
                  : selectedRole !== 'ALL'
                    ? `No employees in ${formatRoleLabel(selectedRole)} role.`
                    : 'No matching employees found for selected filters.'
              }
              ariaLabel="Filter Report by Employee"
            />
          </div>

          {/* 4. Filter Site (Optional) (Associated with Shift & Project) */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#475569',
                marginBottom: '6px',
              }}
            >
              <MapPin
                size={14}
                style={{
                  display: 'inline',
                  marginRight: '4px',
                  color: '#2563eb',
                }}
              />
              Filter Site (Optional)
            </label>
            <select
              value={selectedSiteId}
              onChange={(e) => handleSiteChange(e.target.value)}
              className="form-input"
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '0.88rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                fontWeight: 500,
              }}
              aria-label="Filter by Site"
            >
              <option value="">
                {selectedShiftId
                  ? `All Matching Sites (${availableSites.length})`
                  : `All Sites (${availableSites.length})`}
              </option>
              {availableSites.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* 6. Date / Week / Month / Custom Range Controls */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#475569',
                marginBottom: '6px',
              }}
            >
              <Calendar
                size={14}
                style={{
                  display: 'inline',
                  marginRight: '4px',
                  color: '#2563eb',
                }}
              />
              {reportType === 'DAILY'
                ? 'Target Date'
                : reportType === 'WEEKLY'
                  ? 'Weekly Calendar'
                  : reportType === 'MONTHLY'
                    ? 'Target Month'
                    : 'Custom Date Range'}
            </label>

            {reportType === 'DAILY' && (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setReportData(null);
                }}
                className="form-input"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '0.88rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                }}
              />
            )}

            {reportType === 'WEEKLY' && (
              <WeekPickerPopover
                value={selectedDate}
                onChange={(newMonday) => {
                  setSelectedDate(newMonday);
                  setReportData(null);
                }}
              />
            )}

            {reportType === 'MONTHLY' && (
              <input
                type="month"
                value={selectedDate.substring(0, 7)}
                onChange={(e) => {
                  setSelectedDate(`${e.target.value}-01`);
                  setReportData(null);
                }}
                className="form-input"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '0.88rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                }}
              />
            )}

            {reportType === 'CUSTOM' && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                }}
              >
                <div>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => {
                      setCustomStartDate(e.target.value);
                      setReportData(null);
                    }}
                    className="form-input"
                    style={{
                      width: '100%',
                      padding: '7px 8px',
                      fontSize: '0.82rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                    }}
                    title="From Date"
                  />
                </div>
                <div>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => {
                      setCustomEndDate(e.target.value);
                      setReportData(null);
                    }}
                    className="form-input"
                    style={{
                      width: '100%',
                      padding: '7px 8px',
                      fontSize: '0.82rem',
                      borderRadius: '8px',
                      border: isCustomRangeInvalid
                        ? '1px solid #dc2626'
                        : '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                    }}
                    title="To Date"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 7. Generate Report Action Button */}
          <div>
            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={isLoading || isCustomRangeInvalid}
              style={{
                // width: '100%',
                marginLeft: '100px',
                padding: '9px 9px',
                fontSize: '0.9rem',
                fontWeight: 600,
                borderRadius: '8px',
                backgroundColor: isCustomRangeInvalid ? '#94a3b8' : '#2563eb',
                color: '#ffffff',
                border: 'none',
                cursor:
                  isLoading || isCustomRangeInvalid ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: isCustomRangeInvalid
                  ? 'none'
                  : '0 2px 4px rgba(37, 99, 235, 0.25)',
              }}
            >
              {isLoading ? (
                <span>Generating...</span>
              ) : (
                <>
                  <BarChart2 size={16} />
                  <span>Generate</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Custom Range Error Notification */}
        {isCustomRangeInvalid && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#dc2626',
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '6px 12px',
              backgroundColor: '#fef2f2',
              borderRadius: '6px',
              border: '1px solid #fecaca',
            }}
          >
            <AlertCircle size={14} />
            <span>
              To Date cannot be earlier than From Date. Please select a valid
              range.
            </span>
          </div>
        )}

        {/* Compact Filter Scope Summary Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            fontSize: '0.8rem',
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: selectedEmployeeId ? '#eff6ff' : '#f1f5f9',
            border: `1px solid ${selectedEmployeeId ? '#bfdbfe' : '#e2e8f0'}`,
            color: selectedEmployeeId ? '#1e40af' : '#334155',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 700,
            }}
          >
            <Layers size={14} style={{ color: '#2563eb' }} />
            <span>Report Scope:</span>
          </div>

          <span
            style={{
              backgroundColor: '#ffffff',
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid #cbd5e1',
            }}
          >
            <strong>Mode:</strong>{' '}
            {reportType === 'CUSTOM'
              ? 'Custom Range'
              : reportType.charAt(0) + reportType.slice(1).toLowerCase()}
          </span>

          <span
            style={{
              backgroundColor: '#ffffff',
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid #cbd5e1',
            }}
          >
            <strong>Shift:</strong>{' '}
            {selectedShiftObj ? selectedShiftObj.name : 'All Shifts'}
          </span>

          <span
            style={{
              backgroundColor: '#ffffff',
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid #cbd5e1',
            }}
          >
            <strong>Category:</strong>{' '}
            {selectedRole !== 'ALL'
              ? formatRoleLabel(selectedRole)
              : 'All Roles'}
          </span>

          <span
            style={{
              backgroundColor: '#ffffff',
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid #cbd5e1',
            }}
          >
            <strong>Employee:</strong>{' '}
            {selectedEmployeeObj
              ? `${selectedEmployeeObj.firstName} ${selectedEmployeeObj.lastName || ''}`.trim()
              : selectedRole !== 'ALL'
                ? `All ${formatRoleLabel(selectedRole)}s`
                : 'All Matching Employees'}
          </span>

          <span
            style={{
              backgroundColor: '#ffffff',
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid #cbd5e1',
            }}
          >
            <strong>Site:</strong>{' '}
            {selectedSiteObj ? selectedSiteObj.name : 'All Sites'}
          </span>

          <span
            style={{
              backgroundColor: '#ffffff',
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid #cbd5e1',
            }}
          >
            <strong>Period:</strong> {activePeriodSummary}
          </span>
        </div>
      </div>

      {/* Central Manager: Completed Patrol Sessions Table */}
      {isCentralManager && centralPatrolsData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header & Export Toolbar */}
          <div
            className="glass-card"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderRadius: '12px',
              backgroundColor: isEmployeeScoped ? '#f0fdf4' : '#eff6ff',
              border: `1px solid ${isEmployeeScoped ? '#bbf7d0' : '#bfdbfe'}`,
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {centralPatrolsData.project?.clientLogoUrl && (
                <div
                  style={{
                    maxHeight: '48px',
                    maxWidth: '120px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    padding: '4px 8px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <img
                    src={resolveImageUrl(centralPatrolsData.project.clientLogoUrl)}
                    alt="Client Logo"
                    style={{
                      maxHeight: '40px',
                      maxWidth: '100px',
                      objectFit: 'contain',
                    }}
                  />
                </div>
              )}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    Completed Patrol Sessions
                  </h2>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                    }}
                  >
                    {centralPatrolsData.pagination?.totalRecords ?? centralPatrolsData.summary?.totalCompletedPatrols ?? 0}
                  </span>
                </div>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                  Patrol sessions matching the selected reporting filters.
                </p>
                <div
                  style={{
                    fontSize: '0.82rem',
                    color: isEmployeeScoped ? '#15803d' : '#3b82f6',
                    marginTop: '6px',
                    display: 'flex',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span>
                    Period:{' '}
                    <strong>
                      {centralPatrolsData.period?.periodLabel ||
                        `${centralPatrolsData.period?.startDate} to ${centralPatrolsData.period?.endDate}`}
                    </strong>
                  </span>
                  <span>Timezone: {centralPatrolsData.period?.timezone || 'Asia/Dubai'}</span>
                  {selectedEmployeeObj ? (
                    <span>
                      Employee: <strong>{selectedEmployeeObj.firstName} {selectedEmployeeObj.lastName || ''}</strong>
                    </span>
                  ) : (
                    <span>
                      Scope: <strong>{selectedRole !== 'ALL' ? formatRoleLabel(selectedRole) : 'All Matching Employees'}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Export Action Controls */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  cursor: isDownloadingPdf ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
                }}
              >
                <Download size={14} />
                <span>{isDownloadingPdf ? 'Downloading...' : 'PDF Report'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadExcel}
                disabled={isDownloadingExcel}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  cursor: isDownloadingExcel ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)',
                }}
              >
                <Download size={14} />
                <span>{isDownloadingExcel ? 'Downloading...' : 'Excel (.xlsx)'}</span>
              </button>
            </div>
          </div>

          {/* KPI Summary Metric Cards */}
          {centralPatrolsData.summary && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px',
              }}
            >
              {/* Card 1: Completed Patrols */}
              <div
                className="glass-card"
                style={{
                  padding: '18px 20px',
                  borderRadius: '12px',
                  borderLeft: '4px solid #2563eb',
                  backgroundColor: 'var(--bg-card)',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                  }}
                >
                  Completed Patrols
                </div>
                <div
                  style={{
                    fontSize: '1.75rem',
                    fontWeight: 800,
                    color: '#2563eb',
                  }}
                >
                  {centralPatrolsData.summary.totalCompletedPatrols ??
                    centralPatrolsData.pagination?.totalRecords ??
                    0}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    marginTop: '4px',
                  }}
                >
                  Eligible patrol sessions
                </div>
              </div>

              {/* Card 2: Total Patrol Duration */}
              <div
                className="glass-card"
                style={{
                  padding: '18px 20px',
                  borderRadius: '12px',
                  borderLeft: '4px solid #16a34a',
                  backgroundColor: 'var(--bg-card)',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                  }}
                >
                  Total Patrol Duration
                </div>
                <div
                  style={{
                    fontSize: '1.75rem',
                    fontWeight: 800,
                    color: '#16a34a',
                  }}
                >
                  {centralPatrolsData.summary.totalPatrolDurationFormatted ||
                    '0 sec'}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    marginTop: '4px',
                  }}
                >
                  Period overlap duration
                </div>
              </div>

              {/* Card 3: Total Checkpoints */}
              <div
                className="glass-card"
                style={{
                  padding: '18px 20px',
                  borderRadius: '12px',
                  borderLeft: '4px solid #0891b2',
                  backgroundColor: 'var(--bg-card)',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                  }}
                >
                  Total Checkpoints
                </div>
                <div
                  style={{
                    fontSize: '1.75rem',
                    fontWeight: 800,
                    color: '#0891b2',
                  }}
                >
                  {centralPatrolsData.summary.totalCheckpoints ??
                    centralPatrolsData.summary.totalCheckpointsRequired ??
                    0}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    marginTop: '4px',
                  }}
                >
                  Total checkpoints
                </div>
              </div>

              {/* Card 4: Checkpoints Scanned */}
              <div
                className="glass-card"
                style={{
                  padding: '18px 20px',
                  borderRadius: '12px',
                  borderLeft: '4px solid #8b5cf6',
                  backgroundColor: 'var(--bg-card)',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                  }}
                >
                  Checkpoints Scanned
                </div>
                <div
                  style={{
                    fontSize: '1.75rem',
                    fontWeight: 800,
                    color: '#8b5cf6',
                  }}
                >
                  {centralPatrolsData.summary.totalCheckpointsScanned ?? 0}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    marginTop: '4px',
                  }}
                >
                  Eligible checkpoint scans
                </div>
              </div>

              {/* Card 5: Checkpoints Missed */}
              <div
                className="glass-card"
                style={{
                  padding: '18px 20px',
                  borderRadius: '12px',
                  borderLeft: '4px solid #dc2626',
                  backgroundColor: 'var(--bg-card)',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                  }}
                >
                  Checkpoints Missed
                </div>
                <div
                  style={{
                    fontSize: '1.75rem',
                    fontWeight: 800,
                    color: '#dc2626',
                  }}
                >
                  {centralPatrolsData.summary.totalCheckpointsMissed ?? 0}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    marginTop: '4px',
                  }}
                >
                  Unscanned checkpoints
                </div>
              </div>

              {/* Card 6: Average Compliance */}
              <div
                className="glass-card"
                style={{
                  padding: '18px 20px',
                  borderRadius: '12px',
                  borderLeft: '4px solid #f59e0b',
                  backgroundColor: 'var(--bg-card)',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                  }}
                >
                  Average Compliance
                </div>
                <div
                  style={{
                    fontSize: '1.75rem',
                    fontWeight: 800,
                    color: '#f59e0b',
                  }}
                >
                  {centralPatrolsData.summary.averageCompliancePct ?? 0}%
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    marginTop: '4px',
                  }}
                >
                  Checkpoint scan rate
                </div>
              </div>
            </div>
          )}

          {/* Reusable Completed Patrol Sessions Table */}
          <CompletedPatrolSessionsTable
            patrols={centralPatrolsData.patrols || []}
            showEmployeeColumn={true}
            showSiteColumn={false}
            showComplianceColumn={false}
            isLoading={isLoadingCentralPatrols}
            clientId={clientId || ''}
            onViewReport={handleViewReport}
            onDownloadPdf={handleDownloadSinglePdf}
            onOpenMissedModal={handleOpenMissedModal}
            page={centralPatrolsData.pagination?.currentPage || centralPatrolsPage}
            pageSize={centralPatrolsData.pagination?.pageSize || centralPatrolsLimit}
            totalPages={centralPatrolsData.pagination?.totalPages || 1}
            totalCount={centralPatrolsData.pagination?.totalRecords ?? centralPatrolsData.summary?.totalCompletedPatrols ?? 0}
            onPageChange={handlePatrolPageChange}
            onPageSizeChange={handlePatrolPageSizeChange}
            sortBy={centralPatrolsSortBy}
            sortOrder={centralPatrolsSortOrder}
            onSort={handlePatrolSort}
          />

          {/* Detailed Report Modal */}
          {selectedReportId && (
            <DetailedReportModal
              isOpen={!!selectedReportId}
              onClose={() => {
                setSelectedReportId(null);
                setDetailedReportData(null);
              }}
              report={detailedReportData}
            />
          )}

          {/* Missed Checkpoints Modal */}
          {selectedMissedPatrolId && (
            <MissedCheckpointsModal
              isOpen={!!selectedMissedPatrolId}
              onClose={() => {
                setSelectedMissedPatrolId(null);
                setSelectedMissedPatrolCode(null);
              }}
              patrolId={selectedMissedPatrolId}
              patrolCode={selectedMissedPatrolCode}
              clientId={clientId || ''}
            />
          )}
        </div>
      )}

      {/* Generated Report Summary Container (Client Admin Portal) */}
      {!isCentralManager && reportData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Metadata Banner & Export Controls */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderRadius: '12px',
              backgroundColor: isEmployeeScoped ? '#f0fdf4' : '#eff6ff',
              border: `1px solid ${isEmployeeScoped ? '#bbf7d0' : '#bfdbfe'}`,
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {reportData.metadata.clientLogoUrl && (
                <div
                  style={{
                    maxHeight: '48px',
                    maxWidth: '120px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    padding: '4px 8px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <img
                    src={resolveImageUrl(reportData.metadata.clientLogoUrl)}
                    alt="Client Logo"
                    style={{
                      maxHeight: '40px',
                      maxWidth: '100px',
                      objectFit: 'contain',
                    }}
                  />
                </div>
              )}
              <div>
                <div
                  style={{
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: isEmployeeScoped ? '#166534' : '#1e40af',
                    fontWeight: 700,
                  }}
                >
                  {reportData.metadata.periodType ||
                    reportData.metadata.reportType}{' '}
                  {isEmployeeScoped ? 'EMPLOYEE REPORT' : 'REPORT AUDIT'}
                </div>
                <div
                  style={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: isEmployeeScoped ? '#14532d' : '#1e3a8a',
                    marginTop: '2px',
                  }}
                >
                  {reportData.metadata.clientName}{' '}
                  {reportData.metadata.siteName
                    ? `• ${reportData.metadata.siteName}`
                    : ''}
                  {reportData.metadata.shiftName
                    ? ` • ${reportData.metadata.shiftName}`
                    : ''}
                </div>

                {isEmployeeScoped ? (
                  <div
                    style={{
                      fontSize: '0.92rem',
                      fontWeight: 600,
                      color: '#166534',
                      marginTop: '4px',
                    }}
                  >
                    👤 Employee:{' '}
                    <strong>{reportData.metadata.employeeName}</strong> (
                    {reportData.metadata.employeeRole || 'Security Guard'})
                    {reportData.metadata.employeeNumber
                      ? ` • ID: ${reportData.metadata.employeeNumber}`
                      : ''}
                    {' • Emirates ID: '}
                    <strong>{reportData.metadata.emiratesId || 'Not provided'}</strong>
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      color: '#1e40af',
                      marginTop: '4px',
                    }}
                  >
                    👥 Category Scope:{' '}
                    <strong>
                      {reportData.metadata.roleLabel || 'All Roles'}
                    </strong>
                  </div>
                )}

                <div
                  style={{
                    fontSize: '0.82rem',
                    color: isEmployeeScoped ? '#15803d' : '#3b82f6',
                    marginTop: '2px',
                    display: 'flex',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span>
                    Period:{' '}
                    <strong>
                      {reportData.metadata.periodLabel ||
                        `${reportData.metadata.startDate} to ${reportData.metadata.endDate}`}
                    </strong>
                  </span>
                  <span>Timezone: {reportData.metadata.timezone}</span>
                  <span>
                    Generated:{' '}
                    {new Date(reportData.metadata.generatedAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Download Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  cursor: isDownloadingPdf ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
                }}
              >
                <Download size={14} />
                <span>
                  {isDownloadingPdf ? 'Downloading...' : 'PDF Report'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleDownloadExcel}
                disabled={isDownloadingExcel}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  cursor: isDownloadingExcel ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
                }}
              >
                <Download size={14} />
                <span>
                  {isDownloadingExcel ? 'Downloading...' : 'Excel (.xlsx)'}
                </span>
              </button>
            </div>
          </div>

          {/* Patrol & Checkpoint Duration Summary (4 Compact KPI Cards) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              backgroundColor: '#f8fafc',
              padding: '18px 20px',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Clock size={18} className="text-blue-600" />
                <span
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: '#0f172a',
                  }}
                >
                  Patrol & Checkpoint Duration Summary
                </span>
                {isEmployeeScoped && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#dcfce7',
                      color: '#15803d',
                    }}
                  >
                    Employee Scoped
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Clipped to reporting period boundaries • No double-counting
              </span>
            </div>

            {/* 4 Compact Duration KPI Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '14px',
              }}
            >
              {/* Card 1: Total Patrol Duration */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid #bfdbfe',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#1e40af',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Total Patrol Duration
                </div>
                <div
                  style={{
                    fontSize: '1.65rem',
                    fontWeight: 800,
                    color: '#1e3a8a',
                    marginTop: '4px',
                  }}
                >
                  {reportData.summary.totalPatrolDurationFormatted || '0 sec'}
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#64748b',
                    marginTop: '4px',
                  }}
                >
                  {reportData.summary.completedPatrolsCount ??
                    reportData.summary.completedPatrols ??
                    0}{' '}
                  Completed Sessions
                  {reportData.summary.avgPatrolDurationFormatted
                    ? ` (Avg: ${reportData.summary.avgPatrolDurationFormatted})`
                    : ''}
                </div>
              </div>

              {/* Card 2: Total Checkpoint Duration */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid #bbf7d0',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#15803d',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Total Checkpoint Duration
                </div>
                <div
                  style={{
                    fontSize: '1.65rem',
                    fontWeight: 800,
                    color: '#14532d',
                    marginTop: '4px',
                  }}
                >
                  {reportData.summary.totalCheckpointDurationFormatted ||
                    '0 sec'}
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#64748b',
                    marginTop: '4px',
                  }}
                >
                  {reportData.summary.completedCheckpointsCount ??
                    reportData.summary.completedCheckpoints ??
                    reportData.summary.checkpointsScanned ??
                    0}{' '}
                  Completed Checkpoints
                  {reportData.summary.avgCheckpointDurationFormatted
                    ? ` (Avg: ${reportData.summary.avgCheckpointDurationFormatted})`
                    : ''}
                </div>
              </div>

              {/* Card 3: Completed Patrols */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#475569',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Completed Patrols
                </div>
                <div
                  style={{
                    fontSize: '1.65rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    marginTop: '4px',
                  }}
                >
                  {reportData.summary.completedPatrolsCount ??
                    reportData.summary.completedPatrols ??
                    0}
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#64748b',
                    marginTop: '4px',
                  }}
                >
                  {reportData.summary.untrackedDurationPatrolsCount
                    ? `${reportData.summary.untrackedDurationPatrolsCount} with unavailable duration`
                    : '100% with verified timestamps'}
                </div>
              </div>

              {/* Card 4: Completed Checkpoints */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#475569',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Completed Checkpoints
                </div>
                <div
                  style={{
                    fontSize: '1.65rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    marginTop: '4px',
                  }}
                >
                  {reportData.summary.completedCheckpointsCount ??
                    reportData.summary.completedCheckpoints ??
                    reportData.summary.checkpointsScanned ??
                    0}
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#64748b',
                    marginTop: '4px',
                  }}
                >
                  {reportData.summary.untrackedDurationCheckpointsCount
                    ? `${reportData.summary.untrackedDurationCheckpointsCount} with unavailable duration`
                    : '100% with verified scan duration'}
                </div>
              </div>
            </div>

            {/* Crucial aggregation rule disclaimer */}
            <div
              style={{
                fontSize: '0.75rem',
                color: '#64748b',
                lineHeight: 1.4,
                backgroundColor: '#ffffff',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
              }}
            >
              * <strong>Aggregation Policy:</strong> Total Patrol Duration and
              Total Checkpoint Inspection Duration are reported as separate
              metrics. Checkpoint inspections are conducted during patrol
              sessions and must <em>not</em> be summed together to represent
              physical working time. Elapsed durations reflect activity
              overlapping the selected reporting period.
            </div>
          </div>

          {/* Daily Duration & Activity Breakdown Table (For Selected Employee or when breakdown records exist) */}
          {reportData.dailyBreakdown &&
            reportData.dailyBreakdown.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  backgroundColor: '#ffffff',
                  padding: '18px 20px',
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      color: '#1e293b',
                    }}
                  >
                    Daily Duration & Activity Breakdown
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {reportData.dailyBreakdown.length} day(s) recorded
                  </span>
                </div>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.82rem',
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        backgroundColor: '#f8fafc',
                        borderBottom: '2px solid #cbd5e1',
                        textAlign: 'left',
                      }}
                    >
                      <th style={{ padding: '8px 10px' }}>Date</th>
                      {/* <th style={{ padding: '8px 10px' }}>Shift</th>
                      <th style={{ padding: '8px 10px' }}>Site</th> */}
                      <th style={{ padding: '8px 10px' }}>Patrol Sessions</th>
                      <th style={{ padding: '8px 10px' }}>Patrol Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.dailyBreakdown.map((row, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          backgroundColor:
                            idx % 2 === 0 ? '#ffffff' : '#fcfcfd',
                        }}
                      >
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                          {row.date}
                        </td>
                        {/* <td style={{ padding: '8px 10px', color: '#475569' }}>
                          {row.shiftName ||
                            selectedShiftObj?.name ||
                            'All Shifts'}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#475569' }}>
                          {row.siteName || selectedSiteObj?.name || 'All Sites'}
                        </td> */}
                        <td style={{ padding: '8px 10px' }}>
                          {row.patrolSessionsCount}
                        </td>
                        <td
                          style={{
                            padding: '8px 10px',
                            fontWeight: 600,
                            color: '#1e40af',
                          }}
                        >
                          {row.patrolDurationFormatted}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          {/* Executive Metrics Overview Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '14px',
            }}
          >
            {/* Card 1: Mandatory Patrols Completed */}
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#64748b',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                Mandatory Patrols Completed
              </div>
              <div
                style={{
                  fontSize: '1.65rem',
                  fontWeight: 800,
                  color: '#16a34a',
                  marginTop: '4px',
                }}
              >
                {reportData.summary.mandatoryCompleted ??
                  reportData.summary.mandatoryPatrolsCompleted ??
                  0}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#475569',
                  marginTop: '4px',
                }}
              >
                {reportData.summary.mandatoryCompleted ?? 0} /{' '}
                {reportData.summary.mandatoryScheduled ?? 0} Scheduled Completed
              </div>
            </div>

            {/* Card 2: Mandatory Patrols Missed */}
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#64748b',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                Mandatory Patrols Missed
              </div>
              <div
                style={{
                  fontSize: '1.65rem',
                  fontWeight: 800,
                  color:
                    (reportData.summary.mandatoryMissed ?? 0) > 0
                      ? '#dc2626'
                      : '#1e293b',
                  marginTop: '4px',
                }}
              >
                {reportData.summary.mandatoryMissed ?? 0}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#475569',
                  marginTop: '4px',
                }}
              >
                {(reportData.summary.mandatoryMissed ?? 0) === 0
                  ? 'Zero missed scheduled patrols'
                  : `${reportData.summary.mandatoryMissed} Missed Scheduled Patrols`}
              </div>
            </div>

            {/* Card 3: Total Patrol Sessions */}
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#64748b',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                Total Patrol Sessions
              </div>
              <div
                style={{
                  fontSize: '1.65rem',
                  fontWeight: 800,
                  color: '#1e293b',
                  marginTop: '4px',
                }}
              >
                {reportData.summary.assignedPatrols}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#475569',
                  marginTop: '4px',
                }}
              >
                {reportData.summary.completedPatrols} Completed • +
                {reportData.summary.additionalPatrols} Extra
              </div>
            </div>

            {/* Card 4: Total Checkpoints */}
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#64748b',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                Total Checkpoints
              </div>
              <div
                style={{
                  fontSize: '1.65rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  marginTop: '4px',
                }}
              >
                {reportData.summary.totalCheckpoints ??
                  reportData.summary.requiredCheckpoints ??
                  0}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#475569',
                  marginTop: '4px',
                }}
              >
                Required Checkpoint Scans
              </div>
            </div>

            {/* Card 5: Checkpoints Scanned */}
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#64748b',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                Checkpoints Scanned
              </div>
              <div
                style={{
                  fontSize: '1.65rem',
                  fontWeight: 800,
                  color: '#16a34a',
                  marginTop: '4px',
                }}
              >
                {reportData.summary.checkpointsScanned ??
                  reportData.summary.completedCheckpoints ??
                  0}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#475569',
                  marginTop: '4px',
                }}
              >
                {reportData.summary.checkpointCompletionPct ?? 0}% Compliance
                Rate
              </div>
            </div>

            {/* Card 6: Checkpoints Missed */}
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#64748b',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                Checkpoints Missed
              </div>
              <div
                style={{
                  fontSize: '1.65rem',
                  fontWeight: 800,
                  color:
                    (reportData.summary.checkpointsMissed ??
                      reportData.summary.missedCheckpoints ??
                      0) > 0
                      ? '#dc2626'
                      : '#1e293b',
                  marginTop: '4px',
                }}
              >
                {reportData.summary.checkpointsMissed ??
                  reportData.summary.missedCheckpoints ??
                  0}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#475569',
                  marginTop: '4px',
                }}
              >
                {(reportData.summary.checkpointsMissed ??
                  reportData.summary.missedCheckpoints ??
                  0) === 0
                  ? 'Zero missed checkpoint scans'
                  : 'Missed scheduled checkpoints'}
              </div>
            </div>
          </div>

          {/* Section Navigation Tabs */}
          <div
            style={{
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
            }}
          >
            {[
              {
                id: 'summary',
                label: `Site Summary (${reportData.siteSummary?.length || 0})`,
              },
              {
                id: 'mandatory',
                label: `Mandatory Patrols (${reportData.mandatoryPatrols?.length || 0})`,
              },
              ...(isEmployeeScoped
                ? [
                    {
                      id: 'patrols',
                      label: `Patrol Activity (${reportData.patrols?.length || 0})`,
                    },
                  ]
                : []),
              // {
              //   id: 'attendance',
              //   label: `Attendance (${reportData.attendance?.length || 0})`,
              // },
              // ...(!(
              //   (reportData.metadata?.isKaizen ||
              //     reportData.metadata?.includeIncidents === false ||
              //     reportData.metadata?.clientName
              //       ?.toLowerCase()
              //       .includes('kaizen')) &&
              //   reportData.incidents
              // )
              //   ? [
              //       {
              //         id: 'incidents',
              //         label: `Incidents (${reportData.incidents?.length || 0})`,
              //       },
              //     ]
              //   : []),
              {
                id: 'employeeSummary',
                label: `Employee Performance (${reportData.employeeSummary?.length || 0})`,
              },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as any)}
                style={{
                  padding: '10px 16px',
                  fontSize: '0.85rem',
                  fontWeight: activeTab === t.id ? 700 : 500,
                  color: activeTab === t.id ? '#2563eb' : '#64748b',
                  borderBottom:
                    activeTab === t.id
                      ? '2px solid #2563eb'
                      : '2px solid transparent',
                  background: 'none',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab Content Display */}
          <div style={{ overflowX: 'auto' }}>
            {activeTab === 'summary' && (
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.85rem',
                }}
              >
                <thead>
                  <tr
                    style={{
                      backgroundColor: '#f8fafc',
                      borderBottom: '2px solid #cbd5e1',
                      textAlign: 'left',
                    }}
                  >
                    <th style={{ padding: '10px 12px' }}>Site</th>
                    <th style={{ padding: '10px 12px' }}>Staff Count</th>
                    <th style={{ padding: '10px 12px' }}>Shifts</th>
                    <th style={{ padding: '10px 12px' }}>Completed Patrols</th>
                    <th style={{ padding: '10px 12px' }}>
                      Mandatory Compliance
                    </th>
                    <th style={{ padding: '10px 12px' }}>
                      Checkpoints Scanned
                    </th>
                    {!(
                      reportData.metadata?.isKaizen ||
                      reportData.metadata?.includeIncidents === false ||
                      reportData.metadata?.clientName
                        ?.toLowerCase()
                        .includes('kaizen')
                    ) && <th style={{ padding: '10px 12px' }}>Incidents</th>}
                  </tr>
                </thead>
                <tbody>
                  {reportData.siteSummary?.map((site, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                        {site.siteName}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {site.activeEmployees || site.employeesCount || 0}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {site.totalShifts || 0}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {site.completedPatrols}
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
                          fontWeight: 700,
                          color:
                            site.mandatoryCompliancePct >= 90
                              ? '#16a34a'
                              : '#d97706',
                        }}
                      >
                        {site.mandatoryCompliancePct}% (
                        {site.mandatoryCompleted}/{site.mandatoryScheduled})
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {site.completedCheckpoints} / {site.requiredCheckpoints}
                      </td>
                      {!(
                        reportData.metadata?.isKaizen ||
                        reportData.metadata?.includeIncidents === false ||
                        reportData.metadata?.clientName
                          ?.toLowerCase()
                          .includes('kaizen')
                      ) && (
                        <td
                          style={{
                            padding: '10px 12px',
                            fontWeight: 600,
                            color:
                              site.incidentsCount > 0 ? '#dc2626' : '#64748b',
                          }}
                        >
                          {site.incidentsCount || site.incidents || 0}
                        </td>
                      )}
                    </tr>
                  ))}
                  {(!reportData.siteSummary ||
                    reportData.siteSummary.length === 0) && (
                    <tr>
                      <td
                        colSpan={
                          reportData.metadata?.isKaizen ||
                          reportData.metadata?.includeIncidents === false ||
                          reportData.metadata?.clientName
                            ?.toLowerCase()
                            .includes('kaizen')
                            ? 6
                            : 7
                        }
                        style={{
                          padding: '24px',
                          textAlign: 'center',
                          color: '#64748b',
                        }}
                      >
                        No site summary data for the selected filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'mandatory' && (
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.85rem',
                }}
              >
                <thead>
                  <tr
                    style={{
                      backgroundColor: '#f8fafc',
                      borderBottom: '2px solid #cbd5e1',
                      textAlign: 'left',
                    }}
                  >
                    <th style={{ padding: '10px 12px' }}>Sequence</th>
                    <th style={{ padding: '10px 12px' }}>Employee</th>
                    <th style={{ padding: '10px 12px' }}>Emirates ID</th>
                    <th style={{ padding: '10px 12px' }}>Role</th>
                    <th style={{ padding: '10px 12px' }}>Site</th>
                    <th style={{ padding: '10px 12px' }}>Shift</th>
                    <th style={{ padding: '10px 12px' }}>Scheduled Time</th>
                    <th style={{ padding: '10px 12px' }}>Mandatory Window</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                    <th style={{ padding: '10px 12px' }}>Completed At</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.mandatoryPatrols?.map((mp, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                        Patrol {mp.sequence}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                        <div>{mp.guardName || mp.employeeName}</div>
                        {mp.employeeNumber && (
                          <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                            {mp.employeeNumber}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', fontFamily: 'monospace', color: '#475569' }}>
                        {mp.emiratesId || 'Not provided'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {mp.employeeRole || 'Security Guard'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>{mp.siteName}</td>
                      <td style={{ padding: '10px 12px' }}>{mp.shiftName}</td>
                      <td style={{ padding: '10px 12px' }}>{mp.scheduledAt}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {mp.windowStart} - {mp.windowEnd}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor:
                              mp.status === 'COMPLETED' ? '#dcfce7' : '#fee2e2',
                            color:
                              mp.status === 'COMPLETED' ? '#15803d' : '#b91c1c',
                          }}
                        >
                          {mp.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {mp.completedAt || '—'}
                      </td>
                    </tr>
                  ))}
                  {(!reportData.mandatoryPatrols ||
                    reportData.mandatoryPatrols.length === 0) && (
                    <tr>
                      <td
                        colSpan={10}
                        style={{
                          padding: '24px',
                          textAlign: 'center',
                          color: '#64748b',
                        }}
                      >
                        No mandatory patrols recorded for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {isEmployeeScoped && activeTab === 'patrols' && (
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.85rem',
                }}
              >
                <thead>
                  <tr
                    style={{
                      backgroundColor: '#f8fafc',
                      borderBottom: '2px solid #cbd5e1',
                      textAlign: 'left',
                    }}
                  >
                    <th style={{ padding: '10px 12px' }}>Patrol Code</th>
                    <th style={{ padding: '10px 12px' }}>Employee</th>
                    <th style={{ padding: '10px 12px' }}>Emirates ID</th>
                    <th style={{ padding: '10px 12px' }}>Role</th>
                    <th style={{ padding: '10px 12px' }}>Site / Route</th>
                    <th style={{ padding: '10px 12px' }}>Started At</th>
                    <th style={{ padding: '10px 12px' }}>Completed At</th>
                    <th style={{ padding: '10px 12px' }}>Checkpoints</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.patrols?.map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td
                        style={{
                          padding: '10px 12px',
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          color: '#2563eb',
                        }}
                      >
                        {p.patrolCode}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                        {p.employeeName || p.guardName}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', fontFamily: 'monospace', color: '#475569' }}>
                        {p.emiratesId || reportData.metadata?.emiratesId || 'Not provided'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {p.employeeRole || 'Security Guard'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {p.siteName} - {p.routeName}
                      </td>
                      <td style={{ padding: '10px 12px' }}>{p.startedAt}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {p.completedAt || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                        {p.checkpointsDisplay ||
                          `${p.checkpointsCompleted ?? p.checkpointsScanned ?? 0} / ${
                            p.checkpointsRequired ?? p.totalCheckpoints ?? 0
                          }`}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor:
                              p.status === 'COMPLETED' ? '#dcfce7' : '#fef3c7',
                            color:
                              p.status === 'COMPLETED' ? '#15803d' : '#b45309',
                          }}
                        >
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!reportData.patrols || reportData.patrols.length === 0) && (
                    <tr>
                      <td
                        colSpan={9}
                        style={{
                          padding: '24px',
                          textAlign: 'center',
                          color: '#64748b',
                        }}
                      >
                        No patrol sessions recorded for this employee.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'attendance' && (
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.85rem',
                }}
              >
                <thead>
                  <tr
                    style={{
                      backgroundColor: '#f8fafc',
                      borderBottom: '2px solid #cbd5e1',
                      textAlign: 'left',
                    }}
                  >
                    <th style={{ padding: '10px 12px' }}>Date</th>
                    <th style={{ padding: '10px 12px' }}>Employee</th>
                    <th style={{ padding: '10px 12px' }}>Emirates ID</th>
                    <th style={{ padding: '10px 12px' }}>Role</th>
                    <th style={{ padding: '10px 12px' }}>Site</th>
                    <th style={{ padding: '10px 12px' }}>Shift</th>
                    <th style={{ padding: '10px 12px' }}>Check-In</th>
                    <th style={{ padding: '10px 12px' }}>Check-Out</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.attendance?.map((att, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 12px' }}>{att.shiftDate}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                        <div>{att.employeeName}</div>
                        {att.employeeNumber ? (
                          <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                            {att.employeeNumber}
                          </div>
                        ) : null}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', fontFamily: 'monospace', color: '#475569' }}>
                        {att.emiratesId || 'Not provided'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {att.employeeRole || 'Security Guard'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>{att.siteName}</td>
                      <td style={{ padding: '10px 12px' }}>{att.shiftName}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {att.checkInTime || '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {att.checkOutTime || '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor:
                              att.status === 'PRESENT' ||
                              att.status === 'COMPLETED'
                                ? '#dcfce7'
                                : att.status === 'LATE'
                                  ? '#fef3c7'
                                  : att.status === 'OFF'
                                    ? '#f1f5f9'
                                    : '#fee2e2',
                            color:
                              att.status === 'PRESENT' ||
                              att.status === 'COMPLETED'
                                ? '#15803d'
                                : att.status === 'LATE'
                                  ? '#b45309'
                                  : att.status === 'OFF'
                                    ? '#475569'
                                    : '#b91c1c',
                          }}
                        >
                          {att.status} {att.isLate ? '(Late)' : ''}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!reportData.attendance ||
                    reportData.attendance.length === 0) && (
                    <tr>
                      <td
                        colSpan={9}
                        style={{
                          padding: '24px',
                          textAlign: 'center',
                          color: '#64748b',
                        }}
                      >
                        No attendance logs recorded for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {!(
              reportData.metadata?.isKaizen ||
              reportData.metadata?.includeIncidents === false ||
              reportData.metadata?.clientName?.toLowerCase().includes('kaizen')
            ) &&
              activeTab === 'incidents' && (
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.85rem',
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        backgroundColor: '#f8fafc',
                        borderBottom: '2px solid #cbd5e1',
                        textAlign: 'left',
                      }}
                    >
                      <th style={{ padding: '10px 12px' }}>Reported At</th>
                      <th style={{ padding: '10px 12px' }}>Incident ID</th>
                      <th style={{ padding: '10px 12px' }}>Site</th>
                      <th style={{ padding: '10px 12px' }}>Employee</th>
                      <th style={{ padding: '10px 12px' }}>Type / Severity</th>
                      <th style={{ padding: '10px 12px' }}>Description</th>
                      <th style={{ padding: '10px 12px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.incidents?.map((inc, idx) => (
                      <tr
                        key={idx}
                        style={{ borderBottom: '1px solid #e2e8f0' }}
                      >
                        <td style={{ padding: '10px 12px' }}>
                          {inc.reportedAt || inc.timestamp}
                        </td>
                        <td
                          style={{
                            padding: '10px 12px',
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            color: '#dc2626',
                          }}
                        >
                          {inc.id || inc.incidentId}
                        </td>
                        <td style={{ padding: '10px 12px' }}>{inc.siteName}</td>
                        <td style={{ padding: '10px 12px' }}>
                          {inc.guardName || inc.reportedBy}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {inc.type || inc.category} ({inc.severity})
                        </td>
                        <td
                          style={{
                            padding: '10px 12px',
                            maxWidth: '300px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {inc.description}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              backgroundColor: '#fef3c7',
                              color: '#b45309',
                            }}
                          >
                            {inc.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(!reportData.incidents ||
                      reportData.incidents.length === 0) && (
                      <tr>
                        <td
                          colSpan={7}
                          style={{
                            padding: '24px',
                            textAlign: 'center',
                            color: '#64748b',
                          }}
                        >
                          No incidents reported during this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

            {activeTab === 'employeeSummary' && (
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.85rem',
                }}
              >
                <thead>
                  <tr
                    style={{
                      backgroundColor: '#f8fafc',
                      borderBottom: '2px solid #cbd5e1',
                      textAlign: 'left',
                    }}
                  >
                    <th style={{ padding: '10px 12px' }}>Employee</th>
                    <th style={{ padding: '10px 12px' }}>Emirates ID</th>
                    <th style={{ padding: '10px 12px' }}>Role</th>
                    <th style={{ padding: '10px 12px' }}>Site</th>
                    <th style={{ padding: '10px 12px' }}>Completed Patrols</th>
                    <th style={{ padding: '10px 12px' }}>Patrol Duration</th>
                    <th style={{ padding: '10px 12px' }}>Mandatory Patrols</th>
                    <th style={{ padding: '10px 12px' }}>Mandatory %</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.employeeSummary?.map((emp, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{emp.employeeName}</div>
                        {emp.employeeNumber && (
                          <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                            ID: {emp.employeeNumber}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', fontFamily: 'monospace', color: '#475569' }}>
                        {emp.emiratesId || 'Not provided'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {emp.employeeRole || 'Security Guard'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>{emp.siteName}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {emp.completedPatrols > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleCompletedPatrolsClick(emp)}
                            title={`View ${emp.completedPatrols} completed patrols for ${emp.employeeName}`}
                            aria-label={`View ${emp.completedPatrols} completed patrols for ${emp.employeeName}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              backgroundColor: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              fontWeight: 700,
                              fontSize: '13px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              outline: 'none',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#dbeafe';
                              e.currentTarget.style.borderColor = '#93c5fd';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#eff6ff';
                              e.currentTarget.style.borderColor = '#bfdbfe';
                            }}
                          >
                            <span>{emp.completedPatrols}</span>
                            <ExternalLink size={12} style={{ opacity: 0.7 }} />
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-muted, #94a3b8)', padding: '3px 8px' }}>
                            0
                          </span>
                        )}
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
                          fontWeight: 600,
                          color: '#1e40af',
                        }}
                      >
                        {emp.patrolDurationFormatted || '0 sec'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {emp.mandatoryCompleted} / {emp.mandatoryScheduled}
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
                          fontWeight: 700,
                          color:
                            emp.mandatoryCompliancePct >= 90
                              ? '#16a34a'
                              : '#d97706',
                        }}
                      >
                        {emp.mandatoryCompliancePct}%
                      </td>
                    </tr>
                  ))}
                  {(!reportData.employeeSummary ||
                    reportData.employeeSummary.length === 0) && (
                    <tr>
                      <td
                        colSpan={8}
                        style={{
                          padding: '24px',
                          textAlign: 'center',
                          color: '#64748b',
                        }}
                      >
                        No employee summary records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
