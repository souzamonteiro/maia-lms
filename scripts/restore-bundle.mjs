import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { referencedStorageKeys, validStorageKey } from './backup-utils.mjs';

const args = process.argv.slice(2);
const verifyOnly = args[0] === '--verify';
if (verifyOnly) args.shift();
if (args.length !== (verifyOnly ? 1 : 2))
  throw new Error('Usage: npm run backup:verify -- /bundle OR npm run restore:bundle -- /bundle /new-directory');

function realDirectory(directory) {
  const resolved = path.resolve(directory);
  if (!fs.lstatSync(resolved).isDirectory() || fs.realpathSync(resolved) !== resolved)
    throw new Error('Bundle directories must be real directories without symlink components');
  return resolved;
}

function regularFile(filename) {
  const info = fs.lstatSync(filename);
  if (!info.isFile() || info.isSymbolicLink())
    throw new Error(`Bundle entry must be a regular file: ${filename}`);
  return info;
}

async function digest(filename) {
  regularFile(filename);
  const hash = crypto.createHash('sha256');
  const input = fs.createReadStream(filename, { flags: fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW });
  for await (const chunk of input) hash.update(chunk);
  return hash.digest('hex');
}

function fileRecord(record) {
  return record !== null && typeof record === 'object' &&
    Number.isSafeInteger(record.size) && record.size >= 0 &&
    typeof record.sha256 === 'string' && /^[a-f0-9]{64}$/.test(record.sha256);
}

function storageInventory(directory, prefix = '') {
  realDirectory(directory);
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...storageInventory(filename, name));
    else {
      regularFile(filename);
      files.push(name);
    }
  }
  return files;
}

async function verify(directory, expectedManifest) {
  realDirectory(directory);
  const allowed = new Set(['database.sqlite', 'storage', 'manifest.json']);
  if (fs.readdirSync(directory).some(name => !allowed.has(name)))
    throw new Error('Unexpected entry in bundle (including SQLite sidecars)');
  let manifest = expectedManifest;
  if (manifest === undefined) {
    regularFile(path.join(directory, 'manifest.json'));
    manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
  }
  if (
    !manifest || manifest.formatVersion !== 1 ||
    !fileRecord(manifest.database) || manifest.database.file !== 'database.sqlite' ||
    !manifest.storage || manifest.storage.directory !== 'storage' ||
    !Array.isArray(manifest.storage.files) ||
    !Number.isSafeInteger(manifest.storage.fileCount) ||
    !Number.isSafeInteger(manifest.storage.totalBytes) || manifest.storage.totalBytes < 0
  )
    throw new Error('Invalid or unsupported backup manifest');

  const records = manifest.storage.files;
  const paths = new Set();
  let bytes = 0;
  for (const record of records) {
    if (!fileRecord(record) || !validStorageKey(record.path) || paths.has(record.path))
      throw new Error('Invalid or duplicate manifest storage path');
    paths.add(record.path);
    bytes += record.size;
    if (!Number.isSafeInteger(bytes)) throw new Error('Manifest byte count exceeds safe integer range');
  }
  if (manifest.storage.fileCount !== records.length || manifest.storage.totalBytes !== bytes)
    throw new Error('Manifest totals do not match its file records');

  const inventory = storageInventory(path.join(directory, 'storage'));
  if (inventory.length !== paths.size || inventory.some(name => !paths.has(name)))
    throw new Error('Storage inventory does not match the manifest');

  const databaseFile = path.join(directory, 'database.sqlite');
  for (const [filename, record] of [
    [databaseFile, manifest.database],
    ...records.map(record => [path.join(directory, 'storage', record.path), record]),
  ]) {
    if (regularFile(filename).size !== record.size || await digest(filename) !== record.sha256)
      throw new Error(`Backup checksum or size mismatch: ${path.relative(directory, filename)}`);
  }
  const db = new Database(databaseFile, { readonly: true, fileMustExist: true });
  try {
    if (db.pragma('journal_mode', { simple: true }) !== 'delete')
      throw new Error('Bundle database must use standalone DELETE journal mode; recreate the bundle');
    if (db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length)
      throw new Error('Restored database integrity check failed');
    if (referencedStorageKeys(db).some(key => !paths.has(key)))
      throw new Error('Bundle is missing database-referenced storage objects');
  } finally {
    db.close();
  }
  return manifest;
}

