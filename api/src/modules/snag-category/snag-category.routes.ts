import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../common/auth/auth.middleware';
import { authorize } from '../../common/auth/authorize';
import { snagCategoryController } from './snag-category.controller';

const router: Router = Router();

router.use(authenticate);

router.get(
  '/',
  authorize(UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.SECURITY),
  (req, res, next) => snagCategoryController.list(req, res).catch(next)
);

router.post(
  '/',
  authorize(UserRole.CLIENT_ADMIN, UserRole.MANAGER),
  (req, res, next) => snagCategoryController.createCategory(req, res).catch(next)
);

router.patch(
  '/:id',
  authorize(UserRole.CLIENT_ADMIN, UserRole.MANAGER),
  (req, res, next) => snagCategoryController.updateCategory(req, res).catch(next)
);

router.delete(
  '/:id',
  authorize(UserRole.CLIENT_ADMIN, UserRole.MANAGER),
  (req, res, next) => snagCategoryController.deleteCategory(req, res).catch(next)
);

router.post(
  '/:id/sub-categories',
  authorize(UserRole.CLIENT_ADMIN, UserRole.MANAGER),
  (req, res, next) => snagCategoryController.createSubCategory(req, res).catch(next)
);

router.delete(
  '/sub-categories/:subId',
  authorize(UserRole.CLIENT_ADMIN, UserRole.MANAGER),
  (req, res, next) => snagCategoryController.deleteSubCategory(req, res).catch(next)
);

export default router;
