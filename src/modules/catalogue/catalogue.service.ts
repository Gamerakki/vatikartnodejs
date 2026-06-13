import { catalogueRepository } from './catalogue.repository';
import { companyRepository } from '../company/company.repository';
import { productRepository } from '../product/product.repository';
import { SaveCatalogueReq, SaveCatalogueRes, CatalogRes, CatalogueQueryParams, SoftDeleteRestoreCatalogueReq } from './catalogue.interface';
import { sanitizeString, generateRandom12DigitString } from '../../utils/common';

export class CatalogueService {
  async saveCatalogue(
    loggedInUserId: number,
    req: SaveCatalogueReq
  ): Promise<SaveCatalogueRes> {
    if (!req.catalogue_id) {
      // Creation
      const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
      const slugName = `${sanitizeString(req.catalogue)}-${generateRandom12DigitString()}`;

      const res = await catalogueRepository.saveCatalogue({
        catalogue: req.catalogue,
        companyId,
        addedBy: loggedInUserId,
        slug: slugName,
      });

      return {
        catalogue_id: res.catalogueId,
        slug: res.slug,
        added_date: res.addedDate,
      };
    } else {
      // Update
      const exists = await catalogueRepository.checkExistingCatalogue(req.catalogue_id);
      if (!exists) {
        throw new Error('Catalogue not found');
      }

      const res = await catalogueRepository.saveCatalogue({
        catalogueId: req.catalogue_id,
        catalogue: req.catalogue,
        updatedBy: loggedInUserId,
      });

      return {
        catalogue_id: res.catalogueId,
        slug: res.slug,
        added_date: res.addedDate,
      };
    }
  }

  async fetchCatalogues(
    loggedInUserId: number,
    queryParams: CatalogueQueryParams,
    isDeleted: boolean
  ): Promise<CatalogRes[]> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    
    return await catalogueRepository.fetchCatalogues(companyId, queryParams, isDeleted);
  }

  async fetchCatalogueData(
    loggedInUserId: number,
    catalogueId: number,
    isDeleted: boolean
  ): Promise<CatalogRes> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    const data = await catalogueRepository.fetchCatalogueData(companyId, catalogueId, isDeleted);

    if (!data) {
      throw new Error('Catalogue not found');
    }

    return data;
  }

  async deleteCatalogue(req: SoftDeleteRestoreCatalogueReq): Promise<void> {
    await catalogueRepository.softDeleteCatalogue(req.catalogue_ids);
  }

  async fetchTotalCataloguesCount(
    loggedInUserId: number,
    queryParams: CatalogueQueryParams,
    isDeleted: boolean
  ): Promise<number> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    return await catalogueRepository.fetchTotalCataloguesCount(companyId, queryParams, isDeleted);
  }

  async checkCatalogueIdsExist(
    loggedInUserId: number,
    req: SoftDeleteRestoreCatalogueReq,
    isDeleted: boolean
  ): Promise<number[]> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    const existingIds = await catalogueRepository.checkCatalogueIdsExist(
      companyId,
      req.catalogue_ids,
      isDeleted
    );

    if (existingIds.length === 0) {
      throw new Error('No catalogues found');
    }

    return existingIds;
  }

  async restoreCatalogue(req: SoftDeleteRestoreCatalogueReq): Promise<void> {
    await catalogueRepository.restoreCatalogue(req.catalogue_ids);
  }

  async fetchRestoredCatalogueData(catalogueIds: number[]): Promise<CatalogRes[]> {
    return await catalogueRepository.fetchRestoredCataloguesDataViaCatalogueIds(catalogueIds);
  }

  async fetchPublicCatalogueProducts(idOrSlug: number | string, customerPhone: string | null) {
    let catalogue;
    let targetId = 0;

    if (typeof idOrSlug === 'number') {
      catalogue = await catalogueRepository.fetchPublicCatalogueData(idOrSlug);
      targetId = idOrSlug;
    } else {
      catalogue = await catalogueRepository.fetchPublicCatalogueDataBySlug(idOrSlug);
      if (catalogue) {
        targetId = catalogue.catalogueId;
      }
    }

    if (!catalogue) {
      throw new Error('Catalogue not found');
    }

    if (catalogue.privacyLevel === 'PRIVATE') {
      if (!customerPhone) {
        throw new Error('REQUIRES_ACCESS');
      }
      const hasAccess = await catalogueRepository.hasCustomerAccess(targetId, customerPhone);
      if (!hasAccess) {
        throw new Error('REQUIRES_ACCESS');
      }
    }

    const products = await productRepository.fetchProductsByCatalogue(targetId, catalogue.companyId);
    return {
      title: catalogue.title,
      privacyLevel: catalogue.privacyLevel,
      bannerText: catalogue.bannerText,
      bannerActive: catalogue.bannerActive,
      bannerImgPath: catalogue.bannerImgPath,
      products,
    };
  }

  async createAccessRequest(catalogueId: number, phone: string, name: string): Promise<void> {
    await catalogueRepository.createAccessRequest(catalogueId, phone, name);
  }

  async fetchAccessRequests(loggedInUserId: number): Promise<any[]> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    return await catalogueRepository.fetchAccessRequests(companyId);
  }

  async updateAccessRequest(loggedInUserId: number, accessId: number, status: string, expiresAt: Date | null): Promise<void> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    await catalogueRepository.updateAccessRequest(accessId, companyId, status, expiresAt);
  }

  async updateCataloguePrivacy(loggedInUserId: number, catalogueId: number, privacyLevel: string): Promise<void> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    await catalogueRepository.updateCataloguePrivacy(catalogueId, companyId, privacyLevel);
  }

  async cloneCatalogue(loggedInUserId: number, catalogueId: number, customName: string): Promise<CatalogRes> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    return await catalogueRepository.cloneCatalogue(loggedInUserId, companyId, catalogueId, customName);
  }

  async updateCatalogueBanner(
    loggedInUserId: number,
    catalogueId: number,
    bannerText: string | null,
    bannerActive: boolean,
    bannerImgPath: string | null,
  ): Promise<void> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    await catalogueRepository.updateCatalogueBanner(catalogueId, companyId, bannerText, bannerActive, bannerImgPath);
  }
}

export const catalogueService = new CatalogueService();
