// Centralized financial and discount calculations for Kassa 360
// Prevents duplicate logic and IEEE-754 floating point rounding discrepancies

import { Product, CartRow, SaleItem, Sale, Expense, Income, KassaReport } from '../types';

export const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', 'Standart'] as const;
export const SHOE_SIZES = ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45'] as const;

/**
 * Rounds any number safely to 2 decimal places for AZN currency.
 * Uses Number.EPSILON to avoid binary floating-point roundoff issues.
 */
export const roundMoney = (val: number): number => {
  if (!isFinite(val) || isNaN(val)) return 0;
  return Math.round((val + Number.EPSILON) * 100) / 100;
};

/**
 * Calculates a single cart row given a product, quantity, and item discount amount in AZN.
 */
export interface CalculatedCartRow {
  product: Product;
  quantity: number;
  originalPrice: number;
  discountAmount: number; // Unit discount in AZN (e.g., 2.50 AZN off per unit)
  totalDiscountAmount: number; // Total discount for this row (discountAmount * qty)
  discountedUnitPrice: number;
  total: number; // Final line total
  discountPercent?: number; // Optional derived % for backwards compatibility
}

export const calculateCartRow = (
  product: Product,
  quantity: number,
  discountAmount = 0
): CalculatedCartRow => {
  const qty = Math.max(1, quantity);
  const origPrice = roundMoney(product.salePrice);

  // Unit discount in AZN (cannot be negative, cannot exceed original price)
  const unitDiscount = roundMoney(Math.min(origPrice, Math.max(0, discountAmount || 0)));
  const discountedUnitPrice = roundMoney(Math.max(0, origPrice - unitDiscount));

  // Line total
  const total = roundMoney(discountedUnitPrice * qty);

  // Total discount for this entire row in AZN
  const totalDiscountAmount = roundMoney(unitDiscount * qty);

  const discPct = origPrice > 0 ? roundMoney((unitDiscount / origPrice) * 100) : 0;

  return {
    product,
    quantity: qty,
    originalPrice: origPrice,
    discountAmount: unitDiscount,
    totalDiscountAmount,
    discountedUnitPrice,
    discountPercent: discPct,
    total,
  };
};

/**
 * Totals for the entire cart, combining item-level discounts and global cart discount in AZN.
 */
export interface CartFinancialTotals {
  grossSubtotal: number; // sum(originalPrice * qty)
  itemDiscountsTotal: number; // sum(totalDiscountAmount)
  subtotalAfterItemDiscounts: number; // sum(itemTotal)
  globalDiscountAmount: number; // AZN discount on the cart
  totalDiscount: number; // itemDiscountsTotal + globalDiscountAmount
  finalTotal: number; // final amount payable by customer
  globalDiscountPercent?: number;
}

export const calculateCartTotals = (
  items: { originalPrice: number; discountedUnitPrice: number; total: number; quantity: number }[],
  globalDiscountAmount = 0
): CartFinancialTotals => {
  const grossSubtotal = roundMoney(
    items.reduce((acc, i) => acc + roundMoney(i.originalPrice * i.quantity), 0)
  );

  const subtotalAfterItemDiscounts = roundMoney(
    items.reduce((acc, i) => acc + i.total, 0)
  );

  const itemDiscountsTotal = roundMoney(
    Math.max(0, grossSubtotal - subtotalAfterItemDiscounts)
  );

  const validGlobalDiscount = roundMoney(
    Math.min(subtotalAfterItemDiscounts, Math.max(0, globalDiscountAmount || 0))
  );

  const totalDiscount = roundMoney(itemDiscountsTotal + validGlobalDiscount);
  const finalTotal = roundMoney(Math.max(0, subtotalAfterItemDiscounts - validGlobalDiscount));

  const effectiveGlobalPct =
    subtotalAfterItemDiscounts > 0
      ? roundMoney((validGlobalDiscount / subtotalAfterItemDiscounts) * 100)
      : 0;

  return {
    grossSubtotal,
    itemDiscountsTotal,
    subtotalAfterItemDiscounts,
    globalDiscountAmount: validGlobalDiscount,
    globalDiscountPercent: effectiveGlobalPct,
    totalDiscount,
    finalTotal,
  };
};

/**
 * Computes the exact profit for each sale item when a sale is finalized,
 * distributing any global cart discount proportionally so actual revenue
 * equals customer payment, and actual profit = actual revenue - cost.
 */
