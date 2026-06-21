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
          { status: 'INACTIVE' },
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
    planName: 'FREE' | 'SILVER' | 'GOLD' | 'DIAMOND',
    durationMonths: number,
    pricePaid: number,
    action: 'UPGRADE' | 'DOWNGRADE' | 'EXTEND' | 'STOP'
  ) {
    const now = new Date();
    
    // Check if subscription exists
    const existingSub = await prisma.subscription.findUnique({
      where: { companyId: BigInt(companyId) },
    });

    let newStartDate = now;
    let newEndDate = new Date(now);
    let status = 'ACTIVE';

    if (action === 'STOP') {
      status = 'INACTIVE';
      newEndDate = now;
    } else {
      if (action === 'EXTEND' && existingSub?.endDate && existingSub.endDate > now && existingSub.status === 'ACTIVE') {
        newStartDate = existingSub.endDate;
      }

      newEndDate = new Date(newStartDate);
      newEndDate.setMonth(newEndDate.getMonth() + durationMonths);
    }

    // Upsert the subscription
    return await prisma.subscription.upsert({
      where: { companyId: BigInt(companyId) },
      create: {
        companyId: BigInt(companyId),
        planName,
        startDate: newStartDate,
        endDate: newEndDate,
        status,
        pricePaid: pricePaid,
        updatedDate: now,
      },
      update: {
        planName,
        startDate: newStartDate,
        endDate: newEndDate,
        status,
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

  async getStoreInsights(companyId: string) {
    const compId = BigInt(companyId);

    // Basic aggregations
    const ordersAgg = await prisma.order.aggregate({
      where: { companyId: compId },
      _count: { orderId: true },
      _sum: { total: true },
    });

    const totalOrders = ordersAgg._count.orderId;
    const totalGmv = Number(ordersAgg._sum.total || 0);

    // Top Products via queryRaw
    const topProductsRaw: any[] = await prisma.$queryRaw`
      SELECT 
        p.product as "name",
        CAST(SUM(oi.qty) AS INTEGER) as "totalQty",
        SUM(oi.price * oi.qty) as "totalRevenue"
      FROM order_items oi
      JOIN orders o ON o.order_id = oi.order_id
      JOIN products p ON p.product_id = oi.product_id
      WHERE o.company_id = ${compId}
      GROUP BY p.product_id, p.product
      ORDER BY "totalQty" DESC
      LIMIT 10
    `;

    // Top Catalogues via queryRaw
    const topCataloguesRaw: any[] = await prisma.$queryRaw`
      SELECT 
        c.catalogue as "name",
        CAST(SUM(oi.qty) AS INTEGER) as "totalQty",
        SUM(oi.price * oi.qty) as "totalRevenue"
      FROM order_items oi
      JOIN orders o ON o.order_id = oi.order_id
      JOIN products p ON p.product_id = oi.product_id
      JOIN catalogues c ON c.catalogue_id = p.catalogue_id
      WHERE o.company_id = ${compId}
      GROUP BY c.catalogue_id, c.catalogue
      ORDER BY "totalQty" DESC
      LIMIT 5
    `;

    return {
      totalOrders,
      totalGmv,
      topProducts: topProductsRaw.map((row) => ({
        name: row.name,
        totalQty: Number(row.totalQty),
        totalRevenue: Number(row.totalRevenue || 0),
      })),
      topCatalogues: topCataloguesRaw.map((row) => ({
        name: row.name,
        totalQty: Number(row.totalQty),
        totalRevenue: Number(row.totalRevenue || 0),
      })),
    };
  }
}

export const adminRepository = new AdminRepository();
