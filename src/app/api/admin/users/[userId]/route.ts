import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

async function deleteHandler(
  req: AuthRequest,
  { params }: { params: Promise<{ userId: string }> }
): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "gitara.zizu@gmail.com";
    const currentUserResult = await query(
      `SELECT email, is_owner FROM users WHERE id = $1`,
      [req.user.userId]
    );

    if (currentUserResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const currentUser = currentUserResult.rows[0];
    const isAdmin = currentUser.email === ADMIN_EMAIL || currentUser.is_owner === true;

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const { userId } = await params;

    // Check if target user exists
    const targetUserResult = await query(
      `SELECT id FROM users WHERE id = $1`,
      [userId]
    );

    if (targetUserResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete user and all related data (CASCADE will handle related tables)
    // Due to CASCADE constraints, deleting user will automatically delete:
    // - devices
    // - sessions
    // - cjenovnik
    // - obracuni
    // - payments
    // - subscriptions
    // - file_uploads
    
    await query(`DELETE FROM users WHERE id = $1`, [userId]);

    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error: any) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  return withAuth((authReq) => deleteHandler(authReq, { params }))(req);
}

