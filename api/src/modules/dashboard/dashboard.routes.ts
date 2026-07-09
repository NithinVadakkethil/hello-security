import { Router } from 'express';

import { authenticate } from '../../common/auth/auth.middleware';

import { dashboardController } from './dashboard.controller';

const router: Router = Router();

router.use(authenticate);

router.get('/', dashboardController.get);

export default router;
