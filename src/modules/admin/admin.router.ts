import { Router } from 'express';
import { adminController } from './admin.controller';
import { validateAuth } from '../../middlewares/auth';

const router = Router();

// Protect admin routes with authenticated access
router.get('/dashboard-stats', validateAuth, adminController.getDashboardStats);
router.get('/companies', validateAuth, adminController.getCompanyRegistry);
router.get('/analytics', validateAuth, adminController.getAnalytics);
router.get('/store-insights/:companyId', validateAuth, adminController.getStoreInsights);
router.post('/renew-subscription', validateAuth, adminController.renewSubscription);

router.get('/companies/:companyId/b2b', validateAuth, adminController.getCompanyB2BData);
router.post('/companies/:companyId/b2b/groups', validateAuth, adminController.saveCompanyCustomerGroup);
router.delete('/companies/:companyId/b2b/groups/:groupId', validateAuth, adminController.deleteCompanyCustomerGroup);
router.post('/companies/:companyId/b2b/groups/:groupId/prices', validateAuth, adminController.saveCompanyGroupPrices);
router.put('/companies/:companyId/b2b/catalogues/:catalogueId/access', validateAuth, adminController.saveCatalogGroupAccess);

router.get('/companies/:companyId/custom-domain', validateAuth, adminController.getCompanyCustomDomain);
router.put('/companies/:companyId/custom-domain', validateAuth, adminController.saveCompanyCustomDomain);

router.get('/companies/:companyId/whatsapp-template', validateAuth, adminController.getCompanyWhatsAppTemplate);
router.put('/companies/:companyId/whatsapp-template', validateAuth, adminController.saveCompanyWhatsAppTemplate);

router.get('/analytics/advanced', validateAuth, adminController.getAdvancedAnalytics);
router.get('/sync-diagnostics', validateAuth, adminController.getOfflineSyncDiagnostics);

// Executive Growth & Control Suite
router.get('/growth/executive', validateAuth, adminController.getExecutiveGrowthMetrics);
router.get('/growth/conversion', validateAuth, adminController.getConversionFunnelMetrics);
router.get('/system/health', validateAuth, adminController.getSystemHealthAndStorage);
router.post('/company/:companyId/override', validateAuth, adminController.updateMerchantStatusAndPlan);
router.post('/system/broadcast', validateAuth, adminController.createSystemBroadcastBanner);
router.get('/system/broadcasts', validateAuth, adminController.listSystemBroadcasts);

export const adminRouter = router;
