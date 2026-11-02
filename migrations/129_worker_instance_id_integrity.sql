CREATE TRIGGER worker_instance_id_valid_on_insert
BEFORE INSERT ON worker_instances
WHEN length(trim(NEW.instance_id)) = 0
BEGIN
  SELECT RAISE(ABORT, 'worker instance ID is required');
END;

CREATE TRIGGER worker_instance_id_valid_on_update
BEFORE UPDATE OF instance_id ON worker_instances
WHEN length(trim(NEW.instance_id)) = 0
BEGIN
  SELECT RAISE(ABORT, 'worker instance ID is required');
END;
