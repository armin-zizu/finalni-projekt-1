import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { comparePassword } from '@/lib/password';
import { generateToken } from '@/lib/jwt';

export async function POST(req: NextRequest) {
  try {
    console.log('Login attempt started');
    
    // Check if JWT_SECRET is configured
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { email, password } = body;
    
    console.log('Login request for email:', email);

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
    let result;
    try {
      console.log('Querying database for user:', email.toLowerCase().trim());
      result = await query(
        'SELECT id, email, password_hash, role, is_owner, permissions FROM users WHERE email = $1',
        [email.toLowerCase().trim()]
      );
      console.log('Database query result:', { rowCount: result.rows.length, hasPasswordHash: result.rows[0]?.password_hash ? true : false });
    } catch (dbError: any) {
      console.error('Database query error in login:', dbError);
      console.error('Database error details:', {
        message: dbError.message,
        code: dbError.code,
        detail: dbError.detail,
        hint: dbError.hint,
        stack: dbError.stack,
      });
      return NextResponse.json(
        { error: 'Database connection error', message: dbError.message },
        { status: 500 }
      );
    }

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const user = result.rows[0];

    // Verify password
    let isValidPassword;
    try {
      if (!user.password_hash) {
        console.error('User has no password_hash:', user.email);
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        );
      }
      isValidPassword = await comparePassword(password, user.password_hash);
    } catch (passwordError: any) {
      console.error('Password comparison error:', passwordError);
      return NextResponse.json(
        { error: 'Password verification failed', message: passwordError.message },
        { status: 500 }
      );
    }
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Generate JWT token
    let token;
    try {
      token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        isOwner: user.is_owner,
      });
    } catch (tokenError: any) {
      console.error('JWT generation error:', tokenError);
      return NextResponse.json(
        { error: 'Token generation failed', message: tokenError.message },
        { status: 500 }
      );
    }

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

    // Set token in cookie (non-httpOnly for now, so JavaScript can access it)
    // TODO: For production, consider using httpOnly cookies and server-side token validation
    response.cookies.set('token', token, {
      httpOnly: false, // Allow JavaScript access for client-side API calls
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


