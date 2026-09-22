import { Router, Request, Response } from 'express';
import { db } from '../db';
import { roundMoney } from '../financial/calculator';

const router = Router();

// GET /api/reports/summary
router.get('/summary', async (_req: Request, res: Response): Promise<void> => {
  try {
    const salesSummary = await db.queryOne<{
      totalRevenue: number;
      totalProfit: number;
      totalDiscount: number;
      totalSalesCount: number;
      totalDebt: number;
    }>(`
      SELECT 
        COALESCE(SUM(s.total), 0) as totalRevenue,
        COALESCE(SUM(s.total_discount), 0) as totalDiscount,
        COUNT(s.id) as totalSalesCount,
        COALESCE(SUM(s.debt_amount), 0) as totalDebt,
        COALESCE((SELECT SUM(si.profit) FROM sale_items si JOIN sales s2 ON si.sale_id = s2.id WHERE s2.is_returned = 0), 0) as totalProfit
      FROM sales s
      WHERE s.is_returned = 0
    `);

    const inventorySummary = await db.queryOne<{
      totalProductsCount: number;
      totalItemsInStock: number;
      inventoryCostValue: number;
      inventoryRetailValue: number;
    }>(`
      SELECT 
        COUNT(id) as totalProductsCount,
        COALESCE(SUM(stock_quantity), 0) as totalItemsInStock,
        COALESCE(SUM(stock_quantity * purchase_price), 0) as inventoryCostValue,
        COALESCE(SUM(stock_quantity * sale_price), 0) as inventoryRetailValue
      FROM products
    `);

    const expensesSummary = await db.queryOne<{ totalExpenses: number }>(
      'SELECT COALESCE(SUM(amount), 0) as totalExpenses FROM expenses'
    );

    const grossProfit = Number(salesSummary?.totalProfit || 0);
    const expenses = Number(expensesSummary?.totalExpenses || 0);
    const netProfit = roundMoney(grossProfit - expenses);

    res.json({
      summary: {
        totalRevenue: roundMoney(Number(salesSummary?.totalRevenue || 0)),
        totalProfit: roundMoney(grossProfit),
        netProfit,
        totalExpenses: roundMoney(expenses),
        totalDiscount: roundMoney(Number(salesSummary?.totalDiscount || 0)),
        totalSalesCount: Number(salesSummary?.totalSalesCount || 0),
        totalDebt: roundMoney(Number(salesSummary?.totalDebt || 0)),
        totalProductsCount: Number(inventorySummary?.totalProductsCount || 0),
        totalItemsInStock: Number(inventorySummary?.totalItemsInStock || 0),
        inventoryCostValue: roundMoney(Number(inventorySummary?.inventoryCostValue || 0)),
        inventoryRetailValue: roundMoney(Number(inventorySummary?.inventoryRetailValue || 0)),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/top-products
router.get('/top-products', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(50, Number(req.query.limit || 10));
    const rows = await db.query(
      `SELECT 
        product_id as productId,
        product_name as productName,
        SUM(quantity) as totalQuantity,
        SUM(total) as totalRevenue,
        SUM(profit) as totalProfit
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE s.is_returned = 0
       GROUP BY product_id, product_name
       ORDER BY totalQuantity DESC
       LIMIT ?`,
      [limit]
    );

    res.json({ topProducts: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
