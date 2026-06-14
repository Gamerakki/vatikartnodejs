import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { companyRepository } from '../company/company.repository';

type DashboardRange = 'today' | 'week' | 'month' | 'all';

function getRangeStart(range: DashboardRange): Date | null {
  const now = new Date();

  if (range === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  if (range === 'week') {
    const date = new Date(now);
    date.setDate(now.getDate() - 6);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  if (range === 'month') {
    const date = new Date(now);
    date.setDate(now.getDate() - 29);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  return null;
}

export class AnalyticsController {
  async logEvent(req: Request, res: Response): Promise<void> {
    try {
      const { companyId, productId, eventType, eventValue } = req.body as {
        companyId?: number | string;
        productId?: number | string | null;
        eventType?: string;
        eventValue?: string | null;
      };

      const validTypes = ['VIEW', 'CART_ADD', 'VIEW_DURATION'];
      if (!companyId || !eventType || !validTypes.includes(eventType)) {
        res.status(400).json({ status: false, msg: 'Invalid parameters' });
        return;
      }

      await prisma.analyticsEvent.create({
        data: {
          companyId: BigInt(companyId),
          productId: productId ? BigInt(productId) : null,
          eventType,
          eventValue: eventValue == null ? null : String(eventValue),
        },
      });

      res.status(200).json({ status: true, msg: 'Logged' });
    } catch (err) {
      res.status(500).json({ status: false, msg: 'An error occurred', error: (err as Error).message });
    }
  }

  async getDashboard(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;
    try {
      const requestedRange = String(req.query.range || 'all').toLowerCase();
      const range: DashboardRange = ['today', 'week', 'month', 'all'].includes(requestedRange)
        ? (requestedRange as DashboardRange)
        : 'all';
      const sinceDate = getRangeStart(range);

      const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
      if (!companyId) {
        res.status(404).json({ status: false, msg: 'Company not found' });
        return;
      }

      const companyIdBig = BigInt(companyId);
      const baseEventWhere = {
        companyId: companyIdBig,
        ...(sinceDate ? { addedDate: { gte: sinceDate } } : {}),
      };

      // Top 5 most viewed products
      const topViewed = await prisma.analyticsEvent.groupBy({
        by: ['productId'],
        where: {
          ...baseEventWhere,
          eventType: 'VIEW',
          productId: { not: null },
        },
        _count: { productId: true },
        orderBy: { _count: { productId: 'desc' } },
        take: 5,
      });

      // Top 5 most added to cart products
      const topCarted = await prisma.analyticsEvent.groupBy({
        by: ['productId'],
        where: {
          ...baseEventWhere,
          eventType: 'CART_ADD',
          productId: { not: null },
        },
        _count: { productId: true },
        orderBy: { _count: { productId: 'desc' } },
        take: 5,
      });

      const orderAgg = await prisma.order.aggregate({
        where: {
          companyId: companyIdBig,
          ...(sinceDate ? { addedDate: { gte: sinceDate } } : {}),
        },
        _count: { orderId: true },
        _sum: { total: true },
      });

      // Enrich with product names
      const allIds = [
        ...topViewed.map((r) => r.productId!),
        ...topCarted.map((r) => r.productId!),
      ].filter((id, idx, arr) => arr.indexOf(id) === idx);

      const products = await prisma.product.findMany({
        where: { productId: { in: allIds } },
        select: { productId: true, product: true },
      });
      const productNameMap = new Map(products.map((p) => [p.productId.toString(), p.product]));

      const format = (rows: typeof topViewed) =>
        rows.map((r) => ({
          productId: r.productId?.toString(),
          productName: productNameMap.get(r.productId!.toString()) ?? 'Unknown',
          count: r._count.productId,
        }));

      res.status(200).json({
        status: true,
        data: {
          range,
          orders: {
            totalOrders: orderAgg._count.orderId,
            totalRevenue: Number(orderAgg._sum.total || 0),
          },
          topViewed: format(topViewed),
          topCarted: format(topCarted),
        },
      });
    } catch (err) {
      res.status(500).json({ status: false, msg: 'An error occurred', error: (err as Error).message });
    }
  }
}

export const analyticsController = new AnalyticsController();
