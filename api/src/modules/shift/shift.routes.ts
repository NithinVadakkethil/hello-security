import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../common/auth/auth.middleware';
import { authorize } from '../../common/auth/authorize';
import { shiftController } from './shift.controller';

const router: Router = Router();

router.use(authenticate);
router.use(authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER));

router.post('/', (req, res, next) => shiftController.create(req, res, next));
router.get('/', (req, res, next) => shiftController.list(req, res, next));
router.get('/:id', (req, res, next) => shiftController.get(req, res, next));
router.patch('/:id', (req, res, next) => shiftController.update(req, res, next));
router.patch('/:id/activate', (req, res, next) => shiftController.activate(req, res, next));
router.patch('/:id/deactivate', (req, res, next) => shiftController.deactivate(req, res, next));

export default router;
