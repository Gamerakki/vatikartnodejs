import { Request, Response } from 'express';
import { orderService } from './order.service';
import {
  updateOrderStatusSchema,
  updateOrderDiscountSchema,
  updateOrderShippingSchema,
  bookOrderSchema,
} from './order.validation';

export class OrderController {
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
}

export const orderController = new OrderController();
