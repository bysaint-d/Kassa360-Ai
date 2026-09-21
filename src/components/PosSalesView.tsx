import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ShoppingCart,
  Barcode,
  Search,
  Plus,
  Minus,
  Trash2,
  Receipt,
  CreditCard,
  Banknote,
  UserCheck,
  RotateCcw,
  Printer,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  History,
  Tag,
  Palette,
  MessageSquare,
  Edit2,
  Edit,
  Layers,
  Sparkles,
  Bot,
} from 'lucide-react';
import { Product, CartRow, Sale, ProductVariant } from '../types';
import { useStore } from '../context/StoreContext';
import { ReceiptModal } from './ReceiptModal';
import { EditSaleModal } from './EditSaleModal';
import { calculateCartRow, calculateCartTotals, roundMoney, getColorHex, CLOTHING_SIZE_PRESETS } from '../utils/calculations';
import { AiNaturalSearchBar } from './AiNaturalSearchBar';
import { AiSellerAssistantModal } from './AiSellerAssistantModal';
import { StructuredSearchFilter } from '../services/aiApi';

interface PosSalesViewProps {
  onOpenNewProduct?: (barcode: string) => void;
}

const QUICK_ITEM_COMMENTS = [
  'Müştəri sabah gəlib götürəcək',
  'Xırda düyməsi çatışmır',
  'Dəyişdirilmə üçün ayrılıb',
  'Qüsurlu - endirimlə satıldı',
  'Hədiyyəlik bağlama',
  'Ölçü dəyişimi edilə bilər (3 gün)',
];

