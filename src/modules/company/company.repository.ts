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
    address: string;
    pincode: string;
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
        address: data.address,
        pincode: data.pincode,
        updatedBy: userIdBig,
        updatedDate: now,
        ...(data.logoImgPath ? { logoImgPath: data.logoImgPath } : {}),
      },
      create: {
        companyName: data.companyName,
        address: data.address,
        pincode: data.pincode,
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
        catalogues: {
          where: {
            isDeleted: false,
            isPublished: true,
          },
          orderBy: {
            addedDate: 'desc',
          },
          take: 1,
          select: {
            catalogueId: true,
          },
        },
      },
    });

    if (!company) return null;

    return {
      company_id: Number(company.companyId),
      company_name: company.companyName,
      logo_img_path: company.logoImgPath,
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
        address: true,
        pincode: true,
        logoImgPath: true,
        subdomain: true,
      },
    });

    if (!company) return null;

    return {
      company_id: Number(company.companyId),
      company_name: company.companyName,
      address: company.address,
      pincode: company.pincode,
      logo_img_path: company.logoImgPath,
      subdomain: company.subdomain || null,
    };
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
}

export const companyRepository = new CompanyRepository();
