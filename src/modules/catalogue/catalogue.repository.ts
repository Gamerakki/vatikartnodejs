import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { CatalogueQueryParams, CatalogRes } from './catalogue.interface';

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

  async fetchPublicCatalogueData(catalogueId: number): Promise<{ catalogueId: number; companyId: number; title: string; privacyLevel: string } | null> {
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
    };
  }

  async fetchPublicCatalogueDataBySlug(slug: string): Promise<{ catalogueId: number; companyId: number; title: string; privacyLevel: string } | null> {
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
    };
  }

  async hasCustomerAccess(catalogueId: number, phone: string): Promise<boolean> {
    const access = await prisma.customerAccessRequest.findFirst({
      where: {
        catalogueId: BigInt(catalogueId),
        customerPhone: phone,
        status: 'APPROVED',
      }
    });
    
    if (!access) return false;
    if (access.expiresAt && new Date() > access.expiresAt) return false;
    
    return true;
  }

  async createAccessRequest(catalogueId: number, phone: string, name: string): Promise<void> {
    await prisma.customerAccessRequest.upsert({
      where: {
        catalogueId_customerPhone: {
          catalogueId: BigInt(catalogueId),
          customerPhone: phone,
        }
      },
      update: {
        customerName: name,
        status: 'PENDING',
        requestedAt: new Date(),
      },
      create: {
        catalogueId: BigInt(catalogueId),
        customerPhone: phone,
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
}

export const catalogueRepository = new CatalogueRepository();
