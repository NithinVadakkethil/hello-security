import { Router } from 'express';

import { authController } from './auth.controller';
import { authenticate } from '../../common/auth/auth.middleware';

const router: Router = Router();

router.post('/login', (req, res, next) => authController.login(req, res, next));
router.post('/logout', authenticate, (req, res, next) => authController.logout(req, res, next));
router.post('/refresh', (req, res, next) => authController.refresh(req, res, next));

router.get('/me', authenticate, (req, res, next) => authController.me(req, res, next));
router.patch('/profile', authenticate, (req, res, next) => authController.updateProfile(req, res, next));
router.patch('/change-password', authenticate, (req, res, next) => authController.changePassword(req, res, next));

export default router;
