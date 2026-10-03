import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { storage } from './db/storage.ts';
import {
  authenticateAccessCode,
  setViewerSessionCookie,
  clearViewerSessionCookie,
  getViewerSessionToken,
  requireViewerAuth,
  type AuthenticatedViewerRequest
} from './auth/session.ts';
import {
  verifyAdminCredentials,
  setAdminCookie,
  clearAdminCookie,
  revokeAdminSession,
  requireAdminAuth,
  type AuthenticatedAdminRequest
} from './auth/adminAuth.ts';
import {
  isAdminPortalCode,
  setAdminPortalUnlockCookie,
  clearAdminPortalUnlockCookie,
  requireAdminPortalUnlock
} from './auth/adminPortal.ts';
import { handleEpisodeStream } from './services/streaming.ts';
import { providerRegistry } from './providers/registry.ts';

export const apiRouter = Router();

// ==========================================
// 1. PUBLIC & VIEWER AUTHENTICATION
// ==========================================

const AccessCodeSchema = z.object({
  code: z.string().trim().min(1, 'Access code is required').max(128),
  deviceInfo: z.string().max(500).optional()
});

apiRouter.post('/auth/access-code', (req, res) => {
  const parsed = AccessCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

  // Hidden admin entrance: the code is checked only on the server and never
  // shipped in the frontend bundle. It unlocks the login form for 10 minutes.
  if (isAdminPortalCode(parsed.data.code)) {
    setAdminPortalUnlockCookie(res);
    storage.addAuditLog({
      action: 'ADMIN_PORTAL_UNLOCKED',
      details: 'Hidden admin portal was unlocked.',
      ipAddress: ip,
      level: 'INFO'
    });
    res.json({ success: true, adminPortal: true });
    return;
  }

  const clientToken = getViewerSessionToken(req);
  const deviceInfo = parsed.data.deviceInfo || req.headers['user-agent'] || 'Web Client';
  const authResult = authenticateAccessCode(parsed.data.code, clientToken, deviceInfo, ip);
  if (!authResult.success || !authResult.session || !authResult.accessCode) {
    res.status(401).json({ error: authResult.error || 'الكود غير صحيح أو منتهي.' });
    return;
  }

  setViewerSessionCookie(res, authResult.session.deviceToken);

  res.json({
    success: true,
    code: authResult.accessCode.code,
    expiresAt: authResult.accessCode.expiresAt,
    maxDevices: authResult.accessCode.maxDevices,
    session: {
      id: authResult.session.id,
      deviceInfo: authResult.session.deviceInfo
    }
  });
});

apiRouter.get('/auth/session', requireViewerAuth, (req: AuthenticatedViewerRequest, res) => {
  res.json({
    authenticated: true,
    code: req.accessCode?.code,
    expiresAt: req.accessCode?.expiresAt,
    maxDevices: req.accessCode?.maxDevices,
    session: {
      id: req.viewerSession?.id,
      deviceInfo: req.viewerSession?.deviceInfo,
      createdAt: req.viewerSession?.createdAt
    }
  });
});

apiRouter.post('/auth/logout', (req, res) => {
  const token = getViewerSessionToken(req);
  if (token) storage.revokeSessionByToken(token);
  clearViewerSessionCookie(res);
  res.json({ success: true, message: 'Logged out successfully.' });
});

// ==========================================
// 2. ADMIN AUTHENTICATION
// ==========================================

const AdminLoginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required').max(100),
  password: z.string().min(1, 'Password is required').max(256)
});

apiRouter.post('/auth/admin-login', requireAdminPortalUnlock, async (req, res) => {
  const parsed = AdminLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const result = await verifyAdminCredentials(parsed.data.username, parsed.data.password, ip);

  if (!result.success || !result.token || !result.admin) {
    res.status(401).json({ error: result.error || 'Invalid credentials' });
    return;
  }

  setAdminCookie(res, result.token);
  clearAdminPortalUnlockCookie(res);
  res.json({
    success: true,
    admin: {
      id: result.admin.id,
      username: result.admin.username
    }
  });
});

apiRouter.post('/auth/admin-portal-lock', (_req, res) => {
  clearAdminPortalUnlockCookie(res);
  res.json({ success: true });
});

apiRouter.get('/auth/admin-session', requireAdminAuth, (req: AuthenticatedAdminRequest, res) => {
  res.json({
    authenticated: true,
    admin: {
      id: req.admin?.id,
      username: req.admin?.username
    }
  });
});

