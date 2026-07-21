import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patrolApi } from '../api/patrol.api';
import { usePatrolStore } from '../store/patrol-store';
import { useOfflineStore } from '../../../app/store/offline-store';
import { useActiveAssignment } from '../../assignment/hooks/useAssignment';
import { PatrolSession } from '../../dashboard/types';

export function usePatrol() {
  const queryClient = useQueryClient();
  const isConnected = useOfflineStore((state) => state.isConnected);
  const { data: assignment } = useActiveAssignment();

  const { startSession, pauseSession, resumeSession, scanGate, completeSession } = usePatrolStore();

  const startMutation = useMutation<PatrolSession, Error, string | undefined>({
    mutationFn: async (assignmentId?: string) => {
      if (!isConnected) {
        const tempSession: PatrolSession = {
          id: 'temp-active-session',
          clientId: assignment?.clientId || 'offline-client',
          assignmentId: assignmentId || assignment?.id || 'offline-assignment',
          patrolCode: `PTS-${Math.floor(Math.random() * 90000) + 10000}`,
          status: 'IN_PROGRESS',
          startedAt: new Date().toISOString(),
          endedAt: null,
          pauseCount: 0,
          totalDuration: null,
          remarks: null,
          assignment: assignment || undefined,
        };
        await useOfflineStore.getState().enqueue('/patrol-sessions/start', 'POST', { assignmentId });
        return tempSession;
      }
      return patrolApi.startPatrol(assignmentId);
    },
    onSuccess: async (data) => {
      await startSession(data);
      queryClient.invalidateQueries({ queryKey: ['patrol-session', 'current'] });
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
      if (!isConnected) {
        await useOfflineStore.getState().enqueue(`/patrol-sessions/${id}/complete`, 'PATCH', { remarks });
        return {} as PatrolSession;
      }
      return patrolApi.completePatrol(id, remarks);
    },
    onSuccess: async () => {
      await completeSession();
      queryClient.invalidateQueries({ queryKey: ['patrol-session', 'current'] });
      queryClient.invalidateQueries({ queryKey: ['patrol-session', 'history'] });
    },
  });

  const scanMutation = useMutation<any, Error, { gateId: string; remarks?: string; status?: string; images?: string[]; latitude?: number; longitude?: number }>({
    mutationFn: async ({ gateId, remarks, status, images, latitude, longitude }) => {
      if (!isConnected) {
        await useOfflineStore.getState().enqueue('/patrol-checkpoints/scan', 'POST', {
          gateId,
          remarks,
          status,
          images,
          latitude,
          longitude,
        });
        return { success: true };
      }
      return patrolApi.scanCheckpoint(gateId, remarks, status, images, latitude, longitude);
    },
    onSuccess: async (_, variables) => {
      await scanGate(variables.gateId);
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
    scanCheckpoint: scanMutation.mutateAsync,
    isScanning: scanMutation.isPending,
  };
}
