/**
 * Database Migration: Kreiranje support_messages tabele za chat sistem
 * 
 * Pokrenuti kao: node scripts/create-support-messages-table.js
 * Ili direktno u PostgreSQL:
 * psql -d office_app -f scripts/create-support-messages-table.sql
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createSupportMessagesTable() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Kreiranje support_messages tabele...');
    
    // Kreiraj tabelu
    await client.query(`
      CREATE TABLE IF NOT EXISTS support_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        is_read BOOLEAN DEFAULT FALSE,
        is_admin_response BOOLEAN DEFAULT FALSE,
        conversation_id UUID NOT NULL,
        CONSTRAINT support_messages_message_check CHECK (LENGTH(TRIM(message)) > 0)
      );
    `);
    
    console.log('✅ Tabela support_messages kreirana');
    
    // Kreiraj indexe
    console.log('🔄 Kreiranje indexa...');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_support_messages_user_id 
      ON support_messages(user_id);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_support_messages_conversation_id 
      ON support_messages(conversation_id);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_support_messages_created_at 
      ON support_messages(created_at DESC);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_support_messages_unread 
      ON support_messages(is_read, created_at DESC) 
      WHERE is_read = FALSE;
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_support_messages_user_conversation 
      ON support_messages(user_id, conversation_id, created_at DESC);
    `);
    
    console.log('✅ Indexi kreirani');
    
    // Grant permissions (ako koristiš role-based pristup)
    try {
      await client.query(`
        GRANT SELECT, INSERT, UPDATE ON support_messages TO authenticated;
        GRANT USAGE, SELECT ON SEQUENCE support_messages_id_seq TO authenticated;
      `);
      console.log('✅ Permissions dodane');
    } catch (permError) {
      console.log('⚠️  Permissions greška (možda već postoje):', permError.message);
    }
    
    console.log('✅ Migration završena uspješno!');
    
  } catch (error) {
    console.error('❌ Greška pri kreiranju tabele:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Pokreni migration
createSupportMessagesTable()
  .then(() => {
    console.log('🎉 Migration završena!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration neuspješna:', error);
    process.exit(1);
  });

