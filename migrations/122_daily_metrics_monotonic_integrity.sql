CREATE TRIGGER playback_metric_dimensions_immutable
BEFORE UPDATE OF metric_date, resource_type, status_class ON playback_metrics_daily
WHEN OLD.metric_date IS NOT NEW.metric_date
  OR OLD.resource_type IS NOT NEW.resource_type
  OR OLD.status_class IS NOT NEW.status_class
BEGIN
  SELECT RAISE(ABORT, 'playback metric dimensions are immutable');
END;

CREATE TRIGGER playback_metric_counters_monotonic
BEFORE UPDATE OF request_count, duration_count, duration_total_ms, updated_at
ON playback_metrics_daily
WHEN NEW.request_count < OLD.request_count
  OR NEW.duration_count < OLD.duration_count
  OR NEW.duration_total_ms < OLD.duration_total_ms
  OR julianday(NEW.updated_at) IS NULL
BEGIN
  SELECT RAISE(ABORT, 'playback metric counters or timestamp are invalid');
END;

CREATE TRIGGER playback_metric_timestamp_valid_on_insert
BEFORE INSERT ON playback_metrics_daily
WHEN julianday(NEW.updated_at) IS NULL
BEGIN
  SELECT RAISE(ABORT, 'playback metric timestamp is invalid');
END;

CREATE TRIGGER email_metric_dimensions_immutable
BEFORE UPDATE OF metric_date, outcome ON email_transport_metrics_daily
WHEN OLD.metric_date IS NOT NEW.metric_date
  OR OLD.outcome IS NOT NEW.outcome
BEGIN
  SELECT RAISE(ABORT, 'email metric dimensions are immutable');
END;

CREATE TRIGGER email_metric_counters_monotonic
BEFORE UPDATE OF attempt_count, duration_total_ms ON email_transport_metrics_daily
WHEN NEW.attempt_count < OLD.attempt_count
  OR NEW.duration_total_ms < OLD.duration_total_ms
BEGIN
  SELECT RAISE(ABORT, 'email metric counters cannot decrease');
END;

CREATE TRIGGER reconciliation_metric_dimensions_immutable
BEFORE UPDATE OF metric_date, outcome ON payment_reconciliation_metrics_daily
WHEN OLD.metric_date IS NOT NEW.metric_date
  OR OLD.outcome IS NOT NEW.outcome
BEGIN
  SELECT RAISE(ABORT, 'reconciliation metric dimensions are immutable');
END;

CREATE TRIGGER reconciliation_metric_counters_monotonic
BEFORE UPDATE OF check_count, duration_total_ms ON payment_reconciliation_metrics_daily
WHEN NEW.check_count < OLD.check_count
  OR NEW.duration_total_ms < OLD.duration_total_ms
BEGIN
  SELECT RAISE(ABORT, 'reconciliation metric counters cannot decrease');
END;
