import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { storage } from '../db/storage.ts';
import type { AccessSession, AccessCode } from '../db/schema.ts';
import { authCookieOptions, clearAuthCookieOptions } from './cookieOptions.ts';

const SESSION_COOKIE = 'cinevault_session';
const DEVICE_COOKIE = 'cinevault_device';
const VIEWER_SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export interface AuthenticatedViewerRequest extends Request {
  viewerSession?: AccessSession;
  accessCode?: AccessCode;
}

export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function getViewerSessionToken(req: Request): string | undefined {
  const deviceHeader = req.headers['x-device-token'];
  const sessionHeader = req.headers['x-session-token'];
  return (
    req.cookies?.[SESSION_COOKIE] ||
    req.cookies?.[DEVICE_COOKIE] ||
    (typeof deviceHeader === 'string' ? deviceHeader : undefined) ||
    (typeof sessionHeader === 'string' ? sessionHeader : undefined)
  );
}

/**
 * Validates access code and establishes a device session with device limit enforcement.
 */
export function authenticateAccessCode(
  rawCode: string,
  clientDeviceToken: string | undefined,
  deviceInfo: string,
  ipAddress: string
): { success: boolean; error?: string; session?: AccessSession; accessCode?: AccessCode } {
  if (!rawCode || typeof rawCode !== 'string') {
    return { success: false, error: 'يرجى إدخال كود الدخول.' };
  }

  const accessCode = storage.getAccessCodeByCode(rawCode);
  if (!accessCode) {
    storage.addAuditLog({
      action: 'INVALID_ACCESS_CODE',
      details: 'Failed viewer access-code attempt.',
      ipAddress,
      level: 'WARN'
    });
    return { success: false, error: 'الكود غير صحيح أو منتهي.' };
  }

  if (accessCode.status === 'DISABLED') {
    return { success: false, error: 'هذا الكود تم تعطيله من قبل الإدارة.' };
  }

  if (accessCode.expiresAt) {
    const expiry = new Date(accessCode.expiresAt).getTime();
    if (Date.now() > expiry) {
      storage.updateAccessCode(accessCode.id, { status: 'EXPIRED' });
      return { success: false, error: 'الكود منتهي الصلاحية.' };
    }
  }

  const deviceToken = clientDeviceToken || generateSecureToken();
  const existingSession = storage.getSessionByToken(deviceToken);

  if (existingSession && existingSession.accessCodeId === accessCode.id) {
    storage.updateSessionActivity(deviceToken);
    storage.updateAccessCode(accessCode.id, { lastUsedAt: new Date().toISOString() });
    return { success: true, session: existingSession, accessCode };
  }

  const activeCount = storage.countActiveSessionsByAccessCode(accessCode.id);
  if (activeCount >= accessCode.maxDevices) {
    storage.addAuditLog({
      action: 'DEVICE_LIMIT_EXCEEDED',
      details: `Access code reached device limit (${activeCount}/${accessCode.maxDevices}).`,
      ipAddress,
      level: 'WARN'
    });
    return {
      success: false,
      error: `تم الوصول إلى الحد الأقصى للأجهزة المصرح بها لهذا الكود (${accessCode.maxDevices} أجهزة). تواصل مع الإدارة أو قم بإلغاء الجلسات القديمة.`
    };
  }

  const newSession = storage.createSession({
    accessCodeId: accessCode.id,
    deviceToken,
    deviceInfo: deviceInfo || 'Unknown Browser',
    ipAddress
  });

  storage.updateAccessCode(accessCode.id, { lastUsedAt: new Date().toISOString() });
  storage.addAuditLog({
    action: 'ACCESS_CODE_LOGIN_SUCCESS',
    details: `Viewer authenticated. Active devices: ${activeCount + 1}/${accessCode.maxDevices}`,
    ipAddress,
    level: 'INFO'
  });

  return { success: true, session: newSession, accessCode };
}

export function setViewerSessionCookie(res: Response, sessionToken: string): void {
  res.cookie(SESSION_COOKIE, sessionToken, authCookieOptions(VIEWER_SESSION_TTL_MS, true));
  // Keep a second HttpOnly device cookie for backward-compatible device reuse.
  res.cookie(DEVICE_COOKIE, sessionToken, authCookieOptions(VIEWER_SESSION_TTL_MS, true));
}

export function clearViewerSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, clearAuthCookieOptions());
  res.clearCookie(DEVICE_COOKIE, clearAuthCookieOptions());
}

export function requireViewerAuth(req: AuthenticatedViewerRequest, res: Response, next: NextFunction): void {
  const token = getViewerSessionToken(req);

  if (!token) {
    res.status(401).json({ error: 'Access code required. Please enter your access code.' });
    return;
  }

  const session = storage.getSessionByToken(token);
  if (!session || session.status !== 'ACTIVE') {
    res.status(401).json({ error: 'Session expired or revoked. Please enter access code again.' });
    return;
  }

  const accessCode = storage.getAccessCodeById(session.accessCodeId);
  if (!accessCode || accessCode.status !== 'ACTIVE') {
    res.status(401).json({ error: 'Access code is no longer active.' });
    return;
  }

  if (accessCode.expiresAt && Date.now() > new Date(accessCode.expiresAt).getTime()) {
    storage.updateAccessCode(accessCode.id, { status: 'EXPIRED' });
    res.status(401).json({ error: 'Access code has expired.' });
    return;
  }

  storage.updateSessionActivity(token);
  req.viewerSession = session;
  req.accessCode = accessCode;
  next();
}
