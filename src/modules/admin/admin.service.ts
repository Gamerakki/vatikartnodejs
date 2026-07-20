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
}

export const adminService = new AdminService();
