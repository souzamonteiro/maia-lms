CREATE TRIGGER home_settings_identity_immutable
BEFORE UPDATE OF id ON home_settings
WHEN NEW.id IS NOT OLD.id
BEGIN
  SELECT RAISE(ABORT, 'home settings identity is immutable');
END;
