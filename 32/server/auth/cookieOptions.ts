import type { CookieOptions } from 'express';

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.npm_lifecycle_event === 'start';
}

export function authCookieOptions(maxAge?: number, httpOnly = true): CookieOptions {
  return {
    httpOnly,
    secure: isProductionRuntime(),
    sameSite: 'lax',
    path: '/',
    ...(typeof maxAge === 'number' ? { maxAge } : {})
  };
}

export function clearAuthCookieOptions(): CookieOptions {
  return {
    secure: isProductionRuntime(),
    sameSite: 'lax',
    path: '/'
  };
}
