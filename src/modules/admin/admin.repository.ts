import { prisma } from '../../config/database';
import { DashboardStatsRes, CompanyRegistryItemRes } from './admin.interface';

export class AdminRepository {
  async getDashboardStats(): Promise<DashboardStatsRes> {
    const totalUsers = await prisma.user.count();
    const totalCompanies = await prisma.company.count();
    const totalCatalogues = await prisma.catalogue.count({
      where: { isDeleted: false },
    });
    const totalProducts = await prisma.product.count({
      where: { isDeleted: false },
    });

    const now = new Date();
    
    // Count active subscriptions: status is 'ACTIVE' and (endDate is null or endDate >= now)
    const activeSubscriptions = await prisma.subscription.count({
      where: {
        status: 'ACTIVE',
        OR: [
          { endDate: null },
          { endDate: { gte: now } },
        ],
      },
    });

    // Count expired subscriptions: status is not 'ACTIVE' or endDate < now
    const expiredSubscriptions = await prisma.subscription.count({
      where: {
        OR: [
          { status: 'EXPIRED' },
          { status: 'CANCELLED' },
          { endDate: { lt: now } },
        ],
      },
    });

    // Sum of all pricePaid across all subscriptions
    const aggregateRevenue = await prisma.subscription.aggregate({
      _sum: {
        pricePaid: true,
      },
    });

    const totalRevenue = Number(aggregateRevenue._sum.pricePaid || 0);

    return {
      totalUsers,
      totalCompanies,
      totalCatalogues,
      totalProducts,
      activeSubscriptions,
      expiredSubscriptions,
      totalRevenue,
    };
  }

  async getCompanyRegistry(): Promise<CompanyRegistryItemRes[]> {
    const companies = await prisma.company.findMany({
      include: {
        addedByUser: true,
        subscription: true,
        _count: {
          select: {
            catalogues: {
              where: { isDeleted: false },
            },
            products: {
              where: { isDeleted: false },
            },
          },
        },
      },
      orderBy: {
        addedDate: 'desc',
      },
    });

    return companies.map((c) => {
      const ownerName = c.addedByUser
        ? `${c.addedByUser.firstName} ${c.addedByUser.lastName || ''}`.trim()
        : 'Unknown';

      return {
        companyId: c.companyId.toString(),
        companyName: c.companyName,
        ownerName,
        ownerEmail: c.addedByUser?.emailId || null,
        ownerPhone: c.addedByUser?.mobileNo || null,
        addedDate: c.addedDate.toISOString(),
        catalogueCount: c._count.catalogues,
        productCount: c._count.products,
        subscription: c.subscription
          ? {
              planName: c.subscription.planName,
              startDate: c.subscription.startDate.toISOString(),
              endDate: c.subscription.endDate ? c.subscription.endDate.toISOString() : null,
              status: c.subscription.status,
              pricePaid: Number(c.subscription.pricePaid),
            }
          : null,
      };
    });
  }

  async renewSubscription(
    companyId: string,
    planName: 'FREE' | 'PREMIUM' | 'ENTERPRISE',
    durationMonths: number,
    pricePaid: number
  ) {
    const now = new Date();
    
    // Check if subscription exists
    const existingSub = await prisma.subscription.findUnique({
      where: { companyId: BigInt(companyId) },
    });

    let newStartDate = now;
    // If there is an active subscription with an end date in the future, extend it
    if (existingSub && existingSub.endDate && existingSub.endDate > now && existingSub.status === 'ACTIVE') {
      newStartDate = existingSub.endDate;
    }

    const newEndDate = new Date(newStartDate);
    newEndDate.setMonth(newEndDate.getMonth() + durationMonths);

    // Upsert the subscription
    return await prisma.subscription.upsert({
      where: { companyId: BigInt(companyId) },
      create: {
        companyId: BigInt(companyId),
        planName,
        startDate: newStartDate,
        endDate: newEndDate,
        status: 'ACTIVE',
        pricePaid: pricePaid,
        updatedDate: now,
      },
      update: {
        planName,
        startDate: newStartDate,
        endDate: newEndDate,
        status: 'ACTIVE',
        pricePaid: pricePaid,
        updatedDate: now,
      },
    });
  }

  async getMerchantPerformanceAnalytics(): Promise<any[]> {
    // Group orders by companyId
    const ordersGrouped = await prisma.order.groupBy({
      by: ['companyId'],
      _sum: {
        total: true,
      },
      _count: {
        orderId: true,
      },
      orderBy: {
        _sum: {
          total: 'desc',
        },
      },
    });

    const companyIds = ordersGrouped.map((og) => og.companyId);

    // Fetch details for these companies
    const companies = await prisma.company.findMany({
      where: {
        companyId: { in: companyIds },
      },
      include: {
        addedByUser: true,
      },
    });

    // Map the grouped data to MerchantPerformanceRes
    return ordersGrouped.map((og) => {
      const comp = companies.find((c) => c.companyId === og.companyId);
      const totalOrders = og._count.orderId;
      const totalGmv = Number(og._sum.total || 0);
      const averageOrderValue = totalOrders > 0 ? totalGmv / totalOrders : 0;
      
      return {
        companyId: og.companyId.toString(),
        companyName: comp?.companyName || 'Unknown',
        ownerName: comp?.addedByUser ? `${comp.addedByUser.firstName} ${comp.addedByUser.lastName || ''}`.trim() : 'Unknown',
        totalOrders,
        totalGmv,
        averageOrderValue: Number(averageOrderValue.toFixed(2)),
      };
    });
  }
}

export const adminRepository = new AdminRepository();
