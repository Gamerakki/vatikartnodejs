import { orderRepository } from './order.repository';
import { companyRepository } from '../company/company.repository';
import { OrderItemRes, OrderDetailRes, OrderStatus } from './order.interface';

export class OrderService {
  async fetchOrdersByUserId(userId: number): Promise<OrderItemRes[]> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(userId);
    if (!companyId) {
      return [];
    }
    return await orderRepository.fetchOrdersByCompany(companyId);
  }

  async fetchOrderById(orderId: number, userId: number): Promise<OrderDetailRes> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(userId);
    if (!companyId) {
      throw new Error('Company not found');
    }

    const order = await orderRepository.fetchOrderById(orderId, companyId);
    if (!order) {
      throw new Error('Order not found');
    }

    return order;
  }

  async updateOrderStatus(orderId: number, userId: number, status: OrderStatus): Promise<OrderDetailRes> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(userId);
    if (!companyId) {
      throw new Error('Company not found');
    }

    return await orderRepository.updateOrderStatus(orderId, companyId, status);
  }

  async updateOrderDiscount(orderId: number, userId: number, discount: number): Promise<OrderDetailRes> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(userId);
    if (!companyId) {
      throw new Error('Company not found');
    }

    return await orderRepository.updateOrderDiscount(orderId, companyId, discount);
  }

  async updateOrderShipping(orderId: number, userId: number, shipping: number): Promise<OrderDetailRes> {
    const companyId = await companyRepository.fetchCompanyIDViaUserId(userId);
    if (!companyId) {
      throw new Error('Company not found');
    }

    return await orderRepository.updateOrderShipping(orderId, companyId, shipping);
  }
}

export const orderService = new OrderService();
