import { z } from 'zod';

const orderIdRegex = /^\d+$/;

export const updateOrderStatusSchema = z.object({
  order_id: z.string().regex(orderIdRegex, { message: 'order_id must be a valid number string' }),
  status: z.enum(['UNCONFIRMED', 'CONFIRMED', 'ACCEPTED', 'COMPLETED', 'REJECTED'], {
    errorMap: () => ({ message: 'Invalid order status' }),
  }),
});

export const updateOrderDiscountSchema = z.object({
  order_id: z.string().regex(orderIdRegex, { message: 'order_id must be a valid number string' }),
  discount: z.number().nonnegative({ message: 'Discount cannot be negative' }),
});

export const updateOrderShippingSchema = z.object({
  order_id: z.string().regex(orderIdRegex, { message: 'order_id must be a valid number string' }),
  shipping: z.number().nonnegative({ message: 'Shipping cannot be negative' }),
});
