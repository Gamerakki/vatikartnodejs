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

    try {
      let products;
      if (isNaN(catalogueId)) {
        // Param is a slug!
        products = await catalogueService.fetchPublicCatalogueProducts(idParam);
      } else {
        // Param is an ID!
        products = await catalogueService.fetchPublicCatalogueProducts(catalogueId);
      }

      res.status(200).json({
        status: true,
        msg: 'Public catalogue products fetched successfully!',
        data: products,
      });
    } catch (err) {
      const msg = (err as Error).message;
      const status = msg === 'Catalogue not found' ? 404 : 500;
      res.status(status).json({
        status: false,
        msg: msg === 'Catalogue not found' ? 'Catalogue not found' : 'An error occurred',
        error: msg,
      });
    }
  }
}

export const catalogueController = new CatalogueController();
