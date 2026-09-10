import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../common/auth/auth.middleware';
import { authorize } from '../../common/auth/authorize';
import { managerController } from './manager.controller';

const router = Router();

router.use(authenticate);

// Manager self-service routes
router.get(
  '/clients',
  authorize(UserRole.MANAGER, UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN),
  managerController.getManagerClients.bind(managerController),
);

router.get(
  '/clients/:clientId/sites',
  authorize(UserRole.MANAGER, UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN),
  managerController.getClientSites.bind(managerController),
);

router.get(
  '/clients/:clientId/checkpoints',
  authorize(UserRole.MANAGER, UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN),
  managerController.getClientCheckpoints.bind(managerController),
);

router.get(
  '/clients/:clientId/active-patrols',
  authorize(UserRole.MANAGER, UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN),
  managerController.getActivePatrols.bind(managerController),
);

router.get(
  '/clients/:clientId/completed-patrols',
  authorize(UserRole.MANAGER, UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN),
  managerController.getCompletedPatrols.bind(managerController),
);

router.get(
  '/clients/:clientId/patrols/:id',
  authorize(UserRole.MANAGER, UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN),
  managerController.getPatrolDetail.bind(managerController),
);

// Admin enrollment management routes
router.post(
  '/enroll',
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  managerController.enrollManager.bind(managerController),
);

router.get(
  '/client-list',
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  managerController.listClientManagers.bind(managerController),
);

router.delete(
  '/client-list/:managerUserId',
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  managerController.removeManagerMembership.bind(managerController),
);

// Super Admin Centralized Manager management routes
router.get(
  '/centralized-list',
  authorize(UserRole.SUPER_ADMIN),
  managerController.listCentralizedManagers.bind(managerController),
);

router.post(
  '/centralized-enroll',
  authorize(UserRole.SUPER_ADMIN),
  managerController.enrollCentralizedManager.bind(managerController),
);

router.put(
  '/centralized-memberships/:userId',
  authorize(UserRole.SUPER_ADMIN),
  managerController.updateCentralizedMemberships.bind(managerController),
);

router.patch(
  '/centralized-status/:userId',
  authorize(UserRole.SUPER_ADMIN),
  managerController.setCentralizedManagerStatus.bind(managerController),
);

export default router;
