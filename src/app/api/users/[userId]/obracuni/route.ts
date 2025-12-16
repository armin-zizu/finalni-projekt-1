import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

// Helper funkcija za čišćenje datuma - uklanja tačku sa kraja ako postoji
// Datum se čuva kao text u formatu DD.MM.YYYY (bez tačke na kraju)
function cleanDatum(datum: string): string {
  return datum.toString().replace(/\.$/, ''); // Remove trailing dot if present
}

// GET - Get all obracuni for user
async function getHandler(req: AuthRequest, { params }: { params: Promise<{ userId: string }> }): Promise<NextResponse> {
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

    // Email je glavni identifikator - koristimo email iz JWT tokena
    // Fallback: ako userId nije email, koristimo req.user.email ili pokušavamo da nađemo korisnika po userId
    let userEmail = req.user.email || req.user.userId;
    const { userId: requestedUserId } = await params; // Next.js 15 requires await for params
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    // Ako userId nije email format, pokušaj da nađeš email iz baze
    if (!emailRegex.test(userEmail) && !uuidRegex.test(userEmail)) {
      console.log('Get obracuni - userId is not email format, trying to find user by userId:', userEmail);
      try {
        // Pokušaj da nađeš korisnika po ID-u (možda je stari format)
        const userLookup = await query(
          'SELECT email FROM users WHERE id::text = $1 OR email = $1 LIMIT 1',
          [req.user.userId]
        );
        if (userLookup.rows.length > 0) {
          userEmail = userLookup.rows[0].email;
          console.log('Get obracuni - Found email for userId:', req.user.userId, '->', userEmail);
        } else {
          // Ako ne može da nađe po userId, koristi req.user.email ako postoji
          if (req.user.email && emailRegex.test(req.user.email)) {
            userEmail = req.user.email;
            console.log('Get obracuni - Using req.user.email:', userEmail);
          } else {
            console.error('Get obracuni - Cannot resolve userId to email:', req.user.userId, 'req.user:', req.user);
            return NextResponse.json(
              { 
                error: 'Invalid user ID format. Please log out and log in again.', 
                message: `Cannot resolve userId ${req.user.userId} to email`
              },
              { status: 400 }
            );
          }
        }
      } catch (lookupError: any) {
        console.error('Get obracuni - Error looking up user by userId:', lookupError);
        // Ako ima email u req.user, koristi ga
        if (req.user.email && emailRegex.test(req.user.email)) {
          userEmail = req.user.email;
          console.log('Get obracuni - Using req.user.email as fallback:', userEmail);
        } else {
          return NextResponse.json(
            { 
              error: 'Failed to resolve user ID', 
              message: lookupError.message
            },
            { status: 500 }
          );
        }
      }
    }
    
    console.log('Get obracuni - Final userEmail:', userEmail, 'Requested userId:', requestedUserId);

    // Resolv-ujemo email u ID za SQL upite (baza koristi text u user_id koloni, ne UUID)
    let userIdForDb: string;
    
    // Ako je userEmail email format, pronađi ID korisnika
    if (emailRegex.test(userEmail)) {
      try {
        const userResult = await query(
          'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
          [userEmail]
        );
        
        if (userResult.rows.length === 0) {
          console.error('Get obracuni - User not found for email:', userEmail);
          return NextResponse.json(
            { 
              error: 'User not found. Please log out and log in again.', 
              message: `User with email ${userEmail} not found in database`
            },
            { status: 404 }
          );
        }
        
        userIdForDb = userResult.rows[0].id;
        console.log('Get obracuni - Resolved email to ID:', userEmail, '->', userIdForDb);
      } catch (lookupError: any) {
        console.error('Get obracuni - Error looking up user:', {
          error: lookupError.message,
          code: lookupError.code,
          detail: lookupError.detail,
          hint: lookupError.hint,
          userEmail,
          stack: lookupError.stack
        });
        return NextResponse.json(
          { 
            error: 'Failed to resolve user email', 
            message: lookupError.message,
            detail: lookupError.detail || lookupError.hint || 'Please check server logs for more details'
          },
          { status: 500 }
        );
      }
    } else {
      // Ako nije email, koristi direktno kao ID (može biti bilo šta - text format)
      userIdForDb = userEmail;
      console.log('Get obracuni - Using userEmail directly as ID:', userIdForDb);
    }
    
    // Provjeri dozvole - korisnik može vidjeti samo svoje obračune (ili owner može sve)
    if (!req.user.isOwner) {
      // Provjeri da li requested userId odgovara logovanom korisniku (koristimo email)
      const userEmailLower = userEmail.toLowerCase();
      let requestedUserEmail: string | null = null;
      
      if (emailRegex.test(requestedUserId)) {
        requestedUserEmail = requestedUserId.toLowerCase();
      } else if (uuidRegex.test(requestedUserId)) {
        const reqUserResult = await query(
          'SELECT email FROM users WHERE id = $1 LIMIT 1',
          [requestedUserId]
        );
        if (reqUserResult.rows.length > 0) {
          requestedUserEmail = reqUserResult.rows[0].email.toLowerCase();
        }
      }
      
      if (requestedUserEmail && requestedUserEmail !== userEmailLower) {
        console.warn('Get obracuni - Access denied:', { 
          jwtEmail: userEmail, 
          requestedEmail: requestedUserEmail,
          isOwner: req.user.isOwner 
        });
        return NextResponse.json(
          { error: 'Forbidden - You can only view your own obracuni' },
          { status: 403 }
        );
      }
    }

    // Clean datum - konvertuj iz DD.MM.YYYY u YYYY-MM-DD za PostgreSQL date tip
    let cleanedDatumForPostgres: string | null = null;
    if (datum) {
      const cleanedDatum = cleanDatum(datum); // DD.MM.YYYY format
      // Konvertuj u YYYY-MM-DD format za PostgreSQL date tip
      const parts = cleanedDatum.split('.');
      if (parts.length === 3) {
        const [dan, mjesec, godina] = parts;
        cleanedDatumForPostgres = `${godina}-${mjesec.padStart(2, '0')}-${dan.padStart(2, '0')}`; // YYYY-MM-DD
      } else {
        cleanedDatumForPostgres = cleanedDatum; // Fallback
      }
    }

    // Build SQL query - always use simple query without is_draft column
    // is_draft column doesn't exist in database, so we always return all obracuni
    // Draft functionality is handled on frontend (localStorage/cache)
    // Backend only stores final obracuni
    let sql: string;
    const queryParams: any[] = [userIdForDb]; // Use resolved UUID userIdForDb
    
    sql = `SELECT id, datum, artikli, saved_at
           FROM obracuni
           WHERE user_id = $1::text`;
    
    if (cleanedDatumForPostgres) {
      sql += ' AND datum = $2';
      queryParams.push(cleanedDatumForPostgres);
    }

    // If requesting draft, return empty (drafts are stored on frontend, not in database)
    // Frontend will use localStorage/cache for drafts
    if (isDraft === 'true') {
      sql += ' AND 1 = 0'; // Always false - no drafts in database
    }
    // Otherwise return all (all are final without is_draft column)

    // Sortiranje po datumu - datum kolona je već date tip, možemo direktno sortirati
    sql += ` ORDER BY datum DESC NULLS LAST`;

    console.log('Get obracuni - userEmail:', userEmail, 'userIdForDb:', userIdForDb, 'SQL:', sql, 'params:', queryParams);
    
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
        userEmail,
        userIdForDb,
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
      } else if (!artikliData || typeof artikliData !== 'object') {
        // If artikliData is null, undefined, or not an object, initialize as empty object
        artikliData = {};
      }
      
      // Ensure artikliData has required structure
      if (!artikliData.artikli || !Array.isArray(artikliData.artikli)) {
        artikliData.artikli = [];
      }
      if (!artikliData.rashodi || !Array.isArray(artikliData.rashodi)) {
        artikliData.rashodi = [];
      }
      if (!artikliData.prihodi || !Array.isArray(artikliData.prihodi)) {
        artikliData.prihodi = [];
      }
      
      // Proveri da li je obračun ažurirani i da li je prošlo više od 24h od kraja datuma
      // Ako jeste, automatski konvertuj u običan obračun
      if (artikliData.isAzuriran === true) {
        const datumParts = row.datum.toString().split('-');
        if (datumParts.length === 3) {
          const [godina, mjesec, dan] = datumParts;
          const datumKraj = new Date(parseInt(godina), parseInt(mjesec) - 1, parseInt(dan), 23, 59, 59);
          const sada = new Date();
          const razlikaMS = sada.getTime() - datumKraj.getTime();
          const razlikaSati = razlikaMS / (1000 * 60 * 60);
          
          // Ako je prošlo više od 24h od kraja datuma, konvertuj u običan obračun
          if (razlikaSati > 24) {
            console.log(`Automatska konverzija ažuriranog obračuna u običan (prošlo ${razlikaSati.toFixed(1)}h):`, row.id);
            artikliData.isAzuriran = false;
            
            // Ažuriraj u bazi da obračun više nije ažurirani (async, ne blokiraj odgovor)
            query(
              `UPDATE obracuni 
               SET artikli = $1::jsonb
               WHERE id = $2`,
              [JSON.stringify(artikliData), row.id]
            ).catch((err) => {
              console.error('Error updating obracun after auto-conversion:', err);
            });
          }
        }
      }
      
      console.log('Get obracuni - Parsed artikliData for row:', row.id, 'has artikli:', Array.isArray(artikliData.artikli), 'artikli count:', artikliData.artikli?.length || 0, 'isAzuriran:', artikliData.isAzuriran);
      
      return {
        id: row.id,
        datum: row.datum,
        artikli: artikliData,
        isDraft: false, // All obracuni in database are final (no is_draft column)
        createdAt: row.saved_at,
        updatedAt: row.saved_at,
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
async function postHandler(req: AuthRequest, { params }: { params: Promise<{ userId: string }> }): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Email je glavni identifikator - koristimo email iz JWT tokena
    // Fallback: ako userId nije email, koristimo req.user.email ili pokušavamo da nađemo korisnika po userId
    let userEmail = req.user.email || req.user.userId;
    const { userId: requestedUserId } = await params; // Next.js 15 requires await for params
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    // Ako userId nije email format, pokušaj da nađeš email iz baze
    if (!emailRegex.test(userEmail) && !uuidRegex.test(userEmail)) {
      console.log('Save obracun - userId is not email format, trying to find user by userId:', userEmail);
      try {
        // Pokušaj da nađeš korisnika po ID-u (možda je stari format)
        const userLookup = await query(
          'SELECT email FROM users WHERE id::text = $1 OR email = $1 LIMIT 1',
          [req.user.userId]
        );
        if (userLookup.rows.length > 0) {
          userEmail = userLookup.rows[0].email;
          console.log('Save obracun - Found email for userId:', req.user.userId, '->', userEmail);
        } else {
          // Ako ne može da nađe po userId, koristi req.user.email ako postoji
          if (req.user.email && emailRegex.test(req.user.email)) {
            userEmail = req.user.email;
            console.log('Save obracun - Using req.user.email:', userEmail);
          } else {
            console.error('Save obracun - Cannot resolve userId to email:', req.user.userId, 'req.user:', req.user);
            return NextResponse.json(
              { 
                error: 'Invalid user ID format. Please log out and log in again.', 
                message: `Cannot resolve userId ${req.user.userId} to email`
              },
              { status: 400 }
            );
          }
        }
      } catch (lookupError: any) {
        console.error('Save obracun - Error looking up user by userId:', lookupError);
        // Ako ima email u req.user, koristi ga
        if (req.user.email && emailRegex.test(req.user.email)) {
          userEmail = req.user.email;
          console.log('Save obracun - Using req.user.email as fallback:', userEmail);
        } else {
          return NextResponse.json(
            { 
              error: 'Failed to resolve user ID', 
              message: lookupError.message
            },
            { status: 500 }
          );
        }
      }
    }
    
    console.log('Save obracun - Final userEmail:', userEmail, 'Requested userId:', requestedUserId);

    // Resolv-ujemo email u ID za SQL upite (baza koristi text u user_id koloni, ne UUID)
    let userIdForDb: string;
    
    // Ako je userEmail email format, pronađi ID korisnika
    if (emailRegex.test(userEmail)) {
      try {
        const userResult = await query(
          'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
          [userEmail]
        );
        
        if (userResult.rows.length === 0) {
          console.error('Save obracun - User not found for email:', userEmail);
          return NextResponse.json(
            { 
              error: 'User not found. Please log out and log in again.', 
              message: `User with email ${userEmail} not found in database. Make sure you are registered.`
            },
            { status: 404 }
          );
        }
        
        userIdForDb = userResult.rows[0].id;
        console.log('Save obracun - Resolved email to ID:', userEmail, '->', userIdForDb);
      } catch (lookupError: any) {
        console.error('Save obracun - Error looking up user by email:', {
          error: lookupError.message,
          code: lookupError.code,
          detail: lookupError.detail,
          hint: lookupError.hint,
          userEmail,
          stack: lookupError.stack
        });
        return NextResponse.json(
          { 
            error: 'Failed to resolve user email', 
            message: lookupError.message,
            detail: lookupError.detail || lookupError.hint || 'Please check server logs for more details'
          },
          { status: 500 }
        );
      }
    } else {
      // Ako nije email, koristi direktno kao ID (može biti bilo šta - text format)
      userIdForDb = userEmail;
      console.log('Save obracun - Using userEmail directly as ID:', userIdForDb);
    }

    // Provjeri dozvole - korisnik može čuvati samo svoje obračune (ili owner može sve)
    // Koristimo resolv-ovani email iz JWT tokena
    if (!req.user.isOwner) {
      // Provjeri da li requested userId odgovara logovanom korisniku (koristimo email)
      const userEmailLower = userEmail.toLowerCase();
      let requestedUserEmail: string | null = null;
      
      if (emailRegex.test(requestedUserId)) {
        requestedUserEmail = requestedUserId.toLowerCase();
      } else if (uuidRegex.test(requestedUserId)) {
        const reqUserResult = await query(
          'SELECT email FROM users WHERE id = $1 LIMIT 1',
          [requestedUserId]
        );
        if (reqUserResult.rows.length > 0) {
          requestedUserEmail = reqUserResult.rows[0].email.toLowerCase();
        }
      }
      
      if (requestedUserEmail && requestedUserEmail !== userEmailLower) {
        console.warn('Save obracun - Access denied:', { 
          jwtEmail: userEmail, 
          requestedEmail: requestedUserEmail,
          isOwner: req.user.isOwner 
        });
        return NextResponse.json(
          { error: 'Forbidden - You can only save your own obracuni' },
          { status: 403 }
        );
      }
    }

    const body = await req.json();
    let { datum, artikli, rashodi, prihodi, ukupnoArtikli, ukupnoRashod, ukupnoPrihod, neto, isAzuriran, imaUlaz, invoiceImages, isDraft } = body;

    if (!datum) {
      return NextResponse.json(
        { error: 'datum is required' },
        { status: 400 }
      );
    }

    // Sačuvaj originalni datum format za datum_raw (DD.MM.YYYY bez tačke na kraju)
    const datumRaw = cleanDatum(datum.toString()); // DD.MM.YYYY format
    
    // Clean datum - convert from DD.MM.YYYY to YYYY-MM-DD format for PostgreSQL date column
    const datumStr = datum.toString().replace(/\.$/, ''); // Remove trailing dot
    // Parse DD.MM.YYYY format to YYYY-MM-DD
    const parts = datumStr.split('.');
    let datumForPostgres: string;
    if (parts.length === 3) {
      const [dan, mjesec, godina] = parts;
      datumForPostgres = `${godina}-${mjesec.padStart(2, '0')}-${dan.padStart(2, '0')}`; // YYYY-MM-DD
    } else {
      datumForPostgres = datumStr; // Fallback if format is different
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

    // Upsert obracun - always use simple query without is_draft column
    // is_draft column doesn't exist in database
    let result;
    try {
      console.log('Save obracun - Starting upsert:', { userEmail, userIdForDb, datumForPostgres, datumRaw, requestedUserId });
      
      // Check if exists first - koristimo userIdForDb za SQL upite
      const existingCheck = await query(
        `SELECT id FROM obracuni 
         WHERE user_id = $1::text AND datum = $2`,
        [userIdForDb, datumForPostgres]
      );
      
      console.log('Save obracun - Existing check result:', { 
        exists: existingCheck.rows.length > 0, 
        userEmail,
        userIdForDb, 
        datum
      });
      
      if (existingCheck.rows.length > 0) {
        // Update existing - this is final obracun (saving from draft or updating existing)
        console.log('Save obracun - Updating existing obracun:', { userEmail, userIdForDb, datumForPostgres });
        result = await query(
          `UPDATE obracuni 
           SET artikli = $3::jsonb,
               datum_raw = $4,
               saved_at = NOW()
           WHERE user_id = $1::text AND datum = $2
           RETURNING id, datum, saved_at`,
          [userIdForDb, datumForPostgres, JSON.stringify(obracunData), datumRaw]
        );
      } else {
        // Insert new - this is final obracun (saving from draft)
        console.log('Save obracun - Creating new obracun:', { userEmail, userIdForDb, datumForPostgres, datumRaw });
        result = await query(
          `INSERT INTO obracuni (user_id, datum, datum_raw, artikli, saved_at)
           VALUES ($1::text, $2, $3, $4::jsonb, NOW())
           RETURNING id, datum, saved_at`,
          [userIdForDb, datumForPostgres, datumRaw, JSON.stringify(obracunData)]
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
        userEmail,
        userIdForDb,
        datumForPostgres,
        datumRaw,
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
        createdAt: result.rows[0].saved_at,
        updatedAt: result.rows[0].saved_at,
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
async function deleteHandler(req: AuthRequest, { params }: { params: Promise<{ userId: string }> }): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Email je glavni identifikator - koristimo email iz JWT tokena
    // Fallback: ako userId nije email, koristimo req.user.email ili pokušavamo da nađemo korisnika po userId
    let userEmail = req.user.email || req.user.userId;
    const { userId: requestedUserId } = await params; // Next.js 15 requires await for params
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    // Ako userId nije email format, pokušaj da nađeš email iz baze
    if (!emailRegex.test(userEmail) && !uuidRegex.test(userEmail)) {
      console.log('Delete obracun - userId is not email format, trying to find user by userId:', userEmail);
      try {
        // Pokušaj da nađeš korisnika po ID-u (možda je stari format)
        const userLookup = await query(
          'SELECT email FROM users WHERE id::text = $1 OR email = $1 LIMIT 1',
          [req.user.userId]
        );
        if (userLookup.rows.length > 0) {
          userEmail = userLookup.rows[0].email;
          console.log('Delete obracun - Found email for userId:', req.user.userId, '->', userEmail);
        } else {
          // Ako ne može da nađe po userId, koristi req.user.email ako postoji
          if (req.user.email && emailRegex.test(req.user.email)) {
            userEmail = req.user.email;
            console.log('Delete obracun - Using req.user.email:', userEmail);
          } else {
            console.error('Delete obracun - Cannot resolve userId to email:', req.user.userId, 'req.user:', req.user);
            return NextResponse.json(
              { 
                error: 'Invalid user ID format. Please log out and log in again.', 
                message: `Cannot resolve userId ${req.user.userId} to email`
              },
              { status: 400 }
            );
          }
        }
      } catch (lookupError: any) {
        console.error('Delete obracun - Error looking up user by userId:', lookupError);
        // Ako ima email u req.user, koristi ga
        if (req.user.email && emailRegex.test(req.user.email)) {
          userEmail = req.user.email;
          console.log('Delete obracun - Using req.user.email as fallback:', userEmail);
        } else {
          return NextResponse.json(
            { 
              error: 'Failed to resolve user ID', 
              message: lookupError.message
            },
            { status: 500 }
          );
        }
      }
    }
    
    console.log('Delete obracun - Final userEmail:', userEmail, 'Requested userId:', requestedUserId);

    // Resolv-ujemo email u ID za SQL upite (baza koristi text u user_id koloni, ne UUID)
    let userIdForDb: string;
    
    // Ako je userEmail email format, pronađi ID korisnika
    if (emailRegex.test(userEmail)) {
      const userResult = await query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [userEmail]
      );
      
      if (userResult.rows.length === 0) {
        console.error('Delete obracun - User not found for email:', userEmail);
        return NextResponse.json(
          { 
            error: 'User not found. Please log out and log in again.', 
            message: `User with email ${userEmail} not found in database`
          },
          { status: 404 }
        );
      }
      
      userIdForDb = userResult.rows[0].id;
      console.log('Delete obracun - Resolved email to ID:', userEmail, '->', userIdForDb);
    } else {
      // Ako nije email, koristi direktno kao ID (može biti bilo šta - text format)
      userIdForDb = userEmail;
      console.log('Delete obracun - Using userEmail directly as ID:', userIdForDb);
    }
    
    // Provjeri dozvole - korisnik može brisati samo svoje obračune (ili owner može sve)
    if (!req.user.isOwner) {
      // Provjeri da li requested userId odgovara logovanom korisniku
      const userEmailLower = userEmail.toLowerCase();
      let requestedUserEmail: string | null = null;
      
      if (emailRegex.test(requestedUserId)) {
        requestedUserEmail = requestedUserId.toLowerCase();
      } else {
        // Ako nije email, pokušaj da nađeš email po ID-u
        const reqUserResult = await query(
          'SELECT email FROM users WHERE id::text = $1 LIMIT 1',
          [requestedUserId]
        );
        if (reqUserResult.rows.length > 0) {
          requestedUserEmail = reqUserResult.rows[0].email.toLowerCase();
        }
      }
      
      if (requestedUserEmail && requestedUserEmail !== userEmailLower) {
        return NextResponse.json(
          { error: 'Forbidden - You can only delete your own obracuni' },
          { status: 403 }
        );
      }
    }

    const { searchParams } = new URL(req.url);
    let datum = searchParams.get('datum');

    if (!datum) {
      return NextResponse.json(
        { error: 'datum query parameter is required' },
        { status: 400 }
      );
    }

    // Clean datum - ukloni tačku sa kraja ako postoji (format: DD.MM.YYYY)
    datum = cleanDatum(datum);

    await query(
      'DELETE FROM obracuni WHERE user_id = $1::text AND datum = $2',
      [userIdForDb, datum]
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

export const GET = (req: NextRequest, context: { params: Promise<{ userId: string }> }) => {
  return withAuth((authReq: AuthRequest) => getHandler(authReq, context))(req);
};

export const POST = (req: NextRequest, context: { params: Promise<{ userId: string }> }) => {
  return withAuth((authReq: AuthRequest) => postHandler(authReq, context))(req);
};

export const DELETE = (req: NextRequest, context: { params: Promise<{ userId: string }> }) => {
  return withAuth((authReq: AuthRequest) => deleteHandler(authReq, context))(req);
};

