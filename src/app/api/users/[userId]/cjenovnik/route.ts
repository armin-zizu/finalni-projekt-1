import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

// Cache za provjeru postojanja display_order kolone
let displayOrderColumnExists: boolean | null = null;

// Funkcija za provjeru i automatsko dodavanje display_order kolone
async function ensureDisplayOrderColumn(): Promise<boolean> {
  // Ako već znamo da postoji, vrati true
  if (displayOrderColumnExists === true) {
    return true;
  }

  try {
    // Provjeri da li kolona postoji
    const checkResult = await query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'cjenovnik' AND column_name = 'display_order'`
    );

    if (checkResult.rows.length > 0) {
      displayOrderColumnExists = true;
      return true;
    }

    // Kolona ne postoji - dodaj je automatski
    console.log('🔧 Automatsko dodavanje display_order kolone...');
    
    try {
      // Step 1: Add column
      await query(`
        ALTER TABLE cjenovnik 
        ADD COLUMN IF NOT EXISTS display_order INTEGER;
      `);

      // Step 2: Migrate existing data
      const updateResult = await query(`
        UPDATE cjenovnik
        SET display_order = subquery.row_num - 1
        FROM (
          SELECT 
            id,
            user_id,
            ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY naziv ASC) as row_num
          FROM cjenovnik
          WHERE display_order IS NULL
        ) AS subquery
        WHERE cjenovnik.id = subquery.id AND cjenovnik.user_id = subquery.user_id;
      `);

      // Step 3: Create index
      await query(`
        CREATE INDEX IF NOT EXISTS idx_cjenovnik_display_order ON cjenovnik(user_id, display_order);
      `);

      console.log(`✅ display_order kolona automatski dodana! Ažurirano ${updateResult.rowCount || 0} redova.`);
      displayOrderColumnExists = true;
      return true;
    } catch (migrationError: any) {
      // Ako ne možemo dodati kolonu (nema dozvola), loguj i vrati false
      if (migrationError.code === '42501' || migrationError.message?.includes('permission') || migrationError.message?.includes('owner')) {
        console.warn('⚠️ Nema dozvola za automatsko dodavanje display_order kolone. Migracija mora biti pokrenuta ručno na serveru.');
        displayOrderColumnExists = false;
        return false;
      }
      throw migrationError;
    }
  } catch (error: any) {
    console.warn('⚠️ Greška pri provjeri display_order kolone:', error.message);
    displayOrderColumnExists = false;
    return false;
  }
}

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
    
    // Provjeri i dodaj display_order kolonu ako ne postoji
    const hasDisplayOrder = await ensureDisplayOrderColumn();
    
    // Try to select with display_order, fallback to old query if column doesn't exist
    let result;
    if (hasDisplayOrder) {
      result = await query(
        `SELECT id, naziv, cijena, proizvodna_cijena, zestoko_kolicina, nabavna_cijena, nabavna_cijena_flase, zapremina_flase, pocetno_stanje, display_order, created_at, updated_at
         FROM cjenovnik
         WHERE user_id::text = $1
         ORDER BY COALESCE(display_order, 999999) ASC, naziv ASC`,
        [userId]
      );
    } else {
      // Fallback if display_order column doesn't exist yet
      result = await query(
        `SELECT id, naziv, cijena, proizvodna_cijena, zestoko_kolicina, nabavna_cijena, nabavna_cijena_flase, zapremina_flase, pocetno_stanje, created_at, updated_at
         FROM cjenovnik
         WHERE user_id::text = $1
         ORDER BY naziv ASC`,
        [userId]
      );
    }

    console.log('📋 Database returned', result.rows.length, 'rows for user:', userId, 'Items:', result.rows.map((r: any) => r.naziv));

    const cjenovnik = result.rows.map((row: any) => ({
      id: row.id,
      naziv: row.naziv,
      cijena: parseFloat(row.cijena),
      proizvodnaCijena: row.proizvodna_cijena ? parseFloat(row.proizvodna_cijena) : undefined,
      zestokoKolicina: row.zestoko_kolicina ? parseFloat(row.zestoko_kolicina) : undefined,
      nabavnaCijena: row.nabavna_cijena ? parseFloat(row.nabavna_cijena) : undefined,
      nabavnaCijenaFlase: row.nabavna_cijena_flase ? parseFloat(row.nabavna_cijena_flase) : undefined,
      zapreminaFlase: row.zapremina_flase ? parseFloat(row.zapremina_flase) : undefined,
      pocetnoStanje: row.pocetno_stanje ? parseFloat(row.pocetno_stanje) : 0,
      displayOrder: row.display_order !== null && row.display_order !== undefined ? row.display_order : null,
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

    let body;
    try {
      body = await req.json();
    } catch (error) {
      // Ako je body prazan ili nevalidan JSON, vrati grešku
      return NextResponse.json(
        { error: 'Invalid or missing request body. Expected valid JSON.' },
        { status: 400 }
      );
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Request body must be a valid JSON object' },
        { status: 400 }
      );
    }

    const { cjenovnik } = body;

    if (!Array.isArray(cjenovnik)) {
      return NextResponse.json(
        { error: 'cjenovnik must be an array' },
        { status: 400 }
      );
    }

    console.log('💾 Saving cjenovnik for user:', userId, 'Items count:', cjenovnik.length, 'Items:', cjenovnik.map((i: any) => i.naziv));
    
    // Provjeri i dodaj display_order kolonu ako ne postoji
    const hasDisplayOrder = await ensureDisplayOrderColumn();
    
    // VAŽNO: NE brišemo artikle automatski - samo INSERT/UPDATE (UPSERT)
    // Artikli se brišu SAMO kada korisnik eksplicitno klikne delete dugme
    // Ovo osigurava da se artikli ne gube pri automatskom čuvanju ili refresh-ovima
    
    // Insert/Update cjenovnik items - UPSERT pristup (dodajemo/ažuriramo artikle iz array-a)
    if (cjenovnik.length > 0) {
      // Prvo, pokušaj sa display_order (10 parametara po artiklu) ako kolona postoji
      if (hasDisplayOrder) {
        try {
        const values = cjenovnik.map((item: any, index: number) => {
          const baseIndex = index * 10; // 10 vrijednosti po artiklu (dodato display_order)
          return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}, $${baseIndex + 10})`;
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
            item.zapreminaFlase || null,
            item.pocetnoStanje !== undefined ? item.pocetnoStanje : null,
            item.displayOrder !== null && item.displayOrder !== undefined ? item.displayOrder : null
          );
        });

        console.log('📝 Inserting cjenovnik items with display_order, params count:', queryParams.length, 'expected:', cjenovnik.length * 10);
        
        await query(
          `INSERT INTO cjenovnik (user_id, naziv, cijena, proizvodna_cijena, zestoko_kolicina, nabavna_cijena, nabavna_cijena_flase, zapremina_flase, pocetno_stanje, display_order)
           VALUES ${values}
           ON CONFLICT (user_id, naziv) DO UPDATE
           SET cijena = EXCLUDED.cijena,
               proizvodna_cijena = EXCLUDED.proizvodna_cijena,
               zestoko_kolicina = EXCLUDED.zestoko_kolicina,
               nabavna_cijena = EXCLUDED.nabavna_cijena,
               nabavna_cijena_flase = EXCLUDED.nabavna_cijena_flase,
               zapremina_flase = EXCLUDED.zapremina_flase,
               pocetno_stanje = COALESCE(EXCLUDED.pocetno_stanje, cjenovnik.pocetno_stanje),
               display_order = COALESCE(EXCLUDED.display_order, cjenovnik.display_order),
               updated_at = NOW()`,
          queryParams
        );
        
        console.log('✅ Successfully inserted/updated cjenovnik items with display_order');
        } catch (error: any) {
          throw error; // Ako imamo dozvolu za kolonu, ne smijemo imati greške
        }
      } else {
        // Fallback ako display_order kolona ne postoji (nema dozvola za dodavanje)
        console.log('⚠️ display_order kolona ne postoji, koristim fallback INSERT (bez display_order)');
          
          const values = cjenovnik.map((item: any, index: number) => {
            const baseIndex = index * 9; // 9 vrijednosti po artiklu (bez display_order)
            return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9})`;
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
              item.zapreminaFlase || null,
              item.pocetnoStanje !== undefined ? item.pocetnoStanje : null
            );
          });

          console.log('📝 Fallback INSERT without display_order, params count:', queryParams.length);
          
          await query(
            `INSERT INTO cjenovnik (user_id, naziv, cijena, proizvodna_cijena, zestoko_kolicina, nabavna_cijena, nabavna_cijena_flase, zapremina_flase, pocetno_stanje)
             VALUES ${values}
             ON CONFLICT (user_id, naziv) DO UPDATE
             SET cijena = EXCLUDED.cijena,
                 proizvodna_cijena = EXCLUDED.proizvodna_cijena,
                 zestoko_kolicina = EXCLUDED.zestoko_kolicina,
                 nabavna_cijena = EXCLUDED.nabavna_cijena,
                 nabavna_cijena_flase = EXCLUDED.nabavna_cijena_flase,
                 zapremina_flase = EXCLUDED.zapremina_flase,
                 pocetno_stanje = COALESCE(EXCLUDED.pocetno_stanje, cjenovnik.pocetno_stanje),
                 updated_at = NOW()`,
            queryParams
          );
          
        console.log('✅ Successfully inserted/updated cjenovnik items (fallback without display_order)');
      }
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

// DELETE handler - eksplicitno brisanje artikla
async function deleteHandler(req: AuthRequest, { params }: { params: Promise<{ userId: string }> | { userId: string } }): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    let userId = resolvedParams.userId;
    const body = await req.json();
    const { naziv } = body; // Naziv artikla koji treba obrisati

    if (!naziv) {
      return NextResponse.json(
        { error: 'naziv is required' },
        { status: 400 }
      );
    }

    // Resolve userId to UUID if needed
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
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
      } else {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
    }

    // Check permissions
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

    // Eksplicitno obriši artikal
    const deleteResult = await query(
      `DELETE FROM cjenovnik 
       WHERE user_id::text = $1 
       AND naziv = $2`,
      [userId, naziv]
    );

    if (deleteResult.rowCount && deleteResult.rowCount > 0) {
      console.log(`🗑️ Eksplicitno obrisan artikal: ${naziv} za korisnika: ${userId}`);
      return NextResponse.json({ success: true, message: 'Artikal obrisan' });
    } else {
      console.log(`⚠️ Artikal nije pronađen za brisanje: ${naziv} za korisnika: ${userId}`);
      return NextResponse.json({ success: false, message: 'Artikal nije pronađen' }, { status: 404 });
    }
  } catch (error: any) {
    console.error('Delete artikal error:', error);
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

export const DELETE = (req: NextRequest, context: { params: Promise<{ userId: string }> | { userId: string } }) => {
  return withAuth((authReq: AuthRequest) => deleteHandler(authReq, context))(req);
};

