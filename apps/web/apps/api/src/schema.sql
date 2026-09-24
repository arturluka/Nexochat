CREATE TABLE IF NOT EXISTS migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY, username text UNIQUE NOT NULL, password_hash text NOT NULL,
 display_name text NOT NULL, bio text NOT NULL DEFAULT '', avatar_id uuid,
 status text NOT NULL DEFAULT 'online', dm_policy text NOT NULL DEFAULT 'friends', read_receipts boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE, token_hash text UNIQUE NOT NULL, agent text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS relations (sender uuid REFERENCES users ON DELETE CASCADE, recipient uuid REFERENCES users ON DELETE CASCADE, state text NOT NULL CHECK(state IN ('pending','accepted','blocked')), PRIMARY KEY(sender,recipient), CHECK(sender<>recipient));
CREATE TABLE IF NOT EXISTS servers (id uuid PRIMARY KEY, name text NOT NULL, owner_id uuid NOT NULL REFERENCES users, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS roles (id uuid PRIMARY KEY, server_id uuid NOT NULL REFERENCES servers ON DELETE CASCADE, name text NOT NULL, permissions jsonb NOT NULL DEFAULT '[]');
CREATE TABLE IF NOT EXISTS server_members (server_id uuid REFERENCES servers ON DELETE CASCADE, user_id uuid REFERENCES users ON DELETE CASCADE, role_id uuid REFERENCES roles ON DELETE SET NULL, banned boolean NOT NULL DEFAULT false, PRIMARY KEY(server_id,user_id));
CREATE TABLE IF NOT EXISTS categories (id uuid PRIMARY KEY, server_id uuid NOT NULL REFERENCES servers ON DELETE CASCADE, name text NOT NULL);
CREATE TABLE IF NOT EXISTS rooms (id uuid PRIMARY KEY, name text NOT NULL, kind text NOT NULL CHECK(kind IN ('dm','group','text','voice','temporary')), owner_id uuid NOT NULL REFERENCES users, server_id uuid REFERENCES servers ON DELETE CASCADE, category_id uuid REFERENCES categories ON DELETE SET NULL, dm_key text UNIQUE, expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS room_members (room_id uuid REFERENCES rooms ON DELETE CASCADE, user_id uuid REFERENCES users ON DELETE CASCADE, muted boolean NOT NULL DEFAULT false, last_read_at timestamptz, PRIMARY KEY(room_id,user_id));
CREATE TABLE IF NOT EXISTS invites (code text PRIMARY KEY, server_id uuid NOT NULL REFERENCES servers ON DELETE CASCADE, creator_id uuid NOT NULL REFERENCES users, expires_at timestamptz NOT NULL, uses integer NOT NULL DEFAULT 0, max_uses integer NOT NULL DEFAULT 25);
CREATE TABLE IF NOT EXISTS attachments (id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users, room_id uuid REFERENCES rooms ON DELETE CASCADE, name text NOT NULL, mime text NOT NULL, size integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS messages (id uuid PRIMARY KEY, room_id uuid NOT NULL REFERENCES rooms ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users, body text NOT NULL, reply_id uuid REFERENCES messages ON DELETE SET NULL, attachment_id uuid UNIQUE REFERENCES attachments ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), edited_at timestamptz, deleted boolean NOT NULL DEFAULT false);
CREATE INDEX IF NOT EXISTS messages_room ON messages(room_id,created_at DESC);
CREATE TABLE IF NOT EXISTS reactions (message_id uuid REFERENCES messages ON DELETE CASCADE, user_id uuid REFERENCES users ON DELETE CASCADE, emoji text NOT NULL, PRIMARY KEY(message_id,user_id,emoji));
CREATE TABLE IF NOT EXISTS notifications (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE, actor_id uuid REFERENCES users, room_id uuid REFERENCES rooms ON DELETE CASCADE, body text NOT NULL, read boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS audit (id uuid PRIMARY KEY, server_id uuid REFERENCES servers ON DELETE CASCADE, actor_id uuid NOT NULL REFERENCES users, action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO migrations(version) VALUES(1) ON CONFLICT DO NOTHING;
