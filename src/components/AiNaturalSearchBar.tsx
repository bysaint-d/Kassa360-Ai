import React, { useState } from 'react';
import { Sparkles, Search, X, Loader2, Filter, Tag, Palette, DollarSign, Check } from 'lucide-react';
import { aiApi, StructuredSearchFilter } from '../services/aiApi';

interface AiNaturalSearchBarProps {
  onApplyFilter: (filter: StructuredSearchFilter | null) => void;
  activeFilter: StructuredSearchFilter | null;
  existingCategories: string[];
  placeholder?: string;
  className?: string;
}

const QUICK_PROMPTS = [
  'Qara kostyum 52 razmer 150 manatdan aşağı',
  'M ölçü mavi köynək',
  'Ağ cins şalvar 60 AZN altı',
  '42 razmer ayaqqabı',
];

export const AiNaturalSearchBar: React.FC<AiNaturalSearchBarProps> = ({
  onApplyFilter,
  activeFilter,
  existingCategories,
  placeholder = 'Məs: Qara kostyum 52 razmer 150 manatdan aşağı...',
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExamples, setShowExamples] = useState(false);

  const handleSearch = async (queryText?: string) => {
    const textToSearch = (queryText ?? query).trim();
    if (!textToSearch) {
      onApplyFilter(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setShowExamples(false);

    try {
      const { structuredFilter } = await aiApi.parseNaturalLanguageSearch({
        query: textToSearch,
        existingCategories,
      });
      onApplyFilter(structuredFilter);
    } catch (err: any) {
      setError(err?.message || 'Axtarış emal edilə bilmədi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setError(null);
    onApplyFilter(null);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-indigo-500">
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            ) : (
              <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
            )}
          </div>

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
              }
            }}
            placeholder={placeholder}
            className="w-full pl-10 pr-20 py-2.5 bg-gradient-to-r from-indigo-50/40 via-white to-purple-50/30 border border-indigo-200/80 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-2xs outline-none transition"
          />

          <div className="absolute inset-y-0 right-0 pr-1.5 flex items-center gap-1">
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                title="Təmizlə"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSearch()}
              disabled={isLoading || !query.trim()}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition cursor-pointer"
            >
              <span>Axtar</span>
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowExamples(!showExamples)}
          className="px-2.5 py-2.5 bg-white border border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-600 rounded-xl text-xs font-semibold flex items-center gap-1 shadow-2xs transition cursor-pointer shrink-0"
          title="Təbii axtarış nümunələri"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          <span className="hidden md:inline">Nümunələr</span>
        </button>
      </div>

      {/* Examples Popup / Ribbon */}
      {showExamples && (
        <div className="p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-1.5 text-xs animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-600" />
              Təbii dil ilə sürətli axtarış nümunələri:
            </span>
            <button
              type="button"
              onClick={() => setShowExamples(false)}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              Bağla
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                type="button"
                key={prompt}
                onClick={() => {
                  setQuery(prompt);
                  handleSearch(prompt);
                }}
                className="px-2.5 py-1 bg-white hover:bg-indigo-600 text-slate-700 hover:text-white border border-indigo-200/70 rounded-lg text-[11px] font-medium transition cursor-pointer shadow-2xs"
              >
                "{prompt}"
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="p-2 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Active Structured Filter Badges */}
      {activeFilter && (
        <div className="p-2.5 bg-indigo-50/80 border border-indigo-200 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs animate-in fade-in">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-indigo-950 flex items-center gap-1 mr-1">
              <Filter className="w-3 h-3 text-indigo-600" />
              Aktiv AI Filtri:
            </span>

            {activeFilter.category && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-indigo-200 rounded-md font-semibold text-indigo-700 text-[11px]">
                <Tag className="w-2.5 h-2.5" />
                Kateqoriya: {activeFilter.category}
              </span>
            )}

            {activeFilter.color && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-indigo-200 rounded-md font-semibold text-slate-800 text-[11px]">
                <Palette className="w-2.5 h-2.5 text-indigo-600" />
                Rəng: {activeFilter.color}
              </span>
            )}

            {activeFilter.size && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-600 text-white rounded-md font-black text-[11px] shadow-2xs">
                Ölçü: {activeFilter.size}
              </span>
            )}

            {activeFilter.maxPrice !== undefined && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md font-bold text-[11px]">
                <DollarSign className="w-2.5 h-2.5" />
                Maks: {activeFilter.maxPrice} AZN
              </span>
            )}

            {activeFilter.minPrice !== undefined && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md font-bold text-[11px]">
                Min: {activeFilter.minPrice} AZN
              </span>
            )}

            {activeFilter.keyword && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 text-slate-700 rounded-md font-semibold text-[11px]">
                Açar: "{activeFilter.keyword}"
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleClear}
            className="px-2 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
          >
            <X className="w-3 h-3" />
            Filtri Sil
          </button>
        </div>
      )}
    </div>
  );
};
