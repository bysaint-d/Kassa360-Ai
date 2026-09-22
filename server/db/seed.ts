import bcrypt from 'bcryptjs';
import { db } from './index';
import { INITIAL_PRODUCTS, INITIAL_CATEGORIES, INITIAL_SUPPLIERS, INITIAL_SETTING } from '../../src/data/seedData';

export async function seedInitialData(): Promise<void> {
  await db.init();

  // 1. Seed Users if none exist
  const existingUsers = await db.query('SELECT COUNT(*) as count FROM users');
  const userCount = Number(existingUsers[0]?.count || 0);

  if (userCount === 0) {
    console.log('🌱 [Seed] Seeding default system roles and users...');
    const usersToSeed = [
      {
        id: 'usr_admin',
        username: 'admin',
        password: 'admin123',
        full_name: 'Baş Administrator',
        role: 'admin',
      },
      {
        id: 'usr_manager',
        username: 'manager',
        password: 'manager123',
        full_name: 'Mağaza Meneceri',
        role: 'manager',
      },
      {
        id: 'usr_seller',
        username: 'seller',
        password: 'seller123',
        full_name: 'Kassir / Satıcı (Nigar Əliyeva)',
        role: 'seller',
      },
      {
        id: 'usr_warehouse',
        username: 'warehouse',
        password: 'warehouse123',
        full_name: 'Anbardar (Rəşad Məmmədov)',
        role: 'warehouse',
      },
    ];

    for (const u of usersToSeed) {
      const hash = bcrypt.hashSync(u.password, 10);
      await db.execute(
        `INSERT INTO users (id, username, password_hash, full_name, role, is_active)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [u.id, u.username, hash, u.full_name, u.role]
      );
    }
  }

  // 2. Seed Settings if none exist
  const existingSettings = await db.query('SELECT COUNT(*) as count FROM settings');
  if (Number(existingSettings[0]?.count || 0) === 0) {
    console.log('🌱 [Seed] Seeding store settings...');
    const defaultSettings: Record<string, string> = {
      storeName: INITIAL_SETTING.storeName || 'CALVOTTI MARKET',
      address: INITIAL_SETTING.address || 'Nizami küç. 45, Bakı',
      phone: INITIAL_SETTING.phone || '+994 50 123 45 67',
      currency: INITIAL_SETTING.currency || 'AZN',
      receiptFooter: INITIAL_SETTING.receiptFooter || 'Bizi seçdiyiniz üçün təşəkkür edirik! Geyim dəyişimi 3 gün ərzində qəbzlə mümkündür.',
      allowNegativeStock: INITIAL_SETTING.allowNegativeStock ? 'true' : 'false',
      defaultDiscountLimitPercent: '30',
      autoPrintReceipt: INITIAL_SETTING.autoPrintReceipt ? 'true' : 'false',
      taxPercent: String(INITIAL_SETTING.taxPercent || 0),
    };

    for (const [k, v] of Object.entries(defaultSettings)) {
      await db.execute('INSERT INTO settings (key, value) VALUES (?, ?)', [k, v]);
    }
  }

  // 3. Seed Categories if empty
  const existingCategories = await db.query('SELECT COUNT(*) as count FROM categories');
  if (Number(existingCategories[0]?.count || 0) === 0) {
    console.log('🌱 [Seed] Seeding clothing categories...');
    for (const cat of INITIAL_CATEGORIES) {
      await db.execute(
        'INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)',
        [String(cat.id), cat.name]
      );
    }
  }

  // 4. Seed Suppliers if empty
  const existingSuppliers = await db.query('SELECT COUNT(*) as count FROM suppliers');
  if (Number(existingSuppliers[0]?.count || 0) === 0) {
    console.log('🌱 [Seed] Seeding suppliers...');
    for (const sup of INITIAL_SUPPLIERS) {
      await db.execute(
        'INSERT OR IGNORE INTO suppliers (id, name, phone, notes) VALUES (?, ?, ?, ?)',
        [String(sup.id), sup.name, sup.phone || '', sup.notes || '']
      );
    }
  }

  // 5. Seed Products if empty
  const existingProducts = await db.query('SELECT COUNT(*) as count FROM products');
  if (Number(existingProducts[0]?.count || 0) === 0) {
    console.log('🌱 [Seed] Seeding initial clothing catalogue...');
    for (const prod of INITIAL_PRODUCTS) {
      const sizesJson = prod.sizes ? JSON.stringify(prod.sizes) : JSON.stringify([]);
      await db.execute(
        `INSERT INTO products (
          id, barcode, name, category, brand, color, color_hex, size, sizes_json,
          purchase_price, sale_price, stock_quantity, minimum_stock, supplier,
          image_path, notes, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          String(prod.id),
          prod.barcode || '',
          prod.name,
          prod.category,
          prod.brand || '',
          prod.color || '',
          prod.colorHex || '',
          prod.size || '',
          sizesJson,
          prod.purchasePrice || 0,
          prod.salePrice || 0,
          prod.stockQuantity || 0,
          prod.minimumStock || 3,
          prod.supplier || '',
          prod.imagePath || '',
          prod.notes || '',
        ]
      );

      // Seed variants if present
      if (prod.variants && prod.variants.length > 0) {
        for (const v of prod.variants) {
          await db.execute(
            `INSERT INTO product_variants (id, product_id, color, color_hex, size, stock_quantity, barcode)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              v.id || `var_${prod.id}_${Math.random().toString(36).substring(2, 8)}`,
              String(prod.id),
              v.color || '',
              v.colorHex || '',
              v.size || '',
              v.stockQuantity || 0,
              v.barcode || '',
            ]
          );
        }
      }
    }
  }

  console.log('✅ [Seed] Database initialization and seed check complete');
}
