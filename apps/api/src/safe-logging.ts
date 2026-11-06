const safeErrorNames = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'ReferenceError',
  'SqliteError',
  'ZodError',
  'AppError',
]);

const safeErrorCodes = new Set([
  'EACCES',
  'EBUSY',
  'EEXIST',
  'EIO',
  'EINVAL',
  'EISDIR',
  'ENOENT',
  'ENOSPC',
  'ENOTDIR',
  'EPERM',
  'EROFS',
  'SQLITE_BUSY',
  'SQLITE_CANTOPEN',
  'SQLITE_CONSTRAINT',
  'SQLITE_CORRUPT',
  'SQLITE_FULL',
  'SQLITE_IOERR',
  'SQLITE_LOCKED',
  'SQLITE_READONLY',
]);

export function safeErrorLabel(error: unknown): string {
  if (!(error instanceof Error)) return 'UnknownError';

  const name = safeErrorNames.has(error.name) ? error.name : 'UnknownError';
  const code = 'code' in error && typeof error.code === 'string' && safeErrorCodes.has(error.code)
    ? error.code
    : undefined;
  return code ? `${name} (${code})` : name;
}
