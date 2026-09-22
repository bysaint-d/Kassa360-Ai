import { Router, Request, Response } from 'express';
import { db } from '../db';
import { optionalAuth, requireAuth, requireRole, AuthenticatedRequest } from '../auth/middleware';
import { calculateServerSale, roundMoney } from '../financial/calculator';
import { realtimeHub } from '../websocket/wsServer';

const router = Router();

// Helper to format full sale object with items and debt payments
async function getFullSaleById(id: string): Promise<any | null> {
  const sale = await db.queryOne('SELECT * FROM sales WHERE id = ?', [id]);
  if (!sale) return null;

  const items = await db.query('SELECT * FROM sale_items WHERE sale_id = ?', [id]);
  const debtPayments = await db.query(
    'SELECT * FROM debt_payments WHERE sale_id = ? ORDER BY date ASC',
    [id]
  );

  return {
    id: sale.id,
    clientUuid: sale.client_uuid,
    deviceId: sale.device_id,
    sellerId: sale.seller_id,
    sellerName: sale.seller_name,
    date: sale.date,
    subtotal: Number(sale.subtotal),
    itemDiscountsTotal: Number(sale.item_discounts_total),
    subtotalAfterItemDiscounts: Number(sale.subtotal_after_item_discounts),
    globalDiscountPercent: Number(sale.global_discount_percent),
    discount: Number(sale.discount),
    totalDiscount: Number(sale.total_discount),
    total: Number(sale.total),
    paidAmount: Number(sale.paid_amount),
    changeAmount: Number(sale.change_amount),
    debtAmount: Number(sale.debt_amount),
    initialDebtAmount: Number(sale.initial_debt_amount),
    initialPaidAmount: Number(sale.initial_paid_amount),
    paymentMethod: sale.payment_method,
    partialPaymentMethod: sale.partial_payment_method,
    customerName: sale.customer_name || '',
    notes: sale.notes || '',
    isReturned: Boolean(sale.is_returned),
    syncStatus: sale.sync_status || 'SYNCED',
    items: items.map((itm) => ({
      id: itm.id,
      saleId: itm.sale_id,
      productId: itm.product_id,
      productName: itm.product_name,
      productBarcode: itm.product_barcode || '',
      brand: itm.brand || '',
      color: itm.color || '',
      colorHex: itm.color_hex || '',
      size: itm.size || '',
      variantId: itm.variant_id,
      comment: itm.comment || '',
      quantity: Number(itm.quantity),
      originalPrice: Number(itm.original_price),
      discountAmount: Number(itm.discount_amount || 0),
      salePrice: Number(itm.sale_price),
      costPrice: Number(itm.cost_price || 0),
      total: Number(itm.total),
      profit: Number(itm.profit || 0),
    })),
    debtPayments: debtPayments.map((dp) => ({
      id: dp.id,
      saleId: dp.sale_id,
      amount: Number(dp.amount),
      previousDebt: Number(dp.previous_debt),
      remainingDebt: Number(dp.remaining_debt),
      paymentMethod: dp.payment_method,
      notes: dp.notes || '',
      date: dp.date,
    })),
  };
}

// GET /api/sales - List sales with optional filters
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { fromDate, toDate, paymentMethod, customerName, search } = req.query;
    let sql = 'SELECT id FROM sales WHERE 1=1';
    const params: any[] = [];

    if (fromDate) {
      sql += ' AND date >= ?';
      params.push(String(fromDate));
    }
    if (toDate) {
      sql += ' AND date <= ?';
      params.push(String(toDate));
    }
    if (paymentMethod && paymentMethod !== 'all') {
      sql += ' AND payment_method = ?';
      params.push(String(paymentMethod));
    }
    if (customerName) {
      sql += ' AND LOWER(customer_name) LIKE ?';
      params.push(`%${String(customerName).toLowerCase()}%`);
    }

    sql += ' ORDER BY date DESC LIMIT 500';
    const rows = await db.query<{ id: string }>(sql, params);

    const sales: any[] = [];
    for (const r of rows) {
      const full = await getFullSaleById(r.id);
      if (full) {
        if (search && typeof search === 'string' && search.trim()) {
          const q = search.trim().toLowerCase();
          const matches =
            full.id.toLowerCase().includes(q) ||
            full.customerName.toLowerCase().includes(q) ||
            full.items.some((i: any) => i.productName.toLowerCase().includes(q));
          if (!matches) continue;
        }
        sales.push(full);
      }
    }

    res.json({ sales });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sales/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const sale = await getFullSaleById(req.params.id);
    if (!sale) {
      res.status(404).json({ error: 'Satış tapılmadı' });
      return;
    }
    res.json({ sale });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sales - Create Sale
