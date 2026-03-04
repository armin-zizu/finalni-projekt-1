import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

async function postHandler(req: AuthRequest): Promise<NextResponse> {
  try {
    if (!req.user?.isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log('🗑️ Cleanup request from admin:', req.user.userId);

    // Delete all suppliers for all users
    const deleteSuppliers = await query('DELETE FROM suppliers RETURNING user_id');
    console.log(`✅ Deleted ${deleteSuppliers.rowCount} suppliers`);

    return NextResponse.json({
      message: 'Cleanup completed',
      deletedSuppliers: deleteSuppliers.rowCount,
    });
  } catch (error: any) {
    console.error('❌ Cleanup error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export const POST = withAuth(postHandler);
