import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { comparePassword } from '@/lib/password';
import { generateToken } from '@/lib/jwt';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Find user by email
    const result = await query(
      'SELECT id, email, password_hash, role, is_owner, permissions FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await comparePassword(password, user.password_hash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      isOwner: user.is_owner,
    });

    // Update last login time (if you have that column)
    try {
      await query(
        'UPDATE users SET updated_at = NOW() WHERE id = $1',
        [user.id]
      );
    } catch (error) {
      console.error('Error updating last login:', error);
      // Don't fail login if this fails
    }

    // Return success response
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isOwner: user.is_owner,
        permissions: user.permissions,
      },
      token,
    });

    // Set token in cookie (optional, for httpOnly cookies)
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}


