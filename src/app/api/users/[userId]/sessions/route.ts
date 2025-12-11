import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

// GET - Get all sessions for user
async function getHandler(req: AuthRequest, { params }: { params: { userId: string } }): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = params.userId;

    // Check if user can access sessions
    if (req.user.userId !== userId && !req.user.isOwner) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // 'active' or 'ended'

    let sql = `SELECT id, device_id, session_name, date, status, device, location, ip, created_at
               FROM sessions
               WHERE user_id = $1`;
    const queryParams: any[] = [userId];

    if (status) {
      sql += ' AND status = $2';
      queryParams.push(status);
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, queryParams);

    const sessions = result.rows.map(row => ({
      id: row.id,
      deviceId: row.device_id,
      sessionName: row.session_name,
      date: row.date,
      status: row.status,
      device: row.device,
      location: row.location,
      ip: row.ip,
      createdAt: row.created_at,
    }));

    return NextResponse.json({ sessions });
  } catch (error: any) {
    console.error('Get sessions error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// POST - Create session
async function postHandler(req: AuthRequest, { params }: { params: { userId: string } }): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = params.userId;

    // Check if user can create sessions
    if (req.user.userId !== userId && !req.user.isOwner) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { deviceId, sessionName, date, device, location, ip, status = 'active' } = body;

    if (!deviceId) {
      return NextResponse.json(
        { error: 'deviceId is required' },
        { status: 400 }
      );
    }

    // Deactivate old active sessions for this device
    await query(
      `UPDATE sessions
       SET status = 'ended'
       WHERE user_id = $1 AND device_id = $2 AND status = 'active'`,
      [userId, deviceId]
    );

    // Create new session
    const result = await query(
      `INSERT INTO sessions (user_id, device_id, session_name, date, status, device, location, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, device_id, session_name, date, status, device, location, ip, created_at`,
      [userId, deviceId, sessionName || null, date || null, status, device || null, location || null, ip || null]
    );

    const session = result.rows[0];

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        deviceId: session.device_id,
        sessionName: session.session_name,
        date: session.date,
        status: session.status,
        device: session.device,
        location: session.location,
        ip: session.ip,
        createdAt: session.created_at,
      },
    });
  } catch (error: any) {
    console.error('Create session error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export const GET = (req: NextRequest, context: { params: { userId: string } }) => {
  return withAuth((authReq: AuthRequest) => getHandler(authReq, context))(req);
};

export const POST = (req: NextRequest, context: { params: { userId: string } }) => {
  return withAuth((authReq: AuthRequest) => postHandler(authReq, context))(req);
};

