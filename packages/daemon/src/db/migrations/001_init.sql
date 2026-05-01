-- PRD-MVP-SLIM v0.10 §8.1 — initial schema
-- Tables: profile, item_states, vision_calls, rate_limit_buckets, vision_cache, consents

CREATE TABLE profile (
  employee_id   TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  name          TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE TABLE item_states (
  item_id       TEXT PRIMARY KEY,
  status        TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'blocked')),
  current_step  TEXT,
  started_at    INTEGER,
  completed_at  INTEGER,
  attempt_count INTEGER DEFAULT 0
);

CREATE TABLE vision_calls (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id         TEXT NOT NULL UNIQUE,
  item_id         TEXT NOT NULL,
  step_id         TEXT NOT NULL,
  request_type    TEXT NOT NULL CHECK (request_type IN ('guide', 'verify')),
  image_hash      TEXT NOT NULL,
  prompt_tokens   INTEGER,
  output_tokens   INTEGER,
  latency_ms      INTEGER NOT NULL,
  cache_hit       INTEGER DEFAULT 0,
  result_summary  TEXT,
  error           TEXT,
  created_at      INTEGER NOT NULL
);

CREATE TABLE rate_limit_buckets (
  bucket_id       TEXT PRIMARY KEY,
  call_count      INTEGER NOT NULL DEFAULT 0,
  alert_sent      INTEGER DEFAULT 0,
  paused          INTEGER DEFAULT 0,
  reset_at        INTEGER NOT NULL
);

CREATE TABLE vision_cache (
  cache_key       TEXT PRIMARY KEY,
  response_json   TEXT NOT NULL,
  ttl_at          INTEGER NOT NULL
);

CREATE TABLE consents (
  consent_type    TEXT PRIMARY KEY CHECK (consent_type IN (
                    'screen_recording', 'anthropic_transmission'
                  )),
  granted         INTEGER NOT NULL,
  granted_at      INTEGER,
  revoked_at      INTEGER
);

CREATE INDEX idx_vision_calls_item ON vision_calls(item_id, step_id);
CREATE INDEX idx_vision_calls_created ON vision_calls(created_at);
CREATE INDEX idx_vision_cache_ttl ON vision_cache(ttl_at);
