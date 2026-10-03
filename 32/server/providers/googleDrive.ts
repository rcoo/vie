import { Readable } from 'stream';
import type { VideoSourceProvider, SourceMetadata, StreamRange, StreamResult, SourceTestResult } from './types.ts';
import { storage } from '../db/storage.ts';

export class GoogleDriveProvider implements VideoSourceProvider {
  readonly type = 'GOOGLE_DRIVE';
  readonly displayName = 'Google Drive API';

  private cachedAccessToken: string | null = null;
  private tokenExpiresAt = 0;

  /**
   * Refreshes OAuth2 access token using GOOGLE_REFRESH_TOKEN, CLIENT_ID, CLIENT_SECRET.
   */
  private async getAccessToken(): Promise<string | null> {
    const settings = storage.getSettings();
    const clientId = process.env.GOOGLE_CLIENT_ID || settings.googleClientId;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || settings.googleClientSecret;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || settings.googleRefreshToken;

    if (!clientId || !clientSecret || !refreshToken) {
      return null;
    }

    // Return cached token if still valid (with 60-second buffer)
    if (this.cachedAccessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.cachedAccessToken;
    }

    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (!res.ok) {
        const errorData = await res.text();
        console.error('Google OAuth token refresh error:', errorData);
        return null;
      }

      const data = await res.json() as { access_token: string; expires_in: number };
      this.cachedAccessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);
      return this.cachedAccessToken;
    } catch (err) {
      console.error('Failed to exchange Google refresh token:', err);
      return null;
    }
  }

  private cleanFileId(rawId?: string): string {
    if (!rawId || typeof rawId !== 'string') {
      throw new Error('Google Drive File ID is required.');
    }
    const trimmed = rawId.trim();
    // In case the admin pasted a full Google Drive URL like https://drive.google.com/file/d/1AbCdEf.../view
    const match = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return match[1];
    }
    const idParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idParam && idParam[1]) {
      return idParam[1];
    }
    return trimmed;
  }

  async getMetadata(config: Record<string, any>): Promise<SourceMetadata> {
    const fileId = this.cleanFileId(config.driveFileId);
    const token = await this.getAccessToken();
    const settings = storage.getSettings();
    const apiKey = process.env.GOOGLE_API_KEY || settings.googleApiKey;

    const headers: Record<string, string> = {
      'User-Agent': 'CineVault-Stream/1.0'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size`;
    if (!token && apiKey) {
      url += `&key=${encodeURIComponent(apiKey)}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      // Fallback: try direct media HEAD or web download check
      return {
        mimeType: 'video/mp4',
        supportsRange: true
      };
    }

    const fileMeta = await res.json() as { name?: string; mimeType?: string; size?: string };
    return {
      filename: fileMeta.name,
      mimeType: fileMeta.mimeType || 'video/mp4',
      sizeBytes: fileMeta.size ? parseInt(fileMeta.size, 10) : undefined,
      supportsRange: true
    };
  }

  async getStream(config: Record<string, any>, range?: StreamRange): Promise<StreamResult> {
    const fileId = this.cleanFileId(config.driveFileId);
    const token = await this.getAccessToken();
    const settings = storage.getSettings();
    const apiKey = process.env.GOOGLE_API_KEY || settings.googleApiKey;

    const headers: Record<string, string> = {
      'User-Agent': 'CineVault-Stream/1.0'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (range) {
      if (range.end !== undefined) {
        headers['Range'] = `bytes=${range.start}-${range.end}`;
      } else {
        headers['Range'] = `bytes=${range.start}-`;
      }
    }

    let url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
    if (!token && apiKey) {
      url += `&key=${encodeURIComponent(apiKey)}`;
    }

    let response = await fetch(url, {
      method: 'GET',
      headers
    });

    // If OAuth/API call returns 401 or 403, and public download might work
    if (!response.ok && (response.status === 401 || response.status === 403 || !token)) {
      const publicUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
      const pubHeaders: Record<string, string> = { 'User-Agent': 'CineVault-Stream/1.0' };
      if (range) {
        pubHeaders['Range'] = range.end !== undefined ? `bytes=${range.start}-${range.end}` : `bytes=${range.start}-`;
      }
      const pubRes = await fetch(publicUrl, { headers: pubHeaders });
      if (pubRes.ok || pubRes.status === 206) {
        response = pubRes;
      }
    }

    if (!response.ok && response.status !== 206) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Google Drive API error (${response.status}): ${errText.slice(0, 100) || response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Google Drive file stream body is empty');
    }

    const nodeStream = Readable.fromWeb(response.body as any);
    const contentLengthStr = response.headers.get('content-length');
    const contentRange = response.headers.get('content-range') || undefined;
    const mimeType = response.headers.get('content-type') || 'video/mp4';
    if (mimeType.toLowerCase().includes('text/html')) {
      await response.body?.cancel().catch(() => {});
      throw new Error('Google Drive returned an HTML download/permission page instead of video bytes. Configure OAuth credentials or use a direct media source.');
    }

    const outHeaders: Record<string, string | number> = {
      'Accept-Ranges': 'bytes',
      'Content-Type': mimeType
    };

    if (contentLengthStr) {
      outHeaders['Content-Length'] = parseInt(contentLengthStr, 10);
    }
    if (contentRange) {
      outHeaders['Content-Range'] = contentRange;
    }

    return {
      stream: nodeStream,
      statusCode: response.status === 206 ? 206 : 200,
      headers: outHeaders,
      contentLength: contentLengthStr ? parseInt(contentLengthStr, 10) : undefined,
      contentRange,
      mimeType: outHeaders['Content-Type'] as string
    };
  }

  async supportsRange(config: Record<string, any>): Promise<boolean> {
    return true; // Google Drive API natively supports partial Range requests with alt=media
  }

  async testConnection(config: Record<string, any>): Promise<SourceTestResult> {
    const start = performance.now();
    try {
      const fileId = this.cleanFileId(config.driveFileId);
      const token = await this.getAccessToken();
      const settings = storage.getSettings();
      const apiKey = process.env.GOOGLE_API_KEY || settings.googleApiKey;

      if (!token && !apiKey) {
        // Test public direct reachability
        const probeRes = await fetch(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`, {
          method: 'GET',
          headers: { 'Range': 'bytes=0-0', 'User-Agent': 'CineVault-Stream/1.0' }
        });
        const latencyMs = Math.round(performance.now() - start);

        if (probeRes.ok || probeRes.status === 206) {
          return {
            success: true,
            message: 'Public Google Drive file reached successfully and supports streaming.',
            reachable: true,
            rangeSupported: true,
            mimeType: probeRes.headers.get('content-type') || 'video/mp4',
            latencyMs,
            details: {
              accessMode: 'Public Link',
              httpStatus: probeRes.status,
              note: 'For private files, configure GOOGLE_CLIENT_ID / REFRESH_TOKEN in Admin Settings.'
            }
          };
        } else {
          return {
            success: false,
            message: 'File is either private or requires Google OAuth credentials. Configure credentials in Admin Settings.',
            reachable: false,
            rangeSupported: false,
            latencyMs
          };
        }
      }

      // Check with Drive API
      const headers: Record<string, string> = { 'User-Agent': 'CineVault-Stream/1.0' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size`;
      if (!token && apiKey) url += `&key=${encodeURIComponent(apiKey)}`;

      const metaRes = await fetch(url, { headers });
      const latencyMs = Math.round(performance.now() - start);

      if (!metaRes.ok) {
        const errJson = await metaRes.json().catch(() => ({})) as any;
        const msg = errJson?.error?.message || `Google Drive returned status ${metaRes.status}`;
        return {
          success: false,
          message: msg,
          reachable: false,
          rangeSupported: false,
          latencyMs
        };
      }

      const meta = await metaRes.json() as { id: string; name: string; mimeType: string; size?: string };

      return {
        success: true,
        message: `File verified: "${meta.name}" (${meta.mimeType})`,
        reachable: true,
        mimeType: meta.mimeType,
        sizeBytes: meta.size ? parseInt(meta.size, 10) : undefined,
        rangeSupported: true,
        latencyMs,
        details: {
          fileId: meta.id,
          fileName: meta.name,
          mimeType: meta.mimeType,
          sizeMb: meta.size ? (parseInt(meta.size, 10) / (1024 * 1024)).toFixed(2) + ' MB' : 'unknown'
        }
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Google Drive connection test failed',
        reachable: false,
        rangeSupported: false,
        latencyMs: Math.round(performance.now() - start)
      };
    }
  }
}
