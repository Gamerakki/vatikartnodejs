import { Router } from 'express';
import { adminController } from './admin.controller';
import { validateAuth } from '../../middlewares/auth';

const router = Router();

// Protect admin routes with authenticated access
router.get('/dashboard-stats', validateAuth, adminController.getDashboardStats);
router.get('/companies', validateAuth, adminController.getCompanyRegistry);
router.get('/analytics', validateAuth, adminController.getAnalytics);
router.post('/renew-subscription', validateAuth, adminController.renewSubscription);

export const adminRouter = router;