export const calculateFinalSaleItems = (
  cartItems: {
    product: Product;
    quantity: number;
    discountAmount?: number; // AZN unit discount
    discountPercent?: number;
    size?: string;
    color?: string;
    colorHex?: string;
    variantId?: string;
    comment?: string;
  }[],
  saleId: number,
  globalDiscountAmount = 0
): {
  saleItems: SaleItem[];
  totals: CartFinancialTotals;
} => {
  // Step 1: Calculate rows with item-level discounts (AZN amount)
  const calculatedRows = cartItems.map((item) => {
    let amt = item.discountAmount || 0;
    if (!amt && item.discountPercent) {
      amt = roundMoney((item.product.salePrice * item.discountPercent) / 100);
    }
    return {
      calc: calculateCartRow(item.product, item.quantity, amt),
      size: item.size || item.product.size || undefined,
      color: item.color || item.product.color || undefined,
      colorHex: item.colorHex || item.product.colorHex || undefined,
      variantId: item.variantId || undefined,
      comment: item.comment?.trim() || undefined,
    };
  });

  // Step 2: Calculate cart financial totals
  const rawRows = calculatedRows.map((c) => c.calc);
  const subtotalAfterItem = roundMoney(rawRows.reduce((acc, r) => acc + r.total, 0));
  const validGlobalDiscount = roundMoney(Math.min(subtotalAfterItem, Math.max(0, globalDiscountAmount)));

  const totals = calculateCartTotals(rawRows, validGlobalDiscount);

  // Step 3: Distribute global discount proportionally across items so revenue and profit are exact
  let allocatedGlobalDiscount = 0;

  const saleItems: SaleItem[] = calculatedRows.map((entry, idx) => {
    const row = entry.calc;
    const isLast = idx === calculatedRows.length - 1;
    let itemShareOfGlobal = 0;

    if (subtotalAfterItem > 0 && validGlobalDiscount > 0) {
      if (isLast) {
        // Guarantee exact sum without rounding pennies lost
        itemShareOfGlobal = roundMoney(validGlobalDiscount - allocatedGlobalDiscount);
      } else {
        itemShareOfGlobal = roundMoney((row.total / subtotalAfterItem) * validGlobalDiscount);
        allocatedGlobalDiscount += itemShareOfGlobal;
      }
    }

    // Actual revenue received for this item line
    const actualItemRevenue = roundMoney(Math.max(0, row.total - itemShareOfGlobal));
    const actualItemCost = roundMoney(row.product.purchasePrice * row.quantity);
    const actualItemProfit = roundMoney(actualItemRevenue - actualItemCost);

    return {
      id: Date.now() + idx,
      saleId,
      productId: row.product.id,
      productName: row.product.name,
      productBarcode: row.product.barcode || undefined,
      brand: row.product.brand || undefined,
      color: entry.color,
      colorHex: entry.colorHex,
      size: entry.size,
      variantId: entry.variantId,
      comment: entry.comment,
      quantity: row.quantity,
      originalPrice: row.originalPrice,
      discountAmount: row.totalDiscountAmount, // item-level discount only (global discount is tracked separately in sale.discount)
      salePrice: row.discountedUnitPrice, // discounted unit price before global discount
      costPrice: row.product.purchasePrice,
      total: row.total, // item total before global discount
      profit: actualItemProfit, // net real profit after all discounts!
    };
  });

  return { saleItems, totals };
};

/**
 * Color swatch preset with visual symbol hex and default name
 */
export interface ColorSwatch {
  name: string;
  hex: string;
}

export const COLOR_SWATCHES: ColorSwatch[] = [
  { name: 'Mavi (Marin)', hex: '#1D4ED8' },
  { name: 'Tünd göy', hex: '#1E3A8A' },
  { name: 'Açıq mavi', hex: '#38BDF8' },
  { name: 'Qara', hex: '#0F172A' },
  { name: 'Ağ', hex: '#F8FAFC' },
  { name: 'Bordo', hex: '#800020' },
  { name: 'Bej', hex: '#E6D5B8' },
  { name: 'Krem', hex: '#FFFDD0' },
  { name: 'Antrasit', hex: '#334155' },
  { name: 'Boz', hex: '#64748B' },
  { name: 'Xaki', hex: '#556B2F' },
  { name: 'Yaşıl', hex: '#16A34A' },
  { name: 'Qəhvəyi', hex: '#78350F' },
  { name: 'Qırmızı', hex: '#DC2626' },
  { name: 'Çəhrayı', hex: '#EC4899' },
  { name: 'Sarı', hex: '#D97706' },
  { name: 'Bənövşəyi', hex: '#9333EA' },
  { name: 'Firuzəyi', hex: '#14B8A6' },
  { name: 'Narıncı', hex: '#EA580C' },
];

/**
 * List of most popular apparel/clothing colors (Geyimdə ən çox üstünlük verilən rənglər)
 */
export const CLOTHING_COLOR_PRESETS = [
  'Qara',
  'Ağ',
  'Bordo',
  'Marin',
  'Tünd göy',
  'Bej',
  'Krem',
  'Boz',
  'Antrasit',
  'Xaki',
  'Qəhvəyi',
  'Mavi',
  'Yaşıl',
  'Qırmızı',
  'Çəhrayı',
] as const;

