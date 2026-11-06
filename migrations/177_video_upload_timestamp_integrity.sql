CREATE TRIGGER video_upload_timestamps_valid_on_insert
BEFORE INSERT ON video_uploads
WHEN typeof(NEW.created_at) != 'text'
  OR instr(NEW.created_at, char(0)) > 0
  OR julianday(NEW.created_at) IS NULL
  OR (
    NEW.last_activity_at IS NOT NULL AND (
      typeof(NEW.last_activity_at) != 'text'
      OR instr(NEW.last_activity_at, char(0)) > 0
      OR julianday(NEW.last_activity_at) IS NULL
    )
  )
  OR (
    NEW.heartbeat IS NOT NULL AND (
      typeof(NEW.heartbeat) != 'text'
      OR instr(NEW.heartbeat, char(0)) > 0
      OR julianday(NEW.heartbeat) IS NULL
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'video upload timestamps are invalid');
END;

CREATE TRIGGER video_upload_timestamps_valid_on_update
BEFORE UPDATE OF created_at, last_activity_at, heartbeat ON video_uploads
WHEN typeof(NEW.created_at) != 'text'
  OR instr(NEW.created_at, char(0)) > 0
  OR julianday(NEW.created_at) IS NULL
  OR typeof(NEW.last_activity_at) != 'text'
  OR instr(NEW.last_activity_at, char(0)) > 0
  OR julianday(NEW.last_activity_at) IS NULL
  OR (
    NEW.heartbeat IS NOT NULL AND (
      typeof(NEW.heartbeat) != 'text'
      OR instr(NEW.heartbeat, char(0)) > 0
      OR julianday(NEW.heartbeat) IS NULL
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'video upload timestamps are invalid');
END;
