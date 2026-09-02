import { Router } from 'express';
import { authenticate } from '../../common/auth/auth.middleware';
import { reportController } from './report.controller';

const router: Router = Router();

// Unauthenticated public report PDF download using signed JWT token
router.get('/public/download-pdf', (req, res, next) => reportController.publicDownloadPdf(req, res, next));

// Authenticated web app report endpoints
router.use(authenticate);

router.get('/analytics', (req, res, next) => reportController.getAnalytics(req, res, next));
router.get('/inspections', (req, res, next) => reportController.getInspectionReports(req, res, next));
router.get('/inspections/:id', (req, res, next) => reportController.getSingleInspectionReport(req, res, next));
router.get('/inspections/:id/pdf', (req, res, next) => reportController.getPatrolPdf(req, res, next));
router.get('/export/csv', (req, res, next) => reportController.exportCsv(req, res, next));

export default router;
