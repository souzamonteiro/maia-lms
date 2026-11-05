CREATE TRIGGER instructor_profile_website_https_on_insert
BEFORE INSERT ON instructor_profiles
WHEN NEW.website_url IS NOT NULL
  AND lower(substr(NEW.website_url, 1, 8)) != 'https://'
BEGIN
  SELECT RAISE(ABORT, 'instructor profile website URL must use HTTPS');
END;

CREATE TRIGGER instructor_profile_website_https_on_update
BEFORE UPDATE OF website_url ON instructor_profiles
WHEN NEW.website_url IS NOT NULL
  AND lower(substr(NEW.website_url, 1, 8)) != 'https://'
BEGIN
  SELECT RAISE(ABORT, 'instructor profile website URL must use HTTPS');
END;
