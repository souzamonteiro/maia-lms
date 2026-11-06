import type { Request, Response } from 'express';
import { afterEach, expect, it, vi } from 'vitest';
import { errorHandler } from './middleware/error-handler.js';
import { safeErrorLabel } from './safe-logging.js';

afterEach(() => vi.restoreAllMocks());

it('retains allowlisted technical error codes without including raw messages', () => {
  const error = Object.assign(new Error('private@example.com token=secret'), {
    code: 'SQLITE_BUSY',
  });
  expect(safeErrorLabel(error)).toBe('Error (SQLITE_BUSY)');
  expect(safeErrorLabel(Object.assign(new Error('secret path'), { code: 'secret path' })))
    .toBe('Error');
  expect(safeErrorLabel({ message: 'private@example.com' })).toBe('UnknownError');
});

it('logs unexpected API failures without messages, stacks, query values or correlation IDs', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const error = new Error('private@example.com token=secret');
  error.stack = 'Error: private@example.com token=secret';
  const req = {
    method: 'GET',
    route: { path: '/api/v1/courses/:id' },
    url: '/api/v1/courses/course-123?token=secret',
    headers: { 'x-correlation-id': 'private@example.com' },
  } as unknown as Request;
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const res = { status } as unknown as Response;

  errorHandler(error, req, res, vi.fn());

  expect(status).toHaveBeenCalledWith(500);
  expect(json).toHaveBeenCalledWith({
    error: 'Internal server error',
    code: 'API_INTERNAL_ERROR',
  });
  expect(log).toHaveBeenCalledExactlyOnceWith('Unexpected API error', {
    method: 'GET',
    route: '/api/v1/courses/:id',
    error: 'Error',
  });
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/private@example\.com|token=secret|course-123/);
});
