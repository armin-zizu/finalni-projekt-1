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

async function resolveUserIdToUuid(userIdOrEmail: string | undefined | null): Promise<string | null> {
  if (!userIdOrEmail || typeof userIdOrEmail !== 'string') return null;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(userIdOrEmail)) return userIdOrEmail;

  const result = await query(
    'SELECT id::text as id FROM users WHERE id::text = $1 OR LOWER(email) = LOWER($1) LIMIT 1',
    [userIdOrEmail]
  );

  return result.rows[0]?.id || null;
}

// PUT - Update device
async function putHandler(req: AuthRequest, { params }: { params: Promise<{ userId: string; deviceId: string }> | { userId: string; deviceId: string } }): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    const deviceId = resolvedParams.deviceId;

    if (!deviceId || typeof deviceId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid device id' },
        { status: 400 }
      );
    }

    const jwtUserIdResolved = await resolveUserIdToUuid(req.user.userId || req.user.email);
    if (!jwtUserIdResolved) {
      console.error('Update device - JWT userId not found:', req.user.userId, req.user.email);
      return NextResponse.json(
        { error: 'User not found. Please log out and log in again.' },
        { status: 404 }
      );
    }

    const requestedUserIdResolved = await resolveUserIdToUuid(resolvedParams.userId);

    if (!requestedUserIdResolved) {
      return NextResponse.json(
        { error: 'Requested user not found' },
        { status: 404 }
      );
    }

    console.log('Update device - JWT userId:', req.user.userId, '-> resolved:', jwtUserIdResolved, 'Requested userId:', resolvedParams.userId, '-> resolved:', requestedUserIdResolved, 'deviceId:', deviceId);

    // Check if user can modify devices (compare resolved UUIDs)
    if (!req.user.isOwner && !isAdminEmail(req.user.email) && (!requestedUserIdResolved || jwtUserIdResolved !== requestedUserIdResolved)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { deviceName, role, permissions, isBlocked, status } = body;

    // Update device
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (deviceName !== undefined) {
      updateFields.push(`device_name = $${paramIndex++}`);
      updateValues.push(deviceName);
    }
    if (role !== undefined) {
      updateFields.push(`role = $${paramIndex++}`);
      updateValues.push(role);
    }
    if (permissions !== undefined) {
      updateFields.push(`permissions = $${paramIndex++}::jsonb`);
      updateValues.push(JSON.stringify(permissions ?? {}));
    }
    if (isBlocked !== undefined) {
      updateFields.push(`is_blocked = $${paramIndex++}`);
      updateValues.push(isBlocked);
    }
    if (status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      updateValues.push(status);
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    updateFields.push(`updated_at = NOW()`);
    const deviceIdParamIndex = paramIndex;
    const userIdParamIndex = paramIndex + 1;
    updateValues.push(deviceId.trim());
    const targetUserId = req.user.isOwner ? requestedUserIdResolved : jwtUserIdResolved;
    updateValues.push(targetUserId);

    // Use SKIP LOCKED so we don't wait for locked rows (avoids 55P03 lock timeout)
    // If row is locked by another transaction, update returns 0 rows and we respond 409.
    const sql = `WITH target_device AS (
        SELECT id
        FROM devices
        WHERE (device_id = $${deviceIdParamIndex} OR id::text = $${deviceIdParamIndex})
          AND user_id::text = $${userIdParamIndex}
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE devices
      SET ${updateFields.join(', ')}
      WHERE id IN (SELECT id FROM target_device)
      RETURNING id, device_id, device_name, device_info, role, permissions, is_blocked, status, last_login, created_at, updated_at`;

    console.log('Update device query:', {
      jwtUserIdResolved,
      deviceId,
      updateFields: updateFields.join(', '),
      paramCount: updateValues.length,
      deviceIdParamIndex
    });

    // Retry a few times: SKIP LOCKED returns 0 rows when row is currently locked.
    // This avoids spamming the client with repeated 409s for short, frequent locks.
    const maxAttempts = 12;
    let result: any = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      result = await query(sql, updateValues);

      if (result.rows.length > 0) {
        break;
      }

      if (attempt < maxAttempts) {
        await delay(120 * attempt);
      }
    }

    console.log('Update device result:', { rows: result.rows.length, found: result.rows.length > 0 });

    if (result.rows.length === 0) {
      // Could be either: (a) device doesn't exist, or (b) row is locked and skipped.
      const existsResult = await query(
        `SELECT 1
         FROM devices
         WHERE (device_id = $1 OR id::text = $1)
           AND user_id::text = $2
         LIMIT 1`,
        [deviceId.trim(), targetUserId]
      );

      if (existsResult.rows.length > 0) {
        return NextResponse.json(
          { error: 'Device is temporarily busy, please try again.' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      );
    }

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
    console.error('Update device error:', {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
      hint: error?.hint,
      stack: error?.stack,
    });
    return NextResponse.json(
      { error: error?.message || 'Internal server error', code: error?.code, detail: error?.detail, hint: error?.hint },
      { status: 500 }
    );
  }
}

// DELETE - Delete device
async function deleteHandler(req: AuthRequest, { params }: { params: { userId: string; deviceId: string } }): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Resolve userId from JWT token to UUID if needed
    let userId = req.user.userId;
    const deviceId = params.deviceId;
    let requestedUserId = params.userId;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    // Resolve JWT userId to UUID if needed
    if (!uuidRegex.test(userId)) {
      let userResult;
      if (emailRegex.test(userId)) {
        userResult = await query(
          'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
          [userId]
        );
      } else {
        userResult = await query(
          'SELECT id FROM users WHERE id::text = $1 OR LOWER(email) = LOWER($1) LIMIT 1',
          [userId]
        );
      }
      if (userResult.rows.length > 0) {
        userId = userResult.rows[0].id;
      } else {
        console.error('Delete device - JWT userId not found:', req.user.userId);
        return NextResponse.json(
          { error: 'User not found. Please log out and log in again.' },
          { status: 404 }
        );
      }
    }
    
    // Resolve requested userId to UUID if needed
    let requestedUserIdResolved = requestedUserId;
    if (!uuidRegex.test(requestedUserId)) {
      let userResult;
      if (emailRegex.test(requestedUserId)) {
        userResult = await query(
          'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
          [requestedUserId]
        );
      } else {
        // For non-email, non-UUID values like "admin-user", try to find by email from JWT
        if (req.user.email) {
          userResult = await query(
            'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
            [req.user.email]
          );
        } else {
          userResult = await query(
            'SELECT id FROM users WHERE id = $1 LIMIT 1',
            [requestedUserId]
          );
        }
      }
      if (userResult.rows.length > 0) {
        requestedUserIdResolved = userResult.rows[0].id;
      } else {
        // If requestedUserId can't be resolved and user is owner, use the resolved JWT userId
        // This allows owner to delete devices when URL has "admin-user" or other non-existent user ID
        if (req.user.isOwner) {
          console.log('Delete device - Could not resolve requestedUserId, but user is owner. Using JWT userId:', requestedUserId, '->', userId);
          requestedUserIdResolved = userId;
        } else {
          console.error('Delete device - Could not resolve requestedUserId and user is not owner:', requestedUserId);
          return NextResponse.json(
            { error: 'User not found' },
            { status: 404 }
          );
        }
      }
    }

    // Check if user can delete devices (compare resolved UUIDs)
    // Owner može brisati bilo koji uređaj; ostali samo svoje
    if (userId !== requestedUserIdResolved && !req.user.isOwner && !isAdminEmail(req.user.email)) {
      console.warn('Delete device - Forbidden:', { userId, requestedUserIdResolved, isOwner: req.user.isOwner });
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Ako je owner, dozvoli brisanje bez obzira na requestedUserId (briši po device_id)
    // Inače briši samo svoje (po user_id i device_id)
    const userIdForDelete = req.user.isOwner ? null : requestedUserIdResolved;

    // Validate deviceId
    if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length === 0) {
      console.error('Delete device - Invalid deviceId:', deviceId);
      return NextResponse.json(
        { error: 'Invalid device ID' },
        { status: 400 }
      );
    }

    // Ako nije owner, userIdForDelete mora biti validan UUID
    if (!req.user.isOwner) {
      if (!userIdForDelete || !uuidRegex.test(userIdForDelete)) {
        console.error('Delete device - userIdForDelete is not a valid UUID:', userIdForDelete);
        return NextResponse.json(
          { error: 'Invalid user ID format' },
          { status: 400 }
        );
      }
    }

    console.log('Delete device - Attempting to delete:', {
      userId,
      userIdForDelete,
      deviceId,
      requestedUserId: params.userId,
      resolvedRequestedUserId: requestedUserIdResolved,
      jwtUserId: req.user.userId,
      isOwner: req.user.isOwner
    });

    let deleteResult;
    try {
      if (req.user.isOwner) {
        // Owner briše po device_id (bez user_id uslova)
        deleteResult = await query(
          'DELETE FROM devices WHERE device_id = $1 RETURNING id',
          [deviceId.trim()]
        );
      } else {
        // Ostali brišu samo svoje uređaje
        deleteResult = await query(
          'DELETE FROM devices WHERE user_id = $1 AND device_id = $2 RETURNING id',
          [userIdForDelete, deviceId.trim()] // Use resolved UUID and trimmed deviceId
        );
      }
    } catch (sqlError: any) {
      console.error('Delete device - SQL error:', {
        message: sqlError.message,
        code: sqlError.code,
        detail: sqlError.detail,
        hint: sqlError.hint,
        userIdForDelete,
        deviceId,
        userIdForDeleteType: typeof userIdForDelete,
        deviceIdType: typeof deviceId
      });
      throw sqlError;
    }
    
    console.log('Delete device - Result:', {
      rowsDeleted: deleteResult.rows.length,
      deletedId: deleteResult.rows[0]?.id
    });
    
    if (deleteResult.rows.length === 0) {
      console.warn('Delete device - Device not found:', { userId, deviceId });
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: 'Device deleted' });
  } catch (error: any) {
    console.error('Delete device error:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      stack: error.stack,
      userId: params.userId,
      deviceId: params.deviceId
    });
    return NextResponse.json(
      { error: 'Internal server error', message: error.message, detail: error.detail || error.hint },
      { status: 500 }
    );
  }
}

export const PUT = (req: NextRequest, context: { params: Promise<{ userId: string; deviceId: string }> | { userId: string; deviceId: string } }) => {
  return withAuth((authReq: AuthRequest) => putHandler(authReq, context))(req);
};

export const DELETE = (req: NextRequest, context: { params: { userId: string; deviceId: string } }) => {
  return withAuth((authReq: AuthRequest) => deleteHandler(authReq, context))(req);
};

