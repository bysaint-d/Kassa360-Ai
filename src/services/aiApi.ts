/**
 * Client-side API service communicating with the secure Kassa360 AI Backend.
 * Never exposes API keys on the client.
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

export interface PricingRecommendation {
  productId: number;
  productName: string;
  currentPrice: number;
  suggestedPrice: number;
  reason: string;
  actionType: 'increase' | 'decrease' | 'maintain' | 'discount_campaign';
}

export interface SizeAnalysisResult {
  analysis: string;
  topSizes: string[];
  slowSizes: string[];
  recommendations: string[];
}

export interface SellerAssistantResponse {
  reply: string;
  matchedProducts?: any[];
  suggestedActions?: { label: string; action: string; payload?: any }[];
}

export const aiApi = {
  // 1. AI Product Image Generation
  async generateProductImage(params: {
    name: string;
    category?: string;
    color?: string;
    brand?: string;
    notes?: string;
  }): Promise<{ imageUrl: string; promptUsed: string }> {
    const res = await fetch('/api/ai/product-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Şəkil yaradılarkən xəta baş verdi.');
    }
    return res.json();
  },

  // 2. AI Product Description Generation
  async generateProductDescription(params: {
    name: string;
    category?: string;
    color?: string;
    brand?: string;
    sizes?: string[];
    salePrice?: number;
    existingNotes?: string;
  }): Promise<{ description: string }> {
    const res = await fetch('/api/ai/product-description', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Təsvir yaradılarkən xəta baş verdi.');
    }
    return res.json();
  },

  // 3. AI Product Categorization
  async suggestProductCategory(params: {
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
    const res = await fetch('/api/ai/product-category', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Kateqoriya təklifi zamanı xəta baş verdi.');
    }
    return res.json();
  },

  // 4. AI Natural Language Search
  async parseNaturalLanguageSearch(params: {
    query: string;
    existingCategories: string[];
  }): Promise<{ structuredFilter: StructuredSearchFilter }> {
    const res = await fetch('/api/ai/natural-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Axtarış sorğusu emal edilərkən xəta baş verdi.');
    }
    return res.json();
  },

  // 5. AI Sales Analysis
  async analyzeSales(params: {
    question: string;
    salesData: any;
  }): Promise<{ answer: string }> {
    const res = await fetch('/api/ai/sales-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Satış analizi zamanı xəta baş verdi.');
    }
    return res.json();
  },

  // 6. AI Pricing Analysis
  async analyzePricing(params: {
    products: any[];
  }): Promise<{
    insights: string;
    recommendations: PricingRecommendation[];
  }> {
    const res = await fetch('/api/ai/pricing-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Qiymət analizi zamanı xəta baş verdi.');
    }
    return res.json();
  },

  // 7. AI Size Analysis
  async analyzeSizes(params: {
    sizeStats: any[];
  }): Promise<SizeAnalysisResult> {
    const res = await fetch('/api/ai/size-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Ölçü analizi zamanı xəta baş verdi.');
    }
    return res.json();
  },

  // 8. AI Seller Assistant
  async askSellerAssistant(params: {
    message: string;
    storeContext: any;
  }): Promise<SellerAssistantResponse> {
    const res = await fetch('/api/ai/seller-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Assistent cavab verərkən xəta baş verdi.');
    }
    return res.json();
  },
};
