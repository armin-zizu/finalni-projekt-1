import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

// DELETE - Delete session
async function deleteHandler(req: AuthRequest, { params }: { params: { userId: string; sessionId: string } }): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = params.userId;
    const sessionId = params.sessionId;

    // Check if user can delete sessions
    if (req.user.userId !== userId && !req.user.isOwner) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    await query(
      'DELETE FROM sessions WHERE user_id = $1 AND id = $2',
      [userId, sessionId]
    );

    return NextResponse.json({ success: true, message: 'Session deleted' });
  } catch (error: any) {
    console.error('Delete session error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export const DELETE = (req: NextRequest, context: { params: { userId: string; sessionId: string } }) => {
  return withAuth((authReq: AuthRequest) => deleteHandler(authReq, context))(req);
};

