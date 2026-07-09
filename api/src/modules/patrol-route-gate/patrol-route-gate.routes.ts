import { Router } from 'express';

import { authenticate } from '../../common/auth/auth.middleware';

import { patrolRouteGateController } from './patrol-route-gate.controller';

const router: Router = Router();

router.use(authenticate);

router.post('/patrol-routes/:routeId/gates', patrolRouteGateController.create);

router.get('/patrol-routes/:routeId/gates', patrolRouteGateController.list);

router.patch('/patrol-route-gates/:id', patrolRouteGateController.update);

router.delete('/patrol-route-gates/:id', patrolRouteGateController.delete);

export default router;
