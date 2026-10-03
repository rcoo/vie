import bcrypt from 'bcryptjs';
import type { Admin, AccessCode, Series, Season, Episode, VideoSource, AppSettings } from './schema.ts';

export const initialSettings: AppSettings = {
  siteName: 'viE',
  siteDescription: '.gg/8mr',
  logoUrl: '',
  heroBadgeText: 'المسلسل المميز • حصري على المنصة',
  footerText: 'Encrypted High-Performance Media Gateway',
  completionPercentage: 90,
  autoNextEpisodeDelay: 5,
  defaultMaxDevices: 1,
  allowPip: true,
  allowPlaybackSpeed: true,
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRefreshToken: process.env.GOOGLE_REFRESH_TOKEN || '',
  googleApiKey: process.env.GOOGLE_API_KEY || ''
};

export const initialAdmin: Admin = {
  id: 'admin-primary-1',
  username: process.env.ADMIN_USERNAME || 'vin',
  passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'waswaswas', 10),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export const initialAccessCodes: AccessCode[] = [
  {
    id: 'code-vip-1',
    code: 'STREAM-VIP-2026',
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    maxDevices: 3,
    createdBy: 'admin',
    note: 'VIP All-Access Pass (Valid 1 Year)',
    lastUsedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'code-prem-2',
    code: 'CINE-PREMIUM',
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    maxDevices: 2,
    createdBy: 'admin',
    note: 'Premium 3-Months Access Pass',
    lastUsedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'code-demo-3',
    code: 'DEMO-PASS',
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    maxDevices: 1,
    createdBy: 'admin',
    note: 'Demo Single-Device Pass',
    lastUsedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const initialSeries: Series[] = [
  {
    id: 'series-breaking-bad',
    title: 'Breaking Bad',
    slug: 'breaking-bad',
    description: 'A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine in order to secure his family\'s future.',
    poster: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=600&q=80',
    backdrop: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1600&q=80',
    status: 'PUBLISHED',
    sortOrder: 1,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'series-dark',
    title: 'Dark',
    slug: 'dark',
    description: 'A missing child sets four families on a frantic hunt for answers as they unearth a mind-bending mystery that spans three generations in a small German town.',
    poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
    backdrop: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=80',
    status: 'PUBLISHED',
    sortOrder: 2,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'series-stranger-things',
    title: 'Stranger Things',
    slug: 'stranger-things',
    description: 'When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl.',
    poster: 'https://images.unsplash.com/photo-1509281373149-e957c6296406?auto=format&fit=crop&w=600&q=80',
    backdrop: 'https://images.unsplash.com/photo-1518709779341-56cf4535e94b?auto=format&fit=crop&w=1600&q=80',
    status: 'PUBLISHED',
    sortOrder: 3,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const initialSeasons: Season[] = [
  // Breaking Bad Seasons
  {
    id: 'season-bb-1',
    seriesId: 'series-breaking-bad',
    seasonNumber: 1,
    title: 'Season 1: Pilot & Chemistry',
    description: 'Walter White begins his descent into the criminal underworld with former student Jesse Pinkman.',
    poster: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=600&q=80',
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'season-bb-2',
    seriesId: 'series-breaking-bad',
    seasonNumber: 2,
    title: 'Season 2: Expansion & Fallout',
    description: 'Walt and Jesse struggle to expand their empire while evading the DEA and dangerous cartels.',
    poster: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80',
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  // Dark Seasons
  {
    id: 'season-dark-1',
    seriesId: 'series-dark',
    seasonNumber: 1,
    title: 'Season 1: Secrets of Winden',
    description: 'The disappearance of two children in a German town exposes the double lives and fractured relationships among four families.',
    poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  // Stranger Things Seasons
  {
    id: 'season-st-1',
    seriesId: 'series-stranger-things',
    seasonNumber: 1,
    title: 'Season 1: The Vanishing of Will Byers',
    description: 'A young boy disappears into thin air, and a peculiar girl with telekinetic powers emerges.',
    poster: 'https://images.unsplash.com/photo-1509281373149-e957c6296406?auto=format&fit=crop&w=600&q=80',
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const initialEpisodes: Episode[] = [
  // Breaking Bad S1
  {
    id: 'ep-bb-101',
    seasonId: 'season-bb-1',
    episodeNumber: 1,
    title: 'Pilot',
    description: 'Diagnosed with terminal lung cancer, chemistry teacher Walter White teams up with former student Jesse Pinkman to cook crystal meth in an old RV.',
    thumbnail: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=800&q=80',
    duration: 3480, // ~58 mins
    published: true,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ep-bb-102',
    seasonId: 'season-bb-1',
    episodeNumber: 2,
    title: 'Cat\'s in the Bag...',
    description: 'Walt and Jesse attempt to dispose of two bodies, while Skyler grows suspicious of Walt\'s recent erratic behavior.',
    thumbnail: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80',
    duration: 2880,
    published: true,
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ep-bb-103',
    seasonId: 'season-bb-1',
    episodeNumber: 3,
    title: '...And the Bag\'s in the River',
    description: 'Walt and Jesse must clean up after a bloody bathtub collapse; Walt finds himself in a tense confrontation in the basement.',
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    duration: 2940,
    published: true,
    sortOrder: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  // Breaking Bad S2
  {
    id: 'ep-bb-201',
    seasonId: 'season-bb-2',
    episodeNumber: 1,
    title: 'Seven Thirty-Seven',
    description: 'Walt and Jesse realize just how dangerous their psychotic distributor Tuco Salamanca really is.',
    thumbnail: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80',
    duration: 2820,
    published: true,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  // Dark S1
  {
    id: 'ep-dark-101',
    seasonId: 'season-dark-1',
    episodeNumber: 1,
    title: 'Secrets',
    description: 'In 2019, a local boy\'s disappearance stokes fear in the residents of Winden, a small German town with a strange and tragic history.',
    thumbnail: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
    duration: 3120,
    published: true,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ep-dark-102',
    seasonId: 'season-dark-1',
    episodeNumber: 2,
    title: 'Lies',
    description: 'When a grim discovery leaves police baffled, Ulrich seeks a search warrant for the nuclear power plant.',
    thumbnail: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=800&q=80',
    duration: 2640,
    published: true,
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  // Stranger Things S1
  {
    id: 'ep-st-101',
    seasonId: 'season-st-1',
    episodeNumber: 1,
    title: 'Chapter One: The Vanishing of Will Byers',
    description: 'On his way home from a friend\'s house, young Will Byers sees something terrifying. Nearby, a sinister secret lurks in the depths of a government lab.',
    thumbnail: 'https://images.unsplash.com/photo-1509281373149-e957c6296406?auto=format&fit=crop&w=800&q=80',
    duration: 2900,
    published: true,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const initialVideoSources: VideoSource[] = [
  // For Breaking Bad S1E1: Primary High-speed Direct MP4 stream + Backup Google Drive source template
  {
    id: 'src-bb101-1',
    episodeId: 'ep-bb-101',
    type: 'DIRECT_URL',
    name: 'Primary Direct Stream (Fast CDN)',
    priority: 1,
    enabled: true,
    configuration: {
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'src-bb101-2',
    episodeId: 'ep-bb-101',
    type: 'GOOGLE_DRIVE',
    name: 'Google Drive Private Cloud (Backup)',
    priority: 2,
    enabled: true,
    configuration: {
      driveFileId: '1AbCdEfGhIjKlMnOpQrStUvWxYz-SAMPLE'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // Breaking Bad S1E2
  {
    id: 'src-bb102-1',
    episodeId: 'ep-bb-102',
    type: 'DIRECT_URL',
    name: 'Primary CDN Stream',
    priority: 1,
    enabled: true,
    configuration: {
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // Breaking Bad S1E3
  {
    id: 'src-bb103-1',
    episodeId: 'ep-bb-103',
    type: 'DIRECT_URL',
    name: 'Primary CDN Stream',
    priority: 1,
    enabled: true,
    configuration: {
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // Breaking Bad S2E1
  {
    id: 'src-bb201-1',
    episodeId: 'ep-bb-201',
    type: 'DIRECT_URL',
    name: 'Primary CDN Stream',
    priority: 1,
    enabled: true,
    configuration: {
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // Dark S1E1
  {
    id: 'src-dark101-1',
    episodeId: 'ep-dark-101',
    type: 'DIRECT_URL',
    name: 'Primary CDN Stream',
    priority: 1,
    enabled: true,
    configuration: {
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // Dark S1E2
  {
    id: 'src-dark102-1',
    episodeId: 'ep-dark-102',
    type: 'DIRECT_URL',
    name: 'Primary CDN Stream',
    priority: 1,
    enabled: true,
    configuration: {
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // Stranger Things S1E1
  {
    id: 'src-st101-1',
    episodeId: 'ep-st-101',
    type: 'DIRECT_URL',
    name: 'Primary CDN Stream',
    priority: 1,
    enabled: true,
    configuration: {
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];
