import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  generateProductImage,
  generateProductDescription,
  suggestProductCategory,
  parseNaturalLanguageSearch,
  analyzeSalesData,
  analyzePricingData,
  analyzeSizeData,
  handleSellerAssistant,
} from './server/aiService.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasApiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0),
    });
  });

  // 1. AI Product Image Generation
  app.post('/api/ai/product-image', async (req, res) => {
    try {
      const { name, category, color, brand, notes } = req.body;
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Məhsul adı tələb olunur.' });
      }
      const result = await generateProductImage({ name, category, color, brand, notes });
      res.json(result);
    } catch (err: any) {
      console.error('Error in /api/ai/product-image:', err);
      res.status(500).json({ error: err?.message || 'Şəkil yaradılarkən xəta baş verdi.' });
    }
  });

  // 2. AI Product Description Generation
  app.post('/api/ai/product-description', async (req, res) => {
    try {
      const { name, category, color, brand, sizes, salePrice, existingNotes } = req.body;
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Məhsul adı tələb olunur.' });
      }
      const description = await generateProductDescription({
        name,
        category,
        color,
        brand,
        sizes,
        salePrice,
        existingNotes,
      });
      res.json({ description });
    } catch (err: any) {
      console.error('Error in /api/ai/product-description:', err);
      res.status(500).json({ error: err?.message || 'Təsvir yaradılarkən xəta baş verdi.' });
    }
  });

  // 3. AI Product Categorization
  app.post('/api/ai/product-category', async (req, res) => {
    try {
      const { productName, existingCategories, brand, color } = req.body;
      if (!productName || typeof productName !== 'string') {
        return res.status(400).json({ error: 'Məhsul adı tələb olunur.' });
      }
      const result = await suggestProductCategory({
        productName,
        existingCategories: Array.isArray(existingCategories) ? existingCategories : [],
        brand,
        color,
      });
      res.json(result);
    } catch (err: any) {
      console.error('Error in /api/ai/product-category:', err);
      res.status(500).json({ error: err?.message || 'Kateqoriya müəyyən edilərkən xəta baş verdi.' });
    }
  });

  // 4. AI Natural Language Search
  app.post('/api/ai/natural-search', async (req, res) => {
    try {
      const { query, existingCategories } = req.body;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Axtarış mətni tələb olunur.' });
      }
      const structuredFilter = await parseNaturalLanguageSearch(
        query,
        Array.isArray(existingCategories) ? existingCategories : []
      );
      res.json({ structuredFilter });
    } catch (err: any) {
      console.error('Error in /api/ai/natural-search:', err);
      res.status(500).json({ error: err?.message || 'Axtarış təhlili zamanı xəta baş verdi.' });
    }
  });

  // 5. AI Sales Analysis
  app.post('/api/ai/sales-analysis', async (req, res) => {
    try {
      const { question, salesData } = req.body;
      if (!question || !salesData) {
        return res.status(400).json({ error: 'Sual və satış məlumatları tələb olunur.' });
      }
      const answer = await analyzeSalesData({ question, salesData });
      res.json({ answer });
    } catch (err: any) {
      console.error('Error in /api/ai/sales-analysis:', err);
      res.status(500).json({ error: err?.message || 'Satış analizi zamanı xəta baş verdi.' });
    }
  });

  // 6. AI Pricing Analysis
  app.post('/api/ai/pricing-analysis', async (req, res) => {
    try {
      const { products } = req.body;
      if (!products || !Array.isArray(products)) {
        return res.status(400).json({ error: 'Məhsul siyahısı tələb olunur.' });
      }
      const result = await analyzePricingData({ products });
      res.json(result);
    } catch (err: any) {
      console.error('Error in /api/ai/pricing-analysis:', err);
      res.status(500).json({ error: err?.message || 'Qiymət analizi zamanı xəta baş verdi.' });
    }
  });

  // 7. AI Size Analysis
  app.post('/api/ai/size-analysis', async (req, res) => {
    try {
      const { sizeStats } = req.body;
      if (!sizeStats || !Array.isArray(sizeStats)) {
        return res.status(400).json({ error: 'Ölçü statistikaları tələb olunur.' });
      }
      const result = await analyzeSizeData({ sizeStats });
      res.json(result);
    } catch (err: any) {
      console.error('Error in /api/ai/size-analysis:', err);
      res.status(500).json({ error: err?.message || 'Ölçü analizi zamanı xəta baş verdi.' });
    }
  });

  // 8. AI Seller Assistant
  app.post('/api/ai/seller-assistant', async (req, res) => {
    try {
      const { message, storeContext } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Mesaj tələb olunur.' });
      }
      const result = await handleSellerAssistant({
        message,
        storeContext: storeContext || {
          productsCount: 0,
          todaySalesTotal: 0,
          todaySalesCount: 0,
          topProductsSummary: [],
          sampleProducts: [],
        },
      });
      res.json(result);
    } catch (err: any) {
      console.error('Error in /api/ai/seller-assistant:', err);
      res.status(500).json({ error: err?.message || 'Satıcı köməkçisi xətası.' });
    }
  });

  // Vite middleware in dev or static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Express 5 catch-all syntax: *all
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kassa360 Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
