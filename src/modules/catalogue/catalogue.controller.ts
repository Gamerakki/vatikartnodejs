import { Request, Response } from 'express';
import { catalogueService } from './catalogue.service';
import { saveCatalogueSchema, softDeleteRestoreCatalogueSchema } from './catalogue.validation';
import { prisma } from '../../config/database';
import PDFDocument from 'pdfkit';

function toCdnUrl(path?: string | null): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `https://cdn.vatikart.in/${path}`;
}

function csvCell(value: unknown): string {
  const raw = value == null ? '' : String(value);
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
}

export class CatalogueController {
  private async getExportCatalogueData(catalogueIdOrSlug: string) {
    const numericId = Number(catalogueIdOrSlug);
    const isNumeric = Number.isFinite(numericId) && numericId > 0;

    const catalogue = await prisma.catalogue.findFirst({
      where: isNumeric
        ? { catalogueId: BigInt(numericId), isDeleted: false, isPublished: true }
        : { slug: catalogueIdOrSlug, isDeleted: false, isPublished: true },
      include: {
        company: {
          select: {
            companyName: true,
            logoImgPath: true,
          },
        },
      },
    });

    if (!catalogue) {
      throw new Error('Catalogue not found');
    }

    const products = await prisma.product.findMany({
      where: {
        catalogueId: catalogue.catalogueId,
        companyId: catalogue.companyId,
        isDeleted: false,
      },
      include: {
        images: {
          orderBy: { productImgId: 'asc' },
          take: 1,
        },
      },
      orderBy: { productId: 'desc' },
    });

    return {
      title: catalogue.catalogue || 'Catalogue Export',
      companyName: catalogue.company?.companyName || '',
      logoUrl: toCdnUrl(catalogue.company?.logoImgPath || ''),
      products,
    };
  }

  async exportCataloguePdf(req: Request, res: Response): Promise<void> {
    try {
      const payload = await this.getExportCatalogueData(req.params.catalogueId);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="catalogue-export.pdf"');

      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      doc.pipe(res);

      doc.fontSize(20).text(payload.title, { underline: false });
      if (payload.companyName) {
        doc.moveDown(0.25);
        doc.fontSize(11).fillColor('#444444').text(`Company: ${payload.companyName}`);
      }
      if (payload.logoUrl) {
        doc.moveDown(0.25);
        doc.fontSize(10).fillColor('#666666').text(`Logo: ${payload.logoUrl}`);
      }
      doc.moveDown(0.75);
      doc.fillColor('#000000').fontSize(10).text(`Products: ${payload.products.length}`);
      doc.moveDown(0.8);

      payload.products.forEach((product, index) => {
        if (doc.y > 730) {
          doc.addPage();
        }

        doc.fontSize(13).fillColor('#111111').text(`${index + 1}. ${product.product}`);
        doc.moveDown(0.15);
        doc.fontSize(10).fillColor('#333333').text(`SKU: ${product.sku || 'NA'}`);
        doc.fontSize(10).text(`Price: ${product.price != null ? `Rs ${Number(product.price).toFixed(2)}` : 'NA'} | MRP: ${product.originalPrice != null ? `Rs ${Number(product.originalPrice).toFixed(2)}` : 'NA'}`);
        doc.fontSize(10).text(`Minimum Order Qty: ${product.minimumOrderQty ?? 1}`);
        doc.fontSize(10).text(`Description: ${product.description || 'NA'}`);
        doc.fontSize(9).fillColor('#666666').text(`Image: ${toCdnUrl(product.images[0]?.productImgPath || '') || 'NA'}`);
        doc.moveDown(0.7);
      });

      doc.end();
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

  async exportCatalogueExcel(req: Request, res: Response): Promise<void> {
    try {
      const payload = await this.getExportCatalogueData(req.params.catalogueId);
      const lines: string[] = [];

      lines.push([
        'Product Name',
        'SKU',
        'Price (₹)',
        'MRP (₹)',
        'GST (%)',
        'Price Mode',
        'Minimum Order Qty',
        'Description',
      ].map(csvCell).join(','));

      payload.products.forEach((product) => {
        lines.push([
          product.product,
          product.sku || '',
          product.price != null ? Number(product.price).toFixed(2) : '',
          product.originalPrice != null ? Number(product.originalPrice).toFixed(2) : '',
          product.gstRate != null ? Number(product.gstRate).toFixed(2) : '0',
          product.priceMode || 'perPiece',
          product.minimumOrderQty ?? 1,
          product.description || '',
        ].map(csvCell).join(','));
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="catalogue-export.csv"');
      res.status(200).send(lines.join('\n'));
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
    let catalogueId = parseInt(req.params.catalogue_id, 10);
    const phone = req.body.phone || req.body.customerPhone;
    const name = req.body.name || req.body.customerName;

    if (isNaN(catalogueId)) {
      // Try to look it up as a slug
      const cat = await prisma.catalogue.findFirst({ where: { slug: req.params.catalogue_id } });
      if (!cat) {
        res.status(404).json({ status: false, msg: `Catalogue not found for slug: ${req.params.catalogue_id}` });
        return;
      }
      catalogueId = Number(cat.catalogueId);
    }

    if (!phone || !name) {
      res.status(400).json({ status: false, msg: `Invalid parameters. body=${JSON.stringify(req.body)}` });
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

  async cloneCatalogue(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;
    const catalogueId = parseInt(req.params.catalogue_id, 10);
    const { catalogue } = req.body;

    if (isNaN(catalogueId)) {
      res.status(400).json({ status: false, msg: 'Invalid catalogue_id' });
      return;
    }

    if (!catalogue || !catalogue.trim()) {
      res.status(400).json({ status: false, msg: 'Catalogue name is required' });
      return;
    }

    try {
      const cloned = await catalogueService.cloneCatalogue(loggedInUserId, catalogueId, catalogue);
      res.status(200).json({
        status: true,
        msg: 'Catalogue cloned successfully!',
        data: cloned,
      });
    } catch (err) {
      const msg = (err as Error).message;
      let httpStatus = 500;
      if (msg === 'Catalogue not found') {
        httpStatus = 404;
      } else if (msg === 'A catalogue with this name already exists') {
        httpStatus = 400;
      }
      res.status(httpStatus).json({
        status: false,
        msg: msg === 'Catalogue not found' || msg === 'A catalogue with this name already exists' ? msg : 'An error occurred',
        error: msg,
      });
    }
  }
}

export const catalogueController = new CatalogueController();
