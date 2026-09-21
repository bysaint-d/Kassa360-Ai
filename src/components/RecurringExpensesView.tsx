import React, { useState, useMemo } from 'react';
import {
  Repeat,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Banknote,
  CreditCard,
  Calendar,
  Search,
  Sparkles,
  ArrowRight,
  Check,
  X,
  Zap,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { RecurringExpense, RecurringPeriod } from '../types';

interface RecurringExpensesViewProps {
  onAppliedExpense?: () => void;
}

export const RecurringExpensesView: React.FC<RecurringExpensesViewProps> = ({ onAppliedExpense }) => {
  const {
    recurringExpenses,
    setting,
    addRecurringExpense,
    updateRecurringExpense,
    deleteRecurringExpense,
    toggleRecurringExpense,
    applyRecurringExpense,
    applyAllRecurringExpenses,
  } = useStore();

  // Filter states
  const [filterPeriod, setFilterPeriod] = useState<'all' | RecurringPeriod>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Yemək / Çay');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [amount, setAmount] = useState<number | ''>('');
  const [period, setPeriod] = useState<RecurringPeriod>('Günlük');
  const [paymentMethod, setPaymentMethod] = useState<'Nağd' | 'Kart'>('Nağd');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Apply Single Modal state
  const [applyModalItem, setApplyModalItem] = useState<RecurringExpense | null>(null);
  const [applyDate, setApplyDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Delete Modal state
  const [itemToDelete, setItemToDelete] = useState<RecurringExpense | null>(null);

  // Toast feedback
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const currentMonthStr = useMemo(() => todayStr.slice(0, 7), [todayStr]);

  const categories = [
    'Yemək / Çay',
    'İcarə',
    'Kommunal',
    'Maaş',
    'Nəqliyyat',
    'Təmizlik & Gigiyena',
    'Qablaşdırma & Torba',
    'Təmir & Avadanlıq',
    'Digər',
  ];

  // Quick suggestions for fast addition
  const quickTemplates = [
    { title: 'İşçilərin nahar yeməyi', category: 'Yemək / Çay', amount: 5, period: 'Günlük' as RecurringPeriod, method: 'Nağd' as const },
    { title: 'Mağaza icarə haqqı', category: 'İcarə', amount: 1500, period: 'Aylıq' as RecurringPeriod, method: 'Nağd' as const },
    { title: 'Gündəlik çay və çörək', category: 'Yemək / Çay', amount: 3, period: 'Günlük' as RecurringPeriod, method: 'Nağd' as const },
    { title: 'Elektrik və kommunal', category: 'Kommunal', amount: 120, period: 'Aylıq' as RecurringPeriod, method: 'Kart' as const },
    { title: 'Optik internet', category: 'Kommunal', amount: 35, period: 'Aylıq' as RecurringPeriod, method: 'Kart' as const },
    { title: 'Kassir maaşı avansı', category: 'Maaş', amount: 300, period: 'Aylıq' as RecurringPeriod, method: 'Nağd' as const },
  ];

  // Open modal for new item
  const handleOpenAddModal = () => {
    setEditingId(null);
    setTitle('');
    setCategory('Yemək / Çay');
    setIsCustomCategory(false);
    setCustomCategory('');
    setAmount('');
    setPeriod('Günlük');
    setPaymentMethod('Nağd');
    setNotes('');
    setIsActive(true);
    setIsModalOpen(true);
  };

  // Open modal for editing
  const handleOpenEditModal = (item: RecurringExpense) => {
    setEditingId(item.id);
    setTitle(item.title);
    if (categories.includes(item.category)) {
      setCategory(item.category);
      setIsCustomCategory(false);
      setCustomCategory('');
    } else {
      setIsCustomCategory(true);
      setCustomCategory(item.category);
    }
    setAmount(item.amount);
    setPeriod(item.period);
    setPaymentMethod(item.paymentMethod);
    setNotes(item.notes || '');
    setIsActive(item.isActive);
    setIsModalOpen(true);
  };

  // Handle template click in form
  const handleSelectTemplate = (tpl: typeof quickTemplates[0]) => {
    setTitle(tpl.title);
    setCategory(tpl.category);
    setIsCustomCategory(false);
    setAmount(tpl.amount);
    setPeriod(tpl.period);
    setPaymentMethod(tpl.method);
  };

  // Handle save (create or update)
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const finalCategory = isCustomCategory ? customCategory.trim() : category;
      if (!title.trim()) {
        showToast('Xərc adını daxil edin.', 'error');
        return;
      }
      if (!finalCategory) {
        showToast('Kateqoriya seçin.', 'error');
        return;
      }
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        showToast('Düzgün məbləğ daxil edin.', 'error');
        return;
      }

      if (editingId) {
        updateRecurringExpense(editingId, {
          title: title.trim(),
          category: finalCategory,
          amount: numAmount,
          period,
          paymentMethod,
          notes: notes.trim() || undefined,
          isActive,
        });
        showToast(`"${title}" stabil xərci yeniləndi!`);
      } else {
        addRecurringExpense({
          title: title.trim(),
          category: finalCategory,
          amount: numAmount,
          period,
          paymentMethod,
          notes: notes.trim() || undefined,
          isActive,
        });
        showToast(`"${title}" (${numAmount.toFixed(2)} ${setting.currency}) stabil xərclərə əlavə edildi!`);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Xəta baş verdi.', 'error');
    }
  };

  // Check if an expense was applied today (or this month)
  const getApplicationStatus = (item: RecurringExpense) => {
    if (!item.lastAppliedDate) {
      return { isApplied: false, label: 'Heç vaxt tətbiq olunmayıb' };
    }
    if (item.period === 'Günlük') {
      const isToday = item.lastAppliedDate === todayStr;
      return {
        isApplied: isToday,
        label: isToday ? 'Bugün xərcə yazılıb' : `Son tətbiq: ${item.lastAppliedDate}`,
      };
    }
    if (item.period === 'Aylıq') {
      const isThisMonth = item.lastAppliedDate.slice(0, 7) === currentMonthStr;
      return {
        isApplied: isThisMonth,
        label: isThisMonth ? 'Bu ay üçün ödənilib' : `Son tətbiq: ${item.lastAppliedDate}`,
      };
    }
    return {
      isApplied: false,
      label: `Son tətbiq: ${item.lastAppliedDate}`,
    };
  };

  // Handle single apply
  const handleConfirmApply = () => {
    if (!applyModalItem) return;
    try {
      applyRecurringExpense(applyModalItem.id, applyDate);
      showToast(
        `"${applyModalItem.title}" (-${applyModalItem.amount.toFixed(2)} ${setting.currency}) kassadan çıxarıldı və xərclərə yazıldı!`
      );
      setApplyModalItem(null);
      if (onAppliedExpense) onAppliedExpense();
    } catch (err: any) {
      showToast(err.message || 'Xəta baş verdi.', 'error');
    }
  };

  // Handle Batch Apply Daily
  const handleBatchApplyDaily = () => {
    try {
      const count = applyAllRecurringExpenses('Günlük', todayStr);
      if (count === 0) {
        showToast('Bugün üçün tətbiq edilməmiş aktiv günlük xərc yoxdur.', 'error');
      } else {
        showToast(`${count} ədəd günlük stabil xərc kassadan çıxarıldı və bugünkü xərclərə yazıldı!`);
        if (onAppliedExpense) onAppliedExpense();
      }
    } catch (err: any) {
      showToast(err.message || 'Xəta baş verdi.', 'error');
    }
  };

  // Handle Batch Apply Monthly
  const handleBatchApplyMonthly = () => {
    try {
      const count = applyAllRecurringExpenses('Aylıq', todayStr);
      if (count === 0) {
        showToast('Bu ay üçün tətbiq edilməmiş aktiv aylıq xərc yoxdur.', 'error');
      } else {
        showToast(`${count} ədəd aylıq stabil xərc kassadan çıxarıldı və xərclərə yazıldı!`);
        if (onAppliedExpense) onAppliedExpense();
      }
    } catch (err: any) {
      showToast(err.message || 'Xəta baş verdi.', 'error');
    }
  };

  // Filtered recurring expenses
  const filteredList = useMemo(() => {
    return recurringExpenses.filter((item) => {
      if (filterPeriod !== 'all' && item.period !== filterPeriod) return false;
      if (filterStatus === 'active' && !item.isActive) return false;
      if (filterStatus === 'inactive' && item.isActive) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchCat = item.category.toLowerCase().includes(q);
        const matchNote = item.notes?.toLowerCase().includes(q);
        if (!matchTitle && !matchCat && !matchNote) return false;
      }
      return true;
    });
  }, [recurringExpenses, filterPeriod, filterStatus, searchQuery]);

  // Aggregate Calculations
  const dailyTotal = useMemo(() => {
    return recurringExpenses
      .filter((r) => r.isActive && r.period === 'Günlük')
      .reduce((acc, r) => acc + r.amount, 0);
  }, [recurringExpenses]);

  const monthlyTotal = useMemo(() => {
    return recurringExpenses
      .filter((r) => r.isActive && r.period === 'Aylıq')
      .reduce((acc, r) => acc + r.amount, 0);
  }, [recurringExpenses]);

  const dailyPendingCount = useMemo(() => {
    return recurringExpenses.filter(
      (r) => r.isActive && r.period === 'Günlük' && r.lastAppliedDate !== todayStr
    ).length;
  }, [recurringExpenses, todayStr]);

  const monthlyPendingCount = useMemo(() => {
    return recurringExpenses.filter(
      (r) => r.isActive && r.period === 'Aylıq' && r.lastAppliedDate?.slice(0, 7) !== currentMonthStr
    ).length;
  }, [recurringExpenses, currentMonthStr]);

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
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
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            )}
            <span>{toast.text}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner with Summary & Quick Batch Actions */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                Stabil və Dövri Xərclər
              </h2>
              <p className="text-xs text-slate-500">
                Gündəlik yemək (5 ₼), çay və ya aylıq icarə (1500 ₼), kommunal kimi sabit xərcləri idarə edin və tətbiq edin.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4 flex-wrap text-xs">
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-xl border border-emerald-200/80">
              <span className="font-bold">Günlük Stabil Cəmi:</span>
              <span className="font-black text-emerald-700 text-sm">
                {dailyTotal.toFixed(2)} {setting.currency} / gün
              </span>
              <span className="text-emerald-600 font-medium">
                (aylıq təqr. ~{(dailyTotal * 30).toFixed(0)} {setting.currency})
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-800 px-3 py-1.5 rounded-xl border border-indigo-200/80">
              <span className="font-bold">Aylıq Stabil Cəmi:</span>
              <span className="font-black text-indigo-700 text-sm">
                {monthlyTotal.toFixed(2)} {setting.currency} / ay
              </span>
            </div>
          </div>
        </div>

        {/* Quick Batch Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-shrink-0">
          <button
            type="button"
            onClick={handleBatchApplyDaily}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            title="Bugün üçün hələ vurulmamış bütün aktiv günlük xərcləri (yemək, çay və s.) bir kliklə xərcə yaz"
          >
            <Zap className="w-4 h-4" />
            Bugünkü Günlük Xərcləri Yaz {dailyPendingCount > 0 && `(${dailyPendingCount})`}
          </button>

          <button
            type="button"
            onClick={handleBatchApplyMonthly}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            title="Bu ay üçün ödənilməmiş bütün aktiv aylıq xərcləri (icarə, internet və s.) bir kliklə xərcə yaz"
          >
            <Calendar className="w-4 h-4" />
            Bu Ayın Xərclərini Yaz {monthlyPendingCount > 0 && `(${monthlyPendingCount})`}
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Yeni Stabil Xərc
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Period tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'Hamısı' },
            { id: 'Günlük', label: 'Gündəlik (məs. Yemək 5₼)' },
            { id: 'Aylıq', label: 'Aylıq (məs. İcarə 1500₼)' },
            { id: 'Həftəlik', label: 'Həftəlik' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterPeriod(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                filterPeriod === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Status Filter */}
        <div className="flex items-center gap-2">
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Stabil xərc axtar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
          >
            <option value="all">Bütün Statuslar</option>
            <option value="active">Yalnız Aktivlər</option>
            <option value="inactive">Dayandırılanlar</option>
          </select>
        </div>
      </div>

      {/* Cards Grid */}
      {filteredList.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200/80 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto">
            <Repeat className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Heç bir stabil xərc tapılmadı</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Gündəlik yemək pulu (5 ₼) və ya aylıq icarə haqqı (1500 ₼) kimi təkrarlanan xərcləri qeydiyyata alın.
          </p>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            İlk Stabil Xərci Əlavə Et
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredList.map((item) => {
            const status = getApplicationStatus(item);
            const isDaily = item.period === 'Günlük';
            const isMonthly = item.period === 'Aylıq';

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border p-5 shadow-xs transition-all flex flex-col justify-between relative overflow-hidden ${
                  !item.isActive
                    ? 'border-slate-200 opacity-60 bg-slate-50/50'
                    : isDaily
                    ? 'border-emerald-200/80 hover:border-emerald-300'
                    : isMonthly
                    ? 'border-indigo-200/80 hover:border-indigo-300'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Top badges */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-md tracking-wider ${
                        isDaily
                          ? 'bg-emerald-100 text-emerald-800'
                          : isMonthly
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {item.period}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                        {item.paymentMethod === 'Kart' ? (
                          <CreditCard className="w-3 h-3 text-blue-500" />
                        ) : (
                          <Banknote className="w-3 h-3 text-emerald-500" />
                        )}
                        {item.paymentMethod}
                      </span>

                      <button
                        type="button"
                        onClick={() => toggleRecurringExpense(item.id)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border cursor-pointer transition ${
                          item.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                        }`}
                        title={item.isActive ? 'Xərci deaktiv et' : 'Xərci aktiv et'}
                      >
                        {item.isActive ? 'Aktiv' : 'Deaktiv'}
                      </button>
                    </div>
                  </div>

                  {/* Title & Category */}
                  <h3 className="font-extrabold text-slate-900 text-base leading-snug">
                    {item.title}
                  </h3>

                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      {item.category}
                    </span>
                    {item.notes && (
                      <span className="text-xs text-slate-400 truncate max-w-[180px]" title={item.notes}>
                        {item.notes}
                      </span>
                    )}
                  </div>

                  {/* Amount Display */}
                  <div className="mt-4 mb-3 p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-baseline justify-between">
                    <div>
                      <span className="text-2xl font-black text-slate-900">
                        {item.amount.toFixed(2)}
                      </span>
                      <span className="text-sm font-bold text-slate-600 ml-1">
                        {setting.currency}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-slate-400">
                      / hər {item.period.toLowerCase()}
                    </span>
                  </div>

                  {/* Execution Status Badge */}
                  <div className="mb-4">
                    {status.isApplied ? (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span className="truncate">{status.label}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-lg">
                        <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        <span className="truncate">
                          {isDaily
                            ? 'Bugün üçün hələ çıxarılmayıb'
                            : isMonthly
                            ? 'Bu ay üçün hələ çıxarılmayıb'
                            : status.label}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setApplyModalItem(item);
                      setApplyDate(todayStr);
                    }}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer ${
                      status.isApplied
                        ? 'bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200'
                        : isDaily
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {status.isApplied ? 'Yenidən Xərcə Yaz' : 'Kassadan Çıxart'}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(item)}
                      className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                      title="Düzəliş et"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setItemToDelete(item)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Recurring Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Repeat className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  {editingId ? 'Stabil Xərci Redaktə Et' : 'Yeni Stabil Xərc Əlavə Et'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick suggestions when adding a new item */}
            {!editingId && (
              <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl space-y-2">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Sürətli Şablonlar (Kliklə doldur):
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {quickTemplates.map((tpl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSelectTemplate(tpl)}
                      className="text-[11px] font-bold px-2.5 py-1 bg-white hover:bg-amber-100 text-slate-800 rounded-lg border border-amber-200 transition cursor-pointer"
                    >
                      {tpl.title} ({tpl.amount} {setting.currency} - {tpl.period})
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-4 pt-1">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Stabil Xərcin Adı / Təyinatı <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Məs: İşçilərin nahar yeməyi, Mağaza icarəsi"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* Period selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Dövriyyə / Tezlik (Necə təkrarlanır?) <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Günlük', 'Aylıq', 'Həftəlik'] as RecurringPeriod[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPeriod(p)}
                      className={`py-2 px-3 text-xs font-bold rounded-xl transition border cursor-pointer ${
                        period === p
                          ? p === 'Günlük'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs'
                            : p === 'Aylıq'
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-300 shadow-xs'
                            : 'bg-blue-50 text-blue-800 border-blue-300 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {p === 'Günlük' ? 'Hər gün (Günlük)' : p === 'Aylıq' ? 'Hər ay (Aylıq)' : 'Hər həftə'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Məbləğ ({setting.currency}) <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-xs text-slate-400">
                    {period === 'Günlük' ? 'Hər gün üçün məbləğ' : 'Hər ay üçün məbləğ'}
                  </span>
                </div>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={amount}
                  placeholder={period === 'Günlük' ? '5.00' : '1500.00'}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-extrabold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                />

                {/* Quick amount buttons */}
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  <span className="text-[11px] font-semibold text-slate-400">Tez seçim:</span>
                  {[3, 5, 10, 20, 50, 100, 500, 1500].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmount(amt)}
                      className="text-xs px-2.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-bold transition cursor-pointer"
                    >
                      {amt} {setting.currency}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Xərc Kateqoriyası <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomCategory(!isCustomCategory)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                  >
                    {isCustomCategory ? 'Siyahıdan seç' : '+ Fərdi kateqoriya'}
                  </button>
                </div>

                {isCustomCategory ? (
                  <input
                    type="text"
                    required
                    placeholder="Məsələn: Yemək, Ofis xərci"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                ) : (
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Payment Method & Active Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Ödəniş Üsulu</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('Nağd')}
                      className={`py-2 px-2 text-xs font-bold rounded-xl transition border cursor-pointer ${
                        paymentMethod === 'Nağd'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      Nağd
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('Kart')}
                      className={`py-2 px-2 text-xs font-bold rounded-xl transition border cursor-pointer ${
                        paymentMethod === 'Kart'
                          ? 'bg-blue-50 text-blue-800 border-blue-300'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      Kart
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Status</label>
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className={`w-full py-2 px-3 text-xs font-bold rounded-xl border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    <Check className={`w-3.5 h-3.5 ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                    {isActive ? 'Aktiv (Planlaşdırılır)' : 'Deaktiv (Dayandırılıb)'}
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Əlavə Qeyd (İstəyə bağlı)</label>
                <input
                  type="text"
                  placeholder="Məs: Hər gün saat 13:00-da işçilərə verilir"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  Ləğv Et
                </button>
                <button
                  type="submit"
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                >
                  {editingId ? 'Yadda Saxla' : 'Stabil Xərci Əlavə Et'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Apply Single Expense Modal */}
      {applyModalItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in duration-150">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <Zap className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-extrabold text-slate-900">
                Kassadan Çıxarış və Xərc Qeydi
              </h3>
              <p className="text-xs text-slate-500">
                "{applyModalItem.title}" xərci üçün məbləğ kassadan silinəcək və maliyyə jurnalına qeyd ediləcək.
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Məbləğ:</span>
                <span className="font-extrabold text-rose-600 text-sm">
                  -{applyModalItem.amount.toFixed(2)} {setting.currency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Kateqoriya:</span>
                <span className="font-bold text-slate-800">{applyModalItem.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Ödəniş Üsulu:</span>
                <span className="font-bold text-slate-800">{applyModalItem.paymentMethod}</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mt-2 mb-1">
                  Qeyd Tarixi:
                </label>
                <input
                  type="date"
                  value={applyDate}
                  onChange={(e) => setApplyDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setApplyModalItem(null)}
                className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Ləğv Et
              </button>
              <button
                type="button"
                onClick={handleConfirmApply}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center justify-center gap-1"
              >
                <Check className="w-4 h-4" />
                Xərcə Yaz
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-extrabold text-slate-900">
                Stabil Xərci Silmək İstəyirsiniz?
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                "{itemToDelete.title}" ({itemToDelete.amount.toFixed(2)} {setting.currency}) stabil xərc şablonu silinəcək. (Əvvəlki çıxarış qeydləri silinməyəcək).
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Ləğv Et
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteRecurringExpense(itemToDelete.id);
                  showToast(`"${itemToDelete.title}" stabil xərci silindi.`);
                  setItemToDelete(null);
                }}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition cursor-pointer"
              >
                Bəli, Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
