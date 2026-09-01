import { UserRole } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '../../common/auth/auth.middleware';
import { authorize } from '../../common/auth/authorize';

import { clientNotificationController } from './client-notification.controller';

const router: Router = Router();

router.get(
  '/client/settings/notifications',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN),
  clientNotificationController.getSettings.bind(clientNotificationController),
);

router.put(
  '/client/settings/notifications',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN),
  clientNotificationController.updateSettings.bind(clientNotificationController),
);

export default router;

