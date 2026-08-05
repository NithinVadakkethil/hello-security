import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../common/auth/auth.middleware';
import { authorize } from '../../common/auth/authorize';
import { incidentController } from './incident.controller';
import { upload } from '../../common/middleware/upload';

import { OPERATIONAL_ROLES } from '../../common/auth/constants';

const router: Router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize(...OPERATIONAL_ROLES, UserRole.SUPERVISOR),
  upload.array('images', 4),
  incidentController.create.bind(incidentController)
);

router.get(
  '/',
  authorize(UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR, ...OPERATIONAL_ROLES),
  incidentController.list.bind(incidentController)
);

router.get(
  '/:id',
  authorize(UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR, ...OPERATIONAL_ROLES),
  incidentController.getById.bind(incidentController)
);

export default router;
