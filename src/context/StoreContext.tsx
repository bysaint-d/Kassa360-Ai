import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  Product,
  ProductVariant,
  Sale,
  SaleItem,
  DebtPayment,
  Purchase,
  Expense,
  Income,
  StockMovement,
  Setting,
  Category,
  Supplier,
  SummaryReport,
  StockReport,
  ProductMetric,
  RecurringExpense,
  RecurringPeriod,
  KassaReport,
} from '../types';
import {
  INITIAL_PRODUCTS,
  INITIAL_SALES,
  INITIAL_EXPENSES,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_CATEGORIES,
  INITIAL_SUPPLIERS,
  INITIAL_SETTING,
  INITIAL_RECURRING_EXPENSES,
} from '../data/seedData';
import {
  calculateFinalSaleItems,
  calculateKassaReport,
  roundMoney,
} from '../utils/calculations';

interface StoreContextType {
  products: Product[];
  sales: Sale[];
  purchases: Purchase[];
  expenses: Expense[];
  incomes: Income[];
  movements: StockMovement[];
  categories: Category[];
  suppliers: Supplier[];
  setting: Setting;
  
  // Product Operations
  findProducts: (query?: string) => Product[];
  byBarcode: (barcode: string) => Product | undefined;
  saveProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> & { id?: number }) => Product;
  deleteProduct: (id: number) => void;
  adjustStock: (id: number, change: number, note: string) => void;
  
  // Sales & POS Operations
  completeSale: (params: {
    items: {
      productId: number;
      quantity: number;
      discountAmount?: number;
      discountPercent?: number;
      size?: string;
      color?: string;
      colorHex?: string;
      variantId?: string;
      comment?: string;
    }[];
    discount?: number;
    globalDiscountPercent?: number;
    paidAmount: number;
    paymentMethod: 'Nağd' | 'Kart' | 'Borc';
    partialPaymentMethod?: 'Nağd' | 'Kart';
    customerName?: string;
    notes?: string;
  }) => Sale;
  returnSale: (saleId: number) => void;
  deleteSale: (saleId: number, restoreStock?: boolean) => void;
  updateSale: (
    saleId: number,
    params: {
      customerName?: string;
      paymentMethod?: 'Nağd' | 'Kart' | 'Borc';
      partialPaymentMethod?: 'Nağd' | 'Kart';
      paidAmount?: number;
      discount?: number;
      notes?: string;
      date?: string;
      items?: {
        id?: number;
        productId: number;
        productName: string;
        productBarcode?: string;
        brand?: string;
        color?: string;
        colorHex?: string;
        size?: string;
        variantId?: string;
        comment?: string;
        quantity: number;
        salePrice: number;
        costPrice?: number;
        originalPrice?: number;
        discountAmount?: number;
      }[];
    }
  ) => Sale;
  clearAllSales: (restoreStock?: boolean) => void;
  wipeAllProducts: () => void;
  payDebt: (saleId: number, amount: number, paymentMethod?: 'Nağd' | 'Kart', notes?: string) => void;
  payCustomerDebts: (customerName: string, amount: number, paymentMethod?: 'Nağd' | 'Kart', notes?: string) => void;
  
  // Purchase Operations
  completePurchase: (params: {
    productId: number;
    quantity: number;
    purchasePrice: number;
    supplier?: string;
    notes?: string;
  }) => Purchase;
  
  // Expenses & Income
  addExpense: (expense: Omit<Expense, 'id'>) => void;
  deleteExpense: (id: number) => void;
  addIncome: (income: Omit<Income, 'id'>) => void;
  deleteIncome: (id: number) => void;
  
  // Cash Register Operations (Kassa Mədaxil & Məxaric)
  addCashIn: (amount: number, description: string, paymentMethod?: 'Nağd' | 'Kart', notes?: string) => void;
  addCashOut: (amount: number, description: string, paymentMethod?: 'Nağd' | 'Kart', notes?: string) => void;
  getKassaReport: (from?: Date, to?: Date) => KassaReport;
  
  // Recurring / Fixed Expenses (Stabil Xərclər)
  recurringExpenses: RecurringExpense[];
  addRecurringExpense: (expense: Omit<RecurringExpense, 'id' | 'createdAt'>) => void;
  updateRecurringExpense: (id: number, updated: Partial<Omit<RecurringExpense, 'id' | 'createdAt'>>) => void;
  deleteRecurringExpense: (id: number) => void;
  toggleRecurringExpense: (id: number) => void;
  applyRecurringExpense: (id: number, customDate?: string) => Expense;
  applyAllRecurringExpenses: (period?: RecurringPeriod, customDate?: string) => number;
  
  // Categories & Suppliers
  addCategory: (name: string) => void;
  deleteCategory: (id: number) => void;
  addSupplier: (name: string, phone?: string, notes?: string) => void;
  deleteSupplier: (id: number) => void;
  
  // Settings & DB Maintenance
  updateSetting: (newSetting: Partial<Setting>) => void;
  exportDatabaseJson: () => string;
  importDatabaseJson: (jsonString: string) => boolean;
  resetDatabase: () => void;
  
  // Reports
  getSummary: (from: Date, to: Date) => SummaryReport;
  getPurchasesTotal: (from: Date, to: Date) => number;
  getCostOfGoods: (from: Date, to: Date) => number;
  getProductsSold: (from: Date, to: Date) => number;
  getBestSelling: (from: Date, to: Date) => ProductMetric[];
  getMostProfitable: (from: Date, to: Date) => ProductMetric[];
  getStockReport: () => StockReport;
}

const StoreContext = createContext<StoreContextType | null>(null);

