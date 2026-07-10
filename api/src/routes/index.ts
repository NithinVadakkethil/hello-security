import { Router } from 'express';

import assignmentRoutes from '../modules/assignment/assignment.routes';
import auditLogRoutes from '../modules/audit-log/audit-log.routes';
import authRoutes from '../modules/auth/auth.routes';
import clientRoutes from '../modules/client/client.routes';
import dashboardRoutes from '../modules/dashboard/dashboard.routes';
import employeeRoutes from '../modules/employee/employee.routes';
import gateRoutes from '../modules/gate/gate.routes';
import patrolCheckpointRoutes from '../modules/patrol-checkpoint/patrol-checkpoint.routes';
import patrolRouteGateRoutes from '../modules/patrol-route-gate/patrol-route-gate.routes';
import patrolRouteRoutes from '../modules/patrol-route/patrol-route.routes';
import patrolSessionRoutes from '../modules/patrol-session/patrol-session.routes';
import shiftRoutes from '../modules/shift/shift.routes';
import siteRoutes from '../modules/site/site.routes';
import userRoutes from '../modules/user/user.routes';

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
router.use('/patrol-routes', patrolRouteRoutes);
router.use('/patrol-route-gates', patrolRouteGateRoutes);
router.use('/patrol-sessions', patrolSessionRoutes);
router.use('/shifts', shiftRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/patrol-checkpoints', patrolCheckpointRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/users', userRoutes);
router.use('/audit-logs', auditLogRoutes);

export default router;
