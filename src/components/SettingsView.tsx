import React, { useState, useEffect } from 'react';
import {
  Settings,
  Store,
  Download,
  Upload,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Tag,
  Truck,
  ShieldAlert,
  Database,
  Phone,
  X,
  Lock,
  FileText,
  KeyRound,
  Check,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Category, Supplier } from '../types';

export const SettingsView: React.FC = () => {
  const {
    setting,
    categories = [],
    suppliers = [],
    updateSetting,
    addCategory,
    deleteCategory,
    addSupplier,
    deleteSupplier,
    exportDatabaseJson,
    importDatabaseJson,
    resetDatabase,
    clearAllSales,
    wipeAllProducts,
  } = useStore();

  const [storeName, setStoreName] = useState(setting?.storeName || 'Calvotti Market');
  const [currency, setCurrency] = useState(setting?.currency || '₼');
  const [allowNegativeStock, setAllowNegativeStock] = useState(Boolean(setting?.allowNegativeStock));

  useEffect(() => {
    if (setting) {
      setStoreName(setting.storeName || 'Calvotti Market');
      setCurrency(setting.currency || '₼');
      setAllowNegativeStock(Boolean(setting.allowNegativeStock));
    }
  }, [setting]);

  // New category
  const [newCatName, setNewCatName] = useState('');

  // New supplier
  const [newSupName, setNewSupName] = useState('');
  const [newSupPhone, setNewSupPhone] = useState('');
  const [newSupNotes, setNewSupNotes] = useState('');

  // Modal States
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
  const [wipeSecretCode, setWipeSecretCode] = useState('');
  const [wipeError, setWipeError] = useState<string | null>(null);

  const [isClearSalesModalOpen, setIsClearSalesModalOpen] = useState(false);
  const [isResetDbModalOpen, setIsResetDbModalOpen] = useState(false);
  
  const [pendingImportContent, setPendingImportContent] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  // Toast alert
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) {
      showToast('Mağaza adı boş ola bilməz.', 'error');
      return;
    }
    try {
      updateSetting({
        storeName: storeName.trim(),
        currency,
        allowNegativeStock,
      });
      showToast('Mağaza ayarları uğurla yadda saxlanıldı!');
    } catch (err: any) {
      showToast(err.message || 'Ayarları yadda saxlamaq mümkün olmadı.', 'error');
    }
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCatName.trim();
    if (!name) return;
    try {
      addCategory(name);
      setNewCatName('');
      showToast(`"${name}" kateqoriyası əlavə edildi.`);
    } catch (err: any) {
      showToast(err.message || 'Kateqoriya əlavə edilə bilmədi.', 'error');
    }
  };

  const handleConfirmDeleteCategory = () => {
    if (!categoryToDelete) return;
    try {
      deleteCategory(categoryToDelete.id);
      showToast(`"${categoryToDelete.name}" kateqoriyası silindi.`);
      setCategoryToDelete(null);
    } catch (err: any) {
      showToast(err.message || 'Kateqoriyanı silmək mümkün olmadı.', 'error');
    }
  };

  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newSupName.trim();
    if (!name) return;
    try {
      addSupplier(name, newSupPhone.trim() || undefined, newSupNotes.trim() || undefined);
      setNewSupName('');
      setNewSupPhone('');
      setNewSupNotes('');
      showToast(`"${name}" təchizatçısı əlavə edildi.`);
    } catch (err: any) {
      showToast(err.message || 'Təchizatçı əlavə edilə bilmədi.', 'error');
    }
  };

  const handleConfirmDeleteSupplier = () => {
    if (!supplierToDelete) return;
    try {
      deleteSupplier(supplierToDelete.id);
      showToast(`"${supplierToDelete.name}" təchizatçısı silindi.`);
      setSupplierToDelete(null);
    } catch (err: any) {
      showToast(err.message || 'Təchizatçını silmək mümkün olmadı.', 'error');
    }
  };

  const handleExportBackup = () => {
    try {
      const json = exportDatabaseJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `calvotti-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Baza nüsxəsi JSON faylı kimi yükləndi!');
    } catch (err: any) {
      showToast('Nüsxə çıxarılarkən xəta baş verdi.', 'error');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setPendingImportContent(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = () => {
    if (!pendingImportContent) return;
    try {
      const ok = importDatabaseJson(pendingImportContent);
      if (ok) {
        showToast('Baza uğurla bərpa edildi!');
        setPendingImportContent(null);
      } else {
        showToast('Fayl formatı düzgün deyil.', 'error');
      }
    } catch (err: any) {
      showToast('Faylı oxumaq mümkün olmadı.', 'error');
    }
  };

  const handleConfirmReset = () => {
    try {
      resetDatabase();
      setStoreName('Calvotti Market');
      setCurrency('₼');
      setAllowNegativeStock(false);
      setIsResetDbModalOpen(false);
      showToast('Baza ilkin nümunəvi vəziyyətinə qaytarıldı!');
    } catch (err: any) {
      showToast('Sıfırlama zamanı xəta baş verdi.', 'error');
    }
  };

  const handleConfirmClearSales = () => {
    try {
      clearAllSales(false);
      setIsClearSalesModalOpen(false);
      showToast('Satış tarixçəsi uğurla təmizləndi.');
    } catch (err: any) {
      showToast('Tarixçəni təmizləmək mümkün olmadı.', 'error');
    }
  };

  const handleConfirmMasterWipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (wipeSecretCode.trim() !== 'kamal2014') {
      setWipeError('Daxil edilmiş gizli kod yanlışdır!');
      return;
    }

    try {
      wipeAllProducts();
      setIsWipeModalOpen(false);
      setWipeSecretCode('');
      setWipeError(null);
      showToast('Bütün məhsullar və baza tamamilə sıfırlandı!');
    } catch (err: any) {
      setWipeError(err.message || 'Sıfırlama uğursuz oldu.');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between shadow-lg transition-all ${
            toast.type === 'error'
              ? 'bg-rose-50 border border-rose-200 text-rose-800'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-600" />
            ) : (
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            )}
            <span>{toast.text}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-600" />
            Sistem Ayarları və Parametrlər
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Mağaza adı, valyuta, kateqoriyalar, təchizatçılar və nüsxələmə (Backup)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: General Settings (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* General Store Settings */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
            <h2 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
              <Store className="w-5 h-5 text-blue-600" />
              Ümumi Mağaza Parametrləri
            </h2>

            <form onSubmit={handleSaveGeneral} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mağaza / Obyekt Adı <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Valyuta Simvolu</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 font-bold"
                >
                  <option value="₼">₼ (AZN - Azərbaycan Manatı)</option>
                  <option value="$">$ (USD - ABŞ Dolları)</option>
                  <option value="€">€ (EUR - Avro)</option>
                  <option value="₺">₺ (TRY - Türk Lirəsi)</option>
                  <option value="₽">₽ (RUB - Rusiya Rublu)</option>
                </select>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-200 hover:bg-slate-100/70 transition">
                  <input
                    type="checkbox"
                    checked={allowNegativeStock}
                    onChange={(e) => setAllowNegativeStock(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded-md"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800">Mənfi stoka icazə verilsin</span>
                    <p className="text-[11px] text-slate-400">
                      Stokda mal 0 olsa belə kassa satışına icazə verilir
                    </p>
                  </div>
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-600/20 text-sm transition flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Dəyişiklikləri Yadda Saxla
              </button>
            </form>
          </div>

          {/* Database Backup & Restore */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-600" />
              Verilənlər Bazası və Nüsxələmə (Backup)
            </h2>
            <p className="text-xs text-slate-500">
              Bütün məhsullar, satışlar, alışlar və maliyyə tarixçəsini JSON formatında ixrac edə və ya bərpa edə bilərsiniz.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleExportBackup}
                className="p-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition"
              >
                <Download className="w-5 h-5 text-indigo-600" />
                Nüsxə Çıxar (Backup)
              </button>

              <label className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1.5 cursor-pointer transition">
                <Upload className="w-5 h-5 text-slate-600" />
                Nüsxədən Bərpa Et
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </label>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsResetDbModalOpen(true)}
                className="w-full py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 flex items-center justify-center gap-1.5 transition"
              >
                <RotateCcw className="w-4 h-4" />
                İlkin Nümunə Məlumatlarını Bərpa Et (Reset)
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Categories & Suppliers Management (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Categories Management */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Tag className="w-5 h-5 text-emerald-600" />
              Kateqoriyaların İdarə Edilməsi ({categories.length})
            </h2>

            <form onSubmit={handleAddCategory} className="flex gap-2">
              <input
                type="text"
                required
                placeholder="Yeni kateqoriya adı..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 transition"
              >
                <Plus className="w-4 h-4" />
                Əlavə et
              </button>
            </form>

            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="px-3 py-1.5 bg-slate-100 text-slate-800 rounded-xl text-xs font-medium flex items-center gap-2 border border-slate-200/70"
                >
                  <span>{cat.name}</span>
                  <button
                    onClick={() => setCategoryToDelete(cat)}
                    className="text-slate-400 hover:text-rose-600 font-bold ml-1"
                    title="Kateqoriyanı Sil"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Suppliers Management */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-600" />
              Təchizatçı Şirkətlər ({suppliers.length})
            </h2>

            <form onSubmit={handleAddSupplier} className="space-y-2">
              <input
                type="text"
                required
                placeholder="Şirkət / Distribütor adı..."
                value={newSupName}
                onChange={(e) => setNewSupName(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Telefon (məs: +994 12 ...)"
                  value={newSupPhone}
                  onChange={(e) => setNewSupPhone(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Qeyd / Ərazi"
                  value={newSupNotes}
                  onChange={(e) => setNewSupNotes(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 transition"
              >
                <Plus className="w-4 h-4" />
                Təchizatçını Əlavə Et
              </button>
            </form>

            <div className="space-y-2 max-h-52 overflow-y-auto">
              {suppliers.map((sup) => (
                <div
                  key={sup.id}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-800">{sup.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {sup.phone || 'Telefon qeyd edilməyib'} {sup.notes && `• ${sup.notes}`}
                    </p>
                  </div>
                  <button
                    onClick={() => setSupplierToDelete(sup)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                    title="Təchizatçını Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone: Master Products Reset & Sales Clean with Security Code */}
      <div className="p-6 bg-rose-50/70 rounded-2xl border-2 border-rose-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-rose-800 font-bold text-base">
          <ShieldAlert className="w-5 h-5 text-rose-600" />
          <span>Təhlükəli Əməliyyatlar və Baza Sıfırlama (Danger Zone)</span>
        </div>
        <p className="text-xs text-rose-700 leading-relaxed">
          Bütün məhsulları və bazanı tam sıfırlamaq üçün təhlükəsizlik dialoqundan <strong>kamal2014</strong> gizli kodu daxil edilməlidir. Yanlış kod daxil edildikdə heç bir məlumat silinməyəcək.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={() => {
              setWipeSecretCode('');
              setWipeError(null);
              setIsWipeModalOpen(true);
            }}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-rose-600/20 transition"
          >
            <Trash2 className="w-4 h-4" />
            🔥 Bütün Məhsulları və Bazanı Sıfırla (Kod: kamal2014)
          </button>

          <button
            onClick={() => setIsClearSalesModalOpen(true)}
            className="px-4 py-2.5 bg-white hover:bg-rose-100/50 text-rose-800 font-semibold border border-rose-300 rounded-xl text-xs flex items-center gap-2 transition"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            Yalnız Satış Tarixçəsini Təmizlə
          </button>
        </div>
      </div>

      {/* Modal 1: Master Wipe Modal with Code Input */}
      {isWipeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-rose-200 animate-in fade-in duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Bütün Bazanı Sıfırlamaq İstəyirsiniz?</h3>
              <p className="text-xs text-rose-600 font-semibold">
                ⚠️ Bu əməliyyat geri qaytarıla bilməz! Bütün məhsullar, anbar qalıqları və kateqoriyalar silinəcək.
              </p>
            </div>

            <form onSubmit={handleConfirmMasterWipe} className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                  Gizli Təsdiq Kodu:
                </label>
                <input
                  type="password"
                  required
                  placeholder="Gizli kodu yazın..."
                  value={wipeSecretCode}
                  onChange={(e) => {
                    setWipeSecretCode(e.target.value);
                    setWipeError(null);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono tracking-wider focus:ring-2 focus:ring-rose-500"
                />
                {wipeError && (
                  <p className="text-xs font-bold text-rose-600 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {wipeError}
                  </p>
                )}
                <p className="text-[11px] text-slate-400 mt-1">İpucu: kamal2014</p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsWipeModalOpen(false)}
                  className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
                >
                  Ləğv Et
                </button>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition"
                >
                  Təsdiq Et və Sıfırla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Clear Sales History Confirmation */}
      {isClearSalesModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in duration-150">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Satış Tarixçəsi Təmizlənsin?</h3>
              <p className="text-xs text-slate-500">
                Bütün keçmiş satış qeydləri silinəcək, lakin məhsulların anbardakı qalıqları dəyişməyəcək.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsClearSalesModalOpen(false)}
                className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
              >
                İmtina Et
              </button>
              <button
                type="button"
                onClick={handleConfirmClearSales}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/20 transition"
              >
                Bəli, Təmizlə
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Reset Default Database */}
      {isResetDbModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <RotateCcw className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900">İlkin Nümunəvi Bazaya Qayıdılsın?</h3>
              <p className="text-xs text-slate-500">
                Cari məlumatlar silinib ilkin hazır nümunə məhsulları və kateqoriyaları ilə əvəzlənəcək.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsResetDbModalOpen(false)}
                className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
              >
                İmtina Et
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition"
              >
                Bəli, Bərpa Et
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Import Backup JSON */}
      {pendingImportContent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in duration-150">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
              <Upload className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900">JSON Faylından Bərpa Edilsin?</h3>
              <p className="text-xs text-slate-500">
                Seçdiyiniz JSON nüsxə faylındakı məlumatlar cari bazaya yazılacaq.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <button
                type="button"
                onClick={() => setPendingImportContent(null)}
                className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
              >
                İmtina Et
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition"
              >
                Bəli, Bərpa Et
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Delete Category Confirmation */}
      {categoryToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Tag className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Kateqoriyanı Silmək İstəyirsiniz?</h3>
              <p className="text-xs text-slate-500 font-medium">
                "{categoryToDelete.name}" kateqoriyası silinəcək.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
              >
                Ləğv Et
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCategory}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 6: Delete Supplier Confirmation */}
      {supplierToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Truck className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Təchizatçını Silmək İstəyirsiniz?</h3>
              <p className="text-xs text-slate-500 font-medium">
                "{supplierToDelete.name}" təchizatçı şirkəti silinəcək.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <button
                type="button"
                onClick={() => setSupplierToDelete(null)}
                className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
              >
                Ləğv Et
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSupplier}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
