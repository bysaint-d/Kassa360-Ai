import React, { useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  Package,
  AlertTriangle,
  ShoppingCart,
  PackagePlus,
  ArrowUpRight,
  ArrowRight,
  Receipt,
  PlusCircle,
  Coins,
  CreditCard,
  Wallet,
  ArrowDownLeft,
  RotateCcw,
  Banknote,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ActiveTab } from '../types';

interface DashboardViewProps {
  onNavigate: (tab: ActiveTab) => void;
  onOpenNewProduct?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, onOpenNewProduct }) => {
  const { products, sales, setting, getSummary } = useStore();
  const [showKassaBreakdown, setShowKassaBreakdown] = useState(true);

  // Calculate Today's metrics
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);
  const todaySummary = getSummary(today, endOfDay);
  const kassa = todaySummary.kassaReport;

  // Calculate Month's metrics
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthSummary = getSummary(startOfMonth, endOfDay);

  // Critical products (Stock <= MinimumStock)
  const criticalProducts = products
    .filter((p) => p.stockQuantity <= p.minimumStock)
    .sort((a, b) => a.stockQuantity - b.stockQuantity)
    .slice(0, 10);

  // Recent 5 sales
  const recentSales = sales.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Xoş gəlmisiniz, {setting.storeName || 'Calvotti Market'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Geyim mağazası kassa idarəetməsi, real pul hərəkəti və anbar qalığı
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('Satış')}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md shadow-blue-600/20 flex items-center gap-2 transition cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            Yeni Satış (POS)
          </button>
          <button
            onClick={() => onNavigate('Maliyyə')}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl flex items-center gap-2 transition cursor-pointer"
          >
            <Wallet className="w-4 h-4" />
            Kassa Əməliyyatları
          </button>
        </div>
      </div>

      {/* 4 Main Metric Cards (Distinguishing Ümumi Satış vs Xalis Kassa) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* 1. Ümumi Satış Dövriyyəsi */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Bugünkü Ümumi Satış
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
              {todaySummary.sales.toFixed(2)} {setting.currency}
            </h3>
            <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-2 flex-wrap">
              <span className="text-slate-600 font-semibold">{todaySummary.count} çek</span>
              <span className="text-slate-300">•</span>
              <span className="text-emerald-700 font-medium">Nağd: {kassa.cashSales.toFixed(2)} ₼</span>
              <span className="text-slate-300">•</span>
              <span className="text-blue-700 font-medium">Kart: {kassa.cardSales.toFixed(2)} ₼</span>
            </div>
          </div>
        </div>

        {/* 2. Xalis Kassa (Fiziki Nağd Qalıq) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Xalis Nağd Kassa
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                Kassir Qalığı
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Banknote className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className={`text-2xl font-bold tracking-tight ${kassa.netCashDrawer >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {kassa.netCashDrawer.toFixed(2)} {setting.currency}
            </h3>
            <p className="text-xs text-slate-500 mt-1.5">
              Fiziki kassa yeşiyindəki real nağd pul
            </p>
          </div>
        </div>

        {/* 3. Kart / POS Balansı */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Kart / POS Balansı
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-indigo-700 tracking-tight">
              {kassa.netCardBalance.toFixed(2)} {setting.currency}
            </h3>
            <p className="text-xs text-slate-500 mt-1.5">
              Bank hesabına köçürülən POS ödənişləri
            </p>
          </div>
        </div>

        {/* 4. Bugünkü Qazanc (Təmiz Mənfəət) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Bugünkü Maya Mənfəəti
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-purple-700 tracking-tight">
              {todaySummary.gross.toFixed(2)} {setting.currency}
            </h3>
            <p className="text-xs text-slate-500 mt-1.5">
              Xərclər çıxıldıqdan sonra: <span className="font-semibold text-slate-800">{todaySummary.net.toFixed(2)} {setting.currency}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Accurate Real Kassa Breakdown Panel (Explaining Exact Calculation) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-600" />
            <h2 className="font-bold text-slate-900 text-sm">
              Bugünkü Real Kassa və Pul Hərəkəti İcmalı
            </h2>
            <span className="text-[11px] text-slate-400">
              (Dəqiq Xalis Kassa Hesablaması)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowKassaBreakdown(!showKassaBreakdown)}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
          >
            {showKassaBreakdown ? 'Gizlət' : 'Göstər'}
            {showKassaBreakdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showKassaBreakdown && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs pt-1">
            {/* 1. Nağd Satış */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1">
              <span className="text-slate-500 font-medium block">Nağd Satış:</span>
              <p className="font-extrabold text-emerald-700 text-sm">
                +{kassa.cashSales.toFixed(2)} {setting.currency}
              </p>
              <span className="text-[10px] text-slate-400">Kassaya gələn nağd</span>
            </div>

            {/* 2. Kart Satış */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1">
              <span className="text-slate-500 font-medium block">Kart Satış (POS):</span>
              <p className="font-extrabold text-blue-700 text-sm">
                +{kassa.cardSales.toFixed(2)} {setting.currency}
              </p>
              <span className="text-[10px] text-slate-400">Bank hesabına</span>
            </div>

            {/* 3. Kassaya Əlavə (Mədaxil) */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1">
              <span className="text-slate-500 font-medium block">Kassaya Mədaxil:</span>
              <p className="font-extrabold text-indigo-700 text-sm">
                +{kassa.cashIn.toFixed(2)} {setting.currency}
              </p>
              <span className="text-[10px] text-slate-400">Kassaya əlavə pul</span>
            </div>

            {/* 4. Xərclər */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1">
              <span className="text-slate-500 font-medium block">Xərclər:</span>
              <p className="font-extrabold text-rose-700 text-sm">
                -{kassa.expenses.toFixed(2)} {setting.currency}
              </p>
              <span className="text-[10px] text-slate-400">Nağd: {kassa.cashExpenses.toFixed(2)} ₼</span>
            </div>

            {/* 5. Geri Qaytarmalar */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1">
              <span className="text-slate-500 font-medium block">Geri Qaytarmalar:</span>
              <p className="font-extrabold text-amber-700 text-sm">
                -{kassa.refunds.toFixed(2)} {setting.currency}
              </p>
              <span className="text-[10px] text-slate-400">Nağd: {kassa.cashRefunds.toFixed(2)} ₼</span>
            </div>

            {/* 6. Kassadan Çıxarış (Məxaric) */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1">
              <span className="text-slate-500 font-medium block">Kassadan Məxaric:</span>
              <p className="font-extrabold text-rose-800 text-sm">
                -{kassa.cashOut.toFixed(2)} {setting.currency}
              </p>
              <span className="text-[10px] text-slate-400">İnkasasiya / təhvil</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Critical Stock & Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Critical Low Stock Table */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              <h2 className="font-bold text-slate-900 text-base">Kritik Stok Xəbərdarlığı</h2>
            </div>
            <button
              onClick={() => onNavigate('Mallar')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Hamısına bax <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-0 overflow-x-auto flex-1">
            {criticalProducts.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-medium">Bütün məhsulların stoku normadadır.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-semibold text-slate-500">
                    <th className="py-3 px-4">Məhsul</th>
                    <th className="py-3 px-3">Barkod</th>
                    <th className="py-3 px-3 text-center">Mövcud Stok</th>
                    <th className="py-3 px-3 text-center">Min. Hədd</th>
                    <th className="py-3 px-4 text-right">Qiymət</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {criticalProducts.map((p) => {
                    const isZero = p.stockQuantity <= 0;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900">{p.name}</p>
                          <p className="text-xs text-slate-400">{p.category}</p>
                        </td>
                        <td className="py-3 px-3 font-mono text-xs text-slate-500">
                          {p.barcode || '—'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                              isZero
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {p.stockQuantity} ədəd
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center text-xs text-slate-400">
                          {p.minimumStock} ədəd
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-800">
                          {p.salePrice.toFixed(2)} {setting.currency}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent Transactions & Quick Actions */}
        <div className="lg:col-span-5 space-y-6">
          {/* Quick Actions Panel */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <h2 className="font-bold text-slate-900 text-base mb-4">Sürətli Əməliyyatlar</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onNavigate('Satış')}
                className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 hover:bg-blue-50 text-blue-700 text-left transition group"
              >
                <ShoppingCart className="w-5 h-5 mb-2 text-blue-600 group-hover:scale-110 transition-transform" />
                <p className="font-bold text-sm text-slate-900">Satış Terminalı</p>
                <p className="text-xs text-slate-500 mt-0.5">Kassadan mal satışı</p>
              </button>

              <button
                onClick={() => {
                  onNavigate('Mallar');
                  if (onOpenNewProduct) onOpenNewProduct();
                }}
                className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-700 text-left transition group"
              >
                <PlusCircle className="w-5 h-5 mb-2 text-emerald-600 group-hover:scale-110 transition-transform" />
                <p className="font-bold text-sm text-slate-900">Yeni Məhsul</p>
                <p className="text-xs text-slate-500 mt-0.5">Kataloqa mal əlavəsi</p>
              </button>

              <button
                onClick={() => onNavigate('Alış')}
                className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 text-left transition group"
              >
                <PackagePlus className="w-5 h-5 mb-2 text-indigo-600 group-hover:scale-110 transition-transform" />
                <p className="font-bold text-sm text-slate-900">Anbara Alış</p>
                <p className="text-xs text-slate-500 mt-0.5">Təchizatçıdan qəbul</p>
              </button>

              <button
                onClick={() => onNavigate('Maliyyə')}
                className="p-4 rounded-xl border border-amber-100 bg-amber-50/50 hover:bg-amber-50 text-amber-700 text-left transition group"
              >
                <Coins className="w-5 h-5 mb-2 text-amber-600 group-hover:scale-110 transition-transform" />
                <p className="font-bold text-sm text-slate-900">Xərc Qeydi</p>
                <p className="text-xs text-slate-500 mt-0.5">Gündəlik xərclər</p>
              </button>

              <button
                onClick={() => onNavigate('Borclar')}
                className="p-4 rounded-xl border border-rose-100 bg-rose-50/50 hover:bg-rose-50 text-rose-700 text-left transition group"
              >
                <CreditCard className="w-5 h-5 mb-2 text-rose-600 group-hover:scale-110 transition-transform" />
                <p className="font-bold text-sm text-slate-900">Borc Dəftəri</p>
                <p className="text-xs text-slate-500 mt-0.5">Nisyə & borc ödənişi</p>
              </button>
            </div>
          </div>

          {/* Recent Sales List */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-900 text-sm">Son Satışlar</h2>
              <button
                onClick={() => onNavigate('Hesabatlar')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Hesabat
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {recentSales.map((sale) => (
                <div key={sale.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/50 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 font-mono text-xs font-bold">
                      #{sale.id}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {sale.items.length} çeşid məhsul
                        {sale.customerName && <span className="text-xs font-normal text-slate-500"> ({sale.customerName})</span>}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(sale.date).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })} • {sale.paymentMethod}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-slate-900">
                      {sale.total.toFixed(2)} {setting.currency}
                    </p>
                    {sale.isReturned && (
                      <span className="text-[10px] text-rose-500 font-semibold uppercase">Qaytarılıb</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
