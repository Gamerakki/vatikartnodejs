import { prisma } from '../../config/database';
import { companyRepository } from '../company/company.repository';

export type ShopperTimelineEvent = {
  id: string;
  type: string;
  details: string;
  timestamp: string;
};

export type ActiveShopperSession = {
  name: string;
  phone: string;
  lastActive: string;
  timeline: ShopperTimelineEvent[];
};

export class AnalyticsService {
  async getActiveShoppers(loggedInUserId: number): Promise<ActiveShopperSession[]> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    if (!companyId) {
      throw Object.assign(new Error('Company not found'), { statusCode: 404 });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const events = await prisma.analyticsEvent.findMany({
      where: {
        companyId: BigInt(companyId),
        eventType: 'STOREFRONT_ACTIVITY',
        addedDate: { gte: since },
      },
      orderBy: { addedDate: 'desc' },
      take: 500,
    });

    const sessions = new Map<string, ActiveShopperSession>();

    for (const event of events) {
      const raw = event.eventValue || '';
      const [nameRaw, idRaw, typeRaw, ...detailsParts] = raw.split('|');
      const name = (nameRaw || 'Guest').trim() || 'Guest';
      const phone = (idRaw || 'Anonymous').trim() || 'Anonymous';
      const type = (typeRaw || 'activity').trim() || 'activity';
      const details = (detailsParts.join('|') || '').trim() || 'Storefront activity';
      const timestamp = event.addedDate.toISOString();

      const key = phone;
      const timelineItem: ShopperTimelineEvent = {
        id: event.id.toString(),
        type,
        details,
        timestamp,
      };

      const existing = sessions.get(key);
      if (existing) {
        existing.timeline.push(timelineItem);
        if (new Date(timestamp).getTime() > new Date(existing.lastActive).getTime()) {
          existing.lastActive = timestamp;
          if (name && name !== 'Guest') existing.name = name;
        }
      } else {
        sessions.set(key, {
          name,
          phone,
          lastActive: timestamp,
          timeline: [timelineItem],
        });
      }
    }

    return [...sessions.values()].sort(
      (a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime(),
    );
  }
}

export const analyticsService = new AnalyticsService();
