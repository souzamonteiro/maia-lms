import session from 'express-session';
import type Database from 'better-sqlite3';

export class SQLiteSessionStore extends session.Store {
  constructor(private db: Database.Database) {
    super();
  }
  get(sid: string, callback: (err: unknown, session?: session.SessionData | null) => void): void {
    try {
      const row = this.db
        .prepare('SELECT data FROM http_sessions WHERE sid = ? AND expires_at > ?')
        .get(sid, Date.now()) as { data: string } | undefined;
      callback(null, row ? JSON.parse(row.data) : null);
    } catch (error) {
      callback(error);
    }
  }
  set(sid: string, data: session.SessionData, callback?: (err?: unknown) => void): void {
    try {
      const expiry = data.cookie.expires
        ? new Date(data.cookie.expires).getTime()
        : Date.now() + 7 * 86400000;
      this.db.transaction(() => {
        this.db.prepare('DELETE FROM http_sessions WHERE expires_at <= ?').run(Date.now());
        this.db
          .prepare(
            'INSERT INTO http_sessions (sid, data, expires_at) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at',
          )
          .run(sid, JSON.stringify(data), expiry);
      })();
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }
  destroy(sid: string, callback?: (err?: unknown) => void): void {
    try {
      this.db.prepare('DELETE FROM http_sessions WHERE sid = ?').run(sid);
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }
  touch(sid: string, data: session.SessionData, callback?: (err?: unknown) => void): void {
    this.set(sid, data, callback);
  }
}
