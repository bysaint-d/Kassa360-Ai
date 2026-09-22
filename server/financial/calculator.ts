// Centralized Server-Side Financial Calculation Engine
// Guarantees mathematical accuracy, double-discount bug prevention, and audit-proof financial records

export function roundMoney(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export interface ValidatedLineItem {
  productId: string;
  variantId?: string;
  productName: string;
  productBarcode?: string;
  brand?: string;
  color?: string;
  colorHex?: string;
  size?: string;
  comment?: string;
  quantity: number;
  originalPrice: number; // Immutable unit price before discounts
  discountAmount: number; // Unit line discount in AZN
  salePrice: number; // Unit price after item discount
  costPrice: number;
  total: number; // Subtotal for this line item: (originalPrice - discountAmount) * quantity
  profit: number;
}

export interface ValidatedFinancialSale {
  subtotal: number;
  itemDiscountsTotal: number;
  subtotalAfterItemDiscounts: number;
  globalDiscount: number;
  globalDiscountPercent: number;
  totalDiscount: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  debtAmount: number;
  items: ValidatedLineItem[];
}

export function calculateServerSale(
  rawItems: Array<{
    productId: string;
    variantId?: string;
    productName: string;
    productBarcode?: string;
    brand?: string;
    color?: string;
    colorHex?: string;
    size?: string;
    comment?: string;
    quantity: number;
    dbOriginalPrice: number;
    dbCostPrice: number;
    requestedDiscountAmount?: number;
  }>,
  globalDiscountAmount: number = 0,
  paidAmount: number = 0,
  paymentMethod: 'Nağd' | 'Kart' | 'Borc' = 'Nağd'
): ValidatedFinancialSale {
  let grossSubtotal = 0;
  let totalItemDiscounts = 0;

  const validatedItems: ValidatedLineItem[] = [];

  for (const item of rawItems) {
    const qty = Math.max(1, Math.floor(item.quantity || 1));
    const origPrice = roundMoney(item.dbOriginalPrice);
    const costPrice = roundMoney(item.dbCostPrice);
    
    // Sanitize item discount (cannot exceed original price)
    const lineDiscount = Math.min(origPrice, Math.max(0, roundMoney(item.requestedDiscountAmount || 0)));
    const unitSalePrice = roundMoney(origPrice - lineDiscount);
    const lineTotal = roundMoney(unitSalePrice * qty);

    grossSubtotal += roundMoney(origPrice * qty);
    totalItemDiscounts += roundMoney(lineDiscount * qty);

    validatedItems.push({
      productId: item.productId,
      variantId: item.variantId,
      productName: item.productName,
      productBarcode: item.productBarcode,
      brand: item.brand,
      color: item.color,
      colorHex: item.colorHex,
      size: item.size,
      comment: item.comment?.trim() || undefined,
      quantity: qty,
      originalPrice: origPrice,
      discountAmount: lineDiscount,
      salePrice: unitSalePrice,
      costPrice: costPrice,
      total: lineTotal,
      profit: 0, // Calculated after global discount allocation
    });
  }

  grossSubtotal = roundMoney(grossSubtotal);
  totalItemDiscounts = roundMoney(totalItemDiscounts);
  const subtotalAfterItemDiscounts = roundMoney(Math.max(0, grossSubtotal - totalItemDiscounts));

  // Global discount cannot exceed subtotalAfterItemDiscounts
  const effectiveGlobalDiscount = roundMoney(
    Math.min(subtotalAfterItemDiscounts, Math.max(0, globalDiscountAmount || 0))
  );

  const finalTotal = roundMoney(Math.max(0, subtotalAfterItemDiscounts - effectiveGlobalDiscount));
  const totalCombinedDiscount = roundMoney(totalItemDiscounts + effectiveGlobalDiscount);
  const globalDiscountPercent =
    subtotalAfterItemDiscounts > 0
      ? roundMoney((effectiveGlobalDiscount / subtotalAfterItemDiscounts) * 100)
      : 0;

  // Distribute global discount proportionally across items to accurately determine revenue & profit
  for (const itm of validatedItems) {
    const itemShareRatio =
      subtotalAfterItemDiscounts > 0 ? itm.total / subtotalAfterItemDiscounts : 0;
    const itemGlobalDiscount = roundMoney(effectiveGlobalDiscount * itemShareRatio);
    const finalItemRevenue = roundMoney(Math.max(0, itm.total - itemGlobalDiscount));
    const finalItemCost = roundMoney(itm.costPrice * itm.quantity);
    itm.profit = roundMoney(finalItemRevenue - finalItemCost);
  }

  let finalPaid = roundMoney(paidAmount || 0);
  let finalChange = 0;
  let finalDebt = 0;

  if (paymentMethod === 'Borc') {
    finalDebt = roundMoney(Math.max(0, finalTotal - finalPaid));
  } else {
    if (finalPaid === 0 || finalPaid < finalTotal) {
      finalPaid = finalTotal;
    }
    finalChange = roundMoney(Math.max(0, finalPaid - finalTotal));
    finalDebt = 0;
  }

  return {
    subtotal: grossSubtotal,
    itemDiscountsTotal: totalItemDiscounts,
    subtotalAfterItemDiscounts: subtotalAfterItemDiscounts,
    globalDiscount: effectiveGlobalDiscount,
    globalDiscountPercent: globalDiscountPercent,
    totalDiscount: totalCombinedDiscount,
    total: finalTotal,
    paidAmount: finalPaid,
    changeAmount: finalChange,
    debtAmount: finalDebt,
    items: validatedItems,
  };
}
