import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { authenticate } from '../../common/auth/auth.middleware';
import { authorize } from '../../common/auth/authorize';
import { upload } from '../../common/middleware/upload';
import { clientBrandingController } from './client-branding.controller';

const router: Router = Router();

router.use(authenticate);

router.get(
  '/client/settings/branding',
  clientBrandingController.getBranding.bind(clientBrandingController),
);

router.post(
  '/client/settings/branding/logo',
  authorize(UserRole.CLIENT_ADMIN),
  upload.single('logo'),
  clientBrandingController.uploadLogo.bind(clientBrandingController),
);

router.post(
  '/client/settings/branding/dashboard-image',
  authorize(UserRole.CLIENT_ADMIN),
  upload.single('dashboardImage'),
  clientBrandingController.uploadDashboardImage.bind(clientBrandingController),
);

router.patch(
  '/client/settings/branding/focal-position',
  authorize(UserRole.CLIENT_ADMIN),
  clientBrandingController.updateFocalPosition.bind(clientBrandingController),
);

router.delete(
  '/client/settings/branding/logo',
  authorize(UserRole.CLIENT_ADMIN),
  clientBrandingController.removeLogo.bind(clientBrandingController),
);

router.delete(
  '/client/settings/branding/dashboard-image',
  authorize(UserRole.CLIENT_ADMIN),
  clientBrandingController.removeDashboardImage.bind(clientBrandingController),
);

export default router;
