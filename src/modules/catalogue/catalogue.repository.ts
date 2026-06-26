import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { CatalogueQueryParams, CatalogRes } from './catalogue.interface';
import { sanitizeString, generateRandom12DigitString } from '../../utils/common';

export class CatalogueRepository {
  async saveCatalogue(data: {
    catalogueId?: number;
    catalogue: string;
    companyId?: number;
    addedBy?: number;
    updatedBy?: number;
    slug?: string;
    privacyLevel?: string;
  }): Promise<{ catalogueId: number; slug: string; addedDate: Date }> {
    const now = new Date();

    if (!data.catalogueId) {
      const created = await prisma.catalogue.create({
        data: {
          catalogue: data.catalogue,
          companyId: BigInt(data.companyId || 0),
          addedBy: BigInt(data.addedBy || 0),
          slug: data.slug || null,
          isPublished: true,
          addedDate: now,
          privacyLevel: data.privacyLevel || 'PUBLIC',
        },
      });

      return {
        catalogueId: Number(created.catalogueId),
        slug: created.slug || '',
        addedDate: created.addedDate,
      };
    }

    const updated = await prisma.catalogue.update({
      where: { catalogueId: BigInt(data.catalogueId) },
      data: {
        catalogue: data.catalogue,
        updatedBy: BigInt(data.updatedBy || 0),
        isPublished: true,
        updatedDate: now,
        ...(data.privacyLevel ? { privacyLevel: data.privacyLevel } : {}),
      },
    });

    return {
      catalogueId: Number(updated.catalogueId),
      slug: updated.slug || '',
      addedDate: updated.addedDate,
    };
  }

  async checkExistingCatalogue(catalogueId: number): Promise<boolean> {
    const count = await prisma.catalogue.count({
      where: {
        catalogueId: BigInt(catalogueId),
        isDeleted: false,
      },
    });
    return count > 0;
  }

