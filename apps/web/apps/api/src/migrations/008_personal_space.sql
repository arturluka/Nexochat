BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS community_layout jsonb NOT NULL DEFAULT '{"folders":[],"order":[]}';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS decision text NOT NULL DEFAULT '';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS decided_at timestamptz;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS decided_by uuid REFERENCES users(id) ON DELETE SET NULL;
INSERT INTO migrations(version) VALUES(8) ON CONFLICT DO NOTHING;
COMMIT;
