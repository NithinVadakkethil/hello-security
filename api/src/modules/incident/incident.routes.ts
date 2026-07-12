import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../common/auth/auth.middleware';
import { authorize } from '../../common/auth/authorize';
import { incidentController } from './incident.controller';
import { upload } from '../../common/middleware/upload';

const router: Router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize(UserRole.SECURITY, UserRole.SUPERVISOR),
  upload.array('images', 4),
  incidentController.create.bind(incidentController)
);

router.get(
  '/',
  authorize(UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.SECURITY),
  incidentController.list.bind(incidentController)
);

router.get(
  '/:id',
  authorize(UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.SECURITY),
  incidentController.getById.bind(incidentController)
);

export default router;
