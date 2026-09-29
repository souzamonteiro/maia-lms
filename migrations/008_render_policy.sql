-- Existing plain and Markdown lessons already use policy 1; preserve their bodies.
ALTER TABLE lessons ADD COLUMN render_policy_version INTEGER NOT NULL DEFAULT 1
  CHECK (render_policy_version > 0 AND typeof(render_policy_version) = 'integer');
