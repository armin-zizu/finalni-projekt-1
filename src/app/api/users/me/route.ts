import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

async function handler(req: AuthRequest): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let userId = req.user.userId;

    // If userId is not a UUID, try to find the actual UUID from database
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(userId)) {
      console.log('Get current user - Non-UUID userId detected, looking up in database:', userId);
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
          console.log('Get current user - Found UUID for user:', userId);
        } else {
          console.error('Get current user - User not found:', userId);
          return NextResponse.json(
            { error: 'User not found. Invalid user ID format.', userId: req.user.userId },
            { status: 404 }
          );
        }
      } catch (lookupError: any) {
        console.error('Get current user - Error looking up user:', lookupError);
        return NextResponse.json(
          { error: 'Failed to resolve user ID', message: lookupError.message },
          { status: 500 }
        );
      }
    }

    // Get user from database
    const result = await query(
      `SELECT id, email, app_name, role, is_owner, permissions, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = result.rows[0];

    return NextResponse.json({
      id: user.id,
      email: user.email,
      appName: user.app_name,
      role: user.role,
      isOwner: user.is_owner,
      permissions: user.permissions || {},
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    });
  } catch (error: any) {
    console.error('Get current user error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// PUT/PATCH - Update current user
async function putHandler(req: AuthRequest): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let userId = req.user.userId;
    
    // If userId is not a UUID, try to find the actual UUID from database
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(userId)) {
      console.log('Update user - Non-UUID userId detected, looking up in database:', userId);
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
          console.log('Update user - Found UUID for user:', userId);
        } else {
          console.error('Update user - User not found:', userId);
          return NextResponse.json(
            { error: 'User not found. Invalid user ID format.', userId: req.user.userId },
            { status: 404 }
          );
        }
      } catch (lookupError: any) {
        console.error('Update user - Error looking up user:', lookupError);
        return NextResponse.json(
          { error: 'Failed to resolve user ID', message: lookupError.message },
          { status: 500 }
        );
      }
    }

    const body = await req.json();
    const { appName } = body;

    if (appName !== undefined) {
      await query(
        'UPDATE users SET app_name = $1, updated_at = NOW() WHERE id = $2',
        [appName, userId]
      );
    }

    // Return updated user
    const result = await query(
      `SELECT id, email, app_name, role, is_owner, permissions, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = result.rows[0];

    return NextResponse.json({
      id: user.id,
      email: user.email,
      appName: user.app_name,
      role: user.role,
      isOwner: user.is_owner,
      permissions: user.permissions || {},
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    });
  } catch (error: any) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export const GET = withAuth(handler);
export const PUT = withAuth(putHandler);
export const PATCH = withAuth(putHandler);

