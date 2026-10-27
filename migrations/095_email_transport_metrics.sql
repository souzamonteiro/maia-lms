CREATE TABLE email_transport_metrics_daily (
  metric_date TEXT NOT NULL CHECK (
    length(metric_date)=10
    AND metric_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
    AND strftime('%Y-%m-%d',metric_date) IS NOT NULL
    AND strftime('%Y-%m-%d',metric_date)=metric_date
  ),
  outcome TEXT NOT NULL CHECK (outcome IN ('accepted','failed')),
  attempt_count INTEGER NOT NULL CHECK (typeof(attempt_count)='integer' AND attempt_count>0),
  duration_total_ms INTEGER NOT NULL CHECK (typeof(duration_total_ms)='integer' AND duration_total_ms>=0),
  PRIMARY KEY(metric_date,outcome)
);
