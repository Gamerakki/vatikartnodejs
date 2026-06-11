import { Request, Response } from 'express';
import { productService } from './product.service';
import {
  productFileUploadSchema,
  createProductBatchSchema,
  saveBasicInfoSchema,
  saveVariantOptionsSchema,
  saveInventorySchema,
  restockInventorySchema,
  deleteProductSchema,
} from './product.validation';

export class ProductController {
  async bulkImportProducts(req: Request, res: Response): Promise<void> {
    const catalogueId = parseInt(req.params.catalogue_id, 10);
    const loggedInUserId = res.locals.userId || 0;
    const file = req.file;

    if (isNaN(catalogueId) || !file) {
      res.status(400).json({ status: false, msg: 'Invalid catalogue_id or missing file' });
      return;
    }

    try {
      const result = await productService.bulkImportProducts(loggedInUserId, catalogueId, file);
      res.status(200).json({
        status: true,
        msg: 'Products imported successfully!',
        data: result,
      });
    } catch (err) {
      res.status(500).json({
        status: false,
        msg: 'An error occurred during import',
        error: (err as Error).message,
      });
    }
  }

  async uploadProductUrlGenerator(req: Request, res: Response): Promise<void> {
    const parseResult = productFileUploadSchema.safeParse(req.body);

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

    try {
      const urls = await productService.uploadProductUrlGen(parseResult.data);
      res.status(200).json({
        status: true,
        msg: 'URLs generated successfully!',
        data: urls,
      });
    } catch (err) {
      res.status(400).json({
        status: false,
        msg: 'Upload file count should be less than 20 per upload.',
        error: (err as Error).message,
      });
    }
  }

