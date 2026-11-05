CREATE TRIGGER instructor_profile_text_valid_on_insert
BEFORE INSERT ON instructor_profiles
WHEN typeof(NEW.display_name) != 'text'
  OR length(trim(NEW.display_name,
    char(9) || char(10) || char(11) || char(12) || char(13) || char(32) ||
    char(160) || char(5760) || char(8192) || char(8193) || char(8194) ||
    char(8195) || char(8196) || char(8197) || char(8198) || char(8199) ||
    char(8200) || char(8201) || char(8202) || char(8232) || char(8233) ||
    char(8239) || char(8287) || char(12288) || char(65279))) < 1
  OR length(NEW.display_name) + (
    SELECT count(*) FROM (
      WITH RECURSIVE char_positions(position) AS (
        SELECT 1
        UNION ALL
        SELECT position + 1 FROM char_positions
        WHERE position < length(NEW.display_name)
      )
      SELECT unicode(substr(NEW.display_name, position, 1)) AS codepoint
      FROM char_positions
    )
    WHERE codepoint > 65535
  ) > 100
  OR instr(NEW.display_name, char(0)) > 0
  OR typeof(NEW.bio) != 'text'
  OR length(NEW.bio) + (
    SELECT count(*) FROM (
      WITH RECURSIVE char_positions(position) AS (
        SELECT 1
        UNION ALL
        SELECT position + 1 FROM char_positions
        WHERE position < length(NEW.bio)
      )
      SELECT unicode(substr(NEW.bio, position, 1)) AS codepoint
      FROM char_positions
    )
    WHERE codepoint > 65535
  ) > 5000
  OR instr(NEW.bio, char(0)) > 0
BEGIN
  SELECT RAISE(ABORT, 'invalid instructor profile text');
END;

CREATE TRIGGER instructor_profile_text_valid_on_update
BEFORE UPDATE OF display_name, bio ON instructor_profiles
WHEN typeof(NEW.display_name) != 'text'
  OR length(trim(NEW.display_name,
    char(9) || char(10) || char(11) || char(12) || char(13) || char(32) ||
    char(160) || char(5760) || char(8192) || char(8193) || char(8194) ||
    char(8195) || char(8196) || char(8197) || char(8198) || char(8199) ||
    char(8200) || char(8201) || char(8202) || char(8232) || char(8233) ||
    char(8239) || char(8287) || char(12288) || char(65279))) < 1
  OR length(NEW.display_name) + (
    SELECT count(*) FROM (
      WITH RECURSIVE char_positions(position) AS (
        SELECT 1
        UNION ALL
        SELECT position + 1 FROM char_positions
        WHERE position < length(NEW.display_name)
      )
      SELECT unicode(substr(NEW.display_name, position, 1)) AS codepoint
      FROM char_positions
    )
    WHERE codepoint > 65535
  ) > 100
  OR instr(NEW.display_name, char(0)) > 0
  OR typeof(NEW.bio) != 'text'
  OR length(NEW.bio) + (
    SELECT count(*) FROM (
      WITH RECURSIVE char_positions(position) AS (
        SELECT 1
        UNION ALL
        SELECT position + 1 FROM char_positions
        WHERE position < length(NEW.bio)
      )
      SELECT unicode(substr(NEW.bio, position, 1)) AS codepoint
      FROM char_positions
    )
    WHERE codepoint > 65535
  ) > 5000
  OR instr(NEW.bio, char(0)) > 0
BEGIN
  SELECT RAISE(ABORT, 'invalid instructor profile text');
END;
