-- Migration: Add searchableContent column to messages table
-- Stores the plaintext version of encrypted messages for server-side search.
-- The client sends this alongside the encrypted content so the server can
-- index messages without needing to decrypt them.

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS "searchableContent" TEXT;

-- Trigram index enables fast ILIKE substring search on searchableContent and content.
-- pg_trgm is pre-installed on AWS RDS PostgreSQL.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_messages_searchable_content_trgm
  ON messages USING gin("searchableContent" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_messages_content_trgm
  ON messages USING gin(content gin_trgm_ops);
