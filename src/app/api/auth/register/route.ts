import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { generateToken } from '@/lib/jwt';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, confirmPassword } = body;

    // Validation
    if (!email || !password || !confirmPassword) {
      return NextResponse.json(
        { error: 'Email, password, and confirmation are required' },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Check if this is the first user (will be owner)
    const userCount = await query('SELECT COUNT(*) as count FROM users');
    const isFirstUser = parseInt(userCount.rows[0].count) === 0;

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user in transaction
    const result = await transaction(async (client) => {
      // Insert user
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, is_owner, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, role, is_owner, permissions, created_at`,
        [normalizedEmail, passwordHash, isFirstUser, isFirstUser ? 'vlasnik' : null]
      );

      const user = userResult.rows[0];

      // Initialize default cjenovnik (empty array)
      // This will be handled when cjenovnik is first accessed

      // Generate JWT token
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        isOwner: user.is_owner,
      });

      return { user, token };
    });

    // Return success response
    const response = NextResponse.json({
      success: true,
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
        isOwner: result.user.is_owner,
        permissions: result.user.permissions,
      },
      token: result.token,
    });

    // Set token in cookie
    response.cookies.set('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}


