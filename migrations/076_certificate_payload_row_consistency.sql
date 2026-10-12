CREATE TRIGGER certificate_payload_matches_row
BEFORE INSERT ON certificates
WHEN json_extract(NEW.payload_json, '$.confirmedName') IS NOT NEW.confirmed_name
  OR json_extract(NEW.payload_json, '$.issuedAt') IS NOT NEW.issued_at
BEGIN
  SELECT RAISE(ABORT, 'certificate payload does not match row snapshot');
END;