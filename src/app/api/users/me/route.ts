import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isLockTimeoutError(error: any): boolean {
  const message = (error?.message || '').toLowerCase();
  return error?.code === '55P03' || message.includes('lock timeout') || message.includes('could not obtain lock');
}

async function resolveCurrentUserId(req: AuthRequest): Promise<string | null> {
  if (!req.user) return null;

  const tokenUserId = (req.user.userId || '').toString().trim();
  const tokenEmail = (req.user.email || '').toString().trim();

  // 1) Ako userId već izgleda kao UUID, koristi ga direktno
  if (tokenUserId && uuidRegex.test(tokenUserId)) {
    return tokenUserId;
  }

  // 2) Najpouzdanije: lookup preko email-a iz tokena
  if (tokenEmail) {
    const byEmail = await query(
      'SELECT id::text as id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [tokenEmail]
    );

    if (byEmail.rows.length > 0) {
      return byEmail.rows[0].id;
    }
  }

  // 3) Fallback: token userId može biti email ili legacy text id
  if (tokenUserId) {
    const byUserId = await query(
      'SELECT id::text as id FROM users WHERE id::text = $1 OR LOWER(email) = LOWER($1) LIMIT 1',
      [tokenUserId]
    );

    if (byUserId.rows.length > 0) {
      return byUserId.rows[0].id;
    }
  }

  return null;
}

async function handler(req: AuthRequest): Promise<NextResponse> {
  try {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = await resolveCurrentUserId(req);
    if (!userId) {
      return NextResponse.json(
        {
          error: 'User not found. Invalid user identity in token.',
          userId: req.user.userId,
          email: req.user.email,
        },
        { status: 404 }
      );
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
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
      },
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

    const userId = await resolveCurrentUserId(req);
    if (!userId) {
      return NextResponse.json(
        {
          error: 'User not found. Invalid user identity in token.',
          userId: req.user.userId,
          email: req.user.email,
        },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { appName } = body;

    if (appName !== undefined) {
      if (typeof appName !== 'string') {
        return NextResponse.json(
          { error: 'Ime aplikacije mora biti tekst.' },
          { status: 400 }
        );
      }

      const normalizedAppName = appName.trim();
      if (!normalizedAppName) {
        return NextResponse.json(
          { error: 'Ime aplikacije ne može biti prazno.' },
          { status: 400 }
        );
      }

      if (normalizedAppName.length > 255) {
        return NextResponse.json(
          { error: 'Ime aplikacije je predugo (maksimalno 255 znakova).' },
          { status: 400 }
        );
      }

      const maxAttempts = 4;
      let updateSucceeded = false;
      let updatedUserRow: any | null = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const updatedResult = await query(
            `UPDATE users
             SET app_name = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING id, email, app_name, role, is_owner, permissions, created_at, updated_at`,
            [normalizedAppName, userId]
          );

          if (updatedResult.rows.length === 0) {
            return NextResponse.json(
              { error: 'User not found' },
              { status: 404 }
            );
          }

          updatedUserRow = updatedResult.rows[0];
          updateSucceeded = true;
          break;
        } catch (error: any) {
          const isRetryable = isLockTimeoutError(error);
          const isLastAttempt = attempt === maxAttempts;

          if (!isRetryable || isLastAttempt) {
            if (isRetryable) {
              return NextResponse.json(
                { error: 'Podaci su trenutno zauzeti, pokušajte ponovo za par sekundi.' },
                { status: 409 }
              );
            }
            throw error;
          }

          const waitMs = 200 * attempt;
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
      }

      if (!updateSucceeded) {
        return NextResponse.json(
          { error: 'Podaci su trenutno zauzeti, pokušajte ponovo za par sekundi.' },
          { status: 409 }
        );
      }

      return NextResponse.json({
        id: updatedUserRow.id,
        email: updatedUserRow.email,
        appName: updatedUserRow.app_name,
        role: updatedUserRow.role,
        isOwner: updatedUserRow.is_owner,
        permissions: updatedUserRow.permissions || {},
        createdAt: updatedUserRow.created_at,
        updatedAt: updatedUserRow.updated_at,
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          Pragma: 'no-cache',
        },
      });
    }

    // Return current user if no appName update field was provided
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
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
      },
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

