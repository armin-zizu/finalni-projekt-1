import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

// GET - Get all obracuni for user
async function getHandler(req: AuthRequest, { params }: { params: { userId: string } }): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Use userId from JWT token (UUID) instead of URL params
    // This ensures we always use the correct UUID format
    const userId = req.user.userId;
    const requestedUserId = params.userId;

    console.log('Get obracuni - JWT userId:', userId, 'Requested userId:', requestedUserId);

    // Check if user can access these obracuni
    // Allow access if userId matches or user is owner
    if (userId !== requestedUserId && !req.user.isOwner) {
      console.warn('Get obracuni - Access denied:', { userId, requestedUserId, isOwner: req.user.isOwner });
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(req.url);
    const datum = searchParams.get('datum');

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.error('Get obracuni - Invalid UUID format:', userId);
      return NextResponse.json(
        { error: 'Invalid user ID format', userId: userId },
        { status: 400 }
      );
    }

    let sql = `SELECT id, datum, artikli, created_at, updated_at
               FROM obracuni
               WHERE user_id = $1::uuid`;
    const queryParams: any[] = [userId];

    if (datum) {
      sql += ' AND datum = $2';
      queryParams.push(datum);
    }

    sql += ' ORDER BY datum DESC';

    console.log('Get obracuni - userId:', userId, 'type:', typeof userId, 'SQL:', sql, 'params:', queryParams);
    
    let result;
    try {
      result = await query(sql, queryParams);
      console.log('Get obracuni - result rows:', result.rows.length, 'first row sample:', result.rows[0] ? { id: result.rows[0].id, datum: result.rows[0].datum } : null);
    } catch (dbError: any) {
      console.error('Database query error:', {
        message: dbError.message,
        code: dbError.code,
        detail: dbError.detail,
        hint: dbError.hint,
        userId,
        userIdType: typeof userId,
        sql: sql,
        params: queryParams,
        stack: dbError.stack,
      });
      return NextResponse.json(
        { error: 'Database query failed', message: dbError.message, details: dbError.detail || dbError.hint },
        { status: 500 }
      );
    }

    const obracuni = result.rows.map((row: any) => ({
      id: row.id,
      datum: row.datum,
      artikli: row.artikli,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ obracuni });
  } catch (error: any) {
    console.error('Get obracuni error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// POST - Create or update obracun
async function postHandler(req: AuthRequest, { params }: { params: { userId: string } }): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Use userId from JWT token (UUID) instead of URL params
    const userId = req.user.userId;
    const requestedUserId = params.userId;

    // Check if user can modify obracuni
    if (userId !== requestedUserId && !req.user.isOwner) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { datum, artikli, rashodi, prihodi, ukupnoArtikli, ukupnoRashod, ukupnoPrihod, neto, isAzuriran, imaUlaz, invoiceImages } = body;

    if (!datum) {
      return NextResponse.json(
        { error: 'datum is required' },
        { status: 400 }
      );
    }

    // Combine all data into artikli JSONB
    const obracunData = {
      artikli: artikli || [],
      rashodi: rashodi || [],
      prihodi: prihodi || [],
      ukupnoArtikli: ukupnoArtikli || 0,
      ukupnoRashod: ukupnoRashod || 0,
      ukupnoPrihod: ukupnoPrihod || 0,
      neto: neto || 0,
      isAzuriran: isAzuriran || false,
      imaUlaz: imaUlaz || false,
      invoiceImages: invoiceImages || [],
    };

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.error('Save obracun - Invalid UUID format:', userId);
      return NextResponse.json(
        { error: 'Invalid user ID format', userId: userId },
        { status: 400 }
      );
    }

    // Upsert obracun
    const result = await query(
      `INSERT INTO obracuni (user_id, datum, artikli)
       VALUES ($1::uuid, $2, $3)
       ON CONFLICT (user_id, datum) DO UPDATE
       SET artikli = EXCLUDED.artikli,
           updated_at = NOW()
       RETURNING id, datum, created_at, updated_at`,
      [userId, datum, JSON.stringify(obracunData)]
    );

    return NextResponse.json({
      success: true,
      obracun: {
        id: result.rows[0].id,
        datum: result.rows[0].datum,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at,
      },
    });
  } catch (error: any) {
    console.error('Save obracun error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete obracun
async function deleteHandler(req: AuthRequest, { params }: { params: { userId: string } }): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Use userId from JWT token (UUID) instead of URL params
    const userId = req.user.userId;
    const requestedUserId = params.userId;

    // Check if user can delete obracuni
    if (userId !== requestedUserId && !req.user.isOwner) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const datum = searchParams.get('datum');

    if (!datum) {
      return NextResponse.json(
        { error: 'datum query parameter is required' },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.error('Delete obracun - Invalid UUID format:', userId);
      return NextResponse.json(
        { error: 'Invalid user ID format', userId: userId },
        { status: 400 }
      );
    }

    await query(
      'DELETE FROM obracuni WHERE user_id = $1::uuid AND datum = $2',
      [userId, datum]
    );

    return NextResponse.json({ success: true, message: 'Obracun deleted' });
  } catch (error: any) {
    console.error('Delete obracun error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export const GET = (req: NextRequest, context: { params: { userId: string } }) => {
  return withAuth((authReq: AuthRequest) => getHandler(authReq, context))(req);
};

export const POST = (req: NextRequest, context: { params: { userId: string } }) => {
  return withAuth((authReq: AuthRequest) => postHandler(authReq, context))(req);
};

export const DELETE = (req: NextRequest, context: { params: { userId: string } }) => {
  return withAuth((authReq: AuthRequest) => deleteHandler(authReq, context))(req);
};

