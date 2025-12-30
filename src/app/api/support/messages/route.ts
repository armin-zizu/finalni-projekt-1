import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

// Cache za provjeru postojanja support_messages tabele
let supportMessagesTableExists: boolean | null = null;

// Funkcija za provjeru i automatsko kreiranje support_messages tabele
async function ensureSupportMessagesTable(): Promise<boolean> {
  // Ako već znamo da postoji, vrati true
  if (supportMessagesTableExists === true) {
    return true;
  }

  try {
    // Provjeri da li tabela postoji
    const checkResult = await query(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = 'public' AND table_name = 'support_messages'`
    );

    if (checkResult.rows.length > 0) {
      supportMessagesTableExists = true;
      return true;
    }

    // Tabela ne postoji - kreiraj je automatski
    console.log('🔧 Automatsko kreiranje support_messages tabele...');
    
    try {
      // Kreiraj tabelu
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

      // Kreiraj indexe
      await query(`
        CREATE INDEX IF NOT EXISTS idx_support_messages_user_id 
        ON support_messages(user_id);
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS idx_support_messages_conversation_id 
        ON support_messages(conversation_id);
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS idx_support_messages_created_at 
        ON support_messages(created_at DESC);
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS idx_support_messages_unread 
        ON support_messages(is_read, created_at DESC) 
        WHERE is_read = FALSE;
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS idx_support_messages_user_conversation 
        ON support_messages(user_id, conversation_id, created_at DESC);
      `);

      console.log('✅ support_messages tabela automatski kreirana!');
      supportMessagesTableExists = true;
      return true;
    } catch (migrationError: any) {
      // Ako ne možemo kreirati tabelu (nema dozvola), loguj i vrati false
      if (migrationError.code === '42501' || migrationError.message?.includes('permission') || migrationError.message?.includes('owner')) {
        console.warn('⚠️ Nema dozvola za automatsko kreiranje support_messages tabele. Migracija mora biti pokrenuta ručno na serveru.');
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

// GET - Dohvati poruke za korisnika
async function getMessages(req: AuthRequest): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Provjeri i kreiraj tabelu ako ne postoji
    await ensureSupportMessagesTable();

    const userId = req.user.userId;

    // Provjeri da li je UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let resolvedUserId = userId;
    
    if (!uuidRegex.test(userId)) {
      // Ako nije UUID, pokušaj pronaći po email-u
      const userResult = await query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
      
      resolvedUserId = userResult.rows[0].id;
    }

    // Dohvati sve poruke za ovog korisnika
    const result = await query(
      `SELECT id, user_id, message, created_at, is_read, is_admin_response, conversation_id
       FROM support_messages
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [resolvedUserId]
    );

    return NextResponse.json({
      messages: result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        message: row.message,
        createdAt: row.created_at,
        isRead: row.is_read,
        isAdminResponse: row.is_admin_response,
        conversationId: row.conversation_id,
      })),
    });
  } catch (error: any) {
    console.error('Get messages error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// POST - Pošalji poruku
async function postMessage(req: AuthRequest): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Provjeri i kreiraj tabelu ako ne postoji
    await ensureSupportMessagesTable();

    const userId = req.user.userId;
    const body = await req.json();
    const { message, conversationId } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required and must not be empty' },
        { status: 400 }
      );
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { error: 'Message is too long (max 5000 characters)' },
        { status: 400 }
      );
    }

    // Provjeri da li je UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let resolvedUserId = userId;
    
    if (!uuidRegex.test(userId)) {
      const userResult = await query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
      
      resolvedUserId = userResult.rows[0].id;
    }

    // Koristi postojeći conversation_id ili kreiraj novi
    let finalConversationId = conversationId;
    if (!finalConversationId || !uuidRegex.test(finalConversationId)) {
      // Kreiraj novi conversation_id (koristi UUID)
      const { randomUUID } = require('crypto');
      finalConversationId = randomUUID();
    }

    // Unesi poruku u bazu
    const result = await query(
      `INSERT INTO support_messages (user_id, message, conversation_id, is_admin_response)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, message, created_at, is_read, is_admin_response, conversation_id`,
      [resolvedUserId, message.trim(), finalConversationId, false]
    );

    const newMessage = result.rows[0];

    return NextResponse.json({
      message: {
        id: newMessage.id,
        userId: newMessage.user_id,
        message: newMessage.message,
        createdAt: newMessage.created_at,
        isRead: newMessage.is_read,
        isAdminResponse: newMessage.is_admin_response,
        conversationId: newMessage.conversation_id,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Post message error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getMessages);
export const POST = withAuth(postMessage);

