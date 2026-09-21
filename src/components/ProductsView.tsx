import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Barcode,
  Edit2,
  Trash2,
  Sliders,
  History,
  AlertTriangle,
  Package,
  X,
  Check,
  Tag,
  Truck,
  ArrowUpDown,
  Palette,
  RotateCcw,
  Filter,
  Sparkles,
  Image as ImageIcon,
  Loader2,
  Wand2,
} from 'lucide-react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';
import {
  getColorHex,
  CLOTHING_COLOR_PRESETS,
  COLOR_SWATCHES,
  CLOTHING_SIZE_PRESETS,
} from '../utils/calculations';
import { aiApi, StructuredSearchFilter } from '../services/aiApi';
import { AiProductImageModal } from './AiProductImageModal';
import { AiNaturalSearchBar } from './AiNaturalSearchBar';

export const ProductsView: React.FC = () => {
  const {
    products,
    categories,
    suppliers,
    setting,
    movements,
    saveProduct,
    deleteProduct,
    adjustStock,
    addCategory,
    addSupplier,
    byBarcode,
  } = useStore();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedColor, setSelectedColor] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'inStock' | 'lowStock' | 'outOfStock'>('all');
  const [sortBy, setSortBy] = useState<string>('newest');

  // Barcode input for quick lookup or new entry
  const [barcodeInput, setBarcodeInput] = useState('');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustTargetProduct, setAdjustTargetProduct] = useState<Product | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(0);
  const [adjustNote, setAdjustNote] = useState('');

  const [isMovementsModalOpen, setIsMovementsModalOpen] = useState(false);
  const [movementFilterProduct, setMovementFilterProduct] = useState<Product | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form fields for create / edit
  const [formName, setFormName] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formColor, setFormColor] = useState('');
  const [formColorHex, setFormColorHex] = useState('');
  const [formSizes, setFormSizes] = useState<string[]>([]);
  const [customSizeInput, setCustomSizeInput] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formPurchasePrice, setFormPurchasePrice] = useState<number>(0);
  const [formSalePrice, setFormSalePrice] = useState<number>(0);
  const [formStockQuantity, setFormStockQuantity] = useState<number>(0);
  const [formMinimumStock, setFormMinimumStock] = useState<number>(5);
  const [formSupplier, setFormSupplier] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formImagePath, setFormImagePath] = useState('');

  // AI Feature States
  const [aiFilter, setAiFilter] = useState<StructuredSearchFilter | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isSuggestingCategory, setIsSuggestingCategory] = useState(false);
  const [categorySuggestion, setCategorySuggestion] = useState<{
    suggestedCategory: string;
    confidence: number;
    reasoning: string;
  } | null>(null);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState<string | null>(null);

  // Inline quick category / supplier add
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [showAddCategoryInput, setShowAddCategoryInput] = useState(false);
  const [newSupplierInput, setNewSupplierInput] = useState('');
  const [showAddSupplierInput, setShowAddSupplierInput] = useState(false);

  // Distinct brands list with product count
  const existingBrands = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => {
      const b = p.brand?.trim();
      if (b) {
        map.set(b, (map.get(b) || 0) + 1);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [products]);

  // Distinct colors list with product count and resolved visual hex
  const existingColors = useMemo(() => {
    const map = new Map<string, { count: number; hex: string }>();
    products.forEach((p) => {
      const c = p.color?.trim();
      if (c) {
        const prev = map.get(c);
        const resolvedHex = p.colorHex || getColorHex(c);
        if (prev) {
          prev.count += 1;
        } else {
          map.set(c, { count: 1, hex: resolvedHex });
        }
      }
    });
    return Array.from(map.entries())
      .map(([color, data]) => ({ color, count: data.count, hex: data.hex }))
      .sort((a, b) => a.color.localeCompare(b.color));
  }, [products]);

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (search.trim()) count++;
    if (selectedCategory !== 'all') count++;
    if (selectedBrand !== 'all') count++;
    if (selectedColor !== 'all') count++;
    if (stockFilter !== 'all') count++;
    if (aiFilter !== null) count++;
    return count;
  }, [search, selectedCategory, selectedBrand, selectedColor, stockFilter, aiFilter]);

  const clearAllFilters = () => {
    setSearch('');
    setSelectedCategory('all');
    setSelectedBrand('all');
    setSelectedColor('all');
    setStockFilter('all');
    setSortBy('newest');
    setAiFilter(null);
  };

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = products.filter((p) => {
      // Natural language AI filter
      if (aiFilter) {
        if (aiFilter.keyword) {
          const kw = aiFilter.keyword.toLowerCase();
          const matchesKw =
            p.name.toLowerCase().includes(kw) ||
            p.category.toLowerCase().includes(kw) ||
            (p.brand && p.brand.toLowerCase().includes(kw)) ||
            (p.notes && p.notes.toLowerCase().includes(kw));
          if (!matchesKw) return false;
        }

        if (aiFilter.category) {
          const cat = aiFilter.category.toLowerCase();
          if (!p.category.toLowerCase().includes(cat)) return false;
        }

        if (aiFilter.color) {
          const col = aiFilter.color.toLowerCase();
          if (!p.color || !p.color.toLowerCase().includes(col)) return false;
        }

        if (aiFilter.size) {
          const sz = aiFilter.size.toUpperCase();
          const productSizes = [
            ...(p.sizes || []),
            ...(p.size ? p.size.split(/[,/]+/).map((s) => s.trim()) : []),
          ].map((s) => s.toUpperCase());
          if (!productSizes.some((s) => s === sz || s.includes(sz))) return false;
        }

        if (aiFilter.maxPrice !== undefined && p.salePrice > aiFilter.maxPrice) {
          return false;
        }

        if (aiFilter.minPrice !== undefined && p.salePrice < aiFilter.minPrice) {
          return false;
        }

        if (aiFilter.inStockOnly && p.stockQuantity <= 0) {
          return false;
        }
      }

      const matchQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.color && p.color.toLowerCase().includes(q)) ||
        (p.size && p.size.toLowerCase().includes(q)) ||
        (p.sizes && p.sizes.some((s) => s.toLowerCase().includes(q))) ||
        (p.supplier && p.supplier.toLowerCase().includes(q)) ||
        (p.notes && p.notes.toLowerCase().includes(q));

      const matchCategory = selectedCategory === 'all' || p.category === selectedCategory;
      const matchBrand = selectedBrand === 'all' || (p.brand || '').toLowerCase().trim() === selectedBrand.toLowerCase().trim();
      const matchColor = selectedColor === 'all' || (p.color || '').toLowerCase().trim() === selectedColor.toLowerCase().trim();

      let matchStock = true;
      if (stockFilter === 'lowStock') {
        matchStock = p.stockQuantity <= p.minimumStock && p.stockQuantity > 0;
      } else if (stockFilter === 'outOfStock') {
        matchStock = p.stockQuantity <= 0;
      } else if (stockFilter === 'inStock') {
        matchStock = p.stockQuantity > 0;
      }

      return matchQuery && matchCategory && matchBrand && matchColor && matchStock;
    });

    return list.sort((a, b) => {
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
      if (sortBy === 'price_asc') return a.salePrice - b.salePrice;
      if (sortBy === 'price_desc') return b.salePrice - a.salePrice;
      if (sortBy === 'stock_desc') return b.stockQuantity - a.stockQuantity;
      if (sortBy === 'stock_asc') return a.stockQuantity - b.stockQuantity;
      if (sortBy === 'newest') return (b.id || 0) - (a.id || 0);
      return 0;
    });
  }, [products, search, selectedCategory, selectedBrand, selectedColor, stockFilter, sortBy, aiFilter]);

  const toggleSize = (sz: string) => {
    const clean = sz.trim();
    if (!clean) return;
    setFormSizes((prev) => {
      const exists = prev.some((s) => s.toLowerCase() === clean.toLowerCase());
      if (exists) {
        return prev.filter((s) => s.toLowerCase() !== clean.toLowerCase());
      } else {
        return [...prev, clean];
      }
    });
  };

  const handleAddCustomSize = (customVal?: string) => {
    const val = (customVal !== undefined ? customVal : customSizeInput).trim();
    if (!val) return;
    const pieces = val.split(/[,/]+/).map((s) => s.trim()).filter(Boolean);
    setFormSizes((prev) => {
      const next = [...prev];
      for (const piece of pieces) {
        if (!next.some((s) => s.toLowerCase() === piece.toLowerCase())) {
          next.push(piece);
        }
      }
      return next;
    });
    setCustomSizeInput('');
  };

  const openCreateModal = (presetBarcode = '') => {
    setEditingProduct(null);
    setFormName('');
    setFormBarcode(presetBarcode || '');
    setFormBrand('');
    setFormColor('');
    setFormColorHex('');
    setFormSizes([]);
    setCustomSizeInput('');
    setFormCategory(categories[0]?.name || 'Geyim');
    setFormPurchasePrice(0);
    setFormSalePrice(0);
    setFormStockQuantity(10);
    setFormMinimumStock(5);
    setFormSupplier(suppliers[0]?.name || '');
    setFormNotes('');
    setFormImagePath('');
    setCategorySuggestion(null);
    setDescDraft(null);
    setErrorMessage(null);
    setIsFormModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormBarcode(p.barcode || '');
    setFormBrand(p.brand || '');
    setFormColor(p.color || '');
    setFormColorHex(p.colorHex || (p.color ? getColorHex(p.color) : ''));
    const initialSizes = (p.sizes && p.sizes.length > 0)
      ? [...p.sizes]
      : (p.size ? p.size.split(/[,/]+/).map((s) => s.trim()).filter(Boolean) : []);
    setFormSizes(initialSizes);
    setCustomSizeInput('');
    setFormCategory(p.category || (categories[0]?.name ?? 'Geyim'));
    setFormPurchasePrice(p.purchasePrice);
    setFormSalePrice(p.salePrice);
    setFormStockQuantity(p.stockQuantity);
    setFormMinimumStock(p.minimumStock);
    setFormSupplier(p.supplier || '');
    setFormNotes(p.notes || '');
    setFormImagePath(p.imagePath || '');
    setCategorySuggestion(null);
    setDescDraft(null);
    setErrorMessage(null);
    setIsFormModalOpen(true);
  };

  // Feature 3: AI Product Categorization
  const handleSuggestCategory = async () => {
    if (!formName.trim()) {
      setErrorMessage('Kateqoriya təklifi üçün əvvəlcə məhsulun adını daxil edin.');
      return;
    }
    setIsSuggestingCategory(true);
    setCategorySuggestion(null);
    try {
      const existingCategoryNames = categories.map((c) => c.name);
      const res = await aiApi.suggestProductCategory({
        productName: formName,
        existingCategories: existingCategoryNames,
        brand: formBrand,
        color: formColor,
      });
      setCategorySuggestion(res);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Kateqoriya təklif edilərkən xəta baş verdi.');
    } finally {
      setIsSuggestingCategory(false);
    }
  };

  const handleApplySuggestedCategory = () => {
    if (categorySuggestion?.suggestedCategory) {
      const targetCat = categorySuggestion.suggestedCategory;
      if (!categories.some((c) => c.name.toLowerCase() === targetCat.toLowerCase())) {
        addCategory(targetCat);
      }
      setFormCategory(targetCat);
      setCategorySuggestion(null);
    }
  };

  // Feature 2: AI Product Description
  const handleGenerateDescription = async () => {
    if (!formName.trim()) {
      setErrorMessage('Təsvir yaratmaq üçün məhsulun adını daxil edin.');
      return;
    }
    setIsGeneratingDesc(true);
    setDescDraft(null);
    try {
      const res = await aiApi.generateProductDescription({
        name: formName,
        category: formCategory,
        color: formColor,
        brand: formBrand,
        sizes: formSizes,
        salePrice: formSalePrice,
        existingNotes: formNotes,
      });
      setDescDraft(res.description);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Təsvir yaradılarkən xəta baş verdi.');
    } finally {
      setIsGeneratingDesc(false);
    }
  };

  const handleAcceptDescription = () => {
    if (descDraft) {
      setFormNotes(descDraft);
      setDescDraft(null);
    }
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    const existing = byBarcode(code);
    if (existing) {
      setSearch(code);
      setSuccessMessage(`Məhsul tapıldı: ${existing.name}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } else {
      openCreateModal(code);
    }
    setBarcodeInput('');
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const finalSizes = [...formSizes];
      if (customSizeInput.trim()) {
        const more = customSizeInput.split(/[,/]+/).map((s) => s.trim()).filter(Boolean);
        for (const m of more) {
          if (!finalSizes.some((s) => s.toLowerCase() === m.toLowerCase())) {
            finalSizes.push(m);
          }
        }
      }

      saveProduct({
        id: editingProduct?.id,
        name: formName,
        barcode: formBarcode.trim() || undefined,
        brand: formBrand.trim() || undefined,
        color: formColor.trim() || undefined,
        colorHex: formColorHex.trim() || (formColor.trim() ? getColorHex(formColor.trim()) : undefined),
        imagePath: formImagePath.trim() || undefined,
        sizes: finalSizes.length > 0 ? finalSizes : undefined,
        size: finalSizes.length > 0 ? finalSizes.join(', ') : undefined,
        category: formCategory,
        purchasePrice: Number(formPurchasePrice) || 0,
        salePrice: Number(formSalePrice) || 0,
        stockQuantity: Number(formStockQuantity) || 0,
        minimumStock: Number(formMinimumStock) || 0,
        supplier: formSupplier,
        notes: formNotes,
      });

      setIsFormModalOpen(false);
      setSuccessMessage(editingProduct ? 'Məhsul yeniləndi.' : 'Yeni məhsul əlavə edildi.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Xəta baş verdi');
    }
  };

  const handleDelete = (p: Product) => {
    if (window.confirm(`${p.name} adlı məhsulu silmək istədiyinizdən əminsiniz?`)) {
      try {
        deleteProduct(p.id);
        setSuccessMessage('Məhsul silindi.');
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err: any) {
        alert(err.message || 'Silmək mümkün olmadı.');
      }
    }
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTargetProduct) return;
    try {
      adjustStock(adjustTargetProduct.id, Number(adjustAmount), adjustNote);
      setIsAdjustModalOpen(false);
      setSuccessMessage('Stok uğurla dəyişdirildi.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Stok dəyişdirmək mümkün olmadı.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium flex items-center gap-2 shadow-xs">
          <Check className="w-4 h-4 text-emerald-600" />
          {successMessage}
        </div>
      )}

      {/* Top Header & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-600" />
            Mallar və Anbar Kataloqu
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cəmi {products.length} məhsul qeydiyyatdadır
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Quick Barcode Scanner Form */}
          <form onSubmit={handleBarcodeSubmit} className="relative">
            <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Barkod oxut və ya daxil et..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 w-56 font-mono"
            />
          </form>

          <button
            onClick={() => {
              setMovementFilterProduct(null);
              setIsMovementsModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium flex items-center gap-1.5 transition"
          >
            <History className="w-4 h-4 text-slate-500" />
            Hərəkət Tarixçəsi
          </button>

          <button
            onClick={() => openCreateModal()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            Yeni Məhsul
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        {/* 4. AI Natural Language Search */}
        <AiNaturalSearchBar
          activeFilter={aiFilter}
          onApplyFilter={(f) => setAiFilter(f)}
          existingCategories={categories.map((c) => c.name)}
          placeholder="✨ AI Təbii Axtarış: Məs: 'Qara kostyum 52 razmer 150 manatdan aşağı'..."
        />

        {/* Top Filter Controls: Search, Stock Status, Sort, and Reset */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Məhsul adı, barkod, marka, rəng, kateqoriya ilə axtar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Selects & Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Stock Status Selector */}
            <div className="relative">
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value as any)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer outline-hidden ${
                  stockFilter !== 'all'
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <option value="all">Bütün Stoklar</option>
                <option value="inStock">Stokda Var (&gt; 0)</option>
                <option value="lowStock">Yalnız Kritik Stok (≤ Min)</option>
                <option value="outOfStock">Stokda Bitənlər (0)</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="relative flex items-center">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer outline-hidden"
              >
                <option value="newest">Ən yeni əlavə olunan</option>
                <option value="name_asc">Ad (A - Z)</option>
                <option value="name_desc">Ad (Z - A)</option>
                <option value="price_asc">Qiymət (Ucuzdan-Bahaya)</option>
                <option value="price_desc">Qiymət (Bahadan-Ucuza)</option>
                <option value="stock_desc">Stok (Çoxdan-Aza)</option>
                <option value="stock_asc">Stok (Azdan-Çoxa)</option>
              </select>
            </div>

            {/* Reset Filters Button */}
            {activeFiltersCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                title="Bütün aktiv filtrləri sıfırla"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Sıfırla ({activeFiltersCount})
              </button>
            )}

            {/* Filter Count Badge */}
            <span className="px-2.5 py-2 text-xs font-bold text-slate-500 bg-slate-100/80 rounded-xl whitespace-nowrap">
              {filteredProducts.length} / {products.length} məhsul
            </span>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs border-t border-slate-100 pt-2.5">
          <span className="text-slate-400 font-semibold text-[11px] whitespace-nowrap mr-1 flex items-center gap-1">
            Kateqoriya:
          </span>
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Hamısı ({products.length})
          </button>
          {categories.map((c) => {
            const count = products.filter((p) => p.category === c.name).length;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.name)}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === c.name
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {c.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Brand (Marka) Filter Bar */}
        {existingBrands.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs border-t border-slate-100 pt-2.5">
            <span className="text-slate-400 font-semibold text-[11px] mr-1 flex items-center gap-1 shrink-0">
              <Tag className="w-3 h-3 text-slate-400" />
              Marka:
            </span>
            <button
              onClick={() => setSelectedBrand('all')}
              className={`px-2.5 py-1 rounded-md font-bold whitespace-nowrap transition text-xs cursor-pointer ${
                selectedBrand === 'all'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Bütün Markalar
            </button>
            {existingBrands.map(([brand, count]) => (
              <button
                key={brand}
                onClick={() => setSelectedBrand(brand)}
                className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition text-xs cursor-pointer flex items-center gap-1 ${
                  selectedBrand === brand
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{brand}</span>
                <span className={`text-[10px] px-1 rounded-full ${selectedBrand === brand ? 'bg-blue-700 text-white' : 'bg-slate-200/80 text-slate-500'}`}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Color (Rəng) Filter Bar */}
        {existingColors.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs border-t border-slate-100 pt-2.5">
            <span className="text-slate-400 font-semibold text-[11px] mr-1 flex items-center gap-1 shrink-0">
              <Palette className="w-3 h-3 text-indigo-500" />
              Rəng:
            </span>
            <button
              onClick={() => setSelectedColor('all')}
              className={`px-2.5 py-1 rounded-md font-bold whitespace-nowrap transition text-xs cursor-pointer ${
                selectedColor === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Bütün Rənglər
            </button>
            {existingColors.map(({ color, count, hex }) => {
              const isSelected = selectedColor.toLowerCase() === color.toLowerCase();
              return (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition text-xs cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs font-bold ring-2 ring-indigo-300'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-slate-300 shrink-0"
                    style={{ backgroundColor: hex }}
                  />
                  <span>{color}</span>
                  <span
                    className={`text-[10px] px-1 rounded-full ${
                      isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-xs font-semibold text-slate-500">
                <th className="py-3 px-4">Məhsul Adı</th>
                <th className="py-3 px-3">Barkod</th>
                <th className="py-3 px-3">Marka</th>
                <th className="py-3 px-3">Ölçü</th>
                <th className="py-3 px-3">Rəng</th>
                <th className="py-3 px-3">Kateqoriya</th>
                <th className="py-3 px-3 text-right">Alış Qiyməti</th>
                <th className="py-3 px-3 text-right">Satış Qiyməti</th>
                <th className="py-3 px-3 text-center">Mövcud Stok</th>
                <th className="py-3 px-3 text-center">Min. Hədd</th>
                <th className="py-3 px-3">Təchizatçı</th>
                <th className="py-3 px-4 text-right">Əməliyyatlar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm">Axtarışa uyğun məhsul tapılmadı.</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isLow = p.stockQuantity <= p.minimumStock;
                  const isZero = p.stockQuantity <= 0;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition group">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          {p.imagePath ? (
                            <img
                              src={p.imagePath}
                              alt={p.name}
                              className="w-9 h-9 rounded-lg object-contain bg-slate-50 border border-slate-200 shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                              <Package className="w-4.5 h-4.5 text-slate-300" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="truncate">{p.name}</div>
                            {p.notes && <p className="text-xs text-slate-400 font-normal truncate max-w-xs">{p.notes}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-xs text-slate-600">
                        {p.barcode || '—'}
                      </td>
                      <td className="py-3 px-3">
                        {p.brand ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100/60">
                            {p.brand}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {(p.sizes && p.sizes.length > 0) || p.size ? (
                          <div className="flex items-center gap-1 flex-wrap max-w-[190px]">
                            {(p.sizes && p.sizes.length > 0
                              ? p.sizes
                              : (p.size?.split(/[,/]+/).map((s) => s.trim()).filter(Boolean) || [])
                            ).map((sz) => (
                              <span
                                key={sz}
                                className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-800 text-[11px] font-black border border-indigo-200 shadow-2xs"
                              >
                                {sz}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {p.color ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-slate-300 shrink-0 shadow-2xs"
                              style={{ backgroundColor: getColorHex(p.color, p.colorHex) }}
                            />
                            {p.color}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs">
                          {p.category}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600 font-medium">
                        {p.purchasePrice.toFixed(2)} {setting.currency}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-900 font-bold">
                        {p.salePrice.toFixed(2)} {setting.currency}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isZero
                              ? 'bg-rose-100 text-rose-700'
                              : isLow
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {p.stockQuantity} ədəd
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center text-xs text-slate-400">
                        {p.minimumStock}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-500 truncate max-w-[120px]">
                        {p.supplier || '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Adjust Stock Button */}
                          <button
                            title="Stok düzəlişi et"
                            onClick={() => {
                              setAdjustTargetProduct(p);
                              setAdjustAmount(0);
                              setAdjustNote('');
                              setIsAdjustModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                          >
                            <Sliders className="w-4 h-4" />
                          </button>

                          {/* Movements Log for this product */}
                          <button
                            title="Hərəkət tarixçəsi"
                            onClick={() => {
                              setMovementFilterProduct(p);
                              setIsMovementsModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition"
                          >
                            <History className="w-4 h-4" />
                          </button>

                          {/* Edit Button */}
                          <button
                            title="Redaktə et"
                            onClick={() => openEditModal(p)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete Button */}
                          <button
                            title="Məhsulu sil"
                            onClick={() => handleDelete(p)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-base">
                {editingProduct ? 'Məhsul Məlumatlarını Redaktə Et' : 'Yeni Məhsul Əlavə Et'}
              </h3>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4 overflow-y-auto">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                  {errorMessage}
                </div>
              )}

              {/* 1. AI Product Image Banner & Controls */}
              <div className="p-3.5 bg-gradient-to-r from-indigo-50/60 via-slate-50 to-purple-50/50 rounded-2xl border border-indigo-100/80 flex items-center gap-3.5">
                <div className="w-16 h-16 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs relative">
                  {formImagePath ? (
                    <img
                      src={formImagePath}
                      alt={formName || 'Məhsul'}
                      className="w-full h-full object-contain p-1"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <ImageIcon className="w-7 h-7 text-slate-300" />
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>E-Ticarət Məhsul Şəkli</span>
                    </span>
                    {formImagePath && (
                      <button
                        type="button"
                        onClick={() => setFormImagePath('')}
                        className="text-[11px] text-rose-600 hover:underline font-semibold cursor-pointer"
                      >
                        Şəkli Sil
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-1">
                    {formImagePath
                      ? 'Şəkil təyin edilib. Yeniləmək üçün aşağıdakı düyməyə klikləyin.'
                      : 'Məhsul adı, kateqoriya və rəng əsasında peşəkar studiya şəkli yaradın.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (!formName.trim()) {
                        setErrorMessage('Əvvəlcə məhsulun adını daxil edin.');
                        return;
                      }
                      setIsImageModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{formImagePath ? 'AI ilə Yenidən Yarat' : '✨ AI ilə Şəkil Yarat'}</span>
                  </button>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Məhsul Adı <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Məs: Qara İpək Köynək Slim Fit"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Barcode & Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Barcode className="w-3.5 h-3.5 text-blue-600" />
                    <span>Barkod</span>
                  </label>
                  <input
                    type="text"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    placeholder="Skanerlə oxudun və ya daxil edin"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    İstəyə görə (yoxdursa boş buraxa bilərsiniz)
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Kateqoriya</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSuggestCategory}
                        disabled={isSuggestingCategory}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                        title="AI ilə uyğun kateqoriyanı təyin et"
                      >
                        {isSuggestingCategory ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3 text-indigo-600" />
                        )}
                        <span>AI Təklif Et</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddCategoryInput(!showAddCategoryInput)}
                        className="text-[10px] text-blue-600 font-semibold hover:underline"
                      >
                        + Yeni
                      </button>
                    </div>
                  </div>

                  {/* 3. AI Category Suggestion Banner */}
                  {categorySuggestion && (
                    <div className="mb-2 p-2 bg-indigo-50 border border-indigo-200 rounded-xl text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-indigo-900 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-indigo-600" />
                          Təklif: "{categorySuggestion.suggestedCategory}"
                        </span>
                        <span className="text-[10px] text-indigo-600 font-mono">
                          {Math.round(categorySuggestion.confidence * 100)}%
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600">{categorySuggestion.reasoning}</p>
                      <div className="flex items-center gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={handleApplySuggestedCategory}
                          className="px-2 py-0.5 bg-indigo-600 text-white rounded font-bold text-[11px] shadow-2xs hover:bg-indigo-700 cursor-pointer"
                        >
                          ✓ Tətbiq Et
                        </button>
                        <button
                          type="button"
                          onClick={() => setCategorySuggestion(null)}
                          className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          Ləğv et
                        </button>
                      </div>
                    </div>
                  )}

                  {showAddCategoryInput ? (
                    <div className="flex gap-1">
                      <input
                        type="text"
                        placeholder="Yeni ad..."
                        value={newCategoryInput}
                        onChange={(e) => setNewCategoryInput(e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newCategoryInput.trim()) {
                            addCategory(newCategoryInput.trim());
                            setFormCategory(newCategoryInput.trim());
                            setNewCategoryInput('');
                            setShowAddCategoryInput(false);
                          }
                        }}
                        className="px-2 bg-blue-600 text-white rounded-lg text-xs"
                      >
                        ✓
                      </button>
                    </div>
                  ) : (
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Brand & Color */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50/60 rounded-xl border border-slate-200/70">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-blue-600" />
                    Brand / Marka
                  </label>
                  <input
                    type="text"
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    placeholder="Məs: Milla, Sirab, Apple..."
                    list="brand-datalist"
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                  />
                  <datalist id="brand-datalist">
                    {existingBrands.map(([b]) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                  {existingBrands.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {existingBrands.slice(0, 4).map(([b]) => (
                        <button
                          type="button"
                          key={b}
                          onClick={() => setFormBrand(b)}
                          className={`text-[10px] px-1.5 py-0.5 rounded transition ${
                            formBrand.trim().toLowerCase() === b.toLowerCase()
                              ? 'bg-blue-600 text-white font-medium'
                              : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300'
                          }`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Palette className="w-3.5 h-3.5 text-indigo-600" />
                      Rəng və Rəng Simvolu
                    </label>
                    {formColorHex && (
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        {formColorHex}
                      </span>
                    )}
                  </div>

                  {/* Visual Color Symbol Button + Custom Name Input */}
                  <div className="flex items-center gap-2">
                    <div className="relative group shrink-0" title="Rəng çarxını açmaq və istənilən çaları seçmək üçün klikləyin">
                      <label
                        htmlFor="color-symbol-picker"
                        className="w-10 h-10 rounded-xl border-2 border-slate-300 flex items-center justify-center cursor-pointer shadow-xs hover:scale-105 active:scale-95 transition overflow-hidden relative"
                        style={{ backgroundColor: formColorHex || getColorHex(formColor) || '#2563EB' }}
                      >
                        <span className="sr-only">Rəng simvolu seç</span>
                        <span className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                          <Palette className="w-4 h-4 text-white drop-shadow" />
                        </span>
                      </label>
                      <input
                        id="color-symbol-picker"
                        type="color"
                        value={formColorHex || getColorHex(formColor) || '#2563EB'}
                        onChange={(e) => setFormColorHex(e.target.value)}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      />
                    </div>

                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={formColor}
                        onChange={(e) => setFormColor(e.target.value)}
                        placeholder="Rəng adı daxil edin (məs: Marin, Göy, Bej...)"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    {(formColor || formColorHex) && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormColor('');
                          setFormColorHex('');
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                        title="Rəngi sıfırla"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Hint explaining custom color symbol selection */}
                  <p className="text-[11px] text-slate-500 leading-tight">
                    💡 Soldakı rəng simvolunu və ya aşağıdakı palitranı seçib adını istədiyiniz kimi dəyişə bilərsiniz (məsələn: mavi simvolu seçib adını <strong className="text-blue-700">"Marin"</strong> yaza bilərsiniz).
                  </p>

                  {/* Color Swatches Grid */}
                  <div className="pt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Sürətli rəng simvolları:
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-[110px] overflow-y-auto pr-1">
                      {COLOR_SWATCHES.map((swatch) => {
                        const activeHex = formColorHex || getColorHex(formColor);
                        const isCurrentSymbol = activeHex.toLowerCase() === swatch.hex.toLowerCase();

                        return (
                          <button
                            type="button"
                            key={swatch.name}
                            onClick={() => {
                              setFormColorHex(swatch.hex);
                              // If color name is empty, or matches a preset name, set it. Otherwise preserve custom name!
                              if (!formColor.trim()) {
                                // For 'Mavi (Marin)', clean name to Marin or swatch name
                                const cleanedName = swatch.name.includes('Marin') ? 'Marin' : swatch.name;
                                setFormColor(cleanedName);
                              }
                            }}
                            className={`px-2 py-1 rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer border ${
                              isCurrentSymbol
                                ? 'border-indigo-600 ring-2 ring-indigo-200 bg-indigo-50/70 font-bold text-indigo-950'
                                : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-slate-300 shrink-0 shadow-2xs"
                              style={{ backgroundColor: swatch.hex }}
                            />
                            <span className="text-[11px]">{swatch.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Multi-Size Selection for Single Product */}
              <div className="p-3.5 bg-indigo-50/40 rounded-xl border border-indigo-100 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="text-indigo-700">Ölçülər</span>
                      <span className="text-slate-500 font-normal">(Məhsulun mövcud olan bütün ölçüləri)</span>
                    </label>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Bir məhsulda bir neçə ölçü (məs: XS, S, M, L, XL) qeyd edin. Satışda konkret ölçü seçiləcək.
                    </p>
                  </div>
                  
                  {/* Preset Quick Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const standardClothing = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
                        setFormSizes((prev) => {
                          const allSelected = standardClothing.every((sc) => prev.includes(sc));
                          if (allSelected) {
                            return prev.filter((s) => !standardClothing.includes(s));
                          }
                          const next = [...prev];
                          standardClothing.forEach((sc) => {
                            if (!next.includes(sc)) next.push(sc);
                          });
                          return next;
                        });
                      }}
                      className="px-2 py-1 bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold transition cursor-pointer"
                    >
                      + Geyim (XS-XXL)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const shoes = ['36', '37', '38', '39', '40', '41', '42', '43', '44'];
                        setFormSizes((prev) => {
                          const allSelected = shoes.every((sh) => prev.includes(sh));
                          if (allSelected) {
                            return prev.filter((s) => !shoes.includes(s));
                          }
                          const next = [...prev];
                          shoes.forEach((sh) => {
                            if (!next.includes(sh)) next.push(sh);
                          });
                          return next;
                        });
                      }}
                      className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold transition cursor-pointer"
                    >
                      + Ayaqqabı (36-44)
                    </button>
                    {formSizes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setFormSizes([])}
                        className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-[11px] font-bold transition cursor-pointer"
                      >
                        Sıfırla
                      </button>
                    )}
                  </div>
                </div>

                {/* Selected Sizes Badges Display */}
                {formSizes.length > 0 ? (
                  <div className="flex items-center gap-1.5 flex-wrap p-2.5 bg-white rounded-xl border border-indigo-200 shadow-2xs">
                    <span className="text-[11px] font-bold text-slate-600 mr-1">
                      Seçilən ölçülər ({formSizes.length}):
                    </span>
                    {formSizes.map((sz) => (
                      <span
                        key={sz}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-black shadow-2xs animate-in fade-in"
                      >
                        <span>{sz}</span>
                        <button
                          type="button"
                          onClick={() => toggleSize(sz)}
                          className="hover:bg-indigo-700 rounded-full p-0.5 transition cursor-pointer"
                          title="Ölçünü sil"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="p-2 bg-white/70 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                    Heç bir ölçü seçilməyib. Aşağıdakı düymələrə klikləyərək və ya yazaraq ölçüləri əlavə edin.
                  </div>
                )}

                {/* Custom Size Input Field */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customSizeInput}
                    onChange={(e) => setCustomSizeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomSize();
                      }
                    }}
                    placeholder="Xüsusi ölçü yazın və ya vergüllə bir neçə qeyd edin (məs: 46, 48, Standart)..."
                    className="flex-1 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddCustomSize()}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shrink-0 shadow-2xs"
                  >
                    + Əlavə et
                  </button>
                </div>

                {/* Clickable Quick Size Presets Chips */}
                <div className="pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Ölçüyə klikləyərək seçin / ləğv edin:
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap max-h-[90px] overflow-y-auto pr-1">
                    {CLOTHING_SIZE_PRESETS.map((sz) => {
                      const isSelected = formSizes.some((s) => s.toLowerCase() === sz.toLowerCase());
                      return (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => toggleSize(sz)}
                          className={`text-xs px-2.5 py-1 rounded-lg font-bold transition border cursor-pointer flex items-center gap-1 ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                          <span>{sz}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Purchase & Sale Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Alış Qiyməti ({setting.currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formPurchasePrice}
                    onChange={(e) => setFormPurchasePrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Satış Qiyməti ({setting.currency}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formSalePrice}
                    onChange={(e) => setFormSalePrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Stock Quantity & Minimum Stock */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    İlkin / Cari Stok Miqdarı
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formStockQuantity}
                    onChange={(e) => setFormStockQuantity(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Minimum Stok Xəbərdarlığı
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formMinimumStock}
                    onChange={(e) => setFormMinimumStock(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Supplier Dropdown */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Təchizatçı</label>
                  <button
                    type="button"
                    onClick={() => setShowAddSupplierInput(!showAddSupplierInput)}
                    className="text-[10px] text-blue-600 font-semibold hover:underline"
                  >
                    + Yeni Təchizatçı
                  </button>
                </div>
                {showAddSupplierInput ? (
                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="Təchizatçı şirkət adı..."
                      value={newSupplierInput}
                      onChange={(e) => setNewSupplierInput(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newSupplierInput.trim()) {
                          addSupplier(newSupplierInput.trim());
                          setFormSupplier(newSupplierInput.trim());
                          setNewSupplierInput('');
                          setShowAddSupplierInput(false);
                        }
                      }}
                      className="px-2 bg-blue-600 text-white rounded-lg text-xs"
                    >
                      ✓
                    </button>
                  </div>
                ) : (
                  <select
                    value={formSupplier}
                    onChange={(e) => setFormSupplier(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seçilməyib</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 2. Notes & AI Product Description */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">Qeydlər və Təsvir</label>
                  <button
                    type="button"
                    onClick={handleGenerateDescription}
                    disabled={isGeneratingDesc}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {isGeneratingDesc ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3 text-indigo-600" />
                    )}
                    <span>✨ AI Təsvir Yarat</span>
                  </button>
                </div>

                {/* AI Description Draft Preview (Editable & Acceptable) */}
                {descDraft !== null && (
                  <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-900 flex items-center gap-1 text-[11px]">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        AI Təsvir Qaralaması (redaktə edə və qəbul edə bilərsiniz):
                      </span>
                      <button
                        type="button"
                        onClick={() => setDescDraft(null)}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={descDraft}
                      onChange={(e) => setDescDraft(e.target.value)}
                      className="w-full p-2 bg-white border border-indigo-200 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAcceptDescription}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-2xs cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        <span>Qəbul Et və Qeydə Keçir</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDescDraft(null)}
                        className="px-2.5 py-1 text-slate-500 hover:text-slate-700 text-xs cursor-pointer"
                      >
                        Ləğv Et
                      </button>
                    </div>
                  </div>
                )}

                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Məhsul haqqında əlavə qeydlər və ya AI tərəfindən yaradılmış təsvir..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Ləğv et
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-600/20 transition"
                >
                  Yadda saxla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. AI Product Image Modal */}
      <AiProductImageModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        onUseImage={(url: string) => setFormImagePath(url)}
        currentImage={formImagePath}
        initialName={formName}
        category={formCategory}
        color={formColor}
        brand={formBrand}
        notes={formNotes}
      />

      {/* Stock Adjustment Modal */}
      {isAdjustModalOpen && adjustTargetProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-base">Stok Düzəlişi</h3>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="font-bold text-sm text-slate-900">{adjustTargetProduct.name}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Mövcud Stok: <span className="font-semibold text-slate-800">{adjustTargetProduct.stockQuantity} ədəd</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Düzəliş Miqdarı (+ artırmaq, - azaltmaq üçün)
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Yeni stok olacaq:{' '}
                  <span className="font-bold text-blue-600">
                    {adjustTargetProduct.stockQuantity + Number(adjustAmount)} ədəd
                  </span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Düzəliş Səbəbi / Qeyd</label>
                <input
                  type="text"
                  placeholder="Məs: Sayım nəticəsi, Zədələnmiş mal, Hədiyyə..."
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Bağla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-600/20 transition"
                >
                  Stoku Tətbiq Et
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Movements Log Modal */}
      {isMovementsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">
                  Stok Hərəkətləri Tarixçəsi
                  {movementFilterProduct && ` (${movementFilterProduct.name})`}
                </h3>
                <p className="text-xs text-slate-400">Giriş, çıxış, satış və düzəliş qeydləri</p>
              </div>
              <button
                onClick={() => setIsMovementsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {movements.length === 0 ? (
                <div className="p-8 text-center text-slate-400">Hərəkət qeydi yoxdur.</div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold">
                      <th className="py-2.5 px-3">Tarix</th>
                      <th className="py-2.5 px-3">Məhsul</th>
                      <th className="py-2.5 px-3 text-center">Növ</th>
                      <th className="py-2.5 px-3 text-right">Dəyişim</th>
                      <th className="py-2.5 px-3 text-center">Əvvəlki → Yeni</th>
                      <th className="py-2.5 px-3">Qeyd</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movements
                      .filter((m) => !movementFilterProduct || m.productId === movementFilterProduct.id)
                      .slice(0, 100)
                      .map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                            {new Date(m.date).toLocaleString('az-AZ', {
                              day: '2-digit',
                              month: '2-digit',
                              year: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {m.productName}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full font-semibold ${
                                m.type === 'Satış'
                                  ? 'bg-blue-100 text-blue-700'
                                  : m.type === 'Alış'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : m.type === 'Qaytarma'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {m.type}
                            </span>
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-bold ${
                              m.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-600">
                            {m.previousStock} → <span className="font-semibold text-slate-900">{m.newStock}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">{m.notes || '—'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
