// Local filesystem storage adapter for development and small deployments
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { StorageProvider, StatResult, DeliveryGrant } from './index.js';

export class LocalStorageProvider implements StorageProvider {
  constructor(
    private readonly root: string,
    private readonly signingKey: string,
    private readonly publicBaseUrl: string,
  ) {
    fs.mkdirSync(root, { recursive: true });
  }

  async putPrivate(
    key: string,
    data: Buffer | NodeJS.ReadableStream,
    _contentType: string,
  ): Promise<void> {
    const filePath = this.keyToPath(key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (Buffer.isBuffer(data)) {
      fs.writeFileSync(filePath, data);
    } else {
      await new Promise<void>((resolve, reject) => {
        const ws = fs.createWriteStream(filePath);
        (data as NodeJS.ReadableStream).pipe(ws);
        ws.on('finish', resolve);
        ws.on('error', reject);
      });
    }
  }

  async readAuthorized(key: string): Promise<Buffer> {
    return fs.readFileSync(this.keyToPath(key));
  }

  async delete(key: string): Promise<void> {
    try {
      fs.unlinkSync(this.keyToPath(key));
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  async generateDeliveryGrant(key: string, expiresInSeconds: number): Promise<DeliveryGrant> {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    const payload = `${key}:${expiresAt.getTime()}`;
    const token = crypto.createHmac('sha256', this.signingKey).update(payload).digest('base64url');
    const url = `${this.publicBaseUrl}/media/${encodeURIComponent(key)}?token=${token}&expires=${expiresAt.getTime()}`;
    return { url, expiresAt, token };
  }

  async stat(key: string): Promise<StatResult> {
    const stats = fs.statSync(this.keyToPath(key));
    return {
      size: stats.size,
      contentType: 'application/octet-stream',
      lastModified: stats.mtime,
    };
  }

  /**
   * Verifies a delivery grant token. Used by the media endpoint to authorize streaming.
   */
  verifyToken(key: string, token: string, expires: number): boolean {
    const expiresAt = new Date(expires);
    if (expiresAt < new Date()) return false;
    const payload = `${key}:${expires}`;
    const expected = crypto
      .createHmac('sha256', this.signingKey)
      .update(payload)
      .digest('base64url');
    try {
      return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  private keyToPath(key: string): string {
    // Prevent path traversal attacks
    const normalized = path.normalize(key).replace(/^\.\.\//, '');
    return path.join(this.root, normalized);
  }
}
