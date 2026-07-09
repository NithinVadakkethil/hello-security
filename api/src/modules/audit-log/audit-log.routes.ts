import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../common/auth/auth.middleware';
import { authorize } from '../../common/auth/authorize';
import { auditLogController } from './audit-log.controller';

const router: Router = Router();

router.use(authenticate);
router.use(authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN));

router.get('/', (req, res, next) => auditLogController.list(req, res, next));

export default router;
