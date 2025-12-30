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

// GET - Dohvati poruke za specifičnu konverzaciju (admin)
async function getConversationMessages(
  req: AuthRequest,
  { params }: { params: Promise<{ conversationId: string }> }
): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Provjeri i kreiraj tabelu ako ne postoji
    await ensureSupportMessagesTable();

    const { conversationId } = await params;

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

    if (userEmail?.toLowerCase().trim() !== adminEmail.toLowerCase().trim()) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Dohvati poruke za ovu konverzaciju
    const result = await query(
      `SELECT id, user_id, message, created_at, is_read, is_admin_response, conversation_id
       FROM support_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId]
    );

    // Označi poruke kao pročitane
    await query(
      `UPDATE support_messages
       SET is_read = TRUE
       WHERE conversation_id = $1 AND is_admin_response = FALSE`,
      [conversationId]
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
    console.error('Get conversation messages error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// POST - Admin odgovor na konverzaciju
async function replyToConversation(
  req: AuthRequest,
  { params }: { params: Promise<{ conversationId: string }> }
): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Provjeri i kreiraj tabelu ako ne postoji
    await ensureSupportMessagesTable();

    const { conversationId } = await params;
    const body = await req.json();
    const { message } = body;

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

    if (userEmail?.toLowerCase().trim() !== adminEmail.toLowerCase().trim()) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Pronađi user_id za ovu konverzaciju
    const conversationResult = await query(
      'SELECT DISTINCT user_id FROM support_messages WHERE conversation_id = $1 LIMIT 1',
      [conversationId]
    );

    if (conversationResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const userId = conversationResult.rows[0].user_id;

    // Unesi admin odgovor
    const result = await query(
      `INSERT INTO support_messages (user_id, message, conversation_id, is_admin_response, is_read)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, message, created_at, is_read, is_admin_response, conversation_id`,
      [userId, message.trim(), conversationId, true, true] // Admin odgovori su automatski pročitani
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
    console.error('Reply to conversation error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  return withAuth((authReq: AuthRequest) => getConversationMessages(authReq, { params }))(req);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  return withAuth((authReq: AuthRequest) => replyToConversation(authReq, { params }))(req);
}

