CREATE TRIGGER video_chunk_digest_valid_on_insert
BEFORE INSERT ON video_chunks
WHEN typeof(NEW.sha256) != 'text'
  OR length(NEW.sha256) != 64
  OR instr(NEW.sha256, char(0)) > 0
  OR NEW.sha256 GLOB '*[^0-9a-f]*'
BEGIN
  SELECT RAISE(ABORT, 'video chunk digest is invalid');
END;

CREATE TRIGGER video_chunk_digest_valid_on_update
BEFORE UPDATE OF sha256 ON video_chunks
WHEN typeof(NEW.sha256) != 'text'
  OR length(NEW.sha256) != 64
  OR instr(NEW.sha256, char(0)) > 0
  OR NEW.sha256 GLOB '*[^0-9a-f]*'
BEGIN
  SELECT RAISE(ABORT, 'video chunk digest is invalid');
END;
