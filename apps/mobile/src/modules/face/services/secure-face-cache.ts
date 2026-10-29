import EncryptedStorage from 'react-native-encrypted-storage';

const SECURE_FACE_KEY = 'hello_orbit_secure_face_template_cache_v1';

export interface SecureFaceCachePayload {
  ownerUserId: string;
  ownerEmployeeId: string;
  ownerClientId: string;
  modelName: string;
  modelVersion: string;
  embeddingDimension: number;
  template: number[];
  registeredAt: string;
}

export const secureFaceCache = {
  saveSecureCache: async (
    userId: string,
    employeeId: string,
    clientId: string,
    data: {
      template: number[];
      modelName?: string;
      modelVersion?: string;
      embeddingDimension?: number;
      registeredAt?: string;
    },
  ): Promise<void> => {
    try {
      const payload: SecureFaceCachePayload = {
        ownerUserId: userId,
        ownerEmployeeId: employeeId,
        ownerClientId: clientId,
        modelName: data.modelName || 'MobileFaceNet',
        modelVersion: data.modelVersion || 'v1',
        embeddingDimension: data.embeddingDimension || data.template.length,
        template: data.template,
        registeredAt: data.registeredAt || new Date().toISOString(),
      };

      await EncryptedStorage.setItem(SECURE_FACE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('[secureFaceCache] Failed to save encrypted local cache:', error);
    }
  },

  getSecureCache: async (
    userId: string,
    employeeId: string,
  ): Promise<SecureFaceCachePayload | null> => {
    try {
      const raw = await EncryptedStorage.getItem(SECURE_FACE_KEY);
      if (!raw) {
        return null;
      }

      const payload: SecureFaceCachePayload = JSON.parse(raw);

      // Verify user scope: ensure template belongs strictly to current user & employee
      if (payload.ownerUserId !== userId || payload.ownerEmployeeId !== employeeId) {
        console.warn('[secureFaceCache] Owner mismatch detected in local cache. Clearing invalid cache.');
        await EncryptedStorage.removeItem(SECURE_FACE_KEY);
        return null;
      }

      return payload;
    } catch (error) {
      console.warn('[secureFaceCache] Failed to read encrypted local cache:', error);
      return null;
    }
  },

  clearSecureCache: async (): Promise<void> => {
    try {
      await EncryptedStorage.removeItem(SECURE_FACE_KEY);
    } catch (error) {
      console.warn('[secureFaceCache] Failed to clear encrypted local cache:', error);
    }
  },
};
