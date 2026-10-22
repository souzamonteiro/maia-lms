CREATE TABLE playback_metrics_daily_new (
  metric_date TEXT NOT NULL CHECK (
    length(metric_date)=10
    AND metric_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
    AND strftime('%Y-%m-%d',metric_date)=metric_date
  ),
  resource_type TEXT NOT NULL CHECK (resource_type IN ('mp4','poster','caption','hls_playlist','hls_segment')),
  status_class INTEGER NOT NULL CHECK (
    typeof(status_class)='integer' AND status_class BETWEEN 2 AND 5
  ),
  request_count INTEGER NOT NULL DEFAULT 1 CHECK (
    typeof(request_count)='integer' AND request_count > 0
  ),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(metric_date,resource_type,status_class)
);

INSERT INTO playback_metrics_daily_new(
  metric_date,resource_type,status_class,request_count,updated_at
)
SELECT metric_date,resource_type,status_class,request_count,updated_at
FROM playback_metrics_daily;

DROP TABLE playback_metrics_daily;
ALTER TABLE playback_metrics_daily_new RENAME TO playback_metrics_daily;
