import { Router } from 'express';

import { UserRole } from '@prisma/client';

import { authenticate } from '../../common/auth/auth.middleware';
import { authorize } from '../../common/auth/authorize';

import { clientController } from './client.controller';

const router: Router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize(UserRole.SUPER_ADMIN),
  clientController.create.bind(clientController),
);

router.get(
  '/',
  authorize(UserRole.SUPER_ADMIN),
  clientController.list.bind(clientController),
);

router.get(
  '/:id',
  authorize(UserRole.SUPER_ADMIN),
  clientController.get.bind(clientController),
);

router.patch(
  '/:id',
  authorize(UserRole.SUPER_ADMIN),
  clientController.update.bind(clientController),
);

export default router;
