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
  readAuthorized(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  generateDeliveryGrant(key: string, expiresInSeconds: number): Promise<DeliveryGrant>;
  stat(key: string): Promise<StatResult>;
}
