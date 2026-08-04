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
  product_id: z.coerce.number({ required_error: 'product_id is required' }),
  qty: z.coerce.number().int().positive({ message: 'qty must be a positive integer' }),
  price: z.coerce.number().nonnegative({ message: 'price cannot be negative' }),
  selected_size: z.string().optional().nullable(),
  selected_color: z.string().optional().nullable(),
});

export const bookOrderSchema = z.preprocess((raw) => {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    ...input,
    catalogue_id: input.catalogue_id ?? input.catalog_id ?? input.catalogueId,
    customer_name: input.customer_name ?? input.buyer_name ?? input.name,
    customer_phone: input.customer_phone ?? input.buyer_phone ?? input.phone,
    customer_address: input.customer_address ?? input.buyer_address ?? input.address ?? 'N/A',
    company_id: input.company_id ?? input.companyId,
    items: Array.isArray(input.items)
      ? input.items.map((item: any) => ({
          product_id: item?.product_id ?? item?.productId ?? item?.id,
          qty: item?.qty ?? item?.quantity ?? 1,
          price: item?.price ?? 0,
          selected_size: item?.selected_size ?? item?.selectedSize ?? null,
          selected_color:
            item?.selected_color
            ?? (typeof item?.selectedColor === 'object' ? item?.selectedColor?.name : item?.selectedColor)
            ?? null,
        }))
      : input.items,
  };
}, z.object({
  catalogue_id: z.union([z.number(), z.string()], { required_error: 'catalogue_id is required' }),
  customer_name: z.string().min(1, { message: 'customer_name is required' }).max(255),
  customer_phone: z.string().min(1, { message: 'customer_phone is required' }).max(20),
  customer_address: z.string().min(1, { message: 'customer_address is required' }),
  company_id: z.union([z.number(), z.string()]).optional().nullable(),
  items: z.array(bookOrderItemSchema).min(1, { message: 'items must contain at least 1 item' }),
  subtotal: z.coerce.number().nonnegative().default(0),
  discount: z.coerce.number().nonnegative().default(0),
  shipping: z.coerce.number().nonnegative().default(0),
  tax: z.coerce.number().nonnegative().default(0),
  total: z.coerce.number().nonnegative().default(0),
  reseller_markup: z.coerce.number().nonnegative().optional(),
}));
