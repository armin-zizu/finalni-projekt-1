import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

async function putHandler(
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
    // Samo gitara.zizu@gmail.com ima pristup admin panelu (ne bilo koji owner)
    const isAdmin = currentUser.email === ADMIN_EMAIL;

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const { userId } = await params;

    // Check if target user exists
    const targetUserResult = await query(
      `SELECT id, email, is_owner FROM users WHERE id = $1`,
      [userId]
    );

    if (targetUserResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Target user not found' },
        { status: 404 }
      );
    }

    // Update user as owner
    await query(
      `UPDATE users SET is_owner = TRUE, role = 'vlasnik', updated_at = NOW() WHERE id = $1`,
      [userId]
    );

    // Update all devices for this user to have role "vlasnik"
    await query(
      `UPDATE devices 
       SET role = 'vlasnik', 
           status = 'approved',
           permissions = '{"dashboard": true, "obracun": true, "arhiva": true, "cjenovnik": true, "profit": true, "profile": true, "admin": false}'::jsonb,
           updated_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );

    // Get updated user
    const updatedUserResult = await query(
      `SELECT id, email, app_name, role, is_owner, permissions, created_at, updated_at
       FROM users WHERE id = $1`,
      [userId]
    );

    const user = updatedUserResult.rows[0];

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        appName: user.app_name,
        role: user.role,
        isOwner: user.is_owner,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
    });
  } catch (error: any) {
    console.error('Set user as owner error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  return withAuth((authReq) => putHandler(authReq, { params }))(req);
}

