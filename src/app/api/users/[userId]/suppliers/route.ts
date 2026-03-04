import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

// GET - Fetch suppliers with items for a user
async function getHandler(
  req: AuthRequest,
  { params }: { params: Promise<{ userId: string }> | { userId: string } }
): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    let userId = resolvedParams.userId;

    // Resolve userId to UUID if needed
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.log('📖 Resolving userId to UUID:', userId);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      let userResult;

      if (emailRegex.test(userId)) {
        userResult = await query(
          'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
          [userId]
        );
      } else {
        const jwtUserId = req.user.userId;
        if (emailRegex.test(jwtUserId)) {
          userResult = await query(
            'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
            [jwtUserId]
          );
        } else {
          userResult = await query(
            'SELECT id FROM users WHERE id::text = $1 OR LOWER(email) = LOWER($1) LIMIT 1',
            [userId]
          );
        }
      }

      if (userResult.rows.length > 0) {
        userId = userResult.rows[0].id;
        console.log('✅ Resolved userId to UUID:', userId);
      } else {
        console.log('❌ Could not resolve userId to UUID:', userId);
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
    }

    // Check if user can access (owner can access all, others only their own)
    if (!req.user.isOwner) {
      let jwtUserId = req.user.userId;
      if (!uuidRegex.test(jwtUserId)) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(jwtUserId)) {
          const jwtUserResult = await query(
            'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
            [jwtUserId]
          );
          if (jwtUserResult.rows.length > 0) {
            jwtUserId = jwtUserResult.rows[0].id;
          }
        }
      }
      if (jwtUserId !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    console.log('📖 Getting suppliers for user:', userId);

    // Ensure suppliers table exists first
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS suppliers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          items JSONB DEFAULT '[]',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          deleted_at TIMESTAMP DEFAULT NULL,
          UNIQUE(user_id, name)
        );
        
        CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON suppliers(user_id);
        CREATE INDEX IF NOT EXISTS idx_suppliers_deleted_at ON suppliers(deleted_at);
      `);
    } catch (error: any) {
      // Table might already exist, ignore
      if (!error.message?.includes('already exists')) {
        console.warn('⚠️ Error creating suppliers table:', error.message);
      }
    }

    // Try to select with contact/phone columns, fallback if they don't exist yet
    let result;
    try {
      result = await query(
        `SELECT id, name, contact, phone, items, created_at, updated_at
         FROM suppliers
         WHERE user_id::text = $1 AND deleted_at IS NULL
         ORDER BY created_at DESC`,
        [userId]
      );
    } catch (error: any) {
      // Fallback for old schema without contact/phone columns
      if (error.message?.includes('does not exist') && error.message?.includes('contact')) {
        console.warn('🔄 Columns contact/phone do not exist yet, selecting without them');
        result = await query(
          `SELECT id, name, items, created_at, updated_at
           FROM suppliers
           WHERE user_id::text = $1 AND deleted_at IS NULL
           ORDER BY created_at DESC`,
          [userId]
        );
      } else {
        throw error;
      }
    }

    const suppliers = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      contact: row.contact || '',
      phone: row.phone || '',
      items: row.items && Array.isArray(row.items) ? row.items : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    console.log(`📋 Returning ${suppliers.length} suppliers for user ${userId}`);
    return NextResponse.json({ suppliers });
  } catch (error: any) {
    console.error('❌ Get suppliers error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// POST - Create or update supplier
async function postHandler(
  req: AuthRequest,
  { params }: { params: Promise<{ userId: string }> | { userId: string } }
): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    let userId = resolvedParams.userId;
    const { id, name, items, contact, phone } = await req.json();

    // Validate input
    if (!name || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Missing required fields: name, items' },
        { status: 400 }
      );
    }

    // Resolve userId to UUID if needed
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.log('💾 Resolving userId to UUID:', userId);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      let userResult;

      if (emailRegex.test(userId)) {
        userResult = await query(
          'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
          [userId]
        );
      } else {
        const jwtUserId = req.user.userId;
        if (emailRegex.test(jwtUserId)) {
          userResult = await query(
            'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
            [jwtUserId]
          );
        } else {
          userResult = await query(
            'SELECT id FROM users WHERE id::text = $1 OR LOWER(email) = LOWER($1) LIMIT 1',
            [userId]
          );
        }
      }

      if (userResult.rows.length > 0) {
        userId = userResult.rows[0].id;
        console.log('✅ Resolved userId to UUID:', userId);
      } else {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
    }

    // Check if user can access
    if (!req.user.isOwner) {
      let jwtUserId = req.user.userId;
      if (!uuidRegex.test(jwtUserId)) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(jwtUserId)) {
          const jwtUserResult = await query(
            'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
            [jwtUserId]
          );
          if (jwtUserResult.rows.length > 0) {
            jwtUserId = jwtUserResult.rows[0].id;
          }
        }
      }
      if (jwtUserId !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    console.log('💾 Saving supplier:', name, 'for user:', userId);

    // Ensure suppliers table exists
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS suppliers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          items JSONB DEFAULT '[]',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          deleted_at TIMESTAMP DEFAULT NULL,
          UNIQUE(user_id, name)
        );
        
        CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON suppliers(user_id);
        CREATE INDEX IF NOT EXISTS idx_suppliers_deleted_at ON suppliers(deleted_at);
      `);
    } catch (error: any) {
      if (!error.message?.includes('already exists')) {
        console.warn('⚠️ Error creating suppliers table:', error.message);
      }
    }

    // Ensure suppliers table exists and has new columns
    try {
      await query(`
        ALTER TABLE suppliers 
        ADD COLUMN IF NOT EXISTS contact TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
      `);
    } catch (error: any) {
      // Columns might already exist, ignore
      if (!error.message?.includes('already exists')) {
        console.warn('⚠️ Error adding columns to suppliers:', error.message);
      }
    }

    // Upsert supplier
    let result;
    try {
      if (id) {
        // Update existing supplier
        console.log('🔄 Updating supplier:', id);
        result = await query(
          `UPDATE suppliers 
           SET name = $1, items = $2, contact = $3, phone = $4, updated_at = NOW()
           WHERE id::text = $5 AND user_id::text = $6
           RETURNING id, name, contact, phone, items, created_at, updated_at`,
          [name, JSON.stringify(items), contact || '', phone || '', id, userId]
        );
      } else {
        // Create new supplier
        console.log('✨ Creating new supplier:', name);
        result = await query(
          `INSERT INTO suppliers (user_id, name, items, contact, phone)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, name) DO UPDATE
           SET items = $3, contact = $4, phone = $5, updated_at = NOW()
           RETURNING id, name, contact, phone, items, created_at, updated_at`,
          [userId, name, JSON.stringify(items), contact || '', phone || '']
        );
      }
    } catch (error: any) {
      // Fallback if contact/phone columns don't exist yet
      if (error.message?.includes('does not exist') && error.message?.includes('contact')) {
        console.warn('🔄 Columns contact/phone do not exist, using fallback without them');
        if (id) {
          result = await query(
            `UPDATE suppliers 
             SET name = $1, items = $2, updated_at = NOW()
             WHERE id::text = $3 AND user_id::text = $4
             RETURNING id, name, items, created_at, updated_at`,
            [name, JSON.stringify(items), id, userId]
          );
        } else {
          result = await query(
            `INSERT INTO suppliers (user_id, name, items)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, name) DO UPDATE
             SET items = $3, updated_at = NOW()
             RETURNING id, name, items, created_at, updated_at`,
            [userId, name, JSON.stringify(items)]
          );
        }
      } else {
        throw error;
      }
    }

    if (result.rows.length === 0) {
      console.log('⚠️ Supplier not found or not updated:', id);
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    const supplier = result.rows[0];
    console.log('✅ Supplier saved:', supplier.id);

    return NextResponse.json({
      supplier: {
        id: supplier.id,
        name: supplier.name,
        contact: supplier.contact || '',
        phone: supplier.phone || '',
        items: supplier.items && Array.isArray(supplier.items) ? supplier.items : [],
        createdAt: supplier.created_at,
        updatedAt: supplier.updated_at,
      },
    });
  } catch (error: any) {
    console.error('❌ Post suppliers error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// Export all methods wrapped with withAuth
export const GET = (req: NextRequest, context: any) => {
  return withAuth((authReq: AuthRequest) => getHandler(authReq, context))(req);
};

export const POST = (req: NextRequest, context: any) => {
  return withAuth((authReq: AuthRequest) => postHandler(authReq, context))(req);
};
