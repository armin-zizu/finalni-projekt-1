import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query, transaction } from '@/lib/db';

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
      `SELECT id, email FROM users WHERE id::text = $1`,
      [userId]
    );

    if (targetUserResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const targetUserEmail = (targetUserResult.rows[0]?.email || '').toLowerCase().trim();
    if (targetUserEmail && targetUserEmail === adminEmailLower) {
      return NextResponse.json(
        { error: 'Admin korisnik se ne može obrisati.' },
        { status: 400 }
      );
    }

    await transaction(async (client) => {
      const tableExists = async (tableName: string) => {
        const existsResult = await client.query(
          `SELECT to_regclass($1) AS regclass_name`,
          [tableName]
        );
        return !!existsResult.rows[0]?.regclass_name;
      };

      const safeDelete = async (tableName: string, sql: string, params: any[] = []) => {
        if (!(await tableExists(tableName))) return;
        await client.query(sql, params);
      };

      // Legacy detaljne tabele (ako postoje)
      await safeDelete(
        'obracun_artikli',
        `DELETE FROM obracun_artikli
         WHERE obracun_id IN (SELECT id FROM obracuni WHERE user_id::text = $1)`,
        [userId]
      );

      await safeDelete(
        'obracun_prihodi',
        `DELETE FROM obracun_prihodi
         WHERE obracun_id IN (SELECT id FROM obracuni WHERE user_id::text = $1)`,
        [userId]
      );

      await safeDelete(
        'obracun_rashodi',
        `DELETE FROM obracun_rashodi
         WHERE obracun_id IN (SELECT id FROM obracuni WHERE user_id::text = $1)`,
        [userId]
      );

      // Standardne aplikacijske tabele
      await safeDelete('support_messages', `DELETE FROM support_messages WHERE user_id::text = $1`, [userId]);
      await safeDelete('file_uploads', `DELETE FROM file_uploads WHERE user_id::text = $1`, [userId]);
      await safeDelete('sessions', `DELETE FROM sessions WHERE user_id::text = $1`, [userId]);
      await safeDelete('devices', `DELETE FROM devices WHERE user_id::text = $1`, [userId]);
      await safeDelete('payments', `DELETE FROM payments WHERE user_id::text = $1`, [userId]);
      await safeDelete('subscriptions', `DELETE FROM subscriptions WHERE user_id::text = $1`, [userId]);
      await safeDelete('cjenovnik', `DELETE FROM cjenovnik WHERE user_id::text = $1`, [userId]);
      await safeDelete('obracuni', `DELETE FROM obracuni WHERE user_id::text = $1`, [userId]);

      // Korisnik na kraju
      await client.query(`DELETE FROM users WHERE id::text = $1`, [userId]);
    });

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

