import { Router } from 'express';

import { authenticate } from '../../common/auth/auth.middleware';

import { patrolCheckpointController } from './patrol-checkpoint.controller';

const router: Router = Router();

router.use(authenticate);

router.post('/scan', patrolCheckpointController.scan);

router.get('/history/:sessionId', patrolCheckpointController.history);

export default router;
