import { prisma } from '../../config/database';

export class CompanyRepository {
  async saveCompanyDirect(data: { companyName: string; addedBy: number }) {
    return await prisma.company.upsert({
      where: { addedBy: BigInt(data.addedBy) },
      update: {
        companyName: data.companyName,
      },
      create: {
        companyName: data.companyName,
        addedBy: BigInt(data.addedBy),
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
      },
    });
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
            companyId_socialMediaId: {
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
      },
    });

    if (!company) return null;

    return {
      company_id: Number(company.companyId),
      company_name: company.companyName,
      address: company.address,
      pincode: company.pincode,
      logo_img_path: company.logoImgPath,
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
