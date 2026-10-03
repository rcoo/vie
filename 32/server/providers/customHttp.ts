import { Readable } from 'stream';
import type { VideoSourceProvider, SourceMetadata, StreamRange, StreamResult, SourceTestResult } from './types.ts';
import { validateExternalHttpUrl, fetchWithHeaderTimeout } from './httpSafety.ts';

/**
 * Cloudflare R2 / AWS S3 / Custom Object Storage Provider
 * Works via standard pre-signed or public CDN endpoint with Range support.
 */
export class CustomHttpProvider implements VideoSourceProvider {
  readonly type: string;
  readonly displayName: string;

  constructor(type: 'S3' | 'CLOUDFLARE_R2' | 'CUSTOM_HTTP' = 'CUSTOM_HTTP', displayName = 'Custom Storage / S3 / R2') {
    this.type = type;
    this.displayName = displayName;
  }

  private async getEffectiveUrl(config: Record<string, any>): Promise<URL> {
    const rawUrl = config.url || config.endpoint || '';
    if (!rawUrl) {
      throw new Error('Storage endpoint / video URL is required.');
    }
    return validateExternalHttpUrl(rawUrl);
  }

  async getMetadata(config: Record<string, any>): Promise<SourceMetadata> {
    const url = await this.getEffectiveUrl(config);
    const headRes = await fetchWithHeaderTimeout(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'CineVault-Storage/1.0' }
    });

    if (!headRes.ok) {
      throw new Error(`Storage HEAD returned ${headRes.status}: ${headRes.statusText}`);
    }

    return {
      mimeType: headRes.headers.get('content-type') || 'video/mp4',
      sizeBytes: headRes.headers.get('content-length') ? parseInt(headRes.headers.get('content-length')!, 10) : undefined,
      supportsRange: headRes.headers.get('accept-ranges') === 'bytes'
    };
  }

  async getStream(config: Record<string, any>, range?: StreamRange): Promise<StreamResult> {
    const url = await this.getEffectiveUrl(config);
    const headers: Record<string, string> = {
      'User-Agent': 'CineVault-Storage/1.0'
    };

    if (range) {
      headers['Range'] = range.end !== undefined ? `bytes=${range.start}-${range.end}` : `bytes=${range.start}-`;
    }

    const response = await fetchWithHeaderTimeout(url, { headers });
    if (!response.ok && response.status !== 206) {
      throw new Error(`Storage returned ${response.status}: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Storage response stream is empty');
    }

    const nodeStream = Readable.fromWeb(response.body as any);
    const contentLengthStr = response.headers.get('content-length');
    const contentRange = response.headers.get('content-range') || undefined;
    const mimeType = response.headers.get('content-type') || 'video/mp4';

    const outHeaders: Record<string, string | number> = {
      'Content-Type': mimeType
    };

    const acceptRanges = response.headers.get('accept-ranges');
    if (acceptRanges) outHeaders['Accept-Ranges'] = acceptRanges;
    else if (response.status === 206 || contentRange) outHeaders['Accept-Ranges'] = 'bytes';

    if (contentLengthStr) outHeaders['Content-Length'] = parseInt(contentLengthStr, 10);
    if (contentRange) outHeaders['Content-Range'] = contentRange;

    return {
      stream: nodeStream,
      statusCode: response.status === 206 ? 206 : 200,
      headers: outHeaders,
      contentLength: contentLengthStr ? parseInt(contentLengthStr, 10) : undefined,
      contentRange,
      mimeType
    };
  }

  async supportsRange(config: Record<string, any>): Promise<boolean> {
    try {
      const meta = await this.getMetadata(config);
      return meta.supportsRange;
    } catch {
      return false;
    }
  }

  async testConnection(config: Record<string, any>): Promise<SourceTestResult> {
    const start = performance.now();
    try {
      const url = await this.getEffectiveUrl(config);
      const res = await fetchWithHeaderTimeout(url, {
        headers: { 'Range': 'bytes=0-0', 'User-Agent': 'CineVault-Storage/1.0' }
      });
      const latencyMs = Math.round(performance.now() - start);

      const ok = res.ok || res.status === 206;
      await res.body?.cancel().catch(() => {});
      return {
        success: ok,
        message: ok ? 'Storage endpoint is accessible and streaming is ready.' : `Storage returned status ${res.status}`,
        reachable: ok,
        mimeType: res.headers.get('content-type') || 'video/mp4',
        rangeSupported: res.status === 206 || res.headers.get('accept-ranges') === 'bytes',
        latencyMs
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Storage connection test failed',
        reachable: false,
        rangeSupported: false,
        latencyMs: Math.round(performance.now() - start)
      };
    }
  }
}
