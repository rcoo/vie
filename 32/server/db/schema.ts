export interface Admin {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSession {
  id: string;
  adminId: string;
  tokenHash: string;
  ipAddress: string;
  lastActiveAt: string;
  expiresAt: string;
  createdAt: string;
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

export interface Series {
  id: string;
  title: string;
  slug: string;
  description: string;
  poster: string;
  backdrop: string;
  status: 'PUBLISHED' | 'DRAFT';
  sortOrder: number;
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

export type VideoSourceType = 'GOOGLE_DRIVE' | 'DIRECT_URL' | 'S3' | 'CLOUDFLARE_R2' | 'CUSTOM_HTTP' | 'EXTERNAL_PLAYER';

export interface VideoSource {
  id: string;
  episodeId: string;
  type: VideoSourceType;
  name: string;
  priority: number; // 1 = highest priority
  enabled: boolean;
  configuration: {
    driveFileId?: string;
    url?: string;
    apiKey?: string;
    bucket?: string;
    region?: string;
    [key: string]: any;
  };
  createdAt: string;
  updatedAt: string;
}

export interface WatchProgress {
  id: string;
  sessionId: string;
  episodeId: string;
  position: number; // in seconds
  duration: number; // in seconds
  completed: boolean;
  updatedAt: string;
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
  completionPercentage: number; // e.g. 90%
  autoNextEpisodeDelay: number; // e.g. 5 seconds
  defaultMaxDevices: number; // e.g. 2
  allowPip: boolean;
  allowPlaybackSpeed: boolean;
  googleClientId?: string;
  googleClientSecret?: string;
  googleRefreshToken?: string;
  googleApiKey?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  details: string;
  ipAddress: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  createdAt: string;
}
