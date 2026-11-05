CREATE TRIGGER category_description_utf16_length_on_insert
BEFORE INSERT ON categories
WHEN length(NEW.description) + (
  SELECT count(*) FROM (
    WITH RECURSIVE char_positions(position) AS (
      SELECT 1
      UNION ALL
      SELECT position + 1 FROM char_positions
      WHERE position < length(NEW.description)
    )
    SELECT unicode(substr(NEW.description, position, 1)) AS codepoint
    FROM char_positions
  )
  WHERE codepoint > 65535
) > 1000
BEGIN
  SELECT RAISE(ABORT, 'invalid category fields');
END;

CREATE TRIGGER category_description_utf16_length_on_update
BEFORE UPDATE OF description ON categories
WHEN length(NEW.description) + (
  SELECT count(*) FROM (
    WITH RECURSIVE char_positions(position) AS (
      SELECT 1
      UNION ALL
      SELECT position + 1 FROM char_positions
      WHERE position < length(NEW.description)
    )
    SELECT unicode(substr(NEW.description, position, 1)) AS codepoint
    FROM char_positions
  )
  WHERE codepoint > 65535
) > 1000
BEGIN
  SELECT RAISE(ABORT, 'invalid category fields');
END;
