import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// Ensure uploads directory exists
const UPLOADS_DIR = join(process.cwd(), 'public', 'uploads');

async function ensureUploadsDir() {
  if (!existsSync(UPLOADS_DIR)) {
    await mkdir(UPLOADS_DIR, { recursive: true });
  }
}

// POST - Upload file
async function postHandler(req: AuthRequest): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await ensureUploadsDir();

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const fileType = formData.get('fileType') as string || 'document';
    const obracunDatum = formData.get('obracunDatum') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Resolve userId - može biti email ili ID
    let userId: string = req.user.userId || req.user.email || '';
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID not found' },
        { status: 401 }
      );
    }
    
    // Ako je email, pronađi ID korisnika
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(userId)) {
      try {
        const userResult = await query(
          'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
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
    
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop() || 'bin';
    const safeFilename = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    // Create user-specific directory
    const userDir = join(UPLOADS_DIR, userId);
    if (!existsSync(userDir)) {
      await mkdir(userDir, { recursive: true });
    }

    // If obracunDatum is provided, create subdirectory for that date
    let filePath: string;
    if (obracunDatum) {
      const obracunDir = join(userDir, 'obracuni', obracunDatum);
      if (!existsSync(obracunDir)) {
        await mkdir(obracunDir, { recursive: true });
      }
      filePath = join(obracunDir, safeFilename);
    } else {
      filePath = join(userDir, safeFilename);
    }

    // Convert File to Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Write file to disk
    await writeFile(filePath, buffer);

    // Save file info to database (if table exists, otherwise just return file info)
    // Normalizuj putanju - ukloni process.cwd() i 'public', zadrži samo relativni put
    // Windows putanje koriste \ ali mi trebamo / za URL
    let relativePath = filePath.replace(process.cwd(), '').replace(/\\/g, '/');
    
    // Ukloni /public ako postoji na početku
    if (relativePath.startsWith('/public/')) {
      relativePath = relativePath.substring('/public'.length);
    } else if (relativePath.startsWith('public/')) {
      relativePath = '/' + relativePath.substring('public'.length);
    }
    
    // Ako sadrži uploads, ekstraktuj deo od /uploads/
    if (relativePath.includes('/uploads/')) {
      const uploadsIndex = relativePath.indexOf('/uploads/');
      relativePath = relativePath.substring(uploadsIndex);
    }
    
    // Osiguraj da počinje sa /
    if (!relativePath.startsWith('/')) {
      relativePath = '/' + relativePath;
    }
    
    console.log('Upload file - Original path:', filePath, 'Normalized relative path:', relativePath);
    
    try {
      const result = await query(
        `INSERT INTO file_uploads (user_id, filename, file_path, file_size, mime_type, file_type)
         VALUES ($1::uuid, $2, $3, $4, $5, $6)
         RETURNING id, filename, file_path, file_size, mime_type, file_type, created_at`,
        [
          userId,
          file.name,
          relativePath,
          file.size,
          file.type,
          fileType,
        ]
      );

      const uploadedFile = result.rows[0];

      return NextResponse.json({
        success: true,
        file: {
          id: uploadedFile.id,
          filename: uploadedFile.filename,
          url: relativePath, // URL relative to public folder
          fileSize: parseInt(uploadedFile.file_size),
          mimeType: uploadedFile.mime_type,
          fileType: uploadedFile.file_type,
          createdAt: uploadedFile.created_at,
        },
      });
    } catch (dbError: any) {
      // Ako tabela ne postoji, vrati samo file info bez baze
      console.warn('File_uploads table not found or error saving to DB, returning file info without DB record:', dbError.message);
      
      return NextResponse.json({
        success: true,
        file: {
          id: `temp_${Date.now()}`,
          filename: file.name,
          url: relativePath, // URL relative to public folder
          fileSize: file.size,
          mimeType: file.type,
          fileType: fileType,
          createdAt: new Date().toISOString(),
        },
      });
    }
  } catch (error: any) {
    console.error('Upload file error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// GET - Get files for user
async function getHandler(req: AuthRequest): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Resolve userId - može biti email ili ID
    let userId: string = req.user.userId || req.user.email || '';
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID not found' },
        { status: 401 }
      );
    }
    
    // Ako je email, pronađi ID korisnika
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(userId)) {
      try {
        const userResult = await query(
          'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
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
    const { searchParams } = new URL(req.url);
    const fileType = searchParams.get('fileType');
    const obracunDatum = searchParams.get('obracunDatum');

      let sql = `SELECT id, filename, file_path, file_size, mime_type, file_type, created_at
                 FROM file_uploads
                 WHERE user_id::text = $1::text`;
    const queryParams: any[] = [userId];

    if (fileType) {
      sql += ' AND file_type = $2';
      queryParams.push(fileType);
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, queryParams);

    let files = result.rows.map(row => ({
      id: row.id,
      filename: row.filename,
      url: row.file_path,
      fileSize: parseInt(row.file_size),
      mimeType: row.mime_type,
      fileType: row.file_type,
      createdAt: row.created_at,
    }));

    // Filter by obracunDatum if provided (filter in application since it's in path)
    if (obracunDatum) {
      files = files.filter(file => file.url.includes(`obracuni/${obracunDatum}`));
    }

    return NextResponse.json({ files });
  } catch (error: any) {
    console.error('Get files error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete file
async function deleteHandler(req: AuthRequest): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Resolve userId - može biti email ili ID
    let userId: string = req.user.userId || req.user.email || '';
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID not found' },
        { status: 401 }
      );
    }
    
    // Ako je email, pronađi ID korisnika
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(userId)) {
      try {
        const userResult = await query(
          'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
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
    const { searchParams } = new URL(req.url);
    const fileUrl = searchParams.get('url');

    if (!fileUrl) {
      return NextResponse.json(
        { error: 'File URL is required' },
        { status: 400 }
      );
    }

    try {
      // Find file in database by file_path
      const result = await query(
        `SELECT id, file_path FROM file_uploads 
         WHERE user_id::text = $1::text AND file_path = $2`,
        [userId, fileUrl]
      );

      if (result.rows.length === 0) {
        // Pokušaj da obrišeš direktno sa diska ako nije u bazi
        const filePath = join(process.cwd(), 'public', fileUrl);
        if (existsSync(filePath)) {
          await unlink(filePath);
        }
        return NextResponse.json({ success: true, message: 'File deleted from disk (not in DB)' });
      }

      const fileRecord = result.rows[0];
      const filePath = join(process.cwd(), 'public', fileRecord.file_path);

      // Delete file from disk
      try {
        if (existsSync(filePath)) {
          await unlink(filePath);
        }
      } catch (error: any) {
        console.warn('Failed to delete file from disk:', error);
        // Continue with database deletion even if file deletion fails
      }

      // Delete record from database
      await query(
        `DELETE FROM file_uploads WHERE id = $1`,
        [fileRecord.id]
      );

      return NextResponse.json({ success: true });
    } catch (dbError: any) {
      // Ako tabela ne postoji, pokušaj da obrišeš samo sa diska
      console.warn('File_uploads table not found, deleting from disk only:', dbError.message);
      const filePath = join(process.cwd(), 'public', fileUrl);
      try {
        if (existsSync(filePath)) {
          await unlink(filePath);
        }
      } catch (error: any) {
        console.warn('Failed to delete file from disk:', error);
      }
      return NextResponse.json({ success: true, message: 'File deleted from disk (DB not available)' });
    }
  } catch (error: any) {
    console.error('Delete file error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export const POST = withAuth(postHandler);
export const GET = withAuth(getHandler);
export const DELETE = withAuth(deleteHandler);

