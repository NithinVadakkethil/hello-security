import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { authenticate } from '../../common/auth/auth.middleware';
import { authorize } from '../../common/auth/authorize';
import { subTaskMasterController } from './subtask-master.controller';

const router: Router = Router();

// Master Management Routes (Scoped to Authenticated Client)
router.get(
  '/client/subtask-masters',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR),
  subTaskMasterController.listMasters.bind(subTaskMasterController)
);

router.get(
  '/client/subtask-masters/:role',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR),
  subTaskMasterController.getMasterByRole.bind(subTaskMasterController)
);

router.post(
  '/client/subtask-masters',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR),
  subTaskMasterController.saveMaster.bind(subTaskMasterController)
);

router.delete(
  '/client/subtask-masters/:id',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR),
  subTaskMasterController.deleteMaster.bind(subTaskMasterController)
);

// Site Bulk Apply Routes
router.post(
  '/sites/:siteId/apply-subtask-master/preview',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR),
  subTaskMasterController.previewApply.bind(subTaskMasterController)
);

router.post(
  '/sites/:siteId/apply-subtask-master',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR),
  subTaskMasterController.executeApply.bind(subTaskMasterController)
);

export default router;
