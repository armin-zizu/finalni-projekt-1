-- Database Migration: Kreiranje support_messages tabele za chat sistem
-- Pokrenuti kao: psql -d office_app -f scripts/create-support-messages-table.sql

-- Kreiraj tabelu
-- Napomena: users.id je TEXT tip, ne UUID
CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  is_read BOOLEAN DEFAULT FALSE,
  is_admin_response BOOLEAN DEFAULT FALSE,
  conversation_id UUID NOT NULL,
  CONSTRAINT support_messages_message_check CHECK (LENGTH(TRIM(message)) > 0)
);

-- Kreiraj indexe
CREATE INDEX IF NOT EXISTS idx_support_messages_user_id 
ON support_messages(user_id);

CREATE INDEX IF NOT EXISTS idx_support_messages_conversation_id 
ON support_messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_support_messages_created_at 
ON support_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_messages_unread 
ON support_messages(is_read, created_at DESC) 
WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_support_messages_user_conversation 
ON support_messages(user_id, conversation_id, created_at DESC);

-- Grant permissions (ako koristiš role-based pristup)
-- GRANT SELECT, INSERT, UPDATE ON support_messages TO authenticated;
-- GRANT USAGE, SELECT ON SEQUENCE support_messages_id_seq TO authenticated;

