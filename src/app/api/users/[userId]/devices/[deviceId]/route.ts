import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

// PUT - Update device
async function putHandler(req: AuthRequest, { params }: { params: { userId: string; deviceId: string } }): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = params.userId;
    const deviceId = params.deviceId;

    // Check if user can modify devices
    if (req.user.userId !== userId && !req.user.isOwner) {
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
      updateFields.push(`permissions = $${paramIndex++}`);
      updateValues.push(JSON.stringify(permissions));
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
    updateValues.push(userId, deviceId);

    const result = await query(
      `UPDATE devices
       SET ${updateFields.join(', ')}
       WHERE user_id = $${paramIndex} AND device_id = $${paramIndex + 1}
       RETURNING id, device_id, device_name, device_info, role, permissions, is_blocked, status, last_login, created_at, updated_at`,
      updateValues
    );

    if (result.rows.length === 0) {
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
    console.error('Update device error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
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

    const userId = params.userId;
    const deviceId = params.deviceId;

    // Check if user can delete devices
    if (req.user.userId !== userId && !req.user.isOwner) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    await query(
      'DELETE FROM devices WHERE user_id = $1 AND device_id = $2',
      [userId, deviceId]
    );

    return NextResponse.json({ success: true, message: 'Device deleted' });
  } catch (error: any) {
    console.error('Delete device error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export const PUT = (req: NextRequest, context: { params: { userId: string; deviceId: string } }) => {
  return withAuth((authReq: AuthRequest) => putHandler(authReq, context))(req);
};

export const DELETE = (req: NextRequest, context: { params: { userId: string; deviceId: string } }) => {
  return withAuth((authReq: AuthRequest) => deleteHandler(authReq, context))(req);
};