  async fetchCatalogues(
    companyId: number,
    params: CatalogueQueryParams,
    isDeleted: boolean
  ): Promise<CatalogRes[]> {
    const limit = params.limit || 10;
    const offset = params.offset || 0;
    const companyIdBig = BigInt(companyId);

    // Build the query raw dynamically
    let queryResult: any[];

    if (params.search_txt) {
      queryResult = await prisma.$queryRaw<any[]>`
        SELECT 
          c.catalogue_id,
          c.catalogue,
          c.added_date,
          c.is_published, 
          c.slug,
          c.privacy_level,
          COALESCE(p.total_products_count, 0) as total_products_count,
          COALESCE(pi.thumbnail_images, '') as thumbnail_images,
          COALESCE(cvm.total_visitors, 0) as total_visitors
        FROM catalogues as c
        LEFT JOIN (
          SELECT catalogue_id, COUNT(product_id) as total_products_count
          FROM products
          GROUP BY catalogue_id
        ) as p on p.catalogue_id = c.catalogue_id
        LEFT JOIN (
          SELECT 
            t.catalogue_id,
            STRING_AGG(t.product_img_path, ',') AS thumbnail_images
          FROM (
            SELECT 
              p.catalogue_id,
              pi.product_img_path,
              ROW_NUMBER() OVER (
                PARTITION BY p.catalogue_id 
                ORDER BY pi.product_img_path
              ) AS rn
            FROM products p
            JOIN product_images pi ON pi.product_id = p.product_id
          ) t
          WHERE t.rn <= 4
          GROUP BY t.catalogue_id
        ) as pi on pi.catalogue_id = c.catalogue_id
        LEFT JOIN (
          SELECT catalogue_id, COUNT(customer_id) as total_visitors
          FROM (
            SELECT DISTINCT catalogue_id, customer_id
            FROM catalogue_visitor_mapper
          ) t
          GROUP BY catalogue_id
        ) cvm on cvm.catalogue_id = c.catalogue_id
        WHERE c.is_deleted = ${isDeleted}
          AND c.company_id = ${companyIdBig}
          AND c.catalogue ILIKE ${'%' + params.search_txt + '%'}
        GROUP BY c.catalogue_id, c.slug, c.privacy_level, cvm.total_visitors, p.total_products_count, pi.thumbnail_images
        ORDER BY c.catalogue_id DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      queryResult = await prisma.$queryRaw<any[]>`
        SELECT 
          c.catalogue_id,
          c.catalogue,
          c.added_date,
          c.is_published, 
          c.slug,
          c.privacy_level,
          COALESCE(p.total_products_count, 0) as total_products_count,
          COALESCE(pi.thumbnail_images, '') as thumbnail_images,
          COALESCE(cvm.total_visitors, 0) as total_visitors
        FROM catalogues as c
        LEFT JOIN (
          SELECT catalogue_id, COUNT(product_id) as total_products_count
          FROM products
          GROUP BY catalogue_id
        ) as p on p.catalogue_id = c.catalogue_id
        LEFT JOIN (
          SELECT 
            t.catalogue_id,
            STRING_AGG(t.product_img_path, ',') AS thumbnail_images
          FROM (
            SELECT 
              p.catalogue_id,
              pi.product_img_path,
              ROW_NUMBER() OVER (
                PARTITION BY p.catalogue_id 
                ORDER BY pi.product_img_path
              ) AS rn
            FROM products p
            JOIN product_images pi ON pi.product_id = p.product_id
          ) t
          WHERE t.rn <= 4
          GROUP BY t.catalogue_id
        ) as pi on pi.catalogue_id = c.catalogue_id
        LEFT JOIN (
          SELECT catalogue_id, COUNT(customer_id) as total_visitors
          FROM (
            SELECT DISTINCT catalogue_id, customer_id
            FROM catalogue_visitor_mapper
          ) t
          GROUP BY catalogue_id
        ) cvm on cvm.catalogue_id = c.catalogue_id
        WHERE c.is_deleted = ${isDeleted}
          AND c.company_id = ${companyIdBig}
        GROUP BY c.catalogue_id, c.slug, c.privacy_level, cvm.total_visitors, p.total_products_count, pi.thumbnail_images
        ORDER BY c.catalogue_id DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    return queryResult.map((row) => ({
      catalogue_id: Number(row.catalogue_id),
      catalogue: row.catalogue,
      added_date: row.added_date,
      is_published: row.is_published,
      total_products_count: Number(row.total_products_count),
      total_visitors: Number(row.total_visitors),
      thumbnail_images: row.thumbnail_images || '',
      slug: row.slug || null,
      privacy_level: row.privacy_level || 'PUBLIC',
    }));
  }

  async fetchTotalCataloguesCount(
    companyId: number,
    params: CatalogueQueryParams,
    isDeleted: boolean
  ): Promise<number> {
    const whereClause: Prisma.CatalogueWhereInput = {
      companyId: BigInt(companyId),
      isDeleted,
      ...(params.search_txt
        ? {
            catalogue: {
              contains: params.search_txt,
              mode: 'insensitive',
            },
          }
        : {}),
    };

    return await prisma.catalogue.count({ where: whereClause });
  }

  async fetchCatalogueData(
    companyId: number,
    catalogueId: number,
    isDeleted: boolean
  ): Promise<CatalogRes | null> {
    const catalogue = await prisma.catalogue.findFirst({
      where: {
        catalogueId: BigInt(catalogueId),
        companyId: BigInt(companyId),
        isDeleted,
      },
    });

    if (!catalogue) return null;

    return {
      catalogue_id: Number(catalogue.catalogueId),
      catalogue: catalogue.catalogue,
      added_date: catalogue.addedDate,
      is_published: catalogue.isPublished,
      total_products_count: 0,
      total_visitors: 0,
      thumbnail_images: '',
      slug: catalogue.slug || null,
      privacy_level: catalogue.privacyLevel,
    };
  }

  async softDeleteCatalogue(catalogueIds: number[]): Promise<void> {
    const bigIds = catalogueIds.map((id) => BigInt(id));
    await prisma.catalogue.updateMany({
      where: {
        catalogueId: { in: bigIds },
      },
      data: {
        isDeleted: true,
      },
    });
  }

  async checkCatalogueIdsExist(
    companyId: number,
    catalogueIds: number[],
    isDeleted: boolean
  ): Promise<number[]> {
    const bigIds = catalogueIds.map((id) => BigInt(id));
    const result = await prisma.catalogue.findMany({
      where: {
        catalogueId: { in: bigIds },
        isDeleted,
        companyId: BigInt(companyId),
      },
      select: {
        catalogueId: true,
      },
    });

    return result.map((r) => Number(r.catalogueId));
  }

  async restoreCatalogue(catalogueIds: number[]): Promise<void> {
    const bigIds = catalogueIds.map((id) => BigInt(id));
    await prisma.catalogue.updateMany({
      where: {
        catalogueId: { in: bigIds },
      },
      data: {
        isDeleted: false,
      },
    });
  }

  async fetchRestoredCataloguesDataViaCatalogueIds(catalogueIds: number[]): Promise<CatalogRes[]> {
    const bigIds = catalogueIds.map((id) => BigInt(id));
    const catalogues = await prisma.catalogue.findMany({
      where: {
        catalogueId: { in: bigIds },
      },
    });

    return catalogues.map((c) => ({
      catalogue_id: Number(c.catalogueId),
      catalogue: c.catalogue,
      added_date: c.addedDate,
      is_published: c.isPublished,
      total_products_count: 0,
      total_visitors: 0,
      thumbnail_images: '',
      slug: c.slug || null,
      privacy_level: c.privacyLevel,
    }));
  }

  async fetchPublicCatalogueData(catalogueId: number): Promise<{ catalogueId: number; companyId: number; title: string; privacyLevel: string; bannerText: string | null; bannerActive: boolean; bannerImgPath: string | null } | null> {
    const catalogue = await prisma.catalogue.findFirst({
      where: {
        catalogueId: BigInt(catalogueId),
        isDeleted: false,
        isPublished: true,
      },
    });

    if (!catalogue) return null;

    return {
      catalogueId: Number(catalogue.catalogueId),
      companyId: Number(catalogue.companyId),
      title: catalogue.catalogue || '',
      privacyLevel: catalogue.privacyLevel,
      bannerText: catalogue.bannerText ?? null,
      bannerActive: catalogue.bannerActive,
      bannerImgPath: catalogue.bannerImgPath ?? null,
    };
  }

  async fetchPublicCatalogueDataBySlug(slug: string): Promise<{ catalogueId: number; companyId: number; title: string; privacyLevel: string; bannerText: string | null; bannerActive: boolean; bannerImgPath: string | null } | null> {
    const catalogue = await prisma.catalogue.findFirst({
      where: {
        slug: slug,
        isDeleted: false,
        isPublished: true,
      },
    });

    if (!catalogue) return null;

    return {
      catalogueId: Number(catalogue.catalogueId),
      companyId: Number(catalogue.companyId),
      title: catalogue.catalogue || '',
      privacyLevel: catalogue.privacyLevel,
      bannerText: catalogue.bannerText ?? null,
      bannerActive: catalogue.bannerActive,
      bannerImgPath: catalogue.bannerImgPath ?? null,
    };
  }

  async hasCustomerAccess(catalogueId: number, phone: string): Promise<boolean> {
    const normalizedPhone = phone.replace(/\D/g, '');
    const access = await prisma.customerAccessRequest.findFirst({
      where: {
        catalogueId: BigInt(catalogueId),
        customerPhone: normalizedPhone,
        status: 'APPROVED',
      }
    });
    
    if (!access) return false;
    if (access.expiresAt && new Date() > access.expiresAt) return false;
    
    return true;
  }

  async updateCatalogueBanner(
    catalogueId: number,
    companyId: number,
    bannerText: string | null,
    bannerActive: boolean,
    bannerImgPath: string | null,
  ): Promise<void> {
    await prisma.catalogue.updateMany({
      where: {
        catalogueId: BigInt(catalogueId),
        companyId: BigInt(companyId),
        isDeleted: false,
      },
      data: {
        bannerText: bannerText ?? undefined,
        bannerActive,
        ...(bannerImgPath !== null ? { bannerImgPath } : {}),
      },
    });
  }

  async createAccessRequest(catalogueId: number, phone: string, name: string): Promise<void> {
    const normalizedPhone = phone.replace(/\D/g, '');
    await prisma.customerAccessRequest.upsert({
      where: {
        catalogueId_customerPhone: {
          catalogueId: BigInt(catalogueId),
          customerPhone: normalizedPhone,
        }
      },
      update: {
        customerName: name,
        status: 'PENDING',
        requestedAt: new Date(),
      },
      create: {
        catalogueId: BigInt(catalogueId),
        customerPhone: normalizedPhone,
        customerName: name,
        status: 'PENDING',
      }
    });
  }

  async fetchAccessRequests(companyId: number): Promise<any[]> {
    const requests = await prisma.customerAccessRequest.findMany({
      where: {
        catalogue: {
          companyId: BigInt(companyId),
        }
      },
      include: {
        catalogue: {
          select: {
            catalogue: true,
          }
        }
      },
      orderBy: {
        requestedAt: 'desc'
      }
    });

    return requests.map(r => ({
      accessId: Number(r.accessId),
      catalogueId: Number(r.catalogueId),
      catalogueName: r.catalogue.catalogue,
      customerPhone: r.customerPhone,
      customerName: r.customerName,
      status: r.status,
      expiresAt: r.expiresAt,
      requestedAt: r.requestedAt,
    }));
  }

  async updateAccessRequest(accessId: number, companyId: number, status: string, expiresAt: Date | null): Promise<void> {
    // First verify this access request belongs to a catalogue owned by this company
    const req = await prisma.customerAccessRequest.findFirst({
      where: {
        accessId: BigInt(accessId),
        catalogue: {
          companyId: BigInt(companyId)
        }
      }
    });

    if (!req) {
      throw new Error('Access request not found or unauthorized');
    }

    await prisma.customerAccessRequest.update({
      where: { accessId: BigInt(accessId) },
      data: {
        status,
        expiresAt,
      }
    });
  }

  async approveAllAccessRequests(catalogueId: number, companyId: number): Promise<number> {
    const result = await prisma.customerAccessRequest.updateMany({
      where: {
        catalogueId: BigInt(catalogueId),
        status: 'PENDING',
        catalogue: {
          companyId: BigInt(companyId),
        },
      },
      data: {
        status: 'APPROVED',
      },
    });

    return result.count;
  }

  async updateCataloguePrivacy(catalogueId: number, companyId: number, privacyLevel: string): Promise<void> {
    const exists = await prisma.catalogue.findFirst({
      where: { catalogueId: BigInt(catalogueId), companyId: BigInt(companyId) }
    });
    if (!exists) throw new Error('Catalogue not found');

    await prisma.catalogue.update({
      where: { catalogueId: BigInt(catalogueId) },
      data: { privacyLevel }
    });
  }

  async cloneCatalogue(
    loggedInUserId: number,
    companyId: number,
    catalogueId: number,
    customName: string
  ): Promise<CatalogRes> {
    const duplicateCount = await prisma.catalogue.count({
      where: {
        companyId: BigInt(companyId),
        catalogue: {
          equals: customName.trim(),
          mode: 'insensitive',
        },
        isDeleted: false,
      },
    });

    if (duplicateCount > 0) {
      throw new Error('A catalogue with this name already exists');
    }

    const catalogue = await prisma.catalogue.findFirst({
      where: {
        catalogueId: BigInt(catalogueId),
        companyId: BigInt(companyId),
        isDeleted: false,
      },
    });

    if (!catalogue) {
      throw new Error('Catalogue not found');
    }

    const newTitle = customName.trim();
    const newSlug = `${sanitizeString(newTitle)}-${generateRandom12DigitString()}`;

    const products = await prisma.product.findMany({
      where: {
        catalogueId: BigInt(catalogueId),
        isDeleted: false,
      },
      include: {
        images: true,
        bulkDiscounts: true,
        variantOptions: true,
      },
    });

    const cloned = await prisma.$transaction(async (tx) => {
      const newCat = await tx.catalogue.create({
        data: {
          catalogue: newTitle,
          companyId: BigInt(companyId),
          addedBy: BigInt(loggedInUserId),
          slug: newSlug,
          isPublished: catalogue.isPublished,
          privacyLevel: catalogue.privacyLevel,
          addedDate: new Date(),
        },
      });

      for (const p of products) {
        let newSku: string | null = null;
        if (p.sku) {
          const suffix = `-copy-${generateRandom12DigitString().substring(0, 4)}`;
          const maxOriginalLen = 50 - suffix.length;
          newSku = p.sku.substring(0, maxOriginalLen) + suffix;
        }
        const newProductSlug = `${sanitizeString(p.product)}-${generateRandom12DigitString()}`;

        const newProd = await tx.product.create({
          data: {
            product: p.product,
            sku: newSku,
            description: p.description,
            price: p.price,
            priceMode: p.priceMode,
            setQuantity: p.setQuantity,
            meterQuantity: p.meterQuantity,
            setName: p.setName,
            minimumOrderQty: p.minimumOrderQty,
            companyId: BigInt(companyId),
            addedBy: BigInt(loggedInUserId),
            slug: newProductSlug,
            catalogueId: newCat.catalogueId,
            reorderLevel: p.reorderLevel,
            maxStock: p.maxStock,
            trackInventory: p.trackInventory,
            addedDate: new Date(),
          },
        });

        if (p.images.length > 0) {
          await tx.productImage.createMany({
            data: p.images.map((img) => ({
              productId: newProd.productId,
              productImgPath: img.productImgPath,
            })),
          });
        }

        if (p.bulkDiscounts.length > 0) {
          await tx.productBulkDiscountSlab.createMany({
            data: p.bulkDiscounts.map((slab) => ({
              productId: newProd.productId,
              minQty: slab.minQty,
              maxQty: slab.maxQty,
              discountedPrice: slab.discountedPrice,
              discountPercent: slab.discountPercent,
              sortOrder: slab.sortOrder,
            })),
          });
        }

        const optionMap = new Map<string, bigint>();
        for (const opt of p.variantOptions) {
          const newOpt = await tx.productVariantOption.create({
            data: {
              productId: newProd.productId,
              optionType: opt.optionType,
              label: opt.label,
              accent: opt.accent,
              sortOrder: opt.sortOrder,
            },
          });
          optionMap.set(opt.optionId.toString(), newOpt.optionId);
        }

        const oldInventories = await tx.productVariantInventory.findMany({
          where: { productId: p.productId },
        });

        if (oldInventories.length > 0) {
          await tx.productVariantInventory.createMany({
            data: oldInventories.map((inv) => ({
              productId: newProd.productId,
              sizeOptionId: inv.sizeOptionId ? (optionMap.get(inv.sizeOptionId.toString()) || null) : null,
              colorOptionId: inv.colorOptionId ? (optionMap.get(inv.colorOptionId.toString()) || null) : null,
              quantity: inv.quantity,
              sku: inv.sku,
            })),
          });
        }
      }

      return newCat;
    });

    const thumbnailImages = products
      .slice(0, 4)
      .map((p) => p.images[0]?.productImgPath)
      .filter(Boolean)
      .join(',');

    return {
      catalogue_id: Number(cloned.catalogueId),
      catalogue: cloned.catalogue,
      added_date: cloned.addedDate,
      is_published: cloned.isPublished,
      total_products_count: products.length,
      total_visitors: 0,
      thumbnail_images: thumbnailImages,
      slug: cloned.slug || null,
      privacy_level: cloned.privacyLevel,
    };
  }
}

export const catalogueRepository = new CatalogueRepository();
