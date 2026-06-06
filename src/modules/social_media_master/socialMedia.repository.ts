import { prisma } from '../../config/database';
import { SocialMediaMasterRes, CompanySocialMediaRes } from './socialMedia.interface';

export class SocialMediaRepository {
  async fetchSocialMedia(): Promise<SocialMediaMasterRes[]> {
    const list = await prisma.socialMediaMaster.findMany();
    return list.map((item) => ({
      social_media_id: Number(item.socialMediaId),
      social_media: item.socialMedia,
    }));
  }

  async fetchCompanySocialMedia(companyId: number): Promise<CompanySocialMediaRes[]> {
    const companyIdBig = BigInt(companyId);

    const rows = await prisma.$queryRaw<any[]>`
      SELECT smm.social_media_id, smm.social_media, csmm.social_media as link
      FROM social_media_master smm
      LEFT JOIN company_social_media_mapper csmm 
        ON csmm.social_media_id = smm.social_media_id 
        AND csmm.company_id = ${companyIdBig}
    `;

    return rows.map((r) => ({
      social_media_id: Number(r.social_media_id),
      social_media: r.social_media,
      link: r.link || null,
    }));
  }
}

export const socialMediaRepository = new SocialMediaRepository();
