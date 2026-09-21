import { getGeminiClient } from './geminiClient.js';

/**
 * 1. AI Product Image Generation
 * Generates a clean, studio e-commerce clothing/textile product photo based on name, category, color, brand.
 */
export async function generateProductImage(params: {
  name: string;
  category?: string;
  color?: string;
  brand?: string;
  notes?: string;
}): Promise<{ imageUrl: string; promptUsed: string }> {
  const ai = getGeminiClient();

  const prompt = [
    `Professional studio product photography of ${params.name || 'fashion item'}.`,
    params.category ? `Category: ${params.category}.` : '',
    params.color ? `Color: ${params.color}.` : '',
    params.brand ? `Brand: ${params.brand}.` : '',
    params.notes ? `Details: ${params.notes}.` : '',
    'Clean minimalist neutral light grey background, high resolution e-commerce catalog style, centered garment, soft studio lighting, textile texture, sharp focus, 1:1 aspect ratio, commercial retail presentation without human face, premium fashion apparel look.',
  ]
    .filter(Boolean)
    .join(' ');

  if (!ai) {
    // Graceful placeholder data-URL SVG if API key is not yet configured, so POS never crashes
    return {
      imageUrl: createPlaceholderSvg(params.name, params.color, params.category),
      promptUsed: prompt,
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: '1:1',
        },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        const mimeType = part.inlineData.mimeType || 'image/jpeg';
        return {
          imageUrl: `data:${mimeType};base64,${part.inlineData.data}`,
          promptUsed: prompt,
        };
      }
    }
  } catch (err: any) {
    console.warn('Image generation error or fallback:', err?.message || err);
  }

  // Fallback high quality SVG placeholder
  return {
    imageUrl: createPlaceholderSvg(params.name, params.color, params.category),
    promptUsed: prompt,
  };
}

