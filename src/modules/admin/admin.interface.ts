export interface DashboardStatsRes {
  totalUsers: number;
  totalCompanies: number;
  totalCatalogues: number;
  totalProducts: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  totalRevenue: number;
}

export interface CompanyRegistryItemRes {
  companyId: string;
  companyName: string;
  ownerName: string;
  ownerEmail: string | null;
  ownerPhone: string | null;
  addedDate: string;
  catalogueCount: number;
  productCount: number;
  subscription: {
    planName: string;
    startDate: string;
    endDate: string | null;
    status: string;
    pricePaid: number;
  } | null;
}

export interface RenewSubscriptionReq {
  company_id: string;
  plan_name: 'FREE' | 'PREMIUM' | 'ENTERPRISE';
  duration_months: number;
  price_paid: number;
}

export interface MerchantPerformanceRes {
  companyId: string;
  companyName: string;
  ownerName: string;
  totalOrders: number;
  totalGmv: number;
  averageOrderValue: number;
}
