import { socialMediaRepository } from './socialMedia.repository';
import { companyRepository } from '../company/company.repository';
import { SocialMediaMasterRes, CompanySocialMediaRes } from './socialMedia.interface';

export class SocialMediaService {
  async fetchSocialMedia(): Promise<SocialMediaMasterRes[]> {
    return await socialMediaRepository.fetchSocialMedia();
  }

  async fetchCompanySocialMedia(loggedInUserId: number): Promise<CompanySocialMediaRes[]> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    return await socialMediaRepository.fetchCompanySocialMedia(companyId);
  }
}

export const socialMediaService = new SocialMediaService();
