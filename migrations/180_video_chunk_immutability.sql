DROP TRIGGER video_chunk_digest_valid_on_update;

CREATE TRIGGER video_chunk_identity_immutable
BEFORE UPDATE ON video_chunks
WHEN NEW.upload_id IS NOT OLD.upload_id
  OR NEW.offset IS NOT OLD.offset
  OR NEW.size IS NOT OLD.size
  OR NEW.storage_key IS NOT OLD.storage_key
  OR NEW.sha256 IS NOT OLD.sha256
BEGIN
  SELECT RAISE(ABORT, 'video chunk identity is immutable');
END;
