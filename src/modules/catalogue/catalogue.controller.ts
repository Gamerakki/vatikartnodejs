import { Request, Response } from 'express';
import { catalogueService } from './catalogue.service';
import { saveCatalogueSchema, softDeleteRestoreCatalogueSchema } from './catalogue.validation';
import { prisma } from '../../config/database';
import PDFDocument from 'pdfkit';
import { uploadToR2 } from '../../utils/s3';

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

async function getExportCatalogueData(catalogueIdOrSlug: string) {
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

type ExportCataloguePayload = Awaited<ReturnType<typeof getExportCatalogueData>>;
type ExportProduct = ExportCataloguePayload['products'][number];
type PdfTheme = 'minimalist' | 'bold' | 'corporate' | 'classic';

function normalizePdfTheme(themeValue: string): PdfTheme {
  const normalized = themeValue.toLowerCase();
  if (normalized === 'minimalist') return 'minimalist';
  if (normalized === 'bold') return 'bold';
  if (normalized === 'classic') return 'classic';
  return 'corporate';
}

function truncateText(value: string | null | undefined, maxLength: number): string {
  const text = (value || '').trim();
  if (!text) return 'NA';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function getPdfThemeTokens(theme: PdfTheme) {
  if (theme === 'minimalist') {
    return {
      pageBackground: '#FFFFFF',
      headerBackground: null,
      headerText: '#111827',
      titleColor: '#111827',
      subtitleColor: '#6B7280',
      cardBackground: '#FFFFFF',
      cardBorder: '#D1D5DB',
      cardBorderWidth: 0.8,
      accent: '#6B7280',
      bodyText: '#1F2937',
      mutedText: '#6B7280',
      titleFont: 'Helvetica-Bold',
      bodyFont: 'Helvetica',
    };
  }

  if (theme === 'bold') {
    return {
      pageBackground: '#FFF7ED',
      headerBackground: '#0F766E',
      headerText: '#FFFFFF',
      titleColor: '#0F172A',
      subtitleColor: '#475569',
      cardBackground: '#FFFFFF',
      cardBorder: '#F97316',
      cardBorderWidth: 2,
      accent: '#EA580C',
      bodyText: '#0F172A',
      mutedText: '#475569',
      titleFont: 'Helvetica-Bold',
      bodyFont: 'Helvetica',
    };
  }

  return {
    pageBackground: '#F8FAFC',
    headerBackground: '#E2E8F0',
    headerText: '#0F172A',
    titleColor: '#0F172A',
    subtitleColor: '#475569',
    cardBackground: '#FFFFFF',
    cardBorder: '#CBD5E1',
    cardBorderWidth: 1.2,
    accent: '#0F766E',
    bodyText: '#0F172A',
    mutedText: '#475569',
    titleFont: 'Helvetica-Bold',
    bodyFont: 'Helvetica',
  };
}

function renderCataloguePdfHeader(doc: PDFKit.PDFDocument, payload: ExportCataloguePayload, theme: PdfTheme, columns: 1 | 2) {
  const tokens = getPdfThemeTokens(theme);
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;
  const top = doc.y;
  const headerHeight = theme === 'minimalist' ? 66 : 82;

  if (tokens.headerBackground) {
    doc.save();
    doc.roundedRect(left, top, width, headerHeight, 14).fill(tokens.headerBackground);
    doc.restore();
  }

  const inset = left + 18;
  const headerTextColor = tokens.headerBackground ? tokens.headerText : tokens.titleColor;
  const metaColor = tokens.headerBackground ? 'rgba(255,255,255,0.88)' : tokens.subtitleColor;

  doc.font(tokens.titleFont).fontSize(theme === 'bold' ? 22 : 20).fillColor(headerTextColor).text(payload.title, inset, top + 16, {
    width: width - 36,
  });

  doc.font(tokens.bodyFont).fontSize(10).fillColor(metaColor).text(
    `${payload.companyName || 'VatiKart'} • ${payload.products.length} products • ${columns === 2 ? '2-column grid' : '1-column list'} • ${theme} theme`,
    inset,
    top + (theme === 'bold' ? 48 : 42),
    { width: width - 36 },
  );

  if (payload.logoUrl) {
    doc.fontSize(9).fillColor(metaColor).text(`Logo: ${payload.logoUrl}`, inset, top + headerHeight - 18, {
      width: width - 36,
      lineBreak: false,
    });
  }

  doc.y = top + headerHeight + 12;
}

function renderProductCard(
  doc: PDFKit.PDFDocument,
  product: ExportProduct,
  index: number,
  x: number,
  y: number,
  width: number,
  height: number,
  theme: PdfTheme,
) {
  const tokens = getPdfThemeTokens(theme);
  const padding = theme === 'minimalist' ? 12 : 14;

  doc.save();
  doc.roundedRect(x, y, width, height, 12).fillAndStroke(tokens.cardBackground, tokens.cardBorder);
  doc.lineWidth(tokens.cardBorderWidth).roundedRect(x, y, width, height, 12).stroke(tokens.cardBorder);
  doc.restore();

  const contentX = x + padding;
  let cursorY = y + padding;
  const contentWidth = width - padding * 2;

  doc.font(tokens.titleFont).fontSize(theme === 'bold' ? 13 : 12).fillColor(tokens.titleColor).text(
    `${index + 1}. ${truncateText(product.product, theme === 'bold' ? 42 : 56)}`,
    contentX,
    cursorY,
    { width: contentWidth },
  );
  cursorY += theme === 'bold' ? 22 : 20;

  const priceText = product.price != null ? `Rs ${Number(product.price).toFixed(2)}` : 'NA';
  const mrpText = product.originalPrice != null ? `Rs ${Number(product.originalPrice).toFixed(2)}` : 'NA';

  doc.font(tokens.bodyFont).fontSize(9.5).fillColor(tokens.bodyText).text(`SKU: ${product.sku || 'NA'}`, contentX, cursorY, { width: contentWidth });
  cursorY += 14;
  doc.text(`Price: ${priceText}   MRP: ${mrpText}`, contentX, cursorY, { width: contentWidth });
  cursorY += 14;
  doc.text(`MOQ: ${product.minimumOrderQty ?? 1}   Mode: ${product.priceMode || 'perPiece'}`, contentX, cursorY, { width: contentWidth });
  cursorY += 14;

  doc.font(tokens.bodyFont).fontSize(8.5).fillColor(tokens.mutedText).text(
    `Description: ${truncateText(product.description, width < 250 ? 60 : 140)}`,
    contentX,
    cursorY,
    { width: contentWidth },
  );
  cursorY += width < 250 ? 28 : 18;

  doc.fontSize(8).fillColor(tokens.accent).text(
    `Image: ${truncateText(toCdnUrl(product.images[0]?.productImgPath || ''), width < 250 ? 42 : 78)}`,
    contentX,
    Math.min(cursorY, y + height - 18),
    { width: contentWidth },
  );
}

export class CatalogueController {
  async exportCataloguePdf(req: Request, res: Response): Promise<void> {
    try {
      const payload = await getExportCatalogueData(req.params.catalogueId);
      payload.products = payload.products.slice(0, 150);
      const theme = normalizePdfTheme(String(req.query.theme || 'corporate'));
      const columns = Number(req.query.columns) === 2 ? 2 : 1;
      const tokens = getPdfThemeTokens(theme);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="catalogue-export.pdf"');

      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      doc.pipe(res);

      doc.rect(0, 0, doc.page.width, doc.page.height).fill(tokens.pageBackground);
      doc.fillColor(tokens.bodyText);
      doc.y = doc.page.margins.top;

      renderCataloguePdfHeader(doc, payload, theme, columns);

      const gap = 14;
      const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const cardWidth = columns === 2 ? (contentWidth - gap) / 2 : contentWidth;
      const cardHeight = columns === 2 ? 138 : theme === 'minimalist' ? 104 : 116;
      let x = doc.page.margins.left;
      let y = doc.y;
      let columnIndex = 0;

      payload.products.forEach((product, index) => {
        const needsNewPage = columns === 2
          ? y + cardHeight > doc.page.height - doc.page.margins.bottom
          : y + cardHeight > doc.page.height - doc.page.margins.bottom;

        if (needsNewPage) {
          doc.addPage();
          doc.rect(0, 0, doc.page.width, doc.page.height).fill(tokens.pageBackground);
          doc.fillColor(tokens.bodyText);
          doc.y = doc.page.margins.top;
          renderCataloguePdfHeader(doc, payload, theme, columns);
          x = doc.page.margins.left;
          y = doc.y;
          columnIndex = 0;
        }

        renderProductCard(doc, product, index, x, y, cardWidth, cardHeight, theme);

        if (columns === 2) {
          if (columnIndex === 0) {
            x = doc.page.margins.left + cardWidth + gap;
            columnIndex = 1;
          } else {
            x = doc.page.margins.left;
            y += cardHeight + gap;
            columnIndex = 0;
          }
        } else {
          y += cardHeight + gap;
        }
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
      const payload = await getExportCatalogueData(req.params.catalogueId);
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
        bannerText: result.bannerText ?? null,
        bannerActive: result.bannerActive ?? false,
        bannerImgPath: result.bannerImgPath ?? null,
        wholesalePricingApplied: result.wholesalePricingApplied ?? false,
        wholesaleGroupName: result.wholesaleGroupName ?? null,
        catalogShareTemplate: result.catalogShareTemplate ?? null,
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

      // Fire-and-forget: notify the catalogue owner
      void (async () => {
        try {
          const cat = await prisma.catalogue.findUnique({
            where: { catalogueId: BigInt(catalogueId) },
            select: { catalogue: true, company: { select: { addedBy: true } } },
          });
          if (cat?.company?.addedBy) {
            const { sendMerchantNotification } = await import('../../utils/notification');
            await sendMerchantNotification(
              cat.company.addedBy,
              '🔒 Catalogue Access Request',
              `${name} has requested access to view "${cat.catalogue || 'your catalogue'}".`,
            );
          }
        } catch {
          // Notification failure must not surface to the caller
        }
      })();

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

  async approveAllAccessRequests(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;
    const catalogueId = parseInt(req.params.catalogueId, 10);

    if (isNaN(catalogueId)) {
      res.status(400).json({ status: false, msg: 'Invalid catalogueId' });
      return;
    }

    try {
      const updatedCount = await catalogueService.approveAllAccessRequests(loggedInUserId, catalogueId);
      res.status(200).json({
        status: true,
        msg: 'All pending requests approved successfully',
        data: { updatedCount },
      });
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

  async updateCatalogueBanner(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;
    const catalogueId = parseInt(req.params.catalogueId, 10);

    if (isNaN(catalogueId)) {
      res.status(400).json({ status: false, msg: 'Invalid catalogue ID' });
      return;
    }

    try {
      const bannerText = (req.body.banner_text as string) || null;
      const bannerActive = req.body.banner_active === 'true' || req.body.banner_active === true;

      let bannerImgPath: string | null = null;
      if (req.file) {
        const uploadedName = await uploadToR2('banners', req.file.buffer, req.file.originalname, req.file.mimetype);
        bannerImgPath = `banners/${uploadedName}`;
      }

      await catalogueService.updateCatalogueBanner(loggedInUserId, catalogueId, bannerText, bannerActive, bannerImgPath);

      res.status(200).json({
        status: true,
        msg: 'Catalogue banner updated successfully!',
        data: { bannerText, bannerActive, bannerImgPath },
      });
    } catch (err) {
      const msg = (err as Error).message;
      res.status(500).json({ status: false, msg: 'An error occurred', error: msg });
    }
  }
}

export const catalogueController = new CatalogueController();
