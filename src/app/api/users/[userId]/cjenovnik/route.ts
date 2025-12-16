import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

// GET - Get cjenovnik for user
async function getHandler(req: AuthRequest, { params }: { params: Promise<{ userId: string }> | { userId: string } }): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
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
        // For non-email, non-UUID values like "admin-user", try to find by id::text or email from JWT
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
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
    }

    // Check if user can access this cjenovnik (owner can access all, others only their own)
    // For non-owners, check if the resolved userId matches the JWT userId (after resolving JWT userId too)
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
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
      }
    }

    console.log('📖 Getting cjenovnik for user:', userId);
    
    const result = await query(
      `SELECT id, naziv, cijena, proizvodna_cijena, zestoko_kolicina, nabavna_cijena, nabavna_cijena_flase, zapremina_flase, created_at, updated_at
       FROM cjenovnik
       WHERE user_id = $1::text
       ORDER BY naziv ASC`,
      [userId]
    );

    console.log('📋 Database returned', result.rows.length, 'rows for user:', userId, 'Items:', result.rows.map((r: any) => r.naziv));

    const cjenovnik = result.rows.map(row => ({
      id: row.id,
      naziv: row.naziv,
      cijena: parseFloat(row.cijena),
      proizvodnaCijena: row.proizvodna_cijena ? parseFloat(row.proizvodna_cijena) : undefined,
      zestokoKolicina: row.zestoko_kolicina ? parseFloat(row.zestoko_kolicina) : undefined,
      nabavnaCijena: row.nabavna_cijena ? parseFloat(row.nabavna_cijena) : undefined,
      nabavnaCijenaFlase: row.nabavna_cijena_flase ? parseFloat(row.nabavna_cijena_flase) : undefined,
      zapreminaFlase: row.zapremina_flase ? parseFloat(row.zapremina_flase) : undefined,
      pocetnoStanje: 0, // Default, može se dodati u schema ako treba
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ cjenovnik });
  } catch (error: any) {
    console.error('Get cjenovnik error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// POST - Create or update cjenovnik (upsert)
async function postHandler(req: AuthRequest, { params }: { params: Promise<{ userId: string }> | { userId: string } }): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    let userId = resolvedParams.userId;

    // Resolve userId to UUID if needed
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.log('💾 Resolving userId to UUID for save:', userId);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      let userResult;
      
      if (emailRegex.test(userId)) {
        userResult = await query(
          'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
          [userId]
        );
      } else {
        // For non-email, non-UUID values like "admin-user", try to find by email from JWT
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
        console.log('✅ Resolved userId to UUID for save:', userId);
      } else {
        console.log('❌ Could not resolve userId to UUID for save:', userId);
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
    }

    // Check if user can modify this cjenovnik (owner can modify all, others only their own)
    // For non-owners, check if the resolved userId matches the JWT userId (after resolving JWT userId too)
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
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
      }
    }

    const body = await req.json();
    const { cjenovnik } = body;

    if (!Array.isArray(cjenovnik)) {
      return NextResponse.json(
        { error: 'cjenovnik must be an array' },
        { status: 400 }
      );
    }

    console.log('💾 Saving cjenovnik for user:', userId, 'Items count:', cjenovnik.length, 'Items:', cjenovnik.map((i: any) => i.naziv));
    
    // Delete existing cjenovnik for this user
    await query('DELETE FROM cjenovnik WHERE user_id = $1::text', [userId]);
    console.log('🗑️ Deleted existing cjenovnik for user:', userId);

    // Insert new cjenovnik items
    if (cjenovnik.length > 0) {
      const values = cjenovnik.map((item: any, index: number) => {
        const baseIndex = index * 8; // 8 vrijednosti po artiklu
        return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8})`;
      }).join(', ');

      const queryParams: any[] = [];
      cjenovnik.forEach((item: any) => {
        queryParams.push(
          userId, 
          item.naziv, 
          item.cijena, 
          item.proizvodnaCijena || null, 
          item.zestokoKolicina || null,
          item.nabavnaCijena || null,
          item.nabavnaCijenaFlase || null,
          item.zapreminaFlase || null
        );
      });

      console.log('📝 Inserting cjenovnik items, params count:', queryParams.length, 'expected:', cjenovnik.length * 8);
      
      await query(
        `INSERT INTO cjenovnik (user_id, naziv, cijena, proizvodna_cijena, zestoko_kolicina, nabavna_cijena, nabavna_cijena_flase, zapremina_flase)
         VALUES ${values}
         ON CONFLICT (user_id, naziv) DO UPDATE
         SET cijena = EXCLUDED.cijena,
             proizvodna_cijena = EXCLUDED.proizvodna_cijena,
             zestoko_kolicina = EXCLUDED.zestoko_kolicina,
             nabavna_cijena = EXCLUDED.nabavna_cijena,
             nabavna_cijena_flase = EXCLUDED.nabavna_cijena_flase,
             zapremina_flase = EXCLUDED.zapremina_flase,
             updated_at = NOW()`,
        queryParams
      );
      
      console.log('✅ Successfully inserted/updated cjenovnik items');
    } else {
      console.log('⚠️ No cjenovnik items to insert (empty array)');
    }

    return NextResponse.json({ success: true, message: 'Cjenovnik updated' });
  } catch (error: any) {
    console.error('Update cjenovnik error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export const GET = (req: NextRequest, context: { params: Promise<{ userId: string }> | { userId: string } }) => {
  return withAuth((authReq: AuthRequest) => getHandler(authReq, context))(req);
};

export const POST = (req: NextRequest, context: { params: Promise<{ userId: string }> | { userId: string } }) => {
  return withAuth((authReq: AuthRequest) => postHandler(authReq, context))(req);
};

