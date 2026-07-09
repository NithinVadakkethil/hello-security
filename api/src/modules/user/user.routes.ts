import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../common/auth/auth.middleware';
import { authorize } from '../../common/auth/authorize';
import { userController } from './user.controller';

const router: Router = Router();

router.use(authenticate);
router.use(authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN));

router.get('/', (req, res, next) => userController.list(req, res, next));
router.post('/', (req, res, next) => userController.create(req, res, next));
router.get('/:id', (req, res, next) => userController.get(req, res, next));
router.patch('/:id', (req, res, next) => userController.update(req, res, next));
router.patch('/:id/activate', (req, res, next) => userController.activate(req, res, next));
router.patch('/:id/deactivate', (req, res, next) => userController.deactivate(req, res, next));
router.post('/:id/reset-password', (req, res, next) => userController.resetPassword(req, res, next));

export default router;
