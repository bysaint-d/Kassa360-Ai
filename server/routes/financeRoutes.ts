import { Router, Request, Response } from 'express';
import { db } from '../db';
import { optionalAuth, AuthenticatedRequest } from '../auth/middleware';

const router = Router();

// GET /api/finance/expenses
router.get('/expenses', async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await db.query('SELECT * FROM expenses ORDER BY date DESC');
    res.json({
      expenses: rows.map((r) => ({
        id: r.id,
        date: r.date,
        amount: Number(r.amount),
        category: r.category,
        notes: r.notes || '',
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/finance/expenses
router.post('/expenses', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { amount, category, notes, date } = req.body;
    if (!amount || !category) {
      res.status(400).json({ error: 'Məbləğ və kateqoriya mütləqdir' });
      return;
    }
    const id = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const expDate = date || new Date().toISOString();

    await db.execute('INSERT INTO expenses (id, date, amount, category, notes) VALUES (?, ?, ?, ?, ?)', [
      id,
      expDate,
      Number(amount),
      category,
      notes || '',
    ]);

    res.status(201).json({
      success: true,
      expense: { id, date: expDate, amount: Number(amount), category, notes },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/finance/expenses/:id
router.delete('/expenses/:id', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await db.execute('DELETE FROM expenses WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/finance/incomes
router.get('/incomes', async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await db.query('SELECT * FROM incomes ORDER BY date DESC');
    res.json({
      incomes: rows.map((r) => ({
        id: r.id,
        date: r.date,
        amount: Number(r.amount),
        source: r.source,
        notes: r.notes || '',
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/finance/incomes
router.post('/incomes', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { amount, source, notes, date } = req.body;
    if (!amount || !source) {
      res.status(400).json({ error: 'Məbləğ və mənbə mütləqdir' });
      return;
    }
    const id = `inc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const incDate = date || new Date().toISOString();

    await db.execute('INSERT INTO incomes (id, date, amount, source, notes) VALUES (?, ?, ?, ?, ?)', [
      id,
      incDate,
      Number(amount),
      source,
      notes || '',
    ]);

    res.status(201).json({
      success: true,
      income: { id, date: incDate, amount: Number(amount), source, notes },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/finance/recurring-expenses
router.get('/recurring-expenses', async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await db.query('SELECT * FROM recurring_expenses ORDER BY day_of_month ASC');
    res.json({
      recurringExpenses: rows.map((r) => ({
        id: r.id,
        name: r.name,
        amount: Number(r.amount),
        category: r.category,
        frequency: r.frequency,
        dayOfMonth: Number(r.day_of_month),
        isActive: Boolean(r.is_active),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/finance/recurring-expenses
router.post('/recurring-expenses', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, amount, category, frequency, dayOfMonth } = req.body;
    const id = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    await db.execute(
      `INSERT INTO recurring_expenses (id, name, amount, category, frequency, day_of_month, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [id, name, Number(amount || 0), category, frequency || 'Aylıq', Number(dayOfMonth || 1)]
    );

    res.status(201).json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
