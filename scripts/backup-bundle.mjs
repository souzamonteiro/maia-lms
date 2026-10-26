import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { referencedStorageKeys, validStorageKey } from './backup-utils.mjs';

if (process.env.NODE_ENV !== 'production' && fs.existsSync('.env')) process.loadEnvFile('.env');

const destination = process.argv[2];
if (!destination)
  throw new Error('Usage: npm run backup:bundle -- /path/to/new-backup-directory');

const sourceDatabase = path.resolve(process.env.DATABASE_URL ?? './data/maia-lms.db');
const sourceStorage = path.resolve(process.env.STORAGE_ROOT ?? './data/storage');
const target = path.resolve(destination);

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

if (
  isWithin(sourceStorage, target) ||
  isWithin(target, sourceStorage) ||
  isWithin(target, sourceDatabase)
)
  throw new Error('Backup destination must be separate from the database and storage root');
if (fs.existsSync(target)) throw new Error('Backup destination already exists');
if (!fs.statSync(path.dirname(target)).isDirectory())
  throw new Error('Backup destination parent directory must exist');

const storageInfo = fs.lstatSync(sourceStorage);
if (!storageInfo.isDirectory() || storageInfo.isSymbolicLink())
  throw new Error('Storage root must be a real directory');
const resolvedStorage = fs.realpathSync(sourceStorage);
if (resolvedStorage !== sourceStorage) throw new Error('Storage root cannot resolve through a symlink');

fs.mkdirSync(target, { mode: 0o700 });
fs.mkdirSync(path.join(target, 'storage'), { mode: 0o700 });
const files = [];

async function hashFile(filename) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}

async function copyStorageDirectory(sourceDirectory, destinationDirectory, relativeDirectory = '') {
  const entries = fs.readdirSync(sourceDirectory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const source = path.join(sourceDirectory, entry.name);
    const relativePath = relativeDirectory
      ? `${relativeDirectory}/${entry.name}`
      : entry.name;
    const output = path.join(destinationDirectory, entry.name);
    const before = fs.lstatSync(source);
    if (before.isSymbolicLink()) throw new Error(`Storage symlink rejected: ${relativePath}`);
    if (before.isDirectory()) {
      fs.mkdirSync(output, { mode: 0o700 });
      await copyStorageDirectory(source, output, relativePath);
      continue;
    }
    if (!before.isFile()) throw new Error(`Unsupported storage entry: ${relativePath}`);
    if (!validStorageKey(relativePath)) throw new Error(`Invalid storage key: ${relativePath}`);

    const hash = crypto.createHash('sha256');
    const digest = new Transform({
      transform(chunk, _encoding, callback) {
        hash.update(chunk);
        callback(null, chunk);
      },
    });
    await pipeline(
      fs.createReadStream(source),
      digest,
      fs.createWriteStream(output, { flags: 'wx', mode: 0o600 }),
    );
    const after = fs.lstatSync(source);
    const copiedHash = hash.digest('hex');
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      before.ctimeMs !== after.ctimeMs ||
      copiedHash !== await hashFile(output)
    )
      throw new Error(`Storage changed during backup: ${relativePath}`);
    files.push({ path: relativePath, size: after.size, sha256: copiedHash });
  }
}

const databaseFile = path.join(target, 'database.sqlite');
const databaseDescriptor = fs.openSync(databaseFile, 'wx', 0o600);
fs.closeSync(databaseDescriptor);
const source = new Database(sourceDatabase, { readonly: true, fileMustExist: true });
try {
  await source.backup(databaseFile);
} finally {
  source.close();
}

const backup = new Database(databaseFile, { fileMustExist: true });
try {
  // The standalone snapshot must not depend on WAL sidecars during recovery.
  backup.pragma('journal_mode = DELETE');
  const integrity = backup.pragma('integrity_check', { simple: true });
  const foreignKeyViolations = backup.pragma('foreign_key_check');
  if (integrity !== 'ok' || foreignKeyViolations.length)
    throw new Error('Database backup integrity check failed');

  await copyStorageDirectory(sourceStorage, path.join(target, 'storage'));
  const copiedPaths = new Set(files.map(file => file.path));
  const missingReferences = referencedStorageKeys(backup).filter(key => !copiedPaths.has(key));
  if (missingReferences.length)
    throw new Error(`Backup is missing ${missingReferences.length} database-referenced storage object(s)`);
} finally {
  backup.close();
}

const databaseStat = fs.statSync(databaseFile);
const manifest = {
  formatVersion: 1,
  createdAt: new Date().toISOString(),
  database: {
    file: 'database.sqlite',
    size: databaseStat.size,
    sha256: await hashFile(databaseFile),
    integrityCheck: 'ok',
    foreignKeyViolations: 0,
  },
  storage: {
    directory: 'storage',
    fileCount: files.length,
    totalBytes: files.reduce((total, file) => total + file.size, 0),
    files,
  },
  consistency: 'Database and storage are copied separately. Stop application and worker writes for a crash-consistent recovery point.',
  configuration: 'Environment files and secrets are intentionally excluded; restore configuration separately.',
};
fs.writeFileSync(
  path.join(target, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  { flag: 'wx', mode: 0o600 },
);
console.log(`Verified backup bundle: ${target}`);
