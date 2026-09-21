import React from 'react';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  PackagePlus,
  Coins,
  BarChart3,
  Settings,
  AlertTriangle,
  Store,
  CreditCard,
  Sparkles,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ActiveTab } from '../types';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const { setting, getStockReport, sales } = useStore();
  const stockReport = getStockReport();
  const criticalCount = stockReport.lowStock + stockReport.outOfStock;
  const activeDebtsCount = sales.filter((s) => s.debtAmount > 0).length;

  const navItems = [
    { id: 'Dashboard' as ActiveTab, label: 'Dashboard', icon: LayoutDashboard, badge: null },
    { id: 'Mallar' as ActiveTab, label: 'Mallar (Anbar)', icon: Package, badge: criticalCount > 0 ? `${criticalCount}` : null },
    { id: 'Satış' as ActiveTab, label: 'Satış (POS)', icon: ShoppingCart, badge: 'F2' },
    { id: 'Alış' as ActiveTab, label: 'Alış (Təchizat)', icon: PackagePlus, badge: null },
    {
      id: 'Borclar' as ActiveTab,
      label: 'Borclar (Nisyə)',
      icon: CreditCard,
      badge: activeDebtsCount > 0 ? `${activeDebtsCount}` : null,
    },
    { id: 'Maliyyə' as ActiveTab, label: 'Gəlir / Xərc', icon: Coins, badge: null },
    { id: 'Hesabatlar' as ActiveTab, label: 'Hesabatlar', icon: BarChart3, badge: null },
    { id: 'Ayarlar' as ActiveTab, label: 'Ayarlar', icon: Settings, badge: null },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col justify-between flex-shrink-0 border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div>
        <div className="p-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
              <Store className="w-6 h-6" />
            </div>
            <div className="overflow-hidden">
              <h1 className="font-bold text-lg text-white tracking-wide truncate">
                {setting.storeName || 'CALVOTTI'}
              </h1>
              <p className="text-xs text-blue-400 font-medium tracking-wider uppercase">
                İdarəetmə Sistemi
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      isActive
                        ? 'bg-blue-700 text-white'
                        : item.id === 'Mallar' && criticalCount > 0
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : item.id === 'Borclar'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Sistem statusu</span>
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Aktiv
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>AI Modulları</span>
          <span className="flex items-center gap-1 text-indigo-400 font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            Hazırdır
          </span>
        </div>
        {criticalCount > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>{criticalCount} məhsulda az stok var</span>
          </div>
        )}
      </div>
    </aside>
  );
};
