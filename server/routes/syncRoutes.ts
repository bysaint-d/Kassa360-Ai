import { Router, Request, Response } from 'express';
import { db } from '../db';
import { optionalAuth, AuthenticatedRequest } from '../auth/middleware';
import { calculateServerSale } from '../financial/calculator';
import { realtimeHub } from '../websocket/wsServer';

const router = Router();

// POST /api/sync/bootstrap - Migrates client-side localStorage data into the relational database
router.post('/bootstrap', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { products, sales, categories, suppliers, setting, expenses, recurringExpenses, incomes } = req.body;

    let importedProducts = 0;
    let importedSales = 0;
    let importedCategories = 0;
    let importedSuppliers = 0;

    await db.transaction(async (trx) => {
      // 1. Categories
      if (Array.isArray(categories)) {
        for (const cat of categories) {
          const exists = await trx.queryOne('SELECT id FROM categories WHERE id = ? OR name = ?', [
            String(cat.id),
            cat.name,
          ]);
          if (!exists) {
            await trx.execute('INSERT INTO categories (id, name) VALUES (?, ?)', [String(cat.id), cat.name]);
            importedCategories++;
          }
        }
      }

      // 2. Suppliers
      if (Array.isArray(suppliers)) {
        for (const sup of suppliers) {
          const exists = await trx.queryOne('SELECT id FROM suppliers WHERE id = ?', [String(sup.id)]);
          if (!exists) {
            await trx.execute('INSERT INTO suppliers (id, name, phone, notes) VALUES (?, ?, ?, ?)', [
              String(sup.id),
              sup.name,
              sup.phone || '',
              sup.notes || '',
            ]);
            importedSuppliers++;
          }
        }
      }

      // 3. Products
      if (Array.isArray(products)) {
        for (const prod of products) {
          const exists = await trx.queryOne('SELECT id FROM products WHERE id = ?', [String(prod.id)]);
          if (!exists) {
            const sizesJson = prod.sizes ? JSON.stringify(prod.sizes) : JSON.stringify([]);
            await trx.execute(
              `INSERT INTO products (
                id, barcode, name, category, brand, color, color_hex, size, sizes_json,
                purchase_price, sale_price, stock_quantity, minimum_stock, supplier,
                image_path, notes, version
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
              [
                String(prod.id),
                prod.barcode || null,
                prod.name,
                prod.category,
                prod.brand || '',
                prod.color || '',
                prod.colorHex || '',
                prod.size || '',
                sizesJson,
                Number(prod.purchasePrice || 0),
                Number(prod.salePrice || 0),
                Number(prod.stockQuantity || 0),
                Number(prod.minimumStock || 3),
                prod.supplier || '',
                prod.imagePath || '',
                prod.notes || '',
              ]
            );

            if (Array.isArray(prod.variants)) {
              for (const v of prod.variants) {
                await trx.execute(
                  `INSERT INTO product_variants (id, product_id, color, color_hex, size, stock_quantity, barcode)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`,
                  [
                    v.id || `var_${prod.id}_${Math.random().toString(36).substring(2, 6)}`,
                    String(prod.id),
                    v.color || '',
                    v.colorHex || '',
                    v.size || '',
                    Number(v.stockQuantity || 0),
                    v.barcode || null,
                  ]
                );
              }
            }
            importedProducts++;
          }
        }
      }

      // 4. Sales
      if (Array.isArray(sales)) {
        for (const s of sales) {
          const exists = await trx.queryOne('SELECT id FROM sales WHERE id = ?', [String(s.id)]);
          if (!exists) {
            await trx.execute(
              `INSERT INTO sales (
                id, client_uuid, device_id, seller_id, seller_name, date,
                subtotal, item_discounts_total, subtotal_after_item_discounts,
                global_discount_percent, discount, total_discount, total,
                paid_amount, change_amount, debt_amount, initial_debt_amount, initial_paid_amount,
                payment_method, partial_payment_method, customer_name, notes, is_returned, sync_status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED')`,
              [
                String(s.id),
                s.clientUuid || null,
                s.deviceId || 'bootstrap',
                s.sellerId || 'system',
                s.sellerName || 'Kassa360',
                s.date || new Date().toISOString(),
                Number(s.subtotal || s.total || 0),
                Number(s.itemDiscountsTotal || 0),
                Number(s.subtotalAfterItemDiscounts || s.total || 0),
                Number(s.globalDiscountPercent || 0),
                Number(s.discount || 0),
                Number(s.totalDiscount || s.discount || 0),
                Number(s.total || 0),
                Number(s.paidAmount || s.total || 0),
                Number(s.changeAmount || 0),
                Number(s.debtAmount || 0),
                Number(s.initialDebtAmount || s.debtAmount || 0),
                Number(s.initialPaidAmount || s.paidAmount || 0),
                s.paymentMethod || 'Nağd',
                s.partialPaymentMethod || null,
                s.customerName || null,
                s.notes || null,
                s.isReturned ? 1 : 0,
              ]
            );

            if (Array.isArray(s.items)) {
              for (const itm of s.items) {
                const itemId = itm.id ? String(itm.id) : `si_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
                await trx.execute(
                  `INSERT INTO sale_items (
                    id, sale_id, product_id, product_name, product_barcode, brand, color, color_hex,
                    size, variant_id, comment, quantity, original_price, discount_amount, sale_price,
                    cost_price, total, profit
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    itemId,
                    String(s.id),
                    String(itm.productId),
                    itm.productName,
                    itm.productBarcode || null,
                    itm.brand || null,
                    itm.color || null,
                    itm.colorHex || null,
                    itm.size || null,
                    itm.variantId || null,
                    itm.comment || null,
                    Number(itm.quantity || 1),
                    Number(itm.originalPrice || itm.salePrice || 0),
                    Number(itm.discountAmount || 0),
                    Number(itm.salePrice || 0),
                    Number(itm.costPrice || 0),
                    Number(itm.total || 0),
                    Number(itm.profit || 0),
                  ]
                );
              }
            }

            if (Array.isArray(s.debtPayments)) {
              for (const dp of s.debtPayments) {
                const dpId = dp.id ? String(dp.id) : `dp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
                await trx.execute(
                  `INSERT INTO debt_payments (id, sale_id, amount, previous_debt, remaining_debt, payment_method, notes, date)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    dpId,
                    String(s.id),
                    Number(dp.amount || 0),
                    Number(dp.previousDebt || 0),
                    Number(dp.remainingDebt || 0),
                    dp.paymentMethod || 'Nağd',
                    dp.notes || '',
                    dp.date || new Date().toISOString(),
                  ]
                );
              }
            }
            importedSales++;
          }
        }
      }

      // 5. Settings
      if (setting && typeof setting === 'object') {
        for (const [k, v] of Object.entries(setting)) {
          if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            await trx.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [k, String(v)]);
          }
        }
      }
    });

    console.log(
      `✅ [Bootstrap] Imported: ${importedProducts} products, ${importedSales} sales, ${importedCategories} categories, ${importedSuppliers} suppliers.`
    );

    res.json({
      success: true,
      imported: {
        products: importedProducts,
        sales: importedSales,
        categories: importedCategories,
        suppliers: importedSuppliers,
      },
    });
  } catch (err: any) {
    console.error('Bootstrap error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sync/push - Batch push offline operations (with client UUID idempotency)
router.post('/push', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { operations } = req.body;
    if (!Array.isArray(operations)) {
      res.status(400).json({ error: 'operations array tələb olunur' });
      return;
    }

    const results: Array<{ clientUuid: string; status: 'SUCCESS' | 'DUPLICATE' | 'FAILED'; error?: string }> = [];

    for (const op of operations) {
      const clientUuid = op.clientUuid;
      if (!clientUuid) {
        results.push({ clientUuid: 'unknown', status: 'FAILED', error: 'clientUuid tələb olunur' });
        continue;
      }

      // Check if this operation was already processed
      const existing = await db.queryOne('SELECT id FROM sales WHERE client_uuid = ?', [clientUuid]);
      if (existing) {
        results.push({ clientUuid, status: 'DUPLICATE' });
        continue;
      }

      if (op.type === 'SALE_CREATE') {
        try {
          const saleData = op.payload;
          const items = saleData.items || [];

          // Prepare items for calculation
          const rawItems: any[] = [];
          for (const itm of items) {
            const prod = await db.queryOne('SELECT * FROM products WHERE id = ?', [String(itm.productId)]);
            const origPrice = prod ? Number(prod.sale_price) : Number(itm.originalPrice || itm.salePrice || 0);
            const costPrice = prod ? Number(prod.purchase_price) : Number(itm.costPrice || 0);
            rawItems.push({
              productId: String(itm.productId),
              variantId: itm.variantId ? String(itm.variantId) : undefined,
              productName: itm.productName || (prod ? prod.name : 'Məhsul'),
              productBarcode: itm.productBarcode || (prod ? prod.barcode : ''),
              brand: itm.brand || '',
              color: itm.color || '',
              colorHex: itm.colorHex || '',
              size: itm.size || '',
              comment: itm.comment || '',
              quantity: Math.max(1, Number(itm.quantity || 1)),
              dbOriginalPrice: origPrice,
              dbCostPrice: costPrice,
              requestedDiscountAmount: Number(itm.discountAmount || 0),
            });
          }

          const calc = calculateServerSale(
            rawItems,
            Number(saleData.discount || 0),
            Number(saleData.paidAmount || 0),
            saleData.paymentMethod || 'Nağd'
          );

          const saleId = saleData.id || `sale_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const saleDate = saleData.date || new Date().toISOString();

          await db.transaction(async (trx) => {
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
                clientUuid,
                op.deviceId || 'mobile_offline',
                req.user?.userId || 'system',
                req.user?.fullName || 'Satıcı',
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
                saleData.paymentMethod || 'Nağd',
                saleData.partialPaymentMethod || null,
                saleData.customerName || null,
                saleData.notes || null,
              ]
            );

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

              // Deduct stock
              await trx.execute('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?', [
                item.quantity,
                item.productId,
              ]);
              if (item.variantId) {
                await trx.execute(
                  'UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?',
                  [item.quantity, item.variantId]
                );
              }
            }

            // Log sync operation
            await trx.execute(
              `INSERT INTO sync_operations (id, client_uuid, device_id, entity_type, operation, status)
               VALUES (?, ?, ?, 'sale', 'create', 'SUCCESS')`,
              [`sync_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, clientUuid, op.deviceId || 'mobile']
            );
          });

          // Fetch full sale to broadcast rich data to connected desktops & devices
          const saleRow = await db.queryOne('SELECT * FROM sales WHERE id = ?', [saleId]);
          const saleItems = await db.query('SELECT * FROM sale_items WHERE sale_id = ?', [saleId]);
          const fullSaleObj = saleRow ? {
            id: saleRow.id,
            clientUuid: saleRow.client_uuid,
            deviceId: saleRow.device_id,
            sellerId: saleRow.seller_id,
            sellerName: saleRow.seller_name,
            date: saleRow.date,
            subtotal: Number(saleRow.subtotal),
            itemDiscountsTotal: Number(saleRow.item_discounts_total),
            subtotalAfterItemDiscounts: Number(saleRow.subtotal_after_item_discounts),
            globalDiscountPercent: Number(saleRow.global_discount_percent),
            discount: Number(saleRow.discount),
            totalDiscount: Number(saleRow.total_discount),
            total: Number(saleRow.total),
            paidAmount: Number(saleRow.paid_amount),
            changeAmount: Number(saleRow.change_amount),
            debtAmount: Number(saleRow.debt_amount),
            initialDebtAmount: Number(saleRow.initial_debt_amount),
            initialPaidAmount: Number(saleRow.initial_paid_amount),
            paymentMethod: saleRow.payment_method,
            partialPaymentMethod: saleRow.partial_payment_method,
            customerName: saleRow.customer_name || '',
            notes: saleRow.notes || '',
            isReturned: Boolean(saleRow.is_returned),
            syncStatus: 'SYNCED',
            items: saleItems.map((si: any) => ({
              id: si.id,
              productId: si.product_id,
              productName: si.product_name,
              productBarcode: si.product_barcode || '',
              brand: si.brand || '',
              color: si.color || '',
              colorHex: si.color_hex || '',
              size: si.size || '',
              variantId: si.variant_id || undefined,
              comment: si.comment || '',
              quantity: Number(si.quantity),
              originalPrice: Number(si.original_price),
              discountAmount: Number(si.discount_amount),
              salePrice: Number(si.sale_price),
              costPrice: Number(si.cost_price),
              total: Number(si.total),
              profit: Number(si.profit),
            })),
            debtPayments: [],
          } : { id: saleId, clientUuid };

          realtimeHub.broadcast('SALE_CREATED', fullSaleObj, op.deviceId);
          realtimeHub.broadcast('STOCK_UPDATED', { saleId }, op.deviceId);
          results.push({ clientUuid, status: 'SUCCESS' });
        } catch (opErr: any) {
          results.push({ clientUuid, status: 'FAILED', error: opErr.message });
        }
      }
    }

    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sync/pull - Pull updates for local cache
router.get('/pull', async (req: Request, res: Response): Promise<void> => {
  try {
    const { since } = req.query;
    let productSql = 'SELECT * FROM products';
    const productParams: any[] = [];

    if (since) {
      productSql += ' WHERE updated_at >= ?';
      productParams.push(String(since));
    }

    const products = await db.query(productSql, productParams);
    const variants = await db.query('SELECT * FROM product_variants');
    const categories = await db.query('SELECT * FROM categories');
    const settings = await db.query('SELECT * FROM settings');

    res.json({
      serverTime: new Date().toISOString(),
      productsCount: products.length,
      categories,
      settings: settings.reduce((acc: any, row: any) => {
        acc[row.key] = row.value;
        return acc;
      }, {}),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
