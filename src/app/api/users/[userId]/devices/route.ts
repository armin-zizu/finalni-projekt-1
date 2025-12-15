import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

// GET - Get all devices for user
async function getHandler(req: AuthRequest, { params }: { params: { userId: string } }): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let userId = params.userId;

    // If userId is not a UUID, try to find the actual UUID from database
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(userId)) {
      console.log('Get devices - Non-UUID userId detected, looking up in database:', userId);
      try {
        // First try to find by id (in case it's an old ID format)
        let userResult = await query(
          'SELECT id FROM users WHERE id = $1 LIMIT 1',
          [userId]
        );
        
        // If not found by id, try to find by email
        if (userResult.rows.length === 0) {
          userResult = await query(
            'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
            [userId]
          );
        }
        
        if (userResult.rows.length > 0) {
          userId = userResult.rows[0].id;
          console.log('Get devices - Found UUID for user:', userId);
        } else {
          console.error('Get devices - User not found:', userId);
          return NextResponse.json(
            { error: 'User not found. Invalid user ID format.', userId: params.userId },
            { status: 404 }
          );
        }
      } catch (lookupError: any) {
        console.error('Get devices - Error looking up user:', lookupError);
        return NextResponse.json(
          { error: 'Failed to resolve user ID', message: lookupError.message },
          { status: 500 }
        );
      }
    }

    // Check if user can access devices (compare with resolved UUID)
    const requestUserId = req.user.userId;
    const uuidRegex2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let requestUserIdResolved = requestUserId;
    
    if (!uuidRegex2.test(requestUserId)) {
      const userResult = await query(
        'SELECT id FROM users WHERE id = $1 OR LOWER(email) = LOWER($1) LIMIT 1',
        [requestUserId]
      );
      if (userResult.rows.length > 0) {
        requestUserIdResolved = userResult.rows[0].id;
      }
    }
    
    if (requestUserIdResolved !== userId && !req.user.isOwner) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const result = await query(
      `SELECT id, device_id, device_name, device_info, role, permissions, is_blocked, last_login, status, created_at, updated_at
       FROM devices
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    const devices = result.rows.map(row => ({
      id: row.id,
      deviceId: row.device_id,
      deviceName: row.device_name,
      deviceInfo: row.device_info || {},
      role: row.role,
      permissions: row.permissions || {},
      isBlocked: row.is_blocked,
      lastLogin: row.last_login,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ devices });
  } catch (error: any) {
    console.error('Get devices error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// POST - Create or update device
async function postHandler(req: AuthRequest, { params }: { params: { userId: string } }): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let userId = params.userId;

    // If userId is not a UUID, try to find the actual UUID from database
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(userId)) {
      console.log('Save device - Non-UUID userId detected, looking up in database:', userId);
      try {
        // First try to find by id (in case it's an old ID format)
        let userResult = await query(
          'SELECT id FROM users WHERE id = $1 LIMIT 1',
          [userId]
        );
        
        // If not found by id, try to find by email
        if (userResult.rows.length === 0) {
          userResult = await query(
            'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
            [userId]
          );
        }
        
        if (userResult.rows.length > 0) {
          userId = userResult.rows[0].id;
          console.log('Save device - Found UUID for user:', userId);
        } else {
          console.error('Save device - User not found:', userId);
          return NextResponse.json(
            { error: 'User not found. Invalid user ID format.', userId: params.userId },
            { status: 404 }
          );
        }
      } catch (lookupError: any) {
        console.error('Save device - Error looking up user:', lookupError);
        return NextResponse.json(
          { error: 'Failed to resolve user ID', message: lookupError.message },
          { status: 500 }
        );
      }
    }

    // Check if user can modify devices (compare with resolved UUID)
    const requestUserId = req.user.userId;
    const uuidRegex2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let requestUserIdResolved = requestUserId;
    
    if (!uuidRegex2.test(requestUserId)) {
      const userResult = await query(
        'SELECT id FROM users WHERE id = $1 OR LOWER(email) = LOWER($1) LIMIT 1',
        [requestUserId]
      );
      if (userResult.rows.length > 0) {
        requestUserIdResolved = userResult.rows[0].id;
      }
    }
    
    if (requestUserIdResolved !== userId && !req.user.isOwner) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { deviceId, deviceName, deviceInfo, role, permissions, isBlocked, status } = body;

    if (!deviceId) {
      return NextResponse.json(
        { error: 'deviceId is required' },
        { status: 400 }
      );
    }

    // Upsert device
    const result = await query(
      `INSERT INTO devices (user_id, device_id, device_name, device_info, role, permissions, is_blocked, status, last_login, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       ON CONFLICT (device_id) DO UPDATE
       SET device_name = EXCLUDED.device_name,
           device_info = EXCLUDED.device_info,
           role = EXCLUDED.role,
           permissions = EXCLUDED.permissions,
           is_blocked = EXCLUDED.is_blocked,
           status = EXCLUDED.status,
           last_login = NOW(),
           updated_at = NOW()
       RETURNING id, device_id, device_name, device_info, role, permissions, is_blocked, status, last_login, created_at, updated_at`,
      [
        userId,
        deviceId,
        deviceName || null,
        deviceInfo ? JSON.stringify(deviceInfo) : null,
        role || null,
        permissions ? JSON.stringify(permissions) : '{}',
        isBlocked || false,
        status || 'pending',
      ]
    );

    const device = result.rows[0];

    return NextResponse.json({
      success: true,
      device: {
        id: device.id,
        deviceId: device.device_id,
        deviceName: device.device_name,
        deviceInfo: device.device_info || {},
        role: device.role,
        permissions: device.permissions || {},
        isBlocked: device.is_blocked,
        status: device.status,
        lastLogin: device.last_login,
        createdAt: device.created_at,
        updatedAt: device.updated_at,
      },
    });
  } catch (error: any) {
    console.error('Save device error:', error);
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

