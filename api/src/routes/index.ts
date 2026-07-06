import { Router } from 'express';

import authRoutes from '../modules/auth/auth.routes';
import healthRoute from './health.route';
import protectedRoute from './protected.route';

const router: Router = Router();

router.use('/health', healthRoute);
router.use('/protected', protectedRoute);
router.use('/auth', authRoutes);

export default router;
