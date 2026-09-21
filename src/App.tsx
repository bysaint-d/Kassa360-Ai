import React, { useState, useEffect } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { ActiveTab } from './types';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { ProductsView } from './components/ProductsView';
import { PosSalesView } from './components/PosSalesView';
import { PurchasesView } from './components/PurchasesView';
import { FinanceView } from './components/FinanceView';
import { ReportsView } from './components/ReportsView';
import { BorclarView } from './components/BorclarView';
import { SettingsView } from './components/SettingsView';
import { ShoppingCart } from 'lucide-react';

const MainLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('Dashboard');
  const { setting, products } = useStore();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatHeaderDateTime = (d: Date) => {
    const year = d.getFullYear();
    const month = `M${String(d.getMonth() + 1).padStart(2, '0')}`;
    const day = d.getDate();
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekdayShort = weekdays[d.getDay()];
    const timeStr = d.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `${year} ${month} ${day}, ${weekdayShort} • ${timeStr}`;
  };

  const handleNavigateToTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Global F2 keyboard shortcut to jump directly to POS Cashier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setActiveTab('Satış');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900 antialiased selection:bg-blue-500 selection:text-white font-sans">
      {/* Sidebar Navigation */}
      <Sidebar activeTab={activeTab} onTabChange={handleNavigateToTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-6 py-3 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              {setting.storeName || 'Calvotti Market'}
            </h1>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/70">
              {products.length} aktiv məhsul
            </span>
            <span className="text-xs font-semibold text-slate-400 hidden lg:inline">
              Valyuta: <span className="text-slate-700 font-bold">{setting.currency || '₼'}</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            {activeTab !== 'Satış' && (
              <button
                onClick={() => setActiveTab('Satış')}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Kassaya Keç (F2)
              </button>
            )}

            <div className="text-right hidden sm:block">
              <p className="text-xs font-mono font-bold text-slate-700 bg-slate-100/80 px-3 py-1 rounded-lg border border-slate-200/70">
                {formatHeaderDateTime(currentTime)}
              </p>
            </div>
          </div>
        </header>

        {/* View Router */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'Dashboard' && (
            <DashboardView
              onNavigate={handleNavigateToTab}
              onOpenNewProduct={() => setActiveTab('Mallar')}
            />
          )}
          {activeTab === 'Mallar' && <ProductsView />}
          {activeTab === 'Satış' && (
            <PosSalesView
              onOpenNewProduct={() => {
                setActiveTab('Mallar');
              }}
            />
          )}
          {activeTab === 'Alış' && <PurchasesView />}
          {activeTab === 'Borclar' && <BorclarView />}
          {activeTab === 'Maliyyə' && <FinanceView />}
          {activeTab === 'Hesabatlar' && <ReportsView />}
          {activeTab === 'Ayarlar' && <SettingsView />}
        </main>
      </div>
    </div>
  );
};

export function App() {
  return (
    <StoreProvider>
      <MainLayout />
    </StoreProvider>
  );
}

export default App;
