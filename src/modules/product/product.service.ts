import crypto from 'crypto';
import path from 'path';
import { productRepository } from './product.repository';
import { companyRepository } from '../company/company.repository';
import {
  ProductFileUploadRequest,
  R2UploadURL,
  CreateProductBatchReq,
  SaveProductRes,
  ProductListItemRes,
  SaveBasicInfoReq,
  SaveVariantOptionsReq,
  BasicInfoRes,
  SaveInventoryReq,
  ProductInventoryRes,
  ShopInventoryItemRes,
  ShopInventoryStatsRes,
} from './product.interface';
import { generatePresignedUploadURL } from '../../utils/s3';

export class ProductService {
  async uploadProductUrlGen(req: ProductFileUploadRequest): Promise<R2UploadURL[]> {
    if (req.files.length === 0 || req.files.length > 20) {
      throw new Error('Upload file count should be less than 20 per upload.');
    }

    const result: R2UploadURL[] = [];

    for (const file of req.files) {
      const ext = path.extname(file.name).toLowerCase();
      const timestamp = Math.floor(Date.now() / 1000);
      const uuid = crypto.randomUUID();
      const key = `products/${timestamp}-${uuid}${ext}`;

      const url = await generatePresignedUploadURL(key, file.type);

      result.push({ url, key });
    }

    return result;
  }

  async createProduct(
    loggedInUserId: number,
    req: CreateProductBatchReq
  ): Promise<SaveProductRes[]> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);

    const productsData = req.products.map((p) => ({
      companyId,
      catalogueId: req.catalogue_id,
      product: p.product,
      addedBy: loggedInUserId,
    }));

    const savedProducts = await productRepository.createProducts(productsData);

    const imageEntries = savedProducts.map((saved, index) => ({
      productId: Number(saved.productId),
      productImgPath: req.products[index].img_path,
    }));

    await productRepository.saveBulkProductImages(imageEntries);

    return savedProducts.map((saved, index) => ({
      product_id: Number(saved.productId),
      product: saved.product,
      img_path: req.products[index].img_path,
      slug: saved.slug,
    }));
  }

  async fetchProductsByCatalogue(
    loggedInUserId: number,
    catalogueId: number
  ): Promise<ProductListItemRes[]> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    return await productRepository.fetchProductsByCatalogue(catalogueId, companyId);
  }

  async saveBasicInfo(loggedInUserId: number, req: SaveBasicInfoReq): Promise<void> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);

    const slabs = (req.bulk_discounts || []).map((s, index) => ({
      minQty: s.min_qty,
      maxQty: s.max_qty || null,
      discountedPrice: s.discounted_price || null,
      discountPercent: s.discount_percent || null,
      sortOrder: s.sort_order ?? index,
    }));

    await productRepository.saveBasicInfo(
      {
        productId: req.product_id,
        companyId,
        product: req.title,
        sku: req.sku || null,
        description: req.description || null,
        price: req.price || null,
        priceMode: req.price_mode || 'perPiece',
        setQuantity: req.set_quantity || null,
        meterQuantity: req.meter_quantity || null,
        setName: req.set_name || null,
        minimumOrderQty: req.minimum_order_qty || null,
        updatedBy: loggedInUserId,
      },
      slabs
    );
  }

  async saveVariantOptions(loggedInUserId: number, req: SaveVariantOptionsReq): Promise<void> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);

    const options: { optionType: 'size' | 'color'; label: string; accent: string | null; sortOrder: number }[] = [];

    if (req.sizes) {
      req.sizes.forEach((s, index) => {
        options.push({
          optionType: 'size',
          label: s.label,
          accent: null,
          sortOrder: s.sort_order ?? index,
        });
      });
    }

    if (req.colors) {
      req.colors.forEach((c, index) => {
        options.push({
          optionType: 'color',
          label: c.label,
          accent: c.accent || null,
          sortOrder: c.sort_order ?? index,
        });
      });
    }

    await productRepository.saveVariantOptions(req.product_id, companyId, options);
  }

  async fetchBasicInfo(loggedInUserId: number, productId: number): Promise<BasicInfoRes> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    const data = await productRepository.fetchBasicInfo(productId, companyId);

    if (!data) {
      throw new Error('product not found');
    }

    const { product, slabs, variants } = data;

    const res: BasicInfoRes = {
      product_id: Number(product.productId),
      title: product.product,
      sku: product.sku,
      price: product.price ? Number(product.price) : null,
      price_mode: product.priceMode,
      set_quantity: product.setQuantity ? Number(product.setQuantity) : null,
      meter_quantity: product.meterQuantity ? Number(product.meterQuantity) : null,
      set_name: product.setName,
      minimum_order_qty: product.minimumOrderQty,
      description: product.description,
      bulk_discounts: slabs.map((s) => ({
        slab_id: Number(s.slabId),
        min_qty: s.minQty,
        max_qty: s.maxQty,
        discounted_price: s.discountedPrice ? Number(s.discountedPrice) : null,
        discount_percent: s.discountPercent ? Number(s.discountPercent) : null,
        sort_order: s.sortOrder,
      })),
      variants: {
        sizes: [],
        colors: [],
      },
    };

    variants.forEach((v) => {
      const mapped = {
        option_id: Number(v.optionId),
        label: v.label,
        accent: v.accent,
        sort_order: v.sortOrder,
      };

      if (v.optionType === 'color') {
        res.variants.colors.push(mapped);
      } else {
        res.variants.sizes.push(mapped);
      }
    });

    return res;
  }

  async saveInventory(loggedInUserId: number, req: SaveInventoryReq): Promise<void> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    const items = (req.items || []).map((i) => ({
      optionId: i.option_id,
      quantity: i.quantity,
    }));

    await productRepository.saveInventory(req.product_id, companyId, items);
  }

  async fetchInventory(loggedInUserId: number, productId: number): Promise<ProductInventoryRes> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    const items = await productRepository.fetchInventory(productId, companyId);

    const totalStock = items.reduce((acc, item) => acc + item.quantity, 0);

    return {
      product_id: productId,
      total_stock: totalStock,
      size_count: items.length,
      items,
    };
  }

  async fetchInventoryList(loggedInUserId: number): Promise<ShopInventoryItemRes[]> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    return await productRepository.fetchInventoryList(companyId);
  }

  async fetchInventoryStats(loggedInUserId: number): Promise<ShopInventoryStatsRes> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    return await productRepository.fetchInventoryStats(companyId);
  }

  async restockInventory(loggedInUserId: number, productId: number, amount: number): Promise<boolean> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    return await productRepository.restockInventory(productId, companyId, amount);
  }
}

export const productService = new ProductService();
