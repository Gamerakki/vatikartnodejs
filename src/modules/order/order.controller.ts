import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { orderService } from './order.service';
import { sendBrevoMailViaAPI } from '../../utils/mailer';
import { companyRepository } from '../company/company.repository';
import { getUserIdByCompanyId, sendMerchantNotification } from '../../utils/notification';
import { prisma } from '../../config/database';
import {
  updateOrderStatusSchema,
  updateOrderDiscountSchema,
  updateOrderShippingSchema,
  bookOrderSchema,
} from './order.validation';

async function downloadBrochureImage(url: string): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

export class OrderController {
  async fetchPublicOrdersByCustomerPhone(req: Request, res: Response): Promise<void> {
    const phone = String(req.params.phone || '').trim();

    if (!phone) {
      res.status(400).json({
        status: false,
        msg: 'An error occurred',
        error: 'Invalid customer phone',
      });
      return;
    }

    try {
      const orders = await orderService.fetchPublicOrdersByCustomerPhone(phone);
      res.status(200).json({
        status: true,
        msg: 'Customer orders fetched successfully!',
        data: orders,
      });
    } catch (err) {
      res.status(500).json({
        status: false,
        msg: 'An error occurred',
        error: (err as Error).message,
      });
    }
  }

  async fetchOrders(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;

    try {
      const orders = await orderService.fetchOrdersByUserId(loggedInUserId);
      res.status(200).json({
        status: true,
        msg: 'Orders fetched successfully!',
        data: orders,
      });
    } catch (err) {
      res.status(500).json({
        status: false,
        msg: 'An error occurred',
        error: (err as Error).message,
      });
    }
  }

  async fetchOrderById(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;
    const orderId = Number(req.params.order_id);

    if (isNaN(orderId) || orderId <= 0) {
      res.status(400).json({
        status: false,
        msg: 'An error occurred',
        error: 'Invalid order_id',
      });
      return;
    }

    try {
      const order = await orderService.fetchOrderById(orderId, loggedInUserId);
      res.status(200).json({
        status: true,
        msg: 'Order fetched successfully!',
        data: order,
      });
    } catch (err) {
      const msg = (err as Error).message;
      const status = msg.includes('not found') ? 404 : 500;
      res.status(status).json({
        status: false,
        msg: status === 404 ? 'Order not found' : 'An error occurred',
        error: msg,
      });
    }
  }

  async updateOrderStatus(req: Request, res: Response): Promise<void> {
    const parseResult = updateOrderStatusSchema.safeParse(req.body);

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
    const { order_id, status } = parseResult.data;

    try {
      const updated = await orderService.updateOrderStatus(Number(order_id), loggedInUserId, status);
      res.status(200).json({
        status: true,
        msg: 'Order status updated successfully!',
        data: updated,
      });
    } catch (err) {
      const msg = (err as Error).message;
      const status = msg.includes('not found') ? 404 : 500;
      res.status(status).json({
        status: false,
        msg: 'An error occurred',
        error: msg,
      });
    }
  }

  async updateOrderDiscount(req: Request, res: Response): Promise<void> {
    const parseResult = updateOrderDiscountSchema.safeParse(req.body);

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
    const { order_id, discount } = parseResult.data;

    try {
      const updated = await orderService.updateOrderDiscount(Number(order_id), loggedInUserId, discount);
      res.status(200).json({
        status: true,
        msg: 'Order discount updated successfully!',
        data: updated,
      });
    } catch (err) {
      const msg = (err as Error).message;
      const status = msg.includes('not found') ? 404 : 500;
      res.status(status).json({
        status: false,
        msg: 'An error occurred',
        error: msg,
      });
    }
  }

  async updateOrderShipping(req: Request, res: Response): Promise<void> {
    const parseResult = updateOrderShippingSchema.safeParse(req.body);

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
    const { order_id, shipping } = parseResult.data;

    try {
      const updated = await orderService.updateOrderShipping(Number(order_id), loggedInUserId, shipping);
      res.status(200).json({
        status: true,
        msg: 'Order shipping updated successfully!',
        data: updated,
      });
    } catch (err) {
      const msg = (err as Error).message;
      const status = msg.includes('not found') ? 404 : 500;
      res.status(status).json({
        status: false,
        msg: 'An error occurred',
        error: msg,
      });
    }
  }

