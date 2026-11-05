DROP TRIGGER category_fields_valid_on_insert;
DROP TRIGGER category_fields_valid_on_update;

CREATE TRIGGER category_fields_valid_on_insert
BEFORE INSERT ON categories
WHEN typeof(NEW.slug) != 'text'
  OR length(NEW.slug) < 3
  OR length(NEW.slug) > 100
  OR NEW.slug GLOB '*[^a-z0-9-]*'
  OR NEW.slug GLOB '-*'
  OR NEW.slug GLOB '*-'
  OR NEW.slug GLOB '*--*'
  OR typeof(NEW.name) != 'text'
  OR length(trim(NEW.name,
    char(9) || char(10) || char(11) || char(12) || char(13) || char(32) ||
    char(160) || char(5760) || char(8192) || char(8193) || char(8194) ||
    char(8195) || char(8196) || char(8197) || char(8198) || char(8199) ||
    char(8200) || char(8201) || char(8202) || char(8232) || char(8233) ||
    char(8239) || char(8287) || char(12288) || char(65279))) < 1
  OR length(NEW.name) + (
    SELECT count(*) FROM (
      WITH RECURSIVE char_positions(position) AS (
        SELECT 1
        UNION ALL
        SELECT position + 1 FROM char_positions
        WHERE position < length(NEW.name)
      )
      SELECT unicode(substr(NEW.name, position, 1)) AS codepoint
      FROM char_positions
    )
    WHERE codepoint > 65535
  ) > 100
  OR typeof(NEW.description) != 'text'
  OR length(NEW.description) > 1000
BEGIN
  SELECT RAISE(ABORT, 'invalid category fields');
END;

CREATE TRIGGER category_fields_valid_on_update
BEFORE UPDATE OF slug, name, description ON categories
WHEN typeof(NEW.slug) != 'text'
  OR length(NEW.slug) < 3
  OR length(NEW.slug) > 100
  OR NEW.slug GLOB '*[^a-z0-9-]*'
  OR NEW.slug GLOB '-*'
  OR NEW.slug GLOB '*-'
  OR NEW.slug GLOB '*--*'
  OR typeof(NEW.name) != 'text'
  OR length(trim(NEW.name,
    char(9) || char(10) || char(11) || char(12) || char(13) || char(32) ||
    char(160) || char(5760) || char(8192) || char(8193) || char(8194) ||
    char(8195) || char(8196) || char(8197) || char(8198) || char(8199) ||
    char(8200) || char(8201) || char(8202) || char(8232) || char(8233) ||
    char(8239) || char(8287) || char(12288) || char(65279))) < 1
  OR length(NEW.name) + (
    SELECT count(*) FROM (
      WITH RECURSIVE char_positions(position) AS (
        SELECT 1
        UNION ALL
        SELECT position + 1 FROM char_positions
        WHERE position < length(NEW.name)
      )
      SELECT unicode(substr(NEW.name, position, 1)) AS codepoint
      FROM char_positions
    )
    WHERE codepoint > 65535
  ) > 100
  OR typeof(NEW.description) != 'text'
  OR length(NEW.description) > 1000
BEGIN
  SELECT RAISE(ABORT, 'invalid category fields');
END;
