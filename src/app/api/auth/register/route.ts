import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { generateToken } from '@/lib/jwt';

export async function POST(req: NextRequest) {
  try {
    // Check if JWT_SECRET is configured
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

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
      'SELECT id, password_hash, role, is_owner FROM users WHERE email = $1',
      [normalizedEmail]
    );

    // If user exists and has password_hash, reject
    if (existingUser.rows.length > 0 && existingUser.rows[0].password_hash) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // If user exists but has no password_hash, we'll update it instead of creating new
    const isUpdatingExisting = existingUser.rows.length > 0 && !existingUser.rows[0].password_hash;

    // Check if this is the first user with password for THIS EMAIL (will be owner of this account)
    // Svaki email/nalog ima svog vlasnika - prvi korisnik koji se registruje sa tim emailom
    let isFirstUserWithPasswordForThisEmail = false;
    try {
      // Proveri da li već postoji korisnik sa tim emailom koji ima password_hash
      const userCountForEmail = await query(
        'SELECT COUNT(*) as count FROM users WHERE email = $1 AND password_hash IS NOT NULL',
        [normalizedEmail]
      );
      isFirstUserWithPasswordForThisEmail = parseInt(userCountForEmail.rows[0].count) === 0;
    } catch (countError: any) {
      console.error('Error counting users for email:', countError);
      // Default to false if count fails
      isFirstUserWithPasswordForThisEmail = false;
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create or update user in transaction
    const result = await transaction(async (client) => {
      let user;
      
      if (isUpdatingExisting) {
        // Update existing user with password_hash
        const existingUserId = existingUser.rows[0].id;
        const existingRole = existingUser.rows[0].role;
        const existingIsOwner = existingUser.rows[0].is_owner;
        
        // Set as owner if this is the first user with password for this email
        // Ne menjamo existingIsOwner ako je već postavljen (možda je već vlasnik)
        const finalRole = existingRole || (isFirstUserWithPasswordForThisEmail ? 'vlasnik' : null);
        const finalIsOwner = existingIsOwner || isFirstUserWithPasswordForThisEmail;
        
        const userResult = await client.query(
          `UPDATE users 
           SET password_hash = $1, 
               role = COALESCE(role, $2),
               is_owner = $3,
               updated_at = NOW()
           WHERE id = $4
           RETURNING id, email, role, is_owner, permissions, created_at`,
          [passwordHash, finalRole, finalIsOwner, existingUserId]
        );
        
        user = userResult.rows[0];
      } else {
        // Insert new user
        // Prvi korisnik sa tim emailom dobija is_owner=true i role='vlasnik'
        // Generiši UUID eksplicitno - koristimo gen_random_uuid() ili DEFAULT
        const userResult = await client.query(
          `INSERT INTO users (id, email, password_hash, is_owner, role)
           VALUES (gen_random_uuid(), $1, $2, $3, $4)
           RETURNING id, email, role, is_owner, permissions, created_at`,
          [normalizedEmail, passwordHash, isFirstUserWithPasswordForThisEmail, isFirstUserWithPasswordForThisEmail ? 'vlasnik' : null]
        );
        
        user = userResult.rows[0];
      }

      // const user = userResult.rows[0];

      // Initialize default cjenovnik (empty array)
      // This will be handled when cjenovnik is first accessed

      // Generate JWT token - koristimo email kao userId (glavni identifikator)
      const token = generateToken({
        userId: user.email, // Email je glavni identifikator
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
      httpOnly: false, // Allow JavaScript access for client-side API calls
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Registration error:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      stack: error.stack,
    });
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: error.message,
        detail: error.detail || error.hint || 'Please check server logs for more details'
      },
      { status: 500 }
    );
  }
}


