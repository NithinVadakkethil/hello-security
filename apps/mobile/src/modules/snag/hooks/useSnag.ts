import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../app/api/api-client';
import { useOfflineStore } from '../../../app/store/offline-store';

export interface CreateSnagInput {
  siteId: string;
  gateId?: string;
  patrolSessionId?: string;
  category: string;
  subCategory?: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  images?: string[];
  latitude?: number;
  longitude?: number;
}

export function useCreateSnag() {
  const queryClient = useQueryClient();
  const isOnline = useOfflineStore(state => state.isConnected);
  const enqueueMutation = useOfflineStore(state => state.enqueueMutation);

  return useMutation({
    mutationFn: async (input: CreateSnagInput) => {
      if (!isOnline) {
        enqueueMutation({
          url: '/snags',
          method: 'POST',
          payload: input,
          mutationType: 'CREATE_SNAG',
        });
        return {
          id: `offline-snag-${Date.now()}`,
          ...input,
          status: 'OPEN',
          createdAt: new Date().toISOString(),
        };
      }

      const res = await apiClient.post<{ success: boolean; data: any }>('/snags', input);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snags'] });
      queryClient.invalidateQueries({ queryKey: ['patrol-session'] });
    },
  });
}
