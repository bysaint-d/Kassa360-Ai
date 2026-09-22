import { Router, Request, Response } from 'express';
import { db } from '../db';
import { optionalAuth, requireRole, AuthenticatedRequest } from '../auth/middleware';
import { realtimeHub } from '../websocket/wsServer';

const router = Router();

// Helper to format product with variants and parsed sizes
function formatProductRow(p: any, variants: any[] = []): any {
  let sizes: string[] = [];
  try {
    if (p.sizes_json) {
      sizes = JSON.parse(p.sizes_json);
    } else if (p.size) {
      sizes = p.size.split(/[,/]+/).map((s: string) => s.trim()).filter(Boolean);
    }
  } catch (e) {
    sizes = [];
  }

  return {
    id: p.id,
    barcode: p.barcode || '',
    name: p.name,
    category: p.category,
    brand: p.brand || '',
    color: p.color || '',
    colorHex: p.color_hex || '',
    size: p.size || '',
    sizes,
    purchasePrice: Number(p.purchase_price || 0),
    salePrice: Number(p.sale_price || 0),
    stockQuantity: Number(p.stock_quantity || 0),
    minimumStock: Number(p.minimum_stock || 3),
    supplier: p.supplier || '',
    imagePath: p.image_path || '',
    notes: p.notes || '',
    variants: variants.map((v) => ({
      id: v.id,
      color: v.color || '',
      colorHex: v.color_hex || '',
      size: v.size || '',
      stockQuantity: Number(v.stock_quantity || 0),
      barcode: v.barcode || '',
    })),
  };
}

// GET /api/products - List all products with their variants
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, search } = req.query;
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params: any[] = [];

    if (category && category !== 'all') {
      sql += ' AND category = ?';
      params.push(String(category));
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      sql += ' AND (LOWER(name) LIKE ? OR LOWER(barcode) LIKE ? OR LOWER(brand) LIKE ?)';
      params.push(q, q, q);
    }

    sql += ' ORDER BY name ASC';
    const products = await db.query(sql, params);

    // Fetch all variants
    const allVariants = await db.query('SELECT * FROM product_variants');
    const variantMap = new Map<string, any[]>();
    for (const v of allVariants) {
      const list = variantMap.get(v.product_id) || [];
      list.push(v);
      variantMap.set(v.product_id, list);
    }

    const formatted = products.map((p) => formatProductRow(p, variantMap.get(p.id) || []));
    res.json({ products: formatted });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/barcode/:barcode
