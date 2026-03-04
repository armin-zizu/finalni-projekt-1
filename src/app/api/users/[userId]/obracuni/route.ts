import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

// Helper funkcija za čišćenje datuma - uklanja tačku sa kraja ako postoji
// Datum se čuva kao text u formatu DD.MM.YYYY (bez tačke na kraju)
function cleanDatum(datum: string): string {
  return datum.toString().replace(/\.$/, ''); // Remove trailing dot if present
}

function isLockTimeoutError(error: any): boolean {
  const message = (error?.message || '').toLowerCase();
  return (
    error?.code === '55P03' ||
    message.includes('lock timeout') ||
    message.includes('could not obtain lock') ||
    message.includes('canceling statement due to lock timeout')
  );
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
    
    sql = `SELECT user_id, datum, artikli
           FROM obracuni
          WHERE user_id::text = $1`;
    
    if (cleanedDatumForPostgres) {
      sql += ' AND datum = $2';
      queryParams.push(cleanedDatumForPostgres);
    }

    // VAŽNO: Draft obračuni se čuvaju u bazi sa isAzuriran: true u JSONB polju
    // Ne filtriramo draft obračune - vraćamo sve obračune (finalni i draft)
    // Frontend će sam filtrirati šta treba prikazati u arhivi
    // Draft obračuni (isAzuriran: true) se koriste za privremeno čuvanje do završetka obračuna
    
    // Sortiranje po datumu - datum kolona je već date tip, možemo direktno sortirati
    sql += ` ORDER BY datum DESC NULLS LAST`;

    console.log('Get obracuni - userEmail:', userEmail, 'userIdForDb:', userIdForDb, 'SQL:', sql, 'params:', queryParams);
    
    let result;
    try {
      result = await query(sql, queryParams);
      console.log('Get obracuni - result rows:', result.rows.length, 'first row sample:', result.rows[0] ? { user_id: result.rows[0].user_id, datum: result.rows[0].datum } : null);
      
      // AUTOMATSKO BRIŠANJE STARIH DRAFT OBRACUNA (stariji od 12 sati nakon završetka datuma)
      // Draft obračun se briše 12 sati nakon završetka datuma (npr. za datum 19.12.2025, briše se 20.12.2025 u 12:00)
      try {
        // Koristi PostgreSQL funkcije za precizno računanje expiration time-a
        // Kraj dana = datum + INTERVAL '1 day' - INTERVAL '1 second' (23:59:59)
        // Expiration = kraj dana + INTERVAL '12 hours' (12:00 sljedeći dan)
        await query(
          `DELETE FROM obracuni 
           WHERE user_id::text = $1 
           AND COALESCE((artikli->>'isAzuriran')::text, 'false') = 'true'
           AND NOW() > (datum::timestamp + INTERVAL '1 day' - INTERVAL '1 second' + INTERVAL '12 hours')`,
          [userIdForDb]
        );
        console.log('Get obracuni - Automatsko brisanje starih draft obračuna završeno');
      } catch (deleteError: any) {
        console.warn('Get obracuni - Greška pri brisanju starih draft-ova (nastavlja se normalno):', deleteError.message);
        // Ne zaustavlja proces - samo loguj grešku
      }
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
      
      // VAŽNO: Draft obračuni (isAzuriran: true) se NE konvertuju automatski u finalni
      // Draft obračuni treba da ostanu draft sve dok korisnik ne klikne "Sačuvaj obračun"
      // Draft obračuni su namijenjeni za privremeno čuvanje dok korisnik radi na obračunu
      // Finalni obračun (isAzuriran: false) je onaj koji se prikazuje u arhivi
      // Draft obračun traje 12 sati nakon završetka datuma - automatski se briše
      
      // Ne menjamo isAzuriran status - ostaje kako je sačuvan
      
      // Formatiraj datum u DD.MM.YYYY format za frontend
      // VAŽNO: Koristimo string manipulaciju umjesto Date objekta da se izbjegne timezone pomak
      let formattedDatum: string;
      if (row.datum) {
        // Ako postoji datum_raw, koristi ga direktno (već je u DD.MM.YYYY formatu)
        if (row.datum_raw) {
          formattedDatum = row.datum_raw.endsWith('.') ? row.datum_raw : row.datum_raw + '.';
        } else if (typeof row.datum === 'string') {
          // Ako je string u YYYY-MM-DD formatu (PostgreSQL DATE tip vraća ovako), konvertuj u DD.MM.YYYY. bez Date objekta
          // Ovo izbjegava timezone konverziju koja može uzrokovati pomak od jednog dana
          if (row.datum.match(/^\d{4}-\d{2}-\d{2}/)) {
            const parts = row.datum.split('-');
            if (parts.length >= 3) {
              const [godina, mjesec, dan] = parts;
              formattedDatum = `${dan}.${mjesec}.${godina}.`;
            } else {
              formattedDatum = row.datum;
            }
          } else {
            // Ako već ima DD.MM.YYYY format, dodaj tačku na kraju ako nema
            formattedDatum = row.datum.endsWith('.') ? row.datum : row.datum + '.';
          }
        } else if (row.datum instanceof Date) {
          // Ako je Date objekat, koristi lokalne metode (ne UTC) - ali ovo bi trebalo biti rijetko
          const dan = String(row.datum.getDate()).padStart(2, '0');
          const mjesec = String(row.datum.getMonth() + 1).padStart(2, '0');
          const godina = row.datum.getFullYear();
          formattedDatum = `${dan}.${mjesec}.${godina}.`;
        } else {
          formattedDatum = row.datum.toString();
        }
      } else {
        formattedDatum = row.datum_raw || '';
      }
      
      console.log('Get obracuni - Parsed artikliData for row:', row.user_id, 'has artikli:', Array.isArray(artikliData.artikli), 'artikli count:', artikliData.artikli?.length || 0, 'isAzuriran:', artikliData.isAzuriran, 'datum:', formattedDatum);
      
      // Flatten strukturu - vraćamo artikli, rashodi, prihodi direktno na root level
      return {
        id: `${row.user_id}_${formattedDatum}`, // Use composite key as id
        datum: formattedDatum, // Formatiran datum u DD.MM.YYYY. formatu
        isAzuriran: artikliData.isAzuriran || false,
        artikli: artikliData.artikli || [],
        rashodi: artikliData.rashodi || [],
        prihodi: artikliData.prihodi || [],
        ukupnoArtikli: artikliData.ukupnoArtikli || 0,
        ukupnoRashod: artikliData.ukupnoRashod || 0,
        ukupnoPrihod: artikliData.ukupnoPrihod || 0,
        neto: artikliData.neto || 0,
        imaUlaz: artikliData.imaUlaz || false,
        invoiceImages: artikliData.invoiceImages || [],
        isDraft: false, // All obracuni in database are final (no is_draft column)
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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

    let body;
    try {
      body = await req.json();
      console.log('Save obracun - Request body received:', {
        hasDatum: !!body.datum,
        artikliCount: Array.isArray(body.artikli) ? body.artikli.length : 0,
        rashodiCount: Array.isArray(body.rashodi) ? body.rashodi.length : 0,
        prihodiCount: Array.isArray(body.prihodi) ? body.prihodi.length : 0,
        invoiceImagesCount: Array.isArray(body.invoiceImages) ? body.invoiceImages.length : 0,
        isAzuriran: body.isAzuriran,
        isDraft: body.isDraft
      });
    } catch (parseError: any) {
      console.error('Save obracun - JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body', message: parseError.message },
        { status: 400 }
      );
    }

    let { datum, artikli, rashodi, prihodi, ukupnoArtikli, ukupnoRashod, ukupnoPrihod, neto, isAzuriran, imaUlaz, invoiceImages, isDraft } = body;

    if (!datum) {
      return NextResponse.json(
        { error: 'datum is required' },
        { status: 400 }
      );
    }

    // Provjeri da li su artikli, rashodi, prihodi arrayi
    if (!Array.isArray(artikli)) {
      artikli = [];
    }
    if (!Array.isArray(rashodi)) {
      rashodi = [];
    }
    if (!Array.isArray(prihodi)) {
      prihodi = [];
    }
    if (!Array.isArray(invoiceImages)) {
      invoiceImages = [];
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

    // Normalizuj invoiceImages URL-ove - ukloni file:/// i apsolutne putanje
    let normalizedInvoiceImages: string[] = [];
    if (invoiceImages && Array.isArray(invoiceImages)) {
      normalizedInvoiceImages = invoiceImages.map((url: string) => {
        if (!url) return url;
        // Ako već počinje sa / ili http, vrati kao jeste
        if (url.startsWith('/') || url.startsWith('http')) {
          return url;
        }
        // Ukloni file:/// protokol
        if (url.startsWith('file:///')) {
          const uploadsIndex = url.indexOf('/uploads/');
          if (uploadsIndex !== -1) {
            return url.substring(uploadsIndex);
          }
          const publicIndex = url.indexOf('/public/');
          if (publicIndex !== -1) {
            return url.substring(publicIndex + '/public'.length);
          }
        }
        // Ako sadrži uploads, ekstraktuj relativni put
        if (url.includes('/uploads/')) {
          const uploadsIndex = url.indexOf('/uploads/');
          return url.substring(uploadsIndex);
        }
        // Ako nije relativni put, dodaj /uploads/
        if (!url.startsWith('/')) {
          return url.startsWith('uploads/') ? `/${url}` : `/uploads/${url}`;
        }
        return url;
      });
    }
    
    console.log('Save obracun - Invoice images:', {
      original: invoiceImages,
      normalized: normalizedInvoiceImages,
      count: normalizedInvoiceImages.length
    });

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
      invoiceImages: normalizedInvoiceImages || [],
    };
    
    const obracunDataJson = JSON.stringify(obracunData);

    // Stabilno čuvanje bez UPDATE nad obracuni (u nekim bazama postoji trigger koji očekuje updated_at)
    // Strategija: DELETE postojeći zapis za datum + INSERT novog zapisa
    let result;
    try {
      const maxAttempts = 5;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await query(
            `DELETE FROM obracuni
             WHERE user_id::text = $1
             AND datum = $2`,
            [userIdForDb, datumForPostgres]
          );

          result = await query(
            `INSERT INTO obracuni (user_id, datum, artikli)
             VALUES ($1, $2, $3::jsonb)
             ON CONFLICT (user_id, datum) DO UPDATE
             SET artikli = EXCLUDED.artikli
             RETURNING user_id, datum, artikli`,
            [userIdForDb, datumForPostgres, obracunDataJson]
          );

          break;
        } catch (saveError: any) {
          const retryable = isLockTimeoutError(saveError) || saveError?.code === '23505';
          const isLastAttempt = attempt === maxAttempts;

          if (!retryable || isLastAttempt) {
            throw saveError;
          }

          const waitMs = 200 * attempt;
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
      }

      if (!result || result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Database error', message: 'Obračun nije sačuvan.' },
          { status: 500 }
        );
      }
    } catch (dbError: any) {
      if (isLockTimeoutError(dbError)) {
        return NextResponse.json(
          { error: 'Podaci su trenutno zauzeti, pokušajte ponovo za par sekundi.', code: 'LOCK_TIMEOUT' },
          { status: 409 }
        );
      }

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
        isAzuriran,
        obracunDataSize: obracunDataJson?.length || 0,
        invoiceImagesCount: normalizedInvoiceImages?.length || 0,
        stack: dbError.stack
      });
      return NextResponse.json(
        { 
          error: 'Database error', 
          message: dbError.message,
          detail: dbError.detail || dbError.hint || 'Please check server logs for more details',
          code: dbError.code
        },
        { status: 500 }
      );
    }

    // Format datum from YYYY-MM-DD to DD.MM.YYYY format
    let formattedDatum = '';
    if (result.rows[0].datum) {
      const parts = result.rows[0].datum.split('-');
      if (parts.length === 3) {
        const [godina, mjesec, dan] = parts;
        formattedDatum = `${dan}.${mjesec}.${godina}.`;
      } else {
        formattedDatum = result.rows[0].datum;
      }
    }

    return NextResponse.json({
      success: true,
      obracun: {
        id: `${result.rows[0].user_id}_${formattedDatum}`,
        datum: formattedDatum,
        isDraft: false, // is_draft column doesn't exist, all obracuni are final
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Save obracun error:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      stack: error.stack,
      name: error.name,
      // Dodaj i response ako postoji
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      } : null
    });
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: error.message || 'Unknown error',
        detail: error.detail || error.hint || 'Please check server logs for more details',
        code: error.code
      },
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
    const cleanedDatum = cleanDatum(datum);
    
    // Konvertuj DD.MM.YYYY u YYYY-MM-DD format za PostgreSQL date tip
    const parts = cleanedDatum.split('.');
    if (parts.length !== 3) {
      return NextResponse.json(
        { error: 'Invalid date format. Expected DD.MM.YYYY' },
        { status: 400 }
      );
    }
    const [dan, mjesec, godina] = parts;
    const datumForPostgres = `${godina}-${mjesec.padStart(2, '0')}-${dan.padStart(2, '0')}`; // YYYY-MM-DD

    await query(
      'DELETE FROM obracuni WHERE user_id::text = $1 AND datum = $2',
      [userIdForDb, datumForPostgres]
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

export const GET = (req: NextRequest, context: any) => {
  return withAuth((authReq: AuthRequest) => getHandler(authReq, context))(req);
};

export const POST = (req: NextRequest, context: any) => {
  return withAuth((authReq: AuthRequest) => postHandler(authReq, context))(req);
};

export const DELETE = (req: NextRequest, context: any) => {
  return withAuth((authReq: AuthRequest) => deleteHandler(authReq, context))(req);
};

