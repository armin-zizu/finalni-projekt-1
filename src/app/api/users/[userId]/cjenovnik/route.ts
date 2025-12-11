import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

// GET - Get cjenovnik for user
async function getHandler(req: AuthRequest, { params }: { params: { userId: string } }): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = params.userId;

    // Check if user can access this cjenovnik
    if (req.user.userId !== userId && !req.user.isOwner) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const result = await query(
      `SELECT id, naziv, cijena, proizvodna_cijena, zestoko_kolicina, created_at, updated_at
       FROM cjenovnik
       WHERE user_id = $1
       ORDER BY naziv ASC`,
      [userId]
    );

    const cjenovnik = result.rows.map(row => ({
      id: row.id,
      naziv: row.naziv,
      cijena: parseFloat(row.cijena),
      proizvodnaCijena: row.proizvodna_cijena ? parseFloat(row.proizvodna_cijena) : undefined,
      zestokoKolicina: row.zestoko_kolicina ? parseFloat(row.zestoko_kolicina) : undefined,
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
async function postHandler(req: AuthRequest, { params }: { params: { userId: string } }): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = params.userId;

    // Check if user can modify this cjenovnik
    if (req.user.userId !== userId && !req.user.isOwner) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { cjenovnik } = body;

    if (!Array.isArray(cjenovnik)) {
      return NextResponse.json(
        { error: 'cjenovnik must be an array' },
        { status: 400 }
      );
    }

    // Delete existing cjenovnik for this user
    await query('DELETE FROM cjenovnik WHERE user_id = $1', [userId]);

    // Insert new cjenovnik items
    if (cjenovnik.length > 0) {
      const values = cjenovnik.map((item: any, index: number) => {
        const baseIndex = index * 4;
        return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5})`;
      }).join(', ');

      const queryParams: any[] = [];
      cjenovnik.forEach((item: any) => {
        queryParams.push(userId, item.naziv, item.cijena, item.proizvodnaCijena || null, item.zestokoKolicina || null);
      });

      await query(
        `INSERT INTO cjenovnik (user_id, naziv, cijena, proizvodna_cijena, zestoko_kolicina)
         VALUES ${values}
         ON CONFLICT (user_id, naziv) DO UPDATE
         SET cijena = EXCLUDED.cijena,
             proizvodna_cijena = EXCLUDED.proizvodna_cijena,
             zestoko_kolicina = EXCLUDED.zestoko_kolicina,
             updated_at = NOW()`,
        queryParams
      );
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

export const GET = (req: NextRequest, context: { params: { userId: string } }) => {
  return withAuth((authReq: AuthRequest) => getHandler(authReq, context))(req);
};

export const POST = (req: NextRequest, context: { params: { userId: string } }) => {
  return withAuth((authReq: AuthRequest) => postHandler(authReq, context))(req);
};

