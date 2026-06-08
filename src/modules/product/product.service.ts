import crypto from 'crypto';
import path from 'path';
import { productRepository } from './product.repository';
import { companyRepository } from '../company/company.repository';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
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
import { generatePresignedUploadURL, uploadToR2 } from '../../utils/s3';

export class ProductService {
  async bulkImportProducts(loggedInUserId: number, catalogueId: number, file: Express.Multer.File): Promise<any> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as any);
    
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('No worksheets found in the Excel file.');
    }

    // Map embedded images to cells
    const cellImages = new Map<string, any>();
    for (const image of worksheet.getImages()) {
      const imgId = image.imageId;
      const imgData = workbook.model.media.find((m: any) => m.index === imgId);
      if (imgData && image.range && image.range.tl) {
        // e.g., row: 1 is 2nd row (0-indexed in exceljs range)
        const row = Math.floor(image.range.tl.nativeRow) + 1;
        const col = Math.floor(image.range.tl.nativeCol) + 1;
        cellImages.set(`${row}-${col}`, imgData.buffer);
      }
    }

    // Find headers row (assume row 1)
    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber] = cell.text.trim();
    });

    const colImg = headers.findIndex(h => h === 'Product Image' || h === 'Image');
    const colName = headers.findIndex(h => h === 'Product Name' || h === 'Title');
    const colPrice = headers.findIndex(h => h === 'Product Price' || h === 'Price');
    const colSku = headers.findIndex(h => h === 'Sku' || h === 'SKU');
    const colStock = headers.findIndex(h => h === 'Available quantity' || h === 'Stock');
    const colDesc = headers.findIndex(h => h === 'Product Description' || h === 'Description');

    const productsToCreate: any[] = [];
    const imageUploadPromises: Promise<{ rowIndex: number, uploadKey: string | null }>[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const name = colName > 0 ? row.getCell(colName).text : '';
      if (!name) return; // Skip empty rows

      const priceStr = colPrice > 0 ? row.getCell(colPrice).text : '';
      const price = parseFloat(priceStr) || null;
      
      const sku = colSku > 0 ? row.getCell(colSku).text : null;
      const desc = colDesc > 0 ? row.getCell(colDesc).text : null;
      const stockStr = colStock > 0 ? row.getCell(colStock).text : '';
      const stock = parseInt(stockStr, 10) || 0;

      // Check if this row has an image
      const imgBuffer = colImg > 0 ? cellImages.get(`${rowNumber - 1}-${colImg - 1}`) : null;
      
      let imagePromise: Promise<{ rowIndex: number, uploadKey: string | null }>;

      if (imgBuffer) {
        // Process with sharp and upload
        imagePromise = sharp(imgBuffer)
          .jpeg({ quality: 80 })
          .toBuffer()
          .then(async (compressedBuffer) => {
            const fileName = `img_${Date.now()}_${rowNumber}.jpg`;
            const uploadedName = await uploadToR2('products', compressedBuffer, fileName, 'image/jpeg');
            return { rowIndex: rowNumber, uploadKey: `products/${uploadedName}` };
          })
          .catch(err => {
            console.error(`Failed to process image at row ${rowNumber}:`, err);
            return { rowIndex: rowNumber, uploadKey: null };
          });
      } else {
        imagePromise = Promise.resolve({ rowIndex: rowNumber, uploadKey: null });
      }

      imageUploadPromises.push(imagePromise);

      productsToCreate.push({
        rowIndex: rowNumber,
        companyId,
        catalogueId,
        product: name,
        price,
        sku,
        description: desc,
        stock,
        addedBy: loggedInUserId,
      });
    });

    const uploadResults = await Promise.all(imageUploadPromises);
    const imageKeyMap = new Map<number, string>();
    for (const res of uploadResults) {
      if (res.uploadKey) {
        imageKeyMap.set(res.rowIndex, res.uploadKey);
      }
    }

    // Now insert to DB
    const savedProducts = await productRepository.createProducts(productsToCreate.map(p => ({
      companyId: p.companyId,
      catalogueId: p.catalogueId,
      product: p.product,
      addedBy: p.addedBy,
    })));

    const imageEntries: { productId: number; productImgPath: string }[] = [];
    const basicInfoPromises: Promise<void>[] = [];
    const inventoryPromises: Promise<void>[] = [];

    savedProducts.forEach((saved, index) => {
      const p = productsToCreate[index];
      const imgPath = imageKeyMap.get(p.rowIndex);
      
      if (imgPath) {
        imageEntries.push({
          productId: Number(saved.productId),
          productImgPath: imgPath,
        });
      }

      basicInfoPromises.push(productRepository.saveBasicInfo({
        productId: Number(saved.productId),
        companyId: p.companyId,
        product: p.product,
        sku: p.sku || null,
        description: p.description || null,
        price: p.price || null,
        priceMode: 'perPiece',
        setQuantity: null,
        meterQuantity: null,
        setName: null,
        minimumOrderQty: null,
        updatedBy: loggedInUserId,
      }, []));

      if (p.stock > 0) {
        inventoryPromises.push(
          productRepository.saveVariantOptions(Number(saved.productId), p.companyId, [
            { optionType: 'size', label: 'Free Size', accent: null, sortOrder: 0 }
          ]).then(async () => {
             const data = await productRepository.fetchBasicInfo(Number(saved.productId), p.companyId);
             const opt = data?.variants.find(v => v.optionType === 'size' && v.label === 'Free Size');
             if (opt) {
               await productRepository.saveInventory(Number(saved.productId), p.companyId, [
                 { optionId: Number(opt.optionId), quantity: p.stock }
               ]);
             }
          })
        );
      }
    });

    if (imageEntries.length > 0) {
      await productRepository.saveBulkProductImages(imageEntries);
    }
    
    await Promise.all(basicInfoPromises);
    await Promise.all(inventoryPromises);

    return { imported_count: productsToCreate.length };
  }

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

    const imageEntries: { productId: number; productImgPath: string }[] = [];
    savedProducts.forEach((saved, index) => {
      const paths = req.products[index].img_paths || [];
      paths.forEach((path) => {
        imageEntries.push({
          productId: Number(saved.productId),
          productImgPath: path,
        });
      });
    });

    await productRepository.saveBulkProductImages(imageEntries);

    return savedProducts.map((saved, index) => ({
      product_id: Number(saved.productId),
      product: saved.product,
      img_paths: req.products[index].img_paths,
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

    const options: { optionType: string; label: string; accent: string | null; sortOrder: number }[] = [];

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

    if (req.custom_options) {
      req.custom_options.forEach((co) => {
        co.options.forEach((o, index) => {
          options.push({
            optionType: co.type,
            label: o.label,
            accent: o.accent || null,
            sortOrder: o.sort_order ?? index,
          });
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
        custom_options: [],
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
      } else if (v.optionType === 'size') {
        res.variants.sizes.push(mapped);
      } else {
        let group = res.variants.custom_options.find(g => g.type === v.optionType);
        if (!group) {
          group = { type: v.optionType, options: [] };
          res.variants.custom_options.push(group);
        }
        group.options.push(mapped);
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
