import { OrderRepository } from './order.repository';
import { customerGroupRepository } from '../customer-group/customerGroup.repository';
import { prisma } from '../../config/database';
import {
  assertClientItemPrice,
  assertCouponDiscountPercent,
  assertSlabPriceNotAboveBase,
  assertValidOrderQuantity,
  getServerItemPrice,
  resolveBaseUnitPrice,
} from './order.pricing';

jest.mock('../../config/database', () => ({
  prisma: {
    catalogue: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('../customer-group/customerGroup.repository', () => ({
  customerGroupRepository: {
    resolveGroupByPhone: jest.fn(),
    fetchPriceMapForGroup: jest.fn(),
  },
}));

jest.mock('../../utils/notification', () => ({
  getUserIdByCompanyId: jest.fn(),
  sendMerchantNotification: jest.fn(),
}));

const mockPrisma = prisma as unknown as {
  catalogue: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};
const mockGroupRepo = customerGroupRepository as jest.Mocked<typeof customerGroupRepository>;

function product(overrides: Partial<{
  productId: bigint;
  product: string;
  price: number;
  gstRate: number;
  minimumOrderQty: number | null;
  bulkDiscounts: Array<{
    minQty: number;
    maxQty: number | null;
    discountedPrice: number | null;
    discountPercent: number | null;
    sortOrder: number;
  }>;
}> = {}) {
  return {
    productId: BigInt(101),
    product: 'Test Tee',
    sku: 'SKU-1',
    price: 100,
    gstRate: 0,
    minimumOrderQty: null,
    bulkDiscounts: [],
    ...overrides,
  };
}

describe('order.pricing (via order.repository suite)', () => {
  describe('getServerItemPrice — standard retail', () => {
    it('returns base price for qty 1 with no slabs', () => {
      expect(getServerItemPrice({ price: 500, bulkDiscounts: [] }, 1)).toBe(500);
    });

    it('returns zero when price is null and no slabs', () => {
      expect(getServerItemPrice({ price: null, bulkDiscounts: [] }, 3)).toBe(0);
    });
  });

  describe('getServerItemPrice — quantity slabs', () => {
    const slabs = [
      { minQty: 1, maxQty: 9, discountedPrice: 100, discountPercent: null },
      { minQty: 10, maxQty: 49, discountedPrice: 90, discountPercent: null },
      { minQty: 50, maxQty: null, discountedPrice: 80, discountPercent: null },
    ];

    it('applies first slab at lower boundary (qty 1)', () => {
      expect(getServerItemPrice({ price: 100, bulkDiscounts: slabs }, 1)).toBe(100);
    });

    it('applies middle slab at boundary qty 10', () => {
      expect(getServerItemPrice({ price: 100, bulkDiscounts: slabs }, 10)).toBe(90);
    });

    it('applies top open-ended slab at qty 50', () => {
      expect(getServerItemPrice({ price: 100, bulkDiscounts: slabs }, 50)).toBe(80);
    });

    it('uses aggregate qty semantics at boundary 49 vs 50', () => {
      expect(getServerItemPrice({ price: 100, bulkDiscounts: slabs }, 49)).toBe(90);
      expect(getServerItemPrice({ price: 100, bulkDiscounts: slabs }, 50)).toBe(80);
    });

    it('does not raise price above base when slab discounted price is higher', () => {
      const badSlab = [{ minQty: 5, maxQty: null, discountedPrice: 120, discountPercent: null }];
      expect(getServerItemPrice({ price: 100, bulkDiscounts: badSlab }, 10)).toBe(100);
      expect(assertSlabPriceNotAboveBase(120, 100)).toBe(false);
    });

    it('applies percent discount slab', () => {
      const pctSlab = [{ minQty: 10, maxQty: null, discountedPrice: null, discountPercent: 10 }];
      expect(getServerItemPrice({ price: 200, bulkDiscounts: pctSlab }, 10)).toBe(180);
    });

    it('returns base price for non-positive qty (edge)', () => {
      expect(getServerItemPrice({ price: 100, bulkDiscounts: slabs }, 0)).toBe(100);
      expect(getServerItemPrice({ price: 100, bulkDiscounts: slabs }, -3)).toBe(100);
    });
  });

  describe('wholesale group overrides', () => {
    it('resolveBaseUnitPrice prefers group override over retail', () => {
      expect(resolveBaseUnitPrice(500, 420)).toBe(420);
      expect(resolveBaseUnitPrice(500, undefined)).toBe(500);
    });

    it('calculates slab from group base price', () => {
      const slabs = [{ minQty: 10, maxQty: null, discountedPrice: 400, discountPercent: null }];
      expect(getServerItemPrice({ price: 420, bulkDiscounts: slabs }, 12)).toBe(400);
    });
  });

  describe('validation helpers', () => {
    it('rejects MOQ violations', () => {
      expect(() => assertValidOrderQuantity(4, 5, 'Widget')).toThrow(/minimum order of 5/);
    });

    it('rejects zero and negative quantities', () => {
      expect(() => assertValidOrderQuantity(0, 0, 'Widget')).toThrow('Invalid quantity');
      expect(() => assertValidOrderQuantity(-1, 0, 'Widget')).toThrow('Invalid quantity');
    });

    it('rejects client price drift beyond tolerance', () => {
      expect(() => assertClientItemPrice(99, 100)).toThrow('Price validation failed');
      expect(() => assertClientItemPrice(99.6, 100)).not.toThrow();
    });

    it('rejects coupon discount above 20% of discounted subtotal', () => {
      expect(() => assertCouponDiscountPercent(25, 100)).toThrow('Invalid discount value');
      expect(() => assertCouponDiscountPercent(20, 100)).not.toThrow();
    });
  });
});

describe('OrderRepository.bookOrder', () => {
  const repo = new OrderRepository();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGroupRepo.resolveGroupByPhone.mockResolvedValue(null);
    mockGroupRepo.fetchPriceMapForGroup.mockResolvedValue(new Map());
  });

  function mockSuccessfulTransaction() {
    const createdOrder = { orderId: BigInt(9001), total: 180 };
    const tx = {
      product: {
        findMany: jest.fn().mockResolvedValue([
          product({
            bulkDiscounts: [
              { minQty: 1, maxQty: 9, discountedPrice: 100, discountPercent: null, sortOrder: 0 },
              { minQty: 10, maxQty: null, discountedPrice: 90, discountPercent: null, sortOrder: 1 },
            ],
          }),
        ]),
      },
      order: { create: jest.fn().mockResolvedValue(createdOrder) },
      orderItem: { create: jest.fn().mockResolvedValue({}) },
      productVariantOption: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      productVariantInventory: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    mockPrisma.$transaction.mockImplementation(async (cb: (client: unknown) => Promise<unknown>) => cb(tx));
    return tx;
  }

  it('accepts standard retail checkout with slab pricing at aggregate qty 10', async () => {
    mockPrisma.catalogue.findUnique.mockResolvedValue({ companyId: BigInt(1) } as never);
    mockSuccessfulTransaction();

    const result = await repo.bookOrder(55, {
      customer_name: 'Retail Buyer',
      customer_phone: '9876543210',
      customer_address: 'Test',
      subtotal: 1000,
      discount: 100,
      shipping: 0,
      total: 900,
      items: [{ product_id: 101, qty: 10, price: 90 }],
    });

    expect(result.order_id).toBe('9001');
  });

  it('applies wholesaler group override before slab validation', async () => {
    mockPrisma.catalogue.findUnique.mockResolvedValue({ companyId: BigInt(1) } as never);
    mockGroupRepo.resolveGroupByPhone.mockResolvedValue({ id: 7, name: 'VIP' });
    mockGroupRepo.fetchPriceMapForGroup.mockResolvedValue(new Map([[101, 420]]));

    const tx = {
      product: {
        findMany: jest.fn().mockResolvedValue([
          product({
            price: 500,
            bulkDiscounts: [
              { minQty: 10, maxQty: null, discountedPrice: 400, discountPercent: null, sortOrder: 0 },
            ],
          }),
        ]),
      },
      order: { create: jest.fn().mockResolvedValue({ orderId: BigInt(9002), total: 4000 }) },
      orderItem: { create: jest.fn().mockResolvedValue({}) },
      productVariantOption: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      productVariantInventory: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    mockPrisma.$transaction.mockImplementation(async (cb: (client: unknown) => Promise<unknown>) => cb(tx));

    await repo.bookOrder(55, {
      customer_name: 'VIP Buyer',
      customer_phone: '9999999999',
      customer_address: 'Test',
      subtotal: 4200,
      discount: 200,
      shipping: 0,
      total: 4000,
      items: [{ product_id: 101, qty: 10, price: 400 }],
    });

    expect(mockGroupRepo.fetchPriceMapForGroup).toHaveBeenCalledWith(7, [101]);
    expect(tx.order.create).toHaveBeenCalled();
  });

  it('rejects checkout when client item price does not match server slab price', async () => {
    mockPrisma.catalogue.findUnique.mockResolvedValue({ companyId: BigInt(1) } as never);
    mockSuccessfulTransaction();

    await expect(
      repo.bookOrder(55, {
        customer_name: 'Bad Price',
        customer_phone: '9876543210',
        customer_address: 'Test',
        subtotal: 100,
        discount: 0,
        shipping: 0,
        total: 100,
        items: [{ product_id: 101, qty: 1, price: 50 }],
      }),
    ).rejects.toThrow('Price validation failed');
  });

  it('rejects invalid quantity (zero)', async () => {
    mockPrisma.catalogue.findUnique.mockResolvedValue({ companyId: BigInt(1) } as never);
    mockSuccessfulTransaction();

    await expect(
      repo.bookOrder(55, {
        customer_name: 'Zero Qty',
        customer_phone: '9876543210',
        customer_address: 'Test',
        subtotal: 0,
        discount: 0,
        shipping: 0,
        total: 0,
        items: [{ product_id: 101, qty: 0, price: 100 }],
      }),
    ).rejects.toThrow('Invalid quantity');
  });
});
