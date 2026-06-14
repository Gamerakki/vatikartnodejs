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
  SaveSetCompositionReq,
} from './product.interface';
import { generatePresignedUploadURL, uploadToR2 } from '../../utils/s3';

export class ProductService {
  async bulkImportProducts(loggedInUserId: number, catalogueId: number, file: Express.Multer.File): Promise<any> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);

    // Fetch watermark settings once for all images in this batch
    const companyData = await companyRepository.fetchCompanyDataViaUserId(loggedInUserId);
    const watermarkEnabled = companyData?.watermark_enabled ?? false;
    const watermarkLabel = watermarkEnabled && companyData?.company_name
      ? `© ${companyData.company_name}`
      : null;
    
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

      // Check if this row has an image (1-based row and 1-based colImg)
      const imgBuffer = colImg > 0 ? cellImages.get(`${rowNumber}-${colImg}`) : null;
      
      let imagePromise: Promise<{ rowIndex: number, uploadKey: string | null }>;

      if (imgBuffer) {
        // Process with sharp and upload
        imagePromise = (async () => {
          try {
            const meta = await sharp(imgBuffer).metadata();
            const w = meta.width || 400;
            const h = meta.height || 400;

            let pipeline = sharp(imgBuffer).jpeg({ quality: 80 });

            if (watermarkLabel) {
              const fontSize = Math.max(14, Math.round(w * 0.04));
              const padding = Math.round(fontSize * 0.6);
              const textWidth = Math.round(watermarkLabel.length * fontSize * 0.62);
              const textHeight = Math.round(fontSize * 1.6);
              const svgText = Buffer.from(
                `<svg width="${textWidth + padding * 2}" height="${textHeight}">` +
                `<rect width="100%" height="100%" fill="rgba(0,0,0,0.35)" rx="4"/>` +
                `<text x="${padding}" y="${Math.round(textHeight * 0.72)}" ` +
                `font-family="Arial" font-size="${fontSize}" fill="rgba(255,255,255,0.88)">${watermarkLabel}</text>` +
                `</svg>`
              );
              pipeline = sharp(await pipeline.toBuffer())
                .composite([{
                  input: svgText,
                  gravity: 'southeast',
                  left: Math.max(0, w - textWidth - padding * 2 - 10),
                  top: Math.max(0, h - textHeight - 10),
                }]) as typeof pipeline;
            }

            const compressedBuffer = await pipeline.toBuffer();
            const fileName = `img_${Date.now()}_${rowNumber}.jpg`;
            const uploadedName = await uploadToR2('products', compressedBuffer, fileName, 'image/jpeg');
            return { rowIndex: rowNumber, uploadKey: `products/${uploadedName}` };
          } catch (err) {
            console.error(`Failed to process image at row ${rowNumber}:`, err);
            return { rowIndex: rowNumber, uploadKey: null };
          }
        })();
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

    console.log(`[BulkImport] Starting DB insertion for ${savedProducts.length} products...`);
    
    for (let i = 0; i < savedProducts.length; i++) {
      const saved = savedProducts[i];
      const p = productsToCreate[i];
      const imgPath = imageKeyMap.get(p.rowIndex);
      
      console.log(`[BulkImport] Processing product ${i + 1}/${savedProducts.length}: ID ${saved.productId} - "${p.product}"`);

      if (imgPath) {
        imageEntries.push({
          productId: Number(saved.productId),
          productImgPath: imgPath,
        });
      }

      await productRepository.saveBasicInfo({
        productId: Number(saved.productId),
        companyId: p.companyId,
        product: p.product,
        sku: p.sku || null,
        description: p.description || null,
        price: p.price || null,
        originalPrice: null,
        gstRate: null,
        priceMode: 'perPiece',
        unitType: null,
        setQuantity: null,
        meterQuantity: null,
        setName: null,
        minimumOrderQty: null,
        updatedBy: loggedInUserId,
      }, []);

      if (p.stock > 0) {
        await productRepository.saveVariantOptions(Number(saved.productId), p.companyId, [
          { optionType: 'size', label: 'Free Size', accent: null, sortOrder: 0 }
        ]);
        const data = await productRepository.fetchBasicInfo(Number(saved.productId), p.companyId);
        const opt = data?.variants.find(v => v.optionType === 'size' && v.label === 'Free Size');
        if (opt) {
          await productRepository.saveInventory(Number(saved.productId), p.companyId, [
            { sizeOptionId: Number(opt.optionId), colorOptionId: null, quantity: p.stock }
          ]);
        }
      }
    }

    if (imageEntries.length > 0) {
      console.log(`[BulkImport] Saving ${imageEntries.length} product images...`);
      await productRepository.saveBulkProductImages(imageEntries);
    }

    console.log(`[BulkImport] Successfully completed importing ${productsToCreate.length} products!`);
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

  async fetchAllProducts(
    loggedInUserId: number
  ): Promise<ProductListItemRes[]> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    return await productRepository.fetchAllProducts(companyId);
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
        originalPrice: req.original_price || null,
        gstRate: req.gst_rate || null,
        priceMode: req.price_mode || 'perPiece',
        unitType: req.unit_type || null,
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

    const options: { optionType: string; label: string; accent: string | null; isSet?: boolean; setQuantity?: number; sortOrder: number }[] = [];

    if (req.sizes) {
      req.sizes.forEach((s, index) => {
        options.push({
          optionType: 'size',
          label: s.label,
          accent: null,
          isSet: s.is_set ?? false,
          setQuantity: s.set_quantity ?? 1,
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
          isSet: c.is_set ?? false,
          setQuantity: c.set_quantity ?? 1,
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
      original_price: product.originalPrice ? Number(product.originalPrice) : null,
      gst_rate: product.gstRate ? Number(product.gstRate) : null,
      price_mode: product.priceMode,
      unit_type: product.unitType,
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
      set_composition: (product as any).setCompositions?.map((c: any) => ({
        size_label: c.sizeLabel,
        color_label: c.colorLabel,
        color_hex: c.colorHex,
        qty_in_set: c.qtyInSet,
      })) || [],
    };

    variants.forEach((v) => {
      const mapped = {
        option_id: Number(v.optionId),
        label: v.label,
        accent: v.accent,
        is_set: v.isSet,
        set_quantity: v.setQuantity,
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
      sizeOptionId: i.size_option_id ?? null,
      colorOptionId: i.color_option_id ?? null,
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

  async deleteProducts(loggedInUserId: number, productIds: number[]): Promise<void> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    await productRepository.softDeleteProducts(productIds, companyId);
  }

  async saveSetComposition(loggedInUserId: number, req: SaveSetCompositionReq): Promise<void> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    await productRepository.saveSetComposition(req.product_id, companyId, req.composition);
  }
}

export const productService = new ProductService();
