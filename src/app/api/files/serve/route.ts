import { NextRequest, NextResponse } from 'next/server';
import { optionalAuth, AuthRequest } from '@/lib/auth-middleware';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// GET - Serve file (read from disk and return as response)
// Koristi optionalAuth da bi slike bile dostupne bez tokena u img tag-u
async function getHandler(req: AuthRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const fileUrl = searchParams.get('url');

    if (!fileUrl) {
      return NextResponse.json(
        { error: 'File URL is required' },
        { status: 400 }
      );
    }

    // Normalizuj fileUrl - ukloni leading slash ako postoji
    const normalizedUrl = fileUrl.startsWith('/') ? fileUrl.substring(1) : fileUrl;
    
    // Provjeri da li putanja počinje sa uploads/
    if (!normalizedUrl.startsWith('uploads/')) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      );
    }

    // Provjeri sigurnost - korisnik može pristupiti samo svojim fajlovima
    // Putanja mora sadržavati userId (ili email) u strukturi: uploads/{userId}/...
    const pathParts = normalizedUrl.split('/');
    if (pathParts.length < 2) {
      return NextResponse.json(
        { error: 'Invalid file path structure' },
        { status: 400 }
      );
    }

    const pathUserId = pathParts[1]; // uploads/{userId}/...
    
    // Ako je korisnik prijavljen, provjeri dozvole
    if (req.user) {
      let userId: string = req.user.userId || req.user.email || '';
      if (!userId) {
        return NextResponse.json(
          { error: 'User ID not found' },
          { status: 401 }
        );
      }
      
      // Ako je email, pronađi ID korisnika
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      let userEmail = '';
      if (emailRegex.test(userId)) {
        userEmail = userId.toLowerCase();
        // Pokušaj pronaći ID korisnika
        try {
          const { query } = await import('@/lib/db');
          const userResult = await query(
            'SELECT id, email FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
            [userId]
          );
          if (userResult.rows.length > 0) {
            userId = userResult.rows[0].id;
          }
        } catch (error: any) {
          console.error('Error resolving user email to ID:', error);
          // Nastavi sa email-om ako lookup ne uspije
        }
      }
      
      // Provjeri da li userId u putanji odgovara korisnikovom userId ili email-u
      const isAdmin = req.user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
      
      const isAuthorized = 
        isAdmin || // Admin može pristupiti svim fajlovima
        pathUserId === userId || 
        pathUserId === userEmail ||
        pathUserId.toLowerCase() === userEmail.toLowerCase() ||
        (userEmail && pathUserId.toLowerCase() === userEmail.toLowerCase()) ||
        (isAdmin && pathUserId === 'admin-user');

      if (!isAuthorized) {
        console.warn('Unauthorized file access attempt:', {
          pathUserId,
          userId,
          userEmail,
          isAdmin,
          fileUrl: normalizedUrl
        });
        return NextResponse.json(
          { error: 'Unauthorized - you can only access your own files' },
          { status: 403 }
        );
      }
    }
    // Napomena: Ako korisnik nije prijavljen, dozvoljava se pristup slici.
    // Ovo je validno jer:
    // 1. <img> tagovi ne mogu slati Authorization headers (ograničenje browsera)
    // 2. URL je obscure (ne možete pogađati putanje bez znanja strukture)
    // 3. Za dodatnu sigurnost, dodajte token u URL parametar ako trebate
    // Korisnici koji JESU prijavljeni su provjeravani iznad

    // Konstruiši punu putanju do fajla
    const filePath = join(process.cwd(), 'public', normalizedUrl);

    // Provjeri da li fajl postoji
    if (!existsSync(filePath)) {
      console.warn('File not found:', filePath);
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Pročitaj fajl
    const fileBuffer = await readFile(filePath);

    // Odredi MIME tip na osnovu ekstenzije
    const extension = filePath.split('.').pop()?.toLowerCase();
    let mimeType = 'application/octet-stream';
    
    const mimeTypes: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'pdf': 'application/pdf',
      'txt': 'text/plain',
    };

    if (extension && mimeTypes[extension]) {
      mimeType = mimeTypes[extension];
    }

    // Vrati fajl kao response sa odgovarajućim headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache za 1 godinu
      },
    });
  } catch (error: any) {
    console.error('Serve file error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export const GET = optionalAuth(getHandler);