  async bookOrder(req: Request, res: Response): Promise<void> {
    const parseResult = bookOrderSchema.safeParse(req.body);

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
      let targetCatalogueId = parseResult.data.catalogue_id;
      if (typeof targetCatalogueId === 'string') {
        const { catalogueRepository } = require('../catalogue/catalogue.repository');
        const catalogueData = await catalogueRepository.fetchPublicCatalogueDataBySlug(targetCatalogueId);
        if (!catalogueData) {
          throw new Error('Catalogue not found');
        }
        targetCatalogueId = catalogueData.catalogueId;
      }
      
      const result = await orderService.bookOrder(targetCatalogueId as number, parseResult.data);
      res.status(200).json({
        status: true,
        msg: 'Order placed successfully!',
        data: result,
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

  async exportOrderPdf(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;
    const orderId = Number(req.params.order_id);
    const isB2b = req.query.b2b === 'true';

    if (isNaN(orderId) || orderId <= 0) {
      res.status(400).json({ status: false, msg: 'Invalid order_id' });
      return;
    }

    try {
      const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
      if (!companyId) {
        res.status(404).json({ status: false, msg: 'Company not found' });
        return;
      }

      const order = await orderService.fetchOrderById(orderId, loggedInUserId);
      const company = await companyRepository.fetchCompanyDataViaUserId(loggedInUserId);
      const companyName = company?.company_name || 'VatiKart Store';

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="order-${orderId}.pdf"`);

      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      doc.pipe(res);

      doc.fontSize(20).text(companyName, { align: 'center' });
      doc.fontSize(10).text(isB2b ? 'TAX INVOICE (B2B)' : 'ORDER RECEIPT', { align: 'center' });
      doc.moveDown();

      doc.fontSize(10).text(`Order ID: #${order.id}`);
      doc.text(`Date: ${new Date(order.createdAt).toLocaleString()}`);
      doc.text(`Customer Name: ${order.customerName}`);
      doc.text(`Customer Phone: ${order.customerPhone}`);
      doc.text(`Delivery Address: ${order.customerAddress || 'N/A'}`);
      doc.moveDown();

      doc.fontSize(11).text('Items Summary', { underline: true });
      doc.moveDown(0.5);

      const itemX = 36;
      const skuX = 250;
      const qtyX = 380;
      const priceX = 440;
      const totalX = 500;

      doc.fontSize(10);
      doc.text('Item', itemX, doc.y, { continued: true });
      doc.text('SKU', skuX, doc.y, { continued: true });
      doc.text('Qty', qtyX, doc.y, { continued: true });
      doc.text('Price', priceX, doc.y, { continued: true });
      doc.text('Total', totalX, doc.y);
      doc.text('-------------------------------------------------------------------------------------------------------');

      order.items.forEach((item) => {
        const itemY = doc.y;
        doc.text(item.title, itemX, itemY, { width: 200, lineBreak: false });
        doc.text(item.sku || '-', skuX, itemY);
        doc.text(item.qty.toString(), qtyX, itemY);
        doc.text(`₹${item.price}`, priceX, itemY);
        doc.text(`₹${item.price * item.qty}`, totalX, itemY);
        doc.moveDown();
      });

      doc.text('-------------------------------------------------------------------------------------------------------');
      doc.moveDown();
      doc.text(`Subtotal: ₹${order.subtotal}`, totalX - 80, doc.y);
      if (order.discount > 0) {
        doc.text(`Discount: -₹${order.discount}`, totalX - 80, doc.y);
      }
      if (order.shipping > 0) {
        doc.text(`Shipping: ₹${order.shipping}`, totalX - 80, doc.y);
      }

      if (isB2b) {
        const gstRate = 0.18;
        const taxableValue = order.subtotal / (1 + gstRate);
        const gstAmount = order.subtotal - taxableValue;
        doc.text(`Taxable Value: ₹${taxableValue.toFixed(2)}`, totalX - 80, doc.y);
        doc.text(`CGST (9%): ₹${(gstAmount / 2).toFixed(2)}`, totalX - 80, doc.y);
        doc.text(`SGST (9%): ₹${(gstAmount / 2).toFixed(2)}`, totalX - 80, doc.y);
      }

      doc.fontSize(12).font('Helvetica-Bold').text(`Total: ₹${order.total}`, totalX - 80, doc.y + 10);
      doc.font('Helvetica');
      doc.moveDown(3);
      doc.fontSize(10).text('Thank you for shopping with VatiKart!', { align: 'center', oblique: true });
      doc.end();
    } catch (err) {
      const msg = (err as Error).message;
      const status = msg.includes('not found') ? 404 : 500;
      res.status(status).json({
        status: false,
        msg: status === 404 ? msg : 'An error occurred generating PDF',
        error: msg,
      });
    }
  }

  async emailOrderPdf(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;
    const orderId = Number(req.params.order_id);
    const { email } = req.body as { email?: string };

    if (isNaN(orderId) || orderId <= 0) {
      res.status(400).json({ status: false, msg: 'Invalid order_id' });
      return;
    }

    if (!email) {
      res.status(400).json({ status: false, msg: 'Recipient email is required.' });
      return;
    }

    try {
      const order = await orderService.fetchOrderById(orderId, loggedInUserId);
      const company = await companyRepository.fetchCompanyDataViaUserId(loggedInUserId);
      const companyName = company?.company_name || 'VatiKart Store';

      await sendBrevoMailViaAPI({
        to: [{ email, name: order.customerName }],
        subject: `Your invoice for Order #${order.id} from ${companyName}`,
        htmlContent: `
          <h3>Hello ${order.customerName},</h3>
          <p>Please find details of your order below:</p>
          <ul>
            <li>Order Total: <strong>₹${order.total}</strong></li>
            <li>Status: ${order.status}</li>
          </ul>
          <p>Thank you for choosing ${companyName}!</p>
        `,
      });

      res.status(200).json({ status: true, msg: 'PDF receipt sent via email successfully.' });
    } catch (err) {
      const msg = (err as Error).message;
      const status = msg.includes('not found') ? 404 : 500;
      res.status(status).json({
        status: false,
        msg: status === 404 ? msg : 'An error occurred sending email',
        error: msg,
      });
    }
  }

  async trackStorefrontActivity(req: Request, res: Response): Promise<void> {
    const { buyerName, buyerPhone, activityType, details, companyId } = req.body as {
      buyerName: string;
      buyerPhone: string;
      activityType: string;
      details: string;
      companyId: number;
    };

    if (!buyerName || !buyerPhone || !activityType || !companyId) {
      res.status(400).json({ status: false, msg: 'Missing required parameters.' });
      return;
    }

    const normalizedPhone = buyerPhone.replace(/\D/g, '');

    try {
      const merchantUserId = await getUserIdByCompanyId(BigInt(companyId));
      if (!merchantUserId) {
        res.status(404).json({ status: false, msg: 'Merchant not found.' });
        return;
      }

      let title = '👀 Activity Alert';
      let body = `${buyerName} (${normalizedPhone}) is active on your store.`;

      if (activityType === 'view_product') {
        title = '👀 Product Viewed!';
        body = `${buyerName} (${normalizedPhone}) is viewing: ${details}`;
      } else if (activityType === 'add_to_cart') {
        title = '🛒 Added to Cart!';
        body = `${buyerName} (${normalizedPhone}) added to cart: ${details}`;
      }

      await sendMerchantNotification(
        merchantUserId,
        title,
        body,
        {
          type: 'BUYER_ACTIVITY',
          buyerName,
          buyerPhone: normalizedPhone,
          details: details || '',
          activityType,
        },
      );

      res.status(200).json({ status: true, msg: 'Activity tracked and notification sent.' });
    } catch (err) {
      res.status(500).json({ status: false, msg: 'An error occurred', error: (err as Error).message });
    }
  }

  async exportCatalogueBrochurePdf(req: Request, res: Response): Promise<void> {
    const loggedInUserId = res.locals.userId || 0;
    const catalogueId = Number(req.params.catalogue_id);

    if (!Number.isFinite(catalogueId) || catalogueId <= 0) {
      res.status(400).json({ status: false, msg: 'Invalid catalogue_id' });
      return;
    }

    try {
      const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
      if (!companyId) {
        res.status(404).json({ status: false, msg: 'Company profile not found.' });
        return;
      }

      const company = await companyRepository.fetchCompanyDataViaUserId(loggedInUserId);
      const catalogue = await prisma.catalogue.findFirst({
        where: {
          catalogueId: BigInt(catalogueId),
          companyId: BigInt(companyId),
          isDeleted: false,
        },
        include: {
          products: {
            where: { isDeleted: false },
            orderBy: { productId: 'desc' },
          },
        },
      });

      if (!catalogue) {
        res.status(404).json({ status: false, msg: 'Catalogue not found.' });
        return;
      }

      const companyName = company?.company_name || 'VatiKart Store';
      const subdomain = company?.subdomain || 'abc-ltd';
      const scanUrl = `https://${subdomain}.shop.vatikart.in/?catalogue=${catalogueId}`;
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(scanUrl)}`;
      const qrBuffer = await downloadBrochureImage(qrCodeUrl);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="brochure-${catalogueId}.pdf"`);

      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      doc.pipe(res);

      doc.fontSize(22).text(companyName, { align: 'center' });
      doc.fontSize(12).text(catalogue.catalogue || 'Catalogue Brochure', { align: 'center' });
      doc.moveDown(2);

      const itemsPerRow = 2;
      const cardWidth = 240;
      const cardHeight = 320;
      let startX = 36;
      let startY = doc.y;

      catalogue.products.forEach((prod, index) => {
        if (index > 0 && index % itemsPerRow === 0) {
          startX = 36;
          startY += cardHeight + 20;
          if (startY + cardHeight > doc.page.height - doc.page.margins.bottom) {
            doc.addPage();
            startY = doc.page.margins.top;
          }
        } else if (index > 0) {
          startX = doc.page.width - cardWidth - 36;
        }

        doc.rect(startX, startY, cardWidth, cardHeight).stroke('#E2E8F0');
        doc.fontSize(12).fillColor('#1E293B').text(prod.product, startX + 10, startY + 10, { width: cardWidth - 20, height: 35 });
        doc.fontSize(10).fillColor('#0D9488').text(`Price: ₹${Number(prod.price || 0)}`, startX + 10, startY + 45);
        doc.fontSize(8).fillColor('#64748B').text('Scan to order online', startX + 10, startY + 70);

        if (qrBuffer) {
          try {
            doc.image(qrBuffer, startX + 50, startY + 95, { width: 140, height: 140 });
          } catch {
            doc.fontSize(8).fillColor('#64748B').text('QR unavailable', startX + 10, startY + 95);
          }
        }
      });

      doc.end();
    } catch (err) {
      res.status(500).json({ status: false, msg: 'Failed compiling pdf brochure', error: (err as Error).message });
    }
  }
}

export const orderController = new OrderController();