router.post('/', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const body = req.body;
    const clientUuid = body.clientUuid || body.client_uuid;
    const deviceId = (req.headers['x-device-id'] as string) || body.deviceId || 'device_default';

    // 1. Idempotency check: if sale already created with this clientUuid, return existing sale
    if (clientUuid) {
      const existingSale = await db.queryOne('SELECT id FROM sales WHERE client_uuid = ?', [clientUuid]);
      if (existingSale) {
        console.log(`⚡ [Idempotency] Sale already processed with clientUuid: ${clientUuid}. Returning existing sale.`);
        const full = await getFullSaleById(existingSale.id);
        res.status(200).json({ success: true, sale: full, duplicate: true });
        return;
      }
    }

    const items = body.items;
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Səbət boşdur' });
      return;
    }

    // 2. Fetch authoritative product catalogue data from database
    const rawItemsForCalc: any[] = [];
    const stockChecks: Array<{ productId: string; variantId?: string; qty: number; name: string }> = [];

    for (const itm of items) {
      const prodId = String(itm.productId);
      const prod = await db.queryOne('SELECT * FROM products WHERE id = ?', [prodId]);
      if (!prod) {
        res.status(400).json({ error: `Məhsul tapılmadı: ${itm.productName || prodId}` });
        return;
      }

      const qty = Math.max(1, Number(itm.quantity || 1));
      stockChecks.push({
        productId: prodId,
        variantId: itm.variantId ? String(itm.variantId) : undefined,
        qty,
        name: prod.name,
      });

      rawItemsForCalc.push({
        productId: prodId,
        variantId: itm.variantId ? String(itm.variantId) : undefined,
        productName: prod.name,
        productBarcode: prod.barcode || '',
        brand: itm.brand || prod.brand || '',
        color: itm.color || prod.color || '',
        colorHex: itm.colorHex || prod.color_hex || '',
        size: itm.size || prod.size || '',
        comment: itm.comment || '',
        quantity: qty,
        dbOriginalPrice: Number(prod.sale_price),
        dbCostPrice: Number(prod.purchase_price),
        requestedDiscountAmount: Number(itm.discountAmount || 0),
      });
    }

    // 3. Check store setting for negative stock
    const negStockSetting = await db.queryOne("SELECT value FROM settings WHERE key = 'allowNegativeStock'");
    const allowNegativeStock = negStockSetting?.value === 'true';

    // 4. Validate stock quantities
    if (!allowNegativeStock) {
      for (const sc of stockChecks) {
        if (sc.variantId) {
          const variant = await db.queryOne('SELECT stock_quantity FROM product_variants WHERE id = ?', [sc.variantId]);
          if (variant && Number(variant.stock_quantity) < sc.qty) {
            res.status(400).json({
              error: `"${sc.name}" (variant) üçün kifayət qədər stok yoxdur! Mövcud: ${variant.stock_quantity}, Tələb olunan: ${sc.qty}`,
            });
            return;
          }
        } else {
          const prod = await db.queryOne('SELECT stock_quantity FROM products WHERE id = ?', [sc.productId]);
          if (prod && Number(prod.stock_quantity) < sc.qty) {
            res.status(400).json({
              error: `"${sc.name}" üçün kifayət qədər stok yoxdur! Mövcud: ${prod.stock_quantity}, Tələb olunan: ${sc.qty}`,
            });
            return;
          }
        }
      }
    }

    // 5. Authoritative Financial Calculations on Server
    const calc = calculateServerSale(
      rawItemsForCalc,
      Number(body.discount || 0),
      Number(body.paidAmount || 0),
      body.paymentMethod || 'Nağd'
    );

    const saleId = body.id ? String(body.id) : `sale_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const saleDate = body.date || new Date().toISOString();
    const sellerId = req.user?.userId || body.sellerId || 'system';
    const sellerName = req.user?.fullName || body.sellerName || 'Kassa360';
    const paymentMethod = body.paymentMethod || 'Nağd';

    if (paymentMethod === 'Borc' && (!body.customerName || !body.customerName.trim())) {
      res.status(400).json({ error: 'Nisyə (borc) satış üçün müştəri adı mütləq daxil edilməlidir' });
      return;
    }

    // 6. Execute Atomic Transaction in Database
    await db.transaction(async (trx) => {
      // Insert sale
      await trx.execute(
        `INSERT INTO sales (
          id, client_uuid, device_id, seller_id, seller_name, date,
          subtotal, item_discounts_total, subtotal_after_item_discounts,
          global_discount_percent, discount, total_discount, total,
          paid_amount, change_amount, debt_amount, initial_debt_amount, initial_paid_amount,
          payment_method, partial_payment_method, customer_name, notes, is_returned, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'SYNCED')`,
        [
          saleId,
          clientUuid || null,
          deviceId,
          sellerId,
          sellerName,
          saleDate,
          calc.subtotal,
          calc.itemDiscountsTotal,
          calc.subtotalAfterItemDiscounts,
          calc.globalDiscountPercent,
          calc.globalDiscount,
          calc.totalDiscount,
          calc.total,
          calc.paidAmount,
          calc.changeAmount,
          calc.debtAmount,
          calc.debtAmount,
          calc.paidAmount,
          paymentMethod,
          body.partialPaymentMethod || null,
          body.customerName?.trim() || null,
          body.notes?.trim() || null,
        ]
      );

      // Insert line items & update stock
      for (const item of calc.items) {
        const itemId = `si_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await trx.execute(
          `INSERT INTO sale_items (
            id, sale_id, product_id, product_name, product_barcode, brand, color, color_hex,
            size, variant_id, comment, quantity, original_price, discount_amount, sale_price,
            cost_price, total, profit
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId,
            saleId,
            item.productId,
            item.productName,
            item.productBarcode || null,
            item.brand || null,
            item.color || null,
            item.colorHex || null,
            item.size || null,
            item.variantId || null,
            item.comment || null,
            item.quantity,
            item.originalPrice,
            item.discountAmount,
            item.salePrice,
            item.costPrice,
            item.total,
            item.profit,
          ]
        );

        // Deduct product stock
        const currentProd = await trx.queryOne('SELECT stock_quantity FROM products WHERE id = ?', [item.productId]);
        const oldStock = Number(currentProd?.stock_quantity || 0);
        const newStock = oldStock - item.quantity;
        await trx.execute('UPDATE products SET stock_quantity = ? WHERE id = ?', [newStock, item.productId]);

        // Deduct variant stock if variant exists
        if (item.variantId) {
          await trx.execute(
            'UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?',
            [item.quantity, item.variantId]
          );
        }

        // Record stock movement
        await trx.execute(
          `INSERT INTO stock_movements (id, product_id, product_name, type, quantity, previous_stock, new_stock, notes, user_id, user_name, date)
           VALUES (?, ?, ?, 'Satış', ?, ?, ?, ?, ?, ?, ?)`,
          [
            `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            item.productId,
            item.productName,
            item.quantity,
            oldStock,
            newStock,
            `Satış #${saleId}`,
            sellerId,
            sellerName,
            saleDate,
          ]
        );
      }

      // If initial debt payment was made
      if (paymentMethod === 'Borc' && calc.paidAmount > 0) {
        await trx.execute(
          `INSERT INTO debt_payments (id, sale_id, amount, previous_debt, remaining_debt, payment_method, notes, date)
           VALUES (?, ?, ?, ?, ?, ?, 'İlkin ödəniş', ?)`,
          [
            `dp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            saleId,
            calc.paidAmount,
            calc.total,
            calc.debtAmount,
            body.partialPaymentMethod || 'Nağd',
            saleDate,
          ]
        );
      }
    });

    const fullSale = await getFullSaleById(saleId);

    // 7. Real-Time Broadcasts
    realtimeHub.broadcast('SALE_CREATED', fullSale, deviceId);
    realtimeHub.broadcast('STOCK_UPDATED', { saleId, affectedProducts: stockChecks.map((s) => s.productId) }, deviceId);

    res.status(201).json({ success: true, sale: fullSale });
  } catch (err: any) {
    console.error('Error creating sale:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sales/:id - Edit Sale / Receipt (GUARANTEED NO DOUBLE DISCOUNT)
router.put('/:id', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const saleId = req.params.id;
    const existing = await getFullSaleById(saleId);
    if (!existing) {
      res.status(404).json({ error: 'Satış tapılmadı' });
      return;
    }

    if (existing.isReturned) {
      res.status(400).json({ error: 'Qaytarılmış çeki redaktə etmək mümkün deyil' });
      return;
    }

    const body = req.body;
    const newItems = body.items || existing.items;

    // Recalculate using product original_price to ensure zero double discount
    const rawItemsForCalc: any[] = [];
    for (const itm of newItems) {
      const prodId = String(itm.productId);
      const prod = await db.queryOne('SELECT * FROM products WHERE id = ?', [prodId]);
      const originalPrice = prod ? Number(prod.sale_price) : Number(itm.originalPrice || itm.salePrice);
      const costPrice = prod ? Number(prod.purchase_price) : Number(itm.costPrice || 0);

      rawItemsForCalc.push({
        productId: prodId,
        variantId: itm.variantId ? String(itm.variantId) : undefined,
        productName: itm.productName || prod?.name || 'Məhsul',
        productBarcode: itm.productBarcode || prod?.barcode || '',
        brand: itm.brand || prod?.brand || '',
        color: itm.color || prod?.color || '',
        colorHex: itm.colorHex || prod?.color_hex || '',
        size: itm.size !== undefined ? itm.size : (prod?.size || ''), // Updated size (e.g. M -> L)
        comment: itm.comment || '',
        quantity: Math.max(1, Number(itm.quantity || 1)),
        dbOriginalPrice: originalPrice,
        dbCostPrice: costPrice,
        requestedDiscountAmount: Number(itm.discountAmount || 0),
      });
    }

    const calc = calculateServerSale(
      rawItemsForCalc,
      Number(body.discount !== undefined ? body.discount : existing.discount),
      Number(body.paidAmount !== undefined ? body.paidAmount : existing.paidAmount),
      body.paymentMethod || existing.paymentMethod
    );

    await db.transaction(async (trx) => {
      // 1. Reconcile stock: restore old quantities, deduct new quantities
      for (const oldItm of existing.items) {
        await trx.execute('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [
          oldItm.quantity,
          oldItm.productId,
        ]);
        if (oldItm.variantId) {
          await trx.execute(
            'UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?',
            [oldItm.quantity, oldItm.variantId]
          );
        }
      }

      for (const newItm of calc.items) {
        await trx.execute('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?', [
          newItm.quantity,
          newItm.productId,
        ]);
        if (newItm.variantId) {
          await trx.execute(
            'UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?',
            [newItm.quantity, newItm.variantId]
          );
        }
      }

      // 2. Replace sale items
      await trx.execute('DELETE FROM sale_items WHERE sale_id = ?', [saleId]);
      for (const item of calc.items) {
        const itemId = `si_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await trx.execute(
          `INSERT INTO sale_items (
            id, sale_id, product_id, product_name, product_barcode, brand, color, color_hex,
            size, variant_id, comment, quantity, original_price, discount_amount, sale_price,
            cost_price, total, profit
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId,
            saleId,
            item.productId,
            item.productName,
            item.productBarcode || null,
            item.brand || null,
            item.color || null,
            item.colorHex || null,
            item.size || null,
            item.variantId || null,
            item.comment || null,
            item.quantity,
            item.originalPrice,
            item.discountAmount,
            item.salePrice,
            item.costPrice,
            item.total,
            item.profit,
          ]
        );
      }

      // 3. Update main sale record
      await trx.execute(
        `UPDATE sales SET
          subtotal = ?, item_discounts_total = ?, subtotal_after_item_discounts = ?,
          global_discount_percent = ?, discount = ?, total_discount = ?, total = ?,
          paid_amount = ?, change_amount = ?, debt_amount = ?, customer_name = ?,
          notes = ?, payment_method = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          calc.subtotal,
          calc.itemDiscountsTotal,
          calc.subtotalAfterItemDiscounts,
          calc.globalDiscountPercent,
          calc.globalDiscount,
          calc.totalDiscount,
          calc.total,
          calc.paidAmount,
          calc.changeAmount,
          calc.debtAmount,
          body.customerName !== undefined ? body.customerName.trim() : existing.customerName,
          body.notes !== undefined ? body.notes.trim() : existing.notes,
          body.paymentMethod || existing.paymentMethod,
          saleId,
        ]
      );
    });

    const updatedSale = await getFullSaleById(saleId);
    realtimeHub.broadcast('SALE_UPDATED', updatedSale, req.headers['x-device-id'] as string);
    realtimeHub.broadcast('STOCK_UPDATED', { saleId }, req.headers['x-device-id'] as string);

    res.json({ success: true, sale: updatedSale });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sales/:id/return - Return Sale
