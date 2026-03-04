import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

// DELETE - Soft delete supplier (sets deleted_at)
async function deleteHandler(
  req: AuthRequest,
  { params }: { params: Promise<{ userId: string; supplierId: string }> | { userId: string; supplierId: string } }
): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    let userId = resolvedParams.userId;
    const supplierId = resolvedParams.supplierId;

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
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
    }

    // Check if user can access
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
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    console.log('🗑️ Soft deleting supplier:', supplierId, 'for user:', userId);

    // Soft delete - set deleted_at timestamp
    const result = await query(
      `UPDATE suppliers 
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id::text = $1 AND user_id::text = $2
       RETURNING id, name`,
      [supplierId, userId]
    );

    if (result.rows.length === 0) {
      console.log('⚠️ Supplier not found:', supplierId);
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    console.log('✅ Supplier deleted:', result.rows[0].id);
    return NextResponse.json({ message: 'Supplier deleted successfully' });
  } catch (error: any) {
    console.error('❌ Delete supplier error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export const DELETE = (req: NextRequest, context: any) => {
  return withAuth((authReq: AuthRequest) => deleteHandler(authReq, context))(req);
};
