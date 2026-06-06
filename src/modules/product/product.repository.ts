import { prisma } from '../../config/database';
import { ProductListItemRes } from './product.interface';

export class ProductRepository {
  async createProducts(
    products: { companyId: number; catalogueId: number; product: string; addedBy: number }[]
  ) {
    // We run in transaction to fetch all created items with their IDs
    return await prisma.$transaction(
      products.map((p) =>
        prisma.product.create({
          data: {
            product: p.product,
            companyId: BigInt(p.companyId),
            catalogueId: BigInt(p.catalogueId),
            addedBy: BigInt(p.addedBy),
          },
        })
      )
    );
  }

  async saveBulkProductImages(
    images: { productId: number; productImgPath: string }[]
  ) {
    await prisma.productImage.createMany({
      data: images.map((img) => ({
        productId: BigInt(img.productId),
        productImgPath: img.productImgPath,
      })),
    });
  }

  async fetchProductsByCatalogue(
    catalogueId: number,
    companyId: number
  ): Promise<ProductListItemRes[]> {
    const rawProducts = await prisma.$queryRaw<any[]>`
      SELECT 
        p.product_id,
        p.product,
        p.sku,
        p.price,
        p.slug,
        pi.product_img_path,
        COALESCE(inv.total_stock, 0)::int as total_stock,
        COALESCE(sz.size_count, 0)::int as size_count
      FROM products p
      LEFT JOIN LATERAL (
        SELECT product_img_path
        FROM product_images
        WHERE product_id = p.product_id
        ORDER BY product_img_id ASC
        LIMIT 1
      ) pi ON true
      LEFT JOIN (
        SELECT product_id, COUNT(*) AS size_count
        FROM product_variant_options
        WHERE option_type = 'size'
        GROUP BY product_id
      ) sz ON sz.product_id = p.product_id
      LEFT JOIN (
        SELECT pvi.product_id, SUM(pvi.quantity) AS total_stock
        FROM product_variant_inventories pvi
        JOIN product_variant_options pvo ON pvo.option_id = pvi.option_id AND pvo.option_type = 'size'
        GROUP BY pvi.product_id
      ) inv ON inv.product_id = p.product_id
      WHERE p.catalogue_id = ${BigInt(catalogueId)} 
        AND p.company_id = ${BigInt(companyId)} 
        AND p.is_deleted = false
      ORDER BY p.product_id DESC
    `;

    return rawProducts.map((row) => ({
      product_id: Number(row.product_id),
      product: row.product,
      sku: row.sku,
      price: row.price ? Number(row.price) : null,
      img_path: row.product_img_path || null,
      slug: row.slug,
      total_stock: Number(row.total_stock),
      size_count: Number(row.size_count),
    }));
  }

  async saveBasicInfo(
    product: {
      productId: number;
      companyId: number;
      product: string;
      sku: string | null;
      description: string | null;
      price: number | null;
      priceMode: string | null;
      setQuantity: number | null;
      meterQuantity: number | null;
      setName: string | null;
      minimumOrderQty: number | null;
      updatedBy: number;
    },
    slabs: {
      minQty: number;
      maxQty: number | null;
      discountedPrice: number | null;
      discountPercent: number | null;
      sortOrder: number;
    }[]
  ) {
    const productIdBig = BigInt(product.productId);
    const companyIdBig = BigInt(product.companyId);

    return await prisma.$transaction(async (tx) => {
      // Update basic fields
      await tx.product.update({
        where: {
          productId: productIdBig,
          companyId: companyIdBig,
        },
        data: {
          product: product.product,
          sku: product.sku,
          description: product.description,
          price: product.price,
          priceMode: product.priceMode,
          setQuantity: product.setQuantity,
          meterQuantity: product.meterQuantity,
          setName: product.setName,
          minimumOrderQty: product.minimumOrderQty,
          updatedBy: BigInt(product.updatedBy),
          updatedDate: new Date(),
        },
      });

      // Clear old discount slabs
      await tx.productBulkDiscountSlab.deleteMany({
        where: { productId: productIdBig },
      });

      // Write new discount slabs
      if (slabs.length > 0) {
        await tx.productBulkDiscountSlab.createMany({
          data: slabs.map((s) => ({
            productId: productIdBig,
            minQty: s.minQty,
            maxQty: s.maxQty,
            discountedPrice: s.discountedPrice,
            discountPercent: s.discountPercent,
            sortOrder: s.sortOrder,
          })),
        });
      }
    });
  }

