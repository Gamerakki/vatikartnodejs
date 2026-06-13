import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { companyRepository } from '../company/company.repository';

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
          eventValue: eventValue ?? null,
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
      const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
      if (!companyId) {
        res.status(404).json({ status: false, msg: 'Company not found' });
        return;
      }

      const companyIdBig = BigInt(companyId);

      // Top 5 most viewed products
      const topViewed = await prisma.analyticsEvent.groupBy({
        by: ['productId'],
        where: { companyId: companyIdBig, eventType: 'VIEW', productId: { not: null } },
        _count: { productId: true },
        orderBy: { _count: { productId: 'desc' } },
        take: 5,
      });

      // Top 5 most added to cart products
      const topCarted = await prisma.analyticsEvent.groupBy({
        by: ['productId'],
        where: { companyId: companyIdBig, eventType: 'CART_ADD', productId: { not: null } },
        _count: { productId: true },
        orderBy: { _count: { productId: 'desc' } },
        take: 5,
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
