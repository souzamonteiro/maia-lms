CREATE TABLE playback_metrics_daily (
  metric_date TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('mp4','poster','caption','hls_playlist','hls_segment')),
  status_class INTEGER NOT NULL CHECK (status_class BETWEEN 2 AND 5),
  request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count > 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(metric_date,resource_type,status_class)
);