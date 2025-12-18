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

    // Check if user is admin - use email from JWT token (more reliable)
    const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "gitara.zizu@gmail.com";
    const userEmail = req.user.email || '';
    const adminEmailLower = ADMIN_EMAIL.toLowerCase().trim();
    const userEmailLower = (userEmail || "").toLowerCase().trim();
    const isAdmin = userEmail && userEmailLower === adminEmailLower;

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

    // Delete user and ALL related data - explicit deletion to ensure complete removal
    // Delete in order to respect foreign key constraints
    
    // 1. Delete obracun_artikli, obracun_prihodi, obracun_rashodi (related to obracuni)
    await query(`
      DELETE FROM obracun_artikli 
      WHERE obracun_id IN (SELECT id FROM obracuni WHERE user_id = $1)
    `, [userId]);
    
    await query(`
      DELETE FROM obracun_prihodi 
      WHERE obracun_id IN (SELECT id FROM obracuni WHERE user_id = $1)
    `, [userId]);
    
    await query(`
      DELETE FROM obracun_rashodi 
      WHERE obracun_id IN (SELECT id FROM obracuni WHERE user_id = $1)
    `, [userId]);
    
    // 2. Delete obracuni (daily reports)
    await query(`DELETE FROM obracuni WHERE user_id = $1`, [userId]);
    
    // 3. Delete cjenovnik (price list)
    await query(`DELETE FROM cjenovnik WHERE user_id = $1`, [userId]);
    
    // 4. Delete payments (payment history)
    await query(`DELETE FROM payments WHERE user_id = $1`, [userId]);
    
    // 5. Delete subscriptions
    await query(`DELETE FROM subscriptions WHERE user_id = $1`, [userId]);
    
    // 6. Delete devices
    await query(`DELETE FROM devices WHERE user_id = $1`, [userId]);
    
    // 7. Finally delete the user (this will cascade delete anything else if CASCADE is set)
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

