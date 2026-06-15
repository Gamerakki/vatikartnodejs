import { prisma } from '../../config/database';

export class CompanyRepository {
  async generateUniqueSubdomain(companyName: string, userId: bigint): Promise<string> {
    const existingCompany = await prisma.company.findUnique({
      where: { addedBy: userId },
      select: { subdomain: true }
    });
    
    if (existingCompany?.subdomain) {
      return existingCompany.subdomain;
    }

    const slugBase = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    const tempSlug = slugBase || 'company';
    let unique = false;
    let counter = 0;
    let finalSlug = tempSlug;
    
    while (!unique) {
      finalSlug = counter === 0 ? tempSlug : `${tempSlug}-${counter}`;
      const conflict = await prisma.company.findUnique({
        where: { subdomain: finalSlug }
      });
      if (!conflict) {
        unique = true;
      } else {
        counter++;
      }
    }
    
    return finalSlug;
  }

  async saveCompanyDirect(data: { companyName: string; addedBy: number }) {
    const userIdBig = BigInt(data.addedBy);
    const subdomain = await this.generateUniqueSubdomain(data.companyName, userIdBig);
    
    return await prisma.company.upsert({
      where: { addedBy: userIdBig },
      update: {
        companyName: data.companyName,
      },
      create: {
        companyName: data.companyName,
        addedBy: userIdBig,
        subdomain,
      },
    });
  }

  async saveCompany(data: {
    companyName: string;
    tagline?: string;
    address: string;
    pincode: string;
    phone?: string;
    email?: string;
    currency?: string;
    upiId?: string;
    addedBy: number;
    logoImgPath?: string;
  }) {
    const userIdBig = BigInt(data.addedBy);
    const now = new Date();
    const subdomain = await this.generateUniqueSubdomain(data.companyName, userIdBig);

    return await prisma.company.upsert({
      where: { addedBy: userIdBig },
      update: {
        companyName: data.companyName,
        tagline: data.tagline || null,
        address: data.address,
        pincode: data.pincode,
        phone: data.phone || null,
        email: data.email || null,
        currency: data.currency || 'INR',
        upiId: data.upiId || null,
        updatedBy: userIdBig,
        updatedDate: now,
        ...(data.logoImgPath ? { logoImgPath: data.logoImgPath } : {}),
      },
      create: {
        companyName: data.companyName,
        tagline: data.tagline || null,
        address: data.address,
        pincode: data.pincode,
        phone: data.phone || null,
        email: data.email || null,
        currency: data.currency || 'INR',
        upiId: data.upiId || null,
        addedBy: userIdBig,
        logoImgPath: data.logoImgPath || null,
        subdomain,
      },
    });
  }

