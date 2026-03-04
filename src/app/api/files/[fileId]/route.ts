import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// DELETE - Delete file
async function deleteHandler(req: AuthRequest, { params }: { params: { fileId: string } }): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = req.user.userId;
    const fileId = params.fileId;

    // Get file info
    const result = await query(
      `SELECT file_path FROM file_uploads WHERE id = $1 AND user_id = $2`,
      [fileId, userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    const filePath = result.rows[0].file_path;
    const fullPath = join(process.cwd(), 'public', filePath);

    // Delete file from disk
    if (existsSync(fullPath)) {
      try {
        await unlink(fullPath);
      } catch (error) {
        console.warn('Failed to delete file from disk:', error);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete file record from database
    await query(
      'DELETE FROM file_uploads WHERE id = $1 AND user_id = $2',
      [fileId, userId]
    );

    return NextResponse.json({ success: true, message: 'File deleted' });
  } catch (error: any) {
    console.error('Delete file error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export const DELETE = (req: NextRequest, context: any) => {
  return withAuth((authReq: AuthRequest) => deleteHandler(authReq, context))(req);
};

