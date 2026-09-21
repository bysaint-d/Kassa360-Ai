import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Package,
  Calendar,
  AlertTriangle,
  Receipt,
  ShoppingCart,
  Coins,
  PackagePlus,
  ArrowDownRight,
  Flame,
  Award,
  Search,
  Printer,
  Eye,
  CreditCard,
  Banknote,
  UserCheck,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Tag,
  Percent,
  Sparkles,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useStore } from '../context/StoreContext';
import { Sale } from '../types';
import { ReceiptModal } from './ReceiptModal';
import { getColorHex } from '../utils/calculations';
import { AiAnalyticsDashboard } from './AiAnalyticsDashboard';

export const ReportsView: React.FC = () => {
  const {
    sales,
    setting,
    getSummary,
    getPurchasesTotal,
    getCostOfGoods,
    getProductsSold,
    getBestSelling,
    getMostProfitable,
    getStockReport,
  } = useStore();

  const [activeReportTab, setActiveReportTab] = useState<'standard' | 'ai'>('standard');
  const [period, setPeriod] = useState<'today' | 'yesterday' | 'week' | 'month' | 'lastMonth' | 'custom'>('month');

  const today = useMemo(() => new Date(), []);
  const [customFrom, setCustomFrom] = useState<string>(
    new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  );
  const [customTo, setCustomTo] = useState<string>(today.toISOString().split('T')[0]);

  // Receipts Section State
  const [receiptSearch, setReceiptSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'Nağd' | 'Kart' | 'Borc'>('all');
  const [expandedSaleId, setExpandedSaleId] = useState<number | null>(null);
  const [selectedReceiptSale, setSelectedReceiptSale] = useState<Sale | null>(null);

  // Calculate Date Boundaries
  const { fromDate, toDate } = useMemo(() => {
    const d = new Date();
    let f = new Date();
    let t = new Date();

    if (period === 'today') {
      f.setHours(0, 0, 0, 0);
      t.setHours(23, 59, 59, 999);
    } else if (period === 'yesterday') {
      f.setDate(d.getDate() - 1);
      f.setHours(0, 0, 0, 0);
      t.setDate(d.getDate() - 1);
      t.setHours(23, 59, 59, 999);
    } else if (period === 'week') {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      f = new Date(d.setDate(diff));
      f.setHours(0, 0, 0, 0);
      t = new Date();
      t.setHours(23, 59, 59, 999);
    } else if (period === 'month') {
      f = new Date(d.getFullYear(), d.getMonth(), 1);
      f.setHours(0, 0, 0, 0);
      t = new Date();
      t.setHours(23, 59, 59, 999);
    } else if (period === 'lastMonth') {
      f = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      f.setHours(0, 0, 0, 0);
      t = new Date(d.getFullYear(), d.getMonth(), 0);
      t.setHours(23, 59, 59, 999);
    } else {
      f = new Date(customFrom);
      f.setHours(0, 0, 0, 0);
      t = new Date(customTo);
      t.setHours(23, 59, 59, 999);
    }

    return { fromDate: f, toDate: t };
  }, [period, customFrom, customTo]);

  // Query calculated metrics
  const summary = getSummary(fromDate, toDate);
  const purchasesTotal = getPurchasesTotal(fromDate, toDate);
  const costOfGoods = getCostOfGoods(fromDate, toDate);
  const productsSold = getProductsSold(fromDate, toDate);
  const bestSelling = getBestSelling(fromDate, toDate);
  const mostProfitable = getMostProfitable(fromDate, toDate);
  const stockReport = getStockReport();

  // Period sales list for individual receipts breakdown
  const periodSales = useMemo(() => {
    const fTime = fromDate.getTime();
    const tTime = toDate.getTime();
    return sales
      .filter((s) => {
        const sTime = new Date(s.date).getTime();
        return sTime >= fTime && sTime <= tTime;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, fromDate, toDate]);

  // Filtered period sales based on search & payment filter
  const filteredPeriodSales = useMemo(() => {
    return periodSales.filter((s) => {
      const q = receiptSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        s.id.toString().includes(q) ||
        (s.customerName && s.customerName.toLowerCase().includes(q)) ||
        (s.notes && s.notes.toLowerCase().includes(q)) ||
        s.items.some((i) => i.productName.toLowerCase().includes(q));

      const matchesPayment = paymentFilter === 'all' || s.paymentMethod === paymentFilter;

      return matchesSearch && matchesPayment;
    });
  }, [periodSales, receiptSearch, paymentFilter]);

  // Totals by payment method in current period
  const cashSalesTotal = periodSales
    .filter((s) => s.paymentMethod === 'Nağd' && !s.isReturned)
    .reduce((acc, s) => acc + s.total, 0);

  const cardSalesTotal = periodSales
    .filter((s) => s.paymentMethod === 'Kart' && !s.isReturned)
    .reduce((acc, s) => acc + s.total, 0);

  const debtSalesTotal = periodSales
    .filter((s) => s.paymentMethod === 'Borc' && !s.isReturned)
    .reduce((acc, s) => acc + s.total, 0);

  const totalDiscountsInPeriod = useMemo(() => {
    return periodSales
      .filter((s) => !s.isReturned)
      .reduce((acc, s) => {
        const globalDisc = s.discount || 0;
        const itemsDisc = s.items.reduce((iAcc, item) => {
          if (item.originalPrice && item.originalPrice > item.salePrice) {
            return iAcc + (item.originalPrice - item.salePrice) * item.quantity;
          }
          return iAcc;
        }, 0);
        return acc + globalDisc + itemsDisc;
      }, 0);
  }, [periodSales]);

  // Chart data preparation
  const chartData = [
    {
      name: 'Satış & Dövriyyə',
      Məbləğ: summary.sales,
    },
    {
      name: 'Maya Dəyəri',
      Məbləğ: costOfGoods,
    },
    {
      name: 'Ümumi Qazanc',
      Məbləğ: summary.gross,
    },
    {
      name: 'Xərclər',
      Məbləğ: summary.expenses,
    },
    {
      name: 'Xalis Mənfəət',
      Məbləğ: summary.net,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Switcher: Standart Hesabatlar vs AI Ağıllı Analitika */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveReportTab('standard')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeReportTab === 'standard'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Standart Hesabatlar & Çeklər
        </button>

        <button
          type="button"
          onClick={() => setActiveReportTab('ai')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeReportTab === 'ai'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50/60'
          }`}
        >
          <Sparkles className="w-4 h-4 text-yellow-300" />
          ✨ AI Ağıllı Analitika (Satış, Qiymət, Ölçü)
        </button>
      </div>

      {activeReportTab === 'ai' ? (
        <AiAnalyticsDashboard />
      ) : (
        <>
          {/* Header & Period Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            Maliyyə və Satış Hesabatları
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Mənfəət, xərclər, dövriyyə, ayrı-ayrı çəklər və ən çox satılan məhsulların statistikası
          </p>
        </div>

        {/* Period Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          {[
            { id: 'today', label: 'Bugün' },
            { id: 'yesterday', label: 'Dünən' },
            { id: 'week', label: 'Bu həftə' },
            { id: 'month', label: 'Bu ay' },
            { id: 'lastMonth', label: 'Keçən ay' },
            { id: 'custom', label: 'Tarix aralığı' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setPeriod(item.id as any)}
              className={`px-3 py-1.5 rounded-lg transition ${
                period === item.id
                  ? 'bg-white text-blue-600 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Range Picker */}
      {period === 'custom' && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Başlanğıc:</span>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Son:</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Main KPI Grid (8 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Satış Dövriyyəsi</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-extrabold text-slate-900 mt-2">
            {summary.sales.toFixed(2)} {setting.currency}
          </h3>
          <p className="text-xs text-slate-500 mt-1">{summary.count} ədəd kassa çeki</p>
        </div>

        {/* Cost of Goods Sold */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Malların Maya Dəyəri</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <PackagePlus className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mt-2">
            {costOfGoods.toFixed(2)} {setting.currency}
          </h3>
          <p className="text-xs text-slate-500 mt-1">{productsSold} ədəd məhsul satılıb</p>
        </div>

        {/* Gross Profit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Ümumi Mənfəət</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-extrabold text-emerald-600 mt-2">
            +{summary.gross.toFixed(2)} {setting.currency}
          </h3>
          <p className="text-xs text-slate-500 mt-1">Satış minus maya dəyəri</p>
        </div>

        {/* Net Profit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Xalis Mənfəət (Net)</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              summary.net >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
            }`}>
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <h3 className={`text-2xl font-extrabold mt-2 ${summary.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {summary.net >= 0 ? `+${summary.net.toFixed(2)}` : summary.net.toFixed(2)} {setting.currency}
          </h3>
          <p className="text-xs text-slate-500 mt-1">Mənfəət minus xərclər</p>
        </div>

        {/* Purchases In Period */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Dövrdəki Alışlar</span>
          <h3 className="text-xl font-bold text-slate-800 mt-2">
            {purchasesTotal.toFixed(2)} {setting.currency}
          </h3>
          <p className="text-xs text-slate-500 mt-1">Təchizatçılara ödənilən</p>
        </div>

        {/* Expenses */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Xərclər</span>
          <h3 className="text-xl font-bold text-rose-600 mt-2">
            -{summary.expenses.toFixed(2)} {setting.currency}
          </h3>
          <p className="text-xs text-slate-500 mt-1">Kommunal, icarə, maaş və s.</p>
        </div>

        {/* Total Stock in Store */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Cari Anbar Qalığı</span>
          <h3 className="text-xl font-bold text-slate-800 mt-2">
            {stockReport.totalQuantity} <span className="text-sm font-normal text-slate-500">ədəd</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">{stockReport.productCount} fərqli çeşid məhsul</p>
        </div>

        {/* Low Stock count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Kritik / Bitmiş Stok</span>
          <h3 className="text-xl font-bold text-amber-600 mt-2">
            {stockReport.lowStock + stockReport.outOfStock} <span className="text-sm font-normal text-slate-500">məhsul</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">{stockReport.outOfStock} məhsul tam bitib</p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DETAILED INDIVIDUAL SALES RECEIPTS BREAKDOWN (HƏR SATIŞ AYRI ÇEK KİMİ) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-blue-600" />
              <h2 className="font-bold text-slate-900 text-base">
                Dövrdə Edilən Çeklər və Satışlar (Hər Satış Ayrı)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Seçilmiş dövrdəki bütün kassa çəklərinin ayrı-ayrı siyahısı, müştəri adları, satılan mallar və mənfəəti
            </p>
          </div>

          {/* Quick Payment Totals */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold flex items-center gap-1">
              <Banknote className="w-3.5 h-3.5 text-emerald-600" /> Nağd: {cashSalesTotal.toFixed(2)} {setting.currency}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 font-semibold flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-blue-600" /> Kart: {cardSalesTotal.toFixed(2)} {setting.currency}
            </span>
            {debtSalesTotal > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-semibold flex items-center gap-1">
                ⚠️ Borc: {debtSalesTotal.toFixed(2)} {setting.currency}
              </span>
            )}
            {totalDiscountsInPeriod > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 font-semibold flex items-center gap-1">
                <Percent className="w-3.5 h-3.5 text-rose-600" /> Cəmi Endirimlər: -{totalDiscountsInPeriod.toFixed(2)} {setting.currency}
              </span>
            )}
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
          <div className="relative flex-1 w-full sm:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={receiptSearch}
              onChange={(e) => setReceiptSearch(e.target.value)}
              placeholder="Çek no, müştəri adı, qeyd və ya məhsula görə axtar..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
              <Filter className="w-3.5 h-3.5" /> Növ:
            </span>
            {(['all', 'Nağd', 'Kart', 'Borc'] as const).map((method) => (
              <button
                key={method}
                onClick={() => setPaymentFilter(method)}
                className={`px-3 py-1 text-xs rounded-lg font-semibold transition ${
                  paymentFilter === method
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {method === 'all' ? 'Hamısı' : method}
              </button>
            ))}
          </div>
        </div>

        {/* Receipts Table / List */}
        {filteredPeriodSales.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm space-y-2">
            <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-600">Seçilmiş dövr və filter üçün kassa çeki tapılmadı.</p>
            <p className="text-xs text-slate-400">Yuxarıdakı tarix filtrini dəyişərək digər tarixlərə baxa bilərsiniz.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredPeriodSales.map((sale) => {
              const isExpanded = expandedSaleId === sale.id;
              const saleProfit = sale.items.reduce((acc, i) => acc + i.profit, 0);
              const totalItemsCount = sale.items.reduce((acc, i) => acc + i.quantity, 0);

              const formattedDate = new Date(sale.date).toLocaleString('az-AZ', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={sale.id}
                  className={`transition ${sale.isReturned ? 'bg-rose-50/30' : isExpanded ? 'bg-blue-50/20' : 'hover:bg-slate-50/60'}`}
                >
                  {/* Receipt Header Row */}
                  <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-start md:items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-700 flex-shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">ÇEK</span>
                        <span className="text-xs font-extrabold text-slate-900">#{sale.id}</span>
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">
                            Çek #{sale.id}
                          </span>
                          
                          {/* Payment Method Badge */}
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            sale.paymentMethod === 'Nağd'
                              ? 'bg-emerald-100 text-emerald-800'
                              : sale.paymentMethod === 'Kart'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}>
                            {sale.paymentMethod}
                          </span>

                          {sale.isReturned && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                              Qaytarılıb
                            </span>
                          )}

                          {sale.customerName && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                              <UserCheck className="w-3 h-3" />
                              {sale.customerName}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {formattedDate}
                          </span>
                          <span>•</span>
                          <span>{totalItemsCount} ədəd məhsul ({sale.items.length} çeşid)</span>
                          {sale.notes && (
                            <>
                              <span>•</span>
                              <span className="text-slate-700 font-medium bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                Qeyd: {sale.notes}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Financial Summary & Actions */}
                    <div className="flex items-center justify-between md:justify-end gap-4 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                      <div className="text-left md:text-right">
                        <div className="flex items-baseline gap-2">
                          <span className="text-base font-extrabold text-slate-900">
                            {sale.total.toFixed(2)} {setting.currency}
                          </span>
                          {!sale.isReturned && (
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                              +{saleProfit.toFixed(2)} {setting.currency} mənfəət
                            </span>
                          )}
                        </div>
                        {sale.paymentMethod === 'Borc' && sale.paidAmount > 0 && (
                          <p className="text-[11px] font-semibold text-emerald-700">
                            Ödənilən: {sale.paidAmount.toFixed(2)} {setting.currency} {sale.partialPaymentMethod && `(${sale.partialPaymentMethod})`}
                          </p>
                        )}
                        {sale.debtAmount > 0 && (
                          <p className="text-xs font-bold text-amber-600">
                            Qalıq Borc: {sale.debtAmount.toFixed(2)} {setting.currency}
                          </p>
                        )}
                        {sale.discount > 0 && (
                          <p className="text-[11px] text-rose-500">
                            Endirim: -{sale.discount.toFixed(2)} {setting.currency}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedReceiptSale(sale)}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition"
                          title="Çekə bax və çap et"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                          className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition"
                        >
                          <span>{isExpanded ? 'Gizlə' : 'Detallar'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Items Breakdown */}
                  {isExpanded && (
                    <div className="px-6 pb-4 pt-1 bg-slate-50/80 border-t border-slate-200/60">
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs mt-2">
                        <div className="p-3 bg-slate-100/70 border-b border-slate-200 text-xs font-bold text-slate-700 grid grid-cols-12">
                          <span className="col-span-5">Məhsul Adı</span>
                          <span className="col-span-2 text-center">Say</span>
                          <span className="col-span-2 text-right">Satış Qiyməti</span>
                          <span className="col-span-1 text-right text-slate-500">Maya</span>
                          <span className="col-span-2 text-right">Məbləğ / Mənfəət</span>
                        </div>
                        <div className="divide-y divide-slate-100 text-xs">
                          {sale.items.map((item) => {
                            const hasDiscount =
                              (item.originalPrice && item.originalPrice > item.salePrice) ||
                              (item.discountPercent && item.discountPercent > 0);

                            return (
                              <div key={item.id} className="p-3 grid grid-cols-12 items-center">
                                <div className="col-span-5 pr-2">
                                  <p className="font-semibold text-slate-900">{item.productName}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    {item.brand && (
                                      <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1 py-0.2 rounded border border-blue-100 flex items-center gap-0.5">
                                        <Tag className="w-2.5 h-2.5" />
                                        {item.brand}
                                      </span>
                                    )}
                                    {item.color && (
                                      <span className="text-[9px] font-medium text-slate-700 bg-slate-100 px-1 py-0.2 rounded flex items-center gap-1">
                                        <span
                                          className="w-1.5 h-1.5 rounded-full inline-block border border-slate-300"
                                          style={{ backgroundColor: getColorHex(item.color) }}
                                        />
                                        {item.color}
                                      </span>
                                    )}
                                    {item.productBarcode && (
                                      <span className="text-[9px] text-slate-400 font-mono">
                                        #{item.productBarcode}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span className="col-span-2 text-center font-bold text-slate-800">
                                  {item.quantity} ədəd
                                </span>
                                <div className="col-span-2 text-right">
                                  {hasDiscount && item.originalPrice ? (
                                    <span className="line-through text-slate-400 block text-[10px]">
                                      {item.originalPrice.toFixed(2)} {setting.currency}
                                    </span>
                                  ) : null}
                                  <span className="font-medium text-slate-700">
                                    {item.salePrice.toFixed(2)} {setting.currency}
                                  </span>
                                  {item.discountAmount && item.discountAmount > 0 ? (
                                    <span className="ml-1 text-[9px] font-extrabold text-rose-700 bg-rose-50 px-1 py-0.2 rounded border border-rose-200 inline-block">
                                      -{item.discountAmount.toFixed(2)} {setting.currency}
                                    </span>
                                  ) : null}
                                </div>
                                <span className="col-span-1 text-right text-slate-400">
                                  {item.costPrice.toFixed(2)}
                                </span>
                                <div className="col-span-2 text-right">
                                  <span className="font-bold text-slate-900">
                                    {item.total.toFixed(2)} {setting.currency}
                                  </span>
                                  <p className="text-[10px] font-bold text-emerald-600">
                                    +{item.profit.toFixed(2)} {setting.currency}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Visual Bar Chart */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <h2 className="font-bold text-slate-900 text-base mb-4">Maliyyə Dövriyyəsi Qrafiki</h2>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 12 }} />
              <YAxis tick={{ fill: '#64748B', fontSize: 12 }} unit={` ${setting.currency}`} />
              <Tooltip
                formatter={(val: any) => [`${Number(val).toFixed(2)} ${setting.currency}`, 'Məbləğ']}
                contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0' }}
              />
              <Bar dataKey="Məbləğ" fill="#2563EB" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top 10 Best Sellers & Top 10 Most Profitable */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Best Selling */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-500" />
              <h2 className="font-bold text-slate-900 text-sm">Ən Çox Satılan 10 Məhsul</h2>
            </div>
            <span className="text-xs text-slate-400">Say üzrə</span>
          </div>

          <div className="divide-y divide-slate-100">
            {bestSelling.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                Seçilmiş dövr üçün satış qeydi yoxdur.
              </div>
            ) : (
              bestSelling.map((item, idx) => (
                <div key={item.name} className="p-3.5 flex items-center justify-between hover:bg-slate-50/60">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-sm text-slate-900">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-sm text-blue-600">{item.quantity} ədəd</span>
                    <p className="text-xs text-slate-400">
                      {item.amount.toFixed(2)} {setting.currency}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Most Profitable */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-500" />
              <h2 className="font-bold text-slate-900 text-sm">Ən Çox Qazanc Gətirən 10 Məhsul</h2>
            </div>
            <span className="text-xs text-slate-400">Mənfəət üzrə</span>
          </div>

          <div className="divide-y divide-slate-100">
            {mostProfitable.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                Seçilmiş dövr üçün mənfəət qeydi yoxdur.
              </div>
            ) : (
              mostProfitable.map((item, idx) => (
                <div key={item.name} className="p-3.5 flex items-center justify-between hover:bg-slate-50/60">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-sm text-slate-900">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-sm text-emerald-600">
                      +{item.amount.toFixed(2)} {setting.currency}
                    </span>
                    <p className="text-xs text-slate-400">{item.quantity} ədəd satılıb</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      {selectedReceiptSale && (
        <ReceiptModal
          sale={selectedReceiptSale}
          onClose={() => setSelectedReceiptSale(null)}
        />
      )}
        </>
      )}
    </div>
  );
};

