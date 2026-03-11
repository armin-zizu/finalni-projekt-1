import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthRequest } from '@/lib/auth-middleware';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Vrati trenutni PIN korisnika
export const GET = withAuth(async (req: AuthRequest) => {
  const userId = req.user?.userId;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await query('SELECT ulaz_pin FROM users WHERE id = $1', [userId]);
  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  return NextResponse.json({ pin: result.rows[0].ulaz_pin ?? null });
});

// PUT - Promijeni PIN korisnika
export const PUT = withAuth(async (req: AuthRequest) => {
  const userId = req.user?.userId;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const { newPin } = body;
  if (!newPin || typeof newPin !== 'string' || newPin.length !== 4 || !/^[0-9]{4}$/.test(newPin)) {
    return NextResponse.json({ error: 'PIN mora imati 4 broja.' }, { status: 400 });
  }
  await query('UPDATE users SET ulaz_pin = $1 WHERE id = $2', [newPin, userId]);
  return NextResponse.json({ success: true });
});
