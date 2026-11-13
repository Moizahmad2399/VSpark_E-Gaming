CREATE TABLE IF NOT EXISTS students (
  id BIGSERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE CHECK (phone ~ '^03[0-9]{2}-[0-9]{7}$'),
  email TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  cnic CHAR(13) NOT NULL UNIQUE CHECK (cnic ~ '^[0-9]{13}$'),
  department TEXT NOT NULL,
  profile_image BYTEA,
  profile_image_type TEXT CHECK (profile_image_type IN ('image/jpeg','image/png','image/webp')),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS admins (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS games (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity > 0),
  players_per_match INTEGER NOT NULL DEFAULT 2 CHECK (players_per_match > 0),
  is_open BOOLEAN NOT NULL DEFAULT true,
  image_path TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS event_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  event_date DATE NOT NULL DEFAULT DATE '2026-11-18',
  venue TEXT NOT NULL DEFAULT 'To be announced',
  university_name TEXT NOT NULL DEFAULT 'COMSATS University Islamabad, Vehari Campus',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO event_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
CREATE TABLE IF NOT EXISTS registrations (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  game_id BIGINT NOT NULL REFERENCES games(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'Registered' CHECK (status IN ('Registered','Cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, game_id)
);
CREATE TABLE IF NOT EXISTS matches (
  id BIGSERIAL PRIMARY KEY,
  game_id BIGINT NOT NULL REFERENCES games(id) ON DELETE RESTRICT,
  label TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  status TEXT NOT NULL DEFAULT 'Upcoming' CHECK (status IN ('Upcoming','Live','Completed')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  winner_id BIGINT REFERENCES students(id) ON DELETE SET NULL,
  CHECK (ends_at > starts_at)
);
CREATE TABLE IF NOT EXISTS match_players (
  match_id BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  score TEXT,
  PRIMARY KEY (match_id, student_id)
);
CREATE INDEX IF NOT EXISTS registrations_game_status_idx ON registrations(game_id, status);
CREATE INDEX IF NOT EXISTS registrations_student_idx ON registrations(student_id);
CREATE INDEX IF NOT EXISTS matches_schedule_idx ON matches(starts_at, ends_at, status);
CREATE INDEX IF NOT EXISTS matches_game_idx ON matches(game_id);
CREATE INDEX IF NOT EXISTS match_players_student_idx ON match_players(student_id);

ALTER TABLE students ADD COLUMN IF NOT EXISTS profile_image BYTEA;
ALTER TABLE students ADD COLUMN IF NOT EXISTS profile_image_type TEXT;
