import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'gitara.zizu@gmail.com').toLowerCase().trim();

function isAdminEmail(email?: string | null): boolean {
  return (email || '').toLowerCase().trim() === ADMIN_EMAIL;
}

function isLockTimeoutError(error: any): boolean {
  const code = error?.code;
  const message = (error?.message || '').toLowerCase();
  return code === '55P03' || message.includes('lock timeout') || message.includes('canceling statement due to lock timeout');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// GET - Get all devices for user
async function getHandler(req: AuthRequest, { params }: { params: Promise<{ userId: string }> | { userId: string } }): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    let userId = resolvedParams.userId;

    // If userId is not a UUID, try to find the actual UUID from database
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(userId)) {
      console.log('Get devices - Non-UUID userId detected, looking up in database:', userId);
      try {
        const userResult = await query(
          'SELECT id FROM users WHERE id::text = $1 OR LOWER(email) = LOWER($1) LIMIT 1',
          [userId]
        );
        
        if (userResult.rows.length > 0) {
          userId = userResult.rows[0].id;
          console.log('Get devices - Found UUID for user:', userId);
        } else {
          console.error('Get devices - User not found:', userId);
          return NextResponse.json(
            { error: 'User not found. Invalid user ID format.', userId: resolvedParams.userId },
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
        'SELECT id FROM users WHERE id::text = $1 OR LOWER(email) = LOWER($1) LIMIT 1',
        [requestUserId]
      );
      if (userResult.rows.length > 0) {
        requestUserIdResolved = userResult.rows[0].id;
      }
    }
    
    if (requestUserIdResolved !== userId && !req.user.isOwner && !isAdminEmail(req.user.email)) {
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

    const devices = result.rows.map((row: any) => ({
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
async function postHandler(req: AuthRequest, { params }: { params: Promise<{ userId: string }> | { userId: string } }): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    let userId = resolvedParams.userId;

    // If userId is not a UUID, try to find the actual UUID from database
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(userId)) {
      console.log('Save device - Non-UUID userId detected, looking up in database:', userId);
      try {
        const userResult = await query(
          'SELECT id FROM users WHERE id::text = $1 OR LOWER(email) = LOWER($1) LIMIT 1',
          [userId]
        );
        
        if (userResult.rows.length > 0) {
          userId = userResult.rows[0].id;
          console.log('Save device - Found UUID for user:', userId);
        } else {
          console.error('Save device - User not found:', userId);
          return NextResponse.json(
            { error: 'User not found. Invalid user ID format.', userId: resolvedParams.userId },
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
        'SELECT id FROM users WHERE id::text = $1 OR LOWER(email) = LOWER($1) LIMIT 1',
        [requestUserId]
      );
      if (userResult.rows.length > 0) {
        requestUserIdResolved = userResult.rows[0].id;
      }
    }
    
    if (requestUserIdResolved !== userId && !req.user.isOwner && !isAdminEmail(req.user.email)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch (error) {
      // Ako je body prazan ili nevalidan JSON, vrati grešku
      return NextResponse.json(
        { error: 'Invalid or missing request body. Expected valid JSON.' },
        { status: 400 }
      );
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Request body must be a valid JSON object' },
        { status: 400 }
      );
    }

    const { deviceId, deviceName, deviceInfo, role, permissions, isBlocked, status } = body;

    if (!deviceId) {
      return NextResponse.json(
        { error: 'deviceId is required' },
        { status: 400 }
      );
    }

    // Upsert device - use (user_id, device_id) combination to prevent duplicates
    // Check if device exists first to decide whether to update or insert
    const loadExistingDevice = async () => {
      return await query(
        'SELECT id, device_name, device_info, role, permissions, is_blocked, status FROM devices WHERE user_id = $1 AND device_id = $2',
        [userId, deviceId]
      );
    };

    let existingDevice = await loadExistingDevice();
    let existingDeviceRowId: string | null = existingDevice.rows[0]?.id || null;

    // If device not found by device_id, try to find by fingerprint hash (backup mechanism)
    if (existingDevice.rows.length === 0 && deviceInfo?.fingerprintHash) {
      const fingerprintHash = deviceInfo.fingerprintHash;
      const fingerprintResult = await query(
        `SELECT id, device_id, device_name, device_info, role, permissions, is_blocked, status 
         FROM devices 
         WHERE user_id = $1 AND device_info->>'fingerprintHash' = $2`,
        [userId, fingerprintHash]
      );
      
      if (fingerprintResult.rows.length > 0) {
        // Found device by fingerprint - use existing device_id
        existingDevice = fingerprintResult;
        existingDeviceRowId = fingerprintResult.rows[0].id;
        // Nemoj migrirati device_id ovdje (izbjegava lock timeout konflikte).
        // Koristimo postojeći red identificiran po fingerprint-u.
      }
    }

    if (existingDevice.rows.length > 0) {
      // Update existing device - only update fields that are provided
      const existing = existingDevice.rows[0];
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      // Always update last_login and updated_at
      updateFields.push(`last_login = NOW()`, `updated_at = NOW()`);

      // Update device_name if provided, otherwise keep existing
      if (deviceName !== undefined && deviceName !== null) {
        updateFields.push(`device_name = $${paramIndex++}`);
        updateValues.push(deviceName);
      }

      // Update device_info if provided, otherwise keep existing
      if (deviceInfo !== undefined && deviceInfo !== null) {
        updateFields.push(`device_info = $${paramIndex++}`);
        updateValues.push(JSON.stringify(deviceInfo));
      }

      // Update role if provided, otherwise keep existing
      if (role !== undefined) {
        updateFields.push(`role = $${paramIndex++}`);
        updateValues.push(role);
      }

      // Update permissions if provided, otherwise keep existing
      if (permissions !== undefined && permissions !== null) {
        updateFields.push(`permissions = $${paramIndex++}`);
        updateValues.push(JSON.stringify(permissions));
      }

      // Update is_blocked if provided, otherwise keep existing
      if (isBlocked !== undefined) {
        updateFields.push(`is_blocked = $${paramIndex++}`);
        updateValues.push(isBlocked);
      }

      // Update status if provided, otherwise keep existing
      if (status !== undefined && status !== null) {
        updateFields.push(`status = $${paramIndex++}`);
        updateValues.push(status);
      }

      let result: any = null;
      const maxUpdateAttempts = 6;
      for (let attempt = 1; attempt <= maxUpdateAttempts; attempt++) {
        try {
          if (existingDeviceRowId) {
            const rowIdParamIndex = paramIndex;
            result = await query(
              `WITH target_device AS (
                 SELECT id
                 FROM devices
                 WHERE id = $${rowIdParamIndex}
                 FOR UPDATE SKIP LOCKED
                 LIMIT 1
               )
               UPDATE devices 
               SET ${updateFields.join(', ')}
               WHERE id IN (SELECT id FROM target_device)
               RETURNING id, device_id, device_name, device_info, role, permissions, is_blocked, status, last_login, created_at, updated_at`,
              [...updateValues, existingDeviceRowId]
            );
          } else {
            // Fallback path
            const userIdParamIndex = paramIndex;
            const deviceIdParamIndex = paramIndex + 1;
            result = await query(
              `WITH target_device AS (
                 SELECT id
                 FROM devices
                 WHERE user_id::text = $${userIdParamIndex} AND device_id = $${deviceIdParamIndex}
                 FOR UPDATE SKIP LOCKED
                 LIMIT 1
               )
               UPDATE devices 
               SET ${updateFields.join(', ')}
               WHERE id IN (SELECT id FROM target_device)
               RETURNING id, device_id, device_name, device_info, role, permissions, is_blocked, status, last_login, created_at, updated_at`,
              [...updateValues, userId, deviceId]
            );
          }
          break;
        } catch (updateError: any) {
          if (!isLockTimeoutError(updateError) || attempt === maxUpdateAttempts) {
            throw updateError;
          }
          await delay(180 * attempt);
        }
      }

      if (!result || result.rows.length === 0) {
        const existsAfterRetry = await loadExistingDevice();
        if (existsAfterRetry.rows.length > 0) {
          return NextResponse.json(
            { error: 'Device is temporarily busy, please try again.' },
            { status: 409 }
          );
        }

        return NextResponse.json(
          { error: 'Device not found after concurrent update. Please retry.' },
          { status: 404 }
        );
      }

      const device = result.rows[0];
      if (!device) {
        return NextResponse.json(
          { error: 'Device update returned empty result. Please retry.' },
          { status: 409 }
        );
      }
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
    } else {
      // Insert new device
      let result;
      try {
        const maxInsertAttempts = 6;
        for (let attempt = 1; attempt <= maxInsertAttempts; attempt++) {
          try {
            result = await query(
              `INSERT INTO devices (user_id, device_id, device_name, device_info, role, permissions, is_blocked, status, last_login, updated_at)
               VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7, $8, NOW(), NOW())
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
            break;
          } catch (insertAttemptError: any) {
            if (!isLockTimeoutError(insertAttemptError) || attempt === maxInsertAttempts) {
              throw insertAttemptError;
            }
            await delay(180 * attempt);
          }
        }
      } catch (insertError: any) {
        if (insertError?.code === '23505') {
          result = await query(
            `UPDATE devices
             SET user_id = $1,
                 device_name = COALESCE($3, device_name),
                 device_info = COALESCE($4::jsonb, device_info),
                 role = COALESCE($5, role),
                 permissions = COALESCE($6::jsonb, permissions),
                 is_blocked = COALESCE($7, is_blocked),
                 status = COALESCE($8, status),
                 last_login = NOW(),
                 updated_at = NOW()
             WHERE device_id = $2
             RETURNING id, device_id, device_name, device_info, role, permissions, is_blocked, status, last_login, created_at, updated_at`,
            [
              userId,
              deviceId,
              deviceName || null,
              deviceInfo ? JSON.stringify(deviceInfo) : null,
              role || null,
              permissions ? JSON.stringify(permissions) : null,
              isBlocked ?? null,
              status || null,
            ]
          );

          if (!result.rows?.length) {
            throw insertError;
          }
        } else {
          throw insertError;
        }
      }

      if (!result) {
        return NextResponse.json(
          { error: 'Failed to save device - no result returned' },
          { status: 500 }
        );
      }

      const device = result.rows?.[0];
      if (!device) {
        return NextResponse.json(
          { error: 'Failed to retrieve saved device' },
          { status: 500 }
        );
      }
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
    }
  } catch (error: any) {
    console.error('Save device error:', error);
    if (isLockTimeoutError(error)) {
      return NextResponse.json(
        { error: 'Device is temporarily busy, please try again.' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export const GET = (req: NextRequest, context: any) => {
  return withAuth((authReq: AuthRequest) => getHandler(authReq, context))(req);
};

export const POST = (req: NextRequest, context: any) => {
  return withAuth((authReq: AuthRequest) => postHandler(authReq, context))(req);
};