  async resolveSubdomain(subdomain: string) {
    const company = await prisma.company.findUnique({
      where: { subdomain },
      select: {
        companyId: true,
        companyName: true,
        logoImgPath: true,
        salesPhone: true,
        supportPhone: true,
        policies: true,
        catalogues: {
          where: {
            isDeleted: false,
            isPublished: true,
          },
          orderBy: {
            addedDate: 'desc',
          },
          select: {
            catalogueId: true,
            catalogue: true,
            privacyLevel: true,
            addedDate: true,
            products: {
              where: {
                isDeleted: false,
              },
              take: 1,
              select: {
                images: {
                  orderBy: { productImgId: 'asc' },
                  take: 1,
                  select: {
                    productImgPath: true,
                  },
                },
              },
            },
            _count: {
              select: {
                products: {
                  where: {
                    isDeleted: false,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!company) return null;

    return {
      company_id: Number(company.companyId),
      company_name: company.companyName,
      logo_img_path: company.logoImgPath,
      sales_phone: company.salesPhone,
      support_phone: company.supportPhone,
      policies: company.policies,
      catalogues: company.catalogues.map((c) => {
        let cover_image = null;
        if (c.products.length > 0 && c.products[0].images.length > 0) {
          cover_image = c.products[0].images[0].productImgPath;
        }
        return {
          catalogue_id: Number(c.catalogueId),
          title: c.catalogue || 'Unnamed Catalogue',
          privacy_level: c.privacyLevel,
          added_date: c.addedDate,
          products_count: c._count.products,
          cover_image,
        };
      }),
      catalogue_id: company.catalogues.length > 0 ? Number(company.catalogues[0].catalogueId) : null,
    };
  }



  async fetchCompanyLogoImgPath(loggedInUserId: number): Promise<string> {
    const company = await prisma.company.findUnique({
      where: { addedBy: BigInt(loggedInUserId) },
      select: { logoImgPath: true },
    });
    return company?.logoImgPath || '';
  }

  async saveCompanySocialMediaBatch(
    companyId: number,
    socialMediaBatch: { socialMediaId: number; socialMedia: string }[]
  ) {
    const companyIdBig = BigInt(companyId);

    return await prisma.$transaction(
      socialMediaBatch.map((item) =>
        prisma.companySocialMediaMapper.upsert({
          where: {
            socialMediaId_companyId: {
              companyId: companyIdBig,
              socialMediaId: BigInt(item.socialMediaId),
            },
          },
          update: {
            socialMedia: item.socialMedia,
          },
          create: {
            companyId: companyIdBig,
            socialMediaId: BigInt(item.socialMediaId),
            socialMedia: item.socialMedia,
          },
        })
      )
    );
  }

  async fetchCompanyIDViaUserId(userId: number): Promise<number> {
    const company = await prisma.company.findUnique({
      where: { addedBy: BigInt(userId) },
      select: { companyId: true },
    });
    return company ? Number(company.companyId) : 0;
  }

  async fetchCompanyDataViaUserId(userId: number) {
    const company = await prisma.company.findUnique({
      where: { addedBy: BigInt(userId) },
      select: {
        companyId: true,
        companyName: true,
        tagline: true,
        address: true,
        pincode: true,
        phone: true,
        email: true,
        currency: true,
        upiId: true,
        logoImgPath: true,
        subdomain: true,
        watermarkEnabled: true,
        policies: true,
      },
    });

    if (!company) return null;

    return {
      company_id: Number(company.companyId),
      company_name: company.companyName,
      tagline: company.tagline,
      address: company.address,
      pincode: company.pincode,
      phone: company.phone,
      email: company.email,
      currency: company.currency,
      upi_id: company.upiId,
      logo_img_path: company.logoImgPath,
      subdomain: company.subdomain || null,
      watermark_enabled: company.watermarkEnabled,
      policies: company.policies || null,
    };
  }

  async updateWatermarkEnabled(userId: number, enabled: boolean): Promise<void> {
    await prisma.company.updateMany({
      where: { addedBy: BigInt(userId), isDeleted: false },
      data: { watermarkEnabled: enabled },
    });
  }

  async saveCompanySupportContactDetails(data: {
    companyId: number;
    supportEmail: string | null;
    supportPhone: string | null;
    updatedBy: number;
  }) {
    return await prisma.company.update({
      where: { companyId: BigInt(data.companyId) },
      data: {
        supportEmail: data.supportEmail,
        supportPhone: data.supportPhone,
        updatedBy: BigInt(data.updatedBy),
        updatedDate: new Date(),
      },
    });
  }

  async fetchCompanySupportContactDetails(companyId: number) {
    const company = await prisma.company.findUnique({
      where: { companyId: BigInt(companyId) },
      select: {
        supportEmail: true,
        supportPhone: true,
      },
    });

    return {
      support_email: company?.supportEmail || null,
      support_phone: company?.supportPhone || null,
    };
  }

  async saveCompanySalesContactDetails(data: {
    companyId: number;
    salesEmail: string | null;
    salesPhone: string | null;
    updatedBy: number;
  }) {
    return await prisma.company.update({
      where: { companyId: BigInt(data.companyId) },
      data: {
        salesEmail: data.salesEmail,
        salesPhone: data.salesPhone,
        updatedBy: BigInt(data.updatedBy),
        updatedDate: new Date(),
      },
    });
  }

  async fetchCompanySalesContactDetails(companyId: number) {
    const company = await prisma.company.findUnique({
      where: { companyId: BigInt(companyId) },
      select: {
        salesEmail: true,
        salesPhone: true,
      },
    });

    return {
      sales_email: company?.salesEmail || null,
      sales_phone: company?.salesPhone || null,
    };
  }

  async fetchCompanyPolicies(companyId: number): Promise<{ policies: string | null }> {
    const company = await prisma.company.findUnique({
      where: { companyId: BigInt(companyId) },
      select: {
        policies: true,
      },
    });

    return {
      policies: company?.policies || null,
    };
  }

  async updateCompanyPolicies(
    companyId: number,
    policies: string | null,
    updatedBy: number,
  ): Promise<void> {
    await prisma.company.update({
      where: { companyId: BigInt(companyId) },
      data: {
        policies,
        updatedBy: BigInt(updatedBy),
        updatedDate: new Date(),
      },
    });
  }
}

export const companyRepository = new CompanyRepository();
