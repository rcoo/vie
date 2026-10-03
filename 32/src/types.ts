export interface Series {
  id: string;
  title: string;
  slug: string;
  description: string;
  poster: string;
  backdrop: string;
  status: 'PUBLISHED' | 'DRAFT';
  sortOrder: number;
  seasonCount?: number;
  episodeCount?: number;
  seasons?: Season[];
  createdAt: string;
  updatedAt: string;
}

export interface Season {
  id: string;
  seriesId: string;
  seasonNumber: number;
  title: string;
  description: string;
  poster: string;
  sortOrder: number;
  episodes?: Episode[];
  createdAt: string;
  updatedAt: string;
}

export interface Episode {
  id: string;
  seasonId: string;
  episodeNumber: number;
  title: string;
  description: string;
  thumbnail: string;
  duration: number; // in seconds
  published: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface VideoSource {
  id: string;
  episodeId: string;
  type: 'GOOGLE_DRIVE' | 'DIRECT_URL' | 'S3' | 'CLOUDFLARE_R2' | 'CUSTOM_HTTP' | 'EXTERNAL_PLAYER';
  name: string;
  priority: number;
  enabled: boolean;
  configuration: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface WatchProgress {
  id: string;
  sessionId: string;
  episodeId: string;
  position: number;
  duration: number;
  completed: boolean;
  updatedAt: string;
  createdAt: string;
}

export interface ContinueWatchingItem {
  progress: WatchProgress;
  episode: Episode;
  season: Season;
  series: Series;
}

export interface AccessCode {
  id: string;
  code: string;
  status: 'ACTIVE' | 'DISABLED' | 'EXPIRED';
  expiresAt: string | null;
  maxDevices: number;
  createdBy: string;
  note: string | null;
  lastUsedAt: string | null;
  activeDevicesCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AccessSession {
  id: string;
  accessCodeId: string;
  deviceToken: string;
  deviceInfo: string;
  ipAddress: string;
  status: 'ACTIVE' | 'REVOKED';
  lastActiveAt: string;
  createdAt: string;
}

export interface AppSettings {
  siteName: string;
  siteDescription: string;
  logoUrl: string;
  faviconUrl?: string;
  heroBadgeText?: string;
  footerText?: string;
  communityUrl?: string;
  announcementEnabled?: boolean;
  announcementText?: string;
  announcementLink?: string;
  accentColor?: string;
  completionPercentage: number;
  autoNextEpisodeDelay: number;
  defaultMaxDevices: number;
  allowPip: boolean;
  allowPlaybackSpeed: boolean;
  googleClientId?: string;
  googleClientSecret?: string;
  googleRefreshToken?: string;
  googleApiKey?: string;
}

export interface DashboardMetrics {
  totalSeries: number;
  totalSeasons: number;
  totalEpisodes: number;
  totalAccessCodes: number;
  activeAccessCodes: number;
  activeSessions: number;
  totalWatchEvents: number;
  recentLogs: AuditLog[];
}

export interface AuditLog {
  id: string;
  action: string;
  details: string;
  ipAddress: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  createdAt: string;
}
