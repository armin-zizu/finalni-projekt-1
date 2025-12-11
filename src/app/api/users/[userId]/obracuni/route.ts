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

    const userId = params.userId;

    // Check if user can access these obracuni
    if (req.user.userId !== userId && !req.user.isOwner) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(req.url);
    const datum = searchParams.get('datum');

    let sql = `SELECT id, datum, artikli, created_at, updated_at
               FROM obracuni
               WHERE user_id = $1`;
    const queryParams: any[] = [userId];

    if (datum) {
      sql += ' AND datum = $2';
      queryParams.push(datum);
    }

    sql += ' ORDER BY datum DESC';

    console.log('Get obracuni - userId:', userId, 'SQL:', sql, 'params:', queryParams);
    
    const result = await query(sql, queryParams);

    console.log('Get obracuni - result rows:', result.rows.length);

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

    const userId = params.userId;

    // Check if user can modify obracuni
    if (req.user.userId !== userId && !req.user.isOwner) {
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

    // Upsert obracun
    const result = await query(
      `INSERT INTO obracuni (user_id, datum, artikli)
       VALUES ($1, $2, $3)
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

    const userId = params.userId;

    // Check if user can delete obracuni
    if (req.user.userId !== userId && !req.user.isOwner) {
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

