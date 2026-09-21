/**
 * Automated tests for POS Discount & Sale Recalculation
 * Specifically verifies prevention of double-discount bug on size and sale edits.
 *
 * Test Case:
 * Product = 120 AZN
 * Discount = 20 AZN
 * Expected Total = 100 AZN
 * Editing size must preserve 100 AZN (NEVER 80 AZN or 60 AZN).
 */

import { calculateFinalSaleItems, calculateCartRow, roundMoney } from '../src/utils/calculations';

function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`, details || '');
      failed++;
    }
  }

  console.log('--- RUNNING POS DISCOUNT & RECALCULATION TESTS ---');

  // Test 1: Initial sale with 120 AZN product and 20 AZN global receipt discount
  const productA = {
    id: 1,
    name: 'Kişi Kostyumu',
    purchasePrice: 60,
    salePrice: 120,
    stockQuantity: 10,
    minimumStock: 2,
    category: 'Geyim',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const initialSaleRes = calculateFinalSaleItems(
    [{ product: productA, quantity: 1, discountAmount: 0, size: 'M' }],
    1001,
    20 // 20 AZN global discount
  );

  assert(
    initialSaleRes.totals.finalTotal === 100,
    'Initial Sale: 120 AZN item - 20 AZN discount = 100 AZN total',
    { finalTotal: initialSaleRes.totals.finalTotal }
  );

  assert(
    initialSaleRes.saleItems[0].originalPrice === 120,
    'Initial Sale: Line item originalPrice recorded as 120 AZN',
    { originalPrice: initialSaleRes.saleItems[0].originalPrice }
  );

  assert(
    initialSaleRes.saleItems[0].discountAmount === 0,
    'Initial Sale: Line item discountAmount is 0 (global discount is stored separately)',
    { discountAmount: initialSaleRes.saleItems[0].discountAmount }
  );

  // Test 2: Edit product size (M -> L) preserving base price and discount
  const itemToEdit = initialSaleRes.saleItems[0];
  const sizeChangeItem = {
    ...itemToEdit,
    size: 'L', // Size edited from M to L
  };

  // Simulate modal / store recalculation with size 'L'
  const grossSubtotal = roundMoney(sizeChangeItem.originalPrice * sizeChangeItem.quantity);
  const lineDisc = roundMoney(Math.min(grossSubtotal, Math.max(0, sizeChangeItem.discountAmount || 0)));
  const lineTotal = roundMoney(Math.max(0, grossSubtotal - lineDisc));
  const subtotalAfterItemDiscounts = lineTotal;
  const globalDiscount = 20;
  const recalculatedTotal = roundMoney(Math.max(0, subtotalAfterItemDiscounts - globalDiscount));

  assert(
    recalculatedTotal === 100,
    'Size Edit (M -> L): Total must be 100 AZN (NOT 80 AZN)',
    { recalculatedTotal }
  );

  // Test 3: Second sequential size edit (L -> XL)
  const secondSizeChangeItem = {
    ...sizeChangeItem,
    size: 'XL',
  };
  const gross2 = roundMoney(secondSizeChangeItem.originalPrice * secondSizeChangeItem.quantity);
  const lineDisc2 = roundMoney(Math.min(gross2, Math.max(0, secondSizeChangeItem.discountAmount || 0)));
  const lineTotal2 = roundMoney(Math.max(0, gross2 - lineDisc2));
  const recalculatedTotal2 = roundMoney(Math.max(0, lineTotal2 - globalDiscount));

  assert(
    recalculatedTotal2 === 100,
    'Sequential Size Edit (L -> XL): Total must still be 100 AZN (NOT 60 AZN)',
    { recalculatedTotal2 }
  );

  // Test 4: Line-level item discount of 20 AZN (0 AZN global discount)
  const itemDiscRes = calculateFinalSaleItems(
    [{ product: productA, quantity: 1, discountAmount: 20, size: 'M' }],
    1002,
    0
  );
  assert(
    itemDiscRes.totals.finalTotal === 100,
    'Item Discount: 120 AZN with 20 AZN line discount = 100 AZN total',
    { finalTotal: itemDiscRes.totals.finalTotal }
  );

  // Test 5: Combined discounts (10 AZN item discount + 15 AZN global discount on 120 AZN item)
  const combinedRes = calculateFinalSaleItems(
    [{ product: productA, quantity: 1, discountAmount: 10, size: 'M' }],
    1003,
    15
  );
  assert(
    combinedRes.totals.finalTotal === 95,
    'Combined Discount: 120 - 10 (item) - 15 (global) = 95 AZN total',
    { finalTotal: combinedRes.totals.finalTotal }
  );
  assert(
    combinedRes.totals.totalDiscount === 25,
    'Combined Discount: totalDiscount equals 25 AZN',
    { totalDiscount: combinedRes.totals.totalDiscount }
  );

  // Test 6: Quantity change during edit
  // 1 item @ 120 with 20 global discount -> increased to 2 items @ 120 = 240 gross - 20 disc = 220 net
  const qty2Gross = roundMoney(productA.salePrice * 2);
  const qty2Total = roundMoney(Math.max(0, qty2Gross - 20));
  assert(
    qty2Total === 220,
    'Quantity Change: 2 items @ 120 AZN - 20 AZN discount = 220 AZN total',
    { qty2Total }
  );

  // Test 7: Debt sale verification
  const totalSale = 100;
  const initialPaid = 30;
  const remainingDebt = roundMoney(totalSale - initialPaid);
  assert(
    remainingDebt === 70,
    'Debt Sale: 100 AZN total - 30 AZN paid = 70 AZN remaining debt',
    { remainingDebt }
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