router.get('/barcode/:barcode', async (req: Request, res: Response): Promise<void> => {
  try {
    const barcode = req.params.barcode.trim();
    // Check main product barcode
    const product = await db.queryOne('SELECT * FROM products WHERE barcode = ?', [barcode]);
    if (product) {
      const variants = await db.query('SELECT * FROM product_variants WHERE product_id = ?', [product.id]);
      res.json({ product: formatProductRow(product, variants) });
      return;
    }

    // Check variant barcode
    const variant = await db.queryOne('SELECT * FROM product_variants WHERE barcode = ?', [barcode]);
    if (variant) {
      const parentProduct = await db.queryOne('SELECT * FROM products WHERE id = ?', [variant.product_id]);
      if (parentProduct) {
        const variants = await db.query('SELECT * FROM product_variants WHERE product_id = ?', [parentProduct.id]);
        res.json({
          product: formatProductRow(parentProduct, variants),
          matchedVariantId: variant.id,
        });
        return;
      }
    }

    res.status(404).json({ error: 'Barkoda uyğun məhsul tapılmadı' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await db.queryOne('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!product) {
      res.status(404).json({ error: 'Məhsul tapılmadı' });
      return;
    }
    const variants = await db.query('SELECT * FROM product_variants WHERE product_id = ?', [product.id]);
    res.json({ product: formatProductRow(product, variants) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products - Create product + variants
router.post('/', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const body = req.body;
    if (!body.name || !body.category) {
      res.status(400).json({ error: 'Məhsul adı və kateqoriya mütləqdir' });
      return;
    }

    const id = body.id ? String(body.id) : `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const sizesJson = Array.isArray(body.sizes) ? JSON.stringify(body.sizes) : JSON.stringify([]);
    const stockQty = Number(body.stockQuantity || 0);

    await db.transaction(async (trx) => {
      await trx.execute(
        `INSERT INTO products (
          id, barcode, name, category, brand, color, color_hex, size, sizes_json,
          purchase_price, sale_price, stock_quantity, minimum_stock, supplier,
          image_path, notes, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          id,
          body.barcode?.trim() || null,
          body.name.trim(),
          body.category.trim(),
          body.brand?.trim() || '',
          body.color?.trim() || '',
          body.colorHex?.trim() || '',
          body.size?.trim() || '',
          sizesJson,
          Number(body.purchasePrice || 0),
          Number(body.salePrice || 0),
          stockQty,
          Number(body.minimumStock || 3),
          body.supplier?.trim() || '',
          body.imagePath || '',
          body.notes || '',
        ]
      );

      // Insert variants if any
      if (Array.isArray(body.variants)) {
        for (const v of body.variants) {
          const varId = v.id || `var_${id}_${Math.random().toString(36).substring(2, 6)}`;
          await trx.execute(
            `INSERT INTO product_variants (id, product_id, color, color_hex, size, stock_quantity, barcode)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              varId,
              id,
              v.color?.trim() || '',
              v.colorHex?.trim() || '',
              v.size?.trim() || '',
              Number(v.stockQuantity || 0),
              v.barcode?.trim() || null,
            ]
          );
        }
      }

      // Record initial stock movement
      if (stockQty > 0) {
        await trx.execute(
          `INSERT INTO stock_movements (id, product_id, product_name, type, quantity, previous_stock, new_stock, notes, user_id, user_name, date)
           VALUES (?, ?, ?, 'İlkin stok', ?, 0, ?, 'Məhsul yaradılarkən qeydə alındı', ?, ?, ?)`,
          [
            `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            id,
            body.name.trim(),
            stockQty,
            stockQty,
            req.user?.userId || 'system',
            req.user?.fullName || 'Kassa360',
            new Date().toISOString(),
          ]
        );
      }
    });

    const created = await db.queryOne('SELECT * FROM products WHERE id = ?', [id]);
    const variants = await db.query('SELECT * FROM product_variants WHERE product_id = ?', [id]);
    const formatted = formatProductRow(created, variants);

    // Broadcast real-time update
    realtimeHub.broadcast('PRODUCT_CREATED', formatted, req.headers['x-device-id'] as string);

    res.status(201).json({ success: true, product: formatted });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/products/:id - Update product
router.put('/:id', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id;
    const body = req.body;
    const existing = await db.queryOne('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Məhsul tapılmadı' });
      return;
    }

    const sizesJson = Array.isArray(body.sizes) ? JSON.stringify(body.sizes) : existing.sizes_json;
    const newStockQty = body.stockQuantity !== undefined ? Number(body.stockQuantity) : Number(existing.stock_quantity);
    const oldStockQty = Number(existing.stock_quantity);

    await db.transaction(async (trx) => {
      await trx.execute(
        `UPDATE products SET
          barcode = ?, name = ?, category = ?, brand = ?, color = ?, color_hex = ?,
          size = ?, sizes_json = ?, purchase_price = ?, sale_price = ?,
          stock_quantity = ?, minimum_stock = ?, supplier = ?, image_path = ?,
          notes = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          body.barcode !== undefined ? body.barcode.trim() : existing.barcode,
          body.name !== undefined ? body.name.trim() : existing.name,
          body.category !== undefined ? body.category.trim() : existing.category,
          body.brand !== undefined ? body.brand.trim() : existing.brand,
          body.color !== undefined ? body.color.trim() : existing.color,
          body.colorHex !== undefined ? body.colorHex.trim() : existing.color_hex,
          body.size !== undefined ? body.size.trim() : existing.size,
          sizesJson,
          body.purchasePrice !== undefined ? Number(body.purchasePrice) : Number(existing.purchase_price),
          body.salePrice !== undefined ? Number(body.salePrice) : Number(existing.sale_price),
          newStockQty,
          body.minimumStock !== undefined ? Number(body.minimumStock) : Number(existing.minimum_stock),
          body.supplier !== undefined ? body.supplier.trim() : existing.supplier,
          body.imagePath !== undefined ? body.imagePath : existing.image_path,
          body.notes !== undefined ? body.notes : existing.notes,
          id,
        ]
      );

      // If variants provided, replace them
      if (Array.isArray(body.variants)) {
        await trx.execute('DELETE FROM product_variants WHERE product_id = ?', [id]);
        for (const v of body.variants) {
          const varId = v.id || `var_${id}_${Math.random().toString(36).substring(2, 6)}`;
          await trx.execute(
            `INSERT INTO product_variants (id, product_id, color, color_hex, size, stock_quantity, barcode)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              varId,
              id,
              v.color?.trim() || '',
              v.colorHex?.trim() || '',
              v.size?.trim() || '',
              Number(v.stockQuantity || 0),
              v.barcode?.trim() || null,
            ]
          );
        }
      }

      // If stock quantity manually adjusted via edit form
      if (newStockQty !== oldStockQty) {
        const diff = newStockQty - oldStockQty;
        await trx.execute(
          `INSERT INTO stock_movements (id, product_id, product_name, type, quantity, previous_stock, new_stock, notes, user_id, user_name, date)
           VALUES (?, ?, ?, 'Stok düzəlişi', ?, ?, ?, 'Məhsul redaktəsində dəyişdirildi', ?, ?, ?)`,
          [
            `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            id,
            body.name || existing.name,
            Math.abs(diff),
            oldStockQty,
            newStockQty,
            req.user?.userId || 'system',
            req.user?.fullName || 'Kassa360',
            new Date().toISOString(),
          ]
        );
      }
    });

    const updated = await db.queryOne('SELECT * FROM products WHERE id = ?', [id]);
    const variants = await db.query('SELECT * FROM product_variants WHERE product_id = ?', [id]);
    const formatted = formatProductRow(updated, variants);

    // Broadcast real-time update
    realtimeHub.broadcast('PRODUCT_UPDATED', formatted, req.headers['x-device-id'] as string);

    res.json({ success: true, product: formatted });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/:id
router.delete('/:id', optionalAuth, requireRole('admin', 'manager'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id;
    const existing = await db.queryOne('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Məhsul tapılmadı' });
      return;
    }

    await db.transaction(async (trx) => {
      await trx.execute('DELETE FROM product_variants WHERE product_id = ?', [id]);
      await trx.execute('DELETE FROM products WHERE id = ?', [id]);
    });

    realtimeHub.broadcast('PRODUCT_DELETED', { id }, req.headers['x-device-id'] as string);
    res.json({ success: true, message: 'Məhsul uğurla silindi' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Categories & Suppliers
router.get('/meta/categories', async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await db.query('SELECT * FROM categories ORDER BY name ASC');
    res.json({ categories });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/meta/categories', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Kateqoriya adı daxil edilməlidir' });
      return;
    }
    const id = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await db.execute('INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)', [id, name.trim()]);
    res.status(201).json({ category: { id, name: name.trim() } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/meta/suppliers', async (_req: Request, res: Response): Promise<void> => {
  try {
    const suppliers = await db.query('SELECT * FROM suppliers ORDER BY name ASC');
    res.json({ suppliers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/meta/suppliers', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, phone, notes } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Təchizatçı adı daxil edilməlidir' });
      return;
    }
    const id = `sup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await db.execute('INSERT OR IGNORE INTO suppliers (id, name, phone, notes) VALUES (?, ?, ?, ?)', [
      id,
      name.trim(),
      phone || '',
      notes || '',
    ]);
    res.status(201).json({ supplier: { id, name: name.trim(), phone, notes } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
