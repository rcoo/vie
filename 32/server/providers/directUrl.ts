import { Readable } from 'stream';
import type { VideoSourceProvider, SourceMetadata, StreamRange, StreamResult, SourceTestResult } from './types.ts';
import { validateExternalHttpUrl, fetchWithHeaderTimeout } from './httpSafety.ts';

const DEFAULT_BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function getConfiguredHeader(config: Record<string, any>, key: string): string | undefined {
  const value = config?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function buildUpstreamHeaders(config: Record<string, any>, range?: StreamRange): Record<string, string> {
  const headers: Record<string, string> = {
    // A number of CDNs reject non-browser/bot user agents even for valid signed URLs.
    'User-Agent': getConfiguredHeader(config, 'userAgent') || DEFAULT_BROWSER_UA,
    'Accept': '*/*',
    // Keep byte counts identical to the origin so Content-Range/Length stay correct.
    'Accept-Encoding': 'identity'
  };

  const referer = getConfiguredHeader(config, 'referer');
  const origin = getConfiguredHeader(config, 'origin');
  if (referer) headers['Referer'] = referer;
  if (origin) headers['Origin'] = origin;

  if (range) {
    headers['Range'] = range.end !== undefined
      ? `bytes=${range.start}-${range.end}`
      : `bytes=${range.start}-`;
  }

  return headers;
}

function resolveMimeType(config: Record<string, any>, response: Response): string {
  const configured = getConfiguredHeader(config, 'mimeType');
  if (configured) return configured;

  const raw = (response.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
  if (!raw || raw === 'application/octet-stream' || raw === 'binary/octet-stream' || raw === 'application/download') {
    // Direct signed CDN links often omit the extension and return a generic binary MIME.
    return 'video/mp4';
  }
  return raw;
}

function assertMediaResponse(response: Response): void {
  const raw = (response.headers.get('content-type') || '').toLowerCase();
  if (raw.startsWith('text/html') || raw.startsWith('application/json') || raw.startsWith('text/plain')) {
    throw new Error(`Remote URL returned ${raw || 'a text response'} instead of video data.`);
  }
}

export class DirectUrlProvider implements VideoSourceProvider {
  readonly type = 'DIRECT_URL';
  readonly displayName = 'Direct Video URL';

  async getMetadata(config: Record<string, any>): Promise<SourceMetadata> {
    const url = await validateExternalHttpUrl(config.url);
    try {
      // Try HEAD first. Some signed CDNs block HEAD, so this is only an optimization.
      const headRes = await fetchWithHeaderTimeout(url, {
        method: 'HEAD',
        headers: buildUpstreamHeaders(config)
      });

      if (!headRes.ok) throw new Error(`HEAD returned HTTP ${headRes.status}`);

      const acceptRanges = headRes.headers.get('accept-ranges') === 'bytes';
      const contentLengthStr = headRes.headers.get('content-length');
      const contentType = resolveMimeType(config, headRes);

      return {
        mimeType: contentType,
        sizeBytes: contentLengthStr ? parseInt(contentLengthStr, 10) : undefined,
        supportsRange: acceptRanges
      };
    } catch {
      // Fallback for CDNs that reject HEAD: request a single byte.
      const rangeRes = await fetchWithHeaderTimeout(url, {
        method: 'GET',
        headers: buildUpstreamHeaders(config, { start: 0, end: 0 })
      });
      const rangeSupported = rangeRes.status === 206;
      if (!rangeRes.ok && rangeRes.status !== 206) {
        throw new Error(`Range probe returned HTTP ${rangeRes.status}`);
      }
      assertMediaResponse(rangeRes);

      const contentRange = rangeRes.headers.get('content-range');
      let sizeBytes: number | undefined;
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)$/);
        if (match) sizeBytes = parseInt(match[1], 10);
      }
      const mimeType = resolveMimeType(config, rangeRes);
      await rangeRes.body?.cancel().catch(() => {});
      return {
        mimeType,
        sizeBytes,
        supportsRange: rangeSupported
      };
    }
  }

  async getStream(config: Record<string, any>, range?: StreamRange): Promise<StreamResult> {
    const url = await validateExternalHttpUrl(config.url);
    const response = await fetchWithHeaderTimeout(url, {
      method: 'GET',
      headers: buildUpstreamHeaders(config, range)
    });

    if (!response.ok && response.status !== 206) {
      throw new Error(`Remote source responded with HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Remote source response body is empty');
    }

    assertMediaResponse(response);

    // Convert Web ReadableStream to Node.js Readable stream without buffering the video.
    const nodeStream = Readable.fromWeb(response.body as any);

    const contentLengthStr = response.headers.get('content-length');
    const contentRange = response.headers.get('content-range') || undefined;
    const mimeType = resolveMimeType(config, response);

    const outHeaders: Record<string, string | number> = {
      'Content-Type': mimeType
    };

    const acceptRanges = response.headers.get('accept-ranges');
    if (acceptRanges) outHeaders['Accept-Ranges'] = acceptRanges;
    else if (response.status === 206 || contentRange) outHeaders['Accept-Ranges'] = 'bytes';

    if (contentLengthStr) {
      outHeaders['Content-Length'] = parseInt(contentLengthStr, 10);
    }
    if (contentRange) {
      outHeaders['Content-Range'] = contentRange;
    }

    // Preserve validators that help the browser/CDN handle repeated seeks efficiently.
    const etag = response.headers.get('etag');
    const lastModified = response.headers.get('last-modified');
    if (etag) outHeaders['ETag'] = etag;
    if (lastModified) outHeaders['Last-Modified'] = lastModified;

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
      const url = await validateExternalHttpUrl(config.url);

      // Perform a minimal GET rather than HEAD because signed video CDNs commonly block HEAD.
      const testRes = await fetchWithHeaderTimeout(url, {
        method: 'GET',
        headers: buildUpstreamHeaders(config, { start: 0, end: 0 })
      });

      const latencyMs = Math.round(performance.now() - start);

      if (!testRes.ok && testRes.status !== 206) {
        await testRes.body?.cancel().catch(() => {});
        return {
          success: false,
          message: `Source returned HTTP status ${testRes.status} (${testRes.statusText})`,
          reachable: true,
          rangeSupported: false,
          latencyMs
        };
      }

      assertMediaResponse(testRes);
      const mimeType = resolveMimeType(config, testRes);
      const rangeSupported = testRes.status === 206 || testRes.headers.get('accept-ranges') === 'bytes';
      const contentRange = testRes.headers.get('content-range');
      let sizeBytes: number | undefined;
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)$/);
        if (match) sizeBytes = parseInt(match[1], 10);
      }

      await testRes.body?.cancel().catch(() => {});
      return {
        success: true,
        message: 'Direct URL is healthy and ready for proxied video playback.',
        reachable: true,
        mimeType,
        sizeBytes,
        rangeSupported,
        latencyMs,
        details: {
          httpStatus: testRes.status,
          contentRange: contentRange || 'none',
          acceptRanges: testRes.headers.get('accept-ranges') || 'none',
          finalUrl: testRes.url || url.toString()
        }
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Failed to reach video URL',
        reachable: false,
        rangeSupported: false,
        latencyMs: Math.round(performance.now() - start)
      };
    }
  }
}
