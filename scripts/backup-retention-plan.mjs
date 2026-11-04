import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { planBackupRetention } from './backup-retention-policy.mjs';

const rootArg = process.argv[2];
if (!rootArg)
  throw new Error('Usage: npm run backup:retention-plan -- /path/to/backup-root');

const root = path.resolve(rootArg);
const rootInfo = fs.lstatSync(root);
if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink() || fs.realpathSync(root) !== root)
  throw new Error('Backup root must be a real directory without symlink components');

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const bundles = [];
for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
  const directory = path.join(root, entry.name);
  if (!entry.isDirectory() || entry.isSymbolicLink() || fs.realpathSync(directory) !== directory)
    throw new Error(`Backup root contains an unsupported entry: ${entry.name}`);
  try {
    execFileSync(process.execPath, [path.join(scriptDirectory, 'restore-bundle.mjs'), '--verify', directory], {
      stdio: 'pipe',
    });
  } catch (error) {
    const details = error.stderr?.toString().trim();
    throw new Error(
      `Backup bundle verification failed: ${entry.name}${details ? `: ${details}` : ''}`,
      { cause: error },
    );
  }
  const manifestPath = path.join(directory, 'manifest.json');
  const manifestInfo = fs.lstatSync(manifestPath);
  if (!manifestInfo.isFile() || manifestInfo.isSymbolicLink())
    throw new Error(`Backup manifest must be a regular file: ${entry.name}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  bundles.push({ name: entry.name, createdAt: manifest.createdAt });
}

const { retained, candidates } = planBackupRetention(bundles);
console.log('Read-only retention plan (UTC): retain newest 7 daily, 4 weekly, and 12 monthly bundles.');
console.log(`Verified bundles: ${bundles.length}; retained: ${retained.length}; removal candidates: ${candidates.length}.`);
for (const bundle of retained)
  console.log(`KEEP\t${bundle.createdAt}\t${bundle.name}\t${bundle.keepReasons.join(', ')}`);
for (const bundle of candidates)
  console.log(`REVIEW\t${bundle.createdAt}\t${bundle.name}\tno retention tier selected`);
console.log('No files were moved or deleted. Review candidates and backups before any manual removal.');
