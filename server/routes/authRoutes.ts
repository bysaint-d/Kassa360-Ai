import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { generateToken } from '../auth/jwt';
import { requireAuth, requireRole, AuthenticatedRequest } from '../auth/middleware';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'İstifadəçi adı və şifrə daxil edilməlidir' });
      return;
    }

    const user = await db.queryOne<{
      id: string;
      username: string;
      password_hash: string;
      full_name: string;
      role: 'admin' | 'manager' | 'seller' | 'warehouse';
      is_active: number;
    }>('SELECT * FROM users WHERE username = ?', [username.trim()]);

    if (!user || user.is_active !== 1) {
      res.status(401).json({ error: 'İstifadəçi adı və ya şifrə yanlışdır' });
      return;
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'İstifadəçi adı və ya şifrə yanlışdır' });
      return;
    }

    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      fullName: user.full_name,
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Giriş zamanı xəta baş verdi' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await db.queryOne<{
      id: string;
      username: string;
      full_name: string;
      role: string;
    }>('SELECT id, username, full_name, role FROM users WHERE id = ?', [req.user!.userId]);

    if (!user) {
      res.status(404).json({ error: 'İstifadəçi tapılmadı' });
      return;
    }

    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/users
router.get('/users', requireAuth, requireRole('admin', 'manager'), async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const users = await db.query(
      'SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY created_at ASC'
    );
    res.json({ users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/users
router.post('/users', requireAuth, requireRole('admin'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { username, password, fullName, role } = req.body;
    if (!username || !password || !fullName || !role) {
      res.status(400).json({ error: 'Bütün məlumatlar doldurulmalıdır' });
      return;
    }

    const existing = await db.queryOne('SELECT id FROM users WHERE username = ?', [username.trim()]);
    if (existing) {
      res.status(400).json({ error: 'Bu istifadəçi adı artıq mövcuddur' });
      return;
    }

    const hash = bcrypt.hashSync(password, 10);
    const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    await db.execute(
      'INSERT INTO users (id, username, password_hash, full_name, role, is_active) VALUES (?, ?, ?, ?, ?, 1)',
      [id, username.trim(), hash, fullName.trim(), role]
    );

    res.status(201).json({
      success: true,
      user: { id, username: username.trim(), fullName: fullName.trim(), role },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