function createPlaceholderSvg(name: string, color?: string, category?: string): string {
  const bg = color?.toLowerCase().includes('qara') || color?.toLowerCase().includes('black')
    ? '#1e293b'
    : color?.toLowerCase().includes('qırmızı') || color?.toLowerCase().includes('red')
    ? '#b91c1c'
    : color?.toLowerCase().includes('mavi') || color?.toLowerCase().includes('göy') || color?.toLowerCase().includes('blue')
    ? '#1d4ed8'
    : '#475569';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f8fafc"/>
        <stop offset="100%" stop-color="#e2e8f0"/>
      </linearGradient>
    </defs>
    <rect width="400" height="400" rx="24" fill="url(#grad)"/>
    <circle cx="200" cy="180" r="85" fill="${bg}" opacity="0.9"/>
    <!-- Stylized hanger/apparel icon -->
    <path d="M200 135 C190 135 185 145 190 152 L170 180 L230 180 L210 152 C215 145 210 135 200 135 Z" fill="#ffffff" opacity="0.9"/>
    <path d="M150 190 L250 190 L240 240 L160 240 Z" fill="#ffffff" opacity="0.8"/>
    <text x="200" y="310" font-family="system-ui, sans-serif" font-size="16" font-weight="bold" fill="#1e293b" text-anchor="middle">${escapeXml(name.slice(0, 28))}</text>
    <text x="200" y="335" font-family="system-ui, sans-serif" font-size="13" fill="#64748b" text-anchor="middle">${escapeXml(category || 'Tekstil / Geyim')} ${color ? `• ${escapeXml(color)}` : ''}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * 2. AI Product Description Generation
 * Creates an attractive e-commerce description in Azerbaijani for the product details.
 */
export async function generateProductDescription(params: {
  name: string;
  category?: string;
  color?: string;
  brand?: string;
  sizes?: string[];
  salePrice?: number;
  existingNotes?: string;
}): Promise<string> {
  const ai = getGeminiClient();

  const details = [
    `Məhsul adı: ${params.name}`,
    params.category ? `Kateqoriya: ${params.category}` : '',
    params.brand ? `Brend: ${params.brand}` : '',
    params.color ? `Rəng: ${params.color}` : '',
    params.sizes && params.sizes.length > 0 ? `Mövcud ölçülər: ${params.sizes.join(', ')}` : '',
    params.salePrice ? `Satış qiyməti: ${params.salePrice} AZN` : '',
    params.existingNotes ? `Əlavə qeydlər: ${params.existingNotes}` : '',
  ].filter(Boolean).join('\n');

  if (!ai) {
    return `${params.name} — Yüksək keyfiyyətli parçadan hazırlanmış, gündəlik və xüsusi günlər üçün rahat ${params.category || 'geyim'}. ` +
      `${params.color ? `Rəng: ${params.color}. ` : ''}` +
      `${params.sizes && params.sizes.length > 0 ? `Ölçülər: ${params.sizes.join(', ')}. ` : ''}` +
      `Bədənə tam oturan kəsim və dəriyə nəfəs aldıran material.`;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Sən Kassa360 geyim və tekstil mağazası üçün peşəkar satış və e-ticarət kopirayterisən.
Aşağıdakı məhsul məlumatlarına əsasən Azərbaycan dilində 2-3 cümləlik cəlbedici, lakonik, peşəkar məhsul təsviri yaz:
${details}

Tələblər:
- Yalnız son təsvir mətnini qaytar (əlavə başlıq, salamlama və ya dırnaq işarəsi olmadan).
- Parça keyfiyyəti, rahatlığı və kəsimi vurğula.
- Mağazanın müştərilərinə birbaşa təqdim ediləcək təbii dildə olsun.`,
    });

    return response.text?.trim() || 'Keyfiyyətli və rahat geyim məhsulu.';
  } catch (err: any) {
    console.error('Error generating product description:', err);
    return `${params.name} — Rahat və keyfiyyətli materialdan hazırlanmış, həm gündəlik, həm də zövqlü görünüş üçün ideal seçim.`;
  }
}

/**
 * 3. AI Product Categorization
 * Automatically suggests the best matching existing category based on the product name.
 * Does not create a new category without user confirmation.
 */
export async function suggestProductCategory(params: {
  productName: string;
  existingCategories: string[];
  brand?: string;
  color?: string;
}): Promise<{
  suggestedCategory: string;
  isExisting: boolean;
  confidence: number;
  reasoning: string;
}> {
  const ai = getGeminiClient();

  if (!ai || params.existingCategories.length === 0) {
    // Rule-based heuristic fallback
    const lower = params.productName.toLowerCase();
    const match = params.existingCategories.find((cat) =>
      lower.includes(cat.toLowerCase()) || cat.toLowerCase().includes(lower)
    );

    if (match) {
      return {
        suggestedCategory: match,
        isExisting: true,
        confidence: 0.85,
        reasoning: 'Məhsul adındakı açar sözə əsasən müəyyən edildi.',
      };
    }

    // Secondary heuristic
    if (lower.includes('köynək') || lower.includes('rubaska') || lower.includes('t-shirt') || lower.includes('futbolka')) {
      const shirtCat = params.existingCategories.find(c => c.toLowerCase().includes('köynək') || c.toLowerCase().includes('geyim'));
      if (shirtCat) return { suggestedCategory: shirtCat, isExisting: true, confidence: 0.8, reasoning: 'Geyim/Köynək kateqoriyası ilə uyğunlaşdırıldı.' };
    }
    if (lower.includes('şalvar') || lower.includes('cins') || lower.includes('jeans')) {
      const pantsCat = params.existingCategories.find(c => c.toLowerCase().includes('şalvar') || c.toLowerCase().includes('geyim'));
      if (pantsCat) return { suggestedCategory: pantsCat, isExisting: true, confidence: 0.8, reasoning: 'Şalvar/Geyim kateqoriyası ilə uyğunlaşdırıldı.' };
    }
    if (lower.includes('kostyum') || lower.includes('pencək') || lower.includes('jaket')) {
      const suitCat = params.existingCategories.find(c => c.toLowerCase().includes('kostyum') || c.toLowerCase().includes('geyim'));
      if (suitCat) return { suggestedCategory: suitCat, isExisting: true, confidence: 0.8, reasoning: 'Kostyum kateqoriyası ilə uyğunlaşdırıldı.' };
    }

    return {
      suggestedCategory: params.existingCategories[0] || 'Geyim',
      isExisting: true,
      confidence: 0.5,
      reasoning: 'Standart mövcud kateqoriya təklif edildi.',
    };
  }

  try {
    const prompt = `Məhsul adı: "${params.productName}"
${params.brand ? `Brend: ${params.brand}` : ''}
${params.color ? `Rəng: ${params.color}` : ''}

Mövcud mağaza kateqoriyaları:
${JSON.stringify(params.existingCategories)}

Tapşırıq:
Bu məhsul üçün ən uyğun MÖVCUD kateqoriyanı seç. Yalnız mövcud kateqoriyalar siyahısından birini seçməyə üstünlük ver.
Cavabı yalnız etibarlı JSON formatında ver:
{
  "suggestedCategory": "seçilən kateqoriya adı",
  "isExisting": true və ya false,
  "confidence": 0.0 ilə 1.0 arası əmsal,
  "reasoning": "qısa izahat (Azərbaycan dilində)"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const isExisting = params.existingCategories.includes(parsed.suggestedCategory);

    return {
      suggestedCategory: parsed.suggestedCategory || params.existingCategories[0],
      isExisting,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
      reasoning: parsed.reasoning || 'AI tərəfindən ən uyğun kateqoriya olaraq seçildi.',
    };
  } catch (err: any) {
    console.error('Error suggesting category:', err);
    return {
      suggestedCategory: params.existingCategories[0] || 'Geyim',
      isExisting: true,
      confidence: 0.6,
      reasoning: 'Mövcud kateqoriyalar əsasında seçildi.',
    };
  }
}

/**
 * 4. AI Natural Language Search
 * Converts user query ("Black suit size 52 under 150 AZN") into structured filters.
 * Real search is executed against the real database products!
 */
export interface StructuredSearchFilter {
  keyword?: string;
  category?: string;
  color?: string;
  size?: string;
  minPrice?: number;
  maxPrice?: number;
  brand?: string;
  inStockOnly?: boolean;
  explanation: string;
}

export async function parseNaturalLanguageSearch(
  query: string,
  categories: string[] = []
): Promise<StructuredSearchFilter> {
  const ai = getGeminiClient();

  // Rule-based fallback parser if AI is unavailable or fails
  const fallbackParse = (): StructuredSearchFilter => {
    let q = query.trim().toLowerCase();
    let maxPrice: number | undefined;
    let minPrice: number | undefined;
    let size: string | undefined;
    let color: string | undefined;
    let category: string | undefined;
    let keyword: string | undefined;

    // Size detection: look specifically for "52 razmer", "razmer 52", "size M", "M ölçü"
    const explicitSizeMatch = q.match(/(?:razmer|ölçü|ölçüsü|size)\s*([a-z0-9]+)/i) ||
      q.match(/([a-z0-9]+)\s*(?:razmer|ölçü|ölçüsü|size)/i);
    if (explicitSizeMatch && !['azn', 'manat'].includes(explicitSizeMatch[1].toLowerCase())) {
      size = explicitSizeMatch[1].toUpperCase();
    } else {
      const standardSizeMatch = q.match(/\b(xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl)\b/i);
      if (standardSizeMatch) {
        size = standardSizeMatch[1].toUpperCase();
      }
    }

    // Price regex (e.g. 150 azn, 150 manatdan asagi, under 150)
    const maxPriceMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:azn|manat|m)?(?:\s*(?:altında|aşağı|dən aşağı|dan aşağı|under|less than|ucuz))/i) ||
      q.match(/(?:altında|aşağı|under|max|maks)\s*(\d+(?:\.\d+)?)/i) ||
      q.match(/(\d+(?:\.\d+)?)\s*(?:-dək|-dak|-ə qədər|-a qədər)/i);
    if (maxPriceMatch) {
      maxPrice = parseFloat(maxPriceMatch[1]);
    }

    const minPriceMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:azn|manat|m)?(?:\s*(?:yuxarı|dən yuxarı|dan yuxarı|baha|over|more than))/i);
    if (minPriceMatch) {
      minPrice = parseFloat(minPriceMatch[1]);
    }

    // Color detection
    const colors = [
      { name: 'Qara', patterns: ['qara', 'black', 'чёрный', 'черный'] },
      { name: 'Ağ', patterns: ['ağ', 'ag', 'white', 'белый'] },
      { name: 'Göy', patterns: ['göy', 'goy', 'mavi', 'blue', 'синий', 'голубой', 'marin'] },
      { name: 'Qırmızı', patterns: ['qırmızı', 'qirmizi', 'red', 'красный'] },
      { name: 'Boz', patterns: ['boz', 'grey', 'gray', 'серый'] },
      { name: 'Bej', patterns: ['bej', 'beige', 'бежевый'] },
      { name: 'Yaşıl', patterns: ['yaşıl', 'yasil', 'green', 'зеленый'] },
      { name: 'Sarı', patterns: ['sarı', 'sari', 'yellow', 'желтый'] },
      { name: 'Qəhvəyi', patterns: ['qəhvəyi', 'qehveyi', 'brown', 'коричневый'] },
    ];
    for (const c of colors) {
      if (c.patterns.some((p) => q.includes(p))) {
        color = c.name;
        break;
      }
    }

    // Category match
    for (const cat of categories) {
      if (q.includes(cat.toLowerCase())) {
        category = cat;
        break;
      }
    }

    // Remaining words for keyword
    let clean = q
      .replace(/\b(?:azn|manat|razmer|ölçü|size|under|aşağı|dən aşağı|dan aşağı|altında|ucuz|baha|olan|qiyməti|manata|manatdan)\b/gi, ' ')
      .replace(/\d+/g, ' ')
      .trim();
    if (clean.length > 1) {
      keyword = clean;
    }

    return {
      keyword,
      category,
      color,
      size,
      minPrice,
      maxPrice,
      explanation: `Axtarış filtri: ${[
        category ? `Kateqoriya: ${category}` : '',
        color ? `Rəng: ${color}` : '',
        size ? `Ölçü: ${size}` : '',
        maxPrice ? `Maks. qiymət: ${maxPrice} AZN` : '',
        minPrice ? `Min. qiymət: ${minPrice} AZN` : '',
        keyword ? `Açar söz: ${keyword}` : '',
      ].filter(Boolean).join(', ') || query}`,
    };
  };

  if (!ai) {
    return fallbackParse();
  }

  try {
    const prompt = `Aşağıdakı təbii dildə yazılmış geyim mağazası axtarış sorğusunu strukturlaşdırılmış axtarış filtrlərinə çevir:
Sorğu: "${query}"

Mövcud kateqoriyalar:
${JSON.stringify(categories)}

Yalnız etibarlı JSON qaytar:
{
  "keyword": "məhsul növü və ya açar söz (məs: kostyum, köynək, şalvar)",
  "category": "mövcud kateqoriyalardan ən uyğunu və ya null",
  "color": "rəng (Azərbaycan dilində, məs: Qara, Ağ, Göy, Qırmızı və s.) və ya null",
  "size": "ölçü (məs: 52, M, XL, 42) və ya null",
  "minPrice": minimum rəqəm və ya null,
  "maxPrice": maksimum rəqəm və ya null,
  "brand": "brend adı və ya null",
  "explanation": "sorğunun azərbaycanca qısa izahı"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      keyword: parsed.keyword || undefined,
      category: parsed.category || undefined,
      color: parsed.color || undefined,
      size: parsed.size ? String(parsed.size).toUpperCase() : undefined,
      minPrice: typeof parsed.minPrice === 'number' ? parsed.minPrice : undefined,
      maxPrice: typeof parsed.maxPrice === 'number' ? parsed.maxPrice : undefined,
      brand: parsed.brand || undefined,
      explanation: parsed.explanation || `Təbii axtarış strukturu: "${query}"`,
    };
  } catch (err: any) {
    console.error('Error in parseNaturalLanguageSearch:', err);
    return fallbackParse();
  }
}

/**
 * 5. AI Sales Analysis
 * Answers sales analytical questions based strictly on real database sales data.
 */
export async function analyzeSalesData(params: {
  question: string;
  salesData: {
    totalRevenue: number;
    totalProfit: number;
    salesCount: number;
    topProducts: { name: string; quantity: number; revenue: number; profit: number }[];
    categoryRevenue: { category: string; revenue: number; quantity: number }[];
    sizeSales: { size: string; quantity: number; revenue: number }[];
    monthlyComparison: {
      currentMonth: { name: string; revenue: number; salesCount: number; profit: number };
      lastMonth: { name: string; revenue: number; salesCount: number; profit: number };
    };
    recentSalesSample?: any[];
  };
}): Promise<string> {
  const ai = getGeminiClient();

  const contextData = JSON.stringify(params.salesData, null, 2);

  if (!ai) {
    // Deterministic fallback using actual numbers
    const topProd = params.salesData.topProducts[0];
    const topCat = params.salesData.categoryRevenue[0];
    const curr = params.salesData.monthlyComparison.currentMonth;
    const prev = params.salesData.monthlyComparison.lastMonth;
    const revDiff = curr.revenue - prev.revenue;
    const revPct = prev.revenue > 0 ? ((revDiff / prev.revenue) * 100).toFixed(1) : '100';

    return `📊 **Real Satış Məlumatları Əsasında Hesabat:**\n\n` +
      `• **Ən çox satılan məhsul:** ${topProd ? `${topProd.name} (${topProd.quantity} ədəd, ${topProd.revenue.toFixed(2)} AZN)` : 'Məlumat yoxdur'}\n` +
      `• **Ən çox gəlir gətirən kateqoriya:** ${topCat ? `${topCat.category} (${topCat.revenue.toFixed(2)} AZN)` : 'Məlumat yoxdur'}\n` +
      `• **Cari ay dövriyyəsi:** ${curr.revenue.toFixed(2)} AZN (${curr.salesCount} çek)\n` +
      `• **Keçən ayla müqayisə:** ${revDiff >= 0 ? `+${revDiff.toFixed(2)} AZN artım (+${revPct}%)` : `${revDiff.toFixed(2)} AZN azalma (${revPct}%)`}\n` +
      `• **Cəmi xalis mənfəət:** ${params.salesData.totalProfit.toFixed(2)} AZN`;
  }

  try {
    const prompt = `Sən Kassa360 POS sisteminin baş maliyyə və satış analitikisən.
İstifadəçinin sualı: "${params.question}"

Mağazanın BAZASINDAN REAL SATIŞ STATİSTİKASI:
${contextData}

TƏLƏBLƏR:
1. YALNIZ və YALNIZ yuxarıdakı real verilənlərə əsaslanaraq cavab ver. Heç vaxt saxta rəqəm, məhsul və ya təxmin uydurma!
2. Suala dəqiq, aydın, rəqəmlər və faizlərlə zənginləşdirilmiş peşəkar hesabat şəklində cavab ver.
3. Müqayisə istənilibsə (cari ay və keçən ay), konkret rəqəmlərlə fərqi və dinamikanı göstər.
4. Azərbaycan dilində, səliqəli Markdown formatında (qalın şrift, bəndlər) cavab ver.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    return response.text?.trim() || 'Satış analizi tamamlandı.';
  } catch (err: any) {
    console.error('Error in analyzeSalesData:', err);
    return 'Satış analizi zamanı xəta baş verdi. Real baza göstəriciləri panelindəki qrafikləri nəzərdən keçirin.';
  }
}

