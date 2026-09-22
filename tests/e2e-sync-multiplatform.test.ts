/**
 * End-to-End Multi-Platform Integration Test Suite
 * Tests Desktop & Android Mobile API Synchronization, Authentication,
 * Offline Queue & Idempotency, Stock Updates, and Financial Integrity.
 */

const BASE_URL = 'http://127.0.0.1:3000';

async function runE2ETests() {
  console.log('--- STARTING KASSA360 E2E MULTI-PLATFORM TESTS ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, extra?: any) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`, extra || '');
      failed++;
    }
  }

  try {
    // 1. Health check
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const health = await healthRes.json();
    assert(health.status === 'ok', 'Server health check returns ok');

    // 2. Desktop Admin Login
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    const adminLogin = await adminLoginRes.json();
    assert(adminLogin.token && adminLogin.user.role === 'admin', 'Desktop Admin login successful with JWT');

    // 3. Android Seller Login
    const sellerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'seller', password: 'seller123' }),
    });
    const sellerLogin = await sellerLoginRes.json();
    assert(sellerLogin.token && sellerLogin.user.role === 'seller', 'Android Seller login successful with JWT');

    // 4. Products fetch by Android Mobile Seller
    const productsRes = await fetch(`${BASE_URL}/api/products`, {
      headers: { Authorization: `Bearer ${sellerLogin.token}` },
    });
    const productsData = await productsRes.json();
    const products = productsData.products;
    assert(Array.isArray(products) && products.length > 0, `Android fetches ${products?.length} products`);

    const targetProduct = products[0];
    const initialStock = targetProduct.stockQuantity;

    // 5. Android Seller Creates Sale (1 item, size, color, comment, discount)
    const saleClientUuid = `android_uuid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const salePayload = {
      clientUuid: saleClientUuid,
      deviceId: 'android_samsung_galaxy_s24',
      sellerId: sellerLogin.user.id,
      sellerName: sellerLogin.user.fullName,
      items: [
        {
          productId: targetProduct.id,
          quantity: 1,
          size: 'M',
          color: 'Göy',
          comment: 'Müştəri sabah götürəcək',
          discountAmount: 0,
        },
      ],
      discount: 0,
      paidAmount: targetProduct.salePrice,
      paymentMethod: 'Nağd',
      notes: 'Mobil POS vasitəsilə satış',
    };

    const createSaleRes = await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sellerLogin.token}`,
        'x-device-id': 'android_samsung_galaxy_s24',
      },
      body: JSON.stringify(salePayload),
    });

    const createSaleData = await createSaleRes.json();
    assert(createSaleData.success && createSaleData.sale, 'Android Mobile Seller creates sale successfully');

    const createdSale = createSaleData.sale;
    assert(createdSale.clientUuid === saleClientUuid, 'Authoritative sale contains client_uuid for idempotency');
    assert(createdSale.sellerName === sellerLogin.user.fullName, 'Authoritative sale records seller name');

    // 6. Stock Synchronization check (Desktop views updated product)
    const refreshedProductRes = await fetch(`${BASE_URL}/api/products/${targetProduct.id}`, {
      headers: { Authorization: `Bearer ${adminLogin.token}` },
    });
    const refreshedProductData = await refreshedProductRes.json();
    const newStock = refreshedProductData.product.stockQuantity;
    assert(newStock === initialStock - 1, `Stock decremented accurately from ${initialStock} to ${newStock}`);

    // 7. Desktop Views Sales
    const salesListRes = await fetch(`${BASE_URL}/api/sales`, {
      headers: { Authorization: `Bearer ${adminLogin.token}` },
    });
    const salesListData = await salesListRes.json();
    const foundSaleOnDesktop = salesListData.sales.find((s: any) => s.id === createdSale.id);
    assert(Boolean(foundSaleOnDesktop), 'Desktop sees sale created by Android mobile seller');
    assert(foundSaleOnDesktop.items[0].comment === 'Müştəri sabah götürəcək', 'Sale item comment preserved on desktop');

    // 8. Offline Mode Idempotency & Conflict Prevention
    const offlineClientUuid = `offline_uuid_${Date.now()}`;
    const offlineSyncPayload = {
      operations: [
        {
          id: 'op_test_1',
          clientUuid: offlineClientUuid,
          deviceId: 'android_test_device',
          type: 'SALE_CREATE',
          payload: {
            clientUuid: offlineClientUuid,
            deviceId: 'android_test_device',
            sellerId: sellerLogin.user.id,
            sellerName: sellerLogin.user.fullName,
            items: [{ productId: targetProduct.id, quantity: 1, discountAmount: 0 }],
            discount: 0,
            paidAmount: targetProduct.salePrice,
            paymentMethod: 'Nağd',
          },
        },
      ],
    };

    // First push -> SUCCESS
    const syncRes1 = await fetch(`${BASE_URL}/api/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sellerLogin.token}`,
      },
      body: JSON.stringify(offlineSyncPayload),
    });
    const syncData1 = await syncRes1.json();
    assert(syncData1.results[0].status === 'SUCCESS', 'First sync push processed as SUCCESS');

    // Second push with same client_uuid -> DUPLICATE (prevents duplicate sales)
    const syncRes2 = await fetch(`${BASE_URL}/api/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sellerLogin.token}`,
      },
      body: JSON.stringify(offlineSyncPayload),
    });
    const syncData2 = await syncRes2.json();
    assert(syncData2.results[0].status === 'DUPLICATE', 'Duplicate offline sync push detected and blocked as DUPLICATE');

    // 9. Financial Regression Check on Receipt Edit
    // Create dedicated 120 AZN product
    const createProdRes = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminLogin.token}`,
      },
      body: JSON.stringify({
        name: 'Kişi Kostyumu 120 AZN Test',
        barcode: `TEST_${Date.now()}`,
        brand: 'Calvotti',
        category: 'Kostyumlar',
        purchasePrice: 60,
        salePrice: 120,
        stockQuantity: 20,
        minimumStock: 2,
        size: 'M',
        color: 'Qara',
      }),
    });
    const createProdData = await createProdRes.json();
    const test120Product = createProdData.product;

    // Sell 120 AZN item with 20 AZN discount -> total 100 AZN
    const editTestSaleRes = await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminLogin.token}`,
      },
      body: JSON.stringify({
        items: [{ productId: test120Product.id, quantity: 1, discountAmount: 0, size: 'M' }],
        discount: 20, // 20 AZN global discount
        paidAmount: 100,
        paymentMethod: 'Nağd',
      }),
    });
    const editTestSaleData = await editTestSaleRes.json();
    const editSaleId = editTestSaleData.sale.id;
    assert(editTestSaleData.sale.total === 100, 'Initial sale of 120 AZN item with 20 AZN discount = 100 AZN');

    // Edit only size (M -> L)
    const updateSaleRes = await fetch(`${BASE_URL}/api/sales/${editSaleId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminLogin.token}`,
      },
      body: JSON.stringify({
        items: [{ productId: test120Product.id, quantity: 1, size: 'L', discountAmount: 0 }],
        discount: 20,
      }),
    });
    const updateSaleData = await updateSaleRes.json();
    console.log('UPDATE SALE RESPONSE:', updateSaleRes.status, updateSaleData);
    assert(
      updateSaleData.sale?.total === 100,
      'Size Edit preserves 100 AZN total (Double discount bug strictly prevented on server)'
    );

    console.log(`\n================================`);
    console.log(`E2E TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('E2E Test execution error:', err);
    process.exit(1);
  }
}

runE2ETests();