router.post('/:id/return', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const saleId = req.params.id;
    const sale = await getFullSaleById(saleId);
    if (!sale) {
      res.status(404).json({ error: 'Satış tapılmadı' });
      return;
    }
    if (sale.isReturned) {
      res.status(400).json({ error: 'Bu satış artıq qaytarılıb' });
      return;
    }

    const sellerId = req.user?.userId || 'system';
    const sellerName = req.user?.fullName || 'Kassa360';
    const returnDate = new Date().toISOString();

    await db.transaction(async (trx) => {
      // 1. Restore stock and record movements
      for (const itm of sale.items) {
        const curProd = await trx.queryOne('SELECT stock_quantity FROM products WHERE id = ?', [itm.productId]);
        const oldStock = Number(curProd?.stock_quantity || 0);
        const newStock = oldStock + itm.quantity;

        await trx.execute('UPDATE products SET stock_quantity = ? WHERE id = ?', [newStock, itm.productId]);
        if (itm.variantId) {
          await trx.execute(
            'UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?',
            [itm.quantity, itm.variantId]
          );
        }

        await trx.execute(
          `INSERT INTO stock_movements (id, product_id, product_name, type, quantity, previous_stock, new_stock, notes, user_id, user_name, date)
           VALUES (?, ?, ?, 'Qaytarma', ?, ?, ?, ?, ?, ?, ?)`,
          [
            `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            itm.productId,
            itm.productName,
            itm.quantity,
            oldStock,
            newStock,
            `Satış #${saleId} qaytarıldı`,
            sellerId,
            sellerName,
            returnDate,
          ]
        );
      }

      // 2. Mark sale as returned and zero out active debt
      await trx.execute(
        'UPDATE sales SET is_returned = 1, debt_amount = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [saleId]
      );
    });

    const returnedSale = await getFullSaleById(saleId);
    realtimeHub.broadcast('SALE_RETURNED', returnedSale, req.headers['x-device-id'] as string);
    realtimeHub.broadcast('STOCK_UPDATED', { saleId }, req.headers['x-device-id'] as string);

    res.json({ success: true, sale: returnedSale });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sales/:id/payments - Add Debt Payment
router.post('/:id/payments', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const saleId = req.params.id;
    const sale = await getFullSaleById(saleId);
    if (!sale) {
      res.status(404).json({ error: 'Satış tapılmadı' });
      return;
    }

    const paymentAmount = roundMoney(Number(req.body.amount || 0));
    if (paymentAmount <= 0) {
      res.status(400).json({ error: 'Ödəniş məbləği 0-dan böyük olmalıdır' });
      return;
    }

    if (paymentAmount > sale.debtAmount) {
      res.status(400).json({
        error: `Ödəniş məbləği qalan borcdan (${sale.debtAmount} AZN) çox ola bilməz`,
      });
      return;
    }

    const previousDebt = sale.debtAmount;
    const remainingDebt = roundMoney(previousDebt - paymentAmount);
    const newPaidAmount = roundMoney(sale.paidAmount + paymentAmount);
    const paymentDate = req.body.date || new Date().toISOString();

    await db.transaction(async (trx) => {
      const dpId = `dp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await trx.execute(
        `INSERT INTO debt_payments (id, sale_id, amount, previous_debt, remaining_debt, payment_method, notes, date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dpId,
          saleId,
          paymentAmount,
          previousDebt,
          remainingDebt,
          req.body.paymentMethod || 'Nağd',
          req.body.notes || 'Nisyə ödənişi',
          paymentDate,
        ]
      );

      await trx.execute(
        'UPDATE sales SET debt_amount = ?, paid_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [remainingDebt, newPaidAmount, saleId]
      );
    });

    const updatedSale = await getFullSaleById(saleId);
    realtimeHub.broadcast('SALE_UPDATED', updatedSale, req.headers['x-device-id'] as string);

    res.json({ success: true, sale: updatedSale });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sales/:id
router.delete('/:id', requireAuth, requireRole('admin', 'manager'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const saleId = req.params.id;
    const sale = await getFullSaleById(saleId);
    if (!sale) {
      res.status(404).json({ error: 'Satış tapılmadı' });
      return;
    }

    const restoreStock = req.query.restoreStock !== 'false';

    await db.transaction(async (trx) => {
      if (restoreStock && !sale.isReturned) {
        for (const itm of sale.items) {
          await trx.execute('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [
            itm.quantity,
            itm.productId,
          ]);
          if (itm.variantId) {
            await trx.execute(
              'UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?',
              [itm.quantity, itm.variantId]
            );
          }
        }
      }

      await trx.execute('DELETE FROM debt_payments WHERE sale_id = ?', [saleId]);
      await trx.execute('DELETE FROM sale_items WHERE sale_id = ?', [saleId]);
      await trx.execute('DELETE FROM sales WHERE id = ?', [saleId]);
    });

    realtimeHub.broadcast('SALE_DELETED', { id: saleId }, req.headers['x-device-id'] as string);
    realtimeHub.broadcast('STOCK_UPDATED', { saleId }, req.headers['x-device-id'] as string);

    res.json({ success: true, message: 'Satış uğurla silindi' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
