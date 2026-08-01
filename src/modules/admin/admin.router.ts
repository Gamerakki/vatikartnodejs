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

// Micro-Management Governance
router.get('/micro/store/:companyId', validateAuth, adminController.inspectMerchantStore);
router.post('/micro/store/:companyId/reset-password', validateAuth, adminController.resetOwnerPassword);
router.get('/micro/products', validateAuth, adminController.searchGlobalProducts);
router.put('/micro/products/:productId', validateAuth, adminController.updateGlobalProduct);
router.get('/micro/orders', validateAuth, adminController.searchGlobalOrders);
router.put('/micro/orders/:orderId/status', validateAuth, adminController.updateGlobalOrderStatus);
router.get('/micro/customers', validateAuth, adminController.searchCustomerGovernance);
router.post('/micro/customers/blacklist', validateAuth, adminController.toggleCustomerBlacklist);
router.get('/micro/api-access', validateAuth, adminController.listApiAccessConfigs);
router.put('/micro/api-access/:companyId', validateAuth, adminController.updateApiAccessConfig);

// Growth Suite 2.0
router.get('/churn-risk', validateAuth, adminController.getChurnRiskPredictor);
router.get('/coupons', validateAuth, adminController.listPlatformCoupons);
router.post('/coupons', validateAuth, adminController.createPlatformCoupon);
router.delete('/coupons/:id', validateAuth, adminController.deactivatePlatformCoupon);
router.get('/audit-logs', validateAuth, adminController.getAuditLogs);
router.get('/billing/invoices', validateAuth, adminController.getBillingInvoices);
router.get('/campaigns/targets', validateAuth, adminController.getCampaignTargets);

// Magical Admin Command Center 3.0
router.get('/ai-bots', validateAuth, adminController.getAiBotConfigs);
router.post('/ai-bots/override', validateAuth, adminController.overrideAiBotConfig);
router.get('/syndications', validateAuth, adminController.getCatalogSyndications);
router.put('/syndications/:id/margin', validateAuth, adminController.updateSyndicationMargin);
router.get('/financial/ledger', validateAuth, adminController.getFinancialLedgerMetrics);
router.post('/financial/ledger/:id/release', validateAuth, adminController.releasePayoutSettlement);
router.post('/push-broadcast', validateAuth, adminController.sendExpoPushBroadcast);
router.get('/rfm-segments', validateAuth, adminController.getRfmSegmentation);
router.get('/privacy/deletion-requests', validateAuth, adminController.listDeletionRequests);
router.post('/privacy/deletion-requests', validateAuth, adminController.createDeletionRequest);
router.post('/privacy/deletion-requests/:id/process', validateAuth, adminController.processDeletionRequest);
router.post('/privacy/backup', validateAuth, adminController.triggerDatabaseBackup);

export const adminRouter = router;
