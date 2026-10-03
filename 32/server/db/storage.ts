import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Pool, type PoolConfig } from 'pg';
import type {
  Admin,
  AdminSession,
  AccessCode,
  AccessSession,
  Series,
  Season,
  Episode,
  VideoSource,
  WatchProgress,
  AppSettings,
  AuditLog
} from './schema.ts';
import {
  initialAdmin,
  initialAccessCodes,
  initialSeries,
  initialSeasons,
  initialEpisodes,
  initialVideoSources,
  initialSettings
} from './seed.ts';

interface DatabaseSchema {
  schemaVersion: number;
  admins: Admin[];
  adminSessions: AdminSession[];
  accessCodes: AccessCode[];
  sessions: AccessSession[];
  series: Series[];
  seasons: Season[];
  episodes: Episode[];
  videoSources: VideoSource[];
  watchProgress: WatchProgress[];
  settings: AppSettings;
  auditLogs: AuditLog[];
}

type StorageBackend = 'postgres' | 'file';

const CURRENT_SCHEMA_VERSION = 3;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const POSTGRES_ROW_ID = 'main';

function shouldUseSsl(databaseUrl: string): boolean {
  const explicit = (process.env.DATABASE_SSL || '').trim().toLowerCase();
  if (['0', 'false', 'disable', 'disabled', 'off'].includes(explicit)) return false;
  if (['1', 'true', 'require', 'required', 'on'].includes(explicit)) return true;
  return /sslmode=(require|verify-ca|verify-full)/i.test(databaseUrl) || /neon\.tech|supabase\.(com|co)/i.test(databaseUrl);
}

function buildPoolConfig(databaseUrl: string): PoolConfig {
  const config: PoolConfig = {
    connectionString: databaseUrl,
    max: Number.parseInt(process.env.DATABASE_POOL_SIZE || '5', 10) || 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
  };
  if (shouldUseSsl(databaseUrl)) {
    config.ssl = { rejectUnauthorized: false };
  }
  return config;
}

class Storage {
  private data: DatabaseSchema;
  private saveTimeout: NodeJS.Timeout | null = null;
  private saveChain: Promise<void> = Promise.resolve();
  private pool: Pool | null = null;
  private backend: StorageBackend = 'file';
  private initialized = false;
  private migratedFromJson = false;

