import { z } from 'zod';

const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

export const productFileSchema = z.object({
  name: z.string().min(1, { message: 'The field name is required' }),
  type: z.string().min(1, { message: 'The field type is required' }),
});

export const productFileUploadSchema = z.object({
  files: z.array(productFileSchema).min(1, { message: 'The field files must have at least 1 item' }),
});

export const createProductSchema = z.object({
  product: z.string().min(1, { message: 'The field product is required' }),
  img_path: z.string().min(1, { message: 'The field img_path is required' }),
});

export const createProductBatchSchema = z.object({
  catalogue_id: z.number({ required_error: 'The field catalogue_id is required' }),
  products: z.array(createProductSchema).min(1, { message: 'The field products must have at least 1 item' }),
});

export const bulkDiscountSlabSchema = z.object({
  min_qty: z.number().min(1, { message: 'min_qty must be at least 1' }),
  max_qty: z.number().min(1, { message: 'max_qty must be at least 1' }).nullable().optional(),
  discounted_price: z.number().min(0, { message: 'discounted_price must be at least 0' }).nullable().optional(),
  discount_percent: z.number().min(0).max(100).nullable().optional(),
  sort_order: z.number().default(0),
});

export const saveBasicInfoSchema = z.object({
  product_id: z.number({ required_error: 'The field product_id is required' }),
  title: z.string().min(1).max(150, { message: 'The field title must have at most 150 characters' }),
  sku: z.string().max(50, { message: 'The field sku must have at most 50 characters' }).nullable().optional(),
  price: z.number().min(0).nullable().optional(),
  price_mode: z.enum(['perPiece', 'perSet', 'perMeter']).nullable().optional(),
  set_quantity: z.number().min(0).nullable().optional(),
  meter_quantity: z.number().min(0).nullable().optional(),
  set_name: z.string().max(100).nullable().optional(),
  minimum_order_qty: z.number().min(1).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  bulk_discounts: z.array(bulkDiscountSlabSchema).nullable().optional(),
});

export const variantOptionSchema = z.object({
  label: z.string().min(1).max(100),
  accent: z.string().refine((val) => !val || hexColorRegex.test(val), {
    message: 'accent must be a valid hex color starting with #',
  }).nullable().optional(),
  sort_order: z.number().default(0),
});

export const saveVariantOptionsSchema = z.object({
  product_id: z.number({ required_error: 'The field product_id is required' }),
  sizes: z.array(variantOptionSchema).optional(),
  colors: z.array(variantOptionSchema).optional(),
});

export const inventoryItemSchema = z.object({
  option_id: z.number().gt(0),
  quantity: z.number().min(0),
});

export const saveInventorySchema = z.object({
  product_id: z.number({ required_error: 'The field product_id is required' }),
  items: z.array(inventoryItemSchema).optional(),
});
