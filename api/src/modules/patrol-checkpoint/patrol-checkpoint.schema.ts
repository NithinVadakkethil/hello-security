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
      }).superRefine((data, ctx) => {
        if (data.answer === 'NO') {
          if (!data.remarks || !data.remarks.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Remarks are required when the answer is No.',
              path: ['remarks'],
            });
          }
          const imgCount = data.images?.length || 0;
          if (imgCount < 1) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'At least one evidence photo is required when the answer is No.',
              path: ['images'],
            });
          } else if (imgCount > 5) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Maximum 5 evidence photos are allowed per subtask.',
              path: ['images'],
            });
          }
        }
      }),
    )
    .optional(),
});

export const authorizeScanSchema = z.object({
  gateId: z.string().min(1, 'Gate ID or QR code is required'),
});

export type AuthorizeScanDto = z.infer<typeof authorizeScanSchema>;


