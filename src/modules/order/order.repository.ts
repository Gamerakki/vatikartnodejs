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

  async bookOrder(
    catalogueId: number,
    data: {
      customer_name: string;
      customer_phone: string;
      customer_address: string;
      subtotal: number;
      discount: number;
      shipping: number;
      total: number;
      items: {
        product_id: number;
        qty: number;
        price: number;
        selected_size?: string | null;
        selected_color?: string | null;
      }[];
    }
  ) {
    const catBig = BigInt(catalogueId);

    // Get companyId from catalogue
    const catalogue = await prisma.catalogue.findUnique({
      where: { catalogueId: catBig },
      select: { companyId: true },
    });

    if (!catalogue) {
      throw new Error('Catalogue not found');
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Fetch products and check prices, slabs, MOQ, and GST
      const productIds = data.items.map((item) => BigInt(item.product_id));
      const dbProducts = await tx.product.findMany({
        where: { productId: { in: productIds } },
        include: {
          bulkDiscounts: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });

      const productMap = new Map(dbProducts.map((p) => [Number(p.productId), p]));
      let calculatedSubtotal = 0;
      let calculatedTax = 0;

      for (const item of data.items) {
        const dbProduct = productMap.get(item.product_id);
        if (!dbProduct) {
          throw new Error(`Product ID ${item.product_id} not found`);
        }

        // Validate MOQ (Minimum Order Quantity)
        const moq = dbProduct.minimumOrderQty ?? 0;
        if (moq > 0 && item.qty < moq) {
          throw new Error(`Product "${dbProduct.product}" requires a minimum order of ${moq} units.`);
        }

        // Determine price, checking slabs
        let itemPrice = dbProduct.price ? Number(dbProduct.price) : 0;
        const slabs = dbProduct.bulkDiscounts;
        for (const slab of slabs) {
          if (item.qty >= slab.minQty && (slab.maxQty === null || item.qty <= slab.maxQty)) {
            if (slab.discountedPrice != null) {
              itemPrice = Number(slab.discountedPrice);
            } else if (slab.discountPercent != null && dbProduct.price != null) {
              const basePrice = Number(dbProduct.price);
              itemPrice = basePrice * (1 - Number(slab.discountPercent) / 100);
            }
          }
        }

        // Overwrite client-provided item price with secure server-validated price
        item.price = itemPrice;
        const itemSubtotal = itemPrice * item.qty;
        calculatedSubtotal += itemSubtotal;

        // Dynamic tax calculation per product
        const gstRate = dbProduct.gstRate ? Number(dbProduct.gstRate) : 0;
        calculatedTax += itemSubtotal * (gstRate / 100);
      }

      const serverSubtotal = Number(calculatedSubtotal.toFixed(2));
      const serverTax = Number(calculatedTax.toFixed(2));
      const serverTotal = Number(
        (serverSubtotal - data.discount + data.shipping + serverTax).toFixed(2)
      );

      // Verify that client totals do not deviate significantly (allowing ₹1 rounding tolerance)
      if (Math.abs(data.subtotal - serverSubtotal) > 1.0 || Math.abs(data.total - serverTotal) > 1.0) {
        throw new Error('Price verification failed. Some prices or taxes have changed. Please refresh your cart.');
      }

      // Commit exact server calculations to DB
      data.subtotal = serverSubtotal;
      data.total = serverTotal;

      // 2. Create Order
      const newOrder = await tx.order.create({
        data: {
          customerName: data.customer_name,
          customerPhone: data.customer_phone,
          customerAddress: data.customer_address,
          status: 'UNCONFIRMED',
          subtotal: data.subtotal,
          discount: data.discount,
          shipping: data.shipping,
          total: data.total,
          companyId: catalogue.companyId,
        },
      });

      // 3. Create Order Items & Deduct Stock
      for (const item of data.items) {
        const prodBig = BigInt(item.product_id);
        const dbProduct = productMap.get(item.product_id);

        if (!dbProduct) {
          throw new Error(`Product ID ${item.product_id} not found`);
        }

        await tx.orderItem.create({
          data: {
            orderId: newOrder.orderId,
            productId: prodBig,
            title: dbProduct.product,
            sku: dbProduct.sku || '',
            qty: item.qty,
            price: item.price,
          },
        });

        // Try to deduct inventory if the product has size options
        if (item.selected_size) {
          // Find the variant option matching selected size
          const sizeOption = await tx.productVariantOption.findFirst({
            where: {
              productId: prodBig,
              optionType: 'size',
              label: { equals: item.selected_size, mode: 'insensitive' },
            },
          });

          if (sizeOption) {
            // Find inventory entry
            const inventory = await tx.productVariantInventory.findFirst({
              where: { productId: prodBig, optionId: sizeOption.optionId },
            });

            if (inventory) {
              const newQty = Math.max(0, inventory.quantity - item.qty);
              await tx.productVariantInventory.update({
                where: { inventoryId: inventory.inventoryId },
                data: { quantity: newQty },
              });
            }
          }
        } else {
          // If no size is specified, check if there is exactly one size option for this product
          // (covers both optionless 'One Size' and set products with a single standard option)
          const sizeOptions = await tx.productVariantOption.findMany({
            where: {
              productId: prodBig,
              optionType: 'size',
            },
          });

          if (sizeOptions.length === 1) {
            const onlyOption = sizeOptions[0];
            const inventory = await tx.productVariantInventory.findFirst({
              where: { productId: prodBig, optionId: onlyOption.optionId },
            });

            if (inventory) {
              const newQty = Math.max(0, inventory.quantity - item.qty);
              await tx.productVariantInventory.update({
                where: { inventoryId: inventory.inventoryId },
                data: { quantity: newQty },
              });
            }
          }
        }
      }

      return {
        order_id: newOrder.orderId.toString(),
        total: Number(newOrder.total),
      };
    });
  }
}

export const orderRepository = new OrderRepository();