const STORAGE_KEYS = {
  PRODUCTS: 'calvotti_products_v2',
  SALES: 'calvotti_sales_v2',
  PURCHASES: 'calvotti_purchases_v2',
  EXPENSES: 'calvotti_expenses_v2',
  RECURRING_EXPENSES: 'calvotti_recurring_expenses_v2',
  INCOMES: 'calvotti_incomes_v2',
  MOVEMENTS: 'calvotti_movements_v2',
  CATEGORIES: 'calvotti_categories_v2',
  SUPPLIERS: 'calvotti_suppliers_v2',
  SETTING: 'calvotti_setting_v2',
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (!saved) return INITIAL_PRODUCTS;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.map((p) => ({
          ...p,
          brand: p.brand || undefined,
          color: p.color || undefined,
          colorHex: p.colorHex || undefined,
        }));
      }
      return INITIAL_PRODUCTS;
    } catch {
      return INITIAL_PRODUCTS;
    }
  });

  const [sales, setSales] = useState<Sale[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SALES);
      if (!saved) return INITIAL_SALES;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.map((s) => {
          const hasRealItemDiscounts = (s.itemDiscountsTotal || 0) > 0;
          return {
            ...s,
            itemDiscountsTotal: s.itemDiscountsTotal ?? 0,
            subtotalAfterItemDiscounts: s.subtotalAfterItemDiscounts ?? s.subtotal,
            globalDiscountPercent: s.globalDiscountPercent ?? 0,
            totalDiscount: s.totalDiscount ?? (s.discount || 0),
            items: (s.items || []).map((item: any) => ({
              ...item,
              brand: item.brand || undefined,
              color: item.color || undefined,
              colorHex: item.colorHex || undefined,
              originalPrice: item.originalPrice ?? item.salePrice,
              discountPercent: item.discountPercent ?? 0,
              discountAmount: hasRealItemDiscounts ? (item.discountAmount ?? 0) : 0,
            })),
          };
        });
      }
      return INITIAL_SALES;
    } catch {
      return INITIAL_SALES;
    }
  });

  const [purchases, setPurchases] = useState<Purchase[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PURCHASES);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.EXPENSES);
      if (!saved) return INITIAL_EXPENSES;
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : INITIAL_EXPENSES;
    } catch {
      return INITIAL_EXPENSES;
    }
  });

  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.RECURRING_EXPENSES);
      if (!saved) return INITIAL_RECURRING_EXPENSES;
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : INITIAL_RECURRING_EXPENSES;
    } catch {
      return INITIAL_RECURRING_EXPENSES;
    }
  });

  const [incomes, setIncomes] = useState<Income[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.INCOMES);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [movements, setMovements] = useState<StockMovement[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MOVEMENTS);
      if (!saved) return INITIAL_STOCK_MOVEMENTS;
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : INITIAL_STOCK_MOVEMENTS;
    } catch {
      return INITIAL_STOCK_MOVEMENTS;
    }
  });

  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (!saved) return INITIAL_CATEGORIES;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return INITIAL_CATEGORIES;
      return parsed.map((item, idx) => {
        if (typeof item === 'string') {
          return { id: idx + 1, name: item };
        }
        if (item && typeof item === 'object') {
          return { id: Number(item.id) || idx + 1, name: String(item.name || '') };
        }
        return { id: idx + 1, name: String(item || '') };
      }).filter((c) => c.name.trim() !== '');
    } catch {
      return INITIAL_CATEGORIES;
    }
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SUPPLIERS);
      if (!saved) return INITIAL_SUPPLIERS;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return INITIAL_SUPPLIERS;
      return parsed.map((item, idx) => {
        if (typeof item === 'string') {
          return { id: idx + 1, name: item };
        }
        if (item && typeof item === 'object') {
          return {
            id: Number(item.id) || idx + 1,
            name: String(item.name || ''),
            phone: item.phone ? String(item.phone) : undefined,
            notes: item.notes ? String(item.notes) : undefined,
          };
        }
        return { id: idx + 1, name: String(item || '') };
      }).filter((s) => s.name.trim() !== '');
    } catch {
      return INITIAL_SUPPLIERS;
    }
  });

  const [setting, setSetting] = useState<Setting>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTING);
      if (!saved) return INITIAL_SETTING;
      const parsed = JSON.parse(saved);
      return {
        id: parsed?.id || 1,
        storeName: parsed?.storeName || INITIAL_SETTING.storeName,
        currency: parsed?.currency || INITIAL_SETTING.currency,
        allowNegativeStock: Boolean(parsed?.allowNegativeStock),
      };
    } catch {
      return INITIAL_SETTING;
    }
  });

  // Sync to localStorage
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales)); }, [sales]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.PURCHASES, JSON.stringify(purchases)); }, [purchases]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses)); }, [expenses]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.RECURRING_EXPENSES, JSON.stringify(recurringExpenses)); }, [recurringExpenses]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.INCOMES, JSON.stringify(incomes)); }, [incomes]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(movements)); }, [movements]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(suppliers)); }, [suppliers]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SETTING, JSON.stringify(setting)); }, [setting]);

  // Product Operations
  const findProducts = (query = ''): Product[] => {
    const q = query.trim().toLowerCase();
    if (!q) return [...products].sort((a, b) => a.name.localeCompare(b.name));
    return products
      .filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.color && p.color.toLowerCase().includes(q)) ||
        (p.supplier && p.supplier.toLowerCase().includes(q))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const byBarcode = (barcode: string): Product | undefined => {
    if (!barcode.trim()) return undefined;
    return products.find((p) => p.barcode?.trim() === barcode.trim());
  };

  const saveProduct = (form: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> & { id?: number }): Product => {
    if (!form.name.trim()) throw new Error('Məhsul adı boş ola bilməz.');
    if (form.salePrice < 0 || form.purchasePrice < 0 || form.stockQuantity < 0) {
      throw new Error('Qiymət və stok mənfi ola bilməz.');
    }
    const trimmedBarcode = form.barcode?.trim();
    if (trimmedBarcode) {
      const existing = products.find((p) => p.barcode === trimmedBarcode && p.id !== form.id);
      if (existing) throw new Error('Bu barkod artıq başqa bir məhsula aiddir.');
    }

    const nowIso = new Date().toISOString();
    const cleanBrand = form.brand?.trim() || undefined;
    const cleanColor = form.color?.trim() || (form.variants && form.variants.length > 0 ? form.variants[0].color : undefined);
    const cleanColorHex = form.colorHex?.trim() || (form.variants && form.variants.length > 0 ? form.variants[0].colorHex : undefined);
    const cleanSize = form.size?.trim() || (form.variants && form.variants.length > 0 ? form.variants[0].size : undefined);

    let stockQty = Number(form.stockQuantity || 0);
    if (form.variants && form.variants.length > 0) {
      stockQty = form.variants.reduce((sum, v) => sum + Number(v.stockQuantity || 0), 0);
    }

    if (!form.id || form.id === 0) {
      const nextId = products.length > 0 ? Math.max(...products.map((p) => p.id)) + 1 : 1;
      const newProd: Product = {
        ...form,
        brand: cleanBrand,
        color: cleanColor,
        colorHex: cleanColorHex,
        size: cleanSize,
        stockQuantity: stockQty,
        variants: form.variants,
        id: nextId,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      setProducts((prev) => [newProd, ...prev]);

      // Stock movement for initial stock
      const movement: StockMovement = {
        id: Date.now(),
        productId: nextId,
        productName: newProd.name,
        type: 'İlkin stok',
        quantity: newProd.stockQuantity,
        previousStock: 0,
        newStock: newProd.stockQuantity,
        date: nowIso,
        notes: form.variants && form.variants.length > 0 
          ? `Yeni məhsul və variantlar əlavə edildi (${form.variants.length} variant)`
          : 'Yeni məhsul əlavə edildi',
      };
      setMovements((prev) => [movement, ...prev]);

      return newProd;
    } else {
      const oldProd = products.find((p) => p.id === form.id);
      const updated: Product = {
        ...form,
        brand: cleanBrand,
        color: cleanColor,
        colorHex: cleanColorHex,
        size: cleanSize,
        stockQuantity: stockQty,
        variants: form.variants,
        id: form.id,
        createdAt: oldProd?.createdAt || nowIso,
        updatedAt: nowIso,
      };

      setProducts((prev) => prev.map((p) => (p.id === form.id ? updated : p)));
      return updated;
    }
  };

  const deleteProduct = (id: number) => {
    const p = products.find((x) => x.id === id);
    if (!p) throw new Error('Məhsul tapılmadı.');

    const hasSales = sales.some((s) => s.items.some((i) => i.productId === id));
    const hasPurchases = purchases.some((pr) => pr.productId === id);

    if (hasSales || hasPurchases) {
      throw new Error('Tarixçəsi olan məhsul silinə bilməz; onu stokda 0 edin.');
    }

    setProducts((prev) => prev.filter((x) => x.id !== id));
  };

  const adjustStock = (id: number, change: number, note: string) => {
    if (change === 0) throw new Error('Düzəliş miqdarı 0 ola bilməz.');
    const p = products.find((x) => x.id === id);
    if (!p) throw new Error('Məhsul tapılmadı.');

    const newStock = p.stockQuantity + change;
    if (newStock < 0 && !setting.allowNegativeStock) {
      throw new Error('Stok mənfi ola bilməz.');
    }

    const nowIso = new Date().toISOString();
    const movement: StockMovement = {
      id: Date.now(),
      productId: id,
      productName: p.name,
      type: 'Stok düzəlişi',
      quantity: change,
      previousStock: p.stockQuantity,
      newStock: newStock,
      date: nowIso,
      notes: note || 'Əl ilə düzəliş',
    };

    setProducts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, stockQuantity: newStock, updatedAt: nowIso } : item))
    );
    setMovements((prev) => [movement, ...prev]);
  };

  // Complete Sale
  const completeSale = ({
    items,
    discount = 0,
    globalDiscountPercent = 0,
    paidAmount,
    paymentMethod,
    partialPaymentMethod,
    customerName,
    notes,
  }: {
    items: {
      productId: number;
      quantity: number;
      discountAmount?: number;
      discountPercent?: number;
      size?: string;
      color?: string;
      colorHex?: string;
      variantId?: string;
      comment?: string;
    }[];
    discount?: number;
    globalDiscountPercent?: number;
    paidAmount: number;
    paymentMethod: 'Nağd' | 'Kart' | 'Borc';
    partialPaymentMethod?: 'Nağd' | 'Kart';
    customerName?: string;
    notes?: string;
  }): Sale => {
    if (!items.length) throw new Error('Səbət boşdur.');

    // Validate stock and build product list
    const cartItemsWithProducts: {
      product: Product;
      quantity: number;
      discountAmount?: number;
      discountPercent?: number;
      size?: string;
      color?: string;
      colorHex?: string;
      variantId?: string;
      comment?: string;
    }[] = [];

    for (const item of items) {
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) throw new Error('Məhsul tapılmadı.');
      if (item.quantity <= 0) throw new Error('Məhsul miqdarı 0-dan çox olmalıdır.');

      if (prod.variants && prod.variants.length > 0) {
        const variant = prod.variants.find(
          (v) =>
            (item.variantId && v.id === item.variantId) ||
            (item.size && item.color && v.size === item.size && v.color === item.color)
        );
        if (variant && variant.stockQuantity < item.quantity && !setting.allowNegativeStock) {
          throw new Error(
            `${prod.name} (${variant.color} / ${variant.size}) üçün yetərli stok yoxdur (Mövcud: ${variant.stockQuantity}).`
          );
        }
      } else if (prod.stockQuantity < item.quantity && !setting.allowNegativeStock) {
        throw new Error(`${prod.name} üçün yetərli stok yoxdur (Mövcud: ${prod.stockQuantity}).`);
      }

      cartItemsWithProducts.push({
        product: prod,
        quantity: item.quantity,
        discountAmount: item.discountAmount || 0,
        discountPercent: item.discountPercent || 0,
        size: item.size,
        color: item.color,
        colorHex: item.colorHex,
        variantId: item.variantId,
        comment: item.comment,
      });
    }

    const saleId = sales.length > 0 ? Math.max(...sales.map((s) => s.id)) + 1 : 101;
    const nowIso = new Date().toISOString();

    // Centralized accurate calculations for items and financial totals
    const { saleItems, totals } = calculateFinalSaleItems(
      cartItemsWithProducts,
      saleId,
      discount
    );

    const subtotal = totals.grossSubtotal;
    const total = totals.finalTotal;

    if (discount > totals.subtotalAfterItemDiscounts) {
      throw new Error('Ümumi səbət endirimi məhsulların yekun məbləğindən çox ola bilməz.');
    }

    if (paymentMethod !== 'Borc' && roundMoney(paidAmount) < total) {
      throw new Error('Nağd və kart satışında tam ödəniş tələb olunur.');
    }

    if (paymentMethod === 'Borc' && !customerName?.trim()) {
      throw new Error('Borc satışı üçün müştəri adı (borc götürən) daxil edilməlidir.');
    }

    const changeAmount = paymentMethod === 'Borc' ? 0 : Math.max(0, roundMoney(paidAmount - total));
    const debtAmount = paymentMethod === 'Borc' ? Math.max(0, roundMoney(total - paidAmount)) : 0;
    const initialDebt = paymentMethod === 'Borc' ? debtAmount : 0;
    const initialPaid = paymentMethod === 'Borc' ? paidAmount : (paidAmount >= total ? total : paidAmount);

    const initialPayments: DebtPayment[] = [];
    if (paymentMethod === 'Borc' && paidAmount > 0) {
      initialPayments.push({
        id: Date.now(),
        saleId,
        date: nowIso,
        amount: paidAmount,
        previousDebt: total,
        remainingDebt: debtAmount,
        paymentMethod: partialPaymentMethod || 'Nağd',
        notes: 'İlkin ödəniş (Satış anında)',
      });
    }

    const newSale: Sale = {
      id: saleId,
      date: nowIso,
      subtotal,
      itemDiscountsTotal: totals.itemDiscountsTotal,
      subtotalAfterItemDiscounts: totals.subtotalAfterItemDiscounts,
      globalDiscountPercent: totals.globalDiscountPercent || globalDiscountPercent,
      discount: totals.globalDiscountAmount,
      totalDiscount: totals.totalDiscount,
      total,
      paidAmount,
      changeAmount,
      debtAmount,
      initialDebtAmount: initialDebt,
      initialPaidAmount: initialPaid,
      paymentMethod,
      partialPaymentMethod: paymentMethod === 'Borc' ? (partialPaymentMethod || 'Nağd') : undefined,
      customerName: customerName?.trim() || undefined,
      notes: notes?.trim() || undefined,
      isReturned: false,
      items: saleItems,
      debtPayments: initialPayments,
    };

    // Deduct stock (and variant stocks) and record movements
    const newMovements: StockMovement[] = [];
    setProducts((prev) =>
      prev.map((p) => {
        const productSoldItems = items.filter((i) => i.productId === p.id);
        if (productSoldItems.length === 0) return p;

        if (p.variants && p.variants.length > 0) {
          let updatedVariants = [...p.variants];
          for (const sItem of productSoldItems) {
            updatedVariants = updatedVariants.map((v) => {
              const isMatch =
                (sItem.variantId && v.id === sItem.variantId) ||
                (!sItem.variantId && v.size === sItem.size && v.color === sItem.color);
              if (isMatch) {
                const newVarStock = v.stockQuantity - sItem.quantity;
                newMovements.push({
                  id: Date.now() + Math.random(),
                  productId: p.id,
                  productName: `${p.name} (${v.color || ''} / ${v.size || ''})`,
                  type: 'Satış',
                  quantity: -sItem.quantity,
                  previousStock: v.stockQuantity,
                  newStock: newVarStock,
                  date: nowIso,
                  notes: `Satış #${saleId} [${v.color || ''} / ${v.size || ''}]${sItem.comment ? ` - Şərh: ${sItem.comment}` : ''}${customerName ? ` (${customerName})` : ''}`,
                });
                return { ...v, stockQuantity: newVarStock };
              }
              return v;
            });
          }
          const newTotalStock = updatedVariants.reduce((sum, v) => sum + v.stockQuantity, 0);
          return { ...p, variants: updatedVariants, stockQuantity: newTotalStock, updatedAt: nowIso };
        } else {
          const totalSold = productSoldItems.reduce((sum, i) => sum + i.quantity, 0);
          const newStock = p.stockQuantity - totalSold;
          newMovements.push({
            id: Date.now() + Math.random(),
            productId: p.id,
            productName: p.name,
            type: 'Satış',
            quantity: -totalSold,
            previousStock: p.stockQuantity,
            newStock,
            date: nowIso,
            notes: `Satış #${saleId}${customerName ? ` (${customerName})` : ''}`,
          });
          return { ...p, stockQuantity: newStock, updatedAt: nowIso };
        }
      })
    );

    setMovements((prev) => [...newMovements, ...prev]);
    setSales((prev) => [newSale, ...prev]);

    return newSale;
  };

  const payDebt = (saleId: number, amount: number, paymentMethod?: 'Nağd' | 'Kart', notes?: string) => {
    const sale = sales.find((s) => s.id === saleId);
    if (!sale) throw new Error('Satış çeki tapılmadı.');
    if (sale.isReturned) throw new Error('Qaytarılmış satış üçün borc ödənilə bilməz.');
    if (sale.debtAmount <= 0) throw new Error('Bu satışın heç bir borc qalığı yoxdur.');
    if (amount <= 0) throw new Error('Ödəniş məbləği 0-dan böyük olmalıdır.');
    if (amount > sale.debtAmount) throw new Error(`Ödəniş məbləği qalıq borcdan (${sale.debtAmount} ₼) çox ola bilməz.`);

    const nowIso = new Date().toISOString();
    const newDebtAmount = Math.max(0, Number((sale.debtAmount - amount).toFixed(2)));
    const newPaidAmount = Number((sale.paidAmount + amount).toFixed(2));
    const payType = paymentMethod || 'Nağd';

    const paymentRecord: DebtPayment = {
      id: Date.now(),
      saleId,
      date: nowIso,
      amount,
      previousDebt: sale.debtAmount,
      remainingDebt: newDebtAmount,
      paymentMethod: payType,
      notes: notes?.trim() || (newDebtAmount === 0 ? 'Borcun tam bağlanması' : 'Hissə-hissə borc ödənişi'),
    };

    setSales((prev) =>
      prev.map((s) =>
        s.id === saleId
          ? {
              ...s,
              debtAmount: newDebtAmount,
              paidAmount: newPaidAmount,
              debtPayments: [...(s.debtPayments || []), paymentRecord],
            }
          : s
      )
    );
  };

  const payCustomerDebts = (customerName: string, amount: number, paymentMethod?: 'Nağd' | 'Kart', notes?: string) => {
    const trimmedName = customerName.trim().toLowerCase();
    const customerSales = sales
      .filter((s) => (s.customerName || '').trim().toLowerCase() === trimmedName && s.debtAmount > 0 && !s.isReturned)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (customerSales.length === 0) throw new Error(`${customerName} adlı müştərinin aktiv borcu tapılmadı.`);
    if (amount <= 0) throw new Error('Ödəniş məbləği 0-dan böyük olmalıdır.');

    let remainingToPay = amount;
    for (const s of customerSales) {
      if (remainingToPay <= 0) break;
      const payForThisSale = Math.min(s.debtAmount, remainingToPay);
      payDebt(s.id, payForThisSale, paymentMethod, notes);
      remainingToPay = Number((remainingToPay - payForThisSale).toFixed(2));
    }
  };

  const returnSale = (saleId: number) => {
    const sale = sales.find((s) => s.id === saleId);
    if (!sale) throw new Error('Satış tapılmadı.');
    if (sale.isReturned) throw new Error('Bu satış artıq qaytarılıb.');

    const nowIso = new Date().toISOString();
    const newMovements: StockMovement[] = [];

    setProducts((prev) =>
      prev.map((p) => {
        const returnedItems = sale.items.filter((i) => i.productId === p.id);
        if (returnedItems.length === 0) return p;

        if (p.variants && p.variants.length > 0) {
          let updatedVariants = [...p.variants];
          for (const retItem of returnedItems) {
            updatedVariants = updatedVariants.map((v) => {
              const isMatch =
                (retItem.variantId && v.id === retItem.variantId) ||
                (!retItem.variantId && v.size === retItem.size && v.color === retItem.color);
              if (isMatch) {
                const newVarStock = v.stockQuantity + retItem.quantity;
                newMovements.push({
                  id: Date.now() + Math.random(),
                  productId: p.id,
                  productName: `${p.name} (${v.color || ''} / ${v.size || ''})`,
                  type: 'Qaytarma',
                  quantity: retItem.quantity,
                  previousStock: v.stockQuantity,
                  newStock: newVarStock,
                  date: nowIso,
                  notes: `Satış #${saleId} qaytarıldı [${v.color || ''} / ${v.size || ''}]`,
                });
                return { ...v, stockQuantity: newVarStock };
              }
              return v;
            });
          }
          const newTotalStock = updatedVariants.reduce((sum, v) => sum + v.stockQuantity, 0);
          return { ...p, variants: updatedVariants, stockQuantity: newTotalStock, updatedAt: nowIso };
        } else {
          const totalReturned = returnedItems.reduce((sum, i) => sum + i.quantity, 0);
          const newStock = p.stockQuantity + totalReturned;
          newMovements.push({
            id: Date.now() + Math.random(),
            productId: p.id,
            productName: p.name,
            type: 'Qaytarma',
            quantity: totalReturned,
            previousStock: p.stockQuantity,
            newStock,
            date: nowIso,
            notes: `Satış #${saleId} qaytarıldı`,
          });
          return { ...p, stockQuantity: newStock, updatedAt: nowIso };
        }
      })
    );

    setMovements((prev) => [...newMovements, ...prev]);
    setSales((prev) => prev.map((s) => (s.id === saleId ? { ...s, isReturned: true } : s)));
  };

  const deleteSale = (saleId: number, restoreStock: boolean = true) => {
    const sale = sales.find((s) => s.id === saleId);
    if (!sale) return;

    if (restoreStock && !sale.isReturned) {
      const nowIso = new Date().toISOString();
      const newMovements: StockMovement[] = [];

      setProducts((prev) =>
        prev.map((p) => {
          const matchingItems = sale.items.filter((i) => i.productId === p.id);
          if (matchingItems.length === 0) return p;

          const totalProductQtyToRestore = matchingItems.reduce((acc, it) => acc + it.quantity, 0);

          let updatedVariants = p.variants ? [...p.variants] : undefined;
          if (updatedVariants && updatedVariants.length > 0) {
            for (const item of matchingItems) {
              updatedVariants = updatedVariants.map((v) => {
                const isMatch =
                  (item.variantId && v.id === item.variantId) ||
                  (!item.variantId && v.size === item.size && v.color === item.color);
                if (isMatch) {
                  return { ...v, stockQuantity: v.stockQuantity + item.quantity };
                }
                return v;
              });
            }
          }

          const newStock = p.stockQuantity + totalProductQtyToRestore;
          newMovements.push({
            id: Date.now() + Math.random(),
            productId: p.id,
            productName: p.name,
            type: 'Satış ləğvi',
            quantity: totalProductQtyToRestore,
            previousStock: p.stockQuantity,
            newStock,
            date: nowIso,
            notes: `Satış #${saleId} silindi, ${totalProductQtyToRestore} ədəd stok bərpa edildi`,
          });

          return {
            ...p,
            stockQuantity: newStock,
            variants: updatedVariants,
            updatedAt: nowIso,
          };
        })
      );

      setMovements((prev) => [...newMovements, ...prev]);
    }

    setSales((prev) => prev.filter((s) => s.id !== saleId));
    setIncomes((prev) => prev.filter((i) => !i.description.includes(`Satış #${saleId}`)));
  };

  const updateSale = (
    saleId: number,
    params: {
      customerName?: string;
      paymentMethod?: 'Nağd' | 'Kart' | 'Borc';
      partialPaymentMethod?: 'Nağd' | 'Kart';
      paidAmount?: number;
      discount?: number;
      notes?: string;
      date?: string;
      items?: {
        id?: number;
        productId: number;
        productName: string;
        productBarcode?: string;
        brand?: string;
        color?: string;
        colorHex?: string;
        size?: string;
        variantId?: string;
        comment?: string;
        quantity: number;
        salePrice: number;
        costPrice?: number;
        originalPrice?: number;
        discountAmount?: number;
      }[];
    }
  ): Sale => {
    const sale = sales.find((s) => s.id === saleId);
    if (!sale) throw new Error(`Satış #${saleId} tapılmadı.`);

    const nowIso = new Date().toISOString();

    // 1. If items were changed, calculate stock differences
    if (params.items && !sale.isReturned) {
      const oldItemMap = new Map<string, number>();
      for (const it of sale.items) {
        const key = `${it.productId}_${it.variantId || ''}_${it.size || ''}_${it.color || ''}`;
        oldItemMap.set(key, (oldItemMap.get(key) || 0) + it.quantity);
      }

      const newItemMap = new Map<string, number>();
      for (const it of params.items) {
        const key = `${it.productId}_${it.variantId || ''}_${it.size || ''}_${it.color || ''}`;
        newItemMap.set(key, (newItemMap.get(key) || 0) + it.quantity);
      }

      const allKeys = new Set([...oldItemMap.keys(), ...newItemMap.keys()]);
      const newMovements: StockMovement[] = [];

      const productDeltas = new Map<number, number>();
      for (const key of allKeys) {
        const [prodIdStr] = key.split('_');
        const prodId = Number(prodIdStr);
        const oldQty = oldItemMap.get(key) || 0;
        const newQty = newItemMap.get(key) || 0;
        const diff = newQty - oldQty;
        if (diff !== 0) {
          productDeltas.set(prodId, (productDeltas.get(prodId) || 0) + diff);
        }
      }

      if (productDeltas.size > 0) {
        setProducts((prev) =>
          prev.map((p) => {
            const delta = productDeltas.get(p.id);
            if (!delta) return p;

            const newStock = Math.max(0, p.stockQuantity - delta);

            let updatedVariants = p.variants ? [...p.variants] : undefined;
            if (updatedVariants && updatedVariants.length > 0) {
              for (const [key, oldQ] of oldItemMap.entries()) {
                const [pId, vId, sz, cl] = key.split('_');
                if (Number(pId) === p.id) {
                  const newQ = newItemMap.get(key) || 0;
                  const vDiff = newQ - oldQ;
                  if (vDiff !== 0) {
                    updatedVariants = updatedVariants.map((v) => {
                      const isMatch = (vId && v.id === vId) || (!vId && v.size === sz && v.color === cl);
                      if (isMatch) {
                        return { ...v, stockQuantity: Math.max(0, v.stockQuantity - vDiff) };
                      }
                      return v;
                    });
                  }
                }
              }
            }

            newMovements.push({
              id: Date.now() + Math.random(),
              productId: p.id,
              productName: p.name,
              type: delta > 0 ? 'Satış' : 'Qaytarma',
              quantity: Math.abs(delta),
              previousStock: p.stockQuantity,
              newStock,
              date: nowIso,
              notes: `Satış #${saleId} redaktə edildi (Stok fərqi: ${delta > 0 ? `-${delta}` : `+${Math.abs(delta)}`})`,
            });

            return {
              ...p,
              stockQuantity: newStock,
              variants: updatedVariants,
              updatedAt: nowIso,
            };
          })
        );

        if (newMovements.length > 0) {
          setMovements((prev) => [...newMovements, ...prev]);
        }
      }
    }

    // 2. Build updated items list
    let updatedSaleItems: SaleItem[] = sale.items;
    if (params.items) {
      updatedSaleItems = params.items.map((it, idx) => {
        const prod = products.find((p) => p.id === it.productId);
        const costPrice = it.costPrice ?? (prod ? prod.purchasePrice : 0);
        const baseUnitPrice = roundMoney(
          it.originalPrice !== undefined
            ? it.originalPrice
            : (prod ? prod.salePrice : it.salePrice)
        );
        const qty = Math.max(1, it.quantity || 1);
        const grossLine = roundMoney(baseUnitPrice * qty);
        const discountAmount = roundMoney(
          Math.min(grossLine, Math.max(0, it.discountAmount || 0))
        );
        const lineTotal = roundMoney(Math.max(0, grossLine - discountAmount));
        const unitSalePrice = roundMoney(lineTotal / qty);

        return {
          id: it.id || Date.now() + idx,
          saleId,
          productId: it.productId,
          productName: it.productName,
          productBarcode: it.productBarcode,
          brand: it.brand,
          color: it.color,
          colorHex: it.colorHex,
          size: it.size,
          variantId: it.variantId,
          comment: it.comment,
          quantity: qty,
          originalPrice: baseUnitPrice,
          salePrice: unitSalePrice,
          costPrice,
          discountAmount,
          total: lineTotal,
          profit: roundMoney(lineTotal - (costPrice * qty)),
        };
      });
    }

    // 3. Financial calculations
    const grossSubtotal = roundMoney(
      updatedSaleItems.reduce((acc, it) => acc + ((it.originalPrice || it.salePrice) * it.quantity), 0)
    );
    const itemDiscountsTotal = roundMoney(
      updatedSaleItems.reduce((acc, it) => acc + (it.discountAmount || 0), 0)
    );
    const subtotalAfterItemDiscounts = roundMoney(
      updatedSaleItems.reduce((acc, it) => acc + it.total, 0)
    );

    const validGlobalDiscount = roundMoney(
      params.discount !== undefined
        ? Math.min(subtotalAfterItemDiscounts, Math.max(0, params.discount))
        : Math.min(subtotalAfterItemDiscounts, Math.max(0, sale.discount))
    );
    const finalTotal = roundMoney(Math.max(0, subtotalAfterItemDiscounts - validGlobalDiscount));
    const totalDiscount = roundMoney(itemDiscountsTotal + validGlobalDiscount);

    // Distribute global discount proportionally for precise line item profit tracking
    let allocatedGlobalDiscount = 0;
    updatedSaleItems = updatedSaleItems.map((it, idx) => {
      const isLast = idx === updatedSaleItems.length - 1;
      let itemShareOfGlobal = 0;
      if (subtotalAfterItemDiscounts > 0 && validGlobalDiscount > 0) {
        if (isLast) {
          itemShareOfGlobal = roundMoney(validGlobalDiscount - allocatedGlobalDiscount);
        } else {
          itemShareOfGlobal = roundMoney((it.total / subtotalAfterItemDiscounts) * validGlobalDiscount);
          allocatedGlobalDiscount += itemShareOfGlobal;
        }
      }
      const actualLineRevenue = roundMoney(Math.max(0, it.total - itemShareOfGlobal));
      const lineCost = roundMoney(it.costPrice * it.quantity);
      return {
        ...it,
        profit: roundMoney(actualLineRevenue - lineCost),
      };
    });

    const paymentMethod = params.paymentMethod || sale.paymentMethod;
    const partialPaymentMethod =
      paymentMethod === 'Borc'
        ? (params.partialPaymentMethod || sale.partialPaymentMethod || 'Nağd')
        : undefined;

    let paidAmount = 0;
    let changeAmount = 0;
    let debtAmount = 0;

    if (paymentMethod === 'Borc') {
      const pAmt = params.paidAmount !== undefined ? params.paidAmount : (sale.initialPaidAmount ?? sale.paidAmount);
      paidAmount = roundMoney(Math.min(finalTotal, Math.max(0, pAmt)));
      debtAmount = roundMoney(Math.max(0, finalTotal - paidAmount));
      changeAmount = 0;
    } else {
      const wasPaidInFull = roundMoney(sale.paidAmount) >= roundMoney(sale.total);
      let pAmt: number;
      if (params.paidAmount !== undefined) {
        pAmt = params.paidAmount;
      } else if (wasPaidInFull) {
        pAmt = finalTotal;
      } else {
        pAmt = sale.paidAmount;
      }
      paidAmount = roundMoney(Math.max(0, pAmt));
      if (paidAmount >= finalTotal) {
        changeAmount = roundMoney(paidAmount - finalTotal);
      } else {
        changeAmount = 0;
      }
      debtAmount = 0;
    }

    const updatedSale: Sale = {
      ...sale,
      date: params.date || sale.date,
      subtotal: grossSubtotal,
      itemDiscountsTotal,
      subtotalAfterItemDiscounts,
      discount: validGlobalDiscount,
      totalDiscount,
      total: finalTotal,
      paidAmount,
      changeAmount,
      debtAmount,
      initialDebtAmount: paymentMethod === 'Borc' ? debtAmount : undefined,
      initialPaidAmount: paymentMethod === 'Borc' ? paidAmount : undefined,
      paymentMethod,
      partialPaymentMethod,
      customerName: params.customerName !== undefined ? params.customerName.trim() : sale.customerName,
      notes: params.notes !== undefined ? params.notes.trim() : sale.notes,
      items: updatedSaleItems,
    };

    setSales((prev) => prev.map((s) => (s.id === saleId ? updatedSale : s)));
    return updatedSale;
  };

  const clearAllSales = (restoreStock: boolean = false) => {
    if (restoreStock) {
      const nowIso = new Date().toISOString();
      const newMovements: StockMovement[] = [];

      setProducts((prev) =>
        prev.map((p) => {
          let extraQty = 0;
          for (const s of sales) {
            if (!s.isReturned) {
              const it = s.items.find((i) => i.productId === p.id);
              if (it) extraQty += it.quantity;
            }
          }
          if (extraQty > 0) {
            const newStock = p.stockQuantity + extraQty;
            newMovements.push({
              id: Date.now() + Math.random(),
              productId: p.id,
              productName: p.name,
              type: 'Satış ləğvi',
              quantity: extraQty,
              previousStock: p.stockQuantity,
              newStock,
              date: nowIso,
              notes: `Bütün satışlar təmizləndi, stok bərpa edildi`,
            });
            return { ...p, stockQuantity: newStock, updatedAt: nowIso };
          }
          return p;
        })
      );
      setMovements((prev) => [...newMovements, ...prev]);
    }

    setSales([]);
    setIncomes((prev) => prev.filter((i) => i.category !== 'Satış' && i.category !== 'Qaytarma'));
  };

  const wipeAllProducts = () => {
    localStorage.clear();
    setProducts([]);
    setSales([]);
    setPurchases([]);
    setExpenses([]);
    setRecurringExpenses([]);
    setIncomes([]);
    setMovements([]);
    setCategories([]);
    setSuppliers([]);
  };

  // Purchases
  const completePurchase = ({
    productId,
    quantity,
    purchasePrice,
    supplier,
    notes,
  }: {
    productId: number;
    quantity: number;
    purchasePrice: number;
    supplier?: string;
    notes?: string;
  }): Purchase => {
    if (quantity <= 0 || purchasePrice < 0) {
      throw new Error('Miqdar və qiymət düzgün daxil edilməlidir.');
    }
    const p = products.find((x) => x.id === productId);
    if (!p) throw new Error('Məhsul tapılmadı.');

    const nowIso = new Date().toISOString();
    const purchaseId = purchases.length > 0 ? Math.max(...purchases.map((pr) => pr.id)) + 1 : 1;
    const total = Number((quantity * purchasePrice).toFixed(2));

    const newPurchase: Purchase = {
      id: purchaseId,
      productId,
      productName: p.name,
      date: nowIso,
      quantity,
      purchasePrice,
      supplier: supplier || p.supplier,
      notes,
      total,
    };

    const newStock = p.stockQuantity + quantity;
    const movement: StockMovement = {
      id: Date.now(),
      productId,
      productName: p.name,
      type: 'Alış',
      quantity,
      previousStock: p.stockQuantity,
      newStock,
      date: nowIso,
      notes: notes || `Alış #${purchaseId}${supplier ? ` (${supplier})` : ''}`,
    };

    setProducts((prev) =>
      prev.map((item) =>
        item.id === productId
          ? {
              ...item,
              stockQuantity: newStock,
              purchasePrice: purchasePrice > 0 ? purchasePrice : item.purchasePrice,
              supplier: supplier || item.supplier,
              updatedAt: nowIso,
            }
          : item
      )
    );

    setMovements((prev) => [movement, ...prev]);
    setPurchases((prev) => [newPurchase, ...prev]);

    return newPurchase;
  };

  // Expenses & Income
  const addExpense = (exp: Omit<Expense, 'id'>) => {
    if (exp.amount <= 0 || !exp.description.trim()) {
      throw new Error('Xərc adı və məbləği daxil edilməlidir.');
    }
    const id = expenses.length > 0 ? Math.max(...expenses.map((e) => e.id)) + 1 : 1;
    setExpenses((prev) => [{ ...exp, id }, ...prev]);
  };

  const deleteExpense = (id: number) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const addIncome = (inc: Omit<Income, 'id'>) => {
    if (inc.amount <= 0 || !inc.description.trim()) {
      throw new Error('Gəlir adı və məbləği daxil edilməlidir.');
    }
    const id = incomes.length > 0 ? Math.max(...incomes.map((i) => i.id)) + 1 : 1;
    setIncomes((prev) => [{ ...inc, id }, ...prev]);
  };

  const deleteIncome = (id: number) => {
    setIncomes((prev) => prev.filter((i) => i.id !== id));
  };

  // Cash Register Operations (Kassa Mədaxil & Məxaric)
  const addCashIn = (amount: number, description: string, paymentMethod: 'Nağd' | 'Kart' = 'Nağd', notes?: string) => {
    if (amount <= 0) throw new Error('Məbləğ 0-dan böyük olmalıdır.');
    const nowIso = new Date().toISOString();
    const id = incomes.length > 0 ? Math.max(...incomes.map((i) => i.id)) + 1 : 1;
    const newIncome: Income = {
      id,
      category: 'Kassaya Mədaxil',
      description: description.trim() || 'Kassaya vəsait əlavəsi',
      amount: roundMoney(amount),
      date: nowIso,
      paymentMethod,
      notes: notes?.trim() || 'Kassaya əlavə edilən pul (Mədaxil)',
    };
    setIncomes((prev) => [newIncome, ...prev]);
  };

  const addCashOut = (amount: number, description: string, paymentMethod: 'Nağd' | 'Kart' = 'Nağd', notes?: string) => {
    if (amount <= 0) throw new Error('Məbləğ 0-dan böyük olmalıdır.');
    const nowIso = new Date().toISOString();
    const id = expenses.length > 0 ? Math.max(...expenses.map((e) => e.id)) + 1 : 1;
    const newExpense: Expense = {
      id,
      category: 'Kassadan Məxaric',
      description: description.trim() || 'Kassadan vəsait çıxarışı',
      amount: roundMoney(amount),
      date: nowIso,
      paymentMethod,
      notes: notes?.trim() || 'Kassadan çıxarılan pul (Məxaric / İnkasasiya)',
    };
    setExpenses((prev) => [newExpense, ...prev]);
  };

  const getKassaReport = (from?: Date, to?: Date): KassaReport => {
    return calculateKassaReport(sales, expenses, incomes, from, to);
  };

  // Recurring / Fixed Expenses (Stabil Xərclər)
  const addRecurringExpense = (exp: Omit<RecurringExpense, 'id' | 'createdAt'>) => {
    if (exp.amount <= 0 || !exp.title.trim()) {
      throw new Error('Stabil xərc adı və məbləği daxil edilməlidir.');
    }
    const id = recurringExpenses.length > 0 ? Math.max(...recurringExpenses.map((r) => r.id)) + 1 : 1;
    const newRecord: RecurringExpense = {
      ...exp,
      id,
      createdAt: new Date().toISOString(),
      isActive: exp.isActive ?? true,
    };
    setRecurringExpenses((prev) => [newRecord, ...prev]);
  };

  const updateRecurringExpense = (id: number, updated: Partial<Omit<RecurringExpense, 'id' | 'createdAt'>>) => {
    setRecurringExpenses((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
    );
  };

  const deleteRecurringExpense = (id: number) => {
    setRecurringExpenses((prev) => prev.filter((r) => r.id !== id));
  };

  const toggleRecurringExpense = (id: number) => {
    setRecurringExpenses((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isActive: !item.isActive } : item))
    );
  };

  const applyRecurringExpense = (id: number, customDate?: string): Expense => {
    const rec = recurringExpenses.find((r) => r.id === id);
    if (!rec) throw new Error('Stabil xərc qeydi tapılmadı.');

    const dateStr = customDate || new Date().toISOString().split('T')[0];
    const expId = expenses.length > 0 ? Math.max(...expenses.map((e) => e.id)) + 1 : 1;

    const newExpense: Expense = {
      id: expId,
      category: rec.category,
      description: `${rec.title} (${rec.period} stabil)`,
      amount: rec.amount,
      date: dateStr,
      paymentMethod: rec.paymentMethod,
      notes: rec.notes ? `${rec.notes} • Stabil xərcdən avtomatik köçürüldü` : 'Stabil xərcdən köçürüldü',
      recurringExpenseId: rec.id,
    };

    setExpenses((prev) => [newExpense, ...prev]);
    setRecurringExpenses((prev) =>
      prev.map((r) => (r.id === id ? { ...r, lastAppliedDate: dateStr } : r))
    );

    return newExpense;
  };

  const applyAllRecurringExpenses = (period?: RecurringPeriod, customDate?: string): number => {
    const dateStr = customDate || new Date().toISOString().split('T')[0];
    const targets = recurringExpenses.filter((r) => {
      if (!r.isActive) return false;
      if (period && r.period !== period) return false;
      if (r.lastAppliedDate) {
        if (r.period === 'Günlük' && r.lastAppliedDate === dateStr) return false;
        if (r.period === 'Aylıq' && r.lastAppliedDate.slice(0, 7) === dateStr.slice(0, 7)) return false;
      }
      return true;
    });

    if (targets.length === 0) return 0;

    let nextExpId = expenses.length > 0 ? Math.max(...expenses.map((e) => e.id)) + 1 : 1;
    const newExpensesList: Expense[] = [];
    const targetIds = new Set(targets.map((t) => t.id));

    for (const rec of targets) {
      newExpensesList.push({
        id: nextExpId++,
        category: rec.category,
        description: `${rec.title} (${rec.period} stabil)`,
        amount: rec.amount,
        date: dateStr,
        paymentMethod: rec.paymentMethod,
        notes: rec.notes ? `${rec.notes} • Stabil xərcdən köçürüldü` : 'Stabil xərcdən köçürüldü',
        recurringExpenseId: rec.id,
      });
    }

    setExpenses((prev) => [...newExpensesList, ...prev]);
    setRecurringExpenses((prev) =>
      prev.map((r) => (targetIds.has(r.id) ? { ...r, lastAppliedDate: dateStr } : r))
    );

    return targets.length;
  };

  // Categories & Suppliers
  const addCategory = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Kateqoriya adı boş ola bilməz.');
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error('Bu kateqoriya artıq mövcuddur.');
    }
    const id = categories.length > 0 ? Math.max(...categories.map((c) => c.id)) + 1 : 1;
    setCategories((prev) => [...prev, { id, name: trimmed }]);
  };

  const deleteCategory = (id: number) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  const addSupplier = (name: string, phone?: string, notes?: string) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Təchizatçı adı boş ola bilməz.');
    if (suppliers.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error('Bu təchizatçı artıq mövcuddur.');
    }
    const id = suppliers.length > 0 ? Math.max(...suppliers.map((s) => s.id)) + 1 : 1;
    setSuppliers((prev) => [...prev, { id, name: trimmed, phone, notes }]);
  };

  const deleteSupplier = (id: number) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
  };

  const updateSetting = (newSetting: Partial<Setting>) => {
    setSetting((prev) => ({ ...prev, ...newSetting }));
  };

  // Export / Import
  const exportDatabaseJson = (): string => {
    const backup = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      setting,
      categories,
      suppliers,
      products,
      sales,
      purchases,
      expenses,
      recurringExpenses,
      incomes,
      movements,
    };
    return JSON.stringify(backup, null, 2);
  };

  const importDatabaseJson = (jsonString: string): boolean => {
    try {
      const data = JSON.parse(jsonString);
      if (data.products && Array.isArray(data.products)) {
        setProducts(data.products);
        if (data.sales) setSales(data.sales);
        if (data.purchases) setPurchases(data.purchases);
        if (data.expenses) setExpenses(data.expenses);
        if (data.recurringExpenses) setRecurringExpenses(data.recurringExpenses);
        if (data.incomes) setIncomes(data.incomes);
        if (data.movements) setMovements(data.movements);
        if (data.categories) setCategories(data.categories);
        if (data.suppliers) setSuppliers(data.suppliers);
        if (data.setting) setSetting(data.setting);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const resetDatabase = () => {
    localStorage.clear();
    setProducts(INITIAL_PRODUCTS);
    setSales(INITIAL_SALES);
    setPurchases([]);
    setExpenses(INITIAL_EXPENSES);
    setRecurringExpenses(INITIAL_RECURRING_EXPENSES);
    setIncomes([]);
    setMovements(INITIAL_STOCK_MOVEMENTS);
    setCategories(INITIAL_CATEGORIES);
    setSuppliers(INITIAL_SUPPLIERS);
    setSetting(INITIAL_SETTING);
  };

  // Reporting calculations
  const getSummary = (from: Date, to: Date): SummaryReport => {
    const fromTime = from.getTime();
    const toTime = to.getTime();

    const periodSales = sales.filter((s) => {
      const t = new Date(s.date).getTime();
      return t >= fromTime && t <= toTime && !s.isReturned;
    });

    const salesTotal = roundMoney(periodSales.reduce((acc, s) => acc + s.total, 0));
    const grossProfit = roundMoney(
      periodSales.reduce((acc, s) => {
        const saleCost = s.items.reduce((iAcc, item) => iAcc + (item.costPrice * item.quantity), 0);
        return acc + (s.total - saleCost);
      }, 0)
    );

    const periodExpenses = expenses.filter((e) => {
      const t = new Date(e.date).getTime();
      return t >= fromTime && t <= toTime;
    });
    const totalExpenses = roundMoney(periodExpenses.reduce((acc, e) => acc + e.amount, 0));

    const kassaReport = calculateKassaReport(sales, expenses, incomes, from, to);

    return {
      sales: salesTotal,
      gross: grossProfit,
      expenses: totalExpenses,
      net: roundMoney(grossProfit - totalExpenses),
      count: periodSales.length,
      kassaReport,
    };
  };

  const getPurchasesTotal = (from: Date, to: Date): number => {
    const fromTime = from.getTime();
    const toTime = to.getTime();
    return purchases
      .filter((p) => {
        const t = new Date(p.date).getTime();
        return t >= fromTime && t <= toTime;
      })
      .reduce((acc, p) => acc + p.total, 0);
  };

  const getCostOfGoods = (from: Date, to: Date): number => {
    const fromTime = from.getTime();
    const toTime = to.getTime();
    return sales
      .filter((s) => {
        const t = new Date(s.date).getTime();
        return t >= fromTime && t <= toTime && !s.isReturned;
      })
      .reduce((acc, s) => acc + s.items.reduce((iAcc, item) => iAcc + item.costPrice * item.quantity, 0), 0);
  };

  const getProductsSold = (from: Date, to: Date): number => {
    const fromTime = from.getTime();
    const toTime = to.getTime();
    return sales
      .filter((s) => {
        const t = new Date(s.date).getTime();
        return t >= fromTime && t <= toTime && !s.isReturned;
      })
      .reduce((acc, s) => acc + s.items.reduce((iAcc, item) => iAcc + item.quantity, 0), 0);
  };

  const getBestSelling = (from: Date, to: Date): ProductMetric[] => {
    const fromTime = from.getTime();
    const toTime = to.getTime();
    const map = new Map<string, { quantity: number; amount: number }>();

    sales
      .filter((s) => {
        const t = new Date(s.date).getTime();
        return t >= fromTime && t <= toTime && !s.isReturned;
      })
      .forEach((s) => {
        s.items.forEach((item) => {
          const current = map.get(item.productName) || { quantity: 0, amount: 0 };
          map.set(item.productName, {
            quantity: current.quantity + item.quantity,
            amount: current.amount + item.total,
          });
        });
      });

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        quantity: data.quantity,
        amount: Number(data.amount.toFixed(2)),
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  };

  const getMostProfitable = (from: Date, to: Date): ProductMetric[] => {
    const fromTime = from.getTime();
    const toTime = to.getTime();
    const map = new Map<string, { quantity: number; amount: number }>();

    sales
      .filter((s) => {
        const t = new Date(s.date).getTime();
        return t >= fromTime && t <= toTime && !s.isReturned;
      })
      .forEach((s) => {
        s.items.forEach((item) => {
          const current = map.get(item.productName) || { quantity: 0, amount: 0 };
          map.set(item.productName, {
            quantity: current.quantity + item.quantity,
            amount: current.amount + item.profit,
          });
        });
      });

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        quantity: data.quantity,
        amount: Number(data.amount.toFixed(2)),
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  };

  const getStockReport = (): StockReport => {
    return {
      productCount: products.length,
      totalQuantity: products.reduce((acc, p) => acc + p.stockQuantity, 0),
      lowStock: products.filter((p) => p.stockQuantity <= p.minimumStock && p.stockQuantity > 0).length,
      outOfStock: products.filter((p) => p.stockQuantity <= 0).length,
    };
  };

  return (
    <StoreContext.Provider
      value={{
        products,
        sales,
        purchases,
        expenses,
        incomes,
        movements,
        categories,
        suppliers,
        setting,
        findProducts,
        byBarcode,
        saveProduct,
        deleteProduct,
        adjustStock,
        completeSale,
        returnSale,
        deleteSale,
        updateSale,
        clearAllSales,
        wipeAllProducts,
        payDebt,
        payCustomerDebts,
        completePurchase,
        addExpense,
        deleteExpense,
        addIncome,
        deleteIncome,
        addCashIn,
        addCashOut,
        getKassaReport,
        recurringExpenses,
        addRecurringExpense,
        updateRecurringExpense,
        deleteRecurringExpense,
        toggleRecurringExpense,
        applyRecurringExpense,
        applyAllRecurringExpenses,
        addCategory,
        deleteCategory,
        addSupplier,
        deleteSupplier,
        updateSetting,
        exportDatabaseJson,
        importDatabaseJson,
        resetDatabase,
        getSummary,
        getPurchasesTotal,
        getCostOfGoods,
        getProductsSold,
        getBestSelling,
        getMostProfitable,
        getStockReport,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
};
