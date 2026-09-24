BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sparks integer NOT NULL DEFAULT 0 CHECK (sparks>=0);
ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_frame text;
CREATE TABLE IF NOT EXISTS shop_items (id text PRIMARY KEY, name text NOT NULL, description text NOT NULL, price integer NOT NULL CHECK(price>0), color text NOT NULL);
INSERT INTO shop_items(id,name,description,price,color) VALUES
 ('orbit','Órbita','Um anel violeta para o seu universo.',100,'#b2a1ff'),
 ('mint','Jardim lunar','Verde suave, conexão tranquila.',150,'#76d9b1'),
 ('sunset','Pôr do sol','Um encontro entre laranja e rosa.',200,'#f69db6'),
 ('ocean','Maré neon','Azul elétrico em movimento.',250,'#77baff'),
 ('ember','Chama viva','Faíscas que acompanham seu avatar.',300,'#f8ac66'),
 ('cosmic','Cosmos','Um brilho de todas as cores.',400,'#d2a8ff')
ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS inventory (user_id uuid REFERENCES users ON DELETE CASCADE, item_id text REFERENCES shop_items, acquired_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,item_id));
CREATE TABLE IF NOT EXISTS daily_rewards (user_id uuid REFERENCES users ON DELETE CASCADE, reward_day date NOT NULL, PRIMARY KEY(user_id,reward_day));
CREATE TABLE IF NOT EXISTS wallet_ledger (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE, amount integer NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS wallet_user_time ON wallet_ledger(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS call_history (id uuid PRIMARY KEY, room_id uuid NOT NULL REFERENCES rooms ON DELETE CASCADE, caller_id uuid NOT NULL REFERENCES users ON DELETE CASCADE, recipient_id uuid NOT NULL REFERENCES users ON DELETE CASCADE, status text NOT NULL CHECK(status IN ('ringing','accepted','declined','missed','cancelled','busy')), created_at timestamptz NOT NULL DEFAULT now(), answered_at timestamptz);
CREATE INDEX IF NOT EXISTS call_history_user ON call_history(recipient_id,created_at DESC);
INSERT INTO migrations(version) VALUES(3) ON CONFLICT DO NOTHING;
COMMIT;
