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
    const products = await prisma.product.findMany({
      where: {
        catalogueId: BigInt(catalogueId),
        companyId: BigInt(companyId),
        isDeleted: false,
      },
      include: {
        images: {
          orderBy: { productImgId: 'asc' },
        },
        variantOptions: {
          include: {
            inventories: true,
          },
          orderBy: [{ sortOrder: 'asc' }, { optionId: 'asc' }],
        },
        bulkDiscounts: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { productId: 'desc' },
    });

    return products.map((p) => {
      const sizesOptions = p.variantOptions.filter((o) => o.optionType === 'size');
      const colorsOptions = p.variantOptions.filter((o) => o.optionType === 'color');

      let totalStock = 0;
      sizesOptions.forEach((o) => {
        const qty = o.inventories.reduce((sum, inv) => sum + inv.quantity, 0);
        totalStock += qty;
      });

      return {
        product_id: Number(p.productId),
        product: p.product,
        sku: p.sku,
        price: p.price ? Number(p.price) : null,
        img_path: p.images[0]?.productImgPath || null,
        images: p.images.map((img: any) => img.productImgPath),
        slug: p.slug,
        total_stock: totalStock,
        size_count: sizesOptions.length,
        description: p.description,
        sizes: sizesOptions.map((o) => o.label),
        colors: colorsOptions.map((o) => ({
          name: o.label,
          hex: o.accent,
        })),
        bulk_discounts: p.bulkDiscounts.map((d) => ({
          slab_id: Number(d.slabId),
          min_qty: d.minQty,
          max_qty: d.maxQty,
          discounted_price: d.discountedPrice ? Number(d.discountedPrice) : null,
          discount_percent: d.discountPercent ? Number(d.discountPercent) : null,
          sort_order: d.sortOrder,
        })),
        catalogue_id: Number(p.catalogueId),
      };
    });
  }

  async fetchAllProducts(
    companyId: number
  ): Promise<ProductListItemRes[]> {
    const products = await prisma.product.findMany({
      where: {
        companyId: BigInt(companyId),
        isDeleted: false,
      },
      include: {
        images: {
          orderBy: { productImgId: 'asc' },
        },
        variantOptions: {
          include: {
            inventories: true,
          },
          orderBy: [{ sortOrder: 'asc' }, { optionId: 'asc' }],
        },
        bulkDiscounts: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { productId: 'desc' },
    });

    return products.map((p) => {
      const sizesOptions = p.variantOptions.filter((o) => o.optionType === 'size');
      const colorsOptions = p.variantOptions.filter((o) => o.optionType === 'color');

      let totalStock = 0;
      sizesOptions.forEach((o) => {
        const qty = o.inventories.reduce((sum, inv) => sum + inv.quantity, 0);
        totalStock += qty;
      });

      return {
        product_id: Number(p.productId),
        product: p.product,
        sku: p.sku,
        price: p.price ? Number(p.price) : null,
        img_path: p.images[0]?.productImgPath || null,
        images: p.images.map((img: any) => img.productImgPath),
        slug: p.slug,
        total_stock: totalStock,
        size_count: sizesOptions.length,
        description: p.description,
        sizes: sizesOptions.map((o) => o.label),
        colors: colorsOptions.map((o) => ({
          name: o.label,
          hex: o.accent,
        })),
        bulk_discounts: p.bulkDiscounts.map((d) => ({
          slab_id: Number(d.slabId),
          min_qty: d.minQty,
          max_qty: d.maxQty,
          discounted_price: d.discountedPrice ? Number(d.discountedPrice) : null,
          discount_percent: d.discountPercent ? Number(d.discountPercent) : null,
          sort_order: d.sortOrder,
        })),
        catalogue_id: Number(p.catalogueId),
      };
    });
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
    options: { optionType: string; label: string; accent: string | null; sortOrder: number }[]
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

  async fetchInventoryList(companyId: number): Promise<any[]> {
    const products = await prisma.product.findMany({
      where: {
        companyId: BigInt(companyId),
        isDeleted: false,
      },
      include: {
        variantOptions: {
          where: { optionType: 'size' },
          include: {
            inventories: true,
          },
          orderBy: [{ sortOrder: 'asc' }, { optionId: 'asc' }],
        },
      },
      orderBy: { product: 'asc' },
    });

    return products.map((p) => {
      let totalStock = 0;
      p.variantOptions.forEach((o) => {
        totalStock += o.inventories.reduce((sum, inv) => sum + inv.quantity, 0);
      });

      let status: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK' = 'IN_STOCK';
      if (totalStock === 0) {
        status = 'OUT_OF_STOCK';
      } else if (totalStock <= p.reorderLevel) {
        status = 'LOW_STOCK';
      }

      return {
        id: p.productId.toString(),
        productId: p.productId.toString(),
        productName: p.product,
        sku: p.sku || '',
        quantity: totalStock,
        reorderLevel: p.reorderLevel,
        maxStock: p.maxStock,
        lastRestocked: p.updatedDate ? p.updatedDate.toISOString() : p.addedDate.toISOString(),
        status,
      };
    });
  }

  async fetchInventoryStats(companyId: number): Promise<any> {
    const products = await prisma.product.findMany({
      where: {
        companyId: BigInt(companyId),
        isDeleted: false,
      },
      include: {
        variantOptions: {
          where: { optionType: 'size' },
          include: {
            inventories: true,
          },
        },
      },
    });

    let totalItems = 0;
    let totalQuantity = 0;
    let lowStockItems = 0;
    let outOfStockItems = 0;

    products.forEach((p) => {
      totalItems += 1;
      let totalStock = 0;
      p.variantOptions.forEach((o) => {
        totalStock += o.inventories.reduce((sum, inv) => sum + inv.quantity, 0);
      });

      totalQuantity += totalStock;

      if (totalStock === 0) {
        outOfStockItems += 1;
      } else if (totalStock <= p.reorderLevel) {
        lowStockItems += 1;
      }
    });

    return {
      totalItems,
      totalQuantity,
      lowStockItems,
      outOfStockItems,
    };
  }

  async restockInventory(productId: number, companyId: number, amount: number): Promise<boolean> {
    const prodBig = BigInt(productId);
    const compBig = BigInt(companyId);

    // Verify product exists and belongs to company
    const product = await prisma.product.findFirst({
      where: { productId: prodBig, companyId: compBig, isDeleted: false },
      include: {
        variantOptions: {
          where: { optionType: 'size' },
          orderBy: [{ sortOrder: 'asc' }, { optionId: 'asc' }],
        },
      },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    return await prisma.$transaction(async (tx) => {
      let sizeOptions = product.variantOptions;

      // Fallback: If no size variants exist, create a default "One Size" variant option
      if (sizeOptions.length === 0) {
        const newOption = await tx.productVariantOption.create({
          data: {
            productId: prodBig,
            optionType: 'size',
            label: 'One Size',
            sortOrder: 0,
          },
        });
        sizeOptions = [newOption];
      }

      const N = sizeOptions.length;
      const baseQty = Math.floor(amount / N);
      const remainder = amount % N;

      // Update/Upsert stock count for each size option
      for (let i = 0; i < N; i += 1) {
        const option = sizeOptions[i];
        const addAmount = baseQty + (i === 0 ? remainder : 0);

        // Find existing inventory
        const existingInv = await tx.productVariantInventory.findFirst({
          where: { productId: prodBig, optionId: option.optionId },
        });

        if (existingInv) {
          const newQty = Math.min(existingInv.quantity + addAmount, product.maxStock);
          await tx.productVariantInventory.update({
            where: { inventoryId: existingInv.inventoryId },
            data: { quantity: newQty },
          });
        } else {
          const newQty = Math.min(addAmount, product.maxStock);
          await tx.productVariantInventory.create({
            data: {
              productId: prodBig,
              optionId: option.optionId,
              quantity: newQty,
            },
          });
        }
      }

      // Update product's updated date
      await tx.product.update({
        where: { productId: prodBig },
        data: { updatedDate: new Date() },
      });

      return true;
    });
  }

  async softDeleteProducts(productIds: number[], companyId: number): Promise<void> {
    const bigIds = productIds.map((id) => BigInt(id));
    await prisma.product.updateMany({
      where: {
        productId: { in: bigIds },
        companyId: BigInt(companyId),
      },
      data: {
        isDeleted: true,
      },
    });
  }
}

export const productRepository = new ProductRepository();
