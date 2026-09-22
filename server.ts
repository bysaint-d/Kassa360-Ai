import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db';
import { seedInitialData } from './server/db/seed';
import { realtimeHub } from './server/websocket/wsServer';

// Route imports
import authRoutes from './server/routes/authRoutes';
import productRoutes from './server/routes/productRoutes';
import salesRoutes from './server/routes/salesRoutes';
import inventoryRoutes from './server/routes/inventoryRoutes';
import purchasesRoutes from './server/routes/purchasesRoutes';
import financeRoutes from './server/routes/financeRoutes';
import settingsRoutes from './server/routes/settingsRoutes';
import syncRoutes from './server/routes/syncRoutes';
import reportsRoutes from './server/routes/reportsRoutes';

// AI Service
import {
  generateProductImage,
  generateProductDescription,
  suggestProductCategory,
  parseNaturalLanguageSearch,
  analyzeSalesData,
  analyzePricingData,
  analyzeSizeData,
  handleSellerAssistant,
} from './server/aiService';

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);

  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // CORS and Security Headers for Mobile APK, Desktop, and External Clients
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-device-id');
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'SAMEORIGIN');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Initialize DB & Seed Data
  try {
    await db.init();
    await seedInitialData();
  } catch (dbErr) {
    console.error('❌ [Database] Failed to initialize database:', dbErr);
  }

  // Initialize Real-time WebSocket Hub
  realtimeHub.init(server);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      hasApiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0),
      isPostgres: db.isUsingPostgres(),
      activeWsClients: realtimeHub.getActiveClientCount(),
    });
  });

  // REST API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/sales', salesRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/purchases', purchasesRoutes);
  app.use('/api/finance', financeRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/sync', syncRoutes);
  app.use('/api/reports', reportsRoutes);

  // AI Routes
  app.post('/api/ai/product-image', async (req, res) => {
    try {
      const { name, category, color, brand, notes } = req.body;
      if (!name || typeof name !== 'string') {
        res.status(400).json({ error: 'Məhsul adı tələb olunur.' });
        return;
      }
      const result = await generateProductImage({ name, category, color, brand, notes });
      res.json(result);
    } catch (err: any) {
      console.error('Error in /api/ai/product-image:', err);
      res.status(500).json({ error: err?.message || 'Şəkil yaradılarkən xəta baş verdi.' });
    }
  });

  app.post('/api/ai/product-description', async (req, res) => {
    try {
      const { name, category, color, brand, sizes, salePrice, existingNotes } = req.body;
      if (!name || typeof name !== 'string') {
        res.status(400).json({ error: 'Məhsul adı tələb olunur.' });
        return;
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

  app.post('/api/ai/product-category', async (req, res) => {
    try {
      const { productName, existingCategories, brand, color } = req.body;
      if (!productName || typeof productName !== 'string') {
        res.status(400).json({ error: 'Məhsul adı tələb olunur.' });
        return;
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

  app.post('/api/ai/natural-search', async (req, res) => {
    try {
      const { query, existingCategories } = req.body;
      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Axtarış mətni tələb olunur.' });
        return;
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

  app.post('/api/ai/sales-analysis', async (req, res) => {
    try {
      const { question, salesData } = req.body;
      if (!question || !salesData) {
        res.status(400).json({ error: 'Sual və satış məlumatları tələb olunur.' });
        return;
      }
      const answer = await analyzeSalesData({ question, salesData });
      res.json({ answer });
    } catch (err: any) {
      console.error('Error in /api/ai/sales-analysis:', err);
      res.status(500).json({ error: err?.message || 'Satış analizi zamanı xəta baş verdi.' });
    }
  });

  app.post('/api/ai/pricing-analysis', async (req, res) => {
    try {
      const { products } = req.body;
      if (!products || !Array.isArray(products)) {
        res.status(400).json({ error: 'Məhsul siyahısı tələb olunur.' });
        return;
      }
      const result = await analyzePricingData({ products });
      res.json(result);
    } catch (err: any) {
      console.error('Error in /api/ai/pricing-analysis:', err);
      res.status(500).json({ error: err?.message || 'Qiymət analizi zamanı xəta baş verdi.' });
    }
  });

  app.post('/api/ai/size-analysis', async (req, res) => {
    try {
      const { sizeStats } = req.body;
      if (!sizeStats || !Array.isArray(sizeStats)) {
        res.status(400).json({ error: 'Ölçü statistikaları tələb olunur.' });
        return;
      }
      const result = await analyzeSizeData({ sizeStats });
      res.json(result);
    } catch (err: any) {
      console.error('Error in /api/ai/size-analysis:', err);
      res.status(500).json({ error: err?.message || 'Ölçü analizi zamanı xəta baş verdi.' });
    }
  });

  app.post('/api/ai/seller-assistant', async (req, res) => {
    try {
      const { message, storeContext } = req.body;
      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Mesaj tələb olunur.' });
        return;
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
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Kassa360 Server with WebSocket running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
