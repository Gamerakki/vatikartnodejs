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
}

export const adminController = new AdminController();
