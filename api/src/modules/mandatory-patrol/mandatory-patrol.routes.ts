import { Router } from 'express';
import { authenticate } from '../../common/auth/auth.middleware';
import { mandatoryPatrolController } from './mandatory-patrol.controller';

const router: Router = Router();

router.use(authenticate);

router.get('/me', (req, res, next) => mandatoryPatrolController.getEmployeeSchedule(req, res).catch(next));
router.get('/assignment/:assignmentId', (req, res, next) => mandatoryPatrolController.getAssignmentMandatoryPatrols(req, res).catch(next));

export default router;
