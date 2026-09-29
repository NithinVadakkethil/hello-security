import { Router } from 'express';
import { authenticate } from '../../common/auth/auth.middleware';
import { faceEnrollmentController } from './face-enrollment.controller';

const router: Router = Router();

router.get('/me/face-enrollment', authenticate, faceEnrollmentController.getStatus.bind(faceEnrollmentController));
router.post('/me/face-enrollment', authenticate, faceEnrollmentController.registerFace.bind(faceEnrollmentController));
router.get('/me/face-enrollment/template', authenticate, faceEnrollmentController.getTemplate.bind(faceEnrollmentController));
router.post('/me/face-enrollment/revoke', authenticate, faceEnrollmentController.revokeFace.bind(faceEnrollmentController));

export default router;
