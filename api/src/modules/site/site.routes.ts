import { UserRole } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '../../common/auth/auth.middleware';
import { authorize } from '../../common/auth/authorize';

import { siteController } from './site.controller';

import multer from 'multer';

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
  },
});

const router: Router = Router();

router.get(
  '/import-template',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  siteController.downloadImportTemplate.bind(siteController),
);

router.post(
  '/',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  siteController.create.bind(siteController),
);

router.get(
  '/',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPERVISOR),
  siteController.list.bind(siteController),
);

router.post(
  '/:id/import-checkpoints/validate',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  memoryUpload.single('file'),
  siteController.validateImportCheckpoints.bind(siteController),
);

router.post(
  '/:id/import-checkpoints/execute',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  memoryUpload.single('file'),
  siteController.executeImportCheckpoints.bind(siteController),
);

router.get(
  '/:id/import-template',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  siteController.downloadImportTemplate.bind(siteController),
);

router.get(
  '/:id',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN, UserRole.SUPERVISOR),
  siteController.get.bind(siteController),
);

router.patch(
  '/:id',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  siteController.update.bind(siteController),
);

router.patch(
  '/:id/activate',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  siteController.activate.bind(siteController),
);

router.patch(
  '/:id/deactivate',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  siteController.deactivate.bind(siteController),
);

export default router;
