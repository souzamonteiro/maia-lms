CREATE TRIGGER playback_metric_duration_delta_consistent
BEFORE UPDATE OF request_count, duration_count, duration_total_ms
ON playback_metrics_daily
WHEN NEW.duration_count - OLD.duration_count > NEW.request_count - OLD.request_count
  OR (
    NEW.duration_count = OLD.duration_count
    AND NEW.duration_total_ms > OLD.duration_total_ms
  )
BEGIN
  SELECT RAISE(ABORT, 'playback duration totals require measured samples');
END;
