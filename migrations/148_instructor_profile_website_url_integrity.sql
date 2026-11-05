CREATE TRIGGER instructor_profile_website_url_valid_on_insert
BEFORE INSERT ON instructor_profiles
WHEN NEW.website_url IS NOT NULL AND (
  typeof(NEW.website_url) != 'text'
  OR instr(NEW.website_url, char(0)) > 0
  OR length(NEW.website_url) + (
    SELECT count(*) FROM (
      WITH RECURSIVE char_positions(position) AS (
        SELECT 1
        UNION ALL
        SELECT position + 1 FROM char_positions
        WHERE position < length(NEW.website_url)
      )
      SELECT unicode(substr(NEW.website_url, position, 1)) AS codepoint
      FROM char_positions
    )
    WHERE codepoint > 65535
  ) > 500
)
BEGIN
  SELECT RAISE(ABORT, 'invalid instructor profile website URL');
END;

CREATE TRIGGER instructor_profile_website_url_valid_on_update
BEFORE UPDATE OF website_url ON instructor_profiles
WHEN NEW.website_url IS NOT NULL AND (
  typeof(NEW.website_url) != 'text'
  OR instr(NEW.website_url, char(0)) > 0
  OR length(NEW.website_url) + (
    SELECT count(*) FROM (
      WITH RECURSIVE char_positions(position) AS (
        SELECT 1
        UNION ALL
        SELECT position + 1 FROM char_positions
        WHERE position < length(NEW.website_url)
      )
      SELECT unicode(substr(NEW.website_url, position, 1)) AS codepoint
      FROM char_positions
    )
    WHERE codepoint > 65535
  ) > 500
)
BEGIN
  SELECT RAISE(ABORT, 'invalid instructor profile website URL');
END;
