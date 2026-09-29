import type { Readable } from 'node:stream';
// Storage provider port definition

export interface StatResult {
  size: number;
  contentType: string;
  lastModified: Date;
}

export interface DeliveryGrant {
  url: string;
  expiresAt: Date;
  token: string;
}

export interface StorageProvider {
  putPrivate(key: string, data: Buffer | NodeJS.ReadableStream, contentType: string): Promise<void>;
  // Authorization belongs to the caller; this provider handles private object I/O.
  openRead(key: string, options?: { start?: number; end?: number }): Readable;
  // Bounded convenience operation for small objects. Stream large media instead.
  readAuthorized(key: string, maxBytes?: number): Promise<Buffer>;
  delete(key: string): Promise<void>;
  generateDeliveryGrant(key: string, expiresInSeconds: number): Promise<DeliveryGrant>;
  stat(key: string): Promise<StatResult>;
}
