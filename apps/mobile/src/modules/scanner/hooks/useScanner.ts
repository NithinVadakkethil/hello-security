import { useMutation } from '@tanstack/react-query';
import { scannerApi } from '../api/scanner.api';
import { useOfflineStore } from '../../../app/store/offline-store';
import { usePatrolStore } from '../../patrol/store/patrol-store';

export function useScanGate() {
  const isConnected = useOfflineStore((state) => state.isConnected);
  const scanGateLocally = usePatrolStore((state) => state.scanGate);

  return useMutation<any, Error, { gateId: string; remarks?: string; latitude?: number; longitude?: number }>({
    mutationFn: async ({ gateId, remarks, latitude, longitude }) => {
      if (!isConnected) {
        await useOfflineStore.getState().enqueue('/patrol-checkpoints/scan', 'POST', {
          gateId,
          remarks,
          latitude,
          longitude,
        });
        return { success: true, offline: true };
      }
      return scannerApi.scanCheckpoint(gateId, remarks, latitude, longitude);
    },
    onSuccess: async (_, variables) => {
      await scanGateLocally(variables.gateId);
    },
  });
}
