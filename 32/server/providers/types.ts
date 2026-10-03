import type { Readable } from 'stream';

export interface SourceMetadata {
  mimeType: string;
  sizeBytes?: number;
  supportsRange: boolean;
  filename?: string;
}

export interface StreamRange {
  start: number;
  end?: number;
}

export interface StreamResult {
  stream: Readable;
  statusCode: number;
  headers: Record<string, string | number>;
  contentLength?: number;
  contentRange?: string;
  mimeType: string;
}

export interface SourceTestResult {
  success: boolean;
  message: string;
  reachable: boolean;
  mimeType?: string;
  sizeBytes?: number;
  rangeSupported: boolean;
  latencyMs: number;
  details?: Record<string, any>;
}

export interface VideoSourceProvider {
  readonly type: string;
  readonly displayName: string;
  
  /**
   * Retrieves metadata such as content length, MIME type, and range capability.
   */
  getMetadata(config: Record<string, any>): Promise<SourceMetadata>;

  /**
   * Opens a stream for partial content (Range requests) or full content.
   */
  getStream(config: Record<string, any>, range?: StreamRange): Promise<StreamResult>;

  /**
   * Checks whether the underlying source supports HTTP Range requests.
   */
  supportsRange(config: Record<string, any>): Promise<boolean>;

  /**
   * Runs diagnostic reachability, permissions, MIME type, and Range tests.
   */
  testConnection(config: Record<string, any>): Promise<SourceTestResult>;
}
