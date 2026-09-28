CREATE TABLE video_uploads (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL REFERENCES users(id),
 course_id TEXT NOT NULL REFERENCES courses(id),
 filename TEXT NOT NULL,
 size INTEGER NOT NULL CHECK(size > 0 AND size <= 2147483648),
 offset INTEGER NOT NULL DEFAULT 0 CHECK(offset >= 0 AND offset <= size),
 status TEXT NOT NULL DEFAULT 'UPLOADING' CHECK(status IN ('UPLOADING','QUEUED','PROCESSING','READY','FAILED','CANCELLED')),
 output_key TEXT,
 poster_key TEXT,
 duration REAL,
 error TEXT,
 lease TEXT,
 heartbeat TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX video_upload_owner ON video_uploads(owner_id, status);
CREATE TABLE video_chunks (
 upload_id TEXT NOT NULL REFERENCES video_uploads(id),
 offset INTEGER NOT NULL,
 size INTEGER NOT NULL,
 storage_key TEXT NOT NULL UNIQUE,
 sha256 TEXT NOT NULL,
 PRIMARY KEY(upload_id, offset)
);
ALTER TABLE lessons ADD COLUMN video_id TEXT REFERENCES video_uploads(id);
