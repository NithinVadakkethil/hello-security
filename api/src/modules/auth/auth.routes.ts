import { Router } from 'express';

import { authController } from './auth.controller';

const router: Router = Router();

router.post('/login', (req, res, next) => authController.login(req, res, next));

export default router;
