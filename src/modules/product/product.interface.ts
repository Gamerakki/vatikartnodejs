export interface ProductFileRequest {
  name: string; // matches json key "name"
  type: string; // matches json key "type"
}

export interface ProductFileUploadRequest {
  files: ProductFileRequest[];
}

export interface R2UploadURL {
  url: string;
  key: string;
}

export interface CreateProduct {
  product: string;
  img_paths: string[];
}

export interface CreateProductBatchReq {
  catalogue_id: number;
  products: CreateProduct[];
}

export interface SaveProductRes {
  product_id: number;
  product: string;
  img_paths: string[];
  slug: string | null;
}

export interface ProductListItemRes {
  product_id: number;
  product: string;
  sku: string | null;
  price: number | null;
  original_price: number | null;
  gst_rate: number | null;
  unit_type: string | null;
  img_path: string | null;
  images?: string[];
  slug: string | null;
  total_stock: number;
  size_count: number;
  description?: string | null;
  sizes?: Array<{ option_id: number; label: string; accent?: string | null; is_set: boolean; set_quantity: number; sort_order: number }>;
  colors?: Array<{ option_id: number; name: string; hex: string | null; is_set: boolean; set_quantity: number; sort_order: number }>;
  inventory_items?: InventoryItemRes[];
  bulk_discounts?: BulkDiscountSlabRes[];
  catalogue_id?: number;
  price_mode?: string | null;
  set_quantity?: number | null;
  set_name?: string | null;
  minimum_order_qty?: number | null;
}

export interface BulkDiscountSlabReq {
  min_qty: number;
  max_qty?: number | null;
  discounted_price?: number | null;
  discount_percent?: number | null;
  sort_order: number;
}

export interface SaveBasicInfoReq {
  product_id: number;
  title: string;
  sku?: string | null;
  price?: number | null;
  original_price?: number | null;
  gst_rate?: number | null;
  price_mode?: string | null;
  unit_type?: string | null;
  set_quantity?: number | null;
  meter_quantity?: number | null;
  set_name?: string | null;
  minimum_order_qty?: number | null;
  description?: string | null;
  bulk_discounts?: BulkDiscountSlabReq[] | null;
}

export interface VariantOptionReq {
  label: string;
  accent?: string | null;
  is_set?: boolean;
  set_quantity?: number;
  sort_order: number;
}

export interface SaveVariantOptionsReq {
  product_id: number;
  sizes?: VariantOptionReq[];
  colors?: VariantOptionReq[];
  custom_options?: {
    type: string;
    options: VariantOptionReq[];
  }[];
}

export interface InventoryItemReq {
  size_option_id?: number | null;
  color_option_id?: number | null;
  quantity: number;
}

export interface SaveInventoryReq {
  product_id: number;
  items?: InventoryItemReq[];
}

export interface BulkDiscountSlabRes {
  slab_id: number;
  min_qty: number;
  max_qty: number | null;
  discounted_price: number | null;
  discount_percent: number | null;
  sort_order: number;
}

export interface VariantOptionRes {
  option_id: number;
  label: string;
  accent: string | null;
  is_set: boolean;
  set_quantity: number;
  sort_order: number;
}

export interface ProductVariantsRes {
  sizes: VariantOptionRes[];
  colors: VariantOptionRes[];
  custom_options: {
    type: string;
    options: VariantOptionRes[];
  }[];
}

export interface BasicInfoRes {
  product_id: number;
  title: string;
  sku: string | null;
  price: number | null;
  original_price: number | null;
  gst_rate: number | null;
  price_mode: string | null;
  unit_type: string | null;
  set_quantity: number | null;
  meter_quantity: number | null;
  set_name: string | null;
  minimum_order_qty: number | null;
  description: string | null;
  bulk_discounts: BulkDiscountSlabRes[];
  variants: ProductVariantsRes;
}

export interface InventoryItemRes {
  size_option_id: number | null;
  color_option_id: number | null;
  size_label: string | null;
  color_label: string | null;
  quantity: number;
}

export interface ProductInventoryRes {
  product_id: number;
  total_stock: number;
  size_count: number;
  items: InventoryItemRes[];
}

export interface ShopInventoryItemRes {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  reorderLevel: number;
  maxStock: number;
  lastRestocked: string;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

export interface ShopInventoryStatsRes {
  totalItems: number;
  totalQuantity: number;
  lowStockItems: number;
  outOfStockItems: number;
}


