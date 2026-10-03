import type { VideoSourceProvider } from './types.ts';
import { GoogleDriveProvider } from './googleDrive.ts';
import { DirectUrlProvider } from './directUrl.ts';
import { CustomHttpProvider } from './customHttp.ts';

class ProviderRegistry {
  private providers: Map<string, VideoSourceProvider> = new Map();

  constructor() {
    this.register(new GoogleDriveProvider());
    this.register(new DirectUrlProvider());
    this.register(new CustomHttpProvider('S3', 'Amazon S3 Storage'));
    this.register(new CustomHttpProvider('CLOUDFLARE_R2', 'Cloudflare R2 Storage'));
    this.register(new CustomHttpProvider('CUSTOM_HTTP', 'Custom HTTP Server'));
  }

  register(provider: VideoSourceProvider): void {
    this.providers.set(provider.type.toUpperCase(), provider);
  }

  get(type: string): VideoSourceProvider {
    const p = this.providers.get(type.toUpperCase());
    if (!p) {
      throw new Error(`Unsupported video source provider: "${type}". Registered providers: ${Array.from(this.providers.keys()).join(', ')}`);
    }
    return p;
  }

  has(type: string): boolean {
    return this.providers.has(type.toUpperCase());
  }

  getAll(): VideoSourceProvider[] {
    return Array.from(this.providers.values());
  }
}

export const providerRegistry = new ProviderRegistry();
