BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS displayed_badges jsonb NOT NULL DEFAULT '[]';
CREATE TABLE IF NOT EXISTS user_badges(user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,badge_id text NOT NULL,earned_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,badge_id));
INSERT INTO migrations(version) VALUES(4) ON CONFLICT DO NOTHING;
COMMIT;
