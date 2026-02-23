import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendEmail } from '@/lib/send-email';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Unesi validan e-mail.' }, { status: 400 });
    }

    // Provjeri da li korisnik postoji
    const result = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Korisnik sa tim e-mailom ne postoji.' }, { status: 404 });
    }

    // Generiši token za reset lozinke (može biti random string)
    const resetToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
    // Spremi token u bazu (pretpostavljamo da postoji tabela reset_password)
    await query('INSERT INTO reset_password (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'1 hour\')', [result.rows[0].id, resetToken]);

    // Pošalji e-mail korisniku
    const resetLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/new-password?token=${resetToken}`;
    await sendEmail({
      to: email,
      subject: 'Reset lozinke',
      text: `Klikni na link za reset lozinke: ${resetLink}`,
    });

    return NextResponse.json({ success: true, message: 'Link za reset lozinke je poslan na e-mail.' });
  } catch (error: any) {
    console.error('Greška pri resetu lozinke:', error);
    return NextResponse.json({ error: 'Greška pri resetu lozinke.', message: error.message }, { status: 500 });
  }
}