export const PosSalesView: React.FC<PosSalesViewProps> = ({ onOpenNewProduct }) => {
  const {
    products,
    sales,
    categories,
    setting,
    completeSale,
    returnSale,
    deleteSale,
    byBarcode,
  } = useStore();

  const [activeSubTab, setActiveSubTab] = useState<'kassa' | 'tarixce'>('kassa');

  // Barcode & Catalog State
  const [barcodeInput, setBarcodeInput] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [aiFilter, setAiFilter] = useState<StructuredSearchFilter | null>(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  // Cart State
  const [cart, setCart] = useState<CartRow[]>([]);
  const [openDiscountId, setOpenDiscountId] = useState<string | null>(null);
  const [editingCommentCartItemId, setEditingCommentCartItemId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState<string>('');
  const [variantModalProduct, setVariantModalProduct] = useState<Product | null>(null);
  const [sizeModalProduct, setSizeModalProduct] = useState<Product | null>(null);
  const [customSizeModalInput, setCustomSizeModalInput] = useState('');

  // Cart item inline size editing
  const [editingSizeCartItemId, setEditingSizeCartItemId] = useState<string | null>(null);
  const [sizeText, setSizeText] = useState('');

  // Global Cart Discount State (Monetary AZN amount only)
  const [discount, setDiscount] = useState<number | ''>(''); // AZN

  const [paidAmount, setPaidAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<'Nağd' | 'Kart' | 'Borc'>('Nağd');
  const [partialPaymentMethod, setPartialPaymentMethod] = useState<'Nağd' | 'Kart'>('Nağd');
  const [customerName, setCustomerName] = useState('');
  const [saleNotes, setSaleNotes] = useState('');

  // Default and extracted quick customers
  const defaultQuickCustomers = ['Elmir', 'Rəşad Əliyev', 'Aysel Məmmədova', 'Samir Quliyev', 'Leyla Həsənova'];
  const previousCustomerNames = useMemo(() => {
    const existing = sales
      .map((s) => s.customerName?.trim())
      .filter((name): name is string => Boolean(name && name.length > 0));
    const combined = Array.from(new Set([...defaultQuickCustomers, ...existing]));
    return combined.slice(0, 7);
  }, [sales]);

  // Receipt Modal State
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Edit Sale Modal State
  const [saleToEdit, setSaleToEdit] = useState<Sale | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Delete & Return confirmation modal states (in-app safe, no blocked window.confirm)
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);
  const [deleteRestoreStock, setDeleteRestoreStock] = useState(true);
  const [saleToReturn, setSaleToReturn] = useState<Sale | null>(null);

  // History expandable row state
  const [expandedHistorySaleId, setExpandedHistorySaleId] = useState<number | null>(null);

  // Notifications
  const [posError, setPosError] = useState<string | null>(null);
  const [posSuccess, setPosSuccess] = useState<string | null>(null);

  // Barcode live dropdown state & outside click handler
  const [isBarcodeDropdownOpen, setIsBarcodeDropdownOpen] = useState(false);
  const barcodeBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (barcodeBoxRef.current && !barcodeBoxRef.current.contains(e.target as Node)) {
        setIsBarcodeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Real-time suggestions when typing in barcode field
  const barcodeSuggestions = useMemo(() => {
    const term = barcodeInput.trim().toLowerCase();
    if (!term) return [];

    const exactBarcodeMatches: Product[] = [];
    const startsWithBarcodeMatches: Product[] = [];
    const containsBarcodeMatches: Product[] = [];
    const otherMatches: Product[] = [];

    for (const p of products) {
      const code = (p.barcode || '').trim().toLowerCase();
      const name = p.name.toLowerCase();
      const brand = (p.brand || '').toLowerCase();
      const color = (p.color || '').toLowerCase();

      if (code && code === term) {
        exactBarcodeMatches.push(p);
      } else if (code && code.startsWith(term)) {
        startsWithBarcodeMatches.push(p);
      } else if (code && code.includes(term)) {
        containsBarcodeMatches.push(p);
      } else if (name.includes(term) || brand.includes(term) || color.includes(term)) {
        otherMatches.push(p);
      }
    }

    return [
      ...exactBarcodeMatches,
      ...startsWithBarcodeMatches,
      ...containsBarcodeMatches,
      ...otherMatches,
    ].slice(0, 8);
  }, [products, barcodeInput]);

  // Sales history filter
  const [historySearch, setHistorySearch] = useState('');

  // Focus barcode input on mount
  useEffect(() => {
    if (activeSubTab === 'kassa') {
      barcodeInputRef.current?.focus();
    }
  }, [activeSubTab]);

  // Subtotal of cart after individual item discounts
  const subtotalAfterItemDiscounts = useMemo(() => {
    return roundMoney(cart.reduce((acc, row) => acc + row.total, 0));
  }, [cart]);

  // Determine effective global discount in currency (AZN)
  const effectiveGlobalDiscountAmount = useMemo(() => {
    return typeof discount === 'number' ? Math.max(0, discount) : 0;
  }, [discount]);

  // Centralized cart financial totals
  const cartTotals = useMemo(() => {
    return calculateCartTotals(cart, effectiveGlobalDiscountAmount);
  }, [cart, effectiveGlobalDiscountAmount]);

  const subtotal = cartTotals.grossSubtotal;
  const total = cartTotals.finalTotal;
  const discountNum = cartTotals.globalDiscountAmount;
  const paidNum = typeof paidAmount === 'number' ? paidAmount : 0;
  const change = paymentMethod === 'Borc' ? 0 : Math.max(0, roundMoney(paidNum - total));
  const debt = paymentMethod === 'Borc' ? Math.max(0, roundMoney(total - paidNum)) : 0;

  // Add product to cart with optional variant, comment, and customSize
  const addToCart = (
    product: Product,
    variant?: {
      id?: string;
      size?: string;
      color?: string;
      colorHex?: string;
    },
    comment?: string,
    customSize?: string
  ) => {
    setPosError(null);
    if (product.stockQuantity <= 0 && !setting.allowNegativeStock) {
      setPosError(`${product.name} stokda qalmayıb!`);
      return;
    }

    const resolvedVariantSize = variant?.size || (product.variants && product.variants.length > 0 ? product.variants[0].size : undefined);

    let selectedSize: string | undefined = undefined;
    if (customSize !== undefined && customSize.trim()) {
      selectedSize = customSize.trim();
    } else if (resolvedVariantSize) {
      selectedSize = resolvedVariantSize;
    } else if (product.sizes && product.sizes.length === 1) {
      selectedSize = product.sizes[0];
    } else if (product.size && !product.size.includes(',') && !product.size.includes('/')) {
      selectedSize = product.size.trim();
    }

    const selectedColor = variant?.color || (product.variants && product.variants.length > 0 ? product.variants[0].color : product.color);
    const selectedColorHex = variant?.colorHex || (product.variants && product.variants.length > 0 ? product.variants[0].colorHex : product.colorHex);
    const selectedVariantId = variant?.id || (product.variants && product.variants.length > 0 ? product.variants[0].id : undefined);

    const cartItemId = `${product.id}_${selectedVariantId || ''}_${selectedSize || ''}_${selectedColor || ''}`;

    setCart((prev) => {
      const existing = prev.find((r) => r.cartItemId === cartItemId);
      if (existing) {
        if (existing.quantity + 1 > product.stockQuantity && !setting.allowNegativeStock) {
          setPosError(`${product.name} üçün maksimum stok: ${product.stockQuantity}`);
          return prev;
        }
        const newQty = existing.quantity + 1;
        const currentDiscount = existing.discountAmount || 0;
        const calc = calculateCartRow(product, newQty, currentDiscount);
        return prev.map((r) =>
          r.cartItemId === cartItemId
            ? {
                ...r,
                quantity: calc.quantity,
                originalPrice: calc.originalPrice,
                discountAmount: calc.discountAmount,
                discountPercent: calc.discountPercent,
                discountedUnitPrice: calc.discountedUnitPrice,
                total: calc.total,
                comment: comment !== undefined ? comment : r.comment,
              }
            : r
        );
      } else {
        const calc = calculateCartRow(product, 1, 0);
        return [
          ...prev,
          {
            cartItemId,
            product,
            selectedVariantId,
            selectedSize,
            selectedColor,
            selectedColorHex,
            comment: comment || '',
            quantity: calc.quantity,
            originalPrice: calc.originalPrice,
            discountAmount: calc.discountAmount,
            discountPercent: calc.discountPercent,
            discountedUnitPrice: calc.discountedUnitPrice,
            total: calc.total,
          },
        ];
      }
    });

    if (paymentMethod !== 'Borc' && (paidAmount === '' || paidAmount === total || paidNum === 0)) {
      setPaidAmount(roundMoney(total + product.salePrice));
    }
  };

  const updateCartQuantity = (cartItemId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(cartItemId);
      return;
    }

    setCart((prev) => {
      const item = prev.find((r) => r.cartItemId === cartItemId);
      if (!item) return prev;
      if (qty > item.product.stockQuantity && !setting.allowNegativeStock) {
        setPosError(`${item.product.name} üçün mövcud stok: ${item.product.stockQuantity}`);
        return prev;
      }
      const calc = calculateCartRow(item.product, qty, item.discountAmount || 0);
      return prev.map((r) =>
        r.cartItemId === cartItemId
          ? {
              ...r,
              quantity: calc.quantity,
              originalPrice: calc.originalPrice,
              discountAmount: calc.discountAmount,
              discountPercent: calc.discountPercent,
              discountedUnitPrice: calc.discountedUnitPrice,
              total: calc.total,
            }
          : r
      );
    });
  };

  // Update item-level discount in AZN (currency amount)
  const updateCartItemDiscount = (cartItemId: string, discountAmountAzn: number) => {
    setCart((prev) =>
      prev.map((r) => {
        if (r.cartItemId !== cartItemId) return r;
        const maxPrice = r.product.salePrice;
        const clamped = Math.max(0, Math.min(maxPrice, roundMoney(Number(discountAmountAzn) || 0)));
        const calc = calculateCartRow(r.product, r.quantity, clamped);
        return {
          ...r,
          originalPrice: calc.originalPrice,
          discountAmount: calc.discountAmount,
          discountPercent: calc.discountPercent,
          discountedUnitPrice: calc.discountedUnitPrice,
          total: calc.total,
        };
      })
    );
  };

  const updateCartItemComment = (cartItemId: string, comment: string) => {
    setCart((prev) =>
      prev.map((r) => (r.cartItemId === cartItemId ? { ...r, comment } : r))
    );
  };

  const updateCartItemSize = (cartItemId: string, newSize: string) => {
    const trimmedSize = newSize.trim();
    setCart((prev) => {
      const item = prev.find((r) => r.cartItemId === cartItemId);
      if (!item) return prev;

      const newCartItemId = `${item.product.id}_${item.selectedVariantId || ''}_${trimmedSize}_${item.selectedColor || ''}`;

      // If another item in the cart already has this exact same size, combine them!
      const existingOther = prev.find((r) => r.cartItemId === newCartItemId && r.cartItemId !== cartItemId);
      if (existingOther) {
        const combinedQty = existingOther.quantity + item.quantity;
        const calc = calculateCartRow(item.product, combinedQty, (existingOther.discountAmount || 0) + (item.discountAmount || 0));
        return prev
          .filter((r) => r.cartItemId !== cartItemId)
          .map((r) =>
            r.cartItemId === newCartItemId
              ? {
                  ...r,
                  quantity: calc.quantity,
                  originalPrice: calc.originalPrice,
                  discountAmount: calc.discountAmount,
                  discountPercent: calc.discountPercent,
                  discountedUnitPrice: calc.discountedUnitPrice,
                  total: calc.total,
                  selectedSize: trimmedSize,
                }
              : r
          );
      }

      return prev.map((r) => {
        if (r.cartItemId !== cartItemId) return r;
        return {
          ...r,
          cartItemId: newCartItemId,
          selectedSize: trimmedSize || undefined,
        };
      });
    });
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((r) => r.cartItemId !== cartItemId));
    if (openDiscountId === cartItemId) setOpenDiscountId(null);
    if (editingCommentCartItemId === cartItemId) setEditingCommentCartItemId(null);
    if (editingSizeCartItemId === cartItemId) setEditingSizeCartItemId(null);
  };

  const clearCart = () => {
    setCart([]);
    setDiscount('');
    setPaidAmount('');
    setCustomerName('');
    setSaleNotes('');
    setOpenDiscountId(null);
    setEditingCommentCartItemId(null);
    setEditingSizeCartItemId(null);
    setPosError(null);
  };

  // Barcode submit / enter press
  const handleBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    // 1. Check exact barcode match first
    let product = products.find(
      (p) => p.barcode && p.barcode.trim().toLowerCase() === code.toLowerCase()
    );

    // Check if barcode belongs to a product variant!
    let matchingVariant: { id?: string; size?: string; color?: string; colorHex?: string } | undefined;
    if (!product) {
      for (const p of products) {
        if (p.variants && p.variants.length > 0) {
          const v = p.variants.find((v) => v.barcode && v.barcode.trim().toLowerCase() === code.toLowerCase());
          if (v) {
            product = p;
            matchingVariant = { id: v.id, size: v.size, color: v.color, colorHex: v.colorHex };
            break;
          }
        }
      }
    }

    // 2. If not exact, pick the top match from suggestions
    if (!product && barcodeSuggestions.length > 0) {
      product = barcodeSuggestions[0];
    }

    if (product) {
      addToCart(product, matchingVariant);
      setPosSuccess(`${product.name}${matchingVariant?.size ? ` (${matchingVariant.size})` : ''} səbətə əlavə edildi`);
      setTimeout(() => setPosSuccess(null), 2500);
      setBarcodeInput('');
      setIsBarcodeDropdownOpen(false);
      barcodeInputRef.current?.focus();
    } else {
      if (onOpenNewProduct) {
        if (window.confirm(`'${code}' üzrə məhsul tapılmadı. Yeni məhsul kimi qeydiyyatdan keçirilsin?`)) {
          onOpenNewProduct(code);
        }
      } else {
        setPosError(`'${code}' üzrə heç bir məhsul tapılmadı!`);
      }
    }
  };

  // Scroll categories left/right
  const handleScrollCategories = (direction: 'left' | 'right') => {
    if (categoryScrollRef.current) {
      categoryScrollRef.current.scrollBy({
        left: direction === 'left' ? -180 : 180,
        behavior: 'smooth',
      });
    }
  };

  // Complete checkout
  const handleCheckout = () => {
    try {
      setPosError(null);
      if (cart.length === 0) throw new Error('Səbət boşdur.');

      const numPaid = typeof paidAmount === 'number' ? paidAmount : 0;

      if (paymentMethod !== 'Borc' && numPaid < total) {
        throw new Error(
          `Ödənilən məbləğ (${numPaid.toFixed(2)} ${setting.currency}) yekun məbləğdən (${total.toFixed(2)} ${setting.currency}) azdır! Qalan məbləği borca yazmaq üçün "Borc" növünü seçin.`
        );
      }

      if (paymentMethod === 'Borc' && !customerName.trim() && !saleNotes.trim()) {
        throw new Error('Borc satışı üçün borc götürən müştərinin adını mütləq daxil edin (məsələn: Elmir).');
      }

      const effectiveCustomerName = customerName.trim() || (paymentMethod === 'Borc' ? saleNotes.trim() : '');

      const sale = completeSale({
        items: cart.map((r) => ({
          productId: r.product.id,
          quantity: r.quantity,
          discountAmount: r.discountAmount || 0,
          discountPercent: r.discountPercent || 0,
          size: r.selectedSize,
          color: r.selectedColor,
          colorHex: r.selectedColorHex,
          variantId: r.selectedVariantId,
          comment: r.comment?.trim() || undefined,
        })),
        discount: cartTotals.globalDiscountAmount,
        paidAmount: paymentMethod === 'Borc' ? numPaid : (numPaid || total),
        paymentMethod,
        partialPaymentMethod: paymentMethod === 'Borc' ? partialPaymentMethod : undefined,
        customerName: effectiveCustomerName,
        notes: saleNotes.trim() || undefined,
      });

      setCompletedSale(sale);
      setIsReceiptOpen(true);
      clearCart();
      setPaymentMethod('Nağd');
      setPosSuccess(`Satış #${sale.id} uğurla tamamlandı!`);
      setTimeout(() => setPosSuccess(null), 3500);
    } catch (err: any) {
      setPosError(err.message || 'Satış tamamlana bilmədi.');
    }
  };

  // Return sale handlers
  const handleOpenReturnSale = (sale: Sale) => {
    setSaleToReturn(sale);
  };

  const handleConfirmReturnSale = () => {
    if (!saleToReturn) return;
    try {
      returnSale(saleToReturn.id);
      setPosSuccess(`Satış #${saleToReturn.id} qaytarıldı və stok bərpa edildi.`);
      setTimeout(() => setPosSuccess(null), 3000);
      setSaleToReturn(null);
    } catch (err: any) {
      setPosError(err.message || 'Qaytarma mümkün olmadı.');
    }
  };

  // Delete sale handlers
  const handleOpenDeleteSale = (sale: Sale) => {
    setSaleToDelete(sale);
    setDeleteRestoreStock(true);
  };

  const handleConfirmDeleteSale = () => {
    if (!saleToDelete) return;
    try {
      deleteSale(saleToDelete.id, deleteRestoreStock);
      setPosSuccess(`Satış #${saleToDelete.id} uğurla silindi.`);
      setTimeout(() => setPosSuccess(null), 3000);
      setSaleToDelete(null);
    } catch (err: any) {
      setPosError(err.message || 'Silmə mümkün olmadı.');
    }
  };

  // Filter Catalog Products
  const catalogProducts = useMemo(() => {
    return products.filter((p) => {
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

      // If catalogSearch has text, use it; otherwise if barcodeInput has text, use it too!
      const activeSearch = catalogSearch.trim() || barcodeInput.trim();
      const q = activeSearch.toLowerCase();
      const matchQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.color && p.color.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q);

      const matchCategory = selectedCategory === 'all' || p.category === selectedCategory;
      return matchQuery && matchCategory;
    });
  }, [products, catalogSearch, barcodeInput, selectedCategory, aiFilter]);

  return (
    <div className="space-y-4">
      {/* Toast Notifications */}
      {posError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{posError}</span>
          </div>
          <button onClick={() => setPosError(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {posSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{posSuccess}</span>
          </div>
          <button onClick={() => setPosSuccess(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Subtab Toggle (Minimalist top right or embedded) */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('kassa')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'kassa'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Kassa (POS)
          </button>
          <button
            onClick={() => setActiveSubTab('tarixce')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'tarixce'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Satış Tarixçəsi ({sales.length})
          </button>

          {/* 8. AI Seller Assistant Trigger Button */}
          <button
            type="button"
            onClick={() => setIsAssistantOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-500/20 transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            <span>✨ AI Satıcı Köməkçisi</span>
          </button>
        </div>
      </div>

      {activeSubTab === 'kassa' ? (
        /* Main 2-Column POS Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Barcode, Category Filter, Product Grid (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* 4. AI Natural Language Search Bar */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
              <AiNaturalSearchBar
                activeFilter={aiFilter}
                onApplyFilter={(f) => setAiFilter(f)}
                existingCategories={categories.map((c) => c.name)}
                placeholder="✨ AI Təbii Axtarış: Məs: 'Ağ kətan köynək 42 razmer 60 manata qədər'..."
              />
            </div>

            {/* 1. Barcode Search Card with Live Interactive Autocomplete */}
            <div ref={barcodeBoxRef} className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs relative z-30">
              <form onSubmit={handleBarcodeScan} className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-blue-600 pointer-events-none">
                    <Barcode className="w-4 h-4 text-blue-600" />
                  </div>
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    placeholder="Barkod oxudun, daxil edin və ya məhsul adı yazın..."
                    value={barcodeInput}
                    onFocus={() => setIsBarcodeDropdownOpen(true)}
                    onChange={(e) => {
                      setBarcodeInput(e.target.value);
                      setIsBarcodeDropdownOpen(true);
                    }}
                    className="w-full pl-11 pr-9 py-2.5 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-hidden transition"
                  />
                  {barcodeInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setBarcodeInput('');
                        setIsBarcodeDropdownOpen(false);
                        barcodeInputRef.current?.focus();
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shadow-xs transition active:scale-[0.98] cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  + Əlavə et
                </button>
              </form>

              {/* Live Autocomplete Dropdown */}
              {isBarcodeDropdownOpen && barcodeInput.trim().length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-slate-200 shadow-2xl z-40 overflow-hidden">
                  <div className="p-2.5 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Barcode className="w-3.5 h-3.5 text-blue-600" />
                      Barkod & Məhsul Nəticələri ({barcodeSuggestions.length})
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      Seçmək üçün klikləyin və ya Enter basın
                    </span>
                  </div>

                  {barcodeSuggestions.length > 0 ? (
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {barcodeSuggestions.map((p) => {
                        const isExactBarcode = p.barcode?.trim().toLowerCase() === barcodeInput.trim().toLowerCase();
                        const isOutOfStock = p.stockQuantity <= 0;
                        const isLowStock = p.stockQuantity <= (p.minimumStock || 5);
                        const hasVariants = Boolean(p.variants && p.variants.length > 0);
                        const productSizes = (p.sizes && p.sizes.length > 0)
                          ? p.sizes
                          : (p.size ? p.size.split(/[,/]+/).map((s) => s.trim()).filter(Boolean) : []);
                        const hasMultipleSizes = productSizes.length > 1;

                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              if (hasVariants) {
                                setVariantModalProduct(p);
                                setIsBarcodeDropdownOpen(false);
                              } else if (hasMultipleSizes) {
                                setSizeModalProduct(p);
                                setCustomSizeModalInput('');
                                setIsBarcodeDropdownOpen(false);
                              } else {
                                addToCart(p);
                                setPosSuccess(`${p.name} səbətə əlavə edildi`);
                                setTimeout(() => setPosSuccess(null), 2500);
                                setBarcodeInput('');
                                setIsBarcodeDropdownOpen(false);
                                barcodeInputRef.current?.focus();
                              }
                            }}
                            className={`p-3 flex items-center justify-between gap-3 hover:bg-blue-50/70 transition cursor-pointer ${
                              isExactBarcode ? 'bg-blue-50/40' : ''
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                                  {p.name}
                                </span>
                                {isExactBarcode && (
                                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md">
                                    Tam Barkod Uyğunluğu
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
                                {p.barcode && (
                                  <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-semibold flex items-center gap-1">
                                    <Barcode className="w-3 h-3 text-slate-500" />
                                    {p.barcode}
                                  </span>
                                )}
                                {p.brand && (
                                  <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5">
                                    <Tag className="w-2.5 h-2.5" />
                                    {p.brand}
                                  </span>
                                )}
                                {hasMultipleSizes ? (
                                  <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-semibold border border-indigo-200">
                                    Ölçülər: {productSizes.join(', ')}
                                  </span>
                                ) : productSizes.length === 1 ? (
                                  <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-semibold">
                                    Ölçü: {productSizes[0]}
                                  </span>
                                ) : p.size ? (
                                  <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-semibold">
                                    {p.size}
                                  </span>
                                ) : null}
                                {p.color && (
                                  <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded flex items-center gap-1 font-medium">
                                    <span
                                      className="w-2 h-2 rounded-full border border-slate-300"
                                      style={{ backgroundColor: getColorHex(p.color, p.colorHex) }}
                                    />
                                    {p.color}
                                  </span>
                                )}
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                    isOutOfStock
                                      ? 'bg-rose-100 text-rose-700'
                                      : isLowStock
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-emerald-50 text-emerald-700'
                                  }`}
                                >
                                  {isOutOfStock ? 'Bitib (0 ədəd)' : `Stok: ${p.stockQuantity} ədəd`}
                                </span>
                              </div>
                            </div>

                            <div className="text-right shrink-0 flex items-center gap-2.5">
                              <div>
                                <span className="text-xs sm:text-sm font-extrabold text-blue-600 block">
                                  {p.salePrice.toFixed(2)} {setting.currency}
                                </span>
                              </div>
                              <button
                                type="button"
                                className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition active:scale-95 cursor-pointer shadow-2xs"
                                title="Səbətə at"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-5 text-center space-y-2">
                      <AlertCircle className="w-6 h-6 text-amber-500 mx-auto" />
                      <p className="text-xs font-semibold text-slate-700">
                        "{barcodeInput}" üzrə heç bir məhsul tapılmadı.
                      </p>
                      {onOpenNewProduct && (
                        <button
                          type="button"
                          onClick={() => {
                            const code = barcodeInput.trim();
                            setIsBarcodeDropdownOpen(false);
                            onOpenNewProduct(code);
                          }}
                          className="mt-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-2xs"
                        >
                          + Bu barkod ilə yeni məhsul yarat
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Categories Pill Bar with Scroll Arrows & Search */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs space-y-2.5">
              <div className="flex items-center gap-2">
                {/* Search Toggle Icon Button */}
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(!isSearchOpen)}
                  className={`p-2 rounded-xl border transition cursor-pointer shrink-0 ${
                    isSearchOpen || catalogSearch
                      ? 'bg-blue-50 text-blue-600 border-blue-200'
                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                  }`}
                  title="Mallar üzrə axtarış"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>

                {/* Left Arrow */}
                <button
                  type="button"
                  onClick={() => handleScrollCategories('left')}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition shrink-0 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Scrollable Categories List */}
                <div
                  ref={categoryScrollRef}
                  className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth flex-1 text-xs py-0.5"
                  style={{ scrollbarWidth: 'none' }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs whitespace-nowrap transition cursor-pointer ${
                      selectedCategory === 'all'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Hamısı
                  </button>

                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCategory(c.name)}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs whitespace-nowrap transition cursor-pointer ${
                        selectedCategory === c.name
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>

                {/* Right Arrow */}
                <button
                  type="button"
                  onClick={() => handleScrollCategories('right')}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition shrink-0 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Expandable Search Input */}
              {isSearchOpen && (
                <div className="relative pt-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Məhsul adı və ya barkod ilə filtr..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    autoFocus
                  />
                  {catalogSearch && (
                    <button
                      onClick={() => setCatalogSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 3. Product Cards Grid (4 Columns) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[560px] overflow-y-auto pr-1">
              {catalogProducts.map((p) => {
                const isLow = p.stockQuantity <= (p.minimumStock || 5);
                const isZero = p.stockQuantity <= 0;
                const hasVariants = Boolean(p.variants && p.variants.length > 0);
                const productSizes = (p.sizes && p.sizes.length > 0)
                  ? p.sizes
                  : (p.size ? p.size.split(/[,/]+/).map((s) => s.trim()).filter(Boolean) : []);
                const hasMultipleSizes = productSizes.length > 1;

                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (hasVariants) {
                        setVariantModalProduct(p);
                      } else if (hasMultipleSizes) {
                        setSizeModalProduct(p);
                        setCustomSizeModalInput('');
                      } else {
                        addToCart(p);
                      }
                    }}
                    className="p-3 bg-white border border-slate-200/80 rounded-2xl shadow-2xs hover:border-blue-400 hover:shadow-xs transition cursor-pointer flex flex-col justify-between min-h-[135px] text-left group"
                  >
                    <div>
                      <p className="font-bold text-xs text-slate-900 line-clamp-2 leading-snug group-hover:text-blue-600 transition">
                        {p.name}
                      </p>
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        {p.brand && (
                          <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 flex items-center gap-0.5">
                            <Tag className="w-2.5 h-2.5" />
                            {p.brand}
                          </span>
                        )}
                        {hasMultipleSizes ? (
                          <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 flex items-center gap-0.5">
                            Ölçülər: {productSizes.join(', ')}
                          </span>
                        ) : productSizes.length === 1 ? (
                          <span className="text-[9px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            Ölçü: {productSizes[0]}
                          </span>
                        ) : p.size ? (
                          <span className="text-[9px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {p.size}
                          </span>
                        ) : null}
                        {p.color && (
                          <span className="text-[9px] font-medium text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <span
                              className="w-2 h-2 rounded-full inline-block border border-slate-300"
                              style={{ backgroundColor: getColorHex(p.color, p.colorHex) }}
                            />
                            {p.color}
                          </span>
                        )}
                        {hasVariants && (
                          <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 flex items-center gap-0.5">
                            <Layers className="w-2.5 h-2.5" />
                            {p.variants?.length} variant
                          </span>
                        )}
                        <span className="text-[9px] text-slate-400 truncate">{p.category}</span>
                      </div>
                    </div>

                    <div className="flex items-end justify-between pt-2 border-t border-slate-100 mt-2">
                      <span className="font-extrabold text-sm text-slate-900">
                        {p.salePrice.toFixed(2)} {setting.currency}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          isZero
                            ? 'bg-rose-100 text-rose-700'
                            : isLow
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {p.stockQuantity} əd.
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Cart & Checkout Box (5 Cols) */}
          <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            {/* Cart Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-blue-600" />
                <h2 className="font-bold text-slate-900 text-sm">Cari Səbət</h2>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-extrabold">
                  {cart.length}
                </span>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer transition"
                >
                  Təmizlə
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="py-8 text-center text-slate-400 space-y-1">
                  <ShoppingCart className="w-8 h-8 mx-auto text-slate-200" />
                  <p className="text-xs font-semibold text-slate-500">Səbət boşdur</p>
                  <p className="text-[11px] text-slate-400">Soldan məhsul seçin və ya barkod oxudun</p>
                </div>
              ) : (
                cart.map((item) => {
                  const hasItemDiscount = (item.discountPercent || 0) > 0;
                  const isDiscountOpen = openDiscountId === item.cartItemId;
                  const isCommentEditing = editingCommentCartItemId === item.cartItemId;
                  const isSizeEditing = editingSizeCartItemId === item.cartItemId;
                  const itemUnitPrice = item.discountedUnitPrice ?? item.product.salePrice;

                  return (
                    <div
                      key={item.cartItemId}
                      className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs transition hover:border-slate-300"
                    >
                      {/* Top Row: Info & Controls */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {/* Name & Barcode in Cart Item */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">{item.product.name}</p>
                            {item.product.barcode && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 font-mono text-[10px] sm:text-[11px] font-bold shadow-2xs">
                                <Barcode className="w-3 h-3 text-blue-600 shrink-0" />
                                <span>{item.product.barcode}</span>
                              </span>
                            )}
                          </div>

                          {/* Brand, Size & Color Badges */}
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {item.product.brand && (
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100 flex items-center gap-0.5">
                                <Tag className="w-2.5 h-2.5" />
                                {item.product.brand}
                              </span>
                            )}
                            {item.selectedSize ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSizeCartItemId(isSizeEditing ? null : item.cartItemId);
                                  setSizeText(item.selectedSize || '');
                                }}
                                className="text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 px-1.5 py-0.2 rounded flex items-center gap-1 cursor-pointer transition"
                                title="Ölçünü dəyiş və ya yeni ölçü yaz"
                              >
                                <span>Ölçü: <strong className="text-indigo-700">{item.selectedSize}</strong></span>
                                <Edit2 className="w-2.5 h-2.5 text-indigo-600" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSizeCartItemId(isSizeEditing ? null : item.cartItemId);
                                  setSizeText('');
                                }}
                                className="text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-dashed border-indigo-300 px-1.5 py-0.2 rounded flex items-center gap-1 cursor-pointer transition animate-pulse"
                                title="Bu məhsul üçün ölçü seçin və ya yazın (məs: XL)"
                              >
                                <Plus className="w-2.5 h-2.5" />
                                <span>Ölçü seç / yaz</span>
                              </button>
                            )}
                            {(item.selectedColor || item.product.color) && (
                              <span className="text-[10px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded flex items-center gap-1 border border-slate-200/50">
                                <span
                                  className="w-2 h-2 rounded-full inline-block border border-slate-300 shadow-2xs"
                                  style={{ backgroundColor: item.selectedColorHex || getColorHex(item.selectedColor || item.product.color || '') }}
                                />
                                {item.selectedColor || item.product.color}
                              </span>
                            )}
                          </div>

                          {/* Price breakdown */}
                          <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-1.5 flex-wrap">
                            {hasItemDiscount ? (
                              <>
                                <span className="line-through text-slate-400">
                                  {item.product.salePrice.toFixed(2)}
                                </span>
                                <span className="font-bold text-emerald-700">
                                  {itemUnitPrice.toFixed(2)} {setting.currency}
                                </span>
                                <span className="text-[10px] font-extrabold text-rose-700 bg-rose-50 border border-rose-200 px-1 rounded">
                                  -{item.discountPercent}%
                                </span>
                              </>
                            ) : (
                              <span className="font-bold text-slate-800">
                                {item.product.salePrice.toFixed(2)} {setting.currency}
                              </span>
                            )}
                            <span className="text-slate-400">×</span>
                            <span className="font-bold text-slate-800">{item.quantity}</span>
                            <span className="text-slate-400">=</span>
                            <span className="font-extrabold text-blue-700">
                              {item.total.toFixed(2)} {setting.currency}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Item Discount Toggle Button (AZN amount) */}
                          <button
                            type="button"
                            onClick={() => setOpenDiscountId(isDiscountOpen ? null : item.cartItemId)}
                            className={`px-1.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-0.5 border cursor-pointer transition ${
                              hasItemDiscount
                                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                : isDiscountOpen
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                            title="Məhsula fərdi endirim məbləği təyin et"
                          >
                            <Tag className="w-2.5 h-2.5" />
                            {hasItemDiscount ? `-${(item.discountAmount || 0).toFixed(2)} ${setting.currency}` : 'Endirim'}
                          </button>

                          {/* Quantity Controls */}
                          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item.cartItemId, item.quantity - 1)}
                              className="w-5 h-5 rounded bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer shadow-2xs"
                            >
                              <Minus className="w-3 h-3" />
                            </button>

                            <span className="w-5 text-center text-xs font-bold text-slate-800">
                              {item.quantity}
                            </span>

                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item.cartItemId, item.quantity + 1)}
                              className="w-5 h-5 rounded bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer shadow-2xs"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeFromCart(item.cartItemId)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition cursor-pointer"
                            title="Səbətdən sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Per-Item Size Selection / Input Section */}
                      {isSizeEditing && (
                        <div className="p-2.5 bg-indigo-50/90 border border-indigo-200 rounded-xl space-y-2 text-xs animate-fadeIn">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[11px] text-indigo-950 flex items-center gap-1.5 flex-wrap">
                              <span>📏 Satış Ölçüsü Təyin Et:</span>
                              <strong className="text-indigo-700">{item.product.name}</strong>
                              {item.selectedColor && (
                                <span className="text-slate-500 font-normal">({item.selectedColor})</span>
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingSizeCartItemId(null)}
                              className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Fast Selection from Product's Configured Sizes */}
                          {((item.product.sizes && item.product.sizes.length > 0) || item.product.size) && (
                            <div>
                              <span className="text-[10px] font-bold text-indigo-900 block mb-1">
                                Məhsulun qeyd edilmiş ölçüləri:
                              </span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {(
                                  item.product.sizes && item.product.sizes.length > 0
                                    ? item.product.sizes
                                    : (item.product.size?.split(/[,/]+/).map((s) => s.trim()).filter(Boolean) || [])
                                ).map((sz) => {
                                  const isCurrent = item.selectedSize === sz;
                                  return (
                                    <button
                                      key={sz}
                                      type="button"
                                      onClick={() => {
                                        updateCartItemSize(item.cartItemId, sz);
                                        setEditingSizeCartItemId(null);
                                      }}
                                      className={`text-xs px-2.5 py-1 rounded-lg font-black transition border cursor-pointer ${
                                        isCurrent
                                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                          : 'bg-white text-indigo-900 border-indigo-200 hover:bg-indigo-100'
                                      }`}
                                    >
                                      {sz}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Fast Standard Size Presets */}
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 block mb-1">
                              Digər standart ölçülər:
                            </span>
                            <div className="flex items-center gap-1 flex-wrap">
                              {CLOTHING_SIZE_PRESETS.slice(0, 10).map((sz) => (
                                <button
                                  key={sz}
                                  type="button"
                                  onClick={() => {
                                    updateCartItemSize(item.cartItemId, sz);
                                    setEditingSizeCartItemId(null);
                                  }}
                                  className="text-[10px] px-2 py-0.5 rounded font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 cursor-pointer"
                                >
                                  {sz}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Direct Custom Input */}
                          <div className="flex items-center gap-1.5 pt-1">
                            <input
                              type="text"
                              value={sizeText}
                              onChange={(e) => setSizeText(e.target.value)}
                              placeholder="Ölçünü yazın (məs: XL, 42, 3Düymə qara Xl)..."
                              className="flex-1 px-2.5 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (sizeText.trim()) {
                                    updateCartItemSize(item.cartItemId, sizeText.trim());
                                    setEditingSizeCartItemId(null);
                                  }
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (sizeText.trim()) {
                                  updateCartItemSize(item.cartItemId, sizeText.trim());
                                  setEditingSizeCartItemId(null);
                                }
                              }}
                              disabled={!sizeText.trim()}
                              className="px-3 py-1.5 bg-indigo-600 disabled:bg-slate-200 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs"
                            >
                              Təsdiq et
                            </button>
                            {item.selectedSize && (
                              <button
                                type="button"
                                onClick={() => {
                                  updateCartItemSize(item.cartItemId, '');
                                  setEditingSizeCartItemId(null);
                                }}
                                className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold border border-rose-200 transition cursor-pointer"
                                title="Ölçünü sil"
                              >
                                Sil
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Per-Item Comment Section */}
                      <div className="pt-0.5">
                        {isCommentEditing ? (
                          <div className="p-2 bg-amber-50/90 border border-amber-300 rounded-lg space-y-1.5 animate-fadeIn">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                                <MessageSquare className="w-3 h-3 text-amber-700" />
                                Məhsula Şərh Yaz ({item.product.name}):
                              </span>
                              <button
                                type="button"
                                onClick={() => setEditingCommentCartItemId(null)}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <input
                              type="text"
                              value={commentText}
                              onChange={(e) => setCommentText(e.target.value)}
                              placeholder="Məs: Müştəri sabah gəlib götürəcək, Qüsurlu..."
                              className="w-full px-2 py-1 bg-white border border-amber-300 rounded-md text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  updateCartItemComment(item.cartItemId, commentText.trim());
                                  setEditingCommentCartItemId(null);
                                }
                              }}
                            />

                            {/* Quick comment chips */}
                            <div className="flex items-center gap-1 flex-wrap">
                              {QUICK_ITEM_COMMENTS.map((qc) => (
                                <button
                                  key={qc}
                                  type="button"
                                  onClick={() => setCommentText(qc)}
                                  className="text-[10px] px-2 py-0.5 rounded bg-white hover:bg-amber-100 text-amber-900 border border-amber-200 transition cursor-pointer"
                                >
                                  {qc}
                                </button>
                              ))}
                            </div>

                            <div className="flex items-center justify-end gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingCommentCartItemId(null)}
                                className="px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-200 rounded transition"
                              >
                                İmtina
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  updateCartItemComment(item.cartItemId, commentText.trim());
                                  setEditingCommentCartItemId(null);
                                }}
                                className="px-2.5 py-0.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded shadow-2xs transition"
                              >
                                Yadda Saxla
                              </button>
                            </div>
                          </div>
                        ) : item.comment ? (
                          <div className="flex items-center justify-between gap-1.5 p-1.5 bg-amber-50/80 border border-amber-200 rounded-lg text-xs">
                            <div className="flex items-center gap-1.5 min-w-0 text-amber-900 font-medium">
                              <MessageSquare className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                              <span className="truncate text-[11px] italic">"{item.comment}"</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCommentCartItemId(item.cartItemId);
                                  setCommentText(item.comment || '');
                                }}
                                className="p-1 text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded cursor-pointer"
                                title="Şərhi redaktə et"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => updateCartItemComment(item.cartItemId, '')}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                title="Şərhi sil"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCommentCartItemId(item.cartItemId);
                              setCommentText('');
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-blue-600 hover:bg-blue-50 px-2 py-0.5 rounded border border-dashed border-slate-200 cursor-pointer transition"
                          >
                            <MessageSquare className="w-2.5 h-2.5 text-slate-400" />
                            <span>+ Şərh əlavə et</span>
                          </button>
                        )}
                      </div>

                      {/* Expandable Per-Item Discount Drawer (AZN Amount Only) */}
                      {isDiscountOpen && (
                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs animate-fadeIn">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[11px] text-slate-700 flex items-center gap-1">
                              <Tag className="w-3 h-3 text-blue-600" />
                              Məhsul Endirimi ({item.product.name}):
                            </span>
                            {hasItemDiscount && (
                              <button
                                type="button"
                                onClick={() => updateCartItemDiscount(item.cartItemId, 0)}
                                className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer"
                              >
                                Endirimi Sıfırla
                              </button>
                            )}
                          </div>

                          {/* Quick AZN amount chips */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {[0, 1, 2, 5, 10, 20].map((amt) => {
                              if (amt > item.product.salePrice) return null;
                              return (
                                <button
                                  key={amt}
                                  type="button"
                                  onClick={() => updateCartItemDiscount(item.cartItemId, amt)}
                                  className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition border cursor-pointer ${
                                    (item.discountAmount || 0) === amt
                                      ? 'bg-blue-600 text-white border-blue-600'
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  {amt === 0 ? '0 ₼' : `-${amt} ${setting.currency}`}
                                </button>
                              );
                            })}
                          </div>

                          {/* Custom AZN input */}
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-500 font-medium">Endirim Məbləği:</span>
                            <div className="relative flex-1">
                              <input
                                type="number"
                                min="0"
                                max={item.product.salePrice}
                                step="0.01"
                                placeholder="0.00"
                                value={item.discountAmount || ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                  updateCartItemDiscount(item.cartItemId, val);
                                }}
                                className="w-full px-2 py-1 pr-8 bg-white border border-slate-300 rounded-md text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                                {setting.currency}
                              </span>
                            </div>
                            <span className="text-[11px] font-bold text-emerald-700 whitespace-nowrap">
                              Satış = {itemUnitPrice.toFixed(2)} {setting.currency}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Global Cart Discount and Payment Method Row */}
            <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/80 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Global Cart Discount (Strictly AZN Amount) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-blue-600" />
                      <span>Ümumi Səbət Endirimi ({setting.currency})</span>
                    </label>
                    {discount !== '' && Number(discount) > 0 && (
                      <button
                        type="button"
                        onClick={() => setDiscount('')}
                        className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer"
                      >
                        Sıfırla
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={discount}
                        placeholder="0.00"
                        onChange={(e) => setDiscount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className="w-full px-3 py-1.5 pr-8 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                        {setting.currency}
                      </span>
                    </div>
                    {/* Quick AZN discount chips */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {[1, 2, 5, 10, 20, 50].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setDiscount(amt)}
                          className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition border cursor-pointer ${
                            discount === amt
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          -{amt} {setting.currency}
                        </button>
                      ))}
                    </div>
                    {cartTotals.globalDiscountAmount > 0 && (
                      <p className="text-[10px] font-bold text-rose-600">
                        Səbətdən endirim: -{cartTotals.globalDiscountAmount.toFixed(2)} {setting.currency}
                      </p>
                    )}
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Ödəniş Növü</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['Nağd', 'Kart', 'Borc'] as const).map((method) => {
                      const isBorc = method === 'Borc';
                      const isSelected = paymentMethod === method;
                      return (
                        <button
                          key={method}
                          type="button"
                          onClick={() => {
                            setPaymentMethod(method);
                            if (method === 'Borc') {
                              setPaidAmount(0);
                            } else {
                              setPaidAmount(total);
                            }
                          }}
                          className={`py-2 px-1 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 border cursor-pointer ${
                            isSelected
                              ? isBorc
                                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                : 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {isBorc ? '⚠️ Borc' : method}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Borc & Hissəli Ödəniş Details Container */}
            {paymentMethod === 'Borc' ? (
              <div className="p-3.5 rounded-2xl border border-amber-300 bg-amber-50/40 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <UserCheck className="w-3.5 h-3.5 text-amber-700" />
                    <span>Borc & Hissəli Ödəniş Məlumatları</span>
                  </div>
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">
                    Nisyə Dəftəri
                  </span>
                </div>

                {/* 1. Customer Name */}
                <div>
                  <label className="block text-xs font-bold text-amber-900 mb-1">
                    Borc Götürən Şəxs (Müştəri Adı) <span className="text-rose-600 font-extrabold">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Məsələn: Elmir"
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  {/* Quick selection chips */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[10px] text-amber-800 font-semibold">Tez seçim:</span>
                    {previousCustomerNames.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setCustomerName(name)}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition border cursor-pointer ${
                          customerName === name
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white hover:bg-amber-100 text-amber-900 border-amber-200'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Paid Amount and Quick Chips */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-amber-900">
                      İndi Ödənilən Məbləğ ({setting.currency}):
                    </label>
                    <span className="text-[10px] text-slate-500">
                      (Məs: 150 ₼-dan 100 ₼ ödəyir)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max={total}
                      step="0.01"
                      value={paidAmount}
                      placeholder="0"
                      onChange={(e) => setPaidAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                    />

                    {/* Quick Amount Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPaidAmount(0)}
                        className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-bold rounded-lg border border-amber-200 cursor-pointer"
                      >
                        0 ₼
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaidAmount(50)}
                        className="px-2 py-1 bg-white hover:bg-amber-100 text-slate-800 text-[10px] font-bold rounded-lg border border-amber-200 cursor-pointer"
                      >
                        50 ₼
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaidAmount(100)}
                        className="px-2 py-1 bg-white hover:bg-amber-100 text-slate-800 text-[10px] font-bold rounded-lg border border-amber-200 cursor-pointer"
                      >
                        100 ₼
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaidAmount(total)}
                        className="px-2 py-1 bg-white hover:bg-amber-100 text-slate-800 text-[10px] font-bold rounded-lg border border-amber-200 cursor-pointer"
                      >
                        Tam
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Summary Block */}
                <div className="bg-amber-100/60 p-3 rounded-xl border border-amber-200/80 space-y-1 text-xs text-slate-800">
                  <div className="flex justify-between font-semibold">
                    <span>Məhsulların İlkin Cəmi:</span>
                    <span>{cartTotals.grossSubtotal.toFixed(2)} {setting.currency}</span>
                  </div>
                  {cartTotals.itemDiscountsTotal > 0 && (
                    <div className="flex justify-between font-semibold text-rose-700">
                      <span>Məhsul Endirimləri:</span>
                      <span>-{cartTotals.itemDiscountsTotal.toFixed(2)} {setting.currency}</span>
                    </div>
                  )}
                  {cartTotals.globalDiscountAmount > 0 && (
                    <div className="flex justify-between font-semibold text-rose-700">
                      <span>Səbət Endirimi ({cartTotals.globalDiscountPercent}%):</span>
                      <span>-{cartTotals.globalDiscountAmount.toFixed(2)} {setting.currency}</span>
                    </div>
                  )}
                  {cartTotals.totalDiscount > 0 && (
                    <div className="flex justify-between font-bold text-rose-800 pt-0.5 border-t border-amber-200/60">
                      <span>Cəmi Qənaət:</span>
                      <span>-{cartTotals.totalDiscount.toFixed(2)} {setting.currency}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1 border-t border-amber-200">
                    <span>YEKUN DƏYƏR:</span>
                    <span>{total.toFixed(2)} {setting.currency}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-emerald-800 pt-1">
                    <span>İndi Ödənilən (Nağd):</span>
                    <span>{paidNum.toFixed(2)} {setting.currency}</span>
                  </div>
                  <div className="flex justify-between text-sm font-extrabold text-rose-600 pt-1 border-t border-amber-200">
                    <span>⚠️ Borca Qalan Məbləğ:</span>
                    <span>{debt.toFixed(2)} {setting.currency}</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-bold text-amber-900 pt-0.5">
                    <span>Borc Götürən:</span>
                    <span>{customerName.trim() || '—'}</span>
                  </div>
                </div>

                {/* 4. Sale Note */}
                <div>
                  <label className="block text-[11px] font-bold text-amber-900 mb-1">
                    Satış Qeydi (Məsələn: Ağ polo 85 manat Borc Elmir götürdü)
                  </label>
                  <input
                    type="text"
                    value={saleNotes}
                    onChange={(e) => setSaleNotes(e.target.value)}
                    placeholder="Qeyd və ya xüsusi məlumat..."
                    className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>
            ) : (
              /* Standard Cash/Card Summary Panel */
              <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between font-semibold text-slate-600">
                  <span>Məhsulların İlkin Cəmi:</span>
                  <span>{cartTotals.grossSubtotal.toFixed(2)} {setting.currency}</span>
                </div>
                {cartTotals.itemDiscountsTotal > 0 && (
                  <div className="flex justify-between font-semibold text-rose-600">
                    <span>Məhsul Endirimləri:</span>
                    <span>-{cartTotals.itemDiscountsTotal.toFixed(2)} {setting.currency}</span>
                  </div>
                )}
                {cartTotals.globalDiscountAmount > 0 && (
                  <div className="flex justify-between font-semibold text-rose-600">
                    <span>Səbət Endirimi ({cartTotals.globalDiscountPercent}%):</span>
                    <span>-{cartTotals.globalDiscountAmount.toFixed(2)} {setting.currency}</span>
                  </div>
                )}
                {cartTotals.totalDiscount > 0 && (
                  <div className="flex justify-between font-bold text-rose-700 pt-1 border-t border-slate-200">
                    <span>Cəmi Qənaət / Endirim:</span>
                    <span>-{cartTotals.totalDiscount.toFixed(2)} {setting.currency}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1 border-t border-slate-200">
                  <span>YEKUN ÖDƏNİŞ:</span>
                  <span className="text-blue-600">{total.toFixed(2)} {setting.currency}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 items-center">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Ödənilən ({setting.currency}):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder={total.toFixed(2)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-bold text-emerald-700">Qalıq Pul:</span>
                    <p className="font-extrabold text-sm text-emerald-700">
                      {change.toFixed(2)} {setting.currency}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Müştəri Adı (İstəyə bağlı)
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Məsələn: Rəşad Əliyev"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            )}

            {/* Complete Checkout Button */}
            <button
              type="button"
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className={`w-full py-3.5 text-white font-bold rounded-xl shadow-md text-sm flex items-center justify-center gap-2 transition active:scale-[0.99] cursor-pointer ${
                cart.length === 0
                  ? 'bg-slate-300 cursor-not-allowed shadow-none'
                  : paymentMethod === 'Borc'
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              {paymentMethod === 'Borc'
                ? `Satışı Tamamla (${debt.toFixed(2)} ${setting.currency} Borc, ${paidNum.toFixed(2)} ${setting.currency} Ödənilən)`
                : `Satışı Tamamla (${total.toFixed(2)} ${setting.currency})`}
            </button>
          </div>
        </div>
      ) : (
        /* History & Returns View */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="font-bold text-slate-900 text-base">Satışlar Tarixçəsi</h2>
            <div className="relative w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Çek no və ya müştəri ilə axtar..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-3 px-3 w-8"></th>
                  <th className="py-3 px-3">Çek No</th>
                  <th className="py-3 px-3">Tarix</th>
                  <th className="py-3 px-3">Məhsullar</th>
                  <th className="py-3 px-3">Müştəri</th>
                  <th className="py-3 px-3 text-center">Ödəniş</th>
                  <th className="py-3 px-3 text-right">Məbləğ</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Əməliyyat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales
                  .filter((s) => {
                    const q = historySearch.trim().toLowerCase();
                    return (
                      !q ||
                      s.id.toString().includes(q) ||
                      (s.customerName && s.customerName.toLowerCase().includes(q))
                    );
                  })
                  .map((sale) => {
                    const isExpanded = expandedHistorySaleId === sale.id;

                    return (
                      <React.Fragment key={sale.id}>
                        <tr className={`hover:bg-slate-50/70 transition ${isExpanded ? 'bg-blue-50/30' : ''}`}>
                          <td className="py-3 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => setExpandedHistorySaleId(isExpanded ? null : sale.id)}
                              className="p-1 text-slate-400 hover:text-blue-600 rounded transition cursor-pointer"
                              title="Təfərrüatları göstər / gizlət"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-blue-600">#{sale.id}</td>
                          <td className="py-3 px-3 text-slate-500 font-mono">
                            {sale.date ? sale.date.split('T')[0] : ''}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-slate-800">
                              {sale.items.length} növ məhsul
                            </span>
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-700">
                            {sale.customerName || '—'}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                sale.paymentMethod === 'Borc'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {sale.paymentMethod}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-extrabold text-slate-900">
                            {sale.total.toFixed(2)} {setting.currency}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {sale.isReturned ? (
                              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-bold text-[10px]">
                                Qaytarılıb
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                Tamamlandı
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  setCompletedSale(sale);
                                  setIsReceiptOpen(true);
                                }}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                title="Çekə Bax / Çap et"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSaleToEdit(sale);
                                  setIsEditModalOpen(true);
                                }}
                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 border border-indigo-200/80 rounded-lg transition cursor-pointer flex items-center gap-1 font-bold text-[11px] shadow-2xs"
                                title="Çekə Düzəliş Et"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                <span>Düzəliş et</span>
                              </button>
                              {!sale.isReturned && (
                                <button
                                  onClick={() => handleOpenReturnSale(sale)}
                                  className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                                  title="Malları Qaytar"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenDeleteSale(sale)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="Çeki Sil"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded details row */}
                        {isExpanded && (
                          <tr className="bg-slate-50/90 border-b border-slate-200">
                            <td colSpan={9} className="p-4">
                              <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs space-y-3">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                  <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                                    <Receipt className="w-3.5 h-3.5 text-blue-600" />
                                    Satış #{sale.id} Mallarının Detalları:
                                  </span>
                                  {sale.discount > 0 && (
                                    <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                      Ümumi Səbət Endirimi: -{sale.discount.toFixed(2)} {setting.currency}
                                      {sale.globalDiscountPercent ? ` (${sale.globalDiscountPercent}%)` : ''}
                                    </span>
                                  )}
                                </div>

                                <div className="divide-y divide-slate-100 text-xs">
                                  {sale.items.map((item, idx) => (
                                    <div key={idx} className="py-2 flex items-center justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="font-bold text-slate-900">{item.productName}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                          {item.productBarcode && (
                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-mono text-[9px] font-bold border border-slate-200/60">
                                              <Barcode className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                                              {item.productBarcode}
                                            </span>
                                          )}
                                          {item.brand && (
                                            <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1 py-0.2 rounded border border-blue-100 flex items-center gap-0.5">
                                              <Tag className="w-2.5 h-2.5" />
                                              {item.brand}
                                            </span>
                                          )}
                                          {item.size && (
                                            <span className="text-[9px] font-bold text-slate-800 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-300">
                                              Ölçü: {item.size}
                                            </span>
                                          )}
                                          {item.color && (
                                            <span className="text-[9px] font-medium text-slate-700 bg-slate-100 px-1 py-0.2 rounded flex items-center gap-1">
                                              <span
                                                className="w-1.5 h-1.5 rounded-full inline-block border border-slate-300"
                                                style={{ backgroundColor: getColorHex(item.color, item.colorHex) }}
                                              />
                                              {item.color}
                                            </span>
                                          )}
                                        </div>
                                        {item.comment && (
                                          <p className="text-[10px] text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-1 inline-block font-sans">
                                            💬 Şərh: {item.comment}
                                          </p>
                                        )}
                                      </div>

                                      <div className="text-right shrink-0">
                                        <p className="font-bold text-slate-800">
                                          {item.total.toFixed(2)} {setting.currency}
                                        </p>
                                        <p className="text-[10px] text-slate-500">
                                          {item.originalPrice && item.originalPrice > item.salePrice ? (
                                            <span className="line-through text-slate-400 mr-1">
                                              {item.originalPrice.toFixed(2)}
                                            </span>
                                          ) : null}
                                          {item.salePrice.toFixed(2)} {setting.currency} × {item.quantity} əd.
                                          {item.discountPercent && item.discountPercent > 0 ? (
                                            <span className="ml-1 text-rose-600 font-bold">
                                              (-{item.discountPercent}%)
                                            </span>
                                          ) : null}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Clothing Variant Picker Modal */}
      {variantModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="font-bold text-sm">{variantModalProduct.name}</h3>
                  <p className="text-xs text-slate-400">Geyim Ölçü və Rəng Variantını Seçin</p>
                </div>
              </div>
              <button
                onClick={() => setVariantModalProduct(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
              {variantModalProduct.variants && variantModalProduct.variants.length > 0 ? (
                variantModalProduct.variants.map((v) => {
                  const isOutOfStock = v.stockQuantity <= 0;
                  return (
                    <div
                      key={v.id}
                      className="p-3 rounded-xl border border-slate-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/30 transition flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs shrink-0"
                          style={{ backgroundColor: getColorHex(v.color, v.colorHex) }}
                        />
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-xs text-slate-900 px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200">
                              Ölçü: {v.size}
                            </span>
                            <span className="font-semibold text-xs text-slate-700">
                              {v.color}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                            <span>
                              Stok:{' '}
                              <strong className={isOutOfStock ? 'text-rose-600' : 'text-slate-800'}>
                                {v.stockQuantity} əd.
                              </strong>
                            </span>
                            {v.barcode && (
                              <span className="font-mono text-[10px] text-slate-400">[{v.barcode}]</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isOutOfStock && !setting.allowNegativeStock}
                        onClick={() => {
                          addToCart(variantModalProduct, {
                            id: v.id,
                            size: v.size,
                            color: v.color,
                            colorHex: v.colorHex,
                          });
                          setVariantModalProduct(null);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                          isOutOfStock && !setting.allowNegativeStock
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Səbətə At
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-slate-500 text-xs">
                  Xüsusi variant təyin edilməyib.
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  addToCart(variantModalProduct);
                  setVariantModalProduct(null);
                }}
                className="text-xs text-indigo-700 hover:text-indigo-900 font-bold hover:underline cursor-pointer"
              >
                Əsas Məhsulu Birbaşa Əlavə Et
              </button>
              <button
                type="button"
                onClick={() => setVariantModalProduct(null)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-xs rounded-lg transition cursor-pointer"
              >
                Bağla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Size Selection Modal for Catalog Products with Multiple Sizes */}
      {sizeModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-base border border-indigo-400/30">
                  📏
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">{sizeModalProduct.name}</h3>
                  <p className="text-xs text-slate-400">Satış üçün ölçü seçin və ya yazın</p>
                </div>
              </div>
              <button
                onClick={() => setSizeModalProduct(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[65vh] overflow-y-auto">
              {/* Product Info Bar */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  {sizeModalProduct.color && (
                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block border border-slate-300"
                        style={{ backgroundColor: getColorHex(sizeModalProduct.color, sizeModalProduct.colorHex) }}
                      />
                      {sizeModalProduct.color}
                    </span>
                  )}
                  {sizeModalProduct.brand && (
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                      {sizeModalProduct.brand}
                    </span>
                  )}
                </div>
                <span className="text-sm font-extrabold text-slate-900">
                  {sizeModalProduct.salePrice.toFixed(2)} {setting.currency}
                </span>
              </div>

              {/* Product Registered Sizes Chips */}
              <div>
                <p className="text-xs font-bold text-slate-700 mb-2">
                  Məhsulun qeyd edilmiş ölçüləri (bir kliklə səbətə at):
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {((sizeModalProduct.sizes && sizeModalProduct.sizes.length > 0)
                    ? sizeModalProduct.sizes
                    : (sizeModalProduct.size?.split(/[,/]+/).map((s) => s.trim()).filter(Boolean) || [])
                  ).map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => {
                        addToCart(sizeModalProduct, undefined, undefined, sz);
                        setPosSuccess(`${sizeModalProduct.name} (${sz}) səbətə əlavə edildi`);
                        setTimeout(() => setPosSuccess(null), 2500);
                        setSizeModalProduct(null);
                      }}
                      className="py-2.5 px-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-900 hover:text-white border border-indigo-200 hover:border-indigo-600 rounded-xl font-black text-sm transition text-center shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              {/* Standard Sizes quick row */}
              <div>
                <p className="text-[11px] font-semibold text-slate-500 mb-1.5">
                  Digər standart ölçülər:
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {CLOTHING_SIZE_PRESETS.slice(0, 10).map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => {
                        addToCart(sizeModalProduct, undefined, undefined, sz);
                        setPosSuccess(`${sizeModalProduct.name} (${sz}) səbətə əlavə edildi`);
                        setTimeout(() => setPosSuccess(null), 2500);
                        setSizeModalProduct(null);
                      }}
                      className="text-xs px-2.5 py-1 rounded-lg font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 cursor-pointer"
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Size Input */}
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">
                  Və ya başqa ölçü yazın (məs: XL, 44, Xüsusi):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customSizeModalInput}
                    onChange={(e) => setCustomSizeModalInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customSizeModalInput.trim()) {
                        e.preventDefault();
                        addToCart(sizeModalProduct, undefined, undefined, customSizeModalInput.trim());
                        setPosSuccess(`${sizeModalProduct.name} (${customSizeModalInput.trim()}) səbətə əlavə edildi`);
                        setTimeout(() => setPosSuccess(null), 2500);
                        setSizeModalProduct(null);
                      }
                    }}
                    placeholder="Məsələn: XL, 42..."
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customSizeModalInput.trim()) {
                        addToCart(sizeModalProduct, undefined, undefined, customSizeModalInput.trim());
                        setPosSuccess(`${sizeModalProduct.name} (${customSizeModalInput.trim()}) səbətə əlavə edildi`);
                        setTimeout(() => setPosSuccess(null), 2500);
                        setSizeModalProduct(null);
                      }
                    }}
                    disabled={!customSizeModalInput.trim()}
                    className="px-4 py-2 bg-indigo-600 disabled:bg-slate-200 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-2xs"
                  >
                    Səbətə At
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  addToCart(sizeModalProduct);
                  setSizeModalProduct(null);
                }}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold hover:underline cursor-pointer"
              >
                Ölçüsüz əlavə et
              </button>
              <button
                type="button"
                onClick={() => setSizeModalProduct(null)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-xs rounded-lg transition cursor-pointer"
              >
                Bağla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {isReceiptOpen && completedSale && (
        <ReceiptModal
          sale={completedSale}
          onClose={() => {
            setIsReceiptOpen(false);
            setCompletedSale(null);
          }}
        />
      )}

      {/* Edit Sale Modal */}
      {isEditModalOpen && saleToEdit && (
        <EditSaleModal
          isOpen={isEditModalOpen}
          sale={saleToEdit}
          onClose={() => {
            setIsEditModalOpen(false);
            setSaleToEdit(null);
          }}
          onSaveSuccess={(updatedSale) => {
            setPosSuccess(`Çek #${updatedSale.id} uğurla yeniləndi!`);
            setTimeout(() => setPosSuccess(null), 3000);
            if (completedSale?.id === updatedSale.id) {
              setCompletedSale(updatedSale);
            }
          }}
        />
      )}

      {/* Delete Sale Confirmation Modal */}
      {saleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-rose-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Trash2 className="w-5 h-5" />
                <h3 className="font-bold text-base">Çeki Sil (#{saleToDelete.id})</h3>
              </div>
              <button
                type="button"
                onClick={() => setSaleToDelete(null)}
                className="p-1 rounded-lg text-rose-200 hover:text-white hover:bg-rose-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-100 text-rose-900">
                <p className="font-bold text-sm mb-1">
                  Çek #{saleToDelete.id} tamamilə silinsin?
                </p>
                <p className="text-slate-600">
                  Bu əməliyyat satışı satış tarixçəsindən və müvafiq kassa qeydlərindən siləcək.
                </p>
              </div>

              {/* Summary Info */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Müştəri:</span>
                  <span className="font-bold text-slate-900">{saleToDelete.customerName || 'Anonim'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Məbləğ:</span>
                  <span className="font-bold text-slate-900">{saleToDelete.total.toFixed(2)} {setting.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Məhsullar:</span>
                  <span className="font-semibold text-slate-800">
                    {saleToDelete.items.length} növ ({saleToDelete.items.reduce((acc, it) => acc + it.quantity, 0)} ədəd)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ödəniş Üsulu:</span>
                  <span className="font-semibold text-slate-800">{saleToDelete.paymentMethod}</span>
                </div>
              </div>

              {/* Stock Restore Toggle */}
              {!saleToDelete.isReturned && (
                <label className="flex items-start gap-2.5 p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={deleteRestoreStock}
                    onChange={(e) => setDeleteRestoreStock(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <div className="text-slate-700">
                    <span className="font-bold block text-slate-900">
                      Satılmış malların sayı anbara geri qaytarılsın
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Seçilərsə, məhsulların anbardakı mövcud qalıq sayı bərpa olunacaq.
                    </span>
                  </div>
                </label>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSaleToDelete(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition cursor-pointer"
                >
                  İmtina
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteSale}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-md shadow-rose-600/20 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Bəli, Çeki Sil
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Return Sale Confirmation Modal */}
      {saleToReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-amber-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <RotateCcw className="w-5 h-5" />
                <h3 className="font-bold text-base">Satışı Qaytar (#{saleToReturn.id})</h3>
              </div>
              <button
                type="button"
                onClick={() => setSaleToReturn(null)}
                className="p-1 rounded-lg text-amber-200 hover:text-white hover:bg-amber-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900">
                <p className="font-bold text-sm mb-1">
                  #{saleToReturn.id} nömrəli satışı ləğv edib malları anbara qaytarmaq istəyirsiniz?
                </p>
                <p className="text-slate-600">
                  Mallar anbardakı saya bərpa olunacaq və çekin statusu "Qaytarılıb" olaraq dəyişdiriləcək.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Müştəri:</span>
                  <span className="font-bold text-slate-900">{saleToReturn.customerName || 'Anonim'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Məbləğ:</span>
                  <span className="font-bold text-slate-900">{saleToReturn.total.toFixed(2)} {setting.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Məhsullar:</span>
                  <span className="font-semibold text-slate-800">
                    {saleToReturn.items.length} növ məhsul
                  </span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSaleToReturn(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition cursor-pointer"
                >
                  İmtina
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReturnSale}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-md shadow-amber-600/20 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Bəli, Qaytar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. AI Seller Assistant Modal */}
      <AiSellerAssistantModal
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        onAddToCart={(p) => addToCart(p)}
      />
    </div>
  );
};
