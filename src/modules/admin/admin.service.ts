import { adminRepository } from './admin.repository';
import { DashboardStatsRes, CompanyRegistryItemRes, RenewSubscriptionReq } from './admin.interface';
import { prisma } from '../../config/database';

export class AdminService {
  async getDashboardStats(): Promise<DashboardStatsRes> {
    return await adminRepository.getDashboardStats();
  }

  async getCompanyRegistry(): Promise<CompanyRegistryItemRes[]> {
    return await adminRepository.getCompanyRegistry();
  }

  async getAnalytics(): Promise<any> {
    return await adminRepository.getMerchantPerformanceAnalytics();
  }

  async getStoreInsights(companyId: string): Promise<any> {
    return await adminRepository.getStoreInsights(companyId);
  }

  async renewSubscription(req: RenewSubscriptionReq) {
    const companyIdBig = BigInt(req.company_id);
    const company = await prisma.company.findUnique({
      where: { companyId: companyIdBig },
    });

    if (!company) {
      throw new Error('Company not found');
    }

    return await adminRepository.renewSubscription(
      req.company_id,
      req.plan_name,
      req.duration_months,
      req.price_paid,
      req.action
    );
  }

  getCompanyB2BData(companyId: string) {
    return adminRepository.getCompanyB2BData(companyId);
  }

  saveCompanyCustomerGroup(companyId: string, payload: { id?: number; name: string; description?: string | null }) {
    return adminRepository.saveCompanyCustomerGroup(companyId, payload);
  }

  deleteCompanyCustomerGroup(companyId: string, groupId: number) {
    return adminRepository.deleteCompanyCustomerGroup(companyId, groupId);
  }

  saveCompanyGroupPrices(companyId: string, groupId: number, items: Array<{ product_id: number; custom_price: number }>) {
    return adminRepository.saveCompanyGroupPrices(companyId, groupId, items);
  }

  saveCatalogGroupAccess(companyId: string, catalogueId: number, groupIds: number[]) {
    return adminRepository.saveCatalogGroupAccess(companyId, catalogueId, groupIds);
  }

  getCompanyCustomDomain(companyId: string) {
    return adminRepository.getCompanyCustomDomain(companyId);
  }

  saveCompanyCustomDomain(companyId: string, customDomain: string | null) {
    return adminRepository.saveCompanyCustomDomain(companyId, customDomain);
  }

  getCompanyWhatsAppTemplate(companyId: string) {
    return adminRepository.getCompanyWhatsAppTemplate(companyId);
  }

  saveCompanyWhatsAppTemplate(companyId: string, productShareText: string) {
    return adminRepository.saveCompanyWhatsAppTemplate(companyId, productShareText);
  }

  getAdvancedPlatformAnalytics() {
    return adminRepository.getAdvancedPlatformAnalytics();
  }

  getOfflineSyncDiagnostics() {
    return adminRepository.getOfflineSyncDiagnostics();
  }

  getExecutiveGrowthMetrics() {
    return adminRepository.getExecutiveGrowthMetrics();
  }

  getConversionFunnelMetrics() {
    return adminRepository.getConversionFunnelMetrics();
  }

  getSystemHealthAndStorage() {
    return adminRepository.getSystemHealthAndStorage();
  }

  updateMerchantStatusAndPlan(
    companyId: string,
    payload: {
      status?: string;
      plan_name?: string;
      additional_products?: number;
      extend_months?: number;
      end_date?: string | null;
    },
  ) {
    return adminRepository.updateMerchantStatusAndPlan(companyId, payload);
  }

  createSystemBroadcastBanner(message: string, targetRole: string, expiryDate?: string | null) {
    return adminRepository.createSystemBroadcastBanner(message, targetRole, expiryDate);
  }

  listSystemBroadcasts() {
    return adminRepository.listSystemBroadcasts();
  }

  inspectMerchantStore(companyId: string) {
    return adminRepository.inspectMerchantStore(companyId);
  }

