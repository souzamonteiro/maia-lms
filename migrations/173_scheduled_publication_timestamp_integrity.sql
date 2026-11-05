CREATE TRIGGER scheduled_publication_timestamp_valid_on_insert
BEFORE INSERT ON courses
WHEN NEW.scheduled_publication_at IS NOT NULL AND (
  typeof(NEW.scheduled_publication_at) != 'text'
  OR instr(NEW.scheduled_publication_at, char(0)) > 0
  OR julianday(NEW.scheduled_publication_at) IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'invalid scheduled publication timestamp');
END;

CREATE TRIGGER scheduled_publication_timestamp_valid_on_update
BEFORE UPDATE OF scheduled_publication_at ON courses
WHEN NEW.scheduled_publication_at IS NOT NULL AND (
  typeof(NEW.scheduled_publication_at) != 'text'
  OR instr(NEW.scheduled_publication_at, char(0)) > 0
  OR julianday(NEW.scheduled_publication_at) IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'invalid scheduled publication timestamp');
END;
