import { Request, Response } from 'express';
import { adminService } from './admin.service';
import { renewSubscriptionSchema } from './admin.validation';

export class AdminController {
  async getDashboardStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await adminService.getDashboardStats();
      res.status(200).json({
        status: true,
        msg: 'Dashboard stats fetched successfully',
        data: stats,
      });
    } catch (err) {
      res.status(500).json({
        status: false,
        msg: 'Failed to fetch dashboard stats',
        error: (err as Error).message,
      });
    }
  }

  async getCompanyRegistry(req: Request, res: Response): Promise<void> {
    try {
      const companies = await adminService.getCompanyRegistry();
      res.status(200).json({
        status: true,
        msg: 'Company registry fetched successfully',
        data: companies,
      });
    } catch (err) {
      res.status(500).json({
        status: false,
        msg: 'Failed to fetch company registry',
        error: (err as Error).message,
      });
    }
  }

  async getAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const analytics = await adminService.getAnalytics();
      res.status(200).json({
        status: true,
        msg: 'Analytics fetched successfully',
        data: analytics,
      });
    } catch (err) {
      res.status(500).json({
        status: false,
        msg: 'Failed to fetch analytics',
        error: (err as Error).message,
      });
    }
  }

  async getStoreInsights(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.params;
      if (!companyId) {
        res.status(400).json({ status: false, msg: 'companyId is required' });
        return;
      }
      
      const insights = await adminService.getStoreInsights(companyId);
      res.status(200).json({
        status: true,
        msg: 'Store insights fetched successfully',
        data: insights,
      });
    } catch (err) {
      res.status(500).json({
        status: false,
        msg: 'Failed to fetch store insights',
        error: (err as Error).message,
      });
    }
  }

  async renewSubscription(req: Request, res: Response): Promise<void> {
    const parseResult = renewSubscriptionSchema.safeParse(req.body);

    if (!parseResult.success) {
      const formattedErrors: Record<string, string> = {};
      parseResult.error.issues.forEach((issue) => {
        const fieldPath = issue.path.join('.');
        formattedErrors[fieldPath] = issue.message;
      });

      res.status(400).json({
        status: false,
        msg: 'Validation errors',
        error: formattedErrors,
      });
      return;
    }

    try {
      const result = await adminService.renewSubscription(parseResult.data);
      res.status(200).json({
        status: true,
        msg: 'Subscription renewed successfully',
        data: result,
      });
    } catch (err) {
      const msg = (err as Error).message;
      const httpStatus = msg === 'Company not found' ? 404 : 500;
      res.status(httpStatus).json({
        status: false,
        msg: 'Failed to renew subscription',
        error: msg,
      });
    }
  }

  async getCompanyB2BData(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.params;
      const data = await adminService.getCompanyB2BData(companyId);
      res.status(200).json({ status: true, data });
    } catch (err) {
      res.status(500).json({ status: false, msg: (err as Error).message });
    }
  }

  async saveCompanyCustomerGroup(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.params;
      const data = await adminService.saveCompanyCustomerGroup(companyId, req.body);
      res.status(200).json({ status: true, data });
    } catch (err) {
      res.status(500).json({ status: false, msg: (err as Error).message });
    }
  }

  async deleteCompanyCustomerGroup(req: Request, res: Response): Promise<void> {
    try {
      const { companyId, groupId } = req.params;
      await adminService.deleteCompanyCustomerGroup(companyId, Number(groupId));
      res.status(200).json({ status: true, msg: 'Group deleted' });
    } catch (err) {
      res.status(500).json({ status: false, msg: (err as Error).message });
    }
  }

  async saveCompanyGroupPrices(req: Request, res: Response): Promise<void> {
    try {
      const { companyId, groupId } = req.params;
      const { product_prices } = req.body as { product_prices?: Array<{ product_id: number; custom_price: number }> };
      await adminService.saveCompanyGroupPrices(companyId, Number(groupId), product_prices || []);
      res.status(200).json({ status: true, msg: 'Pricing saved' });
    } catch (err) {
      res.status(500).json({ status: false, msg: (err as Error).message });
    }
  }

  async saveCatalogGroupAccess(req: Request, res: Response): Promise<void> {
    try {
      const { companyId, catalogueId } = req.params;
      const { group_ids } = req.body as { group_ids?: number[] };
      await adminService.saveCatalogGroupAccess(companyId, Number(catalogueId), group_ids || []);
      res.status(200).json({ status: true, msg: 'Catalog access updated' });
    } catch (err) {
      res.status(500).json({ status: false, msg: (err as Error).message });
    }
  }

  async getCompanyCustomDomain(req: Request, res: Response): Promise<void> {
    try {
      const data = await adminService.getCompanyCustomDomain(req.params.companyId);
      res.status(200).json({ status: true, data });
    } catch (err) {
      res.status(500).json({ status: false, msg: (err as Error).message });
    }
  }

  async saveCompanyCustomDomain(req: Request, res: Response): Promise<void> {
    try {
      const { custom_domain } = req.body as { custom_domain?: string | null };
      await adminService.saveCompanyCustomDomain(req.params.companyId, custom_domain ?? null);
      res.status(200).json({ status: true, msg: 'Domain saved' });
    } catch (err) {
      res.status(500).json({ status: false, msg: (err as Error).message });
    }
  }

  async getCompanyWhatsAppTemplate(req: Request, res: Response): Promise<void> {
    try {
      const data = await adminService.getCompanyWhatsAppTemplate(req.params.companyId);
      res.status(200).json({ status: true, data });
    } catch (err) {
      res.status(500).json({ status: false, msg: (err as Error).message });
    }
  }

  async saveCompanyWhatsAppTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { product_share_text } = req.body as { product_share_text?: string };
      if (!product_share_text) {
        res.status(400).json({ status: false, msg: 'product_share_text is required' });
        return;
      }
      await adminService.saveCompanyWhatsAppTemplate(req.params.companyId, product_share_text);
      res.status(200).json({ status: true, msg: 'Template saved' });
    } catch (err) {
      res.status(500).json({ status: false, msg: (err as Error).message });
    }
  }

  async getAdvancedAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const data = await adminService.getAdvancedPlatformAnalytics();
      res.status(200).json({ status: true, data });
    } catch (err) {
      res.status(500).json({ status: false, msg: (err as Error).message });
    }
  }

  async getOfflineSyncDiagnostics(req: Request, res: Response): Promise<void> {
    try {
      const data = await adminService.getOfflineSyncDiagnostics();
      res.status(200).json({ status: true, data });
    } catch (err) {
      res.status(500).json({ status: false, msg: (err as Error).message });
    }
  }
}

export const adminController = new AdminController();
