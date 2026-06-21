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
}

export const adminService = new AdminService();
