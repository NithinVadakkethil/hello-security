import { Router } from 'express';
import { authenticate } from '../../common/auth/auth.middleware';
import { attendanceController } from './attendance.controller';

const router: Router = Router();

// Export endpoints (place before /:id)
router.get('/export/pdf', authenticate, attendanceController.exportPdf.bind(attendanceController));
router.get('/export/excel', authenticate, attendanceController.exportExcel.bind(attendanceController));
router.get('/export', authenticate, attendanceController.export.bind(attendanceController));

// Check-in / Check-out actions
router.post('/check-in', authenticate, attendanceController.checkIn.bind(attendanceController));
router.post('/check-out', authenticate, attendanceController.checkOut.bind(attendanceController));

// List and single record query
router.get('/', authenticate, attendanceController.list.bind(attendanceController));
router.get('/:id', authenticate, attendanceController.getById.bind(attendanceController));

export default router;
