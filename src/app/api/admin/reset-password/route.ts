import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * Admin password reset endpoint
 * Usage: POST /api/admin/reset-password
 * Body: { email, newPassword, adminSecret }
 * 
 * This is a temporary endpoint for admin password recovery
 * Should only work with correct ADMIN_SECRET env var
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, newPassword, adminSecret } = body;

    // Verify admin secret
    const expectedSecret = process.env.ADMIN_SECRET;
    if (!expectedSecret || adminSecret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Invalid admin secret' },
        { status: 403 }
      );
    }

    if (!email || !newPassword) {
      return NextResponse.json(
        { error: 'Email and newPassword are required' },
        { status: 400 }
      );
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update user
    const result = await query(
      'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id, email',
      [passwordHash, email]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log(`Admin reset password for: ${email}`);

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully',
      user: result.rows[0],
    });
  } catch (error: any) {
    console.error('Admin reset password error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
