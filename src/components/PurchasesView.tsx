import React, { useState } from 'react';
import {
  PackagePlus,
  Truck,
  Plus,
  Search,
  CheckCircle,
  AlertCircle,
  FileText,
  Calendar,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';

export const PurchasesView: React.FC = () => {
  const {
    products,
    purchases,
    suppliers,
    setting,
    completePurchase,
    addSupplier,
  } = useStore();

  // Form state
  const [selectedProductId, setSelectedProductId] = useState<number>(products[0]?.id || 0);
  const [quantity, setQuantity] = useState<number>(10);
  const [price, setPrice] = useState<number>(0);
  const [selectedSupplier, setSelectedSupplier] = useState<string>(suppliers[0]?.name || '');
  const [notes, setNotes] = useState('');

  // Inline new supplier
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');

  // Notification
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filter history
  const [historySearch, setHistorySearch] = useState('');

  // Sync default price when product changes
  const handleProductChange = (productId: number) => {
    setSelectedProductId(productId);
    const p = products.find((x) => x.id === productId);
    if (p) {
      setPrice(p.purchasePrice || 0);
      if (p.supplier) setSelectedSupplier(p.supplier);
    }
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];
  const purchaseTotal = Number(((quantity || 0) * (price || 0)).toFixed(2));

  const handlePurchaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      if (!selectedProductId) throw new Error('Məhsul seçilməlidir.');
      if (quantity <= 0) throw new Error('Alış miqdarı 0-dan çox olmalıdır.');
      if (price < 0) throw new Error('Alış qiyməti mənfi ola bilməz.');

      const purchase = completePurchase({
        productId: selectedProductId,
        quantity: Number(quantity),
        purchasePrice: Number(price),
        supplier: selectedSupplier,
        notes,
      });

      setSuccess(`Alış #${purchase.id} uğurla qeydə alındı və anbar stoku artırıldı!`);
      setTimeout(() => setSuccess(null), 3000);
      setNotes('');
    } catch (err: any) {
      setError(err.message || 'Alış qeyd edilə bilmədi.');
    }
  };

  const handleQuickAddSupplier = () => {
    if (!newSupplierName.trim()) return;
    addSupplier(newSupplierName.trim(), newSupplierPhone.trim());
    setSelectedSupplier(newSupplierName.trim());
    setNewSupplierName('');
    setNewSupplierPhone('');
    setShowAddSupplier(false);
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium flex items-center gap-2 shadow-xs">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          {success}
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <PackagePlus className="w-6 h-6 text-blue-600" />
            Malların Alışı və Təchizat Qəbulu
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Təchizatçılardan daxil olan malları qeydiyyata alın və maya dəyərini yeniləyin
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* New Purchase Form (5 cols) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-600" />
              Yeni Alış Forması
            </h2>

            <form onSubmit={handlePurchaseSubmit} className="space-y-4">
              {/* Product Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Məhsul Seçin <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductChange(parseInt(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stok: {p.stockQuantity} əd.)
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity and Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Alış Miqdarı <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vahid Alış Qiyməti ({setting.currency}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Supplier Selector */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Təchizatçı</label>
                  <button
                    type="button"
                    onClick={() => setShowAddSupplier(!showAddSupplier)}
                    className="text-[10px] text-blue-600 font-semibold hover:underline"
                  >
                    + Yeni Təchizatçı
                  </button>
                </div>

                {showAddSupplier ? (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <input
                      type="text"
                      placeholder="Şirkət / Təchizatçı adı"
                      value={newSupplierName}
                      onChange={(e) => setNewSupplierName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Əlaqə nömrəsi (məs: +994 50 123 45 67)"
                      value={newSupplierPhone}
                      onChange={(e) => setNewSupplierPhone(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddSupplier(false)}
                        className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-md"
                      >
                        Ləğv
                      </button>
                      <button
                        type="button"
                        onClick={handleQuickAddSupplier}
                        className="px-3 py-1 text-xs bg-blue-600 text-white font-semibold rounded-md"
                      >
                        Əlavə et
                      </button>
                    </div>
                  </div>
                ) : (
                  <select
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seçilməyib</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Qeyd / Qaimə Nömrəsi
                </label>
                <input
                  type="text"
                  placeholder="Məs: Qaimə #QA-8492"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Total Summary */}
              <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-700 font-medium">Toplam Alış Dəyəri:</p>
                  <p className="text-xs text-slate-500">
                    {quantity} ədəd × {price.toFixed(2)} {setting.currency}
                  </p>
                </div>
                <div className="text-xl font-extrabold text-blue-900">
                  {purchaseTotal.toFixed(2)} {setting.currency}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-600/20 text-sm flex items-center justify-center gap-2 transition"
              >
                <PackagePlus className="w-4 h-4" />
                Alışı Təsdiqlə və Stoku Artır
              </button>
            </form>
          </div>
        </div>

        {/* Purchases History (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <h2 className="font-bold text-slate-900 text-base">Alışlar Tarixçəsi</h2>
            <div className="relative w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Məhsul və ya təchizatçı ilə axtar..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500">
                  <th className="py-3 px-4">Tarix</th>
                  <th className="py-3 px-3">Məhsul</th>
                  <th className="py-3 px-3">Təchizatçı</th>
                  <th className="py-3 px-3 text-center">Miqdar</th>
                  <th className="py-3 px-3 text-right">Alış Qiyməti</th>
                  <th className="py-3 px-4 text-right">Məbləğ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
                      Hələ heç bir alış qeydiyyatı aparılmayıb.
                    </td>
                  </tr>
                ) : (
                  purchases
                    .filter((p) => {
                      const q = historySearch.trim().toLowerCase();
                      return (
                        !q ||
                        p.productName.toLowerCase().includes(q) ||
                        (p.supplier && p.supplier.toLowerCase().includes(q)) ||
                        (p.notes && p.notes.toLowerCase().includes(q))
                      );
                    })
                    .map((purchase) => (
                      <tr key={purchase.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                          {new Date(purchase.date).toLocaleDateString('az-AZ', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          {purchase.productName}
                          {purchase.notes && (
                            <p className="text-[11px] text-slate-400 font-normal">{purchase.notes}</p>
                          )}
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-600">
                          {purchase.supplier || '—'}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-800">
                          +{purchase.quantity}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-600">
                          {purchase.purchasePrice.toFixed(2)} {setting.currency}
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-blue-600">
                          {purchase.total.toFixed(2)} {setting.currency}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
