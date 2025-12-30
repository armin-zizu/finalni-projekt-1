-- =====================================================
-- KREIRANJE support_messages TABELE ZA CHAT SISTEM
-- =====================================================
-- Kopirajte sve linije iz ovog fajla i pokrenite u psql:
-- psql -U postgres -d office_app -f scripts/CREATE_SUPPORT_MESSAGES_TABLE.sql
-- Ili direktno u psql promptu
-- =====================================================

-- Kreiraj tabelu
-- Napomena: users.id je TEXT tip, ne UUID
-- Kreiranje bez FOREIGN KEY constrainta za početak
CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  is_read BOOLEAN DEFAULT FALSE,
  is_admin_response BOOLEAN DEFAULT FALSE,
  conversation_id UUID NOT NULL,
  CONSTRAINT support_messages_message_check CHECK (LENGTH(TRIM(message)) > 0)
);

-- OPCIONALNO: Dodaj foreign key constraint nakon kreiranja tabele
-- Odkomentirajte ako želite referentni integritet:
-- ALTER TABLE support_messages
-- ADD CONSTRAINT fk_support_messages_user_id 
-- FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Kreiraj indexe za performanse
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

-- Provjeri da li je tabela kreirana
SELECT 
  'Tabela support_messages uspješno kreirana!' as status,
  COUNT(*) as broj_redova
FROM support_messages;

-- Provjeri strukturu tabele
\d support_messages;

