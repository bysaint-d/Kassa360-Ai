import { Router, Request, Response } from 'express';
import { db } from '../db';
import { optionalAuth, AuthenticatedRequest } from '../auth/middleware';
import { realtimeHub } from '../websocket/wsServer';

const router = Router();

// GET /api/inventory/movements
router.get('/movements', async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, type, limit } = req.query;
    let sql = 'SELECT * FROM stock_movements WHERE 1=1';
    const params: any[] = [];

    if (productId) {
      sql += ' AND product_id = ?';
      params.push(String(productId));
    }
    if (type && type !== 'all') {
      sql += ' AND type = ?';
      params.push(String(type));
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit ? Math.min(1000, Number(limit)) : 300);

    const movements = await db.query(sql, params);
    res.json({
      movements: movements.map((m) => ({
        id: m.id,
        productId: m.product_id,
        productName: m.product_name,
        type: m.type,
        quantity: Number(m.quantity),
        previousStock: Number(m.previous_stock),
        newStock: Number(m.new_stock),
        notes: m.notes || '',
        userId: m.user_id,
        userName: m.user_name,
        date: m.date,
        createdAt: m.created_at,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventory/adjust
router.post('/adjust', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { productId, variantId, quantityChange, notes } = req.body;
    if (!productId || quantityChange === undefined) {
      res.status(400).json({ error: 'Məhsul və dəyişiklik miqdarı daxil edilməlidir' });
      return;
    }

    const change = Number(quantityChange);
    const prod = await db.queryOne('SELECT * FROM products WHERE id = ?', [String(productId)]);
    if (!prod) {
      res.status(404).json({ error: 'Məhsul tapılmadı' });
      return;
    }

    const oldStock = Number(prod.stock_quantity);
    const newStock = oldStock + change;

    await db.transaction(async (trx) => {
      await trx.execute('UPDATE products SET stock_quantity = ? WHERE id = ?', [newStock, String(productId)]);

      if (variantId) {
        await trx.execute(
          'UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?',
          [change, String(variantId)]
        );
      }

      await trx.execute(
        `INSERT INTO stock_movements (id, product_id, product_name, type, quantity, previous_stock, new_stock, notes, user_id, user_name, date)
         VALUES (?, ?, ?, 'Stok düzəlişi', ?, ?, ?, ?, ?, ?, ?)`,
        [
          `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          String(productId),
          prod.name,
          Math.abs(change),
          oldStock,
          newStock,
          notes || 'Əllə stok tənzimləməsi',
          req.user?.userId || 'system',
          req.user?.fullName || 'Kassa360',
          new Date().toISOString(),
        ]
      );
    });

    realtimeHub.broadcast('STOCK_UPDATED', { productId, newStock }, req.headers['x-device-id'] as string);

    res.json({ success: true, newStock });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inventory/warnings
router.get('/warnings', async (_req: Request, res: Response): Promise<void> => {
  try {
    const lowStock = await db.query(
      'SELECT id, name, category, stock_quantity, minimum_stock FROM products WHERE stock_quantity <= minimum_stock ORDER BY stock_quantity ASC'
    );
    res.json({
      lowStock: lowStock.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        stockQuantity: Number(p.stock_quantity),
        minimumStock: Number(p.minimum_stock),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
