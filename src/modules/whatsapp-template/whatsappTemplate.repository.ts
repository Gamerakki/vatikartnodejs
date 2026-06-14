import { prisma } from '../../config/database';

export class WhatsAppTemplateRepository {
  async fetchByCompanyId(companyId: number) {
    const template = await prisma.whatsAppTemplate.findUnique({
      where: { companyId: BigInt(companyId) },
    });

    return template;
  }

  async upsertByCompanyId(companyId: number, payload: { catalogShareText?: string; orderConfirmText?: string }) {
    const template = await prisma.whatsAppTemplate.upsert({
      where: { companyId: BigInt(companyId) },
      update: {
        ...(payload.catalogShareText !== undefined ? { catalogShareText: payload.catalogShareText } : {}),
        ...(payload.orderConfirmText !== undefined ? { orderConfirmText: payload.orderConfirmText } : {}),
      },
      create: {
        companyId: BigInt(companyId),
        catalogShareText: payload.catalogShareText ?? 'Check out our catalog: {link}',
        orderConfirmText: payload.orderConfirmText ?? 'Your order {order_id} of total {total} is confirmed!',
      },
    });

    return template;
  }
}

export const whatsappTemplateRepository = new WhatsAppTemplateRepository();
