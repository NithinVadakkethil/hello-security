import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard.api';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: dashboardApi.getCounts,
    refetchInterval: 10000,
  });
}

export function useCurrentPatrolSession() {
  return useQuery({
    queryKey: ['patrol-session', 'current'],
    queryFn: dashboardApi.getCurrentPatrolSession,
  });
}

export function usePatrolHistory() {
  return useQuery({
    queryKey: ['patrol-session', 'history'],
    queryFn: dashboardApi.getPatrolHistory,
  });
}

export function useSites() {
  return useQuery({
    queryKey: ['sites'],
    queryFn: dashboardApi.getSites,
  });
}

export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: dashboardApi.getEmployees,
  });
}
