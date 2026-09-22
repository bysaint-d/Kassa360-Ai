import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product, ProductVariant, CartRow, Sale, ActiveTab } from '../../types';
import {
  ShoppingCart,
  Barcode,
  Search,
  Package,
  Clock,
  User as UserIcon,
  Wifi,
  WifiOff,
  RefreshCw,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  X,
  CreditCard,
  Banknote,
  FileText,
  Camera,
  Layers,
  ArrowRight,
  Monitor,
  Printer,
  ChevronRight,
  Tag,
  Share2,
} from 'lucide-react';
import { UserSwitchModal } from '../UserSwitchModal';
import { ReceiptModal } from '../ReceiptModal';

export const MobileSellerApp: React.FC = () => {
  const {
    products,
    sales,
    setting,
    completeSale,
    currentUser,
    isOnline,
    pendingSyncCount,
    isSyncing,
    syncNow,
    setDeviceMode,
    byBarcode,
  } = useStore();

  // Navigation tab for mobile
  const [mobileTab, setMobileTab] = useState<'pos' | 'scanner' | 'catalog' | 'sales' | 'profile'>('pos');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Bütün mallar');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

  // Cart State
  const [cart, setCart] = useState<CartRow[]>([]);
  const [globalDiscount, setGlobalDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'Nağd' | 'Kart' | 'Borc'>('Nağd');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [customerName, setCustomerName] = useState('');
  const [saleNotes, setSaleNotes] = useState('');

  // Variant & Size selection modal
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemDiscount, setItemDiscount] = useState<number>(0);
  const [itemComment, setItemComment] = useState<string>('');

  // Receipt Modal after sale
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Scanner state
  const [manualBarcode, setManualBarcode] = useState('');
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Categories extraction
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['Bütün mallar', ...Array.from(set)];
  }, [products]);

  // Filtered products for POS
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'Bütün mallar' || p.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchCat;
      const matchSearch =
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.color && p.color.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart Calculations
  const cartTotals = useMemo(() => {
    const grossSubtotal = cart.reduce((sum, item) => sum + item.originalPrice * item.quantity, 0);
    const itemDiscountsTotal = cart.reduce((sum, item) => sum + item.discountAmount * item.quantity, 0);
    const subtotalAfterItemDiscounts = Math.max(0, grossSubtotal - itemDiscountsTotal);
    const clampedGlobalDiscount = Math.min(globalDiscount, subtotalAfterItemDiscounts);
    const finalTotal = Math.max(0, subtotalAfterItemDiscounts - clampedGlobalDiscount);
    const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    return {
      grossSubtotal: Number(grossSubtotal.toFixed(2)),
      itemDiscountsTotal: Number(itemDiscountsTotal.toFixed(2)),
      subtotalAfterItemDiscounts: Number(subtotalAfterItemDiscounts.toFixed(2)),
      globalDiscount: Number(clampedGlobalDiscount.toFixed(2)),
      totalDiscount: Number((itemDiscountsTotal + clampedGlobalDiscount).toFixed(2)),
      finalTotal: Number(finalTotal.toFixed(2)),
      totalItemsCount,
    };
  }, [cart, globalDiscount]);

  // Update default paidAmount when total changes
  useEffect(() => {
    if (paymentMethod !== 'Borc') {
      setPaidAmount(cartTotals.finalTotal);
    }
  }, [cartTotals.finalTotal, paymentMethod]);

  // Camera start/stop
  useEffect(() => {
    if (mobileTab === 'scanner') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [mobileTab]);

  const startCamera = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setIsCameraActive(true);
        }
      }
    } catch (e) {
      console.warn('Camera access not granted or not supported:', e);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Quick Barcode Scanning Handler
  const handleBarcodeSubmit = (barcodeValue: string) => {
    const code = barcodeValue.trim();
    if (!code) return;

    const found = byBarcode(code);
    if (found) {
      // Play scanner beep simulation
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } catch (e) {
        // ignore audio
      }

      // Add to cart directly or open size modal if variants exist
      if (found.variants && found.variants.length > 0) {
        openProductModal(found);
        setScanFeedback(`"${found.name}" tapıldı! Ölçü seçin.`);
      } else {
        addProductDirectlyToCart(found);
        setScanFeedback(`✅ "${found.name}" səbətə əlavə edildi!`);
      }
      setManualBarcode('');
      setTimeout(() => setScanFeedback(null), 3000);
    } else {
      setScanFeedback(`❌ "${code}" barkodlu məhsul tapılmadı!`);
      setTimeout(() => setScanFeedback(null), 3000);
    }
  };

  // Add simple product without variants directly to cart
  const addProductDirectlyToCart = (product: Product) => {
    const cartItemId = `${product.id}_default`;
    setCart((prev) => {
      const existing = prev.find((item) => item.cartItemId === cartItemId);
      if (existing) {
        return prev.map((item) =>
          item.cartItemId === cartItemId ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          cartItemId,
          product,
          quantity: 1,
          originalPrice: product.salePrice,
          discountAmount: 0,
          discountedUnitPrice: product.salePrice,
          total: product.salePrice,
        },
      ];
    });
  };

  // Open modal for clothing with sizes/colors/discounts
  const openProductModal = (product: Product) => {
    setSelectedProductForModal(product);
    setItemQuantity(1);
    setItemDiscount(0);
    setItemComment('');

    if (product.variants && product.variants.length > 0) {
      const firstAvailable = product.variants.find((v) => v.stockQuantity > 0) || product.variants[0];
      setSelectedVariantId(firstAvailable.id);
      setSelectedSize(firstAvailable.size);
      setSelectedColor(firstAvailable.color);
    } else {
      setSelectedVariantId('');
      setSelectedSize(product.size || '');
      setSelectedColor(product.color || '');
    }
  };

  // Add customized item from modal
  const handleConfirmAddToCart = () => {
    if (!selectedProductForModal) return;
    const p = selectedProductForModal;

    const cartItemId = `${p.id}_${selectedVariantId || selectedSize || 'std'}_${selectedColor || 'std'}`;
    const unitPrice = p.salePrice;
    const clampedDiscount = Math.min(itemDiscount, unitPrice);
    const discountedPrice = Math.max(0, unitPrice - clampedDiscount);

    setCart((prev) => {
      const existing = prev.find((item) => item.cartItemId === cartItemId);
      if (existing) {
        const newQty = existing.quantity + itemQuantity;
        return prev.map((item) =>
          item.cartItemId === cartItemId
            ? {
                ...item,
                quantity: newQty,
                discountAmount: clampedDiscount,
                discountedUnitPrice: discountedPrice,
                total: Number((discountedPrice * newQty).toFixed(2)),
                comment: itemComment || item.comment,
              }
            : item
        );
      }

      return [
        ...prev,
        {
          cartItemId,
          product: p,
          selectedVariantId: selectedVariantId || undefined,
          selectedSize: selectedSize || undefined,
          selectedColor: selectedColor || undefined,
          quantity: itemQuantity,
          originalPrice: unitPrice,
          discountAmount: clampedDiscount,
          discountedUnitPrice: discountedPrice,
          total: Number((discountedPrice * itemQuantity).toFixed(2)),
          comment: itemComment || undefined,
        },
      ];
    });

    setSelectedProductForModal(null);
  };

  const updateCartItemQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartItemId === cartItemId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            return {
              ...item,
              quantity: newQty,
              total: Number((item.discountedUnitPrice * newQty).toFixed(2)),
            };
          }
          return item;
        })
        .filter(Boolean) as CartRow[]
    );
  };

  const removeCartItem = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  // Complete Mobile Sale
  const handleCompleteSale = () => {
    if (cart.length === 0) return;

    if (paymentMethod === 'Borc' && !customerName.trim()) {
      alert('Borc satışı üçün müştərinin ad və soyadı mütləq daxil edilməlidir.');
      return;
    }

    try {
      const salePayload = {
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          discountAmount: item.discountAmount,
          size: item.selectedSize,
          color: item.selectedColor,
          variantId: item.selectedVariantId,
          comment: item.comment,
        })),
        discount: cartTotals.globalDiscount,
        paidAmount: paymentMethod === 'Borc' ? paidAmount : cartTotals.finalTotal,
        paymentMethod,
        customerName: customerName.trim() || undefined,
        notes: saleNotes.trim() || undefined,
      };

      const sale = completeSale(salePayload);
      setCompletedSale(sale);
      setIsReceiptOpen(true);

      // Reset cart
      setCart([]);
      setGlobalDiscount(0);
      setCustomerName('');
      setSaleNotes('');
      setIsCartOpen(false);
    } catch (err: any) {
      alert(err.message || 'Satış tamamlanarkən xəta baş verdi.');
    }
  };

  // Recent sales by this device/seller
  const recentSales = useMemo(() => {
    return sales.slice(0, 30);
  }, [sales]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans pb-20 select-none">
      {/* --- Top Mobile Header --- */}
      <header className="sticky top-0 z-40 bg-slate-900 text-white px-4 py-3 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center font-black text-sm">
            K
          </div>
          <div>
            <div className="text-xs font-bold text-slate-100 tracking-tight flex items-center gap-1.5">
              <span>{setting.storeName || 'Kassa360'}</span>
              <span className="text-[10px] font-normal text-blue-400 bg-blue-950 px-1.5 py-0.5 rounded">
                Mobil POS
              </span>
            </div>
            <button
              onClick={() => setIsUserModalOpen(true)}
              className="text-[11px] text-slate-300 flex items-center gap-1 hover:text-white"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              {currentUser?.fullName || 'Kassir'} ({currentUser?.role})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Online/Offline & Sync indicator */}
          <button
            onClick={() => syncNow()}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition ${
              isOnline
                ? pendingSyncCount > 0
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
            }`}
          >
            {isOnline ? (
              pendingSyncCount > 0 ? (
                <>
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{pendingSyncCount} gözləyir</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3 h-3" />
                  <span>Onlayn</span>
                </>
              )
            ) : (
              <>
                <WifiOff className="w-3 h-3" />
                <span>Oflayn {pendingSyncCount > 0 && `(${pendingSyncCount})`}</span>
              </>
            )}
          </button>

          {/* Switch to Desktop */}
          <button
            onClick={() => setDeviceMode('desktop')}
            title="Masaüstü Rejimə keç"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
          >
            <Monitor className="w-4 h-4" />
          </button>

          {/* Floating Cart Open Button */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition flex items-center shadow-md"
          >
            <ShoppingCart className="w-4 h-4" />
            {cartTotals.totalItemsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center border-2 border-slate-900">
                {cartTotals.totalItemsCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* --- Main Content Tab Switcher --- */}
      <main className="flex-1 p-3">
        {/* TAB 1: POS & Sales */}
        {mobileTab === 'pos' && (
          <div className="space-y-3">
            {/* Search and Barcode quick-input */}
            <div className="relative flex items-center">
              <Search className="w-4 h-4 absolute left-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Məhsul adı, barkod, brend və ya ölçü..."
                className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category horizontal scroll bar */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {filteredProducts.map((p) => {
                const hasVariants = p.variants && p.variants.length > 0;
                const isOutOfStock = p.stockQuantity <= 0;

                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      if (hasVariants) {
                        openProductModal(p);
                      } else {
                        addProductDirectlyToCart(p);
                      }
                    }}
                    className={`bg-white rounded-xl p-3 border border-slate-200/80 shadow-2xs flex flex-col justify-between active:scale-[0.98] transition cursor-pointer ${
                      isOutOfStock ? 'opacity-60' : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          {p.brand || p.category || 'Paltar'}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                            isOutOfStock
                              ? 'bg-rose-100 text-rose-700'
                              : p.stockQuantity <= p.minimumStock
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {p.stockQuantity} ədəd
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-tight">
                        {p.name}
                      </h4>

                      {/* Sizes badges */}
                      {hasVariants && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {p.variants?.slice(0, 4).map((v) => (
                            <span
                              key={v.id}
                              className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1 py-0.2 rounded border border-slate-200"
                            >
                              {v.size}
                            </span>
                          ))}
                          {(p.variants?.length || 0) > 4 && (
                            <span className="text-[9px] text-slate-400">+{p.variants!.length - 4}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-sm font-black text-slate-900">
                        {p.salePrice.toFixed(2)} ₼
                      </span>
                      <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xs">
                        +
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-6">
                <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-600">Axtarışa uyğun məhsul tapılmadı</p>
                <p className="text-[11px] text-slate-400 mt-1">Barkod və ya adı dəyişib yenidən yoxlayın</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Live Barcode Scanner */}
        {mobileTab === 'scanner' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-600" />
                Kamera Barkod Skanneri
              </h3>

              {/* Camera Viewfinder */}
              <div className="relative w-full aspect-4/3 bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center border-2 border-dashed border-blue-400/60">
                {isCameraActive ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-4">
                    <Camera className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 font-medium">Kamera aktivləşdirilir və ya əlçatan deyil</p>
                    <button
                      onClick={startCamera}
                      className="mt-2 text-xs font-bold text-blue-400 bg-slate-800 px-3 py-1.5 rounded-lg"
                    >
                      Kameranı Başlat
                    </button>
                  </div>
                )}

                {/* Reticle guide */}
                <div className="absolute inset-x-8 inset-y-12 border-2 border-emerald-400/80 rounded-lg pointer-events-none flex flex-col justify-between p-2">
                  <div className="flex justify-between">
                    <span className="w-4 h-4 border-t-2 border-l-2 border-emerald-400"></span>
                    <span className="w-4 h-4 border-t-2 border-r-2 border-emerald-400"></span>
                  </div>
                  <div className="h-0.5 bg-emerald-400/60 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse"></div>
                  <div className="flex justify-between">
                    <span className="w-4 h-4 border-b-2 border-l-2 border-emerald-400"></span>
                    <span className="w-4 h-4 border-b-2 border-r-2 border-emerald-400"></span>
                  </div>
                </div>
              </div>

              {/* Feedback toast */}
              {scanFeedback && (
                <div className="mt-3 p-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold text-center animate-in fade-in">
                  {scanFeedback}
                </div>
              )}

              {/* Manual Barcode entry */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-600 block mb-1.5">
                  Və ya Barkodu Əllə Daxil Edin:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualBarcode}
                    onChange={(e) => setManualBarcode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleBarcodeSubmit(manualBarcode)}
                    placeholder="Məs: 4760012300012"
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <button
                    onClick={() => handleBarcodeSubmit(manualBarcode)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs"
                  >
                    Tap
                  </button>
                </div>
              </div>

              {/* Fast Test Barcode Buttons */}
              <div className="mt-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Sürətli Sınaq Barkodları:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {products.slice(0, 4).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => p.barcode && handleBarcodeSubmit(p.barcode)}
                      className="text-[11px] font-semibold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 transition"
                    >
                      {p.name.substring(0, 16)}...
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Catalog View */}
        {mobileTab === 'catalog' && (
          <div className="space-y-3">
            <div className="bg-white rounded-xl p-3 border border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Məhsul Kataloqu</h3>
                <p className="text-xs text-slate-500">{products.length} məhsul qeydiyyatdadır</p>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                Stok Cəmi: {products.reduce((acc, p) => acc + p.stockQuantity, 0)} ədəd
              </span>
            </div>

            <div className="space-y-2">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-xl p-3 border border-slate-200 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-slate-900 truncate">{p.name}</span>
                      {p.color && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                          {p.color}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Barkod: {p.barcode} • {p.category}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black text-slate-900">{p.salePrice.toFixed(2)} ₼</div>
                    <div
                      className={`text-[11px] font-bold ${
                        p.stockQuantity <= 0
                          ? 'text-rose-600'
                          : p.stockQuantity <= p.minimumStock
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {p.stockQuantity} ədəd
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: Recent Sales */}
        {mobileTab === 'sales' && (
          <div className="space-y-3">
            <div className="bg-white rounded-xl p-3 border border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Son Satışlar</h3>
                <p className="text-xs text-slate-500">Bu gün edilən əməliyyatlar</p>
              </div>
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                {recentSales.length} satış
              </span>
            </div>

            <div className="space-y-2">
              {recentSales.map((s) => (
                <div
                  key={s.id}
                  onClick={() => {
                    setCompletedSale(s);
                    setIsReceiptOpen(true);
                  }}
                  className="bg-white rounded-xl p-3 border border-slate-200 flex items-center justify-between cursor-pointer hover:border-slate-300 transition"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">Çek #{s.id}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          s.syncStatus === 'PENDING_SYNC'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {s.syncStatus === 'PENDING_SYNC' ? 'Oflayn (Gözləyir)' : 'Sinxron'}
                      </span>
                      {s.isReturned && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 bg-rose-100 text-rose-800 rounded">
                          Qaytarılıb
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {new Date(s.date).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })} •{' '}
                      {s.paymentMethod} {s.customerName ? `• ${s.customerName}` : ''}
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <div className="text-sm font-black text-slate-900">{s.total.toFixed(2)} ₼</div>
                      <div className="text-[10px] text-slate-400">{s.items.length} məhsul</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: Profile & Shift Summary */}
        {mobileTab === 'profile' && (
          <div className="space-y-4">
            {/* User card */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-black text-lg flex items-center justify-center shadow-xs">
                    {currentUser?.fullName.substring(0, 2).toUpperCase() || 'KS'}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{currentUser?.fullName}</h3>
                    <p className="text-xs text-slate-500">@{currentUser?.username} • Rol: {currentUser?.role}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsUserModalOpen(true)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Dəyiş
                </button>
              </div>

              {/* Sync status card */}
              <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-700 block">Sinxronizasiya Vəziyyəti</span>
                  <span className="text-[11px] text-slate-500">
                    {isOnline ? 'Mərkəzi serverlə əlaqə var' : 'Oflayn rejim aktivdir'}
                  </span>
                </div>
                <button
                  onClick={() => syncNow()}
                  disabled={isSyncing}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Gedir...' : 'İndi Sinxronlaşdır'}
                </button>
              </div>
            </div>

            {/* Shift Sales Summary */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Bugünkü Növbə Hesabatı
              </h4>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-[11px] text-slate-500 block">Ümumi Satış</span>
                  <span className="text-base font-black text-slate-900">
                    {sales.filter((s) => !s.isReturned).reduce((acc, s) => acc + s.total, 0).toFixed(2)} ₼
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-[11px] text-slate-500 block">Çek Sayı</span>
                  <span className="text-base font-black text-slate-900">
                    {sales.filter((s) => !s.isReturned).length} ədəd
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- CART SLIDE-OVER DRAWER --- */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-t-3xl max-h-[90vh] flex flex-col shadow-2xl border-t border-slate-200 animate-in slide-in-from-bottom duration-200">
            {/* Drawer Header */}
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Səbət ({cartTotals.totalItemsCount} ədəd)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="text-xs text-rose-600 font-semibold px-2 py-1 rounded-lg hover:bg-rose-50"
                  >
                    Təmizlə
                  </button>
                )}
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[140px] max-h-[35vh]">
              {cart.map((item) => (
                <div
                  key={item.cartItemId}
                  className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-bold text-slate-900 truncate">{item.product.name}</h5>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                      {item.selectedSize && (
                        <span className="font-bold bg-white px-1.5 py-0.2 rounded border border-slate-200 text-slate-700">
                          Ölçü: {item.selectedSize}
                        </span>
                      )}
                      {item.selectedColor && <span>Rəng: {item.selectedColor}</span>}
                    </div>
                    {item.discountAmount > 0 && (
                      <span className="text-[10px] text-rose-600 font-bold">
                        Endirim: -{item.discountAmount.toFixed(2)} ₼
                      </span>
                    )}
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                      <button
                        onClick={() => updateCartItemQuantity(item.cartItemId, -1)}
                        className="p-1.5 text-slate-600 hover:bg-slate-100"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-2 text-xs font-black text-slate-900 min-w-6 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateCartItemQuantity(item.cartItemId, 1)}
                        className="p-1.5 text-slate-600 hover:bg-slate-100"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-right min-w-14">
                      <span className="text-xs font-black text-slate-900 block">
                        {item.total.toFixed(2)} ₼
                      </span>
                    </div>

                    <button
                      onClick={() => removeCartItem(item.cartItemId)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {cart.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <ShoppingCart className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                  <p className="text-xs">Səbət boşdur</p>
                </div>
              )}
            </div>

            {/* Payment & Final Checkout */}
            {cart.length > 0 && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
                {/* Global Discount input */}
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-slate-400" />
                    Səbətə Ümumi Endirim (₼):
                  </span>
                  <input
                    type="number"
                    min="0"
                    max={cartTotals.subtotalAfterItemDiscounts}
                    value={globalDiscount || ''}
                    onChange={(e) => setGlobalDiscount(Math.max(0, Number(e.target.value)))}
                    placeholder="0.00"
                    className="w-20 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Payment Method Selector */}
                <div className="grid grid-cols-3 gap-2">
                  {(['Nağd', 'Kart', 'Borc'] as const).map((method) => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                        paymentMethod === method
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {method === 'Nağd' && <Banknote className="w-3.5 h-3.5" />}
                      {method === 'Kart' && <CreditCard className="w-3.5 h-3.5" />}
                      {method === 'Borc' && <FileText className="w-3.5 h-3.5" />}
                      {method}
                    </button>
                  ))}
                </div>

                {/* Debt Customer input */}
                {paymentMethod === 'Borc' && (
                  <div className="space-y-2 p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <label className="text-xs font-bold text-amber-900 block">
                      Borc Alan Müştərinin Adı: *
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Məs: Əli Həsənov"
                      className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                )}

                {/* Total and Submit */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 block">Yekun Ödəniləcək:</span>
                    <span className="text-xl font-black text-slate-900">
                      {cartTotals.finalTotal.toFixed(2)} ₼
                    </span>
                  </div>

                  <button
                    onClick={handleCompleteSale}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-sm rounded-2xl shadow-md transition flex items-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Satışı Tamamla
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- PRODUCT SIZE & VARIANT PICKER MODAL --- */}
      {selectedProductForModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 border border-slate-200 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in duration-150">
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  {selectedProductForModal.brand || selectedProductForModal.category}
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-1">
                  {selectedProductForModal.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedProductForModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Variants / Sizes Grid */}
            {selectedProductForModal.variants && selectedProductForModal.variants.length > 0 && (
              <div className="my-3">
                <label className="text-xs font-bold text-slate-600 block mb-2">
                  Ölçü Seçin:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {selectedProductForModal.variants.map((v) => {
                    const isSelected = selectedVariantId === v.id;
                    const isOut = v.stockQuantity <= 0;
                    return (
                      <button
                        key={v.id}
                        disabled={isOut}
                        onClick={() => {
                          setSelectedVariantId(v.id);
                          setSelectedSize(v.size);
                          setSelectedColor(v.color);
                        }}
                        className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-2xs'
                            : isOut
                            ? 'border-slate-200 bg-slate-50 text-slate-300 opacity-60 cursor-not-allowed'
                            : 'border-slate-200 hover:border-slate-300 bg-white text-slate-800'
                        }`}
                      >
                        <span className="text-xs font-black block">{v.size}</span>
                        <span className="text-[10px] text-slate-500 block">
                          {isOut ? 'Bitib' : `${v.stockQuantity} ədəd`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity and Discount row */}
            <div className="grid grid-cols-2 gap-3 my-4">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Miqdar:</label>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                    className="p-2 text-slate-600 hover:bg-slate-200"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="flex-1 text-center font-black text-sm text-slate-900">
                    {itemQuantity}
                  </span>
                  <button
                    onClick={() => setItemQuantity(itemQuantity + 1)}
                    className="p-2 text-slate-600 hover:bg-slate-200"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Endirim (₼/ədəd):</label>
                <input
                  type="number"
                  min="0"
                  max={selectedProductForModal.salePrice}
                  value={itemDiscount || ''}
                  onChange={(e) => setItemDiscount(Math.max(0, Number(e.target.value)))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Custom note/comment */}
            <div className="mb-4">
              <label className="text-xs font-bold text-slate-600 block mb-1">Xüsusi Şərh (İstəyə görə):</label>
              <input
                type="text"
                value={itemComment}
                onChange={(e) => setItemComment(e.target.value)}
                placeholder="Məs: sabah gəlib götürəcək"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Confirm Add */}
            <button
              onClick={handleConfirmAddToCart}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              Səbətə Əlavə Et (
              {(
                Math.max(0, selectedProductForModal.salePrice - itemDiscount) * itemQuantity
              ).toFixed(2)}{' '}
              ₼)
            </button>
          </div>
        </div>
      )}

      {/* --- BOTTOM MOBILE NAVIGATION BAR --- */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200/90 shadow-lg px-2 py-1.5 flex items-center justify-around">
        <button
          onClick={() => setMobileTab('pos')}
          className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition cursor-pointer ${
            mobileTab === 'pos' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="text-[10px]">Kassa</span>
        </button>

        <button
          onClick={() => setMobileTab('scanner')}
          className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition cursor-pointer ${
            mobileTab === 'scanner' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Barcode className="w-5 h-5" />
          <span className="text-[10px]">Skanner</span>
        </button>

        <button
          onClick={() => setMobileTab('catalog')}
          className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition cursor-pointer ${
            mobileTab === 'catalog' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Package className="w-5 h-5" />
          <span className="text-[10px]">Kataloq</span>
        </button>

        <button
          onClick={() => setMobileTab('sales')}
          className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition cursor-pointer ${
            mobileTab === 'sales' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Clock className="w-5 h-5" />
          <span className="text-[10px]">Çeklər</span>
        </button>

        <button
          onClick={() => setMobileTab('profile')}
          className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition cursor-pointer ${
            mobileTab === 'profile' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <UserIcon className="w-5 h-5" />
          <span className="text-[10px]">Profil</span>
        </button>
      </nav>

      {/* User Switch Modal */}
      <UserSwitchModal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} />

      {/* Receipt Modal */}
      {completedSale && isReceiptOpen && (
        <ReceiptModal
          sale={completedSale}
          onClose={() => {
            setIsReceiptOpen(false);
            setCompletedSale(null);
          }}
        />
      )}
    </div>
  );
};
