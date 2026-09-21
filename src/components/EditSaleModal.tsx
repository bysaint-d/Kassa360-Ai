import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Check,
  Edit,
  Receipt,
  Plus,
  Trash2,
  Calendar,
  User,
  CreditCard,
  Banknote,
  Wallet,
  DollarSign,
  AlertCircle,
  Search,
  Tag,
  Package,
} from 'lucide-react';
import { Sale, SaleItem, Product } from '../types';
import { useStore } from '../context/StoreContext';
import { roundMoney } from '../utils/calculations';

interface EditSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  onSaveSuccess: (updatedSale: Sale) => void;
}

interface EditableSaleItem {
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
  originalPrice: number;
  discountAmount: number;
  costPrice?: number;
}

const COMMON_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '36', '38', '40', '42', '44'];

export const EditSaleModal: React.FC<EditSaleModalProps> = ({
  isOpen,
  onClose,
  sale,
  onSaveSuccess,
}) => {
  const { products, updateSale, setting } = useStore();

  const [customerName, setCustomerName] = useState('');
  const [date, setDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Nağd' | 'Kart' | 'Borc'>('Nağd');
  const [partialPaymentMethod, setPartialPaymentMethod] = useState<'Nağd' | 'Kart'>('Nağd');
  const [paidAmount, setPaidAmount] = useState<number | ''>('');
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<EditableSaleItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Add item selector state
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [productQuery, setProductQuery] = useState('');

  // Editing size state for a specific item
  const [editingSizeIndex, setEditingSizeIndex] = useState<number | null>(null);
  const [customSizeInput, setCustomSizeInput] = useState('');

  useEffect(() => {
    if (sale) {
      setCustomerName(sale.customerName || '');
      // Format date for datetime-local: YYYY-MM-DDTHH:mm
      try {
        const d = new Date(sale.date);
        const iso = d.toISOString().slice(0, 16);
        setDate(iso);
      } catch {
        setDate(sale.date || '');
      }
      setPaymentMethod(sale.paymentMethod || 'Nağd');
      setPartialPaymentMethod(sale.partialPaymentMethod || 'Nağd');
      setPaidAmount(sale.paidAmount !== undefined ? sale.paidAmount : sale.total);
      setDiscount(sale.discount || 0);
      setNotes(sale.notes || '');
      setItems(
        sale.items.map((item) => {
          const hasRealItemDiscounts = (sale.itemDiscountsTotal || 0) > 0;
          const basePrice = roundMoney(item.originalPrice ?? item.salePrice);
          const itemDisc = hasRealItemDiscounts ? (item.discountAmount || 0) : 0;
          const gross = roundMoney(basePrice * item.quantity);
          const lineDisc = roundMoney(Math.min(gross, Math.max(0, itemDisc)));
          const lineTotal = roundMoney(Math.max(0, gross - lineDisc));
          const unitSalePrice = roundMoney(lineTotal / Math.max(1, item.quantity));

          return {
            id: item.id,
            productId: item.productId,
            productName: item.productName,
            productBarcode: item.productBarcode,
            brand: item.brand,
            color: item.color,
            colorHex: item.colorHex,
            size: item.size,
            variantId: item.variantId,
            comment: item.comment,
            quantity: item.quantity,
            originalPrice: basePrice,
            salePrice: unitSalePrice,
            discountAmount: lineDisc,
            costPrice: item.costPrice,
          };
        })
      );
      setError(null);
      setIsAddingItem(false);
      setEditingSizeIndex(null);
    }
  }, [sale, isOpen]);

  // Calculations
  const grossSubtotal = useMemo(() => {
    return roundMoney(
      items.reduce((acc, it) => acc + (it.originalPrice * it.quantity), 0)
    );
  }, [items]);

  const itemDiscountsTotal = useMemo(() => {
    return roundMoney(
      items.reduce((acc, it) => acc + (it.discountAmount || 0), 0)
    );
  }, [items]);

  const subtotalAfterItemDiscounts = useMemo(() => {
    return roundMoney(
      items.reduce(
        (acc, it) => acc + Math.max(0, (it.originalPrice * it.quantity) - (it.discountAmount || 0)),
        0
      )
    );
  }, [items]);

  const totalCalculated = useMemo(() => {
    const validDiscount = Math.min(subtotalAfterItemDiscounts, Math.max(0, Number(discount) || 0));
    return roundMoney(Math.max(0, subtotalAfterItemDiscounts - validDiscount));
  }, [subtotalAfterItemDiscounts, discount]);

  const debtCalculated = useMemo(() => {
    if (paymentMethod !== 'Borc') return 0;
    const paid = Number(paidAmount) || 0;
    return roundMoney(Math.max(0, totalCalculated - paid));
  }, [paymentMethod, totalCalculated, paidAmount]);

  const changeCalculated = useMemo(() => {
    if (paymentMethod === 'Borc') return 0;
    const paid = Number(paidAmount) || 0;
    return roundMoney(Math.max(0, paid - totalCalculated));
  }, [paymentMethod, totalCalculated, paidAmount]);

  if (!isOpen || !sale) return null;

  // Quantity handlers
  const handleUpdateQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const lineGross = roundMoney(it.originalPrice * newQty);
        const lineDisc = roundMoney(Math.min(lineGross, Math.max(0, it.discountAmount || 0)));
        const lineTotal = roundMoney(Math.max(0, lineGross - lineDisc));
        const unitSalePrice = roundMoney(lineTotal / newQty);
        return {
          ...it,
          quantity: newQty,
          discountAmount: lineDisc,
          salePrice: unitSalePrice,
        };
      })
    );
  };

  const handleUpdatePrice = (index: number, newPrice: number) => {
    if (newPrice < 0) return;
    const basePrice = roundMoney(newPrice);
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const lineGross = roundMoney(basePrice * it.quantity);
        const lineDisc = roundMoney(Math.min(lineGross, Math.max(0, it.discountAmount || 0)));
        const lineTotal = roundMoney(Math.max(0, lineGross - lineDisc));
        const unitSalePrice = roundMoney(lineTotal / it.quantity);
        return {
          ...it,
          originalPrice: basePrice,
          salePrice: unitSalePrice,
          discountAmount: lineDisc,
        };
      })
    );
  };

  const handleUpdateItemDiscount = (index: number, newDiscount: number) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const lineGross = roundMoney(it.originalPrice * it.quantity);
        const lineDisc = roundMoney(Math.min(lineGross, Math.max(0, newDiscount)));
        const lineTotal = roundMoney(Math.max(0, lineGross - lineDisc));
        const unitSalePrice = roundMoney(lineTotal / it.quantity);
        return {
          ...it,
          discountAmount: lineDisc,
          salePrice: unitSalePrice,
        };
      })
    );
  };

  const handleUpdateItemSize = (index: number, newSize: string) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, size: newSize.trim() || undefined } : it))
    );
    setEditingSizeIndex(null);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setError('Çekdə ən azı 1 məhsul qalmalıdır.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  };

  // Add product to receipt
  const handleAddProductToSale = (p: Product) => {
    const existingIndex = items.findIndex((it) => it.productId === p.id && !it.size && !it.variantId);
    if (existingIndex >= 0) {
      handleUpdateQuantity(existingIndex, items[existingIndex].quantity + 1);
    } else {
      const defaultSize = (p.sizes && p.sizes.length > 0) ? p.sizes[0] : (p.size || undefined);
      const newItem: EditableSaleItem = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        productId: p.id,
        productName: p.name,
        productBarcode: p.barcode,
        brand: p.brand,
        color: p.color,
        colorHex: p.colorHex,
        size: defaultSize,
        quantity: 1,
        salePrice: p.salePrice,
        originalPrice: p.salePrice,
        discountAmount: 0,
        costPrice: p.purchasePrice,
      };
      setItems((prev) => [...prev, newItem]);
    }
    setIsAddingItem(false);
    setProductQuery('');
  };

  // Search filtered products
  const matchingProducts = products.filter((p) => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q))
    );
  }).slice(0, 6);

  // Submit update
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (items.length === 0) {
      setError('Çekdə ən azı 1 məhsul olmalıdır.');
      return;
    }

    for (const it of items) {
      if (it.quantity <= 0) {
        setError(`"${it.productName}" məhsulunun sayı 0-dan böyük olmalıdır.`);
        return;
      }
      if (it.salePrice < 0) {
        setError(`"${it.productName}" qiyməti mənfi ola bilməz.`);
        return;
      }
    }

    if (paymentMethod === 'Borc' && !customerName.trim() && !notes.trim()) {
      setError('Borc satışı üçün müştərinin adını daxil edin.');
      return;
    }

    try {
      const updated = updateSale(sale.id, {
        customerName: customerName.trim() || undefined,
        paymentMethod,
        partialPaymentMethod: paymentMethod === 'Borc' ? partialPaymentMethod : undefined,
        paidAmount: paymentMethod === 'Borc' ? (Number(paidAmount) || 0) : (paidAmount !== '' ? Number(paidAmount) : totalCalculated),
        discount: Math.max(0, Number(discount) || 0),
        notes: notes.trim() || undefined,
        date: date ? new Date(date).toISOString() : undefined,
        items,
      });

      onSaveSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Çekə düzəliş edilərkən xəta baş verdi.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col my-auto max-h-[92vh] animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Edit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg">Çek #{sale.id} Düzəliş</h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  sale.isReturned ? 'bg-rose-500/30 text-rose-200' : 'bg-emerald-500/30 text-emerald-200'
                }`}>
                  {sale.isReturned ? 'Qaytarılıb' : 'Tamamlanıb'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Məhsul sayı, qiymətlər, ölçü, müştəri və ödəniş məlumatlarını yeniləyin
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Sale Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80">
            {/* Customer Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-600" />
                Müştəri Adı
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Məs: Rəşad Əliyev"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Sale Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                Satış Tarixi və Saatı
              </label>
              <input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Ödəniş Üsulu
              </label>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-200/60 p-1 rounded-xl">
                {(['Nağd', 'Kart', 'Borc'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(m);
                      if (m !== 'Borc') {
                        setPaidAmount(totalCalculated);
                      }
                    }}
                    className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                      paymentMethod === m
                        ? m === 'Borc'
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : m === 'Kart'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Paid Amount / Partial for debt */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {paymentMethod === 'Borc' ? 'İlkin Ödənilən Məbləğ' : 'Kassaya Verilən Məbləğ'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder={totalCalculated.toFixed(2)}
                  className="w-full pl-3 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  {setting.currency}
                </span>
              </div>
              {paymentMethod === 'Borc' && (
                <div className="mt-1 flex items-center justify-between text-[11px]">
                  <span className="text-amber-800 font-semibold">Qalan Borc:</span>
                  <span className="font-extrabold text-amber-700">
                    {debtCalculated.toFixed(2)} {setting.currency}
                  </span>
                </div>
              )}
              {paymentMethod === 'Nağd' && changeCalculated > 0 && (
                <div className="mt-1 flex items-center justify-between text-[11px]">
                  <span className="text-emerald-700 font-semibold">Qaytarılacaq Qalıq:</span>
                  <span className="font-extrabold text-emerald-700">
                    {changeCalculated.toFixed(2)} {setting.currency}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Items Table Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-blue-600" />
                Çekdəki Məhsullar ({items.length})
              </label>
              <button
                type="button"
                onClick={() => setIsAddingItem(!isAddingItem)}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {isAddingItem ? 'Axtarışı Bağla' : 'Məhsul Əlavə Et'}
              </button>
            </div>

            {/* Add product dropdown panel */}
            {isAddingItem && (
              <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 space-y-2 animate-in fade-in">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-blue-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Məhsul adı və ya barkod ilə axtar..."
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {matchingProducts.length === 0 ? (
                    <p className="text-[11px] text-slate-500 p-2 text-center">Uyğun məhsul tapılmadı</p>
                  ) : (
                    matchingProducts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleAddProductToSale(p)}
                        className="flex items-center justify-between p-2 bg-white hover:bg-blue-100/50 rounded-lg border border-slate-100 cursor-pointer transition text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 truncate">{p.name}</p>
                          <p className="text-[10px] text-slate-400">
                            Stok: {p.stockQuantity} | {p.category}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-extrabold text-blue-700">
                            {p.salePrice.toFixed(2)} {setting.currency}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Items List */}
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
              {items.map((it, idx) => {
                const lineTotal = roundMoney(Math.max(0, (it.originalPrice * it.quantity) - (it.discountAmount || 0)));
                const isEditingSize = editingSizeIndex === idx;

                return (
                  <div key={idx} className="p-3 hover:bg-slate-50/60 transition space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-slate-900">{it.productName}</span>
                          {it.brand && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                              {it.brand}
                            </span>
                          )}
                          {it.color && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                              {it.colorHex && (
                                <span
                                  className="w-2 h-2 rounded-full border border-slate-300"
                                  style={{ backgroundColor: it.colorHex }}
                                />
                              )}
                              {it.color}
                            </span>
                          )}
                        </div>
                        {it.productBarcode && (
                          <span className="text-[10px] font-mono text-slate-400">
                            Barkod: {it.productBarcode}
                          </span>
                        )}
                      </div>

                      {/* Line Controls: Quantity, Price, Total, Delete */}
                      <div className="flex items-center gap-3 self-end sm:self-center">
                        {/* Quantity controls */}
                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(idx, it.quantity - 1)}
                            className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={it.quantity}
                            onChange={(e) => handleUpdateQuantity(idx, parseInt(e.target.value) || 1)}
                            className="w-10 text-center text-xs font-extrabold text-slate-900 border-x border-slate-200 py-1 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(idx, it.quantity + 1)}
                            className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
                          >
                            +
                          </button>
                        </div>

                        {/* Unit Sale Price */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400">Qiymət:</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={it.originalPrice}
                            onChange={(e) => handleUpdatePrice(idx, parseFloat(e.target.value) || 0)}
                            className="w-16 px-1.5 py-1 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg text-right outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        {/* Line Total */}
                        <div className="w-20 text-right">
                          <span className="text-xs font-black text-slate-900">
                            {lineTotal.toFixed(2)} ₼
                          </span>
                        </div>

                        {/* Delete line item */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-300 hover:text-rose-600 rounded transition cursor-pointer"
                          title="Məhsulu çekdən çıxar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Size and Item Discount Row */}
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100/80 gap-2 flex-wrap">
                      {/* Size Selector */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-medium">Ölçü:</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (isEditingSize) {
                              setEditingSizeIndex(null);
                            } else {
                              setEditingSizeIndex(idx);
                              setCustomSizeInput(it.size || '');
                            }
                          }}
                          className={`px-2 py-0.5 rounded font-bold cursor-pointer transition flex items-center gap-1 ${
                            it.size
                              ? 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {it.size ? it.size : '+ Ölçü yaz/seç'}
                        </button>
                      </div>

                      {/* Line discount */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-medium">Sətir Endirimi:</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={it.discountAmount || ''}
                          onChange={(e) => handleUpdateItemDiscount(idx, parseFloat(e.target.value) || 0)}
                          placeholder="0 ₼"
                          className="w-14 px-1.5 py-0.5 text-[11px] font-bold text-rose-600 bg-rose-50/60 border border-rose-200 rounded text-right outline-none"
                        />
                      </div>
                    </div>

                    {/* Size Editing Drawer */}
                    {isEditingSize && (
                      <div className="p-2.5 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-2 mt-1 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-indigo-900 uppercase">
                            Ölçü Təyini:
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingSizeIndex(null)}
                            className="text-[10px] text-indigo-600 hover:text-indigo-900 font-bold"
                          >
                            Bağla
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {COMMON_SIZES.map((sz) => (
                            <button
                              key={sz}
                              type="button"
                              onClick={() => handleUpdateItemSize(idx, sz)}
                              className={`px-2 py-1 text-xs font-bold rounded-lg border transition cursor-pointer ${
                                it.size === sz
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white hover:bg-indigo-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {sz}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-1.5 pt-1">
                          <input
                            type="text"
                            value={customSizeInput}
                            onChange={(e) => setCustomSizeInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleUpdateItemSize(idx, customSizeInput);
                              }
                            }}
                            placeholder="Məs: 3Düymə qara Xl, 42, Standart..."
                            className="flex-1 px-2.5 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-medium outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateItemSize(idx, customSizeInput)}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                          >
                            Təsdiq
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Financial Totals & Overall Discount */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Məhsulların Ara Cəmi:</span>
              <span className="font-bold text-slate-800">{grossSubtotal.toFixed(2)} {setting.currency}</span>
            </div>

            {itemDiscountsTotal > 0 && (
              <div className="flex items-center justify-between text-xs text-rose-600 font-medium">
                <span>Məhsul Endirimləri:</span>
                <span>-{itemDiscountsTotal.toFixed(2)} {setting.currency}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs">
              <span className="text-rose-700 font-semibold flex items-center gap-1">
                <Tag className="w-3 h-3 text-rose-500" />
                Ümumi Çek Endirimi (AZN):
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0.00"
                  className="w-20 px-2 py-1 text-xs font-bold text-rose-600 bg-white border border-rose-200 rounded-lg text-right outline-none focus:ring-1 focus:ring-rose-500"
                />
                <span className="text-xs text-rose-500 font-bold">{setting.currency}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
              <span className="font-bold text-sm text-slate-900">Yekun Çek Məbləği:</span>
              <span className="font-black text-base text-blue-700">
                {totalCalculated.toFixed(2)} {setting.currency}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Çekə Aid Qeyd / Şərh
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Məs: Müştəri endirimi, xüsusi sifariş və s."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Ləğv Et
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Dəyişiklikləri Yadda Saxla
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
