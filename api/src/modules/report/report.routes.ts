import { Router } from 'express';
import { authenticate } from '../../common/auth/auth.middleware';
import { reportController } from './report.controller';

const router = Router();

router.use(authenticate);

router.get('/analytics', (req, res, next) => reportController.getAnalytics(req, res, next));
router.get('/inspections', (req, res, next) => reportController.getInspectionReports(req, res, next));
router.get('/export/csv', (req, res, next) => reportController.exportCsv(req, res, next));

export default router;
