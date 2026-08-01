import { Router } from 'express';
import { analyticsController } from './analytics.controller';
import { validateAuth } from '../../middlewares/auth';

const router = Router();

// Public log endpoint – storefront has no auth token
router.post('/log', analyticsController.logEvent);

// Public landing / marketing event logger (no auth)
router.post('/log-event', analyticsController.logMarketingEvent);

// Dashboard analytics require authentication
router.use(validateAuth);
router.get('/dashboard', analyticsController.getDashboard);
router.get('/active-shoppers', analyticsController.getActiveShoppers);

export const analyticsRouter = router;
