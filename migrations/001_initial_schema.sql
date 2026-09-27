-- Migration 001: Initial schema for Maia LMS
-- All timestamps stored as ISO 8601 strings
-- All IDs are UUID strings generated in the application layer
-- Money stored as integer minor units (e.g. centavos for BRL)

-- ============================================================
-- Users and authentication
-- ============================================================

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'learner' CHECK (role IN ('learner', 'author', 'admin', 'worker')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  locale TEXT NOT NULL DEFAULT 'pt-BR',
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(hash)
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_hash ON sessions(hash);

-- Email verification and password-reset tokens
CREATE TABLE email_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('verify', 'reset')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- TOTP secrets for admin 2FA
CREATE TABLE totp_secrets (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  secret TEXT NOT NULL,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Courses
-- ============================================================

CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  access_mode TEXT NOT NULL DEFAULT 'ENROLLED_FREE'
    CHECK (access_mode IN ('OPEN_FREE', 'ENROLLED_FREE', 'PAID')),
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED')),
  locale TEXT NOT NULL DEFAULT 'pt-BR',
  author_id TEXT NOT NULL REFERENCES users(id),
  current_revision_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_courses_slug ON courses(slug);
CREATE INDEX idx_courses_status ON courses(status);
CREATE INDEX idx_courses_author_id ON courses(author_id);

-- Course revisions are immutable once published
CREATE TABLE course_revisions (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  learning_outcomes TEXT NOT NULL DEFAULT '',
  image_alt TEXT NOT NULL DEFAULT '',
  image_key TEXT,
  trailer_media_id TEXT,
  level TEXT CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  duration_minutes INTEGER,
  policy_json TEXT NOT NULL DEFAULT '{}',
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_course_revisions_course_id ON course_revisions(course_id);

-- Modules are ordered sections within a revision
CREATE TABLE modules (
  id TEXT PRIMARY KEY,
  revision_id TEXT NOT NULL REFERENCES course_revisions(id),
  sort_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  UNIQUE(revision_id, sort_order)
);

CREATE INDEX idx_modules_revision_id ON modules(revision_id);

-- Lessons belong to modules
CREATE TABLE lessons (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL REFERENCES modules(id),
  sort_order INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'article' CHECK (kind IN ('video', 'article', 'mixed')),
  media_id TEXT,
  body TEXT,
  is_required INTEGER NOT NULL DEFAULT 1 CHECK (is_required IN (0, 1)),
  is_preview INTEGER NOT NULL DEFAULT 0 CHECK (is_preview IN (0, 1)),
  UNIQUE(module_id, sort_order)
);

CREATE INDEX idx_lessons_module_id ON lessons(module_id);

-- ============================================================
-- Media assets
-- ============================================================

CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('video', 'attachment', 'image')),
  storage_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PROCESSING', 'READY', 'FAILED')),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  retry_count INTEGER NOT NULL DEFAULT 0,
  status_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_assets_owner_id ON assets(owner_id);
CREATE INDEX idx_assets_status ON assets(status);

-- ============================================================
-- Pricing
-- ============================================================

CREATE TABLE prices (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  currency TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  active_from TEXT NOT NULL,
  active_to TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_prices_course_id ON prices(course_id);

-- ============================================================
-- Enrollments and access control
-- ============================================================

CREATE TABLE enrollments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  course_id TEXT NOT NULL REFERENCES courses(id),
  revision_id TEXT NOT NULL REFERENCES course_revisions(id),
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'revoked')),
  enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, course_id)
);

CREATE INDEX idx_enrollments_user_id ON enrollments(user_id);
CREATE INDEX idx_enrollments_course_id ON enrollments(course_id);

CREATE TABLE entitlements (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id),
  source_type TEXT NOT NULL CHECK (source_type IN ('free', 'order', 'admin')),
  source_id TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_entitlements_enrollment_id ON entitlements(enrollment_id);

-- ============================================================
-- Progress tracking
-- ============================================================

