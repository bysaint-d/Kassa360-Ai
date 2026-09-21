import React from 'react';
import { Printer, X, CheckCircle2 } from 'lucide-react';
import { Sale } from '../types';
import { useStore } from '../context/StoreContext';

interface ReceiptModalProps {
  sale: Sale | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, onClose }) => {
  const { setting } = useStore();

  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(sale.date).toLocaleString('az-AZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-base">Satış Çeki #{sale.id}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Receipt Paper */}
        <div className="p-6 overflow-y-auto font-mono text-sm bg-slate-50 border-b border-slate-200">
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-4 text-slate-800" id="receipt-paper">
            {/* Store Name & Header */}
            <div className="text-center border-b border-dashed border-slate-300 pb-4">
              <h2 className="font-bold text-lg text-slate-900 tracking-wider uppercase">
                {setting.storeName || 'CALVOTTI MARKET'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Müştəri Xidməti & Kassa</p>
              <p className="text-xs text-slate-400 mt-1">Tarix: {formattedDate}</p>
              <p className="text-xs text-slate-500">Çek No: #{sale.id}</p>
              {sale.customerName && (
                <p className="text-xs font-semibold text-blue-600 mt-1">Müştəri: {sale.customerName}</p>
              )}
              {sale.notes && (
                <p className="text-[11px] font-medium text-slate-600 mt-0.5 bg-slate-50 py-1 px-2 rounded border border-slate-200">
                  Qeyd: {sale.notes}
                </p>
              )}
            </div>

            {/* Line Items */}
            <div className="space-y-2 text-xs border-b border-dashed border-slate-300 pb-4">
              <div className="grid grid-cols-12 font-bold text-slate-500 pb-1 border-b border-slate-100">
                <span className="col-span-6">Məhsul</span>
                <span className="col-span-2 text-center">Say</span>
                <span className="col-span-2 text-right">Qiymət</span>
                <span className="col-span-2 text-right">Məbləğ</span>
              </div>
              {sale.items.map((item) => (
                <div key={item.id} className="grid grid-cols-12 py-1.5 items-start border-b border-slate-50 last:border-0">
                  <div className="col-span-6 pr-1">
                    <p className="font-semibold text-slate-800">{item.productName}</p>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-sans flex-wrap mt-0.5">
                      {item.brand && (
                        <span className="px-1 py-0.2 bg-blue-50 text-blue-700 rounded font-medium">
                          {item.brand}
                        </span>
                      )}
                      {(item.color || item.size) && (
                        <span className="px-1.5 py-0.2 bg-slate-100 text-slate-800 rounded font-semibold border border-slate-200">
                          {[item.color, item.size].filter(Boolean).join(' | ')}
                        </span>
                      )}
                      {item.productBarcode && (
                        <span className="font-mono text-slate-400">
                          [{item.productBarcode}]
                        </span>
                      )}
                    </div>
                    {item.comment && (
                      <p className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60 font-sans mt-1">
                        💬 Şərh: {item.comment}
                      </p>
                    )}
                    {item.discountAmount !== undefined && item.discountAmount > 0 && (
                      <p className="text-[10px] text-rose-600 font-medium mt-0.5 font-sans">
                        Endirim: -{item.discountAmount.toFixed(2)} {setting.currency} (Satış: {item.salePrice.toFixed(2)} {setting.currency})
                      </p>
                    )}
                  </div>
                  <span className="col-span-2 text-center text-slate-600 font-medium">{item.quantity}</span>
                  <div className="col-span-2 text-right">
                    {item.originalPrice && item.originalPrice !== item.salePrice ? (
                      <div>
                        <span className="line-through text-slate-400 text-[10px] block">
                          {item.originalPrice.toFixed(2)}
                        </span>
                        <span className="text-slate-800 font-medium">
                          {item.salePrice.toFixed(2)}{setting.currency}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-600 font-medium">
                        {item.salePrice.toFixed(2)}{setting.currency}
                      </span>
                    )}
                  </div>
                  <span className="col-span-2 text-right font-bold text-slate-900">
                    {item.total.toFixed(2)}{setting.currency}
                  </span>
                </div>
              ))}
            </div>

            {/* Financial Summary */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Ara cəmi (İlkin):</span>
                <span>{sale.subtotal.toFixed(2)} {setting.currency}</span>
              </div>
              {sale.itemDiscountsTotal !== undefined && sale.itemDiscountsTotal > 0 && (
                <div className="flex justify-between text-rose-600 font-medium">
                  <span>Məhsul endirimləri:</span>
                  <span>-{sale.itemDiscountsTotal.toFixed(2)} {setting.currency}</span>
                </div>
              )}
              {sale.discount > 0 && (
                <div className="flex justify-between text-rose-600 font-medium">
                  <span>Səbət endirimi:</span>
                  <span>-{sale.discount.toFixed(2)} {setting.currency}</span>
                </div>
              )}
              {(sale.totalDiscount !== undefined && sale.totalDiscount > 0 && (sale.itemDiscountsTotal || 0) > 0 && sale.discount > 0) && (
                <div className="flex justify-between text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                  <span>Cəmi endirim:</span>
                  <span>-{sale.totalDiscount.toFixed(2)} {setting.currency}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                <span>YEKUN:</span>
                <span>{sale.total.toFixed(2)} {setting.currency}</span>
              </div>
              <div className="flex justify-between text-slate-600 pt-2">
                <span>Ödəniş növü:</span>
                <span className="font-semibold text-slate-800">
                  {sale.paymentMethod === 'Borc' && sale.paidAmount > 0
                    ? `Borc (İlkin ${sale.partialPaymentMethod || 'Nağd'})`
                    : sale.paymentMethod}
                </span>
              </div>
              {sale.customerName && (
                <div className="flex justify-between text-slate-600">
                  <span>{sale.paymentMethod === 'Borc' || sale.debtAmount > 0 ? 'Borc Alan Müştəri:' : 'Müştəri:'}</span>
                  <span className="font-bold text-slate-800">{sale.customerName}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Ödənilən məbləğ:</span>
                <span className="font-bold text-emerald-700">{sale.paidAmount.toFixed(2)} {setting.currency}</span>
              </div>
              {sale.changeAmount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Qalıq pul:</span>
                  <span>{sale.changeAmount.toFixed(2)} {setting.currency}</span>
                </div>
              )}
              {sale.debtAmount > 0 ? (
                <div className="flex justify-between text-amber-700 font-bold bg-amber-50 p-1.5 rounded border border-amber-200">
                  <span>Qalıq Borc Məbləği:</span>
                  <span>{sale.debtAmount.toFixed(2)} {setting.currency}</span>
                </div>
              ) : (sale.paymentMethod === 'Borc' && (
                <div className="flex justify-between text-emerald-700 font-bold bg-emerald-50 p-1.5 rounded border border-emerald-200">
                  <span>Borc Vəziyyəti:</span>
                  <span>Tam Ödənilib (0.00 {setting.currency})</span>
                </div>
              ))}

              {sale.debtPayments && sale.debtPayments.length > 0 && (
                <div className="pt-2 border-t border-dashed border-slate-300 space-y-1">
                  <p className="font-bold text-[11px] text-slate-700">Ayrı-ayrı Ödəniş Tarixçəsi:</p>
                  {sale.debtPayments.map((p, idx) => (
                    <div key={p.id || idx} className="flex justify-between text-[10px] text-slate-600">
                      <span>
                        {idx + 1}. {new Date(p.date).toLocaleDateString('az-AZ')} ({p.paymentMethod}):
                      </span>
                      <span className="font-semibold text-emerald-700">
                        +{p.amount.toFixed(2)} {setting.currency}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Message & Barcode */}
            <div className="text-center pt-4 border-t border-dashed border-slate-300">
              <p className="text-xs font-semibold text-slate-700">Bizi seçdiyiniz üçün təşəkkür edirik!</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Yenidən gözləyirik.</p>
              <div className="mt-3 flex justify-center">
                <div className="font-mono text-[10px] tracking-widest bg-slate-100 px-3 py-1 rounded text-slate-600 border border-slate-200">
                  * {sale.id.toString().padStart(8, '0')} *
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-white flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
          >
            Bağla
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 flex items-center gap-2 transition"
          >
            <Printer className="w-4 h-4" />
            Çap et
          </button>
        </div>
      </div>
    </div>
  );
};
