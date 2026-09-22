import { Router, Request, Response } from 'express';
import { db } from '../db';
import { optionalAuth, AuthenticatedRequest } from '../auth/middleware';
import { realtimeHub } from '../websocket/wsServer';

const router = Router();

// GET /api/settings
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await db.query('SELECT key, value FROM settings');
    const settingsObj: Record<string, any> = {};
    for (const r of rows) {
      if (r.value === 'true') settingsObj[r.key] = true;
      else if (r.value === 'false') settingsObj[r.key] = false;
      else if (!isNaN(Number(r.value)) && r.value.trim() !== '') settingsObj[r.key] = Number(r.value);
      else settingsObj[r.key] = r.value;
    }
    res.json({ settings: settingsObj });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings
router.put('/', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const settings = req.body;
    if (!settings || typeof settings !== 'object') {
      res.status(400).json({ error: 'Tənzimləmə obyekti tələb olunur' });
      return;
    }

    await db.transaction(async (trx) => {
      for (const [k, v] of Object.entries(settings)) {
        await trx.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [k, String(v)]);
      }
    });

    realtimeHub.broadcast('SETTING_UPDATED', settings, req.headers['x-device-id'] as string);
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
