import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

// Funkcija za provjeru i automatsko kreiranje support_messages tabele
let supportMessagesTableExists: boolean | null = null;

async function ensureSupportMessagesTable(): Promise<boolean> {
  if (supportMessagesTableExists === true) {
    return true;
  }

  try {
    const checkResult = await query(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = 'public' AND table_name = 'support_messages'`
    );

    if (checkResult.rows.length > 0) {
      supportMessagesTableExists = true;
      return true;
    }

    console.log('🔧 Automatsko kreiranje support_messages tabele...');
    
    try {
      await query(`
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
      `);

      await query(`CREATE INDEX IF NOT EXISTS idx_support_messages_user_id ON support_messages(user_id);`);
      await query(`CREATE INDEX IF NOT EXISTS idx_support_messages_conversation_id ON support_messages(conversation_id);`);
      await query(`CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON support_messages(created_at DESC);`);
      await query(`CREATE INDEX IF NOT EXISTS idx_support_messages_unread ON support_messages(is_read, created_at DESC) WHERE is_read = FALSE;`);
      await query(`CREATE INDEX IF NOT EXISTS idx_support_messages_user_conversation ON support_messages(user_id, conversation_id, created_at DESC);`);

      console.log('✅ support_messages tabela automatski kreirana!');
      supportMessagesTableExists = true;
      return true;
    } catch (migrationError: any) {
      if (migrationError.code === '42501' || migrationError.message?.includes('permission') || migrationError.message?.includes('owner')) {
        console.warn('⚠️ Nema dozvola za automatsko kreiranje support_messages tabele.');
        supportMessagesTableExists = false;
        return false;
      }
      throw migrationError;
    }
  } catch (error: any) {
    console.warn('⚠️ Greška pri provjeri support_messages tabele:', error.message);
    supportMessagesTableExists = false;
    return false;
  }
}

// GET - Lista konverzacija za admina
async function getConversations(req: AuthRequest): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Provjeri i kreiraj tabelu ako ne postoji
    await ensureSupportMessagesTable();

    // Provjeri da li je admin (po email-u)
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'gitara.zizu@gmail.com';
    let userEmail = req.user.userId;

    // Ako je userId UUID, dohvati email iz baze
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(req.user.userId)) {
      const userResult = await query(
        'SELECT email FROM users WHERE id = $1 LIMIT 1',
        [req.user.userId]
      );
      
      if (userResult.rows.length > 0) {
        userEmail = userResult.rows[0].email;
      }
    }

    if (userEmail?.toLowerCase().trim() !== adminEmail.toLowerCase().trim()) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Dohvati sve konverzacije sa informacijama o korisniku
    const result = await query(
      `SELECT DISTINCT
         sm.conversation_id,
         sm.user_id,
         u.email as user_email,
         u.app_name,
         MAX(sm.created_at) as last_message_at,
         COUNT(CASE WHEN sm.is_read = FALSE AND sm.is_admin_response = FALSE THEN 1 END) as unread_count
       FROM support_messages sm
       JOIN users u ON sm.user_id = u.id
       GROUP BY sm.conversation_id, sm.user_id, u.email, u.app_name
       ORDER BY last_message_at DESC`,
      []
    );

    const conversations = await Promise.all(
      result.rows.map(async (row) => {
        // Dohvati posljednju poruku
        const lastMessageResult = await query(
          `SELECT message, created_at, is_admin_response
           FROM support_messages
           WHERE conversation_id = $1
           ORDER BY created_at DESC
           LIMIT 1`,
          [row.conversation_id]
        );

        const lastMessage = lastMessageResult.rows[0] || null;

        return {
          conversationId: row.conversation_id,
          userId: row.user_id,
          userEmail: row.user_email,
          appName: row.app_name || 'N/A',
          lastMessageAt: row.last_message_at,
          unreadCount: parseInt(row.unread_count) || 0,
          lastMessage: lastMessage ? {
            message: lastMessage.message,
            createdAt: lastMessage.created_at,
            isAdminResponse: lastMessage.is_admin_response,
          } : null,
        };
      })
    );

    return NextResponse.json({ conversations });
  } catch (error: any) {
    console.error('Get conversations error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getConversations);