CREATE TABLE lesson_progress (
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id),
  lesson_id TEXT NOT NULL REFERENCES lessons(id),
  position_seconds INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (enrollment_id, lesson_id)
);

-- ============================================================
-- Quizzes and assessments
-- ============================================================

CREATE TABLE quizzes (
  id TEXT PRIMARY KEY,
  revision_id TEXT NOT NULL REFERENCES course_revisions(id),
  lesson_id TEXT REFERENCES lessons(id),
  pass_percent INTEGER NOT NULL DEFAULT 70 CHECK (pass_percent BETWEEN 1 AND 100),
  max_attempts INTEGER NOT NULL DEFAULT 3,
  randomize_questions INTEGER NOT NULL DEFAULT 0 CHECK (randomize_questions IN (0, 1)),
  UNIQUE(revision_id, lesson_id)
);

CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id),
  prompt TEXT NOT NULL,
  choices_json TEXT NOT NULL,
  correct_choice_keys TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 1 CHECK (points > 0),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_questions_quiz_id ON questions(quiz_id);

CREATE TABLE attempts (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id),
  quiz_id TEXT NOT NULL REFERENCES quizzes(id),
  revision_id TEXT NOT NULL REFERENCES course_revisions(id),
  seed TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  submitted_at TEXT,
  score INTEGER,
  pass INTEGER CHECK (pass IN (0, 1))
);

CREATE INDEX idx_attempts_enrollment_id ON attempts(enrollment_id);
CREATE INDEX idx_attempts_quiz_id ON attempts(quiz_id);

CREATE TABLE attempt_answers (
  attempt_id TEXT NOT NULL REFERENCES attempts(id),
  question_id TEXT NOT NULL REFERENCES questions(id),
  selected_keys TEXT NOT NULL,
  awarded_points INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (attempt_id, question_id)
);

-- ============================================================
-- Orders and payments
-- ============================================================

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  course_id TEXT NOT NULL REFERENCES courses(id),
  price_snapshot INTEGER NOT NULL,
  currency TEXT NOT NULL,
  provider TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'CREATED'
    CHECK (state IN (
      'CREATED', 'CHECKOUT_PENDING', 'PAID', 'EXPIRED', 'CANCELED',
      'PARTIALLY_REFUNDED', 'REFUNDED', 'CHARGEBACK'
    )),
  idempotency_key TEXT NOT NULL UNIQUE,
  provider_checkout_id TEXT,
  checkout_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_course_id ON orders(course_id);
CREATE INDEX idx_orders_state ON orders(state);

CREATE TABLE provider_payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  provider_payment_id TEXT NOT NULL,
  state TEXT NOT NULL,
  raw_ref TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(order_id, provider_payment_id)
);

-- Webhook event deduplication table
CREATE TABLE webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  processed_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(provider, external_event_id)
);

CREATE TABLE refunds (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  provider_ref TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('approved', 'pending', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_refunds_order_id ON refunds(order_id);

-- ============================================================
-- Certificates
-- ============================================================

CREATE TABLE certificates (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id),
  public_code TEXT NOT NULL UNIQUE,
  confirmed_name TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  reason TEXT
);

CREATE INDEX idx_certificates_enrollment_id ON certificates(enrollment_id);
CREATE INDEX idx_certificates_public_code ON certificates(public_code);

-- ============================================================
-- Promotions
-- ============================================================

CREATE TABLE promotions (
  id TEXT PRIMARY KEY,
  slot TEXT NOT NULL,
  course_id TEXT NOT NULL REFERENCES courses(id),
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Audit log (append-only)
-- ============================================================

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_audit_events_actor_id ON audit_events(actor_id);
CREATE INDEX idx_audit_events_subject ON audit_events(subject_type, subject_id);

-- ============================================================
-- Outbox for reliable async job processing
-- ============================================================

CREATE TABLE outbox (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  available_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_outbox_available ON outbox(available_at) WHERE processed_at IS NULL;
