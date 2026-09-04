import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patrolApi } from '../api/patrol.api';
import { usePatrolStore } from '../store/patrol-store';
import { useOfflineStore } from '../../../app/store/offline-store';
import { useActiveAssignments } from '../../assignment/hooks/useAssignment';
import { PatrolSession } from '../../dashboard/types';

export function usePatrol() {
  const queryClient = useQueryClient();
  const isConnected = useOfflineStore((state) => state.isConnected);
  const { data: assignmentsList } = useActiveAssignments();
  const assignments = assignmentsList || [];

  const { startSession, pauseSession, resumeSession, scanGate, completeSession } = usePatrolStore();

  const startMutation = useMutation<
    PatrolSession,
    Error,
    { assignmentId?: string; resolveExistingPatrol?: boolean } | string | undefined
  >({
    mutationFn: async (args) => {
      const assignmentId = typeof args === 'string' ? args : args?.assignmentId;
      const resolveExistingPatrol = typeof args === 'object' ? args?.resolveExistingPatrol : undefined;
      const startedAt = new Date().toISOString();

      if (!isConnected) {
        // Resolve exact target assignment by ID from cached active assignments list
        const targetAssignment = assignmentId
          ? assignments.find((a: any) => a.id === assignmentId)
          : assignments[0];

        if (assignmentId && !targetAssignment) {
          throw new Error(
            'This patrol route is not available offline. Please connect to the internet and refresh your assignments.',
          );
        }

        const tempSession: PatrolSession = {
          id: 'temp-active-session',
          clientId: targetAssignment?.clientId || (targetAssignment as any)?.site?.clientId || 'offline-client',
          assignmentId: targetAssignment?.id || assignmentId || 'offline-assignment',
          patrolCode: `PTS-${Math.floor(Math.random() * 90000) + 10000}`,
          status: 'IN_PROGRESS',
          startedAt,
          endedAt: null,
          pauseCount: 0,
          totalDuration: null,
          remarks: null,
          assignment: targetAssignment || undefined,
        };
        await useOfflineStore.getState().enqueue('/patrol-sessions/start', 'POST', { assignmentId, resolveExistingPatrol, startedAt });
        return tempSession;
      }
      return patrolApi.startPatrol(assignmentId, resolveExistingPatrol, startedAt);
    },
    onSuccess: async (data) => {
      await startSession(data);
      queryClient.invalidateQueries({ queryKey: ['patrol-session'] });
      queryClient.invalidateQueries({ queryKey: ['patrol-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['active-assignments'] });
    },
  });

  const pauseMutation = useMutation<PatrolSession, Error, string>({
    mutationFn: async (id) => {
      if (!isConnected) {
        await useOfflineStore.getState().enqueue(`/patrol-sessions/${id}/pause`, 'PATCH', {});
        return {} as PatrolSession;
      }
      return patrolApi.pausePatrol(id);
    },
    onSuccess: async () => {
      await pauseSession();
      queryClient.invalidateQueries({ queryKey: ['patrol-session', 'current'] });
    },
  });

  const resumeMutation = useMutation<PatrolSession, Error, string>({
    mutationFn: async (id) => {
      if (!isConnected) {
        await useOfflineStore.getState().enqueue(`/patrol-sessions/${id}/resume`, 'PATCH', {});
        return {} as PatrolSession;
      }
      return patrolApi.resumePatrol(id);
    },
    onSuccess: async () => {
      await resumeSession();
      queryClient.invalidateQueries({ queryKey: ['patrol-session', 'current'] });
    },
  });

  const completeMutation = useMutation<PatrolSession, Error, { id: string; remarks?: string }>({
    mutationFn: async ({ id, remarks }) => {
      const endedAt = new Date().toISOString();
      if (!isConnected) {
        await useOfflineStore.getState().enqueue(`/patrol-sessions/${id}/complete`, 'PATCH', { remarks, endedAt });
        return {} as PatrolSession;
      }
      return patrolApi.completePatrol(id, remarks, endedAt);
    },
    onSuccess: async () => {
      await completeSession();
      queryClient.invalidateQueries({ queryKey: ['patrol-session', 'current'] });
      queryClient.invalidateQueries({ queryKey: ['patrol-session', 'history'] });
    },
  });

  const scanMutation = useMutation<any, Error, { gateId: string; remarks?: string; status?: string; images?: string[]; latitude?: number; longitude?: number; subTaskResponses?: Array<{ gateSubTaskId: string; answer: 'YES' | 'NO'; remarks?: string; images?: string[] }> }>({
    mutationFn: async ({ gateId, remarks, status, images, latitude, longitude, subTaskResponses }) => {
      const currentSessionId = usePatrolStore.getState().activeSession?.id;
      const scannedAt = new Date().toISOString();
      const formattedResponses = subTaskResponses?.map((st) => ({
        ...st,
        answeredAt: scannedAt,
      }));

      if (!isConnected) {
        await useOfflineStore.getState().enqueue('/patrol-checkpoints/scan', 'POST', {
          gateId,
          patrolSessionId: currentSessionId,
          remarks,
          status,
          images,
          latitude,
          longitude,
          scannedAt,
          subTaskResponses: formattedResponses,
        });
        return { success: true };
      }
      return patrolApi.scanCheckpoint(gateId, remarks, status, images, latitude, longitude, formattedResponses, currentSessionId, scannedAt);
    },
    onSuccess: async (_, variables) => {
      await scanGate(variables.gateId);
      queryClient.invalidateQueries({ queryKey: ['patrol-session'] });
      queryClient.invalidateQueries({ queryKey: ['patrol-sessions'] });
    },
  });

  const cancelMutation = useMutation<any, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      if (!isConnected) {
        await useOfflineStore.getState().enqueue(`/patrol-sessions/${id}/cancel`, 'POST', {});
        return { success: true };
      }
      return patrolApi.cancelPatrol(id);
    },
    onSuccess: async () => {
      await completeSession();
      queryClient.invalidateQueries({ queryKey: ['patrol-session'] });
      queryClient.invalidateQueries({ queryKey: ['patrol-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['active-assignments'] });
    },
  });

  return {
    startPatrol: startMutation.mutateAsync,
    isStarting: startMutation.isPending,
    pausePatrol: pauseMutation.mutateAsync,
    isPausing: pauseMutation.isPending,
    resumePatrol: resumeMutation.mutateAsync,
    isResuming: resumeMutation.isPending,
    completePatrol: completeMutation.mutateAsync,
    isCompleting: completeMutation.isPending,
    cancelPatrol: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,
    scanCheckpoint: scanMutation.mutateAsync,
    isScanning: scanMutation.isPending,
  };
}
