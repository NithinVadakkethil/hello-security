import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { incidentApi, IncidentInput } from '../api/incident.api';
import { useOfflineStore } from '../../../app/store/offline-store';
import { sqliteDb } from '../../../app/database/sqlite-db';

export function useCreateIncident() {
  const queryClient = useQueryClient();
  const isConnected = useOfflineStore((state) => state.isConnected);

  return useMutation<any, Error, IncidentInput>({
    mutationFn: async (data) => {
      if (!isConnected) {
        await useOfflineStore.getState().enqueue('/incidents', 'POST', data);
        return { success: true, offline: true };
      }

      const formData = new FormData();
      formData.append('type', data.type);
      formData.append('severity', data.severity);
      formData.append('description', data.description);
      if (data.patrolSessionId) formData.append('patrolSessionId', data.patrolSessionId);
      if (data.gateId) formData.append('gateId', data.gateId);
      if (data.latitude !== undefined && data.latitude !== null) formData.append('latitude', String(data.latitude));
      if (data.longitude !== undefined && data.longitude !== null) formData.append('longitude', String(data.longitude));

      if (data.images && data.images.length > 0) {
        data.images.forEach((img, index) => {
          formData.append('images', {
            uri: img,
            name: `incident-${Date.now()}-${index}.jpg`,
            type: 'image/jpeg',
          } as any);
        });
      }

      return incidentApi.createIncident(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    },
  });
}

export function useIncidents() {
  const isConnected = useOfflineStore((state) => state.isConnected);

  return useQuery<any[], Error>({
    queryKey: ['incidents'],
    queryFn: async () => {
      if (!isConnected) {
        // Retrieve local incidents if needed or return empty cached list
        return [];
      }
      return incidentApi.getIncidents();
    },
  });
}