  async saveVariantOptions(
    productId: number,
    companyId: number,
    options: { optionType: 'size' | 'color'; label: string; accent: string | null; sortOrder: number }[]
  ) {
    const productIdBig = BigInt(productId);
    const companyIdBig = BigInt(companyId);

    return await prisma.$transaction(async (tx) => {
      const count = await tx.product.count({
        where: { productId: productIdBig, companyId: companyIdBig, isDeleted: false },
      });

      if (count === 0) {
        throw new Error('product not found');
      }

      // Clear existing options
      await tx.productVariantOption.deleteMany({
        where: { productId: productIdBig },
      });

      // Create new options
      if (options.length > 0) {
        await tx.productVariantOption.createMany({
          data: options.map((opt) => ({
            productId: productIdBig,
            optionType: opt.optionType,
            label: opt.label,
            accent: opt.accent,
            sortOrder: opt.sortOrder,
          })),
        });
      }
    });
  }

  async fetchBasicInfo(productId: number, companyId: number) {
    const product = await prisma.product.findFirst({
      where: {
        productId: BigInt(productId),
        companyId: BigInt(companyId),
        isDeleted: false,
      },
    });

    if (!product) return null;

    const slabs = await prisma.productBulkDiscountSlab.findMany({
      where: { productId: BigInt(productId) },
      orderBy: [{ sortOrder: 'asc' }, { minQty: 'asc' }],
    });

    const variants = await prisma.productVariantOption.findMany({
      where: { productId: BigInt(productId) },
      orderBy: [{ optionType: 'asc' }, { sortOrder: 'asc' }, { optionId: 'asc' }],
    });

    return { product, slabs, variants };
  }

  async saveInventory(
    productId: number,
    companyId: number,
    items: { optionId: number; quantity: number }[]
  ) {
    const productIdBig = BigInt(productId);
    const companyIdBig = BigInt(companyId);

    return await prisma.$transaction(async (tx) => {
      const count = await tx.product.count({
        where: { productId: productIdBig, companyId: companyIdBig, isDeleted: false },
      });

      if (count === 0) {
        throw new Error('product not found');
      }

      // Clear existing inventories
      await tx.productVariantInventory.deleteMany({
        where: { productId: productIdBig },
      });

      if (items.length === 0) {
        return;
      }

      const optionIDs = items.map((i) => BigInt(i.optionId));

      // Validate option types (must exist and be type "size")
      const validCount = await tx.productVariantOption.count({
        where: {
          productId: productIdBig,
          optionType: 'size',
          optionId: { in: optionIDs },
        },
      });

      if (validCount !== items.length) {
        throw new Error('invalid size option');
      }

      // Save inventories
      await tx.productVariantInventory.createMany({
        data: items.map((item) => ({
          productId: productIdBig,
          optionId: BigInt(item.optionId),
          quantity: item.quantity,
        })),
      });
    });
  }

  async fetchInventory(productId: number, companyId: number) {
    const count = await prisma.product.count({
      where: { productId: BigInt(productId), companyId: BigInt(companyId), isDeleted: false },
    });

    if (count === 0) {
      throw new Error('product not found');
    }

    const rows = await prisma.$queryRaw<any[]>`
      SELECT 
        pvo.option_id, 
        pvo.label, 
        COALESCE(pvi.quantity, 0)::int as quantity
      FROM product_variant_options pvo
      LEFT JOIN product_variant_inventories pvi ON pvi.option_id = pvo.option_id AND pvi.product_id = pvo.product_id
      WHERE pvo.product_id = ${BigInt(productId)} AND pvo.option_type = 'size'
      ORDER BY pvo.sort_order ASC, pvo.option_id ASC
    `;

    return rows.map((r) => ({
      option_id: Number(r.option_id),
      label: r.label,
      quantity: Number(r.quantity),
    }));
  }
}

export const productRepository = new ProductRepository();