  resetOwnerPassword(companyId: string) {
    return adminRepository.resetOwnerPassword(companyId);
  }

  searchGlobalProducts(query: string, companyId?: string | null, limit?: number) {
    return adminRepository.searchGlobalProducts(query, companyId, limit);
  }

  updateGlobalProductStockOrPrice(productId: string, payload: { price?: number; stock?: number; is_deleted?: boolean }) {
    return adminRepository.updateGlobalProductStockOrPrice(productId, payload);
  }

  searchGlobalOrders(query: string, limit?: number) {
    return adminRepository.searchGlobalOrders(query, limit);
  }

  updateGlobalOrderStatus(orderId: string, status: string) {
    return adminRepository.updateGlobalOrderStatus(orderId, status);
  }

  searchCustomerGovernance(phone: string) {
    return adminRepository.searchCustomerGovernance(phone);
  }

  toggleCustomerBlacklist(phone: string, reason: string | null, isBlacklisted: boolean) {
    return adminRepository.toggleCustomerBlacklist(phone, reason, isBlacklisted);
  }

  listApiAccessConfigs() {
    return adminRepository.listApiAccessConfigs();
  }

  updateApiAccessConfig(
    companyId: string,
    payload: { quota?: string; rate_limit_per_minute?: number | null; is_revoked?: boolean },
  ) {
    return adminRepository.updateApiAccessConfig(companyId, payload);
  }

  getChurnRiskPredictor() {
    return adminRepository.getChurnRiskPredictor();
  }

  listPlatformCoupons() {
    return adminRepository.listPlatformCoupons();
  }

  createPlatformCoupon(payload: {
    code: string;
    discount_type: string;
    discount_value: number;
    max_redemptions?: number;
    expiry_date?: string | null;
  }) {
    return adminRepository.createPlatformCoupon(payload);
  }

  deactivatePlatformCoupon(couponId: string) {
    return adminRepository.deactivatePlatformCoupon(couponId);
  }

  getAuditLogs(query?: string, limit?: number) {
    return adminRepository.getAuditLogs(query, limit);
  }

  getBillingInvoices() {
    return adminRepository.getBillingInvoices();
  }

  getCampaignTargets(audience: string) {
    return adminRepository.getCampaignTargets(audience);
  }

  getAiBotConfigs() {
    return adminRepository.getAiBotConfigs();
  }

  overrideAiBotConfig(payload: {
    company_id: string;
    bot_name?: string;
    system_prompt?: string;
    is_enabled?: boolean;
    auto_reply?: boolean;
  }) {
    return adminRepository.overrideAiBotConfig(payload);
  }

  getCatalogSyndications() {
    return adminRepository.getCatalogSyndications();
  }

  updateSyndicationMargin(syndicationId: string, marginMarkupPct: number) {
    return adminRepository.updateSyndicationMargin(syndicationId, marginMarkupPct);
  }

  getFinancialLedgerMetrics() {
    return adminRepository.getFinancialLedgerMetrics();
  }

  releasePayoutSettlement(ledgerId: string) {
    return adminRepository.releasePayoutSettlement(ledgerId);
  }

  sendExpoPushBroadcast(payload: {
    title: string;
    message: string;
    target_screen?: string;
    target_plan?: string;
    test_company_id?: string;
  }) {
    return adminRepository.sendExpoPushBroadcast(payload);
  }

  getRfmSegmentation() {
    return adminRepository.getRfmSegmentation();
  }

  listDeletionRequests() {
    return adminRepository.listDeletionRequests();
  }

  createDeletionRequest(payload: { phone: string; reason?: string }) {
    return adminRepository.createDeletionRequest(payload);
  }

  processDeletionRequest(requestId: string, action: 'COMPLETE' | 'REJECT' = 'COMPLETE') {
    return adminRepository.processDeletionRequest(requestId, action);
  }

  triggerDatabaseBackup() {
    return adminRepository.triggerDatabaseBackup();
  }
}

export const adminService = new AdminService();
