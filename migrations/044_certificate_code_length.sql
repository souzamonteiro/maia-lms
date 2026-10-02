CREATE TRIGGER certificate_public_code_length_insert
BEFORE INSERT ON certificates
WHEN length(trim(NEW.public_code)) < 32
BEGIN
  SELECT RAISE(ABORT, 'certificate public code is too short');
END;

CREATE TRIGGER certificate_public_code_length_update
BEFORE UPDATE OF public_code ON certificates
WHEN length(trim(NEW.public_code)) < 32
BEGIN
  SELECT RAISE(ABORT, 'certificate public code is too short');
END;