const source = realDirectory(args[0]);
const manifest = await verify(source);
if (verifyOnly) {
  console.log(`Verified backup bundle: ${source}`);
} else {
  const destination = path.resolve(args[1]);
  const parent = realDirectory(path.dirname(destination));
  const relative = path.relative(source, destination);
  if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)))
    throw new Error('Restore destination must be outside the backup bundle');
  fs.mkdirSync(path.join(parent, path.basename(destination)), { mode: 0o700 });
  try {
  fs.mkdirSync(path.join(destination, 'storage'), { mode: 0o700 });
  const records = [
    { source: 'database.sqlite', destination: 'database.sqlite' },
    ...manifest.storage.files.map(record => ({
      source: `storage/${record.path}`,
      destination: `storage/${record.path}`,
    })),
  ];
  for (const record of records) {
    const output = path.join(destination, record.destination);
    fs.mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
    await pipeline(
      fs.createReadStream(path.join(source, record.source), { flags: fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW }),
      fs.createWriteStream(output, { flags: 'wx', mode: 0o600 }),
    );
  }
  // The completion marker is written only after the restored files verify.
  await verify(destination, manifest);
  const databaseFile = path.join(destination, 'database.sqlite');
  const restored = new Database(databaseFile, { fileMustExist: true });
  const invalidatedAt = new Date().toISOString();
  let invalidated;
  let unprocessedEmailMessages;
  try {
    restored.pragma('foreign_keys = ON');
    invalidated = restored.transaction(() => ({
      accounts: restored.prepare('UPDATE users SET session_version=session_version+1').run().changes,
      httpSessions: restored.prepare('UPDATE http_sessions SET expires_at=0 WHERE expires_at>0').run().changes,
      legacySessions: restored.prepare('UPDATE sessions SET revoked_at=? WHERE revoked_at IS NULL')
        .run(invalidatedAt).changes,
      emailTokens: restored.prepare('UPDATE email_tokens SET used_at=? WHERE used_at IS NULL')
        .run(invalidatedAt).changes,
      emailChanges: restored.prepare('UPDATE account_email_changes SET used_at=? WHERE used_at IS NULL')
        .run(invalidatedAt).changes,
      mfaChallenges: restored.prepare('UPDATE auth_mfa_challenges SET consumed_at=? WHERE consumed_at IS NULL')
        .run(invalidatedAt).changes,
    })).immediate();
    unprocessedEmailMessages = (restored.prepare(`SELECT count(*) AS total FROM outbox
      WHERE event_type='email.send' AND processed_at IS NULL`).get()).total;
  } finally {
    restored.close();
  }
  const restoredManifest = {
    ...manifest,
    database: {
      ...manifest.database,
      size: regularFile(databaseFile).size,
      sha256: await digest(databaseFile),
    },
    restoration: {
      authenticationPolicy: 'invalidate',
      invalidatedAt,
      invalidated,
      unprocessedEmailMessages,
      sourceDatabaseSha256: manifest.database.sha256,
    },
  };
  await verify(destination, restoredManifest);
  const marker = path.join(destination, 'manifest.json');
  fs.writeFileSync(marker, `${JSON.stringify(restoredManifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  console.log(`Verified restore: ${destination}`);
  console.log('Recovered sessions, pending email tokens and MFA login challenges have been invalidated.');
  console.log('Configuration, migrations and service startup remain operator actions.');
  } catch (error) {
    try {
      fs.rmSync(destination, { recursive: true });
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Restore failed and its incomplete destination could not be removed');
    }
    throw error;
  }
}
