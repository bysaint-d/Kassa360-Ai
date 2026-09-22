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
import { UserSwitchModal } from './components/UserSwitchModal';
import { MobileSellerApp } from './components/mobile/MobileSellerApp';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  ShoppingCart,
  Wifi,
  WifiOff,
  RefreshCw,
  Smartphone,
  UserCheck,
  ChevronDown,
} from 'lucide-react';

const MainLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('Dashboard');
  const {
    setting,
    products,
    currentUser,
    isOnline,
    pendingSyncCount,
    isSyncing,
    syncNow,
    deviceMode,
    setDeviceMode,
  } = useStore();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

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

  // If user is on Mobile mode, render dedicated MobileSellerApp
  if (deviceMode === 'mobile') {
    return <MobileSellerApp />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900 antialiased selection:bg-blue-500 selection:text-white font-sans">
      {/* Sidebar Navigation */}
      <Sidebar activeTab={activeTab} onTabChange={handleNavigateToTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-6 py-2.5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.6)]"></span>
              {setting.storeName || 'Calvotti Market'}
            </h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/70">
              {products.length} aktiv məhsul
            </span>
            <span className="text-xs font-semibold text-slate-400 hidden xl:inline">
              Valyuta: <span className="text-slate-700 font-bold">{setting.currency || '₼'}</span>
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Real-time sync indicator */}
            <button
              onClick={() => syncNow()}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition cursor-pointer ${
                isOnline
                  ? pendingSyncCount > 0
                    ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-rose-50 text-rose-800 border-rose-300'
              }`}
              title={isOnline ? 'Mərkəzi verilənlər bazası ilə əlaqə aktivdir' : 'Oflayn rejimdə işləyir'}
            >
              {isOnline ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>{pendingSyncCount > 0 ? `${pendingSyncCount} gözləyir` : 'Onlayn (Mərkəz)'}</span>
                  {pendingSyncCount > 0 && (
                    <RefreshCw className={`w-3 h-3 text-amber-700 ${isSyncing ? 'animate-spin' : ''}`} />
                  )}
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-rose-600" />
                  <span>Oflayn {pendingSyncCount > 0 && `(${pendingSyncCount})`}</span>
                </>
              )}
            </button>

            {/* Mobile Mode Switcher */}
            <button
              onClick={() => setDeviceMode('mobile')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200/80 flex items-center gap-1.5 transition cursor-pointer"
              title="Mobil Satıcı Rejiminə Keç"
            >
              <Smartphone className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden md:inline">Mobil Rejim</span>
            </button>

            {/* User switch button */}
            <button
              onClick={() => setIsUserModalOpen(true)}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-200/80 flex items-center gap-2 transition cursor-pointer"
            >
              <div className="w-5 h-5 rounded-md bg-blue-600 text-white text-[10px] flex items-center justify-center font-black">
                {currentUser?.fullName.substring(0, 1) || 'A'}
              </div>
              <span className="max-w-[120px] truncate">{currentUser?.fullName}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-700 font-semibold">
                {currentUser?.role}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {activeTab !== 'Satış' && (
              <button
                onClick={() => setActiveTab('Satış')}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Kassaya Keç (F2)
              </button>
            )}

            <div className="text-right hidden xl:block">
              <p className="text-xs font-mono font-bold text-slate-700 bg-slate-100/80 px-2.5 py-1 rounded-lg border border-slate-200/70">
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

      {/* User Switch Modal */}
      <UserSwitchModal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} />
    </div>
  );
};

export function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <MainLayout />
      </StoreProvider>
    </ErrorBoundary>
  );
}

export default App;