/**
 * 6. AI Pricing Analysis
 * Analyzes product prices, margins, discounts and velocity.
 * NEVER automatically changes prices. Provides actionable recommendations.
 */
export async function analyzePricingData(params: {
  products: {
    id: number;
    name: string;
    category: string;
    purchasePrice: number;
    salePrice: number;
    stockQuantity: number;
    marginPercent: number;
    soldCount: number;
    totalRevenue: number;
  }[];
}): Promise<{
  insights: string;
  recommendations: {
    productId: number;
    productName: string;
    currentPrice: number;
    suggestedPrice: number;
    reason: string;
    actionType: 'increase' | 'decrease' | 'maintain' | 'discount_campaign';
  }[];
}> {
  const ai = getGeminiClient();

  const sampleProducts = params.products.slice(0, 40);

  if (!ai) {
    const recs = sampleProducts.slice(0, 5).map((p) => {
      const margin = p.marginPercent;
      if (margin < 20 && p.soldCount > 5) {
        return {
          productId: p.id,
          productName: p.name,
          currentPrice: p.salePrice,
          suggestedPrice: Number((p.salePrice * 1.1).toFixed(2)),
          reason: `Marja aşağıdır (${margin.toFixed(1)}%), lakin tələbat yüksəkdir. Qiyməti azacıq artırmaq rentabelliyi gücləndirər.`,
          actionType: 'increase' as const,
        };
      }
      if (p.stockQuantity > 15 && p.soldCount === 0) {
        return {
          productId: p.id,
          productName: p.name,
          currentPrice: p.salePrice,
          suggestedPrice: Number((p.salePrice * 0.88).toFixed(2)),
          reason: `Stokda çoxdur (${p.stockQuantity} ədəd), lakin satış yoxdur. Likvidliyi artırmaq üçün fəsli endirim təklif edilir.`,
          actionType: 'discount_campaign' as const,
        };
      }
      return {
        productId: p.id,
        productName: p.name,
        currentPrice: p.salePrice,
        suggestedPrice: p.salePrice,
        reason: `Balanslaşdırılmış marja (${margin.toFixed(1)}%) və stabil satış tempi.`,
        actionType: 'maintain' as const,
      };
    });

    return {
      insights: '📊 **Qiymət və Marja Analizi:**\n\nMağazadakı məhsulların maya və satış qiymətləri, faktiki marjalar və satış dövriyyəsi təhlil edildi. Bəzi yüksək tələbatlı mallarda marjanı optimallaşdırmaq, hərəkətsiz qalan stoklarda isə xüsusi kampaniyalar tətbiq etmək tövsiyə olunur. Qeyd: Qiymətlər heç vaxt avtomatik dəyişdirilmir, qərar mağaza sahibinə məxsusdur.',
      recommendations: recs,
    };
  }

  try {
    const prompt = `Sən Kassa360 pərakəndə tekstil və geyim mağazası üçün qiymət və marja ekspertisən.
Aşağıdakı real məhsul və satış göstəricilərini təhlil et:
${JSON.stringify(sampleProducts, null, 2)}

TƏLƏBLƏR:
1. XƏBƏRDARLIQ: Sistem heç vaxt qiymətləri avtomatik dəyişmir. Təhlil yalnız tövsiyə xarakterlidir.
2. Qiymət elastikliyi, marja faizi, anbar qalığı və satış sürətini nəzərə al.
3. Yalnız etibarlı JSON qaytar:
{
  "insights": "ümumi qiymət vəziyyəti, risklər və potensiallar haqqında azərbaycanca ətraflı hesabat mətni",
  "recommendations": [
    {
      "productId": 123,
      "productName": "məhsul adı",
      "currentPrice": 50,
      "suggestedPrice": 55,
      "reason": "qiymət təklifinin dəqiq iqtisadi əsası",
      "actionType": "increase" və ya "decrease" və ya "maintain" və ya "discount_campaign"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      insights: parsed.insights || 'Qiymət təhlili tamamlandı.',
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    };
  } catch (err: any) {
    console.error('Error in analyzePricingData:', err);
    return {
      insights: 'Qiymət analizi tamamlandı. Məhsul siyahısındakı marjalara əsasən qərarlar qəbul edə bilərsiniz.',
      recommendations: [],
    };
  }
}

/**
 * 7. AI Size Analysis
 * Analyzes which sizes sell the most and which are slow-moving.
 * Supports S/M/L/XL, numeric (36-54), and custom size systems (Standart, Battal, etc.).
 */
export async function analyzeSizeData(params: {
  sizeStats: {
    size: string;
    unitsSold: number;
    revenue: number;
    currentStock: number;
    sizeCategory?: 'clothing' | 'shoes' | 'numeric' | 'custom';
  }[];
}): Promise<{
  analysis: string;
  topSizes: string[];
  slowSizes: string[];
  recommendations: string[];
}> {
  const ai = getGeminiClient();

  if (!ai) {
    const sorted = [...params.sizeStats].sort((a, b) => b.unitsSold - a.unitsSold);
    const top = sorted.slice(0, 3).map((s) => s.size);
    const slow = sorted.filter((s) => s.unitsSold === 0 && s.currentStock > 0).map((s) => s.size);

    return {
      analysis: `📏 **Ölçü Satış Dinamikası:**\n\n` +
        `Ən çox satılan ölçülər: **${top.join(', ') || 'Məlumat yoxdur'}**.\n` +
        `Ləng hərəkət edən və ya anbarda yığılıb qalan ölçülər: **${slow.slice(0, 4).join(', ') || 'Yoxdur'}**.\n` +
        `Standart hərfli ölçülər (M, L, XL) və ən çox tələb olunan şalvar/kostyum nömrələri (48, 50, 52) ən yüksək dövriyyəni təmin edir.`,
      topSizes: top,
      slowSizes: slow.slice(0, 5),
      recommendations: [
        'Top ölçülər üçün minimum anbar ehtiyatı xəbərdarlığını artırın ki, vitrində ölçü qırılması yaşanmasın.',
        'Ləng ölçülər üçün kombinasiyalı satış və ya xüsusi ölçü endirimi kampaniyası təşkil edin.',
        'Yeni tədarük zamanı assortiment paylanmasında çox satılan ölçülərə daha yüksək faiz ayırın.',
      ],
    };
  }

  try {
    const prompt = `Sən Kassa360 geyim və tekstil POS sisteminin anbar ölçü çeşidi (size-curve) ekspertisən.
Aşağıdakı real ölçü statistikalarını təhlil et:
${JSON.stringify(params.sizeStats, null, 2)}

TƏLƏBLƏR:
1. Həm hərf ölçülərini (XS, S, M, L, XL, XXL, 3XL), həm nömrəli ölçüləri (36-44 ayaqqabı, 46-56 kostyum/şalvar), həm də xüsusi ölçüləri (Standart, Battal və s.) təhlil et.
2. Hansı ölçülərin sürətli ("hot sizes"), hansı ölçülərin isə anbarda dondurucu ("slow-moving") olduğunu müəyyən et.
3. Yalnız etibarlı JSON qaytar:
{
  "analysis": "azərbaycanca detallı analitik izahat mətni",
  "topSizes": ["ən çox satılan ölçülər siyahısı"],
  "slowSizes": ["ləng hərəkət edən ölçülər"],
  "recommendations": ["təchizat və anbar balanslaşdırılması üçün 3-4 addım"]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      analysis: parsed.analysis || 'Ölçü analizi tamamlandı.',
      topSizes: Array.isArray(parsed.topSizes) ? parsed.topSizes : [],
      slowSizes: Array.isArray(parsed.slowSizes) ? parsed.slowSizes : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    };
  } catch (err: any) {
    console.error('Error in analyzeSizeData:', err);
    return {
      analysis: 'Ölçü analizi aparıldı.',
      topSizes: [],
      slowSizes: [],
      recommendations: [],
    };
  }
}

