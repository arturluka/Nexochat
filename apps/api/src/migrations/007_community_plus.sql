BEGIN;
ALTER TABLE servers ADD COLUMN bio text NOT NULL DEFAULT '';
ALTER TABLE servers ADD COLUMN icon_id uuid;
ALTER TABLE servers ADD COLUMN banner_id uuid;
ALTER TABLE servers ADD COLUMN welcome text NOT NULL DEFAULT '';
ALTER TABLE servers ADD COLUMN rules text NOT NULL DEFAULT '';
ALTER TABLE servers ADD COLUMN rules_version integer NOT NULL DEFAULT 0;
ALTER TABLE server_members ADD COLUMN accepted_rules integer NOT NULL DEFAULT 0;
ALTER TABLE roles ADD COLUMN self_assignable boolean NOT NULL DEFAULT false;
ALTER TABLE roles ADD COLUMN required_badge text;
CREATE TABLE ownership_offers(server_id uuid PRIMARY KEY REFERENCES servers ON DELETE CASCADE,target_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,expires_at timestamptz NOT NULL);
ALTER TABLE room_members ADD COLUMN notification_mode text CHECK(notification_mode IN ('all','mentions','muted'));
ALTER TABLE rooms DROP CONSTRAINT rooms_kind_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_kind_check CHECK(kind IN ('dm','group','text','voice','temporary','forum'));
ALTER TABLE rooms ADD COLUMN forum_tags jsonb NOT NULL DEFAULT '[]';
CREATE TABLE forum_topics(message_id uuid PRIMARY KEY REFERENCES threads(id) ON DELETE CASCADE,tags jsonb NOT NULL DEFAULT '[]');
ALTER TABLE shop_items ADD COLUMN kind text NOT NULL DEFAULT 'frame' CHECK(kind IN ('frame','background','color','effect'));
ALTER TABLE users ADD COLUMN equipped_background text;
ALTER TABLE users ADD COLUMN equipped_color text;
ALTER TABLE users ADD COLUMN equipped_effect text;
INSERT INTO shop_items(id,name,description,price,color,kind) VALUES
('aurora','Aurora','Um fundo de luzes verdes e violetas.',180,'#76d9b1','background'),
('nebula','Nebulosa','Um fundo de estrelas em tons de rosa.',220,'#f69db6','background'),
('golden','Nome dourado','Um toque dourado no seu nome.',120,'#ffd180','color'),
('glacier','Nome glacial','Um azul claro para o seu nome.',120,'#91deff','color'),
('glow','Brilho suave','Um brilho ao redor do seu perfil.',160,'#b2a1ff','effect'),
('twinkle','Estrelas','Uma constelação no seu cartão de perfil.',200,'#e9bc79','effect');
CREATE TABLE shop_gifts(id uuid PRIMARY KEY,sender_id uuid NOT NULL REFERENCES users,recipient_id uuid NOT NULL REFERENCES users,item_id text NOT NULL REFERENCES shop_items,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE call_preferences(user_id uuid REFERENCES users ON DELETE CASCADE,peer_id uuid REFERENCES users ON DELETE CASCADE,volume integer NOT NULL CHECK(volume BETWEEN 0 AND 100),PRIMARY KEY(user_id,peer_id));
CREATE TABLE event_polls(event_id uuid PRIMARY KEY REFERENCES community_events ON DELETE CASCADE,question text NOT NULL,options jsonb NOT NULL,closed boolean NOT NULL DEFAULT false);
CREATE TABLE event_poll_votes(event_id uuid REFERENCES event_polls ON DELETE CASCADE,user_id uuid REFERENCES users ON DELETE CASCADE,choice integer NOT NULL,PRIMARY KEY(event_id,user_id));
CREATE TABLE event_reminders(event_id uuid REFERENCES community_events ON DELETE CASCADE,user_id uuid REFERENCES users ON DELETE CASCADE,minutes integer NOT NULL CHECK(minutes IN (0,5,15,60)),notified_start timestamptz,PRIMARY KEY(event_id,user_id));
INSERT INTO migrations(version) VALUES(7);
COMMIT;
