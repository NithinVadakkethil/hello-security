import { z } from 'zod';

export const scanCheckpointSchema = z.object({
  gateId: z.string().min(1),

  patrolSessionId: z.string().optional(),

  offlineSessionId: z.string().optional(),

  latitude: z.number().optional(),

  longitude: z.number().optional(),

  remarks: z.string().max(1000).optional().nullable(),

  status: z.string().optional(),

  images: z.array(z.string()).optional(),

  subTaskResponses: z
    .array(
      z.object({
        gateSubTaskId: z.string().min(1, 'Gate sub task ID is required.'),
        answer: z.enum(['YES', 'NO']),
        remarks: z.string().max(1000, 'Remarks cannot exceed 1000 characters.').optional().nullable(),
        images: z.array(z.string()).optional(),
      }),
    )
    .optional(),
});

export const authorizeScanSchema = z.object({
  gateId: z.string().min(1, 'Gate ID or QR code is required'),
});

export type AuthorizeScanDto = z.infer<typeof authorizeScanSchema>;


