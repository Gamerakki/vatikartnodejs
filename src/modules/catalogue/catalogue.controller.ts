import { Request, Response } from 'express';
import { catalogueService } from './catalogue.service';
import { saveCatalogueSchema, softDeleteRestoreCatalogueSchema } from './catalogue.validation';

export class CatalogueController {
  async saveCatalogue(req: Request, res: Response): Promise<void> {
    const parseResult = saveCatalogueSchema.safeParse(req.body);

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
      const response = await catalogueService.saveCatalogue(loggedInUserId, parseResult.data);
      res.status(200).json({
        status: true,
        msg: 'Catalogue saved successfully!',
        data: response,
      });
    } catch (err) {
      const msg = (err as Error).message;
      const httpStatus = msg === 'Catalogue not found' ? 404 : 500;
      res.status(httpStatus).json({
        status: false,
        msg: 'An error occurred',
        error: msg,
      });
    }
  }

  async fetchCatalogues(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const search_txt = (req.query.search_txt as string) || '';

    try {
      const list = await catalogueService.fetchCatalogues(
        loggedInUserId,
        { limit, offset, search_txt },
        false
      );
      res.status(200).json({
        status: true,
        msg: 'Catalogues fetched successfully!',
        data: list,
      });
    } catch (err) {
      res.status(500).json({
        status: false,
        msg: 'An error occurred',
        error: (err as Error).message,
      });
    }
  }

  async fetchCatalogueData(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;
    const catalogueId = parseInt(req.params.catalogue_id, 10);

    if (isNaN(catalogueId)) {
      res.status(400).json({ status: false, msg: 'Invalid catalogue_id' });
      return;
    }

    try {
      const data = await catalogueService.fetchCatalogueData(loggedInUserId, catalogueId, false);
      res.status(200).json({
        status: true,
        msg: 'Catalogue data fetched successfully!',
        data,
      });
    } catch (err) {
      const msg = (err as Error).message;
      const httpStatus = msg === 'Catalogue not found' ? 404 : 500;
      res.status(httpStatus).json({
        status: false,
        msg: msg === 'Catalogue not found' ? 'Catalogue not found' : 'An error occurred',
        error: msg,
      });
    }
  }

  async deleteCatalogue(req: Request, res: Response): Promise<void> {
    const parseResult = softDeleteRestoreCatalogueSchema.safeParse(req.body);

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
      // Check existing first
      await catalogueService.checkCatalogueIdsExist(loggedInUserId, parseResult.data, false);
      await catalogueService.deleteCatalogue(parseResult.data);
      res.status(200).json({
        status: true,
        msg: 'Catalogue deleted successfully!',
      });
    } catch (err) {
      const msg = (err as Error).message;
      const httpStatus = msg === 'No catalogues found' ? 404 : 500;
      res.status(httpStatus).json({
        status: false,
        msg: msg === 'No catalogues found' ? 'No catalogues found' : 'An error occurred',
        error: msg,
      });
    }
  }

  async fetchDeletedCatalogues(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const search_txt = (req.query.search_txt as string) || '';

    try {
      const list = await catalogueService.fetchCatalogues(
        loggedInUserId,
        { limit, offset, search_txt },
        true
      );
      res.status(200).json({
        status: true,
        msg: 'Deleted catalogues fetched successfully!',
        data: list,
      });
    } catch (err) {
      res.status(500).json({
        status: false,
        msg: 'An error occurred',
        error: (err as Error).message,
      });
    }
  }

  async fetchDeletedCatalogueData(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;
    const catalogueId = parseInt(req.params.catalogue_id, 10);

    if (isNaN(catalogueId)) {
      res.status(400).json({ status: false, msg: 'Invalid catalogue_id' });
      return;
    }

    try {
      const data = await catalogueService.fetchCatalogueData(loggedInUserId, catalogueId, true);
      res.status(200).json({
        status: true,
        msg: 'Deleted catalogue data fetched successfully!',
        data,
      });
    } catch (err) {
      const msg = (err as Error).message;
      const httpStatus = msg === 'Catalogue not found' ? 404 : 500;
      res.status(httpStatus).json({
        status: false,
        msg: msg === 'Catalogue not found' ? 'Catalogue not found' : 'An error occurred',
        error: msg,
      });
    }
  }

  async restoreCatalogue(req: Request, res: Response): Promise<void> {
    const parseResult = softDeleteRestoreCatalogueSchema.safeParse(req.body);

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
      const existingIds = await catalogueService.checkCatalogueIdsExist(
        loggedInUserId,
        parseResult.data,
        true
      );
      await catalogueService.restoreCatalogue(parseResult.data);
      const restoredData = await catalogueService.fetchRestoredCatalogueData(existingIds);

      res.status(200).json({
        status: true,
        msg: 'Catalogue restored successfully!',
        data: restoredData,
      });
    } catch (err) {
      const msg = (err as Error).message;
      const httpStatus = msg === 'No catalogues found' ? 404 : 500;
      res.status(httpStatus).json({
        status: false,
        msg: msg === 'No catalogues found' ? 'No catalogues found' : 'An error occurred',
        error: msg,
      });
    }
  }

  async fetchPublicCatalogueProducts(req: Request, res: Response): Promise<void> {
    const idParam = req.params.catalogue_id;
    const catalogueId = parseInt(idParam, 10);
    const customerPhone = (req.headers['customer-phone'] as string) || null;

    try {
      let result;
      if (isNaN(catalogueId)) {
        // Param is a slug!
        result = await catalogueService.fetchPublicCatalogueProducts(idParam, customerPhone);
      } else {
        // Param is an ID!
        result = await catalogueService.fetchPublicCatalogueProducts(catalogueId, customerPhone);
      }

      res.status(200).json({
        status: true,
        msg: 'Public catalogue products fetched successfully!',
        title: result.title,
        privacyLevel: result.privacyLevel,
        data: result.products,
      });
    } catch (err) {
      const msg = (err as Error).message;
      let status = 500;
      if (msg === 'Catalogue not found') status = 404;
      if (msg === 'REQUIRES_ACCESS') status = 403;
      res.status(status).json({
        status: false,
        msg: msg === 'Catalogue not found' ? 'Catalogue not found' : msg === 'REQUIRES_ACCESS' ? 'Private catalogue requires access' : 'An error occurred',
        error: msg,
      });
    }
  }

  async updateCataloguePrivacy(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;
    const catalogueId = parseInt(req.params.catalogue_id, 10);
    const { privacyLevel } = req.body;

    if (isNaN(catalogueId) || !['PUBLIC', 'PRIVATE'].includes(privacyLevel)) {
      res.status(400).json({ status: false, msg: 'Invalid parameters' });
      return;
    }

    try {
      await catalogueService.updateCataloguePrivacy(loggedInUserId, catalogueId, privacyLevel);
      res.status(200).json({ status: true, msg: 'Privacy updated successfully' });
    } catch (err) {
      res.status(500).json({ status: false, msg: (err as Error).message });
    }
  }

  async createAccessRequest(req: Request, res: Response): Promise<void> {
    const catalogueId = parseInt(req.params.catalogue_id, 10);
    const { phone, name } = req.body;

    if (isNaN(catalogueId) || !phone || !name) {
      res.status(400).json({ status: false, msg: `Invalid parameters: id=${req.params.catalogue_id}, name=${name}, phone=${phone}` });
      return;
    }

    try {
      await catalogueService.createAccessRequest(catalogueId, phone, name);
      res.status(200).json({ status: true, msg: 'Request submitted successfully' });
    } catch (err) {
      res.status(500).json({ status: false, msg: (err as Error).message });
    }
  }

  async fetchAccessRequests(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;
    try {
      const requests = await catalogueService.fetchAccessRequests(loggedInUserId);
      res.status(200).json({ status: true, data: requests });
    } catch (err) {
      res.status(500).json({ status: false, msg: (err as Error).message });
    }
  }

  async updateAccessRequest(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;
    const accessId = parseInt(req.params.access_id, 10);
    const { status, expiresInHours } = req.body;

    if (isNaN(accessId) || !['APPROVED', 'REJECTED'].includes(status)) {
      res.status(400).json({ status: false, msg: 'Invalid parameters' });
      return;
    }

    let expiresAt: Date | null = null;
    if (status === 'APPROVED' && expiresInHours) {
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresInHours);
    }

    try {
      await catalogueService.updateAccessRequest(loggedInUserId, accessId, status, expiresAt);
      res.status(200).json({ status: true, msg: `Request ${status.toLowerCase()} successfully` });
    } catch (err) {
      res.status(500).json({ status: false, msg: (err as Error).message });
    }
  }
}

export const catalogueController = new CatalogueController();
