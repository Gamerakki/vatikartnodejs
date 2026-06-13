import { Router } from 'express';
import { analyticsController } from './analytics.controller';
import { validateAuth } from '../../middlewares/auth';

const router = Router();

// Public log endpoint – storefront has no auth token
router.post('/log', analyticsController.logEvent);

// Dashboard analytics require authentication
router.use(validateAuth);
router.get('/dashboard', analyticsController.getDashboard);

export const analyticsRouter = router;
