CREATE TRIGGER video_upload_byte_range_valid_on_insert
BEFORE INSERT ON video_uploads
WHEN typeof(NEW.size) != 'integer'
  OR NEW.size < 1
  OR NEW.size > 2147483648
  OR typeof(NEW.offset) != 'integer'
  OR NEW.offset < 0
  OR NEW.offset > NEW.size
BEGIN
  SELECT RAISE(ABORT, 'video upload byte range is invalid');
END;

CREATE TRIGGER video_upload_byte_range_valid_on_update
BEFORE UPDATE OF size, offset ON video_uploads
WHEN typeof(NEW.size) != 'integer'
  OR NEW.size < 1
  OR NEW.size > 2147483648
  OR typeof(NEW.offset) != 'integer'
  OR NEW.offset < 0
  OR NEW.offset > NEW.size
  OR EXISTS (
    SELECT 1 FROM video_chunks c
    WHERE c.upload_id = OLD.id
      AND c.offset + c.size > NEW.size
  )
BEGIN
  SELECT RAISE(ABORT, 'video upload byte range is invalid');
END;

CREATE TRIGGER video_chunk_byte_range_valid_on_insert
BEFORE INSERT ON video_chunks
WHEN typeof(NEW.offset) != 'integer'
  OR NEW.offset < 0
  OR typeof(NEW.size) != 'integer'
  OR NEW.size < 1
  OR NOT EXISTS (
    SELECT 1 FROM video_uploads v
    WHERE v.id = NEW.upload_id
      AND NEW.offset <= v.size
      AND NEW.size <= v.size - NEW.offset
  )
BEGIN
  SELECT RAISE(ABORT, 'video chunk byte range is invalid');
END;

CREATE TRIGGER video_chunk_byte_range_valid_on_update
BEFORE UPDATE OF upload_id, offset, size ON video_chunks
WHEN typeof(NEW.offset) != 'integer'
  OR NEW.offset < 0
  OR typeof(NEW.size) != 'integer'
  OR NEW.size < 1
  OR NOT EXISTS (
    SELECT 1 FROM video_uploads v
    WHERE v.id = NEW.upload_id
      AND NEW.offset <= v.size
      AND NEW.size <= v.size - NEW.offset
  )
BEGIN
  SELECT RAISE(ABORT, 'video chunk byte range is invalid');
END;
