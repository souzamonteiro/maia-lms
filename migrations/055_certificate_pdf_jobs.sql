ALTER TABLE certificates ADD COLUMN pdf_status TEXT NOT NULL DEFAULT 'UNAVAILABLE'
  CHECK (pdf_status IN ('UNAVAILABLE','PENDING','READY','FAILED'));
ALTER TABLE certificates ADD COLUMN pdf_storage_key TEXT;
ALTER TABLE certificates ADD COLUMN pdf_error TEXT;

CREATE TRIGGER certificate_pdf_state_transition
BEFORE UPDATE OF pdf_status ON certificates
WHEN NOT (
  OLD.pdf_status=NEW.pdf_status
  OR (OLD.pdf_status='PENDING' AND NEW.pdf_status IN ('READY','FAILED'))
  OR (OLD.pdf_status='FAILED' AND NEW.pdf_status IN ('PENDING','READY'))
)
BEGIN
  SELECT RAISE(ABORT, 'invalid certificate PDF state transition');
END;

CREATE TRIGGER certificate_pdf_key_immutable
BEFORE UPDATE OF pdf_storage_key ON certificates
WHEN OLD.pdf_storage_key IS NOT NULL AND NEW.pdf_storage_key IS NOT OLD.pdf_storage_key
BEGIN
  SELECT RAISE(ABORT, 'certificate PDF storage key is immutable');
END;
