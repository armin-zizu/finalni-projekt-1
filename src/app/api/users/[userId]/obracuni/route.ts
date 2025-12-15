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

    // Use userId from JWT token instead of URL params
    const jwtUserId = req.user.userId;
    const requestedUserId = params.userId;

    console.log('Get obracuni - JWT userId:', jwtUserId, 'Requested userId:', requestedUserId);

    // Check if user can access these obracuni
    // Allow access if userId matches or user is owner
    if (jwtUserId !== requestedUserId && !req.user.isOwner) {
      console.warn('Get obracuni - Access denied:', { jwtUserId, requestedUserId, isOwner: req.user.isOwner });
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(req.url);
    const datum = searchParams.get('datum');
    const isDraft = searchParams.get('is_draft'); // Optional: filter by draft status

    // If userId is not a UUID, try to find the actual UUID from database
    let userId = jwtUserId;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(userId)) {
      console.log('Get obracuni - Non-UUID userId detected, looking up in database:', userId);
      try {
        // Try to find user by email first (most common case)
        let userResult = await query(
          'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
          [userId]
        );
        
        // If not found by email, return error - we don't support non-UUID IDs anymore
        if (userResult.rows.length === 0) {
          console.error('Get obracuni - User not found by email:', userId);
          return NextResponse.json(
            { 
              error: 'User not found. Invalid user ID format. Please log out and log in again.', 
              userId: jwtUserId 
            },
            { status: 404 }
          );
        }
        
        userId = userResult.rows[0].id;
        console.log('Get obracuni - Found UUID for user:', userId, 'from email:', jwtUserId);
      } catch (lookupError: any) {
        console.error('Get obracuni - Error looking up user:', {
          error: lookupError.message,
          code: lookupError.code,
          detail: lookupError.detail,
          hint: lookupError.hint,
          userId: jwtUserId,
          stack: lookupError.stack
        });
        return NextResponse.json(
          { 
            error: 'Failed to resolve user ID', 
            message: lookupError.message,
            detail: lookupError.detail || lookupError.hint || 'Please check server logs for more details'
          },
          { status: 500 }
        );
      }
    }

    // Automatski briši draftove starije od 24h
    try {
      await query(
        `DELETE FROM obracuni 
         WHERE user_id = $1::uuid 
         AND is_draft = TRUE 
         AND updated_at < NOW() - INTERVAL '24 hours'`,
        [userId]
      );
    } catch (cleanupError) {
      console.warn('Error cleaning up old drafts:', cleanupError);
      // Nastavi dalje čak i ako cleanup ne uspije
    }

    let sql = `SELECT id, datum, artikli, is_draft, created_at, updated_at
               FROM obracuni
               WHERE user_id = $1::uuid`;
    const queryParams: any[] = [userId];

    if (datum) {
      sql += ' AND datum = $2';
      queryParams.push(datum);
    }

    // Filtrirati po is_draft ako je naveden
    if (isDraft !== null) {
      const draftValue = isDraft === 'true';
      if (datum) {
        sql += ' AND is_draft = $3';
        queryParams.push(draftValue);
      } else {
        sql += ' AND is_draft = $2';
        queryParams.push(draftValue);
      }
    } else {
      // Ako nije naveden, vraćamo samo finalne obračune (is_draft = false ili NULL)
      // Draft obračuni se vraćaju samo eksplicitno
      if (datum) {
        sql += ' AND (is_draft = FALSE OR is_draft IS NULL)';
      } else {
        sql += ' AND (is_draft = FALSE OR is_draft IS NULL)';
      }
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
      isDraft: row.is_draft || false,
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

    // Use userId from JWT token instead of URL params
    const jwtUserId = req.user.userId;
    const requestedUserId = params.userId;

    // Check if user can modify obracuni
    if (jwtUserId !== requestedUserId && !req.user.isOwner) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { datum, artikli, rashodi, prihodi, ukupnoArtikli, ukupnoRashod, ukupnoPrihod, neto, isAzuriran, imaUlaz, invoiceImages, isDraft } = body;

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

    // If userId is not a UUID, try to find the actual UUID from database
    let userId = jwtUserId;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(userId)) {
      console.log('Save obracun - Non-UUID userId detected, looking up in database:', userId);
      try {
        const userResult = await query(
          'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
          [userId]
        );
        
        if (userResult.rows.length > 0) {
          userId = userResult.rows[0].id;
          console.log('Save obracun - Found UUID for user:', userId);
        } else {
          console.error('Save obracun - User not found:', userId);
          return NextResponse.json(
            { error: 'User not found. Invalid user ID format.', userId: jwtUserId },
            { status: 404 }
          );
        }
      } catch (lookupError: any) {
        console.error('Save obracun - Error looking up user:', lookupError);
        return NextResponse.json(
          { error: 'Failed to resolve user ID', message: lookupError.message },
          { status: 500 }
        );
      }
    }

    // Determine if this is a draft or final obracun
    const draftValue = isDraft === true || isDraft === 'true';
    
    // Ako spremaš finalni obračun (isDraft = false), prvo obriši draft za taj datum (ako postoji)
    if (!draftValue) {
      try {
        await query(
          `DELETE FROM obracuni 
           WHERE user_id = $1::uuid 
           AND datum = $2 
           AND is_draft = TRUE`,
          [userId, datum]
        );
      } catch (deleteError) {
        console.warn('Error deleting draft before saving final obracun:', deleteError);
        // Nastavi dalje
      }
    }

    // Upsert obracun
    // Napomena: UNIQUE constraint je na (user_id, datum), ali sada imamo i is_draft
    // Zato koristimo INSERT ... ON CONFLICT sa specifičnom logikom
    const result = await query(
      `INSERT INTO obracuni (user_id, datum, artikli, is_draft)
       VALUES ($1::uuid, $2, $3, $4)
       ON CONFLICT (user_id, datum) DO UPDATE
       SET artikli = EXCLUDED.artikli,
           is_draft = EXCLUDED.is_draft,
           updated_at = NOW()
       RETURNING id, datum, is_draft, created_at, updated_at`,
      [userId, datum, JSON.stringify(obracunData), draftValue]
    );

    return NextResponse.json({
      success: true,
      obracun: {
        id: result.rows[0].id,
        datum: result.rows[0].datum,
        isDraft: result.rows[0].is_draft || false,
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

    // Use userId from JWT token instead of URL params
    const jwtUserId = req.user.userId;
    const requestedUserId = params.userId;

    // Check if user can delete obracuni
    if (jwtUserId !== requestedUserId && !req.user.isOwner) {
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

    // If userId is not a UUID, try to find the actual UUID from database
    let userId = jwtUserId;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(userId)) {
      console.log('Delete obracun - Non-UUID userId detected, looking up in database:', userId);
      try {
        const userResult = await query(
          'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
          [userId]
        );
        
        if (userResult.rows.length > 0) {
          userId = userResult.rows[0].id;
          console.log('Delete obracun - Found UUID for user:', userId);
        } else {
          console.error('Delete obracun - User not found:', userId);
          return NextResponse.json(
            { error: 'User not found. Invalid user ID format.', userId: jwtUserId },
            { status: 404 }
          );
        }
      } catch (lookupError: any) {
        console.error('Delete obracun - Error looking up user:', lookupError);
        return NextResponse.json(
          { error: 'Failed to resolve user ID', message: lookupError.message },
          { status: 500 }
        );
      }
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

