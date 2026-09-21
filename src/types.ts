export interface ProductVariant {
  id: string;
  color: string;
  colorHex?: string;
  size: string; // e.g. "XS", "S", "M", "L", "XL", "38", "42"
  stockQuantity: number;
  barcode?: string;
}

export interface Product {
  id: number;
  barcode?: string;
  name: string;
  category: string;
  brand?: string;
  color?: string;
  colorHex?: string;
  size?: string; // e.g. "M", "L", "42" for single size or formatted list "XS, S, M, L, XL"
  sizes?: string[]; // Multiple available sizes for single product (e.g. ["XS", "S", "M", "L", "XL"])
  variants?: ProductVariant[]; // multi-variant list (size + color combinations with separate stock)
  purchasePrice: number;
  salePrice: number;
  stockQuantity: number;
  minimumStock: number;
  supplier?: string;
  imagePath?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  id: number;
  saleId: number;
  productId: number;
  productName: string;
  productBarcode?: string;
  brand?: string;
  color?: string;
  colorHex?: string;
  size?: string; // Geyim/ayaqqabı ölçüsü (XS, S, M, L, XL, 38, 42 və s.)
  variantId?: string; // Variant identifikatoru
  comment?: string; // Məhsula aid ayrıca şərh / qeyd (məs: "Müştəri sabah gəlib götürəcək")
  quantity: number;
  originalPrice?: number;
  discountPercent?: number;
  discountAmount?: number;
  salePrice: number;
  costPrice: number;
  total: number;
  profit: number;
}

export interface DebtPayment {
  id: number;
  saleId: number;
  date: string;
  amount: number;
  previousDebt: number;
  remainingDebt: number;
  paymentMethod: 'Nağd' | 'Kart';
  notes?: string;
}

export interface Sale {
  id: number;
  date: string;
  subtotal: number;
  itemDiscountsTotal?: number;
  subtotalAfterItemDiscounts?: number;
  globalDiscountPercent?: number;
  discount: number;
  totalDiscount?: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  debtAmount: number;
  initialDebtAmount?: number;
  initialPaidAmount?: number;
  paymentMethod: 'Nağd' | 'Kart' | 'Borc';
  partialPaymentMethod?: 'Nağd' | 'Kart';
  customerName?: string;
  notes?: string;
  isReturned: boolean;
  items: SaleItem[];
  debtPayments?: DebtPayment[];
}

export interface Purchase {
  id: number;
  productId: number;
  productName: string;
  date: string;
  quantity: number;
  purchasePrice: number;
  supplier?: string;
  notes?: string;
  total: number;
}

export interface Expense {
  id: number;
  category: string;
  description: string;
  amount: number;
  date: string;
  paymentMethod?: 'Nağd' | 'Kart';
  notes?: string;
  recurringExpenseId?: number;
}

export type RecurringPeriod = 'Günlük' | 'Həftəlik' | 'Aylıq' | 'İllik';

export interface RecurringExpense {
  id: number;
  title: string;
  category: string;
  amount: number;
  period: RecurringPeriod;
  paymentMethod: 'Nağd' | 'Kart';
  notes?: string;
  isActive: boolean;
  createdAt: string;
  lastAppliedDate?: string;
}

export interface Income {
  id: number;
  category: string;
  description: string;
  amount: number;
  date: string;
  paymentMethod?: 'Nağd' | 'Kart';
  notes?: string;
}

export interface StockMovement {
  id: number;
  productId: number;
  productName: string;
  type: 'İlkin stok' | 'Stok düzəlişi' | 'Alış' | 'Satış' | 'Qaytarma' | 'Satış ləğvi';
  quantity: number;
  previousStock: number;
  newStock: number;
  date: string;
  notes?: string;
}

export interface Setting {
  id: number;
  storeName: string;
  allowNegativeStock: boolean;
  currency: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface Supplier {
  id: number;
  name: string;
  phone?: string;
  notes?: string;
}

export interface CartRow {
  cartItemId: string; // unique row identifier, e.g. `${product.id}_${selectedVariantId || selectedSize || ''}_${selectedColor || ''}`
  product: Product;
  selectedVariantId?: string;
  selectedSize?: string;
  selectedColor?: string;
  selectedColorHex?: string;
  comment?: string; // Məhsula aid xüsusi şərh
  quantity: number;
  originalPrice: number;
  discountAmount: number; // in AZN
  discountedUnitPrice: number;
  total: number;
  discountPercent?: number;
}

export interface ProductMetric {
  name: string;
  quantity: number;
  amount: number;
}

export interface StockReport {
  productCount: number;
  totalQuantity: number;
  lowStock: number;
  outOfStock: number;
}

export interface SummaryReport {
  sales: number;
  gross: number;
  expenses: number;
  net: number;
  count: number;
  kassaReport: KassaReport;
}

export interface KassaReport {
  // Ümumi Satış dövriyyəsi (qaytarılmamış çeklərin tam satış məbləği)
  grossSales: number;
  salesCount: number;

  // Daxilolmalar (Real kassa daxilolmaları)
  cashSales: number; // Nağd satışlar (tam nağd + borc ilkin nağd + sonrakı nağd borc ödəmələri)
  cardSales: number; // Kart satışlar (tam kart + borc ilkin kart + sonrakı kart borc ödəmələri)
  totalSalesCollected: number; // cashSales + cardSales
  cashIn: number; // Kassaya əlavə edilən pul (Mədaxil)
  totalInflow: number; // Cəmi mədaxil (satış nağd/kart + kassaya əlavə olunan pul)

  // Çıxışlar (Xərclər, Məxaric, Qaytarmalar)
  expenses: number; // Cari xərclər (İcarə, kommunal, maaş, yemək və s.)
  cashExpenses: number; // Nağd ödənilən xərclər
  cardExpenses: number; // Kartla ödənilən xərclər
  cashOut: number; // Kassadan çıxarılan pul (Məxaric / İnkasasiya)
  refunds: number; // Geri qaytarmalar (müştəriyə geri verilən məbləğ)
  cashRefunds: number; // Nağd geri qaytarmalar
  cardRefunds: number; // Kartla geri qaytarmalar
  totalOutflow: number; // Cəmi məxaric (xərclər + kassadan çıxarılan pul + qaytarmalar)

  // Xalis Kassa Balansı
  netCashDrawer: number; // Xalis Nağd Kassa (kasada olan fiziki nağd pul): cashSales + cashIn - cashExpenses - cashOut - cashRefunds
  netCardBalance: number; // Xalis Kart / Bank hesabı: cardSales - cardExpenses - cardRefunds
  netKassa: number; // XALİS KASSA: totalInflow - totalOutflow
}

export type ActiveTab = 'Dashboard' | 'Mallar' | 'Satış' | 'Borclar' | 'Alış' | 'Maliyyə' | 'Hesabatlar' | 'Ayarlar';

