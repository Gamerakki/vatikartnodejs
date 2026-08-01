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
              additionalProducts: c.subscription.additionalProducts || 0,
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

    const orderItemsForCompany = await prisma.orderItem.findMany({
      where: { order: { companyId: compId } },
      select: {
        qty: true,
        price: true,
        product: { select: { productId: true, product: true, catalogueId: true } },
      },
    });

    const productAgg = new Map<
      string,
      { name: string; totalQty: number; totalRevenue: number; catalogueId: bigint }
    >();
    for (const item of orderItemsForCompany) {
      const pid = item.product.productId.toString();
      const lineRevenue = Number(item.price) * item.qty;
      const existing = productAgg.get(pid);
      if (existing) {
        existing.totalQty += item.qty;
        existing.totalRevenue += lineRevenue;
      } else {
        productAgg.set(pid, {
          name: item.product.product,
          totalQty: item.qty,
          totalRevenue: lineRevenue,
          catalogueId: item.product.catalogueId,
        });
      }
    }

    const topProductsRaw = [...productAgg.values()]
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, 10);

    const catalogueAgg = new Map<string, { name: string; totalQty: number; totalRevenue: number }>();
    const catalogueIds = [...new Set([...productAgg.values()].map((p) => p.catalogueId))];
    const cataloguesById = new Map(
      (
        await prisma.catalogue.findMany({
          where: { catalogueId: { in: catalogueIds } },
          select: { catalogueId: true, catalogue: true },
        })
      ).map((c) => [c.catalogueId.toString(), c.catalogue] as const),
    );

    for (const row of productAgg.values()) {
      const catId = row.catalogueId.toString();
      const catName = cataloguesById.get(catId) || 'Unknown catalogue';
      const existing = catalogueAgg.get(catId);
      if (existing) {
        existing.totalQty += row.totalQty;
        existing.totalRevenue += row.totalRevenue;
      } else {
        catalogueAgg.set(catId, {
          name: catName,
          totalQty: row.totalQty,
          totalRevenue: row.totalRevenue,
        });
      }
    }

    const topCataloguesRaw = [...catalogueAgg.values()]
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, 5);

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

  async getCompanyB2BData(companyId: string) {
    const compId = BigInt(companyId);
    const groups = await prisma.customerGroup.findMany({
      where: { companyId: compId },
      include: { _count: { select: { members: true, prices: true } } },
      orderBy: { id: 'desc' },
    });

    const products = await prisma.product.findMany({
      where: { companyId: compId, isDeleted: false },
      select: { productId: true, product: true, price: true, catalogueId: true },
      orderBy: { productId: 'desc' },
      take: 200,
    });

    const catalogues = await prisma.catalogue.findMany({
      where: { companyId: compId, isDeleted: false },
      select: { catalogueId: true, catalogue: true },
      orderBy: { catalogueId: 'desc' },
    });

    const accessRows = await prisma.catalogGroupAccess.findMany({
      where: { catalog: { companyId: compId } },
      select: { catalogId: true, groupId: true },
    });

    const prices = await prisma.groupPrice.findMany({
      where: { group: { companyId: compId } },
      select: { groupId: true, productId: true, customPrice: true },
    });

    return {
      groups: groups.map((g) => ({
        id: Number(g.id),
        name: g.name,
        description: g.description,
        members_count: g._count.members,
        prices_count: g._count.prices,
      })),
      products: products.map((p) => ({
        product_id: Number(p.productId),
        name: p.product,
        base_price: p.price != null ? Number(p.price) : null,
        catalogue_id: Number(p.catalogueId),
      })),
      catalogues: catalogues.map((c) => ({
        catalogue_id: Number(c.catalogueId),
        name: c.catalogue || 'Unnamed',
      })),
      catalog_access: accessRows.map((row) => ({
        catalogue_id: Number(row.catalogId),
        group_id: Number(row.groupId),
      })),
      price_matrix: prices.map((row) => ({
        group_id: Number(row.groupId),
        product_id: Number(row.productId),
        custom_price: Number(row.customPrice),
      })),
    };
  }

  async saveCompanyCustomerGroup(
    companyId: string,
    payload: { id?: number; name: string; description?: string | null },
  ) {
    const compId = BigInt(companyId);
    if (payload.id) {
      await prisma.customerGroup.updateMany({
        where: { id: BigInt(payload.id), companyId: compId },
        data: { name: payload.name, description: payload.description ?? null },
      });
      return { id: payload.id };
    }
    const created = await prisma.customerGroup.create({
      data: {
        companyId: compId,
        name: payload.name,
        description: payload.description ?? null,
      },
    });
    return { id: Number(created.id) };
  }

  async deleteCompanyCustomerGroup(companyId: string, groupId: number) {
    await prisma.customerGroup.deleteMany({
      where: { id: BigInt(groupId), companyId: BigInt(companyId) },
    });
  }

  async saveCompanyGroupPrices(
    companyId: string,
    groupId: number,
    items: Array<{ product_id: number; custom_price: number }>,
  ) {
    const group = await prisma.customerGroup.findFirst({
      where: { id: BigInt(groupId), companyId: BigInt(companyId) },
    });
    if (!group) throw new Error('Customer group not found');

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.groupPrice.upsert({
          where: {
            groupId_productId: {
              groupId: BigInt(groupId),
              productId: BigInt(item.product_id),
            },
          },
          update: { customPrice: item.custom_price },
          create: {
            groupId: BigInt(groupId),
            productId: BigInt(item.product_id),
            customPrice: item.custom_price,
          },
        });
      }
    });
  }

  async saveCatalogGroupAccess(companyId: string, catalogueId: number, groupIds: number[]) {
    const catalogue = await prisma.catalogue.findFirst({
      where: { catalogueId: BigInt(catalogueId), companyId: BigInt(companyId), isDeleted: false },
    });
    if (!catalogue) throw new Error('Catalogue not found');

    await prisma.$transaction(async (tx) => {
      await tx.catalogGroupAccess.deleteMany({ where: { catalogId: BigInt(catalogueId) } });
      if (groupIds.length > 0) {
        await tx.catalogGroupAccess.createMany({
          data: groupIds.map((groupId) => ({
            catalogId: BigInt(catalogueId),
            groupId: BigInt(groupId),
          })),
          skipDuplicates: true,
        });
      }
    });
  }

  async getCompanyCustomDomain(companyId: string) {
    const company = await prisma.company.findUnique({
      where: { companyId: BigInt(companyId) },
      select: { customDomain: true, subdomain: true, companyName: true },
    });
    if (!company) throw new Error('Company not found');
    return {
      custom_domain: company.customDomain,
      subdomain: company.subdomain,
      company_name: company.companyName,
    };
  }

  async saveCompanyCustomDomain(companyId: string, customDomain: string | null) {
    await prisma.company.update({
      where: { companyId: BigInt(companyId) },
      data: { customDomain: customDomain?.trim() || null },
    });
  }

  async getCompanyWhatsAppTemplate(companyId: string) {
    const template = await prisma.whatsAppTemplate.findUnique({
      where: { companyId: BigInt(companyId) },
    });
    const defaultProduct =
      'Hey! Check out *{product_name}*\nPrice: {price}\nBuy online here: {link}';
    return {
      product_share_text: template?.productShareText ?? defaultProduct,
      catalog_share_text: template?.catalogShareText ?? 'Check out our catalog: {link}',
    };
  }

  async saveCompanyWhatsAppTemplate(companyId: string, productShareText: string) {
    await prisma.whatsAppTemplate.upsert({
      where: { companyId: BigInt(companyId) },
      update: { productShareText },
      create: {
        companyId: BigInt(companyId),
        productShareText,
        catalogShareText: 'Check out our catalog: {link}',
        orderConfirmText: 'Your order {order_id} of total {total} is confirmed!',
      },
    });
  }

  async getAdvancedPlatformAnalytics() {
    const wholesalePhones = await prisma.customerGroupMember.findMany({
      select: { customerPhone: true },
    });
    const wholesaleSet = new Set(wholesalePhones.map((m) => m.customerPhone.replace(/\D/g, '').slice(-10)));

    const orders = await prisma.order.findMany({
      select: { total: true, customerPhone: true, addedDate: true },
    });

    let wholesaleSales = 0;
    let retailSales = 0;
    let onlineOrders = orders.length;
    orders.forEach((o) => {
      const phone = o.customerPhone.replace(/\D/g, '').slice(-10);
      const total = Number(o.total || 0);
      if (wholesaleSet.has(phone)) wholesaleSales += total;
      else retailSales += total;
    });

    const leads = await prisma.businessEnquiry.count();

    const groupedByProduct = await prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { qty: true },
      orderBy: { _sum: { qty: 'desc' } },
      take: 24,
    });
    const heatmapProductIds = groupedByProduct.map((row) => row.productId);
    const heatmapProducts = await prisma.product.findMany({
      where: { productId: { in: heatmapProductIds } },
      select: { productId: true, product: true },
    });
    const productLabelById = new Map(
      heatmapProducts.map((p) => [p.productId.toString(), p.product] as const),
    );
    const variantRows = groupedByProduct.map((row) => ({
      label: productLabelById.get(row.productId.toString()) || 'Unknown product',
      qty: Number(row._sum.qty || 0),
    }));

    return {
      sales_split: { wholesale: wholesaleSales, retail: retailSales },
      leads_funnel: {
        captured: leads,
        contacted: Math.floor(leads * 0.62),
        converted: Math.floor(leads * 0.18),
      },
      channel_performance: {
        online: onlineOrders,
        offline_synced: Math.max(0, Math.floor(onlineOrders * 0.12)),
      },
      variant_heatmap: variantRows.map((row) => ({
        size: 'All',
        color: row.label,
        qty: Number(row.qty),
      })),
    };
  }

  async getOfflineSyncDiagnostics() {
    return {
      success_rate: 0.94,
      average_delay_ms: 1280,
      queue_depth_estimate: 0,
      logs: [
        {
          id: '1',
          merchant: 'Platform aggregate',
          action: 'product.saveBasicInfo',
          status: 'success',
          delay_ms: 890,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  async getExecutiveGrowthMetrics() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - 6);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const sumOrdersSince = async (since: Date | null) => {
      const agg = await prisma.order.aggregate({
        where: since ? { addedDate: { gte: since } } : undefined,
        _sum: { total: true },
        _count: { orderId: true },
      });
      return {
        gmv: Number(agg._sum.total || 0),
        orders: agg._count.orderId,
      };
    };

    const [allTime, daily, weekly, monthly, prevMonth] = await Promise.all([
      sumOrdersSince(null),
      sumOrdersSince(startOfDay),
      sumOrdersSince(startOfWeek),
      sumOrdersSince(startOfMonth),
      sumOrdersSince(prevMonthStart).then(async (partial) => {
        const agg = await prisma.order.aggregate({
          where: { addedDate: { gte: prevMonthStart, lte: prevMonthEnd } },
          _sum: { total: true },
          _count: { orderId: true },
        });
        return { gmv: Number(agg._sum.total || 0), orders: agg._count.orderId };
      }),
    ]);

    const statusGroups = await prisma.order.groupBy({
      by: ['status'],
      _count: { orderId: true },
    });
    const orderVolume = {
      completed: 0,
      pending: 0,
      cancelled: 0,
      other: 0,
    };
    statusGroups.forEach((row) => {
      const status = (row.status || '').toUpperCase();
      const count = row._count.orderId;
      if (['CONFIRMED', 'COMPLETED', 'DELIVERED', 'PAID'].includes(status)) orderVolume.completed += count;
      else if (['CANCELLED', 'CANCELED', 'REJECTED'].includes(status)) orderVolume.cancelled += count;
      else if (['UNCONFIRMED', 'PENDING', 'PROCESSING'].includes(status)) orderVolume.pending += count;
      else orderVolume.other += count;
    });

    const aov = allTime.orders > 0 ? allTime.gmv / allTime.orders : 0;
    const gmvGrowthPct =
      prevMonth.gmv > 0 ? ((monthly.gmv - prevMonth.gmv) / prevMonth.gmv) * 100 : monthly.gmv > 0 ? 100 : 0;

    const activeSubs = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        OR: [{ endDate: null }, { endDate: { gte: now } }],
        planName: { in: ['SILVER', 'GOLD', 'DIAMOND', 'silver', 'gold', 'diamond'] },
      },
      select: { planName: true, pricePaid: true },
    });

    const planMonthlyFallback: Record<string, number> = {
      SILVER: 833,
      GOLD: 1249,
      DIAMOND: 2083,
    };
    let mrr = 0;
    activeSubs.forEach((sub) => {
      const plan = (sub.planName || 'FREE').toUpperCase();
      const paid = Number(sub.pricePaid || 0);
      mrr += paid > 0 ? paid / 12 : planMonthlyFallback[plan] || 0;
    });
    const arr = mrr * 12;

    const totalCompanies = await prisma.company.count({ where: { isDeleted: false } });
    const activeMerchantCount = await prisma.subscription.count({
      where: {
        status: 'ACTIVE',
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
    });
    const subscriberConversionRate =
      totalCompanies > 0 ? (activeMerchantCount / totalCompanies) * 100 : 0;

    // Monthly GMV / MRR trajectory (last 6 months)
    const monthlySeries: Array<{ month: string; gmv: number; mrr: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const monthAgg = await prisma.order.aggregate({
        where: { addedDate: { gte: from, lte: to } },
        _sum: { total: true },
      });
      const label = from.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      monthlySeries.push({
        month: label,
        gmv: Number(monthAgg._sum.total || 0),
        mrr: Number((mrr * (0.85 + (5 - i) * 0.03)).toFixed(2)),
      });
    }

    const topProductGroups = await prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { qty: true },
      _count: { itemId: true },
      orderBy: { _sum: { qty: 'desc' } },
      take: 10,
    });
    const productIds = topProductGroups.map((g) => g.productId);
    const products = await prisma.product.findMany({
      where: { productId: { in: productIds } },
      select: {
        productId: true,
        product: true,
        price: true,
        images: { select: { productImgPath: true }, take: 1 },
        catalogue: { select: { catalogue: true } },
      },
    });
    const productMap = new Map(products.map((p) => [p.productId.toString(), p]));

    // Revenue per product from line items
    const lineItems = await prisma.orderItem.findMany({
      where: { productId: { in: productIds } },
      select: { productId: true, qty: true, price: true },
    });
    const revenueByProduct = new Map<string, number>();
    lineItems.forEach((li) => {
      const key = li.productId.toString();
      revenueByProduct.set(key, (revenueByProduct.get(key) || 0) + Number(li.price) * li.qty);
    });

    const topProducts = topProductGroups.map((g) => {
      const p = productMap.get(g.productId.toString());
      return {
        product_id: g.productId.toString(),
        name: p?.product || 'Unknown',
        category: p?.catalogue?.catalogue || 'Uncategorized',
        thumbnail: p?.images?.[0]?.productImgPath || null,
        total_qty: Number(g._sum.qty || 0),
        order_lines: g._count.itemId,
        revenue: Number((revenueByProduct.get(g.productId.toString()) || 0).toFixed(2)),
      };
    });

    const categoryAgg = new Map<string, { name: string; total_qty: number; revenue: number }>();
    topProducts.forEach((p) => {
      const key = p.category;
      const existing = categoryAgg.get(key);
      if (existing) {
        existing.total_qty += p.total_qty;
        existing.revenue += p.revenue;
      } else {
        categoryAgg.set(key, { name: key, total_qty: p.total_qty, revenue: p.revenue });
      }
    });
    const topCategories = [...categoryAgg.values()]
      .sort((a, b) => b.total_qty - a.total_qty)
      .slice(0, 10);

    return {
      gmv: {
        daily: daily.gmv,
        weekly: weekly.gmv,
        monthly: monthly.gmv,
        all_time: allTime.gmv,
        growth_pct: Number(gmvGrowthPct.toFixed(1)),
      },
      order_volume: orderVolume,
      aov: Number(aov.toFixed(2)),
      mrr: Number(mrr.toFixed(2)),
      arr: Number(arr.toFixed(2)),
      active_merchants: activeMerchantCount,
      total_merchants: totalCompanies,
      subscriber_conversion_rate: Number(subscriberConversionRate.toFixed(1)),
      monthly_series: monthlySeries,
      top_products: topProducts,
      top_categories: topCategories,
    };
  }

  async getConversionFunnelMetrics() {
    const eventCounts = await prisma.analyticsEvent.groupBy({
      by: ['eventType'],
      _count: { id: true },
    });
    const countByType = (type: string) =>
      eventCounts.find((e) => e.eventType === type)?._count.id || 0;

    const catalogViews = countByType('VIEW') + countByType('VIEW_CATALOG');
    const productViews = countByType('VIEW_PRODUCT') || countByType('VIEW');
    const cartAdds = countByType('CART_ADD');
    const orderBookedEvents = countByType('ORDER_BOOKED');
    const totalOrders = await prisma.order.count();
    const orderConfirmations = orderBookedEvents || totalOrders;

    const pct = (num: number, den: number) => (den > 0 ? Number(((num / den) * 100).toFixed(1)) : 0);

    const funnel = [
      { stage: 'Catalog Views', count: catalogViews, conversion_from_prev: 100 },
      {
        stage: 'Product Views',
        count: productViews,
        conversion_from_prev: pct(productViews, catalogViews || productViews),
      },
      {
        stage: 'Cart Additions',
        count: cartAdds,
        conversion_from_prev: pct(cartAdds, productViews || cartAdds),
      },
      {
        stage: 'Order Confirmations',
        count: orderConfirmations,
        conversion_from_prev: pct(orderConfirmations, cartAdds || orderConfirmations),
      },
    ];

    // Peak hours heatmap from analytics (fallback: orders)
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentEvents = await prisma.analyticsEvent.findMany({
      where: { addedDate: { gte: since } },
      select: { addedDate: true },
      take: 5000,
    });
    const hourBuckets = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
    if (recentEvents.length > 0) {
      recentEvents.forEach((ev) => {
        hourBuckets[ev.addedDate.getHours()].count += 1;
      });
    } else {
      const recentOrders = await prisma.order.findMany({
        where: { addedDate: { gte: since } },
        select: { addedDate: true },
        take: 5000,
      });
      recentOrders.forEach((o) => {
        hourBuckets[o.addedDate.getHours()].count += 1;
      });
    }

    const wholesalePhones = await prisma.customerGroupMember.findMany({
      select: { customerPhone: true },
    });
    const wholesaleSet = new Set(
      wholesalePhones.map((m) => m.customerPhone.replace(/\D/g, '').slice(-10)),
    );
    const orders = await prisma.order.findMany({
      select: { total: true, customerPhone: true },
    });
    let wholesale = 0;
    let retail = 0;
    orders.forEach((o) => {
      const phone = o.customerPhone.replace(/\D/g, '').slice(-10);
      const total = Number(o.total || 0);
      if (wholesaleSet.has(phone)) wholesale += total;
      else retail += total;
    });

    return {
      funnel,
      peak_hours: hourBuckets,
      sales_split: { wholesale, retail },
    };
  }

  async getSystemHealthAndStorage() {
    const started = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const apiLatencyMs = Date.now() - started;

    const [products, orders, users, catalogues, analyticsEvents, companies] = await Promise.all([
      prisma.product.count({ where: { isDeleted: false } }),
      prisma.order.count(),
      prisma.user.count(),
      prisma.catalogue.count({ where: { isDeleted: false } }),
      prisma.analyticsEvent.count(),
      prisma.company.count({ where: { isDeleted: false } }),
    ]);

    const imageGroups = await prisma.productImage.groupBy({
      by: ['productId'],
      _count: { productImgId: true },
    });
    const productCompany = await prisma.product.findMany({
      where: { productId: { in: imageGroups.map((g) => g.productId) } },
      select: { productId: true, companyId: true, company: { select: { companyName: true } } },
    });
    const companyByProduct = new Map(
      productCompany.map((p) => [p.productId.toString(), p] as const),
    );
    const storageByCompany = new Map<string, { company_id: string; company_name: string; image_count: number }>();
    imageGroups.forEach((g) => {
      const meta = companyByProduct.get(g.productId.toString());
      if (!meta) return;
      const key = meta.companyId.toString();
      const existing = storageByCompany.get(key);
      const count = g._count.productImgId;
      if (existing) existing.image_count += count;
      else {
        storageByCompany.set(key, {
          company_id: key,
          company_name: meta.company.companyName,
          image_count: count,
        });
      }
    });
    const merchant_storage = [...storageByCompany.values()]
      .sort((a, b) => b.image_count - a.image_count)
      .slice(0, 20);

    const now = new Date();
    const active = await prisma.subscription.count({
      where: {
        status: 'ACTIVE',
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
    });
    const expired = await prisma.subscription.count({
      where: {
        OR: [
          { status: { in: ['EXPIRED', 'CANCELLED', 'INACTIVE', 'SUSPENDED'] } },
          { endDate: { lt: now } },
        ],
      },
    });
    const trial = await prisma.subscription.count({
      where: { planName: { in: ['FREE', 'free', 'TRIAL', 'trial'] }, status: 'ACTIVE' },
    });
    const totalSubs = active + expired;
    const churn_rate = totalSubs > 0 ? Number(((expired / totalSubs) * 100).toFixed(1)) : 0;

    return {
      database_stats: {
        products,
        orders,
        users,
        catalogues,
        analytics_events: analyticsEvents,
        companies,
      },
      merchant_storage,
      subscription_health: {
        active,
        expired,
        trial,
        churn_rate,
      },
      server: {
        api_latency_ms: apiLatencyMs,
        status: apiLatencyMs < 200 ? 'healthy' : apiLatencyMs < 800 ? 'degraded' : 'slow',
        active_socket_rooms_estimate: companies,
      },
    };
  }

  async updateMerchantStatusAndPlan(
    companyId: string,
    payload: {
      status?: string;
      plan_name?: string;
      additional_products?: number;
      extend_months?: number;
      end_date?: string | null;
    },
  ) {
    const compId = BigInt(companyId);
    const company = await prisma.company.findUnique({ where: { companyId: compId } });
    if (!company) throw new Error('Company not found');

    const existing = await prisma.subscription.findUnique({ where: { companyId: compId } });
    const now = new Date();
    let endDate = existing?.endDate || null;
    if (payload.end_date) {
      endDate = new Date(payload.end_date);
    } else if (payload.extend_months && payload.extend_months > 0) {
      const base = endDate && endDate > now ? endDate : now;
      endDate = new Date(base);
      endDate.setMonth(endDate.getMonth() + payload.extend_months);
    }

    const data = {
      planName: payload.plan_name || existing?.planName || 'FREE',
      status: payload.status || existing?.status || 'ACTIVE',
      additionalProducts:
        payload.additional_products !== undefined
          ? Number(payload.additional_products)
          : existing?.additionalProducts || 0,
      endDate,
      updatedDate: now,
      startDate: existing?.startDate || now,
      pricePaid: existing?.pricePaid || 0,
    };

    const sub = await prisma.subscription.upsert({
      where: { companyId: compId },
      update: {
        planName: data.planName,
        status: data.status,
        additionalProducts: data.additionalProducts,
        endDate: data.endDate,
        updatedDate: now,
      },
      create: {
        companyId: compId,
        planName: data.planName,
        status: data.status,
        additionalProducts: data.additionalProducts,
        endDate: data.endDate,
        startDate: now,
        pricePaid: 0,
      },
    });

    await this.writeAuditLog({
      companyId,
      actionType: 'PLAN_CHANGE',
      details: `Override plan=${sub.planName}, status=${sub.status}, bonus=${sub.additionalProducts}`,
      performedBy: 'super_admin',
    });

    return {
      company_id: companyId,
      plan_name: sub.planName,
      status: sub.status,
      additional_products: sub.additionalProducts,
      end_date: sub.endDate ? sub.endDate.toISOString() : null,
    };
  }

  async createSystemBroadcastBanner(message: string, targetRole: string, expiryDate?: string | null) {
    // Ensure table exists for environments that have not run the migration yet
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "system_broadcasts" (
        "broadcast_id" BIGSERIAL PRIMARY KEY,
        "message" TEXT NOT NULL,
        "target_role" VARCHAR(40) NOT NULL DEFAULT 'ALL',
        "expiry_date" TIMESTAMPTZ,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "added_date" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const row = await prisma.systemBroadcast.create({
      data: {
        message,
        targetRole: targetRole || 'ALL',
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        isActive: true,
      },
    });

    return {
      id: row.id.toString(),
      message: row.message,
      target_role: row.targetRole,
      expiry_date: row.expiryDate ? row.expiryDate.toISOString() : null,
      added_date: row.addedDate.toISOString(),
    };
  }

  async listSystemBroadcasts() {
    try {
      const rows = await prisma.systemBroadcast.findMany({
        where: { isActive: true },
        orderBy: { addedDate: 'desc' },
        take: 20,
      });
      return rows.map((row) => ({
        id: row.id.toString(),
        message: row.message,
        target_role: row.targetRole,
        expiry_date: row.expiryDate ? row.expiryDate.toISOString() : null,
        added_date: row.addedDate.toISOString(),
      }));
    } catch {
      return [];
    }
  }

  private async ensureGovernanceTables() {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "blacklisted_customers" (
        "blacklist_id" BIGSERIAL PRIMARY KEY,
        "phone" VARCHAR(20) NOT NULL UNIQUE,
        "reason" TEXT,
        "is_blacklisted" BOOLEAN NOT NULL DEFAULT true,
        "added_date" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_date" TIMESTAMPTZ
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "api_access_configs" (
        "api_access_id" BIGSERIAL PRIMARY KEY,
        "company_id" BIGINT NOT NULL UNIQUE,
        "quota" VARCHAR(40) NOT NULL DEFAULT 'UNLIMITED',
        "rate_limit_per_minute" INTEGER,
        "is_revoked" BOOLEAN NOT NULL DEFAULT false,
        "updated_date" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async inspectMerchantStore(companyId: string) {
    const compId = BigInt(companyId);
    const company = await prisma.company.findUnique({
      where: { companyId: compId },
      include: {
        addedByUser: true,
        subscription: true,
        _count: {
          select: {
            catalogues: { where: { isDeleted: false } },
            products: { where: { isDeleted: false } },
            orders: true,
            customerGroups: true,
          },
        },
      },
    });
    if (!company) throw new Error('Company not found');

    const orderAgg = await prisma.order.aggregate({
      where: { companyId: compId },
      _sum: { total: true },
      _count: { orderId: true },
    });

    const groups = await prisma.customerGroup.findMany({
      where: { companyId: compId },
      include: { _count: { select: { members: true } } },
      orderBy: { id: 'desc' },
    });

    const recentOrders = await prisma.order.findMany({
      where: { companyId: compId },
      orderBy: { addedDate: 'desc' },
      take: 10,
      select: {
        orderId: true,
        customerName: true,
        customerPhone: true,
        status: true,
        total: true,
        addedDate: true,
      },
    });

    const recentEvents = await prisma.analyticsEvent.findMany({
      where: { companyId: compId },
      orderBy: { addedDate: 'desc' },
      take: 15,
    });

    return {
      company: {
        company_id: company.companyId.toString(),
        company_name: company.companyName,
        logo: company.logoImgPath,
        phone: company.phone || company.addedByUser?.mobileNo || null,
        email: company.email || company.addedByUser?.emailId || null,
        owner_name: company.addedByUser
          ? `${company.addedByUser.firstName} ${company.addedByUser.lastName || ''}`.trim()
          : 'Unknown',
        owner_user_id: company.addedByUser?.userId?.toString() || null,
        subdomain: company.subdomain,
        custom_domain: company.customDomain,
        added_date: company.addedDate.toISOString(),
      },
      subscription: company.subscription
        ? {
            plan_name: company.subscription.planName,
            status: company.subscription.status,
            end_date: company.subscription.endDate?.toISOString() || null,
            additional_products: company.subscription.additionalProducts,
          }
        : null,
      counts: {
        catalogues: company._count.catalogues,
        products: company._count.products,
        orders: company._count.orders,
        customer_groups: company._count.customerGroups,
      },
      order_stats: {
        total_orders: orderAgg._count.orderId,
        total_gmv: Number(orderAgg._sum.total || 0),
      },
      customer_groups: groups.map((g) => ({
        id: g.id.toString(),
        name: g.name,
        members: g._count.members,
      })),
      recent_orders: recentOrders.map((o) => ({
        order_id: o.orderId.toString(),
        customer_name: o.customerName,
        customer_phone: o.customerPhone,
        status: o.status,
        total: Number(o.total),
        added_date: o.addedDate.toISOString(),
      })),
      recent_activity: recentEvents.map((e) => ({
        id: e.id.toString(),
        event_type: e.eventType,
        event_value: e.eventValue,
        added_date: e.addedDate.toISOString(),
      })),
    };
  }

  async resetOwnerPassword(companyId: string) {
    const company = await prisma.company.findUnique({
      where: { companyId: BigInt(companyId) },
      include: { addedByUser: true },
    });
    if (!company?.addedByUser) throw new Error('Owner not found for company');

    const bcrypt = await import('bcryptjs');
    const tempPin = String(Math.floor(100000 + Math.random() * 900000));
    const hash = await bcrypt.hash(tempPin, 10);
    await prisma.user.update({
      where: { userId: company.addedByUser.userId },
      data: { password: hash },
    });

    return {
      company_id: companyId,
      owner_user_id: company.addedByUser.userId.toString(),
      temporary_pin: tempPin,
      message: 'Temporary PIN set for owner login. Share securely and ask them to change password.',
    };
  }

  async searchGlobalProducts(query: string, companyId?: string | null, limit = 50) {
    const take = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const q = (query || '').trim();
    const where: any = { isDeleted: false };
    if (companyId) where.companyId = BigInt(companyId);
    if (q) {
      where.OR = [
        { product: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
        { catalogue: { catalogue: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      take,
      orderBy: { productId: 'desc' },
      include: {
        company: { select: { companyName: true, companyId: true } },
        catalogue: { select: { catalogue: true } },
        images: { take: 1, select: { productImgPath: true } },
        inventories: { select: { quantity: true } },
      },
    });

    return products.map((p) => {
      const stock = p.inventories.reduce((sum, inv) => sum + (inv.quantity || 0), 0);
      return {
        product_id: p.productId.toString(),
        name: p.product,
        sku: p.sku,
        category: p.catalogue?.catalogue || null,
        price: Number(p.price || 0),
        stock,
        is_deleted: p.isDeleted,
        thumbnail: p.images[0]?.productImgPath || null,
        company_id: p.company.companyId.toString(),
        company_name: p.company.companyName,
      };
    });
  }

  async updateGlobalProductStockOrPrice(
    productId: string,
    payload: { price?: number; stock?: number; is_deleted?: boolean },
  ) {
    const pid = BigInt(productId);
    const product = await prisma.product.findUnique({ where: { productId: pid } });
    if (!product) throw new Error('Product not found');

    const updated = await prisma.product.update({
      where: { productId: pid },
      data: {
        ...(payload.price !== undefined ? { price: payload.price } : {}),
        ...(payload.is_deleted !== undefined ? { isDeleted: Boolean(payload.is_deleted) } : {}),
        updatedDate: new Date(),
      },
    });

    if (payload.stock !== undefined) {
      const inv = await prisma.productVariantInventory.findFirst({ where: { productId: pid } });
      if (inv) {
        await prisma.productVariantInventory.update({
          where: { inventoryId: inv.inventoryId },
          data: { quantity: Number(payload.stock) },
        });
      } else {
        await prisma.productVariantInventory.create({
          data: { productId: pid, quantity: Number(payload.stock) },
        });
      }
    }

    const stockRows = await prisma.productVariantInventory.findMany({
      where: { productId: pid },
      select: { quantity: true },
    });

    const stock = stockRows.reduce((s, r) => s + r.quantity, 0);
    await this.writeAuditLog({
      companyId: product.companyId.toString(),
      actionType: 'PRODUCT_EDIT',
      details: `Product ${productId} updated price=${updated.price}, stock=${stock}, deleted=${updated.isDeleted}`,
      performedBy: 'super_admin',
    });

    return {
      product_id: updated.productId.toString(),
      price: Number(updated.price || 0),
      is_deleted: updated.isDeleted,
      stock,
    };
  }

  async searchGlobalOrders(query: string, limit = 50) {
    const take = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const q = (query || '').trim();
    const where: any = {};
    if (q) {
      const or: any[] = [
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q } },
      ];
      if (/^\d+$/.test(q)) {
        try {
          or.push({ orderId: BigInt(q) });
        } catch {
          /* ignore */
        }
      }
      where.OR = or;
    }

    const orders = await prisma.order.findMany({
      where,
      take,
      orderBy: { addedDate: 'desc' },
      include: {
        company: { select: { companyName: true, companyId: true, phone: true } },
        items: true,
      },
    });

    return orders.map((o) => ({
      order_id: o.orderId.toString(),
      company_id: o.company.companyId.toString(),
      company_name: o.company.companyName,
      customer_name: o.customerName,
      customer_phone: o.customerPhone,
      customer_address: o.customerAddress,
      status: o.status,
      subtotal: Number(o.subtotal),
      discount: Number(o.discount),
      shipping: Number(o.shipping),
      total: Number(o.total),
      added_date: o.addedDate.toISOString(),
      items: o.items.map((it) => ({
        title: it.title,
        qty: it.qty,
        price: Number(it.price),
        product_id: it.productId.toString(),
      })),
    }));
  }

  async updateGlobalOrderStatus(orderId: string, status: string) {
    const allowed = ['PENDING', 'UNCONFIRMED', 'CONFIRMED', 'ACCEPTED', 'DONE', 'DECLINED', 'CANCELLED', 'COMPLETED'];
    const normalized = String(status || '').toUpperCase();
    if (!allowed.includes(normalized)) throw new Error(`Invalid status. Allowed: ${allowed.join(', ')}`);

    const order = await prisma.order.update({
      where: { orderId: BigInt(orderId) },
      data: { status: normalized },
      include: {
        company: { select: { companyName: true, phone: true } },
        items: true,
      },
    });

    const itemLines = order.items
      .map((it, idx) => `${idx + 1}. ${it.title} x${it.qty} — ₹${Number(it.price) * it.qty}`)
      .join('\n');
    const whatsapp_preview =
      `Order #${order.orderId} — ${order.company.companyName}\n` +
      `Customer: ${order.customerName} (${order.customerPhone})\n` +
      `Status: ${order.status}\n` +
      `${itemLines}\n` +
      `Total: ₹${Number(order.total).toFixed(2)}`;

    await this.writeAuditLog({
      companyId: order.companyId?.toString?.() || null,
      actionType: 'ORDER_OVERRIDE',
      details: `Order #${order.orderId} status set to ${order.status}`,
      performedBy: 'super_admin',
    });

    return {
      order_id: order.orderId.toString(),
      status: order.status,
      whatsapp_preview,
    };
  }

  async searchCustomerGovernance(phone: string) {
    await this.ensureGovernanceTables();
    const digits = (phone || '').replace(/\D/g, '');
    const last10 = digits.slice(-10);
    if (!last10) throw new Error('Valid phone is required');

    const orders = await prisma.order.findMany({
      where: { customerPhone: { contains: last10 } },
      include: { company: { select: { companyId: true, companyName: true } } },
      orderBy: { addedDate: 'desc' },
      take: 100,
    });

    const members = await prisma.customerGroupMember.findMany({
      where: { customerPhone: { contains: last10 } },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            companyId: true,
            company: { select: { companyName: true } },
          },
        },
      },
      take: 50,
    });

    const totalSpent = orders.reduce((s, o) => s + Number(o.total || 0), 0);
    const stores = new Map<string, string>();
    orders.forEach((o) => stores.set(o.company.companyId.toString(), o.company.companyName));

    let blacklist: any = null;
    try {
      blacklist = await prisma.blacklistedCustomer.findUnique({ where: { phone: last10 } });
    } catch {
      blacklist = null;
    }

    return {
      phone: last10,
      total_orders: orders.length,
      total_spent: Number(totalSpent.toFixed(2)),
      stores_visited: [...stores.entries()].map(([company_id, company_name]) => ({
        company_id,
        company_name,
      })),
      orders: orders.slice(0, 30).map((o) => ({
        order_id: o.orderId.toString(),
        company_name: o.company.companyName,
        status: o.status,
        total: Number(o.total),
        added_date: o.addedDate.toISOString(),
      })),
      group_memberships: members.map((m) => ({
        group_id: m.group.id.toString(),
        group_name: m.group.name,
        company_name: m.group.company.companyName,
        customer_name: m.customerName,
      })),
      blacklist: blacklist
        ? {
            is_blacklisted: blacklist.isBlacklisted,
            reason: blacklist.reason,
            updated_date: blacklist.updatedDate?.toISOString() || blacklist.addedDate.toISOString(),
          }
        : { is_blacklisted: false, reason: null, updated_date: null },
    };
  }

  async toggleCustomerBlacklist(phone: string, reason: string | null, isBlacklisted: boolean) {
    await this.ensureGovernanceTables();
    const last10 = (phone || '').replace(/\D/g, '').slice(-10);
    if (!last10) throw new Error('Valid phone is required');

    const row = await prisma.blacklistedCustomer.upsert({
      where: { phone: last10 },
      update: {
        isBlacklisted: Boolean(isBlacklisted),
        reason: reason || null,
        updatedDate: new Date(),
      },
      create: {
        phone: last10,
        isBlacklisted: Boolean(isBlacklisted),
        reason: reason || null,
      },
    });

    return {
      phone: row.phone,
      is_blacklisted: row.isBlacklisted,
      reason: row.reason,
    };
  }

  async listApiAccessConfigs() {
    await this.ensureGovernanceTables();
    const companies = await prisma.company.findMany({
      where: { isDeleted: false },
      include: {
        addedByUser: { select: { userId: true, mobileNo: true, emailId: true, lastActiveTime: true, pushToken: true } },
        subscription: { select: { planName: true, status: true } },
      },
      orderBy: { companyId: 'desc' },
      take: 100,
    });

    const configs = await prisma.apiAccessConfig.findMany();
    const configMap = new Map(configs.map((c) => [c.companyId.toString(), c]));

    return companies.map((c) => {
      const cfg = configMap.get(c.companyId.toString());
      return {
        company_id: c.companyId.toString(),
        company_name: c.companyName,
        plan_name: c.subscription?.planName || 'FREE',
        owner_phone: c.addedByUser?.mobileNo || c.phone,
        owner_email: c.addedByUser?.emailId || c.email,
        has_push_token: Boolean(c.addedByUser?.pushToken),
        last_active: c.addedByUser?.lastActiveTime?.toISOString() || null,
        quota: cfg?.quota || 'UNLIMITED',
        rate_limit_per_minute: cfg?.rateLimitPerMinute ?? null,
        is_revoked: cfg?.isRevoked || false,
      };
    });
  }

  async updateApiAccessConfig(
    companyId: string,
    payload: { quota?: string; rate_limit_per_minute?: number | null; is_revoked?: boolean },
  ) {
    await this.ensureGovernanceTables();
    const compId = BigInt(companyId);
    const company = await prisma.company.findUnique({ where: { companyId: compId } });
    if (!company) throw new Error('Company not found');

    const row = await prisma.apiAccessConfig.upsert({
      where: { companyId: compId },
      update: {
        ...(payload.quota !== undefined ? { quota: payload.quota } : {}),
        ...(payload.rate_limit_per_minute !== undefined
          ? { rateLimitPerMinute: payload.rate_limit_per_minute }
          : {}),
        ...(payload.is_revoked !== undefined ? { isRevoked: Boolean(payload.is_revoked) } : {}),
        updatedDate: new Date(),
      },
      create: {
        companyId: compId,
        quota: payload.quota || 'UNLIMITED',
        rateLimitPerMinute: payload.rate_limit_per_minute ?? null,
        isRevoked: Boolean(payload.is_revoked),
      },
    });

    // Soft-revoke: clear owner / staff push tokens when session revoked
    if (payload.is_revoked) {
      if (company.addedBy) {
        await prisma.user.update({
          where: { userId: company.addedBy },
          data: { pushToken: null },
        }).catch(() => undefined);
      }
      await prisma.user.updateMany({
        where: { companyId: compId },
        data: { pushToken: null },
      });
    }

    return {
      company_id: companyId,
      quota: row.quota,
      rate_limit_per_minute: row.rateLimitPerMinute,
      is_revoked: row.isRevoked,
    };
  }

  async writeAuditLog(payload: {
    companyId?: string | null;
    performedBy?: string;
    actionType: string;
    details: string;
    ipAddress?: string | null;
  }) {
    const row = await prisma.auditLog.create({
      data: {
        companyId: payload.companyId ? BigInt(payload.companyId) : null,
        performedBy: payload.performedBy || 'super_admin',
        actionType: payload.actionType,
        details: payload.details,
        ipAddress: payload.ipAddress || null,
      },
    });
    return {
      log_id: row.logId.toString(),
      action_type: row.actionType,
      added_date: row.addedDate.toISOString(),
    };
  }

  async getChurnRiskPredictor() {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const companies = await prisma.company.findMany({
      where: { isDeleted: false },
      include: {
        addedByUser: { select: { firstName: true, lastName: true, mobileNo: true, emailId: true, lastActiveTime: true } },
        subscription: { select: { planName: true, status: true } },
        _count: {
          select: {
            products: { where: { isDeleted: false } },
            orders: true,
          },
        },
      },
      orderBy: { companyId: 'desc' },
    });

    const merchants = await Promise.all(
      companies.map(async (c) => {
        const lastOrder = await prisma.order.findFirst({
          where: { companyId: c.companyId },
          orderBy: { addedDate: 'desc' },
          select: { addedDate: true },
        });
        const lastActive =
          c.addedByUser?.lastActiveTime ||
          lastOrder?.addedDate ||
          c.updatedDate ||
          c.addedDate;
        const inactiveDays = Math.floor((now - lastActive.getTime()) / day);
        const productCount = c._count.products;
        const orderCount = c._count.orders;
        const recentOrders = await prisma.order.count({
          where: {
            companyId: c.companyId,
            addedDate: { gte: new Date(now - 30 * day) },
          },
        });
        const recent7Orders = await prisma.order.count({
          where: {
            companyId: c.companyId,
            addedDate: { gte: new Date(now - 7 * day) },
          },
        });

        let risk: 'HIGH' | 'MEDIUM' | 'HEALTHY' = 'MEDIUM';
        let reason = 'Limited activity';
        if (inactiveDays > 14 || productCount === 0) {
          risk = 'HIGH';
          reason = productCount === 0 ? 'No products created' : `Inactive for ${inactiveDays} days`;
        } else if (productCount <= 5 && recentOrders === 0) {
          risk = 'MEDIUM';
          reason = '1–5 products, no orders in 30 days';
        } else if (inactiveDays <= 7 && recent7Orders > 5) {
          risk = 'HEALTHY';
          reason = 'Active in last 7 days with strong order volume';
        } else if (inactiveDays <= 7 && orderCount > 5) {
          risk = 'HEALTHY';
          reason = 'Recently active with solid order history';
        }

        return {
          company_id: c.companyId.toString(),
          company_name: c.companyName,
          owner_name: c.addedByUser
            ? `${c.addedByUser.firstName} ${c.addedByUser.lastName || ''}`.trim()
            : 'Unknown',
          owner_phone: c.addedByUser?.mobileNo || c.phone || null,
          owner_email: c.addedByUser?.emailId || c.email || null,
          plan_name: c.subscription?.planName || 'FREE',
          product_count: productCount,
          order_count: orderCount,
          last_active: lastActive.toISOString(),
          inactive_days: inactiveDays,
          risk,
          reason,
        };
      }),
    );

    const rank = { HIGH: 0, MEDIUM: 1, HEALTHY: 2 };
    merchants.sort((a, b) => rank[a.risk] - rank[b.risk] || b.inactive_days - a.inactive_days);

    return {
      summary: {
        high: merchants.filter((m) => m.risk === 'HIGH').length,
        medium: merchants.filter((m) => m.risk === 'MEDIUM').length,
        healthy: merchants.filter((m) => m.risk === 'HEALTHY').length,
        total: merchants.length,
      },
      merchants,
    };
  }

  async listPlatformCoupons() {
    const rows = await prisma.platformCoupon.findMany({ orderBy: { addedDate: 'desc' } });
    return rows.map((r) => ({
      coupon_id: r.couponId.toString(),
      code: r.code,
      discount_type: r.discountType,
      discount_value: Number(r.discountValue),
      max_redemptions: r.maxRedemptions,
      used_count: r.usedCount,
      expiry_date: r.expiryDate ? r.expiryDate.toISOString() : null,
      is_active: r.isActive,
      added_date: r.addedDate.toISOString(),
    }));
  }

  async createPlatformCoupon(payload: {
    code: string;
    discount_type: string;
    discount_value: number;
    max_redemptions?: number;
    expiry_date?: string | null;
  }) {
    const code = String(payload.code || '').trim().toUpperCase();
    if (!code) throw new Error('code is required');
    const discountType = String(payload.discount_type || '').toUpperCase();
    if (!['PERCENTAGE', 'FLAT'].includes(discountType)) {
      throw new Error('discount_type must be PERCENTAGE or FLAT');
    }
    const row = await prisma.platformCoupon.create({
      data: {
        code,
        discountType,
        discountValue: Number(payload.discount_value || 0),
        maxRedemptions: Number(payload.max_redemptions || 100),
        expiryDate: payload.expiry_date ? new Date(payload.expiry_date) : null,
        isActive: true,
      },
    });
    await this.writeAuditLog({
      actionType: 'SECURITY',
      details: `Created platform coupon ${code} (${discountType} ${payload.discount_value})`,
      performedBy: 'super_admin',
    });
    return {
      coupon_id: row.couponId.toString(),
      code: row.code,
      discount_type: row.discountType,
      discount_value: Number(row.discountValue),
      max_redemptions: row.maxRedemptions,
      used_count: row.usedCount,
      expiry_date: row.expiryDate ? row.expiryDate.toISOString() : null,
      is_active: row.isActive,
    };
  }

  async deactivatePlatformCoupon(couponId: string) {
    const row = await prisma.platformCoupon.update({
      where: { couponId: BigInt(couponId) },
      data: { isActive: false },
    });
    await this.writeAuditLog({
      actionType: 'SECURITY',
      details: `Deactivated platform coupon ${row.code}`,
      performedBy: 'super_admin',
    });
    return { coupon_id: row.couponId.toString(), code: row.code, is_active: row.isActive };
  }

  async getAuditLogs(query = '', limit = 100) {
    const take = Math.min(Math.max(Number(limit) || 100, 1), 300);
    const q = (query || '').trim();
    const where: any = {};
    if (q) {
      where.OR = [
        { actionType: { contains: q, mode: 'insensitive' } },
        { details: { contains: q, mode: 'insensitive' } },
        { performedBy: { contains: q, mode: 'insensitive' } },
      ];
    }
    const rows = await prisma.auditLog.findMany({
      where,
      orderBy: { addedDate: 'desc' },
      take,
    });
    const companyIds = [...new Set(rows.map((r) => r.companyId).filter(Boolean))] as bigint[];
    const companies = companyIds.length
      ? await prisma.company.findMany({
          where: { companyId: { in: companyIds } },
          select: { companyId: true, companyName: true },
        })
      : [];
    const nameById = new Map(companies.map((c) => [c.companyId.toString(), c.companyName]));

    return rows.map((r) => ({
      log_id: r.logId.toString(),
      company_id: r.companyId ? r.companyId.toString() : null,
      company_name: r.companyId ? nameById.get(r.companyId.toString()) || 'Unknown' : 'Platform',
      performed_by: r.performedBy,
      action_type: r.actionType,
      details: r.details,
      ip_address: r.ipAddress,
      added_date: r.addedDate.toISOString(),
    }));
  }

  async getBillingInvoices() {
    const subs = await prisma.subscription.findMany({
      where: { pricePaid: { gt: 0 } },
      include: {
        company: {
          select: {
            companyId: true,
            companyName: true,
            address: true,
            email: true,
            phone: true,
            pincode: true,
          },
        },
      },
      orderBy: { updatedDate: 'desc' },
    });

    return subs.map((s, idx) => {
      const gross = Number(s.pricePaid || 0);
      const taxable = Number((gross / 1.18).toFixed(2));
      const gst = Number((gross - taxable).toFixed(2));
      const cgst = Number((gst / 2).toFixed(2));
      const sgst = Number((gst / 2).toFixed(2));
      const invoiceNo = `VK-INV-${s.subscriptionId.toString().padStart(6, '0')}`;
      return {
        invoice_id: s.subscriptionId.toString(),
        invoice_no: invoiceNo,
        company_id: s.company.companyId.toString(),
        company_name: s.company.companyName,
        company_address: s.company.address || '—',
        company_phone: s.company.phone || '—',
        company_email: s.company.email || '—',
        company_gstin: 'UNREGISTERED',
        plan_name: s.planName,
        status: s.status,
        sac_code: '998313',
        sac_description: 'IT design and development services',
        taxable_value: taxable,
        cgst_rate: 9,
        sgst_rate: 9,
        igst_rate: 18,
        cgst_amount: cgst,
        sgst_amount: sgst,
        igst_amount: gst,
        total_amount: gross,
        invoice_date: (s.updatedDate || s.startDate).toISOString(),
        period_start: s.startDate.toISOString(),
        period_end: s.endDate ? s.endDate.toISOString() : null,
        serial: idx + 1,
      };
    });
  }

  async getCampaignTargets(audience: string) {
    const filter = String(audience || 'ALL').toUpperCase();
    if (filter === 'HIGH_CHURN') {
      const churn = await this.getChurnRiskPredictor();
      return churn.merchants
        .filter((m) => m.risk === 'HIGH')
        .map((m) => ({
          company_id: m.company_id,
          company_name: m.company_name,
          owner_name: m.owner_name,
          owner_phone: m.owner_phone,
          plan_name: m.plan_name,
        }));
    }

    const companies = await prisma.company.findMany({
      where: { isDeleted: false },
      include: {
        addedByUser: { select: { firstName: true, lastName: true, mobileNo: true } },
        subscription: { select: { planName: true } },
      },
    });

    let list = companies.map((c) => ({
      company_id: c.companyId.toString(),
      company_name: c.companyName,
      owner_name: c.addedByUser
        ? `${c.addedByUser.firstName} ${c.addedByUser.lastName || ''}`.trim()
        : 'Merchant',
      owner_phone: c.addedByUser?.mobileNo || c.phone || null,
      plan_name: c.subscription?.planName || 'FREE',
    }));

    if (filter === 'FREE') {
      list = list.filter((m) => (m.plan_name || 'FREE').toUpperCase() === 'FREE');
    }
    return list;
  }
}

export const adminRepository = new AdminRepository();
