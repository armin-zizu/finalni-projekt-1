import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

// Funkcija za provjeru i automatsko kreiranje support_messages tabele (kopirano iz messages/route.ts)
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
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

// GET - Broj nepročitanih poruka
async function getUnreadCount(req: AuthRequest): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Provjeri i kreiraj tabelu ako ne postoji
    await ensureSupportMessagesTable();

    // Provjeri da li je admin
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'gitara.zizu@gmail.com';
    let userEmail = req.user.userId;

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

    const isAdmin = userEmail?.toLowerCase().trim() === adminEmail.toLowerCase().trim();

    let count = 0;

    try {
      if (isAdmin) {
        // Admin vidi nepročitane poruke od korisnika
        const result = await query(
          `SELECT COUNT(*) as count
           FROM support_messages
           WHERE is_read = FALSE AND is_admin_response = FALSE`,
          []
        );
        count = parseInt(result.rows[0].count) || 0;
      } else {
        // Korisnik vidi nepročitane admin odgovore
        let resolvedUserId = req.user.userId;
        
        if (!uuidRegex.test(req.user.userId)) {
          const userResult = await query(
            'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
            [req.user.userId]
          );
          
          if (userResult.rows.length > 0) {
            resolvedUserId = userResult.rows[0].id;
          }
        }

        const result = await query(
          `SELECT COUNT(*) as count
           FROM support_messages
           WHERE user_id = $1 AND is_read = FALSE AND is_admin_response = TRUE`,
          [resolvedUserId]
        );
        count = parseInt(result.rows[0].count) || 0;
      }
    } catch (dbError: any) {
      if (dbError.code === '42P01') {
        // Tabela ne postoji - vrati 0 umjesto error-a
        return NextResponse.json({ unreadCount: 0 });
      }
      throw dbError;
    }

    return NextResponse.json({ unreadCount: count });
  } catch (error: any) {
    console.error('Get unread count error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getUnreadCount);

