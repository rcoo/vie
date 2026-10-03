import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { authCookieOptions, clearAuthCookieOptions } from './cookieOptions.ts';

const ADMIN_PORTAL_COOKIE = 'cinevault_admin_portal';
const ADMIN_PORTAL_TTL_MS = 10 * 60 * 1000;
const FALLBACK_ADMIN_PORTAL_CODE = 'vin01012007';

// If SESSION_SECRET is missing, use an ephemeral secret for this process. The
// portal will simply need to be unlocked again after a server restart.
const portalSigningSecret =
  process.env.SESSION_SECRET?.trim() || crypto.randomBytes(48).toString('hex');

function timingSafeTextEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function sign(value: string): string {
  return crypto.createHmac('sha256', portalSigningSecret).update(value).digest('hex');
}

export function getAdminPortalCode(): string {
  return (process.env.ADMIN_PORTAL_CODE || FALLBACK_ADMIN_PORTAL_CODE).trim();
}

export function isAdminPortalCode(rawCode: string): boolean {
  const supplied = rawCode.trim().toLowerCase();
  const expected = getAdminPortalCode().toLowerCase();
  return timingSafeTextEqual(supplied, expected);
}

export function setAdminPortalUnlockCookie(res: Response): void {
  const issuedAt = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = `${issuedAt}.${nonce}`;
  const token = `${payload}.${sign(payload)}`;

  res.cookie(ADMIN_PORTAL_COOKIE, token, authCookieOptions(ADMIN_PORTAL_TTL_MS, true));
}

export function clearAdminPortalUnlockCookie(res: Response): void {
  res.clearCookie(ADMIN_PORTAL_COOKIE, clearAuthCookieOptions());
}

export function isAdminPortalUnlocked(req: Request): boolean {
  const token = req.cookies?.[ADMIN_PORTAL_COOKIE];
  if (!token || typeof token !== 'string') return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [issuedAtRaw, nonce, signature] = parts;
  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt) || !nonce || !signature) return false;
  if (Date.now() - issuedAt > ADMIN_PORTAL_TTL_MS || issuedAt > Date.now() + 30_000) return false;

  const payload = `${issuedAtRaw}.${nonce}`;
  return timingSafeTextEqual(signature, sign(payload));
}

export function requireAdminPortalUnlock(req: Request, res: Response, next: NextFunction): void {
  if (!isAdminPortalUnlocked(req)) {
    // Intentionally return 404 so the admin login endpoint is not advertised.
    res.status(404).json({ error: 'Not found.' });
    return;
  }
  next();
}
