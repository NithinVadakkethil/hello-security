import { Router } from 'express';

import authRoutes from '../modules/auth/auth.routes';
import clientRoutes from '../modules/client/client.routes';
import employeeRoutes from '../modules/employee/employee.routes';
import gateRoutes from '../modules/gate/gate.routes';
import siteRoutes from '../modules/site/site.routes';

import healthRoute from './health.route';
import protectedRoute from './protected.route';

const router: Router = Router();

router.use('/health', healthRoute);
router.use('/protected', protectedRoute);
router.use('/auth', authRoutes);
router.use('/clients', clientRoutes);
router.use('/employees', employeeRoutes);
router.use('/sites', siteRoutes);
router.use('/gates', gateRoutes);

export default router;
