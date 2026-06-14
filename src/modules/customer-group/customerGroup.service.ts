import { companyRepository } from '../company/company.repository';
import { customerGroupRepository } from './customerGroup.repository';

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-12);
}

export class CustomerGroupService {
  async fetchGroups(loggedInUserId: number) {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    return customerGroupRepository.fetchGroups(companyId);
  }

  async saveGroup(loggedInUserId: number, payload: { id?: number; name: string; description?: string | null }) {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    return customerGroupRepository.saveGroup(companyId, payload);
  }

  async deleteGroup(loggedInUserId: number, groupId: number) {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    return customerGroupRepository.deleteGroup(companyId, groupId);
  }

  async fetchGroupMembers(loggedInUserId: number, groupId: number) {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    return customerGroupRepository.fetchGroupMembers(companyId, groupId);
  }

  async addGroupMember(loggedInUserId: number, payload: { group_id: number; customer_phone: string; customer_name?: string | null }) {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    return customerGroupRepository.addGroupMember(companyId, {
      ...payload,
      customer_phone: normalizePhone(payload.customer_phone),
    });
  }

  async deleteGroupMember(loggedInUserId: number, memberId: number) {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    return customerGroupRepository.deleteGroupMember(companyId, memberId);
  }

  async saveGroupPrices(loggedInUserId: number, payload: { group_id: number; product_prices: Array<{ product_id: number; custom_price: number }> }) {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    return customerGroupRepository.saveGroupPrices(companyId, payload.group_id, payload.product_prices);
  }

  async fetchGroupPrices(loggedInUserId: number, groupId: number, catalogueId?: number) {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(loggedInUserId);
    return customerGroupRepository.fetchGroupPrices(companyId, groupId, catalogueId);
  }

  async resolveGroupForPublicCustomer(companyId: number, customerPhone: string) {
    return customerGroupRepository.resolveGroupByPhone(companyId, normalizePhone(customerPhone));
  }

  async fetchPriceMapForGroup(groupId: number, productIds: number[]) {
    return customerGroupRepository.fetchPriceMapForGroup(groupId, productIds);
  }
}

export const customerGroupService = new CustomerGroupService();
