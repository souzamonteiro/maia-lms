ALTER TABLE playback_metrics_daily ADD COLUMN duration_count INTEGER NOT NULL DEFAULT 0
  CHECK (typeof(duration_count)='integer' AND duration_count BETWEEN 0 AND request_count);
ALTER TABLE playback_metrics_daily ADD COLUMN duration_total_ms INTEGER NOT NULL DEFAULT 0
  CHECK (typeof(duration_total_ms)='integer' AND duration_total_ms>=0
    AND (duration_count>0 OR duration_total_ms=0));
