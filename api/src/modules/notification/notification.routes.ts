import { Router } from 'express';
import { authenticate } from '../../common/auth/auth.middleware';
import { notificationController } from './notification.controller';

const router: Router = Router();

router.use(authenticate);

router.get('/', (req, res, next) => notificationController.list(req, res).catch(next));
router.get('/unread-count', (req, res, next) => notificationController.unreadCount(req, res).catch(next));
router.patch('/:id/read', (req, res, next) => notificationController.markAsRead(req, res).catch(next));
router.post('/read-all', (req, res, next) => notificationController.markAllAsRead(req, res).catch(next));

export default router;
