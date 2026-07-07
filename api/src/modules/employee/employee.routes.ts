import { UserRole } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '../../common/auth/auth.middleware';
import { authorize } from '../../common/auth/authorize';

import { employeeController } from './employee.controller';

const router: Router = Router();

router.post(
  '/',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  employeeController.create.bind(employeeController),
);

router.get(
  '/',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  employeeController.list.bind(employeeController),
);

router.get(
  '/:id',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  employeeController.get.bind(employeeController),
);

router.patch(
  '/:id',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  employeeController.update.bind(employeeController),
);

router.patch(
  '/:id/deactivate',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  employeeController.deactivate.bind(employeeController),
);

router.patch(
  '/:id/activate',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  employeeController.activate.bind(employeeController),
);

router.delete(
  '/:id',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  employeeController.delete.bind(employeeController),
);

export default router;
