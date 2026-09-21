import React, { useState } from 'react';
import { Sparkles, Image as ImageIcon, RotateCw, Check, X, Loader2, AlertCircle } from 'lucide-react';
import { aiApi } from '../services/aiApi';

interface AiProductImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUseImage: (imageUrl: string) => void;
  initialName: string;
  category?: string;
  color?: string;
  brand?: string;
  notes?: string;
  currentImage?: string;
}

export const AiProductImageModal: React.FC<AiProductImageModalProps> = ({
  isOpen,
  onClose,
  onUseImage,
  initialName,
  category,
  color,
  brand,
  notes,
  currentImage,
}) => {
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!initialName.trim()) {
      setError('Məhsul adı daxil edilməlidir.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await aiApi.generateProductImage({
        name: initialName,
        category,
        color,
        brand,
        notes,
      });

      if (result.imageUrl) {
        setGeneratedImage(result.imageUrl);
        setHasGeneratedOnce(true);
      } else {
        setError('Şəkil yaradıla bilmədi. Yenidən cəhd edin.');
      }
    } catch (err: any) {
      setError(err?.message || 'Şəkil yaradılarkən xəta baş verdi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseImage = () => {
    if (generatedImage) {
      onUseImage(generatedImage);
      onClose();
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col border border-slate-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/50 flex items-center justify-center text-indigo-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">AI Məhsul Şəkli Generatoru</h3>
              <p className="text-[11px] text-indigo-200">E-ticarət studiya çəkilişi üslubunda</p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Product context info */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Məhsul adı:</span>
              <span className="font-bold text-slate-900">{initialName || 'Qeyd edilməyib'}</span>
            </div>
            {(category || color || brand) && (
              <div className="flex items-center gap-2 text-[11px] text-slate-600 pt-1 border-t border-slate-200/50">
                {category && <span className="bg-white px-2 py-0.5 rounded border border-slate-200">{category}</span>}
                {color && <span className="bg-white px-2 py-0.5 rounded border border-slate-200">{color}</span>}
                {brand && <span className="bg-white px-2 py-0.5 rounded border border-slate-200">{brand}</span>}
              </div>
            )}
          </div>

          {/* Image Display / Preview Area */}
          <div className="relative aspect-square w-full max-w-[280px] mx-auto bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden shadow-inner">
            {isLoading ? (
              <div className="flex flex-col items-center gap-2.5 text-center p-4">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                <p className="text-xs font-semibold text-slate-700">AI studiya şəkli yaradılır...</p>
                <p className="text-[10px] text-slate-400">Rəng, parça və model parametrləri tətbiq olunur</p>
              </div>
            ) : generatedImage ? (
              <img
                src={generatedImage}
                alt={initialName}
                className="w-full h-full object-contain p-2"
                referrerPolicy="no-referrer"
              />
            ) : currentImage ? (
              <div className="relative w-full h-full">
                <img
                  src={currentImage}
                  alt="Mövcud şəkil"
                  className="w-full h-full object-contain p-2"
                  referrerPolicy="no-referrer"
                />
                <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded">
                  Mövcud şəkil
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-center p-4 text-slate-400">
                <ImageIcon className="w-10 h-10 text-slate-300" />
                <p className="text-xs">Şəkil yaratmaq üçün aşağıdakı "Yarat" düyməsinə klikləyin.</p>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Controls: Generate, Regenerate, Use Image, Cancel */}
          <div className="pt-2 flex flex-col gap-2">
            {!hasGeneratedOnce && !generatedImage ? (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Yarat (Generate)</span>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Yenidən Yarat (Regenerate)</span>
                </button>

                <button
                  type="button"
                  onClick={handleUseImage}
                  disabled={isLoading || !generatedImage}
                  className="py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Şəkli İstifadə Et (Use Image)</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleCancel}
              className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition cursor-pointer"
            >
              Ləğv et (Cancel)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
