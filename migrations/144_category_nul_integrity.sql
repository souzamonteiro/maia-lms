CREATE TRIGGER category_text_nul_valid_on_insert
BEFORE INSERT ON categories
WHEN instr(NEW.name, char(0)) > 0
  OR instr(NEW.description, char(0)) > 0
BEGIN
  SELECT RAISE(ABORT, 'invalid category fields');
END;

CREATE TRIGGER category_text_nul_valid_on_update
BEFORE UPDATE OF name, description ON categories
WHEN instr(NEW.name, char(0)) > 0
  OR instr(NEW.description, char(0)) > 0
BEGIN
  SELECT RAISE(ABORT, 'invalid category fields');
END;
