import { UserRole } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '../../common/auth/auth.middleware';
import { authorize } from '../../common/auth/authorize';

import { patrolSessionController } from './patrol-session.controller';

const router: Router = Router();

router.post(
  '/start',
  authenticate,
  authorize(UserRole.SECURITY),
  patrolSessionController.start.bind(patrolSessionController),
);

router.get(
  '/current',
  authenticate,
  authorize(UserRole.SECURITY),
  patrolSessionController.current.bind(patrolSessionController),
);

router.get(
  '/history',
  authenticate,
  authorize(UserRole.SECURITY),
  patrolSessionController.history.bind(patrolSessionController),
);

router.patch(
  '/:id/pause',
  authenticate,
  authorize(UserRole.SECURITY),
  patrolSessionController.pause.bind(patrolSessionController),
);

router.patch(
  '/:id/resume',
  authenticate,
  authorize(UserRole.SECURITY),
  patrolSessionController.resume.bind(patrolSessionController),
);

router.patch(
  '/:id/complete',
  authenticate,
  authorize(UserRole.SECURITY),
  patrolSessionController.complete.bind(patrolSessionController),
);

export default router;