apiRouter.post('/auth/admin-logout', (req, res) => {
  revokeAdminSession(req);
  clearAdminCookie(res);
  clearAdminPortalUnlockCookie(res);
  res.json({ success: true });
});

// ==========================================
// 3. PUBLIC VIEWER CATALOG (Requires Access Code)
// ==========================================

apiRouter.get('/series', requireViewerAuth, (_req, res) => {
  const all = storage.getAllSeries(false);
  // Augment with season count & episode count for browsing
  const result = all.map(ser => {
    const seasons = storage.getSeasonsBySeriesId(ser.id);
    let episodeCount = 0;
    seasons.forEach(sea => {
      episodeCount += storage.getEpisodesBySeasonId(sea.id, false).length;
    });
    return {
      ...ser,
      seasonCount: seasons.length,
      episodeCount
    };
  });
  res.json(result);
});

apiRouter.get('/series/:slug', requireViewerAuth, (req, res) => {
  const series = storage.getSeriesBySlug(req.params.slug);
  if (!series || series.status !== 'PUBLISHED') {
    res.status(404).json({ error: 'Series not found' });
    return;
  }

  const seasons = storage.getSeasonsBySeriesId(series.id);
  const seasonsWithEpisodes = seasons.map(sea => {
    const episodes = storage.getEpisodesBySeasonId(sea.id, false);
    return {
      ...sea,
      episodes
    };
  });

  res.json({
    ...series,
    seasons: seasonsWithEpisodes
  });
});

apiRouter.get('/episodes/:id', requireViewerAuth, (req: AuthenticatedViewerRequest, res) => {
  const episode = storage.getEpisodeById(req.params.id);
  if (!episode || !episode.published) {
    res.status(404).json({ error: 'Episode not found' });
    return;
  }

  const season = storage.getSeasonById(episode.seasonId);
  const series = season ? storage.getSeriesById(season.seriesId) : undefined;

  // Sibling episodes for Prev/Next navigation
  const seasonEpisodes = season ? storage.getEpisodesBySeasonId(season.id, false) : [];
  const currentIndex = seasonEpisodes.findIndex(e => e.id === episode.id);

  const prevEpisode = currentIndex > 0 ? seasonEpisodes[currentIndex - 1] : null;
  const nextEpisode = currentIndex !== -1 && currentIndex < seasonEpisodes.length - 1 ? seasonEpisodes[currentIndex + 1] : null;

  // Available sources (without sensitive configuration like passwords)
  const sources = storage.getVideoSourcesByEpisodeId(episode.id, true).map(s => ({
    id: s.id,
    type: s.type,
    name: s.name,
    priority: s.priority,
    ...(s.type === 'EXTERNAL_PLAYER'
      ? {
          externalPlayback: {
            url: String(s.configuration.url || ''),
            mode: s.configuration.mode === 'IFRAME' ? 'IFRAME' : 'VIDEO'
          }
        }
      : {})
  }));

  // Watch progress for current viewer session
  let savedPosition = 0;
  if (req.viewerSession) {
    const prog = storage.getWatchProgress(req.viewerSession.id, episode.id);
    if (prog) savedPosition = prog.position;
  }

  res.json({
    episode,
    season,
    series,
    sources,
    prevEpisode: prevEpisode ? { id: prevEpisode.id, episodeNumber: prevEpisode.episodeNumber, title: prevEpisode.title } : null,
    nextEpisode: nextEpisode ? { id: nextEpisode.id, episodeNumber: nextEpisode.episodeNumber, title: nextEpisode.title } : null,
    savedPosition,
    allSeasonEpisodes: seasonEpisodes.map(e => ({
      id: e.id,
      episodeNumber: e.episodeNumber,
      title: e.title,
      duration: e.duration,
      thumbnail: e.thumbnail
    }))
  });
});

// ==========================================
// 4. VIDEO STREAMING ENDPOINT (HTTP RANGE)
// ==========================================

apiRouter.get('/episodes/:id/stream', requireViewerAuth, async (req, res) => {
  const preferredSource = typeof req.query.sourceId === 'string' ? req.query.sourceId : undefined;
  await handleEpisodeStream(req, res, req.params.id, preferredSource);
});

