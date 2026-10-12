CREATE TRIGGER certificate_payload_shape_insert
BEFORE INSERT ON certificates
WHEN json_valid(NEW.payload_json) = 0
  OR json_type(NEW.payload_json) IS NOT 'object'
  OR json_type(NEW.payload_json, '$.confirmedName') IS NOT 'text'
  OR length(trim(json_extract(NEW.payload_json, '$.confirmedName'))) = 0
  OR json_type(NEW.payload_json, '$.courseTitle') IS NOT 'text'
  OR length(trim(json_extract(NEW.payload_json, '$.courseTitle'))) = 0
  OR json_type(NEW.payload_json, '$.workloadMinutes') IS NOT 'integer'
  OR json_extract(NEW.payload_json, '$.workloadMinutes') < 1
  OR json_type(NEW.payload_json, '$.issuerName') IS NOT 'text'
  OR length(trim(json_extract(NEW.payload_json, '$.issuerName'))) = 0
  OR json_type(NEW.payload_json, '$.completedAt') IS NOT 'text'
  OR julianday(json_extract(NEW.payload_json, '$.completedAt')) IS NULL
  OR json_type(NEW.payload_json, '$.publicCode') IS NOT 'text'
  OR json_extract(NEW.payload_json, '$.publicCode') IS NOT NEW.public_code
  OR json_type(NEW.payload_json, '$.issuedAt') IS NOT 'text'
  OR julianday(json_extract(NEW.payload_json, '$.issuedAt')) IS NULL
  OR json_type(NEW.payload_json, '$.status') IS NOT 'text'
  OR json_extract(NEW.payload_json, '$.status') IS NOT 'valid'
BEGIN
  SELECT RAISE(ABORT, 'invalid certificate payload snapshot');
END;