/**
 * Returns a hex color code corresponding to a color name in Azerbaijani/English or custom hex.
 * Supports clothing specific fashion tones (Marin, Bordo, Bej, Krem, Antrasit, Xaki, Tünd göy, etc.)
 */
export const getColorHex = (colorName?: string, customColorHex?: string): string => {
  if (customColorHex && /^#[0-9A-Fa-f]{3,8}$/.test(customColorHex.trim())) {
    return customColorHex.trim();
  }
  if (!colorName) return '#94A3B8';
  const c = colorName.toLowerCase().trim();

  // If user entered a hex code directly
  if (/^#[0-9A-Fa-f]{3,8}$/.test(c)) {
    return c;
  }

  // Marin / Marine blue support requested by user
  if (c.includes('marin') || c.includes('marine')) return '#1D4ED8';
  if (c.includes('bordo') || c.includes('burgundy') || c.includes('maroon')) return '#800020';
  if (c.includes('antrasit') || c.includes('charcoal')) return '#334155';
  if (c.includes('tünd göy') || c.includes('tund goy') || c.includes('lacivərd') || c.includes('laciverd') || c.includes('navy')) return '#1E3A8A';
  if (c.includes('krem') || c.includes('cream') || c.includes('süd') || c.includes('sud') || c.includes('ekru')) return '#FFFDD0';
  if (c.includes('xaki') || c.includes('haki') || c.includes('khaki') || c.includes('zeytun') || c.includes('olive')) return '#556B2F';
  if (c.includes('bej') || c.includes('beige')) return '#E6D5B8';
  if (c.includes('qara') || c.includes('black')) return '#0F172A';
  if (c.includes('ağ') || c.includes('ag') || c.includes('white')) return '#F8FAFC';
  if (c.includes('boz') || c.includes('gray') || c.includes('grey')) return '#64748B';
  if (c.includes('qəhvəyi') || c.includes('qehveyi') || c.includes('brown')) return '#78350F';
  if (c.includes('açıq göy') || c.includes('light blue')) return '#38BDF8';
  if (c.includes('mavi')) return '#2563EB';
  if (c.includes('göy') || c.includes('blue')) return '#1D4ED8';
  if (c.includes('yaşıl') || c.includes('yasil') || c.includes('green')) return '#16A34A';
  if (c.includes('qırmızı') || c.includes('qirmizi') || c.includes('red')) return '#DC2626';
  if (c.includes('çəhrayı') || c.includes('cehrayi') || c.includes('pink') || c.includes('pudra')) return '#EC4899';
  if (c.includes('sarı') || c.includes('sari') || c.includes('yellow') || c.includes('xardal') || c.includes('mustard')) return '#D97706';
  if (c.includes('bənövşəyi') || c.includes('benovseyi') || c.includes('purple') || c.includes('yasəmən') || c.includes('lilac')) return '#9333EA';
  if (c.includes('narıncı') || c.includes('narinci') || c.includes('orange')) return '#EA580C';
  if (c.includes('firuzəyi') || c.includes('turquoise') || c.includes('mint')) return '#14B8A6';

  return '#94A3B8';
};

/**
 * Calculates the complete and mathematically accurate Xalis Kassa (Net Cash Register) report.
 * Accounts for:
 * - Nağd satışlar (tam nağd + borc ilkin nağd + borc nağd ödəmələri)
 * - Kart satışlar (tam kart + borc ilkin kart + borc kart ödəmələri)
 * - Kassaya əlavə edilən pul (Mədaxil)
 * - Xərclər (cari əməliyyat xərcləri)
 * - Kassadan çıxarılan pul (Məxaric / İnkasasiya)
 * - Geri qaytarmalar (qaytarılan çek məbləğləri)
 *
 * Distinctly separates "Ümumi satış" (Gross Sales) and "Xalis Kassa" (Net Register Balance).
 */
