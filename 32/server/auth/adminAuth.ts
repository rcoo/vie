import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { storage } from '../db/storage.ts';
import type { Admin } from '../db/schema.ts';
import { authCookieOptions, clearAuthCookieOptions } from './cookieOptions.ts';

const ADMIN_COOKIE = 'cinevault_admin';
const ADMIN_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Login attempt throttling remains in memory; it is intentionally short-lived.
const loginRateLimit = new Map<string, { count: number; blockedUntil?: number; firstAttempt: number }>();

export interface AuthenticatedAdminRequest extends Request {
  admin?: Admin;
}

function hashAdminToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function getAdminToken(req: Request): string | undefined {
  const headerToken = req.headers['x-admin-token'];
  return (
    req.cookies?.[ADMIN_COOKIE] ||
    (typeof headerToken === 'string' ? headerToken : undefined) ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined)
  );
}

export function checkRateLimit(ip: string, maxAttempts = 6, windowMs = 15 * 60 * 1000): { blocked: boolean; remainingMs?: number } {
  const now = Date.now();
  const entry = loginRateLimit.get(ip);

  if (!entry) {
    loginRateLimit.set(ip, { count: 1, firstAttempt: now });
    return { blocked: false };
  }

  if (entry.blockedUntil && now < entry.blockedUntil) {
    return { blocked: true, remainingMs: entry.blockedUntil - now };
  }

  if (now - entry.firstAttempt > windowMs) {
    loginRateLimit.set(ip, { count: 1, firstAttempt: now });
    return { blocked: false };
  }

  entry.count++;
  if (entry.count > maxAttempts) {
    entry.blockedUntil = now + windowMs;
    return { blocked: true, remainingMs: windowMs };
  }

  return { blocked: false };
}

export function resetRateLimit(ip: string): void {
  loginRateLimit.delete(ip);
}

export async function verifyAdminCredentials(
  username: string,
  plainPass: string,
  ipAddress: string
): Promise<{ success: boolean; error?: string; admin?: Admin; token?: string }> {
  const limit = checkRateLimit(ipAddress);
  if (limit.blocked) {
    const mins = Math.ceil((limit.remainingMs || 0) / 60000);
    return {
      success: false,
      error: `Too many login attempts. Please wait ${mins} minutes before trying again.`
    };
  }

  const admin = storage.getAdminByUsername(username);
  if (!admin) {
    storage.addAuditLog({
      action: 'ADMIN_LOGIN_FAILED',
      details: `Failed admin login attempt for user: "${username}"`,
      ipAddress,
      level: 'WARN'
    });
    return { success: false, error: 'Invalid admin username or password.' };
  }

  const match = await bcrypt.compare(plainPass, admin.passwordHash);
  if (!match) {
    storage.addAuditLog({
      action: 'ADMIN_LOGIN_FAILED',
      details: `Failed password for admin: "${username}"`,
      ipAddress,
      level: 'WARN'
    });
    return { success: false, error: 'Invalid admin username or password.' };
  }

  resetRateLimit(ipAddress);
  storage.deleteExpiredAdminSessions();
  storage.revokeAdminSessionsForAdmin(admin.id);

  const token = crypto.randomBytes(32).toString('hex');
  storage.createAdminSession({
    adminId: admin.id,
    tokenHash: hashAdminToken(token),
    ipAddress,
    expiresAt: new Date(Date.now() + ADMIN_SESSION_TTL_MS).toISOString()
  });

  storage.addAuditLog({
    action: 'ADMIN_LOGIN_SUCCESS',
    details: `Admin "${admin.username}" authenticated successfully.`,
    ipAddress,
    level: 'INFO'
  });

  return { success: true, admin, token };
}

export function setAdminCookie(res: Response, token: string): void {
  res.cookie(ADMIN_COOKIE, token, authCookieOptions(ADMIN_SESSION_TTL_MS, true));
}

export function clearAdminCookie(res: Response): void {
  res.clearCookie(ADMIN_COOKIE, clearAuthCookieOptions());
}

export function revokeAdminSession(req: Request): void {
  const token = getAdminToken(req);
  if (token) {
    storage.revokeAdminSessionByTokenHash(hashAdminToken(token));
  }
}

export function requireAdminAuth(req: AuthenticatedAdminRequest, res: Response, next: NextFunction): void {
  const token = getAdminToken(req);

  if (!token) {
    res.status(401).json({ error: 'Admin authentication required.' });
    return;
  }

  const session = storage.getAdminSessionByTokenHash(hashAdminToken(token));
  if (!session) {
    res.status(401).json({ error: 'Admin session expired or invalid.' });
    return;
  }

  const expiresAt = new Date(session.expiresAt).getTime();
  const lastActiveAt = new Date(session.lastActiveAt).getTime();
  const now = Date.now();

  if (!Number.isFinite(expiresAt) || expiresAt <= now || !Number.isFinite(lastActiveAt) || now - lastActiveAt > ADMIN_SESSION_TTL_MS) {
    storage.revokeAdminSessionByTokenHash(hashAdminToken(token));
    res.status(401).json({ error: 'Admin session timed out.' });
    return;
  }

  const admin = storage.getAdminById(session.adminId);
  if (!admin) {
    storage.revokeAdminSessionByTokenHash(hashAdminToken(token));
    res.status(401).json({ error: 'Admin user not found.' });
    return;
  }

  storage.touchAdminSession(session.id);
  req.admin = admin;
  next();
}
