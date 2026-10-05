import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { authenticate } from '../../common/auth/auth.middleware';
import { authorize } from '../../common/auth/authorize';
import { checkpointCategoryController } from './checkpoint-category.controller';

const router: Router = Router();

// Demo cleanup: Delete All Subtasks (supports both /sub-tasks/all and /subtasks/all)
router.delete(
  '/sub-tasks/all',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER),
  checkpointCategoryController.deleteAllSubTasks.bind(checkpointCategoryController),
);
router.delete(
  '/subtasks/all',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER),
  checkpointCategoryController.deleteAllSubTasks.bind(checkpointCategoryController),
);

// List categories
router.get(
  '/',
  authenticate,
  checkpointCategoryController.list.bind(checkpointCategoryController),
);

// Create category
router.post(
  '/',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR),
  checkpointCategoryController.create.bind(checkpointCategoryController),
);

// Update category
router.patch(
  '/:id',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR),
  checkpointCategoryController.update.bind(checkpointCategoryController),
);

// Delete category
router.delete(
  '/:id',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR),
  checkpointCategoryController.delete.bind(checkpointCategoryController),
);

// --- SubTasks inside Category (supports /:id/sub-tasks and /:id/subtasks) ---

// Create category sub-task
router.post(
  ['/:id/sub-tasks', '/:id/subtasks'],
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR),
  checkpointCategoryController.createSubTask.bind(checkpointCategoryController),
);

// Reorder category sub-tasks
router.patch(
  ['/:id/sub-tasks/reorder', '/:id/subtasks/reorder'],
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR),
  checkpointCategoryController.reorderSubTasks.bind(checkpointCategoryController),
);

// Update category sub-task
router.patch(
  ['/:id/sub-tasks/:subTaskId', '/:id/subtasks/:subTaskId'],
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR),
  checkpointCategoryController.updateSubTask.bind(checkpointCategoryController),
);

// Delete category sub-task
router.delete(
  ['/:id/sub-tasks/:subTaskId', '/:id/subtasks/:subTaskId'],
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR),
  checkpointCategoryController.deleteSubTask.bind(checkpointCategoryController),
);

// Get category by ID (Placed after static routes so :id does not capture sub-tasks)
router.get(
  '/:id',
  authenticate,
  checkpointCategoryController.getById.bind(checkpointCategoryController),
);

export default router;
