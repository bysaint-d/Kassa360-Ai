import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  Search,
  CheckCircle2,
  DollarSign,
  User,
  Calendar,
  Clock,
  AlertCircle,
  TrendingDown,
  Printer,
  ChevronDown,
  ChevronUp,
  Coins,
  ArrowRight,
  Filter,
  Check,
  Receipt,
  History,
  FileText,
  BadgePercent,
  PlusCircle,
  Wallet,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Sale, DebtPayment } from '../types';
import { ReceiptModal } from './ReceiptModal';

export const BorclarView: React.FC = () => {
  const { sales, payDebt, payCustomerDebts, setting } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'active' | 'all' | 'settled'>('active');
  const [selectedSaleForPayment, setSelectedSaleForPayment] = useState<Sale | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'Nağd' | 'Kart'>('Nağd');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);
  const [expandedSaleId, setExpandedSaleId] = useState<number | null>(null);

  // Customer statement modal
  const [selectedCustomerForStatement, setSelectedCustomerForStatement] = useState<string | null>(null);

  // All sales that have debt history (either currently has debt or was a debt sale)
  const debtSales = useMemo(() => {
    return sales
      .filter((s) => s.paymentMethod === 'Borc' || s.debtAmount > 0 || (s.paidAmount < s.total && !s.isReturned))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales]);

  // Overall statistics
  const totalActiveDebt = useMemo(() => {
    return debtSales.reduce((acc, s) => acc + (s.debtAmount || 0), 0);
  }, [debtSales]);

  const activeDebtCount = useMemo(() => {
    return debtSales.filter((s) => (s.debtAmount || 0) > 0).length;
  }, [debtSales]);

  const totalCollectedDebt = useMemo(() => {
    return debtSales.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
  }, [debtSales]);

  // Helper to extract or synthesize itemized payment installments for a sale
  const getSalePaymentHistory = (sale: Sale): DebtPayment[] => {
    if (sale.debtPayments && sale.debtPayments.length > 0) {
      return sale.debtPayments;
    }
    const history: DebtPayment[] = [];
    if (sale.paidAmount > 0) {
      history.push({
        id: sale.id * 1000 + 1,
        saleId: sale.id,
        date: sale.date,
        amount: sale.paidAmount,
        previousDebt: sale.total,
        remainingDebt: sale.debtAmount,
        paymentMethod: sale.partialPaymentMethod || 'Nağd',
        notes: 'İlkin ödəniş (Satış anında kassa)',
      });
    }
    return history;
  };

  // Filtered sales
  const filteredSales = useMemo(() => {
    return debtSales.filter((sale) => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !q ||
        sale.id.toString().includes(q) ||
        (sale.customerName && sale.customerName.toLowerCase().includes(q)) ||
        (sale.notes && sale.notes.toLowerCase().includes(q)) ||
        sale.items.some((i) => i.productName.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (filterStatus === 'active') return sale.debtAmount > 0;
      if (filterStatus === 'settled') return sale.debtAmount === 0;
      return true;
    });
  }, [debtSales, searchTerm, filterStatus]);

  // Customer grouped aggregated summary
  const customerDebtsSummary = useMemo(() => {
    const map = new Map<string, { totalDebt: number; totalSales: number; totalPaid: number; lastDate: string }>();
    debtSales
      .filter((s) => s.debtAmount > 0)
      .forEach((s) => {
        const name = s.customerName?.trim() || 'Adsız Müştəri';
        const current = map.get(name) || { totalDebt: 0, totalSales: 0, totalPaid: 0, lastDate: s.date };
        current.totalDebt += s.debtAmount;
        current.totalSales += 1;
        current.totalPaid += s.paidAmount;
        if (new Date(s.date) > new Date(current.lastDate)) {
          current.lastDate = s.date;
        }
        map.set(name, current);
      });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.totalDebt - a.totalDebt);
  }, [debtSales]);

  // Customer statement data
  const customerStatementData = useMemo(() => {
    if (!selectedCustomerForStatement) return null;
    const name = selectedCustomerForStatement.trim().toLowerCase();
    const customerSales = debtSales.filter(
      (s) => (s.customerName || '').trim().toLowerCase() === name
    );
    const totalDebt = customerSales.reduce((acc, s) => acc + s.debtAmount, 0);
    const totalPaid = customerSales.reduce((acc, s) => acc + s.paidAmount, 0);
    const totalPurchased = customerSales.reduce((acc, s) => acc + s.total, 0);

    // Collect all payment steps across all sales
    const allPayments: { saleId: number; payment: DebtPayment }[] = [];
    customerSales.forEach((sale) => {
      const payments = getSalePaymentHistory(sale);
      payments.forEach((p) => {
        allPayments.push({ saleId: sale.id, payment: p });
      });
    });
    allPayments.sort((a, b) => new Date(b.payment.date).getTime() - new Date(a.payment.date).getTime());

    return {
      customerName: selectedCustomerForStatement,
      sales: customerSales,
      allPayments,
      totalDebt,
      totalPaid,
      totalPurchased,
    };
  }, [selectedCustomerForStatement, debtSales]);

  // Handle opening pay modal
  const handleOpenPayModal = (sale: Sale) => {
    setSelectedSaleForPayment(sale);
    setPaymentAmount(sale.debtAmount.toString());
    setPaymentMethod('Nağd');
    setPaymentNotes('');
    setPaymentError(null);
    setPaymentSuccess(null);
  };

  // Submit debt payment
  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSaleForPayment) return;

    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setPaymentError('Zəhmət olmasa düzgün məbləğ daxil edin.');
      return;
    }

    if (amount > selectedSaleForPayment.debtAmount) {
      setPaymentError(
        `Ödəniş məbləği qalıq borcdan (${selectedSaleForPayment.debtAmount.toFixed(2)} ${setting.currency}) çox ola bilməz.`
      );
      return;
    }

    try {
      payDebt(selectedSaleForPayment.id, amount, paymentMethod, paymentNotes);
      const remainingAfter = Math.max(0, Number((selectedSaleForPayment.debtAmount - amount).toFixed(2)));
      
      setPaymentSuccess(
        `${amount.toFixed(2)} ${setting.currency} borc ödənişi uğurla qəbul edildi! (Qalan borc: ${remainingAfter.toFixed(2)} ${setting.currency})`
      );

      // Keep open shortly so user sees feedback and updated history
      setTimeout(() => {
        setSelectedSaleForPayment(null);
        setPaymentSuccess(null);
      }, 1400);
    } catch (err: any) {
      setPaymentError(err.message || 'Ödəniş qeyd edilə bilmədi.');
    }
  };

  const handlePrintStatement = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-amber-600" />
            Borclar və Nisyə Dəftəri
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Borca götürülmüş mallar, müştərilər üzrə hər dəfə edilən ayrı-ayrı ödənişlərin tam tarixçəsi
          </p>
        </div>

        {/* Action / Search stats */}
        <div className="flex items-center gap-2">
          {activeDebtCount > 0 ? (
            <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              {activeDebtCount} aktiv borc qeydi
            </span>
          ) : (
            <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Bütün borclar tam ödənilib
            </span>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-xs bg-linear-to-br from-amber-50/50 to-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Cəmi Qalıq Borc</span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-extrabold text-amber-900 mt-2">
            {totalActiveDebt.toFixed(2)} {setting.currency}
          </h3>
          <p className="text-xs text-amber-700/80 mt-1">Müştərilərdən alınacaq ümumi məbləğ</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-xs bg-linear-to-br from-emerald-50/50 to-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Ödənilmiş Məbləğ</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-extrabold text-emerald-900 mt-2">
            {totalCollectedDebt.toFixed(2)} {setting.currency}
          </h3>
          <p className="text-xs text-emerald-700/80 mt-1">Nisyə satışlardan yığılan vəsait</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Borclu Müştəri Sayı</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mt-2">
            {customerDebtsSummary.length} <span className="text-sm font-normal text-slate-500">nəfər</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">Aktiv borcu olan müştərilər</p>
        </div>
      </div>

      {/* Top Debtors Quick Chips & Statement View */}
      {customerDebtsSummary.length > 0 && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <User className="w-4 h-4 text-amber-600" />
              Müştərilər üzrə Qalıq Borclar (Vərəqə və Filtrlər):
            </span>
            <span className="text-[11px] text-slate-400">
              Vərəqəyə baxmaq və ya filtrləmək üçün müştəri kartına klikləyin
            </span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {customerDebtsSummary.map((cust) => (
              <div
                key={cust.name}
                className={`group px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-2 ${
                  searchTerm === cust.name
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-amber-50/70 text-amber-900 border-amber-200/80 hover:bg-amber-100/80'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSearchTerm(cust.name === searchTerm ? '' : cust.name)}
                  className="flex items-center gap-1.5 cursor-pointer text-left"
                  title="Bu müştərinin borclarını filtrlə"
                >
                  <span className="font-bold">{cust.name}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[11px] font-bold ${
                      searchTerm === cust.name ? 'bg-amber-700 text-white' : 'bg-white text-amber-800 border border-amber-200'
                    }`}
                  >
                    {cust.totalDebt.toFixed(2)} {setting.currency}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedCustomerForStatement(cust.name)}
                  className={`p-1 rounded-md transition cursor-pointer text-[10px] flex items-center gap-1 ${
                    searchTerm === cust.name
                      ? 'bg-amber-700 hover:bg-amber-800 text-white'
                      : 'bg-amber-200/60 hover:bg-amber-200 text-amber-900'
                  }`}
                  title={`${cust.name} üçün borc vərəqəsi və ödəniş tarixçəsi`}
                >
                  <FileText className="w-3 h-3" />
                  <span>Vərəqə</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main List Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Controls */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative flex-1 w-full sm:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Müştəri adı, qeyd (məs: Elmir) və ya çek nömrəsinə görə axtar..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Filter Status */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
              <Filter className="w-3.5 h-3.5" /> Status:
            </span>
            {[
              { id: 'active', label: 'Aktiv Borclar' },
              { id: 'settled', label: 'Bağlanmış Borclar' },
              { id: 'all', label: 'Hamısı' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setFilterStatus(st.id as any)}
                className={`px-3 py-1 text-xs rounded-lg font-semibold transition cursor-pointer ${
                  filterStatus === st.id
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* List of Debt Sales */}
        {filteredSales.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <p className="font-semibold text-slate-700">Seçilmiş parametr üzrə borc qeydi tapılmadı.</p>
            <p className="text-xs text-slate-400">Bütün borclar ödənilib və ya axtarışa uyğun nəticə yoxdur.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredSales.map((sale) => {
              const isExpanded = expandedSaleId === sale.id;
              const formattedDate = new Date(sale.date).toLocaleString('az-AZ', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              const paymentsHistory = getSalePaymentHistory(sale);
              const paidPercent = Math.min(100, Math.round((sale.paidAmount / (sale.total || 1)) * 100));

              return (
                <div
                  key={sale.id}
                  className={`p-5 transition ${
                    sale.debtAmount > 0
                      ? 'hover:bg-amber-50/30 bg-white'
                      : 'hover:bg-slate-50/50 bg-slate-50/20 opacity-90'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Customer & Info */}
                    <div className="flex items-start gap-3.5 flex-1">
                      <div
                        className={`w-11 h-11 rounded-2xl flex flex-col items-center justify-center font-bold text-xs flex-shrink-0 shadow-xs ${
                          sale.debtAmount > 0
                            ? 'bg-linear-to-br from-amber-500 to-amber-600 text-white'
                            : 'bg-linear-to-br from-emerald-500 to-emerald-600 text-white'
                        }`}
                      >
                        {sale.debtAmount > 0 ? (
                          <>
                            <span className="text-[9px] uppercase tracking-wider font-extrabold">BORC</span>
                            <span className="text-[11px]">#{sale.id}</span>
                          </>
                        ) : (
                          <Check className="w-6 h-6 text-white" />
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedCustomerForStatement(sale.customerName || 'Müştəri')}
                            className="font-extrabold text-slate-900 text-base flex items-center gap-1.5 hover:text-blue-600 transition cursor-pointer"
                            title="Müştərinin tam borc vərəqəsinə bax"
                          >
                            <User className="w-4 h-4 text-slate-400" />
                            <span>{sale.customerName || 'Adsız Müştəri'}</span>
                          </button>

                          <span className="text-xs text-slate-400 font-mono">Çek #{sale.id}</span>

                          {sale.debtAmount > 0 ? (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                              Qalıq Borc: {sale.debtAmount.toFixed(2)} {setting.currency}
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Tam Ödənilib (0.00 {setting.currency})
                            </span>
                          )}
                        </div>

                        {/* Date & metadata */}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {formattedDate}
                          </span>
                          <span>•</span>
                          <span>{sale.items.length} çeşid məhsul</span>
                          <span>•</span>
                          <span className="font-medium text-slate-600">
                            {paymentsHistory.length} ödəniş mərhələsi qeydə alınıb
                          </span>
                          {sale.notes && (
                            <>
                              <span>•</span>
                              <span className="text-amber-900 bg-amber-100/70 border border-amber-200/80 px-2 py-0.5 rounded text-[11px] font-semibold">
                                Qeyd: {sale.notes}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Financial Numbers & Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between lg:justify-end gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                      {/* Financial Badges Strip */}
                      <div className="grid grid-cols-3 sm:flex sm:items-center gap-2 text-xs">
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-center sm:text-right">
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Ümumi Dəyər</p>
                          <p className="font-extrabold text-slate-900 text-sm">
                            {sale.total.toFixed(2)} {setting.currency}
                          </p>
                        </div>

                        <div className="p-2 rounded-xl bg-emerald-50/80 border border-emerald-200 text-center sm:text-right">
                          <p className="text-[10px] text-emerald-700 font-semibold uppercase">Ödənilən</p>
                          <p className="font-extrabold text-emerald-700 text-sm">
                            {sale.paidAmount.toFixed(2)} {setting.currency}
                          </p>
                        </div>

                        <div className={`p-2 rounded-xl border text-center sm:text-right ${
                          sale.debtAmount > 0 
                            ? 'bg-amber-50/80 border-amber-300' 
                            : 'bg-slate-100 border-slate-200'
                        }`}>
                          <p className={`text-[10px] font-semibold uppercase ${
                            sale.debtAmount > 0 ? 'text-amber-800' : 'text-slate-500'
                          }`}>Qalıq Borc</p>
                          <p className={`font-extrabold text-sm ${
                            sale.debtAmount > 0 ? 'text-amber-900' : 'text-slate-600'
                          }`}>
                            {sale.debtAmount.toFixed(2)} {setting.currency}
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {sale.debtAmount > 0 && (
                          <button
                            onClick={() => handleOpenPayModal(sale)}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 hover:shadow-lg transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>Ödəniş Qəbul Et</span>
                          </button>
                        )}

                        <button
                          onClick={() => setReceiptSale(sale)}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition cursor-pointer"
                          title="Satış Çekinə Bax və Çap Et"
                        >
                          <Receipt className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
                          title="Ətraflı Ödəniş Tarixçəsi və Məhsullar"
                        >
                          <span>{isExpanded ? 'Gizlə' : 'Tarixçə'}</span>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar of Payment */}
                  <div className="mt-3.5 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium flex items-center gap-1">
                        <BadgePercent className="w-3.5 h-3.5 text-blue-500" />
                        Borcun ödənmə faizi:
                      </span>
                      <span className="font-bold text-slate-700">
                        {paidPercent}% ({sale.paidAmount.toFixed(2)} / {sale.total.toFixed(2)} {setting.currency})
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/70">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          paidPercent >= 100
                            ? 'bg-emerald-500'
                            : paidPercent > 50
                            ? 'bg-blue-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${paidPercent}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* 📌 Hər dəfə edilən ödənişlərin ayrı-ayrı göstərilməsi (Step-by-step Payment Timeline) */}
                  <div className="mt-4 pt-3.5 border-t border-slate-200/70">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-blue-600" />
                        Ödəniş Mərhələləri (Ayrı-ayrı ödəniş tarixçəsi):
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Hər dəfə ödənilən məbləğ və qalan borc addım-addım
                      </span>
                    </div>

                    {paymentsHistory.length === 0 ? (
                      <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Hələ ki heç bir ilkin və ya aralıq ödəniş edilməyib. Ümumi borc: <strong>{sale.debtAmount.toFixed(2)} {setting.currency}</strong></span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {paymentsHistory.map((p, idx) => {
                          const paymentTime = new Date(p.date).toLocaleString('az-AZ', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          });
                          const isInitial = idx === 0 && p.notes?.includes('İlkin');

                          return (
                            <div
                              key={p.id || idx}
                              className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs space-y-2 hover:border-blue-300 transition"
                            >
                              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold flex items-center justify-center">
                                    {idx + 1}
                                  </span>
                                  <span className="text-xs font-bold text-slate-800">
                                    {isInitial ? 'İlkin Ödəniş' : `${idx + 1}-ci Ödəniş`}
                                  </span>
                                </div>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                  {p.paymentMethod}
                                </span>
                              </div>

                              <div className="text-xs space-y-1">
                                <div className="flex justify-between text-slate-500">
                                  <span>Ödənilən Məbləğ:</span>
                                  <span className="font-bold text-emerald-600 text-sm">
                                    +{p.amount.toFixed(2)} {setting.currency}
                                  </span>
                                </div>

                                <div className="flex justify-between text-slate-500 text-[11px]">
                                  <span>Əvvəlki Borc:</span>
                                  <span className="font-semibold text-slate-700">
                                    {p.previousDebt.toFixed(2)} {setting.currency}
                                  </span>
                                </div>

                                <div className="flex justify-between text-[11px] pt-1 border-t border-slate-100 font-bold">
                                  <span className="text-amber-800">Qalan Borc:</span>
                                  <span className={p.remainingDebt === 0 ? 'text-emerald-600' : 'text-amber-900'}>
                                    {p.remainingDebt.toFixed(2)} {setting.currency}
                                    {p.remainingDebt === 0 && ' (Bağlandı)'}
                                  </span>
                                </div>
                              </div>

                              <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-50">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {paymentTime}
                                </span>
                                {p.notes && (
                                  <span className="text-slate-600 font-medium truncate max-w-[120px]" title={p.notes}>
                                    {p.notes}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Expanded Items Details Drawer */}
                  {isExpanded && (
                    <div className="mt-4 pt-3.5 border-t border-slate-200 bg-slate-50/70 p-4 rounded-xl space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Receipt className="w-4 h-4 text-slate-500" />
                          Götürülən Məhsulların Ətraflı Siyahısı:
                        </p>
                        <span className="text-[11px] text-slate-500">
                          {sale.items.reduce((acc, i) => acc + i.quantity, 0)} ədəd ümumi məhsul
                        </span>
                      </div>

                      <div className="divide-y divide-slate-200 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                        {sale.items.map((item) => (
                          <div key={item.id} className="p-3 flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-slate-900">{item.productName}</p>
                              {item.productBarcode && (
                                <p className="text-[10px] text-slate-400 font-mono">{item.productBarcode}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="text-slate-600">
                                {item.quantity} ədəd × {item.salePrice.toFixed(2)} {setting.currency}
                              </span>
                              <p className="font-bold text-slate-900">
                                = {item.total.toFixed(2)} {setting.currency}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pay Debt Modal */}
      {selectedSaleForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[95vh]">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">Borc Ödənişi Qəbulu</h3>
              </div>
              <button
                onClick={() => setSelectedSaleForPayment(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="p-5 space-y-4 overflow-y-auto">
              {paymentError && (
                <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold">
                  {paymentError}
                </div>
              )}

              {paymentSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  {paymentSuccess}
                </div>
              )}

              {/* Customer & Debt Overview */}
              <div className="bg-amber-50/80 border border-amber-200 p-4 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between font-semibold text-slate-700">
                  <span>Müştəri:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {selectedSaleForPayment.customerName || 'Adsız'}
                  </span>
                </div>
                {selectedSaleForPayment.notes && (
                  <div className="flex justify-between text-slate-600">
                    <span>Qeyd:</span>
                    <span className="font-medium text-amber-900">{selectedSaleForPayment.notes}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Satış Çeki:</span>
                  <span className="font-mono">#{selectedSaleForPayment.id}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Məhsulların Ümumi Dəyəri:</span>
                  <span className="font-semibold">{selectedSaleForPayment.total.toFixed(2)} {setting.currency}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>İndiyə qədər ödənilib:</span>
                  <span className="font-semibold text-emerald-700">
                    {selectedSaleForPayment.paidAmount.toFixed(2)} {setting.currency}
                  </span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-amber-900 pt-2 border-t border-amber-200">
                  <span>Cari Qalıq Borc:</span>
                  <span>{selectedSaleForPayment.debtAmount.toFixed(2)} {setting.currency}</span>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ödəniləcək Məbləğ ({setting.currency})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedSaleForPayment.debtAmount}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-base font-extrabold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(selectedSaleForPayment.debtAmount.toString())}
                    className="absolute right-2 top-2 px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Tam Borc
                  </button>
                </div>

                {/* Quick chip buttons */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-400 font-semibold">Tez seçim:</span>
                  {[1, 2, 5, 10, 20, 50].map((amt) => {
                    if (amt > selectedSaleForPayment.debtAmount) return null;
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setPaymentAmount(amt.toString())}
                        className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 hover:bg-emerald-100 hover:text-emerald-900 border border-slate-200 transition cursor-pointer"
                      >
                        +{amt} ₼
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Calculation Strip */}
              {Number(paymentAmount) > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>Ödənişdən sonrakı qalıq:</span>
                    <span className="font-extrabold text-amber-900">
                      {Math.max(0, selectedSaleForPayment.debtAmount - Number(paymentAmount)).toFixed(2)} {setting.currency}
                    </span>
                  </div>
                  {Number(paymentAmount) >= selectedSaleForPayment.debtAmount && (
                    <p className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Borc tam bağlanacaq!
                    </p>
                  )}
                </div>
              )}

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kassaya Daxilolma Növü
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Nağd')}
                    className={`py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                      paymentMethod === 'Nağd'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    💵 Nağd Kassa
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Kart')}
                    className={`py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                      paymentMethod === 'Kart'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    💳 Bank Kartı
                  </button>
                </div>
              </div>

              {/* Payment Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ödəniş Qeydi (İstəyə bağlı)
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Məs: 5 manat verdi, qalanını sabah verəcək"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedSaleForPayment(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Ləğv et
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 hover:shadow-lg transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Ödənişi Qəbul Et
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Statement Modal */}
      {customerStatementData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-bold text-base">Müştəri Nisyə Vərəqəsi</h3>
                  <p className="text-xs text-slate-400">
                    Müştəri: <span className="text-white font-semibold">{customerStatementData.customerName}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomerForStatement(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 overflow-y-auto font-sans" id="customer-statement-paper">
              {/* Financial summary bar */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-[11px] text-slate-500 font-semibold">Cəmi Alış</p>
                  <p className="text-base font-extrabold text-slate-900 mt-0.5">
                    {customerStatementData.totalPurchased.toFixed(2)} {setting.currency}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <p className="text-[11px] text-emerald-700 font-semibold">Cəmi Ödənilən</p>
                  <p className="text-base font-extrabold text-emerald-700 mt-0.5">
                    {customerStatementData.totalPaid.toFixed(2)} {setting.currency}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-300">
                  <p className="text-[11px] text-amber-800 font-semibold">Qalıq Borc</p>
                  <p className="text-base font-extrabold text-amber-900 mt-0.5">
                    {customerStatementData.totalDebt.toFixed(2)} {setting.currency}
                  </p>
                </div>
              </div>

              {/* Itemized Payment History */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-4 h-4 text-blue-600" />
                  Bütün Ödəniş Mərhələləri (Ayrı-ayrı əməliyyatlar):
                </h4>

                {customerStatementData.allPayments.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Heç bir ödəniş qeydiyyatı yoxdur.</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                    <div className="grid grid-cols-12 bg-slate-50 p-2.5 font-bold text-slate-600 text-[11px]">
                      <span className="col-span-3">Tarix</span>
                      <span className="col-span-2">Çek #</span>
                      <span className="col-span-3">Ödəniş / Növ</span>
                      <span className="col-span-2 text-right">Qalan Borc</span>
                      <span className="col-span-2 text-right">Qeyd</span>
                    </div>

                    {customerStatementData.allPayments.map((item, i) => (
                      <div key={item.payment.id || i} className="grid grid-cols-12 p-2.5 items-center">
                        <span className="col-span-3 text-slate-600">
                          {new Date(item.payment.date).toLocaleString('az-AZ', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="col-span-2 font-mono text-slate-700">#{item.saleId}</span>
                        <span className="col-span-3 font-bold text-emerald-600">
                          +{item.payment.amount.toFixed(2)} {setting.currency}{' '}
                          <span className="text-[10px] text-slate-400 font-normal">({item.payment.paymentMethod})</span>
                        </span>
                        <span className="col-span-2 text-right font-semibold text-amber-900">
                          {item.payment.remainingDebt.toFixed(2)} {setting.currency}
                        </span>
                        <span className="col-span-2 text-right text-slate-500 truncate text-[11px]">
                          {item.payment.notes || '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal actions */}
            <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handlePrintStatement}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Vərəqəni Çap Et
              </button>

              <button
                type="button"
                onClick={() => setSelectedCustomerForStatement(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Bağla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receiptSale && (
        <ReceiptModal
          sale={receiptSale}
          onClose={() => setReceiptSale(null)}
        />
      )}
    </div>
  );
};
