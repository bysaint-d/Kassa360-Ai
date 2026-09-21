import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  X,
  Bot,
  User,
  Package,
  ShoppingCart,
  Calendar,
  DollarSign,
  Loader2,
  ChevronRight,
  Maximize2,
  Minimize2,
  Trash2,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { aiApi, SellerAssistantResponse } from '../services/aiApi';
import { Product } from '../types';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  time: string;
  matchedProducts?: any[];
  suggestedActions?: { label: string; action: string; payload?: any }[];
}

interface AiSellerAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
  onAddToCart?: (product: Product, size?: string) => void;
}

const QUICK_QUESTIONS = [
  'Bugünkü satışlar necədir?',
  'Qara kostyum 52 razmer varmı?',
  'M ölçü köynəklər hansılardır?',
  'Stokda ən az qalan mallar hansılardır?',
];

export const AiSellerAssistantModal: React.FC<AiSellerAssistantModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onAddToCart,
}) => {
  const { products, sales, categories, setting } = useStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Salam! Mən Kassa360 ağıllı satıcı köməkçisiyəm. Məndən məhsul axtarışı, qiymət, ölçü, anbar qalığı və ya bugünkü satış statistikasını soruşa bilərsiniz.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedActions: [
        { label: 'Bugünkü satışlar necədir?', action: 'ASK', payload: 'Bugünkü satışlar necədir?' },
        { label: 'Qara kostyum varmı?', action: 'ASK', payload: 'Qara kostyum varmı?' },
      ],
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  // Controlled store snapshot for assistant
  const getControlledStoreContext = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todaySales = sales.filter((s) => s.date.startsWith(todayStr) && !s.isReturned);
    const todaySalesTotal = todaySales.reduce((sum, s) => sum + s.total, 0);
    const todaySalesCount = todaySales.length;

    const sampleProducts = products.map((p) => ({
      id: p.id,
      name: p.name,
      barcode: p.barcode,
      category: p.category,
      brand: p.brand,
      color: p.color,
      sizes: p.sizes || (p.size ? [p.size] : []),
      salePrice: p.salePrice,
      stockQuantity: p.stockQuantity,
    }));

    return {
      productsCount: products.length,
      todaySalesTotal,
      todaySalesCount,
      topProductsSummary: sampleProducts.slice(0, 5).map((p) => `${p.name} (${p.salePrice} AZN, stok: ${p.stockQuantity})`),
      sampleProducts,
    };
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? inputText).trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const storeContext = getControlledStoreContext();
      const response: SellerAssistantResponse = await aiApi.askSellerAssistant({
        message: text,
        storeContext,
      });

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: response.reply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        matchedProducts: response.matchedProducts,
        suggestedActions: response.suggestedActions,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: 'Bağışlayın, cavab hazırlanarkən xəta baş verdi. Zəhmət olmasa bir az sonra yenidən cəhd edin.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionClick = (action: { label: string; action: string; payload?: any }) => {
    if (action.action === 'ASK') {
      handleSendMessage(action.payload || action.label);
    } else if (action.action === 'NAVIGATE_TAB') {
      onNavigateTab?.(action.payload);
      onClose();
    } else if (action.action === 'ADD_TO_CART') {
      const p = products.find((prod) => prod.id === action.payload?.id);
      if (p && onAddToCart) {
        onAddToCart(p);
      }
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome_reset',
        sender: 'assistant',
        text: 'Söhbət tarixçəsi təmizləndi. Necə kömək edə bilərəm?',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end sm:p-6 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md h-[85vh] sm:h-[620px] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white p-3.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
                <Sparkles className="w-4 h-4 animate-pulse" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900" />
            </div>
            <div>
              <h3 className="font-bold text-sm flex items-center gap-1.5">
                <span>Kassa360 Satıcı Assistent</span>
                <span className="text-[10px] bg-indigo-800 text-indigo-200 font-mono px-1.5 py-0.5 rounded">AI</span>
              </h3>
              <p className="text-[11px] text-slate-300">Stok, qiymət, ölçü və satış köməkçisi</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleClearHistory}
              title="Tarixçəni təmizlə"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/70">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[85%] space-y-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`p-3 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-br-xs shadow-xs'
                        : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs shadow-2xs whitespace-pre-line'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* Matched Products Cards (if any) */}
                  {msg.matchedProducts && msg.matchedProducts.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Tapılan Məhsullar:
                      </span>
                      {msg.matchedProducts.map((p: any) => (
                        <div
                          key={p.id}
                          className="p-2.5 bg-white border border-indigo-100 hover:border-indigo-300 rounded-xl shadow-2xs flex items-center justify-between gap-2 transition"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-xs text-slate-900 truncate">{p.name}</p>
                            <p className="text-[11px] text-slate-500">
                              Qiymət: <span className="font-bold text-slate-800">{p.salePrice} AZN</span> • Stok: <span className="font-bold text-emerald-700">{p.stockQuantity} ədəd</span>
                            </p>
                            {p.sizes && p.sizes.length > 0 && (
                              <p className="text-[10px] text-indigo-600 mt-0.5 font-medium">
                                Ölçülər: {p.sizes.join(', ')}
                              </p>
                            )}
                          </div>

                          {onAddToCart && (
                            <button
                              type="button"
                              onClick={() => {
                                const realProd = products.find((pr) => pr.id === p.id);
                                if (realProd) onAddToCart(realProd);
                              }}
                              className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                              title="Kassaya əlavə et"
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                              <span>Səbətə at</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Suggested Quick Actions */}
                  {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {msg.suggestedActions.map((act, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleActionClick(act)}
                          className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-indigo-700 rounded-lg text-[11px] font-semibold transition cursor-pointer shadow-2xs"
                        >
                          {act.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <span className="text-[10px] text-slate-400 block px-1">
                    {msg.time}
                  </span>
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-lg bg-slate-800 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-2.5 items-center">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-2xl rounded-bl-xs text-xs text-slate-500 flex items-center gap-2 shadow-2xs">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Baza yoxlanılır və cavab hazırlanır...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick prompt suggestions ribbon */}
        <div className="px-3 py-2 bg-slate-100/90 border-t border-slate-200 flex items-center gap-1.5 overflow-x-auto text-[11px]">
          <span className="text-slate-400 font-bold whitespace-nowrap">Sürətli:</span>
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => handleSendMessage(q)}
              className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 rounded-lg whitespace-nowrap transition cursor-pointer shadow-2xs"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Sualınızı yazın (məs: 52 razmer qara kostyum varmı?)..."
            className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={isLoading || !inputText.trim()}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl shadow-xs transition cursor-pointer shrink-0"
            title="Göndər"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
