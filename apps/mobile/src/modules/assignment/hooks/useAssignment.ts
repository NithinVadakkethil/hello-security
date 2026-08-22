import { useQuery } from '@tanstack/react-query';
import { assignmentApi } from '../api/assignment.api';

export function useActiveAssignment() {
  return useQuery({
    queryKey: ['assignment', 'active'],
    queryFn: assignmentApi.getActiveAssignment,
  });
}

export function useActiveAssignments() {
  return useQuery({
    queryKey: ['assignments', 'active-list'],
    queryFn: assignmentApi.getActiveAssignments,
  });
}
