import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'kassa360-enterprise-pos-secret-2026-xyz';

export interface TokenPayload {
  userId: string;
  username: string;
  role: 'admin' | 'manager' | 'seller' | 'warehouse';
  fullName: string;
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (err) {
    return null;
  }
}
