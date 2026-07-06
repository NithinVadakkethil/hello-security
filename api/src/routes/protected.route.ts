import { Router } from 'express';

import { authenticate } from '../common/auth/auth.middleware';

const router: Router = Router();

router.get('/me', authenticate, (req, res) => {
  return res.json({
    success: true,
    user: req.user,
  });
});

export default router;
