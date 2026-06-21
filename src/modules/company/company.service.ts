import { companyRepository } from './company.repository';
import { SaveCompany, SaveSocialMediaBatchReq, CompanyData, SaveCompanySupportContactDetailsReq, CompanySupportContactDetailsRes, SaveCompanySalesContactDetailsReq, CompanySalesContactDetailsRes } from './company.interface';
import { uploadFile, deleteFromR2 } from '../../utils/s3';
import { getCompanyPlanUsage } from '../../utils/subscriptionLimits';

export class CompanyService {
  async saveCompany(
    loggedInUserId: number,
    companyReqData: SaveCompany,
    logoFile?: Express.Multer.File
  ): Promise<void> {
    let logoImgPath: string | undefined = undefined;

    if (logoFile && logoFile.size > 0) {
      // Fetch existing logo
      const existingLogo = await companyRepository.fetchCompanyLogoImgPath(loggedInUserId);
      if (existingLogo) {
        try {
          await deleteFromR2(existingLogo);
        } catch (err) {
          // Log error but don't block upload of new logo
        }
      }

      // Upload new logo
      const uploadName = await uploadFile(logoFile, {
        folderName: 'company/logo',
        uploadLocation: 'r2',
        allowedExtensions: { '.jpg': true, '.jpeg': true, '.png': true },
        allowedMimeTypes: { 'image/jpg': true, 'image/jpeg': true, 'image/png': true },
      });

      logoImgPath = `company/logo/${uploadName}`;
    }

    await companyRepository.saveCompany({
      companyName: companyReqData.company_name,
      tagline: companyReqData.tagline?.trim() || undefined,
      address: companyReqData.address || '',
      pincode: companyReqData.pincode || '',
      phone: companyReqData.phone?.replace(/\D/g, '') || undefined,
      email: companyReqData.email?.trim() || undefined,
      currency: companyReqData.currency?.trim().toUpperCase() || 'INR',
      upiId: companyReqData.upi_id?.trim() || undefined,
      addedBy: loggedInUserId,
      logoImgPath,
    });
  }

  async saveCompanySocialMediaBatch(
    loggedInUserId: number,
    batchReq: SaveSocialMediaBatchReq
  ): Promise<void> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    if (!companyId) {
      throw new Error('Please add your company details first');
    }

    const mappedMedia = batchReq.social_media.map((item) => ({
      socialMediaId: item.social_media_id,
      socialMedia: item.social_media,
    }));

    await companyRepository.saveCompanySocialMediaBatch(
      companyId,
      mappedMedia
    );
  }

  async fetchCompanyDataViaUserId(loggedInUserId: number): Promise<CompanyData | null> {
    const companyData = await companyRepository.fetchCompanyDataViaUserId(loggedInUserId);
    if (!companyData) return null;

    const usage = await getCompanyPlanUsage(companyData.company_id);

    return {
      ...companyData,
      subscription_info: {
        plan: usage.plan,
        products_used: usage.productsUsed,
        max_products: usage.maxProducts,
        categories_used: usage.categoriesUsed,
        max_categories: usage.maxCategories,
        users_used: usage.usersUsed,
        max_users: usage.maxUsers,
        access_control: usage.accessControl,
      },
    };
  }

  async saveCompanySupportDetails(
    loggedInUserId: number,
    req: SaveCompanySupportContactDetailsReq
  ): Promise<void> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    if (!companyId) {
      throw new Error('Please add your company details first');
    }

    const email = req.support_email && req.support_email.trim() !== '' ? req.support_email : null;
    const phone = req.support_phone && req.support_phone.trim() !== '' ? req.support_phone : null;

    await companyRepository.saveCompanySupportContactDetails({
      companyId,
      supportEmail: email,
      supportPhone: phone,
      updatedBy: loggedInUserId,
    });
  }

  async fetchCompanySupportContactDetails(
    loggedInUserId: number
  ): Promise<CompanySupportContactDetailsRes> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    if (!companyId) {
      return { support_email: null, support_phone: null };
    }

    return await companyRepository.fetchCompanySupportContactDetails(companyId);
  }

  async saveCompanySalesDetails(
    loggedInUserId: number,
    req: SaveCompanySalesContactDetailsReq
  ): Promise<void> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    if (!companyId) {
      throw new Error('Please add your company details first');
    }

    const email = req.sales_email && req.sales_email.trim() !== '' ? req.sales_email : null;
    const phone = req.sales_phone && req.sales_phone.trim() !== '' ? req.sales_phone : null;

    await companyRepository.saveCompanySalesContactDetails({
      companyId,
      salesEmail: email,
      salesPhone: phone,
      updatedBy: loggedInUserId,
    });
  }

  async fetchCompanySalesContactDetails(
    loggedInUserId: number
  ): Promise<CompanySalesContactDetailsRes> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    if (!companyId) {
      return { sales_email: null, sales_phone: null };
    }

    return await companyRepository.fetchCompanySalesContactDetails(companyId);
  }

  async resolveSubdomain(subdomain: string) {
    return await companyRepository.resolveSubdomain(subdomain);
  }

  async fetchCompanyPolicies(loggedInUserId: number): Promise<{ policies: string | null }> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    if (!companyId) {
      return { policies: null };
    }

    return await companyRepository.fetchCompanyPolicies(companyId);
  }

  async updateCompanyPolicies(loggedInUserId: number, policies: string | null): Promise<void> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    if (!companyId) {
      throw new Error('Please add your company details first');
    }

    const normalized = typeof policies === 'string' ? policies.trim() : '';
    await companyRepository.updateCompanyPolicies(companyId, normalized || null, loggedInUserId);
  }
}

export const companyService = new CompanyService();
