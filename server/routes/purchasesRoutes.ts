import { Router, Request, Response } from 'express';
import { db } from '../db';
import { optionalAuth, AuthenticatedRequest } from '../auth/middleware';
import { realtimeHub } from '../websocket/wsServer';

const router = Router();

// GET /api/purchases
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await db.query('SELECT * FROM purchases ORDER BY date DESC');
    res.json({
      purchases: rows.map((p) => ({
        id: p.id,
        date: p.date,
        supplierName: p.supplier_name,
        totalAmount: Number(p.total_amount),
        paymentMethod: p.payment_method,
        notes: p.notes || '',
        items: JSON.parse(p.items_json || '[]'),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/purchases
router.post('/', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { supplierName, items, totalAmount, paymentMethod, notes, date } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Alış üçün ən azı bir məhsul daxil edilməlidir' });
      return;
    }

    const purchaseId = `pur_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const purchaseDate = date || new Date().toISOString();

    await db.transaction(async (trx) => {
      await trx.execute(
        `INSERT INTO purchases (id, date, supplier_name, total_amount, payment_method, notes, items_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          purchaseId,
          purchaseDate,
          supplierName || 'Naməlum təchizatçı',
          Number(totalAmount || 0),
          paymentMethod || 'Nağd',
          notes || '',
          JSON.stringify(items),
        ]
      );

      // Increase stock for purchased items
      for (const itm of items) {
        if (itm.productId) {
          const qty = Number(itm.quantity || 0);
          const curProd = await trx.queryOne('SELECT stock_quantity, name FROM products WHERE id = ?', [
            String(itm.productId),
          ]);
          if (curProd) {
            const oldStock = Number(curProd.stock_quantity);
            const newStock = oldStock + qty;

            await trx.execute('UPDATE products SET stock_quantity = ? WHERE id = ?', [
              newStock,
              String(itm.productId),
            ]);

            if (itm.variantId) {
              await trx.execute(
                'UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?',
                [qty, String(itm.variantId)]
              );
            }

            await trx.execute(
              `INSERT INTO stock_movements (id, product_id, product_name, type, quantity, previous_stock, new_stock, notes, user_id, user_name, date)
               VALUES (?, ?, ?, 'Alış', ?, ?, ?, ?, ?, ?, ?)`,
              [
                `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                String(itm.productId),
                curProd.name,
                qty,
                oldStock,
                newStock,
                `Alış qaiməsi #${purchaseId}`,
                req.user?.userId || 'system',
                req.user?.fullName || 'Kassa360',
                purchaseDate,
              ]
            );
          }
        }
      }
    });

    realtimeHub.broadcast('STOCK_UPDATED', { purchaseId }, req.headers['x-device-id'] as string);

    res.status(201).json({
      success: true,
      purchase: {
        id: purchaseId,
        date: purchaseDate,
        supplierName,
        totalAmount: Number(totalAmount || 0),
        paymentMethod,
        notes,
        items,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
