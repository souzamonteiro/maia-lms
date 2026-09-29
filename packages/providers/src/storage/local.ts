// Private local objects. The service account exclusively owns the storage root.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { StorageProvider, StatResult, DeliveryGrant } from './index.js';
export class LocalStorageProvider implements StorageProvider {
  private readonly root: string;
  constructor(
    root: string,
    private readonly signingKey: string,
    private readonly publicBaseUrl: string,
  ) {
    fs.mkdirSync(root, { recursive: true, mode: 0o700 });
    if (fs.lstatSync(root).isSymbolicLink()) throw new Error('Storage root cannot be a symlink');
    this.root = fs.realpathSync(root);
  }
  private keyToPath(key: string): string {
    if (fs.lstatSync(this.root).isSymbolicLink() || fs.realpathSync(this.root) !== this.root)
      throw new Error('Storage root changed');
    if (
      !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(key) ||
      key.split('/').some(p => p === '.' || p === '..')
    )
      throw new Error('Invalid storage key');
    let current = this.root;
    for (const part of key.split('/')) {
      current = path.join(current, part);
      try {
        if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Storage symlink rejected');
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      }
    }
    return current;
  }
  async putPrivate(
    key: string,
    data: Buffer | NodeJS.ReadableStream,
    _type: string,
  ): Promise<void> {
    const target = this.keyToPath(key);
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    this.keyToPath(key);
    const temp = `${target}.${crypto.randomUUID()}.part`;
    try {
      await pipeline(
        Buffer.isBuffer(data) ? Readable.from([data]) : data,
        fs.createWriteStream(temp, { flags: 'wx', mode: 0o600 }),
      );
      this.keyToPath(key);
      // Immutable objects; hard-link atomically fails if the destination already exists.
      fs.linkSync(temp, target);
    } finally {
      fs.rmSync(temp, { force: true });
    }
  }
  openRead(key: string, options: { start?: number; end?: number } = {}): fs.ReadStream {
    const fd = fs.openSync(this.keyToPath(key), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    if (!fs.fstatSync(fd).isFile()) {
      fs.closeSync(fd);
      throw new Error('Not a regular file');
    }
    try {
      return fs.createReadStream('', { fd, autoClose: true, ...options });
    } catch (error) {
      fs.closeSync(fd);
      throw error;
    }
  }
  async readAuthorized(key: string, maxBytes = 8 * 1024 * 1024): Promise<Buffer> {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 0 || maxBytes > 8 * 1024 * 1024)
      throw new Error('Buffered reads must be limited to at most 8 MiB; use openRead');
    if ((await this.stat(key)).size > maxBytes)
      throw new Error('Object exceeds buffered read limit; use openRead');
    const chunks: Buffer[] = [];
    let size = 0;
    // Check again while reading: never trust a pre-read size alone.
    for await (const chunk of this.openRead(key)) {
      size += chunk.length;
      if (size > maxBytes) throw new Error('Object exceeds buffered read limit; use openRead');
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks, size);
  }
  async delete(key: string): Promise<void> {
    fs.rmSync(this.keyToPath(key), { force: true });
  }
  async stat(key: string): Promise<StatResult> {
    const fd = fs.openSync(this.keyToPath(key), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    try {
      const stat = fs.fstatSync(fd);
      if (!stat.isFile()) throw new Error('Not a regular file');
      return { size: stat.size, contentType: 'application/octet-stream', lastModified: stat.mtime };
    } finally {
      fs.closeSync(fd);
    }
  }
  async generateDeliveryGrant(key: string, seconds: number): Promise<DeliveryGrant> {
    this.keyToPath(key);
    if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('Invalid expiry');
    const expiresAt = new Date(Date.now() + seconds * 1000);
    const token = crypto
      .createHmac('sha256', this.signingKey)
      .update(`${key}:${expiresAt.getTime()}`)
      .digest('base64url');
    return {
      url: `${this.publicBaseUrl}/media/${encodeURIComponent(key)}?token=${token}&expires=${expiresAt.getTime()}`,
      token,
      expiresAt,
    };
  }
  verifyToken(key: string, token: string, expires: number): boolean {
    if (!Number.isFinite(expires) || expires <= Date.now()) return false;
    const expected = crypto
      .createHmac('sha256', this.signingKey)
      .update(`${key}:${expires}`)
      .digest('base64url');
    try {
      return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
    } catch {
      return false;
    }
  }
}
