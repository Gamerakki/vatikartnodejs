export type BulkDiscountSlab = {
  minQty: number;
  maxQty: number | null;
  discountedPrice: number | null;
  discountPercent: number | null;
};

export type PricedProductInput = {
  price: number | null;
  bulkDiscounts: BulkDiscountSlab[];
};

/** Server-side unit price after bulk / tier slabs (aggregate qty). */
export function getServerItemPrice(dbProduct: PricedProductInput, qty: number): number {
  if (qty <= 0) {
    return dbProduct.price != null ? Number(Number(dbProduct.price).toFixed(2)) : 0;
  }

  let itemPrice = dbProduct.price != null ? Number(dbProduct.price) : 0;

  let lastSlab: BulkDiscountSlab | null = null;
  let maxMinQty = -1;
  for (const slab of dbProduct.bulkDiscounts) {
    const min = Number(slab.minQty) || 0;
    if (min > maxMinQty) {
      maxMinQty = min;
      lastSlab = slab;
    }
  }

  for (const slab of dbProduct.bulkDiscounts) {
    const max = slab === lastSlab ? null : (slab.maxQty != null ? Number(slab.maxQty) : null);
    if (qty >= slab.minQty && (max === null || qty <= max)) {
      if (slab.discountedPrice != null) {
        const slabPrice = Number(slab.discountedPrice);
        if (slabPrice < itemPrice) {
          itemPrice = slabPrice;
        }
      } else if (slab.discountPercent != null && dbProduct.price != null) {
        const pct = Number(slab.discountPercent);
        if (pct > 0) {
          const basePrice = Number(dbProduct.price);
          itemPrice = basePrice * (1 - pct / 100);
        }
      }
    }
  }

  return Number(itemPrice.toFixed(2));
}

export function resolveBaseUnitPrice(
  dbPrice: number | null | undefined,
  groupOverride: number | undefined,
): number {
  if (groupOverride !== undefined) {
    return groupOverride;
  }
  return dbPrice != null ? Number(dbPrice) : 0;
}

export function assertValidOrderQuantity(qty: number, moq: number, productName: string): void {
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error('Invalid quantity');
  }
  if (moq > 0 && qty < moq) {
    throw new Error(`Product "${productName}" requires a minimum order of ${moq} units.`);
  }
}

export function assertSlabPriceNotAboveBase(slabPrice: number, basePrice: number): boolean {
  return slabPrice <= basePrice;
}

export function assertClientItemPrice(clientPrice: number, serverPrice: number, tolerance = 0.5): void {
  if (Math.abs(Number(clientPrice) - serverPrice) > tolerance) {
    throw new Error('Price validation failed; order rejected');
  }
}

export function assertCouponDiscountPercent(couponDiscount: number, discountedSubtotal: number, maxPercent = 0.2): void {
  const couponDiscountPercent = discountedSubtotal > 0 ? couponDiscount / discountedSubtotal : 0;
  if (couponDiscountPercent > maxPercent) {
    throw new Error('Invalid discount value');
  }
}