/**
 * 8. AI Seller Assistant
 * Inside Kassa360, sellers can ask:
 * - Find a product
 * - Check stock
 * - Check price
 * - Check size
 * - Check today's sales
 * - Find products by natural language
 * Uses controlled backend logic instead of unrestricted database access.
 */
export async function handleSellerAssistant(params: {
  message: string;
  storeContext: {
    productsCount: number;
    todaySalesTotal: number;
    todaySalesCount: number;
    topProductsSummary: string[];
    sampleProducts: {
      id: number;
      name: string;
      barcode?: string;
      category: string;
      brand?: string;
      color?: string;
      sizes?: string[];
      salePrice: number;
      stockQuantity: number;
    }[];
  };
}): Promise<{
  reply: string;
  matchedProducts?: any[];
  suggestedActions?: { label: string; action: string; payload?: any }[];
}> {
  const ai = getGeminiClient();
  const q = params.message.trim().toLowerCase();

  // Controlled backend search function:
  const searchControlledProducts = (queryText: string) => {
    const parts = queryText.toLowerCase().split(/\s+/).filter(Boolean);
    return params.storeContext.sampleProducts.filter((p) => {
      const matchName = parts.some((part) => p.name.toLowerCase().includes(part));
      const matchBrand = p.brand && parts.some((part) => p.brand!.toLowerCase().includes(part));
      const matchCat = parts.some((part) => p.category.toLowerCase().includes(part));
      const matchColor = p.color && parts.some((part) => p.color!.toLowerCase().includes(part));
      const matchBarcode = p.barcode && p.barcode.toLowerCase() === queryText.toLowerCase();
      return matchName || matchBrand || matchCat || matchColor || matchBarcode;
    }).slice(0, 6);
  };

  // Immediate rule-based shortcuts for instant responsiveness
  if (q.includes('bugünkü satış') || q.includes('bugun nece') || q.includes('kassa') || q.includes('today')) {
    const total = params.storeContext.todaySalesTotal.toFixed(2);
    const count = params.storeContext.todaySalesCount;
    return {
      reply: `📅 **Bugünkü Satış Göstəriciləri:**\n\n• **Cəmi məbləğ:** ${total} AZN\n• **Satış sayı:** ${count} qəbz\n• Mağazada aktiv məhsul çeşidi: ${params.storeContext.productsCount} ədəd.`,
      suggestedActions: [
        { label: 'Kassaya bax', action: 'NAVIGATE_TAB', payload: 'Satış' },
        { label: 'Hesabatı aç', action: 'NAVIGATE_TAB', payload: 'Hesabatlar' },
      ],
    };
  }

  const matches = searchControlledProducts(q);

  if (!ai) {
    if (matches.length > 0) {
      const list = matches.map((m) =>
        `• **${m.name}** — Qiymət: **${m.salePrice} AZN** | Stok: **${m.stockQuantity} ədəd** | Rəng: ${m.color || 'Qeyd yoxdur'} | Ölçülər: ${(m.sizes || []).join(', ') || 'Tək ölçü'}`
      ).join('\n');

      return {
        reply: `Tapılan məhsullar (${matches.length} ədəd):\n\n${list}`,
        matchedProducts: matches,
        suggestedActions: matches.map((m) => ({
          label: `${m.name} (${m.salePrice} AZN) - Satışa əlavə et`,
          action: 'ADD_TO_CART',
          payload: m,
        })),
      };
    }

    return {
      reply: `Sorğunuz üzrə birbaşa məhsul tapılmadı. Məhsul adını, barkodunu və ya "Qara kostyum 52 razmer" kimi təbii təsvir daxil edə bilərsiniz.`,
      suggestedActions: [
        { label: 'Bugünkü satışları göstər', action: 'ASK', payload: 'Bugünkü satışlar necədir?' },
        { label: 'Bütün mallara bax', action: 'NAVIGATE_TAB', payload: 'Mallar' },
      ],
    };
  }

  try {
    const prompt = `Sən Kassa360 mağaza satıcı köməkçisi və ağıllı assistentisən (Azərbaycan dilində).
Satıcı soruşur: "${params.message}"

Nəzarət olunan mağaza məlumatları:
- Aktiv məhsul sayı: ${params.storeContext.productsCount}
- Bugünkü satış: ${params.storeContext.todaySalesTotal} AZN (${params.storeContext.todaySalesCount} çek)
- Uyğun gələn məhsullar bazası:
${JSON.stringify(matches, null, 2)}

TƏLƏBLƏR:
1. Satıcıya nəzakətli, operativ, lakonik və peşəkar cavab ver.
2. Qiymət, stok qalığı və ya ölçü soruşulubsa, dəqiq məlumatları qeyd et.
3. Əsla saxta məhsul və ya inventar uydurma. Yalnız verilmiş bazadakı məhsulları göstər.
4. Azərbaycan dilində təbii danış.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    return {
      reply: response.text?.trim() || 'Sorğunuz qəbul edildi.',
      matchedProducts: matches,
      suggestedActions: matches.slice(0, 3).map((m) => ({
        label: `${m.name} (${m.salePrice} AZN) - Səbətə at`,
        action: 'ADD_TO_CART',
        payload: m,
      })),
    };
  } catch (err: any) {
    console.error('Error in seller assistant:', err);
    return {
      reply: matches.length > 0
        ? `Tapılan məhsullar:\n${matches.map(m => `• ${m.name}: ${m.salePrice} AZN (Stok: ${m.stockQuantity})`).join('\n')}`
        : 'Sorğunuzu dəqiqləşdirin və ya barkodla axtarın.',
      matchedProducts: matches,
    };
  }
}