  async createProduct(req: Request, res: Response): Promise<void> {
    const parseResult = createProductBatchSchema.safeParse(req.body);

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
      const response = await productService.createProduct(loggedInUserId, parseResult.data);
      res.status(200).json({
        status: true,
        msg: 'Products created successfully!',
        data: response,
      });
    } catch (err) {
      res.status(500).json({
        status: false,
        msg: 'An error occurred',
        error: (err as Error).message,
      });
    }
  }

  async fetchProductsByCatalogue(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;
    const catalogueId = parseInt(req.params.catalogue_id, 10);

    if (isNaN(catalogueId)) {
      res.status(400).json({ status: false, msg: 'Invalid catalogue_id' });
      return;
    }

    try {
      const list = await productService.fetchProductsByCatalogue(loggedInUserId, catalogueId);
      res.status(200).json({
        status: true,
        msg: 'Products fetched successfully!',
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

  async fetchAllProducts(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;

    try {
      const list = await productService.fetchAllProducts(loggedInUserId);
      res.status(200).json({
        status: true,
        msg: 'All products fetched successfully!',
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

  async saveBasicInfo(req: Request, res: Response): Promise<void> {
    const parseResult = saveBasicInfoSchema.safeParse(req.body);

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
      await productService.saveBasicInfo(loggedInUserId, parseResult.data);
      res.status(200).json({
        status: true,
        msg: 'Product basic info saved successfully!',
      });
    } catch (err) {
      res.status(500).json({
        status: false,
        msg: 'An error occurred',
        error: (err as Error).message,
      });
    }
  }

  async saveVariantOptions(req: Request, res: Response): Promise<void> {
    const parseResult = saveVariantOptionsSchema.safeParse(req.body);

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
      await productService.saveVariantOptions(loggedInUserId, parseResult.data);
      res.status(200).json({
        status: true,
        msg: 'Product variant options saved successfully!',
      });
    } catch (err) {
      const msg = (err as Error).message;
      const httpStatus = msg === 'product not found' ? 404 : 500;
      res.status(httpStatus).json({
        status: false,
        msg: msg === 'product not found' ? 'product not found' : 'An error occurred',
        error: msg,
      });
    }
  }

  async fetchBasicInfo(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;
    const productId = parseInt(req.params.product_id, 10);

    if (isNaN(productId)) {
      res.status(400).json({ status: false, msg: 'Invalid product_id' });
      return;
    }

    try {
      const info = await productService.fetchBasicInfo(loggedInUserId, productId);
      res.status(200).json({
        status: true,
        msg: 'Product basic info fetched successfully!',
        data: info,
      });
    } catch (err) {
      const msg = (err as Error).message;
      const httpStatus = msg === 'product not found' ? 404 : 500;
      res.status(httpStatus).json({
        status: false,
        msg: msg === 'product not found' ? 'product not found' : 'An error occurred',
        error: msg,
      });
    }
  }

  async saveInventory(req: Request, res: Response): Promise<void> {
    const parseResult = saveInventorySchema.safeParse(req.body);

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
      await productService.saveInventory(loggedInUserId, parseResult.data);
      res.status(200).json({
        status: true,
        msg: 'Product inventory saved successfully!',
      });
    } catch (err) {
      const msg = (err as Error).message;
      let httpStatus = 500;

      if (msg === 'product not found') {
        httpStatus = 404;
      } else if (msg === 'invalid size option') {
        httpStatus = 501; // Not Implemented (custom mapping in Go)
      }

      res.status(httpStatus).json({
        status: false,
        msg: msg === 'product not found' ? 'product not found' : msg,
        error: msg,
      });
    }
  }

  async fetchInventory(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;
    const productId = parseInt(req.params.product_id, 10);

    if (isNaN(productId)) {
      res.status(400).json({ status: false, msg: 'Invalid product_id' });
      return;
    }

    try {
      const inventory = await productService.fetchInventory(loggedInUserId, productId);
      res.status(200).json({
        status: true,
        msg: 'Product inventory fetched successfully!',
        data: inventory,
      });
    } catch (err) {
      const msg = (err as Error).message;
      const httpStatus = msg === 'product not found' ? 404 : 500;
      res.status(httpStatus).json({
        status: false,
        msg: msg === 'product not found' ? 'product not found' : 'An error occurred',
        error: msg,
      });
    }
  }

  async fetchInventoryList(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;

    try {
      const list = await productService.fetchInventoryList(loggedInUserId);
      res.status(200).json({
        status: true,
        msg: 'Inventory list fetched successfully!',
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

  async fetchInventoryStats(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;

    try {
      const stats = await productService.fetchInventoryStats(loggedInUserId);
      res.status(200).json({
        status: true,
        msg: 'Inventory statistics fetched successfully!',
        data: stats,
      });
    } catch (err) {
      res.status(500).json({
        status: false,
        msg: 'An error occurred',
        error: (err as Error).message,
      });
    }
  }

  async restockInventory(req: Request, res: Response): Promise<void> {
    const parseResult = restockInventorySchema.safeParse(req.body);

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
      const success = await productService.restockInventory(
        loggedInUserId,
        parseResult.data.product_id,
        parseResult.data.quantity
      );
      res.status(200).json({
        status: success,
        msg: 'Product inventory restocked successfully!',
      });
    } catch (err) {
      const msg = (err as Error).message;
      const httpStatus = msg === 'Product not found' ? 404 : 500;
      res.status(httpStatus).json({
        status: false,
        msg: msg === 'Product not found' ? 'Product not found' : 'An error occurred',
        error: msg,
      });
    }
  }

  async deleteProduct(req: Request, res: Response): Promise<void> {
    const parseResult = deleteProductSchema.safeParse(req.body);

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
      await productService.deleteProducts(loggedInUserId, parseResult.data.product_ids);
      res.status(200).json({
        status: true,
        msg: 'Product deleted successfully!',
      });
    } catch (err) {
      res.status(500).json({
        status: false,
        msg: 'An error occurred',
        error: (err as Error).message,
      });
    }
  }
}

export const productController = new ProductController();
