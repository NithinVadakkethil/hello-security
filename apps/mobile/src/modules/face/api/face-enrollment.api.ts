import { apiClient } from '../../../app/api/api-client';
import { ApiResponse } from '../../../app/types/api';

export interface FaceEnrollmentStatusData {
  status: 'REGISTERED' | 'NOT_REGISTERED' | 'RE_ENROLL_REQUIRED' | 'REVOKED';
  registeredAt: string | null;
  modelName?: string;
  modelVersion?: string;
  embeddingDimension?: number;
}

export interface FaceEnrollmentTemplateData {
  status: 'REGISTERED' | 'REVOKED';
  template: number[];
  modelName: string;
  modelVersion: string;
  embeddingDimension: number;
  registeredAt: string;
}

export const faceEnrollmentApi = {
  getStatus: async (): Promise<FaceEnrollmentStatusData> => {
    const response = await apiClient.get<ApiResponse<FaceEnrollmentStatusData>>('/me/face-enrollment');
    return (response as any).data;
  },

  register: async (
    template: number[],
    modelName = 'MobileFaceNet',
    modelVersion = 'v1',
    embeddingDimension = 512,
  ): Promise<FaceEnrollmentStatusData> => {
    const response = await apiClient.post<ApiResponse<FaceEnrollmentStatusData>>('/me/face-enrollment', {
      template,
      modelName,
      modelVersion,
      embeddingDimension,
    });
    return (response as any).data;
  },

  getTemplate: async (): Promise<FaceEnrollmentTemplateData> => {
    const response = await apiClient.get<ApiResponse<FaceEnrollmentTemplateData>>('/me/face-enrollment/template');
    return (response as any).data;
  },

  revoke: async (): Promise<{ status: string; revokedAt: string }> => {
    const response = await apiClient.post<ApiResponse<{ status: string; revokedAt: string }>>('/me/face-enrollment/revoke');
    return (response as any).data;
  },
};