// ==========================================
// 5. WATCH PROGRESS & CONTINUE WATCHING
// ==========================================

const ProgressSchema = z.object({
  episodeId: z.string().min(1),
  position: z.number().min(0),
  duration: z.number().min(0)
});

apiRouter.post('/progress', requireViewerAuth, (req: AuthenticatedViewerRequest, res) => {
  const parsed = ProgressSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  if (!req.viewerSession) {
    res.status(401).json({ error: 'Session required' });
    return;
  }

  const record = storage.upsertWatchProgress({
    sessionId: req.viewerSession.id,
    episodeId: parsed.data.episodeId,
    position: parsed.data.position,
    duration: parsed.data.duration
  });

  res.json({ success: true, progress: record });
});

apiRouter.get('/progress/:episodeId', requireViewerAuth, (req: AuthenticatedViewerRequest, res) => {
  if (!req.viewerSession) {
    res.status(401).json({ error: 'Session required' });
    return;
  }
  const prog = storage.getWatchProgress(req.viewerSession.id, req.params.episodeId);
  res.json({ progress: prog || null });
});

apiRouter.get('/continue-watching', requireViewerAuth, (req: AuthenticatedViewerRequest, res) => {
  if (!req.viewerSession) {
    res.status(401).json({ error: 'Session required' });
    return;
  }
  const list = storage.getContinueWatchingForSession(req.viewerSession.id);
  res.json(list);
});

// ==========================================
// 6. ADMIN PANEL ENDPOINTS (Protected by Admin Auth)
// ==========================================

apiRouter.get('/admin/metrics', requireAdminAuth, (_req, res) => {
  const metrics = storage.getDashboardMetrics();
  res.json(metrics);
});

// --- Admin Series Management ---
apiRouter.get('/admin/series', requireAdminAuth, (_req, res) => {
  const series = storage.getAllSeries(true);
  res.json(series);
});

const CreateSeriesSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  slug: z.string().min(1, 'Slug is required'),
  description: z.string().optional().default(''),
  poster: z.string().optional().default(''),
  backdrop: z.string().optional().default(''),
  status: z.enum(['PUBLISHED', 'DRAFT']).default('PUBLISHED'),
  sortOrder: z.number().optional().default(0)
});

apiRouter.post('/admin/series', requireAdminAuth, (req, res) => {
  const parsed = CreateSeriesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const existing = storage.getSeriesBySlug(parsed.data.slug);
  if (existing) {
    res.status(400).json({ error: `Series with slug "${parsed.data.slug}" already exists.` });
    return;
  }

  const created = storage.createSeries(parsed.data);
  storage.addAuditLog({
    action: 'SERIES_CREATED',
    details: `Created series: "${created.title}" (${created.id})`,
    level: 'INFO'
  });
  res.status(201).json(created);
});

apiRouter.patch('/admin/series/:id', requireAdminAuth, (req, res) => {
  try {
    const updated = storage.updateSeries(req.params.id, req.body);
    storage.addAuditLog({
      action: 'SERIES_UPDATED',
      details: `Updated series: "${updated.title}" (${updated.id})`,
      level: 'INFO'
    });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/admin/series/:id', requireAdminAuth, (req, res) => {
  const success = storage.deleteSeries(req.params.id);
  if (success) {
    storage.addAuditLog({
      action: 'SERIES_DELETED',
      details: `Deleted series id: "${req.params.id}"`,
      level: 'WARN'
    });
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Series not found' });
  }
});

apiRouter.post('/admin/series/reorder', requireAdminAuth, (req, res) => {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) {
    res.status(400).json({ error: 'orderedIds must be an array' });
    return;
  }
  storage.reorderSeries(orderedIds);
  res.json({ success: true });
});

// --- Admin Seasons Management ---
apiRouter.get('/admin/seasons/:seriesId', requireAdminAuth, (req, res) => {
  const seasons = storage.getSeasonsBySeriesId(req.params.seriesId);
  res.json(seasons);
});

const SeasonSchema = z.object({
  seriesId: z.string().min(1),
  seasonNumber: z.number().int().min(1),
  title: z.string().min(1),
  description: z.string().optional().default(''),
  poster: z.string().optional().default(''),
  sortOrder: z.number().optional().default(0)
});

