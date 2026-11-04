CREATE TRIGGER home_settings_singleton_insert_only_when_empty
BEFORE INSERT ON home_settings
WHEN EXISTS (SELECT 1 FROM home_settings)
BEGIN
  SELECT RAISE(ABORT, 'home settings singleton already exists');
END;
