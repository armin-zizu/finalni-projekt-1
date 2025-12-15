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

    // Get query parameters for filtering
    const { searchParams } = new URL(req.url);
    const datum = searchParams.get('datum');
    const isDraft = searchParams.get('is_draft'); // Optional: filter by draft status

    // Use userId from JWT token instead of URL params
    const jwtUserId = req.user.userId;
    let requestedUserId = params.userId;

    console.log('Get obracuni - JWT userId:', jwtUserId, 'Requested userId:', requestedUserId);

    // If userId is not a UUID, try to find the actual UUID from database
    let userId = jwtUserId;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(userId)) {
      console.log('Get obracuni - Non-UUID userId detected, looking up in database:', userId);
      try {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        // Try to find by id::text first (for backward compatibility), then by email if it looks like email
        let userResult;
        if (emailRegex.test(userId)) {
          userResult = await query(
            'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
            [userId]
          );
        } else {
          // Try by id::text first, then by email as fallback
          userResult = await query(
            'SELECT id FROM users WHERE id::text = $1 OR LOWER(email) = LOWER($1) LIMIT 1',
            [userId]
          );
        }
        
        if (userResult.rows.length > 0) {
          userId = userResult.rows[0].id;
          console.log('Get obracuni - Found UUID for user:', userId, 'from:', jwtUserId);
        } else {
          console.error('Get obracuni - User not found:', userId);
          return NextResponse.json(
            { 
              error: 'User not found. Invalid user ID format. Please log out and log in again.', 
              userId: jwtUserId 
            },
            { status: 404 }
          );
        }
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
    
    // Resolve requestedUserId to UUID if needed and check permissions
    let requestedUserIdResolved = requestedUserId;
    if (!uuidRegex.test(requestedUserId)) {
      const userResult = await query(
        'SELECT id FROM users WHERE id = $1 OR LOWER(email) = LOWER($1) LIMIT 1',
        [requestedUserId]
      );
      if (userResult.rows.length > 0) {
        requestedUserIdResolved = userResult.rows[0].id;
      }
    }
    
    // Check if user can access these obracuni (compare resolved UUIDs)
    if (userId !== requestedUserIdResolved && !req.user.isOwner) {
      console.warn('Get obracuni - Access denied:', { 
        jwtUserId: req.user.userId, 
        resolvedUserId: userId,
        requestedUserId: params.userId,
        resolvedRequestedUserId: requestedUserIdResolved,
        isOwner: req.user.isOwner 
      });
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Clean datum - remove trailing dot if present (e.g. "15.12.2025." -> "15.12.2025")
    let cleanedDatum = datum ? datum.toString().replace(/\.$/, '') : null;

    // Build SQL query - always use simple query without is_draft column
    // is_draft column doesn't exist in database, so we always return all obracuni
    // Draft functionality is handled on frontend (localStorage/cache)
    // Backend only stores final obracuni
    let sql: string;
    const queryParams: any[] = [userId]; // Use resolved UUID userId
    
    sql = `SELECT id, datum, artikli, created_at, updated_at
           FROM obracuni
           WHERE user_id = $1::uuid`;
    
    if (cleanedDatum) {
      sql += ' AND datum = $2';
      queryParams.push(cleanedDatum);
    }

    // If requesting draft, return empty (drafts are stored on frontend, not in database)
    // Frontend will use localStorage/cache for drafts
    if (isDraft === 'true') {
      sql += ' AND 1 = 0'; // Always false - no drafts in database
    }
    // Otherwise return all (all are final without is_draft column)

    sql += ' ORDER BY datum DESC';

    console.log('Get obracuni - userId:', userId, 'type:', typeof userId, 'SQL:', sql, 'params:', queryParams);
    
    let result;
    try {
      result = await query(sql, queryParams);
      console.log('Get obracuni - result rows:', result.rows.length, 'first row sample:', result.rows[0] ? { id: result.rows[0].id, datum: result.rows[0].datum } : null);
    } catch (dbError: any) {
      console.error('Get obracuni - Database query error:', {
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

    const obracuni = result.rows.map((row: any) => {
      // Parse artikli if it's a string (JSONB from database)
      let artikliData = row.artikli;
      if (typeof artikliData === 'string') {
        try {
          artikliData = JSON.parse(artikliData);
        } catch (e) {
          console.warn('Error parsing artikli JSON:', e);
          artikliData = {};
        }
      }
      
      return {
        id: row.id,
        datum: row.datum,
        artikli: artikliData,
        isDraft: false, // All obracuni in database are final (no is_draft column)
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

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

    // Resolve userId from JWT token to UUID if needed
    let userId = req.user.userId;
    let requestedUserId = params.userId;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    // Resolve JWT userId to UUID if needed
    if (!uuidRegex.test(userId)) {
      const userResult = await query(
        'SELECT id FROM users WHERE id = $1 OR LOWER(email) = LOWER($1) LIMIT 1',
        [userId]
      );
      if (userResult.rows.length > 0) {
        userId = userResult.rows[0].id;
      }
    }
    
    // Resolve requested userId to UUID if needed
    if (!uuidRegex.test(requestedUserId)) {
      const userResult = await query(
        'SELECT id FROM users WHERE id = $1 OR LOWER(email) = LOWER($1) LIMIT 1',
        [requestedUserId]
      );
      if (userResult.rows.length > 0) {
        requestedUserId = userResult.rows[0].id;
      }
    }

    // Check if user can modify obracuni (compare resolved UUIDs)
    if (userId !== requestedUserId && !req.user.isOwner) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await req.json();
    let { datum, artikli, rashodi, prihodi, ukupnoArtikli, ukupnoRashod, ukupnoPrihod, neto, isAzuriran, imaUlaz, invoiceImages, isDraft } = body;

    if (!datum) {
      return NextResponse.json(
        { error: 'datum is required' },
        { status: 400 }
      );
    }

    // Clean datum - remove trailing dot if present (e.g. "15.12.2025." -> "15.12.2025")
    datum = datum.toString().replace(/\.$/, '');

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

    // Upsert obracun - always use simple query without is_draft column
    // is_draft column doesn't exist in database
    let result;
    try {
      console.log('Save obracun - Starting upsert:', { userId, datum, userIdType: typeof userId, requestedUserId });
      
      // Check if exists first
      const existingCheck = await query(
        `SELECT id FROM obracuni 
         WHERE user_id = $1::uuid AND datum = $2`,
        [userId, datum]
      );
      
      console.log('Save obracun - Existing check result:', { 
        exists: existingCheck.rows.length > 0, 
        userId, 
        datum,
        isUUID: uuidRegex.test(userId)
      });
      
      if (existingCheck.rows.length > 0) {
        // Update existing - this is final obracun (saving from draft or updating existing)
        console.log('Save obracun - Updating existing obracun:', { userId, datum });
        result = await query(
          `UPDATE obracuni 
           SET artikli = $3::jsonb,
               updated_at = NOW()
           WHERE user_id = $1::uuid AND datum = $2
           RETURNING id, datum, created_at, updated_at`,
          [userId, datum, JSON.stringify(obracunData)]
        );
      } else {
        // Insert new - this is final obracun (saving from draft)
        console.log('Save obracun - Creating new obracun:', { userId, datum });
        result = await query(
          `INSERT INTO obracuni (user_id, datum, artikli)
           VALUES ($1::uuid, $2, $3::jsonb)
           RETURNING id, datum, created_at, updated_at`,
          [userId, datum, JSON.stringify(obracunData)]
        );
      }
      
      if (!result || !result.rows || result.rows.length === 0) {
        throw new Error('No rows returned from insert/update query');
      }
      
      console.log('Save obracun - Success:', { id: result.rows[0].id, datum: result.rows[0].datum });
    } catch (dbError: any) {
      console.error('Save obracun - Database error:', {
        message: dbError.message,
        code: dbError.code,
        detail: dbError.detail,
        hint: dbError.hint,
        userId,
        datum,
        userIdType: typeof userId,
        requestedUserId,
        stack: dbError.stack
      });
      throw dbError; // Re-throw to be caught by outer catch
    }

    return NextResponse.json({
      success: true,
      obracun: {
        id: result.rows[0].id,
        datum: result.rows[0].datum,
        isDraft: false, // is_draft column doesn't exist, all obracuni are final
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

    // Resolve userId from JWT token to UUID if needed
    let userId = req.user.userId;
    let requestedUserId = params.userId;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    // Resolve JWT userId to UUID if needed
    if (!uuidRegex.test(userId)) {
      const userResult = await query(
        'SELECT id FROM users WHERE id = $1 OR LOWER(email) = LOWER($1) LIMIT 1',
        [userId]
      );
      if (userResult.rows.length > 0) {
        userId = userResult.rows[0].id;
      }
    }
    
    // Resolve requested userId to UUID if needed
    if (!uuidRegex.test(requestedUserId)) {
      const userResult = await query(
        'SELECT id FROM users WHERE id = $1 OR LOWER(email) = LOWER($1) LIMIT 1',
        [requestedUserId]
      );
      if (userResult.rows.length > 0) {
        requestedUserId = userResult.rows[0].id;
      }
    }

    // Check if user can delete obracuni (compare resolved UUIDs)
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

    await query(
      'DELETE FROM obracuni WHERE user_id = $1 AND datum = $2',
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