export const calculateKassaReport = (
  sales: Sale[],
  expenses: Expense[],
  incomes: Income[],
  fromDate?: Date,
  toDate?: Date
): KassaReport => {
  const fromTime = fromDate ? fromDate.getTime() : 0;
  const toTime = toDate ? toDate.getTime() : Infinity;

  const isInRange = (dateStr: string) => {
    const t = new Date(dateStr).getTime();
    return t >= fromTime && t <= toTime;
  };

  // 1. Filter sales in range
  const periodSales = sales.filter((s) => isInRange(s.date));
  const activeSales = periodSales.filter((s) => !s.isReturned);
  const returnedSales = periodSales.filter((s) => s.isReturned);

  // Ümumi Satış (gross sales revenue of unreturned receipts)
  const grossSales = roundMoney(activeSales.reduce((acc, s) => acc + s.total, 0));
  const salesCount = activeSales.length;

  // Real cash collected from sales
  let cashSales = 0;
  let cardSales = 0;

  activeSales.forEach((s) => {
    if (s.paymentMethod === 'Nağd') {
      cashSales += s.paidAmount || s.total;
    } else if (s.paymentMethod === 'Kart') {
      cardSales += s.paidAmount || s.total;
    } else if (s.paymentMethod === 'Borc') {
      // For credit sales, count initial payment made at the time of sale
      const initialPaid = s.initialPaidAmount || 0;
      if (initialPaid > 0) {
        if (s.partialPaymentMethod === 'Kart') {
          cardSales += initialPaid;
        } else {
          cashSales += initialPaid;
        }
      }
    }
  });

  // Subsequent Debt Payments collected in this period
  sales.forEach((s) => {
    if (s.debtPayments && s.debtPayments.length > 0) {
      s.debtPayments.forEach((dp) => {
        if (isInRange(dp.date)) {
          // If this was an initial payment already accounted for during sale, skip to avoid double counting
          if (dp.notes?.includes('İlkin ödəniş') && isInRange(s.date)) {
            return;
          }
          if (dp.paymentMethod === 'Kart') {
            cardSales += dp.amount;
          } else {
            cashSales += dp.amount;
          }
        }
      });
    }
  });

  cashSales = roundMoney(cashSales);
  cardSales = roundMoney(cardSales);
  const totalSalesCollected = roundMoney(cashSales + cardSales);

  // Kassaya əlavə edilən pul (Mədaxil)
  const periodIncomes = incomes.filter((i) => isInRange(i.date));
  let cashIn = 0;
  periodIncomes.forEach((inc) => {
    // Only count true cash additions / deposits (ignore any legacy duplicate 'Satış' entries)
    if (inc.category !== 'Satış' && inc.category !== 'Qaytarma' && inc.category !== 'Borc Ödənişi') {
      cashIn += inc.amount;
    }
  });
  cashIn = roundMoney(cashIn);
  const totalInflow = roundMoney(totalSalesCollected + cashIn);

  // Xərclər və Kassadan Çıxarılan Pul (Məxaric)
  const periodExpenses = expenses.filter((e) => isInRange(e.date));
  let generalExpenses = 0;
  let cashExpenses = 0;
  let cardExpenses = 0;
  let cashOut = 0; // Kassadan çıxarılan pul (Məxaric / İnkasasiya)

  periodExpenses.forEach((e) => {
    const isCashOut =
      e.category === 'Kassadan Məxaric' ||
      e.category === 'İnkasasiya' ||
      e.category === 'Kassadan Çıxarış';
    if (isCashOut) {
      cashOut += e.amount;
    } else {
      generalExpenses += e.amount;
      if (e.paymentMethod === 'Kart') {
        cardExpenses += e.amount;
      } else {
        cashExpenses += e.amount;
      }
    }
  });

  generalExpenses = roundMoney(generalExpenses);
  cashExpenses = roundMoney(cashExpenses);
  cardExpenses = roundMoney(cardExpenses);
  cashOut = roundMoney(cashOut);

  // Geri qaytarmalar (Refunds)
  let cashRefunds = 0;
  let cardRefunds = 0;
  returnedSales.forEach((s) => {
    const refundAmt = s.paymentMethod === 'Borc' ? (s.paidAmount || s.initialPaidAmount || 0) : s.total;
    if (s.paymentMethod === 'Kart') {
      cardRefunds += refundAmt;
    } else {
      cashRefunds += refundAmt;
    }
  });

  cashRefunds = roundMoney(cashRefunds);
  cardRefunds = roundMoney(cardRefunds);
  const totalRefunds = roundMoney(cashRefunds + cardRefunds);

  const totalOutflow = roundMoney(generalExpenses + cashOut + totalRefunds);

  // Xalis Kassa Balansı
  const netCashDrawer = roundMoney(cashSales + cashIn - cashExpenses - cashOut - cashRefunds);
  const netCardBalance = roundMoney(cardSales - cardExpenses - cardRefunds);
  const netKassa = roundMoney(totalInflow - totalOutflow);

  return {
    grossSales,
    salesCount,
    cashSales,
    cardSales,
    totalSalesCollected,
    cashIn,
    totalInflow,
    expenses: generalExpenses,
    cashExpenses,
    cardExpenses,
    cashOut,
    refunds: totalRefunds,
    cashRefunds,
    cardRefunds,
    totalOutflow,
    netCashDrawer,
    netCardBalance,
    netKassa,
  };
};

export const CLOTHING_SIZE_PRESETS = [
  'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Standart',
  '36', '37', '38', '39', '40', '41', '42', '43', '44', '45'
];
