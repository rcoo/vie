import dns from 'dns/promises';
import net from 'net';

function isBlockedIPv4(address: string): boolean {
  const p = address.split('.').map(Number);
  if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isBlockedIPv6(address: string): boolean {
  const value = address.toLowerCase();
  if (value === '::' || value === '::1') return true;
  if (value.startsWith('fc') || value.startsWith('fd')) return true; // unique-local fc00::/7
  if (/^fe[89ab]/.test(value)) return true; // link-local fe80::/10

  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIPv4(mapped[1]);
  return false;
}

function isBlockedAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return isBlockedIPv4(address);
  if (family === 6) return isBlockedIPv6(address);
  return true;
}

export async function validateExternalHttpUrl(rawUrl: string | URL): Promise<URL> {
  const value = rawUrl instanceof URL ? rawUrl.toString() : rawUrl;
  if (!value || typeof value !== 'string') {
    throw new Error('Video URL is required.');
  }

  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error('Invalid video URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Forbidden protocol: ${parsed.protocol}. Only http and https are permitted.`);
  }
  if (parsed.username || parsed.password) {
    throw new Error('URLs containing embedded username/password credentials are not permitted.');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new Error(`Access to local or private network host "${hostname}" is prohibited.`);
  }

  if (net.isIP(hostname)) {
    if (isBlockedAddress(hostname)) {
      throw new Error(`Access to local or private network address "${hostname}" is prohibited.`);
    }
    return parsed;
  }

  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0) {
    throw new Error(`Could not resolve video host "${hostname}".`);
  }
  if (addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new Error(`Video host "${hostname}" resolves to a private or reserved network address.`);
  }

  return parsed;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Fetch an external HTTP(S) resource while protecting against redirect-based SSRF.
 * Every redirect target is DNS-checked again before the request is followed.
 */
export async function fetchWithHeaderTimeout(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs = 15_000,
  maxRedirects = 6
): Promise<Response> {
  let currentUrl = await validateExternalHttpUrl(input);
  let currentInit: RequestInit = { ...init };

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        ...currentInit,
        redirect: 'manual',
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }

    if (!REDIRECT_STATUSES.has(response.status)) {
      return response;
    }

    const location = response.headers.get('location');
    await response.body?.cancel().catch(() => {});
    if (!location) {
      throw new Error(`Remote source returned redirect HTTP ${response.status} without a Location header.`);
    }
    if (hop >= maxRedirects) {
      throw new Error(`Remote source exceeded the maximum of ${maxRedirects} redirects.`);
    }

    const nextUrl = await validateExternalHttpUrl(new URL(location, currentUrl));

    // Never forward credentials automatically to another origin.
    if (nextUrl.origin !== currentUrl.origin && currentInit.headers) {
      const headers = new Headers(currentInit.headers);
      headers.delete('authorization');
      headers.delete('cookie');
      currentInit = { ...currentInit, headers };
    }

    // Match normal fetch semantics for 303, and POST -> GET on 301/302.
    const method = String(currentInit.method || 'GET').toUpperCase();
    if (response.status === 303 || ((response.status === 301 || response.status === 302) && method === 'POST')) {
      const headers = new Headers(currentInit.headers);
      headers.delete('content-length');
      headers.delete('content-type');
      currentInit = { ...currentInit, method: 'GET', body: undefined, headers };
    }

    currentUrl = nextUrl;
  }

  throw new Error('Unexpected redirect loop.');
}
