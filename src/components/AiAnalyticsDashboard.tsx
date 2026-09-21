import React, { useState } from 'react';
import {
  Sparkles,
  TrendingUp,
  Tag,
  Ruler,
  HelpCircle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Send,
  PieChart,
  BarChart3,
  ShieldAlert,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { aiApi, PricingRecommendation, SizeAnalysisResult } from '../services/aiApi';

export const AiAnalyticsDashboard: React.FC = () => {
  const { products, sales, setting } = useStore();

  const [activeTab, setActiveTab] = useState<'sales' | 'pricing' | 'sizes'>('sales');

  // Sales Analysis State
  const [salesQuestion, setSalesQuestion] = useState('');
  const [salesAnswer, setSalesAnswer] = useState<string | null>(null);
  const [isAnalyzingSales, setIsAnalyzingSales] = useState(false);
  const [salesError, setSalesError] = useState<string | null>(null);

  // Pricing Analysis State
  const [pricingInsights, setPricingInsights] = useState<string | null>(null);
  const [pricingRecommendations, setPricingRecommendations] = useState<PricingRecommendation[]>([]);
  const [isAnalyzingPricing, setIsAnalyzingPricing] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);

  // Size Analysis State
  const [sizeAnalysis, setSizeAnalysis] = useState<SizeAnalysisResult | null>(null);
  const [isAnalyzingSizes, setIsAnalyzingSizes] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);

  // Pre-built questions for Sales Analysis
  const PREBUILT_SALES_QUESTIONS = [
    'Bu ay ən çox nə satılıb?',
    'Hansı kateqoriya ən çox gəlir gətirib?',
    'Hansı ölçülər ən çox satılıb?',
    'Cari ayı keçən ayla müqayisə et.',
  ];

  // Helper to compile real store metrics for AI analysis
  const compileStoreMetrics = () => {
    const validSales = sales.filter((s) => !s.isReturned);
    const totalRevenue = validSales.reduce((acc, s) => acc + s.total, 0);

    const productSalesMap = new Map<number, { name: string; quantity: number; revenue: number; profit: number }>();
    validSales.forEach((s) => {
      s.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const purchasePrice = prod?.purchasePrice || 0;
        const current = productSalesMap.get(item.productId) || {
          name: item.productName,
          quantity: 0,
          revenue: 0,
          profit: 0,
        };
        const rev = item.salePrice * item.quantity;
        const prof = (item.salePrice - purchasePrice) * item.quantity;
        current.quantity += item.quantity;
        current.revenue += rev;
        current.profit += prof;
        productSalesMap.set(item.productId, current);
      });
    });

    const topProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    const totalProfit = Array.from(productSalesMap.values()).reduce((sum, p) => sum + p.profit, 0);

    // Monthly breakdown
    const monthlyMap = new Map<string, { revenue: number; salesCount: number }>();
    validSales.forEach((s) => {
      const monthKey = s.date.slice(0, 7); // YYYY-MM
      const m = monthlyMap.get(monthKey) || { revenue: 0, salesCount: 0 };
      m.revenue += s.total;
      m.salesCount += 1;
      monthlyMap.set(monthKey, m);
    });

    return {
      totalRevenue,
      totalProfit,
      salesCount: validSales.length,
      topProducts,
      monthlyBreakdown: Array.from(monthlyMap.entries()).map(([month, d]) => ({
        month,
        revenue: d.revenue,
        salesCount: d.salesCount,
      })),
    };
  };

  // 5. Trigger Sales Analysis
  const handleAnalyzeSales = async (questionToAsk?: string) => {
    const q = (questionToAsk ?? salesQuestion).trim();
    if (!q) return;

    setIsAnalyzingSales(true);
    setSalesError(null);
    if (questionToAsk) setSalesQuestion(questionToAsk);

    try {
      const salesMetrics = compileStoreMetrics();
      const res = await aiApi.analyzeSales({
        question: q,
        salesData: salesMetrics,
      });
      setSalesAnswer(res.answer);
    } catch (err: any) {
      setSalesError(err?.message || 'Satış təhlili aparılarkən xəta baş verdi.');
    } finally {
      setIsAnalyzingSales(false);
    }
  };

  // 6. Trigger Pricing Analysis
  const handleAnalyzePricing = async () => {
    setIsAnalyzingPricing(true);
    setPricingError(null);

    try {
      const productSummaries = products.map((p) => {
        let soldQty = 0;
        let totalRevenue = 0;
        sales.forEach((s) => {
          if (!s.isReturned) {
            s.items.forEach((item) => {
              if (item.productId === p.id) {
                soldQty += item.quantity;
                totalRevenue += item.salePrice * item.quantity;
              }
            });
          }
        });
        const marginPct = p.salePrice > 0 ? ((p.salePrice - p.purchasePrice) / p.salePrice) * 100 : 0;
        return {
          id: p.id,
          name: p.name,
          category: p.category,
          purchasePrice: p.purchasePrice,
          salePrice: p.salePrice,
          marginPct: Math.round(marginPct),
          stockQuantity: p.stockQuantity,
          soldQuantity: soldQty,
          totalRevenue,
        };
      });

      const res = await aiApi.analyzePricing({ products: productSummaries });
      setPricingInsights(res.insights);
      setPricingRecommendations(res.recommendations);
    } catch (err: any) {
      setPricingError(err?.message || 'Qiymət təhlili aparılarkən xəta baş verdi.');
    } finally {
      setIsAnalyzingPricing(false);
    }
  };

  // 7. Trigger Size Analysis
  const handleAnalyzeSizes = async () => {
    setIsAnalyzingSizes(true);
    setSizeError(null);

    try {
      const sizeStatsMap = new Map<string, { size: string; soldQuantity: number; revenue: number; currentStock: number }>();

      // Sum sold quantities per size
      sales.forEach((s) => {
        if (!s.isReturned) {
          s.items.forEach((item) => {
            const sizeKey = (item.size || 'Standart').trim().toUpperCase();
            const curr = sizeStatsMap.get(sizeKey) || {
              size: sizeKey,
              soldQuantity: 0,
              revenue: 0,
              currentStock: 0,
            };
            curr.soldQuantity += item.quantity;
            curr.revenue += item.salePrice * item.quantity;
            sizeStatsMap.set(sizeKey, curr);
          });
        }
      });

      // Sum stock quantities per size
      products.forEach((p) => {
        const sizes = p.sizes && p.sizes.length > 0 ? p.sizes : (p.size ? [p.size] : ['Standart']);
        const stockPerSize = Math.max(1, Math.floor(p.stockQuantity / sizes.length));
        sizes.forEach((sz) => {
          const key = sz.trim().toUpperCase();
          const curr = sizeStatsMap.get(key) || {
            size: key,
            soldQuantity: 0,
            revenue: 0,
            currentStock: 0,
          };
          curr.currentStock += stockPerSize;
          sizeStatsMap.set(key, curr);
        });
      });

      const sizeStats = Array.from(sizeStatsMap.values());
      const res = await aiApi.analyzeSizes({ sizeStats });
      setSizeAnalysis(res);
    } catch (err: any) {
      setSizeError(err?.message || 'Ölçü təhlili aparılarkən xəta baş verdi.');
    } finally {
      setIsAnalyzingSizes(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-lg border border-indigo-800/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-xs font-semibold border border-indigo-400/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Kassa360 AI Dərin Analitika Mərkəzi</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Satış, Qiymət və Ölçü Təhlili
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Real satış verilənləri və anbar qalığı əsasında süni intellekt köməkçisi ilə gəlir optimallaşdırılması və ölçü tələbatı analizi.
            </p>
          </div>

          {/* Navigation Pills */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/60 self-start md:self-auto">
            <button
              onClick={() => setActiveTab('sales')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'sales'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Satış Analizi</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('pricing');
                if (pricingRecommendations.length === 0 && !isAnalyzingPricing) {
                  handleAnalyzePricing();
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'pricing'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Qiymət Analizi</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('sizes');
                if (!sizeAnalysis && !isAnalyzingSizes) {
                  handleAnalyzeSizes();
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'sizes'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Ruler className="w-3.5 h-3.5" />
              <span>Ölçü Analizi</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5. TAB 1: AI SALES ANALYSIS */}
      {activeTab === 'sales' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  <span>Süni İntellektlə Satış Təhlili</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Real satış rəqəmləri əsasında təbii dildə sual verin və analitik hesabat alın.
                </p>
              </div>
            </div>

            {/* Pre-built questions */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Tövsiyə olunan sürətli suallar:
              </span>
              <div className="flex flex-wrap gap-2">
                {PREBUILT_SALES_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleAnalyzeSales(q)}
                    disabled={isAnalyzingSales}
                    className="px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-700 hover:text-indigo-700 rounded-xl text-xs font-semibold transition cursor-pointer shadow-2xs"
                  >
                    "{q}"
                  </button>
                ))}
              </div>
            </div>

            {/* Custom question input */}
            <div className="flex items-center gap-2 pt-2">
              <input
                type="text"
                value={salesQuestion}
                onChange={(e) => setSalesQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAnalyzeSales();
                  }
                }}
                placeholder="Öz sualınızı yazın (məsələn: Bu həftə hansı məhsullar ən çox zərərlə satılıb?)..."
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button
                type="button"
                onClick={() => handleAnalyzeSales()}
                disabled={isAnalyzingSales || !salesQuestion.trim()}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                {isAnalyzingSales ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Analiz Et</span>
              </button>
            </div>

            {salesError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                {salesError}
              </div>
            )}

            {/* Answer Display */}
            {salesAnswer && (
              <div className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-2 mt-4 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-bold text-xs text-indigo-950">
                      Sual: "{salesQuestion}"
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">Real Baza Hesabatı</span>
                </div>
                <div className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line pt-1">
                  {salesAnswer}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. TAB 2: AI PRICING ANALYSIS */}
      {activeTab === 'pricing' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Safeguard Banner */}
          <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 space-y-0.5">
              <p className="font-bold text-amber-950">Təhlükəsizlik və Avtonomiya Bildirişi:</p>
              <p>
                Süni intellekt heç bir halda məhsul qiymətlərini avtomatik dəyişdirmir. Aşağıdakı təhlil yalnız satış dinamikası və marja əsasında sahibkara tövsiyə xarakteri daşıyır.
              </p>
            </div>
            <button
              onClick={handleAnalyzePricing}
              disabled={isAnalyzingPricing}
              className="ml-auto px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzingPricing ? 'animate-spin' : ''}`} />
              <span>Təhlili Yenilə</span>
            </button>
          </div>

          {pricingError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
              {pricingError}
            </div>
          )}

          {isAnalyzingPricing ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              <p className="font-bold text-sm text-slate-800">Bütün məhsulların satış və marja analizi aparılır...</p>
              <p className="text-xs text-slate-400">Çox satılanlar, ləng gedənlər və endirim strategiyaları hesablanır</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pricingInsights && (
                <div className="p-5 bg-white rounded-2xl border border-slate-200/80 space-y-2">
                  <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    Ümumi Qiymət Strategiyası Rəyi:
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                    {pricingInsights}
                  </p>
                </div>
              )}

              {/* Recommendations Table */}
              <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900">
                    Məhsullar Üzrə Qiymət Tövsiyələri ({pricingRecommendations.length})
                  </h4>
                  <span className="text-xs text-slate-400">Marja və tələbat korrelyasiyası</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Məhsul</th>
                        <th className="py-3 px-3 text-right">Cari Qiymət</th>
                        <th className="py-3 px-3 text-right">Tövsiyə Edilən</th>
                        <th className="py-3 px-3 text-center">Fərq</th>
                        <th className="py-3 px-3">Tövsiyə Növü</th>
                        <th className="py-3 px-4">Əsaslandırma (Səbəb)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pricingRecommendations.map((r) => {
                        const diff = r.suggestedPrice - r.currentPrice;
                        const diffPct = r.currentPrice > 0 ? (diff / r.currentPrice) * 100 : 0;
                        return (
                          <tr key={r.productId} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-4 font-semibold text-slate-900">{r.productName}</td>
                            <td className="py-3 px-3 text-right font-medium text-slate-600">
                              {r.currentPrice.toFixed(2)} {setting.currency}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-indigo-700">
                              {r.suggestedPrice.toFixed(2)} {setting.currency}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {diff > 0 ? (
                                <span className="inline-flex items-center gap-0.5 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full text-[11px]">
                                  <ArrowUpRight className="w-3 h-3" />
                                  +{diff.toFixed(2)} ({diffPct > 0 ? `+${diffPct.toFixed(0)}%` : ''})
                                </span>
                              ) : diff < 0 ? (
                                <span className="inline-flex items-center gap-0.5 text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-full text-[11px]">
                                  <ArrowDownRight className="w-3 h-3" />
                                  {diff.toFixed(2)} ({diffPct.toFixed(0)}%)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full text-[11px]">
                                  <Minus className="w-3 h-3" /> 0.00
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {r.actionType === 'increase' && (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[11px]">
                                  Qaldırmaq
                                </span>
                              )}
                              {r.actionType === 'decrease' && (
                                <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-semibold text-[11px]">
                                  Endirmək
                                </span>
                              )}
                              {r.actionType === 'discount_campaign' && (
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded font-semibold text-[11px]">
                                  Kampaniya
                                </span>
                              )}
                              {r.actionType === 'maintain' && (
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-semibold text-[11px]">
                                  Sabit saxlamaq
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-600 text-xs">{r.reason}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7. TAB 3: AI SIZE ANALYSIS */}
      {activeTab === 'sizes' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                <Ruler className="w-5 h-5 text-indigo-600" />
                <span>Tekstil və Geyim Ölçü Matrisi Təhlili</span>
              </h3>
              <p className="text-xs text-slate-500">
                S/M/L/XL geyim ölçüləri, 36-44 ayaqqabı və 46-56 kostyum ölçülərinin satış statistikası.
              </p>
            </div>

            <button
              onClick={handleAnalyzeSizes}
              disabled={isAnalyzingSizes}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzingSizes ? 'animate-spin' : ''}`} />
              <span>Yenidən Analiz Et</span>
            </button>
          </div>

          {sizeError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
              {sizeError}
            </div>
          )}

          {isAnalyzingSizes ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              <p className="font-bold text-sm text-slate-800">Ölçülərin satış və qalıq həcmləri təhlil olunur...</p>
            </div>
          ) : sizeAnalysis ? (
            <div className="space-y-4">
              {/* Highlight Cards: Top Sizes vs Slow Sizes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-200/80 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <h4 className="font-bold text-sm">Ən Çox Tələb Olunan Ölçülər</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sizeAnalysis.topSizes.map((sz) => (
                      <span
                        key={sz}
                        className="px-3 py-1.5 bg-emerald-600 text-white font-black text-xs rounded-xl shadow-xs"
                      >
                        {sz}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-600">
                    Bu ölçülər mağazada ən sürətli satılan ölçülərdir. Növbəti sifarişlərdə bu ölçülərin payını artırmaq tövsiyə edilir.
                  </p>
                </div>

                <div className="p-5 bg-gradient-to-br from-amber-50 to-white rounded-2xl border border-amber-200/80 space-y-3">
                  <div className="flex items-center gap-2 text-amber-800">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <h4 className="font-bold text-sm">Ləng Gedən (Ölü) Ölçülər</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sizeAnalysis.slowSizes.map((sz) => (
                      <span
                        key={sz}
                        className="px-3 py-1.5 bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl"
                      >
                        {sz}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-600">
                    Bu ölçülər anbarda uzun müddət qalır. Bu ölçülərə xüsusi endirim tətbiq etmək və ya sifariş sayını azaltmaq lazımdır.
                  </p>
                </div>
              </div>

              {/* Detailed Narrative Analysis */}
              <div className="p-5 bg-white rounded-2xl border border-slate-200/80 space-y-2">
                <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  Ekspert Ölçü Rəyi:
                </h4>
                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                  {sizeAnalysis.analysis}
                </p>
              </div>

              {/* Recommendations list */}
              {sizeAnalysis.recommendations && sizeAnalysis.recommendations.length > 0 && (
                <div className="p-5 bg-indigo-50/60 rounded-2xl border border-indigo-100 space-y-2.5">
                  <h4 className="font-bold text-xs text-indigo-950 uppercase tracking-wider">
                    Anbar və Təchizat Tövsiyələri:
                  </h4>
                  <ul className="space-y-1.5">
                    {sizeAnalysis.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-slate-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-2 shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
              <Ruler className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">Ölçü analizi hələ aparılmayıb.</p>
              <button
                type="button"
                onClick={handleAnalyzeSizes}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
              >
                Analizə Başla
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
