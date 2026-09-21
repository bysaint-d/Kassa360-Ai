import React, { useState, useMemo } from 'react';
import {
  TrendingDown,
  Calendar,
  Wallet,
  Search,
  CheckCircle,
  AlertCircle,
  Printer,
  CreditCard,
  Banknote,
  Trash2,
  X,
  Link,
  Plus,
  Repeat,
  Zap,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Expense } from '../types';
import { RecurringExpensesView } from './RecurringExpensesView';

export const FinanceView: React.FC = () => {
  const {
    expenses,
    sales,
    incomes,
    setting,
    addExpense,
    deleteExpense,
    recurringExpenses,
    applyRecurringExpense,
  } = useStore();

  // Active sub-tab
  const [financeTab, setFinanceTab] = useState<'expenses' | 'recurring'>('expenses');

  // Expense form state
  const [expCategory, setExpCategory] = useState('Kommunal');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [expDescription, setExpDescription] = useState('');
  const [expAmount, setExpAmount] = useState<number | ''>('');
  const [expPaymentMethod, setExpPaymentMethod] = useState<'Nağd' | 'Kart'>('Nağd');
  const [expDate, setExpDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [expNotes, setExpNotes] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedMethod, setSelectedMethod] = useState<string>('all');

  // Delete modal state
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  // Notifications
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const expenseCategories = [
    'Kommunal',
    'İcarə',
    'Maaş',
    'Nəqliyyat',
    'Digər',
    'Qablaşdırma & Torba',
    'Təmir & Avadanlıq',
    'Təmizlik & Gigiyena',
    'Yemək / Çay',
  ];

  const quickAmounts = [1, 2, 5, 10, 20, 50, 100, 200];

  // Helper date checker
  const isInPeriod = (dateStr: string) => {
    if (!dateStr) return true;
    if (filterPeriod === 'all') return true;

    const itemDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const itemDay = new Date(itemDate);
    itemDay.setHours(0, 0, 0, 0);

    if (filterPeriod === 'today') {
      return itemDay.getTime() === today.getTime();
    }

    if (filterPeriod === 'yesterday') {
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      return itemDay.getTime() === yest.getTime();
    }

    if (filterPeriod === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return itemDay >= weekAgo && itemDay <= today;
    }

    if (filterPeriod === 'month') {
      return (
        itemDay.getMonth() === today.getMonth() &&
        itemDay.getFullYear() === today.getFullYear()
      );
    }

    if (filterPeriod === 'custom') {
      const start = new Date(customStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);
      return itemDay >= start && itemDay <= end;
    }

    return true;
  };

  // Calculations for Metric Cards
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayExpensesSum = useMemo(() => {
    return expenses
      .filter((e) => {
        if (!e.date) return false;
        const d = new Date(e.date);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
      })
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [expenses, today]);

  const thisMonthExpensesSum = useMemo(() => {
    return expenses
      .filter((e) => {
        if (!e.date) return false;
        const d = new Date(e.date);
        return (
          d.getMonth() === today.getMonth() &&
          d.getFullYear() === today.getFullYear()
        );
      })
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [expenses, today]);

  const totalExpenseSum = useMemo(() => {
    return expenses.reduce((acc, curr) => acc + curr.amount, 0);
  }, [expenses]);

  // Recurring Calculations
  const activeRecurring = useMemo(() => {
    return recurringExpenses.filter((r) => r.isActive);
  }, [recurringExpenses]);

  const dailyRecurringTotal = useMemo(() => {
    return recurringExpenses
      .filter((r) => r.isActive && r.period === 'Günlük')
      .reduce((acc, r) => acc + r.amount, 0);
  }, [recurringExpenses]);

  const monthlyRecurringTotal = useMemo(() => {
    return recurringExpenses
      .filter((r) => r.isActive && r.period === 'Aylıq')
      .reduce((acc, r) => acc + r.amount, 0);
  }, [recurringExpenses]);

  // Net Cash Balance: (Total Sales Paid) + (Total Incomes) - (Total Expenses)
  const netFinancialBalance = useMemo(() => {
    const totalSalesIncome = sales
      .filter((s) => !s.isReturned)
      .reduce((acc, s) => acc + (s.paidAmount || 0), 0);
    const totalOtherIncome = incomes.reduce((acc, i) => acc + i.amount, 0);
    return totalSalesIncome + totalOtherIncome - totalExpenseSum;
  }, [sales, incomes, totalExpenseSum]);

  // Filtered Expenses List
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      // Period filter
      if (!isInPeriod(e.date)) return false;

      // Category filter
      if (selectedCategory !== 'all' && e.category !== selectedCategory) {
        return false;
      }

      // Payment method filter
      if (selectedMethod !== 'all') {
        const method = e.paymentMethod || 'Nağd';
        if (method !== selectedMethod) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = e.description?.toLowerCase().includes(q);
        const matchNote = e.notes?.toLowerCase().includes(q);
        const matchCat = e.category?.toLowerCase().includes(q);
        if (!matchDesc && !matchNote && !matchCat) return false;
      }

      return true;
    });
  }, [expenses, filterPeriod, customStartDate, customEndDate, selectedCategory, selectedMethod, searchQuery]);

  const filteredExpenseSum = useMemo(() => {
    return filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  }, [filteredExpenses]);

  // Handle Add Expense
  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const category = isCustomCategory ? customCategory.trim() : expCategory;
      if (!category) {
        showToast('Xərc kateqoriyasını seçin və ya daxil edin.', 'error');
        return;
      }

      if (!expDescription.trim()) {
        showToast('Xərcin təyinatı / açıqlaması boş ola bilməz.', 'error');
        return;
      }

      const amountNum = Number(expAmount);
      if (isNaN(amountNum) || amountNum <= 0) {
        showToast('Düzgün xərc məbləği daxil edin.', 'error');
        return;
      }

      addExpense({
        category,
        description: expDescription.trim(),
        amount: amountNum,
        date: expDate || new Date().toISOString().split('T')[0],
        paymentMethod: expPaymentMethod,
        notes: expNotes.trim() || undefined,
      });

      setExpDescription('');
      setExpAmount('');
      setExpNotes('');
      if (isCustomCategory) {
        setCustomCategory('');
        setIsCustomCategory(false);
      }

      showToast(`-${amountNum.toFixed(2)} ${setting.currency} xərc uğurla qeydiyyata alındı!`);
    } catch (err: any) {
      showToast(err.message || 'Xərc qeyd edilərkən xəta baş verdi.', 'error');
    }
  };

  // Handle Confirm Delete Expense
  const handleConfirmDeleteExpense = () => {
    if (!expenseToDelete) return;
    try {
      const amount = expenseToDelete.amount;
      const desc = expenseToDelete.description;
      deleteExpense(expenseToDelete.id);
      setExpenseToDelete(null);
      showToast(`"${desc}" (${amount.toFixed(2)} ${setting.currency}) xərci silindi.`);
    } catch (err: any) {
      showToast(err.message || 'Xərci silmək mümkün olmadı.', 'error');
    }
  };

  const handlePrintExpenses = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between shadow-lg transition-all ${
            toastMessage.type === 'error'
              ? 'bg-rose-50 border border-rose-200 text-rose-800'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-600" />
            ) : (
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFinanceTab('expenses')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              financeTab === 'expenses'
                ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/20'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            Cari Xərclər & Jurnal
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                financeTab === 'expenses' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {expenses.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFinanceTab('recurring')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              financeTab === 'recurring'
                ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/20'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Repeat className="w-4 h-4" />
            Stabil Xərclər (Gündəlik / Aylıq)
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                financeTab === 'recurring'
                  ? 'bg-white/20 text-white'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {activeRecurring.length} aktiv
            </span>
          </button>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePrintExpenses}
            className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Çap Et
          </button>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: BUGÜNKÜ XƏRC */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              BUGÜNKÜ XƏRC
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-rose-600">
              -{todayExpensesSum.toFixed(2)} {setting.currency}
            </h3>
            <p className="text-xs text-slate-400 mt-1">Bugün kassadan çıxan xərclər</p>
          </div>
        </div>

        {/* Card 2: BU AYIN XƏRCİ */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              BU AYIN XƏRCİ
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-amber-500">
              -{thisMonthExpensesSum.toFixed(2)} {setting.currency}
            </h3>
            <p className="text-xs text-slate-400 mt-1">Cari ayın toplam çıxarışları</p>
          </div>
        </div>

        {/* Card 3: GÜNLÜK STABİL PLAN */}
        <div
          onClick={() => setFinanceTab('recurring')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between cursor-pointer hover:border-emerald-300 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              GÜNLÜK STABİL PLAN
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Repeat className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-emerald-600">
              {dailyRecurringTotal.toFixed(2)} {setting.currency}
              <span className="text-xs font-bold text-slate-400 ml-1">/ gün</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Məs: Yemək (5 ₼), Çay (3 ₼)
            </p>
          </div>
        </div>

        {/* Card 4: AYLIQ STABİL PLAN */}
        <div
          onClick={() => setFinanceTab('recurring')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between cursor-pointer hover:border-indigo-300 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              AYLIQ STABİL PLAN
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-indigo-600">
              {monthlyRecurringTotal.toFixed(2)} {setting.currency}
              <span className="text-xs font-bold text-slate-400 ml-1">/ ay</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Məs: İcarə (1500 ₼), Kommunal
            </p>
          </div>
        </div>
      </div>

      {/* Conditional rendering depending on sub-tab */}
      {financeTab === 'recurring' ? (
        <RecurringExpensesView
          onAppliedExpense={() =>
            showToast('Stabil xərc uğurla kassadan çıxarıldı və xərclərə yazıldı!')
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form (5 cols) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
              <span className="text-rose-600 font-bold text-lg leading-none">+</span>
              Yeni Xərc Əlavə Et
            </h2>
            <span className="text-xs bg-rose-50 text-rose-600 font-semibold px-2.5 py-1 rounded-md">
              Kassadan Çıxarış
            </span>
          </div>

          {/* Quick Selection from Active Recurring Expenses */}
          {activeRecurring.length > 0 && (
            <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Repeat className="w-3.5 h-3.5 text-amber-600" />
                  Stabil Xərclərdən Sürətli Seçim:
                </span>
                <button
                  type="button"
                  onClick={() => setFinanceTab('recurring')}
                  className="text-[11px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-0.5 cursor-pointer"
                >
                  İdarə Et ({activeRecurring.length}) <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {activeRecurring.slice(0, 5).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setExpDescription(item.title);
                      setExpAmount(item.amount);
                      setExpCategory(item.category);
                      setIsCustomCategory(false);
                      setExpPaymentMethod(item.paymentMethod);
                      setExpNotes(`Stabil xərc: ${item.period}`);
                      showToast(`"${item.title}" (${item.amount} ${setting.currency}) formu dolduruldu.`);
                    }}
                    className="text-xs font-bold px-2.5 py-1 bg-white hover:bg-amber-100 text-slate-800 rounded-lg border border-amber-200 transition shadow-2xs cursor-pointer flex items-center gap-1"
                    title={`${item.title} - ${item.amount} ${setting.currency} (${item.period}). Formu doldurmaq üçün klikləyin.`}
                  >
                    <span>{item.title}</span>
                    <span className="text-amber-700 font-extrabold">{item.amount} {setting.currency}</span>
                    <span className="text-[10px] text-slate-400 font-medium">({item.period})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleExpenseSubmit} className="space-y-4 pt-1">
            {/* Category Selection */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  Xərc Kateqoriyası <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomCategory(!isCustomCategory)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
                >
                  {isCustomCategory ? 'Siyahıdan seç' : '+ Fərdi Kateqoriya'}
                </button>
              </div>

              {isCustomCategory ? (
                <input
                  type="text"
                  required
                  placeholder="Məsələn: Reklam xərcləri, Təmir"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-rose-500 outline-none"
                />
              ) : (
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-rose-500 outline-none"
                >
                  {expenseCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Xərcin Təyinatı / Açıqlaması <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Məs: İşıq pulu, Çörək və çay, Qablaşdırma torbaları"
                value={expDescription}
                onChange={(e) => setExpDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-rose-500 outline-none"
              />
            </div>

            {/* Amount & Quick Buttons */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  Məbləğ ({setting.currency}) <span className="text-rose-500">*</span>
                </label>
                <span className="text-xs text-slate-400">Dəqiq məbləği yazın</span>
              </div>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={expAmount}
                placeholder="0.00"
                onChange={(e) => setExpAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-rose-600 placeholder:text-rose-400 focus:ring-2 focus:ring-rose-500 outline-none"
              />

              {/* Quick Amount Pills */}
              <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                <span className="text-xs font-semibold text-slate-400 mr-1">Tez Məbləğ:</span>
                {quickAmounts.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setExpAmount(amt)}
                    className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 rounded-lg font-bold border border-slate-200 transition cursor-pointer"
                  >
                    {amt} {setting.currency}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Method & Date */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Ödəniş Üsulu</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setExpPaymentMethod('Nağd')}
                    className={`py-2 px-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                      expPaymentMethod === 'Nağd'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    Nağd
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpPaymentMethod('Kart')}
                    className={`py-2 px-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                      expPaymentMethod === 'Kart'
                        ? 'bg-blue-50 text-blue-700 border-blue-300'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Kart
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Tarix</label>
                <input
                  type="date"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Əlavə Qeyd (İstəyə bağlı)</label>
              <input
                type="text"
                placeholder="Xərc haqqında əlavə məlumat..."
                value={expNotes}
                onChange={(e) => setExpNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-rose-500 outline-none"
              />
            </div>

            {/* Save Button */}
            <button
              type="submit"
              className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md shadow-rose-600/20 text-sm flex items-center justify-center gap-1.5 transition active:scale-[0.99] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Xərci Yadda Saxla ({Number(expAmount || 0).toFixed(2)} {setting.currency})
            </button>
          </form>
        </div>

        {/* Right Column: Table & Filters (7 cols) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
          {/* Header & Print */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900 text-base">Xərclər Siyahısı</h2>
              <span className="text-xs font-normal text-slate-500">
                ({filteredExpenses.length} xərc / Cəmi: -{filteredExpenseSum.toFixed(2)} {setting.currency})
              </span>
            </div>

            <button
              onClick={handlePrintExpenses}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 transition self-start sm:self-auto cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              Çap Et
            </button>
          </div>

          {/* Period Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'all', label: 'Bütün Vaxtlar' },
              { id: 'today', label: 'Bugün' },
              { id: 'yesterday', label: 'Dünən' },
              { id: 'week', label: 'Son 7 Gün' },
              { id: 'month', label: 'Bu Ay' },
              { id: 'custom', label: 'Tarix Aralığı' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterPeriod(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-lg font-bold text-xs whitespace-nowrap transition cursor-pointer ${
                  filterPeriod === tab.id
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range */}
          {filterPeriod === 'custom' && (
            <div className="flex items-center gap-2 text-xs bg-slate-50 p-2 rounded-xl border border-slate-200">
              <span className="font-semibold text-slate-600">Tarix aralığı:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs"
              />
              <span className="text-slate-400">-</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs"
              />
            </div>
          )}

          {/* Filters Row: Search, Category, Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <div className="sm:col-span-6 relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Açıqlama və ya qeydlə axtar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-rose-500 outline-none"
              />
            </div>

            <div className="sm:col-span-3">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-rose-500 outline-none"
              >
                <option value="all">Bütün Kateqoriyalar</option>
                {expenseCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <select
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-rose-500 outline-none"
              >
                <option value="all">Bütün Ödəniş Üsulları</option>
                <option value="Nağd">Yalnız Nağd</option>
                <option value="Kart">Yalnız Kart</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border-t border-slate-100 pt-2 min-h-[260px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-2.5 px-2">Tarix</th>
                  <th className="py-2.5 px-2">Kateqoriya</th>
                  <th className="py-2.5 px-2">Açıqlama / Təyinat</th>
                  <th className="py-2.5 px-2">Ödəniş</th>
                  <th className="py-2.5 px-2 text-right">Məbləğ</th>
                  <th className="py-2.5 px-2 text-center">Əməliyyat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      Seçilmiş filterlərə uyğun xərc qeydi tapılmadı.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-2 text-slate-500 whitespace-nowrap font-mono">
                        {exp.date ? exp.date.split('T')[0] : ''}
                      </td>
                      <td className="py-3 px-2 whitespace-nowrap">
                        <span className="inline-flex px-2.5 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-100 font-bold">
                          {exp.category}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-slate-900">{exp.description}</p>
                          {(exp.recurringExpenseId || exp.notes?.includes('Stabil')) && (
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-0.5">
                              <Repeat className="w-2.5 h-2.5" />
                              Stabil
                            </span>
                          )}
                        </div>
                        {exp.notes && (
                          <p className="text-[11px] text-slate-400 mt-0.5">{exp.notes}</p>
                        )}
                      </td>
                      <td className="py-3 px-2 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Banknote className="w-3 h-3" />
                          {exp.paymentMethod || 'Nağd'}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right font-extrabold text-rose-600 whitespace-nowrap text-sm">
                        -{exp.amount.toFixed(2)} {setting.currency}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <button
                          onClick={() => setExpenseToDelete(exp)}
                          className="p-1 text-slate-300 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                          title="Xərci Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Bottom Summary */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800">
              Göstərilən {filteredExpenses.length} xərcin cəmi:
            </span>
            <span className="text-base font-extrabold text-rose-600">
              -{filteredExpenseSum.toFixed(2)} {setting.currency}
            </span>
          </div>
        </div>
      </div>
      )}

      {/* Delete Expense Confirmation Modal */}
      {expenseToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Xərci Silmək İstəyirsiniz?</h3>
              <p className="text-xs text-slate-500 font-medium">
                "{expenseToDelete.description}" (-{expenseToDelete.amount.toFixed(2)} {setting.currency}) xərc qeydi silinəcək.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Ləğv Et
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteExpense}
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
