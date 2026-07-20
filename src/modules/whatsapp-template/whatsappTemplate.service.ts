import { companyRepository } from '../company/company.repository';
import { compileTemplate } from '../../utils/template';
import { whatsappTemplateRepository } from './whatsappTemplate.repository';

const DEFAULTS = {
  catalogShareText: 'Check out our catalog: {link}',
  productShareText: 'Hey! Check out *{product_name}*\nPrice: {price}\nBuy online here: {link}',
  orderConfirmText: 'Your order {order_id} of total {total} is confirmed!',
};

export class WhatsAppTemplateService {
  async fetchForUser(loggedInUserId: number) {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    const template = await whatsappTemplateRepository.fetchByCompanyId(companyId);

    return {
      catalog_share_text: template?.catalogShareText ?? DEFAULTS.catalogShareText,
      product_share_text: template?.productShareText ?? DEFAULTS.productShareText,
      order_confirm_text: template?.orderConfirmText ?? DEFAULTS.orderConfirmText,
    };
  }

  async saveForUser(
    loggedInUserId: number,
    payload: { catalog_share_text?: string; product_share_text?: string; order_confirm_text?: string },
  ) {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    const template = await whatsappTemplateRepository.upsertByCompanyId(companyId, {
      catalogShareText: payload.catalog_share_text,
      productShareText: payload.product_share_text,
      orderConfirmText: payload.order_confirm_text,
    });

    return {
      catalog_share_text: template.catalogShareText,
      product_share_text: template.productShareText,
      order_confirm_text: template.orderConfirmText,
    };
  }

  async fetchProductShareTemplateForUser(loggedInUserId: number) {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    const template = await whatsappTemplateRepository.fetchByCompanyId(companyId);
    return template?.productShareText ?? DEFAULTS.productShareText;
  }

  async saveProductShareTemplateForUser(loggedInUserId: number, templateStr: string) {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    const template = await whatsappTemplateRepository.upsertByCompanyId(companyId, {
      productShareText: templateStr,
    });
    return template.productShareText;
  }

  async fetchPublicProductShareTemplate(companyId: number) {
    const template = await whatsappTemplateRepository.fetchByCompanyId(companyId);
    return template?.productShareText ?? DEFAULTS.productShareText;
  }

  async fetchPublicCatalogueTemplate(companyId: number) {
    const template = await whatsappTemplateRepository.fetchByCompanyId(companyId);
    return template?.catalogShareText ?? DEFAULTS.catalogShareText;
  }

  compile(templateStr: string, varsObject: Record<string, string | number | null | undefined>) {
    return compileTemplate(templateStr, varsObject);
  }
}

export const whatsappTemplateService = new WhatsAppTemplateService();
