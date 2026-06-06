import { prisma } from '../../config/database';
import { OrderItemRes, OrderDetailRes, OrderStatus } from './order.interface';

export class OrderRepository {
  async fetchOrdersByCompany(companyId: number): Promise<OrderItemRes[]> {
    const orders = await prisma.order.findMany({
      where: {
        companyId: BigInt(companyId),
      },
      include: {
        items: {
          where: {
            deletedByCustomer: false,
          },
        },
      },
      orderBy: {
        addedDate: 'desc',
      },
    });

    return orders.map((order) => {
      const itemCount = order.items.length;
      return {
        id: order.orderId.toString(),
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerAddress: order.customerAddress,
        total: Number(order.total),
        itemCount,
        createdAt: order.addedDate.toISOString(),
        status: order.status as OrderStatus,
        isNew: order.status === 'UNCONFIRMED',
      };
    });
  }

  async fetchOrderById(orderId: number, companyId: number): Promise<OrderDetailRes | null> {
    const order = await prisma.order.findFirst({
      where: {
        orderId: BigInt(orderId),
        companyId: BigInt(companyId),
      },
      include: {
        items: true,
      },
    });

    if (!order) return null;

    return {
      id: order.orderId.toString(),
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.customerAddress,
      createdAt: order.addedDate.toISOString(),
      status: order.status as OrderStatus,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      shipping: Number(order.shipping),
      total: Number(order.total),
      items: order.items.map((item) => ({
        id: item.itemId.toString(),
        title: item.title,
        sku: item.sku,
        qty: item.qty,
        price: Number(item.price),
        deletedByCustomer: item.deletedByCustomer,
      })),
    };
  }

  async updateOrderStatus(
    orderId: number,
    companyId: number,
    status: OrderStatus
  ): Promise<OrderDetailRes> {
    const orderBig = BigInt(orderId);
    const companyBig = BigInt(companyId);

    // Verify first
    const exists = await prisma.order.count({
      where: { orderId: orderBig, companyId: companyBig },
    });
    if (exists === 0) {
      throw new Error('Order not found');
    }

    const updated = await prisma.order.update({
      where: { orderId: orderBig },
      data: { status },
      include: { items: true },
    });

    return {
      id: updated.orderId.toString(),
      customerName: updated.customerName,
      customerPhone: updated.customerPhone,
      customerAddress: updated.customerAddress,
      createdAt: updated.addedDate.toISOString(),
      status: updated.status as OrderStatus,
      subtotal: Number(updated.subtotal),
      discount: Number(updated.discount),
      shipping: Number(updated.shipping),
      total: Number(updated.total),
      items: updated.items.map((item) => ({
        id: item.itemId.toString(),
        title: item.title,
        sku: item.sku,
        qty: item.qty,
        price: Number(item.price),
        deletedByCustomer: item.deletedByCustomer,
      })),
    };
  }

  async updateOrderDiscount(
    orderId: number,
    companyId: number,
    discount: number
  ): Promise<OrderDetailRes> {
    const orderBig = BigInt(orderId);
    const companyBig = BigInt(companyId);

    const order = await prisma.order.findFirst({
      where: { orderId: orderBig, companyId: companyBig },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const subtotalNum = Number(order.subtotal);
    const shippingNum = Number(order.shipping);
    const safeDiscount = Math.max(0, Math.min(discount, subtotalNum));
    const total = subtotalNum - safeDiscount + shippingNum;

    const updated = await prisma.order.update({
      where: { orderId: orderBig },
      data: {
        discount: safeDiscount,
        total: total,
      },
      include: { items: true },
    });

    return {
      id: updated.orderId.toString(),
      customerName: updated.customerName,
      customerPhone: updated.customerPhone,
      customerAddress: updated.customerAddress,
      createdAt: updated.addedDate.toISOString(),
      status: updated.status as OrderStatus,
      subtotal: Number(updated.subtotal),
      discount: Number(updated.discount),
      shipping: Number(updated.shipping),
      total: Number(updated.total),
      items: updated.items.map((item) => ({
        id: item.itemId.toString(),
        title: item.title,
        sku: item.sku,
        qty: item.qty,
        price: Number(item.price),
        deletedByCustomer: item.deletedByCustomer,
      })),
    };
  }

  async updateOrderShipping(
    orderId: number,
    companyId: number,
    shipping: number
  ): Promise<OrderDetailRes> {
    const orderBig = BigInt(orderId);
    const companyBig = BigInt(companyId);

    const order = await prisma.order.findFirst({
      where: { orderId: orderBig, companyId: companyBig },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const subtotalNum = Number(order.subtotal);
    const discountNum = Number(order.discount);
    const safeShipping = Math.max(0, shipping);
    const total = subtotalNum - discountNum + safeShipping;

    const updated = await prisma.order.update({
      where: { orderId: orderBig },
      data: {
        shipping: safeShipping,
        total: total,
      },
      include: { items: true },
    });

    return {
      id: updated.orderId.toString(),
      customerName: updated.customerName,
      customerPhone: updated.customerPhone,
      customerAddress: updated.customerAddress,
      createdAt: updated.addedDate.toISOString(),
      status: updated.status as OrderStatus,
      subtotal: Number(updated.subtotal),
      discount: Number(updated.discount),
      shipping: Number(updated.shipping),
      total: Number(updated.total),
      items: updated.items.map((item) => ({
        id: item.itemId.toString(),
        title: item.title,
        sku: item.sku,
        qty: item.qty,
        price: Number(item.price),
        deletedByCustomer: item.deletedByCustomer,
      })),
    };
  }
}

export const orderRepository = new OrderRepository();
