export type OrderStatus = 'UNCONFIRMED' | 'CONFIRMED' | 'ACCEPTED' | 'COMPLETED' | 'REJECTED';

export interface OrderItemRes {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  total: number;
  itemCount: number;
  createdAt: string;
  status: OrderStatus;
  isNew: boolean;
}

export interface OrderLineItemRes {
  id: string;
  title: string;
  sku: string | null;
  qty: number;
  price: number;
  deletedByCustomer: boolean;
}

export interface OrderDetailRes {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  createdAt: string;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  items: OrderLineItemRes[];
}

export interface UpdateOrderStatusReq {
  order_id: string;
  status: OrderStatus;
}

export interface UpdateOrderDiscountReq {
  order_id: string;
  discount: number;
}

export interface UpdateOrderShippingReq {
  order_id: string;
  shipping: number;
}
