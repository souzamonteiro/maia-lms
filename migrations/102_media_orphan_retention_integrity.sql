CREATE TRIGGER video_orphan_retention_insert_integrity
BEFORE INSERT ON video_uploads
WHEN (
  NEW.orphaned_since IS NOT NULL
  AND (NEW.status != 'READY' OR julianday(NEW.orphaned_since) IS NULL)
) OR (
  NEW.collection_started_at IS NOT NULL
  AND (
    NEW.status != 'READY'
    OR NEW.orphaned_since IS NULL
    OR julianday(NEW.collection_started_at) IS NULL
  )
)
BEGIN
  SELECT RAISE(ABORT, 'media retention state is invalid');
END;

CREATE TRIGGER video_orphan_retention_update_integrity
BEFORE UPDATE OF status, orphaned_since, collection_started_at ON video_uploads
WHEN (
  NEW.orphaned_since IS NOT NULL
  AND (NEW.status != 'READY' OR julianday(NEW.orphaned_since) IS NULL)
) OR (
  NEW.collection_started_at IS NOT NULL
  AND (
    NEW.status != 'READY'
    OR NEW.orphaned_since IS NULL
    OR julianday(NEW.collection_started_at) IS NULL
  )
)
BEGIN
  SELECT RAISE(ABORT, 'media retention state is invalid');
END;