  constructor() {
    // Keep construction side-effect free. The server calls initialize() after
    // dotenv has loaded, which allows DATABASE_URL to be read reliably.
    this.data = this.createFreshData();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const databaseUrl = (process.env.DATABASE_URL || '').trim();
    if (!databaseUrl) {
      this.backend = 'file';
      this.data = this.loadLegacyData().data;
      this.persistFileSync(this.data);
      this.initialized = true;
      console.warn('[CineVault] DATABASE_URL is not configured. Using data/db.json fallback storage.');
      return;
    }

    const pool = new Pool(buildPoolConfig(databaseUrl));
    try {
      await pool.query('SELECT 1');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS cinevault_state (
          id TEXT PRIMARY KEY,
          payload JSONB NOT NULL,
          schema_version INTEGER NOT NULL DEFAULT ${CURRENT_SCHEMA_VERSION},
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      const existing = await pool.query<{ payload: DatabaseSchema; schema_version: number }>(
        'SELECT payload, schema_version FROM cinevault_state WHERE id = $1 LIMIT 1',
        [POSTGRES_ROW_ID]
      );

      this.pool = pool;
      this.backend = 'postgres';

      if (existing.rowCount && existing.rows[0]) {
        this.data = this.normalizeData(existing.rows[0].payload || {});
        // Persist normalization/schema upgrades immediately.
        await this.persistPostgres(this.data);
        console.log('[CineVault] PostgreSQL connected. Existing database state loaded.');
      } else {
        const legacy = this.loadLegacyData();
        this.data = legacy.data;
        this.migratedFromJson = legacy.fromJson;

        if (legacy.fromJson) {
          this.data.auditLogs.unshift({
            id: crypto.randomUUID(),
            action: 'DATABASE_MIGRATION',
            details: 'Imported existing data/db.json into PostgreSQL on first database connection.',
            ipAddress: '127.0.0.1',
            level: 'INFO',
            createdAt: new Date().toISOString()
          });
          console.log('[CineVault] Existing data/db.json imported into PostgreSQL. The JSON file was kept as a backup.');
        } else {
          console.log('[CineVault] PostgreSQL initialized with the current CineVault seed data.');
        }

        await this.persistPostgres(this.data);
      }

      pool.on('error', (err) => {
        console.error('[CineVault] PostgreSQL pool error:', err);
      });
      this.initialized = true;
    } catch (err) {
      await pool.end().catch(() => undefined);
      this.pool = null;
      throw new Error(`PostgreSQL initialization failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private createFreshData(): DatabaseSchema {
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      admins: [initialAdmin],
      adminSessions: [],
      accessCodes: initialAccessCodes,
      sessions: [],
      series: initialSeries,
      seasons: initialSeasons,
      episodes: initialEpisodes,
      videoSources: initialVideoSources,
      watchProgress: [],
      settings: initialSettings,
      auditLogs: [
        {
          id: crypto.randomUUID(),
          action: 'SYSTEM_INIT',
          details: 'CineVault database initialized with seed catalog and default access credentials.',
          ipAddress: '127.0.0.1',
          level: 'INFO',
          createdAt: new Date().toISOString()
        }
      ]
    };
  }

  private normalizeData(raw: Partial<DatabaseSchema>): DatabaseSchema {
    const previousVersion = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1;
    const admins = raw.admins?.length ? [...raw.admins] : [initialAdmin];

    // v2 migration: apply requested bootstrap admin credentials once.
    // Later changes made from Admin Settings remain untouched.
    if (previousVersion < 2 && admins.length > 0) {
      admins[0] = {
        ...admins[0],
        username: initialAdmin.username,
        passwordHash: initialAdmin.passwordHash,
        updatedAt: new Date().toISOString()
      };
    }

    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      admins,
      adminSessions: raw.adminSessions || [],
      accessCodes: raw.accessCodes || initialAccessCodes,
      sessions: raw.sessions || [],
      series: raw.series || initialSeries,
      seasons: raw.seasons || initialSeasons,
      episodes: raw.episodes || initialEpisodes,
      videoSources: raw.videoSources || initialVideoSources,
      watchProgress: raw.watchProgress || [],
      settings: { ...initialSettings, ...(raw.settings || {}) },
      auditLogs: raw.auditLogs || []
    };
  }

  private loadLegacyData(): { data: DatabaseSchema; fromJson: boolean } {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      if (fs.existsSync(DB_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')) as Partial<DatabaseSchema>;
        return { data: this.normalizeData(parsed), fromJson: true };
      }
    } catch (err) {
      console.error('[CineVault] Could not read data/db.json:', err);
      try {
        if (fs.existsSync(DB_FILE)) {
          const corruptBackup = `${DB_FILE}.corrupt.${Date.now()}`;
          fs.copyFileSync(DB_FILE, corruptBackup);
          console.error(`[CineVault] Corrupt JSON backup saved to ${corruptBackup}`);
        }
      } catch (backupErr) {
        console.error('[CineVault] Could not back up corrupt db.json:', backupErr);
      }
    }
    return { data: this.createFreshData(), fromJson: false };
  }

  private snapshot(): DatabaseSchema {
    return structuredClone(this.data);
  }

  private persistFileSync(dataToSave: DatabaseSchema): void {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempFile, JSON.stringify(dataToSave, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
    } catch (err) {
      console.error('[CineVault] Failed to persist data/db.json:', err);
    }
  }

  private async persistPostgres(dataToSave: DatabaseSchema): Promise<void> {
    if (!this.pool) throw new Error('PostgreSQL pool is not initialized.');
    await this.pool.query(
      `INSERT INTO cinevault_state (id, payload, schema_version, updated_at)
       VALUES ($1, $2::jsonb, $3, NOW())
       ON CONFLICT (id) DO UPDATE SET
         payload = EXCLUDED.payload,
         schema_version = EXCLUDED.schema_version,
         updated_at = NOW()`,
      [POSTGRES_ROW_ID, JSON.stringify(dataToSave), CURRENT_SCHEMA_VERSION]
    );
  }

  private enqueueSave(snapshot: DatabaseSchema): void {
    this.saveChain = this.saveChain
      .then(async () => {
        if (this.backend === 'postgres') {
          await this.persistPostgres(snapshot);
        } else {
          this.persistFileSync(snapshot);
        }
      })
      .catch((err) => {
        console.error(`[CineVault] Failed to save ${this.backend} state:`, err);
      });
  }

  private scheduleSave(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.enqueueSave(this.snapshot());
    }, 150);
  }

  // Admin
  getAdminByUsername(username: string): Admin | undefined {
    return this.data.admins.find(a => a.username.toLowerCase() === username.trim().toLowerCase());
  }

  getAdminById(id: string): Admin | undefined {
    return this.data.admins.find(a => a.id === id);
  }

  updateAdminCredentials(id: string, updates: { username?: string; passwordHash?: string }): Admin {
    const admin = this.data.admins.find(a => a.id === id);
    if (!admin) throw new Error('Admin not found');
    if (updates.username) admin.username = updates.username.trim();
    if (updates.passwordHash) admin.passwordHash = updates.passwordHash;
    admin.updatedAt = new Date().toISOString();
    this.scheduleSave();
    return admin;
  }

  // Persistent admin sessions
  createAdminSession(params: { adminId: string; tokenHash: string; ipAddress: string; expiresAt: string }): AdminSession {
    const session: AdminSession = {
      id: crypto.randomUUID(),
      adminId: params.adminId,
      tokenHash: params.tokenHash,
      ipAddress: params.ipAddress,
      lastActiveAt: new Date().toISOString(),
      expiresAt: params.expiresAt,
      createdAt: new Date().toISOString()
    };
    this.data.adminSessions.push(session);
    this.scheduleSave();
    return session;
  }

  getAdminSessionByTokenHash(tokenHash: string): AdminSession | undefined {
    return this.data.adminSessions.find(s => s.tokenHash === tokenHash);
  }

  touchAdminSession(id: string): void {
    const session = this.data.adminSessions.find(s => s.id === id);
    if (session) {
      session.lastActiveAt = new Date().toISOString();
      this.scheduleSave();
    }
  }

  revokeAdminSessionByTokenHash(tokenHash: string): boolean {
    const before = this.data.adminSessions.length;
    this.data.adminSessions = this.data.adminSessions.filter(s => s.tokenHash !== tokenHash);
    if (this.data.adminSessions.length !== before) {
      this.scheduleSave();
      return true;
    }
    return false;
  }

  revokeAdminSessionsForAdmin(adminId: string): number {
    const before = this.data.adminSessions.length;
    this.data.adminSessions = this.data.adminSessions.filter(s => s.adminId !== adminId);
    const removed = before - this.data.adminSessions.length;
    if (removed > 0) this.scheduleSave();
    return removed;
  }

  deleteExpiredAdminSessions(): number {
    const now = Date.now();
    const before = this.data.adminSessions.length;
    this.data.adminSessions = this.data.adminSessions.filter(s => {
      const expires = new Date(s.expiresAt).getTime();
      return Number.isFinite(expires) && expires > now;
    });
    const removed = before - this.data.adminSessions.length;
    if (removed > 0) this.scheduleSave();
    return removed;
  }

  // Access Codes
  getAccessCodeByCode(codeStr: string): AccessCode | undefined {
    const clean = codeStr.trim().toUpperCase();
    return this.data.accessCodes.find(c => c.code.toUpperCase() === clean);
  }

  getAccessCodeById(id: string): AccessCode | undefined {
    return this.data.accessCodes.find(c => c.id === id);
  }

  getAllAccessCodes(): AccessCode[] {
    return [...this.data.accessCodes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  createAccessCode(params: {
    code?: string;
    expiresAt?: string | null;
    maxDevices?: number;
    createdBy?: string;
    note?: string | null;
  }): AccessCode {
    const code = params.code?.trim().toUpperCase() || this.generateRandomCode();
    const reservedPortalCode = (process.env.ADMIN_PORTAL_CODE || 'vin01012007').trim().toUpperCase();
    if (code === reservedPortalCode) {
      throw new Error('This code is reserved for the hidden admin portal.');
    }
    const existing = this.getAccessCodeByCode(code);
    if (existing) {
      throw new Error(`Access Code "${code}" already exists.`);
    }

    const newCode: AccessCode = {
      id: crypto.randomUUID(),
      code,
      status: 'ACTIVE',
      expiresAt: params.expiresAt || null,
      maxDevices: params.maxDevices || this.data.settings.defaultMaxDevices || 2,
      createdBy: params.createdBy || 'admin',
      note: params.note || null,
      lastUsedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.data.accessCodes.push(newCode);
    this.scheduleSave();
    return newCode;
  }

  generateBulkCodes(params: {
    count: number;
    prefix?: string;
    expiresAt?: string | null;
    maxDevices?: number;
    note?: string | null;
  }): AccessCode[] {
    const created: AccessCode[] = [];
    const count = Math.min(Math.max(params.count, 1), 100);
    const prefix = params.prefix ? params.prefix.trim().toUpperCase() + '-' : '';

    for (let i = 0; i < count; i++) {
      let candidate = '';
      do {
        candidate = prefix + this.generateRandomCode();
      } while (this.getAccessCodeByCode(candidate));

      const newCode: AccessCode = {
        id: crypto.randomUUID(),
        code: candidate,
        status: 'ACTIVE',
        expiresAt: params.expiresAt || null,
        maxDevices: params.maxDevices || this.data.settings.defaultMaxDevices || 2,
        createdBy: 'admin',
        note: params.note ? `${params.note} (#${i + 1})` : `Batch generated (${new Date().toLocaleDateString()})`,
        lastUsedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.data.accessCodes.push(newCode);
      created.push(newCode);
    }

    this.scheduleSave();
    return created;
  }

  updateAccessCode(id: string, updates: Partial<AccessCode>): AccessCode {
    const idx = this.data.accessCodes.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Access code not found');

    const normalizedUpdates = { ...updates };
    if (typeof normalizedUpdates.code === 'string') {
      const nextCode = normalizedUpdates.code.trim().toUpperCase();
      const reservedPortalCode = (process.env.ADMIN_PORTAL_CODE || 'vin01012007').trim().toUpperCase();
      if (nextCode === reservedPortalCode) {
        throw new Error('This code is reserved for the hidden admin portal.');
      }
      const duplicate = this.data.accessCodes.find(c => c.id !== id && c.code.toUpperCase() === nextCode);
      if (duplicate) {
        throw new Error(`Access Code "${nextCode}" already exists.`);
      }
      normalizedUpdates.code = nextCode;
    }
    delete normalizedUpdates.id;
    delete normalizedUpdates.createdAt;

    this.data.accessCodes[idx] = {
      ...this.data.accessCodes[idx],
      ...normalizedUpdates,
      updatedAt: new Date().toISOString()
    };
    this.scheduleSave();
    return this.data.accessCodes[idx];
  }

  deleteAccessCode(id: string): boolean {
    const initialLen = this.data.accessCodes.length;
    this.data.accessCodes = this.data.accessCodes.filter(c => c.id !== id);
    // Also revoke its sessions
    this.data.sessions = this.data.sessions.filter(s => s.accessCodeId !== id);
    if (this.data.accessCodes.length !== initialLen) {
      this.scheduleSave();
      return true;
    }
    return false;
  }

  private generateRandomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let p1 = '';
    let p2 = '';
    for (let i = 0; i < 4; i++) {
      p1 += chars.charAt(Math.floor(Math.random() * chars.length));
      p2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${p1}-${p2}`;
  }

  // Sessions
  createSession(params: {
    accessCodeId: string;
    deviceToken: string;
    deviceInfo: string;
    ipAddress: string;
  }): AccessSession {
    const session: AccessSession = {
      id: crypto.randomUUID(),
      accessCodeId: params.accessCodeId,
      deviceToken: params.deviceToken,
      deviceInfo: params.deviceInfo,
      ipAddress: params.ipAddress,
      status: 'ACTIVE',
      lastActiveAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    this.data.sessions.push(session);
    this.scheduleSave();
    return session;
  }

  getSessionByToken(token: string): AccessSession | undefined {
    return this.data.sessions.find(s => s.deviceToken === token && s.status === 'ACTIVE');
  }

  getSessionsByAccessCode(accessCodeId: string): AccessSession[] {
    return this.data.sessions
      .filter(s => s.accessCodeId === accessCodeId)
      .sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());
  }

  countActiveSessionsByAccessCode(accessCodeId: string): number {
    return this.data.sessions.filter(s => s.accessCodeId === accessCodeId && s.status === 'ACTIVE').length;
  }

  updateSessionActivity(token: string): void {
    const session = this.data.sessions.find(s => s.deviceToken === token);
    if (session) {
      session.lastActiveAt = new Date().toISOString();
      this.scheduleSave();
    }
  }

  revokeSession(sessionId: string): boolean {
    const session = this.data.sessions.find(s => s.id === sessionId);
    if (session) {
      session.status = 'REVOKED';
      this.scheduleSave();
      return true;
    }
    return false;
  }

  revokeSessionByToken(token: string): boolean {
    const session = this.data.sessions.find(s => s.deviceToken === token && s.status === 'ACTIVE');
    if (!session) return false;
    session.status = 'REVOKED';
    this.scheduleSave();
    return true;
  }

  revokeAllSessionsForCode(accessCodeId: string): number {
    let count = 0;
    for (const session of this.data.sessions) {
      if (session.accessCodeId === accessCodeId && session.status === 'ACTIVE') {
        session.status = 'REVOKED';
        count++;
      }
    }
    if (count > 0) this.scheduleSave();
    return count;
  }

  // Series
  getAllSeries(includeDrafts = false): Series[] {
    let list = this.data.series;
    if (!includeDrafts) {
      list = list.filter(s => s.status === 'PUBLISHED');
    }
    return [...list].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  getSeriesById(id: string): Series | undefined {
    return this.data.series.find(s => s.id === id);
  }

  getSeriesBySlug(slug: string): Series | undefined {
    return this.data.series.find(s => s.slug === slug);
  }

  createSeries(data: Omit<Series, 'id' | 'createdAt' | 'updatedAt'>): Series {
    if (this.getSeriesBySlug(data.slug)) throw new Error(`Series slug "${data.slug}" already exists.`);
    const newSeries: Series = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.data.series.push(newSeries);
    this.scheduleSave();
    return newSeries;
  }

  updateSeries(id: string, updates: Partial<Series>): Series {
    const idx = this.data.series.findIndex(s => s.id === id);
    if (idx === -1) throw new Error('Series not found');
    const normalizedUpdates = { ...updates };
    delete normalizedUpdates.id;
    delete normalizedUpdates.createdAt;
    if (normalizedUpdates.slug) {
      normalizedUpdates.slug = normalizedUpdates.slug.trim();
      const duplicate = this.data.series.find(s => s.id !== id && s.slug === normalizedUpdates.slug);
      if (duplicate) throw new Error(`Series slug "${normalizedUpdates.slug}" already exists.`);
    }
    this.data.series[idx] = {
      ...this.data.series[idx],
      ...normalizedUpdates,
      updatedAt: new Date().toISOString()
    };
    this.scheduleSave();
    return this.data.series[idx];
  }

  deleteSeries(id: string): boolean {
    const initialLen = this.data.series.length;
    this.data.series = this.data.series.filter(s => s.id !== id);

    // Cascade delete seasons, episodes, sources
    const seasonIds = this.data.seasons.filter(sea => sea.seriesId === id).map(sea => sea.id);
    this.data.seasons = this.data.seasons.filter(sea => sea.seriesId !== id);

    const episodeIds = this.data.episodes.filter(ep => seasonIds.includes(ep.seasonId)).map(ep => ep.id);
    this.data.episodes = this.data.episodes.filter(ep => !seasonIds.includes(ep.seasonId));

    this.data.videoSources = this.data.videoSources.filter(src => !episodeIds.includes(src.episodeId));
    this.data.watchProgress = this.data.watchProgress.filter(p => !episodeIds.includes(p.episodeId));

    if (this.data.series.length !== initialLen) {
      this.scheduleSave();
      return true;
    }
    return false;
  }

  reorderSeries(orderedIds: string[]): void {
    orderedIds.forEach((id, index) => {
      const item = this.data.series.find(s => s.id === id);
      if (item) {
        item.sortOrder = index + 1;
      }
    });
    this.scheduleSave();
  }

  // Seasons
  getSeasonsBySeriesId(seriesId: string): Season[] {
    return this.data.seasons
      .filter(s => s.seriesId === seriesId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.seasonNumber - b.seasonNumber);
  }

  getSeasonById(id: string): Season | undefined {
    return this.data.seasons.find(s => s.id === id);
  }

  createSeason(data: Omit<Season, 'id' | 'createdAt' | 'updatedAt'>): Season {
    if (!this.getSeriesById(data.seriesId)) throw new Error('Parent series not found.');
    if (this.data.seasons.some(s => s.seriesId === data.seriesId && s.seasonNumber === data.seasonNumber)) {
      throw new Error(`Season ${data.seasonNumber} already exists for this series.`);
    }
    const newSeason: Season = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.data.seasons.push(newSeason);
    this.scheduleSave();
    return newSeason;
  }

  updateSeason(id: string, updates: Partial<Season>): Season {
    const idx = this.data.seasons.findIndex(s => s.id === id);
    if (idx === -1) throw new Error('Season not found');
    const normalizedUpdates = { ...updates };
    delete normalizedUpdates.id;
    delete normalizedUpdates.createdAt;
    const nextSeriesId = normalizedUpdates.seriesId || this.data.seasons[idx].seriesId;
    const nextSeasonNumber = normalizedUpdates.seasonNumber ?? this.data.seasons[idx].seasonNumber;
    if (!this.getSeriesById(nextSeriesId)) throw new Error('Parent series not found.');
    if (this.data.seasons.some(s => s.id !== id && s.seriesId === nextSeriesId && s.seasonNumber === nextSeasonNumber)) {
      throw new Error(`Season ${nextSeasonNumber} already exists for this series.`);
    }
    this.data.seasons[idx] = {
      ...this.data.seasons[idx],
      ...normalizedUpdates,
      updatedAt: new Date().toISOString()
    };
    this.scheduleSave();
    return this.data.seasons[idx];
  }

  deleteSeason(id: string): boolean {
    const initialLen = this.data.seasons.length;
    this.data.seasons = this.data.seasons.filter(s => s.id !== id);

    const episodeIds = this.data.episodes.filter(ep => ep.seasonId === id).map(ep => ep.id);
    this.data.episodes = this.data.episodes.filter(ep => ep.seasonId !== id);
    this.data.videoSources = this.data.videoSources.filter(src => !episodeIds.includes(src.episodeId));
    this.data.watchProgress = this.data.watchProgress.filter(p => !episodeIds.includes(p.episodeId));

    if (this.data.seasons.length !== initialLen) {
      this.scheduleSave();
      return true;
    }
    return false;
  }

  reorderSeasons(orderedIds: string[]): void {
    orderedIds.forEach((id, index) => {
      const item = this.data.seasons.find(s => s.id === id);
      if (item) {
        item.sortOrder = index + 1;
      }
    });
    this.scheduleSave();
  }

  // Episodes
  getEpisodesBySeasonId(seasonId: string, includeUnpublished = false): Episode[] {
    let list = this.data.episodes.filter(ep => ep.seasonId === seasonId);
    if (!includeUnpublished) {
      list = list.filter(ep => ep.published);
    }
    return list.sort((a, b) => a.sortOrder - b.sortOrder || a.episodeNumber - b.episodeNumber);
  }

  getEpisodeById(id: string): Episode | undefined {
    return this.data.episodes.find(ep => ep.id === id);
  }

  createEpisode(data: Omit<Episode, 'id' | 'createdAt' | 'updatedAt'>): Episode {
    if (!this.getSeasonById(data.seasonId)) throw new Error('Parent season not found.');
    if (this.data.episodes.some(e => e.seasonId === data.seasonId && e.episodeNumber === data.episodeNumber)) {
      throw new Error(`Episode ${data.episodeNumber} already exists in this season.`);
    }
    const newEp: Episode = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.data.episodes.push(newEp);
    this.scheduleSave();
    return newEp;
  }

  updateEpisode(id: string, updates: Partial<Episode>): Episode {
    const idx = this.data.episodes.findIndex(ep => ep.id === id);
    if (idx === -1) throw new Error('Episode not found');
    const normalizedUpdates = { ...updates };
    delete normalizedUpdates.id;
    delete normalizedUpdates.createdAt;
    const nextSeasonId = normalizedUpdates.seasonId || this.data.episodes[idx].seasonId;
    const nextEpisodeNumber = normalizedUpdates.episodeNumber ?? this.data.episodes[idx].episodeNumber;
    if (!this.getSeasonById(nextSeasonId)) throw new Error('Parent season not found.');
    if (this.data.episodes.some(e => e.id !== id && e.seasonId === nextSeasonId && e.episodeNumber === nextEpisodeNumber)) {
      throw new Error(`Episode ${nextEpisodeNumber} already exists in this season.`);
    }
    this.data.episodes[idx] = {
      ...this.data.episodes[idx],
      ...normalizedUpdates,
      updatedAt: new Date().toISOString()
    };
    this.scheduleSave();
    return this.data.episodes[idx];
  }

  deleteEpisode(id: string): boolean {
    const initialLen = this.data.episodes.length;
    this.data.episodes = this.data.episodes.filter(ep => ep.id !== id);
    this.data.videoSources = this.data.videoSources.filter(src => src.episodeId !== id);
    this.data.watchProgress = this.data.watchProgress.filter(p => p.episodeId !== id);

    if (this.data.episodes.length !== initialLen) {
      this.scheduleSave();
      return true;
    }
    return false;
  }

  reorderEpisodes(orderedIds: string[]): void {
    orderedIds.forEach((id, index) => {
      const item = this.data.episodes.find(ep => ep.id === id);
      if (item) {
        item.sortOrder = index + 1;
      }
    });
    this.scheduleSave();
  }

  // Video Sources
  getVideoSourcesByEpisodeId(episodeId: string, onlyEnabled = true): VideoSource[] {
    let list = this.data.videoSources.filter(s => s.episodeId === episodeId);
    if (onlyEnabled) {
      list = list.filter(s => s.enabled);
    }
    return list.sort((a, b) => a.priority - b.priority);
  }

  getVideoSourceById(id: string): VideoSource | undefined {
    return this.data.videoSources.find(s => s.id === id);
  }

  createVideoSource(data: Omit<VideoSource, 'id' | 'createdAt' | 'updatedAt'>): VideoSource {
    if (!this.getEpisodeById(data.episodeId)) throw new Error('Parent episode not found.');
    const newSrc: VideoSource = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.data.videoSources.push(newSrc);
    this.scheduleSave();
    return newSrc;
  }

  updateVideoSource(id: string, updates: Partial<VideoSource>): VideoSource {
    const idx = this.data.videoSources.findIndex(s => s.id === id);
    if (idx === -1) throw new Error('Video source not found');
    const normalizedUpdates = { ...updates };
    delete normalizedUpdates.id;
    delete normalizedUpdates.createdAt;
    const nextEpisodeId = normalizedUpdates.episodeId || this.data.videoSources[idx].episodeId;
    if (!this.getEpisodeById(nextEpisodeId)) throw new Error('Parent episode not found.');
    this.data.videoSources[idx] = {
      ...this.data.videoSources[idx],
      ...normalizedUpdates,
      updatedAt: new Date().toISOString()
    };
    this.scheduleSave();
    return this.data.videoSources[idx];
  }

  deleteVideoSource(id: string): boolean {
    const initialLen = this.data.videoSources.length;
    this.data.videoSources = this.data.videoSources.filter(s => s.id !== id);
    if (this.data.videoSources.length !== initialLen) {
      this.scheduleSave();
      return true;
    }
    return false;
  }

  reorderVideoSources(orderedIds: string[]): void {
    orderedIds.forEach((id, index) => {
      const item = this.data.videoSources.find(s => s.id === id);
      if (item) {
        item.priority = index + 1;
      }
    });
    this.scheduleSave();
  }

  // Watch Progress
  getWatchProgress(sessionId: string, episodeId: string): WatchProgress | undefined {
    return this.data.watchProgress.find(p => p.sessionId === sessionId && p.episodeId === episodeId);
  }

  upsertWatchProgress(params: {
    sessionId: string;
    episodeId: string;
    position: number;
    duration: number;
  }): WatchProgress {
    const { sessionId, episodeId, position, duration } = params;
    const completionThreshold = this.data.settings.completionPercentage || 90;
    const completed = duration > 0 ? (position / duration) * 100 >= completionThreshold : false;

    const existingIdx = this.data.watchProgress.findIndex(
      p => p.sessionId === sessionId && p.episodeId === episodeId
    );

    if (existingIdx !== -1) {
      this.data.watchProgress[existingIdx] = {
        ...this.data.watchProgress[existingIdx],
        position,
        duration: duration || this.data.watchProgress[existingIdx].duration,
        completed,
        updatedAt: new Date().toISOString()
      };
      this.scheduleSave();
      return this.data.watchProgress[existingIdx];
    } else {
      const newProgress: WatchProgress = {
        id: crypto.randomUUID(),
        sessionId,
        episodeId,
        position,
        duration,
        completed,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      this.data.watchProgress.push(newProgress);
      this.scheduleSave();
      return newProgress;
    }
  }

  getContinueWatchingForSession(sessionId: string): Array<{
    progress: WatchProgress;
    episode: Episode;
    season: Season;
    series: Series;
  }> {
    const list = this.data.watchProgress
      .filter(p => p.sessionId === sessionId && !p.completed && p.position > 10)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const result = [];
    for (const progress of list) {
      const episode = this.data.episodes.find(ep => ep.id === progress.episodeId);
      if (!episode || !episode.published) continue;

      const season = this.data.seasons.find(sea => sea.id === episode.seasonId);
      if (!season) continue;

      const series = this.data.series.find(ser => ser.id === season.seriesId);
      if (!series || series.status !== 'PUBLISHED') continue;

      result.push({ progress, episode, season, series });
    }
    return result;
  }

  // Settings
  getSettings(): AppSettings {
    return { ...this.data.settings };
  }

  getPublicSettings() {
    const s = this.data.settings;
    return {
      siteName: s.siteName || 'viE',
      siteDescription: s.siteDescription || '',
      logoUrl: s.logoUrl || '',
      faviconUrl: s.faviconUrl || '',
      heroBadgeText: s.heroBadgeText || 'المسلسل المميز • حصري على المنصة',
      footerText: s.footerText || 'viE • Encrypted High-Performance Streaming Platform',
      communityUrl: s.communityUrl || '',
      announcementEnabled: !!s.announcementEnabled,
      announcementText: s.announcementText || '',
      announcementLink: s.announcementLink || '',
      accentColor: s.accentColor || '#f59e0b',
      allowPip: s.allowPip !== false,
      allowPlaybackSpeed: s.allowPlaybackSpeed !== false,
      autoNextEpisodeDelay: s.autoNextEpisodeDelay || 5,
      completionPercentage: s.completionPercentage || 90,
      defaultMaxDevices: s.defaultMaxDevices || 1
    };
  }

  updateSettings(updates: Partial<AppSettings>): AppSettings {
    this.data.settings = {
      ...this.data.settings,
      ...updates
    };
    this.scheduleSave();
    return this.data.settings;
  }

  // Audit Logs
  addAuditLog(entry: {
    action: string;
    details: string;
    ipAddress?: string;
    level?: 'INFO' | 'WARN' | 'ERROR';
  }): AuditLog {
    const log: AuditLog = {
      id: crypto.randomUUID(),
      action: entry.action,
      details: entry.details,
      ipAddress: entry.ipAddress || 'unknown',
      level: entry.level || 'INFO',
      createdAt: new Date().toISOString()
    };
    this.data.auditLogs.unshift(log);
    // Keep max 1000 logs
    if (this.data.auditLogs.length > 1000) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 1000);
    }
    this.scheduleSave();
    return log;
  }

  getAuditLogs(limit = 100): AuditLog[] {
    return this.data.auditLogs.slice(0, limit);
  }

  async flush(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.enqueueSave(this.snapshot());
    await this.saveChain;
  }

  async close(): Promise<void> {
    await this.flush();
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  getDatabaseStatus() {
    return {
      backend: this.backend,
      connected: this.backend === 'postgres' ? !!this.pool : true,
      migratedFromJson: this.migratedFromJson
    };
  }

  // Dashboard Metrics
  getDashboardMetrics() {
    const totalSeries = this.data.series.length;
    const totalSeasons = this.data.seasons.length;
    const totalEpisodes = this.data.episodes.length;
    const totalAccessCodes = this.data.accessCodes.length;
    const activeAccessCodes = this.data.accessCodes.filter(c => c.status === 'ACTIVE').length;
    const activeSessions = this.data.sessions.filter(s => s.status === 'ACTIVE').length;
    const totalWatchEvents = this.data.watchProgress.length;
    const recentLogs = this.data.auditLogs.slice(0, 10);

    return {
      totalSeries,
      totalSeasons,
      totalEpisodes,
      totalAccessCodes,
      activeAccessCodes,
      activeSessions,
      totalWatchEvents,
      recentLogs
    };
  }
}

export const storage = new Storage();
