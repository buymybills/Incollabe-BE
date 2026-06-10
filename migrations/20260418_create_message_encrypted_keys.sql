CREATE TYPE recipient_type_enum AS ENUM ('influencer', 'brand');

CREATE TABLE IF NOT EXISTS message_encrypted_keys (
  id             SERIAL       NOT NULL,
  message_id     INT          NOT NULL,
  recipient_id   INT          NOT NULL,
  recipient_type recipient_type_enum NOT NULL,
  encrypted_key  TEXT         NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_mek_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mek_message_id ON message_encrypted_keys (message_id);
CREATE INDEX IF NOT EXISTS idx_mek_recipient ON message_encrypted_keys (recipient_id, recipient_type);
