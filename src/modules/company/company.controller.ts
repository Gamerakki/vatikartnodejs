import { Request, Response } from 'express';
import { companyService } from './company.service';
import { companyRepository } from './company.repository';
import {
  saveCompanySchema,
  saveSocialMediaBatchSchema,
  saveCompanySupportContactDetailsSchema,
  saveCompanySalesContactDetailsSchema,
} from './company.validation';

export class CompanyController {
  async saveCompany(req: Request, res: Response): Promise<void> {
    // fields from multipart form are in req.body
    const parseResult = saveCompanySchema.safeParse(req.body);

    if (!parseResult.success) {
      const formattedErrors: Record<string, string> = {};
      parseResult.error.issues.forEach((issue) => {
        const fieldPath = issue.path.join('.');
        formattedErrors[fieldPath] = issue.message;
      });

      res.status(501).json({
        status: false,
        msg: 'Validation errors',
        error: formattedErrors,
      });
      return;
    }

    const loggedInUserId = res.locals.userId || 0;
    const logoFile = req.file;

    try {
      await companyService.saveCompany(loggedInUserId, parseResult.data, logoFile);
      res.status(200).json({
        status: true,
        msg: 'Company details saved successfully!',
      });
    } catch (err) {
      const msg = (err as Error).message;
      const httpStatus = msg.includes('file') || msg.includes('extension') ? 400 : 500;
      res.status(httpStatus).json({
        status: false,
        msg: 'An error occurred',
        error: msg,
      });
    }
  }

  async saveSocialMedia(req: Request, res: Response): Promise<void> {
    const parseResult = saveSocialMediaBatchSchema.safeParse(req.body);

    if (!parseResult.success) {
      const formattedErrors: Record<string, string> = {};
      parseResult.error.issues.forEach((issue) => {
        const fieldPath = issue.path.join('.');
        formattedErrors[fieldPath] = issue.message;
      });

      res.status(501).json({
        status: false,
        msg: 'Validation errors',
        error: formattedErrors,
      });
      return;
    }

    const loggedInUserId = res.locals.userId || 0;

    try {
      await companyService.saveCompanySocialMediaBatch(loggedInUserId, parseResult.data);
      res.status(200).json({
        status: true,
        msg: 'Social media saved successfully!',
      });
    } catch (err) {
      const msg = (err as Error).message;
      const httpStatus = msg.includes('first') ? 422 : 500;
      res.status(httpStatus).json({
        status: false,
        msg: msg.includes('first') ? 'Please add your company details first' : 'An error occurred',
        error: msg,
      });
    }
  }

  async fetchCompanyData(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;

    try {
      const companyData = await companyService.fetchCompanyDataViaUserId(loggedInUserId);
      res.status(200).json({
        status: true,
        msg: 'Company data fetched successfully!',
        data: companyData,
      });
    } catch (err) {
      res.status(500).json({
        status: false,
        msg: 'An error occurred',
        error: (err as Error).message,
      });
    }
  }

  async saveCompanySupportContactDetails(req: Request, res: Response): Promise<void> {
    const parseResult = saveCompanySupportContactDetailsSchema.safeParse(req.body);

    if (!parseResult.success) {
      const formattedErrors: Record<string, string> = {};
      parseResult.error.issues.forEach((issue) => {
        const fieldPath = issue.path.join('.');
        formattedErrors[fieldPath] = issue.message;
      });

      res.status(501).json({
        status: false,
        msg: 'Validation errors',
        error: formattedErrors,
      });
      return;
    }

    const loggedInUserId = res.locals.userId || 0;

    try {
      await companyService.saveCompanySupportDetails(loggedInUserId, parseResult.data);
      res.status(200).json({
        status: true,
        msg: 'Company support contact details saved successfully!',
      });
    } catch (err) {
      res.status(500).json({
        status: false,
        msg: 'An error occurred',
        error: (err as Error).message,
      });
    }
  }

  async fetchCompanySupportContactDetails(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;

    try {
      const details = await companyService.fetchCompanySupportContactDetails(loggedInUserId);
      res.status(200).json({
        status: true,
        msg: 'Company support contact details fetched successfully!',
        data: details,
      });
    } catch (err) {
      res.status(500).json({
        status: false,
        msg: 'An error occurred',
        error: (err as Error).message,
      });
    }
  }

  async saveCompanySalesContactDetails(req: Request, res: Response): Promise<void> {
    const parseResult = saveCompanySalesContactDetailsSchema.safeParse(req.body);

    if (!parseResult.success) {
      const formattedErrors: Record<string, string> = {};
      parseResult.error.issues.forEach((issue) => {
        const fieldPath = issue.path.join('.');
        formattedErrors[fieldPath] = issue.message;
      });

      res.status(501).json({
        status: false,
        msg: 'Validation errors',
        error: formattedErrors,
      });
      return;
    }

    const loggedInUserId = res.locals.userId || 0;

    try {
      await companyService.saveCompanySalesDetails(loggedInUserId, parseResult.data);
      res.status(200).json({
        status: true,
        msg: 'Company sales contact details saved successfully!',
      });
    } catch (err) {
      res.status(500).json({
        status: false,
        msg: 'An error occurred',
        error: (err as Error).message,
      });
    }
  }

  async fetchCompanySalesContactDetails(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;

    try {
      const details = await companyService.fetchCompanySalesContactDetails(loggedInUserId);
      res.status(200).json({
        status: true,
        msg: 'Company sales contact details fetched successfully!',
        data: details,
      });
    } catch (err) {
      res.status(500).json({
        status: false,
        msg: 'An error occurred',
        error: (err as Error).message,
      });
    }
  }

  async resolveSubdomain(req: Request, res: Response): Promise<void> {
    const { subdomain } = req.params;
    if (!subdomain) {
      res.status(400).json({
        status: false,
        msg: 'Subdomain is required',
      });
      return;
    }

    try {
      const result = await companyService.resolveSubdomain(subdomain.toLowerCase().trim());
      if (!result) {
        res.status(404).json({
          status: false,
          msg: 'Company not found for this subdomain',
        });
        return;
      }
      res.status(200).json({
        status: true,
        msg: 'Subdomain resolved successfully',
        data: result,
      });
    } catch (err) {
      res.status(500).json({
        status: false,
        msg: 'An error occurred',
        error: (err as Error).message,
      });
    }
  }

  async updateWatermark(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;
    const { watermarkEnabled } = req.body as { watermarkEnabled?: boolean };

    if (typeof watermarkEnabled !== 'boolean') {
      res.status(400).json({ status: false, msg: 'watermarkEnabled must be a boolean' });
      return;
    }

    try {
      await companyRepository.updateWatermarkEnabled(loggedInUserId, watermarkEnabled);
      res.status(200).json({ status: true, msg: `Watermark ${watermarkEnabled ? 'enabled' : 'disabled'}.` });
    } catch (err) {
      res.status(500).json({ status: false, msg: 'An error occurred', error: (err as Error).message });
    }
  }
}

export const companyController = new CompanyController();
