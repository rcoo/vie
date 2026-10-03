import type { Request, Response } from 'express';
import { storage } from '../db/storage.ts';
import { providerRegistry } from '../providers/registry.ts';
import type { StreamRange } from '../providers/types.ts';

export interface ParseRangeResult {
  range?: StreamRange;
  isPartial: boolean;
  invalid?: boolean;
}

export function parseRangeHeader(rangeHeader?: string): ParseRangeResult {
  if (!rangeHeader) return { isPartial: false };
  if (!rangeHeader.startsWith('bytes=') || rangeHeader.includes(',')) {
    return { isPartial: false, invalid: true };
  }

  const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return { isPartial: false, invalid: true };

  const start = Number.parseInt(match[1], 10);
  const end = match[2] ? Number.parseInt(match[2], 10) : undefined;
  if (!Number.isSafeInteger(start) || start < 0) return { isPartial: false, invalid: true };
  if (end !== undefined && (!Number.isSafeInteger(end) || end < start)) {
    return { isPartial: false, invalid: true };
  }

  return { range: { start, end }, isPartial: true };
}

export async function handleEpisodeStream(
  req: Request,
  res: Response,
  episodeId: string,
  preferredSourceId?: string
): Promise<void> {
  // 1. Fetch episode from DB
  const episode = storage.getEpisodeById(episodeId);
  if (!episode || !episode.published) {
    res.status(404).json({ error: 'Episode not found or is currently unpublished.' });
    return;
  }

  // 2. Fetch enabled sources for this episode
  const sources = storage.getVideoSourcesByEpisodeId(episodeId, true).filter(source => source.type !== 'EXTERNAL_PLAYER');
  if (!sources || sources.length === 0) {
    res.status(404).json({ error: 'No active server-streamed video source configured for this episode.' });
    return;
  }

  // Sort sources: if user specified preferredSourceId, put it first, otherwise by priority
  const orderedSources = [...sources].sort((a, b) => {
    if (preferredSourceId && a.id === preferredSourceId) return -1;
    if (preferredSourceId && b.id === preferredSourceId) return 1;
    return a.priority - b.priority;
  });

  const rangeInfo = parseRangeHeader(req.headers.range);
  if (rangeInfo.invalid) {
    res.status(416).setHeader('Accept-Ranges', 'bytes');
    res.end();
    return;
  }

  let streamResult: any = null;
  let activeSource: any = null;
  let lastError: Error | null = null;

  // Try sources in priority order (automatic fallback)
  for (const source of orderedSources) {
    try {
      const provider = providerRegistry.get(source.type);
      streamResult = await provider.getStream(source.configuration, rangeInfo.range);
      activeSource = source;
      break; // Success!
    } catch (err: any) {
      lastError = err;
      console.warn(`Source ${source.name} (${source.type}) failed for episode ${episodeId}:`, err.message);
      storage.addAuditLog({
        action: 'STREAM_SOURCE_FAILED',
        details: `Source "${source.name}" (${source.id}) failed: ${err.message}`,
        ipAddress: req.ip,
        level: 'WARN'
      });
    }
  }

  if (!streamResult || !activeSource) {
    res.status(502).json({
      error: 'Unable to stream episode. All configured video sources are currently unavailable.',
      details: process.env.NODE_ENV === 'development' ? lastError?.message : undefined
    });
    return;
  }

  // Set HTTP response headers
  res.status(streamResult.statusCode || 200);

  // Apply headers from provider
  for (const [key, val] of Object.entries(streamResult.headers)) {
    if (val !== undefined && val !== null) {
      res.setHeader(key, String(val));
    }
  }

  // Advertise byte ranges only when the upstream provider confirmed them.
  if (!res.hasHeader('Accept-Ranges') && streamResult.statusCode === 206) {
    res.setHeader('Accept-Ranges', 'bytes');
  }
  res.setHeader('Cache-Control', 'private, no-transform, max-age=1800');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Handle client disconnect to abort upstream request
  res.on('close', () => {
    if (streamResult.stream && !streamResult.stream.destroyed) {
      streamResult.stream.destroy();
    }
  });

  // Pipe the video stream directly to the response
  streamResult.stream.on('error', (err: any) => {
    console.error('Streaming pipeline error:', err);
    if (!res.headersSent) {
      res.status(500).end();
    } else {
      res.end();
    }
  });

  streamResult.stream.pipe(res);
}
