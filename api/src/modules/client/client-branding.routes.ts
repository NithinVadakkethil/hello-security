import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { authenticate } from '../../common/auth/auth.middleware';
import { authorize } from '../../common/auth/authorize';
import { upload } from '../../common/middleware/upload';
import { clientBrandingController } from './client-branding.controller';

const router: Router = Router();

router.get(
  '/client/settings/branding',
  authenticate,
  clientBrandingController.getBranding.bind(clientBrandingController),
);

router.post(
  '/client/settings/branding/logo',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN),
  upload.single('logo'),
  clientBrandingController.uploadLogo.bind(clientBrandingController),
);

router.post(
  '/client/settings/branding/dashboard-image',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN),
  upload.single('dashboardImage'),
  clientBrandingController.uploadDashboardImage.bind(clientBrandingController),
);

router.patch(
  '/client/settings/branding/focal-position',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN),
  clientBrandingController.updateFocalPosition.bind(clientBrandingController),
);

router.delete(
  '/client/settings/branding/logo',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN),
  clientBrandingController.removeLogo.bind(clientBrandingController),
);

router.delete(
  '/client/settings/branding/dashboard-image',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN),
  clientBrandingController.removeDashboardImage.bind(clientBrandingController),
);

export default router;
