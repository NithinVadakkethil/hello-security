import { z } from 'zod';

export const scanCheckpointSchema = z.object({
  gateId: z.string().min(1),

  patrolSessionId: z.string().optional(),

  offlineSessionId: z.string().optional(),

  latitude: z.number().optional(),

  longitude: z.number().optional(),

  remarks: z.string().max(500).optional(),

  status: z.string().optional(),

  images: z.array(z.string()).optional(),

  subTaskResponses: z
    .array(
      z.object({
        gateSubTaskId: z.string().min(1, 'Gate sub task ID is required.'),
        answer: z.enum(['YES', 'NO']),
        remarks: z.string().max(500, 'Remarks cannot exceed 500 characters.').optional(),
        images: z.array(z.string()).optional(),
      }),
    )
    .optional(),
});

export const authorizeScanSchema = z.object({
  gateId: z.string().min(1, 'Gate ID or QR code is required'),
});

export type AuthorizeScanDto = z.infer<typeof authorizeScanSchema>;


