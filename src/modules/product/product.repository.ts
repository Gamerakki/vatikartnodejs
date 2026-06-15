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
          orderBy: [{ sortOrder: 'asc' }, { optionId: 'asc' }],
        },
        bulkDiscounts: {
          orderBy: { sortOrder: 'asc' },
        },
        setCompositions: true,
      },
      orderBy: { productId: 'desc' },
    });

    const stockByProduct = new Map<string, number>();
    const inventoryRowsByProduct = new Map<string, Array<{ sizeOptionId: bigint | null; colorOptionId: bigint | null; quantity: number }>>();
    if (products.length > 0) {
      const stockRows = await prisma.productVariantInventory.groupBy({
        by: ['productId'],
        where: { productId: { in: products.map((p) => p.productId) } },
        _sum: { quantity: true },
      });
      stockRows.forEach((row) => {
        stockByProduct.set(row.productId.toString(), row._sum.quantity || 0);
      });

      const inventoryRows = await prisma.productVariantInventory.findMany({
        where: { productId: { in: products.map((p) => p.productId) } },
      });
      inventoryRows.forEach((row) => {
        const key = row.productId.toString();
        const existing = inventoryRowsByProduct.get(key) || [];
        existing.push({ sizeOptionId: row.sizeOptionId, colorOptionId: row.colorOptionId, quantity: row.quantity });
        inventoryRowsByProduct.set(key, existing);
      });
    }

    return products.map((p) => {
      const sizesOptions = p.variantOptions.filter((o) => o.optionType === 'size');
      const colorsOptions = p.variantOptions.filter((o) => o.optionType === 'color');

      const totalStock = stockByProduct.get(p.productId.toString()) || 0;
      const inventoryRows = inventoryRowsByProduct.get(p.productId.toString()) || [];
      const inventoryItems = inventoryRows.map((row) => {
        const sizeOption = row.sizeOptionId ? sizesOptions.find((opt) => opt.optionId.toString() === row.sizeOptionId?.toString()) : null;
        const colorOption = row.colorOptionId ? colorsOptions.find((opt) => opt.optionId.toString() === row.colorOptionId?.toString()) : null;
        return {
          size_option_id: row.sizeOptionId ? Number(row.sizeOptionId) : null,
          color_option_id: row.colorOptionId ? Number(row.colorOptionId) : null,
          size_label: sizeOption?.label || null,
          color_label: colorOption?.label || null,
          quantity: row.quantity,
        };
      });

      return {
        product_id: Number(p.productId),
        product: p.product,
        sku: p.sku,
        price: p.price ? Number(p.price) : null,
        original_price: p.originalPrice ? Number(p.originalPrice) : null,
        gst_rate: p.gstRate ? Number(p.gstRate) : null,
        unit_type: p.unitType,
        img_path: p.images[0]?.productImgPath || null,
        images: p.images.map((img: any) => img.productImgPath),
        slug: p.slug,
        total_stock: totalStock,
        size_count: sizesOptions.length,
        description: p.description,
        sizes: sizesOptions.map((o) => ({
          option_id: Number(o.optionId),
          label: o.label,
          accent: o.accent,
          is_set: o.isSet,
          set_quantity: o.setQuantity,
          sort_order: o.sortOrder,
        })),
        colors: colorsOptions.map((o) => ({
          option_id: Number(o.optionId),
          name: o.label,
          hex: o.accent,
          is_set: o.isSet,
          set_quantity: o.setQuantity,
          sort_order: o.sortOrder,
        })),
        inventory_items: inventoryItems,
        bulk_discounts: p.bulkDiscounts.map((d) => ({
          slab_id: Number(d.slabId),
          min_qty: d.minQty,
          max_qty: d.maxQty,
          discounted_price: d.discountedPrice ? Number(d.discountedPrice) : null,
          discount_percent: d.discountPercent ? Number(d.discountPercent) : null,
          sort_order: d.sortOrder,
        })),
        catalogue_id: Number(p.catalogueId),
        price_mode: p.priceMode,
        set_quantity: p.setQuantity ? Number(p.setQuantity) : null,
        set_name: p.setName,
        minimum_order_qty: p.minimumOrderQty,
        set_composition: p.setCompositions.map((c) => ({
          size_label: c.sizeLabel,
          color_label: c.colorLabel,
          color_hex: c.colorHex,
          qty_in_set: c.qtyInSet,
        })),
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
          orderBy: [{ sortOrder: 'asc' }, { optionId: 'asc' }],
        },
        bulkDiscounts: {
          orderBy: { sortOrder: 'asc' },
        },
        setCompositions: true,
      },
      orderBy: { productId: 'desc' },
    });

    const stockByProduct = new Map<string, number>();
    const inventoryRowsByProduct = new Map<string, Array<{ sizeOptionId: bigint | null; colorOptionId: bigint | null; quantity: number }>>();
    if (products.length > 0) {
      const stockRows = await prisma.productVariantInventory.groupBy({
        by: ['productId'],
        where: { productId: { in: products.map((p) => p.productId) } },
        _sum: { quantity: true },
      });
      stockRows.forEach((row) => {
        stockByProduct.set(row.productId.toString(), row._sum.quantity || 0);
      });

      const inventoryRows = await prisma.productVariantInventory.findMany({
        where: { productId: { in: products.map((p) => p.productId) } },
      });
      inventoryRows.forEach((row) => {
        const key = row.productId.toString();
        const existing = inventoryRowsByProduct.get(key) || [];
        existing.push({ sizeOptionId: row.sizeOptionId, colorOptionId: row.colorOptionId, quantity: row.quantity });
        inventoryRowsByProduct.set(key, existing);
      });
    }

    return products.map((p) => {
      const sizesOptions = p.variantOptions.filter((o) => o.optionType === 'size');
      const colorsOptions = p.variantOptions.filter((o) => o.optionType === 'color');

      const totalStock = stockByProduct.get(p.productId.toString()) || 0;
      const inventoryRows = inventoryRowsByProduct.get(p.productId.toString()) || [];
      const inventoryItems = inventoryRows.map((row) => {
        const sizeOption = row.sizeOptionId ? sizesOptions.find((opt) => opt.optionId.toString() === row.sizeOptionId?.toString()) : null;
        const colorOption = row.colorOptionId ? colorsOptions.find((opt) => opt.optionId.toString() === row.colorOptionId?.toString()) : null;
        return {
          size_option_id: row.sizeOptionId ? Number(row.sizeOptionId) : null,
          color_option_id: row.colorOptionId ? Number(row.colorOptionId) : null,
          size_label: sizeOption?.label || null,
          color_label: colorOption?.label || null,
          quantity: row.quantity,
        };
      });

      return {
        product_id: Number(p.productId),
        product: p.product,
        sku: p.sku,
        price: p.price ? Number(p.price) : null,
        original_price: p.originalPrice ? Number(p.originalPrice) : null,
        gst_rate: p.gstRate ? Number(p.gstRate) : null,
        unit_type: p.unitType,
        img_path: p.images[0]?.productImgPath || null,
        images: p.images.map((img: any) => img.productImgPath),
        slug: p.slug,
        total_stock: totalStock,
        size_count: sizesOptions.length,
        description: p.description,
        sizes: sizesOptions.map((o) => ({
          option_id: Number(o.optionId),
          label: o.label,
          accent: o.accent,
          is_set: o.isSet,
          set_quantity: o.setQuantity,
          sort_order: o.sortOrder,
        })),
        colors: colorsOptions.map((o) => ({
          option_id: Number(o.optionId),
          name: o.label,
          hex: o.accent,
          is_set: o.isSet,
          set_quantity: o.setQuantity,
          sort_order: o.sortOrder,
        })),
        inventory_items: inventoryItems,
        bulk_discounts: p.bulkDiscounts.map((d) => ({
          slab_id: Number(d.slabId),
          min_qty: d.minQty,
          max_qty: d.maxQty,
          discounted_price: d.discountedPrice ? Number(d.discountedPrice) : null,
          discount_percent: d.discountPercent ? Number(d.discountPercent) : null,
          sort_order: d.sortOrder,
        })),
        catalogue_id: Number(p.catalogueId),
        price_mode: p.priceMode,
        set_quantity: p.setQuantity ? Number(p.setQuantity) : null,
        set_name: p.setName,
        minimum_order_qty: p.minimumOrderQty,
        set_composition: p.setCompositions.map((c) => ({
          size_label: c.sizeLabel,
          color_label: c.colorLabel,
          color_hex: c.colorHex,
          qty_in_set: c.qtyInSet,
        })),
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
      originalPrice: number | null;
      gstRate: number | null;
      priceMode: string | null;
      unitType: string | null;
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
          originalPrice: product.originalPrice,
          gstRate: product.gstRate,
          priceMode: product.priceMode,
          unitType: product.unitType,
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
    options: { optionType: string; label: string; accent: string | null; isSet?: boolean; setQuantity?: number; sortOrder: number }[]
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
            isSet: Boolean(opt.isSet),
            setQuantity: Math.max(1, Number(opt.setQuantity || 1)),
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
      include: {
        setCompositions: true,
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
    items: { sizeOptionId?: number | null; colorOptionId?: number | null; quantity: number }[]
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

      const sizeIDs = Array.from(
        new Set(
          items
            .map((i) => i.sizeOptionId)
            .filter((id): id is number => Number.isFinite(id as number) && (id as number) > 0)
            .map((id) => BigInt(id))
        )
      );
      const colorIDs = Array.from(
        new Set(
          items
            .map((i) => i.colorOptionId)
            .filter((id): id is number => Number.isFinite(id as number) && (id as number) > 0)
            .map((id) => BigInt(id))
        )
      );

      if (sizeIDs.length > 0) {
        const validSizeCount = await tx.productVariantOption.count({
          where: {
            productId: productIdBig,
            optionType: 'size',
            optionId: { in: sizeIDs },
          },
        });

        if (validSizeCount !== sizeIDs.length) {
          throw new Error('invalid variant option');
        }
      }

      if (colorIDs.length > 0) {
        const validColorCount = await tx.productVariantOption.count({
          where: {
            productId: productIdBig,
            optionType: 'color',
            optionId: { in: colorIDs },
          },
        });

        if (validColorCount !== colorIDs.length) {
          throw new Error('invalid variant option');
        }
      }

      // Save inventories
      await tx.productVariantInventory.createMany({
        data: items.map((item) => ({
          productId: productIdBig,
          sizeOptionId: item.sizeOptionId ? BigInt(item.sizeOptionId) : null,
          colorOptionId: item.colorOptionId ? BigInt(item.colorOptionId) : null,
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

    const productIdBig = BigInt(productId);
    const [sizeOptions, colorOptions, inventories] = await Promise.all([
      prisma.productVariantOption.findMany({
        where: { productId: productIdBig, optionType: 'size' },
        orderBy: [{ sortOrder: 'asc' }, { optionId: 'asc' }],
      }),
      prisma.productVariantOption.findMany({
        where: { productId: productIdBig, optionType: 'color' },
        orderBy: [{ sortOrder: 'asc' }, { optionId: 'asc' }],
      }),
      prisma.productVariantInventory.findMany({
        where: { productId: productIdBig },
      }),
    ]);

    const inventoryByCombo = new Map<string, number>();
    inventories.forEach((inv) => {
      const key = `${inv.sizeOptionId ? inv.sizeOptionId.toString() : 'null'}:${inv.colorOptionId ? inv.colorOptionId.toString() : 'null'}`;
      inventoryByCombo.set(key, (inventoryByCombo.get(key) || 0) + inv.quantity);
    });

    const combinations: Array<{
      size_option_id: number | null;
      color_option_id: number | null;
      size_label: string | null;
      color_label: string | null;
      quantity: number;
    }> = [];

    if (sizeOptions.length > 0 && colorOptions.length > 0) {
      sizeOptions.forEach((size) => {
        colorOptions.forEach((color) => {
          const key = `${size.optionId.toString()}:${color.optionId.toString()}`;
          combinations.push({
            size_option_id: Number(size.optionId),
            color_option_id: Number(color.optionId),
            size_label: size.label,
            color_label: color.label,
            quantity: inventoryByCombo.get(key) || 0,
          });
        });
      });
      return combinations;
    }

    if (sizeOptions.length > 0) {
      sizeOptions.forEach((size) => {
        const key = `${size.optionId.toString()}:null`;
        combinations.push({
          size_option_id: Number(size.optionId),
          color_option_id: null,
          size_label: size.label,
          color_label: null,
          quantity: inventoryByCombo.get(key) || 0,
        });
      });
      return combinations;
    }

    if (colorOptions.length > 0) {
      colorOptions.forEach((color) => {
        const key = `null:${color.optionId.toString()}`;
        combinations.push({
          size_option_id: null,
          color_option_id: Number(color.optionId),
          size_label: null,
          color_label: color.label,
          quantity: inventoryByCombo.get(key) || 0,
        });
      });
    }

    return combinations;
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
          orderBy: [{ sortOrder: 'asc' }, { optionId: 'asc' }],
        },
      },
      orderBy: { product: 'asc' },
    });

    const stockByProduct = new Map<string, number>();
    if (products.length > 0) {
      const stockRows = await prisma.productVariantInventory.groupBy({
        by: ['productId'],
        where: { productId: { in: products.map((p) => p.productId) } },
        _sum: { quantity: true },
      });
      stockRows.forEach((row) => {
        stockByProduct.set(row.productId.toString(), row._sum.quantity || 0);
      });
    }

    return products.map((p) => {
      const totalStock = stockByProduct.get(p.productId.toString()) || 0;

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
        },
      },
    });

    const stockByProduct = new Map<string, number>();
    if (products.length > 0) {
      const stockRows = await prisma.productVariantInventory.groupBy({
        by: ['productId'],
        where: { productId: { in: products.map((p) => p.productId) } },
        _sum: { quantity: true },
      });
      stockRows.forEach((row) => {
        stockByProduct.set(row.productId.toString(), row._sum.quantity || 0);
      });
    }

    let totalItems = 0;
    let totalQuantity = 0;
    let lowStockItems = 0;
    let outOfStockItems = 0;

    products.forEach((p) => {
      totalItems += 1;
      const totalStock = stockByProduct.get(p.productId.toString()) || 0;

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
          orderBy: [{ optionType: 'asc' }, { sortOrder: 'asc' }, { optionId: 'asc' }],
        },
      },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    return await prisma.$transaction(async (tx) => {
      let sizeOptions = product.variantOptions.filter((opt) => opt.optionType === 'size');
      const colorOptions = product.variantOptions.filter((opt) => opt.optionType === 'color');

      // Fallback: If no size variants exist, create a default "One Size" variant option.
      if (sizeOptions.length === 0 && colorOptions.length === 0) {
        const newOption = await tx.productVariantOption.create({
          data: {
            productId: prodBig,
            optionType: 'size',
            label: 'One Size',
            isSet: false,
            setQuantity: 1,
            sortOrder: 0,
          },
        });
        sizeOptions = [newOption];
      }

      const combinations: Array<{ sizeOptionId: bigint | null; colorOptionId: bigint | null }> = [];
      if (sizeOptions.length > 0 && colorOptions.length > 0) {
        sizeOptions.forEach((sizeOpt) => {
          colorOptions.forEach((colorOpt) => {
            combinations.push({ sizeOptionId: sizeOpt.optionId, colorOptionId: colorOpt.optionId });
          });
        });
      } else if (sizeOptions.length > 0) {
        sizeOptions.forEach((sizeOpt) => {
          combinations.push({ sizeOptionId: sizeOpt.optionId, colorOptionId: null });
        });
      } else {
        colorOptions.forEach((colorOpt) => {
          combinations.push({ sizeOptionId: null, colorOptionId: colorOpt.optionId });
        });
      }

      if (combinations.length === 0) {
        return true;
      }

      const N = combinations.length;
      const baseQty = Math.floor(amount / N);
      const remainder = amount % N;

      // Update/Upsert stock count for each active size/color combination.
      for (let i = 0; i < N; i += 1) {
        const combo = combinations[i];
        const addAmount = baseQty + (i === 0 ? remainder : 0);

        // Find existing inventory row for this exact combination.
        const existingInv = await tx.productVariantInventory.findFirst({
          where: {
            productId: prodBig,
            sizeOptionId: combo.sizeOptionId,
            colorOptionId: combo.colorOptionId,
          },
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
              sizeOptionId: combo.sizeOptionId,
              colorOptionId: combo.colorOptionId,
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

  async saveSetComposition(
    productId: number,
    companyId: number,
    composition: { size_label: string; color_label: string; color_hex?: string | null; qty_in_set: number }[]
  ) {
    const productIdBig = BigInt(productId);
    const companyIdBig = BigInt(companyId);

    return await prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { productId: productIdBig, companyId: companyIdBig, isDeleted: false },
      });

      if (!product) {
        throw new Error('product not found');
      }

      // Delete old composition entries
      await tx.productSetComposition.deleteMany({
        where: { productId: productIdBig },
      });

      // Insert new composition entries
      if (composition.length > 0) {
        await tx.productSetComposition.createMany({
          data: composition.map((c) => ({
            productId: productIdBig,
            sizeLabel: c.size_label,
            colorLabel: c.color_label,
            colorHex: c.color_hex || null,
            qtyInSet: c.qty_in_set,
          })),
        });
      }

      // Maintain compatibility with variants:
      // Delete existing size/color variant options for this product
      await tx.productVariantOption.deleteMany({
        where: { productId: productIdBig },
      });

      // Add a single default size option: 'Standard Set' (or set_name if available)
      const label = product.setName || 'Standard Set';
      const defaultOption = await tx.productVariantOption.create({
        data: {
          productId: productIdBig,
          optionType: 'size',
          label: label,
          isSet: true,
          setQuantity: Math.max(1, Number(product.setQuantity || 1)),
          sortOrder: 0,
        },
      });

      // Keep inventory row for this default option if it doesn't exist
      const existingInv = await tx.productVariantInventory.findFirst({
        where: { productId: productIdBig, sizeOptionId: defaultOption.optionId, colorOptionId: null },
      });
      if (!existingInv) {
        await tx.productVariantInventory.create({
          data: {
            productId: productIdBig,
            sizeOptionId: defaultOption.optionId,
            colorOptionId: null,
            quantity: 0,
          },
        });
      }
    });
  }
}

export const productRepository = new ProductRepository();
