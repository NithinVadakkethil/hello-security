// routes/health.route.ts

import { Router } from 'express';

const router: Router = Router();

router.get('/', (_, res) => {
  res.json({
    success: true,
    message: 'API Healthy',
    timestamp: new Date().toISOString(),
  });
});

export default router;
