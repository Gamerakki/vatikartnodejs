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

export const bookOrderItemSchema = z.object({
  product_id: z.number({ required_error: 'product_id is required' }),
  qty: z.number().int().positive({ message: 'qty must be a positive integer' }),
  price: z.number().nonnegative({ message: 'price cannot be negative' }),
  selected_size: z.string().optional().nullable(),
  selected_color: z.string().optional().nullable(),
});

export const bookOrderSchema = z.object({
  catalogue_id: z.union([z.number(), z.string()], { required_error: 'catalogue_id is required' }),
  customer_name: z.string().min(1, { message: 'customer_name is required' }).max(255),
  customer_phone: z.string().min(1, { message: 'customer_phone is required' }).max(20),
  customer_address: z.string().min(1, { message: 'customer_address is required' }),
  items: z.array(bookOrderItemSchema).min(1, { message: 'items must contain at least 1 item' }),
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  shipping: z.number().nonnegative().default(0),
  tax: z.number().nonnegative().default(0),
  total: z.number().nonnegative(),
});