apiRouter.post('/admin/seasons', requireAdminAuth, (req, res) => {
  const parsed = SeasonSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const created = storage.createSeason(parsed.data);
  storage.addAuditLog({
    action: 'SEASON_CREATED',
    details: `Created season: "${created.title}" for series ${created.seriesId}`,
    level: 'INFO'
  });
  res.status(201).json(created);
});

apiRouter.patch('/admin/seasons/:id', requireAdminAuth, (req, res) => {
  try {
    const updated = storage.updateSeason(req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/admin/seasons/:id', requireAdminAuth, (req, res) => {
  const success = storage.deleteSeason(req.params.id);
  res.json({ success });
});

apiRouter.post('/admin/seasons/reorder', requireAdminAuth, (req, res) => {
  const { orderedIds } = req.body;
  if (Array.isArray(orderedIds)) storage.reorderSeasons(orderedIds);
  res.json({ success: true });
});

// --- Admin Episodes Management ---
apiRouter.get('/admin/episodes/:seasonId', requireAdminAuth, (req, res) => {
  const episodes = storage.getEpisodesBySeasonId(req.params.seasonId, true);
  res.json(episodes);
});

const EpisodeSchema = z.object({
  seasonId: z.string().min(1),
  episodeNumber: z.number().int().min(1),
  title: z.string().min(1),
  description: z.string().optional().default(''),
  thumbnail: z.string().optional().default(''),
  duration: z.number().int().min(0).default(0),
  published: z.boolean().default(true),
  sortOrder: z.number().optional().default(0)
});

apiRouter.post('/admin/episodes', requireAdminAuth, (req, res) => {
  const parsed = EpisodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const created = storage.createEpisode(parsed.data);
  storage.addAuditLog({
    action: 'EPISODE_CREATED',
    details: `Created episode #${created.episodeNumber}: "${created.title}"`,
    level: 'INFO'
  });
  res.status(201).json(created);
});

apiRouter.patch('/admin/episodes/:id', requireAdminAuth, (req, res) => {
  try {
    const updated = storage.updateEpisode(req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/admin/episodes/:id', requireAdminAuth, (req, res) => {
  const success = storage.deleteEpisode(req.params.id);
  res.json({ success });
});

apiRouter.post('/admin/episodes/reorder', requireAdminAuth, (req, res) => {
  const { orderedIds } = req.body;
  if (Array.isArray(orderedIds)) storage.reorderEpisodes(orderedIds);
  res.json({ success: true });
});

// --- Admin Video Sources Management & Live Testing ---
apiRouter.get('/admin/sources/:episodeId', requireAdminAuth, (req, res) => {
  const sources = storage.getVideoSourcesByEpisodeId(req.params.episodeId, false);
  res.json(sources);
});

const VideoSourceSchema = z.object({
  episodeId: z.string().min(1),
  type: z.enum(['GOOGLE_DRIVE', 'DIRECT_URL', 'S3', 'CLOUDFLARE_R2', 'CUSTOM_HTTP', 'EXTERNAL_PLAYER']),
  name: z.string().min(1),
  priority: z.number().int().min(1).default(1),
  enabled: z.boolean().default(true),
  configuration: z.record(z.string(), z.any())
});

function validateExternalPlayerConfiguration(configuration: Record<string, any>): string | null {
  const rawUrl = typeof configuration?.url === 'string' ? configuration.url.trim() : '';
  if (!rawUrl) return 'External player URL is required.';
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return 'External player URL must use http:// or https://.';
    }
  } catch {
    return 'External player URL is invalid.';
  }
  if (configuration.mode && !['VIDEO', 'IFRAME'].includes(String(configuration.mode))) {
    return 'External player mode must be VIDEO or IFRAME.';
  }
  return null;
}

apiRouter.post('/admin/sources', requireAdminAuth, (req, res) => {
  const parsed = VideoSourceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  if (parsed.data.type === 'EXTERNAL_PLAYER') {
    const error = validateExternalPlayerConfiguration(parsed.data.configuration);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    parsed.data.configuration.url = String(parsed.data.configuration.url).trim();
    parsed.data.configuration.mode = parsed.data.configuration.mode === 'IFRAME' ? 'IFRAME' : 'VIDEO';
  }
  const created = storage.createVideoSource(parsed.data);
  storage.addAuditLog({
    action: 'VIDEO_SOURCE_ADDED',
    details: `Added ${created.type} source "${created.name}" for episode ${created.episodeId}`,
    level: 'INFO'
  });
  res.status(201).json(created);
});

apiRouter.patch('/admin/sources/:id', requireAdminAuth, (req, res) => {
  try {
    const updated = storage.updateVideoSource(req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/admin/sources/:id', requireAdminAuth, (req, res) => {
  const success = storage.deleteVideoSource(req.params.id);
  res.json({ success });
});

apiRouter.post('/admin/sources/reorder', requireAdminAuth, (req, res) => {
  const { orderedIds } = req.body;
  if (Array.isArray(orderedIds)) storage.reorderVideoSources(orderedIds);
  res.json({ success: true });
});

// Test existing saved source
apiRouter.post('/admin/sources/:id/test', requireAdminAuth, async (req, res) => {
  const source = storage.getVideoSourceById(req.params.id);
  if (!source) {
    res.status(404).json({ error: 'Video source not found' });
    return;
  }

  try {
    if (source.type === 'EXTERNAL_PLAYER') {
      const error = validateExternalPlayerConfiguration(source.configuration);
      const result = error
        ? { success: false, message: error, reachable: false, rangeSupported: false, latencyMs: 0 }
        : {
            success: true,
            message: source.configuration.mode === 'IFRAME'
              ? 'External embed is configured. Playback is performed directly in the viewer browser.'
              : 'External video is configured. Playback is performed directly in the site player from the viewer browser.',
            reachable: true,
            rangeSupported: undefined,
            latencyMs: 0
          };
      storage.addAuditLog({
        action: 'SOURCE_TEST',
        details: `Validated external source "${source.name}": ${result.success ? 'PASSED' : 'FAILED'} - ${result.message}`,
        level: result.success ? 'INFO' : 'WARN'
      });
      res.json(result);
      return;
    }
    const provider = providerRegistry.get(source.type);
    const result = await provider.testConnection(source.configuration);
    storage.addAuditLog({
      action: 'SOURCE_TEST',
      details: `Tested source "${source.name}" (${source.type}): ${result.success ? 'PASSED' : 'FAILED'} - ${result.message}`,
      level: result.success ? 'INFO' : 'WARN'
    });
    res.json(result);
  } catch (err: any) {
    res.json({
      success: false,
      message: err.message || 'Source test failed',
      reachable: false,
      rangeSupported: false,
      latencyMs: 0
    });
  }
});

// Test draft unsaved source configuration before saving
apiRouter.post('/admin/sources/test-draft', requireAdminAuth, async (req, res) => {
  const { type, configuration } = req.body;
  if (!type || !configuration) {
    res.status(400).json({ error: 'type and configuration are required.' });
    return;
  }

  try {
    if (type === 'EXTERNAL_PLAYER') {
      const error = validateExternalPlayerConfiguration(configuration);
      res.json(error
        ? { success: false, message: error, reachable: false, rangeSupported: false, latencyMs: 0 }
        : { success: true, message: 'External source configuration is valid. Final playback is tested in the viewer browser.', reachable: true, latencyMs: 0 });
      return;
    }
    const provider = providerRegistry.get(type);
    const result = await provider.testConnection(configuration);
    res.json(result);
  } catch (err: any) {
    res.json({
      success: false,
      message: err.message || 'Configuration test failed',
      reachable: false,
      rangeSupported: false,
      latencyMs: 0
    });
  }
});

// --- Admin Access Codes Management ---
apiRouter.get('/admin/access-codes', requireAdminAuth, (_req, res) => {
  const codes = storage.getAllAccessCodes();
  // Include active session count
  const withCounts = codes.map(c => ({
    ...c,
    activeDevicesCount: storage.countActiveSessionsByAccessCode(c.id)
  }));
  res.json(withCounts);
});

const CreateAccessCodeSchema = z.object({
  code: z.string().optional(),
  expiresAt: z.string().nullable().optional(),
  maxDevices: z.number().int().min(1).default(2),
  note: z.string().nullable().optional()
});

apiRouter.post('/admin/access-codes', requireAdminAuth, (req, res) => {
  const parsed = CreateAccessCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  try {
    const created = storage.createAccessCode(parsed.data);
    storage.addAuditLog({
      action: 'ACCESS_CODE_CREATED',
      details: `Created access code: "${created.code}" (max devices: ${created.maxDevices})`,
      level: 'INFO'
    });
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Bulk Generate Codes
const BulkGenerateSchema = z.object({
  count: z.number().int().min(1).max(100).default(20),
  prefix: z.string().optional(),
  expiresAt: z.string().nullable().optional(),
  maxDevices: z.number().int().min(1).default(2),
  note: z.string().nullable().optional()
});

apiRouter.post('/admin/access-codes/bulk', requireAdminAuth, (req, res) => {
  const parsed = BulkGenerateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const codes = storage.generateBulkCodes(parsed.data);
  storage.addAuditLog({
    action: 'BULK_CODES_GENERATED',
    details: `Generated ${codes.length} access codes in batch.`,
    level: 'INFO'
  });
  res.status(201).json({ success: true, count: codes.length, codes });
});

apiRouter.patch('/admin/access-codes/:id', requireAdminAuth, (req, res) => {
  try {
    const updated = storage.updateAccessCode(req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/admin/access-codes/:id', requireAdminAuth, (req, res) => {
  const success = storage.deleteAccessCode(req.params.id);
  res.json({ success });
});

apiRouter.get('/admin/access-codes/:id/sessions', requireAdminAuth, (req, res) => {
  const sessions = storage.getSessionsByAccessCode(req.params.id);
  res.json(sessions);
});

apiRouter.post('/admin/sessions/:sessionId/revoke', requireAdminAuth, (req, res) => {
  const success = storage.revokeSession(req.params.sessionId);
  storage.addAuditLog({
    action: 'SESSION_REVOKED',
    details: `Revoked session: ${req.params.sessionId}`,
    level: 'WARN'
  });
  res.json({ success });
});

function maskAdminSettings(settings: ReturnType<typeof storage.getSettings>) {
  return {
    ...settings,
    googleClientSecret: settings.googleClientSecret ? '••••••••••••' : '',
    googleRefreshToken: settings.googleRefreshToken ? '••••••••••••' : '',
    googleApiKey: settings.googleApiKey ? '••••••••••••' : ''
  };
}

// --- Public Settings (For Branding, Logo, and Site Name) ---
apiRouter.get('/settings/public', (_req, res) => {
  const publicSettings = storage.getPublicSettings();
  res.json(publicSettings);
});

// --- Admin Settings ---
apiRouter.get('/admin/settings', requireAdminAuth, (_req, res) => {
  res.json(maskAdminSettings(storage.getSettings()));
});

apiRouter.patch('/admin/settings', requireAdminAuth, (req, res) => {
  const updates = { ...req.body };
  // If masked secret was sent, do not overwrite with asterisks
  if (updates.googleClientSecret === '••••••••••••') delete updates.googleClientSecret;
  if (updates.googleRefreshToken === '••••••••••••') delete updates.googleRefreshToken;
  if (updates.googleApiKey === '••••••••••••') delete updates.googleApiKey;

  const saved = storage.updateSettings(updates);
  storage.addAuditLog({
    action: 'SETTINGS_UPDATED',
    details: 'Admin modified platform settings.',
    level: 'INFO'
  });
  res.json(maskAdminSettings(saved));
});

// --- Admin Credentials Update (Username & Password) ---
const UpdateAdminCredentialsSchema = z.object({
  username: z.string().min(2, 'اسم المستخدم يجب أن يكون حرفين على الأقل').optional(),
  password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 خانات على الأقل').max(256).optional()
});

apiRouter.patch('/admin/credentials', requireAdminAuth, (req: AuthenticatedAdminRequest, res) => {
  const parsed = UpdateAdminCredentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  if (!req.admin) {
    res.status(401).json({ error: 'Admin session not found.' });
    return;
  }

  const updates: { username?: string; passwordHash?: string } = {};
  if (parsed.data.username) {
    updates.username = parsed.data.username.trim();
  }
  if (parsed.data.password) {
    updates.passwordHash = bcrypt.hashSync(parsed.data.password, 10);
  }

  try {
    const updated = storage.updateAdminCredentials(req.admin.id, updates);
    storage.addAuditLog({
      action: 'ADMIN_CREDENTIALS_UPDATED',
      details: `Admin credentials updated for user: "${updated.username}"`,
      level: 'WARN'
    });
    res.json({
      success: true,
      admin: {
        id: updated.id,
        username: updated.username
      }
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Admin Audit Logs ---
apiRouter.get('/admin/logs', requireAdminAuth, (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
  const logs = storage.getAuditLogs(limit);
  res.json(logs);
